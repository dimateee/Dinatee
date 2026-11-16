"""Разные голоса персонажей из одного дикторского дубля: участок по словам → свой фильтр ffmpeg, длина сохраняется.
.venv/bin/python tools/char_voices.py <эпизод> 'первое_слово|последнее_слово|фильтр' ...
Исходник сохраняется рядом как voice_narrator.wav; результат перезаписывает voice_final.wav."""
import json, os, shutil, subprocess, sys, tempfile
import wave
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ep = sys.argv[1]; d = os.path.join(ROOT, "episodes", ep)
words = json.load(open(os.path.join(d, "words.json")))["words"]
n = lambda s: s.lower().replace("ё", "е").strip(".,:;!?—«»\"– ")
src = os.path.join(d, "voice", "voice_narrator.wav")
if not os.path.exists(src): shutil.copy(os.path.join(d, "voice", "voice_final.wav"), src)
def rd(p):
    sr = int(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.split()[0])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64), sr
def wr(p, x, sr):
    with wave.open(p, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
a, sr = rd(src); out = a.copy()
for spec in sys.argv[2:]:
    w0, w1, flt = spec.split("|", 2)
    i0 = next(i for i, x in enumerate(words) if n(x["word"]) == w0)
    i1 = next(i for i, x in enumerate(words) if i >= i0 and n(x["word"]) == w1)
    t0, t1 = words[i0]["start"] - 0.06, words[i1]["end"] + 0.12
    s0, s1 = int(t0 * sr), int(t1 * sr)
    with tempfile.TemporaryDirectory() as td:
        fi, fo = os.path.join(td, "i.wav"), os.path.join(td, "o.wav")
        wr(fi, a[s0:s1], sr)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", fi, "-af", flt, "-ar", str(sr), "-ac", "1", "-c:a", "pcm_s16le", fo], check=True)
        b, _ = rd(fo)
    b = b[: s1 - s0] if len(b) >= s1 - s0 else np.pad(b, (0, s1 - s0 - len(b)))
    rms = lambda x: np.sqrt(np.mean(x ** 2) + 1e-12)
    b *= rms(a[s0:s1]) / rms(b)
    f = int(0.02 * sr); win = np.ones(len(b)); win[:f] = np.linspace(0, 1, f); win[-f:] = np.linspace(1, 0, f)
    out[s0:s1] = a[s0:s1] * (1 - win) + b * win
    print(f"{w0}…{w1}: {t0:.2f}–{t1:.2f}")
wr(os.path.join(d, "voice", "voice_final.wav"), out, sr)
