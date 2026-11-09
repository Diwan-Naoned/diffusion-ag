# Venue network test

A Windows executable that a **non-technical person** runs on a laptop at the
venue. It checks, on the venue Wi-Fi and then on a 4G/5G phone hotspot, that
the network carries the AG stream and the interpretation feed at scale. Results
are uploaded to the spike stub on the VPS, so they can be followed remotely.
Instructions for the person on site (in French) are in [`CONSIGNES.txt`](CONSIGNES.txt)
and are shipped in the zip.

At startup it asks for a mode: **1, fast check** (at home) or **2, full test**
(at the venue). `-check` skips the menu.

The **fast check** proves the tool works on that laptop and network, with
almost no data: no throughput test, a 320×180 clip (`testcheck.ts`, about
0.4 Mb/s), and one listener for 20 s, about 2 MB in total. It covers
SmartScreen, the Windows firewall, outgoing SRT and WebRTC UDP, Traefik and
ForwardAuth, the Opus feed, and the results upload. The report has
`"mode": "check"`.

## What the full test does

For each network:

1. **Network info**: `netsh wlan show interfaces` (SSID, signal, band, channel),
   local and public IP.
2. **HTTP throughput** to the VPS through Traefik (4 parallel streams, up and down).
3. **SRT ingest**, exactly like OBS: a pre-encoded clip (`AG 1080p` profile:
   1080p30 H.264 CBR 4.5 Mb/s with filler, 2 s GOP, 3 AAC tracks at 128 kb/s,
   about 5.2 Mb/s in total) is looped forever to `srt://…:8890` with the real
   publish credentials and 200 ms latency. PCR/PTS/DTS and continuity counters
   are rewritten on each loop (`ts.go`), so the relay sees one continuous live
   stream and runs the real fan-out (sinks A/B and the Opus transcode).
   SRT stats are sampled every second: rate, RTT, retransmissions, sender drops
   (packets that never arrived), reconnections. On a cut it reconnects every
   2 s, like OBS.
4. **WebRTC listeners**: pion WHEP clients on `https://<APP_HOST>/media/trad/whep`
   (through Traefik and ForwardAuth, with the stub cookie), one UDP socket each,
   ramped up in stages. A listener that loses its session is replaced after
   about 1 s, like `reader.js`. Per stage: listeners connected, connection
   failures, RTP loss after NACK retransmissions, jitter, received bitrate, and
   whether the Opus feed is mono (TOC byte, task 4.3).
5. **End-to-end latency**: the interpreter track is pink noise with a 300 ms
   silence every 2 s. The sender records when each silence leaves the laptop,
   and each listener detects it in the Opus frames (silence frames are 3 bytes,
   noise frames about 100). The result covers laptop → SRT → relay → Opus
   transcode → WebRTC → laptop. It excludes OBS's encoder and the phone's jitter
   buffer, so add roughly 100–200 ms for what a listener actually hears. The
   noise also makes listeners receive a realistic bitrate: about 40 kb/s of
   Opus payload, or about 60 kb/s on the wire, per listener.

Stages (in `build.sh`):

| Network | Stages (listeners × seconds) |
|---|---|
| Venue Wi-Fi | 1×45, 10×60, 50×60, 100×60, 200×90, 300×60, then a guided phone check |
| Phone hotspot | 1×60, 3×150 at 1080p; if any stage is not OK, 3×120 at 720p |

On the hotspot, few listeners are simulated: on the day, people on mobile data
use their own connection, not the laptop's. What matters there is whether the
upload holds 1080p.

The **phone check** runs on the venue Wi-Fi after the stages, while the stream
is still on. The person opens `https://<APP_HOST>/login` (the stub's test
player) on the Android phone, on Wi-Fi then on mobile data, listens for the
noise and its 2 s gaps, locks the screen, and answers yes/no questions. The
answers, the network type shown (5G/4G) and the phone's carrier go into the
report. At the end, the program asks about the venue: Ethernet near the control
desk, power, captive portal, and the number of devices the Wi-Fi accepts.

### Pass criteria per stage

| Result | Condition |
|---|---|
| fail | SRT cut / reconnection; ≥ 0.5 % SRT packets dropped; > 5 % of listeners missing; a connected listener receives nothing; audio loss ≥ 3 %; latency p95 ≥ 1.5 s |
| warn | any SRT drop; retransmissions ≥ 10 %; a few listeners missing or reconnected; audio loss ≥ 1 % (or ≥ 5 % for the worst listener); latency p95 ≥ 1 s or not measured |

