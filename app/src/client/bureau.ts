/**
 * Bureau dashboard (mockup board 3): live queue over SSE, tabs with counts, reading view,
 * reject dialog, Régulation sliders, reception toggle.
 */
import type { BureauAssembly, BureauDelta, BureauIntervention, BureauSnapshot } from '../domain/views.ts';
import { formatDayMonth, formatTime, type Lang } from '../i18n/core.ts';
import type { DashboardData } from '../views/dashboard.tsx';
import { connectLive } from './_live.ts';
import { $, $$, fromTrustedHtml, h, pageData, postJson, storage, translatorFrom } from './_page.ts';
import { formatDuration } from './_format.ts';

type Filter = 'queued' | 'read' | 'rejected' | 'all';
const FILTERS: Filter[] = ['queued', 'read', 'rejected', 'all'];

const data = pageData<DashboardData>();
const lang = data.lang as Lang;
const tr = translatorFrom(lang, data.strings);

const state = {
  assembly: data.assembly as BureauAssembly,
  items: new Map<number, BureauIntervention>(data.items.map((i) => [i.id, i])),
  filter: (storage.get('bureau.filter') as Filter | null) ?? 'queued',
  reading: null as null | { ids: number[]; index: number },
  readSize: Number(storage.get('bureau.readSize')) || 22,
  rejecting: null as number | null,
};
if (!FILTERS.includes(state.filter)) state.filter = 'queued';

const time = (ms: number) => formatTime(lang, ms);
const initials = (name: string) =>
  name
    .split(/[\s.\-']+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function sorted(): BureauIntervention[] {
  return [...state.items.values()].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
}

function visible(filter: Filter = state.filter): BureauIntervention[] {
  const all = sorted();
  return filter === 'all' ? all : all.filter((i) => i.status === filter);
}

function counts() {
  const c = { queued: 0, read: 0, rejected: 0, all: state.items.size };
  for (const i of state.items.values()) c[i.status]++;
  return c;
}

// ---------- Rendering ----------

function meta(item: BureauIntervention): string {
  return [item.school, tr.t('dash.receivedAt', { time: time(item.createdAt) }), tr.tn('dash.words', item.words)]
    .filter(Boolean)
    .join(' · ');
}

function badge(item: BureauIntervention): HTMLElement {
  if (item.status === 'read')
    return h('span', { class: 'badge badge--read' }, tr.t('dash.badge.read', { time: time(item.statusAt ?? 0) }));
  if (item.status === 'rejected') return h('span', { class: 'badge badge--rejected' }, tr.t('dash.badge.rejected'));
  return h('span', { class: 'badge badge--queued' }, tr.t('dash.badge.queued'));
}

function moderationInfo(item: BureauIntervention): HTMLElement | null {
  if (item.status === 'queued') return null;
  const lines: (HTMLElement | string)[] = [];
  if (item.statusBy) lines.push(h('p', { class: 'small muted' }, tr.t('dash.by', { name: item.statusBy })));
  if (item.status === 'rejected') {
    lines.push(h('p', {}, h('strong', {}, tr.t('dash.publicMessage')), ' ', item.publicMessage ?? ''));
    if (item.privateNote) lines.push(h('p', {}, h('strong', {}, tr.t('dash.privateNote')), ' ', item.privateNote));
  }
  return h('div', { class: 'queue-item__moderation stack', style: 'gap:4px' }, ...lines);
}

function actionButtons(item: BureauIntervention, large = false): HTMLElement[] {
  const size = large ? ' btn--large' : '';
  if (item.status === 'queued') {
    const read = h('button', { type: 'button', class: `btn btn--primary${size}` }, tr.t('dash.markRead'));
    read.addEventListener('click', () => moderate(item.id, 'read'));
    const reject = h('button', { type: 'button', class: `btn btn--danger-outline${size}` }, tr.t('dash.reject'));
    reject.addEventListener('click', () => openReject(item.id));
    return [read, reject];
  }
  const back = h('button', { type: 'button', class: `btn${size}` }, tr.t('dash.requeue'));
  back.addEventListener('click', () => moderate(item.id, 'requeue'));
  return [back];
}

function renderItem(item: BureauIntervention, list: number[]): HTMLElement {
  const open = h('button', { type: 'button', class: 'btn' }, tr.t('dash.open'));
  open.addEventListener('click', () => openReading(list, list.indexOf(item.id)));
  return h(
    'li',
    { class: 'queue-item', 'data-status': item.status, 'data-id': String(item.id) },
    h(
      'div',
      { class: 'queue-item__head' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(item.name)),
      h(
        'div',
        { class: 'queue-item__who' },
        h('span', { class: 'queue-item__name' }, item.name),
        h('span', { class: 'queue-item__meta' }, meta(item)),
      ),
      badge(item),
    ),
    h('p', { class: 'queue-item__excerpt' }, item.excerpt),
    moderationInfo(item),
    h('div', { class: 'row' }, open, ...actionButtons(item)),
  );
}

function renderTabs() {
  const c = counts();
  const tabs = $('[data-tabs]');
  tabs.replaceChildren(
    ...FILTERS.map((f) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(state.filter === f) }, tr.t(`dash.tab.${f}`, { n: c[f] }));
      b.addEventListener('click', () => {
        state.filter = f;
        storage.set('bureau.filter', f);
        render();
      });
      return b;
    }),
  );
  $('[data-count="queued"]').textContent = String(c.queued);
  $('[data-count="read"]').textContent = String(c.read);
  $('[data-count="total"]').textContent = String(c.all);
}

