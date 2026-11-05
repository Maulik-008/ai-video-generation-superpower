// Inside Out engine: the COMPONENT ZOO. Every reusable thing on screen lives here.
// All functions draw immediately with the shared ctx, in 1080x1920 canvas pixels unless a scale is given.
import { ctx, C, W, H, TAU, lerp, clamp, seg, eob, rnd, rr, circle, ell, line, fillAll, fontFor, hasDeva } from './lib.js';
import { T } from './timing.js';

// ═════════════════════════ PROPS ═════════════════════════
/** a piece of gum (pill shape). s = scale (1 = 80x52 px) */
export function gum(x, y, s, rot = 0, sx = 1, sy = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * sx, s * sy);
  rr(-40, -26, 80, 52, 24); ctx.fillStyle = C.gum; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.gumEdge; ctx.stroke();
  ell(-14, -11, 14, 6, C.white, -0.3);
  circle(14, 8, 4, '#E2DCD0'); circle(24, -4, 3, '#E2DCD0'); circle(-4, 10, 3, '#E2DCD0');
  ctx.restore();
}

/** the J-shaped stomach (flat, pink, highlight). s = scale; pulse 0..1 swells it */
function stomachPath() {
  ctx.beginPath(); ctx.moveTo(-30, -110);
  ctx.bezierCurveTo(-30, -40, -120, -20, -100, 50);
  ctx.bezierCurveTo(-80, 120, 40, 120, 90, 60);
  ctx.bezierCurveTo(120, 25, 110, -10, 95, -20);
}
export function stomach(x, y, s, pulse = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  stomachPath(); ctx.strokeStyle = C.pinkDark; ctx.lineWidth = 92 + pulse * 14; ctx.stroke();
  stomachPath(); ctx.strokeStyle = C.pink; ctx.lineWidth = 80 + pulse * 14; ctx.stroke();
  ctx.save(); ctx.translate(-8, -8); stomachPath(); ctx.strokeStyle = C.pinkLight; ctx.globalAlpha = 0.7; ctx.lineWidth = 22; ctx.stroke(); ctx.restore();
  ctx.restore();
}
/** the stomach's top opening in local units (where the esophagus joins), for a stomach drawn at (x, y, s) */
export const stomachTop = (x, y, s) => [x - 30 * s, y - 110 * s];

/** flat heart icon. beat 0..1 scales it up */
export function heart(x, y, s, beat = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + beat * 0.12), s * (1 + beat * 0.12));
  const p = () => { ctx.beginPath(); ctx.moveTo(0, 70); ctx.bezierCurveTo(-150, -20, -90, -130, 0, -60); ctx.bezierCurveTo(90, -130, 150, -20, 0, 70); };
  p(); ctx.fillStyle = C.pinkDark; ctx.fill(); ctx.save(); ctx.translate(-6, -6); ctx.scale(0.92, 0.92); p(); ctx.fillStyle = C.red; ctx.fill(); ctx.restore();
  ell(-48, -52, 22, 12, C.pinkLight, -0.6);
  ctx.restore();
}

/** stopwatch. ang = hand angle in radians */
export function stopwatch(x, y, s, ang) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(-40, -330, 80, 60, 14); ctx.fillStyle = C.watch; ctx.fill();
  ctx.save(); ctx.rotate(0.75); rr(-22, -300, 44, 46, 10); ctx.fill(); ctx.restore();
  circle(0, 0, 280, C.watch); circle(0, 0, 240, C.white);
  for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * Math.PI / 6); rr(-6, -226, 12, i % 3 === 0 ? 44 : 26, 6); ctx.fillStyle = C.watch; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.rotate(ang); rr(-9, -200, 18, 220, 9); ctx.fillStyle = C.red; ctx.fill(); ctx.restore();
  circle(0, 0, 24, C.watch);
  ctx.restore();
}

/** tear-off calendar card: big number + word under it. Card is 600x680 at s = 1 */
export function calendar(x, y, s, big, small, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  rr(-300, -340, 600, 680, 46); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke();
  rr(-300, -340, 600, 170, [46, 46, 0, 0]); ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 10; ctx.stroke();
  for (const bx of [-150, 150]) { rr(bx - 18, -390, 36, 100, 18); ctx.fillStyle = C.ink; ctx.fill(); }
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '900 330px Inter'; ctx.fillText(big, 0, 170);
  ctx.font = '900 92px Inter'; ctx.letterSpacing = '4px'; ctx.fillText(small, 0, 285); ctx.letterSpacing = '0px';
  ctx.restore();
}

// ═════════════════════════ GRAPHICS ═════════════════════════
/** dark rounded label ("GUM BASE"). sc animates the pop */
export function pill(text, x, y, size, bg = C.ink, fg = C.white, sc = 1) {
  if (sc <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  ctx.font = fontFor(text, size); ctx.letterSpacing = hasDeva(text) ? '0px' : '2px';
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.6;
  rr(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, size * 0.05);
  ctx.letterSpacing = '0px'; ctx.restore();
}
/** label with a pointer line down to a target point */
export function tag(text, x, y, tx, ty, size = 60, sc = 1) {
  if (sc <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(sc); line([[x, y], [tx, ty]], C.ink, 8); ctx.restore();
  pill(text, x, y, size, C.ink, C.white, sc);
}
/** the danger X (red, ink outline). a = alpha */
export function redX(x, y, s, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.lineCap = 'round';
  for (const [w, c] of [[96, C.ink], [72, C.red]]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-230, -230); ctx.lineTo(230, 230); ctx.moveTo(230, -230); ctx.lineTo(-230, 230); ctx.stroke(); }
  ctx.restore();
}
/** flat red arrow pointing along ang (radians). len in px */
export function arrow(x, y, len, ang = 0, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-len / 2, -28); ctx.lineTo(len / 2 - 110, -28); ctx.lineTo(len / 2 - 110, -80); ctx.lineTo(len / 2, 0);
  ctx.lineTo(len / 2 - 110, 80); ctx.lineTo(len / 2 - 110, 28); ctx.lineTo(-len / 2, 28); ctx.closePath(); ctx.fillStyle = C.red; ctx.fill();
  ctx.restore();
}
/** red warning triangle with "!" */
export function warning(x, y, s) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(140, 110); ctx.lineTo(-140, 110); ctx.closePath();
  ctx.lineJoin = 'round'; ctx.lineWidth = 40; ctx.strokeStyle = C.red; ctx.stroke(); ctx.fillStyle = C.red; ctx.fill();
  rr(-14, -60, 28, 110, 14); ctx.fillStyle = C.white; ctx.fill(); circle(0, 82, 17, C.white);
  ctx.restore();
}
/** "enzyme" chomper: pink pac-man. open = mouth angle (rad), flip = face left */
export function chomper(x, y, r, open, flip) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, open, TAU - open); ctx.closePath(); ctx.fillStyle = C.pink; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = C.pinkDark; ctx.stroke(); circle(r * 0.15, -r * 0.5, r * 0.13, C.ink);
  ctx.restore();
}
/** impact burst (yellow rays) */
export function burst(x, y, s, a) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.strokeStyle = C.yellow; ctx.lineCap = 'round'; ctx.lineWidth = 12;
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * 30 * s, Math.sin(an) * 30 * s); ctx.lineTo(Math.cos(an) * 80 * s, Math.sin(an) * 80 * s); ctx.stroke(); }
  ctx.restore();
}
/** horizontal speed lines trailing left of (x, y) */
export function speedLines(x, y, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; for (let i = 0; i < 5; i++) line([[x - 80 - i * 20, y - 60 + i * 30], [x - 260 - i * 40, y - 60 + i * 30]], C.ink, 10); ctx.restore();
}
/** three "shock" strokes around a point (head reaction) */
export function shockLines(x, y, r, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  for (const an of [-2.4, -Math.PI / 2, -0.75]) line([[x + Math.cos(an) * r, y + Math.sin(an) * r], [x + Math.cos(an) * (r + 70), y + Math.sin(an) * (r + 70)]], C.ink, 14);
  ctx.restore();
}

