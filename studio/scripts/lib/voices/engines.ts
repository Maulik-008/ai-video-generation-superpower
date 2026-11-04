// The voice engines behind one interface:  edge (online, free) · sapi (offline Windows) · kokoro · chatterbox · turbo (local models).
// An engine turns a list of sentences into audio. Anything that goes wrong is returned as an Error for that task, never thrown,
// so the caller can fall back to the next engine without losing the rest of the batch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { Delivery, Emotion } from '../../../src/types.ts';
import { runFfmpeg } from '../ffmpeg.ts';
import { voiceHome, speechCheckEnabled } from '../config.ts';
import { STUDIO_ROOT } from '../paths.ts';
import { parseWav, type Pcm } from '../wav.ts';
import { chatterboxParams, DELIVERY, edgeProsody, kokoroLang, kokoroSpeed, languageOf, pickKokoroVoice, type Voice } from './presets.ts';

export type EngineName = 'edge' | 'sapi' | 'kokoro' | 'chatterbox' | 'turbo';
export type EngineState = { state: 'ready' | 'unchecked' | 'missing'; reason?: string };
export type Task = { key: string; sentences: string[]; voice: Voice; emotion: Emotion; delivery: Delivery; seed: number; anchor?: string };
export type Log = (m: string) => void;

const VOICE_DIR = path.join(STUDIO_ROOT, 'voice');
export const MODELS_DIR = path.join(voiceHome(), '.models');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-'));

// ---- availability ---------------------------------------------------------------------------

export type Status = Partial<Record<EngineName, { ready: boolean; checkedAt?: string; device?: string; note?: string; voices?: string[] }>>;
export const STATUS_PATH = path.join(VOICE_DIR, '.status.json');
export function readStatus(): Status {
  try {
    return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8')) as Status;
  } catch {
    return {};
  }
}

export function venvPython(engine: 'kokoro' | 'chatterbox'): string {
  const dir = path.join(voiceHome(), `.venv-${engine}`);
  return process.platform === 'win32' ? path.join(dir, 'Scripts', 'python.exe') : path.join(dir, 'bin', 'python');
}

/** Chatterbox weights live in a Hugging Face snapshot folder; a build must never start a multi-GB download mid-render. */
function chatterboxModelPresent(): boolean {
  try {
    const snaps = path.join(MODELS_DIR, 'hf', 'hub', 'models--ResembleAI--chatterbox', 'snapshots');
    return fs.readdirSync(snaps).some((d) => sizeOk(path.join(snaps, d, 't3_mtl23ls_v2.safetensors'), 1.5e9) && sizeOk(path.join(snaps, d, 's3gen.pt'), 0.8e9));
  } catch {
    return false;
  }
}

/** Chatterbox Turbo (English, performs [laugh] / [sigh] tags) is an optional extra download of about 4 GB, never fetched by a build. */
export function turboModelPresent(): boolean {
  try {
    const snaps = path.join(MODELS_DIR, 'hf', 'hub', 'models--ResembleAI--chatterbox-turbo', 'snapshots');
    return fs.readdirSync(snaps).some((d) => sizeOk(path.join(snaps, d, 't3_turbo_v1.safetensors'), 1.5e9) && sizeOk(path.join(snaps, d, 's3gen.safetensors'), 0.8e9));
  } catch {
    return false;
  }
}

const KOKORO_FILES: [string, number][] = [['kokoro-v1.0.onnx', 300e6], ['voices-v1.0.bin', 25e6]];
const sizeOk = (file: string, min: number) => fs.existsSync(file) && fs.statSync(file).size >= min;

