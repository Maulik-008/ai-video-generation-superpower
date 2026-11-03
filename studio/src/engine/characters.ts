import * as THREE from 'three';
import type { Action, ResolvedCharacter } from '../types';
import type { FaceParams } from './emotions';
import { shadowTexture } from './textures';
import { clamp, rng, smoothstep } from './util';

export type Metrics = { height: number; headY: number; chestY: number; width: number; faceW: number };
export type CharState = {
  t: number; // seconds
  face: FaceParams;
  speak: number; // 0..1 mouth openness from the audio
  action: { name: Action; p: number } | null; // p = 0..1 progress
  yaw: number;
  seed: number;
};
export interface Rig {
  root: THREE.Group;
  metrics: Metrics;
  update(s: CharState): void;
}

const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.78, metalness: 0.04, ...o });
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const ico = (r: number, detail: number, m: THREE.Material) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m);

export function blinkAmount(t: number, seed: number): number {
  const period = 3.3;
  const phase = (t + seed * 1.7) % period;
  return phase < 0.15 ? Math.sin((Math.PI * phase) / 0.15) : 0;
}

// ---------------------------------------------------------------------------------------------
// Pose: idle breathing + talking gestures + one-shot actions, all pure functions of time.
// ---------------------------------------------------------------------------------------------
type Arm = { fwd: number; abd: number };
type Pose = { y: number; z: number; lean: number; sway: number; squash: number; headX: number; headY: number; headZ: number; armL: Arm; armR: Arm };

