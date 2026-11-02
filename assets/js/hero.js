/* ═══════════════════════════════════════════════════════════
   hero.js — the page chrome and the hero.

   The theme toggle, the bar (menu, current section, the ruler),
   the potential field and its readout, the compile intro, the
   entrances, the manifesto fill, the magnetic buttons, the ⌘K
   menu, the G grid, the footer wordmark, and the cursor. All of it
   is enhancement: with this file removed the page renders, reads
   and navigates.
   ═══════════════════════════════════════════════════════════ */

import { initCursor } from './cursor.js?v=10796e80';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const root = document.documentElement;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const onScroll = (fn) => {
  let ticking = false;
  const run = () => { ticking = false; fn(); };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', fn);
  fn();
};

/* ── theme ────────────────────────────────────────────────
   The saved choice was applied before first paint by the inline
   script in <head>; this only flips it and remembers. */
const toggleTheme = (() => {
  const btn = document.querySelector('[data-theme-toggle]');
  const meta = document.querySelector('meta[name="theme-color"]');
  const label = () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    btn?.setAttribute('aria-label', `Switch to ${next} theme`);
  };
  const flip = () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    meta?.setAttribute('content', next === 'light' ? '#F1F0EB' : '#0A0A0B');
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode: fine */ }
    label();
  };
  label();
  btn?.addEventListener('click', flip);
  return flip;
})();

/* ── the mobile menu ─────────────────────────────────────── */
(function initMenu() {
  const btn = document.querySelector('[data-menu]');
  const menu = document.getElementById('menu');
  if (!btn || !menu) return;

  const set = (open) => {
    if (open) menu.hidden = false;
    /* one frame so the sheet's fade has a start state */
    requestAnimationFrame(() => document.body.classList.toggle('nav-open', open));
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) setTimeout(() => { if (btn.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 400);
    else menu.querySelector('a')?.focus({ preventScroll: true });
  };

  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => set(false)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) set(false); });
})();

/* ── the ruler and the current section ───────────────────── */
(function initBar() {
  const ruler = document.querySelector('.ruler');
  const pct = document.querySelector('.ruler__pct');
  const links = Array.from(document.querySelectorAll('.nav__links a'));
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  onScroll(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    ruler?.style.setProperty('--p', p.toFixed(4));
    if (pct) pct.textContent = `${Math.round(p * 100)}%`;

    /* the section whose top has passed a line a third of the way down */
    const line = innerHeight * 0.33;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    for (const a of links) a.setAttribute('aria-current', String(!!current && a.getAttribute('href') === `#${current.id}`));
  });
})();

/* ── the potential field ─────────────────────────────────── */
(function initField() {
  const canvas = document.querySelector('[data-terrain]');
  const read = document.querySelector('[data-terrain-read]');
  if (!canvas) return;
  const idle = read ? read.textContent : '';
  const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');
  let shown = '';

  const onRead = (r) => {
    if (!read) return;
    const text = r.inside
      ? `FIELD · E ${pad(r.x)} · N ${pad(r.h - r.y)} · φ −${r.phi.toFixed(2)}${r.masses ? ` · ${r.masses} M` : ''}`
      : idle;
    if (text !== shown) { read.textContent = text; shown = text; }
  };

  const boot = () => {
    import('./terrain.js?v=10796e80')
      .then(({ initTerrain }) => initTerrain(canvas, { reducedMotion, onRead }))
      .catch(() => { /* the hero is the type on the sheet without it */ });
  };
  /* after first paint, but soon: the field is what the page opens on.
     A timer, not a frame: a background tab holds frames back, and the
     map should be ready the moment the tab is looked at */
  setTimeout(boot, 80);
})();

/* ── the sub line streams in, word by word ───────────────── */
(function initStream() {
  const el = document.querySelector('[data-stream]');
  if (!el || reducedMotion) return;
  const caret = el.querySelector('.caret');
  const words = el.firstChild.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', words.join(' '));
  el.textContent = '';
  words.forEach((w, n) => {
    const s = document.createElement('span');
    s.className = 'tok';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--n', n);
    s.textContent = n < words.length - 1 ? `${w} ` : w;
    el.appendChild(s);
  });
  if (caret) el.appendChild(caret);
})();

