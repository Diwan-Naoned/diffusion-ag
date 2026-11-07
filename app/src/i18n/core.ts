/**
 * Language-independent i18n helpers, shared by the server and the browser modules.
 * No dictionaries here: the server passes them in, the browser gets a subset embedded in the page.
 */
export type Lang = 'fr' | 'br';
export const LANGS: readonly Lang[] = ['fr', 'br'];

/** Plural forms keyed by CLDR category; `other` is always required. */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Entry = string | PluralForms;
export type Params = Record<string, string | number>;

export function isLang(value: unknown): value is Lang {
  return value === 'fr' || value === 'br';
}

export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

const pluralRules = new Map<Lang, Intl.PluralRules>();
export function pluralCategory(lang: Lang, n: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(lang);
  if (!rules) pluralRules.set(lang, (rules = new Intl.PluralRules(lang)));
  return rules.select(n);
}

/** Picks the plural form for `n` in `lang`, falling back to `other`. `{n}` is always available. */
export function formatPlural(lang: Lang, forms: PluralForms, n: number, params: Params = {}): string {
  const form = forms[pluralCategory(lang, n)] ?? forms.other;
  return interpolate(form, { n: formatNumber(lang, n), ...params });
}

export function formatNumber(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang).format(n);
}

/** HH:MM in the given language and time zone (browser zone when omitted). */
export function formatTime(lang: Lang, epochMs: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(
    epochMs,
  );
}

/** DD/MM, as in "Suppression prévue le 12/11 à 10:00". */
export function formatDayMonth(lang: Lang, epochMs: number, timeZone?: string): string {
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone }).format(epochMs);
}

/** A long date, e.g. "samedi 21 novembre 2026", from an ISO date (YYYY-MM-DD). */
export function formatLongDate(lang: Lang, isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d));
}

/**
 * A translator over a (possibly partial) dictionary with a French fallback.
 * Used directly by the browser modules with the strings embedded in the page.
 */
export function makeTranslator(lang: Lang, dict: Record<string, Entry | undefined>, fallback: Record<string, Entry | undefined> = {}) {
  const lookup = (key: string): Entry => dict[key] ?? fallback[key] ?? key;
  return {
    lang,
    t(key: string, params?: Params): string {
      const entry = lookup(key);
      return typeof entry === 'string' ? interpolate(entry, params) : formatPlural(lang, entry, 0, params);
    },
    tn(key: string, n: number, params?: Params): string {
      const entry = lookup(key);
      return typeof entry === 'string' ? interpolate(entry, { n, ...params }) : formatPlural(lang, entry, n, params);
    },
  };
}
