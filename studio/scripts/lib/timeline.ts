import fs from 'node:fs';
import path from 'node:path';
import type { HairStyle, ResolvedCharacter, SetName, Story, TLChunk, TLLine, TLShot, Timeline } from '../../src/types.ts';
import type { Pcm } from './wav.ts';
import { encodeWav, mouthEnvelope } from './wav.ts';
import type { VoiceBank } from './voices/bank.ts';

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

/** Split a line into caption-sized phrases (<= 6 words / ~32 chars), preferring punctuation breaks. */
export function chunkText(text: string, maxWords = 6, maxChars = 32): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[][] = [];
  let cur: string[] = [];
  const len = (w: string[]) => w.join(' ').length;
  for (const w of words) {
    cur.push(w);
    const punct = /[.?!;:,…—–]$/.test(w);
    if (cur.length >= maxWords || len(cur) >= maxChars || (punct && cur.length >= 2)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) {
    if (cur.length === 1 && chunks.length) chunks[chunks.length - 1].push(...cur);
    else chunks.push(cur);
  }
  return chunks.map((c) => c.join(' '));
}

function chunkTimings(text: string, start: number, end: number): TLChunk[] {
  const parts = chunkText(text);
  const weights = parts.map((p) => p.length + (/[.?!]$/.test(p) ? 5 : /[,;:]$/.test(p) ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: TLChunk[] = [];
  let acc = 0;
  parts.forEach((p, i) => {
    const s = start + Math.round(((end - start) * acc) / total);
    acc += weights[i];
    const e = i === parts.length - 1 ? end : start + Math.round(((end - start) * acc) / total);
    out.push({ text: p, start: s, end: Math.max(e, s + 1) });
  });
  return out;
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

  const shots: TLShot[] = [];
  let cursor = 0;
  let prevSet: SetName = 'studio';
  let lineCount = 0;
  for (const [si, shot] of story.shots.entries()) {
    const set: SetName = shot.set ?? prevSet;
    prevSet = set;
    const start = cursor;
    cursor += Math.round(shot.lead * fps);
    const lines: TLLine[] = [];
    for (let i = 0; i < shot.lines.length; i++) {
      const line = shot.lines[i];
      if (i > 0) cursor += Math.round(line.pause * fps);
      const pcm: Pcm = bank.get(si, i);
      const frames = Math.max(1, Math.ceil((pcm.samples.length / pcm.sampleRate) * fps));
      const rel = `audio/${shot.id}-${i + 1}.wav`;
      fs.writeFileSync(path.join(projectDir, rel), encodeWav(pcm));
      lines.push({
        speaker: line.speaker,
        text: line.text,
        emotion: line.emotion,
        action: line.action,
        start: cursor,
        end: cursor + frames,
        audio: rel,
        chunks: chunkTimings(line.text, cursor, cursor + frames),
        envelope: mouthEnvelope(pcm, fps, frames),
      });
      cursor += frames;
      lineCount++;
      log(`  ${shot.id} · ${line.speaker}: "${line.text.length > 48 ? line.text.slice(0, 45) + '…' : line.text}" (${(frames / fps).toFixed(1)}s)`);
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
      cast: shot.cast ?? story.characters.map((c) => c.id),
      reactions: shot.reactions,
      lines,
      overlay: shot.overlay,
      screen: shot.screen,
    });
  }
  cursor += Math.round(0.5 * fps); // tail so the last caption can breathe
  shots[shots.length - 1].end = cursor;
  log(`  ${lineCount} voiced lines, ${(cursor / fps).toFixed(1)}s total`);

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
    look: { captionPosition: story.look.captions.position, captionSize: story.look.captions.size, handheld: story.look.handheld },
    characters,
    shots,
    music,
    voices: bank.voices,
  };
}