A load-related failure skips the higher stages. An SRT cut fails the stage but
the ramp continues, and the phase summary reports the number of cuts.

### What it cannot test

Simulated listeners all come from one laptop. That tests the venue's internet
link and the router's NAT (300 UDP flows, about 18 Mb/s down while 5–6 Mb/s go
up), and it stresses the relay on the VPS. It does **not** test what 100–200
real phones do to the Wi-Fi access point: the DHCP pool size, the maximum
number of associated clients (often 32–64 on consumer access points), and
airtime on 2.4 GHz. Those have to be asked of the venue, which is why the tool
and `CONSIGNES.txt` ask for them.

The jitter column includes about 30 ms of burstiness from ffmpeg's RTSP output
on the relay, which also shows on localhost. Compare stages with each other, not
with zero.

## Preparing a test

1. Dokploy → `ag-relay`: compose path `./relay/docker-compose.spike.yml` (spike
   mode: RTMP sinks instead of YouTube, stub auth) and the environment from
   `relay/.env`, with `APP_HOST=ag-test.dokploy.cocaud.dev`. The stub must have
   its own host: the web app (`ag-app`) owns the production host, and two
   catch-all routers on one host would conflict. Never run the test against
   production: the test pattern would go to the real YouTube events.
2. Build:

   ```sh
   relay/venue-test/build.sh
   ```

   This reads `relay/.env` (the spike environment) and generates `config.json`
   (gitignored) with the SRT publish credentials, the stub host and the
   results token. On the first run it adds `RESULTS_TOKEN` to `relay/.env`.
   It then generates the test clips if missing (`gen-media.sh`, needs ffmpeg
   with libx264), and writes `dist/test-connexion-AG.zip` (the `.exe` plus
   `CONSIGNES.txt`). It prints the results URL.
3. Put `RESULTS_TOKEN` in Dokploy's environment for `ag-relay` and redeploy.
4. Dry run from your Mac against the VPS. `config.json` is embedded, so this
   uses the same configuration as the `.exe`:

   ```sh
   cd relay/venue-test && go run . -quick        # 15 s stages, both phases
   go run . -only wifi                           # full Wi-Fi phase only
   ```

5. Publish the zip on the stub and send her the link:

   ```sh
   relay/venue-test/build.sh --upload
   ```

   This uploads the zip to the stub (stored in its volume, authenticated with
   `RESULTS_TOKEN`) and prints the download page,
   `https://<APP_HOST>/telecharger?cle=<DOWNLOAD_KEY>`: a page in French with
   a download button and the first steps. `DOWNLOAD_KEY` is generated once in
   `relay/.env`, so the link stays the same across rebuilds. Without the key,
   the page and the zip return 404, since the zip contains the publish
   password. Re-run the command after any rebuild. The `.exe` is not signed:
   SmartScreen shows "Windows a protégé votre ordinateur", then "Informations
   complémentaires" → "Exécuter quand même" (covered in `CONSIGNES.txt`).
   Ask the person to run the fast check (mode 1) at home: it gets past that
   screen and the firewall prompt, and its report shows up in the results.

Results: `https://<APP_HOST>/results?token=<RESULTS_TOKEN>`. The full report
is uploaded at launch and after every step. A **live box** at the top of the
report page shows what is happening on her screen: the current step, the
question waiting for her answer, and fields that depend on the step (time
left, SRT send rate, RTT, retransmissions, listeners connected or connecting,
audio loss, translation delay…). The tool posts it every 5 s, and right away
when the step or the question changes. It is about 1 KB per post, so roughly
1.5 kb/s. The page refreshes every 5 s, and the box turns grey when no update
has arrived for 20 s (laptop closed, network down, or switching to the
hotspot).
A copy (`.json` + `.txt`) is saved next to the `.exe` and on the Desktop.

**After the test**: rotate `RELAY_PUBLISH_PASS`, since it is embedded in the
`.exe` that was sent out (runbook, section 7), and switch `ag-relay` back to the
production compose path when needed.

## Local test

With the local stack (`relay/test/stack.sh up -d --build`), copy
`config.example.json` to `config.json`, replace `127.0.0.1` in `whep_url`
and `base_url` with `APP_HOST` from `test/test.env` (the WHEP router matches on
the host), then `go run . -quick`. Set `VT_DEBUG_SIZES=1` to print every
received Opus packet size on stderr.

`go test` checks the looper: 3 loops written without pacing, with the right
number of markers (`LOOP_OUT=/path/loop.ts go test` keeps the file for
`ffprobe`).
