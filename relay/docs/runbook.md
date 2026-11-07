# AG streaming runbook

Operator guide for streaming the general assembly: the venue laptop (OBS) sends
**one** SRT stream to the VPS, which feeds two YouTube live events and the
in-room interpretation feed.

```
OBS (venue) --SRT, 1 video + 3 audio--> relay on the VPS --> YouTube A  (track 1: room)
                                                         --> YouTube B  (track 2: room + interpreter, ducked)
                                                         --> /salle feed on phones (track 3: interpreter)
```

Detailed OBS settings: [`obs.md`](obs.md). Mobile behaviour: [`mobile-playback.md`](mobile-playback.md).

## 1. Accounts and places

| What | Where |
|---|---|
| Relay service | Dokploy → project `AG` → Compose app `ag-relay` |
| Relay secrets | Dokploy → `ag-relay` → Environment |
| YouTube events and keys | association's YouTube channel → YouTube Studio → Live |
| Interpretation feed | `https://<app host>/salle` (web app), WHEP at `/media/trad/whep` |
| OBS profiles | venue laptop: `AG 1080p` (main), `AG 720p` (weak uplink), `AG secours local` and `AG secours YouTube` (fallbacks, section 6) |
| Local fallback relay | venue laptop: `relay/fallback-local.sh`, secrets in `relay/.env.local` |

## 2. YouTube setup (once per AG)

Both streams run as two live events on the **association's single channel**
(verified on 2026-11-06: two events live at the same time, quality menu offers
720p/480p/360p renditions of the 1080p source). The second-channel fallback of
design D9 was not needed.

For each AG, in YouTube Studio:

1. Create (or reuse) two stream keys: `AG – A – Son de la salle` and
   `AG – B – Avec traduction`. Never use the default key.
2. Schedule two events, each bound to its key:

   | Setting | Value |
   |---|---|
   | Visibility | Unlisted |
   | Latency | Low latency |
   | Live chat | Off |
   | Allow embedding | On |
   | Auto-start | On |
   | **Auto-stop** | **Off** (a Wi-Fi → 5G switch must not end the event) |

3. Put the keys in Dokploy (section 3) and redeploy.
4. Give the two video IDs to the web app (embedded player).

Delete or archive test events afterwards: unlisted test broadcasts stay on the
channel as videos.

## 3. Relay deployment (Dokploy)

Compose app `ag-relay`, type **Docker Compose**, repo `Diwan-Naoned/diffusion-ag`,
branch `main`. Keep *Isolated Deployment* / *Randomize Compose* **off**, and add no
domain in the Domains tab (routing comes from the compose labels).

| Mode | Compose path | Notes |
|---|---|---|
| Tests | `./relay/docker-compose.spike.yml` | adds a stub app (test player at `https://<APP_HOST>/`) and RTMP sinks |
| Production | `./relay/docker-compose.yml` | relay only; the web app provides `/auth/media` and `/salle` |

Environment (template: `relay/.env.example`):

```
RELAY_PUBLISH_USER=publisher
RELAY_PUBLISH_PASS=<openssl rand -hex 24>
RELAY_PUBLIC_IP=195.201.194.221
YOUTUBE_URL_A=rtmps://a.rtmps.youtube.com/live2/<key A>
YOUTUBE_URL_B=rtmps://a.rtmps.youtube.com/live2/<key B>
APP_HOST=<web app host>
RELAY_AUTH_URL=http://ag-app:3000/auth/media
TRAD_BITRATE=48k
```

Environment changes only apply after **Redeploy**.

**Auto-deploy**: Dokploy redeploys `ag-relay` on every push to `main`, which
restarts the relay and cuts both YouTube streams and the interpretation feed for
a few seconds. Turn auto-deploy **off** for `ag-relay` before the AG (and do not
push to `main` while streaming), turn it back on afterwards.

Network: UDP **8890** (SRT) and **8189** (WebRTC) must be open in the Hetzner
firewall and on the host (no host firewall is active on the VPS today).

## 4. OBS setup (venue laptop)

Use the same OBS version as in [`obs.md`](obs.md) and import the profiles
(**Profile → Import**). In every SRT profile:

**Settings → Stream → Server**

```
srt://dokploy.cocaud.dev:8890?streamid=publish:ag:publisher:<RELAY_PUBLISH_PASS>&latency=200000&pkt_size=1316
```

Stream Key empty. `latency` is in microseconds (200 ms).

**Settings → Advanced → Automatically Reconnect**: enabled, Retry Delay 2 s,
Maximum Retries 100 (OBS must keep retrying during a network switch).

**Audio** (details in [`obs.md`](obs.md)):

| Source | Track 1 | Track 2 | Track 3 | Filters |
|---|---|---|---|---|
| `Salle` | ✅ | | | none |
| `Salle (trad)` (same input, second copy) | | ✅ | | Compressor, sidechain `Interprète` (ducking) |
| `Interprète` | | ✅ | ✅ | Noise Gate |

The laptop must not sleep: disable sleep / screen saver, keep it on mains power.

**Fallback profiles** (settings in [`obs.md`](obs.md#fallback-profiles)):
- `AG secours local`: copy of `AG 720p`, server
  `srt://127.0.0.1:8890?streamid=publish:ag:publisher:<RELAY_PUBLISH_PASS of relay/.env.local>&latency=200000&pkt_size=1316`
- `AG secours YouTube`: copy of `AG 720p`, server `rtmps://a.rtmps.youtube.com/live2`,
  Stream Key = key B, Audio Track **2** only

**Local fallback relay** (once per AG, with internet):
1. Docker Desktop installed on the laptop (the venue laptop is the operator's
   Mac, which already has it); a copy of this repository on it.
2. `cp relay/.env.local.example relay/.env.local`, then fill in a publish
   password and the **same two YouTube URLs as in Dokploy**.
3. `relay/fallback-local.sh prepare` (builds the image; `start` then works offline).

## 5. Pre-AG checklist

**One week before (rehearsal, task 6.2)**
- [ ] Full test at the venue on Wi-Fi, then forced onto the 5G backup
- [ ] Tune the ducking threshold and the interpreter's noise gate with the real microphones
- [ ] Decide whether `AG 1080p` holds on 5G (otherwise plan to use `AG 720p` on 5G)
- [ ] Slide text readable on a phone in the YouTube player
- [ ] Fallback level 1: `fallback-local.sh start` + `AG secours local` feeds both YouTube events; does `http://<laptop IP>:8889/media/trad/` play on a phone on the venue Wi-Fi?
- [ ] Fallback level 2: `AG secours YouTube` reaches event B with track 2

**Day before**
- [ ] New `RELAY_PUBLISH_PASS` set in Dokploy and in the OBS profiles
- [ ] YouTube events created (section 2), keys in Dokploy, redeployed with the **production** compose path
- [ ] Dokploy auto-deploy **off** for `ag-relay` (a push to `main` would restart the relay mid-stream)
- [ ] Web app points to the right YouTube video IDs; `/auth/media` and `/salle` work
- [ ] OBS profiles imported on the venue laptop, same OBS version, fallback profiles updated with the new keys/passwords
- [ ] `relay/.env.local` holds the new YouTube keys; `relay/fallback-local.sh prepare` done; Docker Desktop starts

**One hour before**
- [ ] Laptop on mains power, sleep disabled, 5G backup charged and ready
- [ ] Start streaming with `AG 1080p`
- [ ] YouTube Studio: both events receive data, health Good/Excellent
- [ ] Event A preview: room only. Event B preview: room + interpreter, room ducked when the interpreter speaks
- [ ] `/salle` plays the interpreter on a phone over the venue Wi-Fi **and** on mobile data
- [ ] Interpreter's microphone: voice clear on track 3, no room noise when silent

## 6. During the AG

### Venue Wi-Fi drops → 5G backup

1. Switch the laptop to the 5G backup (or let it fail over by itself).
2. Do nothing in OBS: it reconnects automatically to the same SRT URL, and the
   relay restarts both YouTube outputs and the interpretation feed by itself
   (a few seconds of interruption; YouTube events stay live because auto-stop is off).
3. Listeners on `/salle` may need to tap the play/resume button.

**When to switch to `AG 720p`:** if on 5G OBS shows a red/yellow status square,
growing dropped frames, or YouTube Studio reports poor health for more than
about 30 seconds:

1. **Stop Streaming**, Profile → `AG 720p`, **Start Streaming** (about 5 s of interruption).
2. Switch back to `AG 1080p` only during a pause, once back on Wi-Fi.

### VPS down: fallback ladder

| Level | When | OBS profile | YouTube | Phone feed |
|---|---|---|---|---|
| 0 | normal | `AG 1080p` / `AG 720p` | A + B via the VPS | `/salle` (web app) |
| 1 | VPS unreachable | `AG secours local` | A + B via the laptop | best effort on the venue LAN |
| 2 | level 1 fails | `AG secours YouTube` | B only, direct | none |

**Recognising "VPS down":** OBS keeps reconnecting (or shows a connection
error) for more than a minute while the laptop does have internet (a website
opens), or `/salle` and the web app are unreachable from a phone on mobile data.

#### Level 1: local relay on the laptop

The laptop runs the same relay in Docker and pushes to both YouTube events
itself (two uploads: about 6 Mb/s at 720p, which fits the 5G backup).
Verified on 2026-11-07 with OBS and the real YouTube events.

1. Stop Streaming in OBS.
2. In a terminal: `relay/fallback-local.sh start`. It prints the phone URL
   (`http://<laptop LAN IP>:8889/media/trad/`).
3. OBS: Profile → `AG secours local`, Start Streaming.
4. `relay/fallback-local.sh status`: expect the 4 ingest tracks and 3 ffmpeg outputs.
   YouTube Studio: both events receive data again.
5. Phones: if the venue Wi-Fi lets devices reach each other (checked at the
   rehearsal), announce the printed URL (or show it as a QR code); otherwise
   announce that the phone interpretation feed is unavailable.
6. When the VPS is back: Stop Streaming, Profile → `AG 1080p` (or `AG 720p`),
   Start Streaming, then `relay/fallback-local.sh stop`.

The YouTube events accept the laptop's connection on the same keys as soon as
the VPS stopped pushing (it stops by itself once OBS no longer reaches it).

#### Level 2: OBS straight to YouTube event B

If the local relay does not work (Docker not starting, laptop overloaded), stream
directly to **event B** (room + interpreter, so both audiences can follow):

1. Profile → `AG secours YouTube`, Start Streaming.
2. Announce in the room that the phone interpretation feed is unavailable (the
   tour-guide radio kit is the offline fallback, if provided).
3. Remote viewers of event A: post the event B link where the event A link was shared.

### Troubleshooting

In Dokploy → `ag-relay` → `relay` container → Terminal:

```sh
# Is OBS's stream received, with 4 tracks?
ffprobe -v error -rtsp_transport tcp -show_entries stream=index,codec_name,width,height -of compact rtsp://127.0.0.1:8554/ag
# Are the 3 outputs running? (A, B, interpretation)
ps -o pid,args | grep '[f]fmpeg' | cut -c1-110
```

In the Dokploy logs of the relay, lines starting with `[fanout]` show each
output's restarts: an output that keeps restarting points to its destination
(e.g. a wrong or expired YouTube key for A or B).

**Browser warns about the certificate on the app host:** Traefik failed to get
the Let's Encrypt certificate (on 2026-11-06 a transient DNS failure on the VPS
caused it, and Traefik did not retry). Check Traefik's logs for `acme`, then
reload Traefik in Dokploy's Web Server settings.

## 7. After the AG

- [ ] End both YouTube events (Studio → End stream); decide whether to keep the VODs
- [ ] Rotate credentials:
  - new `RELAY_PUBLISH_PASS` in Dokploy (`openssl rand -hex 24`), redeploy
  - delete or reset both YouTube stream keys in YouTube Studio
  - delete any exported copies of the OBS profiles (they contain the SRT password
    and, for `AG secours YouTube`, key B)
  - on the laptop: `relay/fallback-local.sh stop`, and clear the YouTube URLs in `relay/.env.local`
- [ ] Optionally stop the `ag-relay` service in Dokploy until the next AG
- [ ] Turn Dokploy auto-deploy back on if wanted
