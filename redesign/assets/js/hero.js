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

/* ── the three headline candidates ────────────────────────
   Exact wording as briefed. Option B's fourth line reads as
   unfinished and option C repeats the research section's own
   heading; both notes are in the stage-2 writeup. */
const HEADLINES = {
  a: ['Building', 'Machines', 'That Reason', 'Under Load'],
  b: ['Machines', 'That', 'Reason —', 'And the Math Under'],
  c: ['Teaching', 'A Broken', 'Robot to', 'Keep Walking'],
};

const display = document.getElementById('display');

function setHeadline(key) {
  const lines = HEADLINES[key] || HEADLINES.a;
  display.innerHTML = '';
  lines.forEach((text, i) => {
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
  document.documentElement.dataset.headline = key;
}

const PIXEL = {
  departure: "'Departure Mono', 'Silkscreen', monospace",
  silkscreen: "'Silkscreen', 'Departure Mono', monospace",
};

function setPixel(key) {
  document.documentElement.style.setProperty('--font-pixel', PIXEL[key] || PIXEL.departure);
  document.documentElement.dataset.pixel = key;
}

/* URL-addressable so each combination can be captured on its own:
   ?headline=b&pixel=silkscreen */
const startHeadline = params.get('headline') || 'a';
const startPixel = params.get('pixel') || 'departure';
setHeadline(startHeadline);
setPixel(startPixel);

/* Capture aid: ?still drops the .js flag the entrance animations are
   gated on, so a headless screenshot lands on the final state instead
   of on frame one. */
if (params.has('still')) document.documentElement.classList.remove('js');

/* ── stage-2 comparison bar. Only with ?dev, never in the
   shipped page. ─────────────────────────────────────────── */
if (params.has('dev')) {
  const bar = document.createElement('div');
  bar.id = 'devbar';
  bar.innerHTML = `
    <style>
      #devbar { position: fixed; z-index: 300; left: 50%; bottom: 14px; transform: translateX(-50%);
        display: flex; gap: 14px; align-items: center; padding: 8px 12px; border-radius: 999px;
        background: #10141a; border: 1px solid rgba(255,255,255,.14);
        font: 500 11px/1 'JetBrains Mono', monospace; color: #8C95A1; letter-spacing: .08em; }
      #devbar b { color: #4A9EE0; font-weight: 500; text-transform: uppercase; }
      #devbar button { padding: 6px 10px; border-radius: 999px; cursor: pointer; color: #A3ACB6;
        background: rgba(255,255,255,.05); text-transform: uppercase; letter-spacing: .08em; }
      #devbar button[aria-pressed="true"] { background: #4A9EE0; color: #0A0D11; }
      #devbar span { width: 1px; height: 18px; background: rgba(255,255,255,.14); }
    </style>
    <b>headline</b>
    <button data-h="a" type="button">A</button>
    <button data-h="b" type="button">B</button>
    <button data-h="c" type="button">C</button>
    <span></span>
    <b>pixel</b>
    <button data-p="departure" type="button">Departure</button>
    <button data-p="silkscreen" type="button">Silkscreen</button>`;
  document.body.append(bar);

  const sync = () => {
    bar.querySelectorAll('[data-h]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.h === document.documentElement.dataset.headline)));
    bar.querySelectorAll('[data-p]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.p === document.documentElement.dataset.pixel)));
  };
  bar.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.h) setHeadline(t.dataset.h);
    if (t.dataset.p) setPixel(t.dataset.p);
    sync();
  });
  sync();
}

/* ── the 3D object, lazily ────────────────────────────────
   The poster is the LCP element and ships in the HTML. Three.js
   is 167KB over the wire and must never be on that path, so it
   loads after first paint, and not at all on a narrow viewport
   or under reduced motion. */
const stage = document.getElementById('stage');
const canvas = document.getElementById('rig');
const wantsGL = stage && canvas && !reducedMotion && innerWidth > 860;

if (wantsGL) {
  const boot = () => {
    import('./robot.js')
      .then(({ initRobot }) => {
        const rig = initRobot(canvas, { reducedMotion });
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
