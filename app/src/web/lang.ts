import { Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config.ts';
import { isLang, translator, type Lang } from '../i18n/index.ts';
import { baseCookie, COOKIE, LANG_MAX_AGE } from './cookies.ts';
import type { AppEnv } from './types.ts';

/** D16: the `lang` cookie, else Breton if Accept-Language lists it, else French. */
export function resolveLang(cookieValue: string | undefined, acceptLanguage: string | undefined): Lang {
  if (isLang(cookieValue)) return cookieValue;
  const prefersBreton = (acceptLanguage ?? '')
    .split(',')
    .map((part) => part.split(';')[0]!.trim().toLowerCase())
    .some((tag) => tag === 'br' || tag.startsWith('br-'));
  return prefersBreton ? 'br' : 'fr';
}

export const langMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const lang = resolveLang(getCookie(c, COOKIE.lang), c.req.header('accept-language'));
  c.set('lang', lang);
  c.set('tr', translator(lang));
  await next();
};

/** Only same-site paths, so the switch can't be used as an open redirect. */
export function safeBackPath(back: unknown): string {
  if (typeof back !== 'string' || !back.startsWith('/') || back.startsWith('//') || back.includes('\\')) return '/';
  return back;
}

export function langRoutes(config: Config) {
  const app = new Hono<AppEnv>();
  // POST /lang: set the cookie and go back to the same page (the page keeps no other state).
  app.post('/lang', async (c) => {
    const form = await c.req.parseBody();
    const lang = form.lang;
    if (isLang(lang)) setCookie(c, COOKIE.lang, lang, { ...baseCookie(config, LANG_MAX_AGE), httpOnly: false });
    return c.redirect(safeBackPath(form.back), 303);
  });
  return app;
}
