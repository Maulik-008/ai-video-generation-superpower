// Word timings for every voiced line, so captions light up word by word and the mouth, captions and voice agree.
// Best: Whisper's word timestamps (voice/align_words.py, in the Chatterbox environment, no extra download), matched
// back onto the script's own words. Otherwise an estimate that spreads the words over the voiced parts of the clip.
// Results are cached by the clip's audio, so a rebuild never starts Python for lines that did not change.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { stripTags } from '../../src/types.ts';
import { CACHE_DIR, STUDIO_ROOT } from './paths.ts';
import { MODELS_DIR, venvPython } from './voices/engines.ts';
import { voicedRuns, type Pcm } from './wav.ts';

export type Word = { text: string; start: number; end: number }; // seconds within the clip
export type Timed = { words: Word[]; timing: 'whisper' | 'estimate' };
export type AlignItem = { id: string; file: string; text: string; lang: string; pcm: Pcm };

const ALIGN_CACHE = path.join(CACHE_DIR, 'align');
const WHISPER = 'openai/whisper-small';

/** The caption words of a line: tags removed, split on spaces (scripts without spaces stay one word). */
export const captionWords = (text: string) => stripTags(text).split(/\s+/).filter(Boolean);

const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').replace(/़/g, '');

/** Rough syllable weight, used to share time between words. */
function weight(w: string): number {
  const n = norm(w);
  if (!n) return 0.4;
  if (/^[a-z0-9]+$/.test(n)) return Math.max(1, (n.match(/[aeiouy]+/g) ?? []).length) + (/[.?!,;:]$/.test(w) ? 0.6 : 0);
  return Math.max(1, n.length / 2.5) + (/[.?!,;:।]$/.test(w) ? 0.6 : 0);
}

/** Spread words over the voiced runs of the clip in proportion to their syllables. Pauses stay empty. */
export function estimateWords(pcm: Pcm, text: string): Word[] {
  const words = captionWords(text);
  const dur = pcm.samples.length / pcm.sampleRate;
  let runs = voicedRuns(pcm);
  if (!runs.length) runs = [[0, dur]];
  const voicedTotal = runs.reduce((a, [s, e]) => a + (e - s), 0);
  const ws = words.map(weight);
  const total = ws.reduce((a, b) => a + b, 0) || 1;
  // map "voiced seconds so far" onto clip time, skipping the gaps
  const at = (v: number) => {
    let acc = 0;
    for (const [s, e] of runs) {
      if (v <= acc + (e - s)) return s + (v - acc);
      acc += e - s;
    }
    return runs[runs.length - 1][1];
  };
  let acc = 0;
  return words.map((w, i) => {
    const a = at((acc / total) * voicedTotal);
    acc += ws[i];
    const b = at((acc / total) * voicedTotal);
    return { text: w, start: a, end: Math.max(b, a + 0.05) };
  });
}

const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const spell = (n: number): string[] =>
  n < 20 ? [ONES[n]] : n < 100 ? [TENS[Math.floor(n / 10)], ...(n % 10 ? [ONES[n % 10]] : [])] : n < 1000 ? [ONES[Math.floor(n / 100)], 'hundred', ...(n % 100 ? spell(n % 100) : [])] : [String(n)];

/** Whisper writes "1%" and "41" where the script says "one percent" and "forty one": split those into spoken words, sharing the time. */
function expandNumbers(heard: Word[], lang: string): Word[] {
  if (lang !== 'en') return heard;
  return heard.flatMap((h) => {
    const m = /^(\d{1,3})(%?)([.,!?]*)$/.exec(h.text.trim());
    if (!m) return [h];
    const parts = [...spell(Number(m[1])), ...(m[2] ? ['percent'] : [])];
    const step = (h.end - h.start) / parts.length;
    return parts.map((w, i) => ({ text: w, start: h.start + i * step, end: h.start + (i + 1) * step }));
  });
}

/** Line the script's words up with what Whisper heard (edit-distance alignment), then fill any gaps by interpolation. */
export function matchWords(script: string[], heard: Word[], dur: number): Word[] | null {
  const A = script.map(norm);
  const B = heard.map((h) => norm(h.text));
  const n = A.length;
  const m = B.length;
  if (!n || !m) return null;
  const cost = (i: number, j: number) => {
    if (A[i] === B[j]) return 0;
    if (A[i] && B[j] && (A[i].startsWith(B[j]) || B[j].startsWith(A[i]))) return 0.4;
    return 1;
  };
  const D: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost(i - 1, j - 1));
  const hit: (Word | null)[] = Array(n).fill(null);
  let i = n;
  let j = m;
  let matched = 0;
  while (i > 0 && j > 0) {
    const c = cost(i - 1, j - 1);
    if (D[i][j] === D[i - 1][j - 1] + c) {
      if (c < 1) {
        hit[i - 1] = heard[j - 1];
        matched++;
      }
      i--;
      j--;
    } else if (D[i][j] === D[i - 1][j] + 1) i--;
    else j--;
  }
  if (matched < Math.max(1, Math.ceil(n * 0.6))) return null; // Whisper heard something else; trust the estimate instead
  const out: Word[] = script.map((w, k) => ({ text: w, start: hit[k]?.start ?? NaN, end: hit[k]?.end ?? NaN }));
  // fill unmatched words between their matched neighbours, by syllable weight
  for (let k = 0; k < n; ) {
    if (!Number.isNaN(out[k].start)) {
      k++;
      continue;
    }
    let e = k;
    while (e < n && Number.isNaN(out[e].start)) e++;
    const from = k > 0 ? out[k - 1].end : 0;
    const to = e < n ? out[e].start : dur;
    const ws = out.slice(k, e).map((w) => weight(w.text));
    const tot = ws.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let q = k; q < e; q++) {
      out[q].start = from + ((to - from) * acc) / tot;
      acc += ws[q - k];
      out[q].end = from + ((to - from) * acc) / tot;
    }
    k = e;
  }
  for (let k = 0; k < n; k++) {
    out[k].start = Math.max(k ? out[k - 1].start : 0, Math.min(out[k].start, dur));
    out[k].end = Math.max(out[k].start + 0.04, Math.min(out[k].end, dur));
  }
  return out;
}

