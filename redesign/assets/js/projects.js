/* ═══════════════════════════════════════════════════════════
   projects.js — the launcher, the two overlays, and the stepper.

   Everything the dialogs contain is already in the HTML. This file
   only hides it, shows it, and keeps the URL honest about which
   project is open. With scripting off the noscript rule displays
   both panels inline and the page still reads end to end.
   ═══════════════════════════════════════════════════════════ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_NAMES = ['Premise', 'Apparatus', 'Injection', 'Method', 'Measurement', 'Finding'];

/* ── card models, stood up only when a card is engaged ────── */
const models = new WeakMap();
let cardModule = null;

function wakeCard(cardEl, on) {
  const canvas = cardEl.querySelector('.pcard__canvas');
  if (!canvas || reduced || matchMedia('(hover: none)').matches) return;

  const existing = models.get(canvas);
  if (existing) { existing.setActive(on); return; }
  if (!on) return;

  models.set(canvas, { setActive() {} });      /* claim the slot, once */
  (cardModule || (cardModule = import('./cards.js?v=3687b2c8')))
    .then(({ initCardModel }) => {
      const rig = initCardModel(canvas, canvas.dataset.model);
      if (!rig) return;
      models.set(canvas, rig);
      rig.setActive(true);
      canvas.classList.add('is-live');
      /* The poster is transparent-backed, so leaving it under a live
         canvas shows a second, static copy of the model through the
         gaps and the animation reads as a ghost. Drop it. */
      const poster = cardEl.querySelector('.pcard__poster');
      if (poster) setTimeout(() => { poster.hidden = true; }, 450);
    })
    .catch(() => { /* the poster is already correct */ });
}

/* ═══ the in-dialog simulations ════════════════════════════
   One live context at a time. It is created when a dialog opens
   and stopped when it closes, so the hero, the cards and the
   overlays never all hold a WebGL context at once. */
const SIM_PHASES = [
  { at: 0.00, status: 'Nominal gait',        detail: 'base policy · healthy',       tone: 'ok' },
  { at: 0.38, status: 'Fault injected',      detail: 'joint_lock · random joint',   tone: 'bad' },
  { at: 0.52, status: 'Residual engaged',    detail: 'correcting around the fault', tone: 'warn' },
  { at: 0.67, status: 'Speed held 30 steps', detail: 'scored: recovered',           tone: 'ok' },
];

const sims = new Map();

function startSim(slug, d) {
  if (reduced || sims.has(slug)) { sims.get(slug)?.start?.(); return; }
  const canvas = d.querySelector('.proj__canvas');
  if (!canvas) return;

  sims.set(slug, { start() {}, stop() {} });      /* claim the slot once */

  const kind = canvas.dataset.sim;
  const load = kind === 'fault'
    ? import('./rig.js?v=3687b2c8').then(({ initRig }) => initRig(canvas, { reducedMotion: reduced }))
    : import('./cards.js?v=3687b2c8').then(({ initCardModel }) => initCardModel(canvas, 'scan'));

  load.then((rig) => {
    sims.set(slug, rig);
    if (kind === 'fault') {
      const st = steppers.get(slug);
      if (st) paintSim(slug, st.current);
    }
  }).catch(() => { /* the write-up carries the whole story without it */ });
}

function stopSim(slug) {
  sims.get(slug)?.stop?.();
}

/* Project A's simulation is driven by the step, not by scroll: the six
   steps are the trial timeline, so step 3 lands just past the fault and
   step 4 just past the correction. */
