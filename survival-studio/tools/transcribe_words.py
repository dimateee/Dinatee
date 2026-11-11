"""Распознаёт аудио через faster-whisper и сохраняет слова с таймкодами в JSON.
Использование: .venv/bin/python tools/transcribe_words.py in.wav out.json [--model small]"""
import argparse, json
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("audio"); ap.add_argument("out")
ap.add_argument("--model", default="small"); ap.add_argument("--lang", default="ru")
a = ap.parse_args()
model = WhisperModel(a.model, device="cpu", compute_type="int8")
segs, info = model.transcribe(a.audio, language=a.lang, word_timestamps=True, vad_filter=True)
words = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)}
         for s in segs for w in (s.words or [])]
json.dump({"language": info.language, "duration": info.duration, "words": words},
          open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for w in words:
    print(f"[{w['start']:6.2f}–{w['end']:6.2f}] {w['word']}")
