/* ═══════════════════════════════════════════════════════════
   flyby.js — the project-B stage: one flyby, one slider.

   The dialog's picture is not an animation of a result, it is the
   result being computed. Moving the slider changes the burn length
   Π and runs the Oberth atlas's own finite-burn simulator (the one
   vendored in oberth.js) for the whole flyby, then draws the path
   it returned. Everything else is held fixed.

   Fixed case, stated on the page next to the control:
     v∞ = 1.0 v_esc   Δv = 0.1 v_p   Δv/c = 0.3   prograde thrust,
     burn centred on periapsis, point-mass planet.
   An illustrative case, not a mission. Where the atlas gives
   missions it uses its own presets.

   What is read off the simulator, never computed here:
     η         the share of the impulsive Oberth bonus the burn keeps
     loss      the equivalent-Δv loss, as a share of Δv
   What is computed here is geometry only: the dashed conics are the
   unpowered arrival and the textbook impulsive departure.
   ═══════════════════════════════════════════════════════════ */

import { simulate, fromTargets } from './oberth.js?v=82eecee1';

const CASE = { vOverVesc: 1.0, dvOverVp: 0.1, dvOverC: 0.3 };

/* the slider runs 0–1000 over five decades of Π, 0.01 to 1000 */
const SPAN = 1000;
const LO = -2, HI = 3;
const piAt = (v) => 10 ** (LO + ((HI - LO) * v) / SPAN);
const valueAt = (pi) => Math.round(((Math.log10(pi) - LO) / (HI - LO)) * SPAN);

const LOOP_MS = 6200;       /* one pass of the craft */
const HOLD_MS = 900;        /* rests at the far end before it repeats */
const PLAY_MS = 9000;       /* the slider's own sweep, end to end */

/* ── the fixed geometry of the case ──────────────────────── */
const vInf = CASE.vOverVesc * Math.SQRT2;          /* v_esc = √2 at r_p = 1 */
const vPer = Math.sqrt(vInf * vInf + 2);
const dv = CASE.dvOverVp * vPer;
const arrival = { e: 1 + vInf * vInf, p: 2 + vInf * vInf };
const departure = { e: (vPer + dv) ** 2 - 1, p: (vPer + dv) ** 2 };   /* r_p = 1: p = h² */

/* ── formatting ──────────────────────────────────────────── */
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

const fmtPi = (p) => (p >= 100 ? p.toFixed(0) : p >= 10 ? p.toFixed(1) : p >= 1 ? p.toFixed(2) : p.toFixed(3));

function fmtPct(frac) {
  if (!Number.isFinite(frac)) return '–';
  const p = 100 * frac;
  if (p >= 10) return p.toFixed(1) + '%';
  if (p >= 1) return p.toFixed(2) + '%';
  if (p >= 0.01) return p.toPrecision(3) + '%';
  if (p <= 0) return '0%';
  const e = Math.floor(Math.log10(p));
  return `${(p / 10 ** e).toFixed(1)}×10${sup(e)}%`;
}

const fmtEta = (e) => (!Number.isFinite(e) ? '–' : e > 0.99 ? e.toFixed(4) : e.toFixed(3));

/* ── geometry helpers ────────────────────────────────────── */
/* cubic Hermite between two accepted steps, position only */
function hermite(a, b, t) {
  const h = b.t - a.t;
  if (!(h > 0)) return [a.x, a.y];
  const s = (t - a.t) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return [
    h00 * a.x + h10 * h * a.vx + h01 * b.x + h11 * h * b.vx,
    h00 * a.y + h10 * h * a.vy + h01 * b.y + h11 * h * b.vy,
  ];
}

/* The simulator returns one list of accepted integrator steps per
   segment (coast in, burn, coast out). Joined end to end, with the
   state each segment shares with the one before it counted once.
   `from` and `to` are the indices of the burn's first and last state. */