function paintSim(slug, step) {
  const rig = sims.get(slug);
  const d = dialogs.get(slug);
  if (!rig || !d || typeof rig.setProgress !== 'function') return;

  const p = (step - 1) / 5;
  rig.setProgress(p);

  let phase = SIM_PHASES[0];
  for (const ph of SIM_PHASES) if (p >= ph.at) phase = ph;
  const hud = d.querySelector('.simhud');
  if (!hud) return;
  hud.dataset.tone = phase.tone;
  d.querySelector('[data-sim-status]').textContent = phase.status;
  d.querySelector('[data-sim-detail]').textContent = phase.detail;
  d.querySelector('[data-sim-vel]').textContent = (0.5 * (rig.state?.speed ?? 1)).toFixed(2);
  d.querySelector('[data-sim-step]').textContent = String(Math.round(p * 500)).padStart(3, '0');
}

/* ═══ the overlay ══════════════════════════════════════════ */
const dialogs = new Map();
document.querySelectorAll('.proj').forEach((d) => {
  dialogs.set(d.id.replace('project-', ''), d);
});

let openSlug = null;
let restoreTo = null;      /* the card that opened it */
let lockedAt = 0;

/* Closing pops a history entry, and the browser's own scroll
   restoration for that entry lands before ours does, which sent the
   page back to the top. We restore the position by hand, so take the
   browser out of it. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function lockScroll() {
  lockedAt = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedAt}px`;
  document.body.style.width = '100%';
}

function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  /* restore exactly, and without a smooth-scroll animation. Applied
     again on the next frame because the history pop lands after this
     call returns. */
  const y = lockedAt;
  window.scrollTo({ top: y, behavior: 'auto' });
  requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
}

function open(slug, step, { push = true } = {}) {
  const d = dialogs.get(slug);
  if (!d || openSlug === slug) {
    if (openSlug === slug && step) steppers.get(slug)?.go(step, false);
    return;
  }
  if (openSlug) close({ pop: false, restore: false });

  restoreTo = document.querySelector(`[data-open="${slug}"]`) || null;
  lockScroll();
  openSlug = slug;

  if (typeof d.showModal === 'function') d.showModal();
  else { d.setAttribute('open', ''); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); }

  startSim(slug, d);

  const st = steppers.get(slug);
  if (st) { st.measure(); st.go(step || 1, false); }
  else paintSim(slug, 1);

  /* focus the close button: it is the one control every visitor
     needs and it is at a predictable place */
  d.querySelector('[data-close]')?.focus();

  const hash = `#project/${slug}` + (step && step > 1 ? `/${step}` : '');
  if (push) history.pushState({ project: slug, step: step || 1 }, '', hash);
}

function close({ pop = true, restore = true } = {}) {
  if (!openSlug) return;
  const d = dialogs.get(openSlug);
  const openSlugWas = openSlug;
  openSlug = null;

  stopSim(openSlugWas);

  if (typeof d.close === 'function' && d.open) d.close();
  else d.removeAttribute('open');

  unlockScroll();
  if (restore && restoreTo) restoreTo.focus({ preventScroll: true });
  restoreTo = null;

  if (pop) {
    if (history.state && history.state.project) history.back();
    else history.replaceState(null, '', location.pathname + location.search);
  }
}

for (const [slug, d] of dialogs) {
  /* Esc fires the native close event, so both paths land here */
  d.addEventListener('close', () => { if (openSlug === slug) close(); });
  d.querySelector('[data-close]')?.addEventListener('click', () => close());

  /* a click on the backdrop lands on the dialog element itself */
  d.addEventListener('click', (e) => {
    if (e.target === d) close();
  });
}

document.querySelectorAll('[data-open]').forEach((btn) => {
  const slug = btn.dataset.open;
  btn.addEventListener('click', () => open(slug));
  btn.addEventListener('pointerenter', () => wakeCard(btn, true));
  btn.addEventListener('pointerleave', () => wakeCard(btn, false));
  /* focus gets the same treatment as hover, deliberately */
  btn.addEventListener('focus', () => wakeCard(btn, true));
  btn.addEventListener('blur', () => wakeCard(btn, false));
});

/* ═══ the stepper ══════════════════════════════════════════ */
const steppers = new Map();

