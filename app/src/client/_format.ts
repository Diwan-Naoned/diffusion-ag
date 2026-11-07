import type { makeTranslator } from '../i18n/core.ts';

type Tr = ReturnType<typeof makeTranslator>;

/** "aucun délai", "30 s", "1 min", "1 min 30 s" (Régulation slider labels). */
export function formatDuration(tr: Tr, seconds: number): string {
  if (seconds <= 0) return tr.t('duration.none');
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return tr.t('duration.seconds', { s });
  if (s === 0) return tr.t('duration.minutes', { m });
  return tr.t('duration.minutesSeconds', { m, s });
}

/** Countdown as m:ss, e.g. 1:20 (rounded up, so it never shows 0:00 while still waiting). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
