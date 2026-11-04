// Turns content/live.json (or a draft) into page HTML. Shared by the site (script.js),
// the reserved area (admin/) and the Node bake tool, so all three render the same markup.
// Pages mark the parts built from content with <!--render:name--> ... <!--/render:name-->.

export const REPO = { owner: 'chiarals', repo: 'website_LS', branch: 'main' };
export const BASE = 'https://lasputacchiera.com';
export const PAGES = ['index.html', 'corsi.html', 'chi-sono.html', 'privacy.html'];
export const LANGS = ['it', 'en'];

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s ?? '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

// Every course in page order, with its position (01, 02, ...) and anchor on corsi.html.
export function allCourses(c) {
  return [...c.courses.percorsi.map((x) => ({ ...x, group: 'percorsi' })), ...c.courses.altri.map((x) => ({ ...x, group: 'altri' }))]
    .map((x, i) => ({ ...x, n: i + 1, anchor: `percorso-${i + 1}` }));
}

// One flat key -> text map for a language: site texts, courses, FAQ and photo descriptions.
// Anything left empty in English falls back to the Italian text.
export function flatTexts(c, lang) {
  const out = {};
  const put = (key, it, en) => { out[key] = (lang === 'en' && en) ? en : (it ?? ''); };
  for (const k of Object.keys(c.texts.it)) put(k, c.texts.it[k], c.texts.en[k]);
  for (const x of allCourses(c)) for (const f of Object.keys(x.it)) put(`course.${x.id}.${f}`, x.it[f], x.en?.[f]);
  c.faq.forEach((x, i) => { put(`faq.${i}.q`, x.it.q, x.en?.q); put(`faq.${i}.a`, x.it.a, x.en?.a); });
  for (const [g, list] of Object.entries(c.galleries)) list.forEach((x, i) => put(`img.${g}.${i}`, x.alt?.it, x.alt?.en));
  put('img.about', c.images.about.alt?.it, c.images.about.alt?.en);
  return out;
}

// With t = null the blocks come out without texts: the structure alone, used to tell
// whether a block needs rebuilding or only new words.
function blocks(c, t) {
  const tx = (k) => (t ? t[k] ?? '' : '');
  const alt = (k) => esc(t ? plain(t[k]) : '');
  const gallery = (g) => c.galleries[g].map((x, i) =>
    `<img src="${esc(x.src)}" data-i18n-alt="img.${g}.${i}" alt="${alt(`img.${g}.${i}`)}" style="--r:${Number(x.r) || 1}" loading="lazy">`).join('\n        ');
  const card = (x) => {
    const k = (f) => `course.${x.id}.${f}`;
    const more = x.it.more ? ` <span data-i18n="${k('more')}">${tx(k('more'))}</span>` : '';
    const lead = `<p class="lead"><span data-i18n="${k('lead')}">${tx(k('lead'))}</span>${more}</p>`;
    const spec = (f, label) => (x.it[f] ? `\n              <div><dt data-i18n="corsi.k.${label}">${tx(`corsi.k.${label}`)}</dt><dd data-i18n="${k(f)}">${tx(k(f))}</dd></div>` : '');
    const specs = x.group === 'percorsi' && (x.it.dur || x.it.ses)
      ? `\n            <dl class="specs">${spec('dur', 'durata')}${spec('ses', 'sessioni')}\n            </dl>` : '';
    return `<article id="${x.anchor}">
          <h3 class="card-head"><span data-i18n="${k('t')}">${tx(k('t'))}</span></h3>
          <div class="card-body">
            ${lead}${specs}
          </div>
        </article>`;
  };
  const courses = allCourses(c);
  const post = c.newsletterPost;
  return {
    'course-list': courses.map((x) =>
      `<li><a href="corsi.html#${x.anchor}"><span class="course-num">${pad(x.n)}</span><span data-i18n="course.${x.id}.t">${tx(`course.${x.id}.t`)}</span></a></li>`).join('\n        '),
    'courses-percorsi': courses.filter((x) => x.group === 'percorsi').map(card).join('\n        '),
    'courses-altri': courses.filter((x) => x.group === 'altri').map(card).join('\n        '),
    ...Object.fromEntries(Object.keys(c.galleries).map((g) => [`gallery:${g}`, gallery(g)])),
    'about-photo': `<img src="${esc(c.images.about.src)}" data-i18n-alt="img.about" alt="${alt('img.about')}">`,
    faq: c.faq.map((_, i) =>
      `<details><summary data-i18n="faq.${i}.q">${tx(`faq.${i}.q`)}</summary><p data-i18n="faq.${i}.a">${tx(`faq.${i}.a`)}</p></details>`).join('\n        '),
    'nl-post': `<a class="nl-post reveal" href="${esc(post.url)}" target="_blank" rel="noopener">
          <picture>${post.thumb ? `
            <source media="(max-width: 640px)" srcset="${esc(post.thumb)}">` : ''}
            <img src="${esc(post.src)}" alt="" loading="lazy">
          </picture>
          <span class="nl-post-meta" data-i18n="nl.latest">${tx('nl.latest')}</span>
          <span class="nl-post-title">${esc(post.title)}</span>
          <span class="nl-post-read" data-i18n="nl.read">${tx('nl.read')}</span>
        </a>`,
  };
}

