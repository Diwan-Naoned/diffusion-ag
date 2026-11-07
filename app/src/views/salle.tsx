import type { Assembly } from '../domain/types.ts';
import { formatLongDate, type Entry, type Translator } from '../i18n/index.ts';
import { Layout } from './layout.tsx';

export interface SalleData {
  lang: string;
  strings: Record<string, Entry>;
  whepUrl: string;
  agName: string;
}

/** In-room listening page: the interpreter-only feed over WebRTC (WHEP), D9. */
export function SallePage({ tr, ag, data }: { tr: Translator; ag: Assembly; data: SalleData }) {
  return (
    <Layout
      tr={tr}
      title={`${tr.t('salle.title')} — ${ag.name}`}
      heading={tr.t('salle.title')}
      eyebrow={tr.t('app.eyebrow', { date: formatLongDate(tr.lang, ag.date) })}
      path="/salle"
      scripts={['salle']}
      data={data}
    >
      <main class="page page--narrow stack stack--lg">
        <section class="card stack" aria-labelledby="salle-title">
          <div class="section-title">
            <h1 id="salle-title">{tr.t('salle.title')}</h1>
          </div>
          <p>{tr.t('salle.intro')}</p>
          <ul class="guidance">
            <li>{tr.t('salle.headphones')}</li>
            <li>{tr.t('salle.keepOpen')}</li>
          </ul>
          <p class="listen-state" data-state="idle" role="status" aria-live="polite" data-listen-state>
            {tr.t('salle.state.idle')}
          </p>
          <div class="row">
            <button type="button" class="btn btn--primary btn--large" data-listen>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
              </svg>
              <span data-listen-label>{tr.t('salle.listen')}</span>
            </button>
            <button type="button" class="btn btn--large" data-stop hidden>
              {tr.t('salle.stop')}
            </button>
          </div>
          <audio data-audio playsinline></audio>
        </section>
        <a href="/" class="text-link" style="align-self:flex-start">
          {tr.t('salle.back')}
        </a>
      </main>
    </Layout>
  );
}
