# studio/explainer: narrated vertical explainer shorts

The `explainer` engine of the video studio. It makes a 25-60 s, 9:16 short from a topic, fully in code on this computer: script, local AI voice, word-synced captions, animation, sound and music, rendered to MP4. No AI video, no API keys, no credits.

The runbook the director and the producer follow is [`.claude/skills/video-studio/engines/explainer.md`](../../.claude/skills/video-studio/engines/explainer.md). Finished examples to watch first are in [`samples/explainer/`](../../samples/explainer/).

**Styles** (each has a style sheet, a style guide and a finished example project)

| Style | Best for | Example topic |
|---|---|---|
| `deep-dive` Deep Dive 3D | "What happens if...?" body and science, 3D | hold your breath |
| `night-file` Night File 3D | unsolved mysteries, true crime | D.B. Cooper |
| `inside-out` Inside Out | flat 2D x-ray explainers | swallow gum |
| `stick-story` Stick Story | "What would you do if...?" survival steps | 3-day power cut |
| `paper-atlas` Paper Atlas | history on cut-paper maps | the bakery that burned London |
| `tall-tale` Tall Tale 3D | funny true stories | the girl mailed to grandma |

**How it works**
`script.json` → Kokoro voice (local, free) → word timings (Whisper if installed, otherwise estimated inside the exact voice line times) → shots drawn in code, each cut and caption placed on its word → procedural sound + music → headless Chrome captures every frame → ffmpeg renders the MP4. A contact sheet of the whole video is checked before delivery.

**Layout**
`scripts/` (setup, selftest, new_video, build_example, voice, words, estimate, use-studio-tools) · `styles/<style>/` (`style-sheet.png`, `STYLE.md`, `example/` = a complete project that renders as-is) · `projects/<slug>/` (your videos; renders and audio are git-ignored).

**Reuses the rest of `studio/`** (nothing downloaded twice): `scripts/use-studio-tools.sh` points the engine at `studio/node_modules/ffmpeg-static`, the Kokoro model in `studio/.models/kokoro` and the Python environment `studio/.venv-kokoro` (needs `scipy`: `studio/.venv-kokoro/Scripts/python -m pip install scipy`). Without `use-studio-tools.sh`, `bash scripts/setup.sh` builds its own environment in `~/.faceless-shorts` and downloads about 0.9 GB.

**Quick start**
```
cd <repo root>
bash studio/explainer/scripts/build_example.sh inside-out      # builds the bundled example to studio/explainer/projects/inside-out/renders/
bash studio/explainer/scripts/new_video.sh deep-dive my-short  # starts your own project from a style's example
```

**Licenses:** the code, stories, drawings and sound are original and free to use in your videos. Inter font: SIL Open Font License 1.1. three.js (MIT) is vendored in the 3D styles. Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT), faster-whisper + Whisper small.en (MIT), numpy, scipy.

Origin: imported from the `faceless-shorts` Claude skill. The optional YouTube upload through Zapier from that skill is not part of this repo's flow (this repo never publishes a video).