function renderQueue() {
  const items = visible();
  const ids = items.map((i) => i.id);
  $('[data-queue]').replaceChildren(...items.map((i) => renderItem(i, ids)));
  $('[data-empty]').hidden = items.length > 0;
}

function renderReception() {
  const ag = state.assembly;
  const slot = $('[data-reception]');
  if (ag.state === 'in_progress') {
    const open = ag.submissionsOpen;
    const b = h(
      'button',
      { type: 'button', class: `btn ${open ? '' : 'btn--on-brand'}`, 'aria-pressed': String(open), title: tr.t('dash.toggleReception') },
      h('span', {
        'aria-hidden': 'true',
        style: `width:10px;height:10px;border-radius:999px;${open ? 'background:var(--ok)' : 'border:2px solid currentColor'}`,
      }),
      tr.t(open ? 'dash.receptionOpen' : 'dash.receptionClosed'),
    );
    b.addEventListener('click', async () => {
      b.disabled = true;
      const res = await postJson(`/bureau/api/ag/${ag.id}/action/${open ? 'close_submissions' : 'reopen_submissions'}`);
      b.disabled = false;
      if (res.status === 200) applyAssembly(res.data.assembly);
      else showError();
    });
    slot.replaceChildren(b);
  } else {
    const label = ag.state === 'preparation' ? tr.t('dash.notOpened') : tr.t('dash.ended');
    slot.replaceChildren(h('span', { class: 'pill pill--live' }, label));
  }
}

function renderDeletionBanner() {
  const banner = document.querySelector<HTMLElement>('[data-deletion-banner]');
  if (!banner) return;
  const at = state.assembly.state === 'deletion_scheduled' ? state.assembly.deletionAt : null;
  banner.hidden = at === null;
  if (at !== null) $('[data-deletion-text]', banner).textContent = tr.t('bureau.deletionBanner', { date: formatDayMonth(lang, at), time: time(at) });
}

function render() {
  renderTabs();
  renderQueue();
  renderReception();
  renderDeletionBanner();
  renderSliders();
  if (state.reading) renderReading();
}

// ---------- Errors ----------

let errorTimer: number | undefined;
function showError(message = tr.t('app.error')) {
  const el = $('[data-error]');
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => (el.hidden = true), 6000);
}

// ---------- Moderation ----------

async function moderate(id: number, action: 'read' | 'requeue' | 'reject', body: Record<string, string> = {}) {
  const res = await postJson(`/bureau/api/interventions/${id}/${action}`, body);
  if (res.status === 200) {
    applyItem(res.data.item);
    return res;
  }
  if (res.status === 401) window.location.reload();
  else if (action !== 'reject') showError();
  return res;
}

function applyItem(item: BureauIntervention) {
  state.items.set(item.id, item);
  render();
}

function applyAssembly(ag: BureauAssembly) {
  // Ignore stale copies (an older version arriving after a newer one).
  if (ag.version < state.assembly.version) return;
  state.assembly = ag;
  render();
}

// ---------- Reading view ----------

const reading = $<HTMLDialogElement>('[data-reading]');
const r = (name: string) => $(`[data-r="${name}"]`, reading);

function openReading(ids: number[], index: number) {
  state.reading = { ids, index: Math.max(0, index) };
  renderReading();
  if (!reading.open) reading.showModal();
}

function renderReading() {
  const view = state.reading;
  if (!view) return;
  const item = state.items.get(view.ids[view.index]!);
  if (!item) return;
  r('initials').textContent = initials(item.name);
  r('name').textContent = item.name;
  r('meta').textContent = meta(item);
  r('badge').replaceChildren(badge(item));
  const text = r('text');
  text.style.fontSize = `${state.readSize}px`;
  text.replaceChildren(fromTrustedHtml('div', '', item.html));
  r('moderation').replaceChildren(...[moderationInfo(item)].filter((x): x is HTMLElement => x !== null));
  r('position').textContent = tr.t('reading.position', { pos: view.index + 1, total: view.ids.length });
  (r('prev') as HTMLButtonElement).disabled = view.index <= 0;
  (r('next') as HTMLButtonElement).disabled = view.index >= view.ids.length - 1;
  (r('smaller') as HTMLButtonElement).disabled = state.readSize <= 16;
  (r('bigger') as HTMLButtonElement).disabled = state.readSize >= 40;
  r('actions').replaceChildren(...actionButtons(item, true));
}

