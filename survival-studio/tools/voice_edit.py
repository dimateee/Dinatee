"""Монтаж голоса: паузы длиннее --max сокращаются до --keep (режем только в тишине,
кроссфейд --xfade мс). Вход — любой аудиофайл, выход — WAV 48 кГц моно.

.venv/bin/python tools/voice_edit.py in.mp3 out.wav [--max 0.5 --keep 0.30 --xfade 20 --db -45]
Печатает список сокращённых пауз (cuts.json рядом с out.wav)."""
import argparse, json, re, subprocess, wave
from pathlib import Path
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--max", type=float, default=0.5)
ap.add_argument("--keep", type=float, default=0.30)
ap.add_argument("--xfade", type=float, default=20)
ap.add_argument("--db", type=float, default=-45)
a = ap.parse_args()
SR = 48000

pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", a.inp, "-ac", "1", "-ar", str(SR),
                      "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768

log = subprocess.run(["ffmpeg", "-i", a.inp, "-af", f"silencedetect=n={a.db}dB:d={a.max}",
                      "-f", "null", "-"], capture_output=True, text=True).stderr
starts = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]
ends = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
dur = len(x) / SR
sil = [(s, e) for s, e in zip(starts, ends) if 0.05 < s and e < dur - 0.05]  # края не трогаем

xf = int(a.xfade / 1000 * SR)
half = a.keep / 2
pieces, cuts, pos = [], [], 0.0
for s, e in sil:
    cut_a, cut_b = s + half, e - half          # вырезаем середину паузы
    pieces.append(x[int(pos * SR):int(cut_a * SR) + xf])
    cuts.append({"start": round(s, 3), "end": round(e, 3), "was": round(e - s, 3), "now": a.keep})
    pos = cut_b
pieces.append(x[int(pos * SR):])

out = pieces[0]
fade_out = np.linspace(1, 0, xf, dtype=np.float32); fade_in = 1 - fade_out
for p in pieces[1:]:
    tail, head = out[-xf:], p[:xf]
    out = np.concatenate([out[:-xf], tail * fade_out + head * fade_in, p[xf:]])

with wave.open(a.out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
Path(a.out).with_name("cuts.json").write_text(json.dumps(cuts, indent=1))
print(f"пауз сокращено: {len(cuts)}; {dur:.2f} с -> {len(out) / SR:.2f} с")
