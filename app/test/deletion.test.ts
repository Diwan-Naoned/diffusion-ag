import { describe, expect, it } from 'vitest';
import { DELETION_GRACE_MS } from '../src/domain/lifecycle.ts';
import { startDeletionJob } from '../src/jobs/deletion.ts';
import { Client, fakeClock, loginBureau, makeTestApp, tempDbPath } from './helpers.ts';

const DAY = 24 * 3600 * 1000;

function setupScheduled(options: { dbPath?: string } = {}) {
  const t = makeTestApp(options);
  const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
  t.store.updateDetails(ag.id, { name: 'AG 2026', date: '2026-11-21', youtubeAId: 'aaaaaaaaaaa', youtubeBId: 'bbbbbbbbbbb' });
  t.store.lifecycle(ag.id, 'open', 'Anna');
  t.store.updateSettings(ag.id, { minDelaySeconds: 0 }, 'Anna');
  t.store.submitIntervention({ assemblyId: ag.id, deviceId: 'd'.repeat(32), name: 'NOM-PERSONNEL', school: 'ECOLE-X', text: 'TEXTE-PERSONNEL' });
  t.store.moderate(1, 'reject', 'Anna', { publicMessage: 'MESSAGE-PUBLIC', privateNote: 'NOTE-PRIVEE' });
  t.store.lifecycle(ag.id, 'end', 'Anna');
  t.store.recordExportOpened(ag.id);
  t.store.lifecycle(ag.id, 'confirm_export', 'Anna');
  t.store.lifecycle(ag.id, 'schedule_deletion', 'Anna');
  const deadline = t.clock() + DELETION_GRACE_MS;
  return { ...t, ag, deadline, log: [] as string[] };
}

function personalDataLeft(db: ReturnType<typeof makeTestApp>['db']): number {
  const n = (sql: string) => db.prepare(sql).pluck().get() as number;
  return (
    n('SELECT COUNT(*) FROM interventions') +
    n('SELECT COUNT(*) FROM intervention_events') +
    n('SELECT COUNT(*) FROM settings_events') +
    n("SELECT COUNT(*) FROM assemblies WHERE code IS NOT NULL OR youtube_a_id IS NOT NULL OR export_confirmed_by IS NOT NULL")
  );
}

