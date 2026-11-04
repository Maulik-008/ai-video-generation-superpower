# Quality bar: what makes a video people watch to the end

One rubric, used at three moments: the **director** writes to it, the **video-producer** checks the technical half after every build, and the **video-critic** scores the finished video against all of it. Each item says what to look for and the cheapest fix in `story.json`.

The engine already does the following by default, so nobody has to ask for it: the soft "clay toy" look (rounded shapes, glossy eyes, soft shadows, reflections, depth of field, a little bloom), 60 fps, bold word-by-word captions timed by Whisper, voices levelled to one loudness, a room tone for every set, automatic sound effects, springy expressions with sweat drops, tears and blush, gestures that follow the speech, and irregular blinks and eye darts.

## Banned defaults (they make every AI video look the same)

- A title card centred on an empty background as the first thing on screen. Open on the hook line instead.
- Everything fading in. Cuts, punch-ins and the caption pop carry the energy; a fade is for one emotional beat.
- A transition on every cut, or the same transition twice in a row.
- A recap or moral after the punchline.
- Every line on the same framing, or every character speaking at the same pace.
- An effect on every beat. If the sound means nothing with your eyes closed, it is noise.

## A. Engagement (the first 3 seconds decide everything)

| # | Check | Pass when | Fix |
|---|---|---|---|
| A1 | **Hook** | Words start by 1.5 s (QA warns after 2.2 s), and the first line is a problem, a shock, a question or a weird claim | Drop the title card, or cut the opening shot's `duration`/`lead`; move the strongest line first |
| A2 | **Pattern interrupt every 2 to 4 s** | Something changes at least every 4 s: a cut, a `punch-in`, an `action`, a sound effect, a new character | Split long shots; add `"move": "punch-in"` on the beat after a reveal |
| A3 | **Escalation** | Each exchange raises the stakes or adds a twist; no line repeats information | Director rewrites (creative: ask the user if the script was theirs) |
| A4 | **Payoff** | The last line is the best line, on a `close`, and the video ends within 1 s of it | Move the punchline last; `hold` ≤ 0.8 s; no recap after it |
| A5 | **Length** | 20 to 45 s for vertical shorts | Cut the weakest exchange |
| A6 | **Distinct voices** | You can tell who speaks with your eyes closed | Different voices; for Edge push `rate`/`pitch` apart; for Chatterbox raise `expressiveness` on the comic character |
| A7 | **Faces react** | The listener's face shows a feeling before they answer | `reactions` on the shot; an `emotion` on every line |

## B. Motion and picture

| # | Check | Pass when | Fix |
|---|---|---|---|
| B1 | **Framing** | Every `close`/`medium` shows the focus character's face fully, roughly facing the camera | `close` → `medium`, change `focus`, or lower the character's `scale` |
| B2 | **Nothing blocks a face** | Props (laptop, table, lamp) never cover eyes or mouth | `"look": { "laptop": false }` when the story has no use for it, or change the camera type |
| B3 | **Camera language** | Never the same framing 3 times in a row; `wide` only to open, re-establish or end | Alternate two-shot, close, over-shoulder |
| B4 | **Transitions are rare and meaningful** | Hard cuts inside a scene. `whip` or `zoom` for a jump in place or time, `fade` for an emotional beat, `dip` for "later". At most 3 or 4 per video | Remove extras; put `whip` on the shot that changes `set` |
| B5 | **No dead picture** | QA reports no black or frozen stretch longer than 1.6 s | Give long shots a move (`push-in`, `drift-*`, `orbit`), or split them |
| B6 | **Smoothness** | `fps` 60 (default). 30 only when the user wants faster renders | Remove `"fps": 30` |
| B7 | **Phone readability** | On the 360 px phone frames (`out/qa/phone/`) every face, caption and screen text is still clear | Bigger framing (`medium` → `close`), fewer words per line, `look.captions.size` up |
| B8 | **Seekable** | QA's determinism check says the frame is identical on revisit and on a second page | An engine bug if it fails: report it, do not ship |
| B10 | **Colour separation** | Each character stands out from its set: a different hue or clearly lighter or darker than the wall and floor behind it, also at 360 px | Creative: change the character's `look.body` / `outfit`, or the shot's `set` (ask the user) |
| B9 | **Soft look** | `look.style` `soft` (default), the background melts behind the subject in close-ups | `lowpoly` only when the user asks for the faceted look; `look.depthOfField: false` for a sharp background (diagrams, a screen that must be read) |

## C. Captions

| # | Check | Pass when | Fix |
|---|---|---|---|
| C1 | **Readable** | Bold captions over a calm area, never on the eyes | Whole video: `look.captions.position` `top` (default) / `middle` / `bottom`. One shot: change its camera (a `push-in` that lifts the face into the caption band becomes `static`, or `close` becomes `medium`) |
| C2 | **In sync** | QA says Whisper timed every line (an `info` line counts the estimated ones) | Estimated timing is still usable. Install the Chatterbox environment for exact timing |
| C3 | **Short groups** | No caption group wraps to three lines | Shorten words, or split the line |
| C4 | **No emoji, no tags shown** | `[laugh]`-style tags never appear in captions (the engine strips them) | None needed |

## D. Sound

| # | Check | Pass when | Fix |
|---|---|---|---|
| D1 | **Loudness** | About -14 LUFS, the level social platforms play at (QA accepts -17 to -11), true peak below -0.5 dBTP | Automatic. If not, report it |
| D2 | **Speech is right** | QA `--listen` match ≥ 0.85 in English, ≥ 0.7 in other languages | Find the line that differs; change that character's engine or voice |
| D3 | **Delivery fits** | Comedy `natural`; gentle `warm`; heartfelt, apology, bedtime `calm` | Set `voice.delivery` |
| D4 | **Effects support, never decorate** | At most one effect per 3 s; the automatic ones (whoosh on whip/zoom, pop on titles, boing on jumps, typing on inserts) plus 1 or 2 chosen ones | Remove `sfx`, or `look.sfx: false` for a quiet piece |
| D5 | **Non-verbal sounds** | `[laugh]`, `[sigh]`, `[chuckle]` only where a person would really do it, at most one per character per video | Only the `turbo` engine performs them; elsewhere they are skipped silently |
| D6 | **No dead air** | Pauses never fall into digital silence (the room tone covers them) | Keep `look.ambience` on |

## Scores, for the critic

Score each 1 to 10 from the rendered frames and the QA numbers only, never from what the script intended:

| Score | Covers |
|---|---|
| **hook** | A1, A5: words and a reason to stay in the first 2 seconds |
| **phone** | B7, C1, C3: readable at 360 px |
| **motion** | B1, B2, B5, B6, B9: framing, nothing frozen, smooth, the soft look working |
| **variety** | A2, B3, B4: something changes every 2 to 4 seconds, framings alternate, transitions meaningful |
| **sound** | D1 to D6, plus effects landing on the beat they belong to |
| **story** | A3, A4, A6, A7: escalation, payoff last, distinct voices, faces that react |

8 or more on every score ships. Below that, the 3 worst defects get fixed first.

## Severity, for the critic

- **must-fix**: breaks the video. A face hidden or cut off, unreadable or wrong captions, wrong speech, a black or frozen stretch, the hook after 3 s.
- **should-fix**: costs viewers. A weak hook, a flat stretch longer than 4 s with no change, voices too alike, a transition that jars, the payoff buried.
- **polish**: nice to have. A better move, an effect, a reaction.

Technical fixes (camera, transitions, sound effects, timing, captions, laptop, fps) never change the story, so they can be made without asking. Changes to words, characters or plot are creative: the director proposes them to the user.
