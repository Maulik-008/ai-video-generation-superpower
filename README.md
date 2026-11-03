# video-super-power

**Tell Claude a story. Get back an animated video with voices.**

Describe any story, topic or script. Claude asks a few multiple-choice questions, brainstorms three different angles for you to pick from, writes the script, and a worker agent renders the finished MP4: low-poly 3D characters that talk with lip-sync, captions, camera cuts and a voice for every character. It runs on your own machine with free tools. No accounts, no paid APIs.

```
You:  /video-studio a developer asks an AI not to deploy at 3 a.m. (it finds a loophole)
Claude (director):  asks length / tone / world / cast ─► brainstorms 3 concepts ─► you pick one
                    ─► writes the script ─► you confirm once
video-producer (agent):  voices ─► 3D render ─► checks preview frames ─► ffmpeg ─► MP4
```

A 30-second vertical video builds in about 30 seconds on a machine with a GPU.

---

## Quick start

### 1. Requirements

| Need | Notes |
|---|---|
| **Claude Code** | to use the director skill and agent. Not needed for the command-line route |
| **Node.js 20+** | |
| **Google Chrome or Microsoft Edge** | found automatically; set `CHROME_PATH` to use another Chromium |
| **Internet** | for the voices and the first `npm install`. Fully offline voices are available on Windows (`--provider sapi`) |
| ffmpeg | optional: used from your PATH if present, otherwise installed by `npm install` |

Tested on Windows 11 with an NVIDIA GPU. The macOS and Linux browser paths are coded but not tested, and the offline voice is Windows-only.

### 2. Install once

```
cd studio
npm install
```

### 3. Make a video

**With Claude (recommended).** Start Claude Code in this folder, so it picks up the skill and the agent, and describe what you want:

```
/video-studio a robot and a kid argue about whether homework is a good idea
/video-studio explain how a VPN works, funny, 30 seconds
/video-studio <paste a script or an article>
```

Say "surprise me" to skip the questions. Options: `--length 20|35|60`, `--res 720p|1080p`, `--provider auto|edge|sapi`, `--engine studio|browser`.

**Without Claude.** Build one of the included stories, or your own:

```
cd studio
npm run build -- the-3am-deploy
```

The video is saved to `%USERPROFILE%\Videos\VideoStudio\<slug>.mp4` (`~/Videos/VideoStudio` on macOS and Linux). The working files (script, voices, preview frames) stay in `studio/projects/<slug>/`, so changes re-render in about 30 seconds and unchanged voices are reused.

---

## How it works

| Stage | Who | What happens |
|---|---|---|
| 1. Understand | director | Reads what you already said (premise, tone, length, language) so it never re-asks |
| 2. Ask | director | Multiple-choice questions for only what is missing, at most two rounds |
| 3. Brainstorm | director | Three genuinely different concepts shown side by side; you pick one |
| 4. Script | director | Full shot list and dialogue; one confirmation covers the whole build |
| 5. Build | `video-producer` agent | Validates the story, makes the voices, renders, looks at preview frames, fixes technical problems (camera, cast, timing) and checks the MP4 |
| 6. Iterate | both | Offers quick tweaks: a line, a voice, a set, the ending, 1080p |

Only the director talks to you, because only the main conversation can ask questions. The agent never changes the story; it fixes technical problems only.

Under the hood the studio engine turns `story.json` into a video like this:

