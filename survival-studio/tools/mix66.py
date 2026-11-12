"""Звук эпизода серии «66 ДНЕЙ»: свой эмбиент-музыка без вокала, эмбиент сцен, звуковые эффекты и сведение.

.venv/bin/python tools/mix66.py 1|2
Голос: episodes/66days-N/voice/voice_final.wav. Время эпизода = время голоса (+3 с титула после холодного открытия),
хвост «Продолжение следует» — 4 с. Результат: video/public/audio/66days-N_mix.wav + отчёт громкости.
Правила промпта: музыка играет всё время на 15–18 дБ тише голоса, сайдчейн 3–4 дБ, вырез 250–500 Гц на музыке,
у каждой сцены свой эмбиент, эффекты по действию (не больше одного на план), перед поворотом 2–3 с почти тишины,
к финалу музыка нарастает. Итог −14 LUFS, true peak −1…−1,5 dBTP.
"""
import json, os, subprocess, sys, wave
import numpy as np

EP = int(sys.argv[1])
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(66 + EP)

CFG = {
    1: dict(cold=6.19, end=83.03,
            amb=[(0.00, 6.19, "rain_in"), (6.19, 19.10, "birds"), (19.10, 22.22, "wind"), (22.22, 34.93, "rain_in"), (34.93, 43.80, "room"),
                 (43.80, 55.59, "birds"), (55.59, 69.06, "room"), (69.06, 75.33, "room"), (75.33, 78.44, "wind"), (78.44, 999, "stove")],
            sfx=[(0.20, "buzz"), (12.40, "page"), (24.65, "buzz"), (44.19, "creak"), (69.06, "page")],
            # настроение музыки: calm / tense / silence / rise
            mood=[(0.00, "tense"), (6.19, "calm"), (22.22, "tense"), (25.90, "silence"), (28.75, "tense"), (34.93, "calm"), (72.11, "silence"), (75.33, "rise")]),
    2: dict(cold=6.93, end=75.28,
            amb=[(0.00, 6.93, "wind_night"), (6.93, 16.07, "stove"), (16.07, 22.65, "stove"), (22.65, 27.65, "wind"), (27.65, 47.93, "room"),
                 (47.93, 57.88, "wind"), (57.88, 63.41, "room"), (63.41, 999, "wind")],
            sfx=[(9.52, "page"), (22.78, "creak"), (57.96, "page")],
            mood=[(0.00, "tense"), (6.93, "calm"), (19.08, "silence"), (22.67, "calm"), (60.20, "silence"), (63.41, "rise")]),
}[EP]
TITLE, TAIL = 3.0, 2.0
ep = lambda t: t + TITLE if t >= CFG["cold"] - 1e-6 else t  # время голоса → время эпизода
TOTAL = CFG["end"] + TITLE + TAIL
N = int(TOTAL * SR)
t_axis = np.arange(N) / SR

def lp_fast(x, fc):
    # дешёвый ФНЧ: скользящее среднее с окном ~ SR/fc (дважды)
    n = max(1, int(SR / fc / 2)); k = np.ones(n) / n
    return np.convolve(np.convolve(x, k, "same"), k, "same")

def env_ramp(n, a, r):
    e = np.ones(n); a, r = min(a, n // 2), min(r, n // 2)
    e[:a] = np.linspace(0, 1, a); e[n - r:] = np.linspace(1, 0, r); return e

# ---------------- музыка ----------------
def pad_note(freq, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    det = [0.997, 1.0, 1.004]
    s = sum(np.sin(2 * np.pi * freq * d * tt) + 0.35 * np.sin(2 * np.pi * 2 * freq * d * tt) + 0.12 * np.sin(2 * np.pi * 3 * freq * d * tt) for d in det)
    return s * env_ramp(n, int(1.2 * SR), int(1.5 * SR)) / 6

CHORDS = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (130.81, 196.0, 261.63), (196.0, 246.94, 293.66)]  # Am F C G
music = np.zeros(N)
bar = 4.0
for i in range(int(TOTAL / bar) + 1):
    t0 = i * bar; n0 = int(t0 * SR)
    ch = CHORDS[i % 4]
    seg = sum(pad_note(f / 2, bar + 1.5) for f in ch)
    seg += 0.5 * pad_note(ch[0] / 4, bar + 1.5)  # бас
    n1 = min(N, n0 + len(seg)); music[n0:n1] += seg[: n1 - n0]
# лёгкий пульс: мягкие удары баса раз в такт
for i in range(int(TOTAL / 1.0)):
    n0 = int(i * SR); n = int(0.35 * SR)
    if n0 + n < N:
        tt = np.arange(n) / SR; music[n0:n0 + n] += 0.18 * np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 9)
