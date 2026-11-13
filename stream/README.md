# Stream overlays

The overlays of the AG live stream, loaded in OBS as **Browser Sources** from
local files (`file://`). They need no network and no build step: plain HTML,
CSS and a few lines of JavaScript. The look follows the mock-up
(https://claude.ai/artifact/BE4o75AocwQSUQQ2UPaEEG), built on the Diwan design
system (https://claude.ai/artifact/DbGmkfimAgPWyLLxghRGVd).

The OBS side (scenes, sources, hotkeys) is documented in
[`relay/docs/obs.md`](../relay/docs/obs.md).

## Files

| File                 | Shown in                                     | What it is                                                                                                                                          |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `texts.js`           | every page                                   | **Every on-screen string**, Breton and French. Edit texts here only.                                                                                |
| `signature.html`     | every scene, via the nested scene `Habillage` | The signature logo, bottom-left, 260 px wide                                                                                                        |
| `avant.html`         | Avant                                        | Title, date and place, countdown, the five rules, the Diwan characters. Opaque white page.                                                           |
| `presentation.html`  | Présentation                                 | Blue ground with two transparent holes: slide at (48, 80) 1312×738, tribune camera at (1392, 80) 480×270. Put the slide capture and camera **below** it. |
| `rules-strip.html`   | nested scene `Bandeau règles` (Présentation, Débat) | The five rules in short form, bottom of the frame                                                                                              |
| `vote.html`          | Débat – salle, Débat – tribune                | The "Votadeg er sal" banner, above the rules strip                                                                                                  |
| `inset-frame.html`   | Débat – salle, Débat – tribune                | The white frame around the inset camera at (1424, 48) 448×252                                                                                       |
| `interlude.html`     | Pause, Incident, Fin                         | Blue page with a big title; countdown on Pause, "no need to reload" message on Incident. Opaque page, no camera.                                    |
| `img/mask-inset.png` | OBS filter on the inset camera               | Image mask (448×252) that cuts the inset camera's corners to the charter shape                                                                       |
| `tokens.css`         |                                              | Colours, type and radii, copied unmodified from the design system. Loads the Danoise Diwan fonts.                                                  |
| `base.css`           |                                              | Transparent page, 1920×1080 root, Fira Sans Condensed fonts, the entry animations                                                                  |
| `common.js`          |                                              | Fills the texts from `texts.js`; runs the countdowns                                                                                                |
| `fonts/`             |                                              | Danoise Diwan (charter font) and Fira Sans Condensed (stand-in for Myriad / Formata, SIL OFL, see `OFL.txt`)                                       |
| `img/`               |                                              | `diwan-signature.svg`, `diwan-bolomig.svg`: charter files, never edit them. `diwan-signature-screen.svg`: copy of the signature with its quarter-round in the screen accent `#f0b100` at full opacity (the charter draws it in Pantone 109 at 80 %), used by `signature.html` |

## URL parameters

Set in the Browser Source's **URL** field. A "Local file" source cannot carry
a query string, so for every overlay leave **Local file unticked** and type
the full `file://` URL instead, for example:

```
file:///Users/<you>/…/diffusion-ag/stream/avant.html?start=14:00
```

| Page             | Parameter                            | Meaning                                                                                       |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `avant.html`     | `?start=HH:MM`                       | Announced start time (Mac local time). The countdown stops at 00:00 and stays there.          |
| `interlude.html` | `?v=pause&start=HH:MM`               | Pause scene, countdown to the restart time                                                    |
| `interlude.html` | `?v=incident`                        | Technical problem scene                                                                       |
| `interlude.html` | `?v=fin`                             | End scene                                                                                     |

Without a valid `start`, the countdown shows `--:--`. More than an hour away, it
shows `H:MM:SS`.

### Change the pause restart time

1. In OBS, select the **Pause** scene, then double-click the `Pause` browser source.
2. In the URL, change the time after `start=`, for example
   `…/interlude.html?v=pause&start=15:45`.
3. Click **OK**. The page reloads with the new countdown.

The Avant start time works the same way (`avant.html?start=…` in the **Avant** scene).

## Edit a text

1. Open `stream/texts.js` in a text editor. Each text is a pair: `br` (Breton)
   and `fr` (French). The pages set the French line in italics below the Breton.
2. Change the string between the quotes and save. If the text contains an
   apostrophe `'`, keep the string between double quotes `"…"`, or use the
   typographic apostrophe `’`.
3. In OBS, right-click each Browser Source that shows the text → **Refresh**
   (for a shared source like the rules strip, once is enough: it is the same
   source in every scene).

Example, the title: in `texts.js`, change

```js
  title: {
    br: 'Emvod meur dreistordinal', // approved
    fr: 'Assemblée générale extraordinaire',
  },
```

then refresh the `Avant` and `Présentation` browser sources.

The rules strip is long: after changing a rule, check that the strip still ends
before the right edge (it currently ends at x ≈ 1620 of 1920).

## Check a page in Chrome

Open the file in Chrome (`File → Open File…`, then add `?start=…` to the URL)
and set the window to 1920×1080 (DevTools → device toolbar → Responsive,
1920 × 1080). Overlay pages have a transparent background, so Chrome shows them
on white. The JavaScript console shows an error if a text is missing from
`texts.js` or a URL parameter is wrong.

## Animations

Each element plays its entry animation once, when the page loads (at most 1 s
each). Afterwards only the countdowns and the slow float of the Diwan
characters move. To replay an entry animation in OBS, refresh the source, or
let OBS do it with "Refresh browser when scene becomes active" (see `obs.md`).
