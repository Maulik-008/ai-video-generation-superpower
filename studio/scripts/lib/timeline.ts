import fs from 'node:fs';
import path from 'node:path';
import { stripTags, type HairStyle, type ResolvedCharacter, type SetName, type Story, type TLChunk, type TLLine, type TLShot, type TLWord, type Timeline } from '../../src/types.ts';
import type { Pcm } from './wav.ts';
import { declick, encodeWav, levelSpeech, mouthEnvelope, mouthShape } from './wav.ts';
import type { VoiceBank } from './voices/bank.ts';
import { languageOf } from './voices/presets.ts';
import { SFX_GAIN } from './sfx.ts';
import { timeWords } from './words.ts';

const SKIN = ['#f2c3a5', '#e0a982', '#c98d65', '#9a6a48', '#f7d6bd'];
const HAIR = ['#2b1d17', '#3a2a22', '#14100e', '#6b4a2f', '#b0723a'];
const HAIR_STYLES: HairStyle[] = ['spiky', 'messy', 'bob', 'cap', 'spiky'];
const OUTFIT = ['#3b4cc0', '#2f7d6d', '#b0413e', '#6a4bb0', '#c9902f'];
const BODY = ['#ff7a45', '#4fb3d9', '#8fcf6a', '#d96fb3', '#f2c14e'];
const CAPTION = ['#ffffff', '#ffb066', '#9ad1ff', '#b8f5a6', '#ffd1f0'];

export function resolveCharacters(story: Story): ResolvedCharacter[] {
  return story.characters.map((c, i) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    pose: c.pose,
    scale: c.scale,
    look: {
      skin: c.look.skin ?? SKIN[i % SKIN.length],
      hair: c.look.hair ?? HAIR[i % HAIR.length],
      hairStyle: c.look.hairStyle ?? HAIR_STYLES[i % HAIR_STYLES.length],
      outfit: c.look.outfit ?? OUTFIT[i % OUTFIT.length],
      pants: c.look.pants ?? '#27305e',
      shoes: c.look.shoes ?? '#f1f1ff',
      body: c.look.body ?? BODY[i % BODY.length],
      accent: c.look.accent ?? '#ffd08a',
    },
    captionColor: c.captionColor ?? CAPTION[i % CAPTION.length],
  }));
}

/**
 * Group timed words into caption chunks. `bold` shows short punchy groups (up to 3 words) with the spoken word
 * highlighted; `classic` shows longer phrases. A chunk stays up until the next one starts, so captions never flicker.
 */
function chunkWords(words: TLWord[], lineEnd: number, style: 'bold' | 'classic'): TLChunk[] {
  const maxWords = style === 'bold' ? 3 : 6;
  const maxChars = style === 'bold' ? 16 : 32;
  const groups: TLWord[][] = [];
  let cur: TLWord[] = [];
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || cur.map((x) => x.text).join(' ').length + w.text.length + 1 > maxChars)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.?!;:,…—–।]$/.test(w.text) && cur.length >= (style === 'bold' ? 1 : 2)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    const prev = groups[groups.length - 1];
    if (cur.length === 1 && prev && prev.length < maxWords && !/[.?!।]$/.test(prev[prev.length - 1].text)) prev.push(...cur);
    else groups.push(cur);
  }
  return groups.map((g, i) => {
    const start = g[0].start;
    const end = i === groups.length - 1 ? lineEnd : groups[i + 1][0].start;
    return { text: g.map((w) => w.text).join(' '), start, end: Math.max(end, start + 1), words: g };
  });
}

export function dimensions(story: Story, res: '720p' | '1080p'): { width: number; height: number } {
  const long = res === '1080p' ? 1920 : 1280;
  const short = res === '1080p' ? 1080 : 720;
  if (story.aspect === 'square') return { width: short, height: short };
  if (story.aspect === 'landscape') return { width: long, height: short };
  return { width: short, height: long };
}

