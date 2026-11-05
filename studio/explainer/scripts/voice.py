"""Narration for $0 on this computer: Kokoro-82M text-to-speech (Apache-2.0) via kokoro-onnx. No account, no API.

  scripts/py scripts/voice.py <project>          script.json -> data/narration.wav + data/lines.json (exact line times)
  scripts/py scripts/voice.py --list             voices that narrate well
  scripts/py scripts/voice.py --download         only fetch the model files (~340 MB, once)

script.json: { "voice": "am_michael", "speed": 1.05, "lead": 0.45, "outro": 0.9, "gap": 0.32,
               "lines": [ { "text": "What if you swallow gum?", "caps": "...", "gap": 0.3 }, ... ] }
Multi-voice / other languages (all optional, per line, falling back to the script-level voice/speed/lang):
               { "text": "...", "speaker": "pet", "voice": "hm_psi", "lang": "hi", "speed": 0.9, "pitch": -2 }
  lang defaults from the voice's first letter (a en-us, b en-gb, h hi, ...). pitch = semitones (tempo is kept).
  Lines with different voice/lang/speed/pitch are NEVER merged into one pass. "speaker" is passed through to lines.json.
One line = one CUT, not one sentence: a sentence can run across several lines ("It slides down your throat and lands
in your stomach," / "where acid gets to work on it."). Lines are grouped into whole sentences and each sentence is
spoken in ONE pass, so the intonation flows naturally; then every cut inside a sentence is found in the audio (snapped
to the nearest pause, else placed by length). "gap" (on a sentence's last line) = the pause after that sentence.
Write numbers the way they're SAID. Then run words.py for the word timings.
"""
import argparse, json, os, re, sys, urllib.request
from pathlib import Path
import numpy as np
from scipy.io import wavfile

HOME = Path(os.environ.get('FACELESS_HOME', Path.home() / '.faceless-shorts'))
KDIR = HOME / 'kokoro'
FILES = {
    'kokoro-v1.0.onnx': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
    'voices-v1.0.bin': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
}
GOOD = {
    'am_michael': 'US male, steady explainer (default)', 'am_puck': 'US male, lively, playful', 'am_fenrir': 'US male, deeper',
    'am_onyx': 'US male, low', 'af_heart': 'US female, warm (best overall)', 'af_bella': 'US female, bright',
    'af_nicole': 'US female, soft and close', 'bm_george': 'UK male, documentary', 'bm_fable': 'UK male, storyteller',
    'bf_emma': 'UK female, calm',
}
SR = 24000
LANGS = {'a': 'en-us', 'b': 'en-gb', 'e': 'es', 'f': 'fr-fr', 'h': 'hi', 'i': 'it', 'j': 'ja', 'p': 'pt-br', 'z': 'cmn'}
GOOD.update({'hf_alpha': 'Hindi female', 'hf_beta': 'Hindi female (2nd)', 'hm_omega': 'Hindi male', 'hm_psi': 'Hindi male (2nd)'})
SENT_END = re.compile(r'[.?!\u2026\u0964]["\')\u201d]*$')   # . ? ! ... and the Devanagari danda


def ensure_models():
    KDIR.mkdir(parents=True, exist_ok=True)
    for name, url in FILES.items():
        p = KDIR / name
        if p.exists() and p.stat().st_size > 1_000_000: continue
        print(f'downloading {name} (once)...', flush=True)
        tmp = p.with_suffix('.part'); urllib.request.urlretrieve(url, tmp); tmp.rename(p)


def trim(x, thr=0.008):
    """cut leading/trailing silence so line start/end times are exact"""
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx): return x
    a = max(0, idx[0] - int(0.01 * SR)); b = min(len(x), idx[-1] + int(0.03 * SR)); return x[a:b]