for (const [slug, d] of dialogs) {
  const range = d.querySelector('[data-step-range]');
  if (!range) continue;

  const inner = d.querySelector('.proj__inner');
  const pane = d.querySelector('[data-steps]');
  const steps = Array.from(pane.querySelectorAll('.step'));
  const num = d.querySelector('[data-step-num]');
  const name = d.querySelector('[data-step-name]');
  const prev = d.querySelector('[data-step-prev]');
  const next = d.querySelector('[data-step-next]');
  const ticks = Array.from(d.querySelectorAll('[data-step-go]'));

  let current = 1;

  /* Measure the tallest step and hold that height, so dragging the
     slider never makes the dialog jump. Measured, not guessed: each
     step is laid out static and hidden in turn and its own height
     read back. Anything taller than the space available scrolls
     inside the pane rather than being cut. */
  const measure = () => {
    pane.style.height = 'auto';
    let tallest = 0;
    for (const s of steps) {
      const wasActive = s.classList.contains('is-active');
      s.classList.add('is-measuring');
      tallest = Math.max(tallest, s.scrollHeight);
      s.classList.remove('is-measuring');
      s.classList.toggle('is-active', wasActive);
    }
    /* What is left after the header and the stepper, not a guessed
       fraction of the viewport: a fraction overflowed the dialog on a
       900px-tall window. */
    pane.style.height = '0px';
    const chrome = inner.scrollHeight;
    const room = Math.max(240, Math.round(innerHeight * 0.94) - chrome);
    pane.style.height = Math.min(tallest, room) + 'px';
  };

  const go = (n, push = true) => {
    current = Math.min(Math.max(Number(n) || 1, 1), steps.length);
    steps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === current));
    ticks.forEach((t) => t.setAttribute('aria-current', String(Number(t.dataset.stepGo) === current)));
    range.value = String(current);
    range.setAttribute('aria-valuetext', `Step ${current} of ${steps.length}, ${STEP_NAMES[current - 1]}`);
    num.textContent = String(current).padStart(2, '0');
    name.textContent = STEP_NAMES[current - 1];
    prev.disabled = current === 1;
    next.disabled = current === steps.length;
    pane.scrollTop = 0;
    steps[current - 1].scrollTop = 0;
    paintSim(slug, current);

    if (push && openSlug === slug) {
      const hash = `#project/${slug}` + (current > 1 ? `/${current}` : '');
      history.replaceState({ project: slug, step: current }, '', hash);
    }
  };

  range.addEventListener('input', () => go(range.value));
  prev.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  ticks.forEach((t) => t.addEventListener('click', () => go(t.dataset.stepGo)));

  /* Home and End on top of what the range already gives us */
  range.addEventListener('keydown', (e) => {
    if (e.key === 'Home') { e.preventDefault(); go(1); }
    if (e.key === 'End') { e.preventDefault(); go(steps.length); }
  });

  /* horizontal swipe on the content pane */
  let x0 = null, y0 = null;
  pane.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  pane.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) go(current + (dx < 0 ? 1 : -1));
    x0 = y0 = null;
  }, { passive: true });

  addEventListener('resize', () => { if (openSlug === slug) measure(); });

  steppers.set(slug, { go, measure, get current() { return current; } });
}

/* ═══ hash routing ═════════════════════════════════════════
   Hash only. GitHub Pages cannot rewrite paths, so a pushed path
   would 404 on a direct hit or a refresh. */
function parseHash(h) {
  const m = /^#project\/([a-z-]+)(?:\/(\d+))?$/.exec(h || '');
  return m ? { slug: m[1], step: m[2] ? Number(m[2]) : 1 } : null;
}

function syncFromHash({ push = false } = {}) {
  const target = parseHash(location.hash);
  if (target && dialogs.has(target.slug)) open(target.slug, target.step, { push });
  else if (openSlug) close({ pop: false });
}

addEventListener('popstate', () => syncFromHash());
syncFromHash();
