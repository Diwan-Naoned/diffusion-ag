import { describe, expect, it } from 'vitest';
import { migrate, openDb, schemaVersion } from '../src/db/index.ts';
import { migrations } from '../src/db/migrations.ts';
import { tempDbPath } from './helpers.ts';

describe('database', () => {
  it('brings a fresh database to the latest schema', () => {
    const db = openDb(tempDbPath());
    const applied = migrate(db);
    expect(applied).toEqual(migrations.map((m) => m.version));
    expect(schemaVersion(db)).toBe(migrations.at(-1)!.version);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all();
    expect(tables).toEqual(
      expect.arrayContaining(['assemblies', 'interventions', 'intervention_events', 'settings_events']),
    );
    const assemblyColumns = db.prepare('PRAGMA table_info(assemblies)').all() as { name: string; dflt_value: string }[];
    const byName = Object.fromEntries(assemblyColumns.map((c) => [c.name, c.dflt_value]));
    expect(byName.min_delay_seconds).toBe('60');
    expect(byName.max_chars).toBe('1000');
  });

  it('is a no-op on a second startup', () => {
    const path = tempDbPath();
    const first = openDb(path);
    migrate(first);
    first.prepare("INSERT INTO assemblies (name, date, created_at) VALUES ('AG', '2026-11-21', 0)").run();
    first.close();

    const second = openDb(path);
    expect(migrate(second)).toEqual([]);
    expect(second.prepare('SELECT COUNT(*) FROM assemblies').pluck().get()).toBe(1);
  });

  it('enables secure_delete', () => {
    const db = openDb(tempDbPath());
    expect(db.pragma('secure_delete', { simple: true })).toBe(1);
  });
});
