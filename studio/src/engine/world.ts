import * as THREE from 'three';
import type { Emotion, SetName, TLLine, TLShot, Timeline } from '../types';
import { applyMove, frameShot, type CamChar } from './camera';
import { buildRig, type Rig } from './characters';
import { blend, EMOTION_TABLE, type FaceParams } from './emotions';
import { buildSet, type SetBuild } from './sets';
import { clamp, hashString } from './util';

export type Dom = { cap: HTMLElement; ovl: HTMLElement; fade: HTMLElement };

const BLEND_FRAMES = 8;

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
    this.applyCaptionLayout();
  }

  private applyCaptionLayout() {
    const { cap, ovl } = this.dom;
    const h = this.tl.height;
    const top = { top: 0.3, middle: 0.46, bottom: 0.74 }[this.tl.look.captionPosition];
    cap.style.top = `${top * 100}%`;
    cap.style.fontSize = `${Math.round(h * this.tl.look.captionSize)}px`;
    ovl.style.fontSize = `${Math.round(h * 0.06)}px`;
  }

  shotAt(frame: number): TLShot {
    const shots = this.tl.shots;
    for (const s of shots) if (frame >= s.start && frame < s.end) return s;
    return frame < 0 ? shots[0] : shots[shots.length - 1];
  }

  private lineAt(shot: TLShot, id: string | undefined, f: number): TLLine | undefined {
    return shot.lines.find((l) => (id === undefined || l.speaker === id) && f >= l.start && f < l.end);
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

  renderFrame(frame: number) {
    const tl = this.tl;
    const fps = tl.fps;
    const t = frame / fps;
    const shot = this.shotAt(frame);
    const dur = Math.max(1, shot.end - shot.start);
    const local = clamp((frame - shot.start) / dur, 0, 1);

    // set + lighting
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

    // stage
    const n = tl.characters.length;
    const spacing = n <= 2 ? 2.3 : n === 3 ? 2.0 : 1.8;
    const xOf = new Map<string, number>();
    tl.characters.forEach((c, i) => xOf.set(c.id, (i - (n - 1) / 2) * spacing));
    const onStage = tl.characters.filter((c) => shot.cast.includes(c.id));
    if (set.laptopFree) {
      let lx = n % 2 === 1 ? spacing * 0.55 : 0;
      const type = shot.camera.type;
      const single = type === 'close' || type === 'low-angle' || type === 'high-angle' || (type === 'medium' && (shot.camera.focus || onStage.length < 2));
      const fx = xOf.get(shot.camera.focus ?? shot.lines[0]?.speaker ?? onStage[0]?.id ?? '');
      if (single && fx !== undefined) lx = fx - 2.6 * (Math.sign(fx) || 1); // park it beside the focus character, out of frame
      else if (type === 'over-shoulder' && fx !== undefined) lx = fx + 3.6 * (Math.sign(fx) || 1); // far side, away from the shoulder camera
      set.laptop.position.x = lx;
    }
    const lp = set.laptop.position;
    const anchors = { laptop: [lp.x, lp.y + 0.5, lp.z] as [number, number, number] };
    const centre = onStage.length ? onStage.reduce((a, c) => a + xOf.get(c.id)!, 0) / onStage.length : 0;

    const sampleFace = (id: string, f: number): FaceParams => EMOTION_TABLE[this.emotionAt(shot, id, f)];
    const sampleYaw = (id: string, f: number): number => {
      const x = xOf.get(id)!;
      if (onStage.length < 2) return 0;
      const spk = this.lastSpeaker(shot, f);
      let target = centre;
      if (spk && spk !== id && shot.cast.includes(spk)) target = xOf.get(spk)!;
      else if (spk === id) {
        const others = onStage.filter((c) => c.id !== id);
        target = others.reduce((a, c) => a + xOf.get(c.id)!, 0) / others.length;
      }
      return clamp((target - x) * 0.16, -0.5, 0.5);
    };

    for (const c of tl.characters) {
      const rig = this.rigs.get(c.id)!;
      const visible = shot.cast.includes(c.id);
      rig.root.visible = visible;
      if (!visible) continue;
      rig.root.position.set(xOf.get(c.id)!, 0, 0);
      const faces: FaceParams[] = [];
      let yaw = 0;
      for (let k = 0; k < BLEND_FRAMES; k++) {
        const f = Math.max(shot.start, frame - k);
        faces.push(sampleFace(c.id, f));
        yaw += sampleYaw(c.id, f) / BLEND_FRAMES;
      }
      const line = this.lineAt(shot, c.id, frame);
      const speak = line ? (line.envelope[frame - line.start] ?? 0) : 0;
      const action = line?.action ? { name: line.action, p: (frame - line.start) / fps } : null;
      rig.update({ t, face: blend(faces), speak, action, yaw, seed: this.seeds.get(c.id)! });
    }

    // camera
    const chars: CamChar[] = onStage.map((c) => ({ id: c.id, x: xOf.get(c.id)!, m: this.rigs.get(c.id)!.metrics }));
    const speaker = shot.lines[0]?.speaker ?? this.lastSpeaker(shot, frame);
    const base = frameShot(shot.camera.type, shot.camera.focus, { aspect: tl.width / tl.height, chars, speaker, anchors });
    const cam = applyMove(base, shot.camera.move, local, t, tl.look.handheld);
    this.camera.fov = cam.fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(cam.pos);
    this.camera.lookAt(cam.target);
    this.renderer.render(this.scene, this.camera);

    this.updateOverlay(frame, shot);
  }

  private updateOverlay(frame: number, shot: TLShot) {
    const { cap, ovl, fade } = this.dom;
    let chunk: { text: string; start: number; speaker: string } | undefined;
    for (const l of shot.lines) for (const c of l.chunks) if (frame >= c.start && frame < c.end) chunk = { text: c.text, start: c.start, speaker: l.speaker };
    if (chunk) {
      const color = this.tl.characters.find((c) => c.id === chunk!.speaker)?.captionColor ?? '#ffffff';
      const e = clamp((frame - chunk.start) / 4, 0, 1);
      cap.textContent = chunk.text;
      cap.style.color = color;
      cap.style.opacity = String(e);
      cap.style.transform = `translateY(${(1 - e) * 6}px) scale(${0.95 + 0.05 * e})`;
    } else {
      cap.style.opacity = '0';
      cap.textContent = '';
    }
    if (shot.overlay) {
      const local = frame - shot.start;
      const dur = shot.end - shot.start;
      ovl.textContent = shot.overlay;
      ovl.style.opacity = String(clamp(Math.min(local / 8, (dur - local) / 8), 0, 1));
    } else {
      ovl.style.opacity = '0';
    }
    const total = this.tl.frames;
    const fin = clamp(1 - frame / 8, 0, 1);
    const fout = clamp((frame - (total - 14)) / 14, 0, 1);
    fade.style.opacity = String(Math.max(fin, fout));
  }
}
