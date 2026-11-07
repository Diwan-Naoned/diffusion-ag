import { describe, expect, it } from 'vitest';
import { parseBureauCookie } from '../src/web/cookies.ts';
import { BUREAU_PASSWORD, Client, loginBureau, makeTestApp } from './helpers.ts';

describe('Bureau login (D5)', () => {
  it('gives a 12 h session with the display name', async () => {
    const { app, config, clock } = makeTestApp();
    const client = new Client(app);
    const res = await client.postForm('/bureau/login', { password: BUREAU_PASSWORD, name: '  Anna  ' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/bureau');
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('bureau='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Max-Age=43200/);
    const session = parseBureauCookie(config, decodeURIComponent(client.cookies.get('bureau')!), clock());
    expect(session).toEqual({ name: 'Anna', expiresAt: clock() + 12 * 3600 * 1000 });
    expect((await client.get('/bureau/api/ping')).status).toBe(204);

    clock.advance(12 * 3600 * 1000);
    expect((await client.get('/bureau/api/ping')).status).toBe(401);
  });

  it('refuses a wrong password and a missing name', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    const wrong = await client.postForm('/bureau/login', { password: 'nope', name: 'Anna' });
    expect(wrong.status).toBe(401);
    expect(await wrong.text()).toContain('Mot de passe incorrect.');
    const noName = await client.postForm('/bureau/login', { password: BUREAU_PASSWORD, name: '  ' });
    expect(noName.status).toBe(400);
    expect(client.cookies.has('bureau')).toBe(false);
  });

  it('keeps names with non-ASCII characters', async () => {
    const { app, config, clock } = makeTestApp();
    const client = new Client(app);
    await loginBureau(client, 'Maëla Le Bihan');
    expect(parseBureauCookie(config, decodeURIComponent(client.cookies.get('bureau')!), clock())?.name).toBe('Maëla Le Bihan');
  });

  it('limits failed logins per IP', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    for (let i = 0; i < 10; i++) await client.postForm('/bureau/login', { password: 'nope', name: 'x' });
    expect((await client.postForm('/bureau/login', { password: BUREAU_PASSWORD, name: 'x' })).status).toBe(429);
  });

  it('logs out', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    await loginBureau(client);
    const res = await client.postForm('/bureau/logout', {});
    expect(res.headers.get('location')).toBe('/bureau/login');
    expect(client.cookies.has('bureau')).toBe(false);
  });
});

describe('Bureau guard', () => {
  it('sends a participant with only a participant cookie to the login page', async () => {
    const { app, store } = makeTestApp();
    const ag = store.createAssembly({ name: 'AG', date: '2026-11-21' });
    store.lifecycle(ag.id, 'open', 'x');
    const client = new Client(app);
    expect((await client.get(`/?c=${ag.code}`)).status).toBe(302);
    expect(client.cookies.has('ag_access')).toBe(true);

    for (const path of ['/bureau', `/bureau/ag/${ag.id}`, `/bureau/ag/${ag.id}/settings`, '/bureau/ags']) {
      const res = await client.get(path);
      expect(res.status, path).toBe(303);
      expect(res.headers.get('location'), path).toBe(`/bureau/login?next=${encodeURIComponent(path)}`);
    }
    for (const path of ['/bureau/api/ping', `/bureau/api/ag/${ag.id}/events`]) {
      expect((await client.get(path)).status, path).toBe(401);
    }
    expect((await client.postJson(`/bureau/api/ag/${ag.id}/action/end`, {})).status).toBe(401);
  });

  it('rejects a forged or participant-signed cookie used as a Bureau session', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    client.cookies.set('bureau', 'QW5uYQ|99999999999999.forged');
    expect((await client.get('/bureau/api/ping')).status).toBe(401);
  });

  it('returns to the requested Bureau page after login', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    const res = await client.postForm('/bureau/login', { password: BUREAU_PASSWORD, name: 'Anna', next: '/bureau/ags' });
    expect(res.headers.get('location')).toBe('/bureau/ags');
    const evil = await new Client(app).postForm('/bureau/login', { password: BUREAU_PASSWORD, name: 'Anna', next: '//evil.example' });
    expect(evil.headers.get('location')).toBe('/bureau');
  });

  it('shows the login page in both languages', async () => {
    const { app } = makeTestApp();
    const fr = await (await new Client(app).get('/bureau/login')).text();
    expect(fr).toContain('Accès réservé au bureau');
    const br = await (await new Client(app).get('/bureau/login', { 'accept-language': 'br' })).text();
    expect(br).toContain('Miret evit ar burev');
    expect(br).toContain('<html lang="br">');
  });
});
