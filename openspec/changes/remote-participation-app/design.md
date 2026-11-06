# Design

## Context

See proposal.md for motivation and the specs for the required behavior. Constraints:

- Greenfield: the repository has no code yet. The reference UI is the Design canvas "Maquette AG à distance" (`https://claude.ai/artifact/UMKyfrEwnhRmynwhQVqYD5`), which uses the Diwan design system (`tokens.css`, DANOISEDIWAN display font, Fira Sans Condensed body).
- Deployed on the existing Hetzner VPS with Dokploy (Traefik in front). A single instance; low traffic (one AG a year, at most a few hundred participants).
- The `streaming-relay` change serves the interpretation feed at `/media/trad/whep` on the same host, gated by Traefik ForwardAuth calling this app.
- Operated by volunteers: few moving parts, nothing to babysit between AGs.

```
 browser ---HTTPS---> Traefik --+--> app (Node/Hono, :3000) ---- SQLite (/data/ag.db, volume)
                                |        ^
                                |        | ForwardAuth GET /auth/media (internal)
                                '--/media/trad/whep*--> MediaMTX (streaming-relay)
```

## Goals / Non-Goals

**Goals:**
- One small container with no external services (no Redis, no Postgres, no mail).
- Pages usable on phones, matching the mockup.
- Live updates within 2 s that survive flaky venue Wi-Fi.
- French and Breton interface on every page.

