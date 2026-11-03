// Builds the same calm, emotional story with each voice engine so you can compare them by ear.
//   npm run demo                (English + Hindi)         npm run demo -- --lang en
// Videos go to  <Videos>/VideoStudio/voice-demo/  together with a README that says which file is which.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCli } from './lib/args.ts';
import { runBuild } from './lib/build.ts';
import { resolveProject } from './lib/paths.ts';
import { log } from './lib/pipeline.ts';
import { engineState, type EngineName } from './lib/voices/engines.ts';
import type { Delivery } from '../src/types.ts';

const cli = parseCli();
const langs = cli.lang && cli.lang !== 'all' ? [cli.lang] : (['en', 'hi'] as const);
const variants: { id: string; provider: EngineName; delivery: Delivery; what: string }[] = [
  { id: 'edge-natural', provider: 'edge', delivery: 'natural', what: 'Today: free Edge voice, natural delivery (the baseline)' },
  { id: 'edge-calm', provider: 'edge', delivery: 'calm', what: 'Edge voice, calm delivery: slower, real pauses, emotion-aware, warm mastering' },
  { id: 'kokoro-calm', provider: 'kokoro', delivery: 'calm', what: 'Kokoro (local neural voice), calm delivery' },
  { id: 'chatterbox-calm', provider: 'chatterbox', delivery: 'calm', what: 'Chatterbox (local, most expressive), calm delivery, emotion-driven' },
];

const outDir = path.join(os.homedir(), 'Videos', 'VideoStudio', 'voice-demo');
const rows: string[] = [];
for (const lang of langs) {
  const slug = `demo-quiet-apology-${lang}`;
  const project = resolveProject(slug);
  for (const v of variants) {
    const st = engineState(v.provider);
    if (st.state === 'missing') {
      log(`\n-- ${slug} / ${v.id}: skipped (${st.reason})`);
      rows.push(`| ${slug}-${v.id}.mp4 | skipped: ${st.reason} | ${v.what} |`);
      continue;
    }
    log(`\n-- ${slug} / ${v.id}`);
    try {
      await runBuild(project, { ...cli, project: slug, provider: v.provider, delivery: v.delivery, noStills: true }, { videosSubdir: 'voice-demo', outName: `${slug}-${v.id}` });
      const rep = JSON.parse(fs.readFileSync(path.join(project.dir, 'voices-report.json'), 'utf8')) as { voices: Record<string, { engine: string }> };
      const used = Object.entries(rep.voices).map(([c, x]) => `${c}=${x.engine}`).join(', ');
      rows.push(`| ${slug}-${v.id}.mp4 | ${used}${Object.values(rep.voices).some((x) => x.engine !== v.provider) ? ' (fell back)' : ''} | ${v.what} |`);
    } catch (e) {
      log(`  FAILED: ${(e as Error).message}`);
      rows.push(`| ${slug}-${v.id}.mp4 | failed: ${(e as Error).message.slice(0, 80)} | ${v.what} |`);
    }
  }
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'README.md'), `# Voice demo\n\nThe same scene ("A Quiet Apology": Mira and Pip, a few gentle lines), built with each voice engine. Same picture, same script: only the voices differ.\nListen for: how calm it sounds, whether the pauses feel natural, and whether the sad / warm lines carry feeling.\n\n| File | Engine used | What it is |\n|---|---|---|\n${rows.join('\n')}\n`);
log(`\nDemo folder: ${outDir}`);
for (const r of rows) log(r);
