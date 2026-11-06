# Design

## Context

See proposal.md for motivation. Constraints that shape the approach:

- Venue uplink: Wi-Fi ~81 Mb/s up / 27 ms, 5G backup ~9.3 Mb/s up / 100 ms. Only one outgoing stream fits the backup.
- An existing Hetzner VPS (Germany) runs Dokploy, which deploys services behind Traefik. The web app (`remote-participation-app`) is deployed there too.
- The interpreter already lags the speaker by 1–2 s; transport latency for the in-room feed should stay well under that.
- Phones in the room may be on the venue Wi-Fi (guest network, possibly with client isolation) or on mobile data.
- Browsers play WebRTC audio in Opus; OBS produces AAC.

```
 venue                                      Hetzner VPS (Dokploy)
 -----                                      ------------------------------------------------
 OBS --SRT 1v+3a (publish creds)--------->  MediaMTX  path "ag"  (SRT :8890/udp public)
                                              | runOnAvailable: relay-fanout.sh
                                              |   ffmpeg #1: v copy + a0 copy -> rtmps YouTube A
                                              |   ffmpeg #2: v copy + a1 copy -> rtmps YouTube B
                                              |   ffmpeg #3: a2 -> Opus -> rtsp://localhost/media/trad
                                              v
                                            MediaMTX  path "media/trad"  (WebRTC HTTP :8889, internal)
                                              ^                     ICE :8189/udp public
 phone --HTTPS /media/trad/whep--> Traefik --ForwardAuth--> web app /auth/media (200/401)
                                     | path kept as is (no stripPrefix)
                                     '--> MediaMTX :8889
 phone <======== UDP 8189 Opus ==========> MediaMTX
```

## Goals / Non-Goals

**Goals:**

- One venue upload feeding two YouTube streams and the interpretation feed.
- OBS can drop and reconnect (Wi-Fi to 5G) with no action on the VPS.
- Sub-second interpretation latency for listeners on any network.
- Only the interpretation WHEP endpoint is public; access is decided by the web app.

**Non-Goals:**