// ═════════════════════════ BACKGROUNDS ═════════════════════════
/** (A) real world: a simple room with a window, framed picture, plant and floor */
export function room() {
  fillAll(C.bg);
  ctx.fillStyle = C.floor; ctx.fillRect(-300, 1560, W + 600, 700);
  rr(600, 230, 360, 440, 22); ctx.fillStyle = C.white; ctx.fill();
  rr(622, 252, 316, 396, 12); ctx.fillStyle = C.sky; ctx.fill();
  ell(720, 360, 70, 30, C.white); ell(770, 345, 50, 34, C.white);
  ctx.fillStyle = C.white; ctx.fillRect(772, 252, 14, 396); ctx.fillRect(622, 442, 316, 14);
  rr(110, 330, 200, 150, 10); ctx.fillStyle = C.ink; ctx.fill(); rr(124, 344, 172, 122, 4); ctx.fillStyle = '#F7D88A'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(124, 466); ctx.lineTo(190, 390); ctx.lineTo(240, 440); ctx.lineTo(270, 410); ctx.lineTo(296, 466); ctx.fillStyle = '#E0956B'; ctx.fill();
  for (const [x, y, r] of [[130, 1170, -0.5], [170, 1140, 0], [210, 1170, 0.5], [150, 1110, -0.2], [195, 1105, 0.25]]) ell(x, y, 26, 62, C.leaf, r);
  rr(110, 1200, 120, 130, 14); ctx.fillStyle = C.pot; ctx.fill();
}
/** (B) x-ray: navy film with a cyan grid and a sweeping scan line */
export function xray(t) {
  fillAll(C.navy);
  ctx.strokeStyle = C.cyan; ctx.globalAlpha = 0.07; ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, -300); ctx.lineTo(x, H + 300); ctx.stroke(); }
  for (let y = 0; y <= H; y += 90) { ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(W + 300, y); ctx.stroke(); }
  const sy = ((t * 700) % (H + 400)) - 200;
  ctx.globalAlpha = 0.1; ctx.fillStyle = C.cyan; ctx.fillRect(-300, sy, W + 600, 70);
  ctx.globalAlpha = 0.25; ctx.fillRect(-300, sy + 66, W + 600, 6); ctx.globalAlpha = 1;
}
/** (C) inside the stomach: wobbling pink wall, folds, acid pool (acid = 0..1 strength), rising bubbles */
export function insideStomach(t, acid = 1) {
  fillAll(C.stomachBg);
  for (let i = 0; i < 7; i++) circle(rnd(i) * W + Math.sin(t + i) * 20, rnd(i + 9) * H + Math.cos(t * 0.8 + i) * 20, 120 + rnd(i + 3) * 140, C.stomachBgDark);
  ctx.beginPath();
  for (let a = 0; a <= TAU + 0.01; a += 0.05) {
    const r = 1 + 0.035 * Math.sin(3 * a + t * 2) + 0.02 * Math.sin(5 * a - t * 3);
    const x = 540 + 480 * r * Math.cos(a), y = 880 + 660 * r * Math.sin(a); a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = C.pink; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = C.stomachFold; ctx.lineWidth = 20; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const y0 = 360 + i * 120; ctx.beginPath(); for (let x = 80; x <= 1000; x += 20) { const y = y0 + Math.sin(x * 0.012 + t * 1.5 + i) * 26; x === 80 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  if (acid > 0) {
    ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 1180 + Math.sin(x * 0.015 + t * 3) * 18); ctx.lineTo(W, H); ctx.closePath();
    ctx.fillStyle = C.yellow; ctx.globalAlpha = 0.55 * acid; ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const ph = (t * 0.6 + rnd(i)) % 1; ctx.globalAlpha = 0.85 * (1 - ph) * acid;
      ctx.beginPath(); ctx.arc(120 + rnd(i + 20) * 840 + Math.sin(t * 3 + i) * 12, 1400 - ph * 700, 10 + rnd(i + 5) * 18, 0, TAU);
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 6; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ═════════════════════════ INTESTINE ═════════════════════════
/** serpentine gut path (5 rows) filling the upper screen; returns { pts, at(u) -> [x, y, angle], draw() } */
export function makeGut({ L = 210, R = 870, r = 100, y0 = 320, rows = 5 } = {}) {
  const pts = [];
  for (let y = y0 - 260; y < y0; y += 8) pts.push([L, y]);
  for (let row = 0; row < rows; row++) {
    const y = y0 + row * 2 * r, ltr = row % 2 === 0;
    for (let i = 0; i <= 60; i++) pts.push([ltr ? lerp(L, R, i / 60) : lerp(R, L, i / 60), y]);
    if (row < rows - 1) { const cy = y + r; for (let i = 1; i <= 24; i++) { const k = i / 24, a = ltr ? -Math.PI / 2 + k * Math.PI : -Math.PI / 2 - k * Math.PI; pts.push([(ltr ? R : L) + r * Math.cos(a), cy + r * Math.sin(a)]); } }
  }
  const last = pts[pts.length - 1]; for (let x = last[0]; x < 1250; x += 10) pts.push([x, last[1]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  const at = (u) => { const d = clamp(u) * len; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++; const a = pts[i - 1], b = pts[i], k = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])]; };
  const draw = () => {
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(); ctx.strokeStyle = C.cyan; ctx.globalAlpha = 0.25; ctx.lineWidth = 112; ctx.stroke(); ctx.globalAlpha = 1;
    path(); ctx.strokeStyle = C.pinkDark; ctx.lineWidth = 92; ctx.stroke();
    path(); ctx.strokeStyle = C.pink; ctx.lineWidth = 76; ctx.stroke();
    path(); ctx.strokeStyle = C.pinkLight; ctx.globalAlpha = 0.6; ctx.lineWidth = 22; ctx.stroke(); ctx.globalAlpha = 1;
  };
  return { pts, at, draw };
}
/** a straight gut segment across the screen at y (close-up). Returns nothing; draw blockages on top */
export function gutTube(y, t = 0, width = 300) {
  const tube = () => { ctx.beginPath(); for (let x = -150; x <= 1230; x += 20) { const yy = y + Math.sin(x * 0.006 + t * 0.5) * 20; x === -150 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } };
  ctx.lineCap = 'round';
  tube(); ctx.strokeStyle = C.pinkDark; ctx.lineWidth = width + 30; ctx.stroke();
  tube(); ctx.strokeStyle = C.pink; ctx.lineWidth = width; ctx.stroke();
  tube(); ctx.strokeStyle = C.pinkLight; ctx.globalAlpha = 0.5; ctx.lineWidth = width * 0.2; ctx.stroke(); ctx.globalAlpha = 1;
}

// ═════════════════════════ CHARACTER ═════════════════════════
// One hero: flat man, blue tee, navy pants. Origin = chest centre; at s = 1 he is ~950 px tall (head top -480, feet +620).
// Arm poses are elbow/hand points for the RIGHT arm (the left mirrors). Blend them with armPose(a, b, t).
export const ARM = {
  down: { e: [172, 0], h: [176, 138] },
  mouth: { e: [220, -50], h: [58, -262] },     // hand at the mouth (eating, gasp)
  point: { e: [240, -90], h: [205, -300] },    // index finger up (pass finger: angle)
  wave: { e: [250, -120], h: [300, -330] },
  hip: { e: [250, 20], h: [150, 110] },
};
export const armPose = (a, b, t) => ({ e: [lerp(a.e[0], b.e[0], t), lerp(a.e[1], b.e[1], t)], h: [lerp(a.h[0], b.h[0], t), lerp(a.h[1], b.h[1], t)] });
/** mouth position in the man's local coords (for things going in / out of the mouth) */
export const MOUTH = [0, -272];
/** points along the food path in local coords: mouth -> throat -> stomach top -> inside stomach */
export const FOOD_PATH = [[0, -262], [0, -200], [-4, -80], [-12, 58]];

function arm(side, pose, finger, xr) {
  const sx = side, sh = [140 * sx, -170], e = [pose.e[0] * sx, pose.e[1]], h = [pose.h[0] * sx, pose.h[1]];
  const ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
  if (xr) {
    line([sh, e], C.cyan, 58); line([e, h], C.cyan, 52);
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang); ell(6, 0, 38, 32, C.cyan); ctx.restore();
    if (finger != null) { ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(finger); rr(-15, -90, 30, 88, 15); ctx.fillStyle = C.cyan; ctx.fill(); rr(-10, -85, 20, 78, 10); ctx.fillStyle = C.xnavy; ctx.fill(); line([[0, -76], [0, -10]], C.cyan, 6); ctx.restore(); }
    line([sh, e], C.xnavy, 48); line([e, h], C.xnavy, 42);
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang); ell(6, 0, 33, 27, C.xnavy); for (const k of [-12, 0, 12]) line([[-10, k * 0.8], [28, k]], C.cyan, 6); ctx.restore();
    line([sh, e], C.cyan, 13); circle(e[0], e[1], 11, C.cyan);
    const nx = -(h[1] - e[1]), ny = h[0] - e[0], nl = Math.hypot(nx, ny) || 1, ox = nx / nl * 7, oy = ny / nl * 7;
    line([[e[0] + ox, e[1] + oy], [h[0] + ox, h[1] + oy]], C.cyan, 7); line([[e[0] - ox, e[1] - oy], [h[0] - ox, h[1] - oy]], C.cyan, 7);
    return;
  }
  line([sh, e], C.skin, 50); line([e, h], C.skin, 44);
  line([sh, [lerp(sh[0], e[0], 0.55), lerp(sh[1], e[1], 0.55)]], C.shirt, 72);       // short sleeve
  if (finger != null) { ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(finger); rr(-11, -86, 22, 80, 11); ctx.fillStyle = C.skin; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang); ell(6, 0, 34, 28, C.skin); ell(-2, -sx * 22, 15, 10, C.skin, -0.5 * sx); ctx.restore();
}
function torsoPath() {
  ctx.beginPath(); ctx.moveTo(-50, -214);
  ctx.bezierCurveTo(-130, -214, -162, -196, -164, -120); ctx.lineTo(-140, 192); ctx.quadraticCurveTo(-138, 210, -120, 210);
  ctx.lineTo(120, 210); ctx.quadraticCurveTo(138, 210, 140, 192); ctx.lineTo(164, -120); ctx.bezierCurveTo(162, -196, 130, -214, 50, -214); ctx.closePath();
}
function skeletonTorso(pulse, o = {}) {
  ctx.save(); torsoPath(); ctx.clip();
  ctx.fillStyle = C.xnavy; ctx.fillRect(-170, -220, 340, 440);
  for (let y = -192; y < 200; y += 32) { rr(-14, y, 28, 24, 7); ctx.fillStyle = C.cyan; ctx.globalAlpha = 0.9; ctx.fill(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = C.cyan; ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(sd * 22, -186); ctx.quadraticCurveTo(sd * 80, -202, sd * 146, -180); ctx.stroke();
    for (let i = 0; i < 6; i++) { const y = -150 + i * 37; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sd * 18, y); ctx.quadraticCurveTo(sd * 152, y - 26, sd * 116, y + 56); ctx.stroke(); }
    ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(sd * 72, 232, 74, 46, 0, Math.PI, TAU); ctx.stroke();
  }
  if (o.torsoOrgans) o.torsoOrgans();            // talking organ characters (xrayBody) replace the plain stomach
  else { line([[0, -205], [-4, -80]], C.pink, 22); stomach(20, 10, 0.8, pulse); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.8; torsoPath(); ctx.strokeStyle = C.cyan; ctx.lineWidth = 7; ctx.stroke(); ctx.restore();
}
function head(o) {
  ctx.save(); ctx.translate(0, -350);
  ell(0, -34, 116, 94, C.hair);
  for (const sd of [-1, 1]) { ell(sd * 104, 14, 22, 28, C.skin); ell(sd * 106, 14, 10, 15, C.skinShade); }
  ell(0, 12, 102, 112, C.skin);
  // fringe with side part
  ctx.beginPath(); ctx.moveTo(-104, -6); ctx.quadraticCurveTo(-118, -112, -14, -124); ctx.quadraticCurveTo(96, -132, 112, -26);
  ctx.quadraticCurveTo(92, -70, 40, -74); ctx.quadraticCurveTo(-20, -76, -58, -50); ctx.quadraticCurveTo(-86, -34, -104, -6); ctx.closePath();
  ctx.fillStyle = C.hair; ctx.fill(); rr(-106, -40, 18, 46, 8); ctx.fill(); rr(88, -40, 18, 46, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-60, -98); ctx.quadraticCurveTo(0, -118, 62, -96); ctx.strokeStyle = C.hairHi; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
  // brows: brow 0..1 raises them; smirk tilts
  const br = (o.brow || 0) * 16, tl = o.smirk ? 1 : 0, fr = o.frown ? 1 : 0;
  ctx.strokeStyle = C.hair; ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(-66, -26 - br - fr * 6); ctx.quadraticCurveTo(-44, -40 - br - tl * 4, -20, -32 - br + tl * 6 + fr * 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, -32 - br - tl * 8 + fr * 12); ctx.quadraticCurveTo(44, -42 - br - tl * 10, 66, -28 - br - tl * 6 - fr * 6); ctx.stroke();
  // eyes: 'n' | 'wide' | 'closed'
  if (o.eyes === 'wide') {
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 40, 6, 24, 27, 0, 0, TAU); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke(); circle(sd * 40, 8, 12, C.ink); circle(sd * 40 + 4, 3, 4, C.white); }
  } else if (o.eyes === 'droop') {      // half-lidded, sleepy: dot eyes with a skin lid pressed halfway down
    const look = o.look || 0, lid = o.lid ?? 0.5;
    for (const sd of [-1, 1]) {
      ell(sd * 40 + look * 6, 6, 11, 14, C.ink); circle(sd * 40 + 4 + look * 6, 1, 4, C.white);
      ctx.beginPath(); ctx.ellipse(sd * 40, 6 - 14 + 28 * lid, 17, 14, 0, Math.PI, TAU); ctx.lineTo(sd * 40 + 17, 6 - 14 - 10); ctx.lineTo(sd * 40 - 17, 6 - 14 - 10); ctx.closePath(); ctx.fillStyle = C.skin; ctx.fill();
      line([[sd * 40 - 15, 6 - 14 + 28 * lid], [sd * 40 + 15, 6 - 14 + 28 * lid]], C.ink, 6);
    }
  } else if (o.eyes === 'closed') {
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * 40, 2, 13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.stroke(); }
  } else {
    const look = o.look || 0;
    for (const sd of [-1, 1]) { ell(sd * 40 + look * 6, 6, 11, 14, C.ink); circle(sd * 40 + 4 + look * 6, 1, 4, C.white); }
  }
  ctx.beginPath(); ctx.moveTo(4, 26); ctx.quadraticCurveTo(16, 44, 0, 48); ctx.strokeStyle = C.skinShade; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
  ctx.globalAlpha = 0.3; for (const sd of [-1, 1]) ell(sd * 62, 46, 20, 12, C.pink); ctx.globalAlpha = 1;
  // mouth: 'smile' | 'smirk' | 'chew' | 'o' | 'flat' | 'grin'
  const m = o.mouth || 'smile'; ctx.lineCap = 'round'; ctx.strokeStyle = C.mouth; ctx.lineWidth = 8;
  if (m === 'smile') { ctx.beginPath(); ctx.moveTo(-24, 70); ctx.quadraticCurveTo(0, 90, 24, 70); ctx.stroke(); }
  if (m === 'smirk') { ctx.beginPath(); ctx.moveTo(-22, 74); ctx.quadraticCurveTo(8, 88, 32, 64); ctx.stroke(); }
  if (m === 'flat') { ctx.beginPath(); ctx.moveTo(-20, 76); ctx.lineTo(20, 76); ctx.stroke(); }
  if (m === 'chew') ell(0, 76, 18, 4 + 8 * (o.chew || 0), C.mouth);
  if (m === 'o') { ell(0, 80, 20, 27, C.mouth); ell(0, 96, 13, 8, C.pink); }
  if (m === 'talk') { const op = o.talk || 0; ell(0, 76 + op * 4, 17 + op * 5, 4 + 17 * op, C.mouth); if (op > 0.4) ell(0, 76 + op * 12, 11, 5 + op * 3, C.pink); }
  if (m === 'yawn') { const y = o.yawn ?? 1; ell(0, 80 + y * 8, 18 + y * 14, 8 + 38 * y, C.mouth); ell(0, 80 + y * 30, 10 + y * 10, 4 + 10 * y, C.pink); }
  if (m === 'grin') { ctx.beginPath(); ctx.moveTo(-34, 66); ctx.quadraticCurveTo(0, 112, 34, 66); ctx.closePath(); ctx.fillStyle = C.mouth; ctx.fill(); rr(-26, 66, 52, 12, 4); ctx.fillStyle = C.white; ctx.fill(); }
  ctx.restore();
}
/**
 * The hero. o = { x, y, s, arm (pose), finger (rad or null), eyes, mouth, chew, brow, smirk, frown, look (-1..1),
 *   xray (bool: whole body becomes x-ray, head stays normal), pulse (stomach swell 0..1),
 *   holding: [drawFn(x, y)] drawn at the right hand, inside: [x, y, rot] a gum drawn inside the body (local coords) }
 */
