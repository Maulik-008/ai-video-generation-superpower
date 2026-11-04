import { spawn, spawnSync } from 'node:child_process';
import { loadConfig } from './config.ts';

let cached: string | undefined;

const works = (bin: string) => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;

/**
 * Which ffmpeg to use, following the choice made in setup:
 *   system  - the one on PATH only        custom - a path you gave        bundled - the ffmpeg-static download first
 * With no setup done it behaves as before: PATH first, then the bundled binary.
 */
export async function ffmpegPath(): Promise<string> {
  if (cached) return cached;
  const cfg = loadConfig().ffmpeg;
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv) {
    if (works(fromEnv)) return (cached = fromEnv);
    throw new Error(`FFMPEG_PATH is set to "${fromEnv}" but that is not a working ffmpeg.`);
  }
  if (cfg?.mode === 'custom' && cfg.path) {
    if (works(cfg.path)) return (cached = cfg.path);
    throw new Error(`The ffmpeg you chose in setup ("${cfg.path}") does not work. Re-run setup (node setup.mjs) or fix the path in studio/.studio-setup.json.`);
  }
  const bundled = async (): Promise<string | null> => {
    try {
      const mod = await import('ffmpeg-static');
      const p = (mod.default as unknown as string | null) ?? null;
      return p && works(p) ? p : null;
    } catch {
      return null;
    }
  };
  if (cfg?.mode === 'system') {
    if (works('ffmpeg')) return (cached = 'ffmpeg');
    throw new Error('ffmpeg was not found on your PATH, but setup was told to use the system ffmpeg. Install ffmpeg, or re-run setup (node setup.mjs) and choose another option.');
  }
  if (cfg?.mode === 'bundled') {
    const p = await bundled();
    if (p) return (cached = p);
    if (works('ffmpeg')) return (cached = 'ffmpeg');
  } else {
    if (works('ffmpeg')) return (cached = 'ffmpeg');
    const p = await bundled();
    if (p) return (cached = p);
  }
  throw new Error('ffmpeg not found. Install ffmpeg, or run setup (node setup.mjs) and let it download one.');
}

/** Read duration / size / streams of a media file by parsing `ffmpeg -i` output. */
export async function probeMedia(file: string): Promise<{ seconds: number; width: number; height: number; hasAudio: boolean; bytes: number }> {
  const bin = await ffmpegPath();
  const text = await new Promise<string>((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => resolve(err));
  });
  const dur = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
  const dim = /Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(text);
  return {
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
    width: dim ? Number(dim[1]) : 0,
    height: dim ? Number(dim[2]) : 0,
    hasAudio: /Audio:/.test(text),
    bytes: (await import('node:fs')).statSync(file).size,
  };
}

export async function runFfmpeg(args: string[]): Promise<void> {
  const bin = await ffmpegPath();
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.trim().slice(-800)}`))));
  });
}
