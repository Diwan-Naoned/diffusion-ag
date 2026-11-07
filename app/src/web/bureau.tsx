import { Hono, type Context } from 'hono';
import QRCode from 'qrcode';
import type { AppContext } from '../app.ts';
import { canExport, LIFECYCLE_ACTIONS, type LifecycleAction } from '../domain/lifecycle.ts';
import { LIMITS, type Assembly } from '../domain/types.ts';
import { bureauAssembly, bureauIntervention } from '../domain/views.ts';
import { csvFilename, interventionsCsv } from '../exports/csv.ts';
import { pickStrings, type Key } from '../i18n/index.ts';
import { parseYoutubeId } from '../lib/youtube.ts';
import { DashboardPage, REJECT_CHIPS } from '../views/dashboard.tsx';
import { ExportPrintPage } from '../views/export-print.tsx';
import { AssembliesPage, QrPrintPage, SettingsPage, type Flash } from '../views/settings.tsx';
import { bureauApiRoutes } from './bureau-api.ts';
import { bureauGuard } from './bureau-auth.ts';
import type { AppEnv } from './types.ts';

/** Strings the dashboard module needs (D16: embedded in the page, never fetched). */
const DASHBOARD_STRINGS: Key[] = [
  'app.error',
  'bureau.deletionBanner',
  'dash.receptionOpen',
  'dash.receptionClosed',
  'dash.toggleReception',
  'dash.notOpened',
  'dash.ended',
  'dash.tab.queued',
  'dash.tab.read',
  'dash.tab.rejected',
  'dash.tab.all',
  'dash.receivedAt',
  'dash.words',
  'dash.badge.queued',
  'dash.badge.read',
  'dash.badge.rejected',
  'dash.by',
  'dash.publicMessage',
  'dash.privateNote',
  'dash.open',
  'dash.markRead',
  'dash.requeue',
  'dash.reject',
  'reading.position',
  'reject.publicRequired',
  'reg.chars',
  'reg.saved',
  'reg.error',
  'duration.none',
  'duration.seconds',
  'duration.minutes',
  'duration.minutesSeconds',
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function participantLink(ctx: AppContext, ag: Assembly): string | null {
  return ag.code ? `${ctx.config.publicUrl}/?c=${ag.code}` : null;
}

function flashFrom(c: Context): Flash {
  return { ok: c.req.query('ok'), error: c.req.query('error') };
}

export function bureauRoutes(ctx: AppContext) {
  const { store } = ctx;
  const app = new Hono<AppEnv>();
  app.use('/bureau', bureauGuard(ctx));
  app.use('/bureau/*', bureauGuard(ctx));

  app.get('/bureau/api/ping', (c) => c.body(null, 204));
  app.route('/', bureauApiRoutes(ctx));

  const scheduled = () => {
    const active = store.activeAssembly();
    return active?.state === 'deletion_scheduled' ? active : null;
  };
  const common = (c: Context<AppEnv>) => ({
    tr: c.get('tr'),
    session: c.get('bureau'),
    timeZone: ctx.config.timeZone,
    scheduled: scheduled(),
    flash: flashFrom(c),
  });
  const loadAg = (c: Context<AppEnv>) => store.getAssembly(Number(c.req.param('id')));

  app.get('/bureau', (c) => {
    const ag = store.currentAssembly();
    return c.redirect(ag ? `/bureau/ag/${ag.id}` : '/bureau/ags', 303);
  });

  // ---- AG list and creation ----

  app.get('/bureau/ags', (c) =>
    c.html(AssembliesPage({ ...common(c), assemblies: store.listAssemblies(), current: store.currentAssembly() })),
  );

  app.post('/bureau/ags', async (c) => {
    const form = await c.req.parseBody();
    const name = typeof form.name === 'string' ? form.name.trim() : '';
    const date = typeof form.date === 'string' ? form.date : '';
    if (!name || name.length > LIMITS.assemblyNameMax || !ISO_DATE.test(date)) return c.redirect('/bureau/ags?error=invalid', 303);
    const ag = store.createAssembly({ name, date });
    return c.redirect(`/bureau/ag/${ag.id}/settings`, 303);
  });

  // ---- Dashboard ----

  app.get('/bureau/ag/:id', (c) => {
    const ag = loadAg(c);
    if (!ag) return c.redirect('/bureau/ags', 303);
    if (ag.state === 'deleted') return c.redirect(`/bureau/ag/${ag.id}/settings`, 303);
    const tr = c.get('tr');
    return c.html(
      DashboardPage({
        ...common(c),
        ag,
        data: {
          lang: tr.lang,
          strings: pickStrings(tr.lang, DASHBOARD_STRINGS),
          chips: REJECT_CHIPS,
          agId: ag.id,
          serverNow: ctx.clock(),
          assembly: bureauAssembly(ag),
          items: store.listInterventions(ag.id).map(bureauIntervention),
          limits: { delay: LIMITS.delay, maxChars: LIMITS.maxChars },
        },
      }),
    );
  });

  // ---- Settings ----

  app.get('/bureau/ag/:id/settings', async (c) => {
    const ag = loadAg(c);
    if (!ag) return c.redirect('/bureau/ags', 303);
    const link = participantLink(ctx, ag);
    const qrSvg = link ? await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) : null;
    return c.html(SettingsPage({ ...common(c), ag, link, qrSvg }));
  });

  app.post('/bureau/ag/:id/details', async (c) => {
    const id = Number(c.req.param('id'));
    const form = await c.req.parseBody();
    const name = typeof form.name === 'string' ? form.name.trim() : '';
    const date = typeof form.date === 'string' ? form.date : '';
    const youtubeAId = parseYoutubeId(typeof form.youtubeA === 'string' ? form.youtubeA : '');
    const youtubeBId = parseYoutubeId(typeof form.youtubeB === 'string' ? form.youtubeB : '');
    const back = `/bureau/ag/${id}/settings`;
    if (!name || name.length > LIMITS.assemblyNameMax || !ISO_DATE.test(date)) return c.redirect(`${back}?error=invalid`, 303);
    if (youtubeAId === undefined || youtubeBId === undefined) return c.redirect(`${back}?error=youtube`, 303);
    const result = store.updateDetails(id, { name, date, youtubeAId, youtubeBId });
    if (!result.ok) return c.redirect(result.reason === 'not_found' ? '/bureau/ags' : `${back}?error=${result.reason}`, 303);
    return c.redirect(`${back}?ok=saved`, 303);
  });

  app.post('/bureau/ag/:id/regenerate-code', (c) => {
    const id = Number(c.req.param('id'));
    const result = store.regenerateCode(id);
    const back = `/bureau/ag/${id}/settings`;
    return c.redirect(result.ok ? `${back}?ok=code` : `${back}?error=${result.reason}`, 303);
  });

  app.post('/bureau/ag/:id/action/:action', (c) => {
    const id = Number(c.req.param('id'));
    const action = c.req.param('action') as LifecycleAction;
    const back = `/bureau/ag/${id}/settings`;
    if (!LIFECYCLE_ACTIONS.includes(action)) return c.redirect(`${back}?error=invalid_state`, 303);
    const result = store.lifecycle(id, action, c.get('bureau').name);
    const anchor = ['confirm_export', 'schedule_deletion', 'cancel_deletion'].includes(action) ? '#deletion' : '';
    return c.redirect(result.ok ? `${back}?ok=${action}${anchor}` : `${back}?error=${result.reason}${anchor}`, 303);
  });

  app.get('/bureau/ag/:id/qr', async (c) => {
    const ag = loadAg(c);
    const link = ag && participantLink(ctx, ag);
    if (!ag || !link) return c.redirect('/bureau/ags', 303);
    const qrSvg = await QRCode.toString(link, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    return c.html(QrPrintPage({ tr: c.get('tr'), ag, link, qrSvg }));
  });

  // ---- Exports (D12): always French; opening one unlocks the export confirmation ----

  app.get('/bureau/ag/:id/export.csv', (c) => {
    const ag = loadAg(c);
    if (!ag || !canExport(ag)) return c.text('Export indisponible', 409);
    store.recordExportOpened(ag.id);
    const csv = interventionsCsv(store.listInterventions(ag.id), ctx.config.timeZone);
    return c.body(csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(ag)}"`,
      'Cache-Control': 'no-store',
    });
  });

  app.get('/bureau/ag/:id/export/print', (c) => {
    const ag = loadAg(c);
    if (!ag || !canExport(ag)) return c.text('Export indisponible', 409);
    store.recordExportOpened(ag.id);
    c.header('Cache-Control', 'no-store');
    return c.html(
      ExportPrintPage({ ag, items: store.listInterventions(ag.id), now: ctx.clock(), timeZone: ctx.config.timeZone }),
    );
  });

  return app;
}