export function man(o) {
  const s = o.s || 1, XR = !!o.xray;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(s, s);
  if (XR) {
    for (const x of [-128, 6]) {
      rr(x, 180, 122, 440, 40); ctx.fillStyle = C.xnavy; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = C.cyan; ctx.stroke();
      const cx = x + 61; line([[cx, 200], [cx, 380]], C.cyan, 16); circle(cx, 400, 20, C.cyan); line([[cx - 9, 420], [cx - 9, 600]], C.cyan, 8); line([[cx + 9, 420], [cx + 9, 600]], C.cyan, 8);
    }
    rr(-36, -250, 72, 60, 20); ctx.fillStyle = C.xnavy; ctx.fill();
    for (let y = -246; y < -200; y += 22) { rr(-13, y, 26, 16, 6); ctx.fillStyle = C.cyan; ctx.fill(); }
  } else {
    rr(-128, 180, 122, 440, 40); ctx.fillStyle = C.pants; ctx.fill(); rr(6, 180, 122, 440, 40); ctx.fill();
    rr(6, 180, 40, 440, [0, 0, 0, 30]); ctx.fillStyle = C.pantsShade; ctx.fill();
    rr(-36, -250, 72, 60, 20); ctx.fillStyle = C.skin; ctx.fill();
  }
  arm(-1, o.armL || ARM.down, null, XR);
  if (XR) skeletonTorso(o.pulse || 0, o);
  else {
    torsoPath(); ctx.fillStyle = C.shirt; ctx.fill();
    ctx.save(); torsoPath(); ctx.clip(); ctx.beginPath(); ctx.moveTo(95, -220); ctx.quadraticCurveTo(70, 0, 100, 220); ctx.lineTo(200, 220); ctx.lineTo(200, -220); ctx.closePath(); ctx.fillStyle = C.shirtShade; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -214, 46, 26, 0, 0, Math.PI); ctx.fillStyle = C.skin; ctx.fill(); ctx.strokeStyle = C.shirtShade; ctx.lineWidth = 12; ctx.stroke();
  }
  if (o.skull) xrayHead(o); else head(o);
  const ra = o.arm || ARM.down;
  arm(1, ra, o.finger ?? null, XR);
  if (o.holding) o.holding(ra.h[0] - 34, ra.h[1] - 14);
  if (o.inside) gum(o.inside[0], o.inside[1], 0.5, o.inside[2] || 0);
  if (o.over) o.over();                          // drawn last in the man's local coords (speaker pips etc.)
  ctx.restore();
}
/** follow FOOD_PATH: u 0..1 → [x, y] in the man's local coords */
export function foodAt(u) {
  const P = FOOD_PATH, n = P.length - 1, k = clamp(u) * n, i = Math.min(n - 1, Math.floor(k)), f = k - i;
  return [lerp(P[i][0], P[i + 1][0], f), lerp(P[i][1], P[i + 1][1], f)];
}