- Serving the video to remote viewers ourselves (YouTube handles scale and the CDN).
- A local, in-venue media server or a split LAN/internet route (rejected: client isolation and HTTPS/mixed-content problems on a guest network we don't control).
- Recording/archiving the AG on the VPS (YouTube keeps the VOD if wanted).
- Transcoding the video.

## Decisions

### D1. MediaMTX is the ingest endpoint, ffmpeg runs off it

MediaMTX listens for SRT on path `ag`; `runOnAvailable` launches the fan-out when OBS publishes and stops it with SIGINT when OBS stops (`runOnAvailableRestart: true`). (MediaMTX ≥ 1.x names this hook `runOnAvailable`; older docs call it `runOnReady`.)

- _Why_: a bare `ffmpeg -listen` SRT receiver exits when the caller disconnects and needs an external supervisor; MediaMTX keeps the endpoint stable and handles the start/stop lifecycle.
- _Alternative_: ffmpeg as SRT listener under systemd/a restart loop. More moving parts, and the ingest endpoint disappears during restarts.

### D2. Three independent ffmpeg processes instead of one `tee`

`relay-fanout.sh` starts three ffmpeg processes, each reading `rtsp://localhost:8554/ag` and running in its own restart loop (`while :; do ffmpeg …; sleep 2; done`), and stops its children when it receives SIGINT (from MediaMTX) or SIGTERM.

- #1: `-map 0:v:0 -map 0:a:0 -c copy -f flv rtmps://…/<keyA>`
- #2: `-map 0:v:0 -map 0:a:1 -c copy -f flv rtmps://…/<keyB>`
- #3: `-map 0:a:2 -ac 1 -c:a libopus -b:a 48k -application voip -frame_duration 20 -f rtsp rtsp://localhost:8554/media/trad` (mono: one voice from one microphone)
- _Why_: a failing YouTube output must not affect the others (spec: Independent YouTube outputs). `tee` with `onfail=ignore` drops a failed slave but never retries it.
- _Cost_: the ingest is read three times over localhost. Negligible on the VPS.

### D3. Opus re-encode only for the interpretation track

Video and the YouTube audio tracks are copied (OBS sends AAC, which FLV/YouTube accept). Only track 3 is transcoded, because WebRTC needs Opus and MediaMTX does not transcode.
- **Output: Opus mono at 48 kb/s.** The interpreter is a single voice, so stereo would only duplicate the channel. 48 kb/s mono is a conservative bitrate for speech, chosen for listeners on weak mobile connections in the room. The listening latency spike (task 4.3) also checks intelligibility, and the bitrate can be raised if needed.
- Checking mono: RTP always signals Opus as `opus/48000/2` (RFC 7587), so `ffprobe` on the RTSP/WHEP path reports 2 channels regardless. Check the Opus TOC byte of the packets instead (stereo flag `0x04` clear, e.g. `0xf8`).
- **Source: AAC at 128 kb/s** from OBS (D10). This is a second lossy encode, so a generous source bitrate keeps the AAC artifacts from adding to Opus's own.

### D4. Gate WHEP with Traefik ForwardAuth on the web app's host

Traefik routes `https://<app-host>/media/trad/whep*` to MediaMTX `:8889` through a ForwardAuth middleware that calls the web app's internal `/auth/media` endpoint with the original headers (including the cookie).

- _Why_: the participant cookie is same-origin, so the browser sends it automatically. MediaMTX's own HTTP auth hook doesn't receive cookies, so it would need tokens.
- _Alternative_: short-lived JWT checked by MediaMTX (`authMethod: jwt`). More work (keys, JWKS, renewal); only needed if MediaMTX had to live on another domain.
- Gating signaling is enough: the UDP ICE port only carries media for sessions negotiated through WHEP (ICE ufrag/pwd).
- The MediaMTX path is named `media/trad`, so the public URL maps to MediaMTX unchanged and no `stripPrefix` is used. MediaMTX answers the WHEP POST with `Location: /<path>/whep/<secret>`, which the browser uses for PATCH (trickle ICE) and DELETE; with a stripped prefix that URL would miss the router and hit the web app. Verified locally (task 3.1).
- Only `GET/POST/PATCH/DELETE/OPTIONS` under `/media/trad/whep*` are routed (OPTIONS is used by MediaMTX's `reader.js` to discover ICE servers); everything else under `/media` returns 404.

### D5. MediaMTX auth for publishing and internal reads

`authMethod: internal`:

- `publish` on `ag`: a dedicated user/password (put in OBS's SRT `streamid`), never the participant code.
- `read` on `ag` and `publish` on `media/trad`: only from `127.0.0.1` (the fan-out).
- `read` on `media/trad`: anyone. The real gate is ForwardAuth, and port 8889 is not published.
- API, metrics, pprof, playback and HLS disabled or not exposed; RTMP disabled.

### D6. Deployment as a Dokploy Compose service

One image based on `bluenviron/mediamtx:<pinned>-ffmpeg` (or MediaMTX + distro ffmpeg with libopus), with `mediamtx.yml` and `relay-fanout.sh` copied into the image. Secrets (publish password, YouTube keys) come from Dokploy environment variables.

- Ports published directly on the host: `8890/udp` (SRT), `8189/udp` (WebRTC ICE). Also opened in the Hetzner firewall.
- `webrtcAdditionalHosts: [<VPS public IP>]` so ICE candidates are reachable from the internet.
- HTTP 8889 is reachable only on the Dokploy network, via Traefik labels.

### D7. OBS output method

Preferred: OBS's Stream output with an SRT URL, if it carries all 3 audio tracks. Fallback: the _Recording_ output in "Custom Output (FFmpeg)" mode, writing `mpegts` to `srt://<vps>:8890?streamid=publish:ag:<user>:<pass>&latency=200000&pkt_size=1316`, with audio tracks 1–3 selected. This is decided by the first spike (task 1). In OBS, track 2 (room + interpreter) uses a sidechain/ducking filter so the interpreter stays intelligible over the room sound.

### D8. Latency budget

SRT `latency` ≈ 200 ms (raise it if the 5G link shows losses), Opus 20 ms frames, MediaMTX default WebRTC jitter handling. Expected total is ~0.4–0.6 s. Set the YouTube events to "low latency" mode so Bureau readings stay close to what remote viewers see.

### D9. Two concurrent live events on one YouTube channel
- Both streams are live events on the association's single YouTube channel. Each event is bound to its own stream key: two separate keys created in YouTube Studio, so neither event uses the default key.
- Both events are unlisted, allow embedding, have chat disabled and use low-latency mode.
- *Why*: one channel to manage and one place for the VODs afterwards.
- *Fallback*: if the channel refuses to run two live events at the same time (to be checked in task 4.2), create the second event on a second channel. The relay is unaffected either way, since it only needs two RTMPS URLs/keys.

### D10. Video at 1080p, with a prepared 720p profile for weak uplinks
The content is mostly a slide deck and a webcam with little motion. YouTube Live transcodes the source into lower renditions (720p, 480p, 360p…) for every channel, without the viewer threshold Twitch uses. Viewers on weak connections can therefore pick a lower quality in the player, and the source can be 1080p for sharp slide text. Task 4.2 verifies these renditions appear.
- **Main OBS profile** ("AG 1080p"):
  - video 1920×1080 at 30 fps, H.264 CBR at about 4.5 Mb/s (enough for low-motion content);
  - keyframe every 2 s (YouTube requires 4 s or less);
  - x264 preset `veryfast`, or the laptop's hardware encoder.
- **Audio:** AAC 48 kHz at 128 kb/s for all three tracks. A lower bitrate for track 3 would save a negligible amount of bandwidth, and track 3 benefits from a clean source before its Opus re-encode (D3).
- **Upload budget:** about 5 Mb/s in total, plus SRT's retransmission overhead (around 25%), so about 6.3 Mb/s at worst.
  - On venue Wi-Fi (81 Mb/s up) that's trivial.
  - On the 5G backup (9.3 Mb/s up) it fits, with less margin.
- **Backup OBS profile** ("AG 720p"), prepared in advance:
  - 1280×720 at 30 fps, about 2.5 Mb/s, total about 3 Mb/s;
  - used if the 5G link turns out unstable at 1080p during the rehearsal or on the day;
  - switching profiles means stopping and restarting the stream (a few seconds), which the relay handles (automatic recovery).
- *Alternative*: 720p only. Simpler, but slide text is less sharp, and YouTube's renditions already cover viewers with weak connections.

### D11. Fallback ladder when the VPS is down
- **Level 1, local relay**: the venue laptop can run the same relay image and MediaMTX configuration locally (`relay/docker-compose.local.yml`, driven by `relay/fallback-local.sh`, secrets in a gitignored `relay/.env.local`). OBS switches to an `AG secours local` profile publishing to `srt://127.0.0.1:8890`, and the laptop pushes to the same two YouTube keys.
  - This uploads twice from the venue (one stream per event), so the profile is based on `AG 720p` (about 6 Mb/s in total, within the 5G backup). It is a degraded mode, outside the normal single-upload requirement.
  - The interpretation feed is offered best effort on the venue LAN through MediaMTX's own player page (`http://<laptop IP>:8889/media/trad/`), which only works if the venue Wi-Fi does not isolate clients (checked at the rehearsal).
  - The image is built in advance (`fallback-local.sh prepare`), so starting it needs no internet beyond the YouTube uploads.
- **Level 2, direct to YouTube**: an `AG secours YouTube` OBS profile streams track 2 (room + interpreter) straight to event B, so both audiences can still follow. No interpretation feed.
- *Why*: the VPS is a single point of failure for both YouTube streams; level 1 keeps both events and needs only Docker on the laptop, level 2 needs nothing but OBS.

## Risks / Trade-offs

- [OBS cannot send 3 audio tracks over SRT] → D7 fallback (FFmpeg custom recording output); spike first.
- [MediaMTX drops or reorders audio tracks from the MPEG-TS ingest when ffmpeg reads them back over RTSP] → spike first; fallback is to pin track order with stream metadata or have ffmpeg read SRT directly from MediaMTX.
- [The venue internet goes down completely] → everything stops, including the in-room feed. Accepted; a portable tour-guide radio kit is the offline fallback, decided outside this change.
- [Mobile browsers stop WebRTC audio when the screen locks] → spike on iOS and Android; the listening page tells users to keep it open (handled in the app change).
- [Dokploy can't express UDP ports or a ForwardAuth middleware in its UI] → use a Compose app with raw Traefik labels; spike early.
- [Leaked publish credentials let someone hijack the stream] → strong random password, rotated per AG, kept in Dokploy env only.
- [The YouTube stream keys are exposed in the process list on the VPS] → acceptable (single-tenant VPS); keys are rotated after the AG.

## Migration Plan

New deployment, nothing to migrate. Rollout: deploy the stack → loopback test from a laptop with OBS → full rehearsal with the venue laptop at least one week before the AG → rotate credentials. Rollback / fallback: see D11 (local relay on the venue laptop, then OBS straight to YouTube event B); the procedures are in `relay/docs/runbook.md`.
