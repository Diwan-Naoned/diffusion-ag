import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { migrations as defaultMigrations, type Migration } from './migrations.ts';

export type Db = Database.Database;

/** Opens the database with the pragmas the app relies on. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  // Overwrite deleted content with zeros, so deleted interventions don't linger in free pages (D13).
  db.pragma('secure_delete = ON');
  return db;
}

/** Applies pending migrations in order, each in its own transaction. Returns the versions applied. */
export function migrate(db: Db, migrations: Migration[] = defaultMigrations): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT    NOT NULL,
    applied_at INTEGER NOT NULL
  )`);
  const done = new Set(
    db.prepare('SELECT version FROM schema_migrations').pluck().all() as number[],
  );
  const applied: number[] = [];
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (done.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        m.version,
        m.name,
        Date.now(),
      );
    })();
    applied.push(m.version);
  }
  return applied;
}

export function schemaVersion(db: Db): number {
  return (db.prepare('SELECT COALESCE(MAX(version), 0) FROM schema_migrations').pluck().get() as number) ?? 0;
}
