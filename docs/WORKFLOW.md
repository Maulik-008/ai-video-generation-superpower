# The video workflow, end to end

How a sentence typed into Claude Code becomes a finished, checked MP4. Three roles share one quality bar ([quality.md](../.claude/skills/video-studio/references/quality.md)):

| Role | Where it lives | Talks to the user | Job |
|---|---|---|---|
| **Director** | skill `video-studio` ([SKILL.md](../.claude/skills/video-studio/SKILL.md)) | yes, the only one that does | Understand, ask, brainstorm, script, write `story.json`, run the review, apply technical polish, deliver |
| **Producer** | agent `video-producer` ([video-producer.md](../.claude/agents/video-producer.md)) | no | Build, read QA, look at the stills and the contact sheet, fix technical problems, verify |
| **Critic** | agent `video-critic` ([video-critic.md](../.claude/agents/video-critic.md)) | no, and it never edits | Watch the result with fresh eyes, score it against the rubric, return ranked fixes as exact `story.json` edits |
| Setup | skill `setup-video-studio` | yes | First-time install, with every download chosen by the developer |

## The flow

```
 /video-studio <idea>
        │
 1  UNDERSTAND   read what the user already said (premise, length, tone, world, cast, language)
 2  ASK          AskUserQuestion, only for what is missing, max 2 rounds
 3  BRAINSTORM   3 genuinely different concepts; the user picks one
 4  SCRIPT       treatment + shot list + cameras + transitions; ONE confirmation covers the build
 5  WRITE        studio/projects/<slug>/story.json  ->  npm run validate
        │
 6  PRODUCE  (video-producer agent)
        │   voices      each character on its best engine: turbo > chatterbox > kokoro > edge > sapi,
        │               every clip checked (silence, clipping, length; Whisper for Chatterbox), cached
        │   timing      Whisper word timestamps matched onto the script (or an audio-based estimate)
        │   timeline    frames, caption groups, mouth + width tracks, transitions, effects, room tone
        │   render      three.js in 6 headless Chrome pages, 60 fps, springs for every motion
        │   mix         speech levelled -> -16 LUFS -> effects + room tone -> limiter -> H.264 + AAC
        │   QA          black / frozen picture, loudness, true peak, silence, pacing, captions,
        │               contact sheet, Whisper transcript of the final mix (--listen)
        │   fix         technical fixes only, max 2 rebuilds  ->  STATUS: DONE
        │
 7  REVIEW   (video-critic agent)  contact sheet + stills + frames at every cut + QA report
        │                          -> VERDICT ship | polish | rework, score, ranked fixes
        │   polish     the director applies the technical fixes, ONE rebuild
        │   creative   never applied silently: offered to the user as the first tweak
        │
 8  DELIVER  path, length, voices, score, what was polished  ->  offer quick tweaks (cached, ~1 min)
```

## What is automatic, and what the director decides

| Automatic (engine defaults) | Director's choices per story |
|---|---|
| 60 fps, bold word-by-word captions, Whisper timing | Characters, sets, voices (prefer Edge `…MultilingualNeural`, distinct Kokoro ids), `delivery` |
| Springs for expressions and head turns, energy-driven gestures, irregular blinks, eye darts, mouth width | `camera.type` / `focus` / `move` per shot, `punch-in` on beats |
| Room tone per set, speech levelling, limiter | `transition` where the story jumps (`whip`, `zoom`, `fade`, `dip`) |
| Whoosh on whip/zoom, pop on titles, boing on jumps, typing on inserts | 1 or 2 chosen `sfx`; `[laugh]`-style tags only when `turbo` is ready |
| QA after every build | `look.laptop: false` when no computer is in the story |

## Live test (November 2026, Windows 11, RTX 4060)

The flow was run on a new story, `battery-low` (3 characters, 2 sets, 10 shots, all 4 transitions):

1. **Build 1**: Chatterbox voiced Maya and Momo. One of Zip's lines failed the speech check, because Whisper wrote "1%" for "one percent", so Zip fell back to Kokoro. The fallback worked as designed. The check was fixed to understand numbers.
2. **Build 2**: all three characters on Chatterbox. QA: PASS, 98% speech match, -17 LUFS, -1.4 dBTP. Two-shots were then tightened for vertical video, and the laptop prop was hidden (`look.laptop: false`).
3. **Critic**: `ship`, score 82, with four technical fixes: s10 fade → cut (the crossfade ghosted Maya over the punchline), `hold` 0.8 → 0.4, s05 shrug → point, s01 two-shot → medium on Zip. It also reported five gaps in its own instructions, which were fixed.
4. **Polish build**: all four fixes applied; QA: PASS, 98%.

Regression: `example-small-change`, `hindi-chai` (Devanagari bold captions render correctly) and `the-3am-deploy` all rebuild. QA correctly flags their older pacing (a 2.5 s title card before the hook, three close-ups in a row, Edge lines at 4+ words per second).

### Round 2 of the live test: the soft look and the scored critic

| Pass | Verdict | hook | phone | motion | variety | sound | story | Overall |
|---|---|---|---|---|---|---|---|---|
| Soft look, first build | polish | 8 | 8 | 6 | 8 | 7 | 7 | 70 |
| After the 3 worst fixes (s06 punch-in pushed Momo off-frame, s02 close cropped Maya, s01 hook framing) | polish | 8 | 7 | 8 | 8 | 8 | 8 | 82 |
| After the 2-round cap: s02 and s06 made static so no face rises into the caption band | delivered | | | | | | | QA PASS, 98% speech match, deterministic |

The critic's creative suggestions were not applied, because they change the story and need the user's yes. They were: recolour Zip so he separates from the red cozy room (rubric B10), and say "Momo, the cat" so the blob reads as a cat.
