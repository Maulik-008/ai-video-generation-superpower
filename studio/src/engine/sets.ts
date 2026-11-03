import * as THREE from 'three';
import type { SetName } from '../types';
import { bokehTexture, glowTexture, gradientTexture, nightWindowTexture, panelTexture, screenTexture } from './textures';
import { rng } from './util';

export type LightPreset = {
  ambient: [string, number];
  hemi: [string, string, number];
  key: { color: string; intensity: number; pos: [number, number, number] };
  rim: { color: string; intensity: number; pos: [number, number, number] };
};
export type SetBuild = {
  group: THREE.Group;
  laptop: THREE.Group;
  laptopFree: boolean; // true when the laptop may slide sideways to stay clear of a centre character
  background: THREE.Texture;
  fog?: [string, number, number];
  lights: LightPreset;
  anchors: Record<string, [number, number, number]>;
  update(t: number): void;
  setScreen(lines: string[] | undefined): void;
};

const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.03, ...o });
const basic = (color: string, o: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

function sprite(color: string, size: number, opacity: number, map: THREE.Texture = glowTexture()): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  s.scale.set(size, size, 1);
  return s;
}

type Twinkle = { s: THREE.Sprite; base: number; phase: number; speed: number };
const twinkle = (list: Twinkle[], t: number) => {
  for (const w of list) (w.s.material as THREE.SpriteMaterial).opacity = w.base * (0.72 + 0.28 * Math.sin(t * w.speed + w.phase));
};

const DEFAULT_SCREEN = ['> ready', '', 'waiting for input_'];

function makeLaptop() {
  const g = new THREE.Group();
  const base = box(1.5, 0.05, 1.0, std('#c9cbd6', { metalness: 0.5, roughness: 0.4 }));
  base.position.set(0, 0.025, 0.5);
  g.add(base);
  const lid = new THREE.Group();
  lid.position.set(0, 0.05, 0);
  lid.rotation.x = -0.22;
  g.add(lid);
  const frame = box(1.5, 0.98, 0.04, std('#2a2d3a'));
  frame.position.set(0, 0.49, 0);
  lid.add(frame);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture(DEFAULT_SCREEN), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.86), screenMat);
  screen.position.set(0, 0.49, 0.022);
  lid.add(screen);
  const halo = sprite('#6f8cff', 3.2, 0.22);
  halo.position.set(0, 0.55, 0.2);
  g.add(halo);
  let sig = DEFAULT_SCREEN.join('\n');
  return {
    group: g,
    setScreen(lines: string[] | undefined) {
      const l = lines && lines.length ? lines : DEFAULT_SCREEN;
      const s = l.join('\n');
      if (s === sig) return;
      sig = s;
      screenMat.map?.dispose();
      screenMat.map = screenTexture(l);
      screenMat.needsUpdate = true;
    },
  };
}

function finish(
  group: THREE.Group,
  base: Omit<SetBuild, 'group' | 'update' | 'setScreen' | 'anchors' | 'laptop' | 'laptopFree'> & { update?: (t: number) => void },
  laptop: { group: THREE.Group; setScreen(l: string[] | undefined): void },
  at: [number, number, number],
  laptopFree = true,
): SetBuild {
  laptop.group.position.set(...at);
  group.add(laptop.group);
  return {
    group,
    laptop: laptop.group,
    laptopFree,
    background: base.background,
    fog: base.fog,
    lights: base.lights,
    anchors: { laptop: [at[0], at[1] + 0.5, at[2]] },
    update: base.update ?? (() => {}),
    setScreen: laptop.setScreen,
  };
}

