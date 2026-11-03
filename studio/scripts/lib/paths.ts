import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJECTS_DIR = path.join(STUDIO_ROOT, 'projects');
export const CACHE_DIR = path.join(STUDIO_ROOT, '.cache');

export type Project = { slug: string; dir: string; storyPath: string; timelinePath: string; audioDir: string; outDir: string };

/** Accepts a slug ("my-story"), a project folder, or a path to a story.json. */
export function resolveProject(arg: string | undefined): Project {
  if (!arg) throw new Error('Missing project. Pass a project slug, e.g. `npm run build -- my-story`.');
  let dir: string;
  if (arg.endsWith('.json')) dir = path.dirname(path.resolve(arg));
  else if (fs.existsSync(arg) && fs.statSync(arg).isDirectory()) dir = path.resolve(arg);
  else dir = path.join(PROJECTS_DIR, arg);
  const storyPath = path.join(dir, 'story.json');
  if (!fs.existsSync(storyPath)) throw new Error(`No story.json found at ${storyPath}`);
  return {
    slug: path.basename(dir),
    dir,
    storyPath,
    timelinePath: path.join(dir, 'timeline.json'),
    audioDir: path.join(dir, 'audio'),
    outDir: path.join(dir, 'out'),
  };
}
