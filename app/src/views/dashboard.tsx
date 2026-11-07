import type { Assembly } from '../domain/types.ts';
import type { BureauIntervention, BureauAssembly } from '../domain/views.ts';
import type { Entry, Translator } from '../i18n/index.ts';
import type { BureauSession } from '../web/types.ts';
import { BureauLayout } from './bureau-layout.tsx';

/** Fixed French quick-pick suggestions for the reject dialog (D11): never translated. */
export const REJECT_CHIPS = ['Déjà posée', 'Hors sujet', 'Sera traitée plus tard', "Hors du cadre de l'AG"] as const;

export interface DashboardData {
  lang: string;
  strings: Record<string, Entry>;
  chips: readonly string[];
  agId: number;
  serverNow: number;
  assembly: BureauAssembly;
  items: BureauIntervention[];
  limits: { delay: { min: number; max: number; step: number }; maxChars: { min: number; max: number; step: number } };
}

const Icon = {
  check: (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  close: (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  ),
  prev: (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  next: (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
};

export function DashboardPage(props: {
  tr: Translator;
  session: BureauSession;
  timeZone: string;
  ag: Assembly;
  scheduled: Assembly | null;
  data: DashboardData;
}) {
  const { tr, ag, data } = props;
  return (
    <BureauLayout
      tr={tr}
      session={props.session}
      timeZone={props.timeZone}
      title={`${tr.t('dash.title')} — ${ag.name}`}
      heading={tr.t('dash.title')}
      assembly={ag}
      scheduled={props.scheduled}
      path={`/bureau/ag/${ag.id}`}
      active="dashboard"
      scripts={['bureau']}
      data={data}
      headerExtra={<div data-reception></div>}
    >
      <main class="page stack stack--lg">
        <div class="stats" aria-live="polite">
          <div class="stat stat--main">
            <span class="stat__label">{tr.t('dash.count.queued')}</span>
            <span class="stat__value" data-count="queued">
              0
            </span>
          </div>
          <div class="stat">
            <span class="stat__label">{tr.t('dash.count.read')}</span>
            <span class="stat__value" data-count="read">
              0
            </span>
          </div>
          <div class="stat">
            <span class="stat__label">{tr.t('dash.count.total')}</span>
            <span class="stat__value" data-count="total">
              0
            </span>
          </div>
        </div>

        <section class="card card--soft stack" aria-labelledby="reg-title">
          <div class="section-title">
            <h2 id="reg-title">{tr.t('reg.heading')}</h2>
          </div>
          <p class="small muted">{tr.t('reg.hint')}</p>
          <div class="regulation">
            <div class="slider">
              <div class="slider__head">
                <label for="reg-delay">{tr.t('reg.delay')}</label>
                <output class="slider__value" for="reg-delay" data-value="minDelaySeconds"></output>
              </div>
              <input id="reg-delay" type="range" min={data.limits.delay.min} max={data.limits.delay.max} step={data.limits.delay.step} value={ag.minDelaySeconds} data-setting="minDelaySeconds" />
              <span class="slider__status" data-status="minDelaySeconds" aria-live="polite"></span>
            </div>
            <div class="slider">
              <div class="slider__head">
                <label for="reg-chars">{tr.t('reg.maxChars')}</label>
                <output class="slider__value" for="reg-chars" data-value="maxChars"></output>
              </div>
              <input id="reg-chars" type="range" min={data.limits.maxChars.min} max={data.limits.maxChars.max} step={data.limits.maxChars.step} value={ag.maxChars} data-setting="maxChars" />
              <span class="slider__status" data-status="maxChars" aria-live="polite"></span>
            </div>
          </div>
        </section>

        <section class="stack" aria-labelledby="queue-title">
          <div class="row" style="justify-content:space-between;align-items:flex-end;gap:16px">
            <div class="section-title">
              <h2 id="queue-title">{tr.t('dash.queueHeading')}</h2>
            </div>
            <div class="tabs" role="group" aria-label={tr.t('dash.filter')} data-tabs></div>
          </div>
          <p class="small muted">{tr.t('dash.queueIntro')}</p>
          <p class="message message--error" role="alert" data-error hidden></p>
          <div class="empty" data-empty hidden>
            {tr.t('dash.empty')}
          </div>
          <ul class="queue" data-queue></ul>
        </section>
      </main>

      <dialog class="dialog dialog--reading" aria-labelledby="reading-name" data-reading>
        <div class="dialog__head">
          <span class="avatar" aria-hidden="true" data-r="initials"></span>
          <div class="reading__who">
            <h2 class="reading__name" id="reading-name" data-r="name"></h2>
            <span class="small muted" data-r="meta"></span>
          </div>
          <span data-r="badge"></span>
          <div class="size-controls">
            <button type="button" class="btn btn--icon" aria-label={tr.t('reading.smaller')} data-r="smaller">
              A−
            </button>
            <button type="button" class="btn btn--icon" aria-label={tr.t('reading.bigger')} data-r="bigger" style="font-size:1.15rem">
              A+
            </button>
            <button type="button" class="btn btn--icon" aria-label={tr.t('reading.close')} data-r="close">
              {Icon.close}
            </button>
          </div>
        </div>
        <div class="dialog__body">
          <div class="rich reading__text" data-r="text"></div>
          <div class="queue-item__moderation" data-r="moderation"></div>
        </div>
        <div class="dialog__foot">
          <div class="reading__nav">
            <button type="button" class="btn" data-r="prev">
              {Icon.prev}
              {tr.t('reading.prev')}
            </button>
            <span class="small muted" data-r="position"></span>
            <button type="button" class="btn" data-r="next">
              {tr.t('reading.next')}
              {Icon.next}
            </button>
          </div>
          <div class="row" data-r="actions"></div>
        </div>
      </dialog>

      <dialog class="dialog" aria-labelledby="reject-title" data-reject>
        <form method="dialog" style="display:contents" data-reject-form novalidate>
          <div class="dialog__head">
            <h2 class="dialog__title" id="reject-title" style="flex:1 1 auto">
              {tr.t('reject.heading')}
            </h2>
            <button type="button" class="btn btn--icon" aria-label={tr.t('reading.close')} data-reject-cancel>
              {Icon.close}
            </button>
          </div>
          <div class="dialog__body">
            <p class="small muted" data-reject-about></p>
            <div class="field">
              <span class="label" id="chips-label">
                {tr.t('reject.suggestions')}
              </span>
              <div class="chips" role="group" aria-labelledby="chips-label">
                {REJECT_CHIPS.map((chip) => (
                  <button type="button" class="chip" lang="fr" data-chip={chip}>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <div class="field">
              <label for="reject-public">{tr.t('reject.public')}</label>
              <textarea id="reject-public" class="textarea" rows={3} maxlength={500} required data-reject-public style="min-height:96px"></textarea>
              <span class="hint">{tr.t('reject.publicHint')}</span>
            </div>
            <div class="field">
              <label for="reject-private">
                {tr.t('reject.private')} <span class="hint">{tr.t('reject.privateHint')}</span>
              </label>
              <textarea id="reject-private" class="textarea" rows={3} maxlength={2000} data-reject-private style="min-height:96px"></textarea>
            </div>
            <p class="message message--error" role="alert" data-reject-error hidden></p>
          </div>
          <div class="dialog__foot">
            <button type="button" class="btn" data-reject-cancel>
              {tr.t('reject.cancel')}
            </button>
            <button type="submit" class="btn btn--danger" value="confirm">
              {tr.t('reject.confirm')}
            </button>
          </div>
        </form>
      </dialog>
    </BureauLayout>
  );
}

export { Icon };
