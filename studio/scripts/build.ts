// One command: validate -> voices -> preview stills -> render -> copy to the Videos folder.
import { parseCli } from './lib/args.ts';
import { runBuild } from './lib/build.ts';
import { resolveProject } from './lib/paths.ts';

const cli = parseCli();
await runBuild(resolveProject(cli.project), cli);
