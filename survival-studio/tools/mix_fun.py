"""Сведение весёлых роликов («Пчёлки»): голос + музыка (файл владельца или временная мелодия) с приглушением под голос + звуки-гэги.
.venv/bin/python tools/mix_fun.py bee-1 [--music путь/к/песне.mp3] [--music-db -16]
Выход: video/public/audio/<ep без дефиса>_mix.wav, −14 LUFS."""
import argparse, json, os, subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
ap = argparse.ArgumentParser(); ap.add_argument("ep"); ap.add_argument("--music"); ap.add_argument("--music-db", type=float, default=-15.0)
A = ap.parse_args()
d = os.path.join(ROOT, "episodes", A.ep)
words = json.load(open(os.path.join(d, "words.json")))["words"]
n_ = lambda s: s.lower().replace("ё", "е").strip(".,:;!?—«»\"– ")
def ts(w, k=1):
    c = 0
    for x in words:
        if n_(x["word"]) == w:
            c += 1
            if c == k: return x["start"]
    raise KeyError(w)

def load(p, ch=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", str(ch), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

voice = load(os.path.join(d, "voice", "voice_final.wav"))
L = len(voice) + int(1.8 * SR)
rng = np.random.default_rng(7)
x = np.arange(L) / SR

def lp(sig, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(sig); acc = 0.0
    for i in range(len(sig)): acc = (1 - a) * sig[i] + a * acc; y[i] = acc
    return y

# ---------- музыка ----------
if A.music:
    m = load(A.music)
    reps = int(np.ceil(L / len(m)))
    music = np.tile(m, reps)[:L]
else:
    bpm = 118; beat = 60 / bpm
    prog = [(261.63, 329.63, 392.0), (196.0, 246.94, 392.0), (220.0, 261.63, 329.63), (174.61, 220.0, 349.23)]
    mel = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 2]
    scale = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0]
    music = np.zeros(L)
    def pluck(t0, f, dur, amp):
        i0 = int(t0 * SR); n = min(int(dur * SR), L - i0)
        if n <= 0: return
        tt = np.arange(n) / SR
        music[i0:i0 + n] += amp * (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.15 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 5)
    t = 0.0; bar = 0
    while t < L / SR:
        ch = prog[bar % 4]
        for b in range(4):
            tb = t + b * beat
            for j, f in enumerate(ch): pluck(tb + j * 0.012, f, beat * 0.9, 0.10)       # укулеле
            pluck(tb, ch[0] / 2, beat * 0.8, 0.22 if b % 2 == 0 else 0.12)            # бас
            if b % 2 == 1:                                                            # хлопок
                i0 = int(tb * SR); n = int(0.08 * SR)
                if i0 + n < L: music[i0:i0 + n] += rng.standard_normal(n) * np.exp(-np.arange(n) / (0.012 * SR)) * 0.10
            for h in range(2):                                                        # колокольчик-мелодия
                idx = mel[(bar * 8 + b * 2 + h) % len(mel)]
                pluck(tb + h * beat / 2, scale[min(idx, len(scale) - 1)] * 2, beat * 0.45, 0.05)
        t += 4 * beat; bar += 1
    music += np.sin(2 * np.pi * 220 * x + 3 * np.sin(2 * np.pi * 6 * x)) * 0.008  # лёгкое жужжание
music = music / (np.max(np.abs(music)) + 1e-9) * 10 ** (A.music_db / 20) * 3.2

# приглушение музыки под голос
env = np.sqrt(np.convolve(np.pad(voice, (0, L - len(voice))) ** 2, np.ones(2400) / 2400, mode="same"))
duck = 1 - 0.6 * np.clip(env / 0.05, 0, 1)
duck = np.convolve(duck, np.ones(4800) / 4800, mode="same")
music *= duck
fade = np.ones(L); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo); music *= fade

