export interface Config {
  /** Public base URL, e.g. https://ag.example.org (used for the participant link and QR code). */
  publicUrl: string;
  /** Secret used to sign cookies (HMAC-SHA256). */
  sessionSecret: string;
  /** Bureau password, changed before each AG. */
  bureauPassword: string;
  /** CIDR ranges of the reverse proxy whose X-Forwarded-For is trusted. */
  trustedProxyCidrs: string[];
  /** SQLite database file. */
  dbPath: string;
  port: number;
  /** Time zone used for times rendered by the server (exports, deletion banner). */
  timeZone: string;
  /** Whether cookies get the Secure flag (true unless PUBLIC_URL is plain http). */
  secureCookies: boolean;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const publicUrl = required(env, 'PUBLIC_URL').replace(/\/+$/, '');
  const sessionSecret = required(env, 'SESSION_SECRET');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return {
    publicUrl,
    sessionSecret,
    bureauPassword: required(env, 'BUREAU_PASSWORD'),
    trustedProxyCidrs: (env.TRUSTED_PROXY_CIDR ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dbPath: env.DB_PATH ?? '/data/ag.db',
    port: Number(env.PORT ?? 3000),
    timeZone: env.APP_TIME_ZONE ?? 'Europe/Paris',
    secureCookies: !publicUrl.startsWith('http://'),
  };
}
