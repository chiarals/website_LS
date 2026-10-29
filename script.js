const sections = [...document.querySelectorAll('.section')];
const label = document.querySelector('.section-label');
const track = document.querySelector('.label-track');
const langButtons = [...document.querySelectorAll('.lang-switch button')];

// ---------- Language ----------
function readLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (I18N[fromUrl]) return fromUrl;
  try { const saved = localStorage.getItem('lang'); if (I18N[saved]) return saved; } catch (e) {}
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en';
}

function setLang(lang) {
  const t = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = t[el.dataset.i18nAlt]; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t[el.dataset.i18nPlaceholder]; });
  // Top-left label: one line per section in the current language.
  track.innerHTML = '';
  sections.forEach((s) => {
    const line = document.createElement('span');
    line.textContent = t[s.dataset.label];
    track.appendChild(line);
  });
  langButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  try { localStorage.setItem('lang', lang); } catch (e) {}
}

langButtons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
setLang(readLang());

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

// ---------- Photo rows: total aspect ratio, so CSS can keep each row within the screen height ----------
document.querySelectorAll('.gallery').forEach((g) => {
  const sum = [...g.querySelectorAll('img')]
    .reduce((acc, img) => acc + parseFloat(img.style.getPropertyValue('--r')), 0);
  g.style.setProperty('--sum', sum);
});

// Corsi on phones: tap a course title to open/close its description.
const narrow = matchMedia('(max-width: 640px)');
const courseCards = [...document.querySelectorAll('.cards:not(.cards-full) article')];
function syncCourses() {
  courseCards.forEach((c) => {
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
courseCards.forEach((c) => c.querySelector('.card-head').addEventListener('click', () => {
  if (!narrow.matches) return;
  c.classList.toggle('open');
  syncCourses();
}));
// Desktop: "Leggi tutto" opens the rest of a course description.
courseCards.forEach((c) => {
  const more = c.querySelector('.more-toggle');
  if (!more) return; // "Su misura" and "Da regalare" are short, no toggle
  more.addEventListener('click', () => {
    const open = c.classList.toggle('more-open');
    more.setAttribute('aria-expanded', open);
  });
});
narrow.addEventListener('change', syncCourses);
syncCourses();

// Fade-up only while scrolling down: an element animates as it rises into view.
// Scrolling back up it stays visible; once it drops fully below the screen it resets,
// so it fades in again the next time you scroll down to it.
const reveals = document.querySelectorAll('.reveal');
const showOnEnter = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { rootMargin: '0px 0px -10% 0px' });
const resetBelow = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting && e.boundingClientRect.top > 0) e.target.classList.remove('in');
  });
});
reveals.forEach((el) => { showOnEnter.observe(el); resetBelow.observe(el); });

// The liquid logo turns slowly as you scroll.
const liquid = document.querySelector('.liquid-logo');
if (liquid && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const spin = () => liquid.style.setProperty('--spin', `${window.scrollY * 0.15}deg`);
  window.addEventListener('scroll', spin, { passive: true });
  spin();
}
