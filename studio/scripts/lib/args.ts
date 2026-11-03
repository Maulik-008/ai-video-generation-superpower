import { parseArgs } from 'node:util';

export type Cli = {
  project?: string;
  provider: 'auto' | 'edge' | 'sapi';
  res?: '720p' | '1080p';
  workers?: number;
  shots?: string[];
  frames?: number[];
  noStills: boolean;
  keepFrames: boolean;
};

export function parseCli(argv = process.argv.slice(2)): Cli {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      project: { type: 'string' },
      provider: { type: 'string', default: 'auto' },
      res: { type: 'string' },
      workers: { type: 'string' },
      shots: { type: 'string' },
      frames: { type: 'string' },
      'no-stills': { type: 'boolean', default: false },
      'keep-frames': { type: 'boolean', default: false },
    },
  });
  const provider = String(values.provider);
  if (!['auto', 'edge', 'sapi'].includes(provider)) throw new Error('--provider must be auto, edge or sapi');
  if (values.res && !['720p', '1080p'].includes(String(values.res))) throw new Error('--res must be 720p or 1080p');
  return {
    project: values.project ?? positionals[0],
    provider: provider as Cli['provider'],
    res: values.res as Cli['res'],
    workers: values.workers ? Number(values.workers) : undefined,
    shots: values.shots ? String(values.shots).split(',').map((s) => s.trim()) : undefined,
    frames: values.frames ? String(values.frames).split(',').map((s) => Number(s.trim())) : undefined,
    noStills: Boolean(values['no-stills']),
    keepFrames: Boolean(values['keep-frames']),
  };
}
