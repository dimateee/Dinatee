"""Микрофон: запись одной фразы по уровню громкости и распознавание через faster-whisper."""

from __future__ import annotations

import collections
import queue
import re
import time

import numpy as np

from .config import Config

SAMPLE_RATE = 16000
FRAME = 480               # 30 мс
START_FRAMES = 4          # столько громких кадров подряд считается началом речи
END_SILENCE = 0.9         # секунд тишины, после которых фраза считается законченной
MAX_PHRASE = 25.0         # секунд
MIN_PHRASE = 0.35

# Whisper иногда «слышит» это в тишине и шуме.
HALLUCINATIONS = (
    "субтитры", "продолжение следует", "спасибо за просмотр", "подписывайтесь",
    "редактор субтитров", "thanks for watching", "dimatorzok",
)


class Listener:
    def __init__(self, cfg: Config):
        from faster_whisper import WhisperModel

        self.cfg = cfg
        compute = "float16" if cfg.whisper_device == "cuda" else "int8"
        print(f"Загружаю модель распознавания «{cfg.whisper_model}» (первый запуск скачивает её)…")
        self.model = WhisperModel(cfg.whisper_model, device=cfg.whisper_device, compute_type=compute)
        self.noise = cfg.mic_threshold / 3

    def record(self, start_timeout: float | None = None) -> np.ndarray | None:
        """Ждёт речь и возвращает её целиком. None — если за start_timeout никто не заговорил."""
        import sounddevice as sd

        frames: queue.Queue[np.ndarray] = queue.Queue()

        def on_audio(indata, _frames, _time, _status):
            frames.put(indata[:, 0].copy())

        preroll: collections.deque[np.ndarray] = collections.deque(maxlen=10)
        phrase: list[np.ndarray] = []
        loud = 0
        quiet = 0.0
        speaking = False
        started = time.monotonic()

        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32",
                            blocksize=FRAME, callback=on_audio):
            while True:
                try:
                    frame = frames.get(timeout=1)
                except queue.Empty:
                    continue
                level = float(np.sqrt(np.mean(frame * frame)))
                threshold = max(self.cfg.mic_threshold, self.noise * 3)
                seconds = len(frame) / SAMPLE_RATE

                if not speaking:
                    preroll.append(frame)
                    if level > threshold:
                        loud += 1
                    else:
                        loud = 0
                        self.noise = 0.95 * self.noise + 0.05 * level
                    if loud >= START_FRAMES:
                        speaking = True
                        phrase = list(preroll)
                    elif start_timeout is not None and time.monotonic() - started > start_timeout:
                        return None
                    continue

                phrase.append(frame)
                quiet = 0.0 if level > threshold else quiet + seconds
                length = len(phrase) * FRAME / SAMPLE_RATE
                if quiet >= END_SILENCE or length >= MAX_PHRASE:
                    if length - quiet < MIN_PHRASE:  # щелчок или стук, не речь
                        speaking, loud, quiet, phrase = False, 0, 0.0, []
                        preroll.clear()
                        continue
                    return np.concatenate(phrase)

    def transcribe(self, audio: np.ndarray) -> str:
        segments, _ = self.model.transcribe(
            audio,
            language=self.cfg.language or None,
            beam_size=1,
            vad_filter=True,
            initial_prompt="Джарвис, открой браузер.",
            condition_on_previous_text=False,
        )
        text = re.sub(r"\s+", " ", " ".join(s.text for s in segments)).strip()
        lowered = text.lower()
        if any(marker in lowered for marker in HALLUCINATIONS):
            return ""
        return text

    def listen(self, start_timeout: float | None = None) -> str | None:
        """Одна распознанная фраза. None — тайм-аут ожидания, '' — речь не разобрана."""
        audio = self.record(start_timeout)
        if audio is None:
            return None
        return self.transcribe(audio)
