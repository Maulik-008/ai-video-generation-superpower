// One-time (and repeatable) setup of the local voice engines. Safe to re-run: every step checks before it does anything.
//   npm run voices:setup                       Kokoro + Chatterbox
//   npm run voices:setup -- --only kokoro      just one
// Downloads: Kokoro about 0.35 GB. Chatterbox about 2.5 GB (PyTorch for the GPU) + 3.3 GB (model) + 1 GB (Whisper speech check), into git-ignored folders.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { loadConfig, speechCheckEnabled, voiceHome } from './lib/config.ts';
import { STUDIO_ROOT } from './lib/paths.ts';
import { MODELS_DIR, venvPython } from './lib/voices/engines.ts';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : 'all';
const step = (m: string) => console.log(`\n== ${m}`);

function run(cmd: string, args: string[], inherit = true): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: inherit ? 'inherit' : 'ignore', env: { ...process.env, PYTHONUTF8: '1', PIP_DISABLE_PIP_VERSION_CHECK: '1' } });
    p.on('error', () => resolve(-1));
    p.on('close', (c) => resolve(c ?? -1));
  });
}
const quiet = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: 'utf8' });

/** A Python 3.10 to 3.13 (3.11 preferred: Chatterbox is tested on it). */
function findPython(prefer311: boolean): string {
  const chosen = loadConfig().voices?.python;
  if (chosen) {
    const r = quiet(chosen, ['-c', 'import sys;print(sys.version_info[0], sys.version_info[1])']);
    if (r.status === 0) return chosen;
    throw new Error(`The Python you chose in setup (${chosen}) does not run. Re-run: node setup.mjs`);
  }
  const candidates = process.platform === 'win32' ? [['py', '-3.11'], ['py', '-3.12'], ['py', '-3.10'], ['python']] : [['python3.11'], ['python3.12'], ['python3.10'], ['python3']];
  const ok: { cmd: string[]; v: string }[] = [];
  for (const c of candidates) {
    const r = quiet(c[0], [...c.slice(1), '-c', 'import sys;print("%d.%d" % sys.version_info[:2]);print(sys.executable)']);
    if (r.status === 0) {
      const [v, exe] = r.stdout.trim().split(/\r?\n/);
      const minor = Number(v.split('.')[1]);
      if (Number(v.split('.')[0]) === 3 && minor >= 10 && minor <= 13) ok.push({ cmd: [exe], v });
    }
  }
  if (!ok.length) throw new Error('Python 3.10 to 3.13 is required (3.11 recommended). Install it from python.org and re-run.');
  const best = (prefer311 ? ok.find((o) => o.v === '3.11') : undefined) ?? ok[0];
  if (prefer311 && best.v !== '3.11') console.log(`  note: Python ${best.v} found; Chatterbox is tested on 3.11, so a failure here may need Python 3.11`);
  return best.cmd[0];
}

async function ensureVenv(engine: 'kokoro' | 'chatterbox') {
  if (fs.existsSync(venvPython(engine))) return;
  step(`creating the ${engine} Python environment`);
  const code = await run(findPython(engine === 'chatterbox'), ['-m', 'venv', path.join(voiceHome(), `.venv-${engine}`)]);
  if (code !== 0) throw new Error('could not create the Python environment');
}
const canImport = (engine: 'kokoro' | 'chatterbox', mod: string) => quiet(venvPython(engine), ['-c', `import ${mod}`]).status === 0;

async function download(url: string, file: string, minBytes: number) {
  if (fs.existsSync(file) && fs.statSync(file).size >= minBytes) return console.log(`  have ${path.basename(file)}`);
  console.log(`  downloading ${path.basename(file)} ...`);
  const tmp = file + '.part';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const have = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0;
    const res = await fetch(url, { headers: have ? { Range: `bytes=${have}-` } : {}, redirect: 'follow' });
    if (!res.ok && res.status !== 206) {
      console.log(`  HTTP ${res.status}, retrying`);
      continue;
    }
    const stream = fs.createWriteStream(tmp, { flags: have && res.status === 206 ? 'a' : 'w' });
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) stream.write(chunk);
      await new Promise((r) => stream.end(r));
      if (fs.statSync(tmp).size >= minBytes) return fs.renameSync(tmp, file);
    } catch (e) {
      console.log(`  interrupted (${(e as Error).message}), resuming`);
    }
  }
  throw new Error(`could not download ${url}`);
}

