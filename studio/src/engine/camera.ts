import * as THREE from 'three';
import type { Move, ShotType } from '../types';
import type { Metrics } from './characters';
import { easeOutBack, lerp, smoothstep } from './util';

export type CamChar = { id: string; x: number; m: Metrics };
export type CamCtx = {
  aspect: number;
  chars: CamChar[]; // who is on stage in this shot
  speaker?: string;
  anchors: Record<string, [number, number, number]>;
};
export type CamPose = { pos: THREE.Vector3; target: THREE.Vector3; fov: number };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Distance at which a plane of `width` world units exactly fills the frame width. */
function distFor(width: number, fov: number, aspect: number): number {
  return width / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect);
}

export function frameShot(type: ShotType, focusId: string | undefined, ctx: CamCtx): CamPose {
  const { chars, aspect } = ctx;
  const focus = chars.find((c) => c.id === (focusId ?? ctx.speaker)) ?? chars[0];
  const minX = Math.min(...chars.map((c) => c.x - c.m.width / 2));
  const maxX = Math.max(...chars.map((c) => c.x + c.m.width / 2));
  const cx = (minX + maxX) / 2;
  const span = maxX - minX;
  const tallest = Math.max(...chars.map((c) => c.m.height));

  if (type === 'wide') {
    const fov = 40;
    const d = distFor(span + 6.2, fov, aspect);
    return { pos: V(cx, 3.0, d), target: V(cx, 3.9, 0), fov };
  }
  if (type === 'two-shot' || (chars.length > 1 && type === 'medium' && !focusId)) {
    const fov = 36;
    const vertical = aspect < 1;
    const d = distFor(span + (vertical ? 1.3 : 2.0), fov, aspect);
    return vertical
      ? { pos: V(cx, tallest * 0.5 + 1.85, d), target: V(cx, tallest * 0.5 + 1.35, 0), fov }
      : { pos: V(cx, tallest * 0.5 + 2.3, d), target: V(cx, tallest * 0.5 + 1.9, 0), fov };
  }
  if (type === 'insert') {
    const a = ctx.anchors.laptop;
    if (a) {
      const fov = 34;
      const d = distFor(2.1, fov, aspect);
      return { pos: V(a[0], a[1] + 0.25, a[2] + d), target: V(a[0], a[1] + 0.05, a[2]), fov };
    }
    type = 'medium';
  }
  const f = focus;
  const other = chars.filter((c) => c.id !== f.id).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
  const fov = 34;
  switch (type) {
    case 'close': {
      const d = distFor(f.m.faceW, fov, aspect);
      const side = other ? Math.sign(other.x - f.x) : 0;
      return { pos: V(f.x - side * 0.35, f.m.headY + 0.08, d), target: V(f.x, f.m.headY - 0.02, 0), fov };
    }
    case 'over-shoulder': {
      if (!other) return frameShot('close', f.id, ctx);
      const dir = Math.sign(f.x - other.x) || 1;
      const d = distFor(f.m.faceW * 1.45, fov, aspect);
      return { pos: V(other.x - dir * 0.9, f.m.headY + 0.3, d), target: V(f.x - dir * 0.08, f.m.headY - 0.05, 0), fov };
    }
    case 'low-angle': {
      const d = distFor(f.m.faceW * 1.2, 38, aspect);
      return { pos: V(f.x, 0.3, d), target: V(f.x, f.m.headY, 0), fov: 38 };
    }
    case 'high-angle': {
      const d = distFor(f.m.faceW * 1.6, 36, aspect);
      return { pos: V(f.x, f.m.headY + 2.3, d), target: V(f.x, f.m.chestY, 0), fov: 36 };
    }
    case 'medium':
    default: {
      const d = distFor(f.m.faceW * 1.55, fov, aspect);
      return { pos: V(f.x, f.m.chestY + 0.7, d), target: V(f.x, f.m.chestY + 0.25, 0), fov };
    }
  }
}

/** Camera moves over the length of a shot (p = 0..1, `secs` since the cut) plus a whisper of hand-held drift. */
export function applyMove(base: CamPose, move: Move, p: number, t: number, handheld: boolean, secs = 0): CamPose {
  const e = smoothstep(p);
  const pos = base.pos.clone();
  const target = base.target.clone();
  const d = pos.clone().sub(target);
  switch (move) {
    case 'push-in':
      d.multiplyScalar(lerp(1.08, 0.92, e));
      break;
    case 'pull-out':
      d.multiplyScalar(lerp(0.92, 1.08, e));
      break;
    case 'drift-left': {
      const s = lerp(0.35, -0.35, e);
      pos.x += s;
      target.x += s;
      break;
    }
    case 'drift-right': {
      const s = lerp(-0.35, 0.35, e);
      pos.x += s;
      target.x += s;
      break;
    }
    case 'orbit':
      d.applyAxisAngle(new THREE.Vector3(0, 1, 0), lerp(-0.13, 0.13, e));
      break;
    case 'rise':
      pos.y += lerp(-0.25, 0.25, e);
      break;
    case 'punch-in':
      // a quick, springy zoom right after the cut (the emphasis beat of short-form video), then a slow creep
      d.multiplyScalar(lerp(1.16, 0.9, easeOutBack(secs / 0.42, 1.2)) * lerp(1, 0.96, e));
      break;
    case 'static':
      break;
  }
  const out = { pos: target.clone().add(d), target, fov: base.fov };
  if (move === 'drift-left' || move === 'drift-right' || move === 'rise') {
    out.pos = pos;
  }
  if (handheld) {
    out.pos.x += Math.sin(t * 1.3) * 0.012 + Math.sin(t * 2.9) * 0.005;
    out.pos.y += Math.sin(t * 1.7 + 1) * 0.01;
    out.target.x += Math.sin(t * 1.1 + 2) * 0.01;
    out.target.y += Math.sin(t * 1.9) * 0.008;
  }
  return out;
}
