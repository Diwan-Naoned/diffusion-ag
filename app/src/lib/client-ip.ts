import { isIP } from 'node:net';

/**
 * Client IP resolution (D8): X-Forwarded-For is trusted only when the direct peer is the
 * reverse proxy (TRUSTED_PROXY_CIDR). Traefik appends the client address, so we take the
 * right-most address that is not itself a trusted proxy.
 */
export function resolveClientIp(remoteAddress: string | undefined, forwardedFor: string | undefined, trusted: string[]): string {
  const remote = normalizeIp(remoteAddress ?? '') || 'unknown';
  if (!forwardedFor || !isTrusted(remote, trusted)) return remote;
  const hops = forwardedFor
    .split(',')
    .map((s) => normalizeIp(s.trim()))
    .filter((s) => isIP(s) !== 0);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isTrusted(hops[i]!, trusted)) return hops[i]!;
  }
  return hops[0] ?? remote;
}

function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

export function isTrusted(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => inCidr(ip, cidr));
}

export function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsText] = cidr.split('/');
  if (!range) return false;
  const a = toBytes(ip);
  const b = toBytes(range);
  if (!a || !b || a.length !== b.length) return false;
  const bits = bitsText === undefined ? a.length * 8 : Number(bitsText);
  for (let i = 0; i < a.length; i++) {
    const take = Math.max(0, Math.min(8, bits - i * 8));
    if (take === 0) break;
    const mask = (0xff << (8 - take)) & 0xff;
    if ((a[i]! & mask) !== (b[i]! & mask)) return false;
  }
  return true;
}

function toBytes(ip: string): number[] | null {
  const v = isIP(ip);
  if (v === 4) return ip.split('.').map(Number);
  if (v !== 6) return null;
  const [head, tail] = ip.split('::') as [string, string | undefined];
  const parse = (s: string | undefined) => (s ? s.split(':').filter(Boolean) : []);
  let h = parse(head);
  let t = parse(tail);
  // Embedded IPv4 at the end (e.g. ::ffff:1.2.3.4).
  const last = (t.length ? t : h).at(-1);
  if (last && last.includes('.')) {
    const [p, q, r, s] = last.split('.').map(Number) as [number, number, number, number];
    const groups = [((p << 8) | q).toString(16), ((r << 8) | s).toString(16)];
    if (t.length) t = [...t.slice(0, -1), ...groups];
    else h = [...h.slice(0, -1), ...groups];
  }
  const fill = tail === undefined ? [] : Array(8 - h.length - t.length).fill('0');
  const groups = [...h, ...fill, ...t];
  if (groups.length !== 8) return null;
  return groups.flatMap((g) => {
    const n = parseInt(g, 16);
    return [n >> 8, n & 0xff];
  });
}
