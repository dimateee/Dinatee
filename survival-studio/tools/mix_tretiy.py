"""Звук «Третьего дня»: своя эмбиент-музыка с лёгким пульсом, 4 эффекта, сведение.

.venv/bin/python tools/mix_tretiy.py
Голос: episodes/tretiy-den/voice/voice_final.wav (66,24 с) + хвост 1 с.
Музыка под голосом ≈ −25 LUFS, сайдчейн 6–8 дБ, вырез 250–500 Гц. Итог −14 LUFS, TP −1.
Результат: video/public/audio/tretiy_mix.wav.
"""
import json, os, subprocess, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
rng = np.random.default_rng(3)
VOICE_END, TAIL = 66.24, 1.0
TOTAL = VOICE_END + TAIL
N = int(TOTAL * SR)
t_axis = np.arange(N) / SR
# настроение: tense — срыв, silence — пауза перед поворотом, drive — решение, rise — финал
MOOD = [(0.0, "tense"), (15.7, "silence"), (16.3, "calm"), (38.2, "drive"), (57.8, "rise")]
SFX = [(1.60, "snap"), (4.66, "alarm"), (43.86, "tick"), (51.70, "beep")]


def lp_fast(x, fc):
    n = max(1, int(SR / fc / 2)); k = np.ones(n) / n
    return np.convolve(np.convolve(x, k, "same"), k, "same")


def env_ramp(n, a, r):
    e = np.ones(n); a, r = min(a, n // 2), min(r, n // 2)
    e[:a] = np.linspace(0, 1, a); e[n - r:] = np.linspace(1, 0, r); return e


def pad_note(freq, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * freq * d * tt) + 0.3 * np.sin(4 * np.pi * freq * d * tt) for d in (0.997, 1.0, 1.004))
    return s * env_ramp(n, int(0.9 * SR), int(1.2 * SR)) / 6


# Am – F – C – G, такт 2,4 с (100 BPM, 4/4)
CHORDS = [(220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (130.81, 196.0, 261.63), (196.0, 246.94, 293.66)]
BEAT = 0.6; BAR = 4 * BEAT
pad = np.zeros(N); arp = np.zeros(N); kick = np.zeros(N); hat = np.zeros(N)
for i in range(int(TOTAL / BAR) + 1):
    n0 = int(i * BAR * SR); ch = CHORDS[i % 4]
    seg = sum(pad_note(f / 2, BAR + 1.0) for f in ch) + 0.5 * pad_note(ch[0] / 4, BAR + 1.0)
    n1 = min(N, n0 + len(seg)); pad[n0:n1] += seg[: n1 - n0]
    # арпеджио восьмыми — мягкий «плак»
    for j in range(8):
        f = ch[[0, 1, 2, 1, 0, 2, 1, 2][j]] * 2
        m0 = n0 + int(j * BEAT / 2 * SR); n = int(0.28 * SR)
        if m0 + n < N:
            tt = np.arange(n) / SR; arp[m0:m0 + n] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 14) * 0.35
for i in range(int(TOTAL / BEAT)):
    n0 = int(i * BEAT * SR); n = int(0.3 * SR)
    if n0 + n >= N: break
    tt = np.arange(n) / SR
    if i % 2 == 0: kick[n0:n0 + n] += np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 10)
    m = int(0.05 * SR); h = rng.standard_normal(m); h -= lp_fast(h, 6000)
    hat[n0 + int(BEAT / 2 * SR):n0 + int(BEAT / 2 * SR) + m] += h * np.exp(-np.arange(m) / (0.01 * SR)) * 0.25
drone = 0.5 * (np.sin(2 * np.pi * 55 * t_axis) + 0.5 * np.sin(2 * np.pi * 82.4 * t_axis)) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.15 * t_axis))


def mood_curve(name):
    c = np.zeros(N); marks = MOOD + [(TOTAL + 1, None)]
    for (a, m), (b, _) in zip(marks, marks[1:]):
        if m == name: c[int(a * SR):int(min(b, TOTAL) * SR)] = 1
    k = int(0.6 * SR); return np.convolve(c, np.ones(k) / k, "same")


tense, sil, calm, drive, rise = (mood_curve(m) for m in ("tense", "silence", "calm", "drive", "rise"))
mus = (drone * (tense * 0.9 + calm * 0.2) + pad * (tense * 0.35 + calm + drive + rise * 1.2)
       + arp * (calm * 0.5 + drive + rise * 1.2) + kick * (drive * 0.8 + rise) + hat * (drive * 0.6 + rise * 0.8))
mus *= (1 - 0.95 * sil)
mus *= env_ramp(N, int(0.3 * SR), int(1.2 * SR))
mus /= np.max(np.abs(mus)) + 1e-9
mus = np.stack([mus, np.roll(mus, int(0.012 * SR))], 1)


def sfx(kind):
    if kind == "snap":  # трещина: щелчок + хруст
        n = int(0.45 * SR); tt = np.arange(n) / SR; w = rng.standard_normal(n)
        return (w - lp_fast(w, 800)) * np.exp(-tt * 18) * 0.8 + np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 25) * 0.6
    if kind == "alarm":  # два коротких сигнала будильника
        n = int(0.9 * SR); tt = np.arange(n) / SR
        gate = (((tt % 0.22) < 0.12) & (tt < 0.66)).astype(float)
        return 0.35 * np.sign(np.sin(2 * np.pi * 1760 * tt)) * lp_fast(gate, 300)
    if kind == "tick":
        n = int(0.12 * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 70) * 0.6
    if kind == "beep":  # отметка в приложении: два тона вверх
        n = int(0.32 * SR); tt = np.arange(n) / SR
        f = np.where(tt < 0.12, 1320, 1760); ph = 2 * np.pi * np.cumsum(f) / SR
        return np.sin(ph) * env_ramp(n, 200, 4000) * 0.45
    return np.zeros(10)


fx = np.zeros(N)
for t, kind in SFX:
    x = sfx(kind); n0 = int(t * SR); n1 = min(N, n0 + len(x)); fx[n0:n1] += x[: n1 - n0]


def write(path, x):
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(data.shape[1] if data.ndim == 2 else 1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())


tmp = os.path.join(ROOT, "episodes", "tretiy-den", "voice", "mixparts"); os.makedirs(tmp, exist_ok=True)
write(f"{tmp}/music.wav", mus * 0.5)
write(f"{tmp}/fx.wav", np.stack([fx, fx], 1) * 0.6)
vsrc = os.path.join(ROOT, "episodes", "tretiy-den", "voice", "voice_final.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vsrc, "-af", f"apad=whole_dur={TOTAL},aformat=channel_layouts=stereo,aresample={SR}",
                f"{tmp}/voice_ep.wav"], check=True)

out = os.path.join(ROOT, "video", "public", "audio", "tretiy_mix.wav")
graph = (
    "[1]equalizer=f=350:t=o:w=1:g=-6,loudnorm=I=-25:TP=-4:LRA=11[m0];"
    "[2]volume=0.9[f0];"
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
for name, f in (("итог", out), ("голос", f"{tmp}/voice_ep.wav"), ("музыка", f"{tmp}/music.wav")):
    q = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    s = q[q.rindex("Summary:"):]
    print(name, [l.strip() for l in s.splitlines() if " I:" in l or "Peak:" in l])