describe('deletion job (D13)', () => {
  it('deletes nothing before the deadline, and everything personal after it', async () => {
    const t = setupScheduled();
    const job = startDeletionJob(t.store, { log: (m) => t.log.push(m) });
    t.clock.set(t.deadline - 1);
    expect(job.run()).toEqual([]);
    expect(t.store.listInterventions(t.ag.id)).toHaveLength(1);

    t.clock.set(t.deadline);
    expect(job.run()).toEqual([t.ag.id]);
    job.stop();
    expect(personalDataLeft(t.db)).toBe(0);
    const after = t.store.getAssembly(t.ag.id)!;
    expect(after).toMatchObject({ state: 'deleted', name: 'AG 2026', date: '2026-11-21', code: null, deletionAt: null });
    expect(t.log).toEqual([`Deleted the data of AG ${t.ag.id} (scheduled deletion).`]);
  });

  it('leaves no trace of the texts in the database file (secure_delete + VACUUM)', async () => {
    const dbPath = tempDbPath();
    const t = setupScheduled({ dbPath });
    t.clock.set(t.deadline);
    t.store.runDueDeletions();
    t.db.pragma('wal_checkpoint(TRUNCATE)');
    const { readFileSync, existsSync } = await import('node:fs');
    const files = [dbPath, `${dbPath}-wal`].filter(existsSync).map((f) => readFileSync(f).toString('latin1'));
    for (const secret of ['TEXTE-PERSONNEL', 'NOM-PERSONNEL', 'NOTE-PRIVEE', 'MESSAGE-PUBLIC']) {
      expect(files.some((content) => content.includes(secret)), secret).toBe(false);
    }
  });

  it('carries out an overdue deletion at startup', () => {
    const dbPath = tempDbPath();
    const first = setupScheduled({ dbPath });
    first.db.close(); // app stopped during the grace period

    const clock = fakeClock(first.deadline + 3 * DAY); // restarted after the deadline
    const second = makeTestApp({ dbPath, clock });
    const job = startDeletionJob(second.store, { log: () => {} });
    job.stop();
    expect(second.store.getAssembly(first.ag.id)!.state).toBe('deleted');
    expect(personalDataLeft(second.db)).toBe(0);
  });

  it('keeps the deletion date across a redeploy during the grace period', () => {
    const dbPath = tempDbPath();
    const first = setupScheduled({ dbPath });
    first.db.close();
    const clock = fakeClock(first.clock() + 3 * DAY); // redeployed on day 3
    const second = makeTestApp({ dbPath, clock });
    startDeletionJob(second.store, { log: () => {} }).stop();
    expect(second.store.getAssembly(first.ag.id)).toMatchObject({ state: 'deletion_scheduled', deletionAt: first.deadline });
    clock.set(first.deadline);
    expect(second.store.runDueDeletions()).toEqual([first.ag.id]);
  });

  it('never runs a cancelled deletion', () => {
    const t = setupScheduled();
    t.store.lifecycle(t.ag.id, 'cancel_deletion', 'Erwan');
    t.clock.set(t.deadline + 30 * DAY);
    expect(t.store.runDueDeletions()).toEqual([]);
    expect(t.store.getAssembly(t.ag.id)!.state).toBe('ended');
    expect(t.store.listInterventions(t.ag.id)).toHaveLength(1);
  });

  it('never deletes an AG left ended without a scheduled deletion', () => {
    const t = makeTestApp();
    const ag = t.store.createAssembly({ name: 'AG', date: '2026-11-21' });
    t.store.lifecycle(ag.id, 'open', 'Anna');
    t.store.submitIntervention({ assemblyId: ag.id, deviceId: 'd'.repeat(32), name: 'A', school: '', text: 'x' });
    t.store.lifecycle(ag.id, 'end', 'Anna');
    t.clock.advance(400 * DAY);
    expect(t.store.runDueDeletions()).toEqual([]);
    expect(t.store.listInterventions(ag.id)).toHaveLength(1);
  });

  it('rejects old participant cookies and shows the code page afterwards; exports are gone', async () => {
    const t = setupScheduled();
    const participant = new Client(t.app);
    participant.cookies.set(
      'ag_access',
      encodeURIComponent((await import('../src/web/cookies.ts')).accessCookieValue(t.config, t.ag.id, t.store.getAssembly(t.ag.id)!.codeVersion)),
    );
    expect((await participant.get('/')).status).toBe(200);
    const bureau = new Client(t.app);
    await loginBureau(bureau);
    expect((await bureau.get(`/bureau/ag/${t.ag.id}/export.csv`)).status).toBe(200);

    t.clock.set(t.deadline);
    t.store.runDueDeletions();

    const page = await participant.get('/');
    expect(page.status).toBe(401);
    expect(await page.text()).toContain('action="/code"');
    expect((await participant.get(`/?c=${t.ag.code}`)).status).toBe(401);
    expect((await participant.get('/api/mine')).status).toBe(401);
    expect((await participant.get('/auth/media')).status).toBe(401);
    await loginBureau(bureau); // the 12 h session expired during the grace period
    expect((await bureau.get(`/bureau/ag/${t.ag.id}/export.csv`)).status).toBe(409);
    expect(await (await bureau.get(`/bureau/ag/${t.ag.id}/settings`)).text()).toContain('Les données de cette AG ont été supprimées');
  });

  it('tells open participant streams that the AG was deleted', async () => {
    const t = setupScheduled();
    const participant = new Client(t.app);
    participant.cookies.set(
      'ag_access',
      encodeURIComponent((await import('../src/web/cookies.ts')).accessCookieValue(t.config, t.ag.id, t.store.getAssembly(t.ag.id)!.codeVersion)),
    );
    const { SseReader } = await import('./sse-reader.ts');
    const stream = new SseReader(await participant.get('/api/events'));
    await stream.waitFor((m) => m.event === 'snapshot');
    t.clock.set(t.deadline);
    t.store.runDueDeletions();
    expect((await stream.waitFor((m) => m.event === 'delta')).data).toEqual({ type: 'deleted' });
    await stream.close();
  });
});
