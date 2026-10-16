#!/bin/bash
# preview (mede exposição) e depois o final em segmentos
cd "$(dirname "$0")"
node render.mjs video 960 540 1 preview.mp4 '{"saveExp":"exp.json"}' > log_preview.txt 2>&1 || { echo FAIL > status; exit 1; }
echo preview_ok > status
for seg in 0 1 2 3 4; do
  a=$((seg*90)); b=$((a+90))
  [ -f seg/s$seg.mp4 ] && continue
  node render.mjs video 1920 1080 6 seg/s$seg.tmp.mp4 '{"expFile":"exp.json"}' $a $b > log_s$seg.txt 2>&1 || { echo FAIL_s$seg > status; exit 1; }
  mv seg/s$seg.tmp.mp4 seg/s$seg.mp4
  echo seg${seg}_ok > status
done
printf "file 's0.mp4'\nfile 's1.mp4'\nfile 's2.mp4'\nfile 's3.mp4'\nfile 's4.mp4'\n" > seg/list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i seg/list.txt -c copy -movflags +faststart final.mp4 && echo done > status || echo FAIL_concat > status
