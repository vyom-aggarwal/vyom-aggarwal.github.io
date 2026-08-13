/* ═══════════════════════════════════════════════════════════
   shell.js — the console: reading progress, section index,
   theme switch, mobile menu, and the clock.
   ═══════════════════════════════════════════════════════════ */

const SECTIONS = ['overview', 'work', 'education', 'skills', 'awards', 'contact'];

/* ── reading progress ────────────────────────────────────── */
function initProgress() {
  const fill = document.getElementById('progressFill');
  if (!fill) return;
  let ticking = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    fill.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
}

/* ── section index highlighting ──────────────────────────── */
function initIndex() {
  const targets = SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
  if (!targets.length) return;

  const links = document.querySelectorAll('.index a[href^="#"]');
  const ratios = new Map();

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));

    let best = '', bestRatio = 0;
    ratios.forEach((r, id) => { if (r > bestRatio) { bestRatio = r; best = id; } });
    if (!best) return;

    links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${best}`));
  }, { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.01, 0.5, 1] });

  targets.forEach((t) => io.observe(t));
}

/* ── theme ───────────────────────────────────────────────── */
function initTheme({ reducedMotion }) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  /* `persist` only on a deliberate click — writing the
     system-derived value on load would pin the theme and stop
     the site following the visitor's OS setting. */
  const apply = (next, persist) => {
    document.documentElement.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem('va-theme', next); } catch (e) { /* private mode */ }
    }
    btn.setAttribute('aria-label', `Switch to ${next === 'dark' ? 'light' : 'dark'} theme`);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  };

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    if (!reducedMotion && document.startViewTransition) {
      document.startViewTransition(() => apply(next, true));
    } else {
      apply(next, true);
    }
  });

  /* follow the OS until the visitor overrides it */
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('va-theme'); } catch (err) { /* private mode */ }
    if (!saved) apply(e.matches ? 'light' : 'dark', false);
  });

  apply(document.documentElement.dataset.theme || 'dark', false);
}

/* ── mobile menu ─────────────────────────────────────────── */
function initMenu() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  if (!burger || !menu) return;

  const links = Array.from(menu.querySelectorAll('a'));
  /* everything the menu covers, so it can't be tabbed into behind the overlay */
  const behind = [document.getElementById('main')].filter(Boolean);
  let open = false;

  const setOpen = (next) => {
    if (next === open) return;
    open = next;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);
    behind.forEach((el) => { el.inert = open; });

    if (open) {
      menu.hidden = false;
      links.forEach((a, i) => { a.style.transitionDelay = `${120 + i * 55}ms`; });
      void menu.offsetWidth;          /* flush layout so the transition has a start value */
      menu.classList.add('is-open');
      links[0]?.focus({ preventScroll: true });
    } else {
      links.forEach((a) => { a.style.transitionDelay = '0ms'; });
      menu.classList.remove('is-open');
      setTimeout(() => { if (!open) menu.hidden = true; }, 600);
    }
  };

  burger.addEventListener('click', () => setOpen(!open));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    setOpen(false);
    burger.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 1100) setOpen(false); });
}

/* ── clock (Vyom's local time, not the visitor's) ────────── */
function initClock() {
  const el = document.getElementById('clock');
  if (!el) return;

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
}

/* ── misc ────────────────────────────────────────────────── */
function initMisc({ reducedMotion }) {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const toTop = document.getElementById('toTop');
  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* layout grid overlay is gone; G now toggles tile outlines */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    if (e.key === 'g' || e.key === 'G') document.documentElement.classList.toggle('show-grid');
  });
}

export function initShell(opts = {}) {
  initProgress();
  initIndex();
  initTheme(opts);
  initMenu();
  initClock();
  initMisc(opts);
}
