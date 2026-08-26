/* ═══════════════════════════════════════════════════════════
   cursor.js — a two-part cursor: a hard dot that tracks the
   pointer exactly, and a ring that trails behind it and morphs
   into a labelled disc over anything interactive.

   Only runs for fine pointers with motion allowed; touch and
   reduced-motion users keep the native cursor.
   ═══════════════════════════════════════════════════════════ */

const SOFT = 'a, button, [role="button"], input, select, textarea, summary';

export function initCursor(el, { reducedMotion = false } = {}) {
  if (!el) return;
  if (reducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const dot = el.querySelector('.cursor__dot');
  const ring = el.querySelector('.cursor__ring');
  const label = el.querySelector('.cursor__label');
  if (!dot || !ring || !label) return;

  document.documentElement.classList.add('cursor-on');

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  let raf = 0;

  const loop = () => {
    /* the ring eases toward the pointer — the lag is the effect */
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    el.classList.remove('is-idle');
  }, { passive: true });

  document.addEventListener('pointerleave', () => el.classList.add('is-idle'));
  document.addEventListener('pointerenter', () => el.classList.remove('is-idle'));
  window.addEventListener('blur', () => el.classList.add('is-idle'));

  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));

  /* Delegated hover state so filtered/added elements just work. */
  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest?.('[data-cursor]');
    if (labelled) {
      label.textContent = labelled.dataset.cursor;
      el.classList.add('is-hot');
      el.classList.remove('is-soft');
      return;
    }
    if (e.target.closest?.(SOFT)) {
      el.classList.add('is-soft');
      el.classList.remove('is-hot');
    }
  });

  document.addEventListener('pointerout', (e) => {
    const next = e.relatedTarget;
    if (next && next.closest?.('[data-cursor]')) return;
    if (next && next.closest?.(SOFT)) {
      el.classList.add('is-soft');
      el.classList.remove('is-hot');
      return;
    }
    el.classList.remove('is-hot', 'is-soft');
  });

  /* Native cursor comes back if the tab is hidden for a while. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(loop);
  });
}
