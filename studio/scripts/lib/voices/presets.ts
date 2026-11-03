// How a line should be *delivered*: pacing, pauses, emotion, mastering. Pure data + small helpers, no I/O.
import type { Delivery, Emotion, Story } from '../../../src/types.ts';

export type Voice = Story['characters'][number]['voice'];

export type DeliveryPreset = {
  split: boolean; // synthesise sentence by sentence and add real pauses
  pause: number; // seconds of silence between sentences
  master: boolean; // warm mastering chain
  rate: number; // Edge rate offset in %
  pitch: number; // Edge pitch offset in Hz
  speed: number; // Kokoro speed multiplier
  exag: number; // Chatterbox exaggeration offset
  emotionAware: boolean; // let the line's emotion change the delivery
};

/** `natural` reproduces exactly what earlier versions did, so existing stories sound the same. */
export const DELIVERY: Record<Delivery, DeliveryPreset> = {
  natural: { split: false, pause: 0.25, master: false, rate: 0, pitch: 0, speed: 1, exag: 0, emotionAware: false },
  warm: { split: true, pause: 0.4, master: true, rate: -6, pitch: -2, speed: 0.84, exag: -0.05, emotionAware: true },
  calm: { split: true, pause: 0.55, master: true, rate: -14, pitch: -3, speed: 0.72, exag: -0.1, emotionAware: true },
};

