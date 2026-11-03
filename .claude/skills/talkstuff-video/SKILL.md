---
name: talkstuff-video
description: Turn a topic or summary into finished talking-object videos, end to end, through the user's own Chrome. Sends the topic to the TalkStuff GPT on ChatGPT (Pixar-style object characters, image prompts, 10-second scripts), generates each character image in Google Gemini, animates it into a talking video in Google Flow (Veo) or Grok Imagine, and saves the videos to disk. Use when the user says "/talkstuff-video", "make a TalkStuff video about…", "turn this topic/summary into object character videos", or wants the ChatGPT → Gemini → Flow/Grok pipeline run for them.
argument-hint: <topic or summary> [--chars 1|5] [--video flow|grok] [--writer gpt|claude] [--out <folder>]
---

# TalkStuff video pipeline

You orchestrate. The `talkstuff-video-producer` agent does the browser work. Your jobs: settle the inputs, check prerequisites, get one confirmation, launch the agent, unblock it when it gets stuck, and hand over the result.

```
topic/summary ─► ChatGPT "TalkStuff" GPT ─► prompts + scripts (plan.json)
                                         ─► Gemini: one image per character
                                         ─► Flow (Veo) or Grok Imagine: image → talking video
                                         ─► <out>/ videos + images + manifest
```

## 1. Settle the inputs

Read them from `$ARGUMENTS`. Use these defaults when an option is missing. Don't ask about it.

| Option | Default | Meaning |
|---|---|---|
| topic | **required** | A short idea ("Toothbrush, angry, bathroom sink") or a pasted summary or article. If it's missing, ask for it. |
| `--chars` | `1` | `1` = main character only. `5` = main character plus the 4 related characters. |
| `--video` | `flow` | `flow` = labs.google Flow (Veo, generates speech audio). `grok` = grok.com/imagine. |
| `--writer` | `gpt` | `gpt` = the TalkStuff GPT on ChatGPT. `claude` = you write the plan yourself from [references/talkstuff-format.md](references/talkstuff-format.md), with no ChatGPT step. **Switch to `claude` automatically from 2026-12-11**, when ChatGPT retires GPTs, or whenever the GPT can't be reached. |
| `--out` | `%USERPROFILE%\Videos\TalkStuff\<YYYY-MM-DD>-<topic-slug>` | Output folder. |

## 2. Check prerequisites (fast, no generation)

1. Make sure the Chrome extension is connected: call `tabs_context_mcp` with `createIfEmpty: true`.
2. Each site has to be **allowed in the Claude in Chrome extension**, and the user has to be **signed in**:
   - `chatgpt.com` (only when `--writer gpt`)
   - `gemini.google.com`
   - `flow.google.com` (Flow; labs.google redirects there) or `grok.com`, whichever `--video` picks

   Open each site once in a new tab and check for a prompt box versus a sign-in page. If a navigation fails with "domain is not allowed", tell the user to allow that site in the extension's site permissions and stop there. When you're done, close the tabs you opened.
3. Never type passwords and never solve CAPTCHAs. If a site needs either, the user does it.

## 3. One confirmation, then go

Show the plan in a few lines and ask once:

> Topic: … · Characters: N · Writer: GPT/Claude · Video: Flow/Grok · Output: <folder>
> This sends prompts to ChatGPT, Gemini and Flow/Grok as you. It uses your Flow/Grok generation credits, and it downloads about N images and N videos (a few MB each) to your Downloads folder, then moves them into the output folder. Go?

That yes covers this run's prompts, generations and downloads. Ask again before anything outside that scope: buying credits, upgrading a plan, accepting new terms, or sharing or publishing a video.

## 4. Run the agent

Create the output folder. Then launch the `talkstuff-video-producer` agent with a brief that contains:
- the topic text, verbatim
- `chars`, `video`, `writer`, the absolute output folder, and the run start time (ISO). The agent uses the start time to recognise its own downloads.
- `format_ref`: the absolute path of [references/talkstuff-format.md](references/talkstuff-format.md) in this skill's folder
- if `writer = claude`: the `plan.json` you already wrote into the output folder, following [references/talkstuff-format.md](references/talkstuff-format.md)
- the statement "The user confirmed this run (prompts, generations, downloads into the output folder)."

The agent writes `<out>/manifest.json` after every step. It returns one of:
- `STATUS: DONE`: relay the list of video files, which character each is, and anything that degraded (no speech audio, used text-to-video instead of image-to-video, and so on).
- `STATUS: BLOCKED`: relay the reason and the exact thing the user must do (sign in, solve a CAPTCHA, allow a site, out of credits). When the user says it's done, continue the **same** agent with `SendMessage` ("Unblocked, resume from manifest"). If that agent is gone, launch a fresh one with the same brief plus "resume from <out>/manifest.json".
- `STATUS: FAILED`: report what failed and at which stage. Suggest the other `--video` tool or `--writer claude` if that would get around it.

## 5. Finish

Tell the user where the videos are and open the folder (`explorer <out>`). If there's more than one clip and `ffmpeg` is on PATH, offer to stitch them into one `all.mp4`. Don't stitch without asking.
