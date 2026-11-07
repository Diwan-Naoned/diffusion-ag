import type { Assembly, AssemblyState } from './types.ts';

/**
 * AG state machine (spec: assembly-lifecycle), as pure functions over an AG snapshot.
 * The store applies the returned patch in a transaction and publishes the change.
 */
export type LifecycleAction =
  | 'open'
  | 'close_submissions'
  | 'reopen_submissions'
  | 'end'
  | 'reopen'
  | 'confirm_export'
  | 'schedule_deletion'
  | 'cancel_deletion';

export const LIFECYCLE_ACTIONS: readonly LifecycleAction[] = [
  'open',
  'close_submissions',
  'reopen_submissions',
  'end',
  'reopen',
  'confirm_export',
  'schedule_deletion',
  'cancel_deletion',
];

export type Refusal = 'invalid_state' | 'other_active' | 'export_not_opened' | 'export_not_confirmed';

export type AssemblyPatch = Partial<
  Pick<
    Assembly,
    'state' | 'submissionsOpen' | 'exportOpenedAt' | 'exportConfirmedAt' | 'exportConfirmedBy' | 'deletionAt'
  >
>;

export type LifecycleResult = { ok: true; patch: AssemblyPatch } | { ok: false; reason: Refusal };

export interface LifecycleContext {
  now: number;
  /** Bureau member's display name. */
  by: string;
  /** Whether another AG is in progress, ended or awaiting deletion. */
  otherActive: boolean;
}

export const DELETION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** States that count as "the" active AG: at most one AG may be in one of them. */
export const ACTIVE_STATES: readonly AssemblyState[] = ['in_progress', 'ended', 'deletion_scheduled'];

const ok = (patch: AssemblyPatch): LifecycleResult => ({ ok: true, patch });
const refuse = (reason: Refusal): LifecycleResult => ({ ok: false, reason });

export function applyLifecycle(ag: Assembly, action: LifecycleAction, ctx: LifecycleContext): LifecycleResult {
  switch (action) {
    case 'open':
      if (ag.state !== 'preparation') return refuse('invalid_state');
      if (ctx.otherActive) return refuse('other_active');
      return ok({ state: 'in_progress', submissionsOpen: true });

    case 'close_submissions':
      if (ag.state !== 'in_progress' || !ag.submissionsOpen) return refuse('invalid_state');
      return ok({ submissionsOpen: false });

    case 'reopen_submissions':
      if (ag.state !== 'in_progress' || ag.submissionsOpen) return refuse('invalid_state');
      return ok({ submissionsOpen: true });

    case 'end':
      if (ag.state !== 'in_progress') return refuse('invalid_state');
      return ok({ state: 'ended', submissionsOpen: false });

    case 'reopen':
      // Only while no deletion is scheduled. New interventions may come in, so a previous
      // export no longer covers everything: it has to be opened and confirmed again.
      if (ag.state !== 'ended') return refuse('invalid_state');
      return ok({
        state: 'in_progress',
        submissionsOpen: true,
        exportOpenedAt: null,
        exportConfirmedAt: null,
        exportConfirmedBy: null,
      });

    case 'confirm_export':
      if (ag.state !== 'ended') return refuse('invalid_state');
      if (ag.exportOpenedAt === null) return refuse('export_not_opened');
      return ok({ exportConfirmedAt: ctx.now, exportConfirmedBy: ctx.by });

    case 'schedule_deletion':
      if (ag.state !== 'ended') return refuse('invalid_state');
      if (ag.exportOpenedAt === null) return refuse('export_not_opened');
      if (ag.exportConfirmedAt === null) return refuse('export_not_confirmed');
      return ok({ state: 'deletion_scheduled', deletionAt: ctx.now + DELETION_GRACE_MS });

    case 'cancel_deletion':
      if (ag.state !== 'deletion_scheduled') return refuse('invalid_state');
      return ok({ state: 'ended', deletionAt: null });
  }
}

/** Exports exist once the AG has ended, and stay available during the grace period. */
export function canExport(ag: Assembly): boolean {
  return ag.state === 'ended' || ag.state === 'deletion_scheduled';
}

/** Moderation is frozen once deletion is scheduled, so the confirmed export stays accurate. */
export function canModerate(ag: Assembly): boolean {
  return ag.state === 'in_progress' || ag.state === 'ended';
}

/** The Régulation sliders work before and during the AG. */
export function canChangeSettings(ag: Assembly): boolean {
  return ag.state === 'preparation' || ag.state === 'in_progress';
}

/** The code can be changed before the AG and, against abuse, while it runs. */
export function canRegenerateCode(ag: Assembly): boolean {
  return ag.state === 'preparation' || ag.state === 'in_progress';
}

export function canEditDetails(ag: Assembly): boolean {
  return ag.state !== 'deleted';
}

export function acceptsSubmissions(ag: Assembly): boolean {
  return ag.state === 'in_progress' && ag.submissionsOpen;
}

/** Whether participant cookies for this AG grant access to the pages. */
export function grantsParticipantAccess(ag: Assembly): boolean {
  return ag.state !== 'deleted' && ag.code !== null;
}

/** Whether the interpretation feed may be played (D10). */
export function grantsMediaAccess(ag: Assembly): boolean {
  return ag.state === 'in_progress' || ag.state === 'ended';
}
