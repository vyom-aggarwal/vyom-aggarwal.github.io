/* ═══════════════════════════════════════════════════════════
   cursor.js — the custom cursor.

   A point that tracks the pointer exactly and a square ring that
   lags behind it. The lag is the effect: a ring arriving a moment
   late is what gives the pointer mass. The point never lags,
   because that is where the click lands and an eased hit target
   is a broken one.

   Opt-in at runtime. Nothing is applied on a touch device or for
   anyone who has asked for reduced motion, and the native cursor
   is hidden only after this has successfully run — so a throw, a
   failed load, or a browser that chokes on any of it leaves the
   page with a working pointer.
   ═══════════════════════════════════════════════════════════ */

/* State is read from whatever is under the pointer rather than bound
   to each element, so anything added to the page later is covered
   without having to be registered. */
const HOT = "a, button, summary, [role='tab'], [data-magnetic], input, select, textarea";
const COLD = '[data-machine]';
const TEXT = 'p, li, td, h1, h2, h3, blockquote';

/* how hard the ring chases the point, per frame */
const EASE = 0.18;

export function initCursor(_unused, { reducedMotion = false } = {}) {
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (!canHover || reducedMotion) return;

  const point = document.createElement('div');
  point.className = 'cursor';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  /* The visible square lives in a child. The anchor carries the
     position and nothing else, so the state that rotates the square
     cannot rotate where it is standing. */
  const ringBox = document.createElement('div');
  ringBox.className = 'cursor-ring__box';
  ring.append(ringBox);
  document.body.append(ring, point);

  let px = window.innerWidth / 2;
  let py = window.innerHeight / 2;
  let rx = px;
  let ry = py;
  let running = false;

  function step() {
    rx += (px - rx) * EASE;
    ry += (py - ry) * EASE;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;

    if (Math.abs(px - rx) > 0.1 || Math.abs(py - ry) > 0.1) {
      requestAnimationFrame(step);
    } else {
      running = false;
    }
  }

  window.addEventListener('pointermove', (event) => {
    px = event.clientX;
    py = event.clientY;
    /* Written immediately: the point must never trail the pointer. */
    point.style.transform = `translate(${px}px, ${py}px)`;
    /* First real position. Only now does the substitute know where to
       stand, so only now is the native one hidden — adding the class at
       load paints both squares at the origin until the pointer first
       moves, and takes the cursor away from anyone who never moves it. */
    document.documentElement.classList.add('has-cursor');
    if (!running) {
      running = true;
      requestAnimationFrame(step);
    }
  }, { passive: true });

  window.addEventListener('pointerover', (event) => {
    const el = event.target;
    if (!(el instanceof Element)) return;

    const hot = el.closest(HOT);
    const cold = el.closest(COLD);
    const text = !hot && el.closest(TEXT);

    ring.classList.toggle('is-hot', Boolean(hot));
    ring.classList.toggle('is-cold', Boolean(cold));
    ring.classList.toggle('is-text', Boolean(text));
    point.classList.toggle('is-hidden', Boolean(text));
  }, { passive: true });

  window.addEventListener('pointerdown', () => ring.classList.add('is-down'), { passive: true });
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'), { passive: true });

  /* Leaving the window entirely: hide rather than freeze at the edge. */
  document.addEventListener('pointerleave', () => {
    point.classList.add('is-out');
    ring.classList.add('is-out');
  });
  document.addEventListener('pointerenter', () => {
    point.classList.remove('is-out');
    ring.classList.remove('is-out');
  });
}
