#!/bin/sh
# Fan-out of the "ag" ingest path (D2), started by MediaMTX's runOnAvailable
# hook and stopped by it with SIGINT (SIGTERM is handled the same way).
#
# Three independent, supervised ffmpeg processes read the ingest over RTSP:
#   A: video + audio track 1 (room)                -> YouTube stream A
#   B: video + audio track 2 (room + interpreter)  -> YouTube stream B
#   T: audio track 3 (interpreter) -> Opus mono    -> MediaMTX path "media/trad"
#
# Required env: YOUTUBE_URL_A, YOUTUBE_URL_B (full rtmp(s) URLs incl. key).
# Optional env: TRAD_BITRATE (default 48k), RETRY_DELAY (seconds, default 2).
set -u

: "${YOUTUBE_URL_A:?YOUTUBE_URL_A is not set}"
: "${YOUTUBE_URL_B:?YOUTUBE_URL_B is not set}"
TRAD_BITRATE="${TRAD_BITRATE:-48k}"
RETRY_DELAY="${RETRY_DELAY:-2}"
RTSP_PORT="${RTSP_PORT:-8554}"
SRC="rtsp://127.0.0.1:${RTSP_PORT}/ag"
DST_TRAD="rtsp://127.0.0.1:${RTSP_PORT}/media/trad"

log() { echo "[fanout] $*" >&2; }

# Run "ffmpeg <args>" forever, restarting it after RETRY_DELAY when it exits.
# On SIGTERM, stop the current ffmpeg and exit.
supervise() {
  name=$1
  shift
  child=
  trap 'log "$name: stopping"; [ -n "$child" ] && kill -TERM "$child" 2>/dev/null; wait; exit 0' TERM
  while :; do
    log "$name: starting ffmpeg"
    ffmpeg -nostdin -hide_banner -loglevel warning \
      -rtsp_transport tcp -i "$SRC" "$@" &
    child=$!
    wait "$child"
    log "$name: ffmpeg exited with status $?, retrying in ${RETRY_DELAY}s"
    child=
    sleep "$RETRY_DELAY" &
    wait $!
  done
}

supervise A -map 0:v:0 -map 0:a:0 -c copy -f flv "$YOUTUBE_URL_A" &
pid_a=$!
supervise B -map 0:v:0 -map 0:a:1 -c copy -f flv "$YOUTUBE_URL_B" &
pid_b=$!
supervise T -map 0:a:2 -ac 1 -c:a libopus -b:a "$TRAD_BITRATE" \
  -application voip -frame_duration 20 \
  -f rtsp -rtsp_transport tcp "$DST_TRAD" &
pid_t=$!

shutdown() {
  log "received stop signal, stopping outputs"
  kill -TERM "$pid_a" "$pid_b" "$pid_t" 2>/dev/null
  wait
  log "all outputs stopped"
  exit 0
}
trap shutdown INT TERM

log "fan-out started (A=$pid_a B=$pid_b T=$pid_t)"
# wait returns early when a trapped signal arrives; loop while any supervisor lives.
while kill -0 "$pid_a" 2>/dev/null || kill -0 "$pid_b" 2>/dev/null || kill -0 "$pid_t" 2>/dev/null; do
  wait
done
log "all supervisors exited"
