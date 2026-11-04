"""Optional QA: transcribe generated clips with Whisper and compare with the intended text.

    python verify_whisper.py checks.json        # checks.json: {"hf_home": "...", "result": "...", "items": [{"id", "file", "text", "lang"}]}

Runs inside studio/.venv-chatterbox (it already has PyTorch and transformers). The score is a character-level
similarity between what was said and what was meant (1.0 = identical). It cannot judge how pleasant a voice is,
but it does catch silence, gibberish, repeated words and clips that wander off the script.
"""
import difflib
import json
import os
import re
import sys
import unicodedata

os.environ.setdefault("PYTHONUTF8", "1")


def norm(s: str) -> str:
    from chatterbox_worker import _norm  # same rules as the generation check: numbers spelled out, tags dropped

    return _norm(re.sub(r"\[[a-zA-Z ]{2,20}\]", " ", s))


def main() -> int:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    if job.get("hf_home"):
        os.environ["HF_HOME"] = job["hf_home"]
    out = {"ok": False, "items": []}
    try:
        import librosa
        import torch
        from transformers import pipeline

        device = 0 if torch.cuda.is_available() else -1
        asr = pipeline("automatic-speech-recognition", model=job.get("model", "openai/whisper-small"), device=device, torch_dtype=torch.float16 if device == 0 else torch.float32)
        names = {"en": "english", "hi": "hindi", "es": "spanish", "fr": "french"}
        for it in job["items"]:
            try:
                audio, _ = librosa.load(it["file"], sr=16000, mono=True)
                dur = len(audio) / 16000
                text = asr({"raw": audio, "sampling_rate": 16000}, chunk_length_s=30, generate_kwargs={"language": names.get(it.get("lang", "en"), "english"), "task": "transcribe"})["text"].strip()
                score = difflib.SequenceMatcher(None, norm(it["text"]), norm(text), autojunk=False).ratio()  # autojunk would skew long texts
                out["items"].append({"id": it["id"], "seconds": round(dur, 2), "heard": text, "score": round(score, 3)})
            except Exception as e:  # noqa: BLE001
                out["items"].append({"id": it["id"], "error": f"{type(e).__name__}: {e}"})
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = f"{type(e).__name__}: {e}"
    json.dump(out, open(job["result"], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