// ------------------------------------------------------------------------------------------------
function skylineNight(): SetBuild {
  const g = new THREE.Group();
  const r = rng(11);
  const tw: Twinkle[] = [];
  const slab = box(60, 0.5, 34, std('#171d4f'));
  slab.position.set(0, -0.25, 3);
  g.add(slab);
  const lip = box(40, 0.05, 0.12, basic('#4a5cff'));
  lip.position.set(0, 0.01, 4.45);
  g.add(lip);

  for (let i = 0; i < 26; i++) {
    const x = -22 + i * 1.75 + (r() - 0.5) * 0.8;
    const w = 1.3 + r() * 1.8;
    const h = 2.5 + r() * 7.5;
    const z = -14 - r() * 5;
    const col = new THREE.Color('#0b1238').lerp(new THREE.Color('#1c2468'), r() * 0.6);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), new THREE.MeshBasicMaterial({ color: col }));
    b.position.set(x, h / 2 - 0.5, z);
    g.add(b);
    const wins = 3 + Math.floor(r() * 6);
    for (let k = 0; k < wins; k++) {
      const op = 0.55 + r() * 0.4;
      const s = sprite(r() > 0.25 ? '#ffcf7a' : '#9fb4ff', 0.3 + r() * 0.28, op);
      s.position.set(x + (r() - 0.5) * w * 0.8, r() * h * 0.9 - 0.2, z + 1.1);
      g.add(s);
      tw.push({ s, base: op, phase: r() * 6, speed: 0.5 + r() * 1.4 });
    }
  }
  for (let i = 0; i < 16; i++) {
    const colors = ['#ffb86b', '#ff8fa3', '#7fa0ff', '#ffe29a'];
    const op = 0.14 + r() * 0.16;
    const s = sprite(colors[Math.floor(r() * colors.length)], 0.7 + r() * 1.1, op, bokehTexture());
    s.position.set(-9 + r() * 18, 0.4 + r() * 4.2, -9 - r() * 2);
    g.add(s);
    tw.push({ s, base: op, phase: r() * 6, speed: 0.3 + r() * 0.8 });
  }
  for (let i = 0; i < 8; i++) {
    const x = -7.5 + i * 2.15;
    const y = 5.1 - Math.sin((i / 7) * Math.PI) * 0.7;
    const s = sprite('#ffcf8a', 1.7, 0.85);
    s.position.set(x, y, -5.5);
    g.add(s);
    tw.push({ s, base: 0.85, phase: r() * 6, speed: 0.4 + r() * 0.5 });
    const core = sprite('#fff4d8', 0.5, 0.95);
    core.position.set(x, y, -5.4);
    g.add(core);
  }
  const frameMat = basic('#070c26');
  for (const x of [-7, -2.6, 1.8, 6.2]) {
    const v = box(0.16, 11, 0.16, frameMat);
    v.position.set(x, 4.5, -6.5);
    g.add(v);
  }
  for (const y of [1.7, 4.8]) {
    const h = box(24, 0.14, 0.16, frameMat);
    h.position.set(0, y, -6.5);
    g.add(h);
  }
  const motes: { s: THREE.Sprite; x: number; y: number; z: number; sp: number; ph: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const s = sprite('#bcd0ff', 0.09 + r() * 0.1, 0.5);
    const m = { s, x: -5 + r() * 10, y: r() * 6, z: -3 + r() * 5, sp: 0.1 + r() * 0.2, ph: r() * 6 };
    motes.push(m);
    g.add(s);
  }
  return finish(
    g,
    {
      background: gradientTexture([[0, '#070b26'], [0.5, '#142058'], [1, '#2b2a78']]),
      lights: {
        ambient: ['#3a4aa0', 1.1],
        hemi: ['#5a6cff', '#1a1030', 0.5],
        key: { color: '#ffb883', intensity: 2.6, pos: [3.5, 4.5, 5] },
        rim: { color: '#6f86ff', intensity: 3.0, pos: [-4, 3, -3] },
      },
      update(t) {
        twinkle(tw, t);
        for (const m of motes) {
          m.s.position.set(m.x + Math.sin(t * 0.4 + m.ph) * 0.3, (m.y + t * m.sp) % 6, m.z);
          (m.s.material as THREE.SpriteMaterial).opacity = 0.25 + 0.3 * Math.sin(t * 1.3 + m.ph);
        }
      },
    },
    makeLaptop(),
    [0, 0, 2.0],
  );
}

