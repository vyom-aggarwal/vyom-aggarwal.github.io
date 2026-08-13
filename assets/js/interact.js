/* ═══════════════════════════════════════════════════════════
   interact.js — pointer micro-interactions.

   · magnetic  [data-magnetic] drift toward the cursor
   · tilt      .card--tilt lean in 3D
   · spotlight .card--spot track a soft light under the cursor
   · scramble  [data-scramble] shuffle glyphs on hover

   All of it is desktop-only garnish: touch and reduced-motion
   sessions skip straight past.
   ═══════════════════════════════════════════════════════════ */

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01#%$&/*+-<>';

function initMagnetic() {
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.32;
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        if (!tx && !ty) el.style.transform = '';
      }
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * strength;
      ty = (e.clientY - (r.top + r.height / 2)) * strength;
      kick();
    });

    el.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  });
}

function initTilt() {
  document.querySelectorAll('.tile--award, .tile--edu').forEach((el) => {
    const max = 4;   /* degrees */

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      el.classList.add('is-tilting');
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const ry = (px - 0.5) * 2 * max;
      const rx = (0.5 - py) * 2 * max;
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
    });

    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.transform = '';
    });
  });
}

function initSpotlight() {
  document.querySelectorAll('.tile--spot').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

function initScramble() {
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    const target = el.textContent;
    let raf = 0;
    let frame = 0;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      el.textContent = target;
    };

    const run = () => {
      frame++;
      const progress = frame / 14;                 /* ~14 frames per char wave */
      el.textContent = Array.from(target).map((ch, i) => {
        if (ch === ' ') return ch;
        if (i < progress * target.length) return ch;
        return GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join('');

      if (progress * target.length < target.length) raf = requestAnimationFrame(run);
      else stop();
    };

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || raf) return;
      frame = 0;
      raf = requestAnimationFrame(run);
    });
    el.addEventListener('pointerleave', stop);
  });
}

export function initInteractions({ reducedMotion = false } = {}) {
  if (reducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  initMagnetic();
  initTilt();
  initSpotlight();
  initScramble();
}
