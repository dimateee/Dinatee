# INSTALL — survival-studio

Дата установки: 2026-11-11. Машина: облачный контейнер Claude Code (Ubuntu 24.04, x86_64,
4 CPU, 15 ГБ RAM, без GPU). Промпт был написан под macOS/Windows; ниже — как он адаптирован под Linux.

> Контейнер временный. В git лежат только лёгкие файлы. В новой сессии восстановить всё:
> `cd survival-studio && bash tools/setup.sh && tools/start_blender.sh`

## Что стоит и какие версии

| Компонент | Версия | Откуда |
|---|---|---|
| git | 2.43.0 | уже был |
| Node.js / npm | 22.23.4 / 10.9.9 | уже был |
| Python | 3.11.18 (venv `.venv`), системный 3.13 | uv |
| ffmpeg | 6.1.1 | уже был (apt) |
| uv | 0.11.32 | уже был |
| Blender | 4.0.2 | `apt-get install blender` (download.blender.org закрыт сетью) |
| Xvfb | 21.1.12 | apt — виртуальный экран для Blender с интерфейсом |
| MCP for Blender | сервер 1.30.0, аддон 1.8 | `uvx blender-mcp` |
| Remotion | 4.0.543 (+ @remotion/fonts) | `npx create-video@latest --blank` |
| faster-whisper | 1.2.1 (модель `small` в кэше HF) | pip |
| deepfilternet | 0.5.6 + модель DeepFilterNet3 в `tools/models/` | pip + raw.githubusercontent.com |
| PyTorch (CPU) | torch 2.0.1, torchaudio 2.0.2 | download.pytorch.org — нужно deepfilternet; новые torchaudio с ним несовместимы |
| piper-tts | 1.8.0, голос `ru_RU-denis-medium` | pip + huggingface.co |
| mlx-whisper | не ставился | только для Mac на Apple Silicon |

Шрифты в `fonts/` (лицензии OFL в `fonts/licenses/`), кириллица проверена в каждом:
Inter Display Black / ExtraBold (rsms/inter v4.1), Montserrat ExtraBold / Black, Oswald Bold,
Caveat Bold (google/fonts, статические начертания вырезаны из вариативных через fonttools),
JetBrains Mono Regular / Bold (JetBrains/JetBrainsMono v2.304).

## Команды, которые запускались

```bash
apt-get install -y blender xvfb python3-requests
uv venv --python 3.11 .venv
uv pip install faster-whisper deepfilternet piper-tts mcp
uv pip install "torch==2.0.1+cpu" "torchaudio==2.0.2+cpu" --index-url https://download.pytorch.org/whl/cpu \
  --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match
BLENDERMCP_ADDONS_DIR=~/.config/blender/4.0/scripts/addons uvx blender-mcp install-addon
blender --background --python-expr "import bpy; bpy.ops.preferences.addon_enable(module='blender_mcp'); bpy.ops.wm.save_userpref()"
npx create-video@latest --yes --blank --no-tailwind video && (cd video && npm install && npm install @remotion/fonts@4.0.543)
python -m fontTools.varLib.instancer "Montserrat[wght].ttf" wght=900 -o fonts/Montserrat-Black.ttf   # и т.п.
```

## Отличия от исходного промпта

- **Blender MCP без кнопки.** Экрана нет, поэтому `tools/start_blender.sh` запускает Blender
  с интерфейсом под Xvfb, и аддон сам поднимает сервер на `localhost:9876`.
- **Remotion и Chrome.** `remotion.media` закрыт, в `video/remotion.config.ts` указан
  предустановленный headless Chromium (`REMOTION_CHROME` переопределяет путь).
- **faster-whisper** качает модели с `HF_HUB_DISABLE_XET=1` (хранилище Xet сетью не пропускается).
- **deepFilter** запускать с моделью из папки: `.venv/bin/deepFilter -m tools/models/DeepFilterNet3 ...`

## Ждёт подтверждения пользователя

1. `claude mcp add -s user blender -- uvx blender-mcp` — регистрация Blender MCP в Claude Code.
2. Навыки: `npx skills add remotion-dev/skills` и копия `upbrew-tech/svg-creator-skill` в `.claude/skills/svg-creator`.
3. 3D-ассеты — скачать вручную, ссылки в `assets_3d/README.md`.

## Финальная проверка

1. Blender MCP: куб на плоскости, Eevee 1280×720 — `tools/checks/blender_mcp_check.py` → `tools/checks/blender_cube.png` ✅
2. Remotion: 3 с, 1080×1920, «РАБОТАЕТ» Inter Display Black — `npx remotion render Check` → `video/out/check.mp4` ✅
   (шрифт подтверждён: кадр отличается от рендера с запасным шрифтом на 24 674 пикселя)
3. faster-whisper: 5 с голоса Piper с таймкодами слов — `tools/transcribe_words.py` → `tools/checks/words_test.json` ✅
