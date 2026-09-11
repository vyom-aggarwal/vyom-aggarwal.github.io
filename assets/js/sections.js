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
