"""Word timings with local Whisper (faster-whisper small.en, MIT) -> data/words.json [{w, line, s, e}].

  scripts/py scripts/words.py <project>                       after voice.py (uses data/narration.wav + data/lines.json)
  scripts/py scripts/words.py <project> --audio my_vo.m4a      YOUR OWN recording: becomes data/narration.wav, and the
                                                               line times (data/lines.json) are rebuilt from what you said

The words keep the SCRIPT's spelling with the times Whisper heard. Words Whisper heard differently ("7" vs "seven")
or missed share the time between their matched neighbours, by length. Also writes data/words.txt to eyeball.

No Whisper (not installed, or its model can't download)? After voice.py the line times are exact anyway, so each
line's words are spread inside it by length, with pauses at commas and full stops (within ~0.1-0.2 s of the speech).
"""
import argparse, json, re, subprocess, unicodedata
from difflib import SequenceMatcher
from pathlib import Path

def norm(w):
    """lower-case letters/digits/combining marks only (works for Latin and Devanagari; matras are marks)"""
    return ''.join(c for c in unicodedata.normalize('NFC', w).lower() if unicodedata.category(c)[0] in 'LMN')


def phonemes(w):
    """rough length of a word in sounds: letters + vowel signs, without the virama/nukta (Latin: its letters)"""
    return sum(1 for c in norm(w) if c not in '़्') or 1


def english_only(S):
    langs = {(ln.get('lang') or S.get('lang') or ('en' if (ln.get('voice') or S.get('voice', 'am'))[:1] in 'ab' else 'x')).lower() for ln in S['lines']}
    return all(l.startswith('en') for l in langs)


def pause_bounds(P, lo, hi, need):
    """the `need` longest pauses of the narration inside [lo, hi] (sorted by time), or None if the audio has fewer"""
    try:
        import numpy as np
        from scipy.io import wavfile
        sr, x = wavfile.read(P / 'data/narration.wav'); x = x.astype(np.float64) / 32768.0
        seg = x[int(lo * sr):int(hi * sr)]; hop = int(0.01 * sr); n = len(seg) // hop
        rms = np.sqrt(np.mean(seg[:n * hop].reshape(n, hop) ** 2, axis=1)); quiet = rms < 0.03 * np.abs(seg).max()
        runs, st = [], None
        for f, q in enumerate(quiet):
            if q and st is None: st = f
            if (not q or f == n - 1) and st is not None:
                if (f - st) >= 6 and st > 5 and f < n - 5: runs.append((lo + st * 0.01, lo + f * 0.01))
                st = None
        if len(runs) < need: return None
        return sorted(sorted(runs, key=lambda r: r[0] - r[1])[:need])
    except Exception:
        return None


def align(script_words, heard, t0, t1):
    """script_words: [str]; heard: [(word, s, e)] → [(s, e)] per script word, inside [t0, t1]"""
    a = [norm(w) for w in script_words]; b = [norm(h[0]) for h in heard]
    times = [None] * len(a)
    for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size): times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
    # fill gaps between matched neighbours, split by word length
    i = 0
    while i < len(a):
        if times[i] is not None: i += 1; continue
        j = i
        while j < len(a) and times[j] is None: j += 1
        lo = times[i - 1][1] if i > 0 else t0; hi = times[j][0] if j < len(a) else t1
        if hi <= lo: hi = lo + 0.05 * (j - i)
        L = [max(1, len(a[k])) for k in range(i, j)]; tot = sum(L); c = lo
        for k, l in zip(range(i, j), L): d = (hi - lo) * l / tot; times[k] = (c, c + d * 0.9); c += d
        i = j
    return times


