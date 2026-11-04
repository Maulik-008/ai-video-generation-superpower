// Sound design made entirely by ffmpeg's own generators: short effects and a quiet room tone for every set.
// No sample files, so nothing to download or license. Each sound is generated once, levelled by measurement
// (peak for effects, loudness for ambience) and cached in studio/.cache/sfx.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { SetName, Sfx } from '../../src/types.ts';
import { ffmpegPath, runFfmpeg } from './ffmpeg.ts';
import { CACHE_DIR } from './paths.ts';

const SFX_DIR = path.join(CACHE_DIR, 'sfx');
const VERSION = 'v1';
const RATE = 48000;

/** How loud each effect sits in the mix (linear gain on a clip peaking at -3 dBFS; speech is normalised to -16 LUFS). */
export const SFX_GAIN: Record<Sfx, number> = { whoosh: 0.32, pop: 0.3, ding: 0.22, boing: 0.26, thud: 0.4, sparkle: 0.18, type: 0.16, 'swoosh-up': 0.22 };

const tone = (expr: string, d: number) => ['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=${RATE}:d=${d}`];
const noise = (color: string, d: number, filters: string) => ['-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=${color}:r=${RATE}:a=0.8:seed=7,${filters}`];

/** Recipes: ffmpeg input arguments plus an optional filter chain. Times are in seconds. */
const RECIPES: Record<Sfx, { input: string[]; af?: string }> = {
  pop: { input: tone('0.9*sin(2*PI*(900*t-3000*t*t))*exp(-32*t)', 0.16) },
  ding: { input: tone('0.5*sin(2*PI*1568*t)*exp(-5*t)+0.25*sin(2*PI*3136*t)*exp(-8*t)+0.12*sin(2*PI*4704*t)*exp(-12*t)', 1.2) },
  boing: { input: tone('0.8*sin(2*PI*220*t+9*sin(2*PI*9*t)*exp(-4*t))*exp(-3.5*t)', 0.7) },
  thud: { input: tone('0.9*sin(2*PI*(85*t-110*t*t))*exp(-18*t)+0.25*(random(0)*2-1)*exp(-70*t)', 0.35), af: 'lowpass=f=420' },
  sparkle: {
    input: tone('0.22*sin(2*PI*2093*t)*exp(-9*t)+0.2*gte(t,0.07)*sin(2*PI*2637*t)*exp(-9*(t-0.07))+0.18*gte(t,0.14)*sin(2*PI*3136*t)*exp(-9*(t-0.14))+0.16*gte(t,0.21)*sin(2*PI*4186*t)*exp(-9*(t-0.21))', 0.9),
  },
  type: { input: tone('0.8*(random(0)*2-1)*exp(-700*mod(t+0.013*sin(37*t),0.083))', 1.1), af: 'highpass=f=1800,lowpass=f=7000' },
  whoosh: { input: noise('pink', 0.5, 'highpass=f=250,lowpass=f=2800'), af: "volume='pow(sin(PI*t/0.5),3)':eval=frame,aphaser=in_gain=0.6:out_gain=0.9:delay=2:decay=0.5:speed=1.6" },
  'swoosh-up': { input: tone('0.5*sin(2*PI*(220*t+700*t*t))*pow(sin(PI*t/0.5),2)', 0.5), af: 'aecho=0.8:0.5:60:0.25' },
};

/** Room tone per set: what you would hear in that place with nobody talking. Kept very quiet (about -47 LUFS). */
const AMBIENCE: Record<SetName, (d: number) => { input: string[]; af: string }> = {
  'skyline-night': (d) => ({ input: noise('brown', d, 'lowpass=f=520,highpass=f=40'), af: 'tremolo=f=0.13:d=0.25' }),
  'cozy-room': (d) => ({ input: noise('brown', d, 'lowpass=f=320,highpass=f=35'), af: 'tremolo=f=0.1:d=0.1' }),
  'office-day': (d) => ({ input: noise('pink', d, 'lowpass=f=1100,highpass=f=80'), af: 'tremolo=f=0.1:d=0.15' }),
  'sunny-park': (d) => ({ input: noise('pink', d, 'highpass=f=900,lowpass=f=5200'), af: 'tremolo=f=0.21:d=0.55' }),
  'space-stage': (d) => ({ input: tone('0.4*sin(2*PI*55*t)+0.25*sin(2*PI*82.41*t+0.5*sin(2*PI*0.1*t))+0.12*sin(2*PI*110.3*t)', d), af: 'tremolo=f=0.11:d=0.35,lowpass=f=600' }),
  studio: (d) => ({ input: noise('brown', d, 'lowpass=f=400,highpass=f=40'), af: 'tremolo=f=0.1:d=0.08' }),
};
const AMBIENCE_LUFS = -47;

async function measure(file: string, what: 'peak' | 'lufs'): Promise<number> {
  const bin = await ffmpegPath();
  const af = what === 'peak' ? 'astats=metadata=0:reset=0' : 'ebur128=framelog=quiet';
  const text = await new Promise<string>((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-nostats', '-i', file, '-af', af, '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => resolve(err));
  });
  if (what === 'peak') {
    const m = /Overall[\s\S]*?Peak level dB:\s*(-?[\d.]+|-inf)/.exec(text) ?? /Peak level dB:\s*(-?[\d.]+)/.exec(text);
    return m && m[1] !== '-inf' ? Number(m[1]) : -99;
  }
  const m = /Integrated loudness:\s*I:\s*(-?[\d.]+)\s*LUFS/.exec(text);
  return m ? Number(m[1]) : -99;
}

async function generate(file: string, input: string[], af: string | undefined, level: { peakDb?: number; lufs?: number }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = file.replace(/\.wav$/, '.raw.wav');
  await runFfmpeg([...input, ...(af ? ['-af', af] : []), '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', raw]);
  const now = level.lufs !== undefined ? await measure(raw, 'lufs') : await measure(raw, 'peak');
  const want = level.lufs ?? level.peakDb ?? -3;
  const gain = now <= -98 ? 0 : Math.max(-40, Math.min(40, want - now));
  await runFfmpeg(['-i', raw, '-af', `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.01`, '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', file]);
  fs.rmSync(raw, { force: true });
}

/** Path of a ready-made effect (generated on first use). */
export async function sfxFile(name: Sfx): Promise<string> {
  const file = path.join(SFX_DIR, `${VERSION}-${name}.wav`);
  if (!fs.existsSync(file)) await generate(file, RECIPES[name].input, RECIPES[name].af, { peakDb: -3 });
  return file;
}

/** Path of a room-tone bed for `set`, at least `seconds` long (lengths are rounded up so beds are reused between builds). */
export async function ambienceFile(set: SetName, seconds: number): Promise<string> {
  const d = Math.max(4, Math.ceil(seconds / 5) * 5);
  const file = path.join(SFX_DIR, `${VERSION}-amb-${set}-${d}s.wav`);
  if (!fs.existsSync(file)) {
    const r = AMBIENCE[set](d + 1);
    await generate(file, r.input, r.af, { lufs: AMBIENCE_LUFS });
  }
  return file;
}
