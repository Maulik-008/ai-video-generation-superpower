# Reference analysis: four Instagram reels (Hindi/Urdu), November 2026

The four reference reels are in `Downloads\instagram\1.mp4` to `4.mp4`. Each was measured with ffmpeg (scene cuts, loudness, silence), transcribed with Whisper, and read frame by frame from contact sheets. The aim: know exactly how they were made, and make the same **kind** of video on request. Copy the craft, never their characters, names, brands or words.

## The short answer

| | Reel 1 "Body Factory" | Reel 2 "Two Brothers" | Reel 3 "Aloo ke Heere" | Reel 4 "POV: mom goes to the bazaar" |
|---|---|---|---|---|
| Length, size | 95 s, 716×1274, 30 fps | 63 s, 576×1024, 30 fps | 77 s, 716×1274, 30 fps | 52 s, 1080×1920, 30 fps |
| Look | Pixar-style photoreal 3D, organs as characters | Pixar-style 3D, vegetables in Pakistani/Punjabi clothes | Pixar-style 3D, vegetables in a village | Hand-painted 2D, soft pastel, vignette |
| Made with | AI image-to-video (Google **Veo 3**: its ✦ watermark is in the corner) with voices generated in the clip | Veo 3: one 8 s clip per scene, with the dialogue spoken in the clip | Veo 3: one ~7.7 s clip per scene | An illustrator's 2D frames, or AI 2D images with gentle motion, plus a song |
| Cuts | 47 cuts, one every **2.0 s** | 7 scenes, one every **8.4 s** | 8 scenes, one every **7.7 s** | ~12 scenes, soft dissolves, ~4.5 s each |
| Sound | Many character voices, comic, background score, -14.1 LUFS | Narrated dialogue, gentle score, -14.1 LUFS | Dialogue, comic, -14.2 LUFS | No dialogue: an old Hindi song, -14.5 LUFS |
| On-screen text | Name labels ("Liver Kaka", "Kidney Didi", "Dil Kumar"), screen props ("SUGAR LEVEL HIGH") | Brand props only (magazines, signs) | "PART 2" + a Follow button at the end | "POV" + title the whole time, times of day ("5.30 pm", "6.00 pm"), handle |
| Ending | A soft moral ("sweets aren't wrong, too much is") | The moral of the fable lands | Cliffhanger: "to watch part 2, follow" | Emotional payoff (mom returns with treats), then the handle |
| Code-renderable here? | No: needs generated footage | No | No | Partly: AI 2D images + camera motion + a song (no credits for the motion) |

**Our studio engine cannot make these.** It draws everything with code, which wins on cost, speed, control and consistency, but it cannot produce photoreal Pixar-style worlds. These reels come from generative video. This repo already has that route: the `browser` engine, which drives **your own** Gemini (images) and Google Flow (Veo 3 clips) in Chrome with your credits. What was missing (a character bible, multi-scene planning, Hindi dialogue prompts, stitching, the 2D POV route) is now in `formats/kahani.md` and `npm run stitch`. See "How we make these" below.

## What makes them work (the shared formula)

1. **A familiar desi world, made adorable.** Everyday things become characters with a job and a nickname: potato (Aloo), onion, brinjal, karela, radish; brain (Dimagu bhai), stomach (Petu Lal), liver (Liver Kaka), kidney (Kidney Didi), heart (Dil Kumar). The costumes and sets are culturally exact: kurta-pajama and waistcoat, dupatta, a charpai, mud houses, clay pots, a jeweller's shop, a Dubai balcony, an Indian kitchen at night. Viewers recognise their own life, so they share it.
2. **One character design, held across every shot.** The same face, colours and outfit in every scene. That is the hard part with AI video; the creators lock it with a reference image per character and the same description every time.
3. **Every scene is one beat, one line.** In reels 2 and 3, one 8-second Veo clip carries exactly one exchange (one or two lines). The scene changes, the plot moves. In reel 1 the clips are cut faster (every 2 s) because it is a comedy montage with many voices.
4. **The hook is the situation, not a title.** Reel 1 opens on the owner raiding the fridge at night while the brain watches on a monitor. Reel 2 opens on a father in a field with a table full of cash. Reel 3 opens top-down on diamonds spilling from a charpai. You know the conflict in 2 seconds.
5. **A simple story shape: setup → temptation or trouble → consequence → payoff.**
   - A **fable**: two choices, two results, a moral (reel 2).
   - A **comic crime** with a cliffhanger, made for a series (reel 3, "follow for part 2").
   - An **explainer as comedy**: the body reacts to bad habits, then a gentle health moral (reel 1).
   - A **nostalgia POV**: no words, a relatable memory with a timeline, a warm payoff (reel 4).
