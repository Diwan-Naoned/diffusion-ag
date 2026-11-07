# Implementation decisions

Decisions taken while building the app, where reality differed from the design or the design
left a choice open.

## YouTube embed and the referrer (design D9, task 6.2)

**Checked on 2026-11-07** in Chrome against `http://localhost:3100` with a public embeddable video
(`M7lc1UVf-VE`), through `https://www.youtube-nocookie.com/embed/<id>`.

- With `referrerpolicy="no-referrer"` on the iframe, YouTube refuses to play:
  **"Erreur de configuration du lecteur vidéo — Erreur 153"**. YouTube now requires a referrer
  to identify the embedding site.
- With the D9 fallback, `referrerpolicy="strict-origin"`, the video plays.

**Decision:** the iframe uses `referrerpolicy="strict-origin"` (constant `EMBED_REFERRER_POLICY` in
`src/web/participant.tsx`). YouTube receives only the origin (`https://<host>/`), never a path or
query string. By the time the participant page loads, the access code is no longer in the URL
(the `?c=` link redirects to the clean URL first, D3), so nothing secret can leak.

Every app response still sends `Referrer-Policy: no-referrer`; only the YouTube iframe request
overrides it. The spec scenario "Embedded YouTube player" is met in its intent (no Referer
containing the app's URL with a path or code), not with an empty Referer.

To re-check after a YouTube change: set `EMBED_REFERRER_POLICY` to `'no-referrer'`, rebuild,
open the participant page with a video ID set, and look for error 153 in the player.
