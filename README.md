# video-super-power

Tell Claude a story. It asks a few multiple-choice questions, brainstorms three angles for you to pick from, writes the script, and renders a finished animated video with voices, captions and camera work. No accounts, no paid APIs.

```
you: "make a video about a developer and an AI that keeps getting 'one small change' requests"
 └─ /video-studio (director) ── asks: length? tone? world? cast?      (multiple choice)
                            ── brainstorms 3 concepts → you pick one
                            ── writes the script → you confirm once
                            ── video-producer (agent) ── voices ─► 3D render ─► ffmpeg ─► MP4
```

## Contents

| Item | Path | What it does |
|---|---|---|
| Skill `video-studio` | [.claude/skills/video-studio/](.claude/skills/video-studio/SKILL.md) | The director: understand → ask → brainstorm → script → build → iterate |
| Agent `video-producer` | [.claude/agents/video-producer.md](.claude/agents/video-producer.md) | The worker: builds the video, looks at preview stills, fixes technical problems, verifies the MP4 |
| Engine `studio` (default) | [engines/studio.md](.claude/skills/video-studio/engines/studio.md) · code in [studio/](studio/) | three.js characters + sets rendered in headless Chrome, free voices, lip-sync from the audio, ffmpeg mix |
| Engine `browser` | [engines/browser.md](.claude/skills/video-studio/engines/browser.md) | The older route: drive your own Chrome through ChatGPT's TalkStuff GPT, Gemini and Google Flow / Grok Imagine (uses your accounts and credits) |
| Format `story` | [formats/story.md](.claude/skills/video-studio/formats/story.md) | The `story.json` contract: characters, sets, emotions, camera, writing rules |
| Format `talkstuff` | [formats/talkstuff.md](.claude/skills/video-studio/formats/talkstuff.md) | Pixar-style talking-object clips (browser engine) |

## Use it

Open Claude Code in this folder and just describe what you want:

```
/video-studio a robot and a kid argue about whether homework is a good idea
/video-studio explain how a VPN works, funny, 30 seconds
/video-studio <paste a script or article>
/video-studio --engine browser Toothbrush, angry, bathroom sink      # the older Flow/Grok route
```

You can say "surprise me" to skip the questions. A 30-second video builds in about 30 seconds on a machine with a GPU. Videos land in `%USERPROFILE%\Videos\VideoStudio\<slug>.mp4`, and the working files (script, voices, preview stills) stay in `studio/projects/<slug>/`, so you can ask for changes and re-render quickly.

### Without Claude

```
cd studio
npm install                                  # once
npm run build -- example-small-change        # validate → voices → stills → render → copy to Videos
npm run preview -- my-story --shots s01,s03  # just look at a couple of shots
```

Write your own `studio/projects/<slug>/story.json` (copy `example-small-change`; the format is documented in `formats/story.md`).

## What the studio engine can make

- **Characters:** `human` (5 hair styles, sit or stand), `cube` (robot/AI/object), `blob` (pet/creature). Up to 5 per video, each with their own colours, scale and voice.
- **Sets:** night rooftop, space stage, cozy room, sunny office, sunny park, neutral studio.
- **Acting:** 10 emotions, 8 gestures, blinking, breathing and lip-sync that follows the speech.
- **Camera:** wide / two-shot / medium / close / over-the-shoulder / low / high / laptop-screen insert, with slow push-ins, pull-outs, drifts and orbits.
- **Sound:** free Microsoft Edge neural voices in 300+ voices and many languages (English, Hindi, Gujarati, Spanish, French, German, Japanese, …), or Windows' built-in voices offline; optional background music from a file you supply, ducked under speech.
- **Format:** vertical 9:16 (default), square or landscape; 720p or 1080p; captions coloured per speaker.

It cannot draw crowds, vehicles or realistic animals, and it cannot compose music. See the limits in `formats/story.md`.

## Prerequisites

- Node.js 20+, and Google Chrome or Microsoft Edge (found automatically; set `CHROME_PATH` to use another Chromium).
- Internet for the voices and the first `npm install`. Pass `--provider sapi` for fully offline (Windows) voices. The dialogue text is sent to Microsoft's free text-to-speech service to make the voices; nothing else leaves your computer.
- ffmpeg: used from PATH if present, otherwise installed by `npm install` (`ffmpeg-static`, GPL-3.0 binary: fine for personal use, check the licence before redistributing).
- For the `browser` engine only: the Claude in Chrome extension connected, with `chatgpt.com`, `gemini.google.com`, `flow.google.com` / `labs.google` and `grok.com` allowed, and you signed in to each. The TalkStuff GPT is retired on 2026-12-11; after that the format switches to `--writer claude`.

## Licences

Everything the studio engine uses is permissively licensed (three.js MIT, puppeteer-core Apache-2.0, esbuild MIT, msedge-tts MIT) and free for company use. It deliberately does **not** use Remotion, whose licence requires a paid company licence for organisations with more than three people.
