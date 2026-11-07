# Responsive check

Every screen task (code entry, participant page, listening page, Bureau login, dashboard,
reading view, reject dialog, AG settings) must pass this check before it is ticked. The print
export is excluded.

The layout is mobile-first (design D17): base CSS targets a 320 px phone, with two breakpoints
at 640 px and 1024 px. Shared rules live in `static/css/app.css`; `--touch-min: 44px` sizes every
button, chip, tab, selector option and slider thumb.

## Viewports

| Viewport   | Stands for                    |
| ---------- | ----------------------------- |
| 320 × 640  | smallest supported phone      |
| 360 × 800  | common Android phone          |
| 768 × 1024 | tablet, portrait              |
| 1280 × 800 | laptop                        |

Use the browser's device toolbar (Chrome: DevTools → Toggle device toolbar, "Responsive",
type the size). Check portrait and, for phones and the tablet, landscape too.

## What to check at each viewport

1. **No horizontal scroll.** The page never scrolls sideways; all content is reachable by
   scrolling down only.
2. **Touch targets.** Every interactive control is at least 44 × 44 px.
3. **No hover dependency.** Everything works by tapping; nothing appears only on hover.
4. **Readable text.** Body text is at least 16 px, without zooming.
5. **Dialogs** (reject, confirmations) fill the screen under 640 px; the **reading view** fills
   the screen under 1024 px, with its controls visible and only the text scrolling.
6. **Desktop (1280 px):** content uses a constrained width (max 1200 px) and matches the mockup.

## Automated part

Paste this in the browser console at each viewport. It reports horizontal overflow and
controls smaller than 44 × 44 px (visible ones only). Hover dependency and readability are
checked by eye.

```js
(() => {
  const issues = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth) issues.push(`horizontal scroll: ${doc.scrollWidth} > ${doc.clientWidth}`);
  const controls = document.querySelectorAll(
    'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])',
  );
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // hidden
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p, li');
    if (inline) continue; // links inside running text are exempt (WCAG 2.5.8 inline exception)
    if (r.width < 44 || r.height < 44)
      issues.push(`small target ${Math.round(r.width)}×${Math.round(r.height)}: ${el.outerHTML.slice(0, 80)}`);
  }
  const body = parseFloat(getComputedStyle(document.body).fontSize);
  if (body < 16) issues.push(`body text ${body}px < 16px`);
  console.log(issues.length ? issues.join('\n') : 'responsive check: OK');
  return issues;
})();
```

Links inside a sentence (for example "Retour au direct" under a form) are exempt from the
44 px rule, as WCAG allows for inline links; standalone links are not.
