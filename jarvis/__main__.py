"""Запуск: python -m jarvis            — голосовой режим
           python -m jarvis --text     — команды с клавиатуры (без микрофона)
           python -m jarvis --devices  — список аудиоустройств"""

from __future__ import annotations

import argparse
import re
import time

from .config import Config
from .tools import Shutdown, Tools

WAKE = re.compile(r"\b((эй|хей|окей|ок|привет|слушай)[\s,]+)?(д?жарвис\w*|джервис\w*|jarvis)\b[\s,.!?:;—-]*", re.IGNORECASE)
YES = re.compile(r"\b(да|ага|угу|конечно|давай|подтверждаю|выполняй|yes|ок|окей)\b", re.IGNORECASE)


def split_wake(text: str) -> tuple[bool, str]:
    """(прозвучало ли «Джарвис», команда без обращения)."""
    if not WAKE.search(text):
        return False, text.strip()
    return True, WAKE.sub(" ", text).strip(" ,.!?")


def run_text(cfg: Config) -> None:
    from .brain import Brain

    def confirm(question: str) -> bool:
        return bool(YES.search(input(f"Джарвис: {question} (да/нет) > ")))

    brain = Brain(cfg, Tools(confirm, cfg.confirm_dangerous))
    print("Текстовый режим. Пустая строка или Ctrl+C — выход.")
    try:
        while True:
            command = input("Вы > ").strip()
            if not command:
                break
            print("Джарвис:", brain.ask(command))
    except (Shutdown, KeyboardInterrupt, EOFError):
        print("\nДжарвис: До связи.")


def run_voice(cfg: Config) -> None:
    from .audio import Listener
    from .brain import Brain
    from .tts import Speaker

    speaker = Speaker(cfg)
    listener = Listener(cfg)

    def confirm(question: str) -> bool:
        speaker.say(question)
        answer = listener.listen(start_timeout=8) or ""
        print(f"  ответ: {answer!r}")
        return bool(YES.search(answer))

    brain = Brain(cfg, Tools(confirm, cfg.confirm_dangerous))
    voice = "ElevenLabs" if speaker.use_elevenlabs else "системный"
    print(f"Готов. Модель: {cfg.model}, голос: {voice}. Скажите «Джарвис, …». Ctrl+C — выход.")
    speaker.say("Джарвис на связи.")

    followup_until = 0.0
    try:
        while True:
            in_followup = time.monotonic() < followup_until
            text = listener.listen(start_timeout=followup_until - time.monotonic() if in_followup else None)
            if not text:
                continue
            woke, command = split_wake(text)
            if not (woke or in_followup):
                continue
            print(f"Вы: {text}")
            if not command:
                speaker.say("Слушаю, сэр.")
            else:
                reply = brain.ask(command)
                print(f"Джарвис: {reply}")
                speaker.say(reply)
            followup_until = time.monotonic() + cfg.followup_seconds
    except Shutdown:
        speaker.say("Отключаюсь. До связи.")
    except KeyboardInterrupt:
        print("\nВыход.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="jarvis", description="Голосовой помощник Джарвис")
    parser.add_argument("--text", action="store_true", help="режим клавиатуры без микрофона")
    parser.add_argument("--devices", action="store_true", help="показать аудиоустройства и выйти")
    args = parser.parse_args()

    if args.devices:
        import sounddevice as sd

        print(sd.query_devices())
        return

    cfg = Config.load()
    (run_text if args.text else run_voice)(cfg)


if __name__ == "__main__":
    main()