function trackOf(res) {
  const pts = [];
  let from = 0, to = 0;
  res.segments.forEach((seg, si) => {
    if (seg.burn) from = pts.length - 1;
    seg.t.forEach((t, i) => {
      if (si > 0 && i === 0) return;                   /* the previous segment ended here */
      const y = seg.y[i];
      pts.push({ t, x: y[0], y: y[1], vx: y[2], vy: y[3] });
    });
    if (seg.burn) to = pts.length - 1;
  });
  return { pts, from, to };
}

/* a conic r = p / (1 + e cos θ), periapsis on +x, between two angles */
function conic(c, from, to, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const th = from + ((to - from) * i) / n;
    const r = c.p / (1 + c.e * Math.cos(th));
    out.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  return out;
}

/* the angle at which a conic reaches radius R */
const angleAt = (c, R) => Math.acos(Math.min(1, Math.max(-1, (c.p / R - 1) / c.e)));

/* ═══ the stage ═══════════════════════════════════════════ */
export function initFlyby(canvas, root, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const $ = (sel) => root.querySelector(sel);

  const range = $('[data-fly-range]');
  const play = $('[data-fly-play]');
  const hud = $('.simhud');
  const el = {
    pi: $('[data-fly-pi]'),
    kept: $('[data-fly-kept]'),
    status: $('[data-fly-status]'),
    eta: $('[data-fly-eta]'),
    loss: $('[data-fly-loss]'),
  };

  const col = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const C = {
    limb: col('--limb', '#8FE0F5'),
    signal: col('--signal', '#4A9EE0'),
    ink: col('--ink', '#E8EBEE'),
    ink2: col('--ink-2', '#A3ACB6'),
    ink3: col('--ink-3', '#8C95A1'),
    hair2: col('--hair-2', 'rgba(255,255,255,.14)'),
  };

  let w = 0, h = 0, dpr = 1;
  let res = null, track = [], burnAt = { from: 0, to: 0 }, view = null, follow = [0, 1];
  let value = Number(range.value);
  let raf = 0, t0 = 0, running = false;
  let playRaf = 0;

  /* ── size ──────────────────────────────────────────────── */
  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.round(r.width); h = Math.round(r.height);
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (res) { layout(); }
  }

  /* The scale is set by the burn, not by the planet: the burn is the
     thing being shown, so it must fit. Sim x is toward periapsis and
     y along the flight; the picture puts periapsis above the planet
     and the flight left to right. */
  function layout() {
    const burn = res.segments.find((s) => s.burn);
    let yMax = 0, xMax = 1;
    for (const st of burn.y) { yMax = Math.max(yMax, Math.abs(st[1])); xMax = Math.max(xMax, st[0]); }
    const half = Math.max(yMax, 1.4);
    const up = xMax * 1.18;
    const cy = h * 0.80;
    /* on a phone the readout pill covers the top of the stage, so the
       periapsis has to stay below it */
    const top = w < 640 ? 70 : 14;
    const s = Math.max(0.5, Math.min((w * 0.46) / half, (cy - top) / up));
    view = { s, cx: w / 2, cy };

    /* The craft only needs to be followed while it is on screen. A
       small Π puts most of the integrated time far outside the frame,
       and a loop spent watching nothing reads as a stall. */
    const inside = (p) => {
      const [X, Y] = P(p.x, p.y);
      return X > -12 && X < w + 12 && Y > -12 && Y < h + 12;
    };
    let a = 0, b = track.length - 1;
    while (a < b && !inside(track[a])) a++;
    while (b > a && !inside(track[b])) b--;
    follow = a < b ? [track[a].t, track[b].t] : [track[0].t, track[track.length - 1].t];
  }

  const P = (x, y) => [view.cx + view.s * y, view.cy - view.s * x];

  /* ── solve ─────────────────────────────────────────────── */
  function solve() {
    const pi = piAt(value);
    res = simulate({
      ...fromTargets(pi, CASE.vOverVesc, CASE.dvOverVp, CASE.dvOverC),
      record: true,
    });
    ({ pts: track, from: burnAt.from, to: burnAt.to } = trackOf(res));
    if (w) layout();
    readout(pi);
  }

  function readout(pi) {
    const tone = res.loss_rel < 0.01 ? 'ok' : res.eta < 0.5 ? 'bad' : 'warn';
    const status = tone === 'ok' ? 'Near-impulsive' : tone === 'bad' ? 'Under half the bonus kept' : 'Finite-burn loss';
    const kept = Number.isFinite(res.eta) ? `${(100 * res.eta).toFixed(res.eta > 0.999 ? 3 : 1)}%` : '–';

    hud.dataset.tone = tone;
    el.status.textContent = status;
    el.eta.textContent = fmtEta(res.eta);
    el.loss.textContent = fmtPct(res.loss_rel);
    el.pi.textContent = fmtPi(pi);
    const loss = fmtPct(res.loss_rel);
    el.kept.textContent = `keeps ${kept} of the impulsive Oberth bonus · loss ${loss} of Δv`;
    range.setAttribute('aria-valuetext', `Π ${fmtPi(pi)}, keeps ${kept} of the impulsive Oberth bonus, loss ${loss} of Δv`);
  }

  /* ── draw ──────────────────────────────────────────────── */
  function path(points, close = false) {
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      const [X, Y] = P(x, y);
      if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    if (close) ctx.closePath();
  }

  /* each accepted step subdivided on its Hermite cubic, so a long
     coast step does not draw as a chord */
  function smooth(from, to) {
    const out = [];
    for (let i = from; i < to; i++) {
      const a = track[i], b = track[i + 1];
      const steps = 6;
      for (let k = 0; k < steps; k++) out.push(hermite(a, b, a.t + ((b.t - a.t) * k) / steps));
    }
    out.push([track[to].x, track[to].y]);
    return out;
  }

  function at(t) {
    let lo = 0, hi = track.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (track[m].t <= t) lo = m; else hi = m;
    }
    const a = track[lo], b = track[hi];
    const [x, y] = hermite(a, b, Math.min(Math.max(t, a.t), b.t));
    return { x, y, vx: a.vx, vy: a.vy, burn: t >= track[burnAt.from].t && t <= track[burnAt.to].t };
  }

  function draw(tm) {
    if (!w || !res || !view) return;
    ctx.clearRect(0, 0, w, h);
    const { s, cx, cy } = view;
    const far = (1.8 * Math.hypot(w, h)) / s + 4;

    /* the planet's pull, as light rather than as a disc */
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(40, s * 1.5));
    g.addColorStop(0, 'rgba(143,224,245,.16)');
    g.addColorStop(1, 'rgba(143,224,245,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    /* periapsis radius, only while it is big enough to mean something */
    if (s > 26) {
      ctx.save();
      ctx.strokeStyle = C.hair2; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, s, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s); ctx.stroke();
      ctx.fillStyle = C.ink3;
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText('r_p', cx + 7, cy - s * 0.5);
      ctx.restore();
    }

    /* the two dashed conics: what arrives, and the textbook departure */
    ctx.save();
    ctx.strokeStyle = C.ink3; ctx.globalAlpha = 0.75; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
    path(conic(arrival, -angleAt(arrival, far), 0, 240)); ctx.stroke();
    path(conic(departure, 0, angleAt(departure, far), 240)); ctx.stroke();
    ctx.restore();

    /* the flown path: coast in, burn, coast out */
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const { from: first, to: last } = burnAt;
    ctx.strokeStyle = C.signal; ctx.lineWidth = 2;
    path(smooth(0, first)); ctx.stroke();
    path(smooth(last, track.length - 1)); ctx.stroke();

    const burnPts = smooth(first, last);
    ctx.strokeStyle = 'rgba(143,224,245,.22)'; ctx.lineWidth = 11;
    path(burnPts); ctx.stroke();
    ctx.strokeStyle = C.limb; ctx.lineWidth = 4;
    path(burnPts); ctx.stroke();

    /* a burn only a few pixels long still has to be findable */
    const b0 = P(track[first].x, track[first].y), b1 = P(track[last].x, track[last].y);
    if (Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) < 10) {
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc((b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, 9, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();

    /* the planet */
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI); ctx.fill();

    /* the craft, with the exhaust pointing back along the path while
       the engine is on */
    if (tm !== null) {
      const m = at(tm);
      const [X, Y] = P(m.x, m.y);
      const dx = m.vy, dy = -m.vx, len = Math.hypot(dx, dy) || 1;
      ctx.save();
      if (m.burn) {
        ctx.strokeStyle = C.limb; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(X - (dx / len) * 5, Y - (dy / len) * 5);
        ctx.lineTo(X - (dx / len) * 21, Y - (dy / len) * 21);
        ctx.stroke();
      }
      const halo = ctx.createRadialGradient(X, Y, 0, X, Y, 14);
      halo.addColorStop(0, m.burn ? 'rgba(143,224,245,.55)' : 'rgba(232,235,238,.35)');
      halo.addColorStop(1, 'rgba(143,224,245,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(X, Y, 14, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = m.burn ? C.limb : C.ink;
      ctx.beginPath(); ctx.arc(X, Y, 3.6, 0, 2 * Math.PI); ctx.fill();
      ctx.restore();
    }
  }

  /* ── the loop ──────────────────────────────────────────── */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const ph = (now - t0) % (LOOP_MS + HOLD_MS);
    const u = Math.min(ph / LOOP_MS, 1);
    const eased = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) ** 2;       /* slow at both ends */
    draw(follow[0] + (follow[1] - follow[0]) * eased);
  }

  /* ── the control ───────────────────────────────────────── */
  function setValue(v, { moveThumb = true } = {}) {
    value = Math.min(Math.max(v, 0), SPAN);
    if (moveThumb) range.value = String(Math.round(value));
    solve();
    if (!running) draw(null);
  }

  const setPlaying = (on) => {
    if (on) play.setAttribute('data-playing', ''); else play.removeAttribute('data-playing');
    play.setAttribute('aria-label', on ? 'Pause the sweep' : 'Play the sweep');
  };

  function stopPlay() {
    if (!playRaf) return;
    cancelAnimationFrame(playRaf);
    playRaf = 0;
    setPlaying(false);
  }

  /* The sweep drives the same value a drag does, on wall-clock time so
     its speed does not depend on the frame rate. Pressing play at the
     end starts over. */
  function startPlay() {
    const from = value >= SPAN - 1 ? 0 : value;
    const began = performance.now();
    setPlaying(true);
    const step = (now) => {
      const v = Math.min(from + ((now - began) / PLAY_MS) * SPAN, SPAN);
      setValue(v);
      if (v >= SPAN) { stopPlay(); return; }
      playRaf = requestAnimationFrame(step);
    };
    playRaf = requestAnimationFrame(step);
  }

  play.addEventListener('click', () => (playRaf ? stopPlay() : startPlay()));
  range.addEventListener('input', () => { stopPlay(); setValue(Number(range.value), { moveThumb: false }); });

  /* A 1000-unit track would make the arrow keys crawl, so they move a
     tenth of a decade, and Page keys a whole one. */
  range.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 20, ArrowUp: 20, ArrowLeft: -20, ArrowDown: -20, PageUp: 200, PageDown: -200 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    stopPlay();
    setValue(value + step);
  });

  root.querySelectorAll('[data-fly-go]').forEach((b) => {
    b.addEventListener('click', () => { stopPlay(); setValue(valueAt(Number(b.dataset.flyGo))); });
  });

  const ro = new ResizeObserver(() => { resize(); if (!running) draw(null); });
  ro.observe(canvas);

  /* ── lifecycle ─────────────────────────────────────────── */
  resize();
  solve();
  draw(null);

  const api = {
    start() {
      if (running || reducedMotion) return;
      running = true;
      resize();
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      stopPlay();
    },
    /* the same call the explorer test makes: what the simulator
       returned for the slider's present position */
    get result() { return res; },
  };
  return api;
}
