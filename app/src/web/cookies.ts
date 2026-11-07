import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { signValue, verifyValue } from '../lib/signing.ts';
import type { Config } from '../config.ts';
import type { BureauSession } from './types.ts';

export const COOKIE = {
  access: 'ag_access',
  device: 'device',
  bureau: 'bureau',
  lang: 'lang',
} as const;

const DAY = 24 * 60 * 60;
export const ACCESS_MAX_AGE = 2 * DAY; // D3: 48 h, also bounded by the AG state
export const DEVICE_MAX_AGE = 365 * DAY; // D4
export const BUREAU_MAX_AGE_MS = 12 * 60 * 60 * 1000; // D5
export const LANG_MAX_AGE = 365 * DAY; // D16

export function baseCookie(config: Config, maxAge: number): CookieOptions {
  return { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'Lax', maxAge };
}

// ---- Participant access (D3): HMAC(SESSION_SECRET, assembly_id|code_version) ----

export function accessCookieValue(config: Config, assemblyId: number, codeVersion: number): string {
  return signValue(config.sessionSecret, 'ag_access', `${assemblyId}|${codeVersion}`);
}

export function parseAccessCookie(config: Config, value: string | undefined): { assemblyId: number; codeVersion: number } | null {
  const payload = verifyValue(config.sessionSecret, 'ag_access', value);
  const match = payload?.match(/^(\d+)\|(\d+)$/);
  if (!match) return null;
  return { assemblyId: Number(match[1]), codeVersion: Number(match[2]) };
}

export function setAccessCookie(c: Context, config: Config, assemblyId: number, codeVersion: number): void {
  setCookie(c, COOKIE.access, accessCookieValue(config, assemblyId, codeVersion), baseCookie(config, ACCESS_MAX_AGE));
}

// ---- Bureau session (D5): signed name + expiry ----

export function bureauCookieValue(config: Config, session: BureauSession): string {
  const payload = `${Buffer.from(session.name, 'utf8').toString('base64url')}|${session.expiresAt}`;
  return signValue(config.sessionSecret, 'bureau', payload);
}

export function parseBureauCookie(config: Config, value: string | undefined, now: number): BureauSession | null {
  const payload = verifyValue(config.sessionSecret, 'bureau', value);
  const match = payload?.match(/^([A-Za-z0-9_-]*)\|(\d+)$/);
  if (!match) return null;
  const expiresAt = Number(match[2]);
  if (expiresAt <= now) return null;
  return { name: Buffer.from(match[1]!, 'base64url').toString('utf8'), expiresAt };
}

export function setBureauCookie(c: Context, config: Config, session: BureauSession, now: number): void {
  const maxAge = Math.max(0, Math.floor((session.expiresAt - now) / 1000));
  setCookie(c, COOKIE.bureau, bureauCookieValue(config, session), { ...baseCookie(config, maxAge), sameSite: 'Strict' });
}

export function clearBureauCookie(c: Context, config: Config): void {
  deleteCookie(c, COOKIE.bureau, { path: '/', secure: config.secureCookies });
}

export { getCookie };
