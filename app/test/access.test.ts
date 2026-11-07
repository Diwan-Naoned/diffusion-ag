import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_LENGTH, generateCode, normalizeCode } from '../src/lib/code.ts';
import { accessCookieValue, parseAccessCookie } from '../src/web/cookies.ts';
import { assemblyFromAccessCookie } from '../src/web/participant-access.ts';
import { inCidr, resolveClientIp } from '../src/lib/client-ip.ts';
import { Client, makeTestApp, testConfig } from './helpers.ts';

function setup() {
  const t = makeTestApp();
  const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
  return { ...t, ag, deps: { config: t.config, store: t.store, codeLimiter: t.app.ctx.limiters.code } };
}

describe('access code generation (D3)', () => {
  it('uses 7 characters from the unambiguous alphabet', () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });

  it('normalizes typed codes', () => {
    expect(normalizeCode(' abc-d ef7 ')).toBe('ABCDEF7');
  });

  it('generates a code when the AG is created', () => {
    const { ag } = setup();
    expect(ag.code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{7}$`));
  });
});

describe('ag_access cookie (D3)', () => {
  it('is bound to assembly_id|code_version and signed', () => {
    const config = testConfig();
    const value = accessCookieValue(config, 3, 2);
    expect(parseAccessCookie(config, value)).toEqual({ assemblyId: 3, codeVersion: 2 });
    expect(parseAccessCookie(config, value.replace('3|2', '4|2'))).toBeNull();
    expect(parseAccessCookie({ ...config, sessionSecret: 'another-secret-another-secret-12345' }, value)).toBeNull();
    expect(parseAccessCookie(config, 'garbage')).toBeNull();
  });

  it('stops granting access when the code changes', () => {
    const { ag, store, deps, config } = setup();
    const old = accessCookieValue(config, ag.id, ag.codeVersion);
    expect(assemblyFromAccessCookie(deps, old)?.id).toBe(ag.id);
    const result = store.regenerateCode(ag.id);
    expect(result.ok && result.assembly.code).not.toBe(ag.code);
    expect(assemblyFromAccessCookie(deps, old)).toBeNull();
    const fresh = accessCookieValue(config, ag.id, ag.codeVersion + 1);
    expect(assemblyFromAccessCookie(deps, fresh)?.id).toBe(ag.id);
  });
});

describe('access by link (?c=)', () => {
  it('sets the cookie and redirects to the clean URL', async () => {
    const { app, ag } = setup();
    const client = new Client(app);
    const res = await client.get(`/?c=${ag.code}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('ag_access='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=172800/);
    const page = await client.get('/');
    expect(page.status).toBe(200);
  });

  it('keeps the other query parameters and the path', async () => {
    const { app, ag } = setup();
    const res = await new Client(app).get(`/salle?x=1&c=${ag.code}`);
    expect(res.headers.get('location')).toBe('/salle?x=1');
  });

  it('shows the code page with a neutral message and no cookie for a wrong code', async () => {
    const { app } = setup();
    const client = new Client(app);
    const res = await client.get('/?c=WRONG42');
    expect(res.status).toBe(401);
    expect(res.headers.getSetCookie()).toEqual([]);
    const html = await res.text();
    expect(html).toContain("Ce code ne donne pas accès à l&#39;AG");
    expect(html).not.toContain('AG 2026');
  });
});

