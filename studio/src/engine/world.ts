import * as THREE from 'three';
import type { Action, Emotion, SetName, TLChunk, TLLine, TLShot, Timeline, Transition } from '../types';
import { applyMove, frameShot, type CamChar } from './camera';
import { buildRig, type Rig } from './characters';
import { EMOTION_TABLE, type FaceParams } from './emotions';
import { buildSet, type SetBuild } from './sets';
import { clamp, hashString, rng, springStep } from './util';

export type Dom = { cap: HTMLElement; ovl: HTMLElement; fade: HTMLElement };

const FACE_KEYS = Object.keys(EMOTION_TABLE.neutral) as (keyof FaceParams)[];
const ACTION_SECONDS = 1.1;
const TRANSITION_SECONDS: Record<Transition, number> = { cut: 0, fade: 0.45, dip: 0.6, whip: 0.3, zoom: 0.36 };
const MODE: Record<Transition, number> = { cut: 0, fade: 1, dip: 2, whip: 3, zoom: 4 };

/**
 * Everything that moves a character, precomputed once for every frame of the video. Rendering then only reads
 * these arrays, so any frame can be drawn on its own (the render farm draws frames out of order on several pages)
 * and every value is smooth across frames: expressions and head turns are springs, gestures follow a slow speech
 * energy, and the mouth releases gently after a line instead of snapping shut.
 */
type Tracks = {
  mouth: Float32Array;
  shape: Float32Array;
  energy: Float32Array;
  yaw: Float32Array;
  gazeX: Float32Array;
  gazeY: Float32Array;
  blink: Float32Array;
  face: Float32Array; // frames x FACE_KEYS
  actions: { name: Action; start: number }[];
};

/** Critically damped spring following `target`, restarting (no blend) wherever `reset` is set. */
function springTrack(target: Float32Array, reset: Uint8Array, fps: number, omega: number): Float32Array {
  const out = new Float32Array(target.length);
  const steps = 4;
  const dt = 1 / fps / steps;
  let x = target[0] ?? 0;
  let v = 0;
  for (let f = 0; f < target.length; f++) {
    if (reset[f]) {
      x = target[f];
      v = 0;
    } else {
      for (let k = 0; k < steps; k++) {
        v += (omega * omega * (target[f] - x) - 2 * omega * v) * dt;
        x += v * dt;
      }
    }
    out[f] = x;
  }
  return out;
}

