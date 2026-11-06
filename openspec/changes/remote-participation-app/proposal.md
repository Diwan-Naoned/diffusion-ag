# Proposal

## Why

Members following the general assembly (AG) remotely need one place to watch it, choosing the original sound or the version with the Breton→French interpretation, and to take part without the YouTube chat, which will be disabled. Their interventions go to the Bureau (the 2–3 people leading the AG), who read the relevant ones aloud in the room. Members in the room also need an easy way to hear the interpreter on their phone. The approved mockup is the Design canvas "Maquette AG à distance" (boards *Participant·e*, *Bureau — connexion*, *Bureau — tableau de bord*).

## What Changes

- New web app (Node/TypeScript + SQLite), deployed on the existing Hetzner VPS with Dokploy, following the Diwan design system used in the mockup.
- **Responsive**: every screen, Bureau screens included, is mobile-friendly and touch-friendly, from small phones to desktops.
- **Languages**: the interface is available in French and Breton, chosen by each user independently of the stream they watch. Exports stay in French.
- **Live updates** over Server-Sent Events: the Bureau dashboard, authors' statuses, and the AG state (open, closed, ended, current limits) update within 2 seconds without reloading.
- **Access**: a per-AG access code. The link `?c=<code>` from the convocation email (or a QR code in the room) sets a cookie and redirects to a clean URL, with a fallback form to type the code. The Bureau has its own password. An internal endpoint lets the reverse proxy check access to the interpretation feed.
- **Watching**: an embedded YouTube player with a switch between "Son de la salle" (stream A) and "Avec traduction en français" (stream B), no chat.
- **Listening in the room**: a page that plays the interpreter-only feed over WebRTC.
- **Interventions**: participants submit a text with light formatting (bold, italic, bullet lists) under a self-declared name and optional school/structure, then follow its status in "Mes interventions". During the AG, the Bureau adjusts the character limit and the minimum delay between two proposals with sliders, depending on how much time is left for reading. The Bureau dashboard lists them live; each can be *queued*, *read*, or *rejected* (public message to the author required, private Bureau note optional); every transition is reversible and records who and when.
- **AG lifecycle**: preparation → in progress (submissions open/closed) → ended → exports (CSV, plus a printable page for PDF) → deletion scheduled 7 days after an explicit "copy saved" confirmation, cancellable at any time.
- Out of scope: remote voting (not allowed by the statutes), per-member identity, a YouTube-like chat.

## Capabilities

### New Capabilities

- `participant-access`: The AG access code (link, cookie, typed fallback, rate limiting), Bureau authentication, and the access check used by the reverse proxy for the interpretation feed.
- `stream-viewing`: Remote viewing with the choice between the two YouTube streams, and in-room listening to the interpretation feed.
- `interventions`: Submitting interventions, the author's view of their own interventions, the Bureau's moderation (queued / read / rejected with public and private reasons), and the Bureau's live regulation settings (character limit, minimum delay).
- `localization`: The French and Breton interface, the language choice and how it is remembered, and what stays untranslated.
- `responsive-interface`: How every screen adapts to phones, tablets and desktops: layout, touch targets, dialogs, on-screen keyboard and orientation.
- `assembly-lifecycle`: The AG's states, opening and closing submissions, exports for the minutes, and the cancellable scheduled deletion of its data.

### Modified Capabilities

None (no existing specs).

## Impact

- **New code**: the whole web app (server, pages, SQLite schema), plus its Dockerfile and Dokploy configuration.
- **Systems**: Dokploy/Traefik on the VPS (new app, persistent volume for SQLite); DNS record for the app's host.
- **Personal data**: participants' names and texts are stored until the AG data is deleted.
- **Depends on** the `streaming-relay` change for the WHEP feed under `/media/trad/whep` and the YouTube stream IDs; the app can be built and tested independently with placeholders.
