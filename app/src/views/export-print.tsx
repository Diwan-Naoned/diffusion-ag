import { raw } from 'hono/html';
import type { Assembly, Intervention } from '../domain/types.ts';
import { formatDayMonth, formatLongDate, formatTime, t, tn } from '../i18n/index.ts';
import { renderIntervention } from '../lib/render.ts';
import { assetUrl } from '../web/assets.ts';

/** Exports are always in French (D12): this page uses the fr dictionary, not the request's language. */
const L = 'fr' as const;

function statusLine(i: Intervention, timeZone: string): string {
  const at = i.statusAt === null ? '' : formatTime(L, i.statusAt, timeZone);
  if (i.status === 'read') return t(L, 'export.print.readAt', { time: at, name: i.statusBy ?? '' });
  if (i.status === 'rejected') return t(L, 'export.print.rejectedAt', { time: at, name: i.statusBy ?? '' });
  return t(L, 'export.print.queued');
}

/**
 * Printable export (D12): AG name and date, export time, every intervention in reception order
 * with time, author, school, formatted text, status and public message. Never the private note.
 */
export function ExportPrintPage({ ag, items, now, timeZone }: { ag: Assembly; items: Intervention[]; now: number; timeZone: string }) {
  const title = t(L, 'export.print.title', { name: ag.name });
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>{title}</title>
          <link rel="stylesheet" href={assetUrl('/static/fonts/fira-sans-condensed/fira.css')} />
          <link rel="stylesheet" href={assetUrl('/static/ds/diwan/tokens.css')} />
          <link rel="stylesheet" href={assetUrl('/static/css/print.css')} />
          <script type="module" src={assetUrl('/static/js/print.js')}></script>
        </head>
        <body data-autoprint>
          <header class="export-head">
            <h1>{title}</h1>
            <p>{t(L, 'export.print.assembly', { date: formatLongDate(L, ag.date) })}</p>
            <p>
              {t(L, 'export.print.exportedAt', { date: formatDayMonth(L, now, timeZone), time: formatTime(L, now, timeZone) })} ·{' '}
              {tn(L, 'export.print.count', items.length)}
            </p>
            <button type="button" class="no-print" data-print hidden>
              {t(L, 'export.print.print')}
            </button>
          </header>
          {items.length === 0 ? (
            <p>{t(L, 'export.print.empty')}</p>
          ) : (
            <ol class="export-list">
              {items.map((i) => (
                <li class="export-item">
                  <p class="export-meta">
                    <strong>{t(L, 'export.print.receivedAt', { time: formatTime(L, i.createdAt, timeZone) })}</strong> · {i.name}
                    {i.school && <> · {i.school}</>}
                  </p>
                  <div class="rich">{raw(renderIntervention(i.text))}</div>
                  <p class="export-status">
                    {t(L, 'export.print.status')} {statusLine(i, timeZone)}
                  </p>
                  {i.status === 'rejected' && i.publicMessage && (
                    <p class="export-status">
                      {t(L, 'export.print.publicMessage')} {i.publicMessage}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </body>
      </html>
    </>
  );
}
