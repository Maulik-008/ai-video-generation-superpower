#!/usr/bin/env node
// video-super-power: first-time setup wizard.   Run:  node setup.mjs        (or .\setup.cmd / .\setup.ps1 on Windows, bash setup.sh on macOS and Linux)
//
// The one rule: NOTHING is downloaded or installed unless you choose it, and you see the size first.
// Zero dependencies on purpose, so it runs on a fresh clone before `npm install`. Needs Node 20+.
//
//   node setup.mjs                 interactive wizard (asks every question, shows a plan, asks to confirm)
//   node setup.mjs --detect        what this machine has, as JSON (used by the Claude skill)
//   node setup.mjs --status        what is installed, where, and how big
//   node setup.mjs --plan  --answers a.json   show what an answers file would do, change nothing
//   node setup.mjs --apply --answers a.json   do it, without questions (the Claude skill uses this)
//   node setup.mjs --apply --yes   the smallest safe setup: npm packages only, no big downloads
//   node setup.mjs --verify [--level check|sample|demo]
//   node setup.mjs --remove kokoro|chatterbox|turbo|voice-models|browser|deps|config|all-voices [--force]
//   add --dry-run to any action to only print it.   node setup.mjs --help
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.join(ROOT, 'studio');
const CONFIG_PATH = path.join(STUDIO, '.studio-setup.json');
const IS_WIN = process.platform === 'win32';
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR && !flag('no-color');
const paint = (code) => (s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = paint('1'), dim = paint('2'), green = paint('32'), red = paint('31'), yellow = paint('33'), cyan = paint('36');

// Approximate sizes in MB, measured on a real install. "dl" = download, "disk" = space used afterwards.
const SIZE = {
  deps: { dl: 110, disk: 110 },
  ffmpeg: { dl: 83, disk: 83 },
  chrome: { dl: 210, disk: 450 },
  kokoro: { dl: 350, disk: 510 },
  chatterbox: { dl: 5800, disk: 8400 },
  turbo: { dl: 4000, disk: 4100 }, // optional Chatterbox Turbo weights (shares the Chatterbox environment)
  whisper: { dl: 1000, disk: 1000 },
};
const fmtMB = (mb) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`);
const home = os.homedir();
const DEFAULT_OUTPUT = path.join(home, 'Videos', 'VideoStudio');

// ------------------------------------------------------------------------------------------------------------------
// small helpers
// ------------------------------------------------------------------------------------------------------------------
const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Run a command. Package-manager commands need a shell on Windows (they are .cmd files); everything else runs directly. */
function run(cmd, args, { cwd = ROOT, env = {}, capture = false, onLine } = {}) {
  return new Promise((resolve) => {
    const useShell = IS_WIN && ['npm', 'npx', 'pnpm', 'yarn'].includes(cmd);
    const child = useShell
      ? spawn([cmd, ...args.map(quote)].join(' '), { cwd, env: { ...process.env, ...env }, shell: true, stdio: capture || onLine ? ['ignore', 'pipe', 'pipe'] : 'inherit' })
      : spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: capture || onLine ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let out = '';
    let buf = '';
    const feed = (d) => {
      out += d;
      if (!onLine) return;
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        onLine(buf.slice(0, i).replace(/\r$/, ''));
        buf = buf.slice(i + 1);
      }
    };
    child.stdout?.on('data', feed);
    child.stderr?.on('data', feed);
    child.on('error', (e) => resolve({ code: -1, out: String(e) }));
    child.on('close', (code) => resolve({ code: code ?? -1, out }));
  });
}
function quiet(cmd, args, opts = {}) {
  const useShell = IS_WIN && ['npm', 'npx', 'pnpm', 'yarn'].includes(cmd);
  const r = useShell ? spawnSync([cmd, ...args.map(quote)].join(' '), { encoding: 'utf8', shell: true, ...opts }) : spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}
const exists = (p) => !!p && fs.existsSync(p);
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};

function dirSize(dir, limitMs = 15000) {
  const stop = Date.now() + limitMs;
  let total = 0;
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (Date.now() > stop) return;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        try {
          total += fs.statSync(p).size;
        } catch {}
      }
    }
  };
  if (exists(dir)) walk(dir);
  return total / 1e6;
}
function freeGB(p) {
  try {
    let dir = path.resolve(p);
    while (!fs.existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
    const s = fs.statfsSync(dir);
    return (s.bavail * s.bsize) / 1e9;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------------------------
// detection
// ------------------------------------------------------------------------------------------------------------------
function browserCandidates() {
  const local = process.env.LOCALAPPDATA ?? '';
  if (IS_WIN)
    return [
      ['Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
      ['Google Chrome', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
      ['Google Chrome', `${local}\\Google\\Chrome\\Application\\chrome.exe`],
      ['Microsoft Edge', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
      ['Microsoft Edge', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'],
    ];
  if (process.platform === 'darwin') return [['Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'], ['Microsoft Edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']];
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map((n) => [n, `/usr/bin/${n}`]);
}

function detectPythons() {
  const tries = IS_WIN
    ? [['py', '-3.13'], ['py', '-3.12'], ['py', '-3.11'], ['py', '-3.10'], ['python']]
    : [['python3.13'], ['python3.12'], ['python3.11'], ['python3.10'], ['python3'], ['python']];
  const seen = new Set();
  const out = [];
  for (const t of tries) {
    const r = quiet(t[0], [...t.slice(1), '-c', 'import sys;print("%d.%d.%d" % sys.version_info[:3]);print(sys.executable)']);
    if (r.code !== 0) continue;
    const [version, exe] = r.out.split(/\r?\n/);
    if (!exe || seen.has(exe)) continue;
    seen.add(exe);
    const [maj, min] = version.split('.').map(Number);
    out.push({ version, exe, supported: maj === 3 && min >= 10 && min <= 13, recommended: maj === 3 && min === 11 });
  }
  return out;
}

function detect() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const pm = {};
  for (const n of ['npm', 'pnpm', 'yarn']) {
    const r = quiet(n, ['--version']);
    pm[n] = r.code === 0 ? r.out.split(/\r?\n/).pop() : null;
  }
  const ff = quiet('ffmpeg', ['-version']);
  const gpuR = quiet('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']);
  const gpu = gpuR.code === 0 && gpuR.out ? { found: true, name: gpuR.out.split(',')[0].trim(), vramMB: Number(gpuR.out.split(',')[1]) || null } : { found: false };
  const cfg = readJson(CONFIG_PATH);
  const voiceHome = path.resolve(process.env.VIDEO_STUDIO_VOICE_DIR || cfg?.voices?.dir || STUDIO);
  const venv = (e) => path.join(voiceHome, `.venv-${e}`, IS_WIN ? 'Scripts\\python.exe' : 'bin/python');
  const snaps = path.join(voiceHome, '.models', 'hf', 'hub', 'models--ResembleAI--chatterbox', 'snapshots');
  const kokoroFiles = ['kokoro-v1.0.onnx', 'voices-v1.0.bin'].every((f) => exists(path.join(voiceHome, '.models', 'kokoro', f)));
  let chatterboxModel = false;
  try {
    chatterboxModel = fs.readdirSync(snaps).some((d) => exists(path.join(snaps, d, 's3gen.pt')));
  } catch {}
  const turboSnaps = path.join(voiceHome, '.models', 'hf', 'hub', 'models--ResembleAI--chatterbox-turbo', 'snapshots');
  let turboModel = false;
  try {
    turboModel = fs.readdirSync(turboSnaps).some((d) => exists(path.join(turboSnaps, d, 't3_turbo_v1.safetensors')));
  } catch {}
  return {
    os: { platform: process.platform, arch: process.arch, release: os.release() },
    node: { version: process.versions.node, ok: nodeMajor >= 20 },
    packageManagers: pm,
    ffmpeg: { onPath: ff.code === 0, version: ff.code === 0 ? ff.out.split(/\r?\n/)[0] : null },
    browsers: browserCandidates().filter(([, p]) => exists(p)).map(([name, p]) => ({ name, path: p })),
    pythons: detectPythons(),
    gpu,
    disk: { repoFreeGB: freeGB(ROOT), outputFreeGB: freeGB(DEFAULT_OUTPUT) },
    state: {
      depsInstalled: exists(path.join(STUDIO, 'node_modules', 'tsx')),
      configExists: !!cfg,
      kokoroInstalled: exists(venv('kokoro')) && kokoroFiles,
      chatterboxInstalled: exists(venv('chatterbox')) && chatterboxModel,
      turboInstalled: exists(venv('chatterbox')) && turboModel,
      privateBrowser: exists(cfg?.browser?.path) && cfg?.browser?.mode === 'private',
      voiceHome,
    },
    config: cfg,
    defaults: { outputDir: DEFAULT_OUTPUT, voiceDir: STUDIO },
    sizesMB: SIZE,
  };
}

// ------------------------------------------------------------------------------------------------------------------
// prompts (zero dependencies; also work with piped input, which is how the wizard is tested)
// ------------------------------------------------------------------------------------------------------------------
let rl;
let lines;
function input() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, terminal: false });
    lines = rl[Symbol.asyncIterator]();
  }
  return lines;
}
async function readLine(prompt) {
  process.stdout.write(prompt);
  const { value, done } = await input().next();
  if (done) throw new Error('The input ended before every question was answered. Run it in a terminal, or use --answers <file> (see node setup.mjs --help).');
  if (!process.stdin.isTTY) process.stdout.write(`${value}\n`);
  return String(value).trim();
}
async function select(title, options, { def = 0, help } = {}) {
  for (;;) {
    console.log(`\n${bold(title)}`);
    options.forEach((o, i) => {
      console.log(`  ${cyan(String(i + 1) + ')')} ${o.label}${o.recommended ? green('  (recommended)') : ''}`);
      if (o.hint) console.log(`     ${dim(o.hint)}`);
    });
    const a = await readLine(`Choose 1-${options.length}${help ? ', ? for help' : ''} [${def + 1}]: `);
    if (a === '') return options[def].value;
    if (a === '?' && help) {
      console.log(`\n${help}`);
      continue;
    }
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    console.log(yellow('  Please type one of the numbers.'));
  }
}
async function multi(title, options) {
  for (;;) {
    console.log(`\n${bold(title)}`);
    options.forEach((o, i) => {
      console.log(`  ${cyan(String(i + 1) + ')')} ${o.label}${o.note ? dim('  ' + o.note) : ''}`);
      if (o.hint) console.log(`     ${dim(o.hint)}`);
    });
    const a = (await readLine('Type the numbers you want, separated by commas (or press Enter for none): ')).toLowerCase();
    if (a === '' || a === 'none') return [];
    if (a === 'all') return options.map((o) => o.value);
    const picks = a.split(/[,\s]+/).filter(Boolean).map(Number);
    if (picks.every((n) => Number.isInteger(n) && n >= 1 && n <= options.length)) return [...new Set(picks)].map((n) => options[n - 1].value);
    console.log(yellow('  Please type numbers from the list, like: 1,3'));
  }
}
async function confirm(title, def = false) {
  const a = (await readLine(`${bold(title)} ${dim(def ? '[Y/n]' : '[y/N]')} `)).toLowerCase();
  return a === '' ? def : a.startsWith('y');
}
async function text(title, def = '') {
  const a = await readLine(`${bold(title)}${def ? dim(` [${def}]`) : ''}: `);
  return a === '' ? def : a;
}

// ------------------------------------------------------------------------------------------------------------------
// the questions
// ------------------------------------------------------------------------------------------------------------------
function showDetection(d) {
  const ok = (b) => (b ? green('yes') : yellow('no'));
  console.log(`\n${bold('What I found on this machine')}`);
  console.log(`  System          ${d.os.platform} ${d.os.arch}`);
  console.log(`  Node.js         ${d.node.version} ${d.node.ok ? green('(ok)') : red('(too old: 20 or newer is needed)')}`);
  console.log(`  Package managers ${Object.entries(d.packageManagers).map(([k, v]) => `${k} ${v ?? dim('not found')}`).join('   ')}`);
  console.log(`  ffmpeg on PATH  ${d.ffmpeg.onPath ? green(d.ffmpeg.version?.slice(0, 40)) : yellow('not found')}`);
  console.log(`  Chrome / Edge   ${d.browsers.length ? green(d.browsers.map((b) => b.name).join(', ')) : yellow('not found')}`);
  console.log(`  Python          ${d.pythons.length ? d.pythons.map((p) => `${p.version}${p.supported ? '' : dim(' (unsupported)')}`).join(', ') : yellow('not found')}`);
  console.log(`  NVIDIA GPU      ${d.gpu.found ? green(`${d.gpu.name}${d.gpu.vramMB ? `, ${Math.round(d.gpu.vramMB / 1024)} GB` : ''}`) : yellow('none found')}`);
  console.log(`  Already set up  deps ${ok(d.state.depsInstalled)}   Kokoro ${ok(d.state.kokoroInstalled)}   Chatterbox ${ok(d.state.chatterboxInstalled)}   Turbo ${ok(d.state.turboInstalled)}   private Chrome ${ok(d.state.privateBrowser)}`);
}

async function askAll(d, prior = {}) {
  const a = {};
  console.log(`\n${bold('You decide what gets downloaded or installed.')} Nothing happens until you confirm the plan at the end, and every option shows its size.`);

  // 1. core -------------------------------------------------------------------------------
  const havePm = Object.entries(d.packageManagers).filter(([, v]) => v).map(([k]) => k);
  const coreOpts = d.state.depsInstalled
    ? [
        { value: 'keep', label: 'Keep the packages that are already installed', recommended: true },
        { value: 'reinstall', label: `Reinstall them from scratch (about ${fmtMB(SIZE.deps.dl)})`, hint: 'Removes studio/node_modules first. Useful if something is broken.' },
        { value: 'skip', label: 'Do nothing for packages' },
      ]
    : [
        { value: 'yes', label: `Install the studio's packages now (about ${fmtMB(SIZE.deps.dl)}${d.ffmpeg.onPath ? '' : ' + ffmpeg below'})`, recommended: true, hint: 'three.js, puppeteer-core, esbuild, the free voice library, zod, tsx. Installed into studio/node_modules only.' },
        { value: 'skip', label: 'Skip: I will run "npm install" in studio/ myself' },
      ];
  const core = await select('1. The studio\'s code packages (needed to make any video)', coreOpts);
  a.core = { install: core, packageManager: 'npm' };
  if (core === 'yes' || core === 'reinstall') {
    if (havePm.length > 1) a.core.packageManager = await select('   Which package manager?', havePm.map((p) => ({ value: p, label: `${p} ${d.packageManagers[p]}`, recommended: p === 'npm' })));
    else a.core.packageManager = havePm[0] ?? 'npm';
  }

  // 2. ffmpeg -----------------------------------------------------------------------------
  const ffOpts = [];
  if (d.ffmpeg.onPath) ffOpts.push({ value: 'system', label: 'Use the ffmpeg already on my PATH', recommended: true, hint: `${d.ffmpeg.version?.slice(0, 60)}. Skips an ${fmtMB(SIZE.ffmpeg.dl)} download.` });
  ffOpts.push({ value: 'bundled', label: `Download ffmpeg through npm (ffmpeg-static, ${fmtMB(SIZE.ffmpeg.dl)})`, recommended: !d.ffmpeg.onPath, hint: 'A GPL-3.0 binary that lives in studio/node_modules. Fine for personal use; check the licence before redistributing.' });
  ffOpts.push({ value: 'custom', label: 'Use an ffmpeg at a path I will give you' });
  ffOpts.push({ value: 'skip', label: 'Decide later (videos cannot be rendered until ffmpeg exists)' });
  const ff = await select('2. ffmpeg (joins the picture and the sound into the video)', ffOpts);
  a.ffmpeg = { mode: ff };
  if (ff === 'custom') a.ffmpeg.path = await text('   Full path to the ffmpeg program');

  // 3. browser ----------------------------------------------------------------------------
  const brOpts = [];
  if (d.browsers.length) brOpts.push({ value: 'system', label: `Use the ${d.browsers[0].name} that is installed`, recommended: true, hint: d.browsers[0].path });
  brOpts.push({ value: 'private', label: `Download a private Chrome for Testing (about ${fmtMB(SIZE.chrome.dl)}, ${fmtMB(SIZE.chrome.disk)} on disk)`, recommended: !d.browsers.length, hint: 'Isolated in studio/.browsers, never touches your own browser. Good for CI or a machine without Chrome.' });
  brOpts.push({ value: 'custom', label: 'Use a Chromium-based browser at a path I will give you' });
  brOpts.push({ value: 'skip', label: 'Decide later (rendering needs Chrome or Edge)' });
  const br = await select('3. A browser (draws the 3D scenes, invisibly)', brOpts);
  a.browser = { mode: br };
  if (br === 'custom') a.browser.path = await text('   Full path to the browser program');

  // 4. voices -----------------------------------------------------------------------------
  console.log(`\n${bold('4. Voices')}`);
  console.log(`   ${green('Always available, nothing to install:')} the free Microsoft Edge voices (need internet) and, on Windows, the offline Windows voice.`);
  const needsGpu = !d.gpu.found;
  const picks = await multi('   Which LOCAL voice engines do you want installed? (better quality, work offline)', [
    { value: 'kokoro', label: `Kokoro: natural, calm voices. About ${fmtMB(SIZE.kokoro.dl)} download, ${fmtMB(SIZE.kokoro.disk)} on disk`, hint: 'Needs Python 3.10-3.13. No GPU needed. English, Hindi and 6 other languages.' },
    { value: 'chatterbox', label: `Chatterbox: the most expressive. About ${fmtMB(SIZE.chatterbox.dl)} download, ${fmtMB(SIZE.chatterbox.disk)} on disk`, hint: needsGpu ? yellow('No NVIDIA GPU found on this machine: it would not run. Not recommended here.') : 'Needs an NVIDIA GPU and Python (3.11 recommended). 23 languages including Hindi.' },
    { value: 'turbo', label: `Chatterbox Turbo (optional add-on): English only, can [laugh], [sigh] and [chuckle]. About ${fmtMB(SIZE.turbo.dl)} more`, hint: needsGpu ? yellow('Needs an NVIDIA GPU, like Chatterbox.') : 'Shares the Chatterbox environment (Chatterbox is added if you pick this). Off unless you choose it.' },
  ]);
  a.voices = { kokoro: picks.includes('kokoro'), chatterbox: picks.includes('chatterbox') || (picks.includes('turbo') && !d.state.chatterboxInstalled), turbo: picks.includes('turbo'), speechCheck: true, dir: '', python: '' };
  if (a.voices.turbo && !picks.includes('chatterbox') && !d.state.chatterboxInstalled) console.log(`   ${dim('Turbo runs inside the Chatterbox environment, so Chatterbox is added to the plan.')}`);
  if (a.voices.chatterbox) {
    a.voices.speechCheck = await confirm(`   Add the speech check for Chatterbox (a Whisper model, about ${fmtMB(SIZE.whisper.dl)})? It listens to each line and retries bad takes. Strongly advised.`, true);
  }
  if (a.voices.kokoro || a.voices.chatterbox || a.voices.turbo) {
    const dirChoice = await select('   Where should the voice models and Python environments be stored?', [
      { value: 'repo', label: `Inside the repo, in studio/ (git-ignored)`, recommended: true, hint: `Free space on this drive: ${d.disk.repoFreeGB ? d.disk.repoFreeGB.toFixed(0) + ' GB' : 'unknown'}` },
      { value: 'custom', label: 'In a folder I choose (another drive, a data disk)' },
    ]);
    if (dirChoice === 'custom') {
      a.voices.dir = path.resolve(await text('   Folder path'));
      const fg = freeGB(a.voices.dir);
      if (fg !== null) console.log(`   ${dim(`Free space there: ${fg.toFixed(0)} GB`)}`);
    }
    const sup = d.pythons.filter((p) => p.supported);
    const pyOpts = sup.map((p) => ({ value: p.exe, label: `Python ${p.version}`, hint: p.exe, recommended: p.recommended || sup.length === 1 }));
    pyOpts.push({ value: '__custom', label: 'A Python at a path I will give you' });
    pyOpts.push({ value: '__skip', label: 'Skip the local voices (I will install Python later)' });
    const py = await select('   Which Python should the voice engines use?', pyOpts, {
      help: IS_WIN ? 'Install Python 3.11 from python.org or run: winget install Python.Python.3.11' : process.platform === 'darwin' ? 'Install Python 3.11 with: brew install python@3.11' : 'Install Python 3.11 with your package manager, for example: sudo apt install python3.11 python3.11-venv',
    });
    if (py === '__skip') a.voices.kokoro = a.voices.chatterbox = a.voices.turbo = false;
    else a.voices.python = py === '__custom' ? await text('   Full path to the Python program') : py;
  }

  // 5. output -----------------------------------------------------------------------------
  const out = await select('5. Where should finished videos be saved?', [
    { value: 'default', label: DEFAULT_OUTPUT, recommended: true },
    { value: 'repo', label: `Inside the repo: ${path.join(STUDIO, 'output')} (git-ignored)` },
    { value: 'custom', label: 'A folder I choose' },
  ]);
  a.outputDir = out === 'default' ? '' : out === 'repo' ? path.join(STUDIO, 'output') : path.resolve(await text('   Folder path'));

  // 6. verify -----------------------------------------------------------------------------
  a.verify = await select('6. After installing, how much should I check that it works?', [
    { value: 'check', label: 'A quick health check of the voices (a few seconds)', recommended: true },
    { value: 'sample', label: 'Build the small sample video (about 30 seconds; uses the Edge voices, needs internet)' },
    { value: 'demo', label: 'Build the full voice demo (8 videos, about 10 minutes; uses every engine you installed)' },
    { value: 'none', label: 'Nothing, I will check myself' },
  ]);
  return a;
}