/* ── the compile intro ─────────────────────────────────────
   Once per session, the hero is shown as its own wireframe for a
   moment: every part boxed and labelled with its tag and size,
   then the boxes lift away. Pure overlay, so it costs the real
   content nothing. */
(function initCompile() {
  const hero = document.querySelector('[data-compile]');
  if (!hero || reducedMotion) return;
  try { if (sessionStorage.getItem('compiled')) return; sessionStorage.setItem('compiled', '1'); } catch (e) { return; }

  const run = () => {
    const base = hero.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'compile';
    layer.setAttribute('aria-hidden', 'true');
    hero.querySelectorAll('[data-c]').forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const box = document.createElement('i');
      box.className = 'compile__box';
      box.dataset.label = `${el.dataset.c} · ${Math.round(r.width)}×${Math.round(r.height)}`;
      Object.assign(box.style, {
        left: `${r.left - base.left}px`, top: `${r.top - base.top}px`,
        width: `${r.width}px`, height: `${r.height}px`,
        animationDelay: `${i * 90}ms`,
      });
      layer.appendChild(box);
      const rule = document.createElement('i');
      rule.className = 'compile__rule compile__rule--h';
      rule.style.top = `${r.top - base.top}px`;
      rule.style.animationDelay = `${i * 90}ms`;
      layer.appendChild(rule);
    });
    hero.appendChild(layer);
    setTimeout(() => layer.remove(), 2600);
  };
  if (document.fonts?.status === 'loaded') run();
  else (document.fonts?.ready || Promise.resolve()).then(run);
})();

/* ── entrances ─────────────────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
})();

/* ── the manifesto fills as it is read ─────────────────────
   Each line's ink runs left to right as the line crosses the
   middle band of the viewport. Under reduced motion the CSS
   default, fully inked, stands. */
(function initFill() {
  const lines = Array.from(document.querySelectorAll('[data-fill]'));
  if (!lines.length || reducedMotion) return;
  onScroll(() => {
    for (const el of lines) {
      const r = el.getBoundingClientRect();
      const start = innerHeight * 0.88, end = innerHeight * 0.42;
      const p = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
      el.style.setProperty('--fill', `${(p * 100).toFixed(1)}%`);
    }
  });
})();