// ------------------------------------------------------------------------------------------------
function spaceStage(): SetBuild {
  const g = new THREE.Group();
  const r = rng(23);
  const tw: Twinkle[] = [];
  const slab = box(60, 0.4, 34, std('#1b1446', { metalness: 0.5, roughness: 0.35 }));
  slab.position.set(0, -0.2, 3);
  g.add(slab);
  const strip = box(40, 0.04, 0.16, basic('#8b6bff'));
  strip.position.set(0, 0.02, 2.9);
  g.add(strip);
  for (let i = 0; i < 5; i++) {
    const s = sprite('#8b6bff', 4, 0.25);
    s.position.set(-8 + i * 4, 0.3, 2.9);
    g.add(s);
  }
  for (let i = 0; i < 170; i++) {
    const op = 0.4 + r() * 0.6;
    const s = sprite('#ffffff', 0.05 + r() * 0.1, op);
    s.position.set(-17 + r() * 34, 0.5 + r() * 14, -14 + r() * 5);
    g.add(s);
    tw.push({ s, base: op, phase: r() * 6, speed: 0.6 + r() * 2 });
  }
  const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 2), std('#3d4fb5', { emissive: new THREE.Color('#1a2260'), emissiveIntensity: 0.6 }));
  planet.position.set(-5.2, 4.4, -11);
  g.add(planet);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.07, 4, 56), basic('#9aa8ff'));
  ring.position.copy(planet.position);
  ring.rotation.set(1.25, 0.2, 0.3);
  g.add(ring);

  const panelDefs: [string, string, [number, number, number], number][] = [
    ['AGENT-01 · RESEARCH', '#58e1ff', [-4.6, 3.3, -6], 0.35],
    ['AGENT-02 · CODER', '#9d8bff', [-0.6, 5.0, -8], 0.1],
    ['AGENT-03 · TESTER', '#58ffc0', [3.6, 3.7, -6.5], -0.3],
    ['AGENT-04 · REVIEWER', '#ff9cd8', [6.2, 2.4, -5.5], -0.45],
    ['QUEUE', '#ffd16b', [0.9, 2.3, -9.5], 0],
  ];
  const panels: { m: THREE.Mesh; y: number; ph: number }[] = [];
  panelDefs.forEach(([title, accent, pos, yaw], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ map: panelTexture(title, accent, i + 3), transparent: true, opacity: 0.9, fog: false }));
    m.position.set(...pos);
    m.rotation.y = yaw;
    g.add(m);
    panels.push({ m, y: pos[1], ph: i * 1.3 });
  });
  for (const [x, z, s] of [[4.8, -0.8, 1], [-5.4, -1.2, 0.7], [5.8, 0.6, 0.55]] as const) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.55 * s, 0), std('#8c7bff', { emissive: new THREE.Color('#5a3cff'), emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }));
    c.position.set(x, 0.55 * s, z);
    c.scale.y = 1.6;
    g.add(c);
  }
  return finish(
    g,
    {
      background: gradientTexture([[0, '#04020c'], [0.6, '#150b34'], [1, '#2c1760']]),
      lights: {
        ambient: ['#4a3a9a', 1.1],
        hemi: ['#8a6cff', '#0a0618', 0.5],
        key: { color: '#c9a8ff', intensity: 2.6, pos: [3, 5, 6] },
        rim: { color: '#4fd1ff', intensity: 3.0, pos: [-4, 3, -4] },
      },
      update(t) {
        twinkle(tw, t);
        panels.forEach((p) => (p.m.position.y = p.y + Math.sin(t * 0.6 + p.ph) * 0.12));
        planet.rotation.y = t * 0.05;
      },
    },
    makeLaptop(),
    [0, 0, 2.0],
  );
}

