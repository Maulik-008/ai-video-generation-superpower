# Format: story

Animated low-poly 3D story videos with voices, word-by-word captions, camera work, transitions and sound design, rendered by code in `studio/` at 60 fps (no accounts, no paid APIs). This file is the contract for `studio/projects/<slug>/story.json`. The director writes it, `npm run validate` checks it, and the `video-producer` agent builds it.

The schema's source of truth is [studio/src/types.ts](../../../../studio/src/types.ts). If this file and that one disagree, the code wins.

## What the engine can draw

**Characters** (up to 5; the order in `characters[]` is their left-to-right position on stage):

| `kind` | Looks like | Use it for |
|---|---|---|
| `human` | Big-headed low-poly person (hair: `spiky` `messy` `bob` `bald` `cap`), can `sit` or `stand` | people, narrators, kids, professionals |
| `cube` | Orange-ish box on four little legs with two nubs for arms | robots, AIs, gadgets, appliances, any "object that talks" |
| `blob` | Soft round creature with stubby arms and feet | pets, ghosts, monsters, mascots, germs, emotions |

Everything else in a user's story has to be mapped onto these three: a talking toothbrush is a `cube` or `blob` coloured to suit it, a villain can be a `human` with `angry` reactions, a crowd is two or three extras. Set `look` colours (`#rrggbb`) so characters are easy to tell apart: `skin` `hair` `hairStyle` `outfit` `pants` `shoes` for humans, `body` `accent` for cube/blob. `scale` (0.5 to 2) makes a character bigger or smaller (a giant `blob` at 1.6, a kid at 0.8).

**Sets** (`shots[].set`, inherited from the previous shot when omitted):

| Set | Mood |
|---|---|
| `skyline-night` | rooftop at night, city lights, string lights. Cinematic, intimate, tech/startup/late-night feel |
| `space-stage` | dark violet stage with stars, planet and floating agent panels. Sci-fi, AI, digital worlds |
| `cozy-room` | warm living room, lamp, shelf, rug, night window. Family, comfort, slice of life |
| `office-day` | bright office with desk, monitors, clock. Work comedy, meetings, corporate |
| `sunny-park` | trees, hills, bench, clouds. Kids' stories, outdoors, fables, upbeat |
| `studio` | neutral dark stage with drifting shapes. Explainers, abstract ideas, anything |

Every set has a laptop in front. It slides aside automatically so it does not hide a character standing in the middle. When the story has nothing to do with a computer, hide it with `"look": { "laptop": false }` (insert shots still show it).

**Emotions** (`lines[].emotion`, `shots[].reactions`): `neutral` `happy` `sad` `angry` `surprised` `worried` `smug` `tired` `excited` `confused`. A character keeps their last emotion into later shots until they speak again or a `reactions` entry overrides it before their first line of a shot.

**Actions** (`lines[].action`, play for about a second when the line starts): `nod` `shake` `shrug` `point` `lean-in` `jump` `slump` `wave`. Talking gestures, blinking, breathing and lip-sync are automatic.

**Camera** (`shots[].camera`): `type` + optional `focus` (a character id) + `move`.

| `type` | Frames | Use for |
|---|---|---|
| `wide` | whole set, characters small in the lower part | opening, establishing, ending |
| `two-shot` | everyone on stage, close | back-and-forth dialogue |
| `medium` | one character, whole body, with `focus` | reactions, gestures |
| `close` | head and shoulders, with `focus` | the emotional beat, the punchline |
| `over-shoulder` | 3/4 angle on `focus` from the other character's side | tension, arguments |
| `low-angle` / `high-angle` | looks up at / down on `focus` | power, smallness |
| `insert` | the laptop screen (`focus` can be `"laptop"`; set `screen` lines) | showing code, a message, a search, a result |

`move`: `static` `push-in` `pull-out` `drift-left` `drift-right` `orbit` `rise` `punch-in`. All but `punch-in` are slow, over the length of the shot. Default to `push-in` on emotional close-ups, `pull-out` on reveals and endings, and `static` for rapid dialogue. **`punch-in`** is a quick, springy zoom right after the cut, then a slow creep: the emphasis beat of short-form video. Use it on a reaction, a reveal or a punchline, at most every third shot.

**Transitions** (`shots[].transition`, how this shot comes in from the previous one; default `cut`):

