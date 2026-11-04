# Setup guide

How to get this repo running on your machine. **You choose everything that gets downloaded or installed**, and you see the size first. Nothing happens without your yes.

## The 30-second version

```
node setup.mjs            # any OS      (or  .\setup.cmd  /  .\setup.ps1  on Windows,  bash setup.sh  on macOS and Linux)
```

Or, in Claude Code, open this folder and type `/setup-video-studio`. It asks the same questions as multiple-choice, shows the plan, then runs the same script.

You need **Node.js 20 or newer** to start (the wizard itself has no dependencies, so it runs on a fresh clone). Get it from https://nodejs.org (`winget install OpenJS.NodeJS.LTS` on Windows, `brew install node` on macOS).

## What the wizard asks

It first looks at your machine (Node, package managers, ffmpeg, Chrome or Edge, Python, NVIDIA GPU, free disk, what is already installed) and tells you. Then six questions. For each one you pick a number; the recommended choice is marked, and you can always choose to skip and decide later.

| # | Question | Your options | Size |
|---|---|---|---|
| 1 | The studio's code packages | install now (npm, pnpm or yarn, whichever you have) · keep what is there · reinstall from scratch · skip and run `npm install` yourself | about 110 MB |
| 2 | ffmpeg | use the one on your PATH · download one through npm (ffmpeg-static) · use one at a path you give · decide later | 0 or 83 MB |
| 3 | A browser (draws the 3D scenes, invisibly) | use your installed Chrome or Edge · download a private Chrome for Testing · use another Chromium at a path you give · decide later | 0 or about 210 MB |
| 4 | Voices | Always free with nothing to install: Microsoft Edge voices (internet) and the offline Windows voice. Optional local engines, pick any: **Kokoro** (natural, calm, no GPU) and **Chatterbox** (most expressive, NVIDIA GPU). For Chatterbox also: the **speech check** (Whisper, about 1 GB), where the models and Python environments live (inside the repo or a folder or drive you choose), and which Python to use | Kokoro about 350 MB (510 MB on disk) · Chatterbox about 5.8 GB (8.4 GB on disk) · speech check about 1 GB |
| 5 | Where finished videos are saved | your Videos folder · inside the repo (`studio/output`) · a folder you choose | |
| 6 | How much to check afterwards | a quick voice health check · build the small sample video (about 30 s) · build the full voice demo (8 videos, about 10 min) · nothing | |

Then it prints **the plan**: every step, the total download and the space it will use, and a warning if the disk is too small. You answer *go ahead*, *let me change my answers*, *save these answers to a file and stop*, or *cancel*. Only on *go ahead* does it change anything.

If a step fails (a network drop, say), it offers *try again*, *skip*, or *stop*. Every step can be re-run safely: finished work is skipped.

## Things worth knowing

- **Local voice engines are optional.** Without them everything works, using the free Edge voices (they need internet) or the offline Windows voice. They make calmer, more emotional speech and work offline.
- **Chatterbox needs an NVIDIA GPU.** The wizard says so if it does not see one. Kokoro does not need a GPU.
- **Python** (3.10 to 3.13, 3.11 recommended) is only needed for Kokoro and Chatterbox. The wizard never installs Python for you; it tells you how to, and you decide.
- **Where things go.** Packages: `studio/node_modules`. Private Chrome: `studio/.browsers`. Voice environments and models: `studio/.venv-*` and `studio/.models`, or the folder you chose. Your choices: `studio/.studio-setup.json`. All of these are git-ignored. Finished videos go to the folder you chose.
- **What leaves your computer.** Setup downloads from npm, GitHub, Hugging Face and the Chrome for Testing servers. When making videos, only the dialogue text goes to Microsoft (for the Edge voices); Kokoro, Chatterbox and the offline voice stay entirely local.

## Without the questions (scripts, CI, teammates)

Save an answers file (the wizard offers this: *save these answers and stop*), or write one by hand. Every key is optional, and a missing key means *do nothing for that*.

```json
{
  "core":    { "install": "yes", "packageManager": "npm" },
  "ffmpeg":  { "mode": "system" },
  "browser": { "mode": "system" },
  "voices":  { "kokoro": true, "chatterbox": false, "speechCheck": true, "dir": "", "python": "" },
  "outputDir": "",
  "verify": "check"
}
```

```
node setup.mjs --plan  --answers my-answers.json    # shows exactly what it would do, changes nothing
node setup.mjs --apply --answers my-answers.json    # does it, no questions
node setup.mjs --apply --yes                        # the smallest safe setup: packages only, no big downloads
```

Allowed values: `core.install` yes / keep / reinstall / skip · `core.packageManager` npm / pnpm / yarn · `ffmpeg.mode` and `browser.mode` as in the table above (`custom` also needs `path`) · `verify` none / check / sample / demo. Anything else is rejected with a clear message before anything runs.

## Seeing, changing and removing things

```
node setup.mjs --status                 # what is installed, where, how big, and your saved choices
node setup.mjs                          # run it again to change your choices; finished steps are skipped
node setup.mjs --remove kokoro          # kokoro | chatterbox | voice-models | all-voices | browser | deps | config
node setup.mjs --remove chatterbox --dry-run     # shows what would be deleted and how much space it frees
```

Removing asks for confirmation (`--force` skips the question). Your stories, videos and code are never touched. Everything can be installed again later.

## Overrides (environment variables)

They win over the saved choices: `FFMPEG_PATH`, `CHROME_PATH`, `VIDEO_STUDIO_VOICE_DIR`, `VIDEO_STUDIO_OUTPUT_DIR`, `VIDEO_STUDIO_NO_VERIFY=1` (switch off Chatterbox's speech check).

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Node.js 20 or newer is needed" | Install it from https://nodejs.org and run setup again |
| The wizard says "The input ended before every question was answered" | It needs a terminal. Run it in one, or use `--answers <file>` |
| "No Chrome/Edge found" when rendering | Re-run `node setup.mjs` and choose the private Chrome download, or install Chrome |
| "ffmpeg not found" | Re-run setup and choose the npm download, or install ffmpeg and choose "use the one on my PATH" |
| A voice engine step failed | Re-run `node setup.mjs`: it picks up where it stopped. `cd studio && npm run voices:check` shows what works |
| Not enough disk space | Choose a folder on another drive for the voice models, or skip Chatterbox (Kokoro is about 0.5 GB) |
| I want my disk space back | `node setup.mjs --remove all-voices` (about 10 GB with both engines) |
