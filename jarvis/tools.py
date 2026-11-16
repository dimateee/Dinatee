"""Инструменты, которыми Джарвис управляет компьютером (macOS и Windows)."""

from __future__ import annotations

import base64
import datetime as dt
import os
import shutil
import subprocess
import time
import urllib.parse
import webbrowser
from pathlib import Path
from typing import Callable

from .config import IS_MAC, IS_WINDOWS

MAX_OUTPUT = 4000
SKIP_DIRS = {
    "node_modules", "Library", "AppData", "__pycache__", "venv", ".venv",
    "Windows", "Program Files", "Program Files (x86)", "$Recycle.Bin",
}


class ToolError(Exception):
    """Понятная ошибка, текст которой уходит модели."""


class Shutdown(Exception):
    """Пользователь попросил выключить ассистента."""


def _path(raw: str) -> Path:
    return Path(os.path.expandvars(os.path.expanduser(raw))).resolve()


def _run(args, timeout: float = 30, shell: bool = False) -> str:
    try:
        done = subprocess.run(
            args, shell=shell, capture_output=True, text=True,
            timeout=timeout, encoding="utf-8", errors="replace",
        )
    except subprocess.TimeoutExpired:
        raise ToolError(f"Команда не завершилась за {int(timeout)} секунд.")
    except FileNotFoundError as exc:
        raise ToolError(f"Не найдено: {exc}")
    out = (done.stdout or "") + (("\n" + done.stderr) if done.stderr else "")
    out = out.strip()[:MAX_OUTPUT]
    if done.returncode != 0:
        raise ToolError(f"Код возврата {done.returncode}. {out}")
    return out or "Готово."


def _powershell(script: str, timeout: float = 30) -> str:
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    return _run(["powershell", "-NoProfile", "-EncodedCommand", encoded], timeout)


def _osascript(script: str) -> str:
    return _run(["osascript", "-e", script])


def _gui():
    try:
        import pyautogui
    except Exception as exc:  # нет пакета или нет доступа к экрану
        raise ToolError(f"Управление клавиатурой недоступно: {exc}")
    pyautogui.FAILSAFE = True
    return pyautogui


