import fs from 'node:fs';
import path from 'node:path';
import type { Cli } from './args.ts';
import { outputRoot } from './config.ts';
import type { Project } from './paths.ts';
import { log, makeTimeline } from './pipeline.ts';
import { printQa, runQa } from './qa.ts';
import { defaultStillFrames, renderStills, renderVideo } from './render.ts';

/** Voice-affecting flags make a different video of the same story, so they become part of the file name. */
export function variantName(slug: string, cli: Pick<Cli, 'provider' | 'delivery'>): string {
  const tag = [cli.provider !== 'auto' ? cli.provider : '', cli.delivery ?? ''].filter(Boolean).join('-');
  return tag ? `${slug}-${tag}` : slug;
}

/** validate -> voices -> (stills) -> render -> copy to the Videos folder. Returns the copied file. */
export async function runBuild(project: Project, cli: Cli, opts: { videosSubdir?: string; outName?: string } = {}): Promise<string> {
  const tl = await makeTimeline(project, cli);
  if (!cli.noStills) {
    const files = await renderStills(project, tl, defaultStillFrames(tl), { log });
    log(`stills: ${path.dirname(files[0])}`);
  }
  const name = opts.outName ?? variantName(project.slug, cli);
  const out = await renderVideo(project, tl, { workers: cli.workers, keepFrames: cli.keepFrames, outName: name, log });
  if (!cli.noQa) printQa(await runQa(project, tl, out, { listen: cli.listen, log }), log);
  const videos = path.join(outputRoot(), opts.videosSubdir ?? '');
  fs.mkdirSync(videos, { recursive: true });
  const copy = path.join(videos, `${name}.mp4`);
  fs.copyFileSync(out, copy);
  const poster = out.replace(/\.mp4$/, '-poster.jpg');
  if (fs.existsSync(poster)) fs.copyFileSync(poster, path.join(videos, `${name}-poster.jpg`));
  log(`VIDEO: ${copy}`);
  return copy;
}
