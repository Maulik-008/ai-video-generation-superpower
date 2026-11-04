# Format: kahani (cinematic AI story reels, Hindi / Urdu / English)

Multi-scene story reels in the style of the most-shared Indian and Pakistani AI reels: Pixar-style photoreal characters (vegetables, fruits, organs, objects, animals) in a culturally exact desi world, speaking Hindi or Urdu, one 8-second scene per beat, a moral, a joke or a cliffhanger at the end. There is also a hand-painted **2D POV** variant (no dialogue, a song, times of day on screen). The method comes from four reference reels; [docs/REFERENCE_ANALYSIS.md](../../../../docs/REFERENCE_ANALYSIS.md) has the analysis. Take the craft, never their characters, names or brands.

Engine: **`browser`** ([engines/browser.md](../engines/browser.md)): Gemini makes the images, Google Flow (Veo 3) or Grok makes the clips, with the user's own accounts and credits. Then `npm run stitch` in `studio/` assembles the reel locally. The free `studio` engine can draft the same story first in the clay-toy look (see "Draft for free" below).

## Options

| Option | Default | Meaning |
|---|---|---|
| `--style` | `pixar` | `pixar`: cinematic 3D, photoreal textures, golden light, shallow depth of field. `2d-pov`: hand-painted 2D, soft pastel, big eyes, heavy vignette |
| `--world` | from the story | `village` (mud houses, charpai, clay pots, fields), `city` (flats, showroom, cafe), `body` (organs at work inside a body "factory" and "control room"), `kitchen`, `school`, `office`, or any other place |
| `--motion` | `veo` for pixar, `kenburns` for 2d-pov | `veo`: every scene is an 8 s Veo clip, dialogue spoken in the clip (credits). `kenburns`: every scene is a still with a slow camera move made by ffmpeg (no video credits; good for 2D POV and narration) |
| `--lang` | the user's language | `hi` (Devanagari), `ur`, `hinglish` (Hindi in Latin letters), `en`, `gu`... Dialogue is written in it |
| `--part` | `1` | Series part. Part 2 reuses the same `characters.json` so everyone looks the same |
| `--length` | `60` | Seconds. 45 to 90. One scene per 8 s with `veo`; 4 to 5 s per scene with `kenburns` |

## The formula (what the reference reels share)

1. **A desi world everyone recognises, made adorable.** Everyday things become characters with a job and a nickname, for example Aloo, Pyaaz Bhai, Tamatar, Karela Seth, Mooli, Gobhi Chacha, Dimagu Bhai (brain), Petu Lal (stomach), Liver Kaka, Kidney Didi, Dil Kumar (heart). Exact costume and set: kurta-pajama with a waistcoat, a dupatta, a dhoti, a school uniform; a charpai, a clay matka, a tea stall, a jeweller's counter, an auto-rickshaw.
2. **The hook is the situation.** The first frame shows the conflict: a table of cash, diamonds spilling, the fridge raided at 2 a.m. No title card.
3. **One scene = one beat = one or two lines.** 8 seconds, then the place, the time or the speaker changes.
4. **A shape:** setup → temptation or trouble → consequence → payoff. Pick one:
   - **Fable**: two choices, two outcomes, a one-line moral.
   - **Comic crime / masala**: a secret, jealous neighbours, a scheme, a cliffhanger ("Part 2 dekhna hai to follow karo").
   - **Body explainer**: a bad habit, the organs panic, the gentle fact, the moral. Facts must be true.
   - **POV nostalgia (2D)**: a relatable childhood or family memory told with times of day, no dialogue, a warm payoff.
5. **Voices with character**: colloquial Hindi or Urdu ("maalik", "bhai", "yaar", "arre", "kuch to gadbad hai"), one running joke, one catchphrase per character.
6. **Cinematic light in every frame**: golden hour, practical lamps, rim light, shallow depth of field. Any frame could be the thumbnail.
7. **End on the series**: a cliffhanger plus "PART 2 / Follow", or a moral, then the handle.

## Planning: files in the output folder

The director (Claude) writes all of these. No external planner is needed.

### 1. `characters.json`: the character bible (it keeps everyone the same across scenes and parts)

```json
{
  "style": "pixar",
  "style_lock": "Pixar-style 3D animated film still, photoreal textures, soft global illumination, warm cinematic lighting, shallow depth of field, expressive cartoon face with big glossy eyes, small arms and legs, vertical 9:16",
  "characters": [
    { "id": "aloo", "name": "Aloo", "role": "simple, honest farmer, the hero",
      "look": "a plump golden-brown potato with light freckle spots, big kind brown eyes, a small smile, wearing a white kurta-pajama with a black waistcoat, barefoot",
      "voice": "warm, slightly nasal adult male, rustic Hindi, says 'arre bhai' often",
      "ref_prompt": "<style_lock>. Character sheet of ONE character, full body, front view, plain warm grey background: <look>. No text, no watermark." }
  ]
}
```

Rules: 2 to 5 characters. Each `look` is concrete (shape, colour, texture, eyes, clothes, one prop) and is **pasted word for word** into every scene that character appears in. Original characters only: never a real person's likeness, a celebrity, or another creator's named character or brand. Invent your own brand names for props.

### 2. `plan.json`: the scenes (the shape the browser pipeline and `npm run stitch` read)

