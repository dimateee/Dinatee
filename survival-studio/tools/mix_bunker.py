"""Звук серии «Бункер»: тревожный эмбиент (гул, сердцебиение), 4 эффекта, сведение.

.venv/bin/python tools/mix_bunker.py [1|2]
Голос: episodes/bunker-N/voice/voice_final.wav + хвост 1 с.
Музыка под голосом ≈ −25 LUFS, сайдчейн 6–8 дБ, вырез 250–500 Гц. Итог −14 LUFS, TP −1.
"""
import json, os, subprocess, sys, wave
import numpy as np
EP = int(sys.argv[1]) if len(sys.argv) > 1 else 1

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(15)
CFG = {
    1: dict(end=71.43, beat=(12.0, 45.2), tick=(12.0, 45.2), radio=(58.3, 64.0),
            mood=[(0.0, "dread"), (4.2, "calm"), (6.5, "alarm"), (11.6, "silence"), (12.0, "run"), (45.2, "shelter"), (67.4, "end")],
            sfx=[(0.00, "boom"), (6.60, "siren"), (19.28, "rumble"), (45.20, "door")]),
    2: dict(end=66.25, beat=(0.0, 0.0), tick=(12.9, 24.2), radio=(8.7, 12.9),
            mood=[(0.0, "dread"), (5.6, "shelter"), (12.8, "calm"), (24.2, "shelter"), (56.6, "end")],
            sfx=[(0.05, "rumble"), (8.74, "static"), (27.14, "tape"), (52.70, "click")]),
}[EP]
VOICE_END, TAIL = CFG["end"], 1.0
TOTAL = VOICE_END + TAIL
N = int(TOTAL * SR)
t = np.arange(N) / SR
# настроение: dread — гул после вспышки, calm — обычный вечер, alarm — сирена, silence — вдох перед правилами,
# run — сердцебиение и пульс (15 минут), shelter — подвал: низкий гул и лампа, end — финальный подъём
MOOD = CFG["mood"]
SFX = CFG["sfx"]


def lp(x, fc):
    n = max(1, int(SR / fc / 2)); k = np.ones(n) / n
    return np.convolve(np.convolve(x, k, "same"), k, "same")


def ramp(n, a, r):
    e = np.ones(n); a, r = min(a, n // 2), min(r, n // 2)
    e[:a] = np.linspace(0, 1, a); e[n - r:] = np.linspace(1, 0, r); return e


def curve(name):
    c = np.zeros(N); marks = MOOD + [(TOTAL + 1, None)]
    for (a, m), (b, _) in zip(marks, marks[1:]):
        if m == name: c[int(a * SR):int(min(b, TOTAL) * SR)] = 1
    k = int(0.5 * SR); return np.convolve(c, np.ones(k) / k, "same")


dread, calm, alarm, sil, run, shelter, end = (curve(m) for m in ("dread", "calm", "alarm", "silence", "run", "shelter", "end"))

# гул: низкие квинты с биением + шум ветра
drone = (np.sin(2 * np.pi * 41.2 * t) + 0.7 * np.sin(2 * np.pi * 61.7 * t) + 0.4 * np.sin(2 * np.pi * 82.9 * t)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t))
air = lp(rng.standard_normal(N), 500) * 4 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t))
# высокий тревожный тон (диссонанс), медленно «плывёт»
eerie = 0.18 * np.sin(2 * np.pi * (622 + 6 * np.sin(2 * np.pi * 0.2 * t)) * t) + 0.12 * np.sin(2 * np.pi * 659 * t)
# сердцебиение: «лаб-даб», темп растёт 72 → 96 уд/мин к укрытию
beat = np.zeros(N)
b0, b1 = CFG["beat"]
tt = b0
while tt < b1:
    bpm = 72 + 24 * (tt - b0) / max(1, b1 - b0)
    for off, amp in ((0, 1.0), (0.16, 0.65)):
        n0 = int((tt + off) * SR); n = int(0.18 * SR)
        if n0 + n < N:
            x = np.arange(n) / SR; beat[n0:n0 + n] += amp * np.sin(2 * np.pi * (45 + 30 * np.exp(-x * 25)) * x) * np.exp(-x * 18)
    tt += 60 / bpm
# тиканье часов в «15 минутах» — тихо, на долю
tick = np.zeros(N)
for i in range(int(CFG["tick"][0] / 0.5), int(CFG["tick"][1] / 0.5)):
    n0 = int(i * 0.5 * SR); n = int(0.03 * SR); x = np.arange(n) / SR
    tick[n0:n0 + n] += np.sin(2 * np.pi * 3000 * x) * np.exp(-x * 160) * (0.35 if i % 2 else 0.2)
# подвал: гул лампы 100 Гц + радиошум под «Правило пятое»
hum = 0.25 * np.sin(2 * np.pi * 100 * t) + 0.1 * np.sin(2 * np.pi * 200 * t)
radio = np.zeros(N); a, b = int(CFG["radio"][0] * SR), int(CFG["radio"][1] * SR)
w = rng.standard_normal(b - a); radio[a:b] = (w - lp(w, 3000)) * 0.12 * ramp(b - a, 4000, 20000)
# пэд для «обычного вечера» и финала (Dm add9)
pad = np.zeros(N)
for f0 in (146.83, 220.0, 293.66, 329.63):
    pad += np.sin(2 * np.pi * f0 * t) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.3 * t + f0))
pad /= 4

