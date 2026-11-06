# MediaMTX + ffmpeg (with libopus) for the AG streaming relay (D6).
# Pinned by tag and digest; bump both together.
FROM bluenviron/mediamtx:1.21.3-ffmpeg@sha256:208e9f1740a09a5ee63b6308e77ce0d54fce0456462f640e6bd9acfc62ebb5a2

COPY mediamtx.yml /mediamtx.yml
COPY --chmod=0755 relay-fanout.sh /relay-fanout.sh

# SRT ingest, WebRTC HTTP (internal), WebRTC ICE
EXPOSE 8890/udp 8889/tcp 8189/udp
