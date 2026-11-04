#!/usr/bin/env bash
# Собирает архив для обычного PHP-хостинга (REG.RU и похожие):
#   pyexdg-regru.zip — сайт (содержимое public/) + бот в папке api/ (PHP).
# Секретный api/config.php в архив не попадает: его создают на хостинге из config.example.php.
# Запуск: bash regru/build.sh [папка_для_архива]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/site/api"
cp -r "$ROOT/public/." "$TMP/site/"
cp "$ROOT/regru/api/"*.php "$ROOT/regru/api/.htaccess" "$TMP/site/api/"
rm -f "$TMP/site/api/config.php"

rm -f "$OUT/pyexdg-regru.zip"
(cd "$TMP/site" && zip -qr "$OUT/pyexdg-regru.zip" .)
echo "Готово: $OUT/pyexdg-regru.zip"
