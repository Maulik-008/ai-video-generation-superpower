import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Timeline } from '../../src/types.ts';
import type { Browser, Page } from 'puppeteer-core';
import { launch } from './browser.ts';
import { probeMedia, runFfmpeg } from './ffmpeg.ts';
import type { Project } from './paths.ts';
import { buildPlayer, grabFrame, openPlayer } from './player.ts';

type Opts = { workers?: number; keepFrames?: boolean; outName?: string; log: (m: string) => void };

/** One browser process per worker: Chrome only produces frames for a tab it considers visible. */
async function startPages(count: number, tl: Timeline, log: (m: string) => void) {
  const url = await buildPlayer();
  const browsers: Browser[] = [];
  const pages: { page: Page; renderer: string }[] = [];
  for (let i = 0; i < count; i++) {
    const b = await launch(false);
    browsers.push(b);
    pages.push(await openPlayer(b, url, tl));
  }
  const renderer = pages[0].renderer;
  log(/swiftshader|software|llvmpipe/i.test(renderer) ? `WebGL: ${renderer} (software rendering; this will be slow)` : `WebGL: ${renderer}`);
  const close = async () => {
    await Promise.all(browsers.map((b) => b.close().catch(() => {})));
  };
  return { close, pages, renderer };
}

/** Frame numbers worth looking at: the middle of each shot's first spoken line. */
export function defaultStillFrames(tl: Timeline, only?: string[]): { name: string; frame: number }[] {
  return tl.shots
    .filter((s) => !only || only.includes(s.id))
    .map((s) => {
      const l = s.lines[0];
      const frame = l ? Math.round((l.start + l.end) / 2) : Math.round((s.start + s.end) / 2);
      return { name: s.id, frame: Math.min(tl.frames - 1, frame) };
    });
}

export async function renderStills(project: Project, tl: Timeline, targets: { name: string; frame: number }[], opts: Opts): Promise<string[]> {
  const dir = path.join(project.outDir, 'stills');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const { close, pages } = await startPages(1, tl, opts.log);
  const out: string[] = [];
  try {
    for (const t of targets) {
      const buf = await grabFrame(pages[0].page, t.frame, 'jpeg');
      const file = path.join(dir, `${t.name}.jpg`);
      fs.writeFileSync(file, buf);
      out.push(file);
    }
  } finally {
    await close();
  }
  return out;
}

export async function renderVideo(project: Project, tl: Timeline, opts: Opts): Promise<string> {
  const { log } = opts;
  const framesDir = path.join(project.outDir, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const workers = opts.workers ?? Math.min(6, Math.max(2, Math.floor(os.cpus().length / 4)));
  log(`Rendering ${tl.frames} frames at ${tl.width}x${tl.height} with ${workers} parallel pages`);
  const { close, pages } = await startPages(workers, tl, log);

  let next = 0;
  let done = 0;
  let lastPct = -1;
  const started = Date.now();
  try {
    await Promise.all(
      pages.map(async ({ page }) => {
        for (;;) {
          const f = next++;
          if (f >= tl.frames) return;
          const buf = await grabFrame(page, f, 'jpeg');
          await fs.promises.writeFile(path.join(framesDir, `${String(f).padStart(6, '0')}.jpg`), buf);
          done++;
          const pct = Math.floor((done / tl.frames) * 10) * 10;
          if (pct !== lastPct) {
            lastPct = pct;
            log(`  ${pct}%  (${done}/${tl.frames}, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
          }
        }
      }),
    );
  } finally {
    await close();
  }

  const outFile = path.join(project.outDir, `${opts.outName ?? project.slug}.mp4`);
  await mux(project, tl, framesDir, outFile, log);
  if (!opts.keepFrames) fs.rmSync(framesDir, { recursive: true, force: true });
  const info = await probeMedia(outFile);
  log(`Done: ${outFile} (${info.seconds.toFixed(1)}s, ${info.width}x${info.height}, ${(info.bytes / 1e6).toFixed(1)} MB, audio: ${info.hasAudio})`);
  return outFile;
}

async function mux(project: Project, tl: Timeline, framesDir: string, outFile: string, log: (m: string) => void) {
  const D = tl.frames / tl.fps;
  const lines = tl.shots.flatMap((s) => s.lines);
  const args: string[] = ['-framerate', String(tl.fps), '-i', path.join(framesDir, '%06d.jpg')];
  lines.forEach((l) => args.push('-i', path.join(project.dir, l.audio)));
  let fc = '';
  let final = 'aout';
  if (lines.length === 0) {
    args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
    fc = `[1:a]atrim=0:${D.toFixed(3)}[aout]`;
  } else {
    lines.forEach((l, i) => {
      fc += `[${i + 1}:a]adelay=${Math.round((l.start / tl.fps) * 1000)}:all=1[a${i}];`;
    });
    fc += `${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11[speech];`;
    let mixed = 'speech';
    if (tl.music) {
      const idx = lines.length + 1;
      args.push('-stream_loop', '-1', '-i', path.join(project.dir, tl.music.src));
      fc += `[speech]asplit=2[s1][s2];[${idx}:a]volume=${tl.music.volume}[mv];[mv][s1]sidechaincompress=threshold=0.03:ratio=10:attack=15:release=400[md];[s2][md]amix=inputs=2:normalize=0:duration=longest[mix];`;
      mixed = 'mix';
    }
    fc += `[${mixed}]apad,afade=t=out:st=${Math.max(0, D - 0.6).toFixed(3)}:d=0.6[${final}]`;
  }
  const script = path.join(project.outDir, 'audio-graph.txt');
  fs.writeFileSync(script, fc);
  log('Encoding video + mixing audio');
  await runFfmpeg([
    ...args,
    '-filter_complex_script', script,
    '-map', '0:v',
    '-map', `[${final}]`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(tl.fps),
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    '-t', D.toFixed(3),
    outFile,
  ]);
}
