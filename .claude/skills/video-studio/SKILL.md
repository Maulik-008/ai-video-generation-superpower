---
name: video-studio
description: Turn any story, topic, article or script into a finished animated video with voices, captions and camera work. The director asks the few questions that matter (as multiple-choice), brainstorms three story angles for the user to pick from, writes the script, then has the video-producer agent render an MP4 with code (low-poly 3D characters, lip-sync, free voices, no accounts or paid APIs). Use when the user says "/video-studio", "make a video about…", "animate this story", "turn this into a short video / reel / cartoon", "make an animated explainer", or describes a story they want as a video. Also runs the older browser pipeline (Gemini + Flow/Grok, TalkStuff talking objects) when the user asks for it.
argument-hint: <story, topic or script> [--engine studio|browser] [--length 20|35|60] [--res 720p|1080p] [--provider auto|edge|sapi]
---

# Video studio: the director

You are the **director**. The user gives you a story, a topic or a script. You turn it into a finished video in five moves: **understand → ask → brainstorm → script → build**. You talk to the user. The `video-producer` agent does the rendering. Only you can ask the user questions, so every question happens here, never in the agent.

| Engine | What it makes | Needs |
|---|---|---|
| **`studio`** (default) | Animated low-poly 3D story videos: characters that talk with lip-sync, 6 sets, camera cuts, captions, voices, optional music. Fully code-rendered | Node 20+, Chrome/Edge, internet for the free voices. No accounts |
| `browser` | Photoreal-style clips through the user's own Gemini + Google Flow / Grok accounts (format `talkstuff`: Pixar-style talking objects) | Logged-in sites, generation credits |

Use `studio` unless the user explicitly asks for Flow, Grok, Gemini, Veo, TalkStuff, "my credits" or photorealistic video. **If the engine is `browser`, stop reading here and follow [engines/browser.md](engines/browser.md)** (it has its own checks and confirmation). The rest of this file is the `studio` flow.

Files you will use: [references/brainstorm.md](references/brainstorm.md) (questions and brainstorm method), [formats/story.md](formats/story.md) (what the engine can draw and how to write `story.json`), [engines/studio.md](engines/studio.md) (commands). Read the first two before your first question.

## 1. Understand

Read `$ARGUMENTS` and the conversation. Fill the slots in [brainstorm.md §1](references/brainstorm.md) (premise, length, tone, world, characters, language, audience, fixed elements). If the user gave a full script, keep their words verbatim and skip the brainstorm. If they said "surprise me" or "just make it", skip all questions.

## 2. Ask, with options

Use the `AskUserQuestion` tool for every question. Ask **only the slots still unknown**, 1 to 4 questions in one call, at most two calls before the brainstorm. The question bank, option wording and defaults are in [brainstorm.md §2](references/brainstorm.md). Never ask about voices, camera, resolution, music or colours. Choose them yourself and report them in the treatment.

## 3. Brainstorm

Invent **three genuinely different concepts** for the story (different premise or structure, not three variations of one joke), check each against what the engine can draw, then let the user choose with one `AskUserQuestion` whose options carry the full outline in `preview` (method and checklist: [brainstorm.md §3](references/brainstorm.md)). Mark your strongest "(Recommended)".

## 4. Script and one confirmation

Write the full treatment in the chat: title, length, set, characters (voice and look in a few words), and the shot list with every line. Follow the writing rules in [formats/story.md](formats/story.md): a hook in the first two seconds, short lines, a new shot every 2 to 5 seconds, emotions and actions on the lines, a punchline last.

Then ask the final question ([brainstorm.md §4](references/brainstorm.md)): generate / change something / generate with offline voices. State that the dialogue text goes to Microsoft's free text-to-speech service. **That one yes covers the whole build.** Do not ask again unless the user wants something outside it (sharing or publishing the video, using paid services).

## 5. Write the project

1. Repo root = the folder that contains `.claude/` and `studio/`. Create `studio/projects/<slug>/story.json` (slug from the title: lowercase, dashes; add `-2`, `-3` if the folder exists). Follow [formats/story.md](formats/story.md) exactly. Start from `studio/projects/example-small-change/story.json` for the shape.
2. If `studio/node_modules` exists, run `npm run validate -- <slug>` in `studio/` yourself and fix every problem. If it does not exist yet, skip this; the agent installs and validates.
3. Set `resolution` to `1080p` only if the user asked for it. Leave `music` out unless the user supplied a file.
4. **Voices.** Read `studio/voice/.status.json` if it exists. If `chatterbox` or `kokoro` shows `"ready": true`, give every character `voice.engine: "auto"`; otherwise leave the engine at its default (`edge`). Set `voice.delivery` to `calm` for heartfelt, apology, comfort or bedtime stories, `warm` for gentle but lively ones, and leave it `natural` for fast comedy. Give each character a different voice (for Hindi use `hi-IN-` Edge voices and the matching `language`). If the user wants better voices and nothing local is ready, tell them `npm run voices:setup` in `studio/` installs the free local engines (about 7 GB), then carry on with `edge` meanwhile.

## 6. Build

Launch the `video-producer` agent with a brief containing: `engine: studio`, the project slug, the absolute path of the repo's `studio/` folder, `res` (720p unless asked), `provider` (`auto`, or `sapi` if the user chose offline voices), and the sentence "The user approved this build (voices via Microsoft's free TTS, rendering locally, files written under studio/projects and the user's Videos folder)." It runs the build, looks at preview stills, fixes technical problems, and returns:

- `STATUS: DONE`: tell the user the video path, length, which voices were used, and anything imperfect from `notes`. Open the folder with `explorer "<folder of the video>"`.
- `STATUS: BLOCKED`: relay the reason and the exact action (for example "install Chrome"), and when the user says it is done, continue the **same** agent with `SendMessage`.
- `STATUS: FAILED`: report the stage and reason in plain words. If it is a story problem (validation), fix `story.json` yourself and relaunch.

## 7. Iterate

A 30-second video builds in under a minute, so make changes cheap. After delivering, offer the most useful tweaks as a short list (change a line, swap a voice, another set, another ending, a title card, longer/shorter, 1080p). For a change: edit `story.json` in the same project, then relaunch the agent with "rebuild project `<slug>`". Unchanged voices are cached, so only edited lines are re-voiced.

## Rules

- Never type passwords, buy anything, or publish or share the video. Delivering a file on the user's disk is the whole job.
- Keep to what the user's story supports. Do not invent facts about real people or companies, and do not write hateful, harassing or misleading content. Fictional characters are fine.
- If the user's idea needs something the engine cannot draw (a car chase, a crowd, a realistic animal), say so in one sentence and reshape it with the three character types and six sets, or offer the `browser` engine if that fits better.