```
story.json ─► validate ─► voices (free Edge neural voices ─► WAV, silence trimmed)
           ─► timeline.json (frame timing, caption chunks, lip-sync from the audio)
           ─► three.js scene in headless Chrome, 6 parallel browsers, one frame at a time
           ─► ffmpeg: video + mixed audio (speech loudness, optional music ducked) ─► MP4
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
| `the-3am-deploy` | Developer + cube AI, night rooftop, laptop-screen insert, a twist ending | 26.8 s |
| `example-small-change` | The same pair with a title card and every shot type | 30.5 s |
| `hindi-chai` | Hindi voices and Devanagari captions, a person and a blob | 15.8 s |
| `_gallery` | A silent test of all six sets and the three character types (a visual check, not a story) | |

---

## What the studio engine can make

| | |
|---|---|
| **Characters** | `human` (5 hair styles, sits or stands), `cube` (robot, AI, any object), `blob` (pet, creature, mascot). Up to 5 per video, each with their own colours, scale and voice |
| **Sets** | `skyline-night`, `space-stage`, `cozy-room`, `office-day`, `sunny-park`, `studio` |
| **Acting** | 10 emotions, 8 gestures, blinking, breathing, and a mouth that follows the speech |
| **Camera** | wide, two-shot, medium, close, over-the-shoulder, low, high, laptop-screen insert, with slow push-ins, pull-outs, drifts and orbits |
| **Sound** | 300+ free neural voices (English, Hindi, Gujarati, Spanish, French, German, Japanese and more), or offline Windows voices; optional background music from a file you supply, quietened under speech |
| **Picture** | vertical 9:16 (default), square or landscape; 720p or 1080p; captions coloured per speaker |

**Not supported:** crowds, vehicles, realistic animals, composed music, sound effects. The director reshapes ideas to fit what the engine can draw.

---

## Commands

Run from `studio/`. `<slug>` is a folder name under `studio/projects/`.

| Command | Does |
|---|---|
| `npm run validate -- <slug>` | Checks `story.json` |
| `npm run tts -- <slug>` | Makes the voices and `timeline.json` |
| `npm run preview -- <slug>` | One still frame per shot in `out/stills/` (`--shots s01,s03`, `--frames 120,400`) |
| `npm run render -- <slug>` | Renders `out/<slug>.mp4` |
| `npm run build -- <slug>` | All of the above, then copies the MP4 to your Videos folder |
| `npm run typecheck` | Type-checks the engine |

Flags: `--provider auto|edge|sapi` (default `auto`: tries the Edge voices, and falls back to the offline voice for the **whole** video if the service is unreachable), `--res 720p|1080p`, `--workers N`, `--no-stills`, `--keep-frames`. `preview` and `render` rebuild the timeline automatically when `story.json` is newer than it.

---

## Repository layout

```
.claude/
  skills/video-studio/
    SKILL.md                 the director: understand, ask, brainstorm, script, build, iterate
    references/brainstorm.md the question bank and how to brainstorm three concepts
    formats/story.md         the story.json contract and the writing rules
    formats/talkstuff.md     the Pixar-style talking-object format (browser engine)
    engines/studio.md        commands and the worker runbook for the studio engine
    engines/browser.md       the older Gemini + Flow/Grok route
  agents/video-producer.md   the worker agent
studio/
  src/types.ts               the story schema
  src/engine/                characters, sets, camera, emotions, the world renderer
  src/player/index.html      the page that is captured frame by frame
  scripts/                   validate, tts, preview, render, build (+ lib/)
  projects/<slug>/           story.json (yours), audio/, out/ (generated, not committed)
docs/BUILD_LOG.md            how all of this was built, stage by stage, with token usage
```

---

## Extending it

| You want | Do this |
|---|---|
| A new kind of video | Add a file to `.claude/skills/video-studio/formats/` |
| A new place | Add a function to `studio/src/engine/sets.ts` and the name to `SETS` in `types.ts` |
| A new character type | Add a builder to `studio/src/engine/characters.ts` and the name to `KINDS` |
| A different voice engine | Add a provider to `studio/scripts/lib/tts.ts`; it only has to return a 24 kHz mono WAV |
| Sound effects | Add an `sfx` field to lines in `types.ts`, place short WAVs in `timeline.ts`, mix them in `render.ts` |

---

## The browser engine (older route)

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
| Two voices sound alike | Change `voice.edge`, then push `rate` and `pitch` apart |
| `/video-studio` or the agent is not found | Start a new Claude Code session in this folder; new skill and agent files are only picked up at session start |

---

## Privacy and licences

- **What leaves your computer:** only the dialogue text, sent to Microsoft's free text-to-speech service to make the voices. Use `--provider sapi` to keep everything local. Rendering, scripts and files stay on your machine.
- **Licences:** the studio engine uses permissively licensed tools: three.js (MIT), puppeteer-core (Apache-2.0), esbuild (MIT), msedge-tts (MIT), zod (MIT). The ffmpeg binary installed by `ffmpeg-static` is GPL-3.0, which only matters if you redistribute it. Remotion was deliberately **not** used: its licence requires a paid company licence for organisations with more than three people.
- **Content:** the director is instructed not to write hateful, harassing or misleading content, or to invent facts about real people or companies.

---

## More

- [docs/BUILD_LOG.md](docs/BUILD_LOG.md): how this was developed, stage by stage, with the prompts, agents and token usage.
- [studio/src/types.ts](studio/src/types.ts): the story schema, the single source of truth.