// ------------------------------------------------------------------------------------------------
function cozyRoom(): SetBuild {
  const g = new THREE.Group();
  const r = rng(37);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 10), std('#7b4e5a', { flatShading: false }));
  wall.position.set(0, 5, -5);
  g.add(wall);
  const base = box(26, 0.4, 0.2, std('#4a2f3b'));
  base.position.set(0, 0.2, -4.9);
  g.add(base);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), std('#6a4630', { flatShading: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 12);
  g.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), std('#b4533f', { flatShading: false }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, 0.4);
  g.add(rug);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshBasicMaterial({ map: nightWindowTexture() }));
  win.position.set(4.2, 3.6, -4.88);
  g.add(win);
  const fm = std('#3a2432');
  for (const [w, h, x, y] of [[3.3, 0.16, 4.2, 4.98], [3.3, 0.16, 4.2, 2.22], [0.16, 2.9, 2.6, 3.6], [0.16, 2.9, 5.8, 3.6], [0.1, 2.6, 4.2, 3.6], [3, 0.1, 4.2, 3.6]] as const) {
    const b = box(w, h, 0.16, fm);
    b.position.set(x, y, -4.8);
    g.add(b);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3, 6), std('#2a1a22'));
  pole.position.set(-4.4, 1.5, -3.6);
  g.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 0.75, 8, 1, true), basic('#ffd9a0', { side: THREE.DoubleSide }));
  shade.position.set(-4.4, 3.2, -3.6);
  g.add(shade);
  const lampGlow = sprite('#ffbf70', 5.5, 0.6);
  lampGlow.position.set(-4.4, 3.1, -3.4);
  g.add(lampGlow);
  const shelf = box(2.6, 0.1, 0.5, std('#4a3226'));
  shelf.position.set(-1.4, 3.7, -4.65);
  g.add(shelf);
  const colors = ['#d96a5a', '#e0b04a', '#4f86c6', '#6fae7a', '#a06ad0'];
  for (let i = 0; i < 7; i++) {
    const h = 0.45 + r() * 0.3;
    const b = box(0.2, h, 0.36, std(colors[i % colors.length]));
    b.position.set(-2.4 + i * 0.27, 3.75 + h / 2, -4.65);
    g.add(b);
  }
  for (const [x, y, c] of [[0.8, 4.7, '#e8c26a'], [1.5, 4.4, '#7aa6d8']] as const) {
    const f = box(0.7, 0.9, 0.06, std(c));
    f.position.set(x, y, -4.88);
    g.add(f);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.5, 7), std('#b4684a'));
  pot.position.set(-3.2, 0.25, -3.0);
  g.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), std('#4f9a5a'));
    leaf.position.set(-3.2 + (r() - 0.5) * 0.5, 0.8 + r() * 0.5, -3.0 + (r() - 0.5) * 0.4);
    leaf.scale.set(1, 1.4, 0.7);
    g.add(leaf);
  }
  const table = box(2.0, 0.5, 1.2, std('#5a3d2c'));
  table.position.set(0, -0.25, 0);
  const laptop = makeLaptop();
  laptop.group.add(table);
  return finish(
    g,
    {
      background: gradientTexture([[0, '#1c1226'], [1, '#3b2535']]),
      lights: {
        ambient: ['#7a5a6a', 1.3],
        hemi: ['#ffcfa0', '#3a2030', 0.5],
        key: { color: '#ffbf80', intensity: 2.8, pos: [2.5, 4, 5] },
        rim: { color: '#8a9cff', intensity: 1.4, pos: [-4, 3, -3] },
      },
      update(t) {
        (lampGlow.material as THREE.SpriteMaterial).opacity = 0.55 + Math.sin(t * 1.1) * 0.04;
      },
    },
    laptop,
    [0, 0.5, 1.9],
  );
}

