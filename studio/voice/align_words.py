"""Word timings for finished voice clips, so captions can light up word by word exactly when each word is said.

    python align_words.py job.json     # job.json: {"hf_home", "result", "model", "items": [{"id", "file", "lang"}]}

Runs inside studio/.venv-chatterbox (PyTorch + transformers + the Whisper model the speech check already downloaded),
so it costs no extra download. It only reports what Whisper heard and when; matching that to the script's own words
happens in scripts/lib/words.ts, which also falls back to an estimate when this script is not available.
"""
import json
import os
import sys

os.environ.setdefault("PYTHONUTF8", "1")

NAMES = {"en": "english", "hi": "hindi", "es": "spanish", "fr": "french", "de": "german", "it": "italian", "pt": "portuguese", "ja": "japanese", "zh": "chinese", "ko": "korean", "ar": "arabic", "gu": "gujarati"}


def main() -> int:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    if job.get("hf_home"):
        os.environ["HF_HOME"] = job["hf_home"]
        os.environ.setdefault("HF_HUB_OFFLINE", "1")  # never start a download in the middle of a build
    out = {"ok": False, "items": []}
    try:
        import librosa
        import torch
        from transformers import pipeline

        device = 0 if torch.cuda.is_available() else -1
        asr = pipeline(
            "automatic-speech-recognition",
            model=job.get("model", "openai/whisper-small"),
            device=device,
            torch_dtype=torch.float16 if device == 0 else torch.float32,
        )
        out["device"] = "cuda" if device == 0 else "cpu"
        for it in job["items"]:
            try:
                audio, _ = librosa.load(it["file"], sr=16000, mono=True)
                res = asr(
                    {"raw": audio, "sampling_rate": 16000},
                    return_timestamps="word",
                    chunk_length_s=30,
                    generate_kwargs={"language": NAMES.get(it.get("lang", "en"), "english"), "task": "transcribe"},
                )
                words = []
                for c in res.get("chunks", []):
                    a, b = c.get("timestamp", (None, None))
                    if a is None:
                        continue
                    words.append({"w": c["text"].strip(), "start": round(float(a), 3), "end": round(float(b if b is not None else a + 0.2), 3)})
                out["items"].append({"id": it["id"], "words": words})
                print(f"ITEM {it['id']} {len(words)} words", flush=True)
            except Exception as e:  # noqa: BLE001 - one bad clip falls back to the estimate, the rest still align
                out["items"].append({"id": it["id"], "error": f"{type(e).__name__}: {e}"})
        out["ok"] = True
    except Exception as e:  # noqa: BLE001
        out["error"] = f"{type(e).__name__}: {e}"
    json.dump(out, open(job["result"], "w", encoding="utf-8"), ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
