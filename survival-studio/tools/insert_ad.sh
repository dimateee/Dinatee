#!/usr/bin/env bash
# Вставка рекламной паузы в готовый ролик: ролик режется в момент T, вставляется ad-клип (фон — застывший кадр T,
# баннер с вырезанным чёрным фоном, пометка «Реклама»), потом ролик продолжается. Звук рекламы — в паузе, голос не перекрывается.
# insert_ad.sh in.mp4 out.mp4 T ad.mov ["Реклама. Подпись рекламодателя"]
set -euo pipefail
IN="$1"; OUT="$2"; T="$3"; AD="$4"; LABEL="${5:-Реклама}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; FONT="$ROOT/video/public/fonts/JetBrainsMono-Bold.ttf"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AD")
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$IN")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$IN")
BW=$(python3 -c "print(int($W*0.93)//2*2)")
FS=$(python3 -c "print(max(14,int($W*0.03)))")
ffmpeg -v error -y -i "$IN" -i "$AD" -filter_complex "
[0:v]split=3[v0][v1][vf];
[v0]trim=0:$T,setpts=PTS-STARTPTS[a];
[v1]trim=start=$T,setpts=PTS-STARTPTS[b];
[vf]trim=start=$T:duration=0.05,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=$D,trim=0:$D,drawbox=x=0:y=ih*0.56:w=iw:h=ih*0.16:color=black@0.92:t=fill,eq=brightness=-0.22:saturation=0.4,gblur=sigma=10[bg];
[1:v]fps=30,colorkey=0x000000:0.025:0.04,scale=$BW:-2,format=yuva420p,fade=in:st=0:d=0.25:alpha=1,fade=out:st=$(python3 -c "print($D-0.3)"):d=0.3:alpha=1[ad];
[bg][ad]overlay=(W-w)/2:(H-h)/2-H*0.06:shortest=1,
drawtext=fontfile=$FONT:text='$LABEL':fontsize=$FS:fontcolor=white@0.85:box=1:boxcolor=black@0.55:boxborderw=10:x=W*0.04:y=H*0.06,format=yuv420p[m];
[a][m][b]concat=n=3:v=1:a=0[v];
[0:a]asplit=2[x0][x1];
[x0]atrim=0:$T,asetpts=PTS-STARTPTS[aa];
[x1]atrim=start=$T,asetpts=PTS-STARTPTS[ab];
[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=2.5dB,apad=whole_dur=$D,atrim=0:$D[ada];
[aa]aformat=channel_layouts=stereo:sample_rates=48000[aa2];[ab]aformat=channel_layouts=stereo:sample_rates=48000[ab2];
[aa2][ada][ab2]concat=n=3:v=0:a=1[ao]" \
  -map "[v]" -map "[ao]" -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r 30 -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT"
