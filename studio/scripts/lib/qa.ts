// Quality check of a finished video, so the agent can look at its own work before handing it over:
// picture (black or frozen stretches, resolution, frame rate), sound (loudness, peaks, dead air), pacing and
// captions (from the timeline), a contact sheet to look at, and optionally a Whisper transcript of the final mix.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { stripTags, type Timeline } from '../../src/types.ts';
import { ffmpegPath, runFfmpeg } from './ffmpeg.ts';
import type { Project } from './paths.ts';
import { MODELS_DIR, venvPython } from './voices/engines.ts';
import { languageOf } from './voices/presets.ts';
import { STUDIO_ROOT } from './paths.ts';
import { validateStory } from './story.ts';
import { determinismCheck } from './render.ts';

export type Finding = { level: 'fail' | 'warn' | 'info'; area: 'picture' | 'sound' | 'pacing' | 'captions' | 'speech'; message: string; shot?: string; fix?: string };
export type QaReport = {
  video: string; seconds: number; width: number; height: number; fps: number;
  loudness?: number; truePeak?: number; speechMatch?: number; deterministic?: boolean;
  wordTiming: { whisper: number; estimate: number };
  sheet: string; strip?: string; phone: string[]; findings: Finding[]; verdict: 'pass' | 'warn' | 'fail';
};

async function ffLog(args: string[]): Promise<string> {
  const bin = await ffmpegPath();
  return new Promise((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-nostats', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => resolve(err));
  });
}

const ranges = (text: string, key: string) =>
  [...text.matchAll(new RegExp(`${key}_start:\\s*([\\d.]+)[\\s\\S]*?${key}_end:\\s*([\\d.]+)`, 'g'))].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);

