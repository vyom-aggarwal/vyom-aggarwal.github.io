/* ═══════════════════════════════════════════════════════════
   oberth.js — the finite-burn flyby simulator.

   Vendored, not rewritten. This is `explorer/sim.js` from
   github.com/vyom-aggarwal/oberth-efficiency-atlas, commit
   976b4d8 (blob 3f34f7f), with the UMD wrapper replaced by
   ES-module exports. Between the first `const` and the exports the
   body is the original, line for line.

   In that repository it is checked against the Python simulator
   (`tests/test_explorer_js.py`, 10 cases, |Δη| ≤ 1e-8). Change it
   there and re-vendor it; do not edit it here.

   Original header:

   Oberth flyby simulator in JavaScript: a port of
   oberth_atlas.simulate.simulate_nd (planar case).
   Nondimensional units: μ = r_p = 1, V = sqrt(μ/r_p), time
   sqrt(r_p³/μ), mass m0 = 1. Hyperbolic arrival with excess speed
   v_inf; one constant-thrust burn centred at `offset` from the
   unperturbed periapsis passage; prograde or inertial steering.
   Integrator: Dormand–Prince 5(4), adaptive.
   ═══════════════════════════════════════════════════════════ */

const R_FLOOR = 1e-3;
const PRE_COAST_TAU = 5.0;
const POST_COAST_TAU = 5.0;

// Dormand–Prince 5(4) tableau.
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const E = [71 / 57600, 0, -71 / 16695, 71 / 1920, -17253 / 339200, 22 / 525, -1 / 40];

function coastRhs(t, y, out) {
  const r2 = y[0] * y[0] + y[1] * y[1];
  const k = -1 / (r2 * Math.sqrt(r2));
  out[0] = y[2]; out[1] = y[3]; out[2] = k * y[0]; out[3] = k * y[1]; out[4] = 0;
}

function burnRhs(a0, c, steering, vp) {
  return function (t, y, out) {
    coastRhs(t, y, out);
    const am = a0 / y[4];
    let ux, uy;
    if (steering === "inertial") { ux = 0; uy = 1; }          // periapsis velocity direction
    else { const v = Math.hypot(y[2], y[3]); ux = y[2] / v; uy = y[3] / v; }
    out[2] += am * ux; out[3] += am * uy; out[4] = -a0 / c;
  };
}

/* Adaptive DP5(4) from t0 to t1 (either direction). Stops early if |r| < rImpact (located by
 * bisection on the cubic Hermite interpolant). Records accepted states when `record` is true. */
function integrate(f, t0, t1, y0, opt) {
  const rtol = opt.rtol, atol = opt.atol, n = y0.length;
  const dir = t1 >= t0 ? 1 : -1;
  const k = Array.from({ length: 7 }, () => new Float64Array(n));
  const ytmp = new Float64Array(n), ynew = new Float64Array(n);
  let y = Float64Array.from(y0), t = t0;
  const ts = [t], ys = [Array.from(y)], fs = [];
  f(t, y, k[0]);
  if (opt.record) fs.push(Array.from(k[0]));
  // Initial step (Hairer–Wanner heuristic).
  let d0 = 0, d1 = 0;
  for (let i = 0; i < n; i++) {
    const sc = atol + rtol * Math.abs(y[i]);
    d0 += (y[i] / sc) ** 2; d1 += (k[0][i] / sc) ** 2;
  }
  d0 = Math.sqrt(d0 / n); d1 = Math.sqrt(d1 / n);
  let h = d0 < 1e-5 || d1 < 1e-5 ? 1e-6 : 0.01 * d0 / d1;
  h = Math.min(h, Math.abs(t1 - t0));
  let impacted = false, steps = 0;
  while (dir * (t1 - t) > 0) {
    if (++steps > opt.maxSteps) throw new Error("too many steps");
    if (h > Math.abs(t1 - t)) h = Math.abs(t1 - t);
    const hs = dir * h;
    for (let s = 1; s < 7; s++) {
      for (let i = 0; i < n; i++) {
        let acc = y[i];
        for (let j = 0; j < s; j++) acc += hs * A[s][j] * k[j][i];
        ytmp[i] = acc;
      }
      f(t + C[s] * hs, ytmp, k[s]);
      if (s === 6) ynew.set(ytmp);
    }
    let err = 0;
    for (let i = 0; i < n; i++) {
      let e = 0;
      for (let j = 0; j < 7; j++) e += E[j] * k[j][i];
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(ynew[i]));
      err += (hs * e / sc) ** 2;
    }
    err = Math.sqrt(err / n);
    if (err <= 1) {
      const tn = t + hs;
      if (opt.rImpact > 0 && Math.hypot(ynew[0], ynew[1]) < opt.rImpact) {
        const yi = locateImpact(t, y, k[0], tn, ynew, k[6], opt.rImpact);
        t = yi.t; y = Float64Array.from(yi.y); impacted = true;
        ts.push(t); ys.push(Array.from(y)); fs.push(Array.from(k[6]));
        break;
      }
      t = tn; y = Float64Array.from(ynew);
      k[0].set(k[6]);                                   // FSAL
      if (opt.record) { ts.push(t); ys.push(Array.from(y)); fs.push(Array.from(k[0])); }
      h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(err, 1e-16), -0.2)));
    } else {
      h *= Math.max(0.2, 0.9 * Math.pow(err, -0.25));
    }
  }
  if (!opt.record) { ts.push(t); ys.push(Array.from(y)); }
  return { t: ts, y: ys, f: fs, yEnd: Array.from(y), tEnd: t, impacted };
}

