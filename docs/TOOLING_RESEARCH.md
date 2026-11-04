# Tooling research: the "14 repos for better AI videos" list

A post recommended 14 free repos for making AI videos "less boring": voice, captions, 3D, animation and export, all made with code. This page records what each one is, whether it fits this repo's constraints, and what was done about it (November 2026).

**Constraints this repo keeps** (see the README's licence section):
1. Free for a company of any size. MIT, Apache-2.0, BSD or similar; nothing that needs a paid company licence.
2. Runs on the developer's own machine, with no accounts or paid APIs.
3. Nothing large is downloaded unless the developer chooses it in setup.

## Summary

| Repo | Verdict | What happened here |
|---|---|---|
| **Chatterbox** (resemble-ai) | **Adopted** (already in use) + extended | Multilingual Chatterbox already voices characters on a GPU. Added **Chatterbox Turbo** as an opt-in engine (`turbo`, English, about 4 GB more): it performs `[laugh]`, `[sigh]`, `[chuckle]` and other tags written into a line. Setup offers it, but nothing downloads it unless chosen |
| **faster-whisper** (SYSTRAN) | **Idea adopted**, via the Whisper already installed | Captions are now timed **word by word** from Whisper word timestamps (`voice/align_words.py`), matched back onto the script. It uses the Whisper-small model the speech check already downloaded (transformers), so there is no extra download. faster-whisper (MIT) would be a lighter CPU-only option later |
| **FFmpeg** | **Adopted much further** | Beyond encoding: procedural sound effects and a room tone per set (no sample files), per-line speech levelling, a limiter, and automatic QA (black and frozen frames, loudness, true peak, silence, contact sheet) |
| **Three.js** | **Adopted** (the engine) | Rendering at 60 fps, crossfade / dip / whip-pan / zoom-blur transitions in a GLSL compositing pass |
| **HyperFrames** (heygen-com, Apache-2.0) | **Architecture confirmed, ideas borrowed** | HyperFrames turns HTML into video by seeking each frame in headless Chrome and encoding with FFmpeg, which is exactly how `studio/` already works. Borrowed: shader transitions, caption-block styling, an agent that looks at its own output. Not added as a dependency: it needs Node 22+, and its block catalogue leans on GSAP (see below). A good candidate for a future `motion` engine (kinetic-typography explainers) |
| **Chrome DevTools MCP** (Apache-2.0) | **Idea adopted** | "The agent checks its own video" now happens without an extra server: `npm run qa` measures the video, `--listen` transcribes the final mix, and the new `video-critic` agent looks at a contact sheet and frames around every cut. The MCP is still useful for debugging the player page by hand |
| **Impeccable** (pbakaus) | **Idea adopted** | Its "review and polish" loop became the `video-critic` agent and the rubric in `.claude/skills/video-studio/references/quality.md`. No code was taken. Check its licence before copying any of its text |
| **GSAP** | **Not used; replaced** | Free since 2025, but under GreenSock's own "no charge" licence (not OSI open source), which forbids use in tools that compete with Webflow's visual builder. The easings this engine needs (springs, ease-out-back, cubic in-out) are about 20 lines in `src/engine/util.ts` |
| **Remotion** | **Not used** (licence) | A company with more than 3 people needs a paid Remotion licence. This repo already renders React-free with three.js + puppeteer + FFmpeg |
| **Remotion Skills** | **Not used** | It teaches an agent to build videos with Remotion, which is not used here. The general advice (frame-exact timing, springs, no real-time playback) is already how this engine works |
| **Blender** (GPL-2.0+) | **Deferred** | Real 3D models, rigs and Cycles renders would look richer, but Blender is a 300+ MB install and a render is minutes per shot instead of seconds per video. The output of Blender is not GPL, so it is a possible future `blender` engine for "hero" shots |
| **Blender MCP** (MIT) | **Deferred** | Only useful together with Blender |
| **ComfyUI** (GPL-3.0) | **Not used** | Image and video generation needs multi-GB models with their own (often non-commercial) licences and a strong GPU. Conflicts with constraints 1 and 3. The older `browser` engine already covers generated footage through the user's own accounts |
| **yt-dlp** (Unlicense) | **Not used** | Pulling clips or music from platforms raises copyright and terms-of-service problems for anything published. Music stays a file the user supplies |

## What changed in the engine because of this research

| Area | Before | After |
|---|---|---|
| Frame rate | 30 fps | **60 fps** by default (`fps: 30` renders in half the time) |
| Captions | phrases timed by character count | **bold word-by-word captions**: short groups pop in on a spring, the word being spoken lights up in the speaker's colour. Timed by Whisper (`words: whisper` in the log), or estimated from the voiced parts of the audio |
| Gestures | arms followed the per-frame mouth amplitude (twitchy) and snapped down when a line ended | arms follow a **slow speech-energy curve** (attack 0.22 s, release 0.55 s); the mouth releases gently |
| Expressions and head turns | an 8-frame box blur | **critically damped springs** (ease in and out), restarting at each cut like film |
| Eyes | a blink every 3.3 s exactly | **irregular blinks** (some double), **eye darts**, and eyes that lead the head toward whoever is talking |
| Mouth | open / shut | open plus a **width** track ("ee" wide, "oo" round) from the zero-crossing rate |
| Actions | 1 s sine bump, cut short when the line ended | eased attack, hold and release; `jump` has anticipation, flight and landing squash; actions finish even after the line ends |
| Camera | 7 slow moves | + **`punch-in`** (springy emphasis zoom after a cut); a tighter two-shot for vertical video |
| Transitions | hard cuts only | `cut` `fade` `dip` `whip` `zoom` |
| Sound | lines mixed and normalised | lines **levelled** to one loudness and de-clicked, speech at -16 LUFS, **sound effects** (whoosh, pop, ding, boing, thud, sparkle, typing), **room tone** per set, limiter (true peak ≈ -1.5 dBTP) |
| Voices | 4 engines | + opt-in **Chatterbox Turbo** with `[laugh]`-style tags; Edge `…MultilingualNeural` voices recommended; the speech check now understands numbers ("1%" = "one percent") |
| Checking | the agent looked at one still per shot | `npm run qa` (measurements + contact sheet + optional transcript), and a separate **video-critic** agent |

## Measured on the showcase story (`studio/projects/battery-low`, RTX 4060)

| | |
|---|---|
| Length | 28.5 s, 720×1280, 60 fps, 1,712 frames |
| Render | 25 s for the frames + about 10 s to encode and mix (6 parallel browser pages) |
| Voices | Chatterbox Multilingual for all three characters, Whisper speech check on every line |
| Word timing | Whisper for 9 of 9 lines |
| QA | PASS, -17 LUFS, true peak -1.4 dBTP, final mix transcribed back: 98% match with the script |

## Sources

- HyperFrames: https://github.com/heygen-com/hyperframes (Apache-2.0)
- Chatterbox Turbo model card: https://huggingface.co/ResembleAI/chatterbox-turbo (MIT, English, paralinguistic tags)
- Chatterbox: https://github.com/resemble-ai/chatterbox (MIT)
- faster-whisper: https://github.com/SYSTRAN/faster-whisper (MIT)
- Remotion licence: https://www.remotion.dev/license
- GSAP licence: https://gsap.com/standard-license

## Round 2: the "Opus 5.5 motion design" article and the reference reel

The follow-up article (@seeconvm, "What the viral one-prompt videos are hiding") and its reel, a soft orange cube mascot in a "Motion Mart" shop, set the visual and process bar. All 13 links in the post point to the repos above. What the article recommends, and where it now lives here:

| The article's piece | Here |
|---|---|
| **Frame function**: `seek(t)` paints any frame on its own, no timers, seeded noise | Already the design (`window.studio.renderFrame(frame)`, precomputed tracks, seeded `rng`). New: QA **renders a frame twice, and on a second page, and compares the pixels** (PSNR; GPU rounding of about 100 dB passes, a real state bug does not) |
| **The brief**: a production document, not a vibe | The director saves the approved treatment as `projects/<slug>/brief.md` |
| **The reference**: borrow a visual grammar from a frame or clip | A user reference becomes `projects/<slug>/style_guide.md` (palette, set, shot length, cameras, transitions, what to avoid), reused for the whole series. Take the grammar, never the subjects |
| **Springs and sound on one clock** | Closed-form springs for captions, titles and punch-ins; springs for expressions and turns; effects synthesised by ffmpeg and placed on the timeline's frames. Loudness raised to **-14 LUFS** |
| **The critic**: contact sheet, strip around the fastest move, phone test at 360 px, determinism; score 1-10, fix the worst 3, repeat until 8+ | `npm run qa` now writes `phone/`, `strip.jpg`, a poster frame and the determinism result. The `video-critic` gives six 1-10 scores (hook, phone, motion, variety, sound, story) and the 3 worst defects first; the director loops until every score is 8+, at most 2 rounds, logging each in `reviews.md` |
| **Banned defaults** (centred title on a gradient, everything fading in...) | A "Banned defaults" list in `references/quality.md` |
| **The skill**: decisions in files, gates | `brief.md`, `style_guide.md`, `story.json`, `reviews.md` per project; the one confirmation before the build is the gate |

**The look of the reference reel** (rounded, glossy toy characters, soft light, a background melting into bokeh) became the new default `look.style: "soft"`. It uses rounded-box geometry, physical materials with clearcoat and sheen, glossy pill eyes and capsule brows, a studio environment map, soft shadow maps, depth of field focused on the subject, a gentle bloom, and emotion extras (a sweat drop, tears, blush). All of it comes from three.js's own examples (MIT): `RoundedBoxGeometry`, `RoomEnvironment`, `EffectComposer`, `BokehPass`, `UnrealBloomPass` and `OutputPass`. Nothing new is installed. `look.style: "lowpoly"` keeps the old look.

Not adopted from the article: generate-then-trace with a video model (Seedance) and overnight 12-hour runs. Both need paid services or accounts, which this repo avoids.