| `transition` | Looks like | Use for |
|---|---|---|
| `cut` | instant | every shot inside a scene (film language: most shots are cuts) |
| `whip` | fast pan with motion blur (about 0.3 s, automatic whoosh) | a jump to another place, `set` changes, "meanwhile" |
| `zoom` | zoom-blur through into the next shot (about 0.36 s, automatic whoosh) | a reveal, entering someone's head, "and then" |
| `fade` | crossfade (about 0.45 s) | an emotional beat, a soft ending |
| `dip` | through black (about 0.6 s) | time passing, "later", the start of an epilogue |

At most 3 or 4 non-cut transitions per video. They overlap the start of the shot, so they do not change its length.

## story.json

```json
{
  "title": "Just One Small Change",
  "slug": "small-change",
  "aspect": "vertical",
  "resolution": "720p",
  "look": { "captions": { "position": "top", "size": 0.034 }, "handheld": true },
  "music": { "file": "C:/path/to/track.mp3", "volume": 0.12 },
  "characters": [
    { "id": "dev", "name": "Dev", "kind": "human", "pose": "sit",
      "look": { "hairStyle": "spiky", "outfit": "#3b4cc0" },
      "voice": { "edge": "en-US-GuyNeural", "gender": "male", "rate": "+4%", "pitch": "+0Hz" },
      "captionColor": "#ffffff" },
    { "id": "bolt", "name": "Bolt", "kind": "cube", "look": { "body": "#ff7a45" },
      "voice": { "edge": "en-US-AnaNeural", "gender": "female", "rate": "-4%", "pitch": "-6Hz" },
      "captionColor": "#ffb066" }
  ],
  "shots": [
    { "id": "s00", "set": "skyline-night", "camera": { "type": "wide", "move": "pull-out" },
      "duration": 2.2, "overlay": "Just One Small Change" },
    { "id": "s01", "camera": { "type": "two-shot", "move": "push-in" },
      "reactions": { "dev": "worried" },
      "lines": [ { "speaker": "dev", "text": "Hey Bolt. Tiny favour. Just one small change.", "emotion": "worried", "action": "lean-in" } ] },
    { "id": "s02", "camera": { "type": "close", "focus": "bolt" },
      "lines": [ { "speaker": "bolt", "text": "That is exactly what you said at nine this morning.", "emotion": "smug" } ] }
  ]
}
```

A complete working example lives in `studio/projects/example-small-change/story.json`. Copy its structure.

### Top level

| Field | Default | Notes |
|---|---|---|
| `title` | required | Shown in reports. Use `overlay` on a shot for an on-screen title card |
| `slug` | required | Lowercase letters, digits, dashes. The video is saved as `<slug>.mp4` |
| `aspect` | `vertical` | `vertical` 9:16, `square`, `landscape` 16:9 |
| `resolution` | `720p` | `1080p` renders in about twice the time |
| `fps` | `60` | Smooth motion. `30` renders in half the time and looks choppier |
| `look.captions.style` | `bold` | `bold`: big heavy captions in short groups, the word being spoken lit in the speaker's colour (timed by Whisper when the Chatterbox environment is installed, otherwise estimated from the audio). `classic`: the older phrase captions. `none`: no captions |
| `look.captions.position` | `top` | `top` (29% down), `middle`, `bottom`. `size` is a fraction of the frame height (default 0.05 bold, 0.034 classic) |
| `look.handheld` | `true` | Faint camera drift. Turn off for a very still look |
| `look.sfx` | `true` | Automatic sound effects: a whoosh on `whip`/`zoom`, a pop on an `overlay` title, a boing on `jump`, typing on an `insert` with `screen` text. `false` keeps only the ones you set |
| `look.ambience` | `true` | A very quiet room tone per set (city night, room, office, park wind, space drone), so pauses never fall into dead silence |
| `look.laptop` | `true` | `false` hides the laptop prop except in insert shots |
| `music` | none | A file you or the user provide (mp3/wav). Quietened under speech automatically. The engine cannot compose music |

### Characters

`id` (lowercase, dashes), `name`, `kind`, `pose` (`stand` or `sit`, humans only), `scale`, `look`, `voice`, `captionColor`.

**Voice** (all optional; a story that sets none of them sounds exactly as before):