const COMPOSITE_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// A and B are the finished frames (already tone-mapped and in display colours) of the outgoing and incoming shot.
const COMPOSITE_FS = `
uniform sampler2D tA; uniform sampler2D tB; uniform float p; uniform int mode; varying vec2 vUv;
vec4 blurX(sampler2D t, vec2 uv, float amt) { vec4 c = vec4(0.0); for (int i = -4; i <= 4; i++) c += texture2D(t, clamp(uv + vec2(float(i) * amt / 8.0, 0.0), 0.0, 1.0)); return c / 9.0; }
vec4 zoomBlur(sampler2D t, vec2 uv, float scale, float amt) { vec4 c = vec4(0.0); vec2 d = uv - 0.5; for (int i = 0; i < 8; i++) c += texture2D(t, 0.5 + d / (scale * (1.0 + amt * float(i) / 8.0))); return c / 8.0; }
void main() {
  vec4 c;
  if (mode == 1) c = mix(texture2D(tA, vUv), texture2D(tB, vUv), smoothstep(0.0, 1.0, p));
  else if (mode == 2) c = p < 0.5 ? texture2D(tA, vUv) * (1.0 - smoothstep(0.0, 0.5, p)) : texture2D(tB, vUv) * smoothstep(0.5, 1.0, p);
  else if (mode == 3) {
    float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
    float amt = sin(3.14159 * p) * 0.16;
    float x = vUv.x + e;
    c = x < 1.0 ? blurX(tA, vec2(x, vUv.y), amt) : blurX(tB, vec2(x - 1.0, vUv.y), amt);
  } else if (mode == 4) {
    float amt = sin(3.14159 * p) * 0.22;
    c = mix(zoomBlur(tA, vUv, 1.0 + p * 1.3, amt), zoomBlur(tB, vUv, 1.0 + (1.0 - p) * 0.45, amt), smoothstep(0.35, 0.65, p));
  } else c = texture2D(tB, vUv);
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rigs = new Map<string, Rig>();
  private sets = new Map<SetName, SetBuild>();
  private seeds = new Map<string, number>();
  private carry: Map<string, Record<string, Emotion>> = new Map(); // shot id -> char id -> emotion carried in from earlier shots
  private ambient = new THREE.AmbientLight();
  private hemi = new THREE.HemisphereLight();
  private key = new THREE.DirectionalLight();
  private rim = new THREE.DirectionalLight();
  private xOf = new Map<string, number>();
  private spacing: number;
  private shotOf: Int32Array;
  private tracks = new Map<string, Tracks>();
  // transitions: both shots are drawn to the canvas in turn, copied into textures, and blended by a full-screen quad
  private texA: THREE.FramebufferTexture;
  private texB: THREE.FramebufferTexture;
  private quad: { scene: THREE.Scene; camera: THREE.OrthographicCamera; mat: THREE.ShaderMaterial };
  private capKey = '';

  constructor(
    canvas: HTMLCanvasElement,
    private tl: Timeline,
    private dom: Dom,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(tl.width, tl.height, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera = new THREE.PerspectiveCamera(36, tl.width / tl.height, 0.1, 200);

    this.scene.add(this.ambient, this.hemi, this.key, this.rim, this.key.target, this.rim.target);
    this.key.target.position.set(0, 1.5, 0);
    this.rim.target.position.set(0, 1.5, 0);

    for (const c of tl.characters) {
      const seed = (hashString(c.id) % 1000) / 100;
      this.seeds.set(c.id, seed);
      const rig = buildRig(c, seed);
      this.rigs.set(c.id, rig);
      this.scene.add(rig.root);
    }
    for (const shot of tl.shots) {
      if (!this.sets.has(shot.set)) {
        const s = buildSet(shot.set);
        s.group.visible = false;
        this.scene.add(s.group);
        this.sets.set(shot.set, s);
      }
    }
    const last: Record<string, Emotion> = {};
    for (const shot of tl.shots) {
      this.carry.set(shot.id, { ...last });
      for (const l of shot.lines) last[l.speaker] = l.emotion;
    }
    const n = tl.characters.length;
    // vertical frames are narrow: standing a little closer lets a two-shot fill the phone screen instead of the sky
    const vertical = tl.width < tl.height;
    this.spacing = vertical ? (n <= 2 ? 2.0 : n === 3 ? 1.85 : 1.65) : n <= 2 ? 2.3 : n === 3 ? 2.0 : 1.8;
    tl.characters.forEach((c, i) => this.xOf.set(c.id, (i - (n - 1) / 2) * this.spacing));
    this.shotOf = new Int32Array(tl.frames);
    tl.shots.forEach((s, i) => this.shotOf.fill(i, Math.max(0, s.start), Math.min(tl.frames, s.end)));
    for (const c of tl.characters) this.tracks.set(c.id, this.buildTracks(c.id));

    this.texA = new THREE.FramebufferTexture(tl.width, tl.height);
    this.texB = new THREE.FramebufferTexture(tl.width, tl.height);
    const mat = new THREE.ShaderMaterial({
      uniforms: { tA: { value: this.texA }, tB: { value: this.texB }, p: { value: 0 }, mode: { value: 0 } },
      vertexShader: COMPOSITE_VS,
      fragmentShader: COMPOSITE_FS,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });
    const qs = new THREE.Scene();
    qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    this.quad = { scene: qs, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
    this.applyCaptionLayout();
  }

  private applyCaptionLayout() {
    const { cap, ovl } = this.dom;
    const h = this.tl.height;
    const top = { top: 0.29, middle: 0.46, bottom: 0.72 }[this.tl.look.captionPosition];
    cap.style.top = `${top * 100}%`;
    cap.style.fontSize = `${Math.round(h * this.tl.look.captionSize)}px`;
    cap.className = this.tl.look.captionStyle === 'classic' ? 'classic' : 'bold';
    ovl.style.fontSize = `${Math.round(h * 0.062)}px`;
  }

  shotAt(frame: number): TLShot {
    return this.tl.shots[this.shotOf[clamp(frame, 0, this.tl.frames - 1)]];
  }

  private lastSpeaker(shot: TLShot, f: number): string | undefined {
    let who: string | undefined;
    for (const l of shot.lines) if (l.start <= f) who = l.speaker;
    return who;
  }

  private emotionAt(shot: TLShot, id: string, f: number): Emotion {
    let emo: Emotion | undefined;
    for (const l of shot.lines) if (l.speaker === id && l.start <= f) emo = l.emotion;
    return emo ?? shot.reactions[id] ?? this.carry.get(shot.id)?.[id] ?? 'neutral';
  }

  private onStage(shot: TLShot) {
    return this.tl.characters.filter((c) => shot.cast.includes(c.id));
  }

  /** Where a character's body turns: toward whoever is talking, or toward the others while they talk themselves. */
  private yawTarget(shot: TLShot, id: string, f: number): number {
    const stage = this.onStage(shot);
    if (stage.length < 2 || !shot.cast.includes(id)) return 0;
    const x = this.xOf.get(id)!;
    const spk = this.lastSpeaker(shot, f);
    let target = stage.reduce((a, c) => a + this.xOf.get(c.id)!, 0) / stage.length;
    if (spk && spk !== id && shot.cast.includes(spk)) target = this.xOf.get(spk)!;
    else if (spk === id) {
      const others = stage.filter((c) => c.id !== id);
      target = others.reduce((a, c) => a + this.xOf.get(c.id)!, 0) / others.length;
    }
    return clamp((target - x) * 0.16, -0.5, 0.5);
  }

  private buildTracks(id: string): Tracks {
    const { frames: F, fps } = this.tl;
    const dt = 1 / fps;
    const mouth = new Float32Array(F);
    const shape = new Float32Array(F).fill(0.5);
    const inLine = new Uint8Array(F);
    const actions: Tracks['actions'] = [];
    for (const shot of this.tl.shots)
      for (const l of shot.lines) {
        if (l.speaker !== id) continue;
        for (let k = 0; k < l.envelope.length && l.start + k < F; k++) {
          mouth[l.start + k] = l.envelope[k];
          shape[l.start + k] = l.shape?.[k] ?? 0.5;
          inLine[l.start + k] = 1;
        }
        if (l.action) actions.push({ name: l.action, start: l.start });
      }
    const release = Math.pow(0.6, 30 / fps);
    for (let f = 1; f < F; f++)
      if (!inLine[f]) {
        mouth[f] = mouth[f - 1] * release;
        shape[f] = shape[f - 1] + (0.5 - shape[f - 1]) * 0.2;
      }
    const energy = new Float32Array(F);
    const up = 1 - Math.exp(-dt / 0.22);
    const down = 1 - Math.exp(-dt / 0.55);
    for (let f = 1; f < F; f++) energy[f] = energy[f - 1] + (mouth[f] - energy[f - 1]) * (mouth[f] > energy[f - 1] ? up : down);

    // expressions and head turns: springs that restart at every cut (a cut shows the new state at once, like film)
    const reset = new Uint8Array(F);
    for (const s of this.tl.shots) if (s.start < F) reset[s.start] = 1;
    reset[0] = 1;
    const face = new Float32Array(F * FACE_KEYS.length);
    const targets = FACE_KEYS.map(() => new Float32Array(F));
    const yawT = new Float32Array(F);
    for (let f = 0; f < F; f++) {
      const shot = this.shotAt(f);
      const p = EMOTION_TABLE[this.emotionAt(shot, id, f)];
      FACE_KEYS.forEach((k, i) => (targets[i][f] = p[k]));
      yawT[f] = this.yawTarget(shot, id, f);
    }
    FACE_KEYS.forEach((_, i) => {
      const sm = springTrack(targets[i], reset, fps, 9);
      for (let f = 0; f < F; f++) face[f * FACE_KEYS.length + i] = sm[f];
    });
    const yaw = springTrack(yawT, reset, fps, 6.5);

    // eyes: follow the head turn a little further, plus small darting saccades at irregular moments
    const r = rng(hashString(id) ^ 0x9e3779b9);
    const gxT = new Float32Array(F);
    const gyT = new Float32Array(F);
    let sx = 0;
    let sy = 0;
    let next = 0;
    for (let f = 0; f < F; f++) {
      const t = f * dt;
      if (t >= next) {
        sx = (r() - 0.5) * 0.6;
        sy = (r() - 0.5) * 0.35;
        next = t + 0.6 + r() * 1.8;
      }
      gxT[f] = clamp(yawT[f] * 1.6 + sx, -0.9, 0.9);
      gyT[f] = sy;
    }
    const gazeReset = new Uint8Array(F);
    gazeReset[0] = 1;
    const gazeX = springTrack(gxT, gazeReset, fps, 34);
    const gazeY = springTrack(gyT, gazeReset, fps, 34);

    // blinks at irregular intervals (sometimes a double blink): close fast, open a little slower
    const blink = new Float32Array(F);
    const rb = rng(hashString(id) ^ 0x51ed27);
    for (let t = 0.6 + rb() * 1.5; t < F * dt; t += 1.8 + rb() * 3.2) {
      const starts = rb() < 0.18 ? [t, t + 0.28] : [t];
      for (const s0 of starts)
        for (let f = Math.floor(s0 * fps); f < Math.min(F, Math.ceil((s0 + 0.2) * fps)); f++) {
          const ph = f * dt - s0;
          const v = ph < 0 ? 0 : ph < 0.06 ? ph / 0.06 : ph < 0.2 ? 1 - (ph - 0.06) / 0.14 : 0;
          blink[f] = Math.max(blink[f], v);
        }
    }
    return { mouth, shape, energy, yaw, gazeX, gazeY, blink, face, actions };
  }

  private faceAt(tr: Tracks, f: number): FaceParams {
    const out = { ...EMOTION_TABLE.neutral };
    FACE_KEYS.forEach((k, i) => (out[k] = tr.face[f * FACE_KEYS.length + i]));
    return out;
  }

  /** Draw one shot at one frame onto the canvas (scene, lighting, cast, camera). */
  private drawShot(shot: TLShot, frame: number) {
    const tl = this.tl;
    const fps = tl.fps;
    const t = frame / fps;
    const f = clamp(frame, 0, tl.frames - 1);
    const dur = Math.max(1, shot.end - shot.start);
    const local = clamp((frame - shot.start) / dur, 0, 1);

    for (const [name, s] of this.sets) s.group.visible = name === shot.set;
    const set = this.sets.get(shot.set)!;
    set.update(t);
    set.setScreen(shot.screen);
    this.scene.background = set.background;
    this.scene.fog = set.fog ? new THREE.Fog(set.fog[0], set.fog[1], set.fog[2]) : null;
    const L = set.lights;
    this.ambient.color.set(L.ambient[0]);
    this.ambient.intensity = L.ambient[1];
    this.hemi.color.set(L.hemi[0]);
    this.hemi.groundColor.set(L.hemi[1]);
    this.hemi.intensity = L.hemi[2];
    this.key.color.set(L.key.color);
    this.key.intensity = L.key.intensity;
    this.key.position.set(...L.key.pos);
    this.rim.color.set(L.rim.color);
    this.rim.intensity = L.rim.intensity;
    this.rim.position.set(...L.rim.pos);

    const n = tl.characters.length;
    const spacing = this.spacing;
    const xOf = this.xOf;
    const onStage = this.onStage(shot);
    set.laptop.visible = tl.look.laptop !== false || shot.camera.type === 'insert';
    if (set.laptopFree) {
      let lx = n % 2 === 1 ? spacing * 0.55 : 0;
      const type = shot.camera.type;
      const single = type === 'close' || type === 'low-angle' || type === 'high-angle' || (type === 'medium' && (shot.camera.focus || onStage.length < 2));
      const fx = xOf.get(shot.camera.focus ?? shot.lines[0]?.speaker ?? onStage[0]?.id ?? '');
      const xs = onStage.map((c) => xOf.get(c.id)!);
      if (single && fx !== undefined) lx = fx - 2.6 * (Math.sign(fx) || 1); // park it beside the focus character, out of frame
      else if (type === 'over-shoulder' && fx !== undefined) lx = fx + 3.6 * (Math.sign(fx) || 1); // far side, away from the shoulder camera
      else if (onStage.length < n && xs.some((x) => Math.abs(x - lx) < 1.3)) lx = Math.max(...xs) + 1.7; // only part of the cast is here: beside them, not in front
      set.laptop.position.x = lx;
    }
    const lp = set.laptop.position;
    const anchors = { laptop: [lp.x, lp.y + 0.5, lp.z] as [number, number, number] };

    for (const c of tl.characters) {
      const rig = this.rigs.get(c.id)!;
      const visible = shot.cast.includes(c.id);
      rig.root.visible = visible;
      if (!visible) continue;
      rig.root.position.set(xOf.get(c.id)!, 0, 0);
      const tr = this.tracks.get(c.id)!;
      let action: { name: Action; p: number } | null = null;
      for (const a of tr.actions) {
        const p = (frame - a.start) / (ACTION_SECONDS * fps);
        if (p >= 0 && p < 1) action = { name: a.name, p };
      }
      rig.update({
        t,
        face: this.faceAt(tr, f),
        speak: tr.mouth[f],
        shape: tr.shape[f],
        energy: tr.energy[f],
        action,
        yaw: tr.yaw[f],
        gaze: [tr.gazeX[f], tr.gazeY[f]],
        blink: tr.blink[f],
        seed: this.seeds.get(c.id)!,
      });
    }

    const chars: CamChar[] = onStage.map((c) => ({ id: c.id, x: xOf.get(c.id)!, m: this.rigs.get(c.id)!.metrics }));
    const speaker = shot.lines[0]?.speaker ?? this.lastSpeaker(shot, frame);
    const base = frameShot(shot.camera.type, shot.camera.focus, { aspect: tl.width / tl.height, chars, speaker, anchors });
    const cam = applyMove(base, shot.camera.move, local, t, tl.look.handheld, Math.max(0, (frame - shot.start) / fps));
    this.camera.fov = cam.fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(cam.pos);
    this.camera.lookAt(cam.target);
    this.renderer.render(this.scene, this.camera);
  }

  renderFrame(frame: number) {
    const tl = this.tl;
    const si = this.shotOf[clamp(frame, 0, tl.frames - 1)];
    const shot = tl.shots[si];
    const trFrames = Math.round(TRANSITION_SECONDS[shot.transition ?? 'cut'] * tl.fps);
    const into = frame - shot.start;
    if (si > 0 && trFrames > 0 && into < trFrames) {
      this.drawShot(tl.shots[si - 1], frame);
      this.renderer.copyFramebufferToTexture(this.texA);
      this.drawShot(shot, frame);
      this.renderer.copyFramebufferToTexture(this.texB);
      this.quad.mat.uniforms.p.value = (into + 0.5) / trFrames;
      this.quad.mat.uniforms.mode.value = MODE[shot.transition];
      this.renderer.render(this.quad.scene, this.quad.camera);
    } else {
      this.drawShot(shot, frame);
    }
    this.updateOverlay(frame, shot);
  }

  private highlight(speaker: string): string {
    const c = this.tl.characters.find((x) => x.id === speaker)?.captionColor ?? '#ffffff';
    const v = parseInt(c.slice(1), 16);
    const light = (((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255)) / 3;
    return light > 225 ? '#ffd23f' : c; // a white speaker colour would not stand out, so use a warm yellow instead
  }

  private updateCaption(frame: number, shot: TLShot) {
    const { cap } = this.dom;
    const fps = this.tl.fps;
    let hit: { chunk: TLChunk; line: TLLine } | undefined;
    for (const l of shot.lines) for (const c of l.chunks) if (frame >= c.start && frame < c.end) hit = { chunk: c, line: l };
    if (!hit || this.tl.look.captionStyle === 'none') {
      cap.style.opacity = '0';
      cap.textContent = '';
      this.capKey = '';
      return;
    }
    const { chunk, line } = hit;
    const secs = (frame - chunk.start) / fps;
    if (this.tl.look.captionStyle === 'classic' || !chunk.words?.length) {
      const e = clamp(secs / 0.13, 0, 1);
      if (this.capKey !== `c${line.start}:${chunk.start}`) {
        cap.textContent = chunk.text;
        this.capKey = `c${line.start}:${chunk.start}`;
      }
      cap.style.color = this.tl.characters.find((c) => c.id === line.speaker)?.captionColor ?? '#ffffff';
      cap.style.opacity = String(e);
      cap.style.transform = `translateY(${(1 - e) * 6}px) scale(${0.95 + 0.05 * e})`;
      return;
    }
    const key = `b${line.start}:${chunk.start}`;
    if (this.capKey !== key) {
      cap.textContent = '';
      chunk.words.forEach((w, i) => {
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = w.text;
        cap.appendChild(span);
        if (i < chunk.words!.length - 1) cap.appendChild(document.createTextNode(' '));
      });
      this.capKey = key;
    }
    // the group pops in on a spring; the word being spoken lights up in the speaker's colour and swells slightly
    const pop = springStep(secs, 3.4, 0.5);
    cap.style.opacity = String(clamp(secs / 0.07, 0, 1));
    cap.style.transform = `translateY(${((1 - pop) * 0.22).toFixed(3)}em) scale(${(0.8 + 0.2 * pop).toFixed(4)})`;
    const hl = this.highlight(line.speaker);
    const spans = cap.querySelectorAll<HTMLSpanElement>('span.w');
    chunk.words.forEach((w, i) => {
      const s = spans[i];
      if (!s) return;
      const until = chunk.words![i + 1]?.start ?? chunk.end;
      const active = frame >= w.start && frame < until;
      const k = active ? springStep((frame - w.start) / fps, 5, 0.45) : 0;
      s.style.color = active ? hl : '#ffffff';
      s.style.transform = `scale(${(1 + 0.1 * k).toFixed(4)})`;
    });
  }

  private updateOverlay(frame: number, shot: TLShot) {
    const { ovl, fade } = this.dom;
    const fps = this.tl.fps;
    this.updateCaption(frame, shot);
    if (shot.overlay) {
      const local = (frame - shot.start) / fps;
      const left = (shot.end - frame) / fps;
      const pop = springStep(local, 2.6, 0.55);
      ovl.textContent = shot.overlay;
      ovl.style.opacity = String(clamp(Math.min(local / 0.15, left / 0.25), 0, 1));
      ovl.style.transform = `translateY(-50%) scale(${(0.86 + 0.14 * pop).toFixed(4)})`;
    } else {
      ovl.style.opacity = '0';
    }
    const total = this.tl.frames;
    const fin = clamp(1 - frame / (0.27 * fps), 0, 1);
    const fout = clamp((frame - (total - 0.47 * fps)) / (0.47 * fps), 0, 1);
    fade.style.opacity = String(Math.max(fin, fout));
  }
}