// Calibrated by measuring words per second of speech: natural Edge is about 3.2, Kokoro at speed 1.0 about 3.8.
// Calm aims for roughly 2.3 to 2.7 words per second, warm for 2.7 to 3.0.
type EmotionDelivery = { rate: number; pitch: number; speed: number; exag: number; cfg: number };
/** Starting points, meant to be tuned by ear. exag/cfg are Chatterbox's `exaggeration` and `cfg_weight`. */
export const EMOTION: Record<Emotion, EmotionDelivery> = {
  neutral: { rate: 0, pitch: 0, speed: 1.0, exag: 0.45, cfg: 0.5 },
  happy: { rate: 2, pitch: 3, speed: 1.02, exag: 0.65, cfg: 0.45 },
  sad: { rate: -6, pitch: -4, speed: 0.94, exag: 0.6, cfg: 0.35 },
  angry: { rate: 3, pitch: -2, speed: 1.04, exag: 0.8, cfg: 0.4 },
  surprised: { rate: 3, pitch: 5, speed: 1.03, exag: 0.7, cfg: 0.4 },
  worried: { rate: 1, pitch: 2, speed: 1.0, exag: 0.6, cfg: 0.4 },
  smug: { rate: -3, pitch: -2, speed: 0.97, exag: 0.55, cfg: 0.5 },
  tired: { rate: -6, pitch: -5, speed: 0.93, exag: 0.35, cfg: 0.4 },
  excited: { rate: 5, pitch: 5, speed: 1.06, exag: 0.85, cfg: 0.35 },
  confused: { rate: 0, pitch: 2, speed: 1.0, exag: 0.55, cfg: 0.45 },
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const num = (s: string) => parseInt(s, 10) || 0;

export function edgeProsody(voice: Voice, delivery: Delivery, emotion: Emotion): { rate: string; pitch: string } {
  const d = DELIVERY[delivery];
  const e = d.emotionAware ? EMOTION[emotion] : { rate: 0, pitch: 0 };
  const rate = clamp(num(voice.rate) + d.rate + e.rate, -45, 45);
  const pitch = clamp(num(voice.pitch) + d.pitch + e.pitch, -60, 60);
  return { rate: `${rate >= 0 ? '+' : ''}${rate}%`, pitch: `${pitch >= 0 ? '+' : ''}${pitch}Hz` };
}

export function kokoroSpeed(delivery: Delivery, emotion: Emotion): number {
  const d = DELIVERY[delivery];
  return clamp(d.speed * (d.emotionAware ? EMOTION[emotion].speed : 1), 0.6, 1.3);
}

export function chatterboxParams(voice: Voice, delivery: Delivery, emotion: Emotion): { exaggeration: number; cfg: number } {
  const d = DELIVERY[delivery];
  const e = EMOTION[d.emotionAware ? emotion : 'neutral'];
  const trim = voice.expressiveness === undefined ? 0 : (voice.expressiveness - 0.5) * 0.6;
  return { exaggeration: clamp(e.exag + d.exag + trim, 0.25, 1.1), cfg: clamp(delivery === 'calm' ? Math.min(e.cfg, 0.4) : e.cfg, 0.1, 0.7) };
}

// ---- language + voice selection -------------------------------------------------------------

export function languageOf(voice: Voice): string {
  return (voice.language ?? voice.edge.split('-')[0]).toLowerCase();
}

export const KOKORO_LANGS: Record<string, string> = { en: 'en-us', hi: 'hi', es: 'es', fr: 'fr-fr', it: 'it', pt: 'pt-br', ja: 'ja', zh: 'cmn' };
export const CHATTERBOX_LANGS = ['ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sv', 'sw', 'tr', 'zh'];

/** Kokoro voice ids start with language letter + gender letter (af_heart = American, female). */
const KOKORO_PREFERRED: Record<string, { female: string[]; male: string[] }> = {
  en: { female: ['af_heart', 'af_nicole', 'af_bella', 'af_sarah'], male: ['am_michael', 'am_adam', 'am_fenrir'] },
  'en-gb': { female: ['bf_emma', 'bf_isabella'], male: ['bm_george', 'bm_lewis'] },
  hi: { female: ['hf_alpha', 'hf_beta'], male: ['hm_omega', 'hm_psi'] },
  es: { female: ['ef_dora'], male: ['em_alex'] },
  fr: { female: ['ff_siwis'], male: ['ff_siwis'] },
  it: { female: ['if_sara'], male: ['im_nicola'] },
  pt: { female: ['pf_dora'], male: ['pm_alex'] },
  ja: { female: ['jf_alpha'], male: ['jm_kumo'] },
  zh: { female: ['zf_xiaobei'], male: ['zm_yunxi'] },
};

/** The voice to use for a character: their own `kokoro` id if valid, else the best match for language + gender. */
export function pickKokoroVoice(voice: Voice, available: string[] | undefined): string {
  if (voice.kokoro && (!available || available.includes(voice.kokoro))) return voice.kokoro;
  const lang = languageOf(voice);
  const key = lang === 'en' && /^en-GB/i.test(voice.edge) ? 'en-gb' : lang;
  const list = (KOKORO_PREFERRED[key] ?? KOKORO_PREFERRED.en)[voice.gender];
  if (!available) return list[0];
  return list.find((v) => available.includes(v)) ?? available.find((v) => v.startsWith(list[0].slice(0, 2))) ?? available[0];
}

/** Preferred Kokoro voices for this character's language and gender, best first. */
export function kokoroCandidates(voice: Voice): string[] {
  const lang = languageOf(voice);
  const key = lang === 'en' && /^en-GB/i.test(voice.edge) ? 'en-gb' : lang;
  return (KOKORO_PREFERRED[key] ?? KOKORO_PREFERRED.en)[voice.gender];
}

export function kokoroLang(voice: Voice): string | undefined {
  const lang = languageOf(voice);
  if (lang === 'en' && /^en-GB/i.test(voice.edge)) return 'en-gb';
  return KOKORO_LANGS[lang];
}

/**
 * Split into sentences for pause placement, keeping the punctuation (understands the Devanagari danda).
 * Short sentences are merged with their neighbour: chopping "You stayed. You said sorry." into fragments sounds stilted,
 * so real pauses only go between sentences that have at least `minWords` words on both sides.
 */
export function splitSentences(text: string, minWords = 5): string[] {
  const parts = text.match(/[^.!?।॥…]+(?:[.!?।॥…]+["')\]]*|$)/g) ?? [text];
  const raw = parts.map((p) => p.trim()).filter((p) => /[\p{L}\p{N}]/u.test(p));
  const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
  const out: string[] = [];
  for (const s of raw) {
    if (out.length && (words(out[out.length - 1]) < minWords || words(s) < minWords)) out[out.length - 1] += ' ' + s;
    else out.push(s);
  }
  return out.length ? out : [text.trim()];
}

/** Short neutral passage used as the "voice anchor" so Chatterbox characters sound different from each other. */
export const ANCHOR_TEXT: Record<string, string> = {
  en: 'The evening was quiet, and the room was softly lit. Slowly, everything began to feel all right.',
  hi: 'शाम बहुत शांत थी, और कमरे में हल्की रोशनी थी। धीरे धीरे सब कुछ ठीक लगने लगा।',
};
export const anchorTextFor = (lang: string) => ANCHOR_TEXT[lang] ?? ANCHOR_TEXT.en;
