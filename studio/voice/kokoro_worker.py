"""Kokoro (82M, Apache-2.0) batch worker, run inside studio/.venv-kokoro.

Protocol: `python kokoro_worker.py job.json`. The job lists items; the worker writes one WAV per item and a
result JSON. The model is loaded once per batch. A failing item never stops the others, and any problem is
reported in the result file (never only on stderr), so the caller can fall back cleanly.
"""
import json
import os
import sys
import time
import traceback

os.environ.setdefault("PYTHONUTF8", "1")


def main() -> int:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    result = {"engine": "kokoro", "ok": False, "items": [], "info": {}}
    try:
        import numpy as np
        import onnxruntime
        import soundfile as sf
        from kokoro_onnx import Kokoro

        model_dir = job["model_dir"]
        t0 = time.time()
        kokoro = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
        voices = kokoro.get_voices()
        result["info"] = {
            "device": "cpu",
            "providers": onnxruntime.get_available_providers(),
            "voices": voices,
            "load_seconds": round(time.time() - t0, 2),
        }
        for it in job.get("items", []):
            started = time.time()
            try:
                audio, sr = kokoro.create(
                    it["text"],
                    voice=it["voice"],
                    speed=float(it.get("speed", 1.0)),
                    lang=it.get("lang", "en-us"),
                    sentence_pause=float(it.get("sentence_pause", 0.25)),
                    clause_pause=float(it.get("clause_pause", 0.1)),
                )
                audio = np.asarray(audio, dtype=np.float32)
                if audio.size == 0 or not np.isfinite(audio).all():
                    raise ValueError("empty or invalid audio")
                sf.write(it["out"], audio, sr, subtype="PCM_16")
                result["items"].append({"id": it["id"], "ok": True, "seconds": round(len(audio) / sr, 2), "took": round(time.time() - started, 2), "sr": sr})
                print(f"ITEM {it['id']} ok {len(audio) / sr:.1f}s in {time.time() - started:.1f}s", flush=True)
            except Exception as e:  # noqa: BLE001 - report every kind of failure per item
                result["items"].append({"id": it["id"], "ok": False, "error": f"{type(e).__name__}: {e}"})
                print(f"ITEM {it['id']} FAILED {type(e).__name__}: {e}", flush=True)
        result["ok"] = True
    except Exception as e:  # noqa: BLE001
        result["error"] = f"{type(e).__name__}: {e}"
        result["trace"] = traceback.format_exc()[-1500:]
    json.dump(result, open(job["result"], "w", encoding="utf-8"), ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
