"""Обрезка «хвостов» XTTS: модель иногда договаривает лишний слог после конца фразы («понте», «Поя»).
По таймкодам слов faster-whisper находит последнее слово сценария и режет дубль через 90 мс после него.
.venv-xtts/bin/python tools/xtts_trim.py voice_dir   (читает takes_xtts.json, пишет takes_xtts_trim.json)"""
import json, os, re, sys, subprocess
from faster_whisper import WhisperModel

d = sys.argv[1]
takes = json.load(open(os.path.join(d, "takes_xtts.json"), encoding="utf-8"))
os.makedirs(os.path.join(d, "xtts_trim"), exist_ok=True)
wm = WhisperModel("medium", device="cpu", compute_type="int8")
norm = lambda s: re.sub(r"[^а-я0-9]", "", s.lower().replace("ё", "е"))
NUM = {"восемь": "8", "семь": "7", "пятнадцать": "15", "шестнадцать": "16", "тридцать": "30", "сорок": "40"}
out, rep = {}, []
for ph, path in takes.items():
    last = norm(ph.replace("RITM", "Ритм").split()[-1])
    segs, _ = wm.transcribe(path, language="ru", word_timestamps=True, beam_size=5)
    words = [w for s in segs for w in (s.words or [])]
    cut = None
    for w in words:
        n = norm(w.word)
        if n and (n.startswith(last[:4]) or last.startswith(n[:4]) or NUM.get(last) and n.startswith(NUM[last])):
            cut = w.end
    dst = os.path.join(d, "xtts_trim", os.path.basename(path))
    if cut is not None and words and words[-1].end > cut + 0.05:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-t", f"{cut + 0.09:.3f}", "-af", "afade=t=out:st=%.3f:d=0.06" % (cut + 0.03), dst], check=True)
        rep.append(f"обрезано после «{ph.split()[-1]}» на {cut:.2f} с (было слов после: {' '.join(w.word for w in words if w.start >= cut)})")
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, dst], check=True)
    out[ph] = dst
json.dump(out, open(os.path.join(d, "takes_xtts_trim.json"), "w"), ensure_ascii=False, indent=1)
print("\n".join(rep) if rep else "хвостов нет")
