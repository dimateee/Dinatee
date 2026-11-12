"""Озвучка сценария с разметкой пауз через ElevenLabs.
Каждая фраза между паузами генерируется отдельно (с previous_text/next_text для связной интонации),
края обрезаются по тишине, паузы вставляются строго по разметке: «/» 0,6 с, «//» 1,2 с, «///» 2,5 с.

.venv/bin/python tools/tts_markup.py script.txt out_dir [--voice ID] [--speed 0.84] [--stability 0.7]
script.txt — строки «ключ|текст с разметкой». Результат: out_dir/raw.wav, out_dir/segments.json, кэш фраз в out_dir/phrases/.
Ключ API подставляет прокси окружения (в заголовке xi-api-key стоит заглушка)."""
import argparse, hashlib, json, os, re, subprocess, wave
import numpy as np
import requests

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out")
ap.add_argument("--voice", default="JBFqnCBsd6RMkjVDRZzb")  # George
ap.add_argument("--speed", type=float, default=0.84)
ap.add_argument("--stability", type=float, default=0.7)
ap.add_argument("--style", type=float, default=0.0)
ap.add_argument("--engine", choices=["elevenlabs", "piper"], default="elevenlabs")
ap.add_argument("--piper-model", default=os.path.join(os.path.dirname(__file__), "voices", "ru_RU-denis-medium.onnx"))
ap.add_argument("--length-scale", type=float, default=1.12)
ap.add_argument("--noise-scale", type=float, default=0.6)
ap.add_argument("--noise-w", type=float, default=0.7)
ap.add_argument("--takes", default="", help="takes.json из tools/pick_takes.py: готовые лучшие дубли фраз")
a = ap.parse_args()
TAKES = json.load(open(a.takes, encoding="utf-8")) if a.takes else {}
SR = 48000
PAUSE = {"/": 0.6, "//": 1.2, "///": 2.5}
os.makedirs(os.path.join(a.out, "phrases"), exist_ok=True)

# Разбор: список (ключ блока, фраза, пауза после)
items = []
for line in open(a.script, encoding="utf-8"):
    if "|" not in line: continue
    key, text = line.rstrip("\n").split("|", 1)
    toks = re.split(r"\s*(///|//|/)\s*", text.strip())
    for i in range(0, len(toks), 2):
        phrase = toks[i].strip()
        if not phrase: continue
        pause = PAUSE[toks[i + 1]] if i + 1 < len(toks) else 0.6
        items.append((key, phrase, pause))

def tts_piper(text):
    h = hashlib.md5(f"piper{a.piper_model}{a.length_scale}{a.noise_scale}{a.noise_w}{text}".encode()).hexdigest()[:12]
    path = os.path.join(a.out, "phrases", f"p_{h}.wav")
    if not os.path.exists(path):
        piper = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".venv", "bin", "piper")
        subprocess.run([piper, "-m", a.piper_model, "-f", path, "--length-scale", str(a.length_scale),
                        "--noise-scale", str(a.noise_scale), "--noise-w-scale", str(a.noise_w)],
                       input=text.encode(), check=True, capture_output=True)
    return path

def tts(text, prev, nxt):
    if text in TAKES:
        return TAKES[text]
    text = text.replace("RITM", "Ритм")  # произношение; на экране остаётся RITM
    if a.engine == "piper":
        return tts_piper(text)
    h = hashlib.md5(f"{a.voice}{a.speed}{a.stability}{a.style}{text}{prev}{nxt}".encode()).hexdigest()[:12]
    path = os.path.join(a.out, "phrases", f"{h}.mp3")
    if not os.path.exists(path):
        body = {"text": text, "model_id": "eleven_multilingual_v2", "language_code": "ru",
                "previous_text": prev, "next_text": nxt,
                "voice_settings": {"stability": a.stability, "similarity_boost": 0.75, "style": a.style,
                                   "use_speaker_boost": True, "speed": a.speed}}
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{a.voice}?output_format=mp3_44100_128",
                          headers={"xi-api-key": "proxy-injected"}, json=body, timeout=120)
        r.raise_for_status()
        open(path, "wb").write(r.content)
    return path

def load_trim(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    env = np.convolve(np.abs(x), np.ones(480) / 480, mode="same")
    on = np.where(env > 10 ** (-45 / 20))[0]
    a0, a1 = max(0, on[0] - int(0.05 * SR)), min(len(x), on[-1] + int(0.08 * SR))  # 50 мс до, 80 мс после
    y = x[a0:a1].copy()
    f = int(0.012 * SR)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)  # мягкие края (10–30 мс)
    return y

out, segs, t = [], [], 0.35
out.append(np.zeros(int(0.35 * SR), np.float32))
for i, (key, phrase, pause) in enumerate(items):
    prev = items[i - 1][1] if i else ""
    nxt = items[i + 1][1] if i + 1 < len(items) else ""
    y = load_trim(tts(phrase, prev, nxt))
    segs.append({"key": key, "text": phrase, "start": round(t, 3), "end": round(t + len(y) / SR, 3), "pause_after": pause})
    out += [y, np.zeros(int(pause * SR), np.float32)]
    t += len(y) / SR + pause
audio = np.concatenate(out)
with wave.open(os.path.join(a.out, "raw.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
json.dump(segs, open(os.path.join(a.out, "segments.json"), "w"), ensure_ascii=False, indent=1)
print(f"фраз: {len(items)}, длительность {len(audio) / SR:.1f} с")
