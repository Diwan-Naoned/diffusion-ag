import type { Translator } from '../i18n/index.ts';
import { Layout } from './layout.tsx';

export type CodePageMessage = 'invalid' | 'tooMany' | null;

/** Shown to anyone without a valid participant cookie (spec: typed code fallback). */
export function CodePage({ tr, path, message, next }: { tr: Translator; path: string; message: CodePageMessage; next: string }) {
  return (
    <Layout tr={tr} title={tr.t('code.title')} heading={tr.t('code.title')} eyebrow={tr.t('app.eyebrowNoDate')} path={path} bodyClass="tinted">
      <main class="page page--narrow page--center">
        <form method="post" action="/code" class="card card--plain card--roomy stack" style="width:100%">
          <div class="section-title">
            <h1>{tr.t('code.heading')}</h1>
          </div>
          <p>{tr.t('code.intro')}</p>
          {message && (
            <p class="message message--error" role="alert">
              {tr.t(message === 'tooMany' ? 'code.tooMany' : 'code.invalid')}
            </p>
          )}
          <input type="hidden" name="next" value={next} />
          <div class="field">
            <label for="code">{tr.t('code.label')}</label>
            <input
              id="code"
              name="code"
              class="input input--code"
              required
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              maxlength={20}
              inputmode="text"
            />
            <span class="hint">{tr.t('code.hint')}</span>
          </div>
          <button type="submit" class="btn btn--primary btn--large btn--block">
            {tr.t('code.submit')}
          </button>
          <a href="/bureau/login" class="small text-link" style="align-self:center">
            {tr.t('code.bureau')}
          </a>
        </form>
      </main>
    </Layout>
  );
}
