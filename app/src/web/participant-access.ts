import { randomBytes } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config.ts';
import { grantsParticipantAccess } from '../domain/lifecycle.ts';
import type { Store } from '../domain/store.ts';
import type { Assembly } from '../domain/types.ts';
import { normalizeCode } from '../lib/code.ts';
import type { FixedWindowLimiter } from '../lib/ratelimit.ts';
import { CodePage, type CodePageMessage } from '../views/code-page.tsx';
import { baseCookie, COOKIE, DEVICE_MAX_AGE, parseAccessCookie, setAccessCookie } from './cookies.ts';
import type { AppEnv } from './types.ts';

export interface AccessDeps {
  config: Config;
  store: Store;
  /** Failed code attempts per client IP (10 / 10 min). */
  codeLimiter: FixedWindowLimiter;
}

/** The AG a participant cookie grants access to, or null (wrong signature, old code, deleted AG). */
export function assemblyFromAccessCookie(deps: AccessDeps, value: string | undefined): Assembly | null {
  const parsed = parseAccessCookie(deps.config, value);
  if (!parsed) return null;
  const ag = deps.store.getAssembly(parsed.assemblyId);
  if (!ag || ag.codeVersion !== parsed.codeVersion || !grantsParticipantAccess(ag)) return null;
  return ag;
}

export type CodeCheck = { ok: true; assembly: Assembly } | { ok: false; reason: 'invalid' | 'tooMany' };

/** Checks a typed or linked code, with the per-IP limit on failures checked first (spec: 11th attempt refused). */
export function checkCode(deps: AccessDeps, ip: string, input: string): CodeCheck {
  if (deps.codeLimiter.isLimited(ip)) return { ok: false, reason: 'tooMany' };
  const code = normalizeCode(input);
  const ag = code ? deps.store.findByCode(code) : null;
  if (!ag || !grantsParticipantAccess(ag)) {
    deps.codeLimiter.hit(ip);
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, assembly: ag };
}

/** D4: a random device id, issued on first authorized access and kept for a year. */
export function ensureDeviceId(c: Context, config: Config): string {
  const existing = getCookie(c, COOKIE.device);
  if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
  const id = randomBytes(16).toString('hex');
  setCookie(c, COOKIE.device, id, baseCookie(config, DEVICE_MAX_AGE));
  return id;
}

function pathWithQuery(url: URL): string {
  return url.pathname + url.search;
}

export function renderCodePage(c: Context<AppEnv>, message: CodePageMessage, next: string, status: 401 | 429 = 401) {
  const path = pathWithQuery(new URL(c.req.url));
  return c.html(CodePage({ tr: c.get('tr'), path, message, next }), status);
}

/**
 * Guards participant pages and APIs (D3 order: rate limit → ?c= → cookie check).
 * Pages without access get the code page (401); API requests get 401 JSON.
 */
export function participantAccess(deps: AccessDeps, kind: 'page' | 'api'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const url = new URL(c.req.url);

    const linkCode = url.searchParams.get('c');
    if (linkCode !== null && kind === 'page') {
      url.searchParams.delete('c');
      const clean = pathWithQuery(url);
      const check = checkCode(deps, c.get('clientIp'), linkCode);
      if (!check.ok) return renderCodePage(c, check.reason, clean, check.reason === 'tooMany' ? 429 : 401);
      setAccessCookie(c, deps.config, check.assembly.id, check.assembly.codeVersion);
      ensureDeviceId(c, deps.config);
      return c.redirect(clean, 302);
    }

    const ag = assemblyFromAccessCookie(deps, getCookie(c, COOKIE.access));
    if (!ag) {
      if (kind === 'api') return c.json({ error: 'unauthorized' }, 401);
      return renderCodePage(c, null, pathWithQuery(url));
    }
    c.set('access', { assemblyId: ag.id, deviceId: ensureDeviceId(c, deps.config) });
    await next();
  };
}
