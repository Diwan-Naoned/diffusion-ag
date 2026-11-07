import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppContext } from '../app.ts';
import { grantsMediaAccess } from '../domain/lifecycle.ts';
import { COOKIE, parseBureauCookie } from './cookies.ts';
import { assemblyFromAccessCookie } from './participant-access.ts';
import type { AppEnv } from './types.ts';

/**
 * ForwardAuth target for the interpretation feed (D10). Traefik forwards the original request's
 * headers (cookies included). 200 for a valid participant cookie or Bureau session while an AG is
 * in progress or ended, 401 otherwise. No body, no side effects: harmless if reached from outside.
 */
export function mediaAuthRoutes(ctx: AppContext) {
  const app = new Hono<AppEnv>();
  app.all('/auth/media', (c) => {
    c.header('Cache-Control', 'no-store');
    const ag = assemblyFromAccessCookie(
      { config: ctx.config, store: ctx.store, codeLimiter: ctx.limiters.code },
      getCookie(c, COOKIE.access),
    );
    if (ag && grantsMediaAccess(ag)) return c.body(null, 200);

    const bureau = parseBureauCookie(ctx.config, getCookie(c, COOKIE.bureau), ctx.clock());
    const active = ctx.store.activeAssembly();
    if (bureau && active && grantsMediaAccess(active)) return c.body(null, 200);

    return c.body(null, 401);
  });
  return app;
}
