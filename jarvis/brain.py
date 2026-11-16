"""«Мозг» Джарвиса: GigaChat с функциями управления компьютером."""

from __future__ import annotations

import json
import platform
import time
from pathlib import Path

import httpx
from gigachat import GigaChat
from gigachat import exceptions as giga_errors
from gigachat.models import Chat, Function, FunctionParameters, Messages, MessagesRole

from .config import IS_MAC, Config
from .tools import TOOL_SCHEMAS, Shutdown, ToolError, Tools

MAX_STEPS = 12            # сколько вызовов функций допускается на одну реплику
HISTORY_IDLE_RESET = 600  # секунд тишины, после которых разговор начинается заново
HISTORY_MAX_MESSAGES = 40

SYSTEM_PROMPT = """\
Ты Джарвис — личный голосовой помощник, который управляет компьютером пользователя.

Твои ответы озвучиваются синтезатором речи, поэтому пиши так, как говорят вслух: \
одна-три короткие фразы, без списков, разметки, ссылок и смайликов. Числа, даты и \
единицы пиши так, чтобы их можно было прочитать голосом. Отвечай на языке пользователя, \
спокойно и по делу, с лёгкой британской учтивостью; обращение «сэр» уместно изредка.

Команды приходят из распознавания речи и могут быть искажены: восстанавливай очевидный \
смысл по контексту, а если команда неясна и ошибка обошлась бы дорого — переспроси.

Просьбы о действиях выполняй функциями сразу, не спрашивая разрешения: опасные \
функции сами запросят подтверждение у пользователя. Никогда не говори, что действие \
выполнено, если ты не вызвал для него функцию. После действия коротко скажи, что \
сделано. Если функция вернула ошибку — скажи об этом прямо. Длинный вывод (списки \
файлов, текст документа) пересказывай кратко: сколько найдено и самое важное.

У тебя нет доступа к интернету, кроме функции погоды: о свежих новостях и событиях \
честно говори, что не знаешь, и предлагай открыть поиск в браузере.

Компьютер: {system}. Домашняя папка: {home}. Стандартные папки лежат в ней: \
Desktop (рабочий стол), Documents (документы), Downloads (загрузки), Pictures, Music, Movies или Videos.\
"""


def _functions() -> list[Function]:
    return [
        Function(
            name=schema["name"],
            description=schema["description"],
            parameters=FunctionParameters(
                type="object",
                properties=schema["input_schema"]["properties"],
                required=schema["input_schema"]["required"],
            ),
        )
        for schema in TOOL_SCHEMAS
    ]


class Brain:
    def __init__(self, cfg: Config, tools: Tools):
        if not cfg.gigachat_credentials:
            raise SystemExit("Не задан GIGACHAT_CREDENTIALS. Впишите ключ авторизации GigaChat в файл .env.")
        self.cfg = cfg
        self.tools = tools
        self.client = GigaChat(
            credentials=cfg.gigachat_credentials,
            scope=cfg.gigachat_scope,
            model=cfg.model,
            verify_ssl_certs=cfg.gigachat_verify_ssl,
            ca_bundle_file=cfg.gigachat_ca_bundle or None,
            timeout=60,
        )
        system = f"macOS {platform.mac_ver()[0]}" if IS_MAC else f"{platform.system()} {platform.release()}"
        self.system = Messages(
            role=MessagesRole.SYSTEM,
            content=SYSTEM_PROMPT.format(system=system, home=Path.home()),
        )
        self.functions = _functions()
        self.messages: list[Messages] = []
        self.last_used = 0.0

    def ask(self, text: str) -> str:
        """Возвращает фразу для озвучки. Бросает Shutdown, если попросили отключиться."""
        now = time.monotonic()
        if now - self.last_used > HISTORY_IDLE_RESET or len(self.messages) > HISTORY_MAX_MESSAGES:
            self.messages = []
        self.last_used = now
        checkpoint = len(self.messages)
        self.messages.append(Messages(role=MessagesRole.USER, content=text))
        try:
            return self._loop()
        except Shutdown:
            raise
        except giga_errors.AuthenticationError:
            reply = "Ключ ГигаЧата не принят. Проверьте GIGACHAT_CREDENTIALS в файле настроек."
        except giga_errors.RateLimitError:
            reply = "Превышен лимит запросов. Попробуйте через минуту."
        except giga_errors.ResponseError as exc:
            print(f"[ошибка GigaChat] {exc}")
            reply = "Сервер вернул ошибку, подробности в консоли."
        except giga_errors.GigaChatException as exc:
            print(f"[ошибка GigaChat] {exc}")
            reply = "Не удалось связаться с ГигаЧатом, подробности в консоли."
        except (httpx.HTTPError, OSError) as exc:  # нет сети, обрыв соединения, ошибка сертификата
            print(f"[сеть] {type(exc).__name__}: {exc}")
            reply = "Нет связи с сервером. Проверьте интернет."
        del self.messages[checkpoint:]  # не оставляем в истории незавершённый ход
        return reply

    def _loop(self) -> str:
        for _ in range(MAX_STEPS):
            response = self.client.chat(Chat(
                messages=[self.system, *self.messages],
                functions=self.functions,
                function_call="auto",
            ))
            choice = response.choices[0]
            message = choice.message
            self.messages.append(message)

            call = message.function_call
            if choice.finish_reason != "function_call" or call is None:
                return (message.content or "").strip() or "Готово."

            args = dict(call.arguments or {})
            print(f"  ⚙ {call.name} {args}")
            try:
                result = {"result": self.tools.call(call.name, args)}
            except Shutdown:
                raise
            except ToolError as exc:
                result = {"error": str(exc)}
            except Exception as exc:  # функция не должна ронять ассистента
                result = {"error": f"{type(exc).__name__}: {exc}"}
            self.messages.append(Messages(
                role=MessagesRole.FUNCTION,
                name=call.name,
                content=json.dumps(result, ensure_ascii=False),
            ))
        return "Задача оказалась слишком длинной, я остановился."