drone = 0.5 * (np.sin(2 * np.pi * 55 * t_axis) + 0.6 * np.sin(2 * np.pi * 82.4 * t_axis)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.1 * t_axis))

# огибающие настроения (плавные переходы 1,5 с)
def mood_curve(name):
    c = np.zeros(N)
    marks = [(ep(t), m) for t, m in CFG["mood"]] + [(TOTAL + 1, None)]
    for (a, m), (b, _) in zip(marks, marks[1:]):
        if m == name: c[int(a * SR):int(min(b, TOTAL) * SR)] = 1
    k = int(1.5 * SR); return np.convolve(c, np.ones(k) / k, "same")
calm, tense, sil, rise = (mood_curve(m) for m in ("calm", "tense", "silence", "rise"))
rise_amt = rise * np.clip((t_axis - (TOTAL - 10)) / 10 + 0.6, 0.6, 1.6)
mus = music * (calm * 1.0 + rise_amt * 1.0 + tense * 0.25) + drone * (tense * 0.9 + rise * 0.3)
mus *= (1 - 0.92 * sil)
mus /= np.max(np.abs(mus)) + 1e-9
mus = np.stack([mus, np.roll(mus, int(0.012 * SR))], 1)  # лёгкая стерео-ширина

# ---------------- эмбиент сцен ----------------
def noise(n, kind="white"):
    w = rng.standard_normal(n)
    if kind == "brown": w = np.cumsum(w); w -= np.convolve(w, np.ones(SR) / SR, "same"); w /= np.max(np.abs(w)) + 1e-9
    if kind == "pink": w = lp_fast(w, 2500) * 3
    return w

def amb_clip(kind, n):
    tt = np.arange(n) / SR
    if kind in ("wind", "wind_night"):
        x = lp_fast(noise(n), 400) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.13 * tt + rng.random() * 6)) * 6
        return x * (1.3 if kind == "wind_night" else 1)
    if kind == "rain_in":
        return (noise(n) - lp_fast(noise(n), 1200)) * 0.25 + lp_fast(noise(n), 300) * 2
    if kind == "birds":
        x = lp_fast(noise(n), 300) * 1.5
        for _ in range(int(n / SR * 0.8)):
            s0 = rng.integers(0, max(1, n - SR)); d = int(rng.uniform(0.08, 0.2) * SR); f0 = rng.uniform(2500, 4200)
            ch = np.arange(d) / SR; sweep = np.sin(2 * np.pi * (f0 * ch + rng.uniform(-3000, 3000) * ch ** 2))
            x[s0:s0 + d] += 0.25 * sweep * np.hanning(d)
        return x
    if kind == "stove":
        x = lp_fast(noise(n), 200) * 1.2
        for _ in range(int(n / SR * 6)):
            s0 = rng.integers(0, n - 400); x[s0:s0 + 300] += rng.uniform(0.2, 0.8) * rng.standard_normal(300) * np.exp(-np.arange(300) / 40)
        return x
    return lp_fast(noise(n), 250) * 0.6  # room tone

amb = np.zeros(N)
fade = int(0.8 * SR)
for a, b, kind in CFG["amb"]:
    a, b = ep(a), min(ep(b) if b < 900 else TOTAL, TOTAL)
    n0, n1 = int(a * SR), int(b * SR)
    clip = amb_clip(kind, n1 - n0 + fade)
    clip = clip / (np.std(clip) + 1e-9) * 0.25 * env_ramp(len(clip), fade, fade)
    n1b = min(N, n0 + len(clip)); amb[n0:n1b] += clip[: n1b - n0]
# тишина под титулом
ts, te = int(CFG["cold"] * SR), int((CFG["cold"] + TITLE) * SR)
amb[ts:te] *= np.linspace(1, 0, te - ts) ** 4

