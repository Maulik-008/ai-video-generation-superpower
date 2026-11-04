import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Timeline } from '../../src/types.ts';
import type { Browser, Page } from 'puppeteer-core';
import { findBrowser, launch } from './browser.ts';
import { ffmpegPath, probeMedia, runFfmpeg } from './ffmpeg.ts';
import type { Project } from './paths.ts';
import { buildPlayer, grabFrame, openPlayer } from './player.ts';
import { ambienceFile, sfxFile } from './sfx.ts';

/** Empty a folder without removing it: on Windows a folder that is open in Explorer (or a terminal) cannot be deleted. */
function emptyDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
}

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
  log(`Browser: ${findBrowser()}`);
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
  emptyDir(dir);
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

/**
 * Seekability test: a frame must look the same however it is reached. Draws `frame` on two separate pages, and again
 * on the first page after jumping elsewhere, and compares the pixels (PSNR). A timer, Math.random or state carried
 * between frames shows up as a visible change (well under 50 dB); the GPU's own rounding in the soft-look passes
 * flips the odd pixel by one level (about 100 dB), which nobody can see, so that passes.
 */
export async function determinismCheck(tl: Timeline, frame: number, log: (m: string) => void): Promise<{ ok: boolean; detail: string }> {
  const { close, pages } = await startPages(2, tl, () => {});
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-det-'));
  try {
    const save = async (name: string, page: Page, f: number) => {
      const file = path.join(dir, `${name}.png`);
      fs.writeFileSync(file, await grabFrame(page, f, 'png'));
      return file;
    };
    const a = await save('a', pages[0].page, frame);
    await grabFrame(pages[0].page, Math.max(0, tl.frames - 1 - frame), 'png');
    const b = await save('b', pages[0].page, frame);
    const c = await save('c', pages[1].page, frame);
    const db = [await psnr(a, b), await psnr(a, c)];
    const ok = db.every((v) => v >= 50);
    const show = (v: number) => (v === Infinity ? 'identical' : `${v.toFixed(0)} dB`);
    log(`  determinism: frame ${frame} on revisit ${show(db[0])}, on a second page ${show(db[1])}${ok ? '' : ' (VISIBLY DIFFERENT)'}`);
    return { ok, detail: `revisit ${show(db[0])}, second page ${show(db[1])}` };
  } finally {
    await close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Peak signal-to-noise ratio between two images in dB (Infinity when identical). */
async function psnr(a: string, b: string): Promise<number> {
  const { spawn } = await import('node:child_process');
  const bin = await ffmpegPath();
  const text = await new Promise<string>((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-i', a, '-i', b, '-lavfi', '[0]format=rgb24[x];[1]format=rgb24[y];[x][y]psnr', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => resolve(err));
  });
  const m = /average:(inf|[\d.]+)/.exec(text);
  return !m ? 0 : m[1] === 'inf' ? Infinity : Number(m[1]);
}

export async function renderVideo(project: Project, tl: Timeline, opts: Opts): Promise<string> {
  const { log } = opts;
  const framesDir = path.join(project.outDir, 'frames');
  emptyDir(framesDir);
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
  // poster: the punchline frame (middle of the last shot's first line), saved before the frames are deleted
  const last = tl.shots[tl.shots.length - 1];
  const pf = Math.min(tl.frames - 1, last.lines[0] ? Math.round((last.lines[0].start + last.lines[0].end) / 2) : Math.round((last.start + last.end) / 2));
  fs.copyFileSync(path.join(framesDir, `${String(pf).padStart(6, '0')}.jpg`), path.join(project.outDir, `${opts.outName ?? project.slug}-poster.jpg`));
  await mux(project, tl, framesDir, outFile, log);
  if (!opts.keepFrames) fs.rmSync(framesDir, { recursive: true, force: true });
  const info = await probeMedia(outFile);
  log(`Done: ${outFile} (${info.seconds.toFixed(1)}s, ${info.width}x${info.height}, ${(info.bytes / 1e6).toFixed(1)} MB, audio: ${info.hasAudio})`);
  return outFile;
}

async function mux(project: Project, tl: Timeline, framesDir: string, outFile: string, log: (m: string) => void) {
  const D = tl.frames / tl.fps;
  const ms = (frame: number) => Math.max(0, Math.round((frame / tl.fps) * 1000));
  const lines = tl.shots.flatMap((s) => s.lines);
  const args: string[] = ['-framerate', String(tl.fps), '-i', path.join(framesDir, '%06d.jpg')];
  let n = 1;
  const input = (...a: string[]) => {
    args.push(...a);
    return n++;
  };
  let fc = '';
  // 1) speech: every line at its time, then normalised to -14 LUFS, the level social platforms play at (dialogue sets the loudness)
  if (lines.length === 0) {
    const i = input('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono');
    fc += `[${i}:a]atrim=0:${D.toFixed(3)}[speech];`;
  } else {
    const ids = lines.map((l) => ({ i: input('-i', path.join(project.dir, l.audio)), l }));
    ids.forEach(({ i, l }, k) => (fc += `[${i}:a]adelay=${ms(l.start)}:all=1[a${k}];`));
    fc += `${ids.map((_, k) => `[a${k}]`).join('')}amix=inputs=${ids.length}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[speech];`;
  }
  let main = 'speech';
  if (tl.music) {
    const i = input('-stream_loop', '-1', '-i', path.join(project.dir, tl.music.src));
    fc += `[speech]asplit=2[s1][s2];[${i}:a]volume=${tl.music.volume}[mv];[mv][s1]sidechaincompress=threshold=0.03:ratio=10:attack=15:release=400[md];[s2][md]amix=inputs=2:normalize=0:duration=longest[music];`;
    main = 'music';
  }
  // 2) sound design at fixed levels under the normalised speech: effects, and a quiet room tone per set
  const beds: string[] = [];
  // sound design is a nicety: if a sound cannot be made, the video is still built without it
  const made = async (what: string, fn: () => Promise<string>) => {
    try {
      return await fn();
    } catch (e) {
      log(`  warning: skipped ${what} (${(e as Error).message.split('\n')[0].slice(0, 160)})`);
      return null;
    }
  };
  for (const [k, c] of tl.sfx.entries()) {
    const file = await made(`sound effect "${c.name}"`, () => sfxFile(c.name));
    if (!file) continue;
    const i = input('-i', file);
    fc += `[${i}:a]volume=${c.gain},adelay=${ms(c.frame)}:all=1[x${k}];`;
    beds.push(`[x${k}]`);
  }
  for (const [k, a] of tl.ambience.entries()) {
    const len = (a.end - a.start) / tl.fps;
    const file = await made(`ambience for ${a.set}`, () => ambienceFile(a.set, len));
    if (!file) continue;
    const i = input('-i', file);
    const fade = Math.min(0.4, len / 3);
    fc += `[${i}:a]atrim=0:${len.toFixed(3)},afade=t=in:d=${fade.toFixed(2)},afade=t=out:st=${(len - fade).toFixed(3)}:d=${fade.toFixed(2)},adelay=${ms(a.start)}:all=1[r${k}];`;
    beds.push(`[r${k}]`);
  }
  if (beds.length) {
    fc += `[${main}]${beds.join('')}amix=inputs=${beds.length + 1}:normalize=0:duration=first[full];`;
    main = 'full';
  }
  fc += `[${main}]alimiter=limit=0.84:attack=5:release=60:level=false,apad,afade=t=out:st=${Math.max(0, D - 0.6).toFixed(3)}:d=0.6[aout]`;
  const script = path.join(project.outDir, 'audio-graph.txt');
  fs.writeFileSync(script, fc);
  log(`Encoding video + mixing audio (${lines.length} lines, ${tl.sfx.length} effects, ${tl.ambience.length} ambience beds)`);
  await runFfmpeg([
    ...args,
    '-filter_complex_script', script,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'medium', '-tune', 'animation', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(tl.fps),
    '-g', String(tl.fps * 2), '-bf', '2',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    '-t', D.toFixed(3),
    outFile,
  ]);
}
