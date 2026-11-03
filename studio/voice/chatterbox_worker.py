"""Chatterbox Multilingual (500M, MIT) batch worker, run inside studio/.venv-chatterbox.

Protocol: `python chatterbox_worker.py job.json`. The model is loaded (and downloaded on first use) once per batch.
Each item may carry an `anchor`: a short reference clip that sets the speaker's voice, so different characters
sound different. Every item has a seed, so the same line gives the same voice every time. Failures are reported
per item in the result file; GPU out-of-memory never takes down the whole batch.
"""
import json
import os
import sys
import time
import traceback

os.environ.setdefault("PYTHONUTF8", "1")


def _norm(text: str) -> str:
    import re
    import unicodedata

    t = unicodedata.normalize("NFC", text).lower()
    return re.sub(r"[^\w]", "", t).replace("\u093c", "")  # no punctuation or spaces; nukta spelling differs often


def _similarity(meant: str, heard: str) -> float:
    import difflib

    return difflib.SequenceMatcher(None, _norm(meant), _norm(heard)).ratio()


def _threshold(text: str, language: str, cfg: dict) -> float:
    if len(_norm(text)) < 6:
        return cfg.get("min_short", 0.55)
    return cfg.get("min_en", 0.85) if language == "en" else cfg.get("min_other", 0.70)


def _load_verifier(cfg: dict):
    """Whisper speech-to-text, so every generated clip can be checked against the words it should say."""
    import torch
    from transformers import pipeline

    device = 0 if torch.cuda.is_available() else -1
    return pipeline(
        "automatic-speech-recognition",
        model=cfg.get("model", "openai/whisper-small"),
        device=device,
        torch_dtype=torch.float16 if device == 0 else torch.float32,
    )



def main() -> int:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    if job.get("hf_home"):
        os.environ["HF_HOME"] = job["hf_home"]
    result = {"engine": "chatterbox", "ok": False, "items": [], "info": {}}
    try:
        import numpy as np
        import soundfile as sf
        import torch
        from chatterbox.mtl_tts import SUPPORTED_LANGUAGES, ChatterboxMultilingualTTS

        device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cpu" and not job.get("allow_cpu"):
            raise RuntimeError("no CUDA GPU available; Chatterbox on CPU is far too slow (set allow_cpu to force it)")
        t0 = time.time()
        model = ChatterboxMultilingualTTS.from_pretrained(device)
        result["info"] = {
            "device": device,
            "gpu": torch.cuda.get_device_name(0) if device == "cuda" else None,
            "torch": torch.__version__,
            "sample_rate": model.sr,
            "languages": sorted(SUPPORTED_LANGUAGES.keys()),
            "load_seconds": round(time.time() - t0, 1),
        }
        print(f"ITEM (model loaded on {device} in {time.time() - t0:.0f}s)", flush=True)
        verify_cfg = job.get("verify")
        asr = None
        if verify_cfg:
            try:
                asr = _load_verifier(verify_cfg)
                result["info"]["verify"] = verify_cfg.get("model", "openai/whisper-small")
            except Exception as e:  # noqa: BLE001 - the check is a safety net; if it cannot load, say so and carry on
                result["info"]["verify"] = f"unavailable: {type(e).__name__}: {e}"
                print(f"ITEM (speech check unavailable: {type(e).__name__}: {e})", flush=True)

        for it in job.get("items", []):
            started = time.time()
            try:
                import re

                seed = int(it.get("seed", 1))
                anchor = it.get("anchor")
                if anchor and not os.path.exists(anchor):
                    raise FileNotFoundError(f"anchor clip not found: {anchor}")
                language = it.get("language", "en")
                text_in = re.sub(r"^[\s.\u2026]+", "", it["text"]).strip() or it["text"]  # a leading ellipsis makes the model mumble
                need = _threshold(it["text"], language, verify_cfg or {}) if asr is not None else None
                best, best_score, tries = None, -1.0, 0
                for attempt in range(3 if asr is not None else 1):
                    tries += 1
                    torch.manual_seed(seed + attempt * 7919)
                    if device == "cuda":
                        torch.cuda.manual_seed_all(seed + attempt * 7919)
                    wav = model.generate(
                        text_in,
                        language_id=language,
                        audio_prompt_path=anchor or None,
                        exaggeration=float(it.get("exaggeration", 0.5)),
                        cfg_weight=float(it.get("cfg", 0.5)) if attempt == 0 else 0.5,
                    )
                    audio = wav.squeeze().detach().cpu().numpy().astype(np.float32)
                    if audio.size == 0 or not np.isfinite(audio).all():
                        continue
                    score = 1.0
                    if asr is not None:
                        import librosa

                        wav16 = librosa.resample(audio, orig_sr=model.sr, target_sr=16000)
                        lang_arg = {"hi": "hindi", "en": "english"}.get(language, language)
                        heard = asr({"raw": wav16, "sampling_rate": 16000}, chunk_length_s=30, generate_kwargs={"language": lang_arg, "task": "transcribe"})["text"]
                        score = _similarity(it["text"], heard)
                    if score > best_score:
                        best, best_score = audio, score
                    if need is None or score >= need:
                        break
                if best is None:
                    raise ValueError("empty or invalid audio")
                if need is not None and best_score < need:
                    raise ValueError(f"speech check failed: best similarity {best_score:.2f} (needs {need:.2f}) after {tries} tries")
                audio = best
                peak = float(np.max(np.abs(audio)))
                if peak > 0.95:  # never write a clipped file: scale hot output down first
                    audio = audio * (0.9 / peak)
                sf.write(it["out"], audio, model.sr, subtype="PCM_16")
                result["items"].append({"id": it["id"], "ok": True, "seconds": round(len(audio) / model.sr, 2), "took": round(time.time() - started, 2), "sr": model.sr, "similarity": round(best_score, 3) if asr is not None else None, "tries": tries})
                note = f" (matches the text {best_score:.2f}, {tries} {'try' if tries == 1 else 'tries'})" if asr is not None else ""
                print(f"ITEM {it['id']} ok {len(audio) / model.sr:.1f}s in {time.time() - started:.1f}s{note}", flush=True)
            except Exception as e:  # noqa: BLE001
                if device == "cuda":
                    torch.cuda.empty_cache()
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