export async function buildTimeline(story: Story, projectDir: string, bank: VoiceBank, res: '720p' | '1080p', log: (m: string) => void): Promise<Timeline> {
  const fps = story.fps;
  const characters = resolveCharacters(story);
  const audioDir = path.join(projectDir, 'audio');
  fs.rmSync(audioDir, { recursive: true, force: true });
  fs.mkdirSync(audioDir, { recursive: true });
  const style = story.look.captions.style === 'classic' ? 'classic' : 'bold';
  const langOf = new Map(story.characters.map((c) => [c.id, languageOf(c.voice)]));

  // 1) every clip, levelled and de-clicked, written next to the project; then word timings for all of them at once
  const clips = new Map<string, Pcm>();
  const align: { id: string; file: string; text: string; lang: string; pcm: Pcm }[] = [];
  story.shots.forEach((shot, si) =>
    shot.lines.forEach((line, i) => {
      const pcm = declick(levelSpeech(bank.get(si, i)));
      const rel = `audio/${shot.id}-${i + 1}.wav`;
      fs.writeFileSync(path.join(projectDir, rel), encodeWav(pcm));
      clips.set(`${si}:${i}`, pcm);
      align.push({ id: `${si}:${i}`, file: path.join(projectDir, rel), text: line.text, lang: langOf.get(line.speaker) ?? 'en', pcm });
    }),
  );
  const timed = align.length ? await timeWords(align, log) : new Map();

  // 2) lay the shots out on the timeline
  const shots: TLShot[] = [];
  const sfx: Timeline['sfx'] = [];
  const cue = (name: Timeline['sfx'][number]['name'], frame: number) => sfx.push({ name, frame: Math.max(0, Math.round(frame)), gain: SFX_GAIN[name] });
  const auto = story.look.sfx;
  let cursor = 0;
  let prevSet: SetName = 'studio';
  let lineCount = 0;
  for (const [si, shot] of story.shots.entries()) {
    const set: SetName = shot.set ?? prevSet;
    prevSet = set;
    const start = cursor;
    const transition = si === 0 ? 'cut' : shot.transition;
    if (shot.sfx) cue(shot.sfx, start);
    if (auto && (transition === 'whip' || transition === 'zoom')) cue('whoosh', start - 0.12 * fps);
    if (auto && shot.overlay) cue('pop', start + 0.08 * fps);
    if (auto && shot.camera.type === 'insert' && shot.screen?.length) cue('type', start + 0.1 * fps);
    cursor += Math.round(shot.lead * fps);
    const lines: TLLine[] = [];
    for (let i = 0; i < shot.lines.length; i++) {
      const line = shot.lines[i];
      if (i > 0) cursor += Math.round(line.pause * fps);
      const pcm = clips.get(`${si}:${i}`)!;
      const frames = Math.max(1, Math.ceil((pcm.samples.length / pcm.sampleRate) * fps));
      const t = timed.get(`${si}:${i}`);
      const at = cursor;
      const words: TLWord[] = (t?.words ?? []).map((w: { text: string; start: number; end: number }) => ({ text: w.text, start: at + Math.round(w.start * fps), end: at + Math.max(1, Math.round(w.end * fps)) }));
      if (line.sfx) cue(line.sfx, at);
      if (auto && line.action === 'jump') cue('boing', at + 0.05 * fps);
      lines.push({
        speaker: line.speaker,
        text: stripTags(line.text),
        emotion: line.emotion,
        action: line.action,
        start: at,
        end: at + frames,
        audio: `audio/${shot.id}-${i + 1}.wav`,
        chunks: words.length ? chunkWords(words, at + frames, style) : [{ text: stripTags(line.text), start: at, end: at + frames }],
        words,
        timing: t?.timing ?? 'estimate',
        envelope: mouthEnvelope(pcm, fps, frames),
        shape: mouthShape(pcm, fps, frames),
      });
      cursor += frames;
      lineCount++;
      log(`  ${shot.id} · ${line.speaker}: "${line.text.length > 48 ? line.text.slice(0, 45) + '…' : line.text}" (${(frames / fps).toFixed(1)}s, words: ${t?.timing ?? 'estimate'})`);
    }
    if (shot.lines.length) cursor += Math.round(shot.hold * fps);
    const end = Math.max(cursor, shot.duration !== undefined ? start + Math.round(shot.duration * fps) : 0);
    cursor = end;
    shots.push({
      id: shot.id,
      start,
      end,
      set,
      camera: { type: shot.camera.type, focus: shot.camera.focus, move: shot.camera.move },
      transition,
      cast: shot.cast ?? story.characters.map((c) => c.id),
      reactions: shot.reactions,
      lines,
      overlay: shot.overlay,
      screen: shot.screen,
    });
  }
  cursor += Math.round(0.5 * fps); // tail so the last caption can breathe
  shots[shots.length - 1].end = cursor;
  log(`  ${lineCount} voiced lines, ${(cursor / fps).toFixed(1)}s total at ${fps} fps`);

  // one ambience run per stretch of shots in the same set
  const ambience: Timeline['ambience'] = [];
  if (story.look.ambience)
    for (const s of shots) {
      const last = ambience[ambience.length - 1];
      if (last && last.set === s.set) last.end = s.end;
      else ambience.push({ set: s.set, start: s.start, end: s.end });
    }
  if (ambience.length) ambience[ambience.length - 1].end = cursor;

  let music: Timeline['music'];
  if (story.music) {
    const src = path.resolve(projectDir, story.music.file);
    if (!fs.existsSync(src)) throw new Error(`music file not found: ${src}`);
    const rel = `audio/music${path.extname(src)}`;
    fs.copyFileSync(src, path.join(projectDir, rel));
    music = { src: rel, volume: story.music.volume };
  }

  const { width, height } = dimensions(story, res);
  return {
    title: story.title,
    slug: story.slug,
    width,
    height,
    fps,
    frames: cursor,
    look: {
      captionStyle: story.look.captions.style,
      captionPosition: story.look.captions.position,
      captionSize: story.look.captions.size ?? (story.look.captions.style === 'classic' ? 0.034 : 0.05),
      handheld: story.look.handheld,
      laptop: story.look.laptop,
    },
    characters,
    shots,
    music,
    sfx: sfx.sort((a, b) => a.frame - b.frame),
    ambience,
    voices: bank.voices,
  };
}
