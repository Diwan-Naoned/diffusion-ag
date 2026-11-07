import { describe, expect, it } from 'vitest';
import { Client, loginBureau, makeTestApp } from './helpers.ts';
import { SseReader } from './sse-reader.ts';

async function setup(options: { delay?: number } = {}) {
  const t = makeTestApp();
  const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
  t.store.lifecycle(ag.id, 'open', 'Anna');
  if (options.delay !== undefined) t.store.updateSettings(ag.id, { minDelaySeconds: options.delay }, 'Anna');
  const participant = async (ip = '203.0.113.10') => {
    const c = new Client(t.app, ip);
    await c.postForm('/code', { code: ag.code! });
    return c;
  };
  const bureau = new Client(t.app);
  await loginBureau(bureau, 'Anna');
  return { ...t, ag, participant, bureau };
}

const submit = (c: Client, body: Record<string, unknown>) => c.postJson('/api/interventions', body);

describe('POST /api/interventions', () => {
  it('stores a valid submission as queued with its reception time', async () => {
    const t = await setup();
    const p = await t.participant();
    const res = await submit(p, { name: ' Gwen M. ', school: 'Skol Diwan Kemper', text: ' Une **question** ' });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.item).toEqual({
      id: 1,
      createdAt: t.clock(),
      status: 'queued',
      statusAt: null,
      publicMessage: null,
      html: '<p>Une <strong>question</strong></p>',
    });
    expect(body.nextAllowedAt).toBe(t.clock() + 60_000);
    const stored = t.store.getIntervention(1)!;
    expect(stored).toMatchObject({ name: 'Gwen M.', school: 'Skol Diwan Kemper', text: 'Une **question**', status: 'queued' });
    const mine = (await (await p.get('/api/mine')).json()) as any;
    expect(mine.items.map((i: any) => i.id)).toEqual([1]);
  });

  it('refuses when submissions are closed or the AG has not started', async () => {
    const t = await setup();
    const p = await t.participant();
    t.store.lifecycle(t.ag.id, 'close_submissions', 'Anna');
    const closed = await submit(p, { name: 'Gwen', text: 'x' });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({ error: 'closed' });

    const other = t.store.createAssembly({ name: 'Prépa', date: '2027-01-01' });
    const early = new Client(t.app);
    await early.postForm('/code', { code: other.code! });
    expect((await submit(early, { name: 'Gwen', text: 'x' })).status).toBe(409);
  });

  it('names the field that is missing or too long', async () => {
    const t = await setup({ delay: 0 });
    const p = await t.participant();
    const cases: [Record<string, unknown>, Record<string, unknown>][] = [
      [{ name: '   ', text: 'x' }, { field: 'name', reason: 'required' }],
      [{ text: 'x' }, { field: 'name', reason: 'required' }],
      [{ name: 'Gwen', text: ' \n ' }, { field: 'text', reason: 'required' }],
      [{ name: 'x'.repeat(101), text: 'x' }, { field: 'name', reason: 'too_long', max: 100 }],
      [{ name: 'Gwen', school: 'x'.repeat(101), text: 'x' }, { field: 'school', reason: 'too_long', max: 100 }],
      [{ name: 'Gwen', text: 'x'.repeat(1001) }, { field: 'text', reason: 'too_long', max: 1000 }],
    ];
    for (const [body, expected] of cases) {
      const res = await submit(p, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid', ...expected });
    }
    expect((await submit(p, { name: 'x'.repeat(100), school: 'é'.repeat(100), text: '😀'.repeat(1000) })).status).toBe(201);
    expect(t.store.listInterventions(t.ag.id)).toHaveLength(1);
  });

  it("uses the AG's current character limit", async () => {
    const t = await setup({ delay: 0 });
    const p = await t.participant();
    t.store.updateSettings(t.ag.id, { maxChars: 400 }, 'Anna');
    expect(await (await submit(p, { name: 'Gwen', text: 'x'.repeat(401) })).json()).toMatchObject({ field: 'text', max: 400 });
    expect((await submit(p, { name: 'Gwen', text: 'x'.repeat(400) })).status).toBe(201);
  });

  it('refuses a submission before the minimum delay and returns the next allowed time', async () => {
    const t = await setup({ delay: 120 });
    const p = await t.participant();
    expect((await submit(p, { name: 'Gwen', text: 'un' })).status).toBe(201);
    const first = t.clock();
    t.clock.advance(40_000);
    const early = await submit(p, { name: 'Gwen', text: 'deux' });
    expect(early.status).toBe(429);
    const body = (await early.json()) as any;
    expect(body).toEqual({ error: 'too_early', nextAllowedAt: first + 120_000, serverNow: t.clock() });
    expect(body.nextAllowedAt - body.serverNow).toBe(80_000); // the form shows 1:20
    t.clock.advance(80_000);
    expect((await submit(p, { name: 'Gwen', text: 'deux' })).status).toBe(201);
  });

  it('applies the delay per device, not to other devices', async () => {
    const t = await setup({ delay: 120 });
    const a = await t.participant();
    const b = await t.participant();
    expect((await submit(a, { name: 'A', text: 'x' })).status).toBe(201);
    expect((await submit(b, { name: 'B', text: 'x' })).status).toBe(201);
  });

  it('accepts two submissions in a row with no delay', async () => {
    const t = await setup({ delay: 0 });
    const p = await t.participant();
    expect((await submit(p, { name: 'Gwen', text: 'un' })).status).toBe(201);
    expect((await submit(p, { name: 'Gwen', text: 'deux' })).status).toBe(201);
  });

  it('applies a raised delay to the next submission', async () => {
    const t = await setup({ delay: 60 });
    const p = await t.participant();
    await submit(p, { name: 'Gwen', text: 'un' });
    t.clock.advance(90_000);
    t.store.updateSettings(t.ag.id, { minDelaySeconds: 300 }, 'Anna');
    const res = await submit(p, { name: 'Gwen', text: 'deux' });
    expect(res.status).toBe(429);
    expect(((await res.json()) as any).nextAllowedAt - t.clock()).toBe(210_000);
  });

  it('refuses the 31st submission in 10 minutes from one address, whatever the device', async () => {
    const t = await setup({ delay: 0 });
    for (let i = 0; i < 30; i++) {
      const bot = await t.participant('192.0.2.77'); // new device each time
      expect((await submit(bot, { name: `Bot ${i}`, text: 'spam' })).status).toBe(201);
    }
    const bot = await t.participant('192.0.2.77');
    const res = await submit(bot, { name: 'Bot', text: 'spam' });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'rate_limited' });
    expect((await submit(await t.participant('192.0.2.78'), { name: 'Other', text: 'ok' })).status).toBe(201);
    t.clock.advance(10 * 60 * 1000);
    expect((await submit(bot, { name: 'Bot', text: 'later' })).status).toBe(201);
  });

  it('rejects non-JSON bodies', async () => {
    const t = await setup();
    const p = await t.participant();
    expect((await p.postForm('/api/interventions', { name: 'Gwen', text: 'x' })).status).toBe(400);
  });
});

