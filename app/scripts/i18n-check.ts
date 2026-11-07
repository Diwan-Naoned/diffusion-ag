/**
 * Breton review checklist (docs/i18n.md).
 *
 *   npm run i18n:check                    list keys missing from br.ts, and keys whose French changed since review
 *   npm run i18n:check -- --checklist     print every key as a Markdown checklist (French / Breton) for the reviewer
 *   npm run i18n:check -- --mark-reviewed record the current French of every translated key as reviewed
 *
 * Exits with status 1 when a key is missing or needs review.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { br } from '../src/i18n/br.ts';
import type { Entry } from '../src/i18n/core.ts';
import { fr } from '../src/i18n/fr.ts';

const REVIEWED_FILE = fileURLToPath(new URL('../src/i18n/br.reviewed.json', import.meta.url));
/** Exports are always in French (D12): their keys are never translated. */
const FRENCH_ONLY_PREFIXES = ['export.'];

const show = (e: Entry | undefined) => (e === undefined ? '' : typeof e === 'string' ? e : JSON.stringify(e));
const hash = (e: Entry) => createHash('sha256').update(show(e)).digest('hex').slice(0, 12);

const frDict = fr as Record<string, Entry>;
const brDict = br as Record<string, Entry | undefined>;
const keys = Object.keys(frDict).filter((k) => !FRENCH_ONLY_PREFIXES.some((p) => k.startsWith(p)));

let reviewed: Record<string, string> = {};
try {
  reviewed = JSON.parse(readFileSync(REVIEWED_FILE, 'utf8'));
} catch {
  // No review recorded yet.
}

const args = new Set(process.argv.slice(2));

if (args.has('--mark-reviewed')) {
  const next: Record<string, string> = {};
  for (const k of keys) if (brDict[k] !== undefined) next[k] = hash(frDict[k]!);
  writeFileSync(REVIEWED_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log(`Recorded ${Object.keys(next).length} reviewed keys in src/i18n/br.reviewed.json.`);
  process.exit(0);
}

const missing = keys.filter((k) => brDict[k] === undefined);
const changed = keys.filter((k) => brDict[k] !== undefined && reviewed[k] !== hash(frDict[k]!));
const extra = Object.keys(brDict).filter((k) => !(k in frDict));

if (args.has('--checklist')) {
  console.log('| ✓ | Key | Français | Brezhoneg | Note |');
  console.log('|---|-----|----------|-----------|------|');
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  for (const k of keys) {
    const note = brDict[k] === undefined ? 'MISSING' : changed.includes(k) ? 'to review' : '';
    console.log(`| [ ] | \`${k}\` | ${cell(show(frDict[k]))} | ${cell(show(brDict[k]))} | ${note} |`);
  }
  process.exit(0);
}

const section = (title: string, list: string[], detail: (k: string) => string) => {
  if (!list.length) return;
  console.log(`\n${title} (${list.length}):`);
  for (const k of list) console.log(`  - ${k}: ${detail(k)}`);
};
section('Missing from br.ts', missing, (k) => show(frDict[k]));
section('French changed or never reviewed', changed, (k) => `${show(frDict[k])}  →  ${show(brDict[k])}`);
section('Unknown keys in br.ts (not in fr.ts)', extra, () => 'remove');

if (!missing.length && !changed.length && !extra.length) {
  console.log(`i18n check: all ${keys.length} keys translated and reviewed.`);
} else {
  console.log(`\n${keys.length} keys: ${missing.length} missing, ${changed.length} to review, ${extra.length} unknown.`);
  process.exit(1);
}
