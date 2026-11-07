export type AssemblyState = 'preparation' | 'in_progress' | 'ended' | 'deletion_scheduled' | 'deleted';
export type InterventionStatus = 'queued' | 'read' | 'rejected';

export interface Assembly {
  id: number;
  name: string;
  date: string;
  state: AssemblyState;
  submissionsOpen: boolean;
  code: string | null;
  codeVersion: number;
  youtubeAId: string | null;
  youtubeBId: string | null;
  minDelaySeconds: number;
  maxChars: number;
  exportOpenedAt: number | null;
  exportConfirmedAt: number | null;
  exportConfirmedBy: string | null;
  deletionAt: number | null;
  version: number;
  createdAt: number;
}

export interface Intervention {
  id: number;
  assemblyId: number;
  deviceId: string;
  name: string;
  school: string;
  text: string;
  status: InterventionStatus;
  statusAt: number | null;
  statusBy: string | null;
  publicMessage: string | null;
  privateNote: string | null;
  createdAt: number;
}

export interface InterventionEvent {
  id: number;
  interventionId: number;
  fromStatus: InterventionStatus;
  toStatus: InterventionStatus;
  by: string;
  at: number;
  publicMessage: string | null;
  privateNote: string | null;
}

export interface SettingsEvent {
  id: number;
  assemblyId: number;
  setting: string;
  oldValue: string | null;
  newValue: string | null;
  by: string;
  at: number;
}

/** Limits fixed by the spec. */
export const LIMITS = {
  nameMax: 100,
  schoolMax: 100,
  delay: { min: 0, max: 600, step: 30, default: 60 },
  maxChars: { min: 100, max: 2000, step: 50, default: 1000 },
  publicMessageMax: 500,
  privateNoteMax: 2000,
  assemblyNameMax: 120,
} as const;

/** Character count as seen by the user (code points), used on both server and client. */
export function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}