// Cubic Hermite interpolation of position over a step (positions with velocities as derivatives).
function hermite(t0, y0, t1, y1, t) {
  const h = t1 - t0, s = (t - t0) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return [h00 * y0[0] + h10 * h * y0[2] + h01 * y1[0] + h11 * h * y1[2],
          h00 * y0[1] + h10 * h * y0[3] + h01 * y1[1] + h11 * h * y1[3]];
}

function locateImpact(t0, y0, f0, t1, y1, f1, rImp) {
  let a = t0, b = t1;
  for (let it = 0; it < 100; it++) {
    const m = 0.5 * (a + b), p = hermite(t0, y0, t1, y1, m);
    if (Math.hypot(p[0], p[1]) > rImp) a = m; else b = m;
  }
  const p = hermite(t0, y0, t1, y1, b);
  const w = (b - t0) / (t1 - t0);
  const out = Array.from(y1);
  out[0] = p[0]; out[1] = p[1];
  for (let i = 2; i < y1.length; i++) out[i] = y0[i] + w * (y1[i] - y0[i]);
  return { t: b, y: out };
}

// Minimum radius along recorded steps: endpoints, plus Hermite-refined minima where r·v turns positive.
function minRadiusOnSteps(seg) {
  let rmin = Infinity;
  for (let i = 0; i < seg.t.length; i++) rmin = Math.min(rmin, Math.hypot(seg.y[i][0], seg.y[i][1]));
  for (let i = 0; i + 1 < seg.t.length; i++) {
    const a = seg.y[i], b = seg.y[i + 1];
    if (a[0] * a[2] + a[1] * a[3] < 0 && b[0] * b[2] + b[1] * b[3] >= 0) {
      let lo = seg.t[i], hi = seg.t[i + 1];
      const g = (t) => { const p = hermite(seg.t[i], a, seg.t[i + 1], b, t); return p[0] * p[0] + p[1] * p[1]; };
      for (let it = 0; it < 120; it++) {                 // golden-section search
        const m1 = hi - 0.618033988749895 * (hi - lo), m2 = lo + 0.618033988749895 * (hi - lo);
        if (g(m1) < g(m2)) hi = m2; else lo = m1;
      }
      rmin = Math.min(rmin, Math.sqrt(g(0.5 * (lo + hi))));
    }
  }
  return rmin;
}

// Osculating periapsis radius of the coast conic from state y (μ = 1, planar).
function conicPeriapsis(y) {
  const r = Math.hypot(y[0], y[1]), v2 = y[2] * y[2] + y[3] * y[3];
  const h = y[0] * y[3] - y[1] * y[2];
  const rv = y[0] * y[2] + y[1] * y[3];
  const ex = (v2 - 1 / r) * y[0] - rv * y[2], ey = (v2 - 1 / r) * y[1] - rv * y[3];
  const e = Math.hypot(ex, ey);
  return (h * h) / (1 + e);
}

function coastMinRadius(yStart, yEnd) {
  // r is monotonic between apsides: if the coast passes a periapsis (r·v from < 0 to > 0), it is the conic's.
  const rvS = yStart[0] * yStart[2] + yStart[1] * yStart[3], rvE = yEnd[0] * yEnd[2] + yEnd[1] * yEnd[3];
  const ends = Math.min(Math.hypot(yStart[0], yStart[1]), Math.hypot(yEnd[0], yEnd[1]));
  return rvS < 0 && rvE >= 0 ? conicPeriapsis(yStart) : ends;
}

