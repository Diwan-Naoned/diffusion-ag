import { describe, expect, it } from 'vitest';
import { applyLifecycle, DELETION_GRACE_MS, type LifecycleAction } from '../src/domain/lifecycle.ts';
import type { Assembly } from '../src/domain/types.ts';
import { Client, loginBureau, makeTestApp } from './helpers.ts';
import { SseReader } from './sse-reader.ts';

const NOW = Date.UTC(2026, 10, 5, 9, 0);
const base: Assembly = {
  id: 1, name: 'AG', date: '2026-11-21', state: 'preparation', submissionsOpen: false, code: 'ABCDEFG',
  codeVersion: 1, youtubeAId: null, youtubeBId: null, minDelaySeconds: 60, maxChars: 1000,
  exportOpenedAt: null, exportConfirmedAt: null, exportConfirmedBy: null, deletionAt: null, version: 1, createdAt: 0,
};
const ctx = { now: NOW, by: 'Anna', otherActive: false };
const run = (patch: Partial<Assembly>, action: LifecycleAction, extra: Partial<typeof ctx> = {}) =>
  applyLifecycle({ ...base, ...patch }, action, { ...ctx, ...extra });

describe('AG state machine (pure)', () => {
  it('opens an AG in preparation with submissions open', () => {
    expect(run({}, 'open')).toEqual({ ok: true, patch: { state: 'in_progress', submissionsOpen: true } });
  });

  it('refuses to open a second active AG', () => {
    expect(run({}, 'open', { otherActive: true })).toEqual({ ok: false, reason: 'other_active' });
  });

  it('closes and reopens submissions only while in progress', () => {
    const live = { state: 'in_progress' as const, submissionsOpen: true };
    expect(run(live, 'close_submissions')).toEqual({ ok: true, patch: { submissionsOpen: false } });
    expect(run({ ...live, submissionsOpen: false }, 'reopen_submissions')).toEqual({ ok: true, patch: { submissionsOpen: true } });
    expect(run(live, 'reopen_submissions')).toEqual({ ok: false, reason: 'invalid_state' });
    expect(run({ ...live, submissionsOpen: false }, 'close_submissions')).toEqual({ ok: false, reason: 'invalid_state' });
    expect(run({ state: 'ended' }, 'reopen_submissions')).toEqual({ ok: false, reason: 'invalid_state' });
    expect(run({}, 'close_submissions')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('ends an AG in progress, closing submissions', () => {
    expect(run({ state: 'in_progress', submissionsOpen: true }, 'end')).toEqual({
      ok: true,
      patch: { state: 'ended', submissionsOpen: false },
    });
    expect(run({}, 'end')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('reopens an ended AG with no deletion scheduled, resetting the export confirmation', () => {
    const r = run({ state: 'ended', exportOpenedAt: 1, exportConfirmedAt: 2, exportConfirmedBy: 'Anna' }, 'reopen');
    expect(r).toEqual({
      ok: true,
      patch: { state: 'in_progress', submissionsOpen: true, exportOpenedAt: null, exportConfirmedAt: null, exportConfirmedBy: null },
    });
    expect(run({ state: 'deletion_scheduled', deletionAt: NOW }, 'reopen')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('requires an opened export before confirming, and a confirmation before scheduling deletion', () => {
    expect(run({ state: 'ended' }, 'confirm_export')).toEqual({ ok: false, reason: 'export_not_opened' });
    expect(run({ state: 'ended' }, 'schedule_deletion')).toEqual({ ok: false, reason: 'export_not_opened' });
    expect(run({ state: 'ended', exportOpenedAt: 1 }, 'schedule_deletion')).toEqual({ ok: false, reason: 'export_not_confirmed' });
    expect(run({ state: 'ended', exportOpenedAt: 1 }, 'confirm_export')).toEqual({
      ok: true,
      patch: { exportConfirmedAt: NOW, exportConfirmedBy: 'Anna' },
    });
    expect(run({ state: 'in_progress' }, 'confirm_export')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('schedules deletion 7 days later and can cancel it', () => {
    expect(run({ state: 'ended', exportOpenedAt: 1, exportConfirmedAt: 2 }, 'schedule_deletion')).toEqual({
      ok: true,
      patch: { state: 'deletion_scheduled', deletionAt: NOW + DELETION_GRACE_MS },
    });
    expect(DELETION_GRACE_MS).toBe(7 * 24 * 3600 * 1000);
    expect(run({ state: 'deletion_scheduled', deletionAt: 5 }, 'cancel_deletion')).toEqual({
      ok: true,
      patch: { state: 'ended', deletionAt: null },
    });
    expect(run({ state: 'ended' }, 'cancel_deletion')).toEqual({ ok: false, reason: 'invalid_state' });
  });

  it('refuses everything on a deleted AG', () => {
    for (const action of ['open', 'close_submissions', 'reopen_submissions', 'end', 'reopen', 'confirm_export', 'schedule_deletion', 'cancel_deletion'] as const) {
      expect(run({ state: 'deleted' }, action).ok, action).toBe(false);
    }
  });
});

describe('AG lifecycle routes and events', () => {
  async function setup() {
    const t = makeTestApp();
    const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
    const bureau = new Client(t.app);
    await loginBureau(bureau, 'Anna');
    const participant = new Client(t.app);
    await participant.postForm('/code', { code: ag.code! });
    const bureauStream = new SseReader(await bureau.get(`/bureau/api/ag/${ag.id}/events`));
    const participantStream = new SseReader(await participant.get('/api/events'));
    await bureauStream.waitFor((m) => m.event === 'snapshot');
    await participantStream.waitFor((m) => m.event === 'snapshot');
    const act = async (action: LifecycleAction) => bureau.postJson(`/bureau/api/ag/${ag.id}/action/${action}`, {});
    const close = async () => {
      await bureauStream.close();
      await participantStream.close();
    };
    return { ...t, ag, bureau, participant, bureauStream, participantStream, act, close };
  }

  it('publishes each transition to the Bureau and participant streams', async () => {
    const t = await setup();
    const steps: [LifecycleAction, Record<string, unknown>][] = [
      ['open', { state: 'in_progress', submissionsOpen: true }],
      ['close_submissions', { state: 'in_progress', submissionsOpen: false }],
      ['reopen_submissions', { state: 'in_progress', submissionsOpen: true }],
      ['end', { state: 'ended', submissionsOpen: false }],
      ['reopen', { state: 'in_progress', submissionsOpen: true }],
      ['end', { state: 'ended', submissionsOpen: false }],
    ];
    for (const [action, expected] of steps) {
      const res = await t.act(action);
      expect(res.status, action).toBe(200);
      const { assembly } = (await res.json()) as { assembly: { version: number } };
      expect(assembly).toMatchObject(expected);
      const id = String(assembly.version);
      const b = await t.bureauStream.waitFor((m) => m.event === 'delta' && m.id === id);
      expect(b.data, action).toMatchObject({ type: 'assembly', assembly: expected });
      const p = await t.participantStream.waitFor((m) => m.event === 'delta' && m.id === id);
      expect(p.data, action).toMatchObject({ type: 'assembly', assembly: expected });
    }

    // Export, confirm, schedule and cancel deletion: Bureau-visible state changes.
    t.store.recordExportOpened(t.ag.id);
    for (const [action, expected] of [
      ['confirm_export', { state: 'ended' }],
      ['schedule_deletion', { state: 'deletion_scheduled', deletionAt: t.clock() + DELETION_GRACE_MS }],
      ['cancel_deletion', { state: 'ended', deletionAt: null }],
    ] as const) {
      const res = await t.act(action);
      expect(res.status, action).toBe(200);
      const { assembly } = (await res.json()) as { assembly: { version: number } };
      const b = await t.bureauStream.waitFor((m) => m.event === 'delta' && m.id === String(assembly.version));
      expect(b.data, action).toMatchObject({ type: 'assembly', assembly: expected });
    }
    await t.close();
  });

  it('refuses invalid transitions with a reason and publishes nothing', async () => {
    const t = await setup();
    const before = t.bureauStream.messages.length;
    for (const [action, reason] of [
      ['end', 'invalid_state'],
      ['close_submissions', 'invalid_state'],
      ['reopen', 'invalid_state'],
      ['confirm_export', 'invalid_state'],
      ['schedule_deletion', 'invalid_state'],
      ['cancel_deletion', 'invalid_state'],
    ] as const) {
      const res = await t.act(action);
      expect(res.status, action).toBe(409);
      expect(await res.json()).toEqual({ error: reason });
    }
    expect((await t.bureau.postJson(`/bureau/api/ag/${t.ag.id}/action/explode`, {})).status).toBe(404);
    expect((await t.bureau.postJson(`/bureau/api/ag/999/action/open`, {})).status).toBe(404);
    const after = await t.bureauStream.drain(60);
    expect(after.slice(before).filter((m) => m.event === 'delta')).toEqual([]);
    await t.close();
  });

  it('refuses to open a second AG while another is in progress, ended or awaiting deletion', async () => {
    const t = await setup();
    const second = t.store.createAssembly({ name: 'Autre AG', date: '2027-11-20' });
    await t.act('open');
    for (const prepare of [async () => {}, () => t.act('end'), async () => {
      t.store.recordExportOpened(t.ag.id);
      await t.act('confirm_export');
      await t.act('schedule_deletion');
    }]) {
      await prepare();
      const res = await t.bureau.postJson(`/bureau/api/ag/${second.id}/action/open`, {});
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'other_active' });
    }
    expect(t.store.getAssembly(second.id)!.state).toBe('preparation');
    await t.close();
  });

  it('refuses submissions after the AG has ended', async () => {
    const t = await setup();
    await t.act('open');
    expect((await t.participant.postJson('/api/interventions', { name: 'Gwen', text: 'Bonjour' })).status).toBe(201);
    await t.act('end');
    const res = await t.participant.postJson('/api/interventions', { name: 'Gwen', text: 'Encore' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'closed' });
    await t.close();
  });
});