| Field | Default | Meaning |
|---|---|---|
| `engine` | `edge` | `auto` = the best engine installed (turbo for English, then chatterbox, kokoro, edge, offline), or force `edge`, `kokoro`, `chatterbox`, `turbo`, `sapi`. Every choice falls back automatically if it is missing or fails |
| `delivery` | `natural` | `natural` = as before. **`warm`** and **`calm`** = slower, real pauses between longer sentences, the `emotion` of each line shapes the delivery, and a warm mastering pass. Use `calm` for heartfelt, apology, comfort and bedtime stories |
| `edge` | `en-US-GuyNeural` | A Microsoft Edge neural voice name (list below). It also sets the language |
| `kokoro` | chosen from language + gender | A Kokoro voice id such as `af_heart` (US female), `am_michael` (US male), `bf_emma`, `bm_george`, `hf_alpha` / `hm_omega` (Hindi). Two characters of the same gender automatically get different ids |
| `language` | read from the Edge voice | `en`, `hi`, `es`, `fr`, `it`, `pt`, `ja`, `zh` … |
| `expressiveness` | 0.5 | Chatterbox only: 0 flat … 1 very expressive |
| `gender`, `rate`, `pitch` | male, `+0%`, `+0Hz` | `gender` picks the offline fallback voice; `rate` like `+10%` / `-8%` and `pitch` like `+20Hz` / `-15Hz` shift the Edge voice |

**Choosing an engine.** For emotional or calm stories, set `engine: auto` and `delivery: calm` (or `warm`) on every character when `studio/voice/.status.json` shows `chatterbox` or `kokoro` as ready; otherwise keep `engine: edge` with `delivery: calm`, which already sounds noticeably calmer than `natural`. Chatterbox follows the emotion of each line and gives each character a distinct voice; Kokoro is steadier and works without a GPU. Gujarati exists only in the Edge voices, so Gujarati characters stay on `edge`. Chatterbox listens to its own output and retries; one- and two-word lines ("Thanks.", "Always.") are its weak spot, so give them a little more ("Thank you, truly.") when a character uses it.

**Make every character sound different**: pick different voices, then (for Edge) push `rate` and `pitch` apart (a nervous character `+10%` and `+10Hz`, a deadpan robot `-6%` and `-8Hz`, a kid with a child-like voice such as `en-US-AnaNeural`).

| Language | Voices (`<locale>-<Name>`) |
|---|---|
| English, most natural | `en-US-` AndrewMultilingualNeural (M) · BrianMultilingualNeural (M) · AvaMultilingualNeural (F) · EmmaMultilingualNeural (F) · `en-AU-` WilliamMultilingualNeural (M). Prefer these: they sound conversational rather than read aloud |
| English US | `en-US-` GuyNeural (M) · AndrewNeural (M) · BrianNeural (M) · ChristopherNeural (M) · EricNeural (M) · RogerNeural (M) · SteffanNeural (M) · AriaNeural (F) · JennyNeural (F) · AvaNeural (F) · EmmaNeural (F) · MichelleNeural (F) · AnaNeural (F, child-like) |
| English UK / AU / IN | `en-GB-` RyanNeural (M) · ThomasNeural (M) · SoniaNeural (F) · LibbyNeural (F) · MaisieNeural (F, young) · `en-AU-` WilliamMultilingualNeural (M) · NatashaNeural (F) · `en-IN-` PrabhatNeural (M) · NeerjaNeural (F) |
| Hindi | `hi-IN-` MadhurNeural (M) · SwaraNeural (F) |
| Gujarati | `gu-IN-` NiranjanNeural (M) · DhwaniNeural (F) |
| Spanish | `es-ES-` AlvaroNeural (M) · ElviraNeural (F) · XimenaNeural (F) · `es-MX-` JorgeNeural (M) · DaliaNeural (F) |
| French / German / Italian | `fr-FR-` HenriNeural (M) · DeniseNeural (F) · `de-DE-` ConradNeural (M) · KatjaNeural (F) · `it-IT-` DiegoNeural (M) · ElsaNeural (F) |
| Portuguese / Japanese / Korean / Chinese / Arabic | `pt-BR-` AntonioNeural (M) · FranciscaNeural (F) · `ja-JP-` KeitaNeural (M) · NanamiNeural (F) · `ko-KR-` InJoonNeural (M) · SunHiNeural (F) · `zh-CN-` YunxiNeural (M) · XiaoxiaoNeural (F) · `ar-SA-` HamedNeural (M) · ZariyahNeural (F) |

