"""Выравнивает слова faster-whisper по тексту сценария: тайминги — из распознавания,
написание — из сценария (ё, дефисы, пунктуация). Слова, которые Whisper склеил или
записал цифрами, получают время интерполяцией внутри своего промежутка.

.venv/bin/python tools/align_words.py whisper.json script_text.txt words.json"""
import json, re, sys
from difflib import SequenceMatcher

wj, txt, out = sys.argv[1:4]
asr = json.load(open(wj, encoding="utf-8"))["words"]
text = open(txt, encoding="utf-8").read()

# Токены сценария: слово + прилипшая пунктуация; номер абзаца = кусок сценария
script = []
for part_i, para in enumerate([p for p in text.split("\n\n") if p.strip()], start=1):
    for tok in re.findall(r"[«(]*[\wЁё]+(?:-[\wЁё]+)*[»).,!?:;—]*|—", para):
        if tok == "—":
            if script: script[-1]["word"] += " —"
            continue
        script.append({"word": tok, "part": part_i})

norm = lambda s: re.sub(r"[^\wё]", "", s.lower().replace("ё", "е"))
A = [norm(w["word"]) for w in asr]
B = [norm(s["word"]) for s in script]
sm = SequenceMatcher(a=A, b=B, autojunk=False)

times = [None] * len(script)
for tag, a0, a1, b0, b1 in sm.get_opcodes():
    if tag == "equal":
        for k in range(b1 - b0):
            times[b0 + k] = (asr[a0 + k]["start"], asr[a0 + k]["end"])
    elif tag == "replace" and a1 > a0:
        # Распределяем отрезок распознанных слов по словам сценария пропорционально длине
        t0, t1 = asr[a0]["start"], asr[a1 - 1]["end"]
        lens = [max(len(B[j]), 1) for j in range(b0, b1)]
        acc, total = t0, sum(lens)
        for j, L in zip(range(b0, b1), lens):
            d = (t1 - t0) * L / total
            times[j] = (acc, acc + d); acc += d

# Оставшиеся пропуски (delete в сценарии) — между соседями
for i, t in enumerate(times):
    if t is None:
        prev_end = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
        nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev_end + 0.3)
        times[i] = (prev_end, max(nxt, prev_end + 0.05))

unmatched = sum(1 for tag, *_ in sm.get_opcodes() if tag != "equal")
words = [{"word": s["word"], "part": s["part"], "start": round(t[0], 3), "end": round(t[1], 3)}
         for s, t in zip(script, times)]
json.dump({"source": wj, "words": words}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"слов в сценарии: {len(script)}, распознано: {len(asr)}, "
      f"совпало: {sum(1 for t in sm.get_opcodes() if t[0]=='equal' for _ in range(t[4]-t[3]))}, "
      f"участков с расхождением: {unmatched}")
for tag, a0, a1, b0, b1 in sm.get_opcodes():
    if tag != "equal":
        print(f"  {tag}: ASR «{' '.join(w['word'] for w in asr[a0:a1])}» -> сценарий «{' '.join(s['word'] for s in script[b0:b1])}»")
