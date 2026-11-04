---
name: setup-video-studio
description: First-time setup of the video studio for a developer who just cloned this repo. Detects the machine (Node, ffmpeg, Chrome/Edge, Python, NVIDIA GPU, disk), asks the developer every choice as multiple-choice (packages, ffmpeg, browser, local voice engines Kokoro and Chatterbox, where models live, where videos are saved, how much to verify), shows a plan with download sizes, and only then installs exactly what was chosen. Nothing is downloaded or installed without an explicit yes. Use when the user says "/setup-video-studio", "set up", "install", "first time setup", "get started with this repo", "install the voices", "download Kokoro or Chatterbox", "change my setup", "remove the voice models", or when /video-studio fails because studio/node_modules, Chrome, ffmpeg or a voice engine is missing.
argument-hint: [status | change | remove <kokoro|chatterbox|voice-models|all-voices|browser|deps|config>]
---

# Setup: the first-run guide

You help a developer set this repo up on their own machine. The one rule: **nothing is downloaded or installed unless the developer chose it, after seeing what it is and how big it is.** Ask every choice, even when detection makes one obvious (show it as "(recommended)", never apply it silently). Never install system software yourself (Node.js, Python, Chrome, ffmpeg, drivers): if one is missing, say how the developer can install it and let them decide.

All the work is done by `setup.mjs` at the repo root. You are the friendly front end: you ask the questions with `AskUserQuestion`, write an answers file, and run the script. The same script also works by hand (`node setup.mjs`), so everything you do can be repeated without you.

Details of every choice, its size and the answers-file format: [references/choices.md](references/choices.md). Read it before your first question.

## If the argument is not a first-time setup

- `status`: run `node setup.mjs --status` and explain what is installed, where, and how big.
- `remove <target>`: run `node setup.mjs --remove <target> --dry-run` and show what would be deleted and how much space it frees; ask the developer to confirm; then run it again with `--force`.
- `change`: treat as a normal setup, but start from what `--status` shows, and remember the answers file only changes what the developer selects.

## 1. Look at the machine (changes nothing)