mus = (drone * (dread * 1.0 + alarm * 0.7 + run * 0.6 + shelter * 0.5 + end * 0.9)
       + air * (dread * 0.6 + run * 0.4 + end * 0.5)
       + eerie * (dread * 0.8 + run * 0.5 + end * 1.0)
       + pad * (calm * 0.6 + shelter * 0.25 + end * 0.45)
       + beat * run * 1.3 + tick * (run * 0.8 + (calm * 0.5 if EP == 2 else 0)) + hum * shelter * 0.6 + radio * 3)
mus *= (1 - 0.95 * sil)
mus *= ramp(N, int(0.05 * SR), int(1.2 * SR))
mus /= np.max(np.abs(mus)) + 1e-9
mus = np.stack([mus, np.roll(mus, int(0.012 * SR))], 1)


def sfx(kind):
    if kind == "boom":  # вспышка: низкий удар + раскат
        n = int(3.5 * SR); x = np.arange(n) / SR; w = rng.standard_normal(n)
        return (np.sin(2 * np.pi * (38 + 40 * np.exp(-x * 6)) * x) * np.exp(-x * 1.6) * 0.9 + lp(w, 180) * 6 * np.exp(-x * 1.2)) * ramp(n, 60, 9000)
    if kind == "rumble":  # ударная волна: нарастающий раскат и дребезг
        n = int(2.6 * SR); x = np.arange(n) / SR; w = rng.standard_normal(n)
        env = np.minimum(1, x / 0.15) * np.exp(-x * 1.4)
        rattle = (w - lp(w, 1500)) * 0.25 * ((np.sin(2 * np.pi * 22 * x) > 0.4) * np.exp(-x * 3))
        return (lp(w, 120) * 8 + np.sin(2 * np.pi * 34 * x) * 0.6) * env + rattle
    if kind == "siren":  # воющая сирена гражданской обороны, вдалеке
        n = int(5.2 * SR); x = np.arange(n) / SR
        f = 420 + 360 * (0.5 - 0.5 * np.cos(2 * np.pi * x / 2.6)); ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
        return lp(s, 2500) * 0.4 * ramp(n, int(0.6 * SR), int(1.5 * SR))
    if kind == "static":  # радио шипит
        n = int(1.4 * SR); w = rng.standard_normal(n)
        return (w - lp(w, 2500)) * 0.5 * ramp(n, 2000, 8000) * (0.7 + 0.3 * (rng.random(n) > 0.97))
    if kind == "tape":  # скотч отрывается
        n = int(0.7 * SR); x = np.arange(n) / SR; w = rng.standard_normal(n)
        return (w - lp(w, 1800)) * 0.6 * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 38 * x))) * ramp(n, 300, 6000)
    if kind == "click":  # щелчок фонарика
        n = int(0.12 * SR); x = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1800 * x) * np.exp(-x * 90) + rng.standard_normal(n) * np.exp(-x * 140) * 0.3) * 0.9
    if kind == "door":  # тяжёлая дверь подвала
        n = int(1.2 * SR); x = np.arange(n) / SR; w = rng.standard_normal(n)
        return (np.sin(2 * np.pi * 70 * x) * np.exp(-x * 9) * 0.9 + lp(w, 600) * 2 * np.exp(-x * 14) + np.sin(2 * np.pi * 410 * x) * np.exp(-x * 20) * 0.2)
    return np.zeros(10)


fx = np.zeros(N)
for t0, kind in SFX:
    x = sfx(kind); n0 = int(t0 * SR); n1 = min(N, n0 + len(x)); fx[n0:n1] += x[: n1 - n0]
fx /= np.max(np.abs(fx)) + 1e-9


def write(path, x):
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(data.shape[1] if data.ndim == 2 else 1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())


tmp = os.path.join(ROOT, "episodes", f"bunker-{EP}", "voice", "mixparts"); os.makedirs(tmp, exist_ok=True)
write(f"{tmp}/music.wav", mus * 0.5)
write(f"{tmp}/fx.wav", np.stack([fx, fx], 1) * 0.7)
vsrc = os.path.join(ROOT, "episodes", f"bunker-{EP}", "voice", "voice_final.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vsrc, "-af", f"apad=whole_dur={TOTAL},aformat=channel_layouts=stereo,aresample={SR}",
                f"{tmp}/voice_ep.wav"], check=True)
out = os.path.join(ROOT, "video", "public", "audio", f"bunker{EP}_mix.wav")
graph = (
    "[1]equalizer=f=350:t=o:w=1:g=-6,loudnorm=I=-24:TP=-4:LRA=11[m0];"
    "[2]loudnorm=I=-20:TP=-3:LRA=15[f0];"
    "[0]asplit=2[v0][vk];"
    "[m0][vk]sidechaincompress=threshold=0.02:ratio=4:attack=20:release=350:makeup=1[md];"
    "[v0][md][f0]amix=inputs=3:normalize=0:duration=first[mx]"
)
pre = f"{tmp}/premix.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/voice_ep.wav", "-i", f"{tmp}/music.wav", "-i", f"{tmp}/fx.wav",
                "-filter_complex", graph, "-map", "[mx]", "-ar", str(SR), pre], check=True)
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1:LRA=7:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af",
                f"loudnorm=I=-14:TP=-1:LRA=7:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true",
                "-ar", str(SR), out], check=True)
for name, f in (("итог", out), ("голос", f"{tmp}/voice_ep.wav")):
    q = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = q[q.rindex("Summary:"):]
    print(name, [l.strip() for l in s.splitlines() if " I:" in l or "Peak:" in l])
