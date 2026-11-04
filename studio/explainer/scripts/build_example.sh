#!/bin/bash
# Build one style's bundled example into a finished MP4 (voice -> words -> check -> cues -> mix -> contact sheet -> video).
#   bash build_example.sh <style> [--dir <parent>] [--draft]
# Projects go to <parent>/<style> (default studio/explainer/projects). Reuses studio/ tools when they exist.
set -eu
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$SKILL/../.models/kokoro" ] && source "$SKILL/scripts/use-studio-tools.sh"
STYLE="${1:?usage: build_example.sh <style> [--dir <parent>] [--draft]}"; shift
PARENT="$SKILL/projects"; DRAFT=""
while [ $# -gt 0 ]; do case "$1" in --dir) PARENT="${2:?}"; shift 2 ;; --draft) DRAFT="--draft"; shift ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
PY="$SKILL/scripts/py"; P="$PARENT/$STYLE"
[ -d "$P" ] || bash "$SKILL/scripts/new_video.sh" "$STYLE" "$STYLE" --dir "$PARENT"
cd "$P"
"$PY" "$SKILL/scripts/voice.py" . && "$PY" "$SKILL/scripts/words.py" .
node tools/capture.mjs check | tee review/check.txt; grep -q "CHECK OK" review/check.txt
node tools/capture.mjs cues && "$PY" tools/mix.py .
node tools/capture.mjs sheet review/all.jpg 0.5 10
node tools/capture.mjs video "renders/$STYLE.mp4" $DRAFT
echo "DONE $P/renders/$STYLE.mp4"
