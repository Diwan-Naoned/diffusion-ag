import { Hono } from 'hono';
import type { AppContext } from '../app.ts';
import { safeBackPath } from './lang.ts';
import { checkCode, ensureDeviceId, participantAccess, renderCodePage, type AccessDeps } from './participant-access.ts';
import { setAccessCookie } from './cookies.ts';
import { participantApiRoutes } from './participant-api.ts';
import type { AppEnv } from './types.ts';
import { LIMITS } from '../domain/types.ts';
import { publicAssembly, publicIntervention } from '../domain/views.ts';
import { pickStrings, type Key } from '../i18n/index.ts';
import { HomePage } from '../views/home.tsx';
import { ParticipantPage } from '../views/participant.tsx';
import { SallePage } from '../views/salle.tsx';

/** Strings the participant module needs (D16: embedded in the page, never fetched). */
const PARTICIPANT_STRINGS: Key[] = [
  'stream.a.label',
  'stream.b.label',
  'stream.playerTitle',
  'form.counter',
  'form.overLimit',
  'form.send',
  'form.sending',
  'form.wait',
  'form.notOpen',
  'form.closed',
  'form.error.name.required',
  'form.error.name.too_long',
  'form.error.school.too_long',
  'form.error.text.required',
  'form.error.text.too_long',
  'form.error.too_early',
  'form.error.rate_limited',
  'form.error.closed',
  'form.error.network',
  'mine.sentAt',
  'status.queued',
  'status.read',
  'status.rejected',
];

const SALLE_STRINGS: Key[] = [
  'salle.listen',
  'salle.resume',
  'salle.state.idle',
  'salle.state.connecting',
  'salle.state.playing',
  'salle.state.reconnecting',
  'salle.state.offline',
  'salle.state.paused',
  'salle.unsupported',
  'salle.mediaTitle',
];

/**
 * referrerpolicy of the YouTube iframe (D9). The page itself always sends
 * Referrer-Policy: no-referrer; see docs/decisions.md for why the embed differs.
 */
export const EMBED_REFERRER_POLICY = 'strict-origin';

export function participantRoutes(ctx: AppContext) {
  const deps: AccessDeps = { config: ctx.config, store: ctx.store, codeLimiter: ctx.limiters.code };
  const app = new Hono<AppEnv>();

  // Typed code fallback.
  app.post('/code', async (c) => {
    const form = await c.req.parseBody();
    const next = safeBackPath(form.next);
    const check = checkCode(deps, c.get('clientIp'), typeof form.code === 'string' ? form.code : '');
    if (!check.ok) return renderCodePage(c, check.reason, next, check.reason === 'tooMany' ? 429 : 401);
    setAccessCookie(c, ctx.config, check.assembly.id, check.assembly.codeVersion);
    ensureDeviceId(c, ctx.config);
    return c.redirect(next, 303);
  });

  app.use('/', participantAccess(deps, 'page'));
  app.use('/distance', participantAccess(deps, 'page'));
  app.use('/salle', participantAccess(deps, 'page'));
  app.use('/api/*', participantAccess(deps, 'api'));

  // Landing page (from the participant link and the room QR code): in the room or remote.
  app.get('/', (c) => {
    const ag = ctx.store.getAssembly(c.get('access').assemblyId)!;
    return c.html(HomePage({ tr: c.get('tr'), ag }));
  });

  app.get('/distance', (c) => {
    const { assemblyId, deviceId } = c.get('access');
    const ag = ctx.store.getAssembly(assemblyId)!;
    const tr = c.get('tr');
    return c.html(
      ParticipantPage({
        tr,
        data: {
          lang: tr.lang,
          strings: pickStrings(tr.lang, PARTICIPANT_STRINGS),
          serverNow: ctx.clock(),
          assembly: publicAssembly(ag),
          nextAllowedAt: ctx.store.nextAllowedAt(ag, deviceId),
          mine: ctx.store.listForDevice(assemblyId, deviceId).map(publicIntervention),
          limits: { nameMax: LIMITS.nameMax, schoolMax: LIMITS.schoolMax },
          embedReferrerPolicy: EMBED_REFERRER_POLICY,
        },
      }),
    );
  });
  app.get('/salle', (c) => {
    const ag = ctx.store.getAssembly(c.get('access').assemblyId)!;
    const tr = c.get('tr');
    return c.html(
      SallePage({
        tr,
        ag,
        data: {
          lang: tr.lang,
          strings: pickStrings(tr.lang, SALLE_STRINGS),
          whepUrl: '/media/trad/whep',
          agName: ag.name,
        },
      }),
    );
  });

  app.route('/', participantApiRoutes(ctx));

  return app;
}
