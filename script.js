import { REPO, flatTexts, renderBlock } from './render.js';

const sections = [...document.querySelectorAll('.section')];
const label = document.querySelector('.section-label');
const track = document.querySelector('.label-track');
const langButtons = [...document.querySelectorAll('.lang-switch button')];

// ---------- Which content to show ----------
// live: the published site. ?anteprima: the draft saved in the reserved area, with a banner.
// ?anteprima=editor: inside the reserved area, fed the unsaved edits by the editor.
const params = new URLSearchParams(location.search);
const MODE = !params.has('anteprima') ? 'live' : params.get('anteprima') === 'editor' ? 'editor' : 'preview';
const LOCAL = /^(localhost|127\.)/.test(location.hostname);
let content = null;

async function fetchJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

function loadLive() {
  const v = document.querySelector('meta[name="content-version"]')?.content || '';
  return fetchJson(`content/live.json?v=${v}`);
}

// The draft is read straight from GitHub, so it shows up the moment it is saved,
// without waiting for the site to be rebuilt. No draft means nothing to preview: show the live site.
async function loadDraft() {
  try {
    if (LOCAL) return await fetchJson(`content/draft.json?t=${Date.now()}`, { cache: 'no-store' });
    return await fetchJson(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}/contents/content/draft.json?ref=${REPO.branch}&t=${Date.now()}`,
      { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' });
  } catch (e) {
    return null;
  }
}

// ---------- Blocks built from content (courses, photos, FAQ, newsletter post) ----------
// Each block sits between <!--render:name--> and <!--/render:name--> comments.
const blocks = {};
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
for (let n = walker.nextNode(); n; n = walker.nextNode()) {
  const m = n.data.match(/^(\/?)render:([\w:-]+)$/);
  if (!m) continue;
  blocks[m[2]] = blocks[m[2]] || {};
  blocks[m[2]][m[1] ? 'end' : 'start'] = n;
}
const shapes = {};
// The published pages already carry the live content: no need to rebuild them on load.
function primeShapes() {
  for (const name of Object.keys(blocks)) shapes[name] = renderBlock(name, content, null);
}

// Rebuild a block only when its structure changes (a photo or course added, moved, removed);
// switching language only swaps the words, so nothing on screen jumps or fades in again.
function renderBlocks(t) {
  for (const [name, { start, end }] of Object.entries(blocks)) {
    const shape = renderBlock(name, content, null);
    if (shape == null || shape === shapes[name]) continue;
    shapes[name] = shape;
    while (start.nextSibling && start.nextSibling !== end) start.nextSibling.remove();
    const tpl = document.createElement('template');
    tpl.innerHTML = renderBlock(name, content, t);
    start.after(tpl.content);
  }
  afterRender();
}

// ---------- Language ----------
function readLang() {
  const fromUrl = params.get('lang');
  if (fromUrl === 'it' || fromUrl === 'en') return fromUrl;
  try { const saved = localStorage.getItem('lang'); if (saved === 'it' || saved === 'en') return saved; } catch (e) {}
  return 'it'; // Italian by default (also what search engines index); EN is one click away
}
let lang = readLang();

function setLang(next) {
  lang = next;
  langButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  try { localStorage.setItem('lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  if (content) apply();
}

function apply() {
  const t = flatTexts(content, lang);
  renderBlocks(t);
  document.querySelectorAll('[data-i18n]').forEach((el) => { if (el.dataset.i18n in t) el.innerHTML = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = (t[el.dataset.i18nAlt] || '').replace(/<[^>]+>/g, ''); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t[el.dataset.i18nPlaceholder]; });
  // Top-left label: one line per section in the current language.
  track.innerHTML = '';
  sections.forEach((s) => {
    const line = document.createElement('span');
    line.textContent = t[s.dataset.label] ?? '';
    track.appendChild(line);
  });
  if (MODE === 'preview') keepPreviewLinks();
  document.documentElement.classList.remove('content-pending');
}

langButtons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
setLang(lang);

// ---------- Top-left label rolls to the section in view ----------
let current = -1;
function setSection(i) {
  if (i === current) return;
  current = i;
  track.style.transform = `translateY(${-i}em)`;
  label.href = `#${sections[i].id}`;
}

// The active section is the last one whose top has passed the middle of the screen.
function update() {
  const mid = window.innerHeight / 2;
  let i = 0;
  sections.forEach((s, idx) => { if (s.getBoundingClientRect().top <= mid) i = idx; });
  setSection(i);
}
window.addEventListener('scroll', update, { passive: true });
window.addEventListener('resize', update);
update();

// Fade-up only while scrolling down: an element animates as it rises into view.
// Scrolling back up it stays visible; once it drops fully below the screen it resets,
// so it fades in again the next time you scroll down to it.
const showOnEnter = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { rootMargin: '0px 0px -10% 0px' });
const resetBelow = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting && e.boundingClientRect.top > 0) e.target.classList.remove('in');
  });
});

