# Format: talkstuff

Pixar-style talking-object videos: an everyday object with a face, a personality and 10 seconds of lip-synced speech. This file is the content contract for the format. The `video-studio` skill reads it for options and prerequisites, and the `video-producer` agent reads it to plan the run and to know how to build the plan.

## Options

| Option | Default | Meaning |
|---|---|---|
| `--chars` | `1` | `1` = main character only. `5` = main character plus the 4 related characters. |
| `--writer` | `gpt` | `gpt` = the TalkStuff GPT on ChatGPT. `claude` = Claude writes the plan from the rules below, with no ChatGPT step. **Switch to `claude` automatically from 2026-12-11**, when ChatGPT retires GPTs, or whenever the GPT can't be reached. |

Planner site (needed only when `--writer gpt`): `chatgpt.com`.

## Planning

### writer = gpt

1. Navigate to `https://chatgpt.com/g/g-6a081a19f0ac8191a9e843d219941fb9-talkstuff`. This opens a new chat with the TalkStuff GPT. If the page says the GPT is unavailable or retired, return `FAILED` with "GPT unavailable – rerun with --writer claude".
2. Find the composer (hint: `#prompt-textarea`), type the topic verbatim, and press Enter. If the topic is a long summary, prefix it with: `Pick the best everyday object, emotion and setting for this, then do your full output:`
3. Wait until the reply has finished: the stop button (hint: `[data-testid="stop-button"]`) is gone and the length of the last assistant message stays the same across two checks.
4. Extract the reply:
   - Full text: `[...document.querySelectorAll('[data-message-author-role="assistant"]')].pop().innerText`
   - Image prompts, in order: `[...lastMsg.querySelectorAll('pre')].map(p => p.innerText)`. The first is the main character, the next 4 are the related characters.

   If `javascript_tool` output is blocked, use `get_page_text` instead. If the GPT only replied with its welcome menu, send the topic again.
5. Save the raw reply to `<out>/01-talkstuff.md`. Then write `<out>/plan.json` as described below.

Ignore the GPT's closing line about OpenArt/ElevenLabs. This pipeline uses Gemini and Flow/Grok instead.

### writer = claude

Write `<out>/plan.json` yourself from the rules in the next section.

## What TalkStuff produces for one topic

Input style: `"<object>, <emotion>, <setting>"`, for example `Toothbrush, angry, bathroom sink`. If the user gives a summary or article, first choose the everyday object that best carries its message, plus an emotion and a setting.

1. **Main character**
   - **Personality** (3 adjectives), **emotional theme**, and **visual style**: cinematic Pixar-style 3D, exaggerated expressions, glossy textures, dramatic lighting.
   - **Image prompt**, one block, with these sections in order: CHARACTER DESIGN, FACIAL FEATURES (eyes, eyebrows, mouth), ARMS AND GESTURES (small cartoon arms and legs), SCENE, LIGHTING AND CAMERA, COMPOSITION, STYLE. End with "No text, no watermark, no extra characters."
   - **10-second script**: first person, 3 short punchy lines, about 25–30 words in total, so it fits an 8–10 s clip. Note the emotion and the voice type.
   - **Animation direction**: what happens at 0–3 s, 3–7 s and 7–10 s.
   - **Fact** (optional): one real, checkable fact that the script relies on.
2. **Four related characters**: objects from the same scene or theme, each with its own image prompt (same sections) and 10-second script.
3. **Series style**: vertical 9:16, 10 s per character, close-up with subtle movement, lip-sync, expressive comedic voice, sound effects that suit the scene, quick cuts.

## plan.json (written to the output folder)

The shared pipeline only needs `items[]` with `id`, `name`, `image_prompt` and `video_prompt`. The other fields are TalkStuff's own, kept for reference and later runs.

```json
{
  "format": "talkstuff",
  "topic": "Toothbrush, angry, bathroom sink",
  "series_style": "Vertical 9:16, Pixar-inspired 3D, close-up, exaggerated lip-sync, comedic angry voice, water-drip SFX",
  "items": [
    {
      "id": "01-angry-toothbrush",
      "name": "Angry Toothbrush",
      "image_prompt": "Create a high-quality Pixar-style 3D animated character of … No text, no watermark, no extra characters.",
      "video_prompt": "<built from the template below>",
      "video_prompt_short": "<same template, script cut to its 2 strongest lines>",
      "object": "toothbrush",
      "emotion": "furious",
      "voice": "high-energy, irritated, slightly raspy cartoon voice",
      "script": ["HEY! You use me for ten seconds and call that brushing?!", "I'm fighting plaque while you rush out like a maniac!", "Brush for two minutes, twice a day—or don't blame me for your cavities!"],
      "animation": ["0-3s: glares at camera, waving arms angrily", "3-7s: points at toothpaste, stomps feet", "7-10s: leans forward, raises an eyebrow, shouts final warning"],
      "sfx": "water drips, cartoon stomps"
    }
  ]
}
```

`items[0]` is always the main character. When `chars = 1`, only `items[0]` is generated. The others can stay in the file for later runs.

## Video prompt template

Build `video_prompt` from one item:

```
Animate this exact character. Keep its design, colors and proportions identical to the image.
Vertical 9:16, Pixar-style 3D animation, cinematic lighting, subtle camera push-in.
Action: <animation joined with "; ">.
The <object> speaks directly to camera in a <voice>, with exaggerated lip-sync, saying:
"<script joined with " ">"
Sound: <sfx>. No subtitles, no on-screen text, no music over the dialogue.
```

Flow/Veo clips are usually about 8 s. Build `video_prompt_short` the same way but with the script cut to its 2 strongest lines, so the tool never cuts it off mid-word. The agent uses it when the tool limits prompt or clip length.
