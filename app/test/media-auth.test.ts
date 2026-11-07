import { describe, expect, it } from 'vitest';
import { Client, loginBureau, makeTestApp } from './helpers.ts';

function setup() {
  const t = makeTestApp();
  const ag = t.store.createAssembly({ name: 'AG', date: '2026-11-21' });
  return { ...t, ag };
}

async function participant(t: ReturnType<typeof setup>) {
  const client = new Client(t.app);
  await client.postForm('/code', { code: t.ag.code! });
  return client;
}

/** What Traefik ForwardAuth sends: the original cookies, plus X-Forwarded-* headers. */
function check(client: Client) {
  return client.get('/auth/media', { 'x-forwarded-method': 'POST', 'x-forwarded-uri': '/media/trad/whep' });
}

describe('GET /auth/media (D10)', () => {
  it('answers 200 with a participant cookie while the AG is in progress or ended, with no body', async () => {
    const t = setup();
    const client = await participant(t);
    expect((await check(client)).status).toBe(401); // preparation
    t.store.lifecycle(t.ag.id, 'open', 'x');
    const ok = await check(client);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('');
    t.store.lifecycle(t.ag.id, 'end', 'x');
    expect((await check(client)).status).toBe(200);
  });

  it('answers 200 with a Bureau session on an active AG', async () => {
    const t = setup();
    const client = new Client(t.app);
    await loginBureau(client);
    expect((await check(client)).status).toBe(401); // no active AG yet
    t.store.lifecycle(t.ag.id, 'open', 'x');
    expect((await check(client)).status).toBe(200);
  });

  it('answers 401 without a valid cookie or session', async () => {
    const t = setup();
    t.store.lifecycle(t.ag.id, 'open', 'x');
    expect((await check(new Client(t.app))).status).toBe(401);
    const forged = new Client(t.app);
    forged.cookies.set('ag_access', `${t.ag.id}|1.forged`);
    expect((await check(forged)).status).toBe(401);
  });

  it('answers 401 once the code has changed', async () => {
    const t = setup();
    t.store.lifecycle(t.ag.id, 'open', 'x');
    const client = await participant(t);
    expect((await check(client)).status).toBe(200);
    t.store.regenerateCode(t.ag.id);
    expect((await check(client)).status).toBe(401);
  });

  it('answers 401 while deletion is scheduled', async () => {
    const t = setup();
    t.store.lifecycle(t.ag.id, 'open', 'x');
    const client = await participant(t);
    t.store.lifecycle(t.ag.id, 'end', 'x');
    t.store.recordExportOpened(t.ag.id);
    t.store.lifecycle(t.ag.id, 'confirm_export', 'x');
    t.store.lifecycle(t.ag.id, 'schedule_deletion', 'x');
    expect((await check(client)).status).toBe(401);
  });
});
