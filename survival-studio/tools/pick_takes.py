"""Выбор лучшего дубля для Piper: для каждой фразы сценария синтезирует дубли с разными
параметрами шума и темпа, распознаёт faster-whisper и берёт дубль, ближе всего к тексту.
Результат — takes.json {фраза: путь к wav}; его подхватывает tts_markup.py --takes.

.venv/bin/python tools/pick_takes.py vo_markup.txt out_dir [--model путь.onnx] [--min 0.9]"""
import argparse, difflib, json, os, re, subprocess, hashlib
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out")
ap.add_argument("--model", default=os.path.join(os.path.dirname(__file__), "voices", "ru_RU-denis-medium.onnx"))
ap.add_argument("--min", type=float, default=0.9)
a = ap.parse_args()
os.makedirs(os.path.join(a.out, "takes"), exist_ok=True)
PIPER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".venv", "bin", "piper")
VARIANTS = [(1.25, 0.33, 0.5), (1.25, 0.5, 0.6), (1.2, 0.667, 0.8), (1.3, 0.4, 0.5), (1.25, 0.2, 0.4), (1.15, 0.5, 0.7)]

norm = lambda s: re.sub(r"[^а-я0-9 ]", "", s.lower().replace("ё", "е")).strip()
NUM = {"шесть тридцать": "630", "семь сорок": "740", "семь": "7", "пятнадцать": "15", "шестнадцать": "16",
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

wm = WhisperModel("medium", device="cpu", compute_type="int8")
result, report = {}, []
for ph in phrases:
    tts_text = ph.replace("RITM", "Ритм")
    target = canon(tts_text)
    best = (-1, None, "")
    for ls, ns, nw in VARIANTS:
        h = hashlib.md5(f"{a.model}{ls}{ns}{nw}{tts_text}".encode()).hexdigest()[:12]
        path = os.path.join(a.out, "takes", f"{h}.wav")
        if not os.path.exists(path):
            subprocess.run([PIPER, "-m", a.model, "-f", path, "--length-scale", str(ls), "--noise-scale", str(ns),
                            "--noise-w-scale", str(nw)], input=tts_text.encode(), check=True, capture_output=True)
        segs, _ = wm.transcribe(path, language="ru", beam_size=5)
        heard = " ".join(s.text for s in segs)
        score = difflib.SequenceMatcher(a=target, b=canon(heard)).ratio()
        if score > best[0]: best = (score, path, heard)
        if score >= a.min: break
    result[ph] = best[1]
    report.append(f"{best[0]:.2f}  {ph}  →  {best[2].strip()}")
    print(report[-1], flush=True)
json.dump(result, open(os.path.join(a.out, "takes.json"), "w"), ensure_ascii=False, indent=1)
open(os.path.join(a.out, "takes_report.txt"), "w").write("\n".join(report) + "\n")
