# video-super-power

**Tell Claude a story. Get back an animated video with voices.**

Describe any story, topic or script. Claude asks a few multiple-choice questions, brainstorms three different angles for you to pick from, writes the script, and a worker agent renders the finished MP4: soft "clay toy" 3D characters at 60 fps with glossy eyes, soft shadows and depth of field that talk with lip-sync, bold word-by-word captions, camera cuts and transitions, sound effects, and a voice for every character. A critic agent then reviews the video before you get it. It runs on your own machine with free tools. No accounts, no paid APIs.

```
You:  /video-studio a developer asks an AI not to deploy at 3 a.m. (it finds a loophole)
Claude (director):  asks length / tone / world / cast ─► brainstorms 3 concepts ─► you pick one
                    ─► writes the script ─► you confirm once
video-producer (agent):  voices ─► word timing ─► 60 fps 3D render ─► mix ─► QA ─► MP4
video-critic (agent):    contact sheet + frames at every cut ─► ranked fixes ─► one polish round
```

**Four video types, one entry point.** `/video-studio` first asks what you want to make and offers to show finished sample videos of every type: an **animated story** with talking characters (`studio` engine), a narrated **explainer short** from a topic in one of six styles (`explainer` engine), an **edit of your own recording** with cuts and motion graphics (`editor` engine), or a **cinematic AI reel** through your own Gemini/Flow account (`browser` engine). Watch them first: open [samples/index.html](samples/index.html) (list in [samples/README.md](samples/README.md)). Details of each type: [docs/SKILL_TYPES.md](docs/SKILL_TYPES.md).

A 30-second vertical video renders in about 40 seconds on a machine with a GPU, plus the time to make any new voices. The whole flow, with a live test, is in [docs/WORKFLOW.md](docs/WORKFLOW.md).

---

## Quick start

### 1. First-time setup: you choose what gets installed

You only need **Node.js 20+**. Then run the setup wizard from the repo root:

```
node setup.mjs        # any OS.  Also: .\setup.cmd or .\setup.ps1 on Windows, bash setup.sh on macOS and Linux
```

Or, in Claude Code, open this folder and type `/setup-video-studio`: it asks the same questions as multiple-choice.

**Nothing is downloaded or installed unless you choose it, and you see the size first.** The wizard looks at your machine, asks one question at a time, shows a plan with the total download and disk use, and only then acts:

| You choose | Options |
|---|---|
| Code packages (about 110 MB) | install with npm / pnpm / yarn · keep · reinstall · skip |
| ffmpeg | use yours · download one (83 MB) · a path you give · later |
| Browser | your Chrome or Edge · a private Chrome download (about 210 MB) · a path you give · later |
| Local voices (optional) | Kokoro (about 350 MB) · Chatterbox (about 5.8 GB, NVIDIA GPU) · both · none; plus the Whisper speech check (1 GB), which drive or folder they live in, and which Python |
| Where videos are saved | your Videos folder · inside the repo · a folder you choose |
| How much to verify | health check · sample video · full voice demo · nothing |

Without the local voices everything still works, using the free Microsoft Edge voices. Full guide, every option, scripted and CI use, and how to see or remove things: [docs/SETUP.md](docs/SETUP.md).

Tested on Windows 11 with an NVIDIA GPU. The macOS and Linux paths are coded but not tested, and the offline Windows voice is Windows-only.

### 2. Make a video

**With Claude (recommended).** Start Claude Code in this folder, so it picks up the skill and the agent, and describe what you want:

```
/video-studio a robot and a kid argue about whether homework is a good idea
/video-studio explain how a VPN works, funny, 30 seconds
/video-studio <paste a script or an article>
```

Say "show me samples" to see every video type first, or "surprise me" to skip the questions. Options: `--type story|explainer|edit|reel`, `--length 20|35|60`, `--res 720p|1080p`, `--provider auto|edge|sapi`.

```
/video-studio what happens if you swallow gum?                 (explainer short)
/video-studio edit my video D:\clips\intro.mp4                  (editor)
```

**Without Claude.** Build one of the included stories, or your own:

```
cd studio
npm run build -- the-3am-deploy
```

The video is saved to the folder you chose in setup (by default `%USERPROFILE%\Videos\VideoStudio\<slug>.mp4`, `~/Videos/VideoStudio` on macOS and Linux). The working files (script, voices, preview frames) stay in `studio/projects/<slug>/`, so changes re-render in about 30 seconds and unchanged voices are reused.

