# Video types: what `/video-studio` can make

`/video-studio` is the single entry point. It asks what you want to make, offers to show finished samples of every type first ([samples/index.html](../samples/index.html), list in [samples/README.md](../samples/README.md)), brainstorms with you, then builds. Every local engine is code-rendered, runs on this computer and needs no accounts or paid APIs.

```
/video-studio  ->  How do you want to start?  (show samples first / pick the type / surprise me)
               ->  Which type?  story | explainer | edit my recording | cinematic AI reel
               ->  a few multiple-choice questions  ->  3 angles to pick from  ->  script + one confirmation
               ->  video-producer builds  ->  review  ->  MP4 on your disk
```

| Type | Engine | Input | Output | Code | Runbook | Samples |
|---|---|---|---|---|---|---|
| Animated story | `studio` | a story | talking 3D characters, lip-sync, camera cuts, 20-60 s | `studio/` | [engines/studio.md](../.claude/skills/video-studio/engines/studio.md) | `samples/story/` |
| Explainer short | `explainer` | a topic | narrated vertical short, 6 styles, 25-60 s | `studio/explainer/` | [engines/explainer.md](../.claude/skills/video-studio/engines/explainer.md) | `samples/explainer/` |
| Edit my recording | `editor` | your 16:9 talking-head video | cuts + motion graphics + captions | `studio/editor/` | [engines/editor.md](../.claude/skills/video-studio/engines/editor.md) | `samples/editor/` (pending) |
| Cinematic AI reel | `browser` | a story, Hindi/Urdu/English | photoreal Pixar-style scenes stitched into a reel | `studio/scripts/stitch.ts` | [engines/browser.md](../.claude/skills/video-studio/engines/browser.md) | `samples/reel/` |

## Explainer short: 6 styles

| Style id | Best for | Look | Length | Sample |
|---|---|---|---|---|
| `inside-out` | light "what happens if..." body and science | flat 2D hero, x-ray cutaways, bold 1-3 word captions | 25-40 s | What if you swallow gum? |
| `deep-dive` | the flagship body and science explainer | sculpted 3D people, glowing x-ray bodies, shallow focus | 30-45 s | What happens if you hold your breath? |
| `night-file` | unsolved mysteries, true crime | dark 3D places, one light, typewriter dates, case-file inserts | 30-45 s | The man who jumped out of a plane |
| `stick-story` | survival steps, life hacks | stick figures, flat rooms day/night, gold step cards | 30-45 s | What if the power went out for 3 days? |
| `paper-atlas` | history, "how X happened" | parchment maps, crimson routes, gold date ribbons | 30-45 s | How one bakery burned down London |
| `tall-tale` | funny true stories, cons, loopholes | flat 2D cartoon people in a sunny 3D town, one-word captions | 40-60 s | The girl who was mailed to grandma |

Voiceover modes: AI voice (Kokoro, default), your own recording, captions only.

## Edit my recording: 7 graphics styles

`warm-canvas` (calm editorial, default for talking heads) · `creator-motion-graphics` (dark, punchy kinetic type) · `clean-tech` (light UI cards, tech topics) · `software-walkthrough` (mock app screens, cursor and clicks) · `data-story` (dark charts and counters) · `chalk-talk` (hand-drawn chalkboard) · `pop-info` (flat infographic scenes with a character) · or no graphics. English, Hindi or mixed.

## Who does what

| Role | Where | Talks to the user |
|---|---|---|
| Director (central) | skill `video-studio` | yes, the only one |
| Producer | agent `video-producer`, one runbook per engine | no |
| Critic | agent `video-critic` (`studio` projects; for explainer and editor the director reviews the contact sheet itself) | no |
| Setup | skill `setup-video-studio` | yes |

The director is a skill, not an agent, on purpose: only the main conversation can ask the user multiple-choice questions.

## Local setup (nothing downloaded twice)

- `explainer` reuses what `studio/` already installed: ffmpeg from `studio/node_modules/ffmpeg-static`, Kokoro from `studio/.models/kokoro`, Python from `studio/.venv-kokoro` (needs `scipy`). `source studio/explainer/scripts/use-studio-tools.sh` sets that up. Without `faster-whisper`, word timing is estimated inside the exact voice line times (about 0.1-0.2 s off); installing Whisper small.en (about 0.5 GB) makes it exact. That download is opt-in.
- `editor` needs ffmpeg and ffprobe on PATH, `python studio/editor/scripts/setup.py`, and a Whisper model (about 0.5 GB English, 1.6 GB Hindi). All opt-in, never automatic.
- Build a bundled explainer example: `bash studio/explainer/scripts/build_example.sh <style>`; add a sample to the gallery: put it under `samples/<type>/`, edit `samples/samples.json`, run `python samples/build_gallery.py`.

## Left out on purpose

- The original `faceless-shorts` skill's YouTube upload through Zapier and its public temporary file hosts: this repo never publishes a video.
- `editor` has no sample yet: it needs a recording and the Whisper download. Its bundle states no license (Nafay 3D, youtube.com/@nafay3d), so confirm terms before redistributing the style code outside this repo.