6. **Distinct, exaggerated voices in Hindi or Urdu**, with colloquial words ("maalik", "bhai", "yaar", "kuch to gadbad hai"), a little crude humour (reel 3), and a running joke.
7. **Cinematic light everywhere**: golden hour, warm interiors with practical lamps, shallow depth of field, rim light, volumetric glow. Every frame could be a thumbnail.
8. **Sound at -14 LUFS** (all four, measured), a score under the dialogue, and effects for the jokes.
9. **Series thinking**: a handle in the frame, recurring characters, "Part 2". This builds a following.
10. **Length 50 to 95 s**: longer than our 30 s default, because a story with a payoff holds people. The rhythm still changes every 2 s (reel 1) or every 8 s with motion inside the clip (reels 2 and 3).

## Reel by reel

### Reel 1: the body as a factory (comedy explainer, 95 s)
- **Premise.** The "maalik" (the human owner) eats 20 gulab jamuns at night. Inside, Dimagu bhai (the brain, with glasses) runs a control room, Petu Lal (the stomach, with a headband) works the furnace, and Liver Kaka, Kidney Didi and Dil Kumar react. Sugar alarms go off ("SUGAR LEVEL HIGH"), worker cells panic, the stomach gets fat and furious, and the brain calms everyone down.
- **Moral.** "Mithai khana galat nahi hai, lekin zaroorat se zyada..." (Sweets aren't wrong, but more than you need is.)
- **Craft.** 47 cuts at about 2 s each, alternating between the outside world (the owner at the fridge, seen on a monitor) and the inside world. Big expressions, a gag every few seconds, and name labels when a character first appears. The location changes as the story moves through the body (control room, stomach furnace, liver cave, factory floor).

### Reel 2: two brothers and two crore (moral fable, 63 s)
- **Premise.** A father (a green, muscular vegetable in a white kurta) leaves ₹2 crore for his two sons before going abroad. The onion buys a sports car and gambles on "trading"; the potato buys a mango farm and works honestly. One ends up in debt and the other prospers. The father watches from a Dubai balcony.
- **Craft.** Seven 8 s scenes, each a new location (field, bedroom, showroom, farm, car, balcony), and each one beat. A recurring fictional brand ("Fruity") appears on props. The characters speak in the clip, so there is no narrator.

### Reel 3: the potato who farts diamonds (comic crime, part 1, 77 s)
- **Premise.** Aloo discovers he passes diamonds. He and his wife (Mooli, the radish) sell them to Karela the jeweller (₹20 lakh). Jealous neighbours (onion, brinjal, tomato) notice that "kuch to gadbad hai" (something is off), brew a potion to make him produce more, and kidnap him at night.
- **Ending.** "PART 2" and a Follow button: the cliffhanger is the call to action.
- **Craft.** Eight ~7.7 s clips (Veo's length), times of day as the clock (night, dawn, sunset, night), a running joke, and three villains as a comic trio.

### Reel 4: POV, mom goes to the bazaar (2D nostalgia, 52 s)
- **Premise.** A child waits at home while mom is at the market: 5.30 pm playing alone, 6.00 pm watching a crow feed its chicks, 7.00 pm at the door, 7.25 pm on the step. The auto-rickshaw arrives and she brings snacks. Joy, then they eat together.
- **Craft.** No dialogue: an old Hindi song carries it. "POV" and the title stay on screen the whole time; a time of day labels each scene. Soft painted 2D, a heavy vignette, slow push-ins, dissolves, big tearful eyes. The handle closes it.
- **Music** is a commercial song. To publish, add it inside Instagram's own audio library; this repo never downloads songs.

## How we make these now

| Genre | Route | Cost | What the repo does |
|---|---|---|---|
| **Kahani** (veggie / fruit / object drama, fable, comic crime, series) | `--engine browser --format kahani --style pixar` | Your Gemini + Flow credits (about 20 Flow credits per 8 s clip; a 60 s reel is about 8 clips) | Claude writes the character bible and the 8 s beat sheet with Hindi/Urdu dialogue. Gemini makes one locked reference image per character, then one start frame per scene. Veo 3 animates each scene with the lines spoken. `npm run stitch` joins the clips at -14 LUFS with an optional music bed, labels, and a "Part 2 / Follow" end card |
| **Body-factory explainer** (organs or machines as characters) | `--format kahani --style pixar --world body` | Same | Same pipeline, with organ characters and a health fact checked before it is used |
| **2D POV nostalgia** | `--format kahani --style 2d-pov --motion kenburns` | Gemini images only (no Flow credits): the motion is made locally by ffmpeg | Gemini paints each scene in a consistent 2D style. `npm run stitch` adds slow push-ins, dissolves, the vignette, "POV" + title + time labels, and your music file |
| **The same stories, free and instant** | `--engine studio` (the default) | Free, about a minute per video | Our soft clay-toy engine: rounded cube, blob and human characters in six sets. It is not photoreal, but it is fully controllable and costs nothing. Good for drafting a story before spending credits |

Rules that come with it (in `formats/kahani.md`):
- Characters are original. Never a real person's likeness, and no other creator's characters or brands.
- Facts in an explainer are checked before they are written.
- No downloading songs or clips (no yt-dlp): music is a file the user owns, or is added on Instagram.
- Every run asks once before spending credits.