// ------------------------------------------------------------------------------------------------------------------
// answers -> plan -> steps
// ------------------------------------------------------------------------------------------------------------------
const ENUMS = {
  'core.install': ['yes', 'keep', 'reinstall', 'skip'],
  'core.packageManager': ['npm', 'pnpm', 'yarn'],
  'ffmpeg.mode': ['bundled', 'system', 'custom', 'skip'],
  'browser.mode': ['system', 'private', 'custom', 'skip'],
  verify: ['none', 'check', 'sample', 'demo'],
};
function normalize(raw) {
  const a = {
    core: { install: 'skip', packageManager: 'npm', ...(raw.core ?? {}) },
    ffmpeg: { mode: 'skip', path: '', ...(raw.ffmpeg ?? {}) },
    browser: { mode: 'skip', path: '', ...(raw.browser ?? {}) },
    voices: { kokoro: false, chatterbox: false, turbo: false, speechCheck: true, dir: '', python: '', ...(raw.voices ?? {}) },
    outputDir: raw.outputDir ?? '',
    verify: raw.verify ?? 'none',
  };
  const bad = [];
  const get = (k) => k.split('.').reduce((o, p) => o?.[p], a);
  for (const [k, vals] of Object.entries(ENUMS)) if (!vals.includes(get(k))) bad.push(`${k} must be one of: ${vals.join(', ')} (got "${get(k)}")`);
  if (a.ffmpeg.mode === 'custom' && !exists(a.ffmpeg.path)) bad.push(`ffmpeg.path does not exist: "${a.ffmpeg.path}"`);
  if (a.browser.mode === 'custom' && !exists(a.browser.path)) bad.push(`browser.path does not exist: "${a.browser.path}"`);
  if (a.voices.python && !exists(a.voices.python) && quiet(a.voices.python, ['--version']).code !== 0) bad.push(`voices.python does not run: "${a.voices.python}"`);
  if (bad.length) throw new Error(`The answers are not valid:\n  - ${bad.join('\n  - ')}`);
  return a;
}

