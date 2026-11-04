// Assemble a generated story (format `kahani`, browser engine) into one finished reel:
//   npm run stitch -- <folder> [--res 1080p|720p] [--music song.mp3] [--music-volume 0.2] [--name my-reel]
// <folder>/plan.json lists the scenes in order. Each scene is <id>.mp4 (a Veo / Grok clip, its own dialogue kept) or
// <id>.png|jpg|webp (a still that gets a slow camera move here, made by ffmpeg, so it costs no video credits).
// Overlays (a persistent "POV" title, a per-scene label such as "6.00 pm" or "Liver Kaka", a handle, the end card) are
// drawn by headless Chrome, so Hindi, Urdu and any other script render correctly. The mix ends at -14 LUFS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { launch } from './lib/browser.ts';
import { outputRoot } from './lib/config.ts';
import { probeMedia, runFfmpeg } from './lib/ffmpeg.ts';

type Item = { id: string; name?: string; label?: string; seconds?: number; audio?: string; motion?: 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'none' };
type Plan = {
  title?: string;
  style?: string;
  transition?: 'cut' | 'dissolve';
  overlay?: { title?: string[]; handle?: string };
  endcard?: { text: string; sub?: string; seconds?: number };
  music?: { file: string; volume?: number };
  items: Item[];
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { res: { type: 'string', default: '1080p' }, music: { type: 'string' }, 'music-volume': { type: 'string' }, name: { type: 'string' } },
});
const dir = path.resolve(positionals[0] ?? '');
if (!positionals[0] || !fs.existsSync(path.join(dir, 'plan.json'))) throw new Error('Usage: npm run stitch -- <folder with plan.json and the scene files>');
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8')) as Plan;
const [W, H] = values.res === '720p' ? [720, 1280] : [1080, 1920];
const FPS = 30;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-stitch-'));
const log = (m: string) => console.log(m);

function mediaOf(id: string): { file: string; kind: 'video' | 'image' } {
  for (const ext of ['.mp4', '.mov', '.webm']) if (fs.existsSync(path.join(dir, id + ext))) return { file: path.join(dir, id + ext), kind: 'video' };
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) if (fs.existsSync(path.join(dir, id + ext))) return { file: path.join(dir, id + ext), kind: 'image' };
  throw new Error(`scene "${id}": no ${id}.mp4 or ${id}.png/jpg/webp in ${dir}`);
}

// ---- overlays: one transparent PNG per scene (title + label + handle), plus the end card ------------------------
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const FONT = `'Segoe UI', 'Nirmala UI', 'Noto Sans Devanagari', 'Noto Nastaliq Urdu', Arial, sans-serif`;
function overlayHtml(item: Item | null, end?: Plan['endcard']): string {
  const u = H / 1920; // sizes below are for 1080x1920
  const title = (plan.overlay?.title ?? []).map((t, i) => `<div class="t ${i === 0 ? 'big' : ''}">${esc(t)}</div>`).join('');
  const label = item?.label ? `<div class="label">${esc(item.label)}</div>` : '';
  const handle = plan.overlay?.handle ? `<div class="handle">${esc(plan.overlay.handle)}</div>` : '';
  const card = end ? `<div class="end"><div class="e1">${esc(end.text)}</div>${end.sub ? `<div class="e2">${esc(end.sub)}</div>` : ''}</div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent;width:${W}px;height:${H}px;overflow:hidden;font-family:${FONT}}
    .top{position:absolute;top:${150 * u}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:${10 * u}px}
    .t{background:#0b0b0d;color:#fff;font-family:Georgia,'Nirmala UI',serif;font-size:${34 * u}px;padding:${6 * u}px ${16 * u}px}
    .t.big{font-size:${36 * u}px;letter-spacing:.04em}
    .label{position:absolute;top:${(title ? 330 : 170) * u}px;left:0;right:0;margin:auto;width:max-content;color:#1b1b28;background:rgba(255,255,255,.82);
      border-radius:${40 * u}px;padding:${8 * u}px ${26 * u}px;font-weight:700;font-size:${40 * u}px;box-shadow:0 ${6 * u}px ${24 * u}px rgba(0,0,0,.25)}
    .handle{position:absolute;bottom:${120 * u}px;left:${60 * u}px;color:rgba(255,255,255,.85);font-size:${28 * u}px;font-weight:600;text-shadow:0 2px 8px rgba(0,0,0,.6)}
    .end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${24 * u}px}
    .e1{color:#fff;font-weight:900;font-size:${120 * u}px;letter-spacing:.02em;-webkit-text-stroke:${10 * u}px #0b0b14;paint-order:stroke fill}
    .e2{color:#fff;background:#e0245e;border-radius:${50 * u}px;padding:${16 * u}px ${44 * u}px;font-weight:800;font-size:${44 * u}px}
  </style></head><body>${end ? '' : `<div class="top">${title}</div>${label}`}${handle}${card}</body></html>`;
}

