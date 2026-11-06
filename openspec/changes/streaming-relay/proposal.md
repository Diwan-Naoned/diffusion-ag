# Proposal

## Why

The association's general assembly (AG) is held in a conference room in French and Breton, with a live interpreter translating Breton into French. Members who cannot attend must be able to follow it remotely with or without the translation, and members in the room who don't understand Breton must hear the interpreter with minimal delay. The venue has good Wi-Fi uplink (~81 Mb/s) but its 5G backup only offers ~9 Mb/s up, so the venue can afford to upload a single stream only.

## What Changes

- OBS at the venue publishes one SRT stream to the Hetzner VPS: 1 video track + 3 audio tracks (1 = room sound, 2 = room + interpreter, 3 = interpreter only).
- A MediaMTX instance on the VPS is the stable SRT ingest endpoint; OBS can disconnect and reconnect without anything else being restarted by hand.
- When the ingest stream becomes ready, MediaMTX starts an ffmpeg fan-out that:
  - pushes video + track 1 to YouTube live stream A ("son de la salle"),
  - pushes video + track 2 to YouTube live stream B ("avec traduction"),
  - re-encodes track 3 to Opus and republishes it to MediaMTX as an audio-only interpretation feed.
- The interpretation feed is served to phones over WebRTC (WHEP), on the web app's host, behind a Traefik ForwardAuth check delegated to the web app (the access check itself is specified in the `remote-participation-app` change).
- Only the WHEP reading endpoint of the interpretation feed is public; MediaMTX's API, metrics, HLS, built-in pages and the full ingest path are not.
- Deployment as a Docker Compose service in Dokploy, with UDP ports published directly on the host for SRT and WebRTC ICE.
- An operator runbook (OBS settings, YouTube setup, pre-GA checklist).

## Capabilities

### New Capabilities

- `live-stream-relay`: Ingest of the venue's multitrack SRT stream and fan-out to the two YouTube live streams, including publish authentication and recovery after disconnection.
- `interpretation-audio-feed`: Low-latency, access-controlled delivery of the interpreter-only audio track to listeners' browsers.

### Modified Capabilities

None (no existing specs).

## Impact

- **Systems**: Hetzner VPS (Dokploy, Traefik), two concurrent live events on the association's YouTube channel, OBS configuration on the venue laptop (1080p output, 720p backup profile).
- **Network**: new public UDP ports on the VPS (SRT ingest, WebRTC ICE); new HTTPS route `/media/...` on the web app's host.
- **Dependencies**: MediaMTX, ffmpeg (with libopus) in a container image.
- **Depends on** the `remote-participation-app` change for the access-check endpoint used by ForwardAuth and for the in-room listening page. The relay itself can be built and tested independently (with a stub check).