function step(delta: number) {
  if (!state.reading) return;
  const next = state.reading.index + delta;
  if (next < 0 || next >= state.reading.ids.length) return;
  state.reading.index = next;
  renderReading();
  r('text').closest('.dialog__body')!.scrollTop = 0;
}

function resize(delta: number) {
  state.readSize = Math.min(40, Math.max(16, state.readSize + delta));
  storage.set('bureau.readSize', String(state.readSize));
  renderReading();
}

r('prev').addEventListener('click', () => step(-1));
r('next').addEventListener('click', () => step(1));
r('smaller').addEventListener('click', () => resize(-3));
r('bigger').addEventListener('click', () => resize(3));
r('close').addEventListener('click', () => reading.close());
reading.addEventListener('close', () => {
  state.reading = null;
  renderQueue();
});
reading.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});

// ---------- Reject dialog ----------

const reject = $<HTMLDialogElement>('[data-reject]');
const rejectPublic = $<HTMLTextAreaElement>('[data-reject-public]', reject);
const rejectPrivate = $<HTMLTextAreaElement>('[data-reject-private]', reject);
const rejectError = $('[data-reject-error]', reject);

function openReject(id: number) {
  const item = state.items.get(id);
  if (!item) return;
  state.rejecting = id;
  rejectPublic.value = '';
  rejectPrivate.value = '';
  rejectError.hidden = true;
  $('[data-reject-about]', reject).textContent = `${item.name} · ${meta(item)}`;
  reject.showModal();
  rejectPublic.focus();
}

for (const chip of $$<HTMLButtonElement>('[data-chip]', reject)) {
  chip.addEventListener('click', () => {
    rejectPublic.value = chip.dataset.chip ?? '';
    rejectPublic.focus();
    rejectPublic.setSelectionRange(rejectPublic.value.length, rejectPublic.value.length);
  });
}
for (const cancel of $$('[data-reject-cancel]', reject)) cancel.addEventListener('click', () => reject.close());

$<HTMLFormElement>('[data-reject-form]', reject).addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = state.rejecting;
  if (id === null) return;
  const publicMessage = rejectPublic.value.trim();
  if (!publicMessage) {
    rejectError.textContent = tr.t('reject.publicRequired');
    rejectError.hidden = false;
    rejectPublic.focus();
    return;
  }
  const res = await moderate(id, 'reject', { publicMessage, privateNote: rejectPrivate.value.trim() });
  if (res.status === 200) {
    reject.close();
    state.rejecting = null;
  } else {
    rejectError.textContent = res.data?.error === 'public_message_required' ? tr.t('reject.publicRequired') : tr.t('app.error');
    rejectError.hidden = false;
  }
});

// ---------- Régulation sliders ----------

type Setting = 'minDelaySeconds' | 'maxChars';
const sliders = $$<HTMLInputElement>('input[data-setting]');
const dragging = new Set<Setting>();

function settingLabel(setting: Setting, value: number): string {
  return setting === 'maxChars' ? tr.t('reg.chars', { n: value }) : formatDuration(tr, value);
}

function showSliderValue(input: HTMLInputElement) {
  const setting = input.dataset.setting as Setting;
  const value = Number(input.value);
  $(`[data-value="${setting}"]`).textContent = settingLabel(setting, value);
  input.setAttribute('aria-valuetext', settingLabel(setting, value));
}

function renderSliders() {
  const editable = state.assembly.state === 'preparation' || state.assembly.state === 'in_progress';
  for (const input of sliders) {
    const setting = input.dataset.setting as Setting;
    if (!dragging.has(setting)) input.value = String(state.assembly[setting]);
    input.disabled = !editable;
    showSliderValue(input);
  }
}

for (const input of sliders) {
  const setting = input.dataset.setting as Setting;
  const status = $(`[data-status="${setting}"]`);
  input.addEventListener('pointerdown', () => dragging.add(setting));
  input.addEventListener('input', () => {
    dragging.add(setting);
    showSliderValue(input);
    status.textContent = '';
  });
  // Saved when the slider is released (D11).
  input.addEventListener('change', async () => {
    const value = Number(input.value);
    const res = await postJson(`/bureau/api/ag/${state.assembly.id}/settings`, { [setting]: value });
    dragging.delete(setting);
    if (res.status === 200) {
      status.textContent = tr.t('reg.saved');
      applyAssembly(res.data.assembly);
    } else {
      status.textContent = tr.t('reg.error');
      renderSliders();
    }
  });
  input.addEventListener('blur', () => dragging.delete(setting));
}

// ---------- Live updates ----------

connectLive<BureauSnapshot, BureauDelta>({
  url: `/bureau/api/ag/${data.agId}/events`,
  pingUrl: '/bureau/api/ping',
  onSnapshot(snapshot) {
    state.assembly = snapshot.assembly;
    state.items = new Map(snapshot.items.map((i) => [i.id, i]));
    render();
  },
  onDelta(delta) {
    if (delta.type === 'deleted') window.location.reload();
    else if (delta.type === 'assembly') applyAssembly(delta.assembly);
    else applyItem(delta.item);
  },
});

render();
