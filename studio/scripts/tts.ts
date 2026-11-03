// Story -> voices -> timeline.json (audio files, caption timing, lip-sync envelopes).
import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { makeTimeline } from './lib/pipeline.ts';

const cli = parseCli();
await makeTimeline(resolveProject(cli.project), cli);
