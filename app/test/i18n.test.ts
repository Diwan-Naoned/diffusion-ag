import { describe, expect, it } from 'vitest';
import { br } from '../src/i18n/br.ts';
import { fr } from '../src/i18n/fr.ts';
import { formatTime, pluralCategory, t, tn, makeTranslator, pickStrings } from '../src/i18n/index.ts';

describe('i18n', () => {
  it('falls back to French when a Breton key is missing', () => {
    const key = 'code.submit' as const;
    const saved = br[key];
    delete br[key];
    try {
      expect(t('br', key)).toBe(fr[key]);
      expect(pickStrings('br', [key])[key]).toBe(fr[key]);
      // The rest of the page stays in Breton.
      expect(t('br', 'code.label')).toBe(br['code.label']);
    } finally {
      br[key] = saved;
    }
  });

  it('uses the Breton string when present', () => {
    expect(t('br', 'code.label')).toBe('Kod moned');
  });

  it('interpolates parameters', () => {
    expect(t('fr', 'mine.sentAt', { time: '14:21' })).toBe('Envoyée à 14:21');
  });

  it('selects the Breton plural categories', () => {
    expect([1, 2, 3, 9, 20].map((n) => pluralCategory('br', n))).toEqual(['one', 'two', 'few', 'few', 'other']);
    expect(tn('br', 'dash.queuedCount', 2)).toBe('2 ziviz da lenn');
    expect(tn('br', 'dash.queuedCount', 20)).toBe('20 diviz da lenn');
    expect(tn('fr', 'dash.queuedCount', 1)).toBe('1 intervention à lire');
    expect(tn('fr', 'dash.queuedCount', 3)).toBe('3 interventions à lire');
  });

  it('falls back to the other form when a plural category is absent', () => {
    const tr = makeTranslator('br', { k: { one: 'unan', other: '{n} all' } });
    expect(tr.tn('k', 2)).toBe('2 all');
  });

  it('formats times in the given time zone', () => {
    const at = Date.UTC(2026, 10, 21, 13, 32); // 14:32 in Paris (UTC+1 in November)
    expect(formatTime('fr', at, 'Europe/Paris')).toBe('14:32');
    expect(formatTime('br', at, 'Europe/Paris')).toBe('14:32');
  });
});
