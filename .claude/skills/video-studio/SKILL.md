---
name: video-studio
description: Turn a topic or summary into finished AI videos, end to end, through the user's own Chrome. Pick a format (today `talkstuff`: Pixar-style talking-object characters), the skill gets a plan with image prompts and scripts, generates the images in Google Gemini, animates them in Google Flow (Veo) or Grok Imagine, and saves the videos to disk. Use when the user says "/video-studio", "make a video about…", "make a TalkStuff video about…", "turn this topic/summary into videos", or wants the plan → Gemini → Flow/Grok pipeline run for them.
argument-hint: <topic or summary> [--format talkstuff] [--video flow|grok] [--writer gpt|claude] [--out <folder>] [format options]
---

# Video studio

You orchestrate. The `video-producer` agent does the browser work. Your jobs: settle the inputs, check prerequisites, get one confirmation, launch the agent, unblock it when it gets stuck, and hand over the result.

```
topic/summary ─► format's planner (GPT or Claude) ─► plan.json (image + video prompts)
                                                  ─► Gemini: one image per item
                                                  ─► Flow (Veo) or Grok Imagine: image → video
                                                  ─► <out>/ videos + images + manifest
```

A **format** is one file in [formats/](formats/) that defines what kind of video this is: how the plan is written, the shape of `plan.json`, and how video prompts are built. Everything else (browser work, downloads, manifest, blocking rules) is shared. To add a new kind of video, add a new file there. Don't add a new skill or agent.

| Format | File | What it makes |
|---|---|---|
| `talkstuff` (default) | [formats/talkstuff.md](formats/talkstuff.md) | 10-second talking-object character videos |

## 1. Settle the inputs

Read them from `$ARGUMENTS`. Use these defaults when an option is missing. Don't ask about it.

| Option | Default | Meaning |
|---|---|---|
| topic | **required** | A short idea or a pasted summary or article. If it's missing, ask for it. |
| `--format` | `talkstuff` | Which file in `formats/` to use. If the name doesn't match a file, list the available formats and ask. |
| `--video` | `flow` | `flow` = flow.google.com (Veo, generates speech audio). `grok` = grok.com/imagine. |
| `--writer` | per format | Who writes the plan. Each format says which writers it supports and when to switch. |
| `--out` | `%USERPROFILE%\Videos\VideoStudio\<YYYY-MM-DD>-<format>-<topic-slug>` | Output folder. |

Then read the format file. It adds its own options (for `talkstuff`: `--chars 1\|5`) with their defaults, and tells you which sites its planner needs.

## 2. Check prerequisites (fast, no generation)

1. Make sure the Chrome extension is connected: call `tabs_context_mcp` with `createIfEmpty: true`.
2. Each site has to be **allowed in the Claude in Chrome extension**, and the user has to be **signed in**:
   - the planner site named in the format file (only when the chosen writer needs one)
   - `gemini.google.com`
   - `flow.google.com` (labs.google redirects there) or `grok.com`, whichever `--video` picks

   Open each site once in a new tab and check for a prompt box versus a sign-in page. If a navigation fails with "domain is not allowed", tell the user to allow that site in the extension's site permissions and stop there. When you're done, close the tabs you opened.
3. Never type passwords and never solve CAPTCHAs. If a site needs either, the user does it.

## 3. One confirmation, then go

Show the plan in a few lines and ask once:

> Format: … · Topic: … · Items: N · Writer: … · Video: Flow/Grok · Output: <folder>
> This sends prompts to the planner, Gemini and Flow/Grok as you. It uses your Flow/Grok generation credits, and it downloads about N images and N videos (a few MB each) to your Downloads folder, then moves them into the output folder. Go?

That yes covers this run's prompts, generations and downloads. Ask again before anything outside that scope: buying credits, upgrading a plan, accepting new terms, or sharing or publishing a video.

## 4. Run the agent

Create the output folder. Then launch the `video-producer` agent with a brief that contains:
- the topic text, verbatim
- `format`, the format's own options, `video`, `writer`, the absolute output folder, and the run start time (ISO). The agent uses the start time to recognise its own downloads.
- `format_ref`: the absolute path of the format file, for example `…\.claude\skills\video-studio\formats\talkstuff.md`
- if the writer is Claude: the `plan.json` you already wrote into the output folder, following the format file
- the statement "The user confirmed this run (prompts, generations, downloads into the output folder)."

The agent writes `<out>/manifest.json` after every step. It returns one of:
- `STATUS: DONE`: relay the list of video files, which item each is, and anything that degraded (no speech audio, used text-to-video instead of image-to-video, and so on).
- `STATUS: BLOCKED`: relay the reason and the exact thing the user must do (sign in, solve a CAPTCHA, allow a site, out of credits). When the user says it's done, continue the **same** agent with `SendMessage` ("Unblocked, resume from manifest"). If that agent is gone, launch a fresh one with the same brief plus "resume from <out>/manifest.json".
- `STATUS: FAILED`: report what failed and at which stage. Suggest the other `--video` tool or a different `--writer` if that would get around it.

## 5. Finish

Tell the user where the videos are and open the folder (`explorer <out>`). If there's more than one clip and `ffmpeg` is on PATH, offer to stitch them into one `all.mp4`. Don't stitch without asking.
