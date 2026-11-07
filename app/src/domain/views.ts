import { excerpt, plainText, renderIntervention, wordCount } from '../lib/render.ts';
import type { Assembly, Intervention, InterventionStatus } from './types.ts';

/**
 * What each audience may see. Participants get their own interventions with the public message
 * only: `privateNote` and `statusBy` never appear in these shapes (spec: private note confidentiality).
 */
export interface PublicAssembly {
  id: number;
  name: string;
  date: string;
  state: Assembly['state'];
  submissionsOpen: boolean;
  maxChars: number;
  minDelaySeconds: number;
  youtubeAId: string | null;
  youtubeBId: string | null;
}

export interface PublicIntervention {
  id: number;
  createdAt: number;
  status: InterventionStatus;
  statusAt: number | null;
  publicMessage: string | null;
  html: string;
}

export interface BureauAssembly extends PublicAssembly {
  deletionAt: number | null;
  version: number;
}

export interface BureauIntervention {
  id: number;
  name: string;
  school: string;
  html: string;
  excerpt: string;
  words: number;
  createdAt: number;
  status: InterventionStatus;
  statusAt: number | null;
  statusBy: string | null;
  publicMessage: string | null;
  privateNote: string | null;
}

export function publicAssembly(ag: Assembly): PublicAssembly {
  return {
    id: ag.id,
    name: ag.name,
    date: ag.date,
    state: ag.state,
    submissionsOpen: ag.submissionsOpen,
    maxChars: ag.maxChars,
    minDelaySeconds: ag.minDelaySeconds,
    youtubeAId: ag.youtubeAId,
    youtubeBId: ag.youtubeBId,
  };
}

export function publicIntervention(i: Intervention): PublicIntervention {
  return {
    id: i.id,
    createdAt: i.createdAt,
    status: i.status,
    statusAt: i.statusAt,
    publicMessage: i.status === 'rejected' ? i.publicMessage : null,
    html: renderIntervention(i.text),
  };
}

export function bureauAssembly(ag: Assembly): BureauAssembly {
  return { ...publicAssembly(ag), deletionAt: ag.deletionAt, version: ag.version };
}

export function bureauIntervention(i: Intervention): BureauIntervention {
  return {
    id: i.id,
    name: i.name,
    school: i.school,
    html: renderIntervention(i.text),
    excerpt: excerpt(i.text),
    words: wordCount(i.text),
    createdAt: i.createdAt,
    status: i.status,
    statusAt: i.statusAt,
    statusBy: i.statusBy,
    publicMessage: i.publicMessage,
    privateNote: i.privateNote,
  };
}

// ---- Event stream payloads ----

export type ParticipantSnapshot = {
  type: 'snapshot';
  serverNow: number;
  assembly: PublicAssembly;
  nextAllowedAt: number;
  mine: PublicIntervention[];
};
export type ParticipantDelta =
  | { type: 'assembly'; serverNow: number; assembly: PublicAssembly; nextAllowedAt: number }
  | { type: 'intervention'; serverNow: number; item: PublicIntervention; nextAllowedAt: number }
  | { type: 'deleted' };

export type BureauSnapshot = {
  type: 'snapshot';
  serverNow: number;
  assembly: BureauAssembly;
  items: BureauIntervention[];
};
export type BureauDelta =
  | { type: 'assembly'; assembly: BureauAssembly }
  | { type: 'intervention'; item: BureauIntervention }
  | { type: 'deleted' };

export { plainText };