export async function runQa(project: Project, tl: Timeline, video: string, opts: { listen?: boolean; determinism?: boolean; log: (m: string) => void }): Promise<QaReport> {
  const { log } = opts;
  const dir = path.join(project.outDir, 'qa');
  fs.mkdirSync(dir, { recursive: true });
  // frames a critic extracted from an earlier build would mix rounds: each new video starts a clean evidence folder
  for (const f of fs.readdirSync(dir)) if (/^(cut-|cuts-|phone-)/.test(f)) fs.rmSync(path.join(dir, f), { force: true });
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const fps = tl.fps;
  const sec = (f: number) => f / fps;
  const shotAt = (t: number) => tl.shots.find((s) => t * fps >= s.start && t * fps < s.end)?.id;

  // ---- probe ---------------------------------------------------------------------------------
  const info = await ffLog(['-i', video]);
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(info);
  const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0;
  const dim = /Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(info);
  const rate = /,\s*([\d.]+)\s*fps/.exec(info);
  const width = dim ? Number(dim[1]) : 0;
  const height = dim ? Number(dim[2]) : 0;
  const vfps = rate ? Number(rate[1]) : 0;
  if (Math.abs(seconds - tl.frames / fps) > 0.5) add({ level: 'fail', area: 'picture', message: `video is ${seconds.toFixed(1)}s but the timeline is ${(tl.frames / fps).toFixed(1)}s` });
  if (width !== tl.width || height !== tl.height) add({ level: 'fail', area: 'picture', message: `size ${width}x${height}, expected ${tl.width}x${tl.height}` });
  if (Math.round(vfps) !== fps) add({ level: 'warn', area: 'picture', message: `frame rate ${vfps}, expected ${fps}` });
  if (!/Audio:/.test(info)) add({ level: 'fail', area: 'sound', message: 'the video has no audio track' });

  // ---- picture: black or frozen stretches -----------------------------------------------------
  const pic = await ffLog(['-i', video, '-vf', 'blackdetect=d=0.3:pix_th=0.08,freezedetect=n=0.0015:d=1.6', '-an', '-f', 'null', '-']);
  for (const [a, b] of ranges(pic, 'black')) if (a > 0.4 && b < seconds - 0.7) add({ level: 'fail', area: 'picture', message: `black picture from ${a.toFixed(1)}s to ${b.toFixed(1)}s`, shot: shotAt(a), fix: 'check the set and camera of this shot in the stills' });
  for (const m of pic.matchAll(/freeze_start:\s*([\d.]+)[\s\S]*?freeze_duration:\s*([\d.]+)/g)) {
    const a = Number(m[1]);
    const d = Number(m[2]);
    add({ level: 'warn', area: 'picture', message: `almost nothing moves for ${d.toFixed(1)}s from ${a.toFixed(1)}s`, shot: shotAt(a + 0.1), fix: 'give the shot a camera move (push-in, drift, orbit) or split it' });
  }

  // ---- sound: loudness, peaks, dead air -------------------------------------------------------
  const snd = await ffLog(['-i', video, '-vn', '-af', 'ebur128=peak=true:framelog=quiet,silencedetect=n=-50dB:d=1.2', '-f', 'null', '-']);
  const I = /Integrated loudness:\s*I:\s*(-?[\d.]+)/.exec(snd);
  const TP = /True peak:\s*Peak:\s*(-?[\d.]+)/.exec(snd);
  const loudness = I ? Number(I[1]) : undefined;
  const truePeak = TP ? Number(TP[1]) : undefined;
  if (loudness !== undefined && (loudness < -17 || loudness > -11)) add({ level: 'warn', area: 'sound', message: `loudness ${loudness} LUFS (social platforms play at about -14)` });
  if (truePeak !== undefined && truePeak > -0.5) add({ level: 'warn', area: 'sound', message: `true peak ${truePeak} dBTP: risk of distortion on phones` });
  for (const [a, b] of ranges(snd, 'silence')) if (a > 0.3 && b < seconds - 0.8) add({ level: 'warn', area: 'sound', message: `digital silence from ${a.toFixed(1)}s to ${b.toFixed(1)}s`, shot: shotAt(a) });

  // ---- pacing and captions, from the timeline -------------------------------------------------
  const lines = tl.shots.flatMap((s) => s.lines.map((l) => ({ ...l, shot: s.id })));
  const first = lines[0];
  if (first && sec(first.start) > 2.2) add({ level: 'warn', area: 'pacing', message: `the first words start at ${sec(first.start).toFixed(1)}s; the hook should land in the first 2 seconds`, shot: first.shot, fix: 'shorten the opening shot or start on the hook line' });
  for (const s of tl.shots) {
    const len = sec(s.end - s.start);
    if (len > 6.5 && s.camera.move === 'static') add({ level: 'warn', area: 'pacing', message: `shot is ${len.toFixed(1)}s with a static camera`, shot: s.id, fix: 'split it or add a push-in / drift' });
  }
  for (let i = 2; i < tl.shots.length; i++) {
    const [a, b, c] = [tl.shots[i - 2], tl.shots[i - 1], tl.shots[i]];
    if (a.camera.type === b.camera.type && b.camera.type === c.camera.type && a.camera.focus === c.camera.focus) add({ level: 'warn', area: 'pacing', message: `three "${c.camera.type}" shots in a row`, shot: c.id, fix: 'alternate the framing (two-shot, close, over-shoulder)' });
  }
  for (const l of lines) {
    const words = stripTags(l.text).split(/\s+/).filter(Boolean).length;
    const wps = words / Math.max(0.3, sec(l.end - l.start));
    if (wps > 3.8 && words >= 4) add({ level: 'warn', area: 'pacing', message: `"${l.text.slice(0, 40)}" is spoken at ${wps.toFixed(1)} words/s (hard to follow)`, shot: l.shot, fix: 'slow the voice (rate, or delivery warm) or shorten the line' });
  }
  const est = lines.filter((l) => l.timing !== 'whisper').length;
  if (lines.length && tl.look.captionStyle === 'bold') {
    if (est === lines.length) add({ level: 'info', area: 'captions', message: 'word timing is estimated for every line (Whisper not installed); highlights follow the speech energy, not the exact words' });
    else if (est) add({ level: 'info', area: 'captions', message: `${est} of ${lines.length} lines use estimated word timing` });
  }

  // ---- contact sheet -------------------------------------------------------------------------
  const sheet = path.join(dir, 'sheet.jpg');
  const tiles = 30;
  const cols = tl.width > tl.height ? 5 : 6;
  const step = Math.max(0.2, seconds / tiles);
  await runFfmpeg(['-i', video, '-vf', `fps=${(1 / step).toFixed(4)},scale=${tl.width > tl.height ? 320 : 180}:-1,tile=${cols}x${Math.ceil(tiles / cols)}:padding=4:color=0x111111`, '-frames:v', '1', '-q:v', '3', sheet]);

  // ---- phone test: one frame per shot at 360 px wide, the size most people will watch it -----------
  const phoneDir = path.join(dir, 'phone');
  fs.rmSync(phoneDir, { recursive: true, force: true });
  fs.mkdirSync(phoneDir, { recursive: true });
  const phone: string[] = [];
  for (const s of tl.shots) {
    const l = s.lines[0];
    const t = sec(l ? (l.start + l.end) / 2 : (s.start + s.end) / 2);
    const file = path.join(phoneDir, `${s.id}.jpg`);
    await runFfmpeg(['-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=${tl.width > tl.height ? 640 : 360}:-1`, '-q:v', '3', file]);
    phone.push(file);
  }

  // ---- motion strip: 12 consecutive frames around the fastest move (the first non-cut transition, else the first jump) ----
  let strip: string | undefined;
  const moving = tl.shots.find((s, i) => i > 0 && s.transition !== 'cut')?.start ?? lines.find((l) => l.action === 'jump')?.start;
  if (moving !== undefined) {
    strip = path.join(dir, 'strip.jpg');
    const from = Math.max(0, sec(moving) - 3 / fps);
    await runFfmpeg(['-ss', from.toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=${tl.width > tl.height ? 320 : 200}:-1,tile=6x2:padding=3:color=0x111111`, '-q:v', '3', strip]);
  }

  // ---- determinism: any frame must render the same however it is reached -----------------------
  let deterministic: boolean | undefined;
  if (opts.determinism !== false) {
    try {
      const probe = lines[Math.floor(lines.length / 2)];
      const r = await determinismCheck(tl, probe ? Math.round((probe.start + probe.end) / 2) : Math.floor(tl.frames / 2), log);
      deterministic = r.ok;
      if (!r.ok) add({ level: 'fail', area: 'picture', message: `a frame renders visibly differently when reached another way (${r.detail}): something depends on timers, randomness or the previous frame`, fix: 'engine bug: report it' });
    } catch (e) {
      add({ level: 'info', area: 'picture', message: `determinism check could not run: ${(e as Error).message}` });
    }
  }

  // ---- optional: does the final mix say the script? -------------------------------------------
  let speechMatch: number | undefined;
  if (opts.listen) speechMatch = await listen(project, tl, video, findings, log);

  const verdict: QaReport['verdict'] = findings.some((f) => f.level === 'fail') ? 'fail' : findings.some((f) => f.level === 'warn') ? 'warn' : 'pass';
  const report: QaReport = { video, seconds, width, height, fps: vfps, loudness, truePeak, speechMatch, deterministic, wordTiming: { whisper: lines.length - est, estimate: est }, sheet, strip, phone, findings, verdict };
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  return report;
}

/** Transcribe the finished video's sound with Whisper and compare it with the script (needs the Chatterbox environment). */
async function listen(project: Project, tl: Timeline, video: string, findings: Finding[], log: (m: string) => void): Promise<number | undefined> {
  if (!fs.existsSync(venvPython('chatterbox'))) {
    findings.push({ level: 'info', area: 'speech', message: 'speech check skipped: it needs the Chatterbox environment (Whisper)' });
    return undefined;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-studio-qa-'));
  try {
    const wav = path.join(tmp, 'mix.wav');
    await runFfmpeg(['-i', video, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const story = validateStory(project.storyPath).story;
    const lang = story ? languageOf(story.characters[0].voice) : 'en';
    const text = tl.shots.flatMap((s) => s.lines.map((l) => l.text)).join(' ');
    const job = path.join(tmp, 'job.json');
    const result = path.join(tmp, 'result.json');
    fs.writeFileSync(job, JSON.stringify({ hf_home: path.join(MODELS_DIR, 'hf'), result, items: [{ id: 'mix', file: wav, text, lang }] }));
    await new Promise<void>((resolve) => {
      const p = spawn(venvPython('chatterbox'), [path.join(STUDIO_ROOT, 'voice', 'verify_whisper.py'), job], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, PYTHONUTF8: '1', HF_HOME: path.join(MODELS_DIR, 'hf'), HF_HUB_OFFLINE: '1' } });
      p.stderr.resume();
      p.on('close', () => resolve());
      p.on('error', () => resolve());
    });
    const r = JSON.parse(fs.readFileSync(result, 'utf8')) as { ok: boolean; error?: string; items: { score?: number; heard?: string; error?: string }[] };
    const it = r.items?.[0];
    if (!r.ok || it?.score === undefined) {
      findings.push({ level: 'info', area: 'speech', message: `speech check could not run: ${r.error ?? it?.error ?? 'unknown'}` });
      return undefined;
    }
    log(`  speech check: the final mix matches the script ${(it.score * 100).toFixed(0)}%`);
    if (it.score < (lang === 'en' ? 0.85 : 0.7)) findings.push({ level: 'warn', area: 'speech', message: `the final mix matches the script only ${(it.score * 100).toFixed(0)}%. Heard: "${(it.heard ?? '').slice(0, 160)}"`, fix: 'listen to the lines that differ; try another engine or voice for that character' });
    return it.score;
  } catch (e) {
    findings.push({ level: 'info', area: 'speech', message: `speech check could not run: ${(e as Error).message}` });
    return undefined;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function printQa(r: QaReport, log: (m: string) => void) {
  log(`QA: ${r.verdict.toUpperCase()}  ${r.seconds.toFixed(1)}s ${r.width}x${r.height} @${r.fps}fps · loudness ${r.loudness ?? '?'} LUFS · true peak ${r.truePeak ?? '?'} dBTP${r.speechMatch !== undefined ? ` · speech match ${(r.speechMatch * 100).toFixed(0)}%` : ''}`);
  for (const f of r.findings) log(`  ${f.level.toUpperCase().padEnd(4)} ${f.area.padEnd(8)} ${f.shot ? `[${f.shot}] ` : ''}${f.message}${f.fix ? `  -> ${f.fix}` : ''}`);
  log(`  contact sheet: ${r.sheet}${r.strip ? `\n  motion strip:  ${r.strip}` : ''}\n  phone frames:  ${path.dirname(r.phone[0] ?? r.sheet)}`);
}