describe('participant event stream (D6)', () => {
  it('sends the AG state, limits, next allowed time and own interventions only, without private notes', async () => {
    const t = await setup({ delay: 60 });
    const me = await t.participant();
    const other = await t.participant();
    await submit(me, { name: 'Gwen', text: 'mienne' });
    await submit(other, { name: 'Ronan', text: 'autre' });
    t.store.moderate(2, 'reject', 'Anna', { publicMessage: 'Hors sujet', privateNote: 'SECRET-NOTE-2' });

    const stream = new SseReader(await me.get('/api/events'));
    const snap = (await stream.waitFor((m) => m.event === 'snapshot')).data as any;
    expect(snap.assembly).toMatchObject({ state: 'in_progress', submissionsOpen: true, maxChars: 1000, minDelaySeconds: 60 });
    expect(snap.nextAllowedAt).toBe(t.clock() + 60_000);
    expect(snap.serverNow).toBe(t.clock());
    expect(snap.mine.map((i: any) => i.id)).toEqual([1]);

    // Another device's intervention changes: nothing for me.
    t.store.moderate(2, 'requeue', 'Anna');
    // Mine is rejected with a private note: I get the public message only.
    t.store.moderate(1, 'reject', 'Anna', { publicMessage: 'Question déjà posée', privateNote: 'SECRET-NOTE-1' });
    const delta = await stream.waitFor((m) => m.event === 'delta' && (m.data as any).type === 'intervention');
    expect((delta.data as any).item).toEqual({
      id: 1,
      createdAt: snap.mine[0].createdAt,
      status: 'rejected',
      statusAt: t.clock(),
      publicMessage: 'Question déjà posée',
      html: '<p>mienne</p>',
    });
    t.store.updateSettings(t.ag.id, { maxChars: 400 }, 'Anna');
    await stream.waitFor((m) => m.event === 'delta' && (m.data as any).assembly?.maxChars === 400);

    const all = JSON.stringify(stream.messages);
    expect(all).not.toContain('SECRET-NOTE');
    expect(all).not.toContain('privateNote');
    expect(all).not.toContain('Ronan');
    expect(all).not.toContain('autre');
    expect(all).not.toContain('statusBy');
    expect(stream.messages.filter((m) => m.event === 'delta' && (m.data as any).type === 'intervention')).toHaveLength(1);
    await stream.close();

    const mine = await (await me.get('/api/mine')).text();
    expect(mine).toContain('Question déjà posée');
    expect(mine).not.toContain('SECRET-NOTE');
    expect(mine).not.toContain('privateNote');
  });

  it('pushes my own submission and the new next allowed time', async () => {
    const t = await setup({ delay: 60 });
    const me = await t.participant();
    const stream = new SseReader(await me.get('/api/events'));
    await stream.waitFor((m) => m.event === 'snapshot');
    await submit(me, { name: 'Gwen', text: 'nouvelle' });
    const d = (await stream.waitFor((m) => (m.data as any)?.type === 'intervention')).data as any;
    expect(d.item.status).toBe('queued');
    expect(d.nextAllowedAt).toBe(t.clock() + 60_000);
    await stream.close();
  });

  it('catches up after a reconnection with a fresh snapshot', async () => {
    const t = await setup();
    const me = await t.participant();
    await submit(me, { name: 'Gwen', text: 'x' });
    const first = new SseReader(await me.get('/api/events'));
    const snap = await first.waitFor((m) => m.event === 'snapshot');
    await first.close(); // network switch
    t.clock.advance(5000);
    t.store.moderate(1, 'read', 'Anna'); // during the interruption
    const again = new SseReader(await me.get('/api/events', { 'last-event-id': snap.id! }));
    const fresh = (await again.waitFor((m) => m.event === 'snapshot')).data as any;
    expect(fresh.mine[0]).toMatchObject({ status: 'read', statusAt: t.clock() });
    await again.close();
  });
});

