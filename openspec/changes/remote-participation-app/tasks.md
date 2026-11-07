# Tasks

## 1. Project setup

- [x] 1.1 Scaffold `app/` (Node 22, TypeScript strict, Hono, better-sqlite3, esbuild for client modules, Vitest) with `npm run dev|build|test|start`, and verify `npm run build` and an empty `npm test` succeed
- [x] 1.2 Add the SQLite layer (connection with `secure_delete`, ordered SQL migrations applied at startup, D2 schema including `min_delay_seconds`, `max_chars` and `settings_events`) and verify with a test that a fresh database reaches the latest schema and that a second startup is a no-op
- [x] 1.3 Copy the Diwan assets (`tokens.css`, DANOISEDIWAN fonts) from the design canvas into `app/static/ds/diwan/`, self-host Fira Sans Condensed, create the mobile-first base layout (D17: header, viewport meta, breakpoints, `--touch-min`, `Referrer-Policy: no-referrer` header) and verify a page renders with the Diwan fonts and no request to Google; document in `app/docs/responsive.md` the **responsive check** used by every screen task below: at 320×640, 360×800, 768×1024 and 1280×800 there is no horizontal scroll, every control is at least 44×44 px, and nothing depends on hover

## 2. Localization (spec: localization)

- [x] 2.1 Implement the i18n layer (D16: `fr.ts` reference, `br.ts` as `Partial`, `t()` with French fallback, `Intl.PluralRules`/`DateTimeFormat` helpers) and verify with unit tests the fallback on a missing key and the Breton plural categories for 1, 2, 3, 9 and 20
- [x] 2.2 Implement language resolution (`lang` cookie, else `Accept-Language` containing `br`, else `fr`), `POST /lang`, `<html lang>`, and the FR | BR selector in the shared header (code entry page included); verify the resolution order and the redirect back with integration tests, and that the selector passes the responsive check (D17)
- [x] 2.3 Write `app/docs/i18n.md` describing how to add strings and the Breton review checklist (generated list of keys missing from or changed in `br.ts`, via `npm run i18n:check`), and verify the script lists a deliberately removed key

## 3. Live updates (D6)

- [x] 3.1 Implement the in-process event bus (publish after commit) and the SSE helper (snapshot on connect, `id` = AG version, fresh snapshot when `Last-Event-ID` is stale, `: ping` every 20 s, no-cache / `X-Accel-Buffering: no` headers) and verify with tests reading the stream from `app.request()`
- [x] 3.2 Implement the client SSE module (EventSource, snapshot/delta handling, visible "reconnexion…" state) and verify manually that cutting and restoring the network restores the state without a reload

## 4. Participant access (spec: participant-access)

- [x] 4.1 Implement code generation (D3 alphabet, 7 chars) and the signed `ag_access` cookie bound to `assembly_id|code_version`, and verify with unit tests that a code change invalidates old cookies
- [x] 4.2 Implement the `?c=` handling (cookie + 302 to the clean URL), the code entry page with typed fallback (case-insensitive, in both languages), and the 401 behavior for pages and API; verify each spec scenario with integration tests, and that the code entry page passes the responsive check (D17)
- [x] 4.3 Implement the per-IP rate limit for code attempts with trusted-proxy IP resolution, and verify that the 11th failure in 10 minutes is refused
- [x] 4.4 Implement the `device` cookie, issued on first authorized access, and verify it persists across requests
- [x] 4.5 Implement the Bureau login (password from env + display name, signed 12 h `bureau` cookie) and the Bureau guard, and verify a participant cookie cannot reach Bureau routes, and that the login page passes the responsive check (D17)
- [x] 4.6 Implement `GET /auth/media` (D10) and verify 200 with a participant or Bureau cookie on an active AG, and 401 otherwise

## 5. AG lifecycle core (spec: assembly-lifecycle)

- [x] 5.1 Implement the AG state machine (create, open, close/reopen submissions, end, reopen if no deletion scheduled, single active AG) as pure functions plus routes publishing state changes on the event bus, and verify every transition and refusal with tests, including the SSE event emitted for each
- [ ] 5.2 Build the Bureau AG settings page (D11: name/date, YouTube IDs, code regenerate, link copy, QR SVG + print view, state buttons) and verify manually that the QR code opens the participant link on a phone and pass the responsive check (D17)

## 6. Stream viewing (spec: stream-viewing)

- [x] 6.1 Build the participant page layout from mockup board 1 (header, stream switch, YouTube embed via nocookie, explanatory texts, no-chat notice, "not started" placeholder) and verify the switch loads the right video ID, is restored after a reload, and is unchanged by a language switch (and vice versa); verify the phone order (player, form, my interventions), that rotating keeps the stream and draft, and pass the responsive check (D17)
- [x] 6.2 Verify the embed works with `referrerpolicy="no-referrer"`; apply the D9 fallback if YouTube refuses it, and record the result in `app/docs/decisions.md`
- [x] 6.3 Build the `/salle` listening page with the minimal WHEP client, state display, reconnection with backoff, wake lock and guidance text; verify it against a local MediaMTX `trad` path (Wi-Fi drop simulated by disabling the network) and that it shows the "not broadcast" state when the path is offline and pass the responsive check (D17)

