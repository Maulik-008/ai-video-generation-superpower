# video-super-power

Claude Code skills and agents that turn a topic into finished AI videos by driving your own Chrome.

## Contents

| Item | Path | What it does |
|---|---|---|
| Skill `talkstuff-video` | [.claude/skills/talkstuff-video/](.claude/skills/talkstuff-video/SKILL.md) | Topic or summary → TalkStuff GPT (ChatGPT) → Gemini images → Google Flow / Grok Imagine videos |
| Agent `talkstuff-video-producer` | [.claude/agents/talkstuff-video-producer.md](.claude/agents/talkstuff-video-producer.md) | The browser worker the skill launches |

## Usage

Open Claude Code in this folder, then run:

```
/talkstuff-video Toothbrush, angry, bathroom sink
/talkstuff-video <paste a summary> --chars 5 --video grok
```

Options: `--chars 1|5`, `--video flow|grok`, `--writer gpt|claude`, `--out <folder>`. Videos are saved to `%USERPROFILE%\Videos\TalkStuff\<date>-<topic>\` by default.

## Prerequisites

- The Claude in Chrome extension is connected, and these sites are allowed in its site permissions: `chatgpt.com`, `gemini.google.com`, `labs.google`, `grok.com`.
- You're signed in to each of those sites in Chrome, with credits for Flow (Veo) or Grok Imagine.
- The TalkStuff GPT will be retired on 2026-12-11. After that date the skill switches to `--writer claude` automatically.