```json
{
  "format": "kahani", "title": "Aloo ke Heere (Part 1)", "style": "pixar", "motion": "veo", "lang": "hi",
  "transition": "cut",
  "overlay": { "handle": "@your_handle" },
  "endcard": { "text": "PART 2", "sub": "फ़ॉलो करें · Follow", "seconds": 2.5 },
  "items": [
    { "id": "s01", "name": "Diamonds on the charpai", "label": "रात 2 बजे",
      "characters": ["aloo", "mooli"],
      "image_prompt": "<style_lock>. Top-down shot of a village courtyard at night, moonlight and a lantern: <aloo.look> and <mooli.look> wake up shocked on a wooden charpai covered in sparkling diamonds. Exact same characters as the reference images. No text, no watermark.",
      "video_prompt": "<built from the template below>",
      "dialogue": [{ "who": "mooli", "line": "अरे! ये हीरे कहाँ से आए?" }, { "who": "aloo", "line": "पता नहीं... पर अब हम अमीर हैं!" }],
      "seconds": 8 }
  ]
}
```

- `label` (optional) shows as a pill on screen: a time of day ("5.30 pm", "सुबह 6 बजे") or a name the first time a character appears ("Liver Kaka").
- `overlay.title` (optional, for POV reels) is shown the whole time, for example `["POV", "mom goes to the bazaar"]`.
- `endcard` (optional): "PART 2" plus follow for a series; leave it out when the reel ends on a moral.
- `seconds`: 8 for Veo clips; 3.5 to 5 for `kenburns` stills.
- `transition`: `cut` for Veo stories (every reference reel cuts), `dissolve` for 2D POV.

### 3. `music` (optional)

`"music": { "file": "my-song.mp3", "volume": 0.2 }` in `plan.json`, a file the user owns or has licensed. For a commercial song, publish without it and add it inside Instagram's audio library. **Never download songs or clips from the web** (no yt-dlp): that breaks copyright and the platforms' terms.

## Scene writing rules

- **Length**: 6 to 10 scenes for a 60 s reel with `veo`; 10 to 14 with `kenburns`.
- **Dialogue per Veo scene**: 1 to 2 lines, at most about 18 Hindi words in total, so it is spoken in 8 s without being cut off. Put the speaker's name and emotion next to each line.
- **Change something every scene**: the place, the time of day, the speaker, or the camera (wide establishing, medium two-shot, close reaction, top-down, low angle, over-the-shoulder, a POV through a window or monitor).
- **Scene 1 is the hook**; the last scene is the payoff or the cliffhanger.
- **Body explainers**: one health fact, true and mainstream (check it), said by a character, never a cure or medical advice.
- **Crude humour** (the potato's diamonds) is fine at the reference reels' level. No slurs, no mocking a religion, caste, region or disability, no real people.

## Video prompt template (Veo 3 with speech)

```
Animate this exact image as the first frame. Keep every character's design, colours, clothes and proportions identical.
Vertical 9:16, Pixar-style 3D animation, cinematic lighting, <camera: e.g. slow push-in / gentle handheld / static>.
Action: <what each character does in 8 seconds>.
<Name> (<voice>, <emotion>) says in Hindi: "<line>"
<Name2> (<voice2>, <emotion>) replies in Hindi: "<line2>"
Natural lip-sync for whoever is speaking. Ambient sound: <village evening / showroom hum / factory machines>, <one SFX>.
No subtitles, no on-screen text, no music.
```

Keep the dialogue in the script of the language (Devanagari for Hindi, Nastaliq for Urdu): Veo voices Hindi and Urdu best from the native script. Say "says in Hindi" (or Urdu) explicitly. Keep the same voice description for a character in every scene, so it sounds like the same person.

For **`2d-pov`**, use this image style lock: `Hand-painted 2D illustration, soft pastel colours, gentle grain, warm sunset light, heavy soft vignette, simple rounded characters with big glossy eyes and rosy cheeks, Indian home details, vertical 9:16, no text`. With `--motion kenburns`, no video prompts are needed: give each item a `motion` (`push-in`, `pull-out`, `pan-left`, `pan-right`) and `seconds`.

## Stages (the browser runbook does the clicking)

1. **Character sheets**: one Gemini image per character from `ref_prompt`, all in **one Gemini chat**, saved as `<out>/char-<id>.png`.
2. **Scene start frames**: in the **same chat**, one image per scene from `image_prompt`, saying "use exactly the same characters as the character sheets above". Saved as `<out>/<scene id>.png`. Check each image for the right characters, the right number of characters, no text or extra limbs, and regenerate a bad one once.
3. **Clips** (`motion: veo`): each scene image becomes an 8 s Flow (Veo 3.1 Fast) clip with its `video_prompt`, saved as `<out>/<scene id>.mp4`. Check each for the right length and audible speech. (`motion: kenburns`: skip this stage.)
4. **Stitch** (local, free): `npm run stitch -- "<out>" [--music file] [--res 1080p]` in `studio/` joins the scenes, adds the labels, title, handle and end card, ducks the music under the dialogue, and masters at -14 LUFS. The result is `<out>/<folder name>.mp4`, plus a copy in the Videos folder.
5. **Check**: look at a contact sheet (`ffmpeg -vf fps=1,scale=180:-1,tile=6x5`) and at every scene's first frame at 360 px wide. If a character's design drifted, regenerate that scene; if the speech is cut off, shorten the line and regenerate that clip.

**Cost to tell the user before the run**: about 20 Flow credits per Veo clip (8 clips ≈ 160 credits for a 60 s reel), plus one Gemini image per character and per scene. `kenburns` uses no Flow credits.

## Draft for free first

To try a story before spending credits, write the same beats as a `studio` story (`formats/story.md`): `blob` and `cube` characters coloured like the vegetables, the `sunny-park` or `cozy-room` set, Hindi voices (Edge `hi-IN-` or Chatterbox), and the same lines. It builds in about a minute at no cost, and the user can approve the script and pacing before the credit run.
