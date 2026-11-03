# Engine: studio (default)

Renders story videos entirely with code in the `studio/` folder at the repo root: three.js draws the characters and sets in headless Chrome, free text-to-speech makes the voices, the mouths follow the audio, and ffmpeg mixes everything into an MP4. **No accounts, no paid APIs, no browser logins.** A 30-second 720×1280 video builds in about 30 seconds on a machine with a GPU.

Format: [formats/story.md](../formats/story.md) (read it before writing a `story.json`).

## Requirements

| Need | Notes |
|---|---|
| Node.js 20+ | checked with `node -v` |
| Google Chrome or Microsoft Edge | found automatically; set `CHROME_PATH` to point at another Chromium |
| Internet | only for the voices (Microsoft Edge's free neural voices) and the one-time `npm install`. `--provider sapi` uses Windows' built-in voices fully offline |
| ffmpeg | uses the one on PATH, otherwise the binary installed by `npm install` (the `ffmpeg-static` package; the binary is GPL-3.0, which only matters if you redistribute it) |

First run in a fresh checkout: `cd studio && npm install` (about 20 seconds).

## Commands (run from `studio/`)

| Command | Does |
|---|---|
| `npm run validate -- <slug>` | Checks `projects/<slug>/story.json`; prints problems in plain words |
| `npm run tts -- <slug>` | Voices every line → `audio/*.wav` + `timeline.json` (frame timing, captions, lip-sync) |
| `npm run preview -- <slug>` | One still per shot → `out/stills/<shot>.jpg` (`--shots s01,s03`, `--frames 120,400`) |
| `npm run render -- <slug>` | Full video → `out/<slug>.mp4` |
| `npm run build -- <slug>` | All of the above, plus a copy at `%USERPROFILE%\Videos\VideoStudio\<slug>.mp4` |

Flags: `--provider auto|edge|sapi` (default `auto`: tries Edge voices, falls back to the offline voice for the **whole** run if Edge is unreachable, so one video never mixes voice engines), `--res 720p|1080p`, `--workers N` (parallel browsers, default 2 to 6), `--no-stills`, `--keep-frames`.

`<slug>` is the project folder name under `studio/projects/`. Voices are cached by (voice, rate, pitch, text) in `studio/.cache/tts/`, so re-running after editing one line only synthesises that line.

## Worker runbook (the `video-producer` agent follows this when `engine = studio`)

The brief gives you the project slug (its `story.json` is already written by the director), and optionally `res` and `provider`. You do not write or change the creative content (dialogue, plot, characters). You build, check, and fix only technical problems.

1. **Setup.** `cd` to the repo's `studio/` folder. If `node_modules` is missing, run `npm install`. If it fails, return `FAILED` with the error.
2. **Validate.** `npm run validate -- <slug>`. Fix mechanical problems yourself and keep a list of what you changed (an unknown `set` name, a shot without `duration`, an id with capitals, a speaker missing from `cast`). If it needs a creative decision (a line too long to caption, a missing character), return `FAILED` with the exact messages so the director can decide.
3. **Build.** `npm run build -- <slug>` (add `--res 1080p` or `--provider sapi` when the brief says so). It prints each voiced line with its length, the WebGL renderer, progress, and the final file. If the line `edge-tts unavailable … using the offline Windows voice` appears, remember it for your report.
   - If the WebGL line says `SwiftShader` or `software`, rendering runs on the CPU and is slow. Add `--workers 2` and tell the director.
   - If it says `No Chrome/Edge found`, return `BLOCKED` with: "Install Google Chrome or set CHROME_PATH".
4. **Look at the stills.** Read `out/stills/*.jpg` with the Read tool (all of them when there are 8 or fewer shots; otherwise the first, the last, and one of each camera type). Check:
   - Every `close` / `medium` shot shows the focused character fully, not cropped by the frame edge, and facing roughly toward the camera.
   - Captions are readable and do not cover a face completely.
   - Characters in a `two-shot` are both visible and are not stacked on top of each other.
   - Props and set furniture (the laptop, a table, a bench, a lamp) do not cover a face or eye. If one does, change that shot's `camera.type` or `focus`.
   - A still may show only part of a caption line, because long lines are shown in chunks over time. That is not a bug.
   - `insert` shots show the `screen` text legibly.
   - Nothing is blank, black, or showing the wrong set.
5. **Fix and rebuild (at most 2 rounds).** Technical fixes only, in `story.json`: change a `camera.type` (e.g. `close` → `medium` for a very wide cube), a `focus`, a `cast`, a `set`, or `pause`/`lead`/`hold` timings. Then `npm run build -- <slug>` again (`preview` and `render` also rebuild the timeline automatically when `story.json` is newer than it); unchanged voices come from the cache so it is quick. Never rewrite dialogue. If the picture is still wrong after two rounds, deliver anyway and describe the problem in `notes`.
6. **Verify the result.** The build prints `Done: <path> (<seconds>s, <w>x<h>, <MB> MB, audio: true)`. Confirm the duration is within a second of the timeline total, the file is not tiny (roughly 80 KB per second of video or more), and `audio: true`. Otherwise return `FAILED` with the log tail.
7. **Return** exactly one block:

```
STATUS: DONE
video: <absolute path of the copy in Videos\VideoStudio>
project: <absolute path of studio\projects\<slug>>
length: <seconds>s · <width>x<height> · <MB> MB
voices: edge | sapi (offline)
changes: <mechanical fixes you made to story.json, or "none">
notes: <anything visibly imperfect, or "none">
```

```
STATUS: BLOCKED
stage: <setup|build>
reason: <what happened>
user action: <exactly what the user must do>
```

```
STATUS: FAILED
stage: <validate|tts|render|verify>
reason: <the error, in plain words>
log: <last relevant lines>
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `edge-tts failed after 3 attempts` | No internet or the service is blocked. Re-run with `--provider sapi` (Windows only), or retry later |
| `INVALID story.json` | Read the listed paths; each message names the field |
| Very slow render | WebGL on CPU. Use a machine with a GPU, `--workers 2`, or `--res 720p` |
| Character cut off in a close-up | Use `medium` for that shot, or lower the character's `scale` |
| Two voices sound alike | Change `voice.edge`, then push `rate` and `pitch` apart |
| Captions in a non-Latin script show boxes | The system font lacks the glyphs. Windows 11 covers Hindi, Gujarati, Chinese, Japanese, Korean and Arabic out of the box |
| A set looks washed out or dark | Pick another `set`; each has its own lighting |