Write the dialogue text in the same language as the voice. Captions use the same text. If the voice and the text language differ the speech will be garbled.

**Non-verbal sounds.** A line may contain `[laugh]`, `[chuckle]`, `[sigh]`, `[gasp]`, `[cough]`, `[clear throat]`, `[sniff]`, `[groan]` or `[shush]`, for example `"[sigh] Fine. Ship it."`. Only the `turbo` engine (Chatterbox Turbo, English, an optional download) performs them; every other engine and the captions skip them silently, so a story with tags still works everywhere. Use at most one per character per video, where a person really would.

### Shots

| Field | Default | Notes |
|---|---|---|
| `id` | required | `s01`, `s02`, …, unique. Stills and errors use it |
| `set` | previous shot's set | Required on the first shot or it falls back to `studio` |
| `cast` | everyone | Subset of character ids standing in this shot |
| `camera` | `{type:"medium", move:"static"}` | see Camera above |
| `lines[]` | `[]` | `speaker`, `text` (≤ 240 chars), `emotion` (default `neutral`), `action`, `sfx` (an effect when the line starts), `pause` (seconds of silence before the line, default 0.15) |
| `duration` | none | Seconds. **Required for shots without lines** (establishing shots, reaction beats, inserts). Ignored when the lines are longer |
| `transition` | `cut` | `cut` `whip` `zoom` `fade` `dip`, see Transitions above |
| `sfx` | none | An effect at the start of the shot: `whoosh` `swoosh-up` `pop` `ding` `boing` `thud` `sparkle` `type`. All are made by ffmpeg, nothing to download |
| `lead` / `hold` | 0.25 / 0.35 | Seconds before the first line / after the last line |
| `reactions` | `{}` | `{ "dev": "worried" }`: a face for characters who have not spoken yet in this shot |
| `overlay` | none | Big title / end-card text over the shot (≤ 80 chars) |
| `screen` | none | Lines of text on the laptop screen (≤ 8 lines, ≤ 60 chars each). Prefix `>` for cyan, `!` for red |

## Writing rules (this is what makes it good, not just valid)

- **Length**: 20 to 45 seconds is the sweet spot for vertical video. Speech runs at about 2.2 words per second including pauses. 60 words ≈ 27 s. Never go above 90 s.
- **Hook in the first 1.5 seconds**: the first spoken line is a question, a complaint, a shock or a weird claim. No greetings, no "Hello, today I'll tell you…". Open on the line, not on a title card, unless the title is the joke. Give the opening shot `lead: 0.15`.
- **Something changes every 2 to 4 seconds**: a cut, a `punch-in`, an `action`, a reaction, a sound effect. Viewers swipe away from a picture that has stopped changing.
- **Structure**: hook → escalation (each exchange raises the stakes or adds a twist) → punchline or turn in the last 3 seconds. End on the best line, on a `close` shot, and stop. No moral recap.
- **Short lines**: 3 to 12 words per line. One idea per line. If a line needs two breaths, split it into two lines (same speaker is fine).
- **Shot rhythm**: a new shot every 2 to 5 seconds. Alternate camera types (two-shot → close → close → over-shoulder), never the same framing three times in a row. Put `wide` only at the start or end. Use a `close` for the emotional beat and the punchline.
- **Acting**: give every line an `emotion`, and add an `action` on roughly one line in three (`shrug` for "whatever", `jump` for joy, `slump` for defeat, `point` for accusation, `shake` for disbelief). Use `reactions` so the listener's face shows what they feel before they answer.
- **Characters talk differently**: vocabulary, sentence length and voice. Two characters who sound the same make a flat video.
- **Insert shots** are for plot-relevant text only, 2 to 3 seconds: an error message, a chat, a search query, a score. Use `screen`.
- **Sound effects** support a beat; they never decorate. One chosen effect per 10 seconds is plenty on top of the automatic ones: a `thud` on a flat refusal, a `ding` on an idea, a `sparkle` on the happy ending.
- **Overlay title** on a 2-second wide opening shot is optional. Leave it out when the hook line should open the video.
- **Facts and claims**: if the story states a real fact (a statistic, a health claim, a historical date), make sure it is true, or keep it clearly fictional. Do not write defamatory, hateful, or misleading content about real people or companies.
- **Language**: dialogue in the voice's language. Plain words. No emoji (the font cannot show them).
