#!/usr/bin/env bash
# Финальная выдача: H.264 High, 12–16 Мбит/с, AAC 320 кбит/с, громкость −14 LUFS / TP −1 dBTP (loudnorm в 2 прохода).
# finalize.sh in.mp4 out.mp4
set -euo pipefail
IN="$1"; OUT="$2"
M=$(ffmpeg -hide_banner -i "$IN" -af loudnorm=I=-14:TP=-1:LRA=7:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$M" | python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i "$IN" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -b:v 14M -minrate 14M -maxrate 14M -bufsize 14M -x264-params nal-hrd=cbr:force-cfr=1 -r 30 \
  -af "loudnorm=I=-14:TP=-1:LRA=7:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart "$OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -E ' I:|LRA:|Peak:'
ffprobe -v error -show_entries stream=codec_name,profile,width,height,bit_rate -of compact "$OUT"
