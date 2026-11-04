# studio/editor: edit a talking-head recording

The `editor` engine of the video studio. Give it a 16:9 talking-head video and it:

1. transcribes it on this computer with Whisper (English and Hindi),
2. cuts silent parts and mistakes (retakes, false starts); the user approves the cut list first,
3. adds code-drawn motion graphics in one of 7 styles,
4. adds sound effects and optional captions, and renders the final MP4 at -14 LUFS.

No paid APIs: Whisper (faster-whisper), ffmpeg and a headless Chromium (playwright) all run locally.

The runbook the director follows is [`.claude/skills/video-studio/engines/editor.md`](../../.claude/skills/video-studio/engines/editor.md).

**Styles** (`styles/index.json`): `warm-canvas` (default for talking heads), `creator-motion-graphics`, `clean-tech`, `software-walkthrough`, `data-story`, `chalk-talk`, `pop-info`, or no graphics.

**Layout:** `scripts/` (setup, transcribe, cut, render, captions, preview) · `engine/` (the in-browser player) · `styles/<style>/` (`base.js`, `style.md`, `style.json`) · `references/` (story guide and a worked example) · `assets/fonts/`.

**Setup (opt-in, nothing is installed automatically):** needs ffmpeg and ffprobe on PATH, Python 3.9+, and `python studio/editor/scripts/setup.py` (faster-whisper, playwright, numpy, pillow and the browser). The first transcription downloads a Whisper model once: `small.en` about 0.5 GB for English, `large-v3-turbo` about 1.6 GB for Hindi or mixed. On a laptop without an NVIDIA GPU, Hindi can take about as long as the video.

**Limits:** 16:9 only (vertical or square sources are centre-cropped), one continuous recording per edit.

**Origin and license:** imported from the `ai-video-editor` Claude skill by Nafay 3D (youtube.com/@nafay3d). The bundle states no license, so confirm the terms with its author before redistributing the style code outside this repo.