function makePlan(a, d) {
  const steps = [];
  const voicesWanted = a.voices.kokoro || a.voices.chatterbox || a.voices.turbo;
  const sys = a.ffmpeg.mode === 'system' || a.ffmpeg.mode === 'custom';
  steps.push({ id: 'config', title: 'Save your choices to studio/.studio-setup.json', dl: 0, disk: 0 });
  if (a.core.install === 'yes' || a.core.install === 'reinstall') {
    const ffExtra = a.ffmpeg.mode === 'bundled' ? SIZE.ffmpeg.dl : 0;
    steps.push({ id: 'core', title: `${a.core.install === 'reinstall' ? 'Reinstall' : 'Install'} the studio packages with ${a.core.packageManager}${sys ? ' (without the bundled ffmpeg download)' : a.ffmpeg.mode === 'bundled' ? ' (including the ffmpeg download)' : ''}`, dl: SIZE.deps.dl + ffExtra, disk: SIZE.deps.disk + ffExtra, critical: true });
  }
  if (a.browser.mode === 'private') steps.push({ id: 'browser', title: 'Download a private Chrome for Testing into studio/.browsers', dl: SIZE.chrome.dl, disk: SIZE.chrome.disk });
  if (voicesWanted) {
    const where = a.voices.dir || STUDIO;
    if (a.voices.kokoro && !d.state.kokoroInstalled) steps.push({ id: 'kokoro', title: `Install Kokoro voices (Python environment + model) in ${where}`, dl: SIZE.kokoro.dl, disk: SIZE.kokoro.disk });
    if (a.voices.chatterbox && !d.state.chatterboxInstalled) {
      steps.push({ id: 'chatterbox', title: `Install Chatterbox (PyTorch with CUDA + model${a.voices.speechCheck ? ' + Whisper speech check' : ''}) in ${where}`, dl: SIZE.chatterbox.dl + (a.voices.speechCheck ? SIZE.whisper.dl : 0), disk: SIZE.chatterbox.disk + (a.voices.speechCheck ? SIZE.whisper.disk : 0) });
    }
    if (a.voices.turbo && !d.state.turboInstalled) steps.push({ id: 'turbo', title: `Download the Chatterbox Turbo model (English, performs [laugh] / [sigh] tags) into ${where}`, dl: SIZE.turbo.dl, disk: SIZE.turbo.disk });
    for (const e of ['kokoro', 'chatterbox']) if (a.voices[e] && d.state[`${e}Installed`]) steps.push({ id: `have-${e}`, title: `${e === 'kokoro' ? 'Kokoro' : 'Chatterbox'} is already installed: keep it`, dl: 0, disk: 0, info: true });
  }
  if (a.verify !== 'none') steps.push({ id: 'verify', title: { check: 'Run the voice health check', sample: 'Build the small sample video', demo: 'Build the full voice demo (8 videos)' }[a.verify], dl: 0, disk: 0 });
  return steps;
}