describe('Bureau moderation API', () => {
  async function withItem() {
    const t = await setup();
    const p = await t.participant();
    await submit(p, { name: 'Gwen', text: 'Bonjour' });
    const mod = (action: string, body: Record<string, unknown> = {}) => t.bureau.postJson(`/bureau/api/interventions/1/${action}`, body);
    return { ...t, p, mod };
  }

  it('marks as read with the time and the member name, and logs it', async () => {
    const t = await withItem();
    t.clock.advance(60_000);
    const res = await t.mod('read');
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).item).toMatchObject({ status: 'read', statusAt: t.clock(), statusBy: 'Anna' });
    expect(t.store.interventionEvents(1)).toEqual([
      { id: 1, interventionId: 1, fromStatus: 'queued', toStatus: 'read', by: 'Anna', at: t.clock(), publicMessage: null, privateNote: null },
    ]);
  });

  it('requires a public message to reject, and stores both texts as written', async () => {
    const t = await withItem();
    const empty = await t.mod('reject', { publicMessage: '   ', privateNote: 'note' });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({ error: 'public_message_required' });
    expect(t.store.getIntervention(1)!.status).toBe('queued');

    const res = await t.mod('reject', { publicMessage: 'Déjà posée — merci !', privateNote: 'posée par Ronan à 14:02' });
    expect(res.status).toBe(200);
    expect(t.store.getIntervention(1)).toMatchObject({
      status: 'rejected',
      statusBy: 'Anna',
      publicMessage: 'Déjà posée — merci !',
      privateNote: 'posée par Ronan à 14:02',
    });
    expect(t.store.interventionEvents(1)[0]).toMatchObject({
      fromStatus: 'queued', toStatus: 'rejected', publicMessage: 'Déjà posée — merci !', privateNote: 'posée par Ronan à 14:02',
    });
  });

  it('puts read and rejected interventions back in the queue, keeping the history', async () => {
    const t = await withItem();
    await t.mod('read');
    const back = await t.mod('requeue');
    expect(((await back.json()) as any).item).toMatchObject({ status: 'queued', statusBy: 'Anna', publicMessage: null, privateNote: null });
    await t.mod('reject', { publicMessage: 'Hors sujet' });
    await t.mod('requeue');
    expect(t.store.interventionEvents(1).map((e) => `${e.fromStatus}>${e.toStatus}`)).toEqual([
      'queued>read', 'read>queued', 'queued>rejected', 'rejected>queued',
    ]);
    const mine = (await (await t.p.get('/api/mine')).json()) as any;
    expect(mine.items[0]).toMatchObject({ status: 'queued', publicMessage: null });
  });

  it('refuses transitions that make no sense', async () => {
    const t = await withItem();
    expect((await t.mod('requeue')).status).toBe(409);
    await t.mod('read');
    expect((await t.mod('read')).status).toBe(409);
    expect((await t.mod('reject', { publicMessage: 'x' })).status).toBe(409);
    expect((await t.mod('explode')).status).toBe(404);
    expect((await t.bureau.postJson('/bureau/api/interventions/99/read', {})).status).toBe(404);
  });

  it('records the name of whoever acts', async () => {
    const t = await withItem();
    const other = new Client(t.app);
    await loginBureau(other, 'Erwan');
    await other.postJson('/bureau/api/interventions/1/read', {});
    expect(t.store.getIntervention(1)!.statusBy).toBe('Erwan');
  });

  it('publishes every change to all Bureau streams', async () => {
    const t = await withItem();
    const other = new Client(t.app);
    await loginBureau(other, 'Erwan');
    const stream = new SseReader(await other.get(`/bureau/api/ag/${t.ag.id}/events`));
    const snap = (await stream.waitFor((m) => m.event === 'snapshot')).data as any;
    expect(snap.items[0]).toMatchObject({ id: 1, name: 'Gwen', status: 'queued' });
    await t.mod('read');
    const d = (await stream.waitFor((m) => m.event === 'delta')).data as any;
    expect(d).toMatchObject({ type: 'intervention', item: { id: 1, status: 'read', statusBy: 'Anna' } });
    // New interventions arrive too.
    t.clock.advance(120_000);
    await submit(t.p, { name: 'Gwen', text: 'Deuxième' });
    const d2 = (await stream.waitFor((m) => (m.data as any)?.item?.id === 2)).data as any;
    expect(d2.item).toMatchObject({ status: 'queued', excerpt: 'Deuxième', words: 1 });
    await stream.close();
  });

  it('is frozen once deletion is scheduled', async () => {
    const t = await withItem();
    t.store.lifecycle(t.ag.id, 'end', 'Anna');
    expect((await t.mod('read')).status).toBe(200); // still possible once ended
    t.store.recordExportOpened(t.ag.id);
    t.store.lifecycle(t.ag.id, 'confirm_export', 'Anna');
    t.store.lifecycle(t.ag.id, 'schedule_deletion', 'Anna');
    expect((await t.mod('requeue')).status).toBe(409);
  });
});

