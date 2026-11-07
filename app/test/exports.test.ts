import { describe, expect, it } from 'vitest';
import { csvField } from '../src/exports/csv.ts';
import { Client, loginBureau, makeTestApp } from './helpers.ts';

/** Minimal RFC 4180 parser (";" separator) to check the round trip. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') row.push(field), (field = '');
    else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field), rows.push(row), (row = []), (field = ''), i++;
    } else field += ch;
  }
  return rows;
}

async function endedAgWithInterventions() {
  const t = makeTestApp();
  const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
  t.store.lifecycle(ag.id, 'open', 'Anna');
  t.store.updateSettings(ag.id, { minDelaySeconds: 0 }, 'Anna');
  const device = 'd'.repeat(32);
  t.store.submitIntervention({ assemblyId: ag.id, deviceId: device, name: 'Maëla Le Bihan', school: 'Skol Diwan Landerne', text: 'Première ligne « avec ; point-virgule »\n- un "point"\n- deux' });
  t.clock.advance(60_000);
  t.store.submitIntervention({ assemblyId: ag.id, deviceId: device, name: 'Ronan', school: '', text: 'Hors sujet' });
  t.store.moderate(1, 'read', 'Anna');
  t.store.moderate(2, 'reject', 'Erwan', { publicMessage: 'Hors du cadre de l\'AG', privateNote: 'Note privée, interne' });
  t.store.lifecycle(ag.id, 'end', 'Anna');
  const bureau = new Client(t.app);
  await loginBureau(bureau, 'Anna');
  return { ...t, ag, bureau };
}

describe('CSV export (D12)', () => {
  it('quotes fields per RFC 4180', () => {
    expect(csvField('simple')).toBe('simple');
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvField('ligne\nsuivante')).toBe('"ligne\nsuivante"');
  });

  it('downloads a UTF-8 CSV with BOM, French headers and every column, round-tripping accents and line breaks', async () => {
    const t = await endedAgWithInterventions();
    const res = await t.bureau.get(`/bureau/ag/${t.ag.id}/export.csv`, { 'accept-language': 'br' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="ag-2026-11-21-interventions.csv"');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8').decode(bytes.slice(3));
    const rows = parseCsv(text);
    expect(rows[0]).toEqual([
      'Heure de réception', 'Nom', 'École ou structure', 'Texte', 'Statut', 'Heure du statut', 'Membre du bureau', 'Message public', 'Note privée',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      '21/11/2026 14:00', 'Maëla Le Bihan', 'Skol Diwan Landerne', 'Première ligne « avec ; point-virgule »\n- un "point"\n- deux',
      'Lue', '21/11/2026 14:01', 'Anna', '', '',
    ]);
    expect(rows[2]).toEqual([
      '21/11/2026 14:01', 'Ronan', '', 'Hors sujet', 'Non retenue', '21/11/2026 14:01', 'Erwan', "Hors du cadre de l'AG", 'Note privée, interne',
    ]);
  });

  it('is only available once the AG has ended', async () => {
    const t = makeTestApp();
    const ag = t.store.createAssembly({ name: 'AG', date: '2026-11-21' });
    t.store.lifecycle(ag.id, 'open', 'Anna');
    const bureau = new Client(t.app);
    await loginBureau(bureau);
    expect((await bureau.get(`/bureau/ag/${ag.id}/export.csv`)).status).toBe(409);
    expect((await bureau.get(`/bureau/ag/${ag.id}/export/print`)).status).toBe(409);
    expect(t.store.getAssembly(ag.id)!.exportOpenedAt).toBeNull();
  });

  it('is not reachable without a Bureau session', async () => {
    const t = await endedAgWithInterventions();
    expect((await new Client(t.app).get(`/bureau/ag/${t.ag.id}/export.csv`)).status).toBe(303);
  });
});

describe('printable export (D12)', () => {
  it('is in French from a Breton interface, formatted, without private notes', async () => {
    const t = await endedAgWithInterventions();
    const res = await t.bureau.get(`/bureau/ag/${t.ag.id}/export/print`, { 'accept-language': 'br' });
    const html = await res.text();
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('Interventions à distance — AG 2026');
    expect(html).toContain('Assemblée générale du samedi 21 novembre 2026');
    expect(html).toContain('2 interventions, par heure de réception');
    expect(html).toContain('<ul><li>un &quot;point&quot;</li><li>deux</li></ul>');
    expect(html).toContain('lue à 14:01 (Anna)');
    expect(html).toContain("Message public : Hors du cadre de l&#39;AG");
    expect(html).not.toContain('Note privée');
    expect(html).not.toContain('interne');
    expect(html).toContain('data-autoprint');
    expect(html).not.toContain('action="/lang"');
  });
});

describe('export confirmation and deletion scheduling', () => {
  const post = (c: Client, id: number, action: string) => c.postForm(`/bureau/ag/${id}/action/${action}`, {});

  it("can't schedule deletion before an export was opened and confirmed", async () => {
    const t = await endedAgWithInterventions();
    const id = t.ag.id;
    let res = await post(t.bureau, id, 'schedule_deletion');
    expect(res.headers.get('location')).toBe(`/bureau/ag/${id}/settings?error=export_not_opened#deletion`);
    res = await post(t.bureau, id, 'confirm_export');
    expect(res.headers.get('location')).toContain('error=export_not_opened');

    // The settings page offers neither action yet.
    let page = await (await t.bureau.get(`/bureau/ag/${id}/settings`)).text();
    expect(page).not.toContain('/action/confirm_export');
    expect(page).not.toContain('/action/schedule_deletion');

    await t.bureau.get(`/bureau/ag/${id}/export/print`);
    expect(t.store.getAssembly(id)!.exportOpenedAt).toBe(t.clock());
    page = await (await t.bureau.get(`/bureau/ag/${id}/settings`)).text();
    expect(page).toContain('/action/confirm_export');
    expect(page).not.toContain('/action/schedule_deletion');
    res = await post(t.bureau, id, 'schedule_deletion');
    expect(res.headers.get('location')).toContain('error=export_not_confirmed');

    t.clock.advance(60_000);
    res = await post(t.bureau, id, 'confirm_export');
    expect(res.headers.get('location')).toContain('ok=confirm_export');
    expect(t.store.getAssembly(id)).toMatchObject({ exportConfirmedAt: t.clock(), exportConfirmedBy: 'Anna' });
    page = await (await t.bureau.get(`/bureau/ag/${id}/settings`)).text();
    expect(page).toContain('Export enregistré, confirmé par Anna le 21/11 à 14:02.');
    expect(page).toContain('/action/schedule_deletion');
  });

  it('schedules deletion 7 days later, shows the date on every Bureau page, and can be cancelled', async () => {
    const t = await endedAgWithInterventions();
    const id = t.ag.id;
    t.clock.set(Date.UTC(2026, 10, 5, 9, 0)); // 5 November, 10:00 in Paris
    await t.bureau.get(`/bureau/ag/${id}/export.csv`);
    await post(t.bureau, id, 'confirm_export');
    const res = await post(t.bureau, id, 'schedule_deletion');
    expect(res.headers.get('location')).toContain('ok=schedule_deletion');
    expect(t.store.getAssembly(id)).toMatchObject({ state: 'deletion_scheduled', deletionAt: Date.UTC(2026, 10, 12, 9, 0) });

    for (const path of [`/bureau/ag/${id}`, `/bureau/ag/${id}/settings`, '/bureau/ags']) {
      const html = await (await t.bureau.get(path)).text();
      expect(html, path).toContain('Suppression des données de l’AG prévue le 12/11 à 10:00.');
    }
    const br = await (await t.bureau.get(`/bureau/ag/${id}`, { 'accept-language': 'br' })).text();
    expect(br).toContain('12/11 da 10:00');

    // Exports remain available during the grace period.
    expect((await t.bureau.get(`/bureau/ag/${id}/export.csv`)).status).toBe(200);
    // Another Bureau member cancels.
    const other = new Client(t.app);
    await loginBureau(other, 'Erwan');
    await post(other, id, 'cancel_deletion');
    expect(t.store.getAssembly(id)).toMatchObject({ state: 'ended', deletionAt: null });
    const html = await (await t.bureau.get(`/bureau/ag/${id}/settings`)).text();
    expect(html).not.toContain('Suppression des données de l’AG prévue');
  });

  it('records each export opening', async () => {
    const t = await endedAgWithInterventions();
    await t.bureau.get(`/bureau/ag/${t.ag.id}/export.csv`);
    const first = t.store.getAssembly(t.ag.id)!.exportOpenedAt;
    t.clock.advance(1000);
    await t.bureau.get(`/bureau/ag/${t.ag.id}/export/print`);
    expect(t.store.getAssembly(t.ag.id)!.exportOpenedAt).toBe(first! + 1000);
  });
});
