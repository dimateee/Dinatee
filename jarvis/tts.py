"""Озвучка: ElevenLabs (если задан ключ) или системный голос macOS / Windows."""

from __future__ import annotations

import base64
import json
import re
import subprocess
import time
import urllib.error
import urllib.request

from .config import IS_MAC, IS_WINDOWS, Config

SAMPLE_RATE = 22050


def clean_for_speech(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_`#>|]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def elevenlabs_chunks(cfg: Config, text: str):
    """Потоково отдаёт звук 16-бит моно 22050 Гц по мере синтеза."""
    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.elevenlabs_voice}/stream"
        f"?output_format=pcm_{SAMPLE_RATE}"
    )
    body = json.dumps({"text": text, "model_id": cfg.elevenlabs_model}).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, method="POST",
        headers={"xi-api-key": cfg.elevenlabs_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        while chunk := response.read(4096):
            yield chunk


class Speaker:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.use_elevenlabs = bool(cfg.elevenlabs_key)
        self.first_sound_seconds = 0.0

    def say(self, text: str) -> None:
        text = clean_for_speech(text)
        if not text:
            return
        started = time.monotonic()
        self.first_sound_seconds = 0.0
        if self.use_elevenlabs:
            try:
                self._play_stream(elevenlabs_chunks(self.cfg, text), started)
                return
            except (urllib.error.URLError, TimeoutError) as exc:
                detail = exc.read().decode("utf-8", "replace")[:300] if isinstance(exc, urllib.error.HTTPError) else exc
                print(f"[ElevenLabs недоступен, говорю системным голосом] {detail}")
        self._system_voice(text)

    def _play_stream(self, chunks, started: float) -> None:
        """Начинает играть с первым же куском, не дожидаясь конца синтеза."""
        import sounddevice as sd

        tail = b""
        with sd.RawOutputStream(samplerate=SAMPLE_RATE, channels=1, dtype="int16") as out:
            for chunk in chunks:
                if not self.first_sound_seconds:
                    self.first_sound_seconds = time.monotonic() - started
                data = tail + chunk
                even = len(data) // 2 * 2
                out.write(data[:even])
                tail = data[even:]

    def _system_voice(self, text: str) -> None:
        if IS_MAC:
            voice = self.cfg.system_voice or "Milena"
            if subprocess.run(["say", "-v", voice, text]).returncode != 0:
                subprocess.run(["say", text])
        elif IS_WINDOWS:
            payload = base64.b64encode(text.encode("utf-8")).decode("ascii")
            script = (
                "Add-Type -AssemblyName System.Speech;"
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
                "$ru = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'ru*' } | Select-Object -First 1;"
                "if ($ru) { $s.SelectVoice($ru.VoiceInfo.Name) };"
                f"$s.Speak([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')))"
            )
            encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
            subprocess.run(["powershell", "-NoProfile", "-EncodedCommand", encoded])
        else:
            print("(озвучка на этой системе не настроена)")
