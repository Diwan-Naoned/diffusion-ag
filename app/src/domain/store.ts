import type { Db } from '../db/index.ts';
import type { BusEvent, EventBus } from '../events/bus.ts';
import { generateCode } from '../lib/code.ts';
import type { Clock } from '../lib/clock.ts';
import {
  ACTIVE_STATES,
  acceptsSubmissions,
  applyLifecycle,
  canChangeSettings,
  canEditDetails,
  canExport,
  canModerate,
  canRegenerateCode,
  type AssemblyPatch,
  type LifecycleAction,
  type Refusal,
} from './lifecycle.ts';
import {
  charCount,
  LIMITS,
  type Assembly,
  type Intervention,
  type InterventionEvent,
  type InterventionStatus,
  type SettingsEvent,
} from './types.ts';

type Row = Record<string, unknown>;

function toAssembly(r: Row): Assembly {
  return {
    id: r.id as number,
    name: r.name as string,
    date: r.date as string,
    state: r.state as Assembly['state'],
    submissionsOpen: r.submissions_open === 1,
    code: (r.code as string | null) ?? null,
    codeVersion: r.code_version as number,
    youtubeAId: (r.youtube_a_id as string | null) ?? null,
    youtubeBId: (r.youtube_b_id as string | null) ?? null,
    minDelaySeconds: r.min_delay_seconds as number,
    maxChars: r.max_chars as number,
    exportOpenedAt: (r.export_opened_at as number | null) ?? null,
    exportConfirmedAt: (r.export_confirmed_at as number | null) ?? null,
    exportConfirmedBy: (r.export_confirmed_by as string | null) ?? null,
    deletionAt: (r.deletion_at as number | null) ?? null,
    version: r.version as number,
    createdAt: r.created_at as number,
  };
}

function toIntervention(r: Row): Intervention {
  return {
    id: r.id as number,
    assemblyId: r.assembly_id as number,
    deviceId: r.device_id as string,
    name: r.name as string,
    school: r.school as string,
    text: r.text as string,
    status: r.status as InterventionStatus,
    statusAt: (r.status_at as number | null) ?? null,
    statusBy: (r.status_by as string | null) ?? null,
    publicMessage: (r.public_message as string | null) ?? null,
    privateNote: (r.private_note as string | null) ?? null,
    createdAt: r.created_at as number,
  };
}

const PATCH_COLUMNS: Record<keyof AssemblyPatch, string> = {
  state: 'state',
  submissionsOpen: 'submissions_open',
  exportOpenedAt: 'export_opened_at',
  exportConfirmedAt: 'export_confirmed_at',
  exportConfirmedBy: 'export_confirmed_by',
  deletionAt: 'deletion_at',
};

export type SubmitError =
  | { error: 'not_found' }
  | { error: 'closed' }
  | { error: 'invalid'; field: 'name' | 'school' | 'text'; reason: 'required' | 'too_long'; max?: number }
  | { error: 'too_early'; nextAllowedAt: number };

export type SubmitResult = { ok: true; intervention: Intervention; nextAllowedAt: number } | ({ ok: false } & SubmitError);

export type ModerationAction = 'read' | 'reject' | 'requeue';
export type ModerationResult =
  | { ok: true; intervention: Intervention }
  | { ok: false; error: 'not_found' | 'invalid_state' | 'public_message_required' | 'too_long' };

export type SettingsInput = { minDelaySeconds?: unknown; maxChars?: unknown };
export type SettingsResult =
  | { ok: true; assembly: Assembly }
  | { ok: false; error: 'not_found' | 'invalid_state' | 'invalid'; field?: 'minDelaySeconds' | 'maxChars' };

export type ActionResult = { ok: true; assembly: Assembly } | { ok: false; reason: Refusal | 'not_found' };

export class Store {
  constructor(
    readonly db: Db,
    readonly bus: EventBus,
    readonly clock: Clock,
  ) {}

