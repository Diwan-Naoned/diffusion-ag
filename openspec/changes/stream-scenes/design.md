# Design

## Context

- OBS runs on the operator's Mac, which is also the venue laptop of `relay/docs/runbook.md`. The `AG 1080p` profile (1920×1080 canvas and output) is confirmed by test; the 720p and fallback profiles stay as backups and scale the same canvas, so nothing here depends on the profile.
- Audio routing is fixed by `relay/docs/obs.md`: `Salle` on track 1, `Salle (trad)` (ducked by `Interprète`) and `Interprète` on track 2, `Interprète` on track 3. These are currently ordinary sources.
- Video sources: two USB cameras (T = tribune, S = room) and the Google Slides presentation, run on the same Mac in Chrome and driven by the presenter from a tablet through an extension that does not need window focus. The room projector shows the slides, not the OBS output.
- The look is fixed by the mock-up (https://claude.ai/artifact/BE4o75AocwQSUQQ2UPaEEG), built on the Diwan design system artifact (https://claude.ai/artifact/DbGmkfimAgPWyLLxghRGVd): tokens, the Danoise Diwan font files, and the logos `diwan-signature.svg` and `diwan-bolomig.svg`.
- The AG is on 14 November 2026, four days after this change was written: every decision favours what can be built and rehearsed by hand in OBS in a day.

## Goals / Non-Goals

**Goals:**
- Overlays that match the mock-up and render identically with or without network access.
- One place for every on-screen string, so a Breton speaker can review and fix it without touching layout code.
- An OBS setup where switching scenes never touches audio and every action has a hotkey.

**Non-Goals:**
- No build step, framework or package: plain HTML, CSS and a few lines of JavaScript.
- No generated OBS scene collection: scenes are built by hand following the doc, then exported as a backup.
- No automated tests for the overlays; they are checked visually against the mock-up (task list).
- No branded stinger video unless time is left (D8).

## Decisions

### D1. Overlays are local HTML files in `stream/`, loaded as OBS Browser Sources
Each overlay is an HTML page with a transparent background, using CSS variables copied from the design system's `tokens.css`, fonts loaded with `@font-face` from `stream/fonts/`, and logos as SVG files from `stream/img/`. OBS loads them by `file://` URL.
- *Why*: exact charter colours and fonts, CSS animations, the same markup as the mock-up, and no network dependency (spec: Works offline).
- *Alternatives*: PNG overlays plus OBS Text sources (no animation, bilingual layout fiddly, every text change is a re-export); pages hosted on the VPS (adds a network dependency on the day, exactly when the venue may fall back to 5G).

### D2. Overlays are split by element, not by scene
| File | Used in | Content |
|---|---|---|
| `signature.html` | every scene, via the nested scene `Habillage` | signature logo bottom-left, 260 px wide, grows from the corner on first load |
| `avant.html?start=HH:MM` | Avant | title, date and place, countdown to `start`, the five rules in the blue panel, Diwan characters |
| `presentation.html` | Présentation | blue background with the title block under the camera; the slide and camera are OBS sources placed on top |
| `rules-strip.html` | nested scene `Bandeau règles`, included in Présentation and Débat | the five rules in short form |
| `vote.html` | Débat (both layouts) | the "Votadeg er sal" banner |
| `interlude.html?v=pause&start=HH:MM`, `?v=incident`, `?v=fin` | Pause, Incident, Fin | blue background, big title, countdown (pause only), Diwan characters |

Shared elements (signature, rules strip) are single sources inside nested scenes. Browser source settings: "Shutdown source when not visible" **off** and "Refresh browser when scene becomes active" **off** for shared elements, so a scene switch neither replays nor moves them (spec: Rules strip); **on** for the per-scene pages (`avant`, `interlude`) so their entry animation plays each time.
- *Why*: OBS keeps one browser instance per source; nesting is the only way to have the same instance, at the same position, in several scenes, with one visibility toggle for all of them.
- *Alternative*: one full-frame page per scene. Simpler file list, but the strip and logo would replay on every switch, and the strip toggle would need one hotkey per scene.

### D3. Geometry (1920×1080), as validated in the mock-up
- Présentation: slide capture 1312×738 at (48, 80); tribune camera 480×270 at (1392, 80), corners rounded top-left and bottom-right (32 px, via a browser-source mask frame or an OBS image mask); title block bottom-aligned with the slide at x = 1392.
- Rules strip: left 288 px, bottom 48 px, height 116 px (clears the 260 px signature).
- Débat: main camera full frame; inset 448×252 at (1424, 48) with a 4 px white border; vote banner above the strip (bottom 184 px).
- Cameras are scaled to fit, never cropped to another ratio (spec: Presentation scene). The rounded-corner frame is drawn by a mask, not by cropping.

### D4. All strings in `stream/texts.js`
A classic script setting `window.TEXTS = { title: {br, fr}, date: {br, fr}, rules: [{br, fr, brShort, frShort}, ...], ... }`, loaded by every page with `<script src="texts.js">`.
- *Why*: `fetch()` of a local JSON file is blocked under `file://` in OBS's browser; a script tag is not. One file is easy to send to the Breton reviewer.
- Current Breton strings other than "Emvod meur dreistordinal" are drafts and are marked as such in a comment until approved.

### D5. Countdown targets come from the URL
`?start=HH:MM` (local time of the Mac). The page counts down to that time and holds at `00:00`. Changing the start time on the day means editing the source URL in OBS, not the file.

### D6. Debate camera swap = two OBS scenes
`Débat – salle` (S full, T inset) and `Débat – tribune` (T full, S inset), switched with the scene transition (fade).
- *Why*: a hotkey per scene is native OBS; a single scene with swapping sources would need a plugin or a script.
- The spec's "Débat scene in its two camera layouts" is these two scenes.

### D7. Audio moves to global audio devices
In Settings → Audio, `Mic/Auxiliary Audio` 1–3 become `Salle` (room device), `Salle (trad)` (same device again) and `Interprète`, with the same filters (compressor with sidechain on `Salle (trad)`, noise gate on `Interprète`) and the same track assignments as `relay/docs/obs.md`. The old per-scene audio sources are removed. USB camera microphones, if OBS creates audio for them, and all browser sources are set to no track.
- *Why*: global devices exist outside every scene, so no scene switch can drop them (spec: Audio unaffected by scene switches).
- *Alternative*: a nested `Audio` scene included in every scene. Works too, but one forgotten scene silently loses the interpreter; global devices cannot be forgotten.

### D8. Transitions: 300 ms fade; stinger only if time allows
The default scene transition is Fade 300 ms. Overlay toggles (rules strip, vote banner) use OBS's per-item show/hide transition (fade 300 ms).
- The branded sweep of the mock-up needs a WebM with alpha (or a "Move" transition setup). It is the first thing dropped if time is short; the spec only requires restrained motion.

### D9. Slides: capture the presentation display
Google Slides is presented full screen on the Mac's external display (the projector). OBS captures that display with macOS Screen Capture, cropped to the 16:9 slide area if the projector is not 16:9, and scaled to 1312×738.
- *Why*: presenting full screen is what the presenter's remote expects; capturing the display avoids depending on the browser window's title or size.
- *Alternative*: present in a window and use window capture. Kept as fallback if the projector resolution makes the display capture blurry.

### D10. Hotkeys
Bound in Settings → Hotkeys, with modifiers so they never collide with the slides keys:

| Hotkey | Action |
|---|---|
| ⌃⌥1 | Avant |
| ⌃⌥2 | Présentation |
| ⌃⌥3 | Débat – salle |
| ⌃⌥4 | Débat – tribune |
| ⌃⌥5 | Pause |
| ⌃⌥6 | Incident |
| ⌃⌥7 | Fin |
| ⌃⌥R | Show/hide rules strip (item in `Bandeau règles`) |
| ⌃⌥V | Show/hide vote banner |

OBS hotkeys work while another app has focus once OBS has the macOS Accessibility / Input Monitoring permission, which keeps Chrome free for the slides extension (spec: Keyboard operation). Studio Mode stays off: one key, one cut.

### D11. Fonts bundled
Danoise Diwan (Medium, Bold) comes from the design system. Myriad Pro Condensed and Formata are licensed and not on the Mac, so the charter's documented stand-in, Fira Sans Condensed (SIL OFL), is bundled as woff2 in `stream/fonts/` with its licence file. No font is loaded from Google Fonts at runtime.

## Risks / Trade-offs

- [Two USB cameras saturate one bus or do not both deliver 1080p30] → separate Mac ports, no shared hub; check both in OBS together (Stats: no skipped frames); fall back to 720p on the room camera (it is shown small half of the time).
- [Room camera too far for a passive USB cable (~5 m)] → active USB extension; test the real cable run before Saturday.
- [The Mac runs Chrome (Slides), OBS with two cameras and encoding at once] → hardware encoder (Apple VT) as in `obs.md`; watch OBS Stats during the rehearsal; close other apps.
- [Projector forces a 4:3 or 16:10 mode, so the display capture is letterboxed or soft] → crop in OBS; if blurry, present in a 1920×1080 window and use window capture (D9 alternative).
- [Breton texts not reviewed in time] → the review is scheduled first (task group 1) because it runs in parallel with the build; the AG title, the most visible text, is already approved, and every string lives in `texts.js` (D4), so late corrections are a one-file edit and a source refresh.
- [Countdown wrong if the Mac clock is wrong] → the Mac uses network time; check the clock in the pre-AG checklist.
- [Browser sources show stale content after editing files] → right-click → Refresh, or "Refresh cache of current page"; noted in the doc.

## Migration Plan

1. Build `stream/` and check each page in Chrome at 1920×1080, then with the network off.
2. Move audio to global devices (D7) and re-run the two-voices check of `obs.md` on the local test stack before building scenes.
3. Build the scenes in a new OBS scene collection `AG scènes`, keeping the previous collection untouched as rollback.
4. Export the collection to `stream/obs/` once it works.
- Rollback: switch back to the previous scene collection; the profiles and the relay are not touched.

## Open Questions

- The announced start time and the pause restart time: entered as `?start=` in the source URLs on the day, no code change.
- Final Breton wording of the rules and labels: replaces strings in `texts.js` only.
