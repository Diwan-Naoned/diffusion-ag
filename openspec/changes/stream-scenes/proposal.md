# Proposal

## Why

The extraordinary general assembly (Emvod meur dreistordinal / Assemblée générale extraordinaire) takes place on Saturday 14 November 2026 in Vannes. The `streaming-relay` change delivers OBS's output to the two YouTube events, but nothing yet defines what that output looks like. Without designed scenes, remote members get raw camera and slide captures with no Diwan identity, no reminder of the assembly rules, and no explanation when something happens only in the room, such as a vote or a pause. The AG is four days away, so the scope is deliberately small.

## What Changes

- A set of OBS scenes for a 1080p canvas, following the Diwan charter (tokens, logos and Danoise Diwan font from the Diwan design system artifact), validated with the mock-up at https://claude.ai/artifact/BE4o75AocwQSUQQ2UPaEEG:
  - **Avant / A-raok**: title, date and place, countdown, and the five assembly rules.
  - **Présentation / Kinnig**: the Google Slides window capture next to the tribune camera (16:9), with the rules strip.
  - **Débat / Kaozeadenn**: one camera full frame and the other in a 16:9 inset (room or tribune, switchable), with the rules strip and an optional "vote en salle" banner.
  - **Ehan / Pause**, **Kudenn / Incident technique**, **Trugarez / Fin**.
- Overlays built as local HTML pages loaded as OBS Browser Sources, working without network access.
- All on-screen text is bilingual Breton/French, Breton first, French below in italics (no asterisks: the italics already set the translation apart), because both YouTube streams share the same video.
- Restrained entry animations (corner quarter-round growing, accent rule drawing, items appearing in sequence); nothing moves afterwards except the countdown. Scene switches use a fade, with an optional branded stinger.
- Two USB cameras (tribune, room) and the slides window as video sources; the audio routing of `relay/docs/obs.md` stays unchanged across scene switches.
- An exportable OBS scene collection and an operator doc for setting it up on the Mac and driving it with hotkeys.
- Out of scope: QR codes, speaker names and lower thirds, agenda strip, YouTube chat, live data from the participation app, remote voting.

## Capabilities

### New Capabilities

- `stream-scenes`: The visual composition of the live stream: which scenes exist, what each shows, the on-screen texts and their languages, the overlays' behaviour (animations, toggles) and their independence from the network and from the audio routing.

### Modified Capabilities

None (the relay and the participation app are not affected).

## Impact

- New `stream/` directory at the repository root (overlay HTML/CSS, a copy of the Diwan tokens, the Danoise Diwan font files and the logos used), next to `relay/` and `app/`.
- `relay/docs/obs.md`: gains the scene collection setup and the nested audio scene; profiles and audio tracks are unchanged.
- `relay/docs/runbook.md`: pre-AG checklist gains the scene and camera checks.
- Equipment: two USB cameras on separate Mac ports (an active USB extension for the room camera if it is beyond ~5 m), and the Google Slides remote-control extension.
- No change to the relay stack, the VPS, or the participation app.
