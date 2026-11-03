// Render the full video from timeline.json.
import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { ensureTimeline, log } from './lib/pipeline.ts';
import { renderVideo } from './lib/render.ts';

const cli = parseCli();
const project = resolveProject(cli.project);
await renderVideo(project, await ensureTimeline(project, cli), { workers: cli.workers, keepFrames: cli.keepFrames, log });
