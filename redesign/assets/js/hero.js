/* ═══════════════════════════════════════════════════════════
   hero.js — entry point for the hero panel.

   Everything here is progressive enhancement. With this file
   removed the panel still renders, reads, and navigates; only
   the clock, the 3D object, and the stage-2 comparison controls
   go away.
   ═══════════════════════════════════════════════════════════ */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

/* ── local clock, Lathrop ─────────────────────────────────── */
const clock = document.getElementById('clock');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const tick = () => { clock.textContent = fmt.format(new Date()); };
  tick();
  setInterval(tick, 1000);
}

/* Capture aid: ?still drops the .js flag the entrance animations are
   gated on, so a headless screenshot lands on the final state instead
   of on frame one. */
if (params.has('still')) document.documentElement.classList.remove('js');

/* The three headline candidates, for the stage-2 comparison only.
   Option A is what ships and it is already in the HTML, so this runs
   only when a candidate is named in the URL. */
const HEADLINES = {
  b: ['Nothing', 'Up There', 'Gets A', 'Second Try'],
  c: ['Everything', 'Up There', 'Has To Work', 'The First Time'],
};
const pick = params.get('headline');
if (pick && HEADLINES[pick]) {
  const display = document.getElementById('display');
  display.innerHTML = '';
  HEADLINES[pick].forEach((text, i) => {
    const span = document.createElement('span');
    if (i === 0) {
      const sr = document.createElement('span');
      sr.className = 'u-sr';
      sr.textContent = 'Vyom Aggarwal. ';
      span.append(sr);
    }
    span.append(document.createTextNode(text));
    display.append(span);
  });
}
document.documentElement.dataset.headline = pick || 'a';

/* ── the 3D object, lazily ────────────────────────────────
   The poster is the LCP element and ships in the HTML. Three.js
   is 167KB over the wire and must never be on that path, so it
   loads after first paint, and not at all on a narrow viewport
   or under reduced motion. */
const stage = document.getElementById('stage');
const canvas = document.getElementById('heroRig');
const wantsGL = stage && canvas && !reducedMotion && innerWidth > 860;

if (wantsGL) {
  const boot = () => {
    import('./earth.js?v=deff3f92')
      .then(({ initEarth }) => {
        const rig = initEarth(canvas, { reducedMotion });
        canvas.classList.add('is-live');
        stage.classList.add('is-live');
        /* Once the canvas is up the poster is dead weight, and leaving
           it under a semi-transparent canvas double-exposes the props
           for the length of the fade. Drop it out of the box entirely. */
        const poster = document.getElementById('poster');
        if (poster) {
          if (params.has('still')) poster.hidden = true;
          else setTimeout(() => { poster.hidden = true; }, 700);
        }
        /* poster baking, dev only: window.__bakePoster() */
        window.__bakePoster = () => rig.snapshot();
      })
      .catch(() => { /* poster stays; nothing else to do */ });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 1800 });
  else addEventListener('load', () => setTimeout(boot, 200));
}
