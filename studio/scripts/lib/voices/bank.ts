// Voices for a whole story. Every character gets a *chain* of engines (their choice, then fallbacks). A character is
// only ever voiced by one engine per video (never half and half), the first engine in their chain that completes all
// their lines with clips that pass the sanity gate. Finished lines are cached, so re-running costs nothing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Delivery, Emotion, Story } from '../../../src/types.ts';
import { CACHE_DIR } from '../paths.ts';
import { encodeWav, parseWav, trimSilence, type Pcm } from '../wav.ts';
import { checkClip, ensure24k, joinPcm, limitPeak, masterPcm } from './audio.ts';
import { ENGINE_IMPL, engineState, readStatus, verifyEnabled, type EngineName, type Log, type Task } from './engines.ts';
import { anchorTextFor, CHATTERBOX_LANGS, chatterboxParams, DELIVERY, edgeProsody, kokoroCandidates, kokoroLang, kokoroSpeed, languageOf, splitSentences, type Voice } from './presets.ts';

const CACHE_VERSION = 'v5';
const VOICE_CACHE = path.join(CACHE_DIR, 'voices');
const ANCHOR_CACHE = path.join(CACHE_DIR, 'anchors');
const AUTO: EngineName[] = ['chatterbox', 'kokoro', 'edge', 'sapi'];
const FALLBACK: Record<EngineName, EngineName[]> = { edge: ['sapi'], sapi: ['edge'], kokoro: ['edge', 'sapi'], chatterbox: ['kokoro', 'edge', 'sapi'] };

export type VoiceBank = {
  get(shot: number, line: number): Pcm;
  voices: Record<string, { engine: string; delivery: string; requested: string; note?: string }>;
  warnings: string[];
};

type Char = Story['characters'][number];
type Plan = { char: Char; voice: Voice; delivery: Delivery; requested: string; chain: EngineName[]; at: number; notes: string[] };
type Line = { si: number; li: number; key: string; text: string; emotion: Emotion; charId: string };

const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 24);
const seedOf = (s: string) => parseInt(sha(s).slice(0, 8), 16) % 2147483647;

function supports(engine: EngineName, lang: string): boolean {
  if (engine === 'kokoro') return kokoroLang({ language: lang, edge: `${lang}-XX`, gender: 'male' } as Voice) !== undefined;
  if (engine === 'chatterbox') return CHATTERBOX_LANGS.includes(lang);
  if (engine === 'sapi') return lang === 'en';
  return true;
}

function buildChain(requested: string, lang: string, notes: string[]): EngineName[] {
  const want = requested === 'auto' ? AUTO : ([requested, ...FALLBACK[requested as EngineName]] as EngineName[]);
  const out: EngineName[] = [];
  for (const e of want) {
    const st = engineState(e);
    if (!supports(e, lang)) {
      if (e === requested) notes.push(`${e} does not support "${lang}"`);
      continue;
    }
    if (st.state === 'missing') {
      if (e === requested || requested === 'auto') notes.push(`${e}: ${st.reason}`);
      continue;
    }
    if (st.state === 'unchecked' && requested === 'auto') continue; // auto only trusts engines that passed a health check
    out.push(e);
  }
  if (!out.includes('edge')) out.push('edge'); // last resort that always exists
  return out;
}

const planSentences = (engine: EngineName, text: string, delivery: Delivery) => (engine !== 'kokoro' && DELIVERY[delivery].split ? splitSentences(text) : [text]);

function signature(engine: EngineName, p: Plan, text: string, emotion: Emotion, anchorKey: string, seed: number): string {
  const v = p.voice;
  const em = DELIVERY[p.delivery].emotionAware ? emotion : 'neutral';
  const base = { engine, text, parts: planSentences(engine, text, p.delivery), delivery: p.delivery, v: CACHE_VERSION };
  if (engine === 'edge') return JSON.stringify({ ...base, ...edgeProsody(v, p.delivery, emotion), voice: v.edge });
  if (engine === 'sapi') return JSON.stringify({ ...base, gender: v.gender, rate: edgeProsody(v, p.delivery, emotion).rate });
  if (engine === 'kokoro') return JSON.stringify({ ...base, voice: v.kokoro, lang: kokoroLang(v), speed: kokoroSpeed(p.delivery, emotion), pause: DELIVERY[p.delivery].pause });
  return JSON.stringify({ ...base, lang: languageOf(v), ...chatterboxParams(v, p.delivery, em), anchor: anchorKey, seed, verified: verifyEnabled() });
}


