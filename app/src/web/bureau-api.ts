import { Hono } from 'hono';
import type { AppContext } from '../app.ts';
import { LIFECYCLE_ACTIONS, type LifecycleAction } from '../domain/lifecycle.ts';
import type { ModerationAction } from '../domain/store.ts';
import { bureauAssembly, bureauIntervention, type BureauDelta, type BureauSnapshot } from '../domain/views.ts';
import { sseResponse } from '../events/sse.ts';
import type { AppEnv } from './types.ts';

async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get('content-type') ?? '').includes('application/json')) return null;
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

const MODERATION: readonly ModerationAction[] = ['read', 'reject', 'requeue'];

/** Bureau JSON APIs, mounted behind bureauGuard (c.get('bureau') is set). */
export function bureauApiRoutes(ctx: AppContext) {
  const { store } = ctx;
  const app = new Hono<AppEnv>();

  app.post('/bureau/api/ag/:id/action/:action', async (c) => {
    const action = c.req.param('action') as LifecycleAction;
    if (!LIFECYCLE_ACTIONS.includes(action)) return c.json({ error: 'not_found' }, 404);
    if (!(await jsonBody(c.req.raw))) return c.json({ error: 'bad_request' }, 400);
    const result = store.lifecycle(Number(c.req.param('id')), action, c.get('bureau').name);
    if (!result.ok) return c.json({ error: result.reason }, result.reason === 'not_found' ? 404 : 409);
    return c.json({ assembly: bureauAssembly(result.assembly) });
  });

  // Régulation sliders (D11): validated here, logged in settings_events, broadcast over SSE.
  app.post('/bureau/api/ag/:id/settings', async (c) => {
    const body = await jsonBody(c.req.raw);
    if (!body) return c.json({ error: 'bad_request' }, 400);
    const result = store.updateSettings(
      Number(c.req.param('id')),
      { minDelaySeconds: body.minDelaySeconds, maxChars: body.maxChars },
      c.get('bureau').name,
    );
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : result.error === 'invalid' ? 400 : 409;
      return c.json({ error: result.error, field: result.field }, status);
    }
    return c.json({ assembly: bureauAssembly(result.assembly) });
  });

  app.post('/bureau/api/interventions/:id/:action', async (c) => {
    const action = c.req.param('action') as ModerationAction;
    if (!MODERATION.includes(action)) return c.json({ error: 'not_found' }, 404);
    const body = await jsonBody(c.req.raw);
    if (!body) return c.json({ error: 'bad_request' }, 400);
    const result = store.moderate(Number(c.req.param('id')), action, c.get('bureau').name, {
      publicMessage: body.publicMessage,
      privateNote: body.privateNote,
    });
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : result.error === 'invalid_state' ? 409 : 400;
      return c.json({ error: result.error }, status);
    }
    return c.json({ item: bureauIntervention(result.intervention) });
  });

  // D6 Bureau stream: every intervention, settings and state change of the AG.
  app.get('/bureau/api/ag/:id/events', (c) => {
    const id = Number(c.req.param('id'));
    if (!store.getAssembly(id)) return c.json({ error: 'not_found' }, 404);
    return sseResponse(c, {
      bus: ctx.bus,
      keepAliveMs: ctx.sseKeepAliveMs,
      version: () => store.getAssembly(id)?.version ?? 0,
      snapshot: (): BureauSnapshot => ({
        type: 'snapshot',
        serverNow: ctx.clock(),
        assembly: bureauAssembly(store.getAssembly(id)!),
        items: store.listInterventions(id).map(bureauIntervention),
      }),
      delta: (event): BureauDelta | null => {
        if (event.assemblyId !== id) return null;
        if (event.kind === 'deleted') return { type: 'deleted' };
        if (event.kind === 'intervention') {
          const item = store.getIntervention(event.interventionId);
          return item ? { type: 'intervention', item: bureauIntervention(item) } : null;
        }
        return { type: 'assembly', assembly: bureauAssembly(store.getAssembly(id)!) };
      },
    });
  });

  return app;
}
