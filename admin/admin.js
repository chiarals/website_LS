// The reserved area: Chiara edits texts, photos, courses and FAQ, sees the result live,
// saves a draft, previews it on the real site and publishes it when she is happy.
//
// Three versions of the content:
//   live    content/live.json, what visitors see
//   saved   content/draft.json, the saved draft (or live when there is none)
//   working what is on screen now, not saved yet
import { PAGES, bakePage, buildLlms } from '../render.js';
import { GROUPS, COURSE_FIELDS, PREVIEW_PAGES } from './schema.js';
import { GitHubStore, LocalStore } from './store.js';
import { lock, unlock } from './crypto.js';

const $ = (sel) => document.querySelector(sel);
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const json = (x) => JSON.stringify(x, null, 2) + '\n';

let store;
let local = false;
let token = '';
let live, saved, working;
let draftExists = false;
const photos = {}; // path -> data URL, for photos added in this session (not yet on the site)
let group = GROUPS[0].id;
let previewPage = 'index.html';
let previewLang = 'it';
let busy = false;

// ---------- Small DOM helper ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const ICON = {
  up: '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>',
  down: '<path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/>',
  left: '<path d="M13 8H3M7.5 3.5 3 8l4.5 4.5"/>',
  right: '<path d="M3 8h10M8.5 3.5 13 8l-4.5 4.5"/>',
  trash: '<path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.5h6.6l.7-8.5"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  image: '<rect x="2" y="3" width="12" height="10" rx="1"/><path d="m2.5 11.5 3.5-3.5 3 3 2-2 2.5 2.5"/>',
  external: '<path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5"/>',
};
const icon = (name) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICON[name];
  return s;
};
const iconButton = (name, label, onclick, extra = {}) => h('button', { type: 'button', class: 'icon-btn', title: label, 'aria-label': label, onclick, ...extra }, icon(name));

// ---------- Texts: the site stores HTML, Chiara edits plain text ----------
// A new line is a line break; [testo](indirizzo) is a link.
const toEdit = (html = '') => html
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)')
  .replace(/&amp;/g, '&');
const fromEdit = (text) => text
  .replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a class="text-link" href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
  .replace(/\n/g, '<br>');

// ---------- Dialogs and notices ----------
function dialog({ title, body, buttons }) {
  return new Promise((done) => {
    const d = h('dialog', { class: 'dialog' },
      h('h2', { text: title }),
      typeof body === 'string' ? h('p', { text: body }) : body,
      h('div', { class: 'dialog-actions' }, buttons.map((b) =>
        h('button', { type: 'button', class: b.kind || '', onclick: () => { d.close(); done(b.value); } }, b.label))));
    d.addEventListener('close', () => { d.remove(); done(undefined); });
    document.body.append(d);
    d.showModal();
  });
}
const confirmAction = (title, body, label, kind = 'primary') =>
  dialog({ title, body, buttons: [{ label: 'Annulla', value: false }, { label, value: true, kind }] });

function notice(text, kind = '') {
  const n = h('div', { class: `notice ${kind}`, role: 'status', text });
  $('#notices').append(n);
  setTimeout(() => n.classList.add('out'), 4500);
  setTimeout(() => n.remove(), 5000);
}

async function run(label, fn) {
  if (busy) return;
  busy = true;
  document.body.classList.add('busy');
  $('#busy-label').textContent = label;
  try {
    await fn();
  } catch (e) {
    console.error(e);
    await dialog({ title: 'Qualcosa non ha funzionato', body: h('div', {}, h('p', { text: 'Non ho perso niente: le modifiche sono ancora qui. Riprova tra poco; se continua, manda a Simone questo messaggio:' }), h('pre', { text: String(e.message || e) })), buttons: [{ label: 'Chiudi', value: true, kind: 'primary' }] });
  } finally {
    busy = false;
    document.body.classList.remove('busy');
    refreshStatus();
  }
}

// ---------- Access ----------
async function start() {
  if (await LocalStore.available()) {
    local = true;
    store = new LocalStore();
    return openEditor();
  }
  try {
    const t = sessionStorage.getItem('ls-admin');
    if (t) { token = t; store = new GitHubStore(t); await store.check(); return openEditor(); }
  } catch (e) { sessionStorage.removeItem('ls-admin'); }
  const r = await fetch('key.json', { cache: 'no-store' });
  if (!r.ok) return showSetup('first');
  showLogin(await r.json());
}