function computePose(s: CharState, armRest: number): Pose {
  const { t, seed, face: f, speak: a } = s;
  const p: Pose = {
    y: f.bounce * Math.abs(Math.sin(t * 5.5 + seed)) * 0.09,
    z: 0,
    lean: f.lean,
    sway: Math.sin(t * 0.9 + seed) * 0.02,
    squash: Math.sin(t * 1.8 + seed) * 0.012,
    headX: f.headX + Math.sin(t * 1.1 + seed) * 0.02,
    headY: Math.sin(t * 0.7 + seed) * 0.05,
    headZ: f.headZ + Math.sin(t * 0.8 + seed * 2) * 0.02,
    armL: { fwd: 0, abd: armRest },
    armR: { fwd: 0, abd: armRest },
  };
  if (a > 0.03) {
    const g1 = a * (0.5 + 0.5 * Math.sin(t * 4.4 + seed));
    const g2 = a * (0.5 + 0.5 * Math.sin(t * 3.7 + seed * 1.7 + 1));
    p.headX += (a - 0.3) * 0.09;
    p.headZ += Math.sin(t * 3.1 + seed) * 0.035 * a;
    p.headY += Math.sin(t * 2.3 + seed) * 0.05 * a;
    p.armR.fwd += 0.7 * g1;
    p.armR.abd += 0.28 * g1;
    p.armL.fwd += 0.45 * g2;
    p.armL.abd += 0.2 * g2;
    p.lean += 0.02 * a;
  }
  if (s.action) {
    const ap = clamp(s.action.p, 0, 1);
    const bump = Math.sin(Math.PI * ap);
    switch (s.action.name) {
      case 'nod':
        p.headX += Math.sin(ap * Math.PI * 4) * 0.26 * (1 - ap);
        break;
      case 'shake':
        p.headY += Math.sin(ap * Math.PI * 6) * 0.4 * (1 - ap * 0.6);
        break;
      case 'shrug':
        p.armL.abd += 0.55 * bump;
        p.armR.abd += 0.55 * bump;
        p.headZ += 0.1 * bump;
        p.headX -= 0.06 * bump;
        p.y += 0.04 * bump;
        break;
      case 'point':
        p.armR.fwd += 1.5 * bump;
        p.armR.abd += 0.1 * bump;
        p.lean += 0.07 * bump;
        break;
      case 'lean-in':
        p.lean += 0.2 * bump;
        p.z += 0.2 * bump;
        break;
      case 'jump':
        p.y += Math.max(0, Math.sin(ap * Math.PI * 2)) * 0.38 * (1 - ap * 0.4);
        break;
      case 'slump': {
        const k = smoothstep(ap * 1.6);
        p.lean += 0.28 * k;
        p.headX += 0.3 * k;
        p.y -= 0.04 * k;
        break;
      }
      case 'wave': {
        const raise = smoothstep(ap * 5) * (1 - smoothstep((ap - 0.8) * 5));
        p.armR.abd += 2.2 * raise + Math.sin(ap * Math.PI * 10) * 0.25 * raise;
        break;
      }
    }
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// Face: eyes, brows, mouth. Shared by every character type.
// ---------------------------------------------------------------------------------------------
type FaceOpts = {
  eyeX: number;
  eyeY: number;
  eyeW: number; // half width (round) / half width (rect)
  eyeH: number;
  eyeZ: number;
  round: boolean;
  arcEyes: boolean; // swap to ^ ^ eyes when very happy
  browY: number;
  browW: number;
  alwaysBrows: boolean;
  mouthY: number;
  mouthW: number;
  mouthH: number;
  mouthZ: number;
  mouthAlways: boolean;
  ink: number;
};

function buildFace(o: FaceOpts) {
  const g = new THREE.Group();
  const ink = new THREE.MeshBasicMaterial({ color: o.ink });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes: THREE.Mesh[] = [];
  const glints: THREE.Mesh[] = [];
  const arcs: THREE.Mesh[] = [];
  const brows: THREE.Mesh[] = [];
  const sides = [-1, 1];
  for (const side of sides) {
    const eye = o.round ? new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), ink) : box(1, 1, 0.08, ink);
    eye.position.set(side * o.eyeX, o.eyeY, o.eyeZ);
    g.add(eye);
    eyes.push(eye);
    if (o.round) {
      const gl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), white);
      gl.scale.setScalar(o.eyeW * 0.3);
      g.add(gl);
      glints.push(gl);
    }
    if (o.arcEyes) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(o.eyeW * 1.2, o.eyeW * 0.3, 6, 14, Math.PI), ink);
      arc.position.set(side * o.eyeX, o.eyeY - o.eyeH * 0.2, o.eyeZ);
      g.add(arc);
      arcs.push(arc);
    }
    const brow = box(o.browW, 0.05, 0.05, ink);
    g.add(brow);
    brows.push(brow);
  }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 14, Math.PI), ink);
  g.add(arc);
  const openMouth = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x2b0d14 }));
  g.add(openMouth);

  function update(f: FaceParams, amp: number, blink: number) {
    const open = clamp(f.open + amp * 0.95, 0, 1);
    const eyeOpen = f.eye * (1 - 0.93 * blink);
    const happyArc = o.arcEyes && f.curve > 0.7;
    sides.forEach((side, i) => {
      const eye = eyes[i];
      eye.visible = !happyArc;
      if (o.round) eye.scale.set(o.eyeW, o.eyeH * eyeOpen, o.eyeW * 0.55);
      else eye.scale.set(o.eyeW * 2, o.eyeH * 2 * eyeOpen, 0.08);
      if (o.round) {
        glints[i].visible = !happyArc && eyeOpen > 0.4;
        glints[i].position.set(side * o.eyeX + o.eyeW * 0.35, o.eyeY + o.eyeH * 0.38 * eyeOpen, o.eyeZ + o.eyeW * 0.5);
      }
      if (arcs[i]) arcs[i].visible = happyArc;
      const asym = side < 0 ? f.browAsym : -f.browAsym;
      const tilt = f.browTilt + asym;
      const lift = f.browLift + Math.max(0, side > 0 ? f.browAsym : -f.browAsym) * 0.07;
      const brow = brows[i];
      brow.visible = o.alwaysBrows || Math.abs(f.browTilt) > 0.12 || Math.abs(f.browAsym) > 0.15 || f.browLift > 0.05;
      brow.position.set(side * o.eyeX, o.eyeY + o.browY + lift + (eyeOpen - 1) * 0.02, o.eyeZ + 0.015);
      brow.rotation.z = side < 0 ? tilt : -tilt;
    });
    const showOpen = open > 0.08;
    openMouth.visible = showOpen;
    if (showOpen) {
      openMouth.position.set(0, o.mouthY, o.mouthZ);
      openMouth.scale.set(o.mouthW * 0.5 * f.mouthW * (1.05 - 0.3 * open), 0.014 + o.mouthH * 0.6 * open, 0.05);
    }
    const showArc = !showOpen && (o.mouthAlways || Math.abs(f.curve) > 0.35);
    arc.visible = showArc;
    if (showArc) {
      const rise = Math.max(0.1, Math.abs(f.curve)) * o.mouthH;
      arc.scale.set(o.mouthW * f.mouthW, rise * 2, 1);
      arc.rotation.z = f.curve >= 0 ? Math.PI : 0;
      arc.position.set(0, o.mouthY + (f.curve >= 0 ? rise / 2 : -rise / 2), o.mouthZ);
    }
  }
  return { group: g, update };
}

