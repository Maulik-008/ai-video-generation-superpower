# video-super-power

Claude Code skills and agents that turn a topic into finished AI videos by driving your own Chrome.

## Contents

| Item | Path | What it does |
|---|---|---|
| Skill `video-studio` | [.claude/skills/video-studio/](.claude/skills/video-studio/SKILL.md) | Topic or summary → a format's planner → Gemini images → Google Flow / Grok Imagine videos |
| Agent `video-producer` | [.claude/agents/video-producer.md](.claude/agents/video-producer.md) | The browser worker the skill launches |
| Format `talkstuff` | [.claude/skills/video-studio/formats/talkstuff.md](.claude/skills/video-studio/formats/talkstuff.md) | Pixar-style talking-object character videos (the default format) |

## Usage

Open Claude Code in this folder, then run:

```
/video-studio Toothbrush, angry, bathroom sink
/video-studio <paste a summary> --chars 5 --video grok
/video-studio --format talkstuff --writer claude Toothbrush, angry, bathroom sink
```

Shared options: `--format talkstuff`, `--video flow|grok`, `--writer gpt|claude`, `--out <folder>`. Each format adds its own (`talkstuff`: `--chars 1|5`). Videos are saved to `%USERPROFILE%\Videos\VideoStudio\<date>-<format>-<topic>\` by default.

## Adding a new format

A format is one markdown file in `.claude/skills/video-studio/formats/`. It says how the plan is written, what `plan.json` looks like (`items[]` with `id`, `name`, `image_prompt`, `video_prompt`), and which options and sites it needs. The skill and agent stay the same. Copy `talkstuff.md` as the starting point.

## Prerequisites

- The Claude in Chrome extension is connected, and these sites are allowed in its site permissions: `chatgpt.com` (talkstuff with `--writer gpt`), `gemini.google.com`, `flow.google.com` / `labs.google`, `grok.com`.
- You're signed in to each of those sites in Chrome, with credits for Flow (Veo) or Grok Imagine.
- The TalkStuff GPT will be retired on 2026-12-11. After that date the `talkstuff` format switches to `--writer claude` automatically.
