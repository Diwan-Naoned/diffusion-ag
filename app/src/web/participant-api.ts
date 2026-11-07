import { Hono } from 'hono';
import type { AppContext } from '../app.ts';
import { sseResponse } from '../events/sse.ts';
import {
  publicAssembly,
  publicIntervention,
  type ParticipantDelta,
  type ParticipantSnapshot,
} from '../domain/views.ts';
import type { AppEnv } from './types.ts';

async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Participant APIs; mounted behind participantAccess(…, 'api'), so c.get('access') is set. */
export function participantApiRoutes(ctx: AppContext) {
  const { store } = ctx;
  const app = new Hono<AppEnv>();

  app.get('/api/ping', (c) => c.body(null, 204));

  app.get('/api/mine', (c) => {
    const { assemblyId, deviceId } = c.get('access');
    return c.json({ items: store.listForDevice(assemblyId, deviceId).map(publicIntervention) });
  });

  app.post('/api/interventions', async (c) => {
    const { assemblyId, deviceId } = c.get('access');
    const ip = c.get('clientIp');
    const serverNow = ctx.clock();
    // Fixed backstop against bots that drop their device cookie (D8), whatever the Bureau's settings.
    if (ctx.limiters.submissions.isLimited(ip)) return c.json({ error: 'rate_limited', serverNow }, 429);

    const body = await jsonBody(c.req.raw);
    if (!body) return c.json({ error: 'bad_request' }, 400);
    const result = store.submitIntervention({ assemblyId, deviceId, name: body.name, school: body.school, text: body.text });
    if (result.ok) {
      ctx.limiters.submissions.hit(ip);
      return c.json(
        { item: publicIntervention(result.intervention), nextAllowedAt: result.nextAllowedAt, serverNow },
        201,
      );
    }
    switch (result.error) {
      case 'closed':
        return c.json({ error: 'closed', serverNow }, 409);
      case 'too_early':
        return c.json({ error: 'too_early', nextAllowedAt: result.nextAllowedAt, serverNow }, 429);
      case 'invalid':
        return c.json({ error: 'invalid', field: result.field, reason: result.reason, max: result.max }, 400);
      case 'not_found':
        return c.json({ error: 'unauthorized' }, 401);
    }
  });

  // D6 participant stream: AG state, current limits, next allowed time, own interventions only.
  app.get('/api/events', (c) => {
    const { assemblyId, deviceId } = c.get('access');
    const current = () => store.getAssembly(assemblyId);
    return sseResponse(c, {
      bus: ctx.bus,
      keepAliveMs: ctx.sseKeepAliveMs,
      version: () => current()?.version ?? 0,
      snapshot: (): ParticipantSnapshot => {
        const ag = current()!;
        return {
          type: 'snapshot',
          serverNow: ctx.clock(),
          assembly: publicAssembly(ag),
          nextAllowedAt: store.nextAllowedAt(ag, deviceId),
          mine: store.listForDevice(assemblyId, deviceId).map(publicIntervention),
        };
      },
      delta: (event): ParticipantDelta | null => {
        if (event.assemblyId !== assemblyId) return null;
        if (event.kind === 'deleted') return { type: 'deleted' };
        const ag = current();
        if (!ag) return null;
        if (event.kind === 'assembly' || event.kind === 'settings') {
          return {
            type: 'assembly',
            serverNow: ctx.clock(),
            assembly: publicAssembly(ag),
            nextAllowedAt: store.nextAllowedAt(ag, deviceId),
          };
        }
        if (event.deviceId !== deviceId) return null;
        const item = store.getIntervention(event.interventionId);
        if (!item) return null;
        return {
          type: 'intervention',
          serverNow: ctx.clock(),
          item: publicIntervention(item),
          nextAllowedAt: store.nextAllowedAt(ag, deviceId),
        };
      },
    });
  });

  return app;
}
