import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Vertical gradient, top -> bottom. Used for sky / backdrops (scene.background). */
export function gradientTexture(stops: [number, string][]): THREE.CanvasTexture {
  const [c, g] = canvas(4, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  for (const [p, col] of stops) grad.addColorStop(p, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  return tex(c);
}

let glow: THREE.CanvasTexture | undefined;
/** Soft round light, white centre fading to transparent. Tinted per sprite. */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow;
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return (glow = tex(c));
}

let bokeh: THREE.CanvasTexture | undefined;
/** Hard-edged disc with a bright rim, like an out-of-focus lamp. */
export function bokehTexture(): THREE.CanvasTexture {
  if (bokeh) return bokeh;
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.32)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.93, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return (bokeh = tex(c));
}

let shadow: THREE.CanvasTexture | undefined;
export function shadowTexture(): THREE.CanvasTexture {
  if (shadow) return shadow;
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return (shadow = tex(c));
}

/** A floating UI panel with a title bar and faint text rows (space-stage backdrop). */
export function panelTexture(title: string, accent: string, seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(512, 320);
  g.fillStyle = 'rgba(10,14,40,0.82)';
  g.fillRect(0, 0, 512, 320);
  g.strokeStyle = accent;
  g.lineWidth = 4;
  g.strokeRect(2, 2, 508, 316);
  g.fillStyle = accent;
  g.globalAlpha = 0.9;
  g.font = 'bold 22px Consolas, monospace';
  g.fillText(title, 20, 38);
  g.globalAlpha = 0.35;
  for (let i = 0; i < 7; i++) {
    const w = 120 + ((seed * 53 + i * 97) % 280);
    g.fillRect(20, 70 + i * 34, w, 10);
  }
  g.globalAlpha = 1;
  return tex(c);
}

/** Laptop screen: dark terminal-ish background with the story's lines in a monospace font. */
export function screenTexture(lines: string[]): THREE.CanvasTexture {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#0d1226';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#1c2450';
  g.fillRect(0, 0, 512, 34);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = ['#ff6b6b', '#ffd166', '#6bd47a'][i];
    g.beginPath();
    g.arc(22 + i * 22, 17, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.font = '24px Consolas, monospace';
  lines.slice(0, 8).forEach((line, i) => {
    g.fillStyle = line.startsWith('>') ? '#8fe3ff' : line.startsWith('!') ? '#ff9c8a' : '#c9d3ff';
    g.fillText(line.replace(/^!/, ''), 22, 76 + i * 32, 470);
  });
  return tex(c);
}

/** Night window: dark sky, a moon and a few stars. */
export function nightWindowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0b1240');
  grad.addColorStop(1, '#2b2a6a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff6d8';
  g.beginPath();
  g.arc(190, 64, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 24; i++) g.fillRect((i * 97) % 250, (i * 53) % 200, 2, 2);
  return tex(c);
}
