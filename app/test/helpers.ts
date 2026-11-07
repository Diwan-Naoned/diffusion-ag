import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { createApp, type App } from '../src/app.ts';
import type { Config } from '../src/config.ts';
import { migrate, openDb } from '../src/db/index.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

/** A fresh temporary database path, removed after the test. */
export function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ag-test-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'ag.db');
}

export const BUREAU_PASSWORD = 'mot-de-passe-du-bureau';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    publicUrl: 'https://ag.example.test',
    sessionSecret: 'test-secret-test-secret-test-secret-0123',
    bureauPassword: BUREAU_PASSWORD,
    trustedProxyCidrs: ['10.0.0.0/8'],
    dbPath: ':memory:',
    port: 0,
    timeZone: 'Europe/Paris',
    secureCookies: true,
    ...overrides,
  };
}

/** A settable clock starting on 21 November 2026, 14:00 Paris time. */
export function fakeClock(start = Date.UTC(2026, 10, 21, 13, 0)) {
  let now = start;
  const clock = () => now;
  return Object.assign(clock, {
    set: (t: number) => void (now = t),
    advance: (ms: number) => void (now += ms),
  });
}
export type FakeClock = ReturnType<typeof fakeClock>;

export function makeTestApp(options: { config?: Partial<Config>; clock?: FakeClock; dbPath?: string } = {}) {
  const clock = options.clock ?? fakeClock();
  const db = openDb(options.dbPath ?? tempDbPath());
  migrate(db);
  cleanups.push(() => db.open && db.close());
  const app = createApp({ config: testConfig(options.config), clock, db, sseKeepAliveMs: 50 });
  return { app, clock, db, store: app.ctx.store, bus: app.ctx.bus, config: app.ctx.config };
}

/** A browser-like client: keeps cookies between requests and comes from a fixed IP. */
export class Client {
  readonly cookies = new Map<string, string>();

  constructor(
    readonly app: App,
    readonly ip = '203.0.113.10',
  ) {}

  cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    if (this.cookies.size && !headers.cookie) headers.cookie = this.cookieHeader();
    const res = await this.app.request(
      `https://ag.example.test${path}`,
      { ...init, headers },
      { incoming: { socket: { remoteAddress: this.ip } } },
    );
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair!.indexOf('=');
      const name = pair!.slice(0, eq).trim();
      const value = pair!.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim()));
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  get(path: string, headers: Record<string, string> = {}) {
    return this.request(path, { headers });
  }

  postForm(path: string, data: Record<string, string>, headers: Record<string, string> = {}) {
    return this.request(path, {
      method: 'POST',
      body: new URLSearchParams(data).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    });
  }

  postJson(path: string, data: unknown, headers: Record<string, string> = {}) {
    return this.request(path, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'content-type': 'application/json', ...headers },
    });
  }
}

/** Logs a client in as a Bureau member. */
export async function loginBureau(client: Client, name = 'Anna'): Promise<void> {
  const res = await client.postForm('/bureau/login', { password: BUREAU_PASSWORD, name });
  if (res.status !== 303) throw new Error(`Bureau login failed: ${res.status}`);
}
