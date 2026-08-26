/* ═══════════════════════════════════════════════════════════
   main.js — entry point.

   Everything below is progressive enhancement: the page reads
   and navigates fine with this file removed.
   ═══════════════════════════════════════════════════════════ */

import { initHero } from './hero-gl.js';
import { initCursor } from './cursor.js';
import { initReveal } from './reveal.js';
import { initShell } from './shell.js';
import { initWork } from './work.js';
import { initInteractions } from './interact.js';
import { initScrolly } from './scrolly.js';

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const opts = { reducedMotion: motionQuery.matches };

/* keep the console usable immediately */
initShell(opts);
initWork(opts);
initCursor(document.getElementById('cursor'), opts);
initInteractions(opts);
initHero(document.getElementById('gl'), opts);
initScrolly(opts);

/* Hold the entrance animations until the preloader curtain starts
   lifting, otherwise the hero performs to nobody. A deep link skips
   the wait — that visitor is already looking at the content. */
const PRELOAD_MS = 680;
if (opts.reducedMotion || location.hash) {
  initReveal(opts);
} else {
  setTimeout(() => initReveal(opts), PRELOAD_MS);
}

/* Anchor jumps scroll the canvas without smooth-scroll fighting
   the browser's own focus handling. */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: opts.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });
});