function whisperAvailable(): boolean {
  if (process.env.VIDEO_STUDIO_NO_ALIGN === '1') return false;
  if (!fs.existsSync(venvPython('chatterbox'))) return false;
  const snaps = path.join(MODELS_DIR, 'hf', 'hub', 'models--openai--whisper-small', 'snapshots');
  try {
    return fs.readdirSync(snaps).some((d) => fs.existsSync(path.join(snaps, d, 'model.safetensors')));
  } catch {
    return false;
  }
}

async function runAligner(items: AlignItem[], log: (m: string) => void): Promise<Map<string, Word[]>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-align-'));
  const job = path.join(dir, 'job.json');
  const result = path.join(dir, 'result.json');
  fs.writeFileSync(job, JSON.stringify({ hf_home: path.join(MODELS_DIR, 'hf'), result, model: WHISPER, items: items.map(({ id, file, lang }) => ({ id, file, lang })) }));
  const env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', HF_HOME: path.join(MODELS_DIR, 'hf'), HF_HUB_DISABLE_TELEMETRY: '1', TOKENIZERS_PARALLELISM: 'false' };
  await new Promise<void>((resolve) => {
    // stderr is drained (and dropped): Whisper prints long progress bars, and an unread pipe would stall the process
    const child = spawn(venvPython('chatterbox'), [path.join(STUDIO_ROOT, 'voice', 'align_words.py'), job], { env, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.resume();
    const timer = setTimeout(() => child.kill(), 120_000 + items.length * 5_000);
    child.on('error', () => resolve());
    child.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const out = new Map<string, Word[]>();
  try {
    const r = JSON.parse(fs.readFileSync(result, 'utf8')) as { ok: boolean; error?: string; device?: string; items: { id: string; words?: { w: string; start: number; end: number }[] }[] };
    if (!r.ok) log(`  word timing: Whisper unavailable (${r.error}); using the estimate`);
    for (const it of r.items ?? []) if (it.words) out.set(it.id, it.words.map((w) => ({ text: w.w, start: w.start, end: w.end })));
    if (r.ok) log(`  word timing: Whisper on ${r.device} for ${out.size} line(s)`);
  } catch {
    log('  word timing: the Whisper aligner did not finish; using the estimate');
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

/** Word timings for a batch of finished clips. Never fails: anything Whisper cannot do falls back to the estimate. */
export async function timeWords(items: AlignItem[], log: (m: string) => void): Promise<Map<string, Timed>> {
  fs.mkdirSync(ALIGN_CACHE, { recursive: true });
  const out = new Map<string, Timed>();
  const keyOf = (it: AlignItem) => crypto.createHash('sha1').update(`v1|${WHISPER}|${it.lang}|${it.text}|`).update(fs.readFileSync(it.file)).digest('hex').slice(0, 24);
  const todo: AlignItem[] = [];
  const keys = new Map<string, string>();
  for (const it of items) {
    const key = keyOf(it);
    keys.set(it.id, key);
    try {
      out.set(it.id, JSON.parse(fs.readFileSync(path.join(ALIGN_CACHE, `${key}.json`), 'utf8')) as Timed);
    } catch {
      todo.push(it);
    }
  }
  const heard = todo.length && whisperAvailable() ? await runAligner(todo, log) : new Map<string, Word[]>();
  for (const it of todo) {
    const dur = it.pcm.samples.length / it.pcm.sampleRate;
    const script = captionWords(it.text);
    const h = heard.get(it.id);
    const matched = h ? matchWords(script, expandNumbers(h, it.lang), dur) : null;
    const timed: Timed = matched ? { words: matched, timing: 'whisper' } : { words: estimateWords(it.pcm, it.text), timing: 'estimate' };
    out.set(it.id, timed);
    // only cache real alignments: an estimate is cheap to redo, and caching it would hide Whisper once it is installed
    if (matched) fs.writeFileSync(path.join(ALIGN_CACHE, `${keys.get(it.id)}.json`), JSON.stringify(timed));
  }
  return out;
}
