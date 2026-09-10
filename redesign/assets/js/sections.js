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

/* ── research stage ───────────────────────────────────────
   Scroll through the block becomes a 0→1 trial timeline, which
   cross-fades the beats, advances the rig, and drives the
   telemetry readout.

   `vel` is the illustrated forward speed, not measured data. The
   stage is a schematic of the mechanism; the real numbers are in
   the table underneath it. */
const PHASES = [
  { at: 0.00, status: 'Nominal gait',       detail: 'base policy · healthy',          tone: 'ok' },
  { at: 0.38, status: 'Fault injected',     detail: 'joint_lock · random joint',      tone: 'bad' },
  { at: 0.52, status: 'Residual engaged',   detail: 'correcting around the fault',    tone: 'warn' },
  /* trails the recovery ramp's end (0.65 in rig.js) so the label
     settles after the motion does, not before it */
  { at: 0.67, status: 'Speed held 30 steps', detail: 'scored: recovered',             tone: 'ok' },
];

(function initStage() {
  const stage = document.getElementById('rigStage');
  if (!stage) return;

  const canvas = document.getElementById('researchRig');
  const beats = Array.from(stage.querySelectorAll('.beat'));
  const track = stage.querySelector('.rig__track i');
  const hud = stage.querySelector('.hud');
  const statusEl = stage.querySelector('[data-hud="status"]');
  const detailEl = stage.querySelector('[data-hud="detail"]');
  const velEl = stage.querySelector('[data-hud="vel"]');
  const stepEl = stage.querySelector('[data-hud="step"]');

  /* Reduced motion un-pins the stage and shows every beat stacked
     (see sections.css), so no GL context is stood up for something
     nobody will see. Same on a narrow viewport. */
  if (reducedMotion || innerWidth <= 860) {
    for (const b of beats) b.classList.add('is-active');
    return;
  }

  let rig = null;
  import('./rig.js?v=7dc2c391')
    .then(({ initRig }) => { rig = initRig(canvas, { reducedMotion }); update(); })
    .catch(() => { /* beats and table still carry the whole story */ });

  let ticking = false;
  let lastBeat = -1;

  function update() {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const scrollable = rect.height - innerHeight;
    if (scrollable <= 0) return;

    const p = Math.min(Math.max(-rect.top / scrollable, 0), 1);
    rig?.setProgress(p);

    const idx = Math.min(beats.length - 1, Math.floor(p * beats.length));
    if (idx !== lastBeat) {
      beats.forEach((b, i) => b.classList.toggle('is-active', i === idx));
      lastBeat = idx;
    }

    if (track) track.style.transform = `scaleX(${p.toFixed(4)})`;

    let phase = PHASES[0];
    for (const ph of PHASES) if (p >= ph.at) phase = ph;
    if (statusEl && statusEl.textContent !== phase.status) {
      statusEl.textContent = phase.status;
      detailEl.textContent = phase.detail;
      hud.dataset.tone = phase.tone;
    }
    if (velEl && rig) velEl.textContent = (0.5 * rig.state.speed).toFixed(2);
    if (stepEl) stepEl.textContent = String(Math.round(p * 500)).padStart(3, '0');
  }

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  addEventListener('resize', update);
  update();
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
