// Visit statistics (PostHog, EU cloud, Frankfurt) — cookieless, so no consent banner.
//
// Why no banner is needed (Garante privacy, linee guida cookie 10/06/2021, and art. 122
// Codice privacy): nothing is written to or read from the visitor's device for tracking.
// `cookieless_mode: 'always'` keeps PostHog out of cookies and localStorage; it counts
// unique visitors with a server-side hash whose salt rotates every day, so a visitor's
// path across pages is visible for that day, and nobody is followed across days.
// Never sent: names, emails, phone numbers, what is typed in the newsletter field.
// In the PostHog project settings keep "Discard client IP data" ON and
// "Cookieless server hash mode" ON, or events are rejected.
//
// Chiara's (and Simone's) own visits: open the site once with `?notrack` on each device
// and that browser is never counted again (`?track` undoes it). The flag lives in that
// device's localStorage, set by the owner for themselves.
//
// With POSTHOG_KEY empty nothing loads, so local dev never pollutes the dashboard.
const POSTHOG_KEY = '';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

(function () {
  const local = /^(localhost|127\.|192\.168\.)/.test(location.hostname);

  function ownerOptedOut() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('notrack')) localStorage.setItem('notrack', '1');
      if (q.has('track')) localStorage.removeItem('notrack');
      return localStorage.getItem('notrack') === '1';
    } catch (e) {
      return false; // private mode: count the visit
    }
  }

  // Draft previews from the reserved area are not real visits.
  const preview = /[?&]anteprima/.test(location.search);

  if (!POSTHOG_KEY || local || preview || ownerOptedOut()) return;

  // PostHog's official loader: queues calls until the library arrives.
  /* eslint-disable */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  /* eslint-enable */

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    persistence: 'memory',
    cookieless_mode: 'always',
    respect_dnt: true, // browsers set to "Do Not Track" are not counted
    autocapture: true, // every click, with element text + link: powers heatmaps
    capture_pageview: true, // referrer and UTM parameters ride along automatically
    capture_pageleave: true, // time on page and how far down people scrolled
    disable_session_recording: true, // no screen recordings
    disable_surveys: true,
  });

  const page = location.pathname.replace(/^\/|\.html$/g, '') || 'home';
  posthog.register({ lang: document.documentElement.lang, site_page: page });

  const track = (event, props) => posthog.capture(event, Object.assign({ site_page: page }, props));
  const placeOf = (el) => (el.closest('section[id]') || {}).id || 'header';

  // ---------- Contact and outbound clicks: the steps that matter ----------
  // `sendBeacon` so the event still leaves when the click opens WhatsApp or mail.
  function linkEvent(a) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('mailto:')) return ['contact_clicked', { channel: 'email' }];
    if (href.startsWith('tel:')) return ['contact_clicked', { channel: 'phone' }];
    if (href.includes('wa.me/')) return ['contact_clicked', { channel: 'whatsapp' }];
    if (href.includes('substack.com/p/')) return ['newsletter_post_clicked', {}];
    if (href.includes('substack.com')) return ['substack_clicked', {}];
    const course = href.match(/corsi\.html#(percorso-\d)/);
    if (course) return ['course_link_clicked', { course: course[1] }];
    return null;
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      const ev = linkEvent(a);
      if (ev) posthog.capture(ev[0], Object.assign({ site_page: page, place: placeOf(a), label: a.textContent.trim().slice(0, 60) }, ev[1]), { transport: 'sendBeacon' });
      return;
    }
    const langBtn = e.target.closest && e.target.closest('.lang-switch button');
    if (langBtn) {
      posthog.register({ lang: langBtn.dataset.lang });
      track('language_changed', { lang: langBtn.dataset.lang });
      return;
    }
    const card = e.target.closest && e.target.closest('.card-head, .more-toggle');
    if (card) {
      const article = card.closest('article');
      track('course_expanded', { course: article && article.id });
    }
  }, { capture: true });

  // Newsletter: only the fact that someone pressed "Iscriviti", never the address.
  document.querySelectorAll('.nl-form').forEach((f) => f.addEventListener('submit', () => {
    posthog.capture('newsletter_submitted', { site_page: page }, { transport: 'sendBeacon' });
  }));

  // FAQ: which questions people open.
  document.querySelectorAll('.faq details').forEach((d) => d.addEventListener('toggle', () => {
    if (!d.open) return;
    const q = d.querySelector('summary');
    track('faq_opened', { question: q && q.dataset.i18n });
  }));

  // ---------- How far down the page people get ----------
  // `section_viewed` once per section, when its top passes the middle of the screen
  // (same rule as the label in the top bar; some sections are taller than a phone screen).
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const id = en.target.id;
        if (!en.isIntersecting || seen.has(id)) return;
        seen.add(id);
        track('section_viewed', { section: id });
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -50% 0px' });
    document.querySelectorAll('section[id]').forEach((s) => io.observe(s));
  }
})();