/** `VIDEO_STUDIO_DISABLE_ENGINES=kokoro,chatterbox` switches engines off (used for testing the fallbacks). */
export function engineState(name: EngineName, ignoreRecordedResult = false): EngineState {
  const disabled = (process.env.VIDEO_STUDIO_DISABLE_ENGINES ?? '').split(',').map((s) => s.trim());
  if (disabled.includes(name)) return { state: 'missing', reason: 'disabled by VIDEO_STUDIO_DISABLE_ENGINES' };
  if (name === 'edge') return { state: 'ready' };
  if (name === 'sapi') return process.platform === 'win32' ? { state: 'ready' } : { state: 'missing', reason: 'Windows only' };
  const status = readStatus()[name];
  if (name === 'turbo') {
    if (!fs.existsSync(venvPython('chatterbox'))) return { state: 'missing', reason: 'not installed (it shares the Chatterbox environment: run npm run voices:setup, then npm run voices:setup -- --only turbo)' };
    if (!turboModelPresent()) return { state: 'missing', reason: 'model not downloaded (optional, about 4 GB: npm run voices:setup -- --only turbo)' };
    if (!ignoreRecordedResult && status && !status.ready) return { state: 'missing', reason: `last health check failed: ${status.note ?? 'see npm run voices:check'}` };
    return status?.ready && !ignoreRecordedResult ? { state: 'ready' } : { state: 'unchecked', reason: 'not health-checked yet' };
  }
  if (!fs.existsSync(venvPython(name))) return { state: 'missing', reason: `not installed (run: npm run voices:setup)` };
  if (name === 'kokoro' && !KOKORO_FILES.every(([f, min]) => sizeOk(path.join(MODELS_DIR, 'kokoro', f), min))) return { state: 'missing', reason: 'model files missing (run: npm run voices:setup)' };
  if (name === 'chatterbox' && !chatterboxModelPresent()) return { state: 'missing', reason: 'model not downloaded yet (run: npm run voices:setup)' };
  // builds trust the last health check; the health check itself (ignoreRecordedResult) always re-tests, so one failure can never stick
  if (!ignoreRecordedResult && status && !status.ready) return { state: 'missing', reason: `last health check failed: ${status.note ?? 'see npm run voices:check'}` };
  return status?.ready && !ignoreRecordedResult ? { state: 'ready' } : { state: 'unchecked', reason: 'not health-checked yet' };
}

// ---- Edge (online) --------------------------------------------------------------------------

async function toWav(inputFile: string, outWav: string) {
  await runFfmpeg(['-i', inputFile, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
}

async function edgeSentence(text: string, voice: string, rate: string, pitch: string): Promise<Pcm> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tts = new MsEdgeTTS({ synthesisTimeoutMs: 30000 });
    const dir = tmp();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate, pitch });
      const chunks: Buffer[] = [];
      for await (const c of audioStream) chunks.push(c as Buffer);
      const mp3 = Buffer.concat(chunks);
      if (mp3.length < 1000) throw new Error('empty audio from edge-tts');
      fs.writeFileSync(path.join(dir, 'in.mp3'), mp3);
      await toWav(path.join(dir, 'in.mp3'), path.join(dir, 'out.wav'));
      return parseWav(fs.readFileSync(path.join(dir, 'out.wav')));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    } finally {
      tts.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  throw new Error(`edge-tts failed after 3 attempts: ${(lastErr as Error)?.message ?? lastErr}`);
}

