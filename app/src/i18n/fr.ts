import type { PluralForms } from './core.ts';

const plural = (forms: PluralForms): PluralForms => forms;

/**
 * Reference dictionary (French). Every key used by the app must exist here.
 * `{name}` placeholders are filled by t(); plural entries also get `{n}`.
 * See docs/i18n.md before adding or changing a string.
 */
export const fr = {
  // Shared layout
  'lang.label': 'Langue',
  'lang.fr': 'Français',
  'lang.br': 'Brezhoneg',
  'app.eyebrow': 'Assemblée générale · {date}',
  'app.eyebrowNoDate': 'Assemblée générale',
  'app.live': 'En direct',
  'app.reconnecting': 'Reconnexion…',
  'app.error': "L'action n'a pas pu être effectuée. Réessayez.",

  // Code entry page
  'code.title': "Suivre l'AG à distance",
  'code.heading': 'Accès réservé aux membres',
  'code.intro':
    "Pour suivre l'assemblée générale à distance, ouvrez le lien reçu dans la convocation, ou saisissez le code d'accès qui y figure.",
  'code.label': "Code d'accès",
  'code.hint': 'Majuscules ou minuscules, peu importe.',
  'code.submit': "Accéder à l'AG",
  'code.invalid': "Ce code ne donne pas accès à l'AG. Vérifiez-le, ou utilisez le lien de la convocation.",
  'code.tooMany': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'code.bureau': 'Espace bureau',

  // Landing page: in the room or remote
  'home.question': "Comment suivez-vous l'AG ?",
  'home.intro': "Choisissez selon l'endroit où vous êtes. Vous pourrez changer à tout moment.",
  'home.room.title': 'Je suis dans la salle',
  'home.room.text': "Écoutez l'interprétation en français sur votre téléphone, avec des écouteurs.",
  'home.room.cta': "Écouter l'interprétation",
  'home.remote.title': 'Je suis à distance',
  'home.remote.text': 'Suivez le direct vidéo et proposez une intervention au bureau.',
  'home.remote.cta': 'Suivre le direct',
  'home.back': 'Accueil',

  // Participant page: stream
  'participant.title': "Suivre l'AG à distance",
  'stream.heading': 'Le direct',
  'stream.choice': 'Choix du flux vidéo',
  'stream.a.label': 'Son de la salle',
  'stream.a.hint': 'Version originale, breton et français',
  'stream.b.label': 'Avec traduction en français',
  'stream.b.hint': 'Le breton traduit en direct',
  'stream.a.explain':
    'Vous écoutez le son de la salle, sans traduction. Pour entendre le breton traduit en français, choisissez « Avec traduction en français ».',
  'stream.b.explain':
    'Vous écoutez la traduction : les interventions en breton sont traduites en français par un·e interprète. Les interventions en français restent inchangées.',
  'stream.notStarted': "Le direct n'a pas encore commencé",
  'stream.notStartedHint': 'Le lecteur apparaîtra ici dès que le bureau aura indiqué le lien de la diffusion.',
  'stream.playerTitle': 'Lecteur YouTube — {stream}',
  'stream.noChat':
    "Il n'y a pas de chat. Pour intervenir, envoyez votre texte au bureau de l'AG avec le formulaire : le bureau choisit les interventions qu'il lit en séance.",
  'stream.salleLink': "Dans la salle ? Écoutez l'interprétation sur votre téléphone",

  // Participant page: form
  'form.heading': 'Proposer une intervention',
  'form.intro': "Votre texte n'est visible que par le bureau de l'AG, qui le lira à son appréciation.",
  'form.name': 'Nom et prénom',
  'form.school': 'École ou structure',
  'form.optional': '(facultatif)',
  'form.text': 'Votre intervention',
  'form.toolbar': 'Mise en forme',
  'form.bold': 'Gras',
  'form.boldKey': 'G',
  'form.italic': 'Italique',
  'form.italicKey': 'I',
  'form.list': 'Liste à puces',
  'form.placeholder':
    'Votre question, votre remarque ou votre proposition…\n\n**gras**, *italique*, et « - » en début de ligne pour une liste.',
  'form.counter': '{count} / {max} caractères',
  'form.overLimit': 'Raccourcissez votre texte pour pouvoir l’envoyer : la limite est de {max} caractères.',
  'form.send': 'Envoyer au bureau',
  'form.sending': 'Envoi…',
  'form.sent': 'Intervention envoyée.',
  'form.sentHint': "Vous la retrouvez ci-dessous ; vous verrez quand le bureau l'aura lue.",
  'form.wait': 'Prochain envoi possible dans {time}',
  'form.notOpen': "La réception des interventions n'est pas encore ouverte.",
  'form.closed': 'Le bureau a fermé la réception des interventions pour le moment.',
  'form.ended': 'AG terminée',
  'form.endedHint':
    "L'assemblée générale est terminée : il n'est plus possible d'envoyer d'intervention. Vos interventions restent visibles ci-dessous.",
  'form.error.name.required': 'Indiquez votre nom et prénom.',
  'form.error.name.too_long': 'Le nom ne doit pas dépasser {max} caractères.',
  'form.error.school.too_long': "L'école ou la structure ne doit pas dépasser {max} caractères.",
  'form.error.text.required': 'Écrivez votre intervention.',
  'form.error.text.too_long': 'Votre intervention dépasse la limite de {max} caractères.',
  'form.error.too_early': 'Attendez encore {time} avant d’envoyer une nouvelle intervention.',
  'form.error.rate_limited': "Trop d'envois depuis votre réseau. Patientez quelques minutes.",
  'form.error.closed': 'La réception des interventions est fermée.',
  'form.error.network': "L'envoi a échoué. Vérifiez votre connexion et réessayez.",

  // Participant page: my interventions
  'mine.heading': 'Mes interventions',
  'mine.intro': 'Visibles par vous et par le bureau uniquement.',
  'mine.empty': "Vous n'avez encore envoyé aucune intervention depuis cet appareil.",
  'mine.sentAt': 'Envoyée à {time}',
  'status.queued': 'Pas encore lue',
  'status.read': 'Lue à {time}',
  'status.rejected': 'Non retenue par le bureau',

  // Durations (countdown, Régulation)
  'duration.none': 'aucun délai',
  'duration.seconds': '{s} s',
  'duration.minutes': '{m} min',
  'duration.minutesSeconds': '{m} min {s} s',

  // Listening page
  'salle.title': "Écouter l'interprétation",
  'salle.intro':
    "Cette page diffuse uniquement la voix de l'interprète (le breton traduit en français), pour les personnes présentes dans la salle.",
  'salle.headphones': 'Utilisez des écouteurs pour ne pas gêner vos voisin·es.',
  'salle.keepOpen':
    "Gardez cette page ouverte et l'écran allumé : certains téléphones coupent le son quand l'écran se verrouille ou quand on change d'application.",
  'salle.listen': 'Écouter',
  'salle.stop': 'Arrêter',
  'salle.state.idle': 'Prêt',
  'salle.state.connecting': 'Connexion…',
  'salle.state.playing': 'En écoute',
  'salle.state.reconnecting': 'Reconnexion…',
  'salle.state.offline': "L'interprétation n'est pas diffusée en ce moment. Nouvel essai automatique…",
  'salle.state.paused': "L'écoute a été interrompue par votre téléphone (appel, alarme, autre application).",
  'salle.resume': "Reprendre l'écoute",
  'salle.unsupported': "Votre navigateur ne permet pas l'écoute. Essayez avec un navigateur à jour.",
  'salle.mediaTitle': 'Interprétation en français',

  // Bureau: login
  'bureau.space': 'Espace bureau',
  'login.heading': 'Accès réservé au bureau',
  'login.intro':
    "Ce tableau de bord affiche les interventions envoyées par les participant·es à distance. Il n'est accessible qu'aux membres du bureau de l'AG.",
  'login.password': 'Mot de passe',
  'login.passwordHint': "Communiqué aux membres du bureau avant l'AG, changé à chaque assemblée.",
  'login.show': 'Afficher le mot de passe',
  'login.hide': 'Masquer le mot de passe',
  'login.name': 'Votre prénom',
  'login.nameHint': 'Il est enregistré avec les interventions que vous marquez comme lues ou non retenues.',
  'login.submit': 'Ouvrir le tableau de bord',
  'login.error': 'Mot de passe incorrect.',
  'login.nameRequired': 'Indiquez votre prénom.',
  'login.back': 'Retour au direct',

  // Bureau: shared
  'bureau.eyebrow': "Bureau de l'AG · {name}",
  'bureau.logout': 'Se déconnecter',
  'bureau.loggedAs': 'Connecté·e : {name}',
  'bureau.dashboard': 'Tableau de bord',
  'bureau.settings': "Réglages de l'AG",
  'bureau.noAssembly': "Aucune AG n'est encore créée.",
  'bureau.createFirst': 'Créer une AG',
  'bureau.deletionBanner': 'Suppression des données de l’AG prévue le {date} à {time}.',
  'bureau.deletionBannerLink': 'Annuler ou voir les réglages',

  // Bureau: dashboard
  'dash.title': 'Interventions à distance',
  'dash.receptionOpen': 'Réception ouverte',
  'dash.receptionClosed': 'Réception fermée',
  'dash.toggleReception': 'Ouvrir ou fermer la réception des interventions',
  'dash.notOpened': 'AG pas encore ouverte',
  'dash.ended': 'AG terminée',
  'dash.count.queued': 'À lire',
  'dash.count.read': 'Déjà lues',
  'dash.count.total': 'Reçues au total',
  'dash.queueHeading': 'File des interventions',
  'dash.filter': 'Filtrer les interventions',
  'dash.tab.queued': 'À lire ({n})',
  'dash.tab.read': 'Lues ({n})',
  'dash.tab.rejected': 'Non retenues ({n})',
  'dash.tab.all': 'Toutes ({n})',
  'dash.queueIntro':
    "Classées par heure de réception, la plus ancienne en premier. Les textes longs sont abrégés : ouvrez-les en grand pour les lire en séance. Quand vous marquez une intervention comme lue, son auteur·e le voit avec l'heure.",
  'dash.empty': 'Aucune intervention dans cette liste.',
  'dash.receivedAt': 'reçue à {time}',
  'dash.words': plural({ one: '{n} mot', other: '{n} mots' }),
  'dash.queuedCount': plural({ one: '{n} intervention à lire', other: '{n} interventions à lire' }),
  'dash.badge.queued': 'À lire',
  'dash.badge.read': 'Lue à {time}',
  'dash.badge.rejected': 'Non retenue',
  'dash.by': 'par {name}',
  'dash.publicMessage': 'Message à l’auteur·e :',
  'dash.privateNote': 'Note du bureau :',
  'dash.open': 'Ouvrir en grand',
  'dash.markRead': 'Marquer comme lue',
  'dash.requeue': 'Remettre en file',
  'dash.reject': 'Ne pas retenir',

  // Bureau: reading view
  'reading.smaller': 'Réduire le texte',
  'reading.bigger': 'Agrandir le texte',
  'reading.close': 'Fermer',
  'reading.prev': 'Précédente',
  'reading.next': 'Suivante',
  'reading.position': '{pos} sur {total}',

  // Bureau: reject dialog
  'reject.heading': "Ne pas retenir l'intervention",
  'reject.public': "Message à l'auteur·e",
  'reject.publicHint': "Obligatoire. L'auteur·e le voit tel que vous l'écrivez.",
  'reject.suggestions': 'Suggestions',
  'reject.private': 'Note pour le bureau',
  'reject.privateHint': "(facultatif, jamais visible par l'auteur·e)",
  'reject.confirm': 'Confirmer',
  'reject.cancel': 'Annuler',
  'reject.publicRequired': "Écrivez un message pour l'auteur·e.",

  // Bureau: Régulation
  'reg.heading': 'Régulation',
  'reg.hint': "Les changements s'appliquent tout de suite aux formulaires ouverts.",
  'reg.delay': 'Délai minimum entre deux propositions',
  'reg.maxChars': "Longueur maximale d'une intervention",
  'reg.chars': '{n} caractères',
  'reg.saved': 'Enregistré',
  'reg.error': "Échec de l'enregistrement",

  // Bureau: AG settings
  'settings.title': "Réglages de l'AG",
  'settings.assemblies': 'Assemblées',
  'settings.create': 'Créer une AG',
  'settings.name': "Nom de l'AG",
  'settings.date': 'Date',
  'settings.createSubmit': 'Créer',
  'settings.details': 'Informations',
  'settings.save': 'Enregistrer',
  'settings.saved': 'Enregistré.',
  'settings.youtubeA': 'Vidéo YouTube du flux « Son de la salle »',
  'settings.youtubeB': 'Vidéo YouTube du flux « Avec traduction en français »',
  'settings.youtubeHint': "Collez l'adresse de la vidéo en direct ou son identifiant (11 caractères).",
  'settings.youtubeInvalid': "Cette adresse ou cet identifiant YouTube n'est pas reconnu.",
  'settings.access': 'Accès des participant·es',
  'settings.code': "Code d'accès",
  'settings.regenerate': 'Générer un nouveau code',
  'settings.regenerateWarn':
    "Les personnes déjà connectées perdront l'accès et devront utiliser le nouveau lien ou le nouveau code.",
  'settings.link': 'Lien de participation',
  'settings.copy': 'Copier le lien',
  'settings.copied': 'Lien copié',
  'settings.qr': 'QR code du lien',
  'settings.printQr': 'Imprimer le QR code',
  'settings.flow': 'Déroulé',
  'settings.currentState': 'État : {state}',
  'settings.open': "Ouvrir l'AG",
  'settings.closeSubmissions': 'Fermer la réception',
  'settings.reopenSubmissions': 'Rouvrir la réception',
  'settings.end': "Terminer l'AG",
  'settings.endConfirm':
    "Terminer l'AG ? Les participant·es ne pourront plus envoyer d'intervention. Vous pourrez la rouvrir tant que la suppression n'est pas programmée.",
  'settings.reopen': "Rouvrir l'AG",
  'settings.confirm': 'Confirmer',
  'settings.cancel': 'Annuler',
  'settings.exports': 'Exports pour le procès-verbal',
  'settings.exportsUnavailable': "Les exports sont disponibles une fois l'AG terminée.",
  'settings.exportCsv': 'Télécharger le CSV',
  'settings.exportPrint': 'Version imprimable (PDF)',
  'settings.exportOpened': 'Dernier export ouvert le {date} à {time}.',
  'settings.confirmExport': "J'ai bien enregistré l'export",
  'settings.confirmExportHint': "Ouvrez un export et enregistrez-le avant de confirmer : c'est la seule copie qui restera.",
  'settings.exportConfirmed': 'Export enregistré, confirmé par {name} le {date} à {time}.',
  'settings.deletion': 'Suppression des données',
  'settings.scheduleDeletion': 'Supprimer dans 7 jours',
  'settings.scheduleHint':
    "Les interventions, noms, messages, notes et le code d'accès seront supprimés définitivement 7 jours plus tard. N'importe quel membre du bureau peut annuler d'ici là.",
  'settings.scheduleConfirm': 'Programmer la suppression des données de cette AG dans 7 jours ?',
  'settings.deletionScheduled': 'Suppression prévue le {date} à {time}.',
  'settings.cancelDeletion': 'Annuler la suppression',
  'settings.deleted': "Les données de cette AG ont été supprimées. Il n'en reste que le nom et la date.",
  'settings.err.other_active':
    "Une autre AG est déjà ouverte, terminée ou en attente de suppression. Programmez sa suppression et attendez qu'elle soit effectuée avant d'en ouvrir une nouvelle.",
  'settings.err.invalid_state': "Cette action n'est pas possible dans l'état actuel de l'AG.",
  'settings.err.export_not_opened': "Ouvrez d'abord un export (CSV ou version imprimable).",
  'settings.err.export_not_confirmed': "Confirmez d'abord que l'export est bien enregistré.",
  'settings.err.invalid': 'Vérifiez les champs du formulaire.',
  'state.preparation': 'En préparation',
  'state.in_progress': 'En cours',
  'state.ended': 'Terminée',
  'state.deletion_scheduled': 'Suppression programmée',
  'state.deleted': 'Supprimée',

  // QR print view
  'qr.heading': "Suivre l'AG à distance",
  'qr.instructions':
    "Scannez ce code pour suivre l'AG, écouter l'interprétation sur votre téléphone ou envoyer une intervention au bureau.",
  'qr.code': 'Code : {code}',

  // Exports: always French (D12), never translated (skipped by npm run i18n:check).
  'export.csv.receivedAt': 'Heure de réception',
  'export.csv.name': 'Nom',
  'export.csv.school': 'École ou structure',
  'export.csv.text': 'Texte',
  'export.csv.status': 'Statut',
  'export.csv.statusAt': 'Heure du statut',
  'export.csv.statusBy': 'Membre du bureau',
  'export.csv.publicMessage': 'Message public',
  'export.csv.privateNote': 'Note privée',
  'export.status.queued': 'Non lue',
  'export.status.read': 'Lue',
  'export.status.rejected': 'Non retenue',
  'export.print.title': 'Interventions à distance — {name}',
  'export.print.assembly': 'Assemblée générale du {date}',
  'export.print.exportedAt': 'Export du {date} à {time}',
  'export.print.count': plural({ one: '{n} intervention, par heure de réception', other: '{n} interventions, par heure de réception' }),
  'export.print.empty': 'Aucune intervention reçue.',
  'export.print.receivedAt': 'Reçue à {time}',
  'export.print.status': 'Statut :',
  'export.print.readAt': 'lue à {time} ({name})',
  'export.print.rejectedAt': 'non retenue à {time} ({name})',
  'export.print.queued': 'non lue',
  'export.print.publicMessage': 'Message public :',
  'export.print.print': 'Imprimer ou enregistrer en PDF',
} satisfies Record<string, string | PluralForms>;

export type Dict = typeof fr;
export type Key = keyof Dict;
export type StringKey = { [K in Key]: Dict[K] extends string ? K : never }[Key];
export type PluralKey = { [K in Key]: Dict[K] extends PluralForms ? K : never }[Key];
