#!/bin/bash
# Source this (do not run it) to make the explainer engine reuse what studio/ already installed,
# so nothing is downloaded a second time:
#   source studio/explainer/scripts/use-studio-tools.sh
# - ffmpeg:  studio/node_modules/ffmpeg-static
# - Kokoro:  studio/.models/kokoro (the same two files voice.py would download), via FACELESS_HOME
# - Python:  studio/.venv-kokoro (needs numpy + scipy + kokoro-onnx; faster-whisper is optional,
#            without it words.py spreads the words inside the exact voice line times)
_here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_studio="$(cd "$_here/../.." && pwd)"
export FACELESS_HOME="$_studio/.models"
export PATH="$_studio/.venv-kokoro/Scripts:$_studio/.venv-kokoro/bin:$_studio/node_modules/ffmpeg-static:$PATH"
export PYTHONIOENCODING=utf-8
unset _here _studio
