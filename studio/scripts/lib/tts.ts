// Text-to-speech providers. Both are free and need no account:
//   edge  - Microsoft Edge's neural voices over the public read-aloud endpoint (best quality, needs internet)
//   sapi  - Windows built-in speech (offline, robotic)
// Every provider ends up as a 24 kHz mono 16-bit WAV so the rest of the pipeline is identical.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { runFfmpeg } from './ffmpeg.ts';
import { CACHE_DIR, STUDIO_ROOT } from './paths.ts';
import { encodeWav, parseWav, trimSilence, type Pcm } from './wav.ts';

export type VoiceSpec = { edge: string; gender: 'male' | 'female'; rate: string; pitch: string };
export type ProviderName = 'edge' | 'sapi';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-'));

async function synthEdge(text: string, v: VoiceSpec, outWav: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const tts = new MsEdgeTTS({ synthesisTimeoutMs: 30000 });
    const dir = tmp();
    try {
      await tts.setMetadata(v.edge, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate: v.rate, pitch: v.pitch });
      const chunks: Buffer[] = [];
      for await (const c of audioStream) chunks.push(c as Buffer);
      const mp3 = Buffer.concat(chunks);
      if (mp3.length < 1000) throw new Error('empty audio from edge-tts');
      const mp3Path = path.join(dir, 'in.mp3');
      fs.writeFileSync(mp3Path, mp3);
      await runFfmpeg(['-i', mp3Path, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
      return;
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

async function synthSapi(text: string, v: VoiceSpec, outWav: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('the offline sapi voice only works on Windows');
  const dir = tmp();
  try {
    const textFile = path.join(dir, 'text.txt');
    const raw = path.join(dir, 'raw.wav');
    fs.writeFileSync(textFile, text, 'utf8');
    const rate = Math.round(parseInt(v.rate, 10) / 10); // "+20%" -> 2
    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(STUDIO_ROOT, 'scripts', 'lib', 'sapi.ps1'), '-TextFile', textFile, '-OutFile', raw, '-Gender', v.gender, '-Rate', String(rate)],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      p.stderr.on('data', (d) => (err += d));
      p.on('error', reject);
      p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`sapi failed: ${err.trim()}`))));
    });
    await runFfmpeg(['-i', raw, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', outWav]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export type Synth = { provider: ProviderName; line(text: string, voice: VoiceSpec): Promise<Pcm> };

/** Create a synthesiser. With `auto`, probes edge first and falls back to the offline voice for the whole run. */
export async function createSynth(requested: 'auto' | ProviderName, probeVoice: VoiceSpec, log: (m: string) => void): Promise<Synth> {
  let provider: ProviderName = requested === 'sapi' ? 'sapi' : 'edge';
  if (requested === 'auto') {
    const probe = path.join(tmp(), 'probe.wav');
    try {
      await synthEdge('Testing.', probeVoice, probe);
    } catch (e) {
      log(`edge-tts unavailable (${(e as Error).message}); using the offline Windows voice for every line`);
      provider = 'sapi';
    }
  }
  fs.mkdirSync(path.join(CACHE_DIR, 'tts'), { recursive: true });
  return {
    provider,
    async line(text, voice) {
      const key = crypto.createHash('sha1').update([provider, voice.edge, voice.gender, voice.rate, voice.pitch, text].join('|')).digest('hex');
      const cached = path.join(CACHE_DIR, 'tts', `${key}.wav`);
      if (!fs.existsSync(cached)) {
        const raw = path.join(tmp(), 'line.wav');
        if (provider === 'edge') await synthEdge(text, voice, raw);
        else await synthSapi(text, voice, raw);
        fs.writeFileSync(cached, encodeWav(trimSilence(parseWav(fs.readFileSync(raw)))));
      }
      return parseWav(fs.readFileSync(cached));
    },
  };
}