async function sapiSentence(text: string, gender: string, rate: number): Promise<Pcm> {
  const dir = tmp();
  try {
    fs.writeFileSync(path.join(dir, 'text.txt'), text, 'utf8');
    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(STUDIO_ROOT, 'scripts', 'lib', 'sapi.ps1'), '-TextFile', path.join(dir, 'text.txt'), '-OutFile', path.join(dir, 'raw.wav'), '-Gender', gender, '-Rate', String(Math.round(rate / 10))],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      p.stderr.on('data', (d) => (err += d));
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`sapi failed: ${err.trim()}`))));
    });
    await toWav(path.join(dir, 'raw.wav'), path.join(dir, 'out.wav'));
    return parseWav(fs.readFileSync(path.join(dir, 'out.wav')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---- local models: one Python worker per batch -----------------------------------------------

export type WorkerItem = Record<string, unknown> & { id: string; out: string };
type WorkerResult = { ok: boolean; error?: string; trace?: string; info?: Record<string, any>; items?: { id: string; ok: boolean; error?: string }[] };

export async function runWorker(engine: 'kokoro' | 'chatterbox' | 'turbo', items: WorkerItem[], log: Log, extra: Record<string, unknown> = {}): Promise<{ result: WorkerResult; perItem: Map<string, string | null> }> {
  // test hook: VIDEO_STUDIO_FAIL_ENGINES=kokoro makes that engine fail at run time, to prove the fallbacks work
  if ((process.env.VIDEO_STUDIO_FAIL_ENGINES ?? '').split(',').map((s) => s.trim()).includes(engine)) return { result: { ok: false, error: `simulated failure of ${engine} (VIDEO_STUDIO_FAIL_ENGINES)` }, perItem: new Map() };
  const venv = engine === 'turbo' ? 'chatterbox' : engine; // Turbo runs in the Chatterbox environment with the same worker
  if (engine === 'turbo') extra = { ...extra, model: 'turbo' };
  const dir = tmp();
  const jobPath = path.join(dir, 'job.json');
  const resultPath = path.join(dir, 'result.json');
  fs.writeFileSync(jobPath, JSON.stringify({ model_dir: path.join(MODELS_DIR, venv), hf_home: path.join(MODELS_DIR, 'hf'), result: resultPath, items, ...extra }));
  const timeoutMs = engine === 'kokoro' ? 120_000 + items.length * 10_000 : 600_000 + items.length * 60_000;
  const env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', HF_HOME: path.join(MODELS_DIR, 'hf'), HF_HUB_DISABLE_TELEMETRY: '1', TOKENIZERS_PARALLELISM: 'false' };
  let stderr = '';
  const code = await new Promise<number | string>((resolve) => {
    const child = spawn(venvPython(venv), [path.join(VOICE_DIR, `${venv}_worker.py`), jobPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      child.kill();
      resolve('timeout');
    }, timeoutMs);
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith('ITEM ')) log(`    ${engine}: ${line.slice(5)}`);
      }
    });
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
    child.on('error', (e) => {
      clearTimeout(timer);
      stderr += String(e);
      resolve('spawn-error');
    });
    child.on('close', (c) => {
      clearTimeout(timer);
      resolve(c ?? -1);
    });
  });
  let result: WorkerResult;
  try {
    result = JSON.parse(fs.readFileSync(resultPath, 'utf8')) as WorkerResult;
  } catch {
    result = { ok: false, error: code === 'timeout' ? `${engine} worker timed out after ${Math.round(timeoutMs / 1000)}s` : `${engine} worker produced no result (exit ${code}). ${stderr.trim().slice(-400)}` };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const perItem = new Map<string, string | null>();
  for (const it of result.items ?? []) perItem.set(it.id, it.ok ? null : it.error ?? 'failed');
  return { result, perItem };
}

function readItemWav(file: string): Pcm {
  const pcm = parseWav(fs.readFileSync(file));
  fs.rmSync(file, { force: true });
  return pcm;
}

// ---- the engines -------------------------------------------------------------------------------

export type EngineImpl = { name: EngineName; synth(tasks: Task[], log: Log): Promise<Map<string, Pcm[] | Error>> };

const edge: EngineImpl = {
  name: 'edge',
  async synth(tasks) {
    const out = new Map<string, Pcm[] | Error>();
    for (const t of tasks) {
      try {
        const { rate, pitch } = edgeProsody(t.voice, t.delivery, t.emotion);
        const parts: Pcm[] = [];
        for (const s of t.sentences) parts.push(await edgeSentence(s, t.voice.edge, rate, pitch));
        out.set(t.key, parts);
      } catch (e) {
        out.set(t.key, e as Error);
      }
    }
    return out;
  },
};

const sapi: EngineImpl = {
  name: 'sapi',
  async synth(tasks) {
    const out = new Map<string, Pcm[] | Error>();
    for (const t of tasks) {
      try {
        const rate = parseInt(edgeProsody(t.voice, t.delivery, t.emotion).rate, 10) || 0;
        const parts: Pcm[] = [];
        for (const s of t.sentences) parts.push(await sapiSentence(s, t.voice.gender, rate));
        out.set(t.key, parts);
      } catch (e) {
        out.set(t.key, e as Error);
      }
    }
    return out;
  },
};

