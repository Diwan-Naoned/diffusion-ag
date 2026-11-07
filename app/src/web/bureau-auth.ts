import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../app.ts';
import { safeEqual } from '../lib/signing.ts';
import { BureauLoginPage } from '../views/bureau-login.tsx';
import { BUREAU_MAX_AGE_MS, clearBureauCookie, COOKIE, parseBureauCookie, setBureauCookie } from './cookies.ts';
import type { AppEnv } from './types.ts';

function safeBureauPath(next: unknown): string {
  return typeof next === 'string' && /^\/bureau(\/[^/\\]|$|\?)/.test(next) && !next.startsWith('/bureau/login') ? next : '/bureau';
}

export function bureauAuthRoutes(ctx: AppContext) {
  const app = new Hono<AppEnv>();

  app.get('/bureau/login', (c) => {
    if (parseBureauCookie(ctx.config, getCookie(c, COOKIE.bureau), ctx.clock())) return c.redirect('/bureau', 303);
    return c.html(BureauLoginPage({ tr: c.get('tr'), error: null, name: '', next: safeBureauPath(c.req.query('next')) }));
  });

  app.post('/bureau/login', async (c) => {
    const form = await c.req.parseBody();
    const name = typeof form.name === 'string' ? form.name.trim().slice(0, 60) : '';
    const next = safeBureauPath(form.next);
    const ip = c.get('clientIp');
    const page = (error: 'password' | 'name' | 'tooMany', status: 401 | 400 | 429) =>
      c.html(BureauLoginPage({ tr: c.get('tr'), error, name, next }), status);

    if (ctx.limiters.bureauLogin.isLimited(ip)) return page('tooMany', 429);
    const password = typeof form.password === 'string' ? form.password : '';
    if (!safeEqual(password, ctx.config.bureauPassword)) {
      ctx.limiters.bureauLogin.hit(ip);
      return page('password', 401);
    }
    if (!name) return page('name', 400);
    const now = ctx.clock();
    setBureauCookie(c, ctx.config, { name, expiresAt: now + BUREAU_MAX_AGE_MS }, now);
    return c.redirect(next, 303);
  });

  app.post('/bureau/logout', (c) => {
    clearBureauCookie(c, ctx.config);
    return c.redirect('/bureau/login', 303);
  });

  return app;
}

/**
 * Bureau guard (D5): a valid `bureau` session is required; the participant cookie never grants it.
 * Pages redirect to the login page, APIs answer 401.
 */
export function bureauGuard(ctx: AppContext): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = parseBureauCookie(ctx.config, getCookie(c, COOKIE.bureau), ctx.clock());
    if (!session) {
      if (c.req.path.startsWith('/bureau/api/')) return c.json({ error: 'unauthorized' }, 401);
      const url = new URL(c.req.url);
      const back = c.req.method === 'GET' ? `?next=${encodeURIComponent(url.pathname + url.search)}` : '';
      return c.redirect(`/bureau/login${back}`, 303);
    }
    c.set('bureau', session);
    await next();
  };
}
