#!/usr/bin/env bash
# Рендер 3D-клипа из .blend в фоне (Eevee под Xvfb): render_clip.sh scene.blend out_dir
set -e
mkdir -p "$2"
xvfb-run -a -s "-screen 0 1920x1080x24" blender -b "$1" -o "$2/f_####" -F PNG -a > "$2/render.log" 2>&1
ls "$2" | grep -c png
