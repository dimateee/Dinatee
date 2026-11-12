"""Озвучка XTTS-v2 по фразам с выбором лучшего дубля (как pick_takes.py для Piper).
Каждая фраза — отдельная генерация (так XTTS не «додумывает» слоги на стыках), до --takes дублей,
проверка faster-whisper, берётся ближайший к тексту. Результат: out_dir/takes.json для tts_markup.py --takes.

.venv-xtts/bin/python tools/xtts_takes.py vo_markup.txt out_dir [--speaker "Viktor Menelaos"] [--takes 5] [--min 0.92]
Лицензия модели XTTS-v2 — Coqui Public Model License (некоммерческая). См. notes.md."""
import argparse, difflib, hashlib, json, os, re
os.environ["COQUI_TOS_AGREED"] = "1"
import torch
from TTS.api import TTS
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out")
ap.add_argument("--speaker", default="Viktor Menelaos")
ap.add_argument("--takes", type=int, default=5)
ap.add_argument("--min", type=float, default=0.92)
a = ap.parse_args()
torch.set_num_threads(4)
os.makedirs(os.path.join(a.out, "xtts"), exist_ok=True)

norm = lambda s: re.sub(r"[^а-я0-9 ]", "", s.lower().replace("ё", "е")).strip()
NUM = {"шесть тридцать": "630", "семь сорок": "740", "семь": "7", "восемь": "8", "пятнадцать": "15", "шестнадцать": "16",
       "девятнадцатый": "19", "шестьдесят шестой": "66"}
def canon(s):
    s = norm(s)
    for k, v in NUM.items(): s = s.replace(k, v)
    return s.replace(" ", "")

phrases = []
for line in open(a.script, encoding="utf-8"):
    if "|" in line:
        for p in re.split(r"\s*(?:///|//|/)\s*", line.split("|", 1)[1].strip()):
            if p.strip(): phrases.append(p.strip())

tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
wm = WhisperModel("medium", device="cpu", compute_type="int8")
result, report = {}, []
for ph in phrases:
    text = ph.replace("RITM", "Ритм").replace("—", ",")
    if not re.search(r"[.!?…»]$", text): text += "."
    target = canon(text)
    best = (-1.0, None, "")
    for k in range(a.takes):
        h = hashlib.md5(f"{a.speaker}{k}{text}".encode()).hexdigest()[:12]
        path = os.path.join(a.out, "xtts", f"{h}.wav")
        if not os.path.exists(path):
            torch.manual_seed(1000 + k)
            tts.tts_to_file(text=text, speaker=a.speaker, language="ru", file_path=path, temperature=0.6, split_sentences=False)
        segs, _ = wm.transcribe(path, language="ru", beam_size=5)
        heard = " ".join(s.text for s in segs)
        score = difflib.SequenceMatcher(a=target, b=canon(heard)).ratio()
        if score > best[0]: best = (score, path, heard)
        if score >= a.min: break
    result[ph] = best[1]
    report.append(f"{best[0]:.2f}  {ph}  →  {best[2].strip()}")
    print(report[-1], flush=True)
json.dump(result, open(os.path.join(a.out, "takes_xtts.json"), "w"), ensure_ascii=False, indent=1)
open(os.path.join(a.out, "takes_xtts_report.txt"), "w").write("\n".join(report) + "\n")
