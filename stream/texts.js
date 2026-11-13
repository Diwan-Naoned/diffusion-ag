// Every on-screen string of the stream overlays, in one place (design D4).
// Each entry is { br, fr }: Breton first, French second (set in italics).
//
// After editing this file, refresh each Browser Source in OBS
// (right-click → Refresh) to see the change.
//
// BRETON REVIEW: every Breton string marked "DRAFT" below is a draft and must
// be approved by a Breton speaker of the association before the AG. Remove the
// marker once the string is approved. "Emvod meur dreistordinal" is approved.

window.TEXTS = {
  // Federation name, shown as is (proper name, not translated).
  network: 'Kevread Skolioù Diwan',

  title: {
    br: 'Emvod meur dreistordinal', // approved
    fr: 'Assemblée générale extraordinaire',
  },

  date: {
    br: 'Sadorn 14 a viz Du · Gwened', // DRAFT
    fr: 'Samedi 14 novembre · Vannes',
  },

  // Avant: label above the countdown to ?start=
  startsIn: {
    br: 'A-benn nebeut', // DRAFT
    fr: 'Début dans',
  },

  // Heading of the rules: long form on Avant, short form on the strip.
  rulesTitle: {
    br: 'Reolennoù', // DRAFT
    fr: "Règles de l'assemblée",
    brShort: 'Reolennoù', // DRAFT
    frShort: 'Règles',
  },

  // The five rules, in this order (spec: Assembly rules).
  // br / fr: Avant scene; brShort / frShort: rules strip.
  rules: [
    {
      br: 'Chat ebet', // DRAFT
      fr: 'Pas de chat sur le direct',
      brShort: 'Chat ebet', // DRAFT
      frShort: 'Pas de chat',
    },
    {
      br: 'Kinnigit ho prezegenn', // DRAFT
      fr: 'Les interventions se proposent',
      brShort: 'Kinnigit', // DRAFT
      frShort: 'Sur proposition',
    },
    {
      br: 'Ar Burev a ren', // DRAFT
      fr: 'Le Bureau modère les échanges',
      brShort: 'Ar Burev a ren', // DRAFT
      frShort: 'Le Bureau modère',
    },
    {
      br: 'Doujañs etrezomp', // DRAFT
      fr: 'Restons respectueux',
      brShort: 'Doujañs', // DRAFT
      frShort: 'Respect',
    },
    {
      br: 'Kinnigit diskoulmoù', // DRAFT
      fr: 'Proposons des solutions',
      brShort: 'Diskoulmoù', // DRAFT
      frShort: 'Des solutions',
    },
  ],

  // Débat: banner shown while a vote happens in the room.
  vote: {
    br: 'Votadeg er sal', // DRAFT
    fr: 'Vote en salle : seuls les membres présents votent',
  },

  // Interludes (interlude.html?v=pause|incident|fin)
  pause: {
    br: 'Ehan', // DRAFT
    fr: 'Pause',
  },
  resumesIn: {
    br: 'Adkregiñ a-benn', // DRAFT (not in the mock-up, which had French only)
    fr: 'Reprise dans',
  },
  incident: {
    br: 'Kudenn deknikel', // DRAFT
    fr: 'Problème technique',
  },
  incidentMessage: {
    // DRAFT (not in the mock-up, which had French only)
    br: "Adkregiñ a raio ar skignañ war-eeun kerkent ha ma vo tu. N'eo ket ret adkargañ ar bajenn.",
    fr: 'Le direct reprend dès que possible. Inutile de recharger la page.',
  },
  fin: {
    br: 'Trugarez !', // DRAFT
    fr: 'Merci d’avoir suivi l’assemblée',
  },
};
