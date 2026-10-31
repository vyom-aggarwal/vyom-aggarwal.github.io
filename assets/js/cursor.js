/* ═══════════════════════════════════════════════════════════
   cursor.js — the custom cursor.

   A point that tracks exactly and a ring that lags. The point never
   lags, because that is where the click lands; the ring closes 18% of
   the gap each frame, which is what gives the pointer mass.

   What the ring does depends on what is under the pointer, read on
   pointerover rather than bound per element, so anything added later
   is covered without registering it:

     hot    links, buttons, tabs, inputs, magnetic targets
            → grows to 52px, turns the site's blue, rotates 45° into a diamond
     cold   live simulations ([data-machine])
            → keeps its size, takes a softer blue
     text   paragraphs, list items, cells, headings
            → collapses to a 2px caret bar, and the point hides
     down   while a button is held → shrinks to 26px
     out    the pointer left the window → both fade

   Opt-in at runtime. Nothing happens on a touch device or under
   reduced motion, and the native cursor is hidden only after the
   first real pointer position is known, so a failed load, a throw,
   or a visitor who never moves the mouse keeps the system cursor.

   The page opens modal <dialog>s, which sit in the top layer above
   any z-index. So the cursor lives in a manual popover, also in the
   top layer, and is raised again whenever a dialog opens. Where
   popovers are unsupported, an open dialog hands back the native
   cursor instead of hiding it under the modal.
   ═══════════════════════════════════════════════════════════ */

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canHover = matchMedia('(hover: hover)');

const HOT = "a, button, summary, [role='tab'], [data-magnet], input, select, textarea";
const COLD = '[data-machine]';
const TEXT = 'p, li, td, h1, h2, h3, blockquote';

export function initCursor() {
  if (!canHover.matches || reduced.matches) return;

  const root = document.documentElement;
  const layer = document.createElement('div');
  layer.className = 'cursor-layer';
  layer.setAttribute('aria-hidden', 'true');

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  /* The visible square lives in a child. The anchor carries the
     position and nothing else, so a state that rotates the square
     cannot rotate where it is standing. */
  const box = document.createElement('div');
  box.className = 'cursor-ring__box';
  ring.append(box);
  const point = document.createElement('div');
  point.className = 'cursor';
  layer.append(ring, point);
  document.body.append(layer);

  const popover = typeof layer.showPopover === 'function';
  const raise = () => {
    if (!popover) return;
    layer.setAttribute('popover', 'manual');
    try {
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
    } catch (e) { /* not connected yet, or unsupported: stays a fixed div */ }
  };
  raise();

  /* ── movement ───────────────────────────────────────────── */
  let px = innerWidth / 2, py = innerHeight / 2;
  let rx = px, ry = py;
  let running = false;

  function step() {
    rx += (px - rx) * 0.18;
    ry += (py - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    if (Math.abs(px - rx) > 0.1 || Math.abs(py - ry) > 0.1) requestAnimationFrame(step);
    else running = false;
  }

  addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    /* written immediately: the point must never trail the pointer */
    point.style.transform = `translate(${px}px, ${py}px)`;
    /* only now, with a real position to stand on, is the native
       cursor hidden */
    if (!root.classList.contains('has-cursor')) {
      rx = px; ry = py;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      if (popover || !document.querySelector('dialog[open]')) root.classList.add('has-cursor');
    }
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: true });

  /* ── state from what is under the pointer ───────────────── */
  addEventListener('pointerover', (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const hot = el.closest(HOT);
    const cold = el.closest(COLD);
    const text = !hot && el.closest(TEXT);
    ring.classList.toggle('is-hot', Boolean(hot));
    ring.classList.toggle('is-cold', Boolean(cold));
    ring.classList.toggle('is-text', Boolean(text));
    point.classList.toggle('is-hidden', Boolean(text));
  }, { passive: true });

  addEventListener('pointerdown', () => ring.classList.add('is-down'), { passive: true });
  addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });

  /* leaving the window: hide rather than freeze at the edge */
  document.addEventListener('pointerleave', () => { point.classList.add('is-out'); ring.classList.add('is-out'); });
  document.addEventListener('pointerenter', () => { point.classList.remove('is-out'); ring.classList.remove('is-out'); });

  /* ── dialogs ────────────────────────────────────────────── */
  const watch = new MutationObserver(() => {
    const anyOpen = !!document.querySelector('dialog[open]');
    if (popover) { if (anyOpen) raise(); }
    else root.classList.toggle('has-cursor', !anyOpen);
  });
  document.querySelectorAll('dialog').forEach((d) => watch.observe(d, { attributes: true, attributeFilter: ['open'] }));
}