/* ── magnetic buttons, on a fine pointer only ────────────── */
(function initMagnet() {
  if (reducedMotion || !finePointer) return;
  document.querySelectorAll('[data-magnet]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      /* capped: enough to feel alive, never enough to move the target
         out from under a click */
      const cx = Math.max(-8, Math.min(8, x * 0.3)), cy = Math.max(-8, Math.min(8, y * 0.3));
      el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

/* ── the grid, on G ──────────────────────────────────────── */
const toggleGrid = (() => {
  const lay = document.querySelector('.gridlay');
  const flip = () => lay?.classList.toggle('is-on');
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'g' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, [contenteditable]') || document.querySelector('dialog[open]')) return;
    flip();
  });
  return flip;
})();

/* ── the command menu ──────────────────────────────────────
   ⌘K / Ctrl K anywhere. Every command is something already on the
   page, so the menu is a shortcut, never the only way. */
(function initCmdk() {
  const dlg = document.getElementById('cmdk');
  const input = dlg?.querySelector('[data-cmdk-input]');
  const list = dlg?.querySelector('[data-cmdk-list]');
  if (!dlg || !input || !list || typeof dlg.showModal !== 'function') return;

  document.querySelectorAll('[data-cmdk-key]').forEach((k) => { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

  const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  const openProject = (slug) => () => document.querySelector(`[data-open="${slug}"]`)?.click();
  const href = (url, blank) => () => { if (blank) window.open(url, '_blank', 'noopener'); else location.href = url; };

  const COMMANDS = [
    { group: 'Go to', label: 'About', hint: '01', run: go('profile') },
    { group: 'Go to', label: 'Research', hint: '02', run: go('research') },
    { group: 'Go to', label: 'Method', hint: '03', run: go('method') },
    { group: 'Go to', label: 'Experience', hint: '04', run: go('work') },
    { group: 'Go to', label: 'Education', hint: '04.1', run: go('education') },
    { group: 'Go to', label: 'Recognition', hint: '05', run: go('awards') },
    { group: 'Go to', label: 'Contact', hint: '06', run: go('contact') },
    { group: 'Projects', label: 'Fault-tolerant control', hint: 'write-up', run: openProject('fault-tolerant-control') },
    { group: 'Projects', label: 'Oberth Efficiency Atlas', hint: 'write-up', run: openProject('oberth-efficiency-atlas') },
    { group: 'Actions', label: 'Copy email address', hint: 'aggarw.vyom@gmail.com', run: () => navigator.clipboard?.writeText('aggarw.vyom@gmail.com') },
    { group: 'Actions', label: 'Write an email', hint: 'mailto', run: href('mailto:aggarw.vyom@gmail.com') },
    { group: 'Actions', label: 'Toggle light / dark', hint: 'theme', run: toggleTheme },
    { group: 'Actions', label: 'Toggle the layout grid', hint: 'G', run: toggleGrid },
    { group: 'Elsewhere', label: 'GitHub', hint: '↗', run: href('https://github.com/vyom-aggarwal', true) },
    { group: 'Elsewhere', label: 'LinkedIn', hint: '↗', run: href('https://www.linkedin.com/in/vyom-aggarwal/', true) },
  ];

  let shown = [], sel = 0;

  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = COMMANDS.filter((c) => !q || `${c.group} ${c.label} ${c.hint}`.toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.innerHTML = '';
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'cmdk__empty';
      li.textContent = 'Nothing matches that.';
      list.appendChild(li);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let group = '';
    shown.forEach((c, i) => {
      if (c.group !== group) {
        group = c.group;
        const g = document.createElement('li');
        g.className = 'cmdk__group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.appendChild(g);
      }
      const li = document.createElement('li');
      li.className = 'cmdk__item';
      li.id = `cmdk-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === sel));
      li.innerHTML = '<span></span><span></span>';
      li.firstChild.textContent = c.label;
      li.lastChild.textContent = c.hint;
      li.addEventListener('pointermove', () => { if (sel !== i) { sel = i; mark(); } });
      li.addEventListener('click', () => exec(i));
      list.appendChild(li);
    });
    mark();
  };

  const mark = () => {
    list.querySelectorAll('.cmdk__item').forEach((li) => li.setAttribute('aria-selected', String(li.id === `cmdk-${sel}`)));
    input.setAttribute('aria-activedescendant', `cmdk-${sel}`);
    document.getElementById(`cmdk-${sel}`)?.scrollIntoView({ block: 'nearest' });
  };

  const open = () => {
    if (dlg.open || document.querySelector('dialog.proj[open]')) return;
    input.value = ''; sel = 0; render();
    dlg.showModal();
    input.focus();
  };
  const close = () => { if (dlg.open) dlg.close(); };
  const exec = (i) => {
    const c = shown[i];
    if (!c) return;
    close();
    /* after the dialog has let go of focus; a timer rather than a
       frame, which a background tab would hold back */
    setTimeout(() => c.run(), 30);
  };

  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(sel); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.querySelectorAll('[data-cmdk-open]').forEach((b) => b.addEventListener('click', open));
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? close() : open(); }
  });
})();

/* ── the footer wordmark, fitted to its column ───────────── */
(function initFit() {
  const el = document.querySelector('[data-fit]');
  const text = el?.firstElementChild;
  if (!text) return;
  /* measured on the inline text, which can be narrower than the box
     as well as wider; scrollWidth only ever reports the latter */
  const fit = () => {
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize);
    const room = el.clientWidth, need = text.getBoundingClientRect().width;
    if (room > 0 && need > 0) el.style.fontSize = `${Math.floor(base * (room / need) * 0.995 * 100) / 100}px`;
  };
  new ResizeObserver(fit).observe(el.parentElement);
  document.fonts?.ready.then(fit);
  fit();
})();

/* ── the cursor ──────────────────────────────────────────── */
initCursor();
