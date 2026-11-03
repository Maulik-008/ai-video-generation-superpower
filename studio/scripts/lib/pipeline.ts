import fs from 'node:fs';
import path from 'node:path';
import type { Timeline } from '../../src/types.ts';
import type { Cli } from './args.ts';
import type { Project } from './paths.ts';
import { validateStory } from './story.ts';
import { buildTimeline } from './timeline.ts';
import { prepareVoices } from './voices/bank.ts';

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
  log(`Voices for "${story.title}" (engine: ${cli.provider === 'auto' ? 'as set in the story' : cli.provider}${cli.delivery ? `, delivery: ${cli.delivery}` : ''})`);
  const bank = await prepareVoices(story, { provider: cli.provider, delivery: cli.delivery }, log);
  const timeline = await buildTimeline(story, project.dir, bank, cli.res ?? story.resolution, log);
  fs.writeFileSync(path.join(project.dir, 'voices-report.json'), JSON.stringify({ voices: timeline.voices, warnings: bank.warnings }, null, 2));
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
