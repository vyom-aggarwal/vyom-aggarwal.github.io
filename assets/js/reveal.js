/* ═══════════════════════════════════════════════════════════
   reveal.js — scroll-triggered entrances.

   · splitText()   wraps words (and optionally characters) in
                   masked spans so headlines rise into view
   · initReveal()  observes [data-reveal] / [data-stagger] /
                   .split and plays each once
   ═══════════════════════════════════════════════════════════ */

const WORD_STEP = 55;   /* ms between words */
const CHAR_STEP = 26;   /* ms between characters */

/* Rebuilds a node tree, replacing text nodes with masked spans
   and leaving markup like <br> and <em> intact. */
function rebuild(node, chars, out) {
  const frag = document.createDocumentFragment();

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const parts = child.textContent.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }

        const word = document.createElement('span');
        word.className = 'word';

        if (chars) {
          for (const ch of Array.from(part)) {
            const c = document.createElement('span');
            c.className = 'char';
            c.textContent = ch;
            word.appendChild(c);
            out.push(c);
          }
        } else {
          const inner = document.createElement('span');
          inner.className = 'inner';
          inner.textContent = part;
          word.appendChild(inner);
          out.push(inner);
        }
        frag.appendChild(word);
      }
      return;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      if (child.tagName === 'BR') { frag.appendChild(child.cloneNode()); return; }
      const clone = child.cloneNode(false);
      clone.appendChild(rebuild(child, chars, out));
      frag.appendChild(clone);
      return;
    }
  });

  return frag;
}

export function splitText(el) {
  if (el.dataset.splitDone) return;
  const chars = el.dataset.split === 'chars';
  const pieces = [];
  const frag = rebuild(el, chars, pieces);

  el.textContent = '';
  el.appendChild(frag);
  el.classList.add('split');
  el.dataset.splitDone = '1';

  const step = chars ? CHAR_STEP : WORD_STEP;
  pieces.forEach((p, i) => { p.style.setProperty('--d', `${i * step}ms`); });
}

export function initReveal({ reducedMotion = false } = {}) {
  const splits = document.querySelectorAll('[data-split]');
  splits.forEach(splitText);

  if (reducedMotion) {
    document.querySelectorAll('[data-reveal], [data-stagger], .split')
      .forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;

      const delay = Number(el.dataset.revealDelay || 0);
      if (delay) el.style.setProperty('--d', `${delay}ms`);

      if (el.hasAttribute('data-stagger')) {
        Array.from(el.children).forEach((child, i) => {
          child.style.setProperty('--d', `${delay + i * 80}ms`);
        });
      }

      el.classList.add('is-in');
      io.unobserve(el);
    }
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  document.querySelectorAll('[data-reveal], [data-stagger], .split').forEach((el) => io.observe(el));
}
