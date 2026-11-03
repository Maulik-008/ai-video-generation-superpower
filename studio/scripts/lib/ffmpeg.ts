import { spawn, spawnSync } from 'node:child_process';

let cached: string | undefined;

/** Prefer an ffmpeg already on PATH, otherwise the binary shipped by the ffmpeg-static package. */
export async function ffmpegPath(): Promise<string> {
  if (cached) return cached;
  const onPath = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (onPath.status === 0) return (cached = 'ffmpeg');
  const mod = await import('ffmpeg-static');
  const p = (mod.default as unknown as string | null) ?? null;
  if (!p) throw new Error('ffmpeg not found. Install ffmpeg or run `npm install` in studio/ again.');
  return (cached = p);
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
