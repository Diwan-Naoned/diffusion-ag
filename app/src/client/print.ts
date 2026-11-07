// Print helpers: a "Print" button, and the print dialog on load for the export page (D12).
const button = document.querySelector<HTMLButtonElement>('[data-print]');
if (button) {
  button.hidden = false;
  button.addEventListener('click', () => window.print());
}
if (document.body.hasAttribute('data-autoprint')) {
  // Wait for fonts so the preview has the final layout.
  const go = () => window.setTimeout(() => window.print(), 300);
  if (document.fonts?.ready) document.fonts.ready.then(go, go);
  else window.addEventListener('load', go);
}
