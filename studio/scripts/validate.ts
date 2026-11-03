import { parseCli } from './lib/args.ts';
import { resolveProject } from './lib/paths.ts';
import { log, validateOrExit } from './lib/pipeline.ts';

const story = validateOrExit(resolveProject(parseCli().project));
log(`OK — "${story.title}": ${story.characters.length} characters, ${story.shots.length} shots`);