Run from the repo root: `node setup.mjs --detect`. If `node` itself is not found, stop and tell the developer to install Node.js 20 or newer (https://nodejs.org), and offer to continue afterwards. From the JSON note: Node version, which package managers exist (`packageManagers`), `ffmpeg.onPath`, `browsers`, `pythons` (and which are `supported`: 3.10 to 3.13, 3.11 recommended), `gpu`, free disk, and what is already installed (`state`). Tell the developer in two or three lines what you found.

## 2. Ask, with all the options

Use `AskUserQuestion`. At most 4 questions per call, 2 to 4 options each, a short `header` (max 12 characters), the recommended option first with "(Recommended)" and its size in the description. The tool adds "Other" so the developer can type a path. Skip a question only when it cannot apply (for example, do not ask about Python or storage if they chose no local voices). Offer **every** option listed here.

**Round 1: the basics**

| Header | Question | Options |
|---|---|---|
| Packages | Install the studio's code packages (about 110 MB, into `studio/node_modules` only)? | If not installed: *Install with npm (Recommended)* · *Install with pnpm / yarn* (only if detected) · *Skip, I will run `npm install` myself*. If installed: *Keep what is installed (Recommended)* · *Reinstall from scratch* · *Do nothing* |
| ffmpeg | Which ffmpeg joins picture and sound into the video? | *Use the ffmpeg on my PATH (Recommended, skips an 83 MB download)* (only if `ffmpeg.onPath`) · *Download one through npm (ffmpeg-static, 83 MB, GPL-3.0 binary)* (Recommended if none on PATH) · *Use an ffmpeg at a path I give (Other)* · *Decide later* |
| Browser | Which browser draws the 3D scenes (invisibly)? | *Use the installed Chrome / Edge (Recommended)* (only if found) · *Download a private Chrome for Testing (about 210 MB, 450 MB on disk, isolated in `studio/.browsers`)* · *Use a Chromium at a path I give (Other)* · *Decide later* |
| Videos | Where should finished videos be saved? | *The default Videos folder* (`defaults.outputDir`) · *Inside the repo, `studio/output` (git-ignored)* · *A folder I choose (Other)* |

**Round 2: voices.** Say first: "Always available with nothing to install: the free Microsoft Edge voices (need internet) and, on Windows, the offline Windows voice. These two engines are optional upgrades that run on your machine."

| Header | Question | Options |
|---|---|---|
| Local voices | Install local voice engines (better quality, work offline)? | *Kokoro + Chatterbox* (about 6 GB download, 9 GB on disk; needs an NVIDIA GPU for Chatterbox and Python) · *Kokoro only (about 350 MB, no GPU needed)* · *Chatterbox only (about 5.8 GB, NVIDIA GPU)* · *None, use the Edge voices only*. Mark the best fit for this machine "(Recommended)": with no GPU that is Kokoro only; with a GPU and plenty of disk it is Kokoro + Chatterbox. Warn plainly if there is no NVIDIA GPU and they pick Chatterbox |
| Speech check | Add the speech check for Chatterbox (a Whisper model, about 1 GB)? | *Yes (Recommended)*: it listens to each generated line and retries bad takes · *No, skip the 1 GB download*: less reliable on very short lines (only ask if Chatterbox was chosen) |
| Storage | Where should the voice models and Python environments live? | *Inside the repo, `studio/` (git-ignored) (Recommended)* · *A folder I choose, such as another drive (Other)* (only if a local engine was chosen; mention the free space from `disk`) |
| Python | Which Python should the voice engines use? | One option per supported Python from `pythons` (3.11 first, "(Recommended)") · *A Python at a path I give (Other)* · *Skip the local voices, I will install Python later* (only if a local engine was chosen; if none is supported, offer the install hint for their OS and *Skip*) |

**Round 3: how much to check**

| Header | Question | Options |
|---|---|---|
| Verify | After installing, how much should I check that it works? | *A quick voice health check, a few seconds (Recommended)* · *Build the small sample video, about 30 s (uses Edge voices, needs internet)* · *Build the full voice demo, 8 videos, about 10 min* · *Nothing* |

## 3. Show the plan, get one more yes

Write the answers to `studio/.studio-setup.answers.json` (shape in the reference; leave out anything they did not choose, a missing key means "do nothing"). Run `node setup.mjs --plan --answers studio/.studio-setup.answers.json` and show its output: every step, the total download and the space used. Then ask one last `AskUserQuestion`: *Go ahead with exactly this (Recommended)* · *Let me change something* (go back to the relevant round) · *Save the answers and stop (a teammate or I can run it later)* · *Cancel, change nothing*. Only on "Go ahead" continue.

## 4. Do it

Run `node setup.mjs --apply --answers studio/.studio-setup.answers.json`. Large steps (Chatterbox is several GB and can take 10 to 30 minutes) run in the background (`run_in_background`); you are notified when it finishes, so do not poll. Tell the developer what is happening and roughly how long it will take. Each step is repeatable, so if something fails (a network drop), tell them exactly which step failed and re-run the same command: finished steps are skipped.

Never use `--yes` unless the developer asked for "the minimal setup" (that is packages only, no big downloads).

## 5. Check and hand over

Run `node setup.mjs --status` and `node setup.mjs --verify --level check`. Report in plain words: what is installed and where, what is not, anything that failed and the one thing to do about it. End with how to start: `/video-studio <story idea>` in Claude Code, or `cd studio && npm run build -- the-3am-deploy`. Mention how to see, change or remove things later: `node setup.mjs --status`, `node setup.mjs` again, `node setup.mjs --remove <target>`.

## Rules

- Ask before every download or install. Show the size. Respect "no" and "later" without nagging.
- Install nothing outside the repo except where the developer chose a folder. Never touch their system Python, Node, Chrome or drivers.
- Never ask for, print or store passwords or tokens. None are needed.
- If detection and the developer disagree, the developer wins.
- If the machine cannot run something (no NVIDIA GPU for Chatterbox, no supported Python), say so honestly, recommend the alternative, and still let them choose.
