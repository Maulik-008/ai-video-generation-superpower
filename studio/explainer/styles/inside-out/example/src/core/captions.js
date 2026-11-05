// Captions: 1-3 words, Inter Black, white with a thick ink outline, ONE yellow word, centre lower third.
// Each script line has "caps": "WHAT IF *YOU | SWALLOW *GUM?"  ("|" = next caption, "*" = the yellow word).
// Without "caps", the line is chunked automatically (2-3 words, the longest word goes yellow).
// A chunk appears 0.05 s before its first word and stays until the next chunk (or shortly after the line ends).
import { ctx, C, clamp, lerp, seg, eob, fontFor, hasDeva } from './lib.js';
import { T, lineWords, norm } from './timing.js';

export const CAP = { y: 1400, size: 150, maxW: 900 };
let caps = [];

function autoChunks(text) {
  const ws = text.toUpperCase().split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < ws.length;) { const n = ws.length - i === 4 ? 2 : Math.min(3, ws.length - i); out.push(ws.slice(i, i + n)); i += n; }
  return out.map((c) => { const k = c.reduce((b, w, j) => (norm(w).length > norm(c[b]).length ? j : b), 0); return c.map((w, j) => (j === k ? '*' + w : w)).join(' '); });
}

export function buildCaptions(script) {
  caps = [];
  script.lines.forEach((ln, i) => {
    const chunks = (ln.caps ? ln.caps.split('|') : autoChunks(ln.text)).map((s) => s.trim()).filter(Boolean);
    const ws = lineWords(i); if (!ws.length) return;
    const counts = chunks.map((c) => c.split(/\s+/).length), N = counts.reduce((a, b) => a + b, 0);
    const nm = norm;   // letters + combining marks, so Devanagari words match by spelling too
    let acc = 0, from = 0;
    chunks.forEach((c, j) => {
      // find the chunk's first word in the spoken line (from where the last chunk started); else place it by word count
      const first = nm(c.split(/\s+/)[0]);
      let idx = j === 0 ? 0 : ws.findIndex((w, k) => k > from && first && (nm(w.w) === first || (first.length > 2 && nm(w.w).startsWith(first))));
      if (idx < 0) idx = Math.max(from + (j ? 1 : 0), Math.min(ws.length - 1, Math.round(acc * ws.length / N)));
      acc += counts[j]; from = idx;
      caps.push({ line: i, s: ws[idx].s - 0.05, words: c.split(/\s+/).map((w) => ({ txt: w.replace('*', ''), hi: w.startsWith('*') })) });
    });
  });
  caps.forEach((c, k) => {
    const next = caps[k + 1], lineEnd = T.lines[c.line].end;
    c.e = next ? (next.s - lineEnd > 0.7 && next.line !== c.line ? lineEnd + 0.35 : next.s) : T.dur;
  });
  return caps;
}
export const captionList = () => caps;

export function drawCaption(t) {
  const c = caps.find((c) => t >= c.s && t < c.e); if (!c) return;
  const lt = t - c.s, size = CAP.size;
  const sp = size * 0.26;
  // Latin: Inter Black. Devanagari: Nirmala UI Bold (Inter has no Devanagari glyphs); no letter-spacing there (it would break conjuncts)
  c.words.forEach((w) => { w.deva = hasDeva(w.txt); ctx.font = fontFor(w.txt, size); ctx.letterSpacing = w.deva ? '0px' : '-2px'; w.w = ctx.measureText(w.txt).width; });
  const width = (ws) => ws.reduce((a, w) => a + w.w, 0) + sp * (ws.length - 1);
  let lines = [c.words];
  const deva = c.words.some((w) => w.deva);   // Devanagari: shrink a 2-3 word chunk a little to keep it on ONE line before wrapping
  if (width(c.words) > CAP.maxW && c.words.length > 1 && !(deva && CAP.maxW / width(c.words) >= 0.78)) {
    let best = null;
    for (let i = 1; i < c.words.length; i++) { const a = c.words.slice(0, i), b = c.words.slice(i), m = Math.max(width(a), width(b)); if (!best || m < best.m) best = { m, l: [a, b] }; }
    lines = best.l;
  }
  const fit = Math.min(1, CAP.maxW / Math.max(...lines.map(width)));
  const sc = (lt < 0.2 ? lerp(0.65, 1, eob(seg(lt, 0, 0.2))) : 1) * fit;
  ctx.save(); ctx.translate(540, CAP.y); ctx.scale(sc, sc);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const lh = size * (lines.some((l) => l.some((w) => w.deva)) ? 1.2 : 1), y0 = -(lines.length - 1) * lh / 2;
  lines.forEach((ln, li) => {
    let x = -width(ln) / 2; const y = y0 + li * lh;
    for (const w of ln) {
      ctx.font = fontFor(w.txt, size); ctx.letterSpacing = w.deva ? '0px' : '-2px';
      const yy = y + (w.deva ? -8 : 0);                                  // Nirmala sits lower in its line box: lift it to Inter's optical centre
      ctx.lineWidth = w.deva ? 26 : 30; ctx.strokeStyle = C.ink; ctx.strokeText(w.txt, x, yy + 10); ctx.strokeText(w.txt, x, yy);
      ctx.fillStyle = w.hi ? C.yellow : C.white; ctx.fillText(w.txt, x, yy);
      if (w.deva) { ctx.lineWidth = 5; ctx.strokeStyle = ctx.fillStyle; ctx.strokeText(w.txt, x, yy); }   // thicken the thinner Devanagari strokes
      x += w.w + sp;
    }
  });
  ctx.letterSpacing = '0px'; ctx.restore();
}