## 7. Interventions (spec: interventions)

- [x] 7.1 Implement `renderIntervention()` (escape-first; bold, italic, lists) and verify with unit tests, including HTML/script injection and unbalanced markers
- [x] 7.2 Implement `POST /api/interventions` (field limits with the AG's current `max_chars`, submissions-open check, Bureau minimum delay per device returning the next allowed time, fixed per-IP ceiling of 30 / 10 min) and verify every submission scenario with integration tests, including delay 0 and the ceiling
- [x] 7.3 Implement the participant SSE stream (D6: AG state, current limits, next allowed submission time, own interventions only, public message only) and verify with tests that it never includes `private_note` or another device's items
- [ ] 7.4 Build the participant form (formatting toolbar inserting markers, live character counter against the current limit, countdown until the next allowed submission, draft kept in `localStorage`) and the "Mes interventions" list driven by SSE; verify manually that a Bureau status change shows within 2 s and that a lowered limit keeps an over-long draft but disables sending; verify on a real phone that the counter, countdown and send button stay reachable with the on-screen keyboard open, and pass the responsive check (D17)
- [x] 7.5 Implement the Bureau moderation API (mark read, reject with required public message + optional private note, put back in queue; every change logged in `intervention_events` with name and time, published on the event bus) and verify transitions and the event log with tests
- [x] 7.6 Implement the regulation settings API (minimum delay 0–600 s in 30 s steps, character limit 100–2000 in steps of 50, validated on the server, logged in `settings_events`, broadcast over SSE) and verify range validation and logging with tests
- [ ] 7.7 Build the Bureau dashboard from mockup board 3 (tabs with counts, oldest first, reading modal with text size and previous/next, reject dialog with the fixed French quick-pick chips, Régulation panel with the two sliders, Bureau SSE stream) and verify with two browsers that an action in one shows in the other within 2 s, and that moving a slider updates an open participant form within 2 s; verify on a phone and a tablet that the reading view fills the screen with its controls visible, the reject dialog is a full-screen sheet with wrapping chips, the sliders work by touch, and pass the responsive check (D17)

## 8. Exports and deletion (spec: assembly-lifecycle)

- [x] 8.1 Implement the CSV export (always French headers, BOM, `;`, RFC 4180 quoting, all columns including private note) and verify with a test that accents and multi-line texts round-trip and that headers are French when the request's language is `br`, and manually that it opens correctly in a spreadsheet
- [x] 8.2 Implement the printable export page (always French, no private notes, formatted texts, print CSS, auto `window.print()`) and verify manually from a Breton interface that the saved PDF is in French, has no controls and no intervention split across pages when it fits
- [x] 8.3 Record export openings, implement "J'ai bien enregistré l'export", "Supprimer dans 7 jours" and cancel, plus the deletion banner on Bureau pages; verify with tests that deletion can't be scheduled before an export was opened and confirmed
- [x] 8.4 Implement the deletion job (startup + every minute, D13 transaction, VACUUM) and verify with tests using a fake clock: nothing deleted before the deadline, deleted after it, carried out at startup when overdue, cancelled deletions never run, and old cookies rejected afterwards
- [x] 8.5 Implement the participant "AG terminée" state (form hidden, own interventions still listed, pushed live over SSE) and verify with a test

## 9. Packaging and deployment

- [x] 9.1 Write the multi-stage `app/Dockerfile` and verify the image starts and serves the code page with a mounted `/data` volume
- [ ] 9.2 Deploy to Dokploy (host, env vars, `/data` volume excluded from backups or with short retention) and verify the app over HTTPS with a test AG
- [ ] 9.3 Verify SSE through the real Traefik: events reach the browser immediately (no buffering), the connection is served over HTTP/2, and an idle stream stays open more than 10 minutes on Wi-Fi and on 4G/5G
- [ ] 9.4 Write `app/docs/bureau-guide.md` (preparing an AG, during the AG including the Régulation sliders, after the AG: export, confirm, delete) and verify a Bureau member can follow it on the test AG

## 10. Integration checks

- [ ] 10.1 Have a Breton speaker of the association review every string in `br.ts` using the `docs/i18n.md` checklist, and verify `npm run i18n:check` reports no missing key
- [ ] 10.2 With the `streaming-relay` stack deployed, verify `/salle` plays the interpretation with a participant cookie, and that `/media/trad/whep` returns 401 without one
- [ ] 10.3 Full rehearsal with a test AG, Bureau and participants on phones and laptops in both languages: submit, read (with one Bureau member reading from a phone or tablet), reject, put back, move both sliders, close submissions, end, export CSV and PDF, confirm, schedule deletion, redeploy the app mid-rehearsal (data must survive), cancel and reschedule deletion; verify every step behaves as specified
