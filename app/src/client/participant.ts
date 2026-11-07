/**
 * Participant page (mockup board 1): stream switch, intervention form with live limits and
 * countdown, "Mes interventions" driven by SSE.
 *
 * Kept on the device (localStorage): the stream choice and the form draft. The interface
 * language is a separate cookie (D16); neither setting touches the other.
 */
import type { ParticipantDelta, ParticipantSnapshot, PublicAssembly, PublicIntervention } from '../domain/views.ts';
import { formatTime, type Lang } from '../i18n/core.ts';
import type { ParticipantData } from '../views/participant.tsx';
import { formatCountdown } from './_format.ts';
import { connectLive } from './_live.ts';
import { $, $$, beforeLanguageSwitch, fromTrustedHtml, h, pageData, postJson, storage, translatorFrom } from './_page.ts';

const data = pageData<ParticipantData>();
const lang = data.lang as Lang;
const tr = translatorFrom(lang, data.strings);

const STREAM_KEY = 'ag.stream';
const DRAFT_KEY = 'ag.draft';

const state = {
  assembly: data.assembly,
  mine: new Map<number, PublicIntervention>(data.mine.map((i) => [i.id, i])),
  nextAllowedAt: data.nextAllowedAt,
  /** server clock − device clock, so countdowns don't depend on the device's time. */
  offset: data.serverNow - Date.now(),
  sending: false,
};

const serverNow = () => Date.now() + state.offset;
const charCount = (text: string) => [...text].length;
const ended = (ag: PublicAssembly) => ag.state === 'ended' || ag.state === 'deletion_scheduled' || ag.state === 'deleted';

// ---------- Stream switch and player (D9) ----------

type Stream = 'a' | 'b';
let stream: Stream = storage.get(STREAM_KEY) === 'b' ? 'b' : 'a';
let playerId: string | null | undefined; // undefined: nothing rendered yet

function videoId(): string | null {
  return stream === 'a' ? state.assembly.youtubeAId : state.assembly.youtubeBId;
}