describe('typed code fallback', () => {
  it('accepts the code in any letter case and lands on the participant page', async () => {
    const { app, ag } = setup();
    const client = new Client(app);
    const res = await client.postForm('/code', { code: ag.code!.toLowerCase(), next: '/' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/');
    expect(client.cookies.has('ag_access')).toBe(true);
    expect((await client.get('/')).status).toBe(200);
  });

  it('works from the Breton interface and shows Breton errors', async () => {
    const { app } = setup();
    const client = new Client(app);
    const res = await client.postForm('/code', { code: 'NOPE', next: '/' }, { 'accept-language': 'br' });
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('Ar c’hod-se ne ro ket moned');
  });

  it('never redirects outside the site after a valid code', async () => {
    const { app, ag } = setup();
    const res = await new Client(app).postForm('/code', { code: ag.code!, next: '//evil.example/' });
    expect(res.headers.get('location')).toBe('/');
  });
});

describe('visitor without a code', () => {
  it('gets the code page for pages and 401 for the API, revealing nothing', async () => {
    const { app, ag } = setup();
    const client = new Client(app);
    for (const path of ['/', '/salle']) {
      const res = await client.get(path);
      expect(res.status, path).toBe(401);
      const html = await res.text();
      expect(html).toContain('action="/code"');
      expect(html).not.toContain(ag.name);
      expect(html).not.toContain(ag.code!);
    }
    for (const path of ['/api/mine', '/api/events']) {
      const res = await client.get(path);
      expect(res.status, path).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
    }
    const post = await client.postJson('/api/interventions', { name: 'x', text: 'y' });
    expect(post.status).toBe(401);
  });

  it('is sent back to the code page when the code was changed', async () => {
    const { app, ag, store } = setup();
    const client = new Client(app);
    await client.get(`/?c=${ag.code}`);
    expect((await client.get('/')).status).toBe(200);
    store.regenerateCode(ag.id);
    expect((await client.get('/')).status).toBe(401);
    expect((await client.get('/api/mine')).status).toBe(401);
  });
});

describe('code attempt rate limit (per IP)', () => {
  it('refuses the 11th failure within 10 minutes without checking the code', async () => {
    const { app, ag, clock } = setup();
    const client = new Client(app, '198.51.100.7');
    for (let i = 0; i < 10; i++) expect((await client.postForm('/code', { code: 'BAD' })).status).toBe(401);
    // Even the right code is refused now.
    const refused = await client.postForm('/code', { code: ag.code! });
    expect(refused.status).toBe(429);
    expect(await refused.text()).toContain('Trop de tentatives');
    expect(client.cookies.has('ag_access')).toBe(false);
    // Link access is limited too.
    expect((await client.get(`/?c=${ag.code}`)).status).toBe(429);
    // Another IP is not affected.
    expect((await new Client(app, '198.51.100.8').postForm('/code', { code: ag.code! })).status).toBe(303);
    // After the window, attempts are allowed again.
    clock.advance(10 * 60 * 1000);
    expect((await client.postForm('/code', { code: ag.code! })).status).toBe(303);
  });

  it('counts only failures', async () => {
    const { app, ag } = setup();
    for (let i = 0; i < 15; i++) expect((await new Client(app, '198.51.100.9').postForm('/code', { code: ag.code! })).status).toBe(303);
  });

  it('uses X-Forwarded-For only from the trusted proxy', async () => {
    const { app } = setup();
    // Behind Traefik (10.0.0.0/8 in tests): two different forwarded clients don't share the limit.
    const proxy = new Client(app, '10.0.1.2');
    for (let i = 0; i < 10; i++) await proxy.postForm('/code', { code: 'BAD' }, { 'x-forwarded-for': '192.0.2.1' });
    expect((await proxy.postForm('/code', { code: 'BAD' }, { 'x-forwarded-for': '192.0.2.1' })).status).toBe(429);
    expect((await proxy.postForm('/code', { code: 'BAD' }, { 'x-forwarded-for': '192.0.2.2' })).status).toBe(401);
    // A direct client can't escape the limit by forging the header.
    const direct = new Client(app, '192.0.2.50');
    for (let i = 0; i < 10; i++) await direct.postForm('/code', { code: 'BAD' }, { 'x-forwarded-for': `192.0.2.${100 + i}` });
    expect((await direct.postForm('/code', { code: 'BAD' }, { 'x-forwarded-for': '192.0.2.99' })).status).toBe(429);
  });
});

describe('client IP resolution', () => {
  it('matches CIDR ranges (IPv4, IPv6, mapped IPv4)', () => {
    expect(inCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(inCidr('11.1.2.3', '10.0.0.0/8')).toBe(false);
    expect(inCidr('172.18.0.5', '172.16.0.0/12')).toBe(true);
    expect(inCidr('fd00::1', 'fd00::/8')).toBe(true);
    expect(inCidr('fe80::1', 'fd00::/8')).toBe(false);
    expect(resolveClientIp('::ffff:10.0.0.2', '203.0.113.9', ['10.0.0.0/8'])).toBe('203.0.113.9');
  });

  it('takes the right-most untrusted forwarded address', () => {
    expect(resolveClientIp('10.0.0.2', '1.1.1.1, 203.0.113.9', ['10.0.0.0/8'])).toBe('203.0.113.9');
    expect(resolveClientIp('10.0.0.2', '203.0.113.9, 10.0.0.7', ['10.0.0.0/8'])).toBe('203.0.113.9');
    expect(resolveClientIp('203.0.113.1', '1.1.1.1', ['10.0.0.0/8'])).toBe('203.0.113.1');
  });
});

describe('device cookie (D4)', () => {
  it('is issued on first authorized access and persists across requests', async () => {
    const { app, ag } = setup();
    const client = new Client(app);
    expect((await client.get('/')).headers.getSetCookie().some((c) => c.startsWith('device='))).toBe(false);
    const first = await client.get(`/?c=${ag.code}`);
    const deviceCookie = first.headers.getSetCookie().find((c) => c.startsWith('device='))!;
    expect(deviceCookie).toMatch(/^device=[0-9a-f]{32};/);
    expect(deviceCookie).toMatch(/Max-Age=31536000/);
    expect(deviceCookie).toMatch(/HttpOnly/);
    const id = client.cookies.get('device');
    for (let i = 0; i < 3; i++) {
      const res = await client.get('/');
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie().some((c) => c.startsWith('device='))).toBe(false);
    }
    expect(client.cookies.get('device')).toBe(id);
  });

  it('is issued on first access by a client that already has an access cookie', async () => {
    const { app, ag } = setup();
    const client = new Client(app);
    await client.get(`/?c=${ag.code}`);
    client.cookies.delete('device');
    const res = await client.get('/');
    expect(res.headers.getSetCookie().some((c) => /^device=[0-9a-f]{32};/.test(c))).toBe(true);
  });
});