function printPlan(steps, a, d) {
  console.log(`\n${bold('The plan')}`);
  let dl = 0;
  let disk = 0;
  steps.forEach((s, i) => {
    dl += s.dl;
    disk += s.disk;
    console.log(`  ${i + 1}. ${s.title}${s.dl ? dim(`   download ~${fmtMB(s.dl)}, on disk ~${fmtMB(s.disk)}`) : ''}`);
  });
  console.log(`\n  ${bold('Total')}: download about ${bold(fmtMB(dl))}, space used about ${bold(fmtMB(disk))}.`);
  const target = a.voices.dir || STUDIO;
  const free = freeGB(target);
  if (free !== null && disk / 1000 > free * 0.9) console.log(red(`  Warning: only ${free.toFixed(1)} GB free where this goes.`));
  const notes = [];
  if (a.core.install === 'skip' && !d.state.depsInstalled) notes.push('The packages are not installed: run "npm install" in studio/ before anything else.');
  if (a.ffmpeg.mode === 'skip' && !d.ffmpeg.onPath) notes.push('No ffmpeg was chosen or found: install one before rendering.');
  if (a.browser.mode === 'skip' && !d.browsers.length) notes.push('No browser was chosen or found: install Chrome or Edge before rendering.');
  if ((a.voices.kokoro || a.voices.chatterbox || a.voices.turbo) && a.core.install === 'skip' && !d.state.depsInstalled) notes.push('The voice setup needs the studio packages first.');
  for (const n of notes) console.log(yellow(`  Note: ${n}`));
  console.log(dim(`  Nothing outside the repo is touched except: ${[a.voices.dir && `the voice folder ${a.voices.dir}`, a.outputDir !== '' && `the video folder ${a.outputDir}`].filter(Boolean).join(', ') || 'the output folder when you render videos'}.`));
  return { dl, disk };
}

