# Mobile playback of the interpretation feed (task 1.3)

Spike run on 2026-11-06 against the local test stack (`relay/test/stack.sh`), with
OBS 33.0.1 publishing and a looping test voice on track 3.

## Setup

- Phones on the same Wi-Fi as the Mac running the stack.
- Player: the test page served by `relay/test/app-stub.py`
  (`http://<Mac LAN IP>:8088/login`, then **Play**), which uses MediaMTX's own
  `reader.js` against `/media/trad/whep` through Traefik + ForwardAuth.
- Feed: mono Opus 48 kb/s from the `media/trad` path.
- The page has **no background-audio mitigation** (no wake lock, no Media
  Session, no "keep this page open" guidance), so these results are the
  browsers' baseline behaviour.
- Plain HTTP on a LAN IP (not a secure context) was enough for WebRTC
  playback in all three browsers.

## Results

| Phone | Browser | Playback starts | Screen locked | Other app in front | Back to browser |
|---|---|---|---|---|---|
| iPhone (iOS) | Safari | ✅ | ✅ audio continues | ✅ audio continues | ✅ still playing |
| iPhone (iOS) | Arc | ✅ | ✅ audio continues | ✅ audio continues | ✅ still playing |
| Android | Chrome | ✅ | ✅ audio continues | ✅ audio continues | ✅ still playing |

Audio never stopped by itself in any browser. Phone models and OS/browser
versions were not recorded.

Relay-side sessions during the first round lasted 98 s, 38 s and 11 s (closed by
the tester), so each lock / app-switch period was short.

### Long locked test and interruption (iPhone, Safari)

- **15 minutes with the screen locked**: audio never stopped.
- **Interrupted by another audio session** (the phone's alarm ringing): playback
  **stopped and did not resume by itself**; the listener had to tap Play again.
  iOS pauses the page's audio when another app takes the audio session, and
  the WebRTC session itself may stay up, so a reconnection on
  `connectionstatechange` alone does not catch this case.

## Conclusions

- The design's risk "mobile browsers stop WebRTC audio when the screen locks"
  did not materialise on current iOS (Safari, Arc) or Android (Chrome).
- The app's `/salle` page should still keep its planned mitigations (guidance
  text, wake lock, reconnection with backoff), which cost little and cover
  older or more aggressive power-saving devices.
- The `/salle` page must handle audio interruptions (alarm, phone call, other
  media app): watch the `<audio>` element's `pause` event and the
  `visibilitychange` event, and show a clear "Reprendre l'écoute" button (a user
  tap is needed to restart audio on iOS). Reconnection alone is not enough.
- Arc on iOS keeps its own cookie store: a listener switching browsers must go
  through the access-code step again (it got 401 until it had the cookie).
- Still worth checking under real conditions (tasks 4.3 / 6.2): a long locked
  period on mobile data, over the real HTTPS endpoint.
