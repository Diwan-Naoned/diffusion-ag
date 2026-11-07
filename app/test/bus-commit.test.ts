import { describe, expect, it } from 'vitest';
import type { BusEvent } from '../src/events/bus.ts';
import { makeTestApp } from './helpers.ts';

describe('publish after commit', () => {
  it('publishes once the change is visible to other readers', () => {
    const { store, bus } = makeTestApp();
    const ag = store.createAssembly({ name: 'AG', date: '2026-11-21' });
    const seen: { event: BusEvent; stateSeen: string | undefined; inTx: boolean }[] = [];
    bus.subscribe((event) =>
      seen.push({ event, stateSeen: store.getAssembly(event.assemblyId)?.state, inTx: store.db.inTransaction }),
    );
    store.lifecycle(ag.id, 'open', 'Anna');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ stateSeen: 'in_progress', inTx: false, event: { kind: 'assembly', version: 2 } });
  });

  it('publishes nothing when the transaction fails', () => {
    const { store, bus, db } = makeTestApp();
    const ag = store.createAssembly({ name: 'AG', date: '2026-11-21' });
    const seen: BusEvent[] = [];
    bus.subscribe((e) => seen.push(e));
    db.exec(`CREATE TRIGGER fail BEFORE UPDATE OF state ON assemblies BEGIN SELECT RAISE(ABORT, 'boom'); END`);
    expect(() => store.lifecycle(ag.id, 'open', 'Anna')).toThrow('boom');
    expect(seen).toEqual([]);
    expect(store.getAssembly(ag.id)!.state).toBe('preparation');
  });
});
