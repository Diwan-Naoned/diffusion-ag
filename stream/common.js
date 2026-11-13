// Small helpers shared by the overlays. Load after texts.js.

// Fill every element carrying data-text="key" (or "key.field") from TEXTS.
// "rules.0.brShort" is also accepted.
function fillTexts(root) {
  (root || document).querySelectorAll('[data-text]').forEach(function (el) {
    var value = el.getAttribute('data-text').split('.').reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, window.TEXTS);
    if (typeof value !== 'string') {
      console.error('texts.js: missing string', el.getAttribute('data-text'));
      return;
    }
    el.textContent = value;
  });
}

// Count down to ?start=HH:MM (local time of the Mac) and hold at 00:00
// (design D5). Writes MM:SS, or H:MM:SS when more than an hour is left.
// Without a valid ?start= the clock shows --:--.
function startCountdown(el) {
  var param = new URLSearchParams(location.search).get('start') || '';
  var m = /^(\d{1,2}):(\d{2})$/.exec(param);
  if (!m) {
    el.textContent = '--:--';
    console.error('countdown: add ?start=HH:MM to the URL');
    return;
  }
  var target = new Date();
  target.setHours(Number(m[1]), Number(m[2]), 0, 0);

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function tick() {
    var left = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    var h = Math.floor(left / 3600);
    var mm = Math.floor((left % 3600) / 60);
    var ss = left % 60;
    el.textContent = (h > 0 ? h + ':' + pad(mm) : pad(mm)) + ':' + pad(ss);
  }
  tick();
  setInterval(tick, 250);
}
