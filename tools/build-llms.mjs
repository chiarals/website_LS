// Builds /llms.txt (short guide for AI assistants, llmstxt.org format) and /llms-full.txt
// (all site content in Italian and English) from i18n.js.  Run: node tools/build-llms.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8') + '\nthis.I18N = I18N;', ctx);
const { it, en } = ctx.I18N;
const BASE = 'https://lasputacchiera.com';
const plain = (s) => s.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const short = `# La Sputacchiera

> Corsi sul vino personalizzati e degustazioni su regioni meno conosciute, a Milano, in casa, per piccoli gruppi (da 1 a 4 persone). Fondato da Chiara Asselta, ingegnera biomedica e certificata WSET Level 3 in Wines. Newsletter senza tecnicismi su Substack e community WhatsApp.
> Tailored wine courses and tastings of lesser-known regions in Milan, at home, for small groups (1 to 4 people), by Chiara Asselta (WSET Level 3 Award in Wines).

- Lingue / Languages: italiano (principale), English
- Dove / Where: Milano, zona San Siro o City Life, in casa privata
- Quando / When: su appuntamento, data scelta dal partecipante
- Contatti / Contact: chiara.asselta@gmail.com, WhatsApp +39 338 696 5363

## Pagine / Pages

- [Home](${BASE}/): presentazione, corsi in breve, degustazioni, collaborazioni, newsletter, FAQ, contatti
- [Corsi](${BASE}/corsi.html): dettagli dei corsi (durata, sessioni, a chi sono rivolti)
- [Chi sono](${BASE}/chi-sono.html): biografia di Chiara Asselta, fondatrice

## Corsi / Courses

- [${it['corsi.c1.t']}](${BASE}/corsi.html#percorso-1): ${it['corsi.c1.lead']} Durata ${it['corsi.c1.dur']}.
- [${it['corsi.c2.t']}](${BASE}/corsi.html#percorso-2): ${it['corsi.c2.lead']} Durata ${it['corsi.c2.dur']}.
- [${it['corsi.c3.t']}](${BASE}/corsi.html#percorso-3): ${it['corsi.c3.lead']} Durata ${it['corsi.c3.dur']}.
- [${it['corsi.sumisura.t']}](${BASE}/corsi.html#percorso-4): ${it['corsi.sumisura.d']}
- [${it['corsi.regalo.t']}](${BASE}/corsi.html#percorso-5): ${it['corsi.regalo.d']}

## Newsletter

- [La Sputacchiera su Substack](https://lasputacchiera.substack.com/): ${it['nl.desc']}
- [Chiara Asselta su Substack](https://substack.com/@chiaraasselta)

## Optional

- [Contenuto completo / Full content](${BASE}/llms-full.txt): tutti i testi del sito in italiano e in inglese
`;

const full = (t, heading) => `## ${heading}

### ${plain(t['label.corsi'])}
${plain(t['corsi.intro'])}

- ${t['corsi.k.quando']}: ${t['corsi.quando']}
- ${t['corsi.k.dove']}: ${t['corsi.dove']}
- ${t['corsi.k.partecipanti']}: ${t['corsi.partecipanti']}

${[1, 2, 3].map((n) => `#### ${t[`corsi.c${n}.t`]}
${t[`corsi.c${n}.lead`]} ${t[`corsi.c${n}.more`]}
${t['corsi.k.durata']}: ${t[`corsi.c${n}.dur`]}. ${t['corsi.k.sessioni']}: ${t[`corsi.c${n}.ses`]}.`).join('\n\n')}

#### ${t['corsi.sumisura.t']}
${t['corsi.sumisura.d']}

#### ${t['corsi.regalo.t']}
${t['corsi.regalo.d']}

${t['corsi.n1']} ${t['corsi.n2']}

### ${t['label.degustazioni']}
${plain(t['degustazioni.intro'])}

### ${t['label.collaborazioni']}
${plain(t['collab.intro'])}
${[1, 2, 3, 4].map((n) => `- ${t[`collab.t${n}`]}`).join('\n')}

### Newsletter
${t['nl.desc']}
https://lasputacchiera.substack.com/

### ${t['label.about']}: Chiara Asselta
${[1, 2, 3, 4].map((n) => plain(t[`about.p${n}`])).join('\n\n')}

### ${t['label.faq']}
${[1, 2, 3, 4, 5].map((n) => `**${t[`faq.q${n}`]}**\n${t[`faq.a${n}`]}`).join('\n\n')}

### ${t['label.contatti']}
chiara.asselta@gmail.com · WhatsApp +39 338 696 5363 · ${BASE}
`;

const fullText = `# La Sputacchiera: contenuto completo / full content

> ${plain(it['hero.text'])}
> ${plain(en['hero.text'])}

Sito / Website: ${BASE}

${full(it, 'Italiano')}
${full(en, 'English')}`;

fs.writeFileSync(path.join(root, 'llms.txt'), short);
fs.writeFileSync(path.join(root, 'llms-full.txt'), fullText);
console.log('llms.txt', short.length, 'chars · llms-full.txt', fullText.length, 'chars');
