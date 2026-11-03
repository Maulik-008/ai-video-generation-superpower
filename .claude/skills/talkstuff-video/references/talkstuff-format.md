# TalkStuff format and plan.json

The pipeline uses this content contract. The TalkStuff GPT produces it. With `--writer claude`, Claude writes it directly using the rules below.

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

Ignore the GPT's closing line about OpenArt/ElevenLabs. This pipeline uses Gemini and Flow/Grok instead.

## plan.json (written to the output folder)

```json
{
  "topic": "Toothbrush, angry, bathroom sink",
  "series_style": "Vertical 9:16, Pixar-inspired 3D, close-up, exaggerated lip-sync, comedic angry voice, water-drip SFX",
  "characters": [
    {
      "id": "01-angry-toothbrush",
      "name": "Angry Toothbrush",
      "object": "toothbrush",
      "emotion": "furious",
      "voice": "high-energy, irritated, slightly raspy cartoon voice",
      "image_prompt": "Create a high-quality Pixar-style 3D animated character of … No text, no watermark, no extra characters.",
      "script": ["HEY! You use me for ten seconds and call that brushing?!", "I'm fighting plaque while you rush out like a maniac!", "Brush for two minutes, twice a day—or don't blame me for your cavities!"],
      "animation": ["0-3s: glares at camera, waving arms angrily", "3-7s: points at toothpaste, stomps feet", "7-10s: leans forward, raises an eyebrow, shouts final warning"],
      "sfx": "water drips, cartoon stomps"
    }
  ]
}
```

`characters[0]` is always the main character. When `chars = 1`, only `characters[0]` is generated. The others can stay in the file for later runs.

## Video prompt template (Flow / Grok)

Build this from one character entry:

```
Animate this exact character. Keep its design, colors and proportions identical to the image.
Vertical 9:16, Pixar-style 3D animation, cinematic lighting, subtle camera push-in.
Action: <animation joined with "; ">.
The <object> speaks directly to camera in a <voice>, with exaggerated lip-sync, saying:
"<script joined with " ">"
Sound: <sfx>. No subtitles, no on-screen text, no music over the dialogue.
```

If the tool limits prompt length or clip length (Flow/Veo clips are usually about 8 s), shorten the script to its 2 strongest lines rather than letting it get cut off mid-word.