function contactShadow(width: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, opacity: 0.55, depthWrite: false, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.set(width * 1.5, width * 1.05, 1);
  m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------------------------------------
// Human: big-headed low-poly person.
// ---------------------------------------------------------------------------------------------
function makeHair(style: string, mat: THREE.Material, accent: THREE.Material, seed: number): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(seed);
  if (style === 'bald') return g;
  if (style === 'cap') {
    const dome = ico(0.56, 1, accent);
    dome.scale.set(1, 0.62, 1.04);
    dome.position.set(0, 0.2, -0.04);
    const brim = box(0.7, 0.05, 0.5, accent);
    brim.position.set(0, 0.2, 0.5);
    g.add(dome, brim);
    return g;
  }
  const cap = ico(0.55, 1, mat);
  const bob = style === 'bob';
  cap.scale.set(bob ? 1.08 : 1.0, bob ? 0.9 : 0.72, bob ? 1.06 : 1.02);
  cap.position.set(0, bob ? 0.14 : 0.25, -0.13);
  g.add(cap);
  if (bob) {
    const fringe = box(0.92, 0.17, 0.2, mat);
    fringe.position.set(0, 0.36, 0.4);
    g.add(fringe);
    return g;
  }
  const count = style === 'spiky' ? 7 : 9;
  const h = style === 'spiky' ? 0.36 : 0.26;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const r = 0.27 + rand() * 0.04;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, h * (0.8 + rand() * 0.45), 4), mat);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r * 0.9 - 0.05;
    cone.position.set(x, 0.55, z);
    cone.rotation.z = -x * 1.3 + (rand() - 0.5) * 0.3;
    cone.rotation.x = z * 1.3 + (rand() - 0.5) * 0.3;
    g.add(cone);
  }
  const front = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 4), mat);
  front.position.set(0, 0.55, 0.2);
  front.rotation.x = 0.7;
  g.add(front);
  return g;
}

