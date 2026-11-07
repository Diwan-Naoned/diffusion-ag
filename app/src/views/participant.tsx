import type { PublicAssembly, PublicIntervention } from '../domain/views.ts';
import { formatLongDate, type Entry, type Translator } from '../i18n/index.ts';
import { Layout } from './layout.tsx';

export interface ParticipantData {
  lang: string;
  strings: Record<string, Entry>;
  serverNow: number;
  assembly: PublicAssembly;
  nextAllowedAt: number;
  mine: PublicIntervention[];
  limits: { nameMax: number; schoolMax: number };
  /** iframe referrerpolicy for the YouTube embed (D9, see docs/decisions.md). */
  embedReferrerPolicy: string;
}

export function isEnded(ag: PublicAssembly): boolean {
  return ag.state === 'ended' || ag.state === 'deletion_scheduled' || ag.state === 'deleted';
}

const InfoIcon = (
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2a2a7e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 11v6" />
    <path d="M12 7.5v.5" />
  </svg>
);

export function ParticipantPage({ tr, data }: { tr: Translator; data: ParticipantData }) {
  const ag = data.assembly;
  const ended = isEnded(ag);
  return (
    <Layout
      tr={tr}
      title={`${tr.t('participant.title')} — ${ag.name}`}
      heading={tr.t('participant.title')}
      eyebrow={tr.t('app.eyebrow', { date: formatLongDate(tr.lang, ag.date) })}
      path="/"
      scripts={['participant']}
      data={data}
      headerTools={
        <span class="pill pill--live" data-live-pill hidden={ag.state !== 'in_progress'}>
          {tr.t('app.live')}
        </span>
      }
    >
      <main class="page">
        <div class="participant">
          <section class="participant__stream stack" aria-labelledby="stream-title">
            <div class="section-title">
              <h1 id="stream-title">{tr.t('stream.heading')}</h1>
            </div>
            <div class="stream-switch" role="group" aria-label={tr.t('stream.choice')}>
              <button type="button" aria-pressed="true" data-stream="a">
                <span class="label">{tr.t('stream.a.label')}</span>
                <span class="hint">{tr.t('stream.a.hint')}</span>
              </button>
              <button type="button" aria-pressed="false" data-stream="b">
                <span class="label">{tr.t('stream.b.label')}</span>
                <span class="hint">{tr.t('stream.b.hint')}</span>
              </button>
            </div>
            <div class="player" data-player>
              <div class="player__placeholder" data-player-placeholder>
                <strong>{tr.t('stream.notStarted')}</strong>
                <span class="small">{tr.t('stream.notStartedHint')}</span>
              </div>
            </div>
            <p data-explain="a">{tr.t('stream.a.explain')}</p>
            <p data-explain="b" hidden>
              {tr.t('stream.b.explain')}
            </p>
            <div class="notice">
              {InfoIcon}
              <p>{tr.t('stream.noChat')}</p>
            </div>
            <a href="/salle" class="btn" style="align-self:flex-start">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
              </svg>
              {tr.t('stream.salleLink')}
            </a>
          </section>

          <aside class="participant__form">
            <form class="card form-card" data-form hidden={ended} novalidate>
              <div class="section-title">
                <h2>{tr.t('form.heading')}</h2>
              </div>
              <p class="small">{tr.t('form.intro')}</p>
              <p class="message" role="status" data-form-state hidden></p>
              <div class="field">
                <label for="f-name">{tr.t('form.name')}</label>
                <input id="f-name" name="name" class="input" required maxlength={data.limits.nameMax} autocomplete="name" />
              </div>
              <div class="field">
                <label for="f-school">
                  {tr.t('form.school')} <span style="font-weight:400">{tr.t('form.optional')}</span>
                </label>
                <input id="f-school" name="school" class="input" maxlength={data.limits.schoolMax} autocomplete="organization" />
              </div>
              <div class="field">
                <label for="f-text">{tr.t('form.text')}</label>
                <div class="editor">
                  <div class="toolbar" role="toolbar" aria-label={tr.t('form.toolbar')} aria-controls="f-text">
                    <button type="button" aria-label={tr.t('form.bold')} data-format="bold" style="font-weight:700">
                      {tr.t('form.boldKey')}
                    </button>
                    <button type="button" aria-label={tr.t('form.italic')} data-format="italic" style="font-style:italic">
                      {tr.t('form.italicKey')}
                    </button>
                    <button type="button" aria-label={tr.t('form.list')} data-format="list">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M9 6h11" />
                        <path d="M9 12h11" />
                        <path d="M9 18h11" />
                        <circle cx="4.5" cy="6" r="1" />
                        <circle cx="4.5" cy="12" r="1" />
                        <circle cx="4.5" cy="18" r="1" />
                      </svg>
                    </button>
                  </div>
                  <textarea id="f-text" name="text" class="textarea" rows={6} required placeholder={tr.t('form.placeholder')} aria-describedby="f-counter f-over"></textarea>
                </div>
              </div>
              {/* Counter, countdown and send button right under the textarea (on-screen keyboard, D17). */}
              <div class="stack" style="gap:8px" data-form-actions>
                <div class="form-status">
                  <span class="countdown" data-countdown aria-live="polite"></span>
                  <span id="f-counter" data-counter></span>
                </div>
                <p id="f-over" class="small" style="color:var(--danger);font-weight:600" data-over hidden></p>
                <p class="message message--error" role="alert" data-form-error hidden></p>
                <button type="submit" class="btn btn--primary btn--large" data-send>
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4Z" />
                  </svg>
                  <span data-send-label>{tr.t('form.send')}</span>
                </button>
                <p class="message message--ok" role="status" data-sent hidden>
                  <strong>{tr.t('form.sent')}</strong> {tr.t('form.sentHint')}
                </p>
              </div>
            </form>
            <div class="card stack" data-ended hidden={!ended} role="status">
              <div class="section-title">
                <h2>{tr.t('form.ended')}</h2>
              </div>
              <p>{tr.t('form.endedHint')}</p>
            </div>
          </aside>

          <section class="participant__mine stack" aria-labelledby="mine-title">
            <div class="section-title">
              <h2 id="mine-title">
                {tr.t('mine.heading')} (<span data-mine-count>{data.mine.length}</span>)
              </h2>
            </div>
            <p class="small">{tr.t('mine.intro')}</p>
            <p class="muted" data-mine-empty hidden={data.mine.length > 0}>
              {tr.t('mine.empty')}
            </p>
            <ul class="mine-list" data-mine></ul>
          </section>
        </div>
      </main>
    </Layout>
  );
}