export function renderBlock(name, c, t) {
  const b = blocks(c, t);
  return name in b ? b[name] : null;
}

// Short stable fingerprint of the content, stamped in the pages so the browser fetches
// the matching content/live.json instead of a cached older one.
export function contentVersion(c) {
  const s = JSON.stringify(c);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

// ---------- Publishing: write the Italian texts straight into the HTML ----------
// so search engines and AI crawlers read the content without running JavaScript.
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function bakePage(html, c, page = '') {
  const t = flatTexts(c, 'it');
  const b = blocks(c, t);
  const extra = {
    version: `<meta name="content-version" content="${contentVersion(c)}">\n  <link rel="preload" href="content/live.json?v=${contentVersion(c)}" as="fetch" crossorigin>`,
    'jsonld-corsi': jsonLdCorsi(c),
  };
  html = html.replace(/<!--render:([\w:-]+)-->[\s\S]*?<!--\/render:\1-->/g, (m, name) => {
    const inner = name in b ? b[name] : extra[name];
    if (inner == null) throw new Error(`${page}: unknown block "${name}"`);
    return `<!--render:${name}-->${inner}<!--/render:${name}-->`;
  });
  html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (m, open, tag, key, _inner, close) => {
    if (!(key in t)) throw new Error(`${page}: missing Italian text for "${key}"`);
    return open + t[key] + close;
  });
  html = html.replace(/<(img|input)\b[^>]*>/g, (tag) => {
    const altKey = tag.match(/data-i18n-alt="([^"]+)"/);
    if (altKey) tag = tag.replace(/\salt="[^"]*"/, ` alt="${attr(plain(t[altKey[1]]))}"`);
    const phKey = tag.match(/data-i18n-placeholder="([^"]+)"/);
    if (phKey) tag = tag.replace(/\splaceholder="[^"]*"/, ` placeholder="${attr(t[phKey[1]])}"`);
    return tag;
  });
  return html;
}

const ORG = {
  '@type': 'Organization',
  '@id': `${BASE}/#org`,
  name: 'La Sputacchiera',
  url: `${BASE}/`,
  logo: `${BASE}/assets/logo-liquido.png`,
  image: `${BASE}/assets/og-preview.jpg`,
  description: 'Corsi sul vino personalizzati e degustazioni su regioni meno conosciute, in casa a Milano, per piccoli gruppi.',
  email: 'chiara.asselta@gmail.com',
  telephone: '+39 338 696 5363',
  areaServed: { '@type': 'City', name: 'Milano' },
  founder: { '@id': `${BASE}/chi-sono.html#chiara` },
  sameAs: ['https://lasputacchiera.substack.com/', 'https://substack.com/@chiaraasselta'],
};

