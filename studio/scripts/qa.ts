// Check a finished video: picture, sound, pacing, captions, a contact sheet, and (--listen) a Whisper transcript of the mix.
//   npm run qa -- <slug> [--listen] [--video path.mp4]
import fs from 'node:fs';
import path from 'node:path';
import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { ensureTimeline, log } from './lib/pipeline.ts';
import { printQa, runQa } from './lib/qa.ts';

const cli = parseCli();
const project = resolveProject(cli.project);
const tl = await ensureTimeline(project, cli);
const newest = () =>
  fs.readdirSync(project.outDir).filter((f) => f.endsWith('.mp4')).map((f) => path.join(project.outDir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
const video = cli.video ?? (fs.existsSync(path.join(project.outDir, `${project.slug}.mp4`)) ? path.join(project.outDir, `${project.slug}.mp4`) : newest());
if (!video) throw new Error(`No video in ${project.outDir}; run npm run render -- ${project.slug} first`);
const report = await runQa(project, tl, video, { listen: cli.listen, log });
printQa(report, log);
process.exit(report.verdict === 'fail' ? 1 : 0);
