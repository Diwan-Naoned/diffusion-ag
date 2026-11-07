import type { Lang, Translator } from '../i18n/index.ts';

export interface ParticipantAccess {
  assemblyId: number;
  deviceId: string;
}

export interface BureauSession {
  name: string;
  expiresAt: number;
}

export type AppEnv = {
  Variables: {
    lang: Lang;
    tr: Translator;
    clientIp: string;
    access: ParticipantAccess;
    bureau: BureauSession;
  };
};
