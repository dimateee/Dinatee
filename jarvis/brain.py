"""«Мозг» Джарвиса: Claude с инструментами управления компьютером."""

from __future__ import annotations

import platform
import time
from pathlib import Path

import anthropic

from .config import IS_MAC, Config
from .tools import TOOL_SCHEMAS, Shutdown, ToolError, Tools

MAX_STEPS = 12            # сколько раундов инструментов допускается на одну реплику
HISTORY_IDLE_RESET = 600  # секунд тишины, после которых разговор начинается заново
HISTORY_MAX_MESSAGES = 60

SYSTEM_PROMPT = """\
Ты Джарвис — личный голосовой помощник, который управляет компьютером пользователя.

Твои ответы озвучиваются синтезатором речи, поэтому пиши так, как говорят вслух: \
одна-три короткие фразы, без списков, разметки, ссылок и смайликов. Числа, даты и \
единицы пиши так, чтобы их можно было прочитать голосом. Отвечай на языке пользователя, \
спокойно и по делу, с лёгкой британской учтивостью; обращение «сэр» уместно изредка.

Команды приходят из распознавания речи и могут быть искажены: восстанавливай очевидный \
смысл по контексту, а если команда неясна и ошибка обошлась бы дорого — переспроси.

Просьбы о действиях выполняй инструментами сразу, не спрашивая разрешения: опасные \
инструменты сами запросят подтверждение у пользователя. После действия коротко скажи, \
что сделано. Если инструмент вернул ошибку — скажи об этом прямо и не утверждай, что \
всё получилось. Длинный вывод (списки файлов, текст документа) пересказывай кратко: \
сколько найдено и самое важное.

Компьютер: {system}. Домашняя папка: {home}. Стандартные папки лежат в ней: \
Desktop (рабочий стол), Documents (документы), Downloads (загрузки), Pictures, Music, Movies или Videos.\
"""


class Brain:
    def __init__(self, cfg: Config, tools: Tools):
        self.cfg = cfg
        self.tools = tools
        self.client = anthropic.Anthropic()
        self.messages: list[dict] = []
        self.last_used = 0.0
        system = f"macOS {platform.mac_ver()[0]}" if IS_MAC else f"{platform.system()} {platform.release()}"
        self.system = [{
            "type": "text",
            "text": SYSTEM_PROMPT.format(system=system, home=Path.home()),
            "cache_control": {"type": "ephemeral"},
        }]
        self.tool_defs: list[dict] = list(TOOL_SCHEMAS)
        if cfg.web_search:
            self.tool_defs.append({"type": "web_search_20260209", "name": "web_search", "max_uses": 3})

    def ask(self, text: str) -> str:
        """Возвращает фразу для озвучки. Бросает Shutdown, если попросили отключиться."""
        now = time.monotonic()
        if now - self.last_used > HISTORY_IDLE_RESET or len(self.messages) > HISTORY_MAX_MESSAGES:
            self.messages = []
        self.last_used = now
        checkpoint = len(self.messages)
        self.messages.append({"role": "user", "content": text})
        try:
            return self._loop()
        except Shutdown:
            raise
        except anthropic.AuthenticationError:
            reply = "Ключ Anthropic не принят. Проверьте ANTHROPIC_API_KEY в файле настроек."
        except anthropic.RateLimitError:
            reply = "Превышен лимит запросов. Попробуйте через минуту."
        except anthropic.APIConnectionError:
            reply = "Нет связи с сервером. Проверьте интернет."
        except anthropic.APIStatusError as exc:
            print(f"[ошибка API {exc.status_code}] {exc.message}")
            reply = "Сервер вернул ошибку, подробности в консоли."
        del self.messages[checkpoint:]  # не оставляем в истории незавершённый ход
        return reply

    def _loop(self) -> str:
        for _ in range(MAX_STEPS):
            response = self.client.beta.messages.create(
                model=self.cfg.model,
                max_tokens=4000,
                system=self.system,
                tools=self.tool_defs,
                messages=self.messages,
                output_config={"effort": self.cfg.effort},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            self.messages.append({"role": "assistant", "content": response.content})

            if response.stop_reason == "pause_turn":  # серверный инструмент ещё работает
                continue
            if response.stop_reason == "refusal":
                return "С этим я помочь не могу."

            calls = [b for b in response.content if b.type == "tool_use"]
            if response.stop_reason != "tool_use" or not calls:
                spoken = " ".join(b.text for b in response.content if b.type == "text").strip()
                return spoken or "Готово."

            results = []
            for call in calls:
                print(f"  ⚙ {call.name} {call.input}")
                try:
                    output, failed = self.tools.call(call.name, dict(call.input)), False
                except Shutdown:
                    raise
                except ToolError as exc:
                    output, failed = str(exc), True
                except Exception as exc:  # инструмент не должен ронять ассистента
                    output, failed = f"{type(exc).__name__}: {exc}", True
                results.append({
                    "type": "tool_result",
                    "tool_use_id": call.id,
                    "content": output,
                    "is_error": failed,
                })
            self.messages.append({"role": "user", "content": results})
        return "Задача оказалась слишком длинной, я остановился."