describe('Régulation settings API', () => {
  const put = (t: Awaited<ReturnType<typeof setup>>, body: Record<string, unknown>) =>
    t.bureau.postJson(`/bureau/api/ag/${t.ag.id}/settings`, body);

  it('accepts values on the steps and within range, and logs who changed what', async () => {
    const t = await setup();
    for (const v of [0, 30, 600]) expect((await put(t, { minDelaySeconds: v })).status, String(v)).toBe(200);
    for (const v of [100, 150, 2000]) expect((await put(t, { maxChars: v })).status, String(v)).toBe(200);
    const res = await put(t, { minDelaySeconds: 120, maxChars: 400 });
    expect(((await res.json()) as any).assembly).toMatchObject({ minDelaySeconds: 120, maxChars: 400 });
    const events = t.store.settingsEvents(t.ag.id);
    expect(events.at(-2)).toMatchObject({ setting: 'min_delay_seconds', oldValue: '600', newValue: '120', by: 'Anna', at: t.clock() });
    expect(events.at(-1)).toMatchObject({ setting: 'max_chars', oldValue: '2000', newValue: '400', by: 'Anna' });
  });

  it('refuses values out of range or off the steps', async () => {
    const t = await setup();
    const bad: Record<string, unknown>[] = [
      { minDelaySeconds: -30 }, { minDelaySeconds: 630 }, { minDelaySeconds: 45 }, { minDelaySeconds: 1.5 },
      { minDelaySeconds: '60s' }, { maxChars: 50 }, { maxChars: 2050 }, { maxChars: 125 }, { maxChars: null }, {},
    ];
    for (const body of bad) {
      const res = await put(t, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(t.store.getAssembly(t.ag.id)).toMatchObject({ minDelaySeconds: 60, maxChars: 1000 });
    expect(t.store.settingsEvents(t.ag.id)).toEqual([]);
  });

  it('broadcasts changes to participants and Bureau within the stream', async () => {
    const t = await setup();
    const p = await t.participant();
    const ps = new SseReader(await p.get('/api/events'));
    await ps.waitFor((m) => m.event === 'snapshot');
    await put(t, { maxChars: 400 });
    const d = (await ps.waitFor((m) => m.event === 'delta')).data as any;
    expect(d).toMatchObject({ type: 'assembly', assembly: { maxChars: 400 } });
    await ps.close();
  });

  it('does not log or broadcast a value that did not change', async () => {
    const t = await setup();
    await put(t, { maxChars: 1000 });
    expect(t.store.settingsEvents(t.ag.id)).toEqual([]);
  });

  it('has the spec defaults: 1 minute and 1000 characters', async () => {
    const t = await setup();
    expect(t.store.getAssembly(t.ag.id)).toMatchObject({ minDelaySeconds: 60, maxChars: 1000 });
  });
});