  /** Runs `fn` in a transaction, then publishes the events it collected (only after commit, D6). */
  #write<T>(fn: (emit: (e: BusEvent) => void) => T): T {
    const events: BusEvent[] = [];
    const result = this.db.transaction(() => fn((e) => events.push(e)))();
    for (const e of events) this.bus.publish(e);
    return result;
  }

  #bumpVersion(assemblyId: number): number {
    return this.db
      .prepare('UPDATE assemblies SET version = version + 1 WHERE id = ? RETURNING version')
      .pluck()
      .get(assemblyId) as number;
  }

  // ---------- Assemblies: reads ----------

  getAssembly(id: number): Assembly | null {
    const row = this.db.prepare('SELECT * FROM assemblies WHERE id = ?').get(id) as Row | undefined;
    return row ? toAssembly(row) : null;
  }

  listAssemblies(): Assembly[] {
    return (this.db.prepare('SELECT * FROM assemblies ORDER BY date DESC, id DESC').all() as Row[]).map(toAssembly);
  }

  /** The AG in progress, ended or awaiting deletion, if any (at most one). */
  activeAssembly(): Assembly | null {
    const row = this.db
      .prepare(
        `SELECT * FROM assemblies WHERE state IN (${ACTIVE_STATES.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 1`,
      )
      .get(...ACTIVE_STATES) as Row | undefined;
    return row ? toAssembly(row) : null;
  }

  /** The AG the Bureau works on by default: the active one, else the latest in preparation. */
  currentAssembly(): Assembly | null {
    const active = this.activeAssembly();
    if (active) return active;
    const row = this.db
      .prepare("SELECT * FROM assemblies WHERE state = 'preparation' ORDER BY date DESC, id DESC LIMIT 1")
      .get() as Row | undefined;
    return row ? toAssembly(row) : null;
  }

  findByCode(code: string): Assembly | null {
    const row = this.db.prepare("SELECT * FROM assemblies WHERE code = ? AND state != 'deleted'").get(code) as
      | Row
      | undefined;
    return row ? toAssembly(row) : null;
  }

  // ---------- Assemblies: writes ----------

  createAssembly(input: { name: string; date: string }): Assembly {
    return this.#write(() => {
      const code = this.#uniqueCode();
      const id = this.db
        .prepare('INSERT INTO assemblies (name, date, code, created_at) VALUES (?, ?, ?, ?) RETURNING id')
        .pluck()
        .get(input.name, input.date, code, this.clock()) as number;
      return this.getAssembly(id)!;
    });
  }

  #uniqueCode(): string {
    const taken = this.db.prepare('SELECT 1 FROM assemblies WHERE code = ?').pluck();
    for (;;) {
      const code = generateCode();
      if (!taken.get(code)) return code;
    }
  }

  updateDetails(
    id: number,
    input: { name: string; date: string; youtubeAId: string | null; youtubeBId: string | null },
  ): ActionResult {
    return this.#write((emit) => {
      const ag = this.getAssembly(id);
      if (!ag) return { ok: false, reason: 'not_found' };
      if (!canEditDetails(ag)) return { ok: false, reason: 'invalid_state' };
      this.db
        .prepare('UPDATE assemblies SET name = ?, date = ?, youtube_a_id = ?, youtube_b_id = ? WHERE id = ?')
        .run(input.name, input.date, input.youtubeAId, input.youtubeBId, id);
      const version = this.#bumpVersion(id);
      emit({ kind: 'assembly', assemblyId: id, version });
      return { ok: true, assembly: this.getAssembly(id)! };
    });
  }

  /** New code and code_version: every participant cookie issued before stops working (D3). */
  regenerateCode(id: number): ActionResult {
    return this.#write((emit) => {
      const ag = this.getAssembly(id);
      if (!ag) return { ok: false, reason: 'not_found' };
      if (!canRegenerateCode(ag)) return { ok: false, reason: 'invalid_state' };
      this.db
        .prepare('UPDATE assemblies SET code = ?, code_version = code_version + 1 WHERE id = ?')
        .run(this.#uniqueCode(), id);
      const version = this.#bumpVersion(id);
      emit({ kind: 'assembly', assemblyId: id, version });
      return { ok: true, assembly: this.getAssembly(id)! };
    });
  }

  lifecycle(id: number, action: LifecycleAction, by: string): ActionResult {
    return this.#write((emit) => {
      const ag = this.getAssembly(id);
      if (!ag) return { ok: false, reason: 'not_found' };
      const other = this.activeAssembly();
      const result = applyLifecycle(ag, action, {
        now: this.clock(),
        by,
        otherActive: other !== null && other.id !== id,
      });
      if (!result.ok) return result;
      this.#applyPatch(id, result.patch);
      const version = this.#bumpVersion(id);
      emit({ kind: 'assembly', assemblyId: id, version });
      return { ok: true, assembly: this.getAssembly(id)! };
    });
  }

  #applyPatch(id: number, patch: AssemblyPatch): void {
    const entries = Object.entries(patch) as [keyof AssemblyPatch, unknown][];
    if (entries.length === 0) return;
    const sets = entries.map(([k]) => `${PATCH_COLUMNS[k]} = ?`).join(', ');
    const values = entries.map(([, v]) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    this.db.prepare(`UPDATE assemblies SET ${sets} WHERE id = ?`).run(...values, id);
  }

  /** Called when the CSV or the printable export is opened (D12). */
  recordExportOpened(id: number): ActionResult {
    return this.#write((emit) => {
      const ag = this.getAssembly(id);
      if (!ag) return { ok: false, reason: 'not_found' };
      if (!canExport(ag)) return { ok: false, reason: 'invalid_state' };
      this.db.prepare('UPDATE assemblies SET export_opened_at = ? WHERE id = ?').run(this.clock(), id);
      const version = this.#bumpVersion(id);
      emit({ kind: 'assembly', assemblyId: id, version });
      return { ok: true, assembly: this.getAssembly(id)! };
    });
  }

  // ---------- Régulation ----------

  updateSettings(id: number, input: SettingsInput, by: string): SettingsResult {
    const fields: { key: 'minDelaySeconds' | 'maxChars'; column: string; limits: { min: number; max: number; step: number } }[] = [
      { key: 'minDelaySeconds', column: 'min_delay_seconds', limits: LIMITS.delay },
      { key: 'maxChars', column: 'max_chars', limits: LIMITS.maxChars },
    ];
    const changes: { column: string; key: string; value: number }[] = [];
    for (const f of fields) {
      const raw = input[f.key];
      if (raw === undefined) continue;
      const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < f.limits.min ||
        value > f.limits.max ||
        (value - f.limits.min) % f.limits.step !== 0
      ) {
        return { ok: false, error: 'invalid', field: f.key };
      }
      changes.push({ column: f.column, key: f.key, value });
    }
    if (changes.length === 0) return { ok: false, error: 'invalid' };

    return this.#write((emit) => {
      const ag = this.getAssembly(id);
      if (!ag) return { ok: false, error: 'not_found' };
      if (!canChangeSettings(ag)) return { ok: false, error: 'invalid_state' };
      const now = this.clock();
      let changed = false;
      for (const c of changes) {
        const old = ag[c.key as 'minDelaySeconds' | 'maxChars'];
        if (old === c.value) continue;
        changed = true;
        this.db.prepare(`UPDATE assemblies SET ${c.column} = ? WHERE id = ?`).run(c.value, id);
        this.db
          .prepare(
            'INSERT INTO settings_events (assembly_id, setting, old_value, new_value, by, at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(id, c.column, String(old), String(c.value), by, now);
      }
      if (changed) {
        const version = this.#bumpVersion(id);
        emit({ kind: 'settings', assemblyId: id, version });
      }
      return { ok: true, assembly: this.getAssembly(id)! };
    });
  }

  settingsEvents(assemblyId: number): SettingsEvent[] {
    return (
      this.db.prepare('SELECT * FROM settings_events WHERE assembly_id = ? ORDER BY id').all(assemblyId) as Row[]
    ).map((r) => ({
      id: r.id as number,
      assemblyId: r.assembly_id as number,
      setting: r.setting as string,
      oldValue: (r.old_value as string | null) ?? null,
      newValue: (r.new_value as string | null) ?? null,
      by: r.by as string,
      at: r.at as number,
    }));
  }

  // ---------- Interventions ----------

  /** When this device may submit again (D8): last submission + the AG's current minimum delay. */
  nextAllowedAt(ag: Assembly, deviceId: string): number {
    const last = this.db
      .prepare('SELECT MAX(created_at) FROM interventions WHERE assembly_id = ? AND device_id = ?')
      .pluck()
      .get(ag.id, deviceId) as number | null;
    return last === null ? 0 : last + ag.minDelaySeconds * 1000;
  }

  submitIntervention(input: {
    assemblyId: number;
    deviceId: string;
    name: unknown;
    school: unknown;
    text: unknown;
  }): SubmitResult {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const school = typeof input.school === 'string' ? input.school.trim() : '';
    const text = typeof input.text === 'string' ? input.text.replace(/\r\n?/g, '\n').trim() : '';

    return this.#write((emit): SubmitResult => {
      const ag = this.getAssembly(input.assemblyId);
      if (!ag) return { ok: false, error: 'not_found' };
      if (!acceptsSubmissions(ag)) return { ok: false, error: 'closed' };

      if (!name) return { ok: false, error: 'invalid', field: 'name', reason: 'required' };
      if (charCount(name) > LIMITS.nameMax)
        return { ok: false, error: 'invalid', field: 'name', reason: 'too_long', max: LIMITS.nameMax };
      if (charCount(school) > LIMITS.schoolMax)
        return { ok: false, error: 'invalid', field: 'school', reason: 'too_long', max: LIMITS.schoolMax };
      if (!text) return { ok: false, error: 'invalid', field: 'text', reason: 'required' };
      if (charCount(text) > ag.maxChars)
        return { ok: false, error: 'invalid', field: 'text', reason: 'too_long', max: ag.maxChars };

      const now = this.clock();
      const nextAllowedAt = this.nextAllowedAt(ag, input.deviceId);
      if (now < nextAllowedAt) return { ok: false, error: 'too_early', nextAllowedAt };

      const id = this.db
        .prepare(
          `INSERT INTO interventions (assembly_id, device_id, name, school, text, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'queued', ?) RETURNING id`,
        )
        .pluck()
        .get(ag.id, input.deviceId, name, school, text, now) as number;
      const version = this.#bumpVersion(ag.id);
      emit({ kind: 'intervention', assemblyId: ag.id, version, interventionId: id, deviceId: input.deviceId });
      return {
        ok: true,
        intervention: this.getIntervention(id)!,
        nextAllowedAt: now + ag.minDelaySeconds * 1000,
      };
    });
  }

  getIntervention(id: number): Intervention | null {
    const row = this.db.prepare('SELECT * FROM interventions WHERE id = ?').get(id) as Row | undefined;
    return row ? toIntervention(row) : null;
  }

  /** Oldest first (Bureau queue order). */
  listInterventions(assemblyId: number): Intervention[] {
    return (
      this.db.prepare('SELECT * FROM interventions WHERE assembly_id = ? ORDER BY created_at, id').all(assemblyId) as Row[]
    ).map(toIntervention);
  }

  /** Newest first ("Mes interventions"). */
  listForDevice(assemblyId: number, deviceId: string): Intervention[] {
    return (
      this.db
        .prepare('SELECT * FROM interventions WHERE assembly_id = ? AND device_id = ? ORDER BY created_at DESC, id DESC')
        .all(assemblyId, deviceId) as Row[]
    ).map(toIntervention);
  }

  moderate(
    id: number,
    action: ModerationAction,
    by: string,
    input: { publicMessage?: unknown; privateNote?: unknown } = {},
  ): ModerationResult {
    return this.#write((emit): ModerationResult => {
      const item = this.getIntervention(id);
      if (!item) return { ok: false, error: 'not_found' };
      const ag = this.getAssembly(item.assemblyId)!;
      if (!canModerate(ag)) return { ok: false, error: 'invalid_state' };

      let to: InterventionStatus;
      let publicMessage: string | null = null;
      let privateNote: string | null = null;
      switch (action) {
        case 'read':
          if (item.status !== 'queued') return { ok: false, error: 'invalid_state' };
          to = 'read';
          break;
        case 'reject': {
          if (item.status !== 'queued') return { ok: false, error: 'invalid_state' };
          publicMessage = typeof input.publicMessage === 'string' ? input.publicMessage.trim() : '';
          privateNote = typeof input.privateNote === 'string' ? input.privateNote.trim() : '';
          if (!publicMessage) return { ok: false, error: 'public_message_required' };
          if (charCount(publicMessage) > LIMITS.publicMessageMax || charCount(privateNote) > LIMITS.privateNoteMax)
            return { ok: false, error: 'too_long' };
          privateNote ||= null;
          to = 'rejected';
          break;
        }
        case 'requeue':
          if (item.status === 'queued') return { ok: false, error: 'invalid_state' };
          to = 'queued';
          break;
      }

      const now = this.clock();
      this.db
        .prepare(
          `UPDATE interventions SET status = ?, status_at = ?, status_by = ?, public_message = ?, private_note = ?
           WHERE id = ?`,
        )
        .run(to, now, by, publicMessage, privateNote, id);
      this.db
        .prepare(
          `INSERT INTO intervention_events (intervention_id, from_status, to_status, by, at, public_message, private_note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, item.status, to, by, now, publicMessage, privateNote);
      const version = this.#bumpVersion(item.assemblyId);
      emit({ kind: 'intervention', assemblyId: item.assemblyId, version, interventionId: id, deviceId: item.deviceId });
      return { ok: true, intervention: this.getIntervention(id)! };
    });
  }

  interventionEvents(interventionId: number): InterventionEvent[] {
    return (
      this.db
        .prepare('SELECT * FROM intervention_events WHERE intervention_id = ? ORDER BY id')
        .all(interventionId) as Row[]
    ).map((r) => ({
      id: r.id as number,
      interventionId: r.intervention_id as number,
      fromStatus: r.from_status as InterventionStatus,
      toStatus: r.to_status as InterventionStatus,
      by: r.by as string,
      at: r.at as number,
      publicMessage: (r.public_message as string | null) ?? null,
      privateNote: (r.private_note as string | null) ?? null,
    }));
  }

  statusCounts(assemblyId: number): Record<InterventionStatus | 'total', number> {
    const counts = { queued: 0, read: 0, rejected: 0, total: 0 };
    for (const r of this.db
      .prepare('SELECT status, COUNT(*) AS n FROM interventions WHERE assembly_id = ? GROUP BY status')
      .all(assemblyId) as { status: InterventionStatus; n: number }[]) {
      counts[r.status] = r.n;
      counts.total += r.n;
    }
    return counts;
  }

  // ---------- Deletion (D13) ----------

  /**
   * Deletes every AG whose scheduled deletion time has passed. Returns the ids deleted.
   * Each AG is deleted in one transaction; VACUUM afterwards rewrites the file without freed pages.
   */
  runDueDeletions(): number[] {
    const due = this.db
      .prepare("SELECT id FROM assemblies WHERE state = 'deletion_scheduled' AND deletion_at <= ?")
      .pluck()
      .all(this.clock()) as number[];
    for (const id of due) {
      this.#write((emit) => {
        this.db
          .prepare(
            'DELETE FROM intervention_events WHERE intervention_id IN (SELECT id FROM interventions WHERE assembly_id = ?)',
          )
          .run(id);
        this.db.prepare('DELETE FROM interventions WHERE assembly_id = ?').run(id);
        this.db.prepare('DELETE FROM settings_events WHERE assembly_id = ?').run(id);
        this.db
          .prepare(
            `UPDATE assemblies SET state = 'deleted', submissions_open = 0, code = NULL, code_version = code_version + 1,
               youtube_a_id = NULL, youtube_b_id = NULL, export_confirmed_by = NULL, deletion_at = NULL
             WHERE id = ?`,
          )
          .run(id);
        const version = this.#bumpVersion(id);
        emit({ kind: 'deleted', assemblyId: id, version });
      });
    }
    if (due.length > 0) this.db.exec('VACUUM');
    return due;
  }
}
