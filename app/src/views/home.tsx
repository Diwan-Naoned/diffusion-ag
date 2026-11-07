import type { Assembly } from '../domain/types.ts';
import { formatLongDate, type Translator } from '../i18n/index.ts';
import { Layout } from './layout.tsx';

/*
 * Illustrations in the Diwan palette (tokens.css): brand blue, accent orange, the characters'
 * skin and hair tones. Hex values are inlined because SVG presentation attributes don't take
 * CSS variables everywhere. Decorative only (aria-hidden): the card text says everything.
 */

const BRAND = '#2a2a7e';
const BRAND_LIGHT = '#8caed5';
const ACCENT = '#f0b100';
const YELLOW = '#ffec00';
const MAGENTA = '#e2007a';
const CYAN = '#009ee0';
const GREEN = '#00a562';
const PURPLE = '#93117e';
const ORANGE = '#f09100';
const SKIN = ['#f6d8a3', '#f8c9bc', '#e5b28a'];
const TINT = '#eef0fa';

/** Seen from behind: a head with hair over a seat back. */
function Spectator({ x, y, hair, scale = 1 }: { x: number; y: number; hair: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-13 14 q0 -12 13 -12 q13 0 13 12 z" fill={hair} opacity="0.9" />
      <circle cx="0" cy="0" r="9" fill={hair} />
      <rect x="-15" y="10" width="30" height="20" rx="7" fill={BRAND} />
    </g>
  );
}

export const RoomIllustration = (
  <svg class="choice-card__art" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
    <path d="M24 30 C24 14 40 8 70 8 H200 C222 8 232 20 232 40 V122 C232 146 218 154 190 154 H48 C26 154 12 142 12 118 V62 C12 46 24 42 24 30 Z" fill={TINT} />
    {/* Stage: screen, speaker at the lectern. */}
    <rect x="62" y="12" width="116" height="36" rx="5" fill="#fff" stroke={BRAND} stroke-width="3" />
    <circle cx="84" cy="30" r="8" fill={YELLOW} />
    <rect x="100" y="23" width="60" height="5" rx="2.5" fill={BRAND_LIGHT} />
    <rect x="100" y="33" width="40" height="5" rx="2.5" fill={BRAND_LIGHT} />
    <rect x="44" y="76" width="152" height="6" rx="3" fill={BRAND} opacity="0.25" />
    <circle cx="120" cy="58" r="6" fill={SKIN[2]} />
    <path d="M114 56 q6 -9 12 0" fill={GREEN} />
    <path d="M110 76 L113 64 H127 L130 76 Z" fill={MAGENTA} />
    <path d="M108 64 h24 l-3 14 h-18 z" fill={ORANGE} />
    {/* Audience, back rows. */}
    <Spectator x={52} y={96} hair={PURPLE} scale={0.8} />
    <Spectator x={84} y={96} hair={MAGENTA} scale={0.8} />
    <Spectator x={156} y={96} hair={BRAND_LIGHT} scale={0.8} />
    <Spectator x={68} y={122} hair={GREEN} />
    <Spectator x={110} y={122} hair={CYAN} />
    {/* The listener: headphones, phone, sound waves. */}
    <g transform="translate(160 118)">
      <path d="M-14 16 q0 -15 14 -15 q14 0 14 15 z" fill={ORANGE} />
      <circle cx="0" cy="0" r="11" fill={ORANGE} />
      <path d="M-14 2 a14 14 0 0 1 28 0" fill="none" stroke={ACCENT} stroke-width="4" stroke-linecap="round" />
      <rect x="-17" y="-1" width="7" height="12" rx="3" fill={BRAND} />
      <rect x="10" y="-1" width="7" height="12" rx="3" fill={BRAND} />
      <rect x="-17" y="12" width="34" height="24" rx="8" fill={BRAND} />
    </g>
    <g transform="translate(186 98) rotate(12)">
      <rect x="0" y="0" width="22" height="38" rx="5" fill={BRAND} />
      <rect x="3" y="5" width="16" height="25" rx="2" fill="#fff" />
      <path d="M7 14 v8 M11 11 v14 M15 15 v6" stroke={ACCENT} stroke-width="2.5" stroke-linecap="round" />
    </g>
    <path d="M213 98 q6 6 0 12 M219 92 q12 12 0 24" fill="none" stroke={ACCENT} stroke-width="3" stroke-linecap="round" />
  </svg>
);

