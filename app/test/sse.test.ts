import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/events/bus.ts';
import { SSE_HEADERS, sseResponse } from '../src/events/sse.ts';
import { SseReader } from './sse-reader.ts';

function streamApp() {
  const bus = new EventBus();
  let version = 5;
  const app = new Hono();
  app.get('/events', (c) =>
    sseResponse(c, {
      bus,
      keepAliveMs: 30,
      version: () => version,
      snapshot: () => ({ type: 'snapshot', version }),
      delta: (e) => (e.assemblyId === 1 ? { type: e.kind } : null),
    }),
  );
  return {
    app,
    bus,
    setVersion: (v: number) => void (version = v),
  };
}

describe('SSE helper', () => {
  it('sends the no-buffering headers', async () => {
    const { app } = streamApp();
    const res = await app.request('/events');
    for (const [k, v] of Object.entries(SSE_HEADERS)) expect(res.headers.get(k)).toBe(v);
    expect(res.headers.get('content-encoding')).toBeNull();
    await res.body!.cancel();
  });

  it('sends a snapshot with the AG version as id on connect', async () => {
    const { app } = streamApp();
    const reader = new SseReader(await app.request('/events'));
    const snap = await reader.waitFor((m) => m.event === 'snapshot');
    expect(snap.id).toBe('5');
    expect(snap.data).toEqual({ type: 'snapshot', version: 5 });
    await reader.close();
  });

  it('forwards relevant bus events as deltas, with the new version as id', async () => {
    const { app, bus, setVersion } = streamApp();
    const reader = new SseReader(await app.request('/events'));
    await reader.waitFor((m) => m.event === 'snapshot');
    setVersion(6);
    bus.publish({ kind: 'assembly', assemblyId: 2, version: 6 }); // filtered out
    setVersion(7);
    bus.publish({ kind: 'assembly', assemblyId: 1, version: 7 });
    const delta = await reader.waitFor((m) => m.event === 'delta');
    expect(delta).toMatchObject({ id: '7', data: { type: 'assembly' } });
    expect(reader.ofType('delta')).toHaveLength(1);
    await reader.close();
  });

  it('skips the snapshot when Last-Event-ID is current, and sends a fresh one when stale', async () => {
    const { app } = streamApp();
    const current = new SseReader(await app.request('/events', { headers: { 'last-event-id': '5' } }));
    const msgs = await current.drain(80);
    expect(msgs.filter((m) => m.event === 'snapshot')).toHaveLength(0);
    await current.close();

    const stale = new SseReader(await app.request('/events', { headers: { 'last-event-id': '3' } }));
    expect((await stale.waitFor((m) => m.event === 'snapshot')).id).toBe('5');
    await stale.close();
  });

  it('sends keep-alive pings', async () => {
    const { app } = streamApp();
    const reader = new SseReader(await app.request('/events'));
    expect((await reader.waitFor((m) => m.comment === 'ping')).comment).toBe('ping');
    await reader.close();
  });

  it('unsubscribes from the bus when the client goes away', async () => {
    const { app, bus } = streamApp();
    const reader = new SseReader(await app.request('/events'));
    await reader.waitFor((m) => m.event === 'snapshot');
    expect(bus.listenerCount).toBe(1);
    await reader.close();
    expect(bus.listenerCount).toBe(0);
  });
});

describe('event bus', () => {
  it('delivers events to every subscriber until unsubscribed', () => {
    const bus = new EventBus();
    const a: number[] = [];
    const b: number[] = [];
    const offA = bus.subscribe((e) => a.push(e.version));
    bus.subscribe((e) => b.push(e.version));
    bus.publish({ kind: 'assembly', assemblyId: 1, version: 1 });
    offA();
    bus.publish({ kind: 'assembly', assemblyId: 1, version: 2 });
    expect(a).toEqual([1]);
    expect(b).toEqual([1, 2]);
  });
});
