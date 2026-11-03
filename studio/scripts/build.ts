// One command: validate -> voices -> preview stills -> render -> copy to the Videos folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { log, makeTimeline } from './lib/pipeline.ts';
import { defaultStillFrames, renderStills, renderVideo } from './lib/render.ts';

const cli = parseCli();
const project = resolveProject(cli.project);
const tl = await makeTimeline(project, cli);
if (!cli.noStills) {
  const files = await renderStills(project, tl, defaultStillFrames(tl), { log });
  log(`stills: ${path.dirname(files[0])}`);
}
const out = await renderVideo(project, tl, { workers: cli.workers, keepFrames: cli.keepFrames, log });
const videos = path.join(os.homedir(), 'Videos', 'VideoStudio');
fs.mkdirSync(videos, { recursive: true });
const copy = path.join(videos, `${project.slug}.mp4`);
fs.copyFileSync(out, copy);
log(`VIDEO: ${copy}`);
