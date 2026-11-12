#!/usr/bin/env bash
# Обработка голоса по стандарту студии:
# deepFilter (умеренно) -> HPF 80 Гц -> -2 дБ @ 300 Гц (если гудит) -> де-эссер ->
# компрессия 2:1 (атака 15 мс) -> loudnorm в два прохода (-14 LUFS, TP -1 dBTP, LRA <= 6).
# Использование: tools/voice_process.sh in.wav out.wav [--no-mud] [--no-df]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN=$(realpath "$1"); OUT=$(realpath -m "$2"); MUD=1; DFN=1
for o in "${@:3}"; do [ "$o" = "--no-mud" ] && MUD=0; [ "$o" = "--no-df" ] && DFN=0; done
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

ffmpeg -v error -y -i "$IN" -ac 1 -ar 48000 "$TMP/in.wav"
# 1. DeepFilterNet: ограничение подавления 8 дБ — без «подводного» звука
# (--no-df: для синтезированного голоса без шума шумодав только портит дикцию)
if [ "$DFN" = 1 ]; then
  "$ROOT/.venv/bin/deepFilter" -m "$ROOT/tools/models/DeepFilterNet3" --atten-lim 8 -o "$TMP" "$TMP/in.wav" >/dev/null 2>&1
  DF="$TMP/in_DeepFilterNet3.wav"
else DF="$TMP/in.wav"; fi

EQ="highpass=f=80:poles=2"
[ "$MUD" = 1 ] && EQ="$EQ,equalizer=f=300:t=q:w=1.2:g=-2"
CHAIN="$EQ,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-22dB:ratio=2:attack=15:release=150:makeup=1"

# 2. Первый проход loudnorm — измерение
M=$(ffmpeg -hide_banner -i "$DF" -af "$CHAIN,loudnorm=I=-14:TP=-1:LRA=6:print_format=json" -f null - 2>&1 \
    | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
# 3. Второй проход — линейная нормализация по измерениям
ffmpeg -v error -y -i "$DF" -af "$CHAIN,loudnorm=I=-14:TP=-1:LRA=6:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 -c:a pcm_s24le "$OUT"

# Контроль
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -A12 "Summary:" \
  | grep -E "I:|LRA:|Peak:" | sed 's/^ */  /'