class Tools:
    """Набор инструментов. confirm(вопрос) -> bool спрашивает пользователя перед опасным действием."""

    def __init__(self, confirm: Callable[[str], bool], confirm_dangerous: bool = True):
        self._ask = confirm
        self._confirm_dangerous = confirm_dangerous

    def _confirm(self, question: str) -> None:
        if self._confirm_dangerous and not self._ask(question):
            raise ToolError("Пользователь не подтвердил действие. Ничего не сделано.")

    # --- программы и браузер -------------------------------------------------

    def open_app(self, name: str) -> str:
        if IS_MAC:
            _run(["open", "-a", name])
        elif IS_WINDOWS:
            _powershell(f"Start-Process -FilePath '{name.replace(chr(39), chr(39) * 2)}'")
        else:
            subprocess.Popen([name])
        return f"Приложение «{name}» запущено."

    def close_app(self, name: str) -> str:
        if IS_MAC:
            _osascript(f'tell application "{name}" to quit')
        elif IS_WINDOWS:
            exe = name if name.lower().endswith(".exe") else name + ".exe"
            _run(["taskkill", "/IM", exe])
        else:
            _run(["pkill", "-f", name])
        return f"Приложение «{name}» закрыто."

    def open_url(self, url: str) -> str:
        if "://" not in url:
            url = "https://" + url
        if not url.lower().startswith(("http://", "https://")):
            raise ToolError("Открываю только http и https ссылки.")
        webbrowser.open(url)
        return f"Открыл {url}"

    def search_in_browser(self, query: str, site: str = "google") -> str:
        q = urllib.parse.quote_plus(query)
        engines = {
            "google": f"https://www.google.com/search?q={q}",
            "youtube": f"https://www.youtube.com/results?search_query={q}",
            "yandex": f"https://yandex.ru/search/?text={q}",
        }
        webbrowser.open(engines.get(site, engines["google"]))
        return f"Открыл поиск «{query}» ({site})."

    # --- файлы и проводник ---------------------------------------------------

    def open_path(self, path: str) -> str:
        target = _path(path)
        if not target.exists():
            raise ToolError(f"Нет такого пути: {target}")
        if IS_MAC:
            _run(["open", str(target)])
        elif IS_WINDOWS:
            os.startfile(str(target))  # type: ignore[attr-defined]
        else:
            _run(["xdg-open", str(target)])
        return f"Открыл {target}"

    def list_folder(self, path: str) -> str:
        folder = _path(path)
        if not folder.is_dir():
            raise ToolError(f"Это не папка: {folder}")
        entries = sorted(folder.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        lines = [("[папка] " if p.is_dir() else "") + p.name for p in entries[:100]]
        more = f"\n… и ещё {len(entries) - 100}" if len(entries) > 100 else ""
        return f"{folder} ({len(entries)} элементов):\n" + "\n".join(lines) + more

    def find_files(self, query: str, folder: str = "~") -> str:
        root = _path(folder)
        if not root.is_dir():
            raise ToolError(f"Это не папка: {root}")
        needle = query.lower()
        found: list[str] = []
        deadline = time.monotonic() + 10
        for current, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
            for name in dirs + files:
                if needle in name.lower():
                    found.append(str(Path(current) / name))
            if len(found) >= 30 or time.monotonic() > deadline:
                break
        if not found:
            return f"Ничего похожего на «{query}» в {root} не найдено."
        return "\n".join(found[:30])

    def read_text_file(self, path: str) -> str:
        target = _path(path)
        if not target.is_file():
            raise ToolError(f"Нет такого файла: {target}")
        text = target.read_text(encoding="utf-8", errors="replace")
        return text[:MAX_OUTPUT] + ("\n… (обрезано)" if len(text) > MAX_OUTPUT else "")

    def write_text_file(self, path: str, content: str) -> str:
        target = _path(path)
        if target.exists():
            self._confirm(f"Файл {target.name} уже существует. Перезаписать?")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return f"Записал {target}"

    def create_folder(self, path: str) -> str:
        target = _path(path)
        target.mkdir(parents=True, exist_ok=True)
        return f"Папка создана: {target}"

    def move_path(self, source: str, destination: str) -> str:
        src, dst = _path(source), _path(destination)
        if not src.exists():
            raise ToolError(f"Нет такого пути: {src}")
        if dst.is_dir():
            dst = dst / src.name
        if dst.exists():
            raise ToolError(f"В месте назначения уже есть {dst.name}. Ничего не перемещал.")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        return f"Перемещено: {src} → {dst}"

    def delete_to_trash(self, path: str) -> str:
        target = _path(path)
        if not target.exists():
            raise ToolError(f"Нет такого пути: {target}")
        self._confirm(f"Переместить {target.name} в корзину?")
        try:
            from send2trash import send2trash
        except ImportError:
            raise ToolError("Не установлен пакет send2trash, удаление отключено.")
        send2trash(str(target))
        return f"{target.name} в корзине."

    # --- система -------------------------------------------------------------

    def run_command(self, command: str) -> str:
        self._confirm(f"Выполнить команду: {command}?")
        if IS_WINDOWS:
            return _powershell(command, timeout=60)
        return _run(command, timeout=60, shell=True)

    def set_volume(self, percent: int) -> str:
        percent = max(0, min(100, int(percent)))
        if IS_MAC:
            _osascript(f"set volume output volume {percent}")
        else:
            gui = _gui()  # шаг клавиши громкости в Windows — 2 %
            gui.press("volumedown", presses=50)
            gui.press("volumeup", presses=percent // 2)
        return f"Громкость {percent} процентов."

    def media_control(self, action: str) -> str:
        if IS_MAC:
            if action == "mute":
                _osascript("set volume output muted (not (output muted of (get volume settings)))")
                return "Звук переключён."
            verbs = {"play_pause": "playpause", "next": "next track", "previous": "previous track"}
            for player in ("Spotify", "Music"):
                running = _osascript(f'application "{player}" is running')
                if "true" in running:
                    _osascript(f'tell application "{player}" to {verbs[action]}')
                    return f"Готово ({player})."
            raise ToolError("Не запущен ни Spotify, ни Музыка.")
        keys = {"play_pause": "playpause", "next": "nexttrack", "previous": "prevtrack", "mute": "volumemute"}
        _gui().press(keys[action])
        return "Готово."

    def press_hotkey(self, keys: list[str]) -> str:
        _gui().hotkey(*[k.lower() for k in keys])
        return "Нажал " + " + ".join(keys)

    def type_text(self, text: str) -> str:
        gui = _gui()
        try:
            import pyperclip
        except ImportError:
            raise ToolError("Не установлен пакет pyperclip.")
        pyperclip.copy(text)  # через буфер обмена — иначе кириллица не печатается
        gui.hotkey("command" if IS_MAC else "ctrl", "v")
        return "Текст напечатан."

    def take_screenshot(self) -> str:
        target = Path.home() / "Desktop" / f"screenshot-{dt.datetime.now():%Y%m%d-%H%M%S}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        if IS_MAC:
            _run(["screencapture", "-x", str(target)])
        else:
            _gui().screenshot(str(target))
        return f"Снимок экрана сохранён: {target}"

    def lock_screen(self) -> str:
        if IS_MAC:
            _run(["pmset", "displaysleepnow"])
        elif IS_WINDOWS:
            _run(["rundll32.exe", "user32.dll,LockWorkStation"])
        else:
            raise ToolError("Блокировка экрана на этой системе не поддерживается.")
        return "Экран заблокирован."

    def get_datetime(self) -> str:
        return dt.datetime.now().astimezone().strftime("%A, %d.%m.%Y, %H:%M, часовой пояс %Z")

    def shutdown_assistant(self) -> str:
        raise Shutdown()

    def call(self, name: str, args: dict) -> str:
        method = getattr(self, name, None)
        if name.startswith("_") or name == "call" or not callable(method):
            raise ToolError(f"Неизвестный инструмент: {name}")
        return str(method(**args))


def _tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None) -> dict:
    return {
        "name": name,
        "description": description,
        "input_schema": {
            "type": "object",
            "properties": properties or {},
            "required": required if required is not None else list(properties or {}),
        },
    }


_STR = {"type": "string"}
_PATH = {"type": "string", "description": "Абсолютный путь или путь с ~ (домашняя папка)."}

TOOL_SCHEMAS = [
    _tool("open_app", "Запустить приложение по имени (например Safari, Google Chrome, Telegram, notepad, calc).", {"name": _STR}),
    _tool("close_app", "Закрыть приложение по имени.", {"name": _STR}),
    _tool("open_url", "Открыть сайт или ссылку в браузере по умолчанию.", {"url": _STR}),
    _tool(
        "search_in_browser",
        "Открыть в браузере страницу поиска — когда пользователь хочет увидеть результаты сам.",
        {"query": _STR, "site": {"type": "string", "enum": ["google", "youtube", "yandex"]}},
        ["query"],
    ),
    _tool("open_path", "Открыть папку в проводнике (Finder / Explorer) или файл в программе по умолчанию.", {"path": _PATH}),
    _tool("list_folder", "Показать содержимое папки.", {"path": _PATH}),
    _tool(
        "find_files",
        "Найти файлы и папки по части имени. По умолчанию ищет в домашней папке.",
        {"query": _STR, "folder": _PATH},
        ["query"],
    ),
    _tool("read_text_file", "Прочитать текстовый файл.", {"path": _PATH}),
    _tool("write_text_file", "Создать текстовый файл с указанным содержимым.", {"path": _PATH, "content": _STR}),
    _tool("create_folder", "Создать папку.", {"path": _PATH}),
    _tool(
        "move_path",
        "Переместить или переименовать файл или папку. Существующие файлы не перезаписывает.",
        {"source": _PATH, "destination": _PATH},
    ),
    _tool("delete_to_trash", "Переместить файл или папку в корзину. Пользователя спросят о подтверждении.", {"path": _PATH}),
    _tool(
        "run_command",
        "Выполнить команду оболочки (zsh на macOS, PowerShell на Windows) и вернуть вывод. "
        "Только когда другие инструменты не подходят. Пользователя спросят о подтверждении.",
        {"command": _STR},
    ),
    _tool("set_volume", "Установить громкость системы в процентах.", {"percent": {"type": "integer", "minimum": 0, "maximum": 100}}),
    _tool(
        "media_control",
        "Управление воспроизведением и звуком.",
        {"action": {"type": "string", "enum": ["play_pause", "next", "previous", "mute"]}},
    ),
    _tool(
        "press_hotkey",
        "Нажать сочетание клавиш в активном окне, например ['ctrl','t'] или ['command','w'].",
        {"keys": {"type": "array", "items": _STR}},
    ),
    _tool("type_text", "Напечатать текст в активном окне.", {"text": _STR}),
    _tool("take_screenshot", "Сделать снимок экрана и сохранить на рабочий стол."),
    _tool("lock_screen", "Заблокировать экран."),
    _tool("get_datetime", "Узнать текущие дату и время."),
    _tool("shutdown_assistant", "Завершить работу ассистента, когда пользователь просит отключиться."),
]