async function renderOverlays(): Promise<{ items: string[]; end?: string }> {
  const browser = await launch(false);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    const shot = async (html: string, file: string) => {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      fs.writeFileSync(file, await page.screenshot({ type: 'png', omitBackground: true }));
      return file;
    };
    const items: string[] = [];
    for (const it of plan.items) items.push(await shot(overlayHtml(it), path.join(work, `ov-${it.id}.png`)));
    const end = plan.endcard ? await shot(overlayHtml(null, plan.endcard), path.join(work, 'ov-end.png')) : undefined;
    return { items, end };
  } finally {
    await browser.close();
  }
}

// ---- scenes: every one normalised to the same size, frame rate and audio format -------------------------------------
const VOUT = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const AOUT = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];
const cover = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;

/** A slow camera move over a still, rendered at 2x and scaled down so the motion does not shimmer. */
function kenBurns(motion: Item['motion'], frames: number): string {
  const p = `(on/${Math.max(1, frames - 1)})`;
  const ease = `(${p}*${p}*(3-2*${p}))`;
  const z = motion === 'pull-out' ? `1.14-0.12*${ease}` : motion === 'none' ? '1' : motion === 'push-in' || !motion ? `1.02+0.12*${ease}` : '1.12';
  const x = motion === 'pan-left' ? `(iw-iw/zoom)*(1-${ease})` : motion === 'pan-right' ? `(iw-iw/zoom)*${ease}` : 'iw/2-(iw/zoom/2)';
  return `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1`;
}

async function makeScene(it: Item, overlay: string, i: number): Promise<{ file: string; seconds: number }> {
  const m = mediaOf(it.id);
  const out = path.join(work, `seg-${String(i).padStart(3, '0')}.mp4`);
  if (m.kind === 'video') {
    const info = await probeMedia(m.file);
    const seconds = Math.min(info.seconds, it.seconds ?? info.seconds);
    const audio = info.hasAudio ? [] : ['-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo'];
    await runFfmpeg(['-i', m.file, '-i', overlay, ...audio, '-filter_complex', `[0:v]${cover},fps=${FPS}[b];[b][1:v]overlay=0:0[v]`, '-map', '[v]', '-map', info.hasAudio ? '0:a' : '2:a', '-t', seconds.toFixed(3), ...VOUT, ...AOUT, out]);
    return { file: out, seconds };
  }
  // a still may carry its own voice-over (`audio`: a wav/mp3 next to plan.json, for example lines voiced by this repo's own engines)
  const voice = it.audio ? path.resolve(dir, it.audio) : undefined;
  if (voice && !fs.existsSync(voice)) throw new Error(`scene "${it.id}": audio file not found: ${voice}`);
  const seconds = voice ? Math.max(it.seconds ?? 0, (await probeMedia(voice)).seconds + 0.5) : (it.seconds ?? 4);
  const frames = Math.round(seconds * FPS);
  const sound = voice ? ['-i', voice] : ['-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo'];
  await runFfmpeg(['-loop', '1', '-framerate', String(FPS), '-t', seconds.toFixed(3), '-i', m.file, '-i', overlay, ...sound, '-filter_complex', `[0:v]${kenBurns(it.motion, frames)}[b];[b][1:v]overlay=0:0[v];[2:a]aresample=48000,apad,atrim=0:${seconds.toFixed(3)}[a]`, '-map', '[v]', '-map', '[a]', '-t', seconds.toFixed(3), ...VOUT, ...AOUT, out]);
  return { file: out, seconds };
}