// Runs after every block rebuild: new photos, courses and posts need the same treatment.
function afterRender() {
  // Photo rows: total aspect ratio, so CSS can keep each row within the screen height.
  document.querySelectorAll('.gallery').forEach((g) => {
    const sum = [...g.querySelectorAll('img')]
      .reduce((acc, img) => acc + (parseFloat(img.style.getPropertyValue('--r')) || 0), 0);
    g.style.setProperty('--sum', sum);
  });
  document.querySelectorAll('.reveal').forEach((el) => {
    if (MODE === 'editor') { el.classList.add('in'); return; } // no fades while editing
    showOnEnter.observe(el);
    resetBelow.observe(el);
  });
  syncCourses();
}

// Corsi on phones: tap a course title to open/close its description.
const narrow = matchMedia('(max-width: 640px)');
const collapsible = () => [...document.querySelectorAll('.cards:not(.cards-full) article')];
function syncCourses() {
  collapsible().forEach((c) => {
    const btn = c.querySelector('.card-head');
    if (narrow.matches) {
      btn.setAttribute('aria-expanded', c.classList.contains('open'));
      btn.removeAttribute('tabindex');
    } else {
      btn.removeAttribute('aria-expanded');
      btn.tabIndex = -1;
    }
  });
}
document.addEventListener('click', (e) => {
  const head = e.target.closest('.cards:not(.cards-full) .card-head');
  if (head && narrow.matches) { head.closest('article').classList.toggle('open'); syncCourses(); }
  // Desktop: "Leggi tutto" opens the rest of a course description.
  const more = e.target.closest('.more-toggle');
  if (more) more.setAttribute('aria-expanded', more.closest('article').classList.toggle('more-open'));
});
narrow.addEventListener('change', syncCourses);
afterRender();

// The liquid logo turns slowly as you scroll.
const liquid = document.querySelector('.liquid-logo');
if (liquid && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const spin = () => liquid.style.setProperty('--spin', `${window.scrollY * 0.15}deg`);
  window.addEventListener('scroll', spin, { passive: true });
  spin();
}

// ---------- Draft preview ----------
// Links between pages keep the preview on, and photos uploaded with the draft come
// straight from GitHub until the draft is published.
function keepPreviewLinks() {
  document.querySelectorAll('a[href]').forEach((a) => {
    const m = a.getAttribute('href').match(/^((?:index|corsi|chi-sono|privacy)\.html)(#.*)?$/);
    if (m) a.setAttribute('href', `${m[1]}?anteprima${m[2] || ''}`);
  });
  if (LOCAL) return;
  const raw = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/`;
  document.querySelectorAll('img[src^="assets/foto/uploads/"]').forEach((img) => { img.src = raw + img.getAttribute('src'); });
  document.querySelectorAll('source[srcset^="assets/foto/uploads/"]').forEach((s) => { s.srcset = raw + s.getAttribute('srcset'); });
}

function showBanner(hasDraft) {
  const bar = document.createElement('div');
  bar.className = 'preview-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = hasDraft
    ? '<b>Anteprima</b><span>Questa è la bozza salvata, non il sito pubblicato.</span><a href="admin/">Torna all’area riservata</a>'
    : '<b>Anteprima</b><span>Non c’è nessuna bozza salvata: stai vedendo il sito pubblicato.</span><a href="admin/">Torna all’area riservata</a>';
  document.body.appendChild(bar);
  document.documentElement.classList.add('has-preview-banner');
}

// ---------- Inside the reserved area ----------
// The editor sends every change; a click on a text or photo tells the editor which field to open.
function connectEditor() {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'content') return;
    content = e.data.content;
    if (e.data.lang && e.data.lang !== lang) setLang(e.data.lang); else apply();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (a && !a.getAttribute('href')?.startsWith('#')) e.preventDefault(); // pages are switched from the editor
    const el = e.target.closest('[data-i18n], [data-i18n-alt], .nl-post');
    if (!el) return;
    const key = el.dataset.i18n || el.dataset.i18nAlt || 'newsletterPost';
    parent.postMessage({ type: 'focus', key }, location.origin);
  }, true);
  langButtons.forEach((b) => b.addEventListener('click', () => parent.postMessage({ type: 'lang', lang: b.dataset.lang }, location.origin)));
  parent.postMessage({ type: 'ready', page: location.pathname.split('/').pop() || 'index.html' }, location.origin);
}

(async () => {
  if (MODE === 'editor') return connectEditor();
  try {
    let hasDraft = false;
    if (MODE === 'preview') {
      content = await loadDraft();
      hasDraft = !!content;
    }
    if (!content) { content = await loadLive(); primeShapes(); }
    apply();
    if (MODE === 'preview') showBanner(hasDraft);
  } catch (e) {
    // The page already carries the Italian texts: if the content can't load, it still reads fine.
    document.documentElement.classList.remove('content-pending');
  }
})();
// Never leave the page hidden waiting for content.
setTimeout(() => document.documentElement.classList.remove('content-pending'), 2500);
