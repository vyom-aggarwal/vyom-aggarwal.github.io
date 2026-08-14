/* ═══════════════════════════════════════════════════════════
   scrolly.js — drives the research stage.

   A tall section pins its inner panel while you scroll past it.
   Scroll position through that section becomes a 0→1 progress
   value, which:
     · cross-fades the beat panels
     · advances the quadruped rig through the experiment
     · updates the telemetry readout

   With reduced motion the stage un-pins (see research.css) and
   every beat is simply shown stacked, so nothing is gated behind
   an animation.
   ═══════════════════════════════════════════════════════════ */

import { initResearchRig } from './research-gl.js';

/* Readouts keyed to where the scroll is. `vel` is the illustrated
   forward speed, not measured data — the stage is a schematic of
   the mechanism, and the real numbers live in the tiles below. */
const PHASES = [
  { at: 0.00, status: 'Nominal gait', detail: 'base policy · healthy', tone: 'ok' },
  { at: 0.34, status: 'Fault injected', detail: 'joint_lock · front-left', tone: 'bad' },
  { at: 0.56, status: 'Residual engaged', detail: 'correcting around the fault', tone: 'warn' },
  { at: 0.80, status: 'Partial recovery', detail: 'locked joint remains locked', tone: 'warn' },
];

export function initScrolly({ reducedMotion = false } = {}) {
  const stage = document.getElementById('rigStage');
  if (!stage) return;

  const canvas = document.getElementById('rig');
  const beats = Array.from(stage.querySelectorAll('.beat'));
  const track = stage.querySelector('.stage__track i');
  const statusEl = stage.querySelector('[data-hud="status"]');
  const detailEl = stage.querySelector('[data-hud="detail"]');
  const velEl = stage.querySelector('[data-hud="vel"]');
  const stepEl = stage.querySelector('[data-hud="step"]');
  const hud = stage.querySelector('.stage__hud');

  /* Reduced motion hides the canvas outright (see research.css), so
     don't stand up a GL context for something nobody will see. */
  if (reducedMotion) {
    beats.forEach((b) => b.classList.add('is-active'));
    stage.classList.add('is-static');
    if (statusEl) statusEl.textContent = PHASES[0].status;
    if (detailEl) detailEl.textContent = PHASES[0].detail;
    return;
  }

  const rig = initResearchRig(canvas, { reducedMotion });

  let ticking = false;
  let lastBeat = -1;

  const update = () => {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;

    const p = Math.min(Math.max(-rect.top / scrollable, 0), 1);
    rig?.setProgress(p);

    /* beats are evenly spaced across the scroll, one at a time */
    const idx = Math.min(beats.length - 1, Math.floor(p * beats.length));
    if (idx !== lastBeat) {
      beats.forEach((b, i) => b.classList.toggle('is-active', i === idx));
      lastBeat = idx;
    }

    if (track) track.style.transform = `scaleX(${p.toFixed(4)})`;

    /* telemetry */
    let phase = PHASES[0];
    for (const ph of PHASES) if (p >= ph.at) phase = ph;
    if (statusEl && statusEl.textContent !== phase.status) {
      statusEl.textContent = phase.status;
      detailEl.textContent = phase.detail;
      hud.dataset.tone = phase.tone;
    }
    if (velEl && rig) velEl.textContent = (0.5 * rig.state.speed).toFixed(2);
    if (stepEl) stepEl.textContent = String(Math.round(p * 500)).padStart(3, '0');
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener('resize', update);
  update();
}
