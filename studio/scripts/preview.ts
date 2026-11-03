// Render still frames (one per shot by default) so the look can be checked before the full render.
import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { ensureTimeline, log } from './lib/pipeline.ts';
import { defaultStillFrames, renderStills } from './lib/render.ts';

const cli = parseCli();
const project = resolveProject(cli.project);
const tl = await ensureTimeline(project, cli);
const targets = cli.frames ? cli.frames.map((frame) => ({ name: `frame-${frame}`, frame })) : defaultStillFrames(tl, cli.shots);
const files = await renderStills(project, tl, targets, { log });
log(`${files.length} stills:`);
for (const f of files) log(`  ${f}`);
