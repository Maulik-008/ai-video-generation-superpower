import { parseArgs } from 'node:util';

export type Cli = {
  project?: string;
  provider: 'auto' | 'edge' | 'sapi' | 'kokoro' | 'chatterbox' | 'turbo';
  delivery?: 'natural' | 'warm' | 'calm';
  lang?: 'en' | 'hi' | 'all';
  res?: '720p' | '1080p';
  workers?: number;
  shots?: string[];
  frames?: number[];
  noStills: boolean;
  keepFrames: boolean;
  noQa: boolean;
  listen: boolean;
  fps?: 30 | 60;
  video?: string;
};

export function parseCli(argv = process.argv.slice(2)): Cli {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      project: { type: 'string' },
      provider: { type: 'string', default: 'auto' },
      delivery: { type: 'string' },
      lang: { type: 'string' },
      res: { type: 'string' },
      workers: { type: 'string' },
      shots: { type: 'string' },
      frames: { type: 'string' },
      'no-stills': { type: 'boolean', default: false },
      'keep-frames': { type: 'boolean', default: false },
      'no-qa': { type: 'boolean', default: false },
      listen: { type: 'boolean', default: false },
      fps: { type: 'string' },
      video: { type: 'string' },
    },
  });
  const provider = String(values.provider);
  if (!['auto', 'edge', 'sapi', 'kokoro', 'chatterbox', 'turbo'].includes(provider)) throw new Error('--provider must be auto, edge, sapi, kokoro, chatterbox or turbo');
  if (values.delivery && !['natural', 'warm', 'calm'].includes(String(values.delivery))) throw new Error('--delivery must be natural, warm or calm');
  if (values.lang && !['en', 'hi', 'all'].includes(String(values.lang))) throw new Error('--lang must be en, hi or all');
  if (values.res && !['720p', '1080p'].includes(String(values.res))) throw new Error('--res must be 720p or 1080p');
  if (values.fps && !['30', '60'].includes(String(values.fps))) throw new Error('--fps must be 30 or 60');
  return {
    project: values.project ?? positionals[0],
    provider: provider as Cli['provider'],
    res: values.res as Cli['res'],
    delivery: values.delivery as Cli['delivery'],
    lang: values.lang as Cli['lang'],
    workers: values.workers ? Number(values.workers) : undefined,
    shots: values.shots ? String(values.shots).split(',').map((s) => s.trim()) : undefined,
    frames: values.frames ? String(values.frames).split(',').map((s) => Number(s.trim())) : undefined,
    noStills: Boolean(values['no-stills']),
    keepFrames: Boolean(values['keep-frames']),
    noQa: Boolean(values['no-qa']),
    listen: Boolean(values.listen),
    fps: values.fps ? (Number(values.fps) as 30 | 60) : undefined,
    video: values.video ? String(values.video) : undefined,
  };
}
