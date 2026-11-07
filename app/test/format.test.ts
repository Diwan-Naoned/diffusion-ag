import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDuration } from '../src/client/_format.ts';
import { makeTranslator } from '../src/i18n/core.ts';
import { pickStrings } from '../src/i18n/index.ts';

describe('client formatting', () => {
  it('formats the countdown as m:ss', () => {
    expect(formatCountdown(80_000)).toBe('1:20');
    expect(formatCountdown(79_001)).toBe('1:20');
    expect(formatCountdown(5_000)).toBe('0:05');
    expect(formatCountdown(-1)).toBe('0:00');
  });

  it('formats Régulation durations', () => {
    const keys = ['duration.none', 'duration.seconds', 'duration.minutes', 'duration.minutesSeconds'] as const;
    const fr = makeTranslator('fr', pickStrings('fr', keys));
    expect([0, 30, 60, 90, 600].map((s) => formatDuration(fr, s))).toEqual(['aucun délai', '30 s', '1 min', '1 min 30 s', '10 min']);
  });
});
