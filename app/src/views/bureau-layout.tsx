import type { Child } from 'hono/jsx';
import type { Assembly } from '../domain/types.ts';
import { formatDayMonth, formatLongDate, formatTime, type Translator } from '../i18n/index.ts';
import type { BureauSession } from '../web/types.ts';
import { Layout } from './layout.tsx';

export interface BureauLayoutProps {
  tr: Translator;
  session: BureauSession;
  timeZone: string;
  title: string;
  heading: string;
  /** AG shown in the eyebrow and nav links. */
  assembly: Assembly | null;
  /** AG with a scheduled deletion, if any: its date is shown on every Bureau page. */
  scheduled: Assembly | null;
  path: string;
  active: 'dashboard' | 'settings';
  headerExtra?: Child;
  scripts?: string[];
  data?: unknown;
  children?: Child;
}

export function DeletionBanner({ tr, ag, timeZone, live }: { tr: Translator; ag: Assembly | null; timeZone: string; live?: boolean }) {
  const at = ag?.state === 'deletion_scheduled' ? ag.deletionAt : null;
  return (
    <div class="banner banner--danger" role="status" data-deletion-banner={live ? '' : undefined} hidden={at === null}>
      <span data-deletion-text>
        {at !== null &&
          tr.t('bureau.deletionBanner', { date: formatDayMonth(tr.lang, at, timeZone), time: formatTime(tr.lang, at, timeZone) })}
      </span>{' '}
      {ag && (
        <a href={`/bureau/ag/${ag.id}/settings#deletion`} class="text-link">
          {tr.t('bureau.deletionBannerLink')}
        </a>
      )}
    </div>
  );
}

export function bureauEyebrow(tr: Translator, ag: Assembly | null): string {
  if (!ag) return tr.t('bureau.space');
  return `${tr.t('bureau.eyebrow', { name: ag.name })} · ${formatLongDate(tr.lang, ag.date)}`;
}

export function BureauLayout(props: BureauLayoutProps) {
  const { tr, assembly } = props;
  const nav = assembly && (
    <nav class="row" aria-label={tr.t('bureau.space')}>
      {props.active === 'settings' ? (
        <a href={`/bureau/ag/${assembly.id}`} class="header-link">
          {tr.t('bureau.dashboard')}
        </a>
      ) : (
        <a href={`/bureau/ag/${assembly.id}/settings`} class="header-link">
          {tr.t('bureau.settings')}
        </a>
      )}
    </nav>
  );
  return (
    <Layout
      tr={tr}
      title={props.title}
      heading={props.heading}
      eyebrow={bureauEyebrow(tr, assembly)}
      path={props.path}
      scripts={props.scripts}
      data={props.data}
      banner={<DeletionBanner tr={tr} ag={props.scheduled} timeZone={props.timeZone} live={props.active === 'dashboard'} />}
      headerTools={
        <>
          {props.headerExtra}
          {nav}
          <form method="post" action="/bureau/logout" class="row">
            <button type="submit" class="btn btn--on-brand" title={tr.t('bureau.loggedAs', { name: props.session.name })}>
              {tr.t('bureau.logout')}
            </button>
          </form>
        </>
      }
    >
      {props.children}
    </Layout>
  );
}