async function setupKokoro() {
  await ensureVenv('kokoro');
  if (!canImport('kokoro', 'kokoro_onnx')) {
    step('installing Kokoro');
    if ((await run(venvPython('kokoro'), ['-m', 'pip', 'install', 'kokoro-onnx', 'soundfile', 'numpy'])) !== 0) throw new Error('pip install failed for Kokoro');
  } else console.log('  kokoro packages already installed');
  step('Kokoro model files (about 350 MB)');
  const dir = path.join(MODELS_DIR, 'kokoro');
  fs.mkdirSync(dir, { recursive: true });
  const base = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0';
  await download(`${base}/kokoro-v1.0.onnx`, path.join(dir, 'kokoro-v1.0.onnx'), 300e6);
  await download(`${base}/voices-v1.0.bin`, path.join(dir, 'voices-v1.0.bin'), 25e6);
}

async function setupChatterbox() {
  await ensureVenv('chatterbox');
  const py = venvPython('chatterbox');
  const hasGpu = quiet('nvidia-smi', ['-L']).status === 0;
  if (!canImport('chatterbox', 'torch')) {
    step(hasGpu ? 'installing PyTorch with CUDA (about 2.5 GB)' : 'installing PyTorch (no NVIDIA GPU found: Chatterbox will not be usable, Kokoro and Edge still work)');
    const args = ['-m', 'pip', 'install', 'torch==2.6.0', 'torchaudio==2.6.0', ...(hasGpu ? ['--index-url', 'https://download.pytorch.org/whl/cu124'] : [])];
    if ((await run(py, args)) !== 0) throw new Error('pip install failed for PyTorch');
  } else console.log('  PyTorch already installed');
  if (!canImport('chatterbox', 'chatterbox')) {
    step('installing Chatterbox');
    if ((await run(py, ['-m', 'pip', 'install', 'chatterbox-tts'])) !== 0) throw new Error('pip install failed for chatterbox-tts');
  } else console.log('  chatterbox-tts already installed');
  step('Chatterbox model weights (about 3.3 GB on first run)');
  fs.mkdirSync(path.join(MODELS_DIR, 'chatterbox'), { recursive: true });
  const { runWorker, verifyExtra } = await import('./lib/voices/engines.ts');
  if (speechCheckEnabled()) step('Speech-check model (Whisper, about 1 GB): Chatterbox listens to its own output and retries bad takes');
  else console.log('\n== Speech check is switched off in your setup: Chatterbox will not download Whisper (less reliable on very short lines)');
  const { result } = await runWorker('chatterbox', [], (m) => console.log(m), verifyExtra());  // verifyExtra() is empty when the check is off
  if (!result.ok) throw new Error(result.error ?? 'could not load the Chatterbox model');
  console.log(`  model ready on ${result.info?.device}${result.info?.gpu ? ` (${result.info.gpu})` : ''}; speech check: ${result.info?.verify ?? 'off'}`);
  if (String(result.info?.verify ?? '').startsWith('unavailable')) console.log('  note: Chatterbox will still work, but without the speech check (less reliable on very short lines).');
}

const failures: string[] = [];
for (const [name, fn] of [['kokoro', setupKokoro], ['chatterbox', setupChatterbox]] as const) {
  if (only !== 'all' && only !== name) continue;
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
    console.error(`\n${name} setup failed: ${(e as Error).message}`);
  }
}
step('health check');
await run(process.execPath, [path.join(STUDIO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(STUDIO_ROOT, 'scripts', 'voices-check.ts')]);
if (failures.length) {
  console.error(`\nSetup finished with problems:\n  ${failures.join('\n  ')}\nVideos still build: a missing engine falls back to the next one.`);
  process.exit(1);
}
