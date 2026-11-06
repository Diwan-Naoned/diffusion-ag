#!/bin/sh
# Simulated OBS for local tests: 1080p30 H.264 (2 s GOP) + 3 AAC tracks with distinct tones, mpegts over SRT.
# usage: publish.sh <streamid> <duration> [host]
SID=$1; DUR=$2; HOST=${3:-127.0.0.1}
exec ffmpeg -nostdin -hide_banner -loglevel error -re \
  -f lavfi -i "testsrc2=size=1920x1080:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" \
  -f lavfi -i "sine=frequency=880:sample_rate=48000" \
  -f lavfi -i "sine=frequency=1320:sample_rate=48000" \
  -map 0:v -map 1:a -map 2:a -map 3:a -t "$DUR" \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 4500k -maxrate 4500k -bufsize 4500k -g 60 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -ac 2 \
  -f mpegts "srt://$HOST:8890?streamid=$SID&latency=200000&pkt_size=1316"
