// Single source of truth for the story format. The director (Claude) writes story.json, the scripts
// validate it with these schemas, and the browser engine only imports the *types* (erased at bundle time).
import { z } from 'zod';

export const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'worried', 'smug', 'tired', 'excited', 'confused'] as const;
export const ACTIONS = ['nod', 'shake', 'shrug', 'point', 'lean-in', 'jump', 'slump', 'wave'] as const;
export const SETS = ['skyline-night', 'space-stage', 'cozy-room', 'office-day', 'sunny-park', 'studio'] as const;
export const KINDS = ['human', 'cube', 'blob'] as const;
export const HAIR_STYLES = ['spiky', 'messy', 'bob', 'bald', 'cap'] as const;
export const SHOT_TYPES = ['wide', 'two-shot', 'medium', 'close', 'over-shoulder', 'low-angle', 'high-angle', 'insert'] as const;
export const ENGINES = ['auto', 'edge', 'kokoro', 'chatterbox', 'turbo', 'sapi'] as const;
export const DELIVERIES = ['natural', 'warm', 'calm'] as const;
export const MOVES = ['static', 'push-in', 'pull-out', 'drift-left', 'drift-right', 'orbit', 'rise', 'punch-in'] as const;
export const TRANSITIONS = ['cut', 'fade', 'dip', 'whip', 'zoom'] as const;
export const CAPTION_STYLES = ['bold', 'classic', 'none'] as const;
// Sound effects are synthesised by ffmpeg (no sample files, nothing to license). `auto` placement is described in formats/story.md.
export const SFX = ['whoosh', 'pop', 'ding', 'boing', 'thud', 'sparkle', 'type', 'swoosh-up'] as const;
// Non-verbal sounds written inline in a line, e.g. "[laugh] You did what?". Only the `turbo` engine performs them; other engines skip them.
export const TAGS = ['laugh', 'chuckle', 'sigh', 'gasp', 'cough', 'clear throat', 'sniff', 'groan', 'shush'] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type Action = (typeof ACTIONS)[number];
export type SetName = (typeof SETS)[number];
export type Kind = (typeof KINDS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type ShotType = (typeof SHOT_TYPES)[number];
export type Move = (typeof MOVES)[number];
export type Engine = (typeof ENGINES)[number];
export type Delivery = (typeof DELIVERIES)[number];
export type Transition = (typeof TRANSITIONS)[number];
export type CaptionStyle = (typeof CAPTION_STYLES)[number];
export type Sfx = (typeof SFX)[number];

/** `[laugh]`-style tags removed, for captions and for engines that cannot perform them. */
export const stripTags = (text: string) => text.replace(/\[[a-z ]{2,20}\]/gi, ' ').replace(/\s{2,}/g, ' ').trim();

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'use a #rrggbb colour');
const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'use lowercase letters, digits and dashes');

export const VoiceSchema = z.object({
  engine: z.enum(ENGINES).default('edge'), // which voice engine; `auto` = best one installed, always with automatic fallback
  delivery: z.enum(DELIVERIES).default('natural'), // natural = as before; warm / calm = slower, real pauses, emotion-aware, warm mastering
  edge: z.string().default('en-US-GuyNeural'), // any Microsoft Edge neural voice ShortName (also gives the language)
  kokoro: z.string().optional(), // Kokoro voice id (af_heart, am_michael, hf_alpha, ...); chosen from language + gender when omitted
  language: z.string().min(2).max(8).optional(), // 'en', 'hi', ...; read from the Edge voice name when omitted
  expressiveness: z.number().min(0).max(1).optional(), // Chatterbox only: 0 flat .. 1 very expressive (default 0.5)
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
  sfx: z.enum(SFX).optional(), // a sound effect when the line starts
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
  transition: z.enum(TRANSITIONS).default('cut'), // how this shot comes in from the previous one
  sfx: z.enum(SFX).optional(), // a sound effect at the start of the shot (in addition to the automatic ones)
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
  fps: z.union([z.literal(30), z.literal(60)]).default(60), // 60 = smooth motion; 30 renders in half the time
  look: z
    .object({
      captions: z
        .object({
          style: z.enum(CAPTION_STYLES).default('bold'), // bold = big word-by-word captions, the active word highlighted; classic = the older phrase captions
          position: z.enum(['top', 'middle', 'bottom']).default('top'),
          size: z.number().min(0.02).max(0.07).optional(), // fraction of frame height; default depends on the style
        })
        .default({}),
      handheld: z.boolean().default(true),
      style: z.enum(['soft', 'lowpoly']).default('soft'), // soft = rounded, glossy "clay toy" characters, soft shadows, reflections, bloom; lowpoly = the older flat-shaded look
      depthOfField: z.boolean().default(true), // soft style only: the background melts into bokeh behind the character in focus
      sfx: z.boolean().default(true), // automatic sound effects (whoosh on whip/zoom transitions, pop on titles, boing on jumps, typing on inserts)
      ambience: z.boolean().default(true), // quiet room tone for each set, so pauses never fall into dead digital silence
      laptop: z.boolean().default(true), // the laptop prop in front of the cast; false hides it except in insert shots
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

export type TLChunk = { text: string; start: number; end: number; words?: TLWord[] }; // absolute frames, end exclusive
export type TLWord = { text: string; start: number; end: number }; // absolute frames
export type TLLine = {
  speaker: string;
  text: string;
  emotion: Emotion;
  action?: Action;
  start: number;
  end: number;
  audio: string; // path relative to the project folder
  chunks: TLChunk[];
  words: TLWord[];
  timing: 'whisper' | 'estimate'; // how the word times were found
  envelope: number[]; // mouth openness 0..1, one value per frame starting at `start`
  shape: number[]; // mouth width 0..1 per frame (0 = round "oo", 1 = wide "ee")
};
export type TLShot = {
  id: string;
  start: number;
  end: number;
  set: SetName;
  camera: { type: ShotType; focus?: string; move: Move };
  transition: Transition;
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
  look: { captionStyle: CaptionStyle; captionPosition: 'top' | 'middle' | 'bottom'; captionSize: number; handheld: boolean; laptop?: boolean; style?: 'soft' | 'lowpoly'; depthOfField?: boolean };
  characters: ResolvedCharacter[];
  shots: TLShot[];
  music?: { src: string; volume: number };
  sfx: { name: Sfx; frame: number; gain: number }[];
  ambience: { set: SetName; start: number; end: number }[];
  voices?: Record<string, { engine: string; delivery: string; requested: string; note?: string }>;
};
