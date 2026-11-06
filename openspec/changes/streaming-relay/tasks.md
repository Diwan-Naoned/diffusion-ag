# Tasks

## 1. Spikes (do first, they can change the design)

- [x] 1.1 Configure OBS with the D10 profiles ("AG 1080p": 1080p30, ~4.5 Mb/s CBR; "AG 720p": 720p30, ~2.5 Mb/s; both with 2 s keyframes and the three AAC tracks at 128 kb/s) to publish 1 video + 3 distinct audio tracks over SRT to a local MediaMTX (Stream output first, then the D7 fallback if needed) and verify with `ffprobe` on the MediaMTX path that all 4 tracks are present; record the working OBS settings in `relay/docs/obs.md`
- [x] 1.2 From that MediaMTX, run the three ffmpeg mappings of D2 (YouTube outputs replaced by local `.flv` files) and verify each output contains the expected audio track by listening to it
- [x] 1.3 Play the Opus `media/trad` path in MediaMTX's WebRTC reader on an iPhone and an Android phone, lock the screen / switch apps, and record in `relay/docs/mobile-playback.md` whether audio continues
- [x] 1.4 Create a throwaway Dokploy Compose app on the VPS with a published UDP port and a Traefik ForwardAuth label pointing at a stub HTTP service; verify a request is blocked when the stub returns 401 and passes when it returns 200

## 2. Relay configuration

- [x] 2.1 Write `relay/mediamtx.yml` (paths `ag` and `media/trad`, `authInternalUsers` per D5, API/metrics/HLS/RTMP disabled, `webrtcAdditionalHosts` from env) and verify `mediamtx` starts with it without warnings
- [x] 2.2 Write `relay/relay-fanout.sh` (three supervised ffmpeg loops, stopped on SIGINT/SIGTERM) and verify that stopping the publisher leaves no `ffmpeg` process running (`pgrep ffmpeg` empty)
- [x] 2.3 Write `relay/Dockerfile` (pinned MediaMTX + ffmpeg with libopus) and verify `ffmpeg -encoders | grep libopus` succeeds inside the image
- [x] 2.4 Write `relay/docker-compose.yml` (UDP 8890/8189 published, 8889 internal only, Traefik labels for `/media/trad/whep*` routed unchanged to MediaMTX path `media/trad` (no stripPrefix, see D4) with ForwardAuth to the app's `/auth/media`, secrets from env) and verify `docker compose config` is valid

## 3. Local end-to-end test

- [x] 3.1 Run the compose stack locally with YouTube URLs pointed at a local RTMP sink, and an auth stub; verify with OBS publishing that both sinks receive video + their audio track and that the WHEP feed plays in a browser
- [x] 3.2 Kill OBS's connection and reconnect; verify all three outputs resume without touching the stack (spec: automatic recovery)
- [x] 3.3 Make sink B refuse connections; verify sink A and the WHEP feed keep running and B resumes when it comes back (spec: independent outputs)
- [x] 3.4 Publish with wrong credentials, try to read `ag` over SRT, and request `/media/v3/...`, `/media/trad/` (player page), and the HLS port; verify every attempt is refused (specs: authenticated ingest, minimal public surface)

## 4. VPS deployment

- [x] 4.1 Open UDP 8890 and 8189 in the Hetzner firewall and deploy the stack in Dokploy with real secrets; verify OBS on a home connection can publish and `ffprobe` inside the relay container (Dokploy terminal; RTSP is bound to the container's loopback, so no SSH tunnel) shows 4 tracks
- [x] 4.2 On the association's channel, create two separate stream keys and two live events bound to them (D9: unlisted, embedding allowed, chat disabled, low-latency mode), and set the keys in Dokploy; verify both events are live at the same time with the right audio in YouTube Studio's preview, and that the player's quality menu offers lower renditions (720p, 480p, 360p) of the 1080p source, or apply the D9 second-channel fallback and record which one was used in `relay/docs/runbook.md`
- [ ] 4.3 Measure interpretation latency (clap in the interpreter mic, record phone audio and mic together) on Wi-Fi and on 4G/5G; verify it stays under 1 s, and adjust SRT latency if needed; also have a listener judge the intelligibility of the 48 kb/s mono Opus feed with headphones and with the phone speaker, check that the `media/trad` path is mono Opus (Opus TOC byte, see D3: `ffprobe` always reports 2 channels over RTP), and raise the bitrate in D2/D3 if speech is not clear

## 5. Operator documentation

- [ ] 5.1 Write `relay/docs/runbook.md` (OBS profile and audio routing with ducking on track 2, SRT URL format, pre-GA checklist, 5G failover procedure including when to switch to the 720p OBS profile, degraded mode streaming directly to YouTube, credential rotation after the AG) and verify a second person can follow it to start a test stream
- [x] 5.2 Write the local fallback relay (D11: `relay/docker-compose.local.yml`, `relay/fallback-local.sh`, `relay/.env.local.example`) and the `AG secours local` / `AG secours YouTube` OBS profiles in `relay/docs/obs.md`; verify with a simulated OBS stream that `prepare`/`start`/`status`/`stop` work and both YouTube stand-ins receive video + their audio track

## 6. Integration with the web app

- [ ] 6.1 Once `remote-participation-app` provides `/auth/media`, point ForwardAuth at it and verify the WHEP feed plays with a participant cookie and returns 401 without one
- [ ] 6.2 Full rehearsal at the venue (or on its network conditions) at least one week before the AG, with the venue laptop on Wi-Fi then forced onto 5G; verify both YouTube streams and the in-room feed survive the switch, that the 1080p profile holds on 5G (upload about 5 Mb/s, no sustained SRT losses), otherwise switch to the 720p profile and record that in the runbook, that slide text is readable on a phone, and run fallback levels 1 and 2 from the runbook (including whether the LAN interpretation feed plays on the venue Wi-Fi)
