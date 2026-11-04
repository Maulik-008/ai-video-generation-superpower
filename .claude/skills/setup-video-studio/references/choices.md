# Every setup choice

What `setup.mjs` can install or configure, what each choice means, and what it costs. Sizes are measured on a real install and are approximate.

**The rule:** nothing is downloaded or installed unless it was chosen. Anything not in the answers file is left alone.

## The choices

| Area | Choice | What it does | Download / on disk |
|---|---|---|---|
| **Packages** | `core.install`: `yes` / `keep` / `reinstall` / `skip` | Installs `studio/node_modules` (three.js, puppeteer-core, esbuild, the Edge voice library, zod, tsx, typescript). `reinstall` deletes `node_modules` first | about 110 MB |
| | `core.packageManager`: `npm` / `pnpm` / `yarn` | Which package manager runs the install. Any that is installed can be used | |
| **ffmpeg** | `ffmpeg.mode`: `system` | Use the `ffmpeg` already on PATH. Installs packages with `--ignore-scripts` so the 83 MB binary is **not** downloaded | 0 |
| | `bundled` | npm downloads `ffmpeg-static` (a GPL-3.0 binary, fine for personal use; check the licence before redistributing it) | 83 MB |
| | `custom` (+ `path`) | Use an ffmpeg at a path you give. Also skips the download | 0 |
| | `skip` | Decide later. Videos cannot render until ffmpeg exists | 0 |
| **Browser** | `browser.mode`: `system` | Use the installed Chrome or Edge (found automatically) | 0 |
| | `private` | Downloads a private Chrome for Testing into `studio/.browsers` using `@puppeteer/browsers`. Never touches your own browser | about 210 MB / 450 MB |
| | `custom` (+ `path`) | Any Chromium-based browser at a path you give | 0 |
| | `skip` | Decide later | 0 |
| **Voices** | always available | The free Microsoft Edge voices (internet needed) and, on Windows, the offline Windows voice. Nothing to install | 0 |
| | `voices.kokoro` | Kokoro: natural, calm voices. Python environment + model. No GPU needed. 54 voices, 8 languages including Hindi | about 350 MB / 510 MB |
| | `voices.chatterbox` | Chatterbox: the most expressive, 23 languages including Hindi. PyTorch with CUDA + model. **Needs an NVIDIA GPU** | about 5.8 GB / 8.4 GB |
| | `voices.turbo` | Chatterbox Turbo, an optional add-on: English only, the most natural, and it performs `[laugh]` `[sigh]` `[chuckle]` tags in a script. Shares the Chatterbox environment (Chatterbox is added to the plan if it is missing). **Off unless chosen** | about 4.0 GB / 4.1 GB |
| | `voices.speechCheck` | Whisper (about 1 GB) lets Chatterbox listen to each line and retry bad takes. Only matters with Chatterbox. On by default | about 1 GB |
| | `voices.dir` | Where the `.venv-*` environments and `.models` live. Empty = inside `studio/`. Use another drive for the big downloads | |
| | `voices.python` | Which Python (3.10 to 3.13, 3.11 recommended) creates the environments. Empty = detect | |
| **Output** | `outputDir` | Where finished videos are copied. Empty = `~/Videos/VideoStudio` | |
| **Verify** | `verify`: `none` / `check` / `sample` / `demo` | After installing: nothing, a voice health check (seconds), build the small sample video (about 30 s, Edge voices, internet), or the full 8-video voice demo (about 10 min) | |

## Answers file

JSON, saved by the skill as `studio/.studio-setup.answers.json` (git-ignored). Every key is optional.

```json
{
  "core":    { "install": "yes", "packageManager": "npm" },
  "ffmpeg":  { "mode": "bundled" },
  "browser": { "mode": "system" },
  "voices":  { "kokoro": true, "chatterbox": false, "turbo": false, "speechCheck": true, "dir": "", "python": "" },
  "outputDir": "",
  "verify": "check"
}
```

Run it: `node setup.mjs --plan --answers <file>` (shows the plan, changes nothing), then `node setup.mjs --apply --answers <file>`.

The choices are remembered in `studio/.studio-setup.json` (git-ignored). The studio reads it: the ffmpeg to use, the browser, where the voice models are, where videos go, whether the speech check is on. Environment variables override it: `FFMPEG_PATH`, `CHROME_PATH`, `VIDEO_STUDIO_VOICE_DIR`, `VIDEO_STUDIO_OUTPUT_DIR`, `VIDEO_STUDIO_NO_VERIFY=1`.

## Commands

| Command | Does |
|---|---|
| `node setup.mjs` | The interactive wizard |
| `node setup.mjs --detect` | Machine report (JSON) |
| `node setup.mjs --status [--json]` | What is installed, where, how big, and the saved choices |
| `node setup.mjs --plan --answers FILE` | Show what an answers file would do |
| `node setup.mjs --apply --answers FILE` | Do it, without questions |
| `node setup.mjs --apply --yes` | The smallest safe setup: packages only, no big downloads |
| `node setup.mjs --verify --level check\|sample\|demo` | Check that it works |
| `node setup.mjs --remove TARGET [--force]` | Delete something it installed: `kokoro`, `chatterbox`, `turbo`, `voice-models`, `all-voices`, `browser`, `deps`, `config`. `--dry-run` shows what would go and how much space it frees |

## If something is missing

| Missing | What to tell the developer |
|---|---|
| Node.js 20+ | Install from https://nodejs.org (`winget install OpenJS.NodeJS.LTS` on Windows, `brew install node` on macOS, or nvm / fnm). Setup cannot run without it |
| Python 3.10 to 3.13 | Only needed for Kokoro and Chatterbox. 3.11 is recommended. Windows: `winget install Python.Python.3.11`; macOS: `brew install python@3.11`; Linux: `sudo apt install python3.11 python3.11-venv` |
| NVIDIA GPU | Chatterbox needs one. Kokoro and the Edge voices do not |
| Chrome / Edge | Install either, or choose the private Chrome download |
| ffmpeg | Choose the npm download, or install ffmpeg yourself and choose "use the one on my PATH" |