function renderPlayer() {
  const id = videoId();
  if (id === playerId) return; // never reload the iframe needlessly (rotation, unrelated updates)
  playerId = id;
  const player = $('[data-player]');
  const placeholder = $('[data-player-placeholder]');
  player.querySelector('iframe')?.remove();
  placeholder.hidden = id !== null;
  if (id === null) return;
  const label = tr.t(stream === 'a' ? 'stream.a.label' : 'stream.b.label');
  const iframe = h('iframe', {
    // autoplay=1: starts with sound where the browser allows it (it does after a click, e.g. a
    // stream switch); otherwise YouTube shows its play button. Not muted on purpose: a silent
    // start would look broken to a remote participant.
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`,
    title: tr.t('stream.playerTitle', { stream: label }),
    referrerpolicy: data.embedReferrerPolicy,
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
    allowfullscreen: true,
    loading: 'lazy',
  });
  player.append(iframe);
}

function renderStream() {
  for (const b of $$<HTMLButtonElement>('[data-stream]')) b.setAttribute('aria-pressed', String(b.dataset.stream === stream));
  for (const p of $$('[data-explain]')) p.hidden = p.dataset.explain !== stream;
  renderPlayer();
}

for (const b of $$<HTMLButtonElement>('[data-stream]')) {
  b.addEventListener('click', () => {
    stream = b.dataset.stream === 'b' ? 'b' : 'a';
    storage.set(STREAM_KEY, stream);
    renderStream();
  });
}

// ---------- Form ----------

const form = $<HTMLFormElement>('[data-form]');
const nameInput = $<HTMLInputElement>('#f-name');
const schoolInput = $<HTMLInputElement>('#f-school');
const textInput = $<HTMLTextAreaElement>('#f-text');
const sendButton = $<HTMLButtonElement>('[data-send]');
const formError = $('[data-form-error]');
const sentMessage = $('[data-sent]');

function saveDraft() {
  storage.set(DRAFT_KEY, JSON.stringify({ name: nameInput.value, school: schoolInput.value, text: textInput.value }));
}

function restoreDraft() {
  try {
    const draft = JSON.parse(storage.get(DRAFT_KEY) ?? '{}') as { name?: string; school?: string; text?: string };
    nameInput.value = draft.name ?? '';
    schoolInput.value = draft.school ?? '';
    textInput.value = draft.text ?? '';
  } catch {
    // ignore a broken draft
  }
}

function waitingMs(): number {
  return state.nextAllowedAt - serverNow();
}

/** Why sending is not possible right now, or null. */
function blockedReason(): string | null {
  const ag = state.assembly;
  if (ag.state === 'preparation') return tr.t('form.notOpen');
  if (ag.state === 'in_progress' && !ag.submissionsOpen) return tr.t('form.closed');
  return null;
}

function renderForm() {
  const ag = state.assembly;
  const isEnded = ended(ag);
  form.hidden = isEnded;
  $('[data-ended]').hidden = !isEnded;
  document.querySelector<HTMLElement>('[data-live-pill]')!.hidden = ag.state !== 'in_progress';
  if (isEnded) return;

  const blocked = blockedReason();
  const formState = $('[data-form-state]');
  formState.hidden = blocked === null;
  formState.textContent = blocked ?? '';

  const count = charCount(textInput.value.trim());
  const over = count > ag.maxChars;
  const counter = $('[data-counter]');
  counter.textContent = tr.t('form.counter', { count, max: ag.maxChars });
  counter.classList.toggle('over', over);
  const overMessage = $('[data-over]');
  overMessage.hidden = !over;
  overMessage.textContent = over ? tr.t('form.overLimit', { max: ag.maxChars }) : '';

  const wait = waitingMs();
  $('[data-countdown]').textContent = wait > 0 ? tr.t('form.wait', { time: formatCountdown(wait) }) : '';

  const empty = !textInput.value.trim() || !nameInput.value.trim();
  sendButton.disabled = state.sending || blocked !== null || over || wait > 0 || empty;
  $('[data-send-label]').textContent = tr.t(state.sending ? 'form.sending' : 'form.send');
}

function showFormError(message: string, focus?: HTMLElement) {
  formError.textContent = message;
  formError.hidden = false;
  focus?.focus();
}

for (const input of [nameInput, schoolInput, textInput]) {
  input.addEventListener('input', () => {
    saveDraft();
    sentMessage.hidden = true;
    formError.hidden = true;
    renderForm();
  });
}
beforeLanguageSwitch(saveDraft);

// Formatting toolbar: inserts the markers the renderer understands.
function wrapSelection(marker: string) {
  const { selectionStart: start, selectionEnd: end, value } = textInput;
  const selected = value.slice(start, end) || '';
  textInput.setRangeText(`${marker}${selected}${marker}`, start, end, 'select');
  textInput.setSelectionRange(start + marker.length, start + marker.length + selected.length);
}

function toggleList() {
  const { selectionStart: start, selectionEnd: end, value } = textInput;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const allListed = lines.every((l) => /^- /.test(l));
  const replaced = lines.map((l) => (allListed ? l.replace(/^- /, '') : /^- /.test(l) ? l : `- ${l}`)).join('\n');
  textInput.setRangeText(replaced, lineStart, lineEnd, 'end');
}

for (const button of $$<HTMLButtonElement>('[data-format]')) {
  button.addEventListener('click', () => {
    textInput.focus();
    if (button.dataset.format === 'bold') wrapSelection('**');
    else if (button.dataset.format === 'italic') wrapSelection('*');
    else toggleList();
    textInput.dispatchEvent(new Event('input'));
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (sendButton.disabled) return;
  state.sending = true;
  formError.hidden = true;
  renderForm();
  let res: { status: number; data: any };
  try {
    res = await postJson('/api/interventions', {
      name: nameInput.value,
      school: schoolInput.value,
      text: textInput.value,
    });
  } catch {
    state.sending = false;
    renderForm();
    showFormError(tr.t('form.error.network'));
    return;
  }
  state.sending = false;
  const body = res.data ?? {};
  if (typeof body.serverNow === 'number') state.offset = body.serverNow - Date.now();
  if (res.status === 201) {
    textInput.value = '';
    saveDraft();
    state.nextAllowedAt = body.nextAllowedAt;
    addMine(body.item);
    sentMessage.hidden = false;
  } else if (res.status === 400 && body.error === 'invalid') {
    const field = body.field === 'name' ? nameInput : body.field === 'school' ? schoolInput : textInput;
    showFormError(tr.t(`form.error.${body.field}.${body.reason}`, { max: body.max ?? '' }), field);
  } else if (res.status === 429 && body.error === 'too_early') {
    state.nextAllowedAt = body.nextAllowedAt;
    showFormError(tr.t('form.error.too_early', { time: formatCountdown(waitingMs()) }));
  } else if (res.status === 429) {
    showFormError(tr.t('form.error.rate_limited'));
  } else if (res.status === 409) {
    showFormError(tr.t('form.error.closed'));
  } else if (res.status === 401) {
    window.location.reload();
    return;
  } else {
    showFormError(tr.t('form.error.network'));
  }
  renderForm();
});

// Countdown tick.
window.setInterval(() => {
  if (state.nextAllowedAt > serverNow() - 1000) renderForm();
}, 1000);

// ---------- Mes interventions ----------

function statusBadge(item: PublicIntervention): HTMLElement {
  if (item.status === 'read')
    return h('span', { class: 'badge badge--read' }, tr.t('status.read', { time: formatTime(lang, item.statusAt ?? 0) }));
  if (item.status === 'rejected') return h('span', { class: 'badge badge--rejected' }, tr.t('status.rejected'));
  return h('span', { class: 'badge badge--queued' }, tr.t('status.queued'));
}

function renderMine() {
  const items = [...state.mine.values()].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
  $('[data-mine-count]').textContent = String(items.length);
  $('[data-mine-empty]').hidden = items.length > 0;
  $('[data-mine]').replaceChildren(
    ...items.map((item) =>
      h(
        'li',
        { class: 'mine-item', 'data-status': item.status },
        h(
          'div',
          { class: 'mine-item__head' },
          h('span', {}, tr.t('mine.sentAt', { time: formatTime(lang, item.createdAt) })),
          statusBadge(item),
        ),
        item.status === 'rejected' && item.publicMessage
          ? h('p', { class: 'mine-item__reason' }, `${tr.t('status.rejected')} — ${item.publicMessage}`)
          : null,
        fromTrustedHtml('div', 'rich', item.html),
      ),
    ),
  );
}

function addMine(item: PublicIntervention) {
  state.mine.set(item.id, item);
  renderMine();
}

// ---------- Live updates ----------

function applyAssembly(ag: PublicAssembly) {
  state.assembly = ag;
  renderStream();
  renderForm();
}

connectLive<ParticipantSnapshot, ParticipantDelta>({
  url: '/api/events',
  pingUrl: '/api/ping',
  onSnapshot(snapshot) {
    state.offset = snapshot.serverNow - Date.now();
    state.nextAllowedAt = snapshot.nextAllowedAt;
    state.mine = new Map(snapshot.mine.map((i) => [i.id, i]));
    applyAssembly(snapshot.assembly);
    renderMine();
  },
  onDelta(delta) {
    if (delta.type === 'deleted') {
      window.location.reload();
      return;
    }
    state.offset = delta.serverNow - Date.now();
    state.nextAllowedAt = delta.nextAllowedAt;
    if (delta.type === 'assembly') applyAssembly(delta.assembly);
    else {
      addMine(delta.item);
      renderForm();
    }
  },
});

restoreDraft();
renderStream();
renderForm();
renderMine();
