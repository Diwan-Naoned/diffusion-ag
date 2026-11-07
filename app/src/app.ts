import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { Config } from './config.ts';
import type { Db } from './db/index.ts';
import { Store } from './domain/store.ts';
import { EventBus } from './events/bus.ts';
import { resolveClientIp } from './lib/client-ip.ts';
import type { Clock } from './lib/clock.ts';
import { FixedWindowLimiter } from './lib/ratelimit.ts';
import { bureauAuthRoutes } from './web/bureau-auth.ts';
import { bureauRoutes } from './web/bureau.tsx';
import { langMiddleware, langRoutes } from './web/lang.ts';
import { mediaAuthRoutes } from './web/media-auth.ts';
import { participantRoutes } from './web/participant.tsx';
import type { AppEnv } from './web/types.ts';

export interface AppDeps {
  config: Config;
  clock: Clock;
  db: Db;
  /** Keep-alive interval for event streams (20 s in production, D6). */
  sseKeepAliveMs?: number;
}

export type App = ReturnType<typeof createApp>;

const TEN_MINUTES = 10 * 60 * 1000;

export function createApp(deps: AppDeps) {
  const { config, clock } = deps;
  const bus = new EventBus();
  const store = new Store(deps.db, bus, clock);
  const limiters = {
    code: new FixedWindowLimiter(10, TEN_MINUTES, clock),
    submissions: new FixedWindowLimiter(30, TEN_MINUTES, clock),
    bureauLogin: new FixedWindowLimiter(10, TEN_MINUTES, clock),
  };
  const ctx = { ...deps, bus, store, limiters, sseKeepAliveMs: deps.sseKeepAliveMs ?? 20_000 };

  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
    c.set('clientIp', resolveClientIp(env?.incoming?.socket?.remoteAddress, c.req.header('x-forwarded-for'), config.trustedProxyCidrs));
    await next();
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Content-Type-Options', 'nosniff');
  });

  app.use(
    '/static/*',
    serveStatic({
      root: './static',
      rewriteRequestPath: (p) => p.replace(/^\/static/, ''),
      onFound: (_path, c) => {
        c.header('Cache-Control', 'public, max-age=86400');
      },
    }),
  );
  app.get('/healthz', (c) => c.text('ok'));
  app.route('/', mediaAuthRoutes(ctx));

  app.use(langMiddleware);
  app.route('/', langRoutes(config));
  app.route('/', bureauAuthRoutes(ctx));
  app.route('/', bureauRoutes(ctx));
  app.route('/', participantRoutes(ctx));

  return Object.assign(app, { ctx });
}

export type AppContext = ReturnType<typeof createApp>['ctx'];
