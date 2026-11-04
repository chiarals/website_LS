// What the reserved area lets Chiara edit, grouped as she sees the site.
// key: a text in content.texts (Italian and English). long: several lines.
// courses / gallery / image / faq / post: the editors for those lists.
// page: which page the preview shows while the group is open.

export const GROUPS = [
  {
    id: 'home', title: 'Home', page: 'index.html#home',
    items: [
      { key: 'hero.text', label: 'Presentazione', long: true },
      { key: 'hero.cta', label: 'Pulsante verso i corsi' },
      { key: 'hero.about', label: 'Pulsante “Chi sono”' },
      { key: 'hero.contact', label: 'Pulsante “Contatti”' },
      { gallery: 'home', label: 'Foto sotto la presentazione' },
    ],
  },
  {
    id: 'corsi', title: 'Corsi', page: 'corsi.html',
    items: [
      { key: 'corsi.intro', label: 'Introduzione della pagina Corsi', long: true },
      { key: 'corsi.quando', label: 'Quando' },
      { key: 'corsi.dove', label: 'Dove' },
      { key: 'corsi.partecipanti', label: 'Partecipanti' },
      { key: 'corsi.g1', label: 'Titolo del primo gruppo di corsi' },
      { courses: 'percorsi', label: 'Corsi del primo gruppo', hint: 'Con durata e sessioni.' },
      { key: 'corsi.g2', label: 'Titolo del secondo gruppo' },
      { courses: 'altri', label: 'Corsi del secondo gruppo', hint: 'Solo titolo e descrizione.' },
      { key: 'corsi.n1', label: 'Nota sotto i corsi (1)' },
      { key: 'corsi.n2', label: 'Nota sotto i corsi (2)' },
      { key: 'corsi.teaser', label: 'Frase sui corsi in home', page: 'index.html#corsi' },
      { key: 'corsi.all', label: 'Pulsante “Vedi tutti i corsi” in home', page: 'index.html#corsi' },
      { gallery: 'corsi', label: 'Foto della sezione corsi in home', page: 'index.html#corsi' },
    ],
  },
  {
    id: 'degustazioni', title: 'Degustazioni', page: 'index.html#degustazioni',
    items: [
      { key: 'degustazioni.intro', label: 'Testo', long: true },
      { gallery: 'degustazioni-1', label: 'Prima fila di foto' },
      { gallery: 'degustazioni-2', label: 'Seconda fila di foto' },
    ],
  },
  {
    id: 'collaborazioni', title: 'Collaborazioni', page: 'index.html#collaborazioni',
    items: [
      { key: 'collab.intro', label: 'Testo', long: true },
      { key: 'collab.t1', label: 'Tipo di collaborazione 1' },
      { key: 'collab.t2', label: 'Tipo di collaborazione 2' },
      { key: 'collab.t3', label: 'Tipo di collaborazione 3' },
      { key: 'collab.t4', label: 'Tipo di collaborazione 4' },
      { gallery: 'collaborazioni', label: 'Foto' },
    ],
  },
  {
    id: 'newsletter', title: 'Newsletter', page: 'index.html#newsletter',
    items: [
      { key: 'nl.desc', label: 'Descrizione', long: true },
      { key: 'nl.email', label: 'Scritta nel campo email' },
      { key: 'nl.subscribe', label: 'Pulsante di iscrizione' },
      { key: 'nl.note', label: 'Nota sotto il modulo' },
      { key: 'nl.follow', label: 'Link a Substack' },
      { post: true, label: 'Ultimo articolo' },
      { key: 'nl.latest', label: 'Scritta sopra l’articolo (con la data)' },
      { key: 'nl.read', label: 'Link “Leggi su Substack”' },
    ],
  },
  {
    id: 'faq', title: 'Domande frequenti', page: 'index.html#faq',
    items: [{ faq: true, label: 'Domande e risposte' }],
  },
  {
    id: 'chi-sono', title: 'Chi sono', page: 'chi-sono.html',
    items: [
      { key: 'about.role', label: 'Ruolo' },
      { key: 'about.p1', label: 'Paragrafo 1', long: true },
      { key: 'about.p2', label: 'Paragrafo 2', long: true },
      { key: 'about.p3', label: 'Paragrafo 3', long: true },
      { key: 'about.p4', label: 'Paragrafo 4', long: true },
      { key: 'about.substack', label: 'Pulsante Substack' },
      { image: 'about', label: 'Foto' },
    ],
  },
  {
    id: 'etichette', title: 'Titoli e pulsanti', page: 'index.html#contatti',
    hint: 'I nomi delle sezioni in alto a sinistra e le scritte ricorrenti.',
    items: [
      { key: 'label.corsi', label: 'Sezione Corsi' },
      { key: 'label.degustazioni', label: 'Sezione Degustazioni' },
      { key: 'label.collaborazioni', label: 'Sezione Collaborazioni' },
      { key: 'label.newsletter', label: 'Sezione Newsletter' },
      { key: 'label.faq', label: 'Sezione Domande frequenti' },
      { key: 'label.contatti', label: 'Sezione Contatti' },
      { key: 'label.about', label: 'Pagina Chi sono' },
      { key: 'corsi.k.durata', label: 'Etichetta “Durata”', page: 'corsi.html' },
      { key: 'corsi.k.sessioni', label: 'Etichetta “Sessioni”', page: 'corsi.html' },
      { key: 'corsi.k.quando', label: 'Etichetta “Quando”', page: 'corsi.html' },
      { key: 'corsi.k.dove', label: 'Etichetta “Dove”', page: 'corsi.html' },
      { key: 'corsi.k.partecipanti', label: 'Etichetta “Partecipanti”', page: 'corsi.html' },
      { key: 'contact.write', label: 'Pulsante “Scrivici”' },
      { key: 'nav.home', label: 'Link “Home” in alto', page: 'corsi.html' },
      { key: 'nav.back', label: 'Pulsante “Torna alla home”', page: 'corsi.html' },
      { key: 'footer.place', label: 'Città in fondo alla pagina' },
      { key: 'footer.privacy', label: 'Link alla privacy' },
    ],
  },
];

export const COURSE_FIELDS = {
  percorsi: [
    { f: 't', label: 'Titolo' },
    { f: 'lead', label: 'Descrizione', long: true },
    { f: 'more', label: 'Seguito della descrizione', long: true },
    { f: 'dur', label: 'Durata' },
    { f: 'ses', label: 'Sessioni' },
  ],
  altri: [
    { f: 't', label: 'Titolo' },
    { f: 'lead', label: 'Descrizione', long: true },
  ],
};

export const PREVIEW_PAGES = [
  { page: 'index.html', label: 'Home' },
  { page: 'corsi.html', label: 'Corsi' },
  { page: 'chi-sono.html', label: 'Chi sono' },
];
