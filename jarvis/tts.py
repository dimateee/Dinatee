"""Озвучка: ElevenLabs (если задан ключ) или системный голос macOS / Windows."""

from __future__ import annotations

import base64
import json
import re
import subprocess
import urllib.error
import urllib.request

from .config import IS_MAC, IS_WINDOWS, Config

SAMPLE_RATE = 22050


def clean_for_speech(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_`#>|]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def elevenlabs_pcm(cfg: Config, text: str) -> bytes:
    """Возвращает звук 16-бит моно 22050 Гц."""
    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.elevenlabs_voice}"
        f"?output_format=pcm_{SAMPLE_RATE}"
    )
    body = json.dumps({"text": text, "model_id": cfg.elevenlabs_model}).encode("utf-8")
    request = urllib.request.Request(
        url, data=body, method="POST",
        headers={"xi-api-key": cfg.elevenlabs_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


class Speaker:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.use_elevenlabs = bool(cfg.elevenlabs_key)

    def say(self, text: str) -> None:
        text = clean_for_speech(text)
        if not text:
            return
        if self.use_elevenlabs:
            try:
                self._play(elevenlabs_pcm(self.cfg, text))
                return
            except (urllib.error.URLError, TimeoutError) as exc:
                detail = exc.read().decode("utf-8", "replace")[:300] if isinstance(exc, urllib.error.HTTPError) else exc
                print(f"[ElevenLabs недоступен, говорю системным голосом] {detail}")
        self._system_voice(text)

    @staticmethod
    def _play(pcm: bytes) -> None:
        import numpy as np
        import sounddevice as sd

        sd.play(np.frombuffer(pcm[: len(pcm) // 2 * 2], dtype=np.int16), SAMPLE_RATE)
        sd.wait()

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
