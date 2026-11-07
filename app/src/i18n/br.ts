import type { PluralForms } from './core.ts';
import type { Dict } from './fr.ts';

const plural = (forms: PluralForms): PluralForms => forms;

/**
 * Breton dictionary. Typed as Partial: a missing key falls back to French at runtime,
 * and `npm run i18n:check` lists missing keys and keys whose French changed since review.
 *
 * FIRST DRAFT, NOT YET REVIEWED by a Breton speaker of the association (see docs/i18n.md).
 */
export const br: Partial<Dict> = {
  // Shared layout
  'lang.label': 'Yezh',
  'lang.fr': 'Français',
  'lang.br': 'Brezhoneg',
  'app.eyebrow': 'Bodadeg veur · {date}',
  'app.eyebrowNoDate': 'Bodadeg veur',
  'app.live': 'War-eeun',
  'app.reconnecting': 'Oc’h adkevreañ…',
  'app.error': 'N’eus ket bet gallet ober an dra-se. Klaskit en-dro.',

  // Code entry page
  'code.title': 'Heuliañ ar vodadeg a-bell',
  'code.heading': 'Miret evit an izili',
  'code.intro':
    'Evit heuliañ ar vodadeg veur a-bell, digorit al liamm resevet er c’hemenn-pediñ, pe skrivit ar c’hod moned a zo ennañ.',
  'code.label': 'Kod moned',
  'code.hint': 'Pennlizherennoù pe lizherennoù bihan, n’eus forzh.',
  'code.submit': 'Mont d’ar vodadeg',
  'code.invalid':
    'Ar c’hod-se ne ro ket moned d’ar vodadeg. Gwiriit anezhañ, pe implijit al liamm er c’hemenn-pediñ.',
  'code.tooMany': 'Re a daolioù-esae. Klaskit en-dro a-benn un nebeut munutennoù.',
  'code.bureau': 'Lec’h ar burev',

  // Participant page: stream
  'participant.title': 'Heuliañ ar vodadeg a-bell',
  'stream.heading': 'War-eeun',
  'stream.choice': 'Dibab ar wiskad video',
  'stream.a.label': 'Son ar sal',
  'stream.a.hint': 'Stumm orin, brezhoneg ha galleg',
  'stream.b.label': 'Gant troidigezh e galleg',
  'stream.b.hint': 'Ar brezhoneg troet war-eeun',
  'stream.a.explain':
    'Emaoc’h o selaou son ar sal, hep troidigezh. Evit klevout ar brezhoneg troet e galleg, dibabit « Gant troidigezh e galleg ».',
  'stream.b.explain':
    'Emaoc’h o selaou an droidigezh : an divizoù e brezhoneg a vez troet e galleg gant un etreer·ez. An divizoù e galleg ne cheñchont ket.',
  'stream.notStarted': 'N’eo ket kroget ar skignañ war-eeun c’hoazh',
  'stream.notStartedHint': 'Al lenner a zeuio war wel amañ kerkent ha ma vo bet roet liamm ar skignañ gant ar burev.',
  'stream.playerTitle': 'Lenner YouTube — {stream}',
  'stream.noChat':
    'N’eus ket a gaozeadenn. Evit kemer perzh, kasit ho testenn da vurev ar vodadeg gant ar furmskrid : ar burev a zibab an divizoù a vez lennet er sal.',
  'stream.salleLink': 'Er sal emaoc’h ? Selaouit an droidigezh war ho pellgomzer',

  // Participant page: form
  'form.heading': 'Kinnig un diviz',
  'form.intro': 'N’eo gwelus ho testenn nemet gant burev ar vodadeg, a lenno anezhi mar kav dezhañ.',
  'form.name': 'Anv hag anv-bihan',
  'form.school': 'Skol pe aozadur',
  'form.optional': '(diret)',
  'form.text': 'Ho tiviz',
  'form.toolbar': 'Furmaozañ',
  'form.bold': 'Tev',
  'form.boldKey': 'T',
  'form.italic': 'Stouet',
  'form.italicKey': 'S',
  'form.list': 'Roll gant pikoù',
  'form.placeholder':
    'Ho koulenn, ho evezhiadenn pe ho kinnig…\n\n**tev**, *stouet*, ha « - » e penn al linenn evit ur roll.',
  'form.counter': '{count} / {max} arouezenn',
  'form.overLimit': 'Berraait ho testenn evit gallout he c’has : {max} arouezenn d’ar muiañ.',
  'form.send': 'Kas d’ar burev',
  'form.sending': 'O kas…',
  'form.sent': 'Diviz kaset.',
  'form.sentHint': 'Amañ dindan emañ ; gwelet a reot pa vo bet lennet gant ar burev.',
  'form.wait': 'Kas en-dro a-benn {time}',
  'form.notOpen': 'N’eo ket digor degemer an divizoù c’hoazh.',
  'form.closed': 'Serret eo bet degemer an divizoù gant ar burev evit ar mare.',
  'form.ended': 'Echu eo ar vodadeg',
  'form.endedHint':
    'Echu eo ar vodadeg veur : n’haller ket kas divizoù ken. Gwelus e chom ho tivizoù amañ dindan.',
  'form.error.name.required': 'Skrivit hoc’h anv hag hoc’h anv-bihan.',
  'form.error.name.too_long': 'N’hall ket an anv bezañ hiroc’h eget {max} arouezenn.',
  'form.error.school.too_long': 'N’hall ket ar skol pe an aozadur bezañ hiroc’h eget {max} arouezenn.',
  'form.error.text.required': 'Skrivit ho tiviz.',
  'form.error.text.too_long': 'Re hir eo ho tiviz : {max} arouezenn d’ar muiañ.',
  'form.error.too_early': 'Gortozit c’hoazh {time} a-raok kas un diviz nevez.',
  'form.error.rate_limited': 'Re a gasadennoù eus ho rouedad. Gortozit un nebeut munutennoù.',
  'form.error.closed': 'Serret eo degemer an divizoù.',
  'form.error.network': 'C’hwitet eo ar c’has. Gwiriit ho kevreadenn ha klaskit en-dro.',

  // Participant page: my interventions
  'mine.heading': 'Ma divizoù',
  'mine.intro': 'Gwelus ganeoc’h ha gant ar burev hepken.',
  'mine.empty': 'N’hoc’h eus kaset diviz ebet eus an trevnad-mañ c’hoazh.',
  'mine.sentAt': 'Kaset da {time}',
  'status.queued': 'N’eo ket bet lennet c’hoazh',
  'status.read': 'Lennet da {time}',
  'status.rejected': 'N’eo ket bet dalc’het gant ar burev',

  // Durations
  'duration.none': 'tamm dale ebet',
  'duration.seconds': '{s} eil',
  'duration.minutes': '{m} min',
  'duration.minutesSeconds': '{m} min {s} eil',

  // Listening page
  'salle.title': 'Selaou an droidigezh',
  'salle.intro':
    'Ar bajenn-mañ a skign mouezh an etreer·ez hepken (ar brezhoneg troet e galleg), evit an dud a zo er sal.',
  'salle.headphones': 'Implijit selaouelloù evit chom hep trubuilhañ ho amezeien.',
  'salle.keepOpen':
    'Dalc’hit ar bajenn-mañ digor hag ar skramm enaouet : pellgomzerioù zo a droc’h ar son pa vez prennet ar skramm pe pa vez cheñchet arload.',
  'salle.listen': 'Selaou',
  'salle.stop': 'Paouez',
  'salle.state.idle': 'Prest',
  'salle.state.connecting': 'O kevreañ…',
  'salle.state.playing': 'O selaou',
  'salle.state.reconnecting': 'Oc’h adkevreañ…',
  'salle.state.offline': 'N’eo ket skignet an droidigezh er mare-mañ. Klasket e vo en-dro ent emgefreek…',
  'salle.state.paused': 'Troc’het eo bet ar selaou gant ho pellgomzer (galv, dihuner, arload all).',
  'salle.resume': 'Adkregiñ gant ar selaou',
  'salle.unsupported': 'Ho merdeer ne c’hall ket lenn ar son. Klaskit gant ur merdeer hizivaet.',
  'salle.back': 'Distreiñ d’ar skignañ war-eeun',
  'salle.mediaTitle': 'Troidigezh e galleg',

  // Bureau: login
  'bureau.space': 'Lec’h ar burev',
  'login.heading': 'Miret evit ar burev',
  'login.intro':
    'Ar daolenn-stur-mañ a ziskouez an divizoù kaset gant an dud a-bell. N’eo tizhus nemet gant izili burev ar vodadeg.',
  'login.password': 'Ger-tremen',
  'login.passwordHint': 'Roet d’izili ar burev a-raok ar vodadeg, cheñchet bep bodadeg.',
  'login.show': 'Diskouez ar ger-tremen',
  'login.hide': 'Kuzhat ar ger-tremen',
  'login.name': 'Hoc’h anv-bihan',
  'login.nameHint': 'Enrollet e vez gant an divizoù a verkit evel lennet pe n’int ket dalc’het.',
  'login.submit': 'Digeriñ an daolenn-stur',
  'login.error': 'Fall eo ar ger-tremen.',
  'login.nameRequired': 'Skrivit hoc’h anv-bihan.',
  'login.back': 'Distreiñ d’ar skignañ war-eeun',

  // Bureau: shared
  'bureau.eyebrow': 'Burev ar vodadeg · {name}',
  'bureau.logout': 'Digevreañ',
  'bureau.loggedAs': 'Kevreet : {name}',
  'bureau.dashboard': 'Taolenn-stur',
  'bureau.settings': 'Arventennoù ar vodadeg',
  'bureau.noAssembly': 'N’eus bet krouet bodadeg ebet c’hoazh.',
  'bureau.createFirst': 'Krouiñ ur vodadeg',
  'bureau.deletionBanner': 'Diverkadur roadennoù ar vodadeg raktreset d’an {date} da {time}.',
  'bureau.deletionBannerLink': 'Nullañ pe gwelet an arventennoù',

  // Bureau: dashboard
  'dash.title': 'Divizoù a-bell',
  'dash.receptionOpen': 'Degemer digor',
  'dash.receptionClosed': 'Degemer serret',
  'dash.toggleReception': 'Digeriñ pe serriñ degemer an divizoù',
  'dash.notOpened': 'Bodadeg n’eo ket digoret c’hoazh',
  'dash.ended': 'Echu eo ar vodadeg',
  'dash.count.queued': 'Da lenn',
  'dash.count.read': 'Lennet dija',
  'dash.count.total': 'Resevet en holl',
  'dash.queueHeading': 'Steudad an divizoù',
  'dash.filter': 'Silañ an divizoù',
  'dash.tab.queued': 'Da lenn ({n})',
  'dash.tab.read': 'Lennet ({n})',
  'dash.tab.rejected': 'N’int ket dalc’het ({n})',
  'dash.tab.all': 'An holl ({n})',
  'dash.queueIntro':
    'Renket hervez an eur m’int bet resevet, ar c’hoshañ da gentañ. Berraet eo an testennoù hir : digorit anezho bras evit o lenn er sal. Pa verkit un diviz evel lennet, e oberour·ez a wel an dra-se gant an eur.',
  'dash.empty': 'Diviz ebet er roll-mañ.',
  'dash.receivedAt': 'resevet da {time}',
  'dash.words': plural({ one: '{n} ger', two: '{n} c’her', few: '{n} ger', many: '{n} a c’herioù', other: '{n} ger' }),
  'dash.queuedCount': plural({
    one: '{n} diviz da lenn',
    two: '{n} ziviz da lenn',
    few: '{n} diviz da lenn',
    many: '{n} a zivizoù da lenn',
    other: '{n} diviz da lenn',
  }),
  'dash.badge.queued': 'Da lenn',
  'dash.badge.read': 'Lennet da {time}',
  'dash.badge.rejected': 'N’eo ket dalc’het',
  'dash.by': 'gant {name}',
  'dash.publicMessage': 'Kemennadenn d’an oberour·ez :',
  'dash.privateNote': 'Notenn ar burev :',
  'dash.open': 'Digeriñ bras',
  'dash.markRead': 'Merkañ evel lennet',
  'dash.requeue': 'Lakaat en-dro er steudad',
  'dash.reject': 'Chom hep dalc’hen',

  // Bureau: reading view
  'reading.smaller': 'Bihanaat an destenn',
  'reading.bigger': 'Brasaat an destenn',
  'reading.close': 'Serriñ',
  'reading.prev': 'A-raok',
  'reading.next': 'War-lerc’h',
  'reading.position': '{pos} diwar {total}',

  // Bureau: reject dialog
  'reject.heading': 'Chom hep dalc’hen an diviz',
  'reject.public': 'Kemennadenn d’an oberour·ez',
  'reject.publicHint': 'Ret. An oberour·ez a wel anezhi evel ma vo skrivet ganeoc’h.',
  'reject.suggestions': 'Kinnigoù',
  'reject.private': 'Notenn evit ar burev',
  'reject.privateHint': '(diret, morse gwelus gant an oberour·ez)',
  'reject.confirm': 'Kadarnaat',
  'reject.cancel': 'Nullañ',
  'reject.publicRequired': 'Skrivit ur gemennadenn d’an oberour·ez.',

  // Bureau: Régulation
  'reg.heading': 'Reoliañ',
  'reg.hint': 'Ar c’hemmoù a dalv diouzhtu evit ar furmskridoù digor.',
  'reg.delay': 'Dale bihanañ etre daou ginnig',
  'reg.maxChars': 'Hirder brasañ un diviz',
  'reg.chars': '{n} arouezenn',
  'reg.saved': 'Enrollet',
  'reg.error': 'C’hwitet eo an enrollañ',

  // Bureau: AG settings
  'settings.title': 'Arventennoù ar vodadeg',
  'settings.assemblies': 'Bodadegoù',
  'settings.create': 'Krouiñ ur vodadeg',
  'settings.name': 'Anv ar vodadeg',
  'settings.date': 'Deiziad',
  'settings.createSubmit': 'Krouiñ',
  'settings.details': 'Titouroù',
  'settings.save': 'Enrollañ',
  'settings.saved': 'Enrollet.',
  'settings.youtubeA': 'Video YouTube ar wiskad « Son ar sal »',
  'settings.youtubeB': 'Video YouTube ar wiskad « Gant troidigezh e galleg »',
  'settings.youtubeHint': 'Pegit chomlec’h ar video war-eeun pe he naoudi (11 arouezenn).',
  'settings.youtubeInvalid': 'N’eo ket anavezet ar chomlec’h pe an naoudi YouTube-se.',
  'settings.access': 'Moned an dud',
  'settings.code': 'Kod moned',
  'settings.regenerate': 'Krouiñ ur c’hod nevez',
  'settings.regenerateWarn':
    'An dud kevreet dija a gollo o moned ha ret e vo dezho implijout al liamm nevez pe ar c’hod nevez.',
  'settings.link': 'Liamm evit kemer perzh',
  'settings.copy': 'Eilañ al liamm',
  'settings.copied': 'Liamm eilet',
  'settings.qr': 'Kod QR al liamm',
  'settings.printQr': 'Moullañ ar c’hod QR',
  'settings.flow': 'Kenderc’h',
  'settings.currentState': 'Stad : {state}',
  'settings.open': 'Digeriñ ar vodadeg',
  'settings.closeSubmissions': 'Serriñ an degemer',
  'settings.reopenSubmissions': 'Addigeriñ an degemer',
  'settings.end': 'Echuiñ ar vodadeg',
  'settings.endConfirm':
    'Echuiñ ar vodadeg ? An dud ne c’hallint ket kas divizoù ken. Gallout a reot he addigeriñ e-keit ha n’eo ket raktreset an diverkadur.',
  'settings.reopen': 'Addigeriñ ar vodadeg',
  'settings.confirm': 'Kadarnaat',
  'settings.cancel': 'Nullañ',
  'settings.exports': 'Ezporzhiañ evit an danevell',
  'settings.exportsUnavailable': 'An ezporzhiadurioù a vo da gaout pa vo echu ar vodadeg.',
  'settings.exportCsv': 'Pellgargañ ar CSV',
  'settings.exportPrint': 'Stumm da voullañ (PDF)',
  'settings.exportOpened': 'Ezporzhiadur diwezhañ digoret d’an {date} da {time}.',
  'settings.confirmExport': 'Enrollet mat em eus an ezporzhiadur',
  'settings.confirmExportHint':
    'Digorit un ezporzhiadur hag enrollit anezhañ a-raok kadarnaat : an eilenn nemetañ a chomo eo.',
  'settings.exportConfirmed': 'Ezporzhiadur enrollet, kadarnaet gant {name} d’an {date} da {time}.',
  'settings.deletion': 'Diverkañ ar roadennoù',
  'settings.scheduleDeletion': 'Diverkañ a-benn 7 deiz',
  'settings.scheduleHint':
    'An divizoù, an anvioù, ar c’hemennadennoù, an notennoù hag ar c’hod moned a vo diverket da vat 7 deiz goude. Forzh peseurt ezel eus ar burev a c’hall nullañ betek neuze.',
  'settings.scheduleConfirm': 'Raktres diverkañ roadennoù ar vodadeg-mañ a-benn 7 deiz ?',
  'settings.deletionScheduled': 'Diverkadur raktreset d’an {date} da {time}.',
  'settings.cancelDeletion': 'Nullañ an diverkadur',
  'settings.deleted': 'Diverket eo bet roadennoù ar vodadeg-mañ. Ne chom nemet he anv hag he deiziad.',
  'settings.err.other_active':
    'Ur vodadeg all a zo digor, echu pe o c’hortoz bezañ diverket. Raktresit he diverkañ ha gortozit ma vo graet a-raok digeriñ unan nevez.',
  'settings.err.invalid_state': 'N’haller ket ober an dra-se e stad a-vremañ ar vodadeg.',
  'settings.err.export_not_opened': 'Digorit un ezporzhiadur da gentañ (CSV pe stumm da voullañ).',
  'settings.err.export_not_confirmed': 'Kadarnait da gentañ eo bet enrollet mat an ezporzhiadur.',
  'settings.err.invalid': 'Gwiriit maeziennoù ar furmskrid.',
  'state.preparation': 'O prientiñ',
  'state.in_progress': 'O vont en-dro',
  'state.ended': 'Echu',
  'state.deletion_scheduled': 'Diverkadur raktreset',
  'state.deleted': 'Diverket',

  // QR print view
  'qr.heading': 'Heuliañ ar vodadeg a-bell',
  'qr.instructions':
    'Skannit ar c’hod-mañ evit heuliañ ar vodadeg, selaou an droidigezh war ho pellgomzer pe kas un diviz d’ar burev.',
  'qr.code': 'Kod : {code}',
};