// ------------------------------------------------------------------------------------------------
function officeDay(): SetBuild {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(28, 10), std('#ece7de', { flatShading: false }));
  wall.position.set(0, 5, -5);
  g.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 50), std('#8d97a3', { flatShading: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 12);
  g.add(floor);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.8), new THREE.MeshBasicMaterial({ map: gradientTexture([[0, '#5fa8e6'], [1, '#b9dcf7']]) }));
  sky.position.set(-3.2, 3.7, -4.9);
  g.add(sky);
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 3; i++) {
    const c = sprite('#ffffff', 1.5, 0.7);
    c.material.blending = THREE.NormalBlending;
    c.position.set(-5 + i * 1.8, 3.4 + (i % 2) * 0.5, -4.85);
    g.add(c);
    clouds.push(c);
  }
  const fm = std('#d2cdc3');
  for (const [w, h, x, y] of [[6.5, 0.18, -3.2, 5.65], [6.5, 0.18, -3.2, 1.8], [0.18, 4, -6.4, 3.7], [0.18, 4, -0.0, 3.7], [0.12, 3.8, -3.2, 3.7]] as const) {
    const b = box(w, h, 0.16, fm);
    b.position.set(x, y, -4.8);
    g.add(b);
  }
  const desk = box(5, 0.12, 1.6, std('#b98d62'));
  desk.position.set(4, 1.45, -3.2);
  g.add(desk);
  for (const x of [1.7, 6.3]) {
    const leg = box(0.12, 1.45, 1.4, std('#8f6c4a'));
    leg.position.set(x, 0.72, -3.2);
    g.add(leg);
  }
  for (const x of [3.3, 5.2]) {
    const mon = box(1.4, 0.9, 0.06, std('#20232e'));
    mon.position.set(x, 2.3, -3.6);
    g.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.78), basic('#27386b', { toneMapped: false }));
    scr.position.set(x, 2.3, -3.565);
    g.add(scr);
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 7), std('#c9714f'));
  pot.position.set(6.1, 1.66, -3.2);
  g.add(pot);
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), std('#4f9a5a'));
    leaf.position.set(6.1 + (i - 1.5) * 0.08, 1.95 + (i % 2) * 0.15, -3.2);
    leaf.scale.set(1, 1.5, 0.8);
    g.add(leaf);
  }
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), basic('#ffffff'));
  clock.position.set(4.6, 4.8, -4.88);
  g.add(clock);
  const hand = box(0.04, 0.4, 0.02, basic('#222222'));
  hand.geometry.translate(0, 0.2, 0);
  hand.position.set(4.6, 4.8, -4.86);
  g.add(hand);
  for (const [x, c] of [[-7.4, '#e0644f'], [-8.6, '#4f86c6'], [-9.8, '#e8c26a']] as const) {
    const p = box(0.9, 1.2, 0.05, std(c));
    p.position.set(x, 3.6, -4.9);
    g.add(p);
  }
  const laptop = makeLaptop();
  laptop.group.scale.setScalar(0.7);
  return finish(
    g,
    {
      background: gradientTexture([[0, '#bfdcff'], [1, '#e6f0ff']]),
      lights: {
        ambient: ['#e8efff', 1.7],
        hemi: ['#ffffff', '#9aa0b0', 0.6],
        key: { color: '#fff1dc', intensity: 2.8, pos: [3, 6, 5] },
        rim: { color: '#a8c8ff', intensity: 1.2, pos: [-4, 3, -3] },
      },
      update(t) {
        hand.rotation.z = -t * 0.3;
        clouds.forEach((c, i) => (c.position.x = -5.4 + ((i * 1.8 + t * 0.12) % 5.2)));
      },
    },
    laptop,
    [2.6, 1.51, -2.9],
    false,
  );
}

// ------------------------------------------------------------------------------------------------
function sunnyPark(): SetBuild {
  const g = new THREE.Group();
  const r = rng(51);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), std('#69b563', { flatShading: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  g.add(ground);
  for (const [x, s, c] of [[-10, 5, '#5aa655'], [4, 7, '#6cbc65'], [14, 5, '#58a052']] as const) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 2), std(c));
    hill.scale.set(2.4, 0.4, 1);
    hill.position.set(x, -0.8, -18);
    g.add(hill);
  }
  for (let i = 0; i < 11; i++) {
    let x = -13 + r() * 26;
    if (Math.abs(x) < 2.6) x += x < 0 ? -3 : 3;
    const z = -4 - r() * 8;
    const s = 0.8 + r() * 0.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.22 * s, 1.5 * s, 6), std('#7a5230'));
    trunk.position.set(x, 0.75 * s, z);
    g.add(trunk);
    const top1 = new THREE.Mesh(new THREE.ConeGeometry(1.05 * s, 2.1 * s, 6), std('#3f9a52'));
    top1.position.set(x, 2.0 * s, z);
    g.add(top1);
    const top2 = new THREE.Mesh(new THREE.ConeGeometry(0.8 * s, 1.7 * s, 6), std('#4fb35f'));
    top2.position.set(x, 3.0 * s, z);
    g.add(top2);
  }
  const clouds: { grp: THREE.Group; x: number; sp: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const grp = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + r() * 0.4, 1), std('#ffffff', { emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.55 }));
      b.position.set(k * 0.9 - 0.9, r() * 0.25, 0);
      b.scale.y = 0.65;
      grp.add(b);
    }
    const x = -18 + r() * 36;
    grp.position.set(x, 5.5 + r() * 3.5, -15 - r() * 4);
    g.add(grp);
    clouds.push({ grp, x, sp: 0.15 + r() * 0.2 });
  }
  const sun = sprite('#fff0b0', 8, 0.45);
  sun.position.set(6, 7.5, -14);
  g.add(sun);
  const bench = new THREE.Group();
  const part = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
    const m = box(w, h, d, std(color));
    m.position.set(x, y, z);
    bench.add(m);
  };
  part(1.8, 0.1, 0.5, 0, 0.5, 0, '#8a6240');
  part(1.8, 0.5, 0.08, 0, 0.85, -0.22, '#8a6240');
  for (const x of [-0.8, 0.8]) part(0.1, 0.5, 0.45, x, 0.25, 0, '#3a3a44');
  bench.position.set(4.8, 0, -2.4);
  bench.rotation.y = -0.4;
  g.add(bench);
  for (let i = 0; i < 24; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), std(['#ff7aa8', '#ffd24a', '#ffffff', '#b58cff'][i % 4]));
    f.position.set(-7 + r() * 14, 0.08, -1.5 - r() * 5);
    g.add(f);
  }
  const crate = box(1.7, 0.5, 1.1, std('#a8773f'));
  crate.position.set(0, -0.25, 0);
  const parkLaptop = makeLaptop();
  parkLaptop.group.add(crate);
  return finish(
    g,
    {
      background: gradientTexture([[0, '#5fb8ff'], [0.6, '#a9dcff'], [1, '#e2f5ff']]),
      fog: ['#cfe9ff', 34, 95],
      lights: {
        ambient: ['#cfe6ff', 1.7],
        hemi: ['#bfe3ff', '#5a8a50', 0.7],
        key: { color: '#fff1c2', intensity: 3.0, pos: [4, 6, 4] },
        rim: { color: '#9fd4ff', intensity: 1.0, pos: [-4, 3, -3] },
      },
      update(t) {
        for (const c of clouds) c.grp.position.x = ((c.x + t * c.sp + 20) % 40) - 20;
      },
    },
    parkLaptop,
    [0, 0.5, 1.9],
  );
}

