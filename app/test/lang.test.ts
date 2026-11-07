import { describe, expect, it } from 'vitest';
import { resolveLang, safeBackPath } from '../src/web/lang.ts';
import { Client, makeTestApp } from './helpers.ts';

describe('language resolution', () => {
  it('prefers the cookie, then Accept-Language containing br, then French', () => {
    expect(resolveLang('fr', 'br,fr;q=0.8')).toBe('fr');
    expect(resolveLang('br', 'fr-FR')).toBe('br');
    expect(resolveLang(undefined, 'fr-FR,br;q=0.9,en;q=0.5')).toBe('br');
    expect(resolveLang(undefined, 'br-FR')).toBe('br');
    expect(resolveLang(undefined, 'fr-FR,en')).toBe('fr');
    expect(resolveLang(undefined, 'bre,bra')).toBe('fr');
    expect(resolveLang(undefined, undefined)).toBe('fr');
    expect(resolveLang('de', 'en')).toBe('fr');
  });

  it('only redirects back to local paths', () => {
    expect(safeBackPath('/salle?x=1')).toBe('/salle?x=1');
    expect(safeBackPath('//evil.example')).toBe('/');
    expect(safeBackPath('https://evil.example')).toBe('/');
    expect(safeBackPath('/\\evil.example')).toBe('/');
    expect(safeBackPath(undefined)).toBe('/');
  });
});

describe('language selection (integration)', () => {
  it('shows the code entry page in Breton for a browser preferring Breton', async () => {
    const { app } = makeTestApp();
    const html = await (await new Client(app).get('/', { 'accept-language': 'br,fr;q=0.8' })).text();
    expect(html).toContain('<html lang="br">');
    expect(html).toContain('Kod moned');
  });

  it('switches language before the code is entered, and remembers it', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    expect(await (await client.get('/')).text()).toContain('<html lang="fr">');

    const res = await client.postForm('/lang', { lang: 'br', back: '/salle' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/salle');
    expect(res.headers.get('set-cookie')).toMatch(/lang=br;.*Max-Age=31536000/);

    // Returning visit: the stored choice wins over the browser's languages.
    const back = await (await client.get('/salle', { 'accept-language': 'fr-FR' })).text();
    expect(back).toContain('<html lang="br">');
    expect(back).toContain('Kod moned');

    await client.postForm('/lang', { lang: 'fr', back: '/' });
    const fr = await (await client.get('/', { 'accept-language': 'br' })).text();
    expect(fr).toContain('<html lang="fr">');
  });

  it('ignores an unknown language and an external back URL', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    const res = await client.postForm('/lang', { lang: 'de', back: 'https://evil.example/' });
    expect(res.headers.get('location')).toBe('/');
    expect(client.cookies.has('lang')).toBe(false);
  });

  it('shows the FR | BR selector, with the current language marked, on the code entry page', async () => {
    const { app } = makeTestApp();
    const html = await (await new Client(app).get('/salle?x=1')).text();
    expect(html).toContain('action="/lang"');
    expect(html).toMatch(/name="back" value="\/salle\?x=1"/);
    expect(html).toMatch(/value="fr"[^>]*aria-current="true"/);
    expect(html).toMatch(/value="br"[^>]*aria-current="false"/);
  });
});
