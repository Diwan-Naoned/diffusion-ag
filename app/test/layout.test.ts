import { describe, expect, it } from 'vitest';
import { Client, makeTestApp } from './helpers.ts';

describe('base layout and assets', () => {
  it('renders a page with the Diwan fonts, mobile viewport and no request to Google', async () => {
    const { app } = makeTestApp();
    const res = await new Client(app).get('/');
    const html = await res.text();
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"/>');
    expect(html).toMatch(/href="\/static\/fonts\/fira-sans-condensed\/fira\.css\?v=/);
    expect(html).toMatch(/href="\/static\/ds\/diwan\/tokens\.css\?v=/);
    expect(html).not.toMatch(/googleapis|gstatic|fonts\.google/);
  });

  it('serves the self-hosted fonts and stylesheets', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    const tokens = await client.get('/static/ds/diwan/tokens.css');
    expect(tokens.status).toBe(200);
    const css = await tokens.text();
    expect(css).toContain('url("fonts/DANOISEDIWAN-Bold.otf")');
    expect(css).not.toMatch(/googleapis|gstatic/);

    const display = await client.get('/static/ds/diwan/fonts/DANOISEDIWAN-Bold.otf');
    expect(display.status).toBe(200);
    const fira = await client.get('/static/fonts/fira-sans-condensed/fira.css');
    const firaCss = await fira.text();
    expect(firaCss).not.toMatch(/googleapis|gstatic|https?:/);
    const firstFont = firaCss.match(/url\("\.\/([^"]+)"\)/)![1];
    const font = await client.get(`/static/fonts/fira-sans-condensed/${firstFont}`);
    expect(font.status).toBe(200);
    expect(font.headers.get('content-type')).toBe('font/woff2');

    const app_css = await (await client.get('/static/css/app.css')).text();
    expect(app_css).toContain('--touch-min: 44px');
    expect(app_css).not.toMatch(/googleapis|gstatic/);
  });

  it('sends Referrer-Policy on every response', async () => {
    const { app } = makeTestApp();
    const client = new Client(app);
    for (const path of ['/healthz', '/static/css/app.css', '/api/mine', '/nope']) {
      expect((await client.get(path)).headers.get('referrer-policy'), path).toBe('no-referrer');
    }
  });
});