function writeConfig(a) {
  const prev = readJson(CONFIG_PATH) ?? {};
  const cfg = {
    version: 1,
    ...prev,
    packageManager: a.core.packageManager,
    ffmpeg: a.ffmpeg.mode === 'skip' ? prev.ffmpeg : { mode: a.ffmpeg.mode, ...(a.ffmpeg.path ? { path: a.ffmpeg.path } : {}) },
    browser: a.browser.mode === 'skip' ? prev.browser : a.browser.mode === 'system' ? { mode: 'system' } : { mode: a.browser.mode, ...(a.browser.path ? { path: a.browser.path } : prev.browser?.path ? { path: prev.browser.path } : {}) },
    voices: { ...prev.voices, kokoro: a.voices.kokoro || prev.voices?.kokoro || false, chatterbox: a.voices.chatterbox || prev.voices?.chatterbox || false, turbo: a.voices.turbo || prev.voices?.turbo || false, speechCheck: a.voices.speechCheck, ...(a.voices.dir ? { dir: a.voices.dir } : {}), ...(a.voices.python ? { python: a.voices.python } : {}) },
    ...(a.outputDir ? { outputDir: a.outputDir } : prev.outputDir ? { outputDir: prev.outputDir } : {}),
    createdAt: prev.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

const tsx = () => path.join(STUDIO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const studioRun = (script, args = [], opts = {}) => run(process.execPath, [tsx(), path.join('scripts', script), ...args], { cwd: STUDIO, ...opts });

const STEP_RUN = {
  async config(a) {
    writeConfig(a);
    return 'saved';
  },
  async core(a) {
    if (a.core.install === 'reinstall') fs.rmSync(path.join(STUDIO, 'node_modules'), { recursive: true, force: true });
    const sys = a.ffmpeg.mode === 'system' || a.ffmpeg.mode === 'custom';
    const pm = a.core.packageManager;
    const args = pm === 'npm' ? ['install', '--no-audit', '--no-fund'] : ['install'];
    if (sys) args.push('--ignore-scripts'); // skips the ffmpeg-static download (and nothing else the studio needs)
    const r = await run(pm, args, { cwd: STUDIO });
    if (r.code !== 0) throw new Error(`${pm} install failed (exit ${r.code})`);
    if (!exists(tsx())) throw new Error('the packages installed but tsx is missing');
    return 'installed';
  },
  async browser() {
    if (!exists(tsx())) throw new Error('needs the studio packages first');
    let exe = '';
    const r = await studioRun('install-browser.ts', [], { onLine: (l) => { console.log(l); if (l.startsWith('EXECUTABLE ')) exe = l.slice(11).trim(); } });
    if (r.code !== 0 || !exe) throw new Error('the Chrome download failed');
    const cfg = readJson(CONFIG_PATH) ?? {};
    cfg.browser = { mode: 'private', path: exe };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
    return exe;
  },
  async kokoro() {
    if (!exists(tsx())) throw new Error('needs the studio packages first');
    const r = await studioRun('voices-setup.ts', ['--only', 'kokoro']);
    if (r.code !== 0) throw new Error('the Kokoro setup reported problems (see above)');
    return 'installed';
  },
  async chatterbox() {
    if (!exists(tsx())) throw new Error('needs the studio packages first');
    const r = await studioRun('voices-setup.ts', ['--only', 'chatterbox']);
    if (r.code !== 0) throw new Error('the Chatterbox setup reported problems (see above)');
    return 'installed';
  },
  async turbo() {
    if (!exists(tsx())) throw new Error('needs the studio packages first');
    const r = await studioRun('voices-setup.ts', ['--only', 'turbo']);
    if (r.code !== 0) throw new Error('the Turbo setup reported problems (see above)');
    return 'installed';
  },
  async verify(a) {
    return verifyLevel(a.verify);
  },
};

async function verifyLevel(level) {
  if (!exists(tsx())) throw new Error('the studio packages are not installed');
  if (level === 'check') {
    const r = await studioRun('voices-check.ts');
    if (r.code !== 0) throw new Error('the health check found no working voice engine');
    return 'voices ok';
  }
  if (level === 'sample') {
    const r = await studioRun('build.ts', ['example-small-change', '--no-stills']);
    if (r.code !== 0) throw new Error('the sample video did not build');
    return 'sample built';
  }
  if (level === 'demo') {
    const r = await studioRun('demo.ts');
    if (r.code !== 0) throw new Error('the demo did not finish');
    return 'demo built';
  }
  return 'skipped';
}

async function execute(steps, a, { interactive }) {
  const results = [];
  for (const s of steps) {
    if (s.info) {
      results.push({ s, status: 'kept' });
      continue;
    }
    for (let attempt = 1; ; attempt++) {
      console.log(`\n${bold(`> ${s.title}`)}`);
      try {
        const note = await STEP_RUN[s.id](a);
        console.log(green(`  done: ${note}`));
        results.push({ s, status: 'ok', note });
        break;
      } catch (e) {
        console.log(red(`  failed: ${e.message}`));
        if (interactive) {
          const c = await select('  What now?', [
            { value: 'retry', label: 'Try this step again' },
            { value: 'skip', label: 'Skip it and continue' },
            { value: 'stop', label: 'Stop here' },
          ]);
          if (c === 'retry') continue;
          if (c === 'stop') {
            results.push({ s, status: 'failed', note: e.message });
            return results;
          }
        }
        results.push({ s, status: 'failed', note: e.message });
        if (s.critical) return results;
        break;
      }
    }
  }
  return results;
}

function summary(results, a) {
  console.log(`\n${bold('Summary')}`);
  for (const r of results) console.log(`  ${r.status === 'ok' || r.status === 'kept' ? green('✓') : red('✗')} ${r.s.title}${r.status === 'failed' ? red(`  (${r.note})`) : ''}`);
  const bad = results.filter((r) => r.status === 'failed');
  console.log(`\n${bold('Next')}`);
  console.log(`  Make a video with Claude Code:  open Claude Code in this folder and type  ${cyan('/video-studio <your story idea>')}`);
  console.log(`  Or from the terminal:           ${cyan('cd studio && npm run build -- the-3am-deploy')}`);
  console.log(`  See what is installed:          ${cyan('node setup.mjs --status')}      Remove something: ${cyan('node setup.mjs --remove <target>')}`);
  if (bad.length) console.log(yellow(`\n  ${bad.length} step(s) did not finish. Re-run ${cyan('node setup.mjs')}: it skips what is already done.`));
  return bad.length ? 1 : 0;
}

// ------------------------------------------------------------------------------------------------------------------
// status / remove
// ------------------------------------------------------------------------------------------------------------------
function status(asJson) {
  const d = detect();
  const home = d.state.voiceHome;
  const items = [
    ['Studio packages (studio/node_modules)', path.join(STUDIO, 'node_modules'), d.state.depsInstalled],
    ['Kokoro environment', path.join(home, '.venv-kokoro'), exists(path.join(home, '.venv-kokoro'))],
    ['Chatterbox environment', path.join(home, '.venv-chatterbox'), exists(path.join(home, '.venv-chatterbox'))],
    ['Voice models (Kokoro files, Hugging Face cache)', path.join(home, '.models'), exists(path.join(home, '.models'))],
    ['Private Chrome (studio/.browsers)', path.join(STUDIO, '.browsers'), exists(path.join(STUDIO, '.browsers'))],
    ['Voice and render cache (studio/.cache)', path.join(STUDIO, '.cache'), exists(path.join(STUDIO, '.cache'))],
  ].map(([name, p, present]) => ({ name, path: p, present, mb: present ? Math.round(dirSize(p)) : 0 }));
  if (asJson) return console.log(JSON.stringify({ detect: d, items }, null, 2));
  showDetection(d);
  console.log(`\n${bold('Installed things and their size')}`);
  for (const i of items) console.log(`  ${i.present ? green('●') : dim('○')} ${i.name.padEnd(48)} ${i.present ? fmtMB(i.mb).padStart(8) : dim('not installed'.padStart(13))}  ${dim(i.present ? i.path : '')}`);
  const cfg = d.config;
  console.log(`\n${bold('Your saved choices')} ${dim(CONFIG_PATH)}`);
  console.log(cfg ? JSON.stringify(cfg, null, 2).split('\n').map((l) => `  ${l}`).join('\n') : dim('  none yet: run node setup.mjs'));
}

async function remove(target) {
  const d = detect();
  const home = d.state.voiceHome;
  const map = {
    kokoro: [path.join(home, '.venv-kokoro'), path.join(home, '.models', 'kokoro')],
    chatterbox: [path.join(home, '.venv-chatterbox'), path.join(home, '.models', 'hf')],
    turbo: [path.join(home, '.models', 'hf', 'hub', 'models--ResembleAI--chatterbox-turbo')],
    'voice-models': [path.join(home, '.models')],
    'all-voices': [path.join(home, '.venv-kokoro'), path.join(home, '.venv-chatterbox'), path.join(home, '.models'), path.join(STUDIO, 'voice', '.status.json')],
    browser: [path.join(STUDIO, '.browsers')],
    deps: [path.join(STUDIO, 'node_modules')],
    config: [CONFIG_PATH],
  };
  if (!map[target]) throw new Error(`Unknown target "${target}". Choose: ${Object.keys(map).join(', ')}`);
  const paths = map[target].filter(exists);
  if (!paths.length) return console.log('Nothing to remove: it is not installed.');
  const mb = paths.reduce((n, p) => n + dirSize(p), 0);
  console.log(`\nThis will delete:\n${paths.map((p) => `  ${p}`).join('\n')}\nIt frees about ${fmtMB(mb)}. Your stories, videos and code are not touched.`);
  if (target === 'chatterbox') console.log(dim('  (the shared voice-model cache also holds the Whisper checker; it is downloaded again if you reinstall)'));
  if (flag('dry-run')) return console.log(dim('(dry run: nothing deleted)'));
  if (!flag('force') && !(await confirm('Delete it?', false))) return console.log('Cancelled.');
  for (const p of paths) fs.rmSync(p, { recursive: true, force: true });
  const cfg = readJson(CONFIG_PATH);
  if (cfg && target !== 'config') {
    if (target === 'browser' && cfg.browser?.mode === 'private') delete cfg.browser;
    if (target === 'kokoro') cfg.voices = { ...cfg.voices, kokoro: false };
    if (target === 'chatterbox') cfg.voices = { ...cfg.voices, chatterbox: false, turbo: false };
    if (target === 'turbo') cfg.voices = { ...cfg.voices, turbo: false };
    if (target === 'all-voices') cfg.voices = { ...cfg.voices, kokoro: false, chatterbox: false, turbo: false };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
  }
  console.log(green('Removed.'));
}

// ------------------------------------------------------------------------------------------------------------------
// main
// ------------------------------------------------------------------------------------------------------------------
const HELP = `video-super-power setup. Nothing is downloaded or installed unless you choose it.

  node setup.mjs                          interactive wizard (the normal way)
  node setup.mjs --detect                 machine report as JSON
  node setup.mjs --status [--json]        what is installed, where, how big
  node setup.mjs --plan  --answers FILE   show what an answers file would do (changes nothing)
  node setup.mjs --apply --answers FILE   run an answers file without questions
  node setup.mjs --apply --yes            smallest safe setup: npm packages only, no big downloads
  node setup.mjs --verify [--level check|sample|demo]
  node setup.mjs --remove TARGET [--force]   TARGET: kokoro | chatterbox | turbo | voice-models | all-voices | browser | deps | config
  --dry-run   print instead of doing         --no-color

Answers file (JSON, every key optional; a missing key means "do nothing for that"):
  { "core": {"install": "yes|keep|reinstall|skip", "packageManager": "npm|pnpm|yarn"},
    "ffmpeg": {"mode": "bundled|system|custom|skip", "path": ""},
    "browser": {"mode": "system|private|custom|skip", "path": ""},
    "voices": {"kokoro": false, "chatterbox": false, "turbo": false, "speechCheck": true, "dir": "", "python": ""},
    "outputDir": "", "verify": "none|check|sample|demo" }
Full guide: docs/SETUP.md`;

async function main() {
  if (flag('help') || flag('h')) return console.log(HELP);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    console.error(`Node.js 20 or newer is needed (you have ${process.versions.node}). Install it from https://nodejs.org, then run this again.`);
    return 1;
  }
  if (flag('detect')) return console.log(JSON.stringify(detect(), null, 2));
  if (flag('status')) return status(flag('json'));
  if (flag('remove')) return remove(opt('remove'));
  if (flag('verify')) {
    const r = await verifyLevel(opt('level') ?? 'check');
    console.log(green(r));
    return 0;
  }

  const d = detect();
  const fromFile = opt('answers');

  if (flag('plan') || flag('apply')) {
    let raw;
    if (fromFile) raw = readJson(path.resolve(fromFile)) ?? (() => { throw new Error(`Cannot read the answers file: ${fromFile}`); })();
    else if (flag('yes')) {
      raw = { core: { install: d.state.depsInstalled ? 'keep' : 'yes' }, ffmpeg: { mode: d.ffmpeg.onPath ? 'system' : 'bundled' }, browser: { mode: d.browsers.length ? 'system' : 'skip' }, verify: 'check' };
    } else throw new Error('Give --answers <file> (or --yes for the smallest safe setup). See --help.');
    const a = normalize(raw);
    const steps = makePlan(a, d);
    printPlan(steps, a, d);
    if (flag('plan') || flag('dry-run')) return console.log(dim('\n(nothing was changed)'));
    return summary(await execute(steps, a, { interactive: false }), a);
  }

  // interactive wizard
  console.log(`${bold('video-super-power setup')}\n${dim('Press Ctrl+C at any time to stop. Nothing is changed until you confirm the plan.')}`);
  showDetection(d);
  if (!d.node.ok) return 1;
  let a = fromFile ? normalize(readJson(path.resolve(fromFile)) ?? {}) : normalize(await askAll(d));
  for (;;) {
    const steps = makePlan(a, d);
    printPlan(steps, a, d);
    const go = await select('Go ahead?', [
      { value: 'go', label: 'Yes, do exactly this', recommended: true },
      { value: 'change', label: 'Let me change my answers' },
      { value: 'save', label: 'Save these answers to a file and stop (for later, or for a teammate)' },
      { value: 'cancel', label: 'Cancel: change nothing' },
    ]);
    if (go === 'cancel') return console.log('Cancelled. Nothing was changed.');
    if (go === 'change') {
      a = normalize(await askAll(d));
      continue;
    }
    if (go === 'save') {
      const p = path.join(STUDIO, '.studio-setup.answers.json');
      fs.writeFileSync(p, JSON.stringify(a, null, 2) + '\n');
      return console.log(green(`Saved to ${p}\nRun it later with: node setup.mjs --apply --answers "${p}"`));
    }
    return summary(await execute(steps, a, { interactive: true }), a);
  }
}

main()
  .then((code) => {
    rl?.close();
    process.exitCode = typeof code === 'number' ? code : 0;
  })
  .catch((e) => {
    rl?.close();
    console.error(red(`\n${e.message}`));
    process.exitCode = 1;
  });