### 3. Better voices (optional, free, local)

The setup wizard offers these. You can also add them later with the wizard, or directly (about 7 GB for both, into git-ignored folders):

```
cd studio
npm run voices:setup      # Kokoro + Chatterbox (own Python environments, models downloaded once)
npm run voices:check      # a real English + Hindi test sentence through every engine
npm run demo              # the same story voiced four ways, to compare by ear
```

Details in [Better voices](#better-voices-calm-warm-emotional) below.

---

## How it works

| Stage | Who | What happens |
|---|---|---|
| 1. Understand | director | Reads what you already said (premise, tone, length, language) so it never re-asks |
| 2. Ask | director | Multiple-choice questions for only what is missing, at most two rounds |
| 3. Brainstorm | director | Three genuinely different concepts shown side by side; you pick one |
| 4. Script | director | Full shot list and dialogue; one confirmation covers the whole build |
| 5. Build | `video-producer` agent | Validates the story, makes the voices, renders, runs QA, looks at the contact sheet and preview frames, fixes technical problems (camera, cast, timing) and checks the MP4 |
| 6. Review | `video-critic` agent | Watches the result with fresh eyes against [the quality bar](.claude/skills/video-studio/references/quality.md) and returns ranked fixes; the director applies the technical ones in one polish round |
| 7. Iterate | director | Offers quick tweaks: a line, a voice, a set, the ending, 1080p |

Only the director talks to you, because only the main conversation can ask questions. The agent never changes the story; it fixes technical problems only.

Under the hood the studio engine turns `story.json` into a video like this:

```
story.json ─► validate ─► voices (best local or free engine per character ─► WAV, checked, levelled)
           ─► word timing (Whisper timestamps matched onto the script)
           ─► timeline.json (frames, caption groups, mouth + width tracks, transitions, effects, room tone)
           ─► three.js scene in headless Chrome, 6 parallel browsers, 60 fps, springs for every motion
           ─► ffmpeg: video + mixed audio (speech at -16 LUFS, effects, room tone, music ducked, limiter) ─► MP4
           ─► QA: picture, loudness, pacing, captions, contact sheet, transcript of the final mix
```

---

## Writing a story

A story is one file, `studio/projects/<slug>/story.json`: characters and shots. The smallest useful one:

```json
{
  "title": "Tiny Favour",
  "slug": "tiny-favour",
  "characters": [
    { "id": "dev",  "name": "Dev",  "kind": "human", "pose": "sit", "voice": { "edge": "en-US-AndrewNeural" } },
    { "id": "bolt", "name": "Bolt", "kind": "cube",  "voice": { "edge": "en-US-AriaNeural", "pitch": "-8Hz" } }
  ],
  "shots": [
    { "id": "s01", "set": "skyline-night", "camera": { "type": "two-shot", "move": "push-in" },
      "lines": [{ "speaker": "dev", "text": "Bolt. Promise me. No deploys at three a.m.", "emotion": "worried", "action": "lean-in" }] },
    { "id": "s02", "camera": { "type": "close", "focus": "bolt" },
      "lines": [{ "speaker": "bolt", "text": "Of course. That would be reckless.", "emotion": "smug" }] }
  ]
}
```

The full contract (every field, the voice table, camera guide and the writing rules that make a story good) is in [formats/story.md](.claude/skills/video-studio/formats/story.md). The schema's source of truth is [studio/src/types.ts](studio/src/types.ts), and `npm run validate -- <slug>` explains any mistake in plain words.

### Example stories included

| Project | Shows | Length |
|---|---|---|
| `battery-low` | The showcase: a person, a robot vacuum and a cat-blob, two sets, every transition, punch-ins, effects, Chatterbox voices | 28.1 s |
| `the-3am-deploy` | Developer + cube AI, night rooftop, laptop-screen insert, a twist ending | 26.5 s |
| `example-small-change` | The same pair with a title card and every shot type | 30.5 s |
| `hindi-chai` | Hindi voices and Devanagari captions, a person and a blob | 15.8 s |
| `_gallery` | A silent test of all six sets and the three character types (a visual check, not a story) | |

---

## Better voices (calm, warm, emotional)

Every character picks a voice **engine** and a **delivery** in `story.json`:

```json
"voice": { "engine": "auto", "delivery": "calm", "edge": "en-US-AvaMultilingualNeural", "kokoro": "af_heart" }
```

| Engine | Good for | Needs |
|---|---|---|
| `chatterbox` | The most expressive: reacts to the emotion of each line, 23 languages including Hindi, a distinct voice per character | NVIDIA GPU, about 7 GB (`voices:setup`) |
| `kokoro` | Natural, steady, fast on a CPU, 54 voices in 8 languages including Hindi. A good calm narrator | about 0.35 GB (`voices:setup`) |
| `turbo` | Optional. Chatterbox Turbo: English only, the most natural, and the one engine that performs `[laugh]` `[sigh]` `[chuckle]` written into a line (other engines skip the tags) | about 4 GB more, on top of Chatterbox (`npm run voices:setup -- --only turbo`, or pick it in setup) |
| `edge` | The default. Free Microsoft voices, 300+ of them including Gujarati. The `…MultilingualNeural` English voices sound the most natural | internet |
| `sapi` | Windows' built-in voice, offline, robotic. Last resort | Windows |

| Delivery | What changes |
|---|---|
| `natural` (default) | Exactly what earlier versions did, so existing stories sound the same |
| `warm` | Slightly slower, a short pause between longer sentences, the emotion of each line shapes the delivery, warm mastering |
| `calm` | Slower again, longer pauses, softer pitch. For heartfelt, apology, comfort and bedtime stories |

`engine: auto` uses the best engine that passed `npm run voices:check` (turbo for English, then chatterbox, kokoro, edge, offline). **It is built to always produce a video:** each character has a chain of fallbacks, a missing or failing engine is skipped with the reason in the log and in `projects/<slug>/voices-report.json`, every generated clip is checked for silence, clipping and implausible length before it is used, and finished lines are cached so re-runs start no engine at all. A character always has one engine per video, never half and half.

**Chatterbox checks its own work.** Generated speech can occasionally mumble, invent extra words or skip a very short line (testing found exactly this in Hindi). So after every clip Chatterbox transcribes what it said with Whisper (a 1 GB model, installed by `voices:setup`), compares it with the intended text, and retries with a different take up to three times. A line that still does not match fails, and that character moves to the next engine. Set `VIDEO_STUDIO_NO_VERIFY=1` to switch the check off. Lines of one or two words ("Thanks.") are the hardest for it: where you can, make them a little longer.

Measured on the demo story: natural Edge speaks at about 3.2 words per second, `calm` Edge about 2.8, `calm` Kokoro about 2.4, `warm` about 2.9 to 3.0. The finished demo videos were transcribed back with Whisper: English says the whole script (similarity 0.98 to 1.0). Hindi scores about 0.95 to 0.96 for Edge and Kokoro, which is Whisper's own noise level on Hindi. That shows the speech is intelligible, not how pleasant it sounds: that is for your ears, which is what `npm run demo` is for.

---

## What the studio engine can make

| | |
|---|---|
| **Characters** | `human` (5 hair styles, sits or stands), `cube` (robot, AI, any object), `blob` (pet, creature, mascot). Up to 5 per video, each with their own colours, scale and voice |
| **Sets** | `skyline-night`, `space-stage`, `cozy-room`, `office-day`, `sunny-park`, `studio` |
| **Acting** | 10 emotions, 8 gestures (eased, with anticipation and follow-through), gestures that follow the speech in phrases, springy expressions, irregular blinks, eye darts, and a mouth that opens and widens with the speech |
| **Camera** | wide, two-shot, medium, close, over-the-shoulder, low, high, laptop-screen insert, with slow push-ins, pull-outs, drifts, orbits and a springy `punch-in` |
| **Transitions** | cut, crossfade, dip to black, whip pan with motion blur, zoom blur |
| **Captions** | bold, word by word, the spoken word lit in the speaker's colour, timed by Whisper; or classic phrases; any script your system fonts have (Hindi tested) |
| **Sound** | Five voice engines with automatic fallback (above); 300+ Edge voices including Gujarati, 54 Kokoro voices, 23 Chatterbox languages; calm / warm delivery; sound effects and a room tone per set, made by ffmpeg; optional background music from a file you supply, quietened under speech |
| **Look** | `soft` (default): rounded, glossy "clay toy" characters, soft shadows, studio reflections, depth of field and bloom; or `lowpoly`, the faceted look. Emotions add sweat drops, tears and blush |
| **Picture** | vertical 9:16 (default), square or landscape; 720p or 1080p; 60 fps (or 30); a poster frame for the thumbnail |

**Not supported:** crowds, vehicles, realistic animals, composed music. The director reshapes ideas to fit what the engine can draw.

---

## Commands

Run from `studio/`. `<slug>` is a folder name under `studio/projects/`.

| Command | Does |
|---|---|
| `npm run validate -- <slug>` | Checks `story.json` |
| `npm run tts -- <slug>` | Makes the voices and `timeline.json` |
| `npm run preview -- <slug>` | One still frame per shot in `out/stills/` (`--shots s01,s03`, `--frames 120,400`) |
| `npm run render -- <slug>` | Renders `out/<slug>.mp4` |
| `npm run build -- <slug>` | All of the above, then QA, then copies the MP4 to your Videos folder |
| `npm run stitch -- <folder>` | Joins generated scenes (Veo/Grok clips, or stills with slow camera moves) from a `kahani` plan into one reel: labels, POV title, handle, end card, music ducked under the dialogue, -14 LUFS |
| `npm run qa -- <slug>` | Checks the finished video (picture, loudness, pacing, captions) and writes a contact sheet; `--listen` also transcribes the final mix and compares it with the script |
| `node setup.mjs` (repo root) | The first-time setup wizard; also `--status`, `--plan`, `--apply`, `--verify`, `--remove` (see [docs/SETUP.md](docs/SETUP.md)) |
| `npm run voices:setup` | Installs the Kokoro and Chatterbox voice engines (`-- --only kokoro` for one) |
| `npm run voices:check` | Makes a real test sentence with every engine and records which are ready |
| `npm run demo` | Builds the voice demo (English and Hindi, four voice variants) into `Videos\VideoStudio\voice-demo\` |
| `npm run typecheck` | Type-checks the engine |

Flags: `--provider auto|edge|kokoro|chatterbox|turbo|sapi` (default `auto` = whatever each character has in the story; another value forces that engine for everyone, still with fallback), `--delivery natural|warm|calm`, `--res 720p|1080p`, `--fps 30|60`, `--workers N`, `--no-stills`, `--keep-frames`, `--no-qa`, `--listen`. `preview` and `render` rebuild the timeline automatically when `story.json` is newer than it.

---

## Repository layout

```
.claude/
  skills/video-studio/
    SKILL.md                 the director: understand, ask, brainstorm, script, build, iterate
    references/brainstorm.md the question bank and how to brainstorm three concepts
    references/quality.md    the quality bar: engagement, motion, captions, sound (used by all three roles)
    formats/story.md         the story.json contract and the writing rules
    formats/talkstuff.md     the Pixar-style talking-object format (browser engine)
    engines/studio.md        commands and the worker runbook for the studio engine
    engines/browser.md       the older Gemini + Flow/Grok route
  agents/video-producer.md   the worker agent (build, QA, technical fixes)
  agents/video-critic.md     the reviewer agent (fresh eyes, ranked fixes, never edits)
studio/
  src/types.ts               the story schema
  src/engine/                characters, sets, camera, emotions, the world renderer
  src/player/index.html      the page that is captured frame by frame
  scripts/                   validate, tts, preview, render, build, demo, voices-setup, voices-check (+ lib/)
  scripts/lib/voices/        the voice engines, delivery presets, fallback chains, quality checks
  voice/                     Python workers for Kokoro and Chatterbox / Turbo, the Whisper checker and word aligner
  .venv-*/ .models/          the local engines and their models (git-ignored)
  projects/<slug>/           story.json (yours), audio/, out/ (generated, not committed)
docs/WORKFLOW.md             the whole flow, director to critic, with a live test
docs/TOOLING_RESEARCH.md     the 14 tools reviewed (HyperFrames, Chatterbox, Whisper, GSAP, Remotion...) and what was adopted
docs/BUILD_LOG.md            how all of this was built, stage by stage, with token usage
```

---

## Extending it

| You want | Do this |
|---|---|
| A new kind of video | Add a file to `.claude/skills/video-studio/formats/` |
| A new place | Add a function to `studio/src/engine/sets.ts` and the name to `SETS` in `types.ts` |
| A new character type | Add a builder to `studio/src/engine/characters.ts` and the name to `KINDS` |
| A different voice engine | Add an entry to `studio/scripts/lib/voices/engines.ts` (it turns sentences into 24 kHz mono audio and returns an `Error` instead of throwing), then add its name to `ENGINES` in `types.ts` and to the chains in `bank.ts` |
| A new sound effect | Add its name to `SFX` in `types.ts` and an ffmpeg recipe plus a gain to `studio/scripts/lib/sfx.ts` |
| A new transition | Add its name to `TRANSITIONS` in `types.ts`, a length and mode in `src/engine/world.ts`, and a branch in the compositing shader there |

---

## The browser engine: cinematic AI reels

For the photoreal Pixar-style look of the popular Hindi and Urdu story reels (talking vegetables in a village, organs in a "body factory", fables with a Part 2, 2D POV nostalgia), use `--engine browser --format kahani`. Claude writes a character bible and an 8-second beat sheet with the dialogue; your own Gemini and Google Flow (Veo 3) make the images and voiced clips; `npm run stitch` assembles the reel locally. It costs about 20 Flow credits per scene, or none with `--motion kenburns` (stills with camera moves). How the reference reels were made, and why: [docs/REFERENCE_ANALYSIS.md](docs/REFERENCE_ANALYSIS.md). The format: [formats/kahani.md](.claude/skills/video-studio/formats/kahani.md).

### The older talking-object route

`--engine browser` drives **your own Chrome** through ChatGPT's TalkStuff GPT, Gemini images and Google Flow or Grok Imagine to make short photoreal-style talking-object clips (format `talkstuff`). It uses your logged-in accounts and generation credits, so it is not the default. It needs the Claude in Chrome extension connected, with `chatgpt.com`, `gemini.google.com`, `flow.google.com` / `labs.google` and `grok.com` allowed and signed in. The TalkStuff GPT is retired on 2026-12-11; after that the format switches to `--writer claude`. Details: [engines/browser.md](.claude/skills/video-studio/engines/browser.md).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No Chrome/Edge found` | Install Google Chrome, or set `CHROME_PATH` to a Chromium-based browser |
| `edge-tts failed after 3 attempts` | No internet or the service is blocked: retry later, or add `--provider sapi` (Windows) |
| `INVALID story.json` | Read the listed field paths; each message names the field |
| Very slow render | WebGL is running on the CPU. Use a machine with a GPU, `--workers 2`, or `--res 720p` |
| A character is cut off in a close-up | Use `medium` for that shot, or lower the character's `scale` |
| Two voices sound alike | Change `voice.edge` (and `voice.kokoro`), then push `rate` and `pitch` apart |
| `using edge instead of chatterbox` (or similar) | An engine was missing or failed; the reason is in the log and in `voices-report.json`. Run `npm run voices:check`, and `npm run voices:setup` if it says not installed |
| Everything sounds fast, not calm | Set `delivery: calm` on the characters, or build with `--delivery calm` |
| Chatterbox says no CUDA GPU | It needs an NVIDIA GPU; characters use Kokoro or Edge instead |
| `/video-studio` or the agent is not found | Start a new Claude Code session in this folder; new skill and agent files are only picked up at session start |

---

## Privacy and licences

- **What leaves your computer:** with the Edge voices, only the dialogue text, sent to Microsoft's free text-to-speech service. Kokoro, Chatterbox and the offline Windows voice run entirely on your machine (use `--provider kokoro` for a fully local video). Rendering, scripts and files always stay on your machine. The one-time setup downloads models from GitHub and Hugging Face.
- **Licences:** the studio engine uses permissively licensed tools: three.js (MIT), puppeteer-core (Apache-2.0), esbuild (MIT), msedge-tts (MIT), zod (MIT). Kokoro (Apache-2.0), Chatterbox and Chatterbox Turbo (MIT) and Whisper (MIT) are free for company use. Sound effects and room tone are synthesised by ffmpeg, so there are no sample licences. GSAP was not used (its licence is not open source); the engine has its own easing and spring functions. Why each of the 14 tools in the "better AI videos" list was adopted, borrowed from or skipped: [docs/TOOLING_RESEARCH.md](docs/TOOLING_RESEARCH.md). Every Chatterbox clip carries an imperceptible watermark from its maker, which this tool does not remove. PyTorch is BSD-licensed. Voices are not cloned from real people: Chatterbox characters get their voice from a short reference clip generated by Kokoro or Edge, never from a recording of a person. The ffmpeg binary installed by `ffmpeg-static` is GPL-3.0, which only matters if you redistribute it. Remotion was deliberately **not** used: its licence requires a paid company licence for organisations with more than three people.
- **Content:** the director is instructed not to write hateful, harassing or misleading content, or to invent facts about real people or companies.

---

## More

- [docs/BUILD_LOG.md](docs/BUILD_LOG.md): how this was developed, stage by stage, with the prompts, agents and token usage.
- [studio/src/types.ts](studio/src/types.ts): the story schema, the single source of truth.