/** The end card: the last frame, blurred and darkened, with the call to action on top. */
async function makeEndcard(last: string, lastSeconds: number, overlay: string, seconds: number): Promise<{ file: string; seconds: number }> {
  const still = path.join(work, 'last.png');
  await runFfmpeg(['-ss', Math.max(0, lastSeconds - 0.1).toFixed(3), '-i', last, '-frames:v', '1', still]);
  const out = path.join(work, 'seg-end.mp4');
  await runFfmpeg(['-loop', '1', '-framerate', String(FPS), '-t', seconds.toFixed(3), '-i', still, '-i', overlay, '-f', 'lavfi', '-t', seconds.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo', '-filter_complex', `[0:v]${cover},boxblur=24:2,eq=brightness=-0.18[b];[b][1:v]overlay=0:0[v]`, '-map', '[v]', '-map', '2:a', '-t', seconds.toFixed(3), ...VOUT, ...AOUT, out]);
  return { file: out, seconds };
}

// ---- join, mix, master ----------------------------------------------------------------------------------------------
async function join(segs: { file: string; seconds: number }[], dissolve: boolean): Promise<string> {
  const out = path.join(work, 'joined.mp4');
  const inputs = segs.flatMap((s) => ['-i', s.file]);
  let fc = '';
  if (!dissolve || segs.length < 2) {
    fc = `${segs.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${segs.length}:v=1:a=1[v][a]`;
  } else {
    const d = 0.5;
    let at = 0;
    let v = '0:v';
    let a = '0:a';
    for (let i = 1; i < segs.length; i++) {
      at += segs[i - 1].seconds - d;
      fc += `[${v}][${i}:v]xfade=transition=fade:duration=${d}:offset=${at.toFixed(3)}[v${i}];[${a}][${i}:a]acrossfade=d=${d}[a${i}];`;
      v = `v${i}`;
      a = `a${i}`;
    }
    fc += `[${v}]null[v];[${a}]anull[a]`;
  }
  await runFfmpeg([...inputs, '-filter_complex', fc, '-map', '[v]', '-map', '[a]', ...VOUT, ...AOUT, out]);
  return out;
}

async function master(joined: string, file: string) {
  const music = values.music ? path.resolve(values.music) : plan.music?.file ? path.resolve(dir, plan.music.file) : undefined;
  if (music && !fs.existsSync(music)) throw new Error(`music file not found: ${music}`);
  const vol = Number(values['music-volume'] ?? plan.music?.volume ?? 0.2);
  const D = (await probeMedia(joined)).seconds;
  const args = ['-i', joined];
  let fc: string;
  if (music) {
    args.push('-stream_loop', '-1', '-i', music);
    // the music ducks under the dialogue; with no dialogue (a POV reel) it simply carries the video
    fc = `[0:a]asplit=2[d1][d2];[1:a]volume=${vol},atrim=0:${D.toFixed(3)}[m];[m][d1]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=500[md];[d2][md]amix=inputs=2:normalize=0:duration=first[mix];`;
  } else fc = `[0:a]anull[mix];`;
  fc += `[mix]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.84:level=false,afade=t=out:st=${Math.max(0, D - 0.8).toFixed(3)}:d=0.8[a]`;
  await runFfmpeg([...args, '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', ...AOUT, '-t', D.toFixed(3), '-movflags', '+faststart', file]);
}

try {
  const name = values.name ?? path.basename(dir);
  log(`Stitching ${plan.items.length} scenes from ${dir} at ${W}x${H}`);
  const ov = await renderOverlays();
  const segs: { file: string; seconds: number }[] = [];
  for (const [i, it] of plan.items.entries()) {
    segs.push(await makeScene(it, ov.items[i], i));
    log(`  ${it.id}: ${mediaOf(it.id).kind}, ${segs[i].seconds.toFixed(1)}s${it.label ? `, "${it.label}"` : ''}`);
  }
  if (plan.endcard && ov.end) segs.push(await makeEndcard(segs[segs.length - 1].file, segs[segs.length - 1].seconds, ov.end, plan.endcard.seconds ?? 2.5));
  const joined = await join(segs, plan.transition === 'dissolve');
  const file = path.join(dir, `${name}.mp4`);
  await master(joined, file);
  const info = await probeMedia(file);
  const copy = path.join(outputRoot(), `${name}.mp4`);
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.copyFileSync(file, copy);
  log(`Done: ${file} (${info.seconds.toFixed(1)}s, ${info.width}x${info.height}, ${(info.bytes / 1e6).toFixed(1)} MB, audio: ${info.hasAudio})`);
  log(`VIDEO: ${copy}`);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
