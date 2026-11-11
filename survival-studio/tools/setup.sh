#!/usr/bin/env bash
# Восстанавливает студию в новом облачном контейнере (Ubuntu 24.04).
# Повторный запуск безопасен: уже установленное пропускается.
# Запуск из корня survival-studio:  bash tools/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
say() { printf '\n== %s\n' "$*"; }

say "Системные пакеты: Blender 4.x, Xvfb, ffmpeg"
need=()
command -v blender >/dev/null || need+=(blender)
command -v xvfb-run >/dev/null || need+=(xvfb)
command -v ffmpeg >/dev/null || need+=(ffmpeg)
python3 -c "import requests" 2>/dev/null || need+=(python3-requests)
if [ ${#need[@]} -gt 0 ]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq && apt-get install -y -q "${need[@]}"
fi

say "Python 3.11 venv: faster-whisper, deepfilternet, piper-tts, PyTorch CPU"
[ -x .venv/bin/python ] || uv venv -q --python 3.11 .venv
export VIRTUAL_ENV="$ROOT/.venv"
uv pip install -q faster-whisper deepfilternet piper-tts mcp
.venv/bin/python -c "import torch" 2>/dev/null || uv pip install -q \
  "torch==2.0.1+cpu" "torchaudio==2.0.2+cpu" \
  --index-url https://download.pytorch.org/whl/cpu \
  --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match

say "Модель DeepFilterNet3 -> tools/models/"
if [ ! -f tools/models/DeepFilterNet3/config.ini ]; then
  mkdir -p tools/models && tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/DFN3.zip" https://raw.githubusercontent.com/Rikorose/DeepFilterNet/main/models/DeepFilterNet3.zip
  unzip -qo "$tmp/DFN3.zip" -d tools/models && rm -rf "$tmp"
fi

say "Голос Piper ru_RU-denis-medium -> tools/voices/"
V=https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/denis/medium
for f in ru_RU-denis-medium.onnx ru_RU-denis-medium.onnx.json; do
  [ -s "tools/voices/$f" ] || curl -fsSL -o "tools/voices/$f" "$V/$f"
done

say "Blender MCP: аддон"
ADDONS=$(blender --background --python-expr \
  "import bpy;print('ADDONDIR='+bpy.utils.user_resource('SCRIPTS',path='addons',create=True))" \
  2>/dev/null | sed -n 's/^ADDONDIR=//p')
[ -f "$ADDONS/blender_mcp.py" ] || BLENDERMCP_ADDONS_DIR="$ADDONS" uvx blender-mcp install-addon
blender --background --python-expr \
  "import bpy; bpy.ops.preferences.addon_enable(module='blender_mcp'); bpy.ops.wm.save_userpref()" \
  >/dev/null 2>&1

say "Remotion: npm-зависимости и шрифты"
(cd video && { [ -d node_modules ] || npm ci --silent; })
mkdir -p video/public/fonts && cp fonts/*.ttf video/public/fonts/

say "Готово. Blender MCP запускается так: tools/start_blender.sh"