function buildHuman(c: ResolvedCharacter, seed: number): Rig {
  const L = c.look;
  const sit = c.pose === 'sit';
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(c.scale);
  root.add(inner);
  const skin = std(L.skin);
  const outfit = std(L.outfit);
  const pants = std(L.pants);
  const shoes = std(L.shoes, { roughness: 0.5, emissive: new THREE.Color(L.shoes), emissiveIntensity: 0.18 });
  const hairMat = std(L.hair);
  const accentMat = std(L.accent);
  const legLen = 0.78;
  const shoeH = 0.15;
  const hipY = sit ? 0.17 : legLen + shoeH;

  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, hipY, 0);
    const thigh = box(0.3, legLen, 0.32, pants);
    thigh.position.y = -legLen / 2;
    pivot.add(thigh);
    if (sit) {
      const shoe = box(0.34, 0.2, 0.3, shoes);
      shoe.position.set(0, -legLen - 0.1, 0);
      pivot.add(shoe);
      pivot.rotation.x = -Math.PI / 2;
    } else {
      const shoe = box(0.34, shoeH, 0.5, shoes);
      shoe.position.set(0, -legLen - shoeH / 2, 0.08);
      pivot.add(shoe);
    }
    inner.add(pivot);
  }

  const upper = new THREE.Group();
  upper.position.y = hipY;
  inner.add(upper);
  const torso = box(0.95, 0.95, 0.56, outfit);
  torso.position.y = 0.475;
  upper.add(torso);
  for (const side of [-1, 1]) {
    const string = box(0.035, 0.28, 0.03, accentMat);
    string.position.set(side * 0.09, 0.62, 0.295);
    upper.add(string);
  }

  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.58, 0.82, 0);
    const arm = box(0.24, 0.62, 0.26, outfit);
    arm.position.y = -0.31;
    const hand = box(0.22, 0.2, 0.22, skin);
    hand.position.y = -0.7;
    pivot.add(arm, hand);
    upper.add(pivot);
    arms.push(pivot);
  }

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.95;
  upper.add(headPivot);
  const head = ico(0.5, 1, skin);
  head.scale.set(1, 1.06, 0.96);
  head.position.y = 0.42;
  headPivot.add(head);
  const headCentre = new THREE.Group();
  headCentre.position.y = 0.42;
  headPivot.add(headCentre);
  for (const side of [-1, 1]) {
    const ear = ico(0.1, 0, skin);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(side * 0.5, -0.02, 0);
    headCentre.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.06, 0.5);
  headCentre.add(nose);
  headCentre.add(makeHair(L.hairStyle, hairMat, accentMat, seed * 997));

  const face = buildFace({
    eyeX: 0.19,
    eyeY: 0.03,
    eyeW: 0.066,
    eyeH: 0.092,
    eyeZ: 0.455,
    round: true,
    arcEyes: false,
    browY: 0.15,
    browW: 0.17,
    alwaysBrows: true,
    mouthY: -0.22,
    mouthW: 0.26,
    mouthH: 0.14,
    mouthZ: 0.445,
    mouthAlways: true,
    ink: 0x1b1220,
  });
  headCentre.add(face.group);

  const shadow = contactShadow(1.5 * c.scale);
  root.add(shadow);
  const top = hipY + 1.95;
  return {
    root,
    metrics: { height: top * c.scale, headY: (hipY + 1.37) * c.scale, chestY: (hipY + 0.55) * c.scale, width: 1.5 * c.scale, faceW: 1.3 * c.scale },
    update(s) {
      const p = computePose(s, 0.1);
      root.rotation.y = s.yaw;
      inner.position.set(0, p.y, p.z);
      upper.rotation.set(p.lean, 0, p.sway);
      upper.scale.y = 1 + p.squash;
      headPivot.rotation.set(p.headX, p.headY, p.headZ);
      arms[0].rotation.set(-p.armL.fwd, 0, -p.armL.abd);
      arms[1].rotation.set(-p.armR.fwd, 0, p.armR.abd);
      face.update(s.face, s.speak, blinkAmount(s.t, s.seed));
      shadow.scale.setScalar(1 - p.y * 0.4);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Cube: a box creature on four little legs (reads as a robot / AI / object).
// ---------------------------------------------------------------------------------------------
function buildCube(c: ResolvedCharacter): Rig {
  const L = c.look;
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(c.scale);
  root.add(inner);
  const bodyMat = std(L.body);
  const accent = std(L.accent);
  const legH = 0.42;
  const bodyW = 1.5;
  const bodyH = 1.2;
  const bodyD = 1.1;

  for (const x of [-0.52, -0.17, 0.17, 0.52]) {
    const leg = box(0.24, legH, 0.24, std(L.body, { color: new THREE.Color(L.body).multiplyScalar(0.8) }));
    leg.position.set(x, legH / 2, 0.22);
    inner.add(leg);
  }
  const upper = new THREE.Group();
  upper.position.y = legH;
  inner.add(upper);
  const body = box(bodyW, bodyH, bodyD, bodyMat);
  body.position.y = bodyH / 2;
  upper.add(body);
  const nubs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (bodyW / 2), bodyH * 0.45, 0.05);
    const nub = box(0.34, 0.3, 0.42, accent);
    nub.position.set(side * 0.17, 0, 0.1);
    pivot.add(nub);
    upper.add(pivot);
    nubs.push(pivot);
  }
  const face = buildFace({
    eyeX: 0.3,
    eyeY: 0.74,
    eyeW: 0.075,
    eyeH: 0.18,
    eyeZ: bodyD / 2 + 0.02,
    round: false,
    arcEyes: true,
    browY: 0.3,
    browW: 0.26,
    alwaysBrows: false,
    mouthY: 0.36,
    mouthW: 0.34,
    mouthH: 0.16,
    mouthZ: bodyD / 2 + 0.02,
    mouthAlways: false,
    ink: 0x160d12,
  });
  upper.add(face.group);
  const shadow = contactShadow(bodyW * c.scale);
  root.add(shadow);
  return {
    root,
    metrics: { height: (legH + bodyH) * c.scale, headY: (legH + 0.75) * c.scale, chestY: (legH + 0.6) * c.scale, width: (bodyW + 0.5) * c.scale, faceW: 2.6 * c.scale },
    update(s) {
      const p = computePose(s, 0);
      root.rotation.y = s.yaw;
      inner.position.set(0, p.y, p.z);
      upper.rotation.set(p.lean + p.headX * 0.6, p.headY * 0.6, p.sway + p.headZ * 0.8);
      upper.scale.y = 1 + p.squash;
      nubs[0].rotation.set(0, p.armL.fwd * 0.8, -p.armL.abd * 0.8);
      nubs[1].rotation.set(0, -p.armR.fwd * 0.8, p.armR.abd * 0.8);
      face.update(s.face, s.speak, blinkAmount(s.t, s.seed));
      shadow.scale.setScalar(1 - p.y * 0.4);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Blob: a soft round creature.
// ---------------------------------------------------------------------------------------------
function buildBlob(c: ResolvedCharacter): Rig {
  const L = c.look;
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(c.scale);
  root.add(inner);
  const bodyMat = std(L.body);
  const accent = std(L.accent);
  for (const x of [-0.32, 0.32]) {
    const foot = ico(0.2, 1, accent);
    foot.scale.set(1, 0.7, 1.3);
    foot.position.set(x, 0.14, 0.1);
    inner.add(foot);
  }
  const upper = new THREE.Group();
  upper.position.y = 1.0;
  inner.add(upper);
  const body = ico(0.8, 2, bodyMat);
  body.scale.set(1.05, 0.95, 0.95);
  upper.add(body);
  const nubs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.78, -0.05, 0.05);
    const nub = ico(0.2, 1, accent);
    nub.position.set(side * 0.1, -0.1, 0);
    pivot.add(nub);
    upper.add(pivot);
    nubs.push(pivot);
  }
  const face = buildFace({
    eyeX: 0.27,
    eyeY: 0.13,
    eyeW: 0.1,
    eyeH: 0.13,
    eyeZ: 0.7,
    round: true,
    arcEyes: true,
    browY: 0.22,
    browW: 0.22,
    alwaysBrows: false,
    mouthY: -0.17,
    mouthW: 0.36,
    mouthH: 0.2,
    mouthZ: 0.72,
    mouthAlways: true,
    ink: 0x1a1020,
  });
  upper.add(face.group);
  const shadow = contactShadow(1.7 * c.scale);
  root.add(shadow);
  return {
    root,
    metrics: { height: 1.8 * c.scale, headY: 1.1 * c.scale, chestY: 0.95 * c.scale, width: 1.9 * c.scale, faceW: 1.9 * c.scale },
    update(s) {
      const p = computePose(s, 0);
      root.rotation.y = s.yaw;
      inner.position.set(0, p.y, p.z);
      upper.rotation.set(p.lean + p.headX * 0.6, p.headY * 0.6, p.sway + p.headZ * 0.8);
      upper.scale.set(1 - p.squash * 0.6, 1 + p.squash, 1 - p.squash * 0.6);
      nubs[0].rotation.set(0, p.armL.fwd * 0.8, -p.armL.abd * 0.9);
      nubs[1].rotation.set(0, -p.armR.fwd * 0.8, p.armR.abd * 0.9);
      face.update(s.face, s.speak, blinkAmount(s.t, s.seed));
      shadow.scale.setScalar(1 - p.y * 0.4);
    },
  };
}

export function buildRig(c: ResolvedCharacter, seed: number): Rig {
  if (c.kind === 'cube') return buildCube(c);
  if (c.kind === 'blob') return buildBlob(c);
  return buildHuman(c, seed);
}
