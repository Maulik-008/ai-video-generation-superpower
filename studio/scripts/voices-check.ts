// Health check: makes a real test sentence with every engine (English and Hindi), checks the audio, and records the result.
// `npm run voices:check` (add `-- --engines kokoro` to check just one). The build trusts this file when it picks engines.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ENGINE_IMPL, engineState, runWorker, STATUS_PATH, readStatus, verifyExtra, type EngineName, type Status, type Task } from './lib/voices/engines.ts';
import { checkClip } from './lib/voices/audio.ts';
import { chatterboxParams, kokoroCandidates, kokoroLang, type Voice } from './lib/voices/presets.ts';

const arg = process.argv.indexOf('--engines');
const wanted = (arg > 0 ? process.argv[arg + 1].split(',') : ['edge', 'sapi', 'kokoro', 'chatterbox']) as EngineName[];
const TESTS = [
  { lang: 'en', text: 'The evening was quiet, and everything felt all right.', voice: { engine: 'edge', delivery: 'natural', edge: 'en-US-AvaMultilingualNeural', gender: 'female', rate: '+0%', pitch: '+0Hz' } as Voice },
  { lang: 'hi', text: 'शाम बहुत शांत थी, और सब कुछ ठीक लगा।', voice: { engine: 'edge', delivery: 'natural', edge: 'hi-IN-SwaraNeural', gender: 'female', rate: '+0%', pitch: '+0Hz' } as Voice },
];

const status: Status = readStatus();
type Row = { engine: string; result: string; detail: string };
const rows: Row[] = [];
const log = () => {};

for (const engine of wanted) {
  const st = engineState(engine, true);
  if (st.state === 'missing') {
    rows.push({ engine, result: 'UNAVAILABLE', detail: st.reason ?? '' });
    if (engine === 'kokoro' || engine === 'chatterbox') status[engine] = { ready: false, checkedAt: new Date().toISOString(), note: st.reason };
    continue;
  }
  const notes: string[] = [];
  let ok = true;
  let device: string | undefined;
  let voices: string[] | undefined;
  const t0 = Date.now();
  try {
    if (engine === 'kokoro' || engine === 'chatterbox') {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-check-'));
      const items = TESTS.map((t, i) => ({
        id: `t${i}`, out: path.join(dir, `t${i}.wav`), text: t.text, language: t.lang, seed: 1,
        voice: kokoroCandidates({ ...t.voice, kokoro: undefined })[0], lang: kokoroLang(t.voice) ?? 'en-us', speed: 1, sentence_pause: 0.25, clause_pause: 0.1,
        ...chatterboxParams(t.voice, 'natural', 'neutral'),
      }));
      const { result, perItem } = await runWorker(engine, items, log, engine === 'chatterbox' ? verifyExtra() : {});
      if (!result.ok && !result.items?.length) throw new Error(result.error ?? 'worker failed');
      device = result.info?.gpu ? `${result.info.device} (${result.info.gpu})` : result.info?.device;
      if (engine === 'chatterbox') notes.push(`speech check: ${result.info?.verify ?? 'off'}`);
      if (engine === 'kokoro') voices = result.info?.voices;
      for (const [i, t] of TESTS.entries()) {
        const err = perItem.get(`t${i}`);
        if (err !== null) { ok = false; notes.push(`${t.lang}: ${err ?? 'no result'}`); continue; }
        const { parseWav } = await import('./lib/wav.ts');
        const pcm = parseWav(fs.readFileSync(items[i].out));
        const why = checkClip(pcm, t.text, 3);
        if (why) { ok = false; notes.push(`${t.lang}: ${why}`); } else notes.push(`${t.lang} ok ${(pcm.samples.length / pcm.sampleRate).toFixed(1)}s`);
      }
      fs.rmSync(dir, { recursive: true, force: true });
    } else {
      for (const t of TESTS) {
        if (engine === 'sapi' && t.lang !== 'en') continue;
        const task: Task = { key: 'c', sentences: [t.text], voice: t.voice, emotion: 'neutral', delivery: 'natural', seed: 1 };
        const res = (await ENGINE_IMPL[engine].synth([task], log)).get('c');
        if (!res || res instanceof Error) { ok = false; notes.push(`${t.lang}: ${res?.message ?? 'no result'}`); continue; }
        const why = checkClip(res[0], t.text, 3);
        if (why) { ok = false; notes.push(`${t.lang}: ${why}`); } else notes.push(`${t.lang} ok ${(res[0].samples.length / res[0].sampleRate).toFixed(1)}s`);
      }
    }
  } catch (e) {
    ok = false;
    notes.push((e as Error).message.slice(0, 220));
  }
  rows.push({ engine, result: ok ? 'READY' : 'FAILED', detail: `${notes.join(' · ')}${device ? ` · ${device}` : ''} · ${((Date.now() - t0) / 1000).toFixed(0)}s` });
  if (engine === 'kokoro' || engine === 'chatterbox') status[engine] = { ready: ok, checkedAt: new Date().toISOString(), device, note: ok ? undefined : notes.join('; '), voices };
}

fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
const w = Math.max(...rows.map((r) => r.engine.length));
console.log('\nVoice engines');
for (const r of rows) console.log(`  ${r.engine.padEnd(w)}  ${r.result.padEnd(13)} ${r.detail}`);
const anyOk = rows.some((r) => r.result === 'READY' && (r.engine === 'edge' || r.engine === 'sapi' || r.engine === 'kokoro' || r.engine === 'chatterbox'));
console.log(anyOk ? '\nAt least one engine is ready: videos will build (failed engines fall back automatically).' : '\nNo engine is ready. Check your internet connection (Edge voices) or run: npm run voices:setup');
process.exit(anyOk ? 0 : 1);
