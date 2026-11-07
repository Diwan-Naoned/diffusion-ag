import { br } from './br.ts';
import { formatPlural, interpolate, type Entry, type Lang, type Params } from './core.ts';
import { fr, type Dict, type Key, type PluralKey, type StringKey } from './fr.ts';

export * from './core.ts';
export type { Key, PluralKey, StringKey } from './fr.ts';

const dictionaries: Record<Lang, Partial<Dict>> = { fr, br };

/** The entry for `key` in `lang`, or the French one when the translation is missing. */
export function entry(lang: Lang, key: Key): Entry {
  return dictionaries[lang][key] ?? fr[key];
}

export function t(lang: Lang, key: StringKey, params?: Params): string {
  return interpolate(entry(lang, key) as string, params);
}

export function tn(lang: Lang, key: PluralKey, n: number, params?: Params): string {
  return formatPlural(lang, entry(lang, key) as Exclude<Entry, string>, n, params);
}

/** Resolved entries for the given keys, to embed in a page for a browser module. */
export function pickStrings(lang: Lang, keys: readonly Key[]): Record<string, Entry> {
  return Object.fromEntries(keys.map((k) => [k, entry(lang, k)]));
}

/** A translator bound to one language, as passed to the page templates. */
export function translator(lang: Lang) {
  return {
    lang,
    t: (key: StringKey, params?: Params) => t(lang, key, params),
    tn: (key: PluralKey, n: number, params?: Params) => tn(lang, key, n, params),
  };
}
export type Translator = ReturnType<typeof translator>;