def inline_fallback(P, S):
    L = json.loads((P / 'data/lines.json').read_text(encoding='utf-8'))['lines']; words = []; snapped = 0
    for i, ln in enumerate(S['lines']):
        toks = [w for w in ln['text'].split() if norm(w)]
        mid = [k for k, w in enumerate(toks[:-1]) if re.search(r'[.?!\u2026\u0964;:]$', w.rstrip('"\')\u201d')) and not w.endswith(',')]   # sentence-ish pauses inside the line
        lo, hi = L[i]['start'], L[i]['end']
        pb = pause_bounds(P, lo, hi, len(mid)) if mid else []
        if mid and pb: snapped += 1
        # speech spans: between detected pauses when they were found, else the whole line with weighted pauses
        spans, cur0 = [], 0
        if mid and pb:
            edges = [lo] + [e for p in pb for e in p] + [hi]
            for j, k in enumerate(mid + [len(toks) - 1]): spans.append((cur0, k, edges[2 * j], edges[2 * j + 1])); cur0 = k + 1
        else: spans.append((0, len(toks) - 1, lo, hi))
        for (a0, a1, t0, t1) in spans:
            ws = toks[a0:a1 + 1]
            wts = [phonemes(w) + 2.5 + (2.5 if w.endswith(',') else (4.5 if (not pb and re.search(r'[.?!…।]$', w.rstrip('"\')”')) and a0 + ws.index(w) < len(toks) - 1) else 0)) for w in ws]
            c = t0; tot = sum(wts)
            for w, wt in zip(ws, wts):
                d = (t1 - t0) * wt / tot; speak = d - (t1 - t0) * (wt - phonemes(w) - 2.5) / tot
                words.append({'w': w, 'line': i, 's': round(c, 3), 'e': round(c + speak * 0.92, 3)}); c += d
    (P / 'data/words.json').write_text(json.dumps(words, indent=1), encoding='utf-8')
    (P / 'data/words.txt').write_text(chr(10).join(f"{w['s']:7.2f} {w['e']:7.2f}  L{w['line']:<2d} {w['w']}" for w in words), encoding='utf-8')
    print(f'data/words.json: {len(words)} words (spread inside the voice line times; {snapped} lines snapped to detected pauses)')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('project'); ap.add_argument('--audio'); a = ap.parse_args()
    P = Path(a.project); S = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    if not english_only(S) and not a.audio and (P / 'data/lines.json').exists():
        print('Whisper small.en is English-only: not aligning this non-English script with it')
        return inline_fallback(P, S)
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel('small.en', device='cpu', compute_type='int8')
    except Exception as e:
        if a.audio or not (P / 'data/lines.json').exists():
            raise SystemExit(f'Whisper is needed for your own recording and could not load: {e}')
        print(f'Whisper unavailable ({type(e).__name__}); spreading words inside the exact line times instead')
        return inline_fallback(P, S)
    if a.audio:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.audio, '-ac', '1', '-ar', '24000', str(P / 'data/narration.wav')], check=True)
    try:   # decode with ffmpeg ourselves (avoids PyAV version problems), 16 kHz mono float32
        import numpy as np
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(P / 'data/narration.wav'), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        segs, _ = model.transcribe(np.frombuffer(raw, dtype=np.float32), word_timestamps=True, vad_filter=False)
        heard = [(w.word.strip(), w.start + 0.04, w.end) for s in segs for w in s.words]   # Whisper starts run a little early
    except Exception as e:
        if a.audio or not (P / 'data/lines.json').exists():
            raise SystemExit(f'Whisper could not transcribe the recording: {e}')
        print(f'Whisper failed ({type(e).__name__}: {e}); spreading words inside the exact line times instead')
        return inline_fallback(P, S)
    toks = [(w, i) for i, ln in enumerate(S['lines']) for w in ln['text'].split() if norm(w)]
    dur_audio = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(P / 'data/narration.wav')], capture_output=True, text=True).stdout)
    times = align([w for w, _ in toks], heard, 0.0, dur_audio)
    words = [{'w': w, 'line': i, 's': round(s, 3), 'e': round(e, 3)} for (w, i), (s, e) in zip(toks, times)]
    if a.audio or not (P / 'data/lines.json').exists():
        lines = []
        for i, ln in enumerate(S['lines']):
            ws = [w for w in words if w['line'] == i]; lines.append({'i': i, 'text': ln['text'], 'start': ws[0]['s'], 'end': ws[-1]['e']})
        (P / 'data/lines.json').write_text(json.dumps({'duration': round(dur_audio, 3), 'lines': lines}, indent=1))
    else:   # keep every word inside its line's exact TTS window
        L = json.loads((P / 'data/lines.json').read_text(encoding='utf-8'))['lines']
        for w in words: lo, hi = L[w['line']]['start'], L[w['line']]['end']; w['s'] = round(min(max(w['s'], lo), hi), 3); w['e'] = round(min(max(w['e'], w['s']), hi), 3)
    (P / 'data/words.json').write_text(json.dumps(words, indent=1))
    (P / 'data/words.txt').write_text('\n'.join(f"{w['s']:7.2f} {w['e']:7.2f}  L{w['line']:<2d} {w['w']}" for w in words))
    print(f'data/words.json: {len(words)} words (Whisper heard {len(heard)})')


if __name__ == '__main__':
    main()
