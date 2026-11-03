import fs from 'node:fs';
import type { Timeline } from '../../src/types.ts';
import type { Cli } from './args.ts';
import type { Project } from './paths.ts';
import { validateStory } from './story.ts';
import { buildTimeline } from './timeline.ts';
import { createSynth } from './tts.ts';

export const log = (m: string) => console.log(m);

export function validateOrExit(project: Project) {
  const { story, errors, warnings } = validateStory(project.storyPath);
  for (const w of warnings) log(`warning: ${w}`);
  if (!story) {
    console.error(`INVALID story.json (${project.storyPath}):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  return story;
}

/** validate -> voices -> timeline.json */
export async function makeTimeline(project: Project, cli: Cli): Promise<Timeline> {
  const story = validateOrExit(project);
  log(`Voices for "${story.title}" (provider: ${cli.provider})`);
  const synth = await createSynth(cli.provider, story.characters[0].voice, log);
  log(`using ${synth.provider} voices`);
  const timeline = await buildTimeline(story, project.dir, synth, cli.res ?? story.resolution, log);
  fs.mkdirSync(project.outDir, { recursive: true });
  fs.writeFileSync(project.timelinePath, JSON.stringify(timeline));
  log(`timeline: ${timeline.width}x${timeline.height}, ${timeline.frames} frames, ${(timeline.frames / timeline.fps).toFixed(1)}s`);
  return timeline;
}

/** The timeline is derived from story.json, so rebuild it (voices come from the cache) when the story changed or is missing. */
export async function ensureTimeline(project: Project, cli: Cli): Promise<Timeline> {
  const stale = !fs.existsSync(project.timelinePath) || fs.statSync(project.storyPath).mtimeMs > fs.statSync(project.timelinePath).mtimeMs;
  if (stale) {
    log('story.json changed since the last timeline; rebuilding it first');
    return makeTimeline(project, cli);
  }
  return JSON.parse(fs.readFileSync(project.timelinePath, 'utf8')) as Timeline;
}
