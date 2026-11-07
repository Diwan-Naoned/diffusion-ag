import { describe, expect, it } from 'vitest';
import { jsonForScript } from '../src/views/layout.tsx';
import { Client, makeTestApp } from './helpers.ts';
import { SseReader } from './sse-reader.ts';

function pageData(html: string): any {
  const json = html.match(/<script type="application\/json" id="page-data">([\s\S]*?)<\/script>/)![1]!;
  return JSON.parse(json);
}

async function setup() {
  const t = makeTestApp();
  const ag = t.store.createAssembly({ name: 'AG 2026', date: '2026-11-21' });
  t.store.lifecycle(ag.id, 'open', 'Anna');
  const p = new Client(t.app);
  await p.postForm('/code', { code: ag.code! });
  return { ...t, ag, p };
}

describe('participant page', () => {
  it('renders the stream switch, the "not started" placeholder, the no-chat notice and the form, in phone order', async () => {
    const t = await setup();
    const html = await (await t.p.get('/')).text();
    expect(html).toContain('Son de la salle');
    expect(html).toContain('Avec traduction en français');
    expect(html).toContain("Le direct n&#39;a pas encore commencé");
    expect(html).toContain("Il n&#39;y a pas de chat.");
    expect(html).toContain('href="/salle"');
    // Source order = phone order: player, form, my interventions.
    const order = ['data-player', 'data-form', 'data-mine'].map((m) => html.indexOf(m));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(pageData(html)).toMatchObject({ assembly: { state: 'in_progress', youtubeAId: null }, embedReferrerPolicy: expect.any(String) });
    expect(html).not.toContain('youtube.com/embed'); // the iframe is created by the browser module
  });

  it('embeds the video IDs and the strings the browser module needs, in the interface language', async () => {
    const t = await setup();
    t.store.updateDetails(t.ag.id, { name: 'AG 2026', date: '2026-11-21', youtubeAId: 'aaaaaaaaaaa', youtubeBId: 'bbbbbbbbbbb' });
    const data = pageData(await (await t.p.get('/', { 'accept-language': 'br' })).text());
    expect(data.assembly).toMatchObject({ youtubeAId: 'aaaaaaaaaaa', youtubeBId: 'bbbbbbbbbbb' });
    expect(data.lang).toBe('br');
    expect(data.strings['status.queued']).toBe('N’eo ket bet lennet c’hoazh');
  });

  it('escapes page data so it cannot close the script tag', () => {
    expect(jsonForScript({ x: '</script><script>alert(1)</script>' })).not.toContain('</script>');
  });

  it('serves the listening page with the WHEP URL and guidance', async () => {
    const t = await setup();
    const html = await (await t.p.get('/salle')).text();
    expect(html).toContain('Utilisez des écouteurs');
    expect(html).toContain('Gardez cette page ouverte');
    expect(pageData(html)).toMatchObject({ whepUrl: '/media/trad/whep' });
  });
});

describe('"AG terminée" (8.5)', () => {
  it('hides the form and keeps the own interventions listed once the AG has ended', async () => {
    const t = await setup();
    await t.p.postJson('/api/interventions', { name: 'Gwen', text: 'Ma question' });
    t.store.lifecycle(t.ag.id, 'end', 'Anna');
    const html = await (await t.p.get('/')).text();
    expect(html).toMatch(/<form class="card form-card" data-form="true" hidden=""/);
    expect(html).toMatch(/<div class="card stack" data-ended="true" role="status">/);
    expect(html).toContain('AG terminée');
    const data = pageData(html);
    expect(data.mine).toHaveLength(1);
    expect(data.mine[0].html).toBe('<p>Ma question</p>');
  });

  it('is pushed live to open participant pages, with their interventions still listed', async () => {
    const t = await setup();
    await t.p.postJson('/api/interventions', { name: 'Gwen', text: 'Ma question' });
    const stream = new SseReader(await t.p.get('/api/events'));
    await stream.waitFor((m) => m.event === 'snapshot');
    t.store.lifecycle(t.ag.id, 'end', 'Anna');
    const delta = (await stream.waitFor((m) => m.event === 'delta')).data as any;
    expect(delta).toMatchObject({ type: 'assembly', assembly: { state: 'ended', submissionsOpen: false } });
    await stream.close();
    // After a reconnection, the snapshot still lists them.
    const again = new SseReader(await t.p.get('/api/events'));
    const snap = (await again.waitFor((m) => m.event === 'snapshot')).data as any;
    expect(snap.assembly.state).toBe('ended');
    expect(snap.mine).toHaveLength(1);
    await again.close();
  });
});