**Non-Goals:**
- Translating user content or exports (exports are in French only for now).
- Multiple concurrent AGs, multi-tenant use, Bureau user accounts.
- Email sending (the convocation is sent by the association's usual tools, with the link).
- Offline support / PWA.

## Decisions

### D1. Stack: Node 22 + TypeScript, Hono, better-sqlite3, server-rendered pages
- **Hono** for routing and JSX server rendering. It's small, has typed handlers, and supports in-process testing (`app.request`).
- **better-sqlite3**: synchronous, fast, a single file on a Docker volume. Migrations are plain SQL files applied at startup in order.
- **Pages** are rendered on the server with Hono JSX. Interactivity (stream switch, SSE subscriptions, forms, modals, WHEP player) is small vanilla TypeScript modules bundled with esbuild. No SPA framework.
- *Alternatives*: Fastify (equivalent; Hono is lighter for JSX), Postgres (an extra service to run for a few hundred rows), React SPA (more build and state than this needs).

### D2. Data model
```
assemblies(id, name, date, state[preparation|in_progress|ended|deletion_scheduled|deleted],
           submissions_open, code, code_version, youtube_a_id, youtube_b_id,
           min_delay_seconds (default 60), max_chars (default 1000),
           export_opened_at, export_confirmed_at, export_confirmed_by,
           deletion_at, version)
interventions(id, assembly_id, device_id, name, school, text,
              status[queued|read|rejected], status_at, status_by,
              public_message, private_note, created_at)
intervention_events(id, intervention_id, from_status, to_status, by, at,
                    public_message, private_note)
settings_events(id, assembly_id, setting, old_value, new_value, by, at)
```
- `assemblies.version` is incremented on every write affecting the AG, its settings or its interventions, and is used as the SSE event id (D6).
- A device's last submission time is derived from `MAX(interventions.created_at) WHERE device_id = ?` (indexed); no separate table.
- `text` is stored raw (the user's markdown-like input); rendering happens at display time.

### D3. Participant access: signed cookie bound to AG + code version
- The `ag_access` cookie holds `HMAC(SESSION_SECRET, assembly_id|code_version)` plus those two values. Changing the code or deleting the AG increments `code_version`, which invalidates every existing cookie without a session table.
- Code alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, 7 characters. Comparison is case-insensitive.
- Middleware order: rate limit → `?c=` handling (set cookie, 302 to the clean path) → cookie check → participant routes. Unauthenticated page requests render the code page with 401; API requests return 401 JSON.
- The cookie lasts 48 h (Max-Age) and is also bounded by the AG state checks.

### D4. Device identity for "Mes interventions" and rate limits
A separate `device` cookie (random 128-bit, HttpOnly, 1 year) is issued at first access. Interventions store `device_id`. `GET /api/mine` filters on it. A participant who clears their cookies loses their list, which is accepted (spec: another device).

### D5. Bureau authentication
- One Bureau password from the `BUREAU_PASSWORD` env var, changed in Dokploy before each AG (the mockup's "changé à chaque assemblée").
- The login asks for the password and a display name. The session is a signed `bureau` cookie (name + expiry, 12 h).
- The display name is what's recorded as `status_by` and in the event log. It's self-declared, which fits the trust level of 2–3 people sitting together.
- *Alternative*: per-member accounts. Rejected: account management for 3 people once a year.

### D6. Live updates with Server-Sent Events
- **Two streams.** `GET /api/events` for participants, and `GET /bureau/api/events` for the Bureau.
  - Participant stream: AG state, `submissions_open`, current `max_chars`/`min_delay_seconds`, the device's next allowed submission time, and changes to the device's own interventions (with no `private_note`).
  - Bureau stream: every intervention change, settings change and AG state change, including the deletion banner.
- **Snapshot then deltas.** On connect the server sends a `snapshot` event with the full state for that client, then `delta` events.
  - Each event's `id` is the AG `version`.
  - On reconnect, `EventSource` sends `Last-Event-ID`. If it differs from the current version, the server sends a fresh snapshot instead of replaying history. The data is small, so this keeps the server stateless.
- **Event bus.** Writes publish to an in-process event bus (`EventEmitter`) after their transaction commits, and each open stream filters what it forwards. One instance means no broker is needed.
- **Keep-alive.** A `: ping` comment every 20 s, so mobile carriers, NAT and Traefik don't drop idle connections.
- **Headers.** `Cache-Control: no-cache`, `X-Accel-Buffering: no`, no compression on `text/event-stream`.
- **Transport.** Traefik serves HTTP/2 to browsers, so the event stream is multiplexed on the same connection as the page and its API calls (no 6-connections-per-host limit). Traefik talks to the app over HTTP/1.1, which is fine.
- **Writes stay plain HTTP.** Submit and moderate are `POST` requests. Their effects arrive to every client, the author included, through the event streams.
- **Load.** At most ~100 concurrent users means ~100 idle long-lived responses, which is negligible for Node.
- *Alternatives*:
  - Polling: rejected. Higher latency, constant requests, and SSE's automatic reconnection plus the snapshot gives the same robustness.
  - WebSocket: rejected. The traffic is server-to-client only, and WebSocket would need its own reconnect logic and proxy configuration.

### D7. Formatting: tiny escape-first renderer, shared by server and client
One pure function `renderIntervention(text) -> safe HTML` escapes everything first, then applies `**bold**`, `*italic*` and `- ` list lines (the grammar from the mockup's `parse()`). It's used by the server for all rendering, including the print page. API responses carry `html` produced on the server. No markdown library, so no HTML passes through.

### D8. Submission regulation and rate limiting
- **Bureau-controlled delay.** A submission is refused if `now < last_submission(device) + min_delay_seconds`. The check uses the database (D2), so it survives restarts. The refusal returns the next allowed time, and the form shows a countdown from it.
- **Bureau-controlled length.** `max_chars` is checked on the server at submission time. The form receives the current value over SSE and updates its counter. A draft over the new limit stays in the textarea, but the send button is disabled.
- **Fixed backstops, in memory.** A fixed-window counter in a `Map`:
  - per client IP for code attempts (10 failures / 10 min);
  - per client IP for submissions (30 / 10 min), against bots that drop their device cookie. This is generous on purpose, because many venue Wi-Fi users share one IP.
  - One instance makes in-memory correct, and a restart resetting these counters is acceptable.
- **Client IP.** Taken from `X-Forwarded-For` only when the request comes from the Traefik network (`TRUSTED_PROXY_CIDR`).

### D9. Stream viewing
- YouTube via `https://www.youtube-nocookie.com/embed/<id>`. Switching streams replaces the iframe `src`. The choice is stored in `localStorage` (wrapped in try/catch). It's a separate setting from the interface language (the `lang` cookie, D16), and neither control touches the other.
- `Referrer-Policy: no-referrer` is a global response header. The iframe also gets `referrerpolicy="no-referrer"`, assuming the embed works without a referrer. If YouTube refuses it, fall back to `strict-origin`, since by then the code is no longer in the URL (D3 redirect).
- The `/salle` listening page has its own minimal WHEP client: a recvonly audio `RTCPeerConnection`, non-trickle (wait for ICE gathering, then one `POST` with the SDP offer to `/media/trad/whep`), with the session URL from `Location` deleted on stop. Reconnection uses backoff on `connectionstatechange` failure (1 s → 10 s), with the visible states *Prêt / Connexion… / En écoute / Reconnexion… / Interprétation non diffusée*.
- The Media Session API sets a title; a wake lock (`navigator.wakeLock`) is requested while listening where supported, to help with screen locking.

### D10. ForwardAuth endpoint
`GET /auth/media` reads the original cookies forwarded by Traefik and returns 200 for a valid `ag_access` or `bureau` cookie of an AG that is *in_progress* or *ended*, and 401 otherwise. It returns no body and does no side effects, so being reachable from outside is harmless.

### D11. Bureau screens
- **Dashboard** (mockup board 3):
  - tabs *À lire / Lues / Non retenues / Toutes*, counters, reading modal with text size and previous/next;
  - a reject dialog: required public message with chips *Déjà posée*, *Hors sujet*, *Sera traitée plus tard*, *Hors du cadre de l'AG*, plus an optional private note. The chips are fixed French text, inserted as text and never translated;
  - a "Remettre en file" action;
  - a compact **Régulation** panel with two sliders (minimum delay 0–10 min in 30 s steps, character limit 100–2000 in steps of 50). Each slider shows its current value. A change is saved when the slider is released, logged in `settings_events`, and broadcast over SSE.
- **AG settings** (new, not in the mockup; same visual language):
  - create the AG (name, date);
  - YouTube IDs A/B;
  - access code with regenerate, participant link with copy, QR code as SVG (`qrcode` npm package) with a print view;
  - state buttons (open / close and reopen submissions / end / reopen);
  - exports;
  - export confirmation and deletion scheduling/cancellation.
- When a deletion is scheduled, a banner shows its date on every Bureau page.

### D12. Exports
- Both exports are always in French, whatever the exporting member's interface language. They use the `fr` dictionary directly, not the request's language.
- CSV: `text/csv; charset=utf-8` with a BOM (so Excel shows accents), RFC 4180 quoting, `;` separator (French Excel default), filename `ag-<date>-interventions.csv`.
- Print page `/bureau/export/print`: server-rendered with `@media print` rules (`@page` margins, `break-inside: avoid` per intervention, controls hidden) and `window.print()` on load.
- Opening either export sets `export_opened_at`, which unlocks the "J'ai bien enregistré l'export" confirmation.

### D13. Deletion job
- At startup and then every minute, the job deletes AGs with `state = deletion_scheduled AND deletion_at <= now`, in one transaction: delete events and interventions, null out the code and YouTube IDs, increment `code_version`, set state to `deleted`.
- `PRAGMA secure_delete = ON` is set at connection open. After a deletion the job runs `VACUUM`, so freed pages don't keep the old text.

### D14. Packaging and deployment
- Multi-stage Dockerfile (build with esbuild/tsc, run on `node:22-slim`). The SQLite file lives at `/data/ag.db` on a Dokploy volume.
- Env vars: `PUBLIC_URL`, `SESSION_SECRET`, `BUREAU_PASSWORD`, `TRUSTED_PROXY_CIDR`.
- Diwan assets (`tokens.css`, DANOISEDIWAN fonts) are copied from the design canvas into `app/static/ds/diwan/`. Fira Sans Condensed is self-hosted rather than loaded from Google Fonts, to avoid sending a referrer/IP to Google from a members-only app.

### D16. Localization (French / Breton)
- **Dictionaries.** `app/src/i18n/fr.ts` is the reference dictionary. `br.ts` is typed as `Partial<typeof fr>`, so the compiler lists missing keys without blocking the build. Lookups go through `t(lang, key, params)`, which falls back to `fr` when a key is missing.
  - No i18n library: two languages and a few hundred strings don't justify one.
- **Choosing the language.** It comes from the `lang` cookie (`fr` | `br`, 1 year). With no cookie, it's `br` if `Accept-Language` contains `br`, otherwise `fr`.
  - The FR | BR selector is in the shared header layout, the code entry page included.
  - Selecting a language is a `POST /lang` that sets the cookie and redirects back to the same page. The page keeps no other state, since stream choice and drafts live in `localStorage`.
  - Before switching, the client saves any draft in progress to `localStorage`, so a reload doesn't lose it.
- **Rendering.** Pages are rendered on the server in the chosen language, with `<html lang="fr|br">`.
  - Client modules get only the strings they need, embedded in the page as JSON. They never fetch dictionaries.
  - SSE payloads carry data, not text, and the client formats it with the embedded strings.
- **Plurals, dates and times.** `Intl.PluralRules(lang)` handles counts, since Breton has *one/two/few/many/other* categories. `Intl.DateTimeFormat(lang)` handles times. Node 22 and modern browsers ship full ICU data for `br`.
- **Not localized:** user content, rejection chips (fixed French text), and exports (always French, D12).
- **Breton strings.** A first draft may be produced during implementation. It must be reviewed and corrected by a Breton speaker of the association before the AG, with a `docs/i18n.md` checklist listing every key.

### D17. Responsive, mobile-first layout
- **Mobile-first CSS** built on the Diwan tokens: flex and grid with `gap`, fluid widths, `rem` sizes, and `max-width` containers on desktop. Two breakpoints: ~640 px (single column becomes two columns where the mockup has them) and ~1024 px (desktop spacing). No CSS framework.
- **Touch targets.** A shared `--touch-min: 44px` used by every button, chip, tab, selector option and slider thumb. Range inputs get custom thumb and track styles sized for touch. No hover-only affordances; `:focus-visible` styles are kept.
- **Reading view.** A fixed full-screen layer on screens under 1024 px, sized with `100dvh` so mobile toolbars don't cut it off. A header and footer hold the controls, and the text scrolls between them.
- **Dialogs.** Native `<dialog>`, shown as a centered modal on desktop and as a full-screen sheet under 640 px.
- **On-screen keyboard.** The form's counter, countdown and send button sit directly under the textarea, not in a fixed footer. `scrollIntoView` on focus keeps them visible above the keyboard.
- **Viewport.** `<meta name="viewport" content="width=device-width, initial-scale=1">`, with no zoom blocking.
- **YouTube player.** A wrapper with `aspect-ratio: 16/9; width: 100%`.
- **Rotation.** Rotating never re-renders the page or reloads the iframe, since layout is pure CSS. The draft, stream choice and scroll position are untouched.
- **Reference viewports for checks:** 320×640 (minimum), 360×800, 768×1024 and 1280×800.

### D15. Tests
Vitest. Unit tests for the renderer, code generation, CSV, the state machine, the i18n fallback and plurals. Tests for the SSE endpoints read the stream from `app.request()`. Integration tests through `app.request()` against a temporary SQLite file for every spec scenario that is server-observable. A few browser checks are done manually (print layout, WHEP on phones) and listed in tasks.

## Risks / Trade-offs

- [Dokploy volume backups keep a copy of the database after deletion] → document in the runbook that AG data lives in `/data`, and exclude that volume from backups or set backup retention under 7 days.
- [The access code leaks (convocation forwarded)] → accepted by design; the Bureau can regenerate the code (and send a new link) if abuse starts, and moderation filters the rest.
- [Self-declared Bureau display names] → accepted (2–3 trusted people); the password is rotated per AG.
- [Traefik or a mobile carrier buffers or cuts SSE responses] → keep-alive comments, no compression, `X-Accel-Buffering: no`; verified through the real Dokploy/Traefik stack (task 8.x). `EventSource` reconnects automatically and the snapshot restores state.
- [A device clears its cookies to get around the Bureau's delay] → accepted; the fixed per-IP ceiling stops automated abuse, and moderation handles the rest.
- [Breton strings are inaccurate or incomplete on the day] → French fallback per key; the native-speaker review is a tracked task before the rehearsal.
- [YouTube embed refuses `no-referrer`] → fallback in D9.
- [iOS stops WebRTC audio in the background] → wake lock + guidance text (spec); real behavior comes from the `streaming-relay` spike 1.3.
- [Losing the SQLite data during the AG (misconfigured volume)] → the rehearsal includes redeploying the app mid-test and checking that interventions are still there.

## Migration Plan

New deployment, nothing to migrate. Deploy to Dokploy on a host such as `ag.<domain>`. Rehearse with a test AG, then delete it through the normal deletion flow (which also tests it). Rollback: stop the app. Remote participants can still watch the YouTube links directly, but interventions are unavailable.

## Open Questions

- Final hostname, and whether the YouTube events are on one channel or two. These only change configuration values.
- Exact wording of the rejection quick-pick chips: hard-coded, easy to adjust after a Bureau review.
