/**
 * Ordered SQL migrations, applied at startup. Never edit a migration that has
 * shipped: add a new one with the next version number instead.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: /* sql */ `
      CREATE TABLE assemblies (
        id                  INTEGER PRIMARY KEY,
        name                TEXT    NOT NULL,
        date                TEXT    NOT NULL,
        state               TEXT    NOT NULL DEFAULT 'preparation'
                            CHECK (state IN ('preparation', 'in_progress', 'ended', 'deletion_scheduled', 'deleted')),
        submissions_open    INTEGER NOT NULL DEFAULT 0,
        code                TEXT,
        code_version        INTEGER NOT NULL DEFAULT 1,
        youtube_a_id        TEXT,
        youtube_b_id        TEXT,
        min_delay_seconds   INTEGER NOT NULL DEFAULT 60,
        max_chars           INTEGER NOT NULL DEFAULT 1000,
        export_opened_at    INTEGER,
        export_confirmed_at INTEGER,
        export_confirmed_by TEXT,
        deletion_at         INTEGER,
        version             INTEGER NOT NULL DEFAULT 1,
        created_at          INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX assemblies_code ON assemblies (code) WHERE code IS NOT NULL;

      CREATE TABLE interventions (
        id             INTEGER PRIMARY KEY,
        assembly_id    INTEGER NOT NULL REFERENCES assemblies (id),
        device_id      TEXT    NOT NULL,
        name           TEXT    NOT NULL,
        school         TEXT    NOT NULL DEFAULT '',
        text           TEXT    NOT NULL,
        status         TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'read', 'rejected')),
        status_at      INTEGER,
        status_by      TEXT,
        public_message TEXT,
        private_note   TEXT,
        created_at     INTEGER NOT NULL
      );
      CREATE INDEX interventions_assembly ON interventions (assembly_id, created_at);
      CREATE INDEX interventions_device ON interventions (device_id, assembly_id, created_at);

      CREATE TABLE intervention_events (
        id              INTEGER PRIMARY KEY,
        intervention_id INTEGER NOT NULL REFERENCES interventions (id),
        from_status     TEXT    NOT NULL,
        to_status       TEXT    NOT NULL,
        by              TEXT    NOT NULL,
        at              INTEGER NOT NULL,
        public_message  TEXT,
        private_note    TEXT
      );
      CREATE INDEX intervention_events_intervention ON intervention_events (intervention_id);

      CREATE TABLE settings_events (
        id          INTEGER PRIMARY KEY,
        assembly_id INTEGER NOT NULL REFERENCES assemblies (id),
        setting     TEXT    NOT NULL,
        old_value   TEXT,
        new_value   TEXT,
        by          TEXT    NOT NULL,
        at          INTEGER NOT NULL
      );
      CREATE INDEX settings_events_assembly ON settings_events (assembly_id);
    `,
  },
];
