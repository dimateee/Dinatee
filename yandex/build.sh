#!/usr/bin/env bash
# Собирает два архива для Yandex Cloud:
#   pyexdg-yandex-site.zip      — файлы сайта для бакета Object Storage (содержимое public/)
#   pyexdg-yandex-function.zip  — функция бота для Cloud Functions (точка входа index.handler)
# Запуск: bash yandex/build.sh [папка_для_архивов]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# сайт: файлы лежат в корне архива (index.html, css/, js/, images/, favicon.svg)
rm -f "$OUT/pyexdg-yandex-site.zip"
(cd "$ROOT/public" && zip -qr "$OUT/pyexdg-yandex-site.zip" .)

# функция: index.js + папка netlify с кодом бота
mkdir -p "$TMP/fn/netlify"
cp "$ROOT/yandex/index.js" "$TMP/fn/index.js"
cp -r "$ROOT/netlify/functions" "$ROOT/netlify/lib" "$TMP/fn/netlify/"
rm -f "$OUT/pyexdg-yandex-function.zip"
(cd "$TMP/fn" && zip -qr "$OUT/pyexdg-yandex-function.zip" .)

echo "Готово: $OUT/pyexdg-yandex-site.zip и $OUT/pyexdg-yandex-function.zip"
