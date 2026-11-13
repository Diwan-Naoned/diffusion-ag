# Tasks

## 1. Texts and Breton review (start first, runs in parallel)

- [x] 1.1 Write `stream/texts.js` (D4) with every on-screen string: title, date and place, the five rules (long and short forms), countdown labels, vote banner, Pause / Incident / Fin; mark the draft Breton strings in a comment; verify every string shown in the mock-up has an entry and that a page including the script shows `window.TEXTS` in the Chrome console without error
- [ ] 1.2 Send the Breton strings to a Breton speaker of the association, apply their corrections in `texts.js` and remove the draft markers; verify the reviewer has approved the final list (spec: Assembly rules)

## 2. Assets

- [x] 2.1 Create `stream/` with `tokens.css` copied from the Diwan design system, `fonts/` (Danoise Diwan Medium and Bold from the design system, Fira Sans Condensed 300/400/700/900 and italic 400 as woff2 with `OFL.txt`) and `img/` (`diwan-signature.svg`, `diwan-bolomig.svg` unmodified from the design system); verify a scratch page using the fonts renders Danoise and Fira in Chrome with Wi-Fi off (DevTools Network panel shows no external request)
- [x] 2.2 Write `stream/base.css` (transparent `html, body`, 1920×1080 root, the entry keyframes `grow`, `rule`, `rise`, `fade`, and the slow `float`, all ≤ 1 s except `float`); verify by loading it in a scratch page that the background is transparent in OBS (a Browser Source over a colour source shows the colour)

## 3. Overlays

Each overlay is checked in Chrome at 1920×1080 side by side with the mock-up artboard, then once more with Wi-Fi off.

- [x] 3.1 Write `stream/signature.html` (logo bottom-left, 260 px wide, grows from the corner on load); verify it matches the mock-up corner and the logo is not distorted (spec: Diwan identity)
- [x] 3.2 Write `stream/avant.html` (title, date and place, countdown to `?start=HH:MM` holding at 00:00, the five rules appearing in sequence, blue panel with the Diwan characters); verify with `?start=` set one minute ahead that the countdown reaches 00:00 and stays, and that all five rules are visible (spec: Waiting scene)
- [x] 3.3 Write `stream/presentation.html` (blue background with transparent holes for the slide at (48, 80, 1312×738) and the camera at (1392, 80, 480×270), title block bottom-aligned with the slide, camera frame mask with the two rounded corners); verify against the mock-up and that nothing in it animates after 1 s (spec: Restrained motion)
- [x] 3.4 Write `stream/rules-strip.html` (five numbered rules in short form, left 288 px, bottom 48 px); verify it does not overlap the signature at 260 px and fits within the canvas with the longest strings from `texts.js` (spec: Rules strip)
- [x] 3.5 Write `stream/vote.html` (banner above the strip, bottom 184 px); verify the text matches the spec scenario "Vote in progress"
- [x] 3.6 Write `stream/interlude.html` (`?v=pause|incident|fin`, countdown with `&start=` for pause, Diwan characters); verify the three variants against the mock-up, including the "no need to reload" message on incident (spec: Interlude scenes)
- [x] 3.7 Write `stream/README.md` (what each file is, URL parameters, how to edit `texts.js` and refresh a Browser Source); verify a reader can change the pause time and the title by following it

## 4. OBS on the Mac

- [x] 4.1 Move the three audio sources to global Mic/Aux devices with the same filters and tracks (D7); verify with two test voices on the local test stack (`relay/test/stack.sh`) that YouTube A = room only, B = both, `media/trad` = interpreter only, as in `relay/docs/obs.md`
- [x] 4.2 Plug both USB cameras into separate Mac ports (active extension for the room camera if its cable run exceeds ~5 m) and add them as Video Capture Devices at 1080p30; verify both run together for 10 minutes with no skipped frames in OBS Stats, and that no camera microphone feeds any track
- [x] 4.3 Add the slides capture (macOS Screen Capture of the presentation display, cropped to 16:9, D9) while Google Slides is presented full screen and driven from the tablet extension; verify a 24 pt slide is readable in a 1080p local recording (spec: Presentation scene)
- [x] 4.4 Create the scene collection `AG scènes` with the nested scenes `Habillage` (signature) and `Bandeau règles` (rules strip), and the scenes Avant, Présentation, Débat – salle, Débat – tribune, Pause, Incident, Fin with the geometry of D3 and the browser source refresh settings of D2; verify each scene against its mock-up artboard and that switching Présentation → Débat leaves the strip and logo still (spec: Rules strip)
- [x] 4.5 Set the Fade 300 ms scene transition, the fade show/hide transitions on the strip and vote banner, and the hotkeys of D10, and grant OBS the macOS Accessibility / Input Monitoring permission; verify every hotkey works while Chrome presents the slides and that the tablet still advances slides after each hotkey (spec: Keyboard operation)
- [ ] 4.6 Verify on a local recording that switching scenes while the interpreter speaks leaves no gap on tracks 2 and 3 (spec: Audio unaffected by scene switches), and that all scenes render with the Mac's Wi-Fi off after a refresh of every Browser Source (spec: Works offline)
- [ ] 4.7 Export the scene collection to `stream/obs/AG-scenes.json` and document the setup in `relay/docs/obs.md` (scene collection, global audio devices replacing the per-scene sources, Browser Source settings, hotkey table, absolute paths to fix after import); verify the doc matches the exported collection
- [ ] 4.8 Add the scene checks to the pre-AG checklist in `relay/docs/runbook.md` (both cameras live, slides capture sharp, `?start=` times set, Mac clock correct, strip and vote toggles, hotkeys respond); verify the checklist can be run in under 10 minutes

## 5. Integration

- [ ] 5.1 Rehearsal on the Mac with the real cameras, the slides on the projector (or a second screen) and a stream to the YouTube events through the relay: run Avant → Présentation → Débat (both layouts, vote banner on and off) → Pause → Débat → Fin, with an interruption to Incident; verify on a second device that every scene looks like the mock-up on YouTube at 1080p and that both YouTube streams show the same picture with their own audio
- [ ] 5.2 (Optional, only if time remains) Render the branded sweep transition as a WebM with alpha and set it as a stinger (D8); verify it lasts ≤ 1.2 s and cuts on the fully covered frame

## Workflow follow-up

- After the AG, archive this change once the rehearsal and the day itself are signed off.
