// Audio helpers shared by every engine: join sentences with real pauses, warm mastering, and a sanity gate for every clip.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runFfmpeg } from '../ffmpeg.ts';
import { encodeWav, parseWav, type Pcm } from '../wav.ts';

export const SAMPLE_RATE = 24000;

export async function ensure24k(pcm: Pcm): Promise<Pcm> {
  if (pcm.sampleRate === SAMPLE_RATE) return pcm;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-'));
  try {
    fs.writeFileSync(path.join(dir, 'in.wav'), encodeWav(pcm));
    await runFfmpeg(['-i', path.join(dir, 'in.wav'), '-ar', String(SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', path.join(dir, 'out.wav')]);
    return parseWav(fs.readFileSync(path.join(dir, 'out.wav')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Concatenate with `gapSec` of silence between parts. */
export function joinPcm(parts: Pcm[], gapSec: number): Pcm {
  const gap = Math.round(gapSec * SAMPLE_RATE);
  const total = parts.reduce((n, p) => n + p.samples.length, 0) + gap * (parts.length - 1);
  const out = new Float32Array(total);
  let at = 0;
  parts.forEach((p, i) => {
    out.set(p.samples, at);
    at += p.samples.length + (i < parts.length - 1 ? gap : 0);
  });
  return { sampleRate: SAMPLE_RATE, samples: out };
}

/** Warm voice chain: gentle low boost, softer highs, light compression, a very short room tail. Loudness is set later in the final mix. */
const WARM = 'highpass=f=70,bass=g=3:f=180,equalizer=f=4500:t=q:w=1.2:g=-2,acompressor=threshold=-21dB:ratio=2.2:attack=15:release=180:makeup=2,aecho=0.9:0.6:40|70:0.10|0.06';
export async function masterPcm(pcm: Pcm): Promise<Pcm> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-'));
  try {
    fs.writeFileSync(path.join(dir, 'in.wav'), encodeWav(pcm));
    await runFfmpeg(['-i', path.join(dir, 'in.wav'), '-af', WARM, '-ar', String(SAMPLE_RATE), '-ac', '1', '-c:a', 'pcm_s16le', path.join(dir, 'out.wav')]);
    return parseWav(fs.readFileSync(path.join(dir, 'out.wav')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Gain-only safety: if a clip is hot, bring its peak down to 0.9 so nothing is ever stored clipped. */
export function limitPeak(pcm: Pcm, target = 0.9): Pcm {
  let peak = 0;
  for (let i = 0; i < pcm.samples.length; i++) peak = Math.max(peak, Math.abs(pcm.samples[i]));
  if (peak <= 0.95) return pcm;
  const g = target / peak;
  return { sampleRate: pcm.sampleRate, samples: pcm.samples.map((v) => v * g) };
}

/** Returns why a clip is unusable, or null when it looks like real speech of a plausible length for the text. */
export function checkClip(pcm: Pcm, text: string, extraSeconds = 0): string | null {
  const { samples, sampleRate } = pcm;
  const seconds = samples.length / sampleRate;
  let peak = 0;
  let sum = 0;
  let hot = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) return 'contains invalid samples';
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a >= 0.995) hot++;
    sum += v * v;
  }
  if (hot / samples.length > 0.003) return 'clipping (distorted)';
  if (seconds < 0.25) return `too short (${seconds.toFixed(2)}s)`;
  if (peak < 0.02) return 'silent';
  if (Math.sqrt(sum / samples.length) < 0.003) return 'almost silent';
  const letters = [...text].filter((c) => /[\p{L}\p{M}\p{N}]/u.test(c)).length; // marks count: Indic scripts write vowels as combining marks
  const min = Math.max(0.3, letters / 45);
  const max = letters / 5 + 2 + extraSeconds; // slower than about 5 letters a second means dragging or rambling
  if (seconds < min) return `too short for the text (${seconds.toFixed(1)}s for ${letters} characters)`;
  if (seconds > max) return `too long for the text (${seconds.toFixed(1)}s for ${letters} characters)`;
  return null;
}
