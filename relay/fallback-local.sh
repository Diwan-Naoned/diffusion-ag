#!/bin/sh
# Local fallback relay on the venue laptop, used when the VPS is unreachable
# (fallback level 1, see docs/runbook.md).
#
#   relay/fallback-local.sh prepare   build the image (needs internet; do it before the AG)
#   relay/fallback-local.sh start     start the relay, print the URLs to use
#   relay/fallback-local.sh status    show whether OBS is received and the outputs run
#   relay/fallback-local.sh stop      stop the relay
#
# Reads relay/.env.local (template: relay/.env.local.example), or $ENV_FILE.
set -eu
cd "$(dirname "$0")"
ENV_FILE="${ENV_FILE:-.env.local}"

die() { echo "error: $*" >&2; exit 1; }
[ -f "$ENV_FILE" ] || die "relay/$ENV_FILE not found (copy relay/.env.local.example and fill it in)"
command -v docker >/dev/null || die "docker is not installed"
docker info >/dev/null 2>&1 || die "Docker is not running (start Docker Desktop)"

lan_ip() {
  for i in en0 en1 en2; do ip=$(ipconfig getifaddr "$i" 2>/dev/null || true); [ -n "$ip" ] && { echo "$ip"; return; }; done
  hostname -I 2>/dev/null | awk '{print $1}'
}

compose() { docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" "$@"; }

case "${1:-}" in
  prepare)
    RELAY_PUBLIC_IP=127.0.0.1 compose build
    echo "Image ag-relay:local is ready. 'start' works offline from now on."
    ;;
  start)
    ip=$(lan_ip)
    [ -n "$ip" ] || { echo "warning: no LAN address found, phones on the LAN will not get the feed" >&2; ip=127.0.0.1; }
    RELAY_PUBLIC_IP="$ip" compose up -d --no-build \
      || die "could not start (did you run 'prepare' before the AG?)"
    cat <<EOF

Local relay started.
  OBS: Profile -> "AG secours local", then Start Streaming
       (server srt://127.0.0.1:8890?streamid=publish:ag:publisher:<RELAY_PUBLISH_PASS>&latency=200000&pkt_size=1316)
  YouTube: events A and B resume within a few seconds of OBS connecting.
  Phones on the venue Wi-Fi (best effort): http://$ip:8889/media/trad/
  Check: relay/fallback-local.sh status
EOF
    ;;
  status)
    RELAY_PUBLIC_IP=x compose ps --format '{{.Service}}: {{.State}} ({{.Status}})'
    echo "--- ingest from OBS:"
    RELAY_PUBLIC_IP=x compose exec -T relay ffprobe -v error -rtsp_transport tcp \
      -show_entries stream=codec_name,width,height -of csv=p=0 rtsp://127.0.0.1:8554/ag 2>/dev/null \
      || echo "no stream from OBS"
    echo "--- outputs (expect 3 ffmpeg: YouTube A, YouTube B, interpretation):"
    RELAY_PUBLIC_IP=x compose exec -T relay sh -c "ps -o pid,args | grep '[f]fmpeg' | sed -E 's/rtmps?:[^ ]*/<youtube url>/' | cut -c1-110" || true
    echo "--- recent fan-out events:"
    RELAY_PUBLIC_IP=x compose logs --since 10m relay 2>&1 | grep '\[fanout\]' | tail -5 || true
    ;;
  stop)
    RELAY_PUBLIC_IP=x compose down
    ;;
  *)
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