function screen(...children) {
  const s = $('#gate');
  s.replaceChildren(h('div', { class: 'gate-box' }, h('img', { src: '../assets/logo.svg', alt: 'La Sputacchiera', class: 'gate-logo' }), ...children));
  s.hidden = false;
}

function showLogin(box) {
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'gate-error', role: 'alert' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      form.classList.add('working');
      try {
        token = await unlock(box, pw.value);
      } catch (x) {
        form.classList.remove('working');
        err.textContent = 'Password sbagliata.';
        pw.select();
        return;
      }
      try {
        store = new GitHubStore(token);
        await store.check();
      } catch (x) {
        form.classList.remove('working');
        return showSetup('expired');
      }
      try { sessionStorage.setItem('ls-admin', token); } catch (x) {}
      openEditor();
    },
  },
  h('label', { for: 'pw', text: 'Password' }), pw, err,
  h('button', { class: 'primary', type: 'submit' }, 'Entra'));
  screen(h('h1', { text: 'Area riservata' }), form);
  pw.focus();
}

// First set-up, or a new GitHub key when the old one expires. Chiara does it herself.
function showSetup(why) {
  const tok = h('input', { type: 'password', id: 'tok', autocomplete: 'off', placeholder: 'github_pat_…', required: true });
  const pw = h('input', { type: 'password', id: 'npw', autocomplete: 'new-password', required: true, minlength: 12 });
  const pw2 = h('input', { type: 'password', id: 'npw2', autocomplete: 'new-password', required: true });
  const err = h('p', { class: 'gate-error', role: 'alert' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (pw.value.length < 12) { err.textContent = 'La password deve avere almeno 12 caratteri: una frase breve va benissimo.'; return; }
      if (pw.value !== pw2.value) { err.textContent = 'Le due password non coincidono.'; return; }
      form.classList.add('working');
      try {
        const s = new GitHubStore(tok.value.trim());
        await s.check();
        await s.commit({ 'admin/key.json': json(await lock(tok.value.trim(), pw.value)) }, 'Area riservata: nuova chiave e password');
        token = tok.value.trim();
        store = s;
        try { sessionStorage.setItem('ls-admin', token); } catch (x) {}
        openEditor();
        notice('Fatto. Da ora si entra con la nuova password.');
      } catch (x) {
        form.classList.remove('working');
        err.textContent = 'Questa chiave non funziona: controlla di averla copiata tutta e che abbia il permesso “Contents: Read and write” sul repository website_LS.';
      }
    },
  },
  h('ol', { class: 'steps' },
    h('li', {}, 'Accedi a GitHub e apri ', h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'questa pagina'), '.'),
    h('li', {}, 'Nome: “Area riservata sito”. Scadenza: “No expiration”, oppure la più lunga possibile.'),
    h('li', {}, 'Repository access: “Only select repositories” e scegli ', h('b', { text: 'website_LS' }), '.'),
    h('li', {}, 'Permissions → Repository permissions → ', h('b', { text: 'Contents' }), ': “Read and write”. Nient’altro.'),
    h('li', {}, 'Premi “Generate token” e incolla qui sotto la chiave che compare.')),
  h('label', { for: 'tok', text: 'Chiave GitHub' }), tok,
  h('label', { for: 'npw', text: 'Scegli la password dell’area riservata' }), pw,
  h('label', { for: 'npw2', text: 'Ripeti la password' }), pw2,
  err,
  h('button', { class: 'primary', type: 'submit' }, 'Salva e entra'));
  const intro = {
    first: 'Prima configurazione: collega l’area riservata al sito con una chiave GitHub e scegli una password. Si fa una volta sola.',
    expired: 'La chiave GitHub non funziona più (probabilmente è scaduta). Creane una nuova: ci vogliono due minuti e il sito non cambia.',
  }[why];
  screen(h('h1', { text: 'Area riservata' }), h('p', { class: 'gate-intro', text: intro }), form);
}