export const RemoteIllustration = (
  <svg class="choice-card__art" viewBox="0 0 240 160" aria-hidden="true" focusable="false">
    <path d="M30 22 C40 8 70 10 96 10 H196 C220 10 230 26 230 46 V118 C230 142 214 152 188 152 H50 C26 152 10 138 10 114 V58 C10 40 22 32 30 22 Z" fill={TINT} />
    {/* Laptop showing the live stream. */}
    <rect x="46" y="30" width="140" height="90" rx="7" fill={BRAND} />
    <rect x="54" y="38" width="124" height="74" rx="3" fill="#fff" />
    <rect x="54" y="38" width="124" height="74" rx="3" fill={BRAND_LIGHT} opacity="0.35" />
    <rect x="60" y="44" width="30" height="11" rx="5.5" fill="#db001b" />
    <circle cx="67" cy="49.5" r="2.5" fill="#fff" />
    <rect x="72" y="47.5" width="13" height="4" rx="2" fill="#fff" />
    <circle cx="116" cy="70" r="9" fill={SKIN[0]} />
    <path d="M107 68 q9 -14 18 0 q-2 -5 -9 -5 q-7 0 -9 5" fill={PURPLE} />
    <path d="M100 98 q0 -18 16 -18 q16 0 16 18 z" fill={GREEN} />
    <path d="M96 112 l4 -16 h32 l4 16 z" fill={ORANGE} />
    <path d="M30 120 H202 L194 132 H38 Z" fill={BRAND} />
    <rect x="104" y="120" width="24" height="4" rx="2" fill={BRAND_LIGHT} />
    {/* Speech bubble: proposing an intervention. */}
    <g transform="translate(164 10)">
      <rect x="0" y="0" width="64" height="40" rx="12" fill={ACCENT} />
      <path d="M14 38 l-6 14 l18 -14 z" fill={ACCENT} />
      <rect x="11" y="11" width="42" height="5" rx="2.5" fill={BRAND} />
      <rect x="11" y="22" width="28" height="5" rx="2.5" fill={BRAND} />
    </g>
    {/* Mug and plant: at home. */}
    <rect x="16" y="98" width="18" height="22" rx="4" fill={MAGENTA} />
    <path d="M34 103 h3 a5 5 0 0 1 0 10 h-3" fill="none" stroke={MAGENTA} stroke-width="3" />
    <path d="M21 92 q-3 -5 0 -9 M28 92 q-3 -5 0 -9" fill="none" stroke={BRAND_LIGHT} stroke-width="2.5" stroke-linecap="round" />
    <path d="M206 120 h18 l-3 14 h-12 z" fill={CYAN} />
    <path d="M215 120 q-2 -16 -12 -22 M215 120 q2 -18 12 -24 M215 120 v-26" fill="none" stroke={GREEN} stroke-width="3" stroke-linecap="round" />
  </svg>
);

const Arrow = (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/** Participant landing page: choose between the in-room listening page and the remote page. */
export function HomePage({ tr, ag }: { tr: Translator; ag: Assembly }) {
  return (
    <Layout
      tr={tr}
      title={ag.name}
      heading={ag.name}
      eyebrow={tr.t('app.eyebrow', { date: formatLongDate(tr.lang, ag.date) })}
      path="/"
      headerTools={
        ag.state === 'in_progress' ? <span class="pill pill--live">{tr.t('app.live')}</span> : undefined
      }
    >
      <main class="page home stack stack--lg">
        <div class="section-title home__intro">
          <h1>{tr.t('home.question')}</h1>
          <p>{tr.t('home.intro')}</p>
        </div>
        <ul class="choices" role="list">
          <li>
            <a href="/salle" class="choice-card">
              <span class="choice-card__media">{RoomIllustration}</span>
              <span class="choice-card__body">
                <span class="choice-card__title">{tr.t('home.room.title')}</span>
                <span class="choice-card__text">{tr.t('home.room.text')}</span>
                <span class="choice-card__cta">
                  {tr.t('home.room.cta')}
                  {Arrow}
                </span>
              </span>
            </a>
          </li>
          <li>
            <a href="/distance" class="choice-card">
              <span class="choice-card__media">{RemoteIllustration}</span>
              <span class="choice-card__body">
                <span class="choice-card__title">{tr.t('home.remote.title')}</span>
                <span class="choice-card__text">{tr.t('home.remote.text')}</span>
                <span class="choice-card__cta">
                  {tr.t('home.remote.cta')}
                  {Arrow}
                </span>
              </span>
            </a>
          </li>
        </ul>
      </main>
    </Layout>
  );
}

/** "← Accueil" link shown at the top of the two participant pages. */
export function HomeLink({ tr }: { tr: Translator }) {
  return (
    <a href="/" class="text-link back-link">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </svg>
      {tr.t('home.back')}
    </a>
  );
}
