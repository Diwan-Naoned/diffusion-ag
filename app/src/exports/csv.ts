import type { Assembly, Intervention } from '../domain/types.ts';
import { t } from '../i18n/index.ts';

/** Exports are always French (D12), whatever the exporting member's interface language. */
const LANG = 'fr' as const;

/** dd/mm/yyyy hh:mm in the AG's time zone, as French spreadsheets expect. */
export function formatDateTime(epochMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(epochMs);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** RFC 4180 field: quoted when it contains the separator, a quote or a line break. */
export function csvField(value: string, separator = ';'): string {
  return /["\r\n]/.test(value) || value.includes(separator) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function interventionsCsv(items: Intervention[], timeZone: string): string {
  const header = [
    'export.csv.receivedAt',
    'export.csv.name',
    'export.csv.school',
    'export.csv.text',
    'export.csv.status',
    'export.csv.statusAt',
    'export.csv.statusBy',
    'export.csv.publicMessage',
    'export.csv.privateNote',
  ] as const;
  const rows = items.map((i) => [
    formatDateTime(i.createdAt, timeZone),
    i.name,
    i.school,
    i.text,
    t(LANG, `export.status.${i.status}`),
    i.statusAt === null ? '' : formatDateTime(i.statusAt, timeZone),
    i.statusBy ?? '',
    i.publicMessage ?? '',
    i.privateNote ?? '',
  ]);
  const lines = [header.map((k) => t(LANG, k)), ...rows].map((r) => r.map((f) => csvField(f)).join(';'));
  // BOM so Excel reads UTF-8 accents; CRLF line ends as in RFC 4180.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

export function csvFilename(ag: Assembly): string {
  return `ag-${ag.date}-interventions.csv`;
}