async function changePassword() {
  const pw = h('input', { type: 'password', autocomplete: 'new-password', minlength: 12 });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const ok = await dialog({
    title: 'Cambia password',
    body: h('div', { class: 'stack' }, h('label', { text: 'Nuova password (almeno 12 caratteri)' }), pw, h('label', { text: 'Ripetila' }), pw2),
    buttons: [{ label: 'Annulla', value: false }, { label: 'Cambia', value: true, kind: 'primary' }],
  });
  if (!ok) return;
  if (pw.value.length < 12 || pw.value !== pw2.value) return notice('Password non cambiata: deve avere almeno 12 caratteri e le due devono coincidere.', 'warn');
  await run('Cambio la password…', async () => {
    await store.commit({ 'admin/key.json': json(await lock(token, pw.value)) }, 'Area riservata: nuova password');
    notice('Password cambiata.');
  });
}

function logout() {
  try { sessionStorage.removeItem('ls-admin'); } catch (e) {}
  location.reload();
}

// ---------- Loading ----------
async function openEditor() {
  $('#gate').hidden = true;
  $('#app').hidden = false;
  await run('Carico il sito…', async () => {
    live = JSON.parse(await store.read('content/live.json'));
    const draft = await store.read('content/draft.json');
    draftExists = !!draft;
    saved = draft ? JSON.parse(draft) : clone(live);
    working = clone(saved);
  });
  if (!working) return;
  $('#versions').hidden = local;
  $('#password').hidden = local;
  $('#logout').hidden = local;
  if (local) $('#mode').textContent = 'prova in locale';
  buildGroupNav();
  buildPreviewBar();
  openGroup(group);
}

// ---------- State ----------
function changed() {
  refreshStatus();
  sendPreview();
}

function refreshStatus() {
  if (!working) return;
  const dirty = !same(working, saved);
  const pending = !same(saved, live);
  const s = $('#status');
  s.className = `status ${dirty ? 'dirty' : pending ? 'pending' : 'clean'}`;
  s.textContent = dirty ? 'Modifiche non salvate' : pending ? 'Bozza salvata, non ancora pubblicata' : 'Il sito è aggiornato';
  $('#undo').disabled = busy || !dirty;
  $('#save').disabled = busy || !dirty;
  $('#publish').disabled = busy || dirty || !pending;
  $('#publish').title = dirty ? 'Salva prima la bozza' : pending ? '' : 'Non c’è niente di nuovo da pubblicare';
  $('#discard').disabled = busy || !draftExists;
}

window.addEventListener('beforeunload', (e) => {
  if (working && !same(working, saved)) { e.preventDefault(); e.returnValue = ''; }
});

// Every photo path the content uses.
function photoPaths(c) {
  const out = new Set();
  for (const list of Object.values(c.galleries)) list.forEach((x) => out.add(x.src));
  out.add(c.images.about.src);
  out.add(c.newsletterPost.src);
  if (c.newsletterPost.thumb) out.add(c.newsletterPost.thumb);
  return out;
}

// ---------- Actions ----------
async function save() {
  await run('Salvo la bozza…', async () => {
    const files = { 'content/draft.json': json(working) };
    const savedPhotos = photoPaths(saved);
    for (const p of photoPaths(working)) {
      if (photos[p] && !savedPhotos.has(p)) files[p] = { base64: photos[p].split(',')[1] };
    }
    await store.commit(files, 'Bozza salvata dall’area riservata');
    saved = clone(working);
    draftExists = true;
    notice('Bozza salvata. Puoi guardarla con “Guarda l’anteprima del sito”.');
  });
}

async function undo() {
  if (!await confirmAction('Annullare le modifiche?', 'Torni all’ultima bozza salvata. Le modifiche fatte da allora si perdono.', 'Annulla le modifiche', 'danger')) return;
  working = clone(saved);
  openGroup(group);
  changed();
}

async function publish() {
  if (!await confirmAction('Pubblicare la bozza?', 'La bozza diventa il sito che vedono tutti. Il sito si aggiorna entro qualche minuto.', 'Pubblica')) return;
  await run('Pubblico…', async () => {
    const files = { 'content/live.json': json(saved) };
    if (draftExists) files['content/draft.json'] = null;
    for (const page of PAGES) files[page] = bakePage(await store.read(page), saved, page);
    Object.assign(files, buildLlms(saved));
    await store.commit(files, 'Pubblicazione dall’area riservata');
    live = clone(saved);
    draftExists = false;
    notice('Pubblicato. Il sito si aggiorna entro qualche minuto.');
  });
}

