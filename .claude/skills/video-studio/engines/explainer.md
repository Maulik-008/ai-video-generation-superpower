# Engine: explainer

Makes a finished **vertical explainer short** (25-60 s, 9:16) from a topic: script, voice, word-synced captions, animated shots, sound and music, rendered to MP4. **Everything is code**: canvas and three.js drawing in headless Chrome, a local Kokoro voice, word timing, numpy sound, ffmpeg. No AI images or video, no API keys, no credits, no accounts. The engine lives in [`studio/explainer/`](../../../../studio/explainer/) (called `EXPLAINER` below); finished examples are in [`samples/explainer/`](../../../../samples/explainer/).

Use it when the user wants a narrated faceless short from a **topic** (not a character story with dialogue: that is the `studio` engine, and not their own recording: that is the `editor` engine). Projects live in `studio/explainer/projects/<slug>/`.

## Styles (the "format" of this engine)

| Style id | What it makes | Length |
|---|---|---|
| `deep-dive` Deep Dive 3D | "What happens if...?" body and science: sculpted 3D people in sunlit sets, glowing x-ray bodies, camera journeys through blood vessels, shallow focus | 30-45 s |
| `night-file` Night File 3D | unsolved mysteries and true crime: dark 3D places with one light, faceless people (the subject glows red), typewriter dates, case-file inserts | 30-45 s |
| `inside-out` Inside Out | lighter, faster flat 2D "What happens if...?" explainer: a simple hero, x-ray cutaways, bold 1-3 word captions | 25-40 s |
| `stick-story` Stick Story | "What would you do if...?" survival steps: stick people with acting eyes, flat rooms day/night, gold step cards | 30-45 s |
| `paper-atlas` Paper Atlas | history in cut paper: parchment maps, crimson routes, gold date ribbons, period figures | 30-45 s |
| `tall-tale` Tall Tale 3D | funny true stories, cons, loopholes: flat 2D cartoon people in a sunny 3D town, camera always moving, one-word captions | 40-60 s |

Multi-voice / Hindi (`inside-out`): per-line `voice`/`lang`/`speed`/`pitch`/`speaker` in `script.json`, Devanagari captions and talking organs: see `styles/inside-out/STYLE.md` section 8. Whisper small.en cannot time Hindi, so words are spread inside the exact voice lines and snapped to pauses (say "estimate" in `notes`).

Which style: body, health, science "what happens if" → `deep-dive` (or `inside-out` for a lighter 2D look) · creepy, unexplained, true crime → `night-file` · survival, life hacks, "here is what you do" → `stick-story` · a historical event, "how X happened" → `paper-atlas` · a funny or clever true story, "this guy did X" → `tall-tale`.

Each style = `EXPLAINER/styles/<style>/style-sheet.png` (the look in one image) + `STYLE.md` (the rules and the engine manual) + `example/` (a complete project that renders as-is). **Read the style's `STYLE.md` in full before planning.**

## Requirements

Node.js 22+, Chrome or Edge, ffmpeg, Python 3.10+. Voice: Kokoro (about 0.35 GB). Word timing: Whisper small.en if installed (about 0.5 GB), otherwise the words are spread inside the exact voice line times (about 0.1-0.2 s off). This repo already has Kokoro in `studio/.models/kokoro`, ffmpeg in `studio/node_modules/ffmpeg-static` and the Python environment `studio/.venv-kokoro`; **source `EXPLAINER/scripts/use-studio-tools.sh` first** so nothing is downloaded again (it needs `scipy` in that environment). If something is missing, run the `setup-video-studio` skill; never download a model without the user's yes. On Windows run the scripts in Git Bash.

## Director steps (main conversation)

1. **Intake with `AskUserQuestion`** (only the unknown slots, see [brainstorm.md](../references/brainstorm.md) for the rules): topic (or "pick three ideas"), style (if it is not obvious from the topic), length (default about 30 s), voiceover mode (**AI voice** default · **their own recording**, `words.py --audio` · **captions only**, `estimate.py`), voice (`EXPLAINER/scripts/py EXPLAINER/scripts/voice.py --list`; default `am_michael`; never ask more than "male or female narrator"), end line or handle. Music: the built-in bed unless they supply a royalty-free file.
2. **Brainstorm three angles** for the topic (three genuinely different hooks and twists, each with title, hook line, the surprise and the last line) and let the user pick one.
3. **The plan, then one confirmation.** Show: title · the full narration, one line per cut, with its caption chunks (`WHAT IF *YOU | SWALLOW *GUM?`) · the shot list, one line each (what we see, what moves, which word it lands on) · new components you will add to the kit, if any · facts and their sources. Ask "Build it?" with `AskUserQuestion`. That yes covers the whole build.

**Script rules.** Write it the way a person talks to a friend: full, flowing sentences with connecting words ("Well,", "where", "but", "so", "which means"), not a list of caption-like statements. About 90-110 words for 35 s. **A line is a CUT, not a sentence**: split each sentence into 1-3 lines at natural pauses (commas, "and", "where"), so the picture changes every 1.5-3.5 s while the voice keeps flowing (`voice.py` speaks each whole sentence in one pass). Shape: hook question, escalation, a myth or surprise, a twist ("but if you..."), a punchy last line that loops. Write numbers as they are said ("seven"). Original writing only: take a format you like, never another creator's script or shots. Every fact is checked against a reliable source (list them in `script.json` `"sources"`). Health topics: accurate, no gore, no scary misinformation.

## Commands (run from the repo root, after `source EXPLAINER/scripts/use-studio-tools.sh`)