# ---------- звуки-гэги ----------
def sfx(kind):
    if kind == "fanfare":
        n = int(1.3 * SR); tt = np.arange(n) / SR; out = np.zeros(n)
        for k, (f, t0) in enumerate([(392, 0), (523.25, 0.18), (659.25, 0.36), (783.99, 0.54)]):
            m = (tt >= t0); s_ = np.sign(np.sin(2 * np.pi * f * (tt - t0))) * 0.5 + np.sin(2 * np.pi * f * (tt - t0))
            out += s_ * m * np.exp(-np.clip(tt - t0, 0, None) * (2.5 if k == 3 else 7)) * 0.12
        return lp(out, 4000)
    if kind == "gasp":
        n = int(0.9 * SR); tt = np.arange(n) / SR; w = rng.standard_normal(n)
        return (lp(w, 2500) - lp(w, 400)) * np.sin(np.pi * np.clip(tt / 0.6, 0, 1)) * 0.9
    if kind in ("zip", "whoosh"):
        n = int(0.7 * SR); tt = np.arange(n) / SR
        f = 300 + 900 * tt / 0.7 if kind == "zip" else 200 + 300 * tt
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR + 3 * np.sin(2 * np.pi * 40 * tt)) if kind == "zip" else lp(rng.standard_normal(n), 1500)
        return sig * np.sin(np.pi * tt / 0.7) * 0.25
    if kind == "boing":
        n = int(0.6 * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * np.cumsum(180 + 120 * np.sin(2 * np.pi * 9 * tt) * np.exp(-tt * 4)) / SR) * np.exp(-tt * 5) * 0.35
    if kind == "sad":
        n = int(1.6 * SR); tt = np.arange(n) / SR; out = np.zeros(n)
        for k, f in enumerate([311, 293, 277, 262]):
            t0 = k * 0.35; m = tt >= t0; ff = f * (1 - 0.03 * np.clip(tt - t0, 0, 0.4) * (k == 3))
            out += np.sign(np.sin(2 * np.pi * ff * (tt - t0))) * m * np.exp(-np.clip(tt - t0, 0, None) * (1.5 if k == 3 else 6)) * 0.08
        return lp(out, 1800)
    if kind == "snore":
        n = int(2.4 * SR); tt = np.arange(n) / SR; w = rng.standard_normal(n)
        env_ = np.clip(np.sin(2 * np.pi * tt / 1.2), 0, 1) ** 2
        return lp(w, 300) * env_ * 1.8 + np.sin(2 * np.pi * 70 * tt) * env_ * 0.15
    if kind == "chime":
        n = int(1.2 * SR); tt = np.arange(n) / SR; out = np.zeros(n)
        for k, f in enumerate([1046.5, 1318.5, 1568, 2093]):
            t0 = k * 0.09; m = tt >= t0; out += np.sin(2 * np.pi * f * (tt - t0)) * m * np.exp(-np.clip(tt - t0, 0, None) * 4) * 0.07
        return out
    if kind == "strain":
        n = int(1.2 * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * np.cumsum(140 + 60 * tt) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * tt)) * 0.12
    if kind == "pop":
        n = int(0.35 * SR); tt = np.arange(n) / SR
        return (np.sin(2 * np.pi * np.cumsum(900 - 600 * tt / 0.35) / SR) * np.exp(-tt * 14) + rng.standard_normal(n) * np.exp(-tt * 60) * 0.6) * 0.5
    if kind == "splash":
        n = int(1.0 * SR); tt = np.arange(n) / SR; w = rng.standard_normal(n)
        return (lp(w, 3000) - lp(w, 300)) * np.exp(-tt * 4) * 0.8
    if kind == "ding":
        n = int(1.5 * SR); tt = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1760 * tt) + 0.5 * np.sin(2 * np.pi * 2637 * tt)) * np.exp(-tt * 3) * 0.12
    raise KeyError(kind)

EV = {
    "bee-1": [(ts("трубит"), "fanfare"), (ts("ахнули"), "gasp"), (ts("быстрый"), "zip"), (ts("гриша"), "boing"), (ts("соня"), "boing"),
              (ts("бзз"), "boing"), (ts("пусто"), "sad"), (ts("храпит"), "snore"), (ts("танец-восьмерку"), "chime"), (ts("туда"), "whoosh"),
              (ts("собирают"), "zip"), (ts("застрял"), "boing"), (ts("тянет"), "strain"), (ts("чпок"), "pop"), (ts("лужу"), "splash"),
              (ts("золотую"), "ding"), (ts("лайк"), "pop")],
}[A.ep]
fx = np.zeros(L)
for t0, kind in EV:
    s_ = sfx(kind); i0 = int(t0 * SR); n = min(len(s_), L - i0)
    if n > 0: fx[i0:i0 + n] += s_[:n]

mix = np.pad(voice, (0, L - len(voice))) + music + fx * 0.8
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 0.9
tmp = os.path.join(d, "voice", "mixparts_fun.raw")
mix.astype(np.float32).tofile(tmp)
out = os.path.join(ROOT, "video", "public", "audio", A.ep.replace("-", "") + "_mix.wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1:LRA=11",
                "-ar", str(SR), "-ac", "2", out], check=True)
os.remove(tmp)
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
print(out, [l.strip() for l in r.splitlines() if " I:" in l or "Peak:" in l][-2:])
