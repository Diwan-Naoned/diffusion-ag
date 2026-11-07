import type { Translator } from '../i18n/index.ts';
import { Layout } from './layout.tsx';

export type LoginError = 'password' | 'name' | 'tooMany' | null;

export function BureauLoginPage({ tr, error, name, next }: { tr: Translator; error: LoginError; name: string; next: string }) {
  const message =
    error === 'password' ? tr.t('login.error') : error === 'name' ? tr.t('login.nameRequired') : error === 'tooMany' ? tr.t('code.tooMany') : null;
  return (
    <Layout
      tr={tr}
      title={tr.t('bureau.space')}
      heading={tr.t('bureau.space')}
      eyebrow={tr.t('app.eyebrowNoDate')}
      path="/bureau/login"
      bodyClass="tinted"
      scripts={['bureau-login']}
      data={{ show: tr.t('login.show'), hide: tr.t('login.hide') }}
    >
      <main class="page page--narrow page--center">
        <form method="post" action="/bureau/login" class="card card--plain card--roomy stack" style="width:100%">
          <div class="section-title">
            <h1>{tr.t('login.heading')}</h1>
          </div>
          <p>{tr.t('login.intro')}</p>
          {message && (
            <p class="message message--error" role="alert">
              {message}
            </p>
          )}
          <input type="hidden" name="next" value={next} />
          <div class="field">
            <label for="password">{tr.t('login.password')}</label>
            <div class="input-row">
              <input id="password" name="password" type="password" class="input" required autocomplete="current-password" />
              <button type="button" class="btn btn--icon" aria-label={tr.t('login.show')} aria-pressed="false" data-toggle-password hidden>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <span class="hint">{tr.t('login.passwordHint')}</span>
          </div>
          <div class="field">
            <label for="name">{tr.t('login.name')}</label>
            <input id="name" name="name" class="input" required maxlength={60} autocomplete="given-name" value={name} />
            <span class="hint">{tr.t('login.nameHint')}</span>
          </div>
          <button type="submit" class="btn btn--primary btn--large btn--block">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            {tr.t('login.submit')}
          </button>
          <a href="/" class="small text-link" style="align-self:center">
            {tr.t('login.back')}
          </a>
        </form>
      </main>
    </Layout>
  );
}
