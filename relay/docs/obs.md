# OBS settings for the AG relay

Verified on 2026-11-06 with **OBS Studio 33.0.1 on macOS**, publishing to the
local test stack (`relay/test/stack.sh`). Use the same OBS version on the venue
laptop (OBS warns when a profile references an encoder that is missing).

Result: OBS's regular **Stream output** carries 1 video + 3 audio tracks over
SRT. The D7 fallback (Custom FFmpeg recording output) is not needed.

## Profiles

Two profiles, identical except for the video output resolution and bitrate (D10):

| Setting | `AG 1080p` (main) | `AG 720p` (weak uplink) |
|---|---|---|
| Settings → Video → Base (Canvas) | 1920x1080 | 1920x1080 |
| Settings → Video → Output (Scaled) | 1920x1080 | 1280x720, Lanczos |
| Settings → Video → FPS | 30 | 30 |
| Output → Streaming → Bitrate | 4500 Kbps | 2500 Kbps |
| Measured video bitrate | ~4480 kb/s | ~2520 kb/s |
| Total upload (video + 3 × 128k audio) | ~4.9 Mb/s | ~2.9 Mb/s |

Create `AG 1080p` first, then **Profile → Duplicate** to make `AG 720p` and change
the two lines above. Switching profile requires stopping and restarting the
stream; the relay recovers on its own (verified).

## Settings common to both profiles

**Settings → Stream**
- Service: `Custom…`
- Server: `srt://<host>:8890?streamid=publish:ag:<user>:<password>&latency=200000&pkt_size=1316`
  - `<host>`: VPS public IP or DNS name (`127.0.0.1` for the local test stack)
  - `<user>` / `<password>`: `RELAY_PUBLISH_USER` / `RELAY_PUBLISH_PASS` from Dokploy
  - `latency` is in microseconds (200 ms, D8); raise it if the 5G link shows losses
- Stream Key: empty

**Settings → Output** (Output Mode: **Advanced**)
- Streaming tab:
  - Audio Track: tick **1, 2 and 3** (checkboxes appear because the server is `srt://`)
  - Video Encoder: **Apple VT H264 Hardware Encoder**
    (on a Windows/Linux venue laptop: x264 preset `veryfast`, or NVENC/QuickSync with the same values)
  - Rate Control: **CBR**, Bitrate per profile (above)
  - Keyframe Interval: **2 s** (Apple VT produces ~1.9 s, well within YouTube's 4 s limit)
  - Profile: **high**
- Audio tab: Track 1, 2, 3 at **128** kbps, AAC (do not use `ffmpeg Opus`: the
  encoder applies to all tracks and YouTube's RTMP ingest only accepts AAC/MP3).
  Suggested names: `Salle`, `Salle+Interp`, `Interp`.

**Settings → Audio**: Sample Rate **48 kHz**, Channels **Stereo**.

## Audio routing (Edit → Advanced Audio Properties → Tracks)

| Source | 1 | 2 | 3 | 4–6 |
|---|---|---|---|---|
| Room sound (venue mixer / room mic) | ✅ | ✅ | | |
| Interpreter mic | | ✅ | ✅ | |
| Everything else (desktop audio, other mics) | | | | |

- Track 1 → YouTube A ("son de la salle")
- Track 2 → YouTube B ("avec traduction")
- Track 3 → interpretation feed in the room (re-encoded to mono Opus 48 kb/s by the relay)

Ducking of the room sound on track 2 under the interpreter's voice is covered in
the runbook (`relay/docs/runbook.md`).

## Verification (2026-11-06, local stack)

`ffprobe` on the MediaMTX `ag` path:

```
stream|index=0|codec_name=h264|profile=High|width=1920|height=1080|r_frame_rate=30/1
stream|index=1|codec_name=aac|profile=LC|sample_rate=48000|channels=2
stream|index=2|codec_name=aac|profile=LC|sample_rate=48000|channels=2
stream|index=3|codec_name=aac|profile=LC|sample_rate=48000|channels=2
```

With two distinct test voices on the room and interpreter sources, listening to
the fan-out outputs (task 1.2) gave: YouTube A = room voice only, YouTube B =
both voices, `media/trad` = interpreter voice only.

To check an ingest yourself on the test stack:

```
docker exec relay-relay-1 ffprobe -v error -rtsp_transport tcp \
  -show_entries stream=index,codec_name,width,height,channels -of compact \
  rtsp://127.0.0.1:8554/ag
```

## Moving the profiles to the venue laptop

**Profile → Export** in OBS, then **Profile → Import** on the venue laptop.
The exported folder contains the SRT URL **with the publish password**: transfer
it privately and delete the copy afterwards. Re-select the video encoder if the
venue laptop is not a Mac.
