import fs from 'node:fs';
import { StorySchema, stripTags, TAGS, type Story } from '../../src/types.ts';

export type Validation = { story?: Story; errors: string[]; warnings: string[] };

/** Schema validation plus the cross-reference checks a schema cannot express. Messages are written for the director to act on. */
export function validateStory(storyPath: string): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(storyPath, 'utf8'));
  } catch (e) {
    return { errors: [`story.json is not valid JSON: ${(e as Error).message}`], warnings };
  }
  const parsed = StorySchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    return { errors, warnings };
  }
  const story = parsed.data;
  const chars = new Set<string>();
  for (const c of story.characters) {
    if (chars.has(c.id)) errors.push(`characters: duplicate id "${c.id}"`);
    chars.add(c.id);
  }
  const shotIds = new Set<string>();
  let words = 0;
  story.shots.forEach((shot, i) => {
    const at = `shots[${i}] (${shot.id})`;
    if (shotIds.has(shot.id)) errors.push(`${at}: duplicate shot id`);
    shotIds.add(shot.id);
    for (const id of shot.cast ?? []) if (!chars.has(id)) errors.push(`${at}.cast: unknown character "${id}"`);
    if (shot.camera.focus && shot.camera.type !== 'insert' && !chars.has(shot.camera.focus)) errors.push(`${at}.camera.focus: unknown character "${shot.camera.focus}"`);
    for (const id of Object.keys(shot.reactions)) if (!chars.has(id)) errors.push(`${at}.reactions: unknown character "${id}"`);
    const cast = new Set(shot.cast ?? story.characters.map((c) => c.id));
    if (shot.lines.length === 0 && shot.duration === undefined) errors.push(`${at}: a shot without lines needs "duration" (seconds)`);
    shot.lines.forEach((line, j) => {
      if (!chars.has(line.speaker)) errors.push(`${at}.lines[${j}]: unknown speaker "${line.speaker}"`);
      else if (!cast.has(line.speaker)) errors.push(`${at}.lines[${j}]: speaker "${line.speaker}" is not in this shot's cast`);
      words += line.text.split(/\s+/).length;
      for (const m of line.text.matchAll(/\[([a-z ]{2,20})\]/gi)) {
        const tag = m[1].toLowerCase();
        if (!(TAGS as readonly string[]).includes(tag)) warnings.push(`${at}.lines[${j}]: unknown tag "[${m[1]}]" (known: ${TAGS.map((t) => `[${t}]`).join(' ')}); it is skipped`);
        else if (!/^(auto|turbo)$/.test(story.characters.find((c) => c.id === line.speaker)?.voice.engine ?? '')) warnings.push(`${at}.lines[${j}]: "[${m[1]}]" is only performed by the turbo engine (engine "auto" uses it when installed); other engines skip it`);
      }
      if (!stripTags(line.text)) errors.push(`${at}.lines[${j}]: the line has only tags and no words to say`);
      if (line.text.split(/\s+/).length > 28) warnings.push(`${at}.lines[${j}]: ${line.text.split(/\s+/).length} words is long for one caption beat; consider splitting it`);
    });
    if (i === 0 && !shot.set) warnings.push(`${at}: no "set" on the first shot, using "studio"`);
  });
  if (story.shots.some((s) => s.camera.type === 'insert' && s.camera.focus === 'laptop' && !s.screen)) warnings.push('an insert shot on the laptop has no "screen" text');
  const estSeconds = Math.round(words / 2.5 + story.shots.length * 0.6);
  if (estSeconds > 120) warnings.push(`estimated length ~${estSeconds}s; vertical videos work best under 90s`);
  return { story: errors.length ? undefined : story, errors, warnings };
}
