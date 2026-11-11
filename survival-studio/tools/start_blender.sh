#!/usr/bin/env bash
# Запускает Blender с интерфейсом на виртуальном дисплее (Xvfb), чтобы аддон
# MCP for Blender сам поднял сервер на localhost:9876. Лог: tools/blender.log
set -euo pipefail
cd "$(dirname "$0")"
if (exec 3<>/dev/tcp/127.0.0.1/9876) 2>/dev/null; then echo "Blender MCP уже слушает :9876"; exit 0; fi
nohup xvfb-run -a -s "-screen 0 1920x1080x24" blender > blender.log 2>&1 &
for i in $(seq 1 60); do
  if (exec 3<>/dev/tcp/127.0.0.1/9876) 2>/dev/null; then echo "Blender MCP готов на :9876"; exit 0; fi
  sleep 1
done
echo "Blender MCP не поднялся, см. tools/blender.log"; tail -20 blender.log; exit 1