// ═════════════════════════ FOOD PROPS ═════════════════════════
const FOOD = { bun: '#E8A55C', bunDark: '#C9803F', patty: '#6B3A2A', pattyDark: '#512A1E', fry: '#FFD43B', fryDark: '#E0B21F', cupDark: '#A91E2D' };
/** flat burger, ~180 x 150 at s = 1 (origin = centre) */
export function burger(x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  rr(-82, 28, 164, 42, [8, 8, 30, 30]); ctx.fillStyle = FOOD.bun; ctx.fill(); rr(-82, 52, 164, 18, [0, 0, 30, 30]); ctx.fillStyle = FOOD.bunDark; ctx.fill();
  rr(-90, -2, 180, 34, 17); ctx.fillStyle = FOOD.patty; ctx.fill(); rr(-90, 18, 180, 14, [0, 0, 17, 17]); ctx.fillStyle = FOOD.pattyDark; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-84, -4); ctx.lineTo(84, -4); ctx.lineTo(0, 30); ctx.closePath(); ctx.fillStyle = C.yellow; ctx.fill();          // cheese
  ctx.beginPath(); ctx.moveTo(-92, -8); for (let i = 0; i <= 8; i++) ctx.lineTo(-92 + i * 23, -8 + (i % 2 ? 14 : 0)); ctx.lineTo(92, -14); ctx.lineTo(-92, -14); ctx.closePath(); ctx.fillStyle = C.leaf; ctx.fill();   // lettuce
  ctx.beginPath(); ctx.moveTo(-86, -14); ctx.bezierCurveTo(-90, -96, 90, -96, 86, -14); ctx.closePath(); ctx.fillStyle = FOOD.bun; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = FOOD.bunDark; ctx.globalAlpha = 0.45; ctx.fillRect(-100, -40, 200, 40); ctx.restore();
  ell(-34, -66, 26, 9, '#F6C985', -0.4);
  for (const [sx, sy, r] of [[-12, -58, 0.3], [18, -64, -0.4], [40, -48, 0.6], [-44, -40, -0.5], [4, -40, 0.1]]) ell(sx, sy, 8, 4.5, C.white, r);
  ctx.restore();
}
/** red fries box with yellow sticks, ~150 x 190 at s = 1 */
export function fries(x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const sticks = [[-52, -92, -0.14], [-30, -108, -0.06], [-8, -100, 0.02], [14, -112, 0.08], [36, -98, 0.14], [54, -86, 0.2], [-66, -78, -0.24]];
  for (const [sx, sy, r] of sticks) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(r); rr(-9, 0, 18, 96, 6); ctx.fillStyle = FOOD.fry; ctx.fill(); rr(3, 0, 6, 96, 3); ctx.fillStyle = FOOD.fryDark; ctx.fill(); ctx.restore(); }
  ctx.beginPath(); ctx.moveTo(-78, -26); ctx.lineTo(78, -26); ctx.lineTo(60, 92); ctx.quadraticCurveTo(0, 100, -60, 92); ctx.closePath(); ctx.fillStyle = C.red; ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); ctx.moveTo(40, -30); ctx.lineTo(90, -30); ctx.lineTo(90, 100); ctx.lineTo(50, 100); ctx.closePath(); ctx.fillStyle = FOOD.cupDark; ctx.fill(); ctx.restore();
  rr(-34, 6, 68, 40, 12); ctx.fillStyle = C.yellow; ctx.fill();
  ctx.restore();
}
/** soda cup with lid and straw, ~140 x 270 at s = 1. fizz 0..1 adds rising bubbles */
export function cola(x, y, s = 1, rot = 0, fizz = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.save(); ctx.rotate(0.12); rr(8, -170, 14, 120, 7); ctx.fillStyle = C.white; ctx.fill(); rr(8, -170, 14, 40, 7); ctx.fillStyle = C.red; ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-62, -52); ctx.lineTo(62, -52); ctx.lineTo(46, 112); ctx.quadraticCurveTo(0, 120, -46, 112); ctx.closePath(); ctx.fillStyle = C.red; ctx.fill();
  ctx.save(); ctx.clip(); ctx.beginPath(); ctx.moveTo(30, -60); ctx.lineTo(80, -60); ctx.lineTo(80, 120); ctx.lineTo(40, 120); ctx.closePath(); ctx.fillStyle = FOOD.cupDark; ctx.fill();
  ctx.fillStyle = C.white; ctx.fillRect(-80, -4, 160, 62); ctx.restore();
  ell(-6, 28, 22, 22, C.red); ell(-6, 28, 12, 12, C.white);
  rr(-72, -76, 144, 30, 14); ctx.fillStyle = C.ink; ctx.fill(); rr(-60, -88, 120, 20, [14, 14, 0, 0]); ctx.fill();
  if (fizz > 0) for (let i = 0; i < 4; i++) { const ph = (fizz * 2 + i * 0.27) % 1; ctx.globalAlpha = (1 - ph) * 0.9; circle(-30 + i * 20, -120 - ph * 70, 7 + (i % 2) * 4, C.sky); ctx.globalAlpha = 1; }
  ctx.restore();
}
/** round wooden side table (top surface at y), x = centre; 380 px wide at s = 1, legs reach 450 px down */
export function table(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(-24, 14, 48, 420, 14); ctx.fillStyle = '#A85C38'; ctx.fill(); rr(-120, 420, 240, 26, 13); ctx.fillStyle = '#A85C38'; ctx.fill();
  ell(0, 0, 190, 32, '#A85C38'); ell(0, -8, 190, 30, C.pot); ell(-60, -14, 90, 8, '#DB9066');
  ctx.restore();
}
/** sugar cube (white, soft edge) */
export function sugar(x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  rr(-26, -26, 52, 52, 9); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.gumEdge; ctx.stroke();
  rr(-26, 8, 52, 18, [0, 0, 9, 9]); ctx.fillStyle = '#E8E3D8'; ctx.fill(); circle(-9, -9, 3, '#E2DCD0'); circle(8, 4, 2.5, '#E2DCD0');
  ctx.restore();
}
/** sweat drop (flat, sky blue) */
export function sweatDrop(x, y, s = 1, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(0, -34); ctx.bezierCurveTo(26, -2, 26, 22, 0, 24); ctx.bezierCurveTo(-26, 22, -26, -2, 0, -34); ctx.fillStyle = C.sky; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#7FB9D2'; ctx.stroke();
  ell(-7, 6, 5, 9, C.white, 0.2);
  ctx.restore();
}
/** floating "Z" sleep marks, drifting up. t = seconds */
export function zzz(x, y, s, t) {
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.55 + i / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.translate(x + i * 34 * s + ph * 20, y - ph * 110 * s);
    ctx.font = `900 ${Math.round((54 + i * 18) * s)}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = C.ink; ctx.strokeText('Z', 0, 0); ctx.fillStyle = C.white; ctx.fillText('Z', 0, 0); ctx.restore();
  }
}
/** a vessel clogged with red cells nose-to-tail ("traffic jam"). x, y = centre, w = length, t = seconds (cells jitter in place) */
export function trafficJam(x, y, w, t, tube = 130) {
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  line([[-w / 2, 0], [w / 2, 0]], C.pinkDark, tube + 22); line([[-w / 2, 0], [w / 2, 0]], C.pink, tube); line([[-w / 2 + 20, -tube * 0.26], [w / 2 - 20, -tube * 0.26]], C.pinkLight, tube * 0.12);
  const n = Math.floor(w / 64);
  for (let i = 0; i < n; i++) { const cx = -w / 2 + 40 + i * 64 + Math.sin(t * 9 + i * 1.7) * 4, cy = ((i % 3) - 1) * 24 + Math.cos(t * 7 + i) * 3; ell(cx, cy, 32, 28, C.red); ell(cx, cy, 15, 11, '#B01E2E'); }
  ctx.restore();
}

// ═════════════════════════ TALKING ORGANS ═════════════════════════
// Four flat organ characters (brain "dimaag", stomach "pet", heart "dil", liver "jigar"). Each is a flat fill, one darker
// shade, one highlight, no outline; a face with dot eyes + highlight, brows and a mouth. Emotions: EMO. Drawn at (x, y),
// native ~240 px wide at s = 1. organ(kind, o) with o = { x, y, s, emo, talk (0..1 mouth open), pop (0..1 scale pop), tilt, sx, sy,
// look (-1..1), blink (0..1), sweat (0..1), t (seconds, for the idle breathing) }.
export const EMO = ['neutral', 'worried', 'angry', 'tired', 'surprised', 'happy', 'sleepy'];
const OPEN = '#4E1B26';
const ORG = {
  brain:   { base: '#E08FB8', dark: '#B5628F', light: '#F2B6D2' },
  stomach: { base: C.pink, dark: C.pinkDark, light: C.pinkLight },
  heart:   { base: '#E5384B', dark: '#A91E2D', light: '#F5707C' },
  liver:   { base: '#A8453A', dark: '#7A2C25', light: '#C86C5A' },
};
/** where each organ sits inside the man (his local coords) + its draw scale there */
export const ORGAN_AT = { brain: [0, -372, 0.58], heart: [54, -120, 0.46], stomach: [50, 28, 0.52], liver: [-74, -4, 0.5] };
/** the speaker pip colour of each character */
export const PIP = { dimaag: '#8B6FD6', pet: C.leaf, dil: C.red, jigar: '#E0956B', hero: C.shirt };

function eyes(emo, o, base) {
  const look = (o.look || 0) * 6, bl = 1 - clamp(o.blink || 0);
  for (const sd of [-1, 1]) {
    const ex = sd * 34 + look;
    if (emo === 'happy') { ctx.beginPath(); ctx.arc(ex, 8, 12, 1.12 * Math.PI, 1.88 * Math.PI); ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); }
    else if (emo === 'sleepy') { ctx.beginPath(); ctx.arc(ex, -2, 12, 0.12 * Math.PI, 0.88 * Math.PI); ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); }
    else if (emo === 'surprised') { circle(ex, 0, 19, C.white); circle(ex + look * 0.6, 1, 9, C.ink); circle(ex + 3 + look * 0.6, -3, 3.5, C.white); }
    else {
      ctx.save(); ctx.translate(ex, 0); ctx.scale(1, Math.max(0.08, bl)); ell(0, 0, 11, 14, C.ink); circle(4, -5, 4, C.white); ctx.restore();
      if (emo === 'tired') {
        ctx.beginPath(); ctx.ellipse(ex, 0, 17, 16, 0, Math.PI, TAU); ctx.closePath(); ctx.fillStyle = base; ctx.fill();   // lid
        line([[ex - 15, 0], [ex + 15, 0]], C.ink, 6);
        ctx.beginPath(); ctx.arc(ex, 14, 13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 5; ctx.stroke();   // eye bag
      }
    }
  }
}
function brows(emo) {
  ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineCap = 'round';
  const b = (sd, ox, oy, ix, iy, cy) => { ctx.beginPath(); ctx.moveTo(sd * ox, oy); ctx.quadraticCurveTo(sd * (ox + ix) / 2, cy, sd * ix, iy); ctx.stroke(); };
  for (const sd of [-1, 1]) {
    if (emo === 'worried') b(sd, 52, -22, 18, -40, -40);
    else if (emo === 'angry') b(sd, 52, -40, 16, -20, -34);
    else if (emo === 'tired') b(sd, 52, -22, 18, -26, -30);
    else if (emo === 'surprised') b(sd, 50, -44, 20, -46, -56);
    else if (emo === 'happy') b(sd, 50, -32, 20, -34, -44);
    else if (emo === 'sleepy') b(sd, 50, -20, 20, -24, -26);
    else b(sd, 50, -34, 20, -36, -42);
  }
}
function mouth(emo, talk) {
  ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = C.ink;
  if (talk > 0.04) {     // talking: an open mouth that flaps with the syllables
    const w = (emo === 'angry' ? 22 : 15) + 8 * talk, h = 4 + 20 * talk;
    ell(0, 42 + h * 0.3, w, h, OPEN); ell(0, 42 + h * 0.3 + h * 0.5, w * 0.6, h * 0.4, '#E57A8A');
    if (emo === 'angry' || emo === 'happy') { rr(-w * 0.7, 42 + h * 0.3 - h, w * 1.4, 7, 3); ctx.fillStyle = C.white; ctx.fill(); }
    return;
  }
  ctx.beginPath();
  if (emo === 'worried') { ctx.moveTo(-20, 46); ctx.quadraticCurveTo(-10, 36, 0, 46); ctx.quadraticCurveTo(10, 56, 20, 46); ctx.stroke(); }
  else if (emo === 'angry') { ctx.moveTo(-20, 52); ctx.quadraticCurveTo(0, 32, 20, 52); ctx.stroke(); }
  else if (emo === 'tired') { ctx.moveTo(-14, 46); ctx.quadraticCurveTo(0, 50, 14, 44); ctx.stroke(); }
  else if (emo === 'surprised') { ell(0, 50, 11, 15, OPEN); }
  else if (emo === 'happy') { ctx.moveTo(-24, 36); ctx.quadraticCurveTo(0, 74, 24, 36); ctx.closePath(); ctx.fillStyle = OPEN; ctx.fill(); rr(-19, 36, 38, 9, 4); ctx.fillStyle = C.white; ctx.fill(); }
  else if (emo === 'sleepy') { ell(0, 48, 8, 9, OPEN); }
  else { ctx.moveTo(-16, 42); ctx.quadraticCurveTo(0, 56, 16, 42); ctx.stroke(); }
}
function organFace(o, base) {
  const emo = o.emo || 'neutral';
  eyes(emo, o, base); brows(emo); mouth(emo, o.talk || 0);
  if (emo === 'happy' || emo === 'surprised') { ctx.globalAlpha = 0.3; for (const sd of [-1, 1]) ell(sd * 58, 28, 14, 9, C.white); ctx.globalAlpha = 1; }
}
// each body function draws the shape and returns the face transform (undo with ctx.restore)
function bodyBrain(P) {
  const lobes = [[-64, -26, 56], [0, -50, 62], [64, -26, 56], [-72, 26, 48], [72, 26, 48], [0, 8, 74]];
  for (const [x, y, r] of lobes) circle(x, y + 9, r * 1.02, P.dark);
  rr(-16, 70, 32, 46, 12); ctx.fillStyle = P.dark; ctx.fill(); ell(0, 92, 40, 24, P.dark);            // stem + cerebellum
  for (const [x, y, r] of lobes) circle(x, y, r, P.base);
  ell(0, 86, 38, 21, P.base);
  ctx.strokeStyle = P.dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const [a, b, c, d, e, f] of [[-54, -82, -34, -64, -52, -44], [26, -96, 40, -78, 22, -60], [-104, -24, -84, -10, -102, 6], [100, -22, 82, -8, 100, 10], [-34, -102, -8, -86, -24, -70], [66, -66, 84, -52, 70, -40], [-92, 52, -70, 60, -52, 76], [92, 54, 70, 62, 52, 76]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.quadraticCurveTo(c, d, e, f); ctx.stroke(); }
  ell(-44, -62, 26, 11, P.light, -0.5); ell(46, -76, 14, 7, P.light, 0.5);
  ctx.save(); ctx.translate(0, 2); ctx.scale(1.12, 1.12);
}
function bodyStomach(P) {
  const path = () => { ctx.beginPath(); ctx.moveTo(-38, -92); ctx.bezierCurveTo(14, -112, 66, -84, 92, -34); ctx.bezierCurveTo(124, 28, 94, 104, 22, 108); ctx.bezierCurveTo(-52, 112, -106, 72, -98, 8); ctx.bezierCurveTo(-94, -42, -74, -72, -38, -92); ctx.closePath(); };
  rr(-52, -150, 30, 70, 14); ctx.fillStyle = P.dark; ctx.fill(); rr(-48, -146, 22, 66, 11); ctx.fillStyle = P.base; ctx.fill();     // oesophagus
  rr(66, -66, 70, 30, 14); ctx.fillStyle = P.dark; ctx.fill();                                                                         // exit to the gut
  ctx.save(); ctx.translate(6, 9); path(); ctx.fillStyle = P.dark; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = P.base; ctx.fill();
  ctx.save(); path(); ctx.clip(); ctx.strokeStyle = P.light; ctx.globalAlpha = 0.5; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (const y of [70, 92]) { ctx.beginPath(); ctx.moveTo(-90, y); ctx.quadraticCurveTo(0, y + 22, 100, y - 16); ctx.stroke(); } ctx.restore();
  ell(-56, -50, 24, 11, P.light, -0.7); ell(-30, -76, 9, 5, P.light, -0.5);
  ctx.save(); ctx.translate(2, 4); ctx.scale(1.12, 1.12);
}
function bodyHeart(P) {
  const path = () => { ctx.beginPath(); ctx.moveTo(0, 100); ctx.bezierCurveTo(-176, -4, -120, -128, 0, -64); ctx.bezierCurveTo(120, -128, 176, -4, 0, 100); ctx.closePath(); };
  for (const [x, a] of [[-34, -0.2], [26, 0.25]]) { ctx.save(); ctx.translate(x, -76); ctx.rotate(a); rr(-15, -50, 30, 70, 14); ctx.fillStyle = P.dark; ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.translate(5, 8); path(); ctx.fillStyle = P.dark; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = P.base; ctx.fill();
  ell(-76, -46, 28, 13, P.light, -0.6); circle(-44, -76, 6, P.light);
  ctx.save(); ctx.translate(0, 4); ctx.scale(1.12, 1.12);
}
function bodyLiver(P) {
  const path = () => { ctx.beginPath(); ctx.moveTo(-116, -30); ctx.bezierCurveTo(-116, -90, -20, -96, 44, -66); ctx.bezierCurveTo(96, -44, 126, -14, 118, 10); ctx.bezierCurveTo(70, 58, -20, 76, -74, 56); ctx.bezierCurveTo(-116, 42, -122, 4, -116, -30); ctx.closePath(); };
  ctx.save(); ctx.translate(6, 9); path(); ctx.fillStyle = P.dark; ctx.fill(); ctx.restore();
  path(); ctx.fillStyle = P.base; ctx.fill();
  ctx.save(); path(); ctx.clip(); ctx.strokeStyle = P.dark; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(64, -62); ctx.quadraticCurveTo(40, -20, 70, 34); ctx.stroke(); ctx.restore();
  ell(-76, -58, 26, 10, P.light, -0.25);
  ctx.save(); ctx.translate(-8, -6); ctx.scale(1.1, 1.1);
}
/** A talking organ. kind: 'brain' | 'stomach' | 'heart' | 'liver' (see the block comment above for o) */
export function organ(kind, o = {}) {
  const P = ORG[kind], s = o.s ?? 1, breathe = 1 + 0.018 * Math.sin((o.t || 0) * 3.1), pop = 1 + 0.16 * (o.pop || 0);
  ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.rotate(o.tilt || 0);
  ctx.scale(s * pop * breathe * (o.sx ?? 1), s * pop * (2 - breathe) * (o.sy ?? 1));
  ({ brain: bodyBrain, stomach: bodyStomach, heart: bodyHeart, liver: bodyLiver })[kind](P);
  organFace(o, P.base); ctx.restore();                     // restores the face transform opened by the body function
  if (o.sweat) sweatDrop(kind === 'heart' ? 118 : 108, -34 - (1 - clamp(o.sweat)) * 10, 1, clamp(o.sweat));
  ctx.restore();
}
export const brain = (o) => organ('brain', o);
export const stomachChar = (o) => organ('stomach', o);
export const heartChar = (o) => organ('heart', o);
export const liver = (o) => organ('liver', o);

/** Line-timing helper: what the speaking organ does at film time t while line `line` is spoken.
 *  → { on, talk (0..1 mouth open, flaps with every spoken word), pop (0..1 scale pop that decays after the line starts) } */
export function speech(t, line) {
  const l = T.lines[line]; if (!l || t < l.start - 0.02 || t > l.end + 0.05) return { on: false, talk: 0, pop: 0 };
  let talk = 0;
  for (const w of T.words) if (w.line === line && t >= w.s - 0.02 && t <= w.e) { const k = (t - w.s) * 11; talk = 0.3 + 0.7 * Math.abs(Math.sin(k)) * (0.7 + 0.3 * Math.sin(k * 0.37 + w.s * 9)); }
  return { on: true, talk, pop: Math.exp(-Math.max(0, t - l.start) * 7) };
}
/** speaker pip: a coloured bubble with sound bars and a little tail pointing DOWN (tail tip at y + 44 s) */
export function speakerPip(x, y, s, color, t, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 9) * 3 * s); ctx.scale(s, s); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.moveTo(-14, 20); ctx.lineTo(0, 44); ctx.lineTo(14, 20); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  rr(-46, -24, 92, 52, 26); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.stroke();
  rr(-14, 18, 28, 14, 4); ctx.fillStyle = color; ctx.fill();
  for (let i = -1; i <= 1; i++) { const h = 10 + 16 * Math.abs(Math.sin(t * 10 + i * 1.9)); rr(i * 20 - 5, 2 - h / 2, 10, h, 5); ctx.fillStyle = C.white; ctx.fill(); }
  ctx.restore();
}

// ═════════════════════════ X-RAY BODY WITH ALL FOUR ORGANS ═════════════════════════
function xrayHead(o) {
  ctx.save(); ctx.translate(0, -350);
  ctx.beginPath(); ctx.ellipse(0, 12, 102, 112, 0, 0, TAU); ctx.fillStyle = C.xnavy; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = C.cyan; ctx.stroke();
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 40, 66, 24, 20, 0, 0, TAU); ctx.fillStyle = C.xnavy; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.cyan; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, 82); ctx.lineTo(-9, 100); ctx.lineTo(9, 100); ctx.closePath(); ctx.lineWidth = 5; ctx.stroke();
  for (let i = -3; i <= 3; i++) { rr(i * 13 - 5.5, 110, 11, 15, 4); ctx.fillStyle = C.cyan; ctx.fill(); }
  ctx.restore();
  if (o.headOrgan) o.headOrgan();
}
const PIP_UP = { brain: 112, heart: 100, stomach: 108, liver: 70 };
const WHO = { brain: 'dimaag', stomach: 'pet', heart: 'dil', liver: 'jigar' };
/** The x-ray body (whole body see-through, including the skull) with the four organ characters in their places.
 *  o = { x, y, s, t, organs: { brain, heart, stomach, liver: { emo, talk, pop, tilt, sx, sy, look, blink, sweat, x, y } }, only: ['brain'] (draw just these organs), speaker: 'brain'|'heart'|'stomach'|'liver', pip, arm, armL }
 *  Placement in man-local coords: ORGAN_AT. focusOn(name, s, sx, sy) gives the man origin that puts an organ at a screen point. */
export function xrayBody(o) {
  const og = o.organs || {}, t = o.t || 0;
  const put = (k) => { if (o.only && !o.only.includes(k)) return; const [px, py, ps] = ORGAN_AT[k], d = og[k] || {}; organ(k, { t, ...d, x: px + (d.x || 0), y: py + (d.y || 0), s: ps * (d.s ?? 1) }); };
  man({ x: o.x, y: o.y, s: o.s, xray: true, skull: true, arm: o.arm, armL: o.armL, pulse: 0,
    headOrgan: () => put('brain'),
    torsoOrgans: () => { put('liver'); put('stomach'); put('heart'); },
    over: () => { const k = o.speaker; if (!k) return; const [px, py, ps] = ORGAN_AT[k], sc = o.pip ?? 0.62, pop = (og[k] && og[k].pop) || 0; speakerPip(px, py - PIP_UP[k] * ps * 1.8 / 1.0 * 0.62 - 44 * sc - 8 - pop * 6, sc, PIP[WHO[k]], t); } });
}
export function focusOn(name, s, sx = 540, sy = 760) { const [px, py] = ORGAN_AT[name]; return [sx - px * s, sy - py * s]; }
