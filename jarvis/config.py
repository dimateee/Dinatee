"""Настройки Джарвиса: читаются из файла .env рядом с проектом и из переменных окружения."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IS_MAC = sys.platform == "darwin"
IS_WINDOWS = sys.platform.startswith("win")


def load_env_file(path: Path = ROOT / ".env") -> None:
    """Подхватывает KEY=VALUE из .env, не перезаписывая уже заданные переменные."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        if value:
            os.environ.setdefault(key.strip(), value)


def _flag(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "on", "true", "yes", "да")


@dataclass
class Config:
    model: str
    effort: str
    web_search: bool
    confirm_dangerous: bool
    language: str
    whisper_model: str
    whisper_device: str
    mic_threshold: float
    followup_seconds: float
    elevenlabs_key: str
    elevenlabs_voice: str
    elevenlabs_model: str
    system_voice: str

    @classmethod
    def load(cls) -> "Config":
        load_env_file()
        env = os.environ.get
        return cls(
            model=env("JARVIS_MODEL", "claude-opus-5-5"),
            effort=env("JARVIS_EFFORT", "low"),
            web_search=_flag("JARVIS_WEB_SEARCH", True),
            confirm_dangerous=_flag("JARVIS_CONFIRM", True),
            language=env("JARVIS_LANGUAGE", "ru"),
            whisper_model=env("JARVIS_WHISPER_MODEL", "small"),
            whisper_device=env("JARVIS_WHISPER_DEVICE", "cpu"),
            mic_threshold=float(env("JARVIS_MIC_THRESHOLD", "0.012")),
            followup_seconds=float(env("JARVIS_FOLLOWUP_SECONDS", "8")),
            elevenlabs_key=env("ELEVENLABS_API_KEY", ""),
            elevenlabs_voice=env("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
            elevenlabs_model=env("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
            system_voice=env("JARVIS_SYSTEM_VOICE", ""),
        )