function jsonLdCorsi(c) {
  const it = (x, f) => plain(x.it[f]);
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [ORG, {
      '@type': 'ItemList',
      name: 'Corsi di vino — La Sputacchiera',
      itemListElement: allCourses(c).map((x) => ({
        '@type': 'ListItem',
        position: x.n,
        item: {
          '@type': 'Course',
          name: it(x, 't'),
          description: [it(x, 'lead'), x.it.more ? it(x, 'more') : '', x.it.dur ? `${plain(x.it.dur)}.` : ''].filter(Boolean).join(' '),
          inLanguage: 'it',
          url: `${BASE}/corsi.html#${x.anchor}`,
          provider: { '@id': `${BASE}/#org` },
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'onsite',
            location: { '@type': 'Place', name: 'Milano (San Siro / CityLife), in casa privata' },
          },
        },
      })),
    }],
  };
  return `\n  <script type="application/ld+json">\n${JSON.stringify(graph, null, 2)}\n  </script>\n  `;
}

// ---------- /llms.txt and /llms-full.txt (llmstxt.org) ----------
export function buildLlms(c) {
  const it = flatTexts(c, 'it');
  const en = flatTexts(c, 'en');
  const courses = allCourses(c);
  const line = (x) => `- [${plain(it[`course.${x.id}.t`])}](${BASE}/corsi.html#${x.anchor}): ${plain(it[`course.${x.id}.lead`])}${x.it.dur ? ` Durata ${plain(x.it.dur)}.` : ''}`;

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

${courses.map(line).join('\n')}

## Newsletter

- [La Sputacchiera su Substack](https://lasputacchiera.substack.com/): ${plain(it['nl.desc'])}
- [Chiara Asselta su Substack](https://substack.com/@chiaraasselta)

## Optional

- [Contenuto completo / Full content](${BASE}/llms-full.txt): tutti i testi del sito in italiano e in inglese
`;

  const full = (t, heading) => {
    const p = (k) => plain(t[k]);
    const course = (x) => {
      const k = (f) => `course.${x.id}.${f}`;
      const specs = [x.it.dur && `${p('corsi.k.durata')}: ${p(k('dur'))}.`, x.it.ses && `${p('corsi.k.sessioni')}: ${p(k('ses'))}.`].filter(Boolean).join(' ');
      return `#### ${p(k('t'))}\n${[p(k('lead')), x.it.more && p(k('more'))].filter(Boolean).join(' ')}${specs ? `\n${specs}` : ''}`;
    };
    return `## ${heading}

### ${p('label.corsi')}
${p('corsi.intro')}

- ${p('corsi.k.quando')}: ${p('corsi.quando')}
- ${p('corsi.k.dove')}: ${p('corsi.dove')}
- ${p('corsi.k.partecipanti')}: ${p('corsi.partecipanti')}

${courses.map(course).join('\n\n')}

${p('corsi.n1')} ${p('corsi.n2')}

### ${p('label.degustazioni')}
${p('degustazioni.intro')}

### ${p('label.collaborazioni')}
${p('collab.intro')}
${[1, 2, 3, 4].map((n) => `- ${p(`collab.t${n}`)}`).join('\n')}

### Newsletter
${p('nl.desc')}
https://lasputacchiera.substack.com/

### ${p('label.about')}: Chiara Asselta
${[1, 2, 3, 4].map((n) => p(`about.p${n}`)).join('\n\n')}

### ${p('label.faq')}
${c.faq.map((_, i) => `**${p(`faq.${i}.q`)}**\n${p(`faq.${i}.a`)}`).join('\n\n')}

### ${p('label.contatti')}
chiara.asselta@gmail.com · WhatsApp +39 338 696 5363 · ${BASE}
`;
  };

  const fullText = `# La Sputacchiera: contenuto completo / full content

> ${plain(it['hero.text'])}
> ${plain(en['hero.text'])}

Sito / Website: ${BASE}

${full(it, 'Italiano')}
${full(en, 'English')}`;

  return { 'llms.txt': short, 'llms-full.txt': fullText };
}
