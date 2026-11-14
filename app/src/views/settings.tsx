import { raw } from 'hono/html';
import { canExport, canRegenerateCode } from '../domain/lifecycle.ts';
import type { Assembly } from '../domain/types.ts';
import { CUSTOM_CODE_MAX, CUSTOM_CODE_MIN } from '../lib/code.ts';
import { formatDayMonth, formatLongDate, formatTime, type StringKey, type Translator } from '../i18n/index.ts';
import type { BureauSession } from '../web/types.ts';
import { BureauLayout } from './bureau-layout.tsx';
import { Layout } from './layout.tsx';

export type Flash = { ok?: string; error?: string };

const ERRORS: Record<string, StringKey> = {
  other_active: 'settings.err.other_active',
  invalid_state: 'settings.err.invalid_state',
  export_not_opened: 'settings.err.export_not_opened',
  export_not_confirmed: 'settings.err.export_not_confirmed',
  invalid: 'settings.err.invalid',
  youtube: 'settings.youtubeInvalid',
  code_invalid: 'settings.err.code_invalid',
  code_taken: 'settings.err.code_taken',
};

function FlashMessage({ tr, flash }: { tr: Translator; flash: Flash }) {
  if (flash.error && ERRORS[flash.error])
    return (
      <p class="message message--error" role="alert">
        {tr.t(ERRORS[flash.error]!)}
      </p>
    );
  if (flash.ok)
    return (
      <p class="message message--ok" role="status">
        <strong>{tr.t('settings.saved')}</strong>
      </p>
    );
  return null;
}

/** A POST form with one button, optionally confirmed in a dialog first (data-confirm). */
function ActionForm(props: { action: string; label: string; variant?: 'primary' | 'danger' | 'outline'; confirm?: string; tr: Translator }) {
  const cls = props.variant === 'primary' ? 'btn btn--primary' : props.variant === 'danger' ? 'btn btn--danger' : 'btn';
  return (
    <form method="post" action={props.action} data-confirm={props.confirm} data-confirm-ok={props.confirm ? props.tr.t('settings.confirm') : undefined} data-confirm-cancel={props.confirm ? props.tr.t('settings.cancel') : undefined}>
      <button type="submit" class={cls}>
        {props.label}
      </button>
    </form>
  );
}

interface CommonProps {
  tr: Translator;
  session: BureauSession;
  timeZone: string;
  scheduled: Assembly | null;
  flash: Flash;
}