// ------------------------------------------------------------------------------------------------
function studio(): SetBuild {
  const g = new THREE.Group();
  const r = rng(77);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), std('#232842', { roughness: 0.4, flatShading: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 8);
  g.add(floor);
  const palette = ['#ff8fa3', '#7fa0ff', '#ffd27a', '#8fe3c0', '#c08bff'];
  const shapes: { m: THREE.Mesh; sp: number; y0: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const geo = [new THREE.OctahedronGeometry(0.6, 0), new THREE.IcosahedronGeometry(0.55, 0), new THREE.BoxGeometry(0.8, 0.8, 0.8)][i % 3];
    const c = palette[i % palette.length];
    const m = new THREE.Mesh(geo, std(c, { emissive: new THREE.Color(c), emissiveIntensity: 0.25, transparent: true, opacity: 0.8 }));
    m.position.set(-7 + r() * 14, 0.5 + r() * 6, -5 - r() * 5);
    m.scale.setScalar(0.6 + r() * 1.1);
    g.add(m);
    shapes.push({ m, sp: 0.1 + r() * 0.3, y0: m.position.y });
  }
  for (const [x, y, c] of [[-4, 3, '#ff5fa8'], [4.5, 4.5, '#4fb0ff'], [0, 6, '#9d7bff']] as const) {
    const s = sprite(c, 9, 0.2);
    s.position.set(x, y, -9);
    g.add(s);
  }
  const ped = box(1.9, 0.5, 1.2, std('#2f3556'));
  ped.position.set(0, -0.25, 0);
  const studioLaptop = makeLaptop();
  studioLaptop.group.add(ped);
  return finish(
    g,
    {
      background: gradientTexture([[0, '#14172a'], [1, '#2d3358']]),
      lights: {
        ambient: ['#8a94d6', 1.2],
        hemi: ['#a6b4ff', '#1a1d33', 0.5],
        key: { color: '#ffe3c6', intensity: 2.6, pos: [3, 5, 5] },
        rim: { color: '#7aa6ff', intensity: 2.2, pos: [-4, 3, -3] },
      },
      update(t) {
        shapes.forEach((s, i) => {
          s.m.rotation.x = t * s.sp;
          s.m.rotation.y = t * s.sp * 1.3;
          s.m.position.y = s.y0 + Math.sin(t * 0.5 + i) * 0.25;
        });
      },
    },
    studioLaptop,
    [0, 0.5, 1.9],
  );
}

export function buildSet(name: SetName): SetBuild {
  switch (name) {
    case 'skyline-night':
      return skylineNight();
    case 'space-stage':
      return spaceStage();
    case 'cozy-room':
      return cozyRoom();
    case 'office-day':
      return officeDay();
    case 'sunny-park':
      return sunnyPark();
    case 'studio':
      return studio();
  }
}