/* simulate({v_inf, dv, c, a0, steering, offset, impactRadius, rtol, atol, record})
 * Returns η, the equivalent-Δv loss, r_min and (optionally) the trajectory. */
function simulate(p) {
  const vInf = p.v_inf, dv = p.dv, c = p.c, a0 = p.a0;
  const steering = p.steering || "prograde";
  const opt = { rtol: p.rtol || 1e-12, atol: p.atol || 1e-12, maxSteps: p.maxSteps || 5e6, record: true,
                rImpact: p.impactRadius === undefined ? R_FLOOR : p.impactRadius };
  const vp = Math.sqrt(vInf * vInf + 2), tau = 1 / vp;
  const tb = (c / a0) * -Math.expm1(-dv / c);
  const ts = (p.offset || 0) - 0.5 * tb, te = ts + tb;
  const t0 = Math.min(ts, 0) - PRE_COAST_TAU * tau;
  const back = integrate(coastRhs, 0, t0, [1, 0, 0, vp, 1], { ...opt, record: false, rImpact: 0 });
  const y0 = back.yEnd; y0[4] = 1;
  const pre = integrate(coastRhs, t0, ts, y0, opt);
  const out = { Pi: tb * vp, t_b: tb, v_p: vp, impacted: false, segments: [] };
  out.segments.push({ label: "pre", burn: false, t: pre.t, y: pre.y });
  let rmin = coastMinRadius(pre.y[0], pre.yEnd);
  if (pre.impacted) return finish(out, p, NaN, opt.rImpact, true);
  const burn = integrate(burnRhs(a0, c, steering, vp), ts, te, pre.yEnd, opt);
  out.segments.push({ label: "burn", burn: true, t: burn.t, y: burn.y });
  rmin = Math.min(rmin, minRadiusOnSteps(burn));
  if (burn.impacted) return finish(out, p, NaN, opt.rImpact, true);
  const yb = burn.yEnd;
  const eps = 0.5 * (yb[2] * yb[2] + yb[3] * yb[3]) - 1 / Math.hypot(yb[0], yb[1]);
  const tf = Math.max(te, 0) + POST_COAST_TAU * tau;
  const post = integrate(coastRhs, te, tf, yb, opt);
  out.segments.push({ label: "post", burn: false, t: post.t, y: post.y });
  // A periapsis still ahead after the window is the conic's (exact); otherwise the coast endpoints.
  const rvB = yb[0] * yb[2] + yb[1] * yb[3];
  rmin = Math.min(rmin, rvB < 0 ? conicPeriapsis(yb) : coastMinRadius(yb, post.yEnd));
  if (post.impacted) return finish(out, p, eps, opt.rImpact, true);
  return finish(out, p, eps, rmin, false);
}

function finish(out, p, eps, rmin, impacted) {
  const vInf = p.v_inf, dv = p.dv, vp = out.v_p;
  out.impacted = impacted;
  out.r_min = rmin;
  out.eps_out = eps;
  out.captured = !impacted && !(eps > 0);
  out.v_inf_out = eps > 0 ? Math.sqrt(2 * eps) : NaN;
  const vImp = Math.sqrt((vp + dv) ** 2 - 2);
  const bImp = vImp - vInf - dv, bFin = out.v_inf_out - vInf - dv;
  out.v_inf_imp = vImp;
  out.b_imp = bImp;
  out.eta = bImp > 1e-6 * dv && Number.isFinite(bFin) ? bFin / bImp : NaN;
  out.dv_eq = Number.isFinite(eps) ? Math.sqrt(2 * (eps + 1)) - vp : NaN;
  out.loss_rel = Number.isFinite(out.dv_eq) ? 1 - out.dv_eq / dv : NaN;
  if (!p.record) delete out.segments;
  return out;
}

/* Map the dimensionless targets (Π, v∞/v_esc, Δv/v_p, Δv/c) to the simulator inputs. */
function fromTargets(Pi, vOverVesc, dvOverVp, dvOverC) {
  const v = vOverVesc * Math.SQRT2, vp = Math.sqrt(v * v + 2);
  const dv = dvOverVp * vp, c = dv / dvOverC, tb = Pi / vp;
  return { v_inf: v, dv: dv, c: c, a0: (c / tb) * -Math.expm1(-dvOverC) };
}

export { simulate, fromTargets, integrate, R_FLOOR };
