// Minimal PCM WAV helpers: parse, trim silence, write, and compute a per-frame mouth envelope.

export type Pcm = { sampleRate: number; samples: Float32Array };

export function parseWav(buf: Buffer): Pcm {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let pos = 12;
  let channels = 1;
  let sampleRate = 24000;
  let bits = 16;
  let data: Buffer | undefined;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (size === 0xffffffff || body + size > buf.length) size = buf.length - body;
      data = buf.subarray(body, body + size);
      break;
    }
    pos = body + size + (size % 2);
  }
  if (!data) throw new Error('WAV has no data chunk');
  if (bits !== 16) throw new Error(`only 16-bit WAV is supported (got ${bits})`);
  const frames = Math.floor(data.length / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data.readInt16LE((i * channels + c) * 2);
    samples[i] = sum / channels / 32768;
  }
  return { sampleRate, samples };
}

export function encodeWav({ sampleRate, samples }: Pcm): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function rms(s: Float32Array, from: number, to: number): number {
  let acc = 0;
  const n = Math.max(1, to - from);
  for (let i = from; i < to; i++) acc += s[i] * s[i];
  return Math.sqrt(acc / n);
}

/** Cut leading/trailing silence, keeping a small pad so words are not clipped. */
export function trimSilence(pcm: Pcm, thresholdDb = -42, padStart = 0.04, padEnd = 0.1): Pcm {
  const { sampleRate, samples } = pcm;
  const thr = Math.pow(10, thresholdDb / 20);
  const win = Math.max(1, Math.round(sampleRate * 0.01));
  let first = -1;
  let last = -1;
  for (let i = 0; i + win <= samples.length; i += win) {
    if (rms(samples, i, i + win) > thr) {
      if (first < 0) first = i;
      last = i + win;
    }
  }
  if (first < 0) return pcm; // silent clip, leave alone
  const a = Math.max(0, first - Math.round(padStart * sampleRate));
  const b = Math.min(samples.length, last + Math.round(padEnd * sampleRate));
  return { sampleRate, samples: samples.slice(a, b) };
}

/** Per-frame mouth openness in 0..1, smoothed with a fast attack and slower release. */
export function mouthEnvelope(pcm: Pcm, fps: number, frames: number): number[] {
  const { sampleRate, samples } = pcm;
  const win = sampleRate / fps;
  const raw: number[] = [];
  for (let f = 0; f < frames; f++) {
    const a = Math.floor(f * win);
    const b = Math.min(samples.length, Math.floor((f + 1) * win));
    raw.push(a < samples.length ? rms(samples, a, b) : 0);
  }
  const active = raw.filter((v) => v > 0.01).sort((x, y) => x - y);
  const ref = active.length ? active[Math.floor(active.length * 0.92)] : 1;
  const out: number[] = [];
  let prev = 0;
  for (const v of raw) {
    const norm = Math.min(1, Math.pow(Math.min(1.4, v / ref), 0.8));
    prev = norm > prev ? prev * 0.25 + norm * 0.75 : prev * 0.6 + norm * 0.4;
    out.push(Math.round(prev * 100) / 100);
  }
  return out;
}