| Step | Command |
|---|---|
| New project from a style's example | `bash EXPLAINER/scripts/new_video.sh <style> <slug>` → `EXPLAINER/projects/<slug>/` |
| Voice + exact line times | `EXPLAINER/scripts/py EXPLAINER/scripts/voice.py <proj>` |
| Word timing | `EXPLAINER/scripts/py EXPLAINER/scripts/words.py <proj>` (own recording: add `--audio their.m4a`; captions only: `estimate.py <proj>`) |
| Check | in `<proj>`: `node tools/capture.mjs check` (must say CHECK OK) |
| Cues + sound | `node tools/capture.mjs cues` then `EXPLAINER/scripts/py tools/mix.py .` |
| QA sheet | `node tools/capture.mjs sheet review/all.jpg 0.5 10` (a frame every 0.5 s, time-stamped) |
| Iterate on one shot | `node tools/capture.mjs frames review/f "4.2,4.6"` |
| Render | `node tools/capture.mjs video renders/<slug>.mp4` (add `--draft` for a fast clip) |
| Bundled example in one go | `bash EXPLAINER/scripts/build_example.sh <style>` |
| Self test (all styles, 2-4 min) | `bash EXPLAINER/scripts/selftest.sh` |

Write `script.json` (lines + caps + gaps; see the style's `STYLE.md`), then rewrite `src/shots.js`: one shot per line (or two for long lines), each placed with `cut(i)` and its key moments on words with `Wd('word', line)`. Reuse the kit (`src/core/kit.js`); add new components there, in the style's look.

3D styles render real 3D with three.js. With a graphics card a 35 s short takes about a minute. Without one (no GPU acceleration) render with `SOFTWARE_GL=1 QS='&res=0.6&aa=0&shadow=1024' FPS=24` in front of `node tools/capture.mjs ...` (about 2 s per frame): tell the user the time up front and QA with `sheet review/all.jpg 1 10` first.

## Worker runbook (the `video-producer` agent follows this when `engine = explainer`)

The brief gives you the style, the project slug and the approved `script.json` (or the topic and the approved plan). You do not change the creative content (lines, facts, order). You build, check and fix technical problems.

1. **Tools.** `source EXPLAINER/scripts/use-studio-tools.sh`. If `ffmpeg`, `node` 22+, Chrome or the Kokoro model is missing, return `BLOCKED` with the exact action (never download a model yourself).
2. **Project.** `new_video.sh` (never overwrite an existing project), write or copy `script.json`, and write `src/shots.js` from the plan.
3. **Timing and voice.** `voice.py`, then `words.py`. Say in `notes` whether word timing was Whisper or the estimate.
4. **Check, cues, mix.** `capture.mjs check` must say CHECK OK before you go on.
5. **QA: never accept a frame you have not looked at.** Make the sheet and read the whole thing with the Read tool, then key frames full size. For every frame ask:
   - **Does it make sense?** One visual mode per shot: if the body is x-ray, ALL of it is x-ray. Props move with whatever holds them. Nothing appears before its cause.
   - **Does it match the narration at that moment?** The picture changes just before its line; reveals land on their word.
   - **Is anything colliding?** Moving things never cross labels, pills, the caption zone (y 1250-1550) or each other by accident.
   - **Captions:** 1-3 words, exactly one highlighted word, spelled right, on the word being said, readable on a phone.
   - **Style sheet:** only the palette, shapes and view rules of the style.
   - **Sound:** voice clear over the music; effects soft. Check the mean volume is not silent (`ffmpeg -i <mp4> -af volumedetect -vn -f null -`).
   Fix technical problems, re-render the sheet, re-check, at most two rounds.
6. **Render and deliver.** `capture.mjs video renders/<slug>.mp4`; copy to `%USERPROFILE%\Videos\VideoStudio\<slug>.mp4`. Make a share copy if over 35 MB (`ffmpeg -i in.mp4 -c:v libx264 -crf 24 -preset slow -c:a aac -b:a 160k -movflags +faststart share.mp4`) and the best cover frame (`capture.mjs frames`).
7. **Return** exactly one block:

```
STATUS: DONE
video: <absolute path of the copy in Videos\VideoStudio>
project: <absolute path of studio\explainer\projects\<slug>>
length: <seconds>s · <width>x<height> · <MB> MB
style: <style id>
voice: <voice id and speed>; word timing: whisper | estimate
qa: <what you checked, what you fixed>
notes: <anything visibly imperfect, or "none">
```

(`BLOCKED` and `FAILED` use the same blocks as the other engines.)

Deliver also: a title, a caption and 5-8 hashtags in the chat, and for own-recording mode the script with each line's timing to read against. Offer one round of precise changes and re-render only what changed.

## Adding a new style (when the user asks)

Make `EXPLAINER/styles/<new-style>/` with `style-sheet.png`, `STYLE.md` (same sections as Inside Out: look rules, palette, format, engine/kit map, components, shot anatomy, cue types, QA pitfalls) and a complete `example/`. Copy Inside Out's `tools/`, `index.html`, `src/main.js`, `src/core/{lib,timing,captions}.js`, then build the new look's kit and shots. The shared scripts work unchanged. Add a row to the style table above and to `samples/`, and run `selftest.sh` until every style passes.

## Never

Generate images or video with AI; spend the user's money or credits; publish or upload a video anywhere (the original skill's YouTube-via-Zapier step is deliberately not part of this repo); copy another creator's script, shots or frames; overwrite a user's project without asking; ship a frame you have not looked at.