# ---------------- эффекты ----------------
def sfx(kind):
    if kind == "buzz":
        n = int(1.6 * SR); tt = np.arange(n) / SR
        gate = ((tt % 0.5) < 0.32).astype(float)
        return 0.6 * np.sign(np.sin(2 * np.pi * 150 * tt)) * gate * lp_fast(np.ones(n), 50) * env_ramp(n, 200, 2000) * 0.5
    if kind == "creak":
        n = int(1.1 * SR); tt = np.arange(n) / SR
        f = 180 + 140 * np.sin(np.pi * tt / 1.1) + 30 * np.sin(2 * np.pi * 7 * tt)
        ph = 2 * np.pi * np.cumsum(f) / SR
        return 0.5 * (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * env_ramp(n, 2000, 6000) * (0.7 + 0.3 * rng.random(n))
    if kind == "page":
        n = int(0.5 * SR); return 0.5 * (noise(n) - lp_fast(noise(n), 1500)) * np.hanning(n)
    return np.zeros(10)

fx = np.zeros(N)
for t, kind in CFG["sfx"]:
    x = sfx(kind); n0 = int(ep(t) * SR); n1 = min(N, n0 + len(x)); fx[n0:n1] += x[: n1 - n0]

def write(path, x):
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(data.shape[1] if data.ndim == 2 else 1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())

tmp = os.path.join(ROOT, "episodes", f"66days-{EP}", "voice", "mixparts"); os.makedirs(tmp, exist_ok=True)
write(f"{tmp}/music.wav", mus * 0.5)
write(f"{tmp}/amb.wav", np.stack([amb, amb], 1) * 0.5)
write(f"{tmp}/fx.wav", np.stack([fx, fx], 1) * 0.6)

# голос с паузой под титул и хвостом
vsrc = os.path.join(ROOT, "episodes", f"66days-{EP}", "voice", "voice_final.wav")
cold_ms = int(CFG["cold"] * 1000)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vsrc, "-filter_complex",
                f"[0]atrim=0:{CFG['cold']},asetpts=N/SR/TB[a];[0]atrim={CFG['cold']},asetpts=N/SR/TB,adelay={int(TITLE * 1000)}|{int(TITLE * 1000)}[b];"
                f"[a][b]concat=n=2:v=0:a=1,apad=whole_dur={TOTAL},aformat=channel_layouts=stereo,aresample={SR}[v]",
                "-map", "[v]", f"{tmp}/voice_ep.wav"], check=True)

out = os.path.join(ROOT, "video", "public", "audio", f"66days-{EP}_mix.wav")
os.makedirs(os.path.dirname(out), exist_ok=True)
# музыка: вырез 250–500 Гц, уровень ~ −30 LUFS, сайдчейн от голоса на 3–4 дБ; эмбиент ~ −33 LUFS
graph = (
    "[1]equalizer=f=350:t=o:w=1:g=-5,loudnorm=I=-31:TP=-6:LRA=11[m0];"
    "[2]loudnorm=I=-34:TP=-8:LRA=11[a0];"
    "[3]volume=0.9[f0];"
    "[0]asplit=2[v0][vk];"
    "[m0][vk]sidechaincompress=threshold=0.03:ratio=2.2:attack=40:release=400:makeup=1[md];"
    "[v0][md][a0][f0]amix=inputs=4:normalize=0:duration=first,acompressor=threshold=-26dB:ratio=2:attack=30:release=600:makeup=2[mx]"
)
pre = f"{tmp}/premix.wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{tmp}/voice_ep.wav", "-i", f"{tmp}/music.wav", "-i", f"{tmp}/amb.wav", "-i", f"{tmp}/fx.wav",
                "-filter_complex", graph, "-map", "[mx]", "-ar", str(SR), pre], check=True)
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.3:LRA=5:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", pre, "-af",
                f"loudnorm=I=-14:TP=-1.3:LRA=5:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true",
                "-ar", str(SR), out], check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
summ = r[r.rindex("Summary:"):]
print(f"серия {EP}: {TOTAL:.1f} с ->", out)
print("\n".join(l for l in summ.splitlines() if any(k in l for k in (" I:", "LRA:", "Peak:"))))
# разница голос/музыка (для отчёта)
for name, f in (("голос", f"{tmp}/voice_ep.wav"), ("музыка", f"{tmp}/music.wav")):
    q = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    print(name, [l.strip() for l in q[q.rindex("Summary:"):].splitlines() if " I:" in l][0])