async function assemble(parts: Pcm[], delivery: Delivery): Promise<Pcm> {
  const d = DELIVERY[delivery];
  const fixed = await Promise.all(parts.map(ensure24k));
  let pcm = fixed.length === 1 ? fixed[0] : joinPcm(fixed, d.pause);
  if (d.master) pcm = await masterPcm(pcm);
  return limitPeak(trimSilence(pcm));
}

function readCache(file: string, text: string): Pcm | null {
  try {
    const pcm = parseWav(fs.readFileSync(file));
    return checkClip(pcm, text, 8) === null ? pcm : null;
  } catch {
    return null;
  }
}

export async function prepareVoices(story: Story, opts: { provider: string; delivery?: Delivery }, log: Log): Promise<VoiceBank> {
  fs.mkdirSync(VOICE_CACHE, { recursive: true });
  fs.mkdirSync(ANCHOR_CACHE, { recursive: true });
  const warnings: string[] = [];
  const warn = (m: string) => {
    warnings.push(m);
    log(`  warning: ${m}`);
  };

  // unique Kokoro voices for characters that did not pick one, so two women (or two men) never share a voice
  const taken = new Set(story.characters.map((c) => c.voice.kokoro).filter(Boolean) as string[]);
  const available = readStatus().kokoro?.voices;
  const plans = new Map<string, Plan>();
  for (const c of story.characters) {
    const voice: Voice = { ...c.voice };
    if (voice.kokoro && available && !available.includes(voice.kokoro)) {
      warn(`${c.id}: Kokoro voice "${voice.kokoro}" does not exist, using a default one instead (see studio/voice/.status.json for the list)`);
      voice.kokoro = undefined;
    }
    if (!voice.kokoro) {
      const list = kokoroCandidates(voice).filter((v) => !available || available.includes(v));
      voice.kokoro = list.find((v) => !taken.has(v)) ?? list[0] ?? kokoroCandidates(voice)[0];
      taken.add(voice.kokoro);
    }
    const requested = opts.provider !== 'auto' ? opts.provider : voice.engine;
    const notes: string[] = [];
    plans.set(c.id, { char: c, voice, delivery: opts.delivery ?? voice.delivery, requested, chain: buildChain(requested, languageOf(voice), notes), at: 0, notes });
  }

  const lines: Line[] = [];
  story.shots.forEach((s, si) => s.lines.forEach((l, li) => lines.push({ si, li, key: `${si}:${li}`, text: l.text, emotion: l.emotion, charId: l.speaker })));
  const done = new Map<string, Pcm>(); // line key -> final clip
  const used = new Map<string, { engine: EngineName; cached: number; made: number }>();
  const pending = new Set(story.characters.filter((c) => lines.some((l) => l.charId === c.id)).map((c) => c.id));
  const stats = { cached: 0, made: 0 };

  // anchors: a short reference clip per character so Chatterbox voices sound different from each other
  async function anchorFor(p: Plan): Promise<{ file?: string; key: string }> {
    const lang = languageOf(p.voice);
    const text = anchorTextFor(lang);
    const src = (['kokoro', 'edge'] as EngineName[]).find((e) => supports(e, lang) && engineState(e).state !== 'missing') ?? 'edge';
    const key = sha(`anchor|${CACHE_VERSION}|${src}|${src === 'kokoro' ? p.voice.kokoro : p.voice.edge}|${p.voice.gender}|${lang}|${text}`);
    const file = path.join(ANCHOR_CACHE, `${key}.wav`);
    if (fs.existsSync(file) && fs.statSync(file).size > 60_000) return { file, key };
    try {
      const task: Task = { key: 'anchor', sentences: [text], voice: p.voice, emotion: 'neutral', delivery: 'natural', seed: 1 };
      const res = (await ENGINE_IMPL[src].synth([task], log)).get('anchor');
      if (!res || res instanceof Error) throw res ?? new Error('no result');
      const pcm = trimSilence(await assemble(res, 'natural'));
      if (pcm.samples.length / pcm.sampleRate < 4) throw new Error('anchor clip too short');
      fs.writeFileSync(file, encodeWav(pcm));
      return { file, key };
    } catch (e) {
      warn(`could not make a voice anchor for ${p.char.id} (${(e as Error).message}); its Chatterbox voice may sound like the default voice`);
      return { key: 'none' };
    }
  }

  async function runPass(engine: EngineName, group: Plan[]) {
    // 1) serve from cache, collect what still has to be made
    type Work = { p: Plan; line: Line; sig: string; file: string; sentences: string[]; seed: number; anchor?: string };
    const work: Work[] = [];
    const have = new Map<string, Pcm>();
    for (const p of group) {
      const anchor = engine === 'chatterbox' ? await anchorFor(p) : { key: '' as string, file: undefined };
      for (const line of lines.filter((l) => l.charId === p.char.id)) {
        const seed = seedOf(`${p.char.id}|${line.text}`);
        const sig = signature(engine, p, line.text, line.emotion, anchor.key, seed);
        const file = path.join(VOICE_CACHE, `${sha(sig)}.wav`);
        const hit = readCache(file, line.text);
        if (hit) have.set(`${p.char.id}|${line.key}`, hit);
        else work.push({ p, line, sig, file, sentences: planSentences(engine, line.text, p.delivery), seed, anchor: anchor.file });
      }
    }
    // 2) make the missing lines
    const failed = new Map<string, string>(); // char id -> reason
    const made = new Map<string, Pcm>();
    if (work.length) {
      const state = engineState(engine);
      log(`  ${engine}: making ${work.length} line(s) for ${[...new Set(work.map((w) => w.p.char.id))].join(', ')}${state.state === 'unchecked' ? ' (engine not health-checked)' : ''}`);
      let todo = work;
      for (let attempt = 0; attempt < (engine === 'chatterbox' ? 2 : 1) && todo.length; attempt++) {
        const tasks: Task[] = todo.map((w) => ({ key: w.line.key + '@' + w.p.char.id, sentences: w.sentences, voice: w.p.voice, emotion: w.line.emotion, delivery: w.p.delivery, seed: w.seed + attempt * 7919, anchor: w.anchor }));
        const results = await ENGINE_IMPL[engine].synth(tasks, log);
        const retry: Work[] = [];
        for (const w of todo) {
          const r = results.get(w.line.key + '@' + w.p.char.id);
          let why: string | null = null;
          if (!r || r instanceof Error) why = r instanceof Error ? r.message : 'no result';
          else {
            try {
              const pcm = await assemble(r, w.p.delivery);
              why = checkClip(pcm, w.line.text, (w.sentences.length - 1) * DELIVERY[w.p.delivery].pause + 1);
              if (!why) {
                fs.writeFileSync(w.file, encodeWav(pcm));
                made.set(`${w.p.char.id}|${w.line.key}`, pcm);
              }
            } catch (e) {
              why = (e as Error).message;
            }
          }
          if (why) {
            if (attempt === 0 && engine === 'chatterbox' && !(results.get(w.line.key + '@' + w.p.char.id) instanceof Error)) retry.push(w);
            else failed.set(w.p.char.id, `line "${w.line.text.slice(0, 40)}": ${why}`);
          }
        }
        todo = retry;
      }
      for (const w of todo) failed.set(w.p.char.id, `line "${w.line.text.slice(0, 40)}": failed the quality check twice`);
    }
    // 3) commit characters that completed, push the others down their chain
    for (const p of group) {
      if (failed.has(p.char.id)) {
        const reason = `${engine} failed (${failed.get(p.char.id)})`;
        p.notes.push(reason);
        p.at++;
        log(`  ${reason}; trying ${p.chain[p.at] ?? 'nothing else'}`);
        if (p.at >= p.chain.length) throw new Error(`No voice engine could voice "${p.char.id}". ${p.notes.join(' | ')}`);
        continue;
      }
      let c = 0;
      let m = 0;
      for (const line of lines.filter((l) => l.charId === p.char.id)) {
        const k = `${p.char.id}|${line.key}`;
        const pcm = have.get(k) ?? made.get(k)!;
        if (have.has(k)) c++;
        else m++;
        done.set(line.key, pcm);
      }
      used.set(p.char.id, { engine, cached: c, made: m });
      stats.cached += c;
      stats.made += m;
      pending.delete(p.char.id);
    }
  }

  while (pending.size) {
    const groups = new Map<EngineName, Plan[]>();
    for (const id of pending) {
      const p = plans.get(id)!;
      const e = p.chain[p.at];
      groups.set(e, [...(groups.get(e) ?? []), p]);
    }
    for (const [engine, group] of groups) await runPass(engine, group);
  }

  const voices: VoiceBank['voices'] = {};
  for (const [id, p] of plans) {
    const u = used.get(id);
    if (!u) continue;
    const note = u.engine !== p.requested && p.requested !== 'auto' ? p.notes.join(' | ') : undefined;
    voices[id] = { engine: u.engine, delivery: p.delivery, requested: p.requested, note };
    log(`  ${id} → ${u.engine} (${p.delivery})${u.cached ? `, ${u.cached} cached` : ''}${u.made ? `, ${u.made} new` : ''}${note ? `  [wanted ${p.requested}: ${note}]` : ''}`);
    if (note) warn(`${id}: using ${u.engine} instead of ${p.requested}`);
  }
  return { get: (si, li) => done.get(`${si}:${li}`)!, voices, warnings };
}
