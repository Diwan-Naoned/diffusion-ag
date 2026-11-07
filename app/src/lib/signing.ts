import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 signatures for cookie values. `purpose` separates the kinds of cookies,
 * so a value signed for one cookie is never accepted as another.
 */
export function sign(secret: string, purpose: string, payload: string): string {
  return createHmac('sha256', secret).update(`${purpose}\n${payload}`).digest('base64url');
}

export function signValue(secret: string, purpose: string, payload: string): string {
  return `${payload}.${sign(secret, purpose, payload)}`;
}

/** Returns the payload when the signature is valid, otherwise null. */
export function verifyValue(secret: string, purpose: string, value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(secret, purpose, payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return payload;
}

/** Constant-time string comparison (hashing first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'compare').update(a).digest();
  const hb = createHmac('sha256', 'compare').update(b).digest();
  return timingSafeEqual(ha, hb);
}
