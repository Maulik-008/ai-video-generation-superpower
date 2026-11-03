// Single source of truth for the story format. The director (Claude) writes story.json, the scripts
// validate it with these schemas, and the browser engine only imports the *types* (erased at bundle time).
import { z } from 'zod';

export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried', 'smug', 'tired', 'excited', 'confused'] as const;
export const ACTIONS = ['nod', 'shake', 'shrug', 'point', 'lean-in', 'jump', 'slump', 'wave'] as const;
export const SETS = ['skyline-night', 'space-stage', 'cozy-room', 'office-day', 'sunny-park', 'studio'] as const;
export const KINDS = ['human', 'cube', 'blob'] as const;
export const HAIR_STYLES = ['spiky', 'messy', 'bob', 'bald', 'cap'] as const;
export const SHOT_TYPES = ['wide', 'two-shot', 'medium', 'close', 'over-shoulder', 'low-angle', 'high-angle', 'insert'] as const;
export const MOVES = ['static', 'push-in', 'pull-out', 'drift-left', 'drift-right', 'orbit', 'rise'] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type Action = (typeof ACTIONS)[number];
export type SetName = (typeof SETS)[number];
export type Kind = (typeof KINDS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type ShotType = (typeof SHOT_TYPES)[number];
export type Move = (typeof MOVES)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'use a #rrggbb colour');
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes');

export const VoiceSchema = z.object({
  edge: z.string().default('en-US-GuyNeural'), // any Microsoft Edge neural voice ShortName
  gender: z.enum(['male', 'female']).default('male'), // used only by the offline Windows fallback
  rate: z.string().regex(/^[+-]\d{1,3}%$/, 'like +10% or -5%').default('+0%'),
  pitch: z.string().regex(/^[+-]\d{1,3}Hz$/, 'like +20Hz or -15Hz').default('+0Hz'),
});

export const LookSchema = z.object({
  skin: hex.optional(),
  hair: hex.optional(),
  hairStyle: z.enum(HAIR_STYLES).optional(),
  outfit: hex.optional(),
  pants: hex.optional(),
  shoes: hex.optional(),
  body: hex.optional(), // cube / blob body colour
  accent: hex.optional(), // cube / blob nubs, feet
});

export const CharacterSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(KINDS),
  pose: z.enum(['stand', 'sit']).default('stand'), // humans only
  scale: z.number().min(0.5).max(2).default(1),
  look: LookSchema.default({}),
  voice: VoiceSchema.default({}),
  captionColor: hex.optional(),
});

export const LineSchema = z.object({
  speaker: id,
  text: z.string().min(1).max(240),
  emotion: z.enum(EMOTIONS).default('neutral'),
  action: z.enum(ACTIONS).optional(),
  pause: z.number().min(0).max(3).default(0.15), // seconds of silence before this line (not used for the first line)
});

export const ShotSchema = z.object({
  id,
  set: z.enum(SETS).optional(), // inherits the previous shot's set
  cast: z.array(id).optional(), // who is on stage; default = every character
  camera: z
    .object({
      type: z.enum(SHOT_TYPES).default('medium'),
      focus: z.string().optional(), // character id (or "laptop" for an insert)
      move: z.enum(MOVES).default('static'),
    })
    .default({}),
  lines: z.array(LineSchema).default([]),
  duration: z.number().min(0.5).max(20).optional(), // required for shots without lines
  lead: z.number().min(0).max(3).default(0.25), // seconds before the first line
  hold: z.number().min(0).max(5).default(0.35), // seconds after the last line
  reactions: z.record(z.string(), z.enum(EMOTIONS)).default({}), // face for characters who have not spoken yet in this shot
  overlay: z.string().max(80).optional(), // big title / end-card text
  screen: z.array(z.string().max(60)).max(8).optional(), // text shown on the laptop screen
});

export const StorySchema = z.object({
  title: z.string().min(1),
  slug: id,
  aspect: z.enum(['vertical', 'square', 'landscape']).default('vertical'),
  resolution: z.enum(['720p', '1080p']).default('720p'),
  fps: z.literal(30).default(30),
  look: z
    .object({
      captions: z
        .object({ position: z.enum(['top', 'middle', 'bottom']).default('top'), size: z.number().min(0.02).max(0.06).default(0.034) })
        .default({}),
      handheld: z.boolean().default(true),
    })
    .default({}),
  music: z.object({ file: z.string(), volume: z.number().min(0).max(1).default(0.12) }).optional(),
  characters: z.array(CharacterSchema).min(1).max(5),
  shots: z.array(ShotSchema).min(1).max(60),
});

export type Story = z.infer<typeof StorySchema>;
export type StoryInput = z.input<typeof StorySchema>;

// ---- resolved / computed data (written to timeline.json, consumed by the browser engine) ----

export type ResolvedCharacter = {
  id: string;
  name: string;
  kind: Kind;
  pose: 'stand' | 'sit';
  scale: number;
  look: {
    skin: string;
    hair: string;
    hairStyle: HairStyle;
    outfit: string;
    pants: string;
    shoes: string;
    body: string;
    accent: string;
  };
  captionColor: string;
};

export type TLChunk = { text: string; start: number; end: number }; // absolute frames, end exclusive
export type TLLine = {
  speaker: string;
  text: string;
  emotion: Emotion;
  action?: Action;
  start: number;
  end: number;
  audio: string; // path relative to the project folder
  chunks: TLChunk[];
  envelope: number[]; // mouth openness 0..1, one value per frame starting at `start`
};
export type TLShot = {
  id: string;
  start: number;
  end: number;
  set: SetName;
  camera: { type: ShotType; focus?: string; move: Move };
  cast: string[];
  reactions: Record<string, Emotion>;
  lines: TLLine[];
  overlay?: string;
  screen?: string[];
};
export type Timeline = {
  title: string;
  slug: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  look: { captionPosition: 'top' | 'middle' | 'bottom'; captionSize: number; handheld: boolean };
  characters: ResolvedCharacter[];
  shots: TLShot[];
  music?: { src: string; volume: number };
};
