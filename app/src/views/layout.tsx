import type { Child } from 'hono/jsx';
import { raw } from 'hono/html';
import type { Translator } from '../i18n/index.ts';
import { assetUrl } from '../web/assets.ts';

/** Serializes data for a <script type="application/json"> block without allowing "</script>". */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export interface LayoutProps {
  tr: Translator;
  /** Document title. */
  title: string;
  /** Big title in the header. */
  heading: string;
  eyebrow?: string;
  /** Current path and query, so the language switch comes back here. */
  path: string;
  headerTools?: Child;
  banner?: Child;
  bodyClass?: string;
  /** Browser modules from static/js/ to load. */
  scripts?: string[];
  /** JSON data for the browser modules, read from #page-data. */
  data?: unknown;
  children?: Child;
}

export function LangSwitch({ tr, path }: { tr: Translator; path: string }) {
  return (
    <form method="post" action="/lang" class="lang-switch" aria-label={tr.t('lang.label')} data-lang-switch>
      <input type="hidden" name="back" value={path} />
      <button type="submit" name="lang" value="fr" lang="fr" aria-label={tr.t('lang.fr')} aria-current={tr.lang === 'fr' ? 'true' : 'false'}>
        FR
      </button>
      <button type="submit" name="lang" value="br" lang="br" aria-label={tr.t('lang.br')} aria-current={tr.lang === 'br' ? 'true' : 'false'}>
        BR
      </button>
    </form>
  );
}

export function Layout(props: LayoutProps) {
  const { tr } = props;
  return (
    <>
      {raw('<!doctype html>')}
      <html lang={tr.lang}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="referrer" content="no-referrer" />
          <meta name="robots" content="noindex, nofollow" />
          <meta name="theme-color" content="#2a2a7e" />
          <title>{props.title}</title>
          <link rel="stylesheet" href={assetUrl('/static/fonts/fira-sans-condensed/fira.css')} />
          <link rel="stylesheet" href={assetUrl('/static/ds/diwan/tokens.css')} />
          <link rel="stylesheet" href={assetUrl('/static/css/app.css')} />
          {props.data !== undefined && (
            <script type="application/json" id="page-data">
              {raw(jsonForScript(props.data))}
            </script>
          )}
          {(props.scripts ?? []).map((name) => (
            <script type="module" src={assetUrl(`/static/js/${name}.js`)}></script>
          ))}
        </head>
        <body class={props.bodyClass}>
          <div class="banner banner--info connection-banner" role="status" data-connection-banner hidden>
            {tr.t('app.reconnecting')}
          </div>
          {props.banner}
          <header class="site-header">
            <div class="site-header__inner">
              <div class="site-header__titles">
                {props.eyebrow && <span class="eyebrow">{props.eyebrow}</span>}
                <span class="site-title">{props.heading}</span>
              </div>
              <div class="site-header__tools">
                {props.headerTools}
                <LangSwitch tr={tr} path={props.path} />
              </div>
            </div>
          </header>
          {props.children}
        </body>
      </html>
    </>
  );
}
