import type { Emotion } from '../types';

/** Everything an emotion changes on a face/body. Blended over a few frames so expressions never pop. */
export type FaceParams = {
  browTilt: number; // + = inner ends up (worried/sad), - = inner ends down (angry)
  browLift: number; // brows up/down
  browAsym: number; // extra tilt on one brow (confused / smug)
  eye: number; // eye openness multiplier (1 = normal)
  curve: number; // mouth curve: + smile, - frown
  mouthW: number; // mouth width multiplier
  open: number; // resting mouth opening (surprise)
  headX: number; // + = look down
  headZ: number; // head tilt
  lean: number; // body lean forward (+) / back (-)
  bounce: number; // energetic bobbing
  sweat: number; // 0..1 a sweat drop by the head (worry, panic)
  tears: number; // 0..1 tears running from the eyes
  blush: number; // 0..1 pink cheeks (joy, pride)
};

const F = (p: Partial<FaceParams>): FaceParams => ({
  browTilt: 0,
  browLift: 0,
  browAsym: 0,
  eye: 1,
  curve: 0.08,
  mouthW: 1,
  open: 0,
  headX: 0,
  headZ: 0,
  lean: 0,
  bounce: 0,
  sweat: 0,
  tears: 0,
  blush: 0,
  ...p,
});

export const EMOTION_TABLE: Record<Emotion, FaceParams> = {
  neutral: F({}),
  happy: F({ browLift: 0.03, eye: 0.85, curve: 0.95, mouthW: 1.15, headZ: 0.05, bounce: 0.3, blush: 0.55 }),
  sad: F({ browTilt: 0.4, eye: 0.9, curve: -0.75, mouthW: 0.8, headX: 0.14, lean: 0.05, tears: 1 }),
  angry: F({ browTilt: -0.5, browLift: -0.02, eye: 0.72, curve: -0.55, mouthW: 0.9, lean: 0.08, headX: 0.04 }),
  surprised: F({ browLift: 0.08, eye: 1.35, curve: 0, mouthW: 0.7, open: 0.55, lean: -0.1, headX: -0.05, sweat: 0.45 }),
  worried: F({ browTilt: 0.32, browLift: 0.02, eye: 1.08, curve: -0.35, mouthW: 0.85, headZ: -0.06, sweat: 1 }),
  smug: F({ browLift: 0.02, browAsym: 0.3, eye: 0.6, curve: 0.55, mouthW: 1.05, headZ: 0.08, headX: -0.05, lean: -0.04, blush: 0.2 }),
  tired: F({ browTilt: 0.12, eye: 0.45, curve: -0.12, mouthW: 0.8, headX: 0.2, lean: 0.12, sweat: 0.3 }),
  excited: F({ browLift: 0.07, eye: 1.2, curve: 0.9, mouthW: 1.2, bounce: 1, lean: 0.05, blush: 0.75 }),
  confused: F({ browTilt: 0.08, browAsym: -0.45, eye: 1, curve: -0.15, headZ: 0.14, mouthW: 0.9, sweat: 0.55 }),
};