async function discard() {
  if (!await confirmAction('Scartare la bozza?', 'La bozza salvata viene cancellata e torni al sito pubblicato. Il sito non cambia.', 'Scarta la bozza', 'danger')) return;
  await run('Scarto la bozza…', async () => {
    await store.commit({ 'content/draft.json': null }, 'Bozza scartata dall’area riservata');
    draftExists = false;
    saved = clone(live);
    working = clone(live);
    openGroup(group);
    sendPreview();
  });
}

// The site preview shows the saved draft: offer to save what is still on screen first.
async function openSitePreview(e) {
  e.preventDefault();
  const url = new URL(`../${previewPage}?anteprima`, location.href).href;
  if (!same(working, saved)) {
    const choice = await dialog({
      title: 'Ci sono modifiche non salvate',
      body: 'L’anteprima del sito mostra la bozza salvata. Vuoi salvare prima le ultime modifiche?',
      buttons: [{ label: 'Apri senza salvare', value: 'open' }, { label: 'Salva e apri', value: 'save', kind: 'primary' }],
    });
    if (!choice) return;
    const w = window.open('about:blank', '_blank');
    if (choice === 'save') await save();
    if (w) w.location = url;
    return;
  }
  window.open(url, '_blank');
}

async function showVersions() {
  let list = [];
  await run('Carico le versioni…', async () => { list = await store.history(); });
  if (!list.length) return;
  const fmt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  const pick = await dialog({
    title: 'Versioni pubblicate',
    body: h('div', {},
      h('p', { text: 'Scegli una versione per ricaricarla nell’editor. Il sito non cambia finché non salvi e pubblichi.' }),
      h('ul', { class: 'versions' }, list.map((v, i) => h('li', {},
        h('span', {}, fmt.format(new Date(v.date)), i === 0 ? h('b', { text: ' · quella online' }) : ''),
        h('button', { type: 'button', onclick: (e) => { e.target.closest('dialog').close(); pickVersion(v.sha); } }, 'Carica'))))),
    buttons: [{ label: 'Chiudi', value: null }],
  });
  return pick;
}

async function pickVersion(sha) {
  await run('Carico la versione…', async () => {
    working = JSON.parse(await store.readAt('content/live.json', sha));
    openGroup(group);
    changed();
    notice('Versione caricata. Salva la bozza e pubblica per rimetterla online.');
  });
}

// ---------- Photos ----------
async function readPhoto(file, max = 2000) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    throw new Error('Questo formato di foto non si apre qui: usa una foto JPG o PNG.');
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const hgt = Math.round(bmp.height * scale);
  const canvas = h('canvas', { width: w, height: hgt });
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  const data = canvas.toDataURL('image/jpeg', 0.85);
  const slug = file.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto';
  const path = `assets/foto/uploads/${new Date().toISOString().slice(0, 10)}-${slug}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  photos[path] = data;
  return { src: path, r: Math.round((w / hgt) * 1000) / 1000 };
}

function choosePhoto(onPhoto) {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic' });
  input.addEventListener('change', () => {
    if (!input.files[0]) return;
    run('Preparo la foto…', async () => { onPhoto(await readPhoto(input.files[0])); });
  });
  input.click();
}

// Where a photo can be seen from the reserved area: added in this session, already on the
// site, or saved in a draft and not published yet (then straight from GitHub).
function photoUrl(src) {
  if (photos[src]) return photos[src];
  if (!local && src.startsWith('assets/foto/uploads/') && !photoPaths(live).has(src)) {
    return `https://raw.githubusercontent.com/chiarals/website_LS/main/${src}`;
  }
  return `../${src}`;
}

