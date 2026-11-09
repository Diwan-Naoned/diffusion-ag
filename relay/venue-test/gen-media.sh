#!/bin/sh
# Generate the embedded test clips (needs ffmpeg with libx264). Each clip is
# exactly 16 s of video (480 frames at 30 fps, 2 s GOP, CBR with filler so the
# bitrate matches OBS) + 3 AAC tracks like the OBS profiles:
#   a:0 440 Hz, a:1 660 Hz, a:2 interpreter track = continuous pink noise (as
#   costly to encode as speech, so listeners receive a realistic bitrate) with a
#   300 ms silence every 2 s. The start of each silence is the latency marker.
# The looper in ts.go relies on the 16 s length and on the silences starting at
# the first video frame (content time 0, 2, 4… s).
set -eu
cd "$(dirname "$0")/media"
gen() { # <file> <size> <video bitrate> [audio bitrate]
  ffmpeg -y -nostdin -hide_banner -loglevel error \
    -f lavfi -i "testsrc2=size=${2}:rate=30:duration=16" \
    -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=16" \
    -f lavfi -i "sine=frequency=660:sample_rate=48000:duration=16" \
    -f lavfi -i "anoisesrc=color=pink:sample_rate=48000:amplitude=0.3:duration=16:seed=1,volume='if(lt(mod(t\,2)\,0.3)\,0\,1)':eval=frame" \
    -map 0:v -map 1:a -map 2:a -map 3:a \
    -c:v libx264 -preset medium -b:v "$3" -minrate "$3" -maxrate "$3" -bufsize "$3" \
    -x264-params nal-hrd=cbr:force-cfr=1 -g 60 -keyint_min 60 -sc_threshold 0 \
    -pix_fmt yuv420p -profile:v high \
    -c:a aac -b:a "${4:-128k}" -ac 2 \
    -muxdelay 0 -muxpreload 0 -f mpegts "$1"
}
gen test1080.ts 1920x1080 4500k   # "AG 1080p" profile
gen test720.ts 1280x720 2500k     # "AG 720p" profile
gen testcheck.ts 320x180 150k 48k # fast check at home: ~0.3 Mb/s, same structure
ls -l test1080.ts test720.ts testcheck.ts
