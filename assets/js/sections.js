/* ═══════════════════════════════════════════════════════════
   sections.js — behaviour below the hero.

   Three things: the discipline filter on the role index, the
   scroll-driven research stage, and anchor scrolling. Everything
   is progressive enhancement; with this file removed the page
   still reads, and the roles are all visible because filtering
   only ever adds a class.
   ═══════════════════════════════════════════════════════════ */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── role filter ──────────────────────────────────────────
   Every role's detail is already on the page, so filtering is
   the only interaction there is. */
(function initFilter() {
  const list = document.getElementById('roles');
  if (!list) return;

  const roles = Array.from(list.querySelectorAll('.role'));
  const empty = document.getElementById('rolesEmpty');
  const buttons = Array.from(document.querySelectorAll('.filter'));

  const apply = (key) => {
    let shown = 0;
    for (const role of roles) {
      const tags = (role.dataset.tags || '').split(/\s+/);
      const match = key === 'all' || tags.includes(key);
      role.classList.toggle('is-hidden', !match);
      if (match) shown++;
    }
    if (empty) empty.hidden = shown > 0;
  };

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === btn));
      apply(btn.dataset.filter || 'all');
    });
  }
})();

/* ── anchors ──────────────────────────────────────────────
   Scroll without smooth-scroll fighting the browser's own focus
   handling. */
for (const a of document.querySelectorAll('a[href^="#"]')) {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });
}

/* ── the research slides ──────────────────────────────────
   Each slide pins (CSS) for three screens of scroll. This reads how
   far through it the reader is, sets the step, 1 to 3, fills the
   tabs, and hands the step to that slide's live 3D demo (demos.js,
   loaded when the research section comes near).

   Where the slide does not pin (narrow screens) no step is set, every
   caption shows, and the demo plays its three states on its own
   while it is on screen. Under reduced motion the demo shows its
   last state, still. */
(function initSlides() {
  const slides = Array.from(document.querySelectorAll('[data-slide]'));
  if (!slides.length) return;
  const pins = matchMedia('(min-width: 1001px) and (prefers-reduced-motion: no-preference)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the demos, stood up once, when the section is close ── */
  const demos = new Map();
  let loading = null;
  const load = () => loading || (loading = import('./demos.js?v=10796e80').then((mod) => {
    for (const s of slides) {
      const canvas = s.querySelector('[data-demo]');
      if (!canvas) continue;
      const hud = s.querySelector('.demo__panel');
      try {
        const demo = canvas.dataset.demo === 'flyby'
          ? mod.initFlyby(canvas, { reducedMotion: reduced, hud })
          : mod.initQuadruped(canvas, { reducedMotion: reduced });
        demos.set(s, demo);
      } catch (e) { /* no WebGL: the slide reads without its demo */ }
    }
    update();
  }).catch(() => {}));
  const near = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { near.disconnect(); load(); }
  }, { rootMargin: '100% 0px' });
  slides.forEach((s) => near.observe(s));

  /* the quadruped's HUD, written from its own state */
  const PHASES = [
    { at: 0.0, status: 'Nominal gait', detail: 'base policy · healthy', tone: 'ok' },
    { at: 0.4, status: 'Fault injected', detail: 'joint_lock · step 200', tone: 'bad' },
    { at: 0.52, status: 'Residual correcting', detail: 'schematic · not a measured trial', tone: 'warn' },
  ];
  const hudFor = (s, demo) => {
    if (!demo.state) return;
    const p = demo.state.progress;
    let ph = PHASES[0];
    for (const x of PHASES) if (p >= x.at - 0.001) ph = x;
    const hud = s.querySelector('.demo__hud');
    if (hud && hud.dataset.phase !== ph.status) {
      hud.dataset.phase = ph.status;
      hud.dataset.tone = ph.tone;
      hud.querySelector('[data-demo-status]').textContent = ph.status;
      hud.querySelector('[data-demo-detail]').textContent = ph.detail;
    }
    s.querySelector('.demo__panel')?.style.setProperty('--p', p.toFixed(3));
  };
  const isOn = (s) => { const r = s.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  /* the HUD follows the demo's eased progress, so it is polled on a
     timer while a slide is visible rather than set once per step */
  setInterval(() => { for (const [s, d] of demos) if (isOn(s)) hudFor(s, d); }, 120);

  const setDemo = (s, step) => demos.get(s)?.setStep(step);

  /* ── pinned: scroll position decides ───────────────────── */
  const clear = () => slides.forEach((s) => {
    s.removeAttribute('data-step');
    s.querySelectorAll('.tabs__tab').forEach((t) => { t.classList.remove('is-on'); t.style.removeProperty('--p'); });
  });

  let ticking = false;
  function update() {
    ticking = false;
    if (!pins.matches) { clear(); return; }
    for (const s of slides) {
      const r = s.getBoundingClientRect();
      const run = r.height - (innerHeight - 72);
      const p = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 1;
      const step = Math.min(3, Math.floor(p * 3) + 1);
      if (s.dataset.step !== String(step)) s.dataset.step = String(step);
      setDemo(s, step);
      s.querySelectorAll('.tabs__tab').forEach((t, i) => {
        const local = Math.min(1, Math.max(0, p * 3 - i));
        t.style.setProperty('--p', local.toFixed(3));
        t.classList.toggle('is-on', i === step - 1);
      });
    }
  }
  const ask = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  pins.addEventListener('change', update);

  /* ── not pinned: the demo plays itself ─────────────────── */
  const auto = new Map();
  setInterval(() => {
    if (pins.matches) return;
    for (const s of slides) {
      if (!isOn(s)) continue;
      if (reduced) { setDemo(s, 3); continue; }
      const n = ((auto.get(s) || 0) % 3) + 1;
      auto.set(s, n);
      setDemo(s, n);
    }
  }, 3600);

  update();
})();
