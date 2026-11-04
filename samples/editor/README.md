# Editor sample (pending)

A before / after of a real talking-head edit is not generated yet. It needs two things the repo does not ship:

1. a 16:9 talking-head recording (your own), and
2. the Whisper model for transcription: `small.en` about 0.5 GB (English) or `large-v3-turbo` about 1.6 GB (Hindi or mixed), plus `python studio/editor/scripts/setup.py` and ffprobe on PATH.

Once you have a recording and approve the download, run `/video-studio`, choose "Edit my recording", save the result here as `before.mp4`, `after.mp4` and `poster.jpg`, replace the `pending` entry in `../samples.json`, and run `python samples/build_gallery.py`.

Graphics styles to expect: `warm-canvas`, `creator-motion-graphics`, `clean-tech`, `software-walkthrough`, `data-story`, `chalk-talk`, `pop-info` (see `studio/editor/styles/`).
