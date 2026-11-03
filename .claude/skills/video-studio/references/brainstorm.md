# Intake, questions and brainstorm

How the director turns a rough request into a story worth rendering. Everything here happens **in the main conversation** (never inside the worker agent), because only the main conversation can ask the user questions.

## 1. Read the request first

Pull out everything the user already said, so you never ask for it again:

| Slot | Examples of what counts as answered |
|---|---|
| **Story / premise** | a plot, a topic, an article, a moral, a product, "explain X", "a story about a lazy cat" |
| **Length** | "30 seconds", "short", "one minute" |
| **Tone** | "funny", "scary", "wholesome", "serious" |
| **World / look** | "in space", "a park", "an office", "cozy" |
| **Characters** | named or described ones; "a robot and a kid" |
| **Language** | the language they wrote in, or an explicit request |
| **Purpose / audience** | "for kids", "for our team", "for Reels/Shorts/TikTok", "to explain onboarding" |
| **Anything fixed** | exact lines, a title, an ending, a moral, brand colours, a music file |

If the user supplied a **full script**, skip brainstorming: keep their words exactly, only ask the questions needed to stage it (world, characters' looks), then go to the treatment.

If the user says **"surprise me", "you decide", "just make it", "automatic"**: do not ask questions. Brainstorm silently, pick the strongest concept, show the treatment in one short message, and go straight to the build unless they asked to review first.

## 2. Ask only what is missing, in one or two rounds

Use `AskUserQuestion`: 1 to 4 questions per call, 2 to 4 options each, a short `header` (max 12 characters), the recommended option first with "(Recommended)". The tool always adds an "Other" so people can type their own answer. **Maximum two calls before the brainstorm.** If three or more slots are already known, one call is enough. Never ask a question whose answer you can infer from the request.

### Round 1: creative direction (ask the slots that are still unknown)

| Header | Question | Options (first = default) |
|---|---|---|
| Length | How long should the video be? | **Standard, ~35 seconds (Recommended)** · Short, ~20 seconds · Long, ~60 seconds |
| Tone | What feel should it have? | **Funny (Recommended)** · Heartwarming · Dramatic with a twist · Calm explainer |
| World | Where does it take place? | **Night city rooftop** (`skyline-night`) · Space / digital world (`space-stage`) · Cozy room (`cozy-room`) · Sunny park (`sunny-park`). Office (`office-day`) and neutral stage (`studio`) are reachable through "Other" |
| Cast | Who is in it? | **Let Claude design the characters (Recommended)** · A person and a talking robot/gadget · Two people · A person and a pet/creature |

Add these only when they apply:

| Header | When | Options |
|---|---|---|
| Language | the user wrote in Hindi, Gujarati or another non-English language, or asked for one | The language they used · English · Other. Check the voice table in [formats/story.md](../formats/story.md) |
| Audience | the purpose is unclear and it changes the writing | Social media viewers · Colleagues / internal · Kids · Customers |
| Moral | the story should teach or sell something | Let Claude choose · I will tell you (Other) |

Do not ask about voices, camera, resolution, music, captions or colours. Choose sensible values yourself and say what you chose in the treatment. The user can change them afterwards.

## 3. Brainstorm: three genuinely different concepts

Based on the answers, invent **three distinct angles**, not three variations of one joke. They should differ in premise or structure (for example: an argument that escalates, a misunderstanding reveal, a role reversal, a countdown, a confession). For each, write:

- **Title** (2 to 4 words)
- **Logline** (one sentence)
- **Cast and world** (who, which set)
- **The hook line** (the first spoken line, in the first two seconds)
- **The turn** (what changes in the middle)
- **The last line** (the punchline or ending)

Show them with `AskUserQuestion`: one question, three options, with the full outline in each option's `preview` field so the user can compare them side by side. Put your strongest in first place and mark it "(Recommended)". The user can pick one, or type a mix ("2 but with the ending of 3") under "Other".

Sanity-check each concept before showing it:
- Can it be told in the engine's vocabulary (humans, cubes, blobs; six sets; talking, gestures, laptop screens)? No car chases, crowds, fight scenes, or anything needing props the engine does not have. Reshape the idea until it can.
- Is it 20 to 60 seconds of talking, not a lecture?
- Does the hook work with sound off (captions are on screen)?
- Is it safe to publish (no real people mocked, no harmful claims)?

## 4. Treatment, then one confirmation

After the pick, write the full plan **in the chat** in a compact form:

```
Title · length · set · characters (voice, look in a few words)

s01 [two-shot, push-in]  DEV (worried): "Hey Bolt. Tiny favour. Just one small change."
s02 [close on Bolt]      BOLT (smug): "That is exactly what you said at nine this morning."
...
Music: none · Captions: top · Voices: Microsoft Edge free voices (needs internet)
```

Then ask one final `AskUserQuestion` with these options:

| Option | Meaning |
|---|---|
| **Generate the video (Recommended)** | build it now |
| Change something first | the user types what to change; revise the treatment, show it again, ask again (at most twice) |
| Generate with offline voices | `--provider sapi`: Windows built-in voices, robotic but fully offline |

Include in the question text: "The dialogue text is sent to Microsoft's free text-to-speech service to make the voices; nothing else leaves your computer." This is the only network use besides the first-time `npm install`.

## 5. After the build: offer to iterate

A 30-second video renders in well under a minute, so make iteration cheap. After delivering the video, offer the most useful tweaks as a short list (not a question dialog): change a line, swap a voice, different set, different ending, add a title card, make it longer or shorter, render in 1080p. Re-running only needs the changed `story.json`; the pipeline caches voices for lines that did not change.