export function AssembliesPage(props: CommonProps & { assemblies: Assembly[]; current: Assembly | null }) {
  const { tr } = props;
  return (
    <BureauLayout
      tr={tr}
      session={props.session}
      timeZone={props.timeZone}
      title={tr.t('settings.assemblies')}
      heading={tr.t('settings.title')}
      assembly={props.current}
      scheduled={props.scheduled}
      path="/bureau/ags"
      active="settings"
    >
      <main class="page settings-grid">
        <section class="card stack" aria-labelledby="list-title">
          <div class="section-title">
            <h1 id="list-title">{tr.t('settings.assemblies')}</h1>
          </div>
          <FlashMessage tr={tr} flash={props.flash} />
          {props.assemblies.length === 0 ? (
            <p>{tr.t('bureau.noAssembly')}</p>
          ) : (
            <ul class="ag-list">
              {props.assemblies.map((ag) => (
                <li>
                  <a href={`/bureau/ag/${ag.id}/settings`}>
                    <strong>{ag.name}</strong>
                    <span class="small muted">
                      {formatLongDate(tr.lang, ag.date)} · {tr.t(`state.${ag.state}`)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section class="card stack" aria-labelledby="create-title">
          <div class="section-title">
            <h2 id="create-title">{tr.t('settings.create')}</h2>
          </div>
          <form method="post" action="/bureau/ags" class="stack">
            <div class="field">
              <label for="ag-name">{tr.t('settings.name')}</label>
              <input id="ag-name" name="name" class="input" required maxlength={120} />
            </div>
            <div class="field">
              <label for="ag-date">{tr.t('settings.date')}</label>
              <input id="ag-date" name="date" type="date" class="input" required />
            </div>
            <button type="submit" class="btn btn--primary btn--large">
              {tr.t('settings.createSubmit')}
            </button>
          </form>
        </section>
      </main>
    </BureauLayout>
  );
}

export function SettingsPage(props: CommonProps & { ag: Assembly; link: string | null; qrSvg: string | null }) {
  const { tr, ag, timeZone } = props;
  const base = `/bureau/ag/${ag.id}`;
  const when = (at: number) => ({ date: formatDayMonth(tr.lang, at, timeZone), time: formatTime(tr.lang, at, timeZone) });

  if (ag.state === 'deleted') {
    return (
      <BureauLayout tr={tr} session={props.session} timeZone={timeZone} title={tr.t('settings.title')} heading={tr.t('settings.title')} assembly={ag} scheduled={props.scheduled} path={`${base}/settings`} active="settings">
        <main class="page stack">
          <div class="section-title">
            <h1>{ag.name}</h1>
          </div>
          <p class="notice">{tr.t('settings.deleted')}</p>
          <a href="/bureau/ags" class="btn" style="align-self:flex-start">
            {tr.t('settings.assemblies')}
          </a>
        </main>
      </BureauLayout>
    );
  }

  const flow: { action: string; label: StringKey; variant?: 'primary' | 'danger'; confirm?: StringKey }[] = [];
  if (ag.state === 'preparation') flow.push({ action: 'open', label: 'settings.open', variant: 'primary' });
  if (ag.state === 'in_progress') {
    flow.push(
      ag.submissionsOpen
        ? { action: 'close_submissions', label: 'settings.closeSubmissions' }
        : { action: 'reopen_submissions', label: 'settings.reopenSubmissions', variant: 'primary' },
    );
    flow.push({ action: 'end', label: 'settings.end', variant: 'danger', confirm: 'settings.endConfirm' });
  }
  if (ag.state === 'ended') flow.push({ action: 'reopen', label: 'settings.reopen' });

  return (
    <BureauLayout
      tr={tr}
      session={props.session}
      timeZone={timeZone}
      title={`${tr.t('settings.title')} — ${ag.name}`}
      heading={tr.t('settings.title')}
      assembly={ag}
      scheduled={props.scheduled}
      path={`${base}/settings`}
      active="settings"
      scripts={['settings']}
      data={{ copied: tr.t('settings.copied') }}
    >
      <main class="page stack stack--lg">
        <FlashMessage tr={tr} flash={props.flash} />
        <div class="settings-grid">
          <section class="card stack" aria-labelledby="flow-title">
            <div class="section-title">
              <h2 id="flow-title">{tr.t('settings.flow')}</h2>
            </div>
            <p>
              <strong>{tr.t('settings.currentState', { state: tr.t(`state.${ag.state}`) })}</strong>
              {ag.state === 'in_progress' && <> · {tr.t(ag.submissionsOpen ? 'dash.receptionOpen' : 'dash.receptionClosed')}</>}
            </p>
            <div class="row">
              {flow.map((f) => (
                <ActionForm tr={tr} action={`${base}/action/${f.action}`} label={tr.t(f.label)} variant={f.variant} confirm={f.confirm && tr.t(f.confirm)} />
              ))}
            </div>
          </section>

          <section class="card stack" aria-labelledby="details-title">
            <div class="section-title">
              <h2 id="details-title">{tr.t('settings.details')}</h2>
            </div>
            <form method="post" action={`${base}/details`} class="stack">
              <div class="field">
                <label for="ag-name">{tr.t('settings.name')}</label>
                <input id="ag-name" name="name" class="input" required maxlength={120} value={ag.name} />
              </div>
              <div class="field">
                <label for="ag-date">{tr.t('settings.date')}</label>
                <input id="ag-date" name="date" type="date" class="input" required value={ag.date} />
              </div>
              <div class="field">
                <label for="yt-a">{tr.t('settings.youtubeA')}</label>
                <input id="yt-a" name="youtubeA" class="input" value={ag.youtubeAId ?? ''} autocomplete="off" spellcheck={false} />
              </div>
              <div class="field">
                <label for="yt-b">{tr.t('settings.youtubeB')}</label>
                <input id="yt-b" name="youtubeB" class="input" value={ag.youtubeBId ?? ''} autocomplete="off" spellcheck={false} />
                <span class="hint">{tr.t('settings.youtubeHint')}</span>
              </div>
              <button type="submit" class="btn btn--primary" style="align-self:flex-start">
                {tr.t('settings.save')}
              </button>
            </form>
          </section>

          {props.link && (
            <section class="card stack" aria-labelledby="access-title">
              <div class="section-title">
                <h2 id="access-title">{tr.t('settings.access')}</h2>
              </div>
              <div class="field">
                <span class="label">{tr.t('settings.code')}</span>
                <span class="code-display" data-code>
                  {ag.code}
                </span>
              </div>
              <div class="field">
                <span class="label">{tr.t('settings.link')}</span>
                <span class="link-box" data-link>
                  {props.link}
                </span>
                <div class="row">
                  <button type="button" class="btn" data-copy={props.link} hidden>
                    {tr.t('settings.copy')}
                  </button>
                  <span class="small muted" role="status" data-copy-status></span>
                </div>
              </div>
              {props.qrSvg && (
                <div class="field">
                  <span class="label">{tr.t('settings.qr')}</span>
                  <div class="qr">{raw(props.qrSvg)}</div>
                  <a href={`${base}/qr`} class="btn" target="_blank" style="align-self:flex-start">
                    {tr.t('settings.printQr')}
                  </a>
                </div>
              )}
              {canRegenerateCode(ag) && (
                <form
                  method="post"
                  action={`${base}/code`}
                  class="field"
                  data-confirm={tr.t('settings.regenerateWarn')}
                  data-confirm-ok={tr.t('settings.confirm')}
                  data-confirm-cancel={tr.t('settings.cancel')}
                >
                  <label for="ag-code">{tr.t('settings.customCode')}</label>
                  <div class="input-row">
                    <input
                      id="ag-code"
                      name="code"
                      class="input"
                      required
                      minlength={CUSTOM_CODE_MIN}
                      maxlength={CUSTOM_CODE_MAX + 10}
                      value={ag.code ?? ''}
                      autocomplete="off"
                      autocapitalize="characters"
                      spellcheck={false}
                      style="text-transform:uppercase"
                    />
                    <button type="submit" class="btn">
                      {tr.t('settings.customCodeSave')}
                    </button>
                  </div>
                  <span class="hint">{tr.t('settings.customCodeHint', { min: String(CUSTOM_CODE_MIN), max: String(CUSTOM_CODE_MAX) })}</span>
                </form>
              )}
              {canRegenerateCode(ag) && (
                <div class="stack" style="gap:8px">
                  <ActionForm tr={tr} action={`${base}/regenerate-code`} label={tr.t('settings.regenerate')} confirm={tr.t('settings.regenerateWarn')} />
                  <span class="hint small muted">{tr.t('settings.regenerateWarn')}</span>
                </div>
              )}
            </section>
          )}

          <section class="card stack" aria-labelledby="exports-title" id="deletion">
            <div class="section-title">
              <h2 id="exports-title">{tr.t('settings.exports')}</h2>
            </div>
            {!canExport(ag) ? (
              <p>{tr.t('settings.exportsUnavailable')}</p>
            ) : (
              <>
                <div class="row">
                  <a href={`${base}/export.csv`} class="btn btn--primary" download>
                    {tr.t('settings.exportCsv')}
                  </a>
                  <a href={`${base}/export/print`} class="btn" target="_blank">
                    {tr.t('settings.exportPrint')}
                  </a>
                </div>
                {ag.exportOpenedAt !== null && <p class="small muted">{tr.t('settings.exportOpened', when(ag.exportOpenedAt))}</p>}
                {ag.exportConfirmedAt !== null ? (
                  <p class="notice">{tr.t('settings.exportConfirmed', { name: ag.exportConfirmedBy ?? '', ...when(ag.exportConfirmedAt) })}</p>
                ) : (
                  ag.state === 'ended' &&
                  ag.exportOpenedAt !== null && (
                    <div class="stack" style="gap:8px">
                      <p class="small">{tr.t('settings.confirmExportHint')}</p>
                      <ActionForm tr={tr} action={`${base}/action/confirm_export`} label={tr.t('settings.confirmExport')} variant="primary" />
                    </div>
                  )
                )}
                {ag.state === 'ended' && ag.exportConfirmedAt !== null && (
                  <div class="stack" style="gap:8px">
                    <h3 style="margin:0">{tr.t('settings.deletion')}</h3>
                    <p class="small">{tr.t('settings.scheduleHint')}</p>
                    <ActionForm tr={tr} action={`${base}/action/schedule_deletion`} label={tr.t('settings.scheduleDeletion')} variant="danger" confirm={tr.t('settings.scheduleConfirm')} />
                  </div>
                )}
                {ag.state === 'deletion_scheduled' && ag.deletionAt !== null && (
                  <div class="stack" style="gap:8px">
                    <h3 style="margin:0">{tr.t('settings.deletion')}</h3>
                    <p class="notice notice--strong">{tr.t('settings.deletionScheduled', when(ag.deletionAt))}</p>
                    <ActionForm tr={tr} action={`${base}/action/cancel_deletion`} label={tr.t('settings.cancelDeletion')} variant="primary" />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
        <a href="/bureau/ags" class="text-link" style="align-self:flex-start">
          {tr.t('settings.assemblies')} · {tr.t('settings.create')}
        </a>
      </main>
      <dialog class="dialog" aria-labelledby="confirm-text" data-confirm-dialog>
        <div class="dialog__body">
          <p id="confirm-text" data-confirm-text></p>
        </div>
        <div class="dialog__foot">
          <button type="button" class="btn" data-confirm-no></button>
          <button type="button" class="btn btn--primary" data-confirm-yes></button>
        </div>
      </dialog>
    </BureauLayout>
  );
}

/** Printable QR code of the participant link, for the room (D11). */
export function QrPrintPage({ tr, ag, link, qrSvg }: { tr: Translator; ag: Assembly; link: string; qrSvg: string }) {
  return (
    <Layout tr={tr} title={tr.t('qr.heading')} heading={tr.t('qr.heading')} eyebrow={`${ag.name} · ${formatLongDate(tr.lang, ag.date)}`} path={`/bureau/ag/${ag.id}/qr`} scripts={['print']}>
      <main class="page page--narrow stack" style="align-items:center;text-align:center">
        <p style="font-size:1.25rem">{tr.t('qr.instructions')}</p>
        <div class="qr" style="max-width:420px">
          {raw(qrSvg)}
        </div>
        <p class="link-box">{link}</p>
        <p class="code-display">{tr.t('qr.code', { code: ag.code ?? '' })}</p>
        <button type="button" class="btn btn--primary no-print" data-print hidden>
          {tr.t('settings.printQr')}
        </button>
      </main>
    </Layout>
  );
}