def silences(x, thr=0.012, min_len=0.06):
    """pauses inside speech: [(start_s, end_s)] where the 10 ms RMS stays under thr for >= min_len"""
    hop = int(0.01 * SR); n = len(x) // hop
    rms = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1)); quiet = rms < thr * np.abs(x).max()
    out, st = [], None
    for f, q in enumerate(quiet):
        if q and st is None: st = f
        if (not q or f == n - 1) and st is not None:
            if (f - st) * 0.01 >= min_len: out.append((st * 0.01, f * 0.01))
            st = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project', nargs='?'); ap.add_argument('--list', action='store_true'); ap.add_argument('--download', action='store_true')
    ap.add_argument('--voice'); ap.add_argument('--speed', type=float)
    a = ap.parse_args()
    if a.list:
        for k, v in GOOD.items(): print(f'{k:12s} {v}')
        return
    ensure_models()
    if a.download: return
    if not a.project: ap.error('project folder missing')
    from kokoro_onnx import Kokoro
    P = Path(a.project); S = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    voice = a.voice or S.get('voice', 'am_michael'); speed = a.speed or S.get('speed', 1.0)
    k = Kokoro(str(KDIR / 'kokoro-v1.0.onnx'), str(KDIR / 'voices-v1.0.bin'))

    def spec(ln):      # (voice, lang, speed, pitch) for one line; falls back to the script level
        v = ln.get('voice') or voice
        return (v, ln.get('lang') or S.get('lang') or LANGS.get(v[:1], 'en-us'), float(ln.get('speed') or speed), float(ln.get('pitch') or 0))

    def say(text, sp):
        v, lang, spd, pitch = sp; f = 2 ** (pitch / 12)
        x = np.asarray(k.create(text, voice=v, speed=spd / f, lang=lang)[0], dtype=np.float64)
        if pitch:
            from scipy.signal import resample_poly
            x = resample_poly(x, 100, int(round(100 * f)))     # faster playback = higher pitch; speed/f above keeps the tempo
        return trim(x)
    specs = [spec(ln) for ln in S['lines']]; multi = len(set(specs)) > 1
    # group the lines into whole sentences (a line ending in . ? ! closes one; "break": true forces a close);
    # a change of voice/lang/speed/pitch always closes the group: different speakers are never merged into one pass
    groups, cur = [], []
    for i, ln in enumerate(S['lines']):
        cur.append(i)
        last = i == len(S['lines']) - 1
        if SENT_END.search(ln['text'].strip()) or ln.get('break') or last or specs[i + 1] != specs[i]: groups.append(cur); cur = []
    out = [np.zeros(int(S.get('lead', 0.4) * SR))]; t = len(out[0]) / SR; lines = [None] * len(S['lines'])
    for g in groups:
        sp = specs[g[0]]
        x = say(' '.join(S['lines'][i]['text'] for i in g), sp)
        if multi:                                          # even loudness between voices
            act = x[np.abs(x) > 0.02 * np.abs(x).max()]; x = x * (0.13 / (np.sqrt(np.mean(act ** 2)) + 1e-9)); x = np.clip(x, -0.98, 0.98)
        cuts = [0.0]
        if len(g) > 1:                                    # find each cut inside the sentence
            lens = np.array([len(say(S['lines'][i]['text'], sp)) for i in g], dtype=float)
            pauses = silences(x)
            for c in np.cumsum(lens)[:-1] / lens.sum() * len(x) / SR:
                near = [p for p in pauses if abs((p[0] + p[1]) / 2 - c) < 0.4]
                if near: p = min(near, key=lambda p: abs((p[0] + p[1]) / 2 - c)); cuts.append((p[0], p[1]))
                else: cuts.append((c, c))
        n = len(x) / SR
        for j, i in enumerate(g):
            a = 0.0 if j == 0 else cuts[j][1]; b = n if j == len(g) - 1 else cuts[j + 1][0]
            lines[i] = {'i': i, 'text': S['lines'][i]['text'], 'start': round(t + a, 3), 'end': round(t + b, 3)}
            for key in ('speaker',): 
                if S['lines'][i].get(key): lines[i][key] = S['lines'][i][key]
            if multi: lines[i]['voice'] = specs[i][0]
            print(f'{i:2d} {lines[i]["start"]:6.2f}-{lines[i]["end"]:6.2f}  {S["lines"][i].get("speaker", ""):7s} {S["lines"][i]["text"]}', flush=True)
        gap = np.zeros(int(float(S['lines'][g[-1]].get('gap', S.get('gap', 0.3))) * SR))
        out += [x, gap]; t += (len(x) + len(gap)) / SR
    outro = np.zeros(int(float(S.get('outro', 0.9)) * SR)); out.append(outro)
    y = np.concatenate(out); y = y / (np.abs(y).max() + 1e-9) * 0.9
    (P / 'data').mkdir(exist_ok=True)
    wavfile.write(P / 'data/narration.wav', SR, (y * 32767).astype(np.int16))
    dur = len(y) / SR
    (P / 'data/lines.json').write_text(json.dumps({'duration': round(dur, 3), 'voice': voice, 'speed': speed, 'lines': lines}, indent=1), encoding='utf-8')
    print(f'data/narration.wav ({dur:.2f} s, {voice if not multi else "voices: " + ", ".join(sorted({q[0] for q in specs}))} x{speed}) + data/lines.json. Next: words.py')


if __name__ == '__main__':
    main()