/** Run a batch through a local worker; items map back to tasks as `<key>#<n>`. */
async function localSynth(engine: 'kokoro' | 'chatterbox' | 'turbo', tasks: Task[], log: Log, makeItem: (t: Task, sentence: string, id: string, out: string) => WorkerItem, tmpDir: string, extra: Record<string, unknown> = {}): Promise<Map<string, Pcm[] | Error>> {
  const out = new Map<string, Pcm[] | Error>();
  const items: WorkerItem[] = [];
  for (const t of tasks) t.sentences.forEach((s, i) => items.push(makeItem(t, s, `${t.key}#${i}`, path.join(tmpDir, `${t.key.replace(/[^\w-]/g, '_')}-${i}.wav`))));
  const { result, perItem } = await runWorker(engine, items, log, extra);
  if (!result.ok && !result.items?.length) {
    for (const t of tasks) out.set(t.key, new Error(result.error ?? `${engine} failed`));
    return out;
  }
  for (const t of tasks) {
    try {
      const parts: Pcm[] = [];
      for (let i = 0; i < t.sentences.length; i++) {
        const id = `${t.key}#${i}`;
        const err = perItem.get(id);
        if (err !== null) throw new Error(err ?? 'no result for item');
        parts.push(readItemWav(items.find((x) => x.id === id)!.out));
      }
      out.set(t.key, parts);
    } catch (e) {
      out.set(t.key, e as Error);
    }
  }
  return out;
}

const kokoro: EngineImpl = {
  name: 'kokoro',
  async synth(tasks, log) {
    const dir = tmp();
    const available = readStatus().kokoro?.voices;
    try {
      return await localSynth('kokoro', tasks, log, (t, text, id, out) => ({
        id,
        out,
        text,
        voice: pickKokoroVoice(t.voice, available),
        lang: kokoroLang(t.voice) ?? 'en-us',
        speed: kokoroSpeed(t.delivery, t.emotion),
        sentence_pause: DELIVERY[t.delivery].pause,
        clause_pause: t.delivery === 'calm' ? 0.18 : t.delivery === 'warm' ? 0.14 : 0.1,
      }), dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};

/** Chatterbox checks its own speech with Whisper (transcribe, compare, retry). Set VIDEO_STUDIO_NO_VERIFY=1 to skip it. */
export const verifyEnabled = () => speechCheckEnabled();
export const verifyExtra = (): Record<string, unknown> => (verifyEnabled() ? { verify: { model: 'openai/whisper-small', min_en: 0.85, min_other: 0.7, min_short: 0.55 } } : {});

const chatterbox: EngineImpl = {
  name: 'chatterbox',
  async synth(tasks, log) {
    const dir = tmp();
    try {
      return await localSynth('chatterbox', tasks, log, (t, text, id, out) => {
        const p = chatterboxParams(t.voice, t.delivery, t.emotion);
        return { id, out, text, language: languageOf(t.voice), exaggeration: p.exaggeration, cfg: p.cfg, seed: t.seed, anchor: t.anchor ?? null };
      }, dir, verifyExtra());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};

/** Chatterbox Turbo: English only, and the one engine that performs `[laugh]`, `[sigh]`, `[chuckle]`... tags. */
const turbo: EngineImpl = {
  name: 'turbo',
  async synth(tasks, log) {
    const dir = tmp();
    try {
      return await localSynth('turbo', tasks, log, (t, text, id, out) => {
        const p = chatterboxParams(t.voice, t.delivery, t.emotion);
        return { id, out, text, language: 'en', temperature: Math.min(0.95, 0.65 + p.exaggeration * 0.25), seed: t.seed, anchor: t.anchor ?? null };
      }, dir, verifyExtra());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};

export const ENGINE_IMPL: Record<EngineName, EngineImpl> = { edge, sapi, kokoro, chatterbox, turbo };
