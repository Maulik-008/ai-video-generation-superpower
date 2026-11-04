# Sample videos

One folder per video type. Watch these before choosing what to make (`/video-studio` offers them first). Open [`index.html`](index.html) in a browser to play them all.

Add a sample: put its folder under `samples/<type>/`, add an entry to `samples.json`, run `python samples/build_gallery.py`.

## Animated story (`studio` engine)

Characters that talk with lip-sync, camera cuts, captions and free voices, rendered in code (soft clay-toy look, 60 fps, 720x1280).

| Title | Style | Topic | Video | Files |
|---|---|---|---|---|
| Just One Small Change | skyline-night, English comedy | A developer asks for one tiny change. | [example-small-change.mp4](story/example-small-change/example-small-change.mp4) (6.7 MB) | [story.json](story/example-small-change/story.json) |
| The 3 A.M. Deploy | skyline-night, English | A late-night production deploy. | [the-3am-deploy.mp4](story/the-3am-deploy/the-3am-deploy.mp4) (6.2 MB) | [story.json](story/the-3am-deploy/story.json) |
| Battery Low | cozy-room and sunny-park, English | A phone battery story. | [battery-low.mp4](story/battery-low/battery-low.mp4) (6.6 MB) | [story.json](story/battery-low/story.json) |
| रात के दो बजे | cozy-room, Hindi voices | A short Hindi night-time scene. | [hindi-chai.mp4](story/hindi-chai/hindi-chai.mp4) (3.0 MB) | [story.json](story/hindi-chai/story.json) |
| POV: power cut at home | cozy-room, English | A POV story about a power cut. | [power-cut-pov.mp4](story/power-cut-pov/power-cut-pov.mp4) (7.1 MB) | [story.json](story/power-cut-pov/story.json) |

## Explainer short (`explainer` engine)

A narrated vertical short from a topic, in one of six styles (1080x1920, 25-60 s).

| Title | Style | Topic | Video | Files |
|---|---|---|---|---|
| What if you swallow gum? | inside-out (flat 2D x-ray) | Body and science what-if | [inside-out.mp4](explainer/inside-out/inside-out.mp4) (4.6 MB) | [sheet](explainer/inside-out/contact-sheet.jpg) · [script.json](explainer/inside-out/script.json) |
| What happens if you hold your breath? | deep-dive (3D, x-ray bodies) | Body and science what-if | [deep-dive.mp4](explainer/deep-dive/deep-dive.mp4) (9.1 MB) | [sheet](explainer/deep-dive/contact-sheet.jpg) · [script.json](explainer/deep-dive/script.json) |
| The man who jumped out of a plane | night-file (dark 3D mystery) | True crime: D.B. Cooper | [night-file.mp4](explainer/night-file/night-file.mp4) (10.6 MB) | [sheet](explainer/night-file/contact-sheet.jpg) · [script.json](explainer/night-file/script.json) |
| What if the power went out for 3 days? | stick-story (stick figures, step cards) | Survival steps | [stick-story.mp4](explainer/stick-story/stick-story.mp4) (2.9 MB) | [sheet](explainer/stick-story/contact-sheet.jpg) · [script.json](explainer/stick-story/script.json) |
| How one bakery burned down London | paper-atlas (cut paper maps) | History | [paper-atlas.mp4](explainer/paper-atlas/paper-atlas.mp4) (4.4 MB) | [sheet](explainer/paper-atlas/contact-sheet.jpg) · [script.json](explainer/paper-atlas/script.json) |
| The girl who was mailed to grandma | tall-tale (2D cartoon people, 3D town) | Funny true story | [tall-tale.mp4](explainer/tall-tale/tall-tale.mp4) (14.5 MB) | [sheet](explainer/tall-tale/contact-sheet.jpg) · [script.json](explainer/tall-tale/script.json) |

## Edit my recording (`editor` engine)

Cuts silences and mistakes from your own 16:9 talking-head video and adds motion graphics in one of 7 styles.

**Pending:** Needs a 16:9 talking-head recording and the Whisper model (small.en about 0.5 GB, Hindi large-v3-turbo about 1.6 GB). Not generated yet. See [`editor/README.md`](editor/README.md).

## Cinematic AI reel (`browser` engine)

Photoreal Pixar-style story reels made with your own Gemini + Google Flow (Veo) account, stitched locally. Uses generation credits.

| Title | Style | Topic | Video | Files |
|---|---|---|---|---|
| Tamatar Superstar, part 1 | kahani (Pixar-style vegetable drama, Hindi) | Multi-scene story reel made with Veo through the browser engine | [tamatar-superstar-part1.mp4](reel/tamatar-superstar/tamatar-superstar-part1.mp4) (19.2 MB) | [plan.json](reel/tamatar-superstar/plan.json) |

_Made with a personal Google account and Flow credits._