// ---------- Editors ----------
function langPair(key, get, set, { long = false, single = false } = {}) {
  return h('div', { class: 'langs' }, ['it', 'en'].map((lang) => {
    const attrs = {
      'aria-label': `${lang === 'it' ? 'Italiano' : 'Inglese'}`,
      placeholder: lang === 'en' ? 'Vuoto = si vede l’italiano' : '',
      oninput: (e) => { set(lang, single ? e.target.value : fromEdit(e.target.value)); autosize(e.target); changed(); },
    };
    const value = single ? get(lang) ?? '' : toEdit(get(lang) ?? '');
    const input = long ? h('textarea', { ...attrs, rows: 3 }) : h('textarea', { ...attrs, rows: 1, class: 'short' });
    input.value = value;
    return h('label', { class: 'lang' }, h('span', { class: 'lang-tag', text: lang.toUpperCase() }), input);
  }));
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

function textField(item) {
  return h('div', { class: 'field', 'data-key': item.key },
    h('div', { class: 'field-label', text: item.label }),
    langPair(item.key, (l) => working.texts[l][item.key], (l, v) => { working.texts[l][item.key] = v; }, item));
}

function moveIn(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function listActions(list, i, what, after) {
  return h('div', { class: 'item-actions' },
    iconButton('up', 'Sposta su', () => { moveIn(list, i, -1); after(); }, { disabled: i === 0 }),
    iconButton('down', 'Sposta giù', () => { moveIn(list, i, 1); after(); }, { disabled: i === list.length - 1 }),
    iconButton('trash', `Elimina ${what}`, async () => {
      if (!await confirmAction(`Eliminare ${what}?`, 'Si toglie dalla bozza. Finché non salvi puoi ancora annullare.', 'Elimina', 'danger')) return;
      list.splice(i, 1);
      after();
    }));
}

function rerender() {
  openGroup(group, { keepScroll: true });
  changed();
}

function coursesEditor(item) {
  const list = working.courses[item.courses];
  const offset = item.courses === 'altri' ? working.courses.percorsi.length : 0;
  return h('div', { class: 'field list' },
    h('div', { class: 'field-label', text: item.label }),
    item.hint && h('p', { class: 'field-hint', text: item.hint }),
    list.map((c, i) => h('div', { class: 'item', 'data-key': `course.${c.id}` },
      h('div', { class: 'item-head' },
        h('span', { class: 'item-num', text: String(offset + i + 1).padStart(2, '0') }),
        h('span', { class: 'item-title', text: (c.it.t || 'Nuovo corso').replace(/<[^>]+>/g, '') }),
        listActions(list, i, 'questo corso', rerender)),
      COURSE_FIELDS[item.courses].map((f) => h('div', { class: 'subfield', 'data-key': `course.${c.id}.${f.f}` },
        h('div', { class: 'field-label small', text: f.label }),
        langPair(null, (l) => c[l]?.[f.f], (l, v) => {
          c[l] = c[l] || {};
          c[l][f.f] = v;
          if (f.f === 't' && l === 'it') document.querySelector(`[data-key="course.${c.id}"] .item-title`).textContent = v.replace(/<[^>]+>/g, '') || 'Nuovo corso';
        }, f))))),
    h('button', {
      type: 'button',
      class: 'add',
      onclick: () => {
        const blank = Object.fromEntries(COURSE_FIELDS[item.courses].map((f) => [f.f, '']));
        const id = `c${Date.now().toString(36)}`;
        list.push({ id, it: { ...blank, t: 'Nuovo corso' }, en: { ...blank } });
        rerender();
        focusKey(`course.${id}.t`);
      },
    }, icon('plus'), 'Aggiungi un corso'));
}

function photoCard(x, onReplace, altKey, actions) {
  return h('div', { class: 'photo', 'data-key': altKey },
    h('button', { type: 'button', class: 'photo-img', title: 'Sostituisci la foto', onclick: () => choosePhoto(onReplace) },
      h('img', { src: photoUrl(x.src), alt: '' }),
      h('span', { class: 'photo-replace' }, icon('image'), 'Sostituisci')),
    actions,
    x.alt && h('div', { class: 'subfield' },
      h('div', { class: 'field-label small', text: 'Descrizione (per chi non vede la foto)' }),
      langPair(null, (l) => x.alt[l], (l, v) => { x.alt[l] = v; }, { single: true })));
}

function galleryEditor(item) {
  const list = working.galleries[item.gallery];
  return h('div', { class: 'field list' },
    h('div', { class: 'field-label', text: item.label }),
    h('div', { class: 'photos' }, list.map((x, i) => photoCard(x,
      (p) => { Object.assign(x, p); rerender(); },
      `img.${item.gallery}.${i}`,
      h('div', { class: 'item-actions' },
        iconButton('left', 'Sposta a sinistra', () => { moveIn(list, i, -1); rerender(); }, { disabled: i === 0 }),
        iconButton('right', 'Sposta a destra', () => { moveIn(list, i, 1); rerender(); }, { disabled: i === list.length - 1 }),
        iconButton('trash', 'Togli la foto', async () => {
          if (!await confirmAction('Togliere la foto?', 'Si toglie dalla bozza. Finché non salvi puoi ancora annullare.', 'Togli', 'danger')) return;
          list.splice(i, 1);
          rerender();
        }))))),
    h('button', { type: 'button', class: 'add', onclick: () => choosePhoto((p) => { list.push({ ...p, alt: { it: '', en: '' } }); rerender(); }) }, icon('plus'), 'Aggiungi una foto'));
}

function imageEditor(item) {
  const x = working.images[item.image];
  return h('div', { class: 'field' },
    h('div', { class: 'field-label', text: item.label }),
    h('div', { class: 'photos single' }, photoCard(x, (p) => { x.src = p.src; rerender(); }, `img.${item.image}`)));
}

function postEditor(item) {
  const p = working.newsletterPost;
  const input = (k, label, type = 'text') => h('label', { class: 'subfield' },
    h('div', { class: 'field-label small', text: label }),
    Object.assign(h('input', { type, oninput: (e) => { p[k] = e.target.value; changed(); } }), { value: p[k] || '' }));
  return h('div', { class: 'field', 'data-key': 'newsletterPost' },
    h('div', { class: 'field-label', text: item.label }),
    input('title', 'Titolo'),
    input('url', 'Indirizzo dell’articolo su Substack', 'url'),
    h('div', { class: 'photos single' }, photoCard(p, (ph) => { p.src = ph.src; p.thumb = null; rerender(); }, 'newsletterPost.img')));
}

function faqEditor() {
  const list = working.faq;
  return h('div', { class: 'field list' },
    list.map((q, i) => h('div', { class: 'item', 'data-key': `faq.${i}` },
      h('div', { class: 'item-head' },
        h('span', { class: 'item-num', text: String(i + 1).padStart(2, '0') }),
        h('span', { class: 'item-title', text: (q.it.q || 'Nuova domanda').replace(/<[^>]+>/g, '') }),
        listActions(list, i, 'questa domanda', rerender)),
      h('div', { class: 'subfield', 'data-key': `faq.${i}.q` }, h('div', { class: 'field-label small', text: 'Domanda' }),
        langPair(null, (l) => q[l]?.q, (l, v) => { q[l] = q[l] || {}; q[l].q = v; })),
      h('div', { class: 'subfield', 'data-key': `faq.${i}.a` }, h('div', { class: 'field-label small', text: 'Risposta' }),
        langPair(null, (l) => q[l]?.a, (l, v) => { q[l] = q[l] || {}; q[l].a = v; }, { long: true })))),
    h('button', { type: 'button', class: 'add', onclick: () => { list.push({ it: { q: 'Nuova domanda', a: '' }, en: { q: '', a: '' } }); rerender(); focusKey(`faq.${list.length - 1}.q`); } }, icon('plus'), 'Aggiungi una domanda'));
}

function itemEditor(item) {
  if (item.key) return textField(item);
  if (item.courses) return coursesEditor(item);
  if (item.gallery) return galleryEditor(item);
  if (item.image) return imageEditor(item);
  if (item.post) return postEditor(item);
  if (item.faq) return faqEditor(item);
  return null;
}

function buildGroupNav() {
  $('#groups').replaceChildren(...GROUPS.map((g) => h('button', { type: 'button', 'data-group': g.id, onclick: () => openGroup(g.id) }, g.title)));
}

function openGroup(id, { keepScroll = false } = {}) {
  group = id;
  const g = GROUPS.find((x) => x.id === id);
  const panel = $('#editor');
  const scroll = panel.scrollTop;
  document.querySelectorAll('#groups button').forEach((b) => b.setAttribute('aria-current', b.dataset.group === id ? 'true' : 'false'));
  panel.replaceChildren(
    h('h2', { class: 'group-title', text: g.title }),
    g.hint && h('p', { class: 'field-hint', text: g.hint }),
    ...g.items.map((item) => {
      const el = itemEditor(item);
      if (el && (item.page || g.page)) el.addEventListener('focusin', () => showPage(item.page || g.page));
      return el;
    }));
  panel.querySelectorAll('textarea').forEach(autosize);
  if (keepScroll) panel.scrollTop = scroll;
  else { panel.scrollTop = 0; showPage(g.page); }
}

// Which group holds a key clicked in the preview.
function groupOf(key) {
  if (key.startsWith('course.') || key.startsWith('corsi.k.')) return key.startsWith('corsi.k.') ? 'etichette' : 'corsi';
  if (key.startsWith('faq.')) return 'faq';
  if (key === 'newsletterPost') return 'newsletter';
  if (key === 'img.about') return 'chi-sono';
  const gallery = key.match(/^img\.(.+)\.\d+$/);
  return GROUPS.find((g) => g.items.some((it) => it.key === key || (gallery && it.gallery === gallery[1])))?.id;
}

function focusKey(key) {
  const id = groupOf(key);
  if (!id) return;
  if (id !== group) openGroup(id, { keepScroll: true });
  const el = document.querySelector(`#editor [data-key="${CSS.escape(key)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  const input = el.querySelector(`.lang:${previewLang === 'en' ? 'last-child' : 'first-child'} textarea, input, textarea`);
  input?.focus({ preventScroll: true });
  document.body.dataset.view = 'edit';
}

// ---------- Live preview ----------
const frame = () => $('#frame');

function buildPreviewBar() {
  $('#pages').replaceChildren(...PREVIEW_PAGES.map((p) => h('button', { type: 'button', 'data-page': p.page, onclick: () => showPage(p.page) }, p.label)));
  document.querySelectorAll('#devices button').forEach((b) => b.addEventListener('click', () => setDevice(b.dataset.device)));
  window.addEventListener('resize', fitFrame);
  setDevice('desktop');
}

function showPage(target) {
  const [page, hash = ''] = target.split('#');
  document.querySelectorAll('#pages button').forEach((b) => b.setAttribute('aria-current', b.dataset.page === page ? 'true' : 'false'));
  const f = frame();
  if (page === previewPage && f.src) {
    if (hash) f.contentWindow?.document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  previewPage = page;
  f.src = `../${page}?anteprima=editor${hash ? `#${hash}` : ''}`;
}

// The preview gets the working content, with new photos shown from this browser.
function sendPreview() {
  const f = frame();
  if (!f?.contentWindow || !working) return;
  const c = clone(working);
  const fix = (x, k = 'src') => { if (x[k]) x[k] = photoUrl(x[k]).replace(/^\.\.\//, ''); };
  for (const list of Object.values(c.galleries)) list.forEach((x) => fix(x));
  fix(c.images.about);
  fix(c.newsletterPost);
  fix(c.newsletterPost, 'thumb');
  f.contentWindow.postMessage({ type: 'content', content: c, lang: previewLang }, location.origin);
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  if (e.data?.type === 'ready') sendPreview();
  if (e.data?.type === 'focus') focusKey(e.data.key);
  if (e.data?.type === 'lang') previewLang = e.data.lang;
});

// Computer: the page is drawn 1280px wide and scaled down to fit; phone: 390px.
let device = 'desktop';
function setDevice(d) {
  device = d;
  document.querySelectorAll('#devices button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.device === d ? 'true' : 'false'));
  fitFrame();
}
function fitFrame() {
  const box = $('#stage');
  const f = frame();
  const width = device === 'desktop' ? 1280 : 390;
  const scale = Math.min(1, box.clientWidth / width);
  f.style.width = `${width}px`;
  f.style.height = `${box.clientHeight / scale}px`;
  f.style.transform = `scale(${scale})`;
  box.classList.toggle('phone', device === 'phone');
}

// ---------- Wiring ----------
$('#save').addEventListener('click', save);
$('#undo').addEventListener('click', undo);
$('#publish').addEventListener('click', publish);
$('#discard').addEventListener('click', discard);
$('#site-preview').addEventListener('click', openSitePreview);
$('#versions').addEventListener('click', showVersions);
$('#password').addEventListener('click', changePassword);
$('#logout').addEventListener('click', logout);
document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => {
  document.body.dataset.view = b.dataset.view;
  if (b.dataset.view === 'preview') requestAnimationFrame(fitFrame);
}));
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (!$('#save').disabled) save(); }
});

start();
