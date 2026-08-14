/* ═══════════════════════════════════════════════════════════
   research-gl.js — the quadruped rig behind the research
   scrollytelling stage.

   A procedurally animated four-legged armature drawn as glowing
   joints and wireframe limbs, in the same visual language as the
   hero object. Scroll drives the actual experiment timeline:

     healthy trot  →  fault injected  →  compensating gait

   The fault freezes one leg (joint_lock) and the body lists
   toward that corner; "recovery" levels the body and lengthens
   the other three strides, but the locked leg stays locked —
   the residual corrects *around* the fault, it does not repair
   it. That is the actual claim of the project.

   Raw WebGL2, no libraries.
   ═══════════════════════════════════════════════════════════ */

/* ── mat4 ────────────────────────────────────────────────── */

function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) / (near - far); out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function lookAt(out, ex, ey, ez, tx, ty, tz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  /* x = normalize(cross(up, z)), with up fixed at (0,1,0) */
  let xx = zz, xy = 0, xz = -zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

/* ── shaders ─────────────────────────────────────────────── */

const VERT = `#version 300 es
precision highp float;
in vec3 aPos;
in float aTint;
uniform mat4 uProj;
uniform mat4 uMV;
uniform vec3 uOffset;
uniform float uSize;
uniform float uDpr;
out float vTint;
out float vFog;
void main(){
  vec4 mv = uMV * vec4(aPos + uOffset, 1.0);
  gl_Position = uProj * mv;
  float dist = max(-mv.z, 0.001);
  vFog  = clamp((dist - 1.1) / 3.4, 0.0, 1.0);
  vTint = aTint;
  gl_PointSize = max(1.0, uSize * uDpr / dist);
}`;

const FRAG_POINT = `#version 300 es
precision highp float;
in float vTint;
in float vFog;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
out vec4 frag;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.015, d) * uOpacity * (1.0 - vFog * 0.92);
  vec3 col = mix(uColorA, uColorB, vTint);
  frag = vec4(col * a, a);
}`;

const FRAG_LINE = `#version 300 es
precision highp float;
in float vTint;
in float vFog;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
out vec4 frag;
void main(){
  float a = uOpacity * (1.0 - vFog);
  vec3 col = mix(uColorA, uColorB, vTint);
  frag = vec4(col * a, a);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[research-gl] shader:', gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

function program(gl, vs, fragSrc) {
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[research-gl] link:', gl.getProgramInfoLog(p));
    return null;
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function hexToRgb(hex, fallback) {
  const m = /^#?([\da-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [((v >> 16 & 255) / 255) ** 2.2, ((v >> 8 & 255) / 255) ** 2.2, ((v & 255) / 255) ** 2.2];
}

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/* ── rig definition ──────────────────────────────────────── */

const BODY_L = 0.30, BODY_H = 0.070, BODY_W = 0.13;
const THIGH = 0.21, SHANK = 0.21;
/* Body-centre height. Hips sit BODY_H below it, so the hip-to-ground
   reach is ~0.35 against a 0.42 leg — bent, but not folded double. */
const STAND = 0.42;
const STRIDE = 0.17;
const LIFT = 0.095;

/* front-left, front-right, back-left, back-right */
const HIPS = [
  [BODY_L, -BODY_H, BODY_W],
  [BODY_L, -BODY_H, -BODY_W],
  [-BODY_L, -BODY_H, BODY_W],
  [-BODY_L, -BODY_H, -BODY_W],
];
/* trot: diagonal pairs move together */
const PHASE = [0, 0.5, 0.5, 0];
/* front legs bend like elbows, rear legs like knees */
const BEND = [-1, -1, 1, 1];
const FAULT_LEG = 0;         /* front-left seizes */

/* 12 edges of the body box, as index pairs into the 8 corners */
const BOX_EDGES = [
  0, 1, 1, 3, 3, 2, 2, 0,
  4, 5, 5, 7, 7, 6, 6, 4,
  0, 4, 1, 5, 2, 6, 3, 7,
];

export function initResearchRig(canvas, { reducedMotion = false } = {}) {
  if (!canvas) return null;

  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: true, depth: false, powerPreference: 'high-performance',
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  if (!vs) return null;
  const pointProg = program(gl, vs, FRAG_POINT);
  const lineProg = program(gl, vs, FRAG_LINE);
  gl.deleteShader(vs);
  if (!pointProg || !lineProg) return null;

  /* ── buffers ───────────────────────────────────────────── */
  const JOINTS = 8 + 4 * 3;                       /* box corners + hip/knee/foot */
  const RIG_LINE_VERTS = 24 + 4 * 4;              /* box edges + 2 segments/leg  */

  const jointData = new Float32Array(JOINTS * 4);      /* xyz + tint */
  const lineData = new Float32Array(RIG_LINE_VERTS * 4);

  /* ground grid: rungs across the direction of travel, plus two rails */
  const GRID_N = 22, GRID_STEP = 0.24, RAIL_Z = 0.78;
  const gridVerts = [];
  for (let i = 0; i < GRID_N; i++) {
    const x = -2.0 + i * GRID_STEP;
    gridVerts.push(x, 0, -RAIL_Z, 0, x, 0, RAIL_Z, 0);
  }
  for (const z of [-RAIL_Z, RAIL_Z]) {
    gridVerts.push(-2.0, 0, z, 0, -2.0 + GRID_N * GRID_STEP, 0, z, 0);
  }
  const gridData = new Float32Array(gridVerts);

  function makeVao(prog, data, usage) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    const aPos = gl.getAttribLocation(prog.p, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 16, 0);
    const aTint = gl.getAttribLocation(prog.p, 'aTint');
    gl.enableVertexAttribArray(aTint);
    gl.vertexAttribPointer(aTint, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
    return { vao, buf };
  }

  const joints = makeVao(pointProg, jointData, gl.DYNAMIC_DRAW);
  const lines = makeVao(lineProg, lineData, gl.DYNAMIC_DRAW);
  const grid = makeVao(lineProg, gridData, gl.STATIC_DRAW);

  /* ── theme ─────────────────────────────────────────────── */
  const theme = { a: [0, 0, 0], b: [0, 0, 0], opacity: 1 };
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    theme.a = hexToRgb(cs.getPropertyValue('--accent-2'), [0.08, 0.19, 1]);
    theme.b = hexToRgb(cs.getPropertyValue('--accent'), [1, 0.1, 0.02]);
    const dark = document.documentElement.dataset.theme !== 'light';
    theme.opacity = dark ? 0.95 : 0.7;
    gl.blendFunc(gl.ONE, dark ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.enable(gl.BLEND);
  readTheme();
  document.addEventListener('themechange', readTheme);

  /* ── camera ────────────────────────────────────────────── */
  const proj = new Float32Array(16);
  const mv = new Float32Array(16);
  let dpr = 1, w = 1, h = 1;

  const FOV = 0.82, DIST = 1.78;
  /* screen-space nudge, applied in eye space after the look-at */
  let camOffX = 0, camOffY = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(r.width); h = Math.round(r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const aspect = w / h;
    perspective(proj, FOV, aspect, 0.05, 14);

    const halfH = Math.tan(FOV / 2) * DIST;
    const halfW = halfH * aspect;
    /* wide: beats hold the left, so the rig sits right of centre.
       narrow: beats sit at the bottom, so it lifts instead. */
    if (w > 900) { camOffX = 0.20 * 2 * halfW; camOffY = 0; }
    else { camOffX = 0; camOffY = 0.22 * 2 * halfH; }
  }

  /* ── state driven by scroll ────────────────────────────── */
  const state = { progress: 0, fault: 0, recovery: 0, speed: 1 };
  let gaitPhase = 0;
  let gridShift = 0;
  let lockedPhase = 0;
  let lockedCaptured = false;
  let time = 0;

  function setProgress(p) {
    state.progress = Math.min(Math.max(p, 0), 1);
    state.fault = smoothstep(0.34, 0.52, state.progress);
    state.recovery = smoothstep(0.56, 0.76, state.progress);
    /* Derived here rather than as a side effect of drawing, so the
       telemetry readout can never disagree with the scroll position. */
    state.speed = 1 - 0.55 * state.fault * (1 - 0.6 * state.recovery);
  }

  /* ── per-frame rig solve ───────────────────────────────── */
  function solve() {
    const { fault, recovery } = state;

    /* body attitude: lists toward the dead corner, then levels out */
    const listing = fault * (1 - 0.85 * recovery);
    const roll = 0.30 * listing;
    const pitch = 0.10 * listing;
    const drop = 0.055 * listing;
    const bob = 0.011 * Math.sin(gaitPhase * Math.PI * 4);
    const bodyY = STAND + bob - drop;

    const cr = Math.cos(roll), sr = Math.sin(roll);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);

    /* rotate a body-frame point by pitch (about z) then roll (about x) */
    const xf = (px, py, pz) => {
      const x1 = px * cp - py * sp;
      const y1 = px * sp + py * cp;
      const y2 = y1 * cr - pz * sr;
      const z2 = y1 * sr + pz * cr;
      return [x1, y2 + bodyY, z2];
    };

    /* 8 body corners */
    let j = 0;
    const corners = [];
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        for (const sz of [1, -1]) {
          const p = xf(sx * BODY_L, sy * BODY_H, sz * BODY_W);
          corners.push(p);
          jointData[j++] = p[0]; jointData[j++] = p[1]; jointData[j++] = p[2];
          jointData[j++] = 0.15;
        }
      }
    }

    /* legs */
    const legPts = [];
    for (let i = 0; i < 4; i++) {
      const isFaulted = i === FAULT_LEG && fault > 0.5;
      let p = (gaitPhase + PHASE[i]) % 1;
      if (isFaulted) p = lockedPhase;

      /* the three sound legs lengthen their stride to carry the load */
      const amp = STRIDE * (1 + (i === FAULT_LEG ? 0 : 0.38 * recovery));
      /* pre-recovery scramble */
      const jitter = fault * (1 - recovery) * 0.045 * Math.sin(time * 11 + i * 2.3);

      let fx, lift;
      if (p < 0.5) { const t = p / 0.5; fx = amp * (0.5 - t); lift = 0; }
      else { const t = (p - 0.5) / 0.5; fx = amp * (-0.5 + t); lift = LIFT * Math.sin(Math.PI * t); }
      if (isFaulted) lift = 0;
      fx += jitter;

      const hip = xf(HIPS[i][0], HIPS[i][1], HIPS[i][2]);
      const reach = hip[1] - lift;                    /* vertical drop to the foot */
      const d = Math.min(Math.hypot(fx, reach), THIGH + SHANK - 0.004);
      const phi = Math.atan2(fx, reach);
      let c = (THIGH * THIGH + d * d - SHANK * SHANK) / (2 * THIGH * Math.max(d, 1e-4));
      c = Math.min(Math.max(c, -1), 1);
      const psi = Math.acos(c);
      const ka = phi + BEND[i] * psi;

      const knee = [hip[0] + THIGH * Math.sin(ka), hip[1] - THIGH * Math.cos(ka), hip[2]];
      const foot = [hip[0] + fx, hip[1] - reach, hip[2]];

      const tint = i === FAULT_LEG ? Math.max(0.34, fault) : 0.34;
      for (const pt of [hip, knee, foot]) {
        jointData[j++] = pt[0]; jointData[j++] = pt[1]; jointData[j++] = pt[2];
        jointData[j++] = tint;
      }
      legPts.push({ hip, knee, foot, tint });
    }

    /* line list: body box then leg segments */
    let k = 0;
    const push = (p, t) => {
      lineData[k++] = p[0]; lineData[k++] = p[1]; lineData[k++] = p[2]; lineData[k++] = t;
    };
    for (let e = 0; e < BOX_EDGES.length; e += 2) {
      push(corners[BOX_EDGES[e]], 0.12);
      push(corners[BOX_EDGES[e + 1]], 0.12);
    }
    for (const L of legPts) {
      push(L.hip, L.tint); push(L.knee, L.tint);
      push(L.knee, L.tint); push(L.foot, L.tint);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, joints.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, jointData);
    gl.bindBuffer(gl.ARRAY_BUFFER, lines.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData);
  }

  function draw(prog, target, mode, count, { size = 1, opacity = 1, offset = [0, 0, 0] }) {
    gl.useProgram(prog.p);
    gl.bindVertexArray(target.vao);
    if (prog.u.uProj) gl.uniformMatrix4fv(prog.u.uProj, false, proj);
    if (prog.u.uMV) gl.uniformMatrix4fv(prog.u.uMV, false, mv);
    if (prog.u.uOffset) gl.uniform3fv(prog.u.uOffset, offset);
    if (prog.u.uSize) gl.uniform1f(prog.u.uSize, size);
    if (prog.u.uDpr) gl.uniform1f(prog.u.uDpr, dpr);
    if (prog.u.uOpacity) gl.uniform1f(prog.u.uOpacity, opacity);
    if (prog.u.uColorA) gl.uniform3fv(prog.u.uColorA, theme.a);
    if (prog.u.uColorB) gl.uniform3fv(prog.u.uColorB, theme.b);
    gl.drawArrays(mode, 0, count);
  }

  function render() {
    /* slow orbit across the whole scroll */
    const yaw = -0.62 + state.progress * 1.05;
    const eyeY = 0.74 - state.progress * 0.18;
    lookAt(mv,
      Math.sin(yaw) * DIST, eyeY, Math.cos(yaw) * DIST,
      0, 0.30, 0);
    mv[12] += camOffX;
    mv[13] += camOffY;

    solve();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    draw(lineProg, grid, gl.LINES, gridData.length / 4,
      { opacity: theme.opacity * 0.16, offset: [gridShift, 0, 0] });
    draw(lineProg, lines, gl.LINES, RIG_LINE_VERTS,
      { opacity: theme.opacity * 0.64 });
    draw(pointProg, joints, gl.POINTS, JOINTS,
      { size: 13, opacity: theme.opacity });
  }

  /* ── loop ──────────────────────────────────────────────── */
  let raf = 0, last = 0, visible = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;

    gaitPhase = (gaitPhase + dt * 1.15 * state.speed) % 1;
    gridShift = (gridShift - dt * 0.55 * state.speed) % GRID_STEP;

    /* remember where the leg was when it seized */
    if (state.fault > 0.5 && !lockedCaptured) {
      lockedPhase = (gaitPhase + PHASE[FAULT_LEG]) % 1;
      lockedCaptured = true;
    } else if (state.fault <= 0.5) {
      lockedCaptured = false;
    }

    render();
  }

  const start = () => {
    if (raf || reducedMotion) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  /* The loop used to be started *only* by an IntersectionObserver, which
     made a single bad reading fatal: once stopped, nothing restarted it
     until the next threshold crossing, so the gait froze for as long as
     you sat there reading. Geometry is the source of truth instead, and
     every plausible trigger re-checks it. */
  function shouldRun() {
    if (reducedMotion || document.hidden) return false;
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const margin = 240;
    return r.bottom > -margin && r.top < window.innerHeight + margin;
  }

  let syncedAt = 0;
  function sync(force) {
    /* cheap guard: one layout read per 100 ms of scrolling */
    const t = performance.now();
    if (!force && t - syncedAt < 100) return;
    syncedAt = t;
    visible = shouldRun();
    visible ? start() : stop();
  }

  resize();
  render();
  canvas.classList.add('is-ready');

  if (!reducedMotion) {
    /* Kept purely as an optimisation hint. Note entries[entries.length-1]:
       a batch arrives oldest-first, so reading entries[0] can act on a
       stale record and stop a canvas that is already back on screen. */
    new IntersectionObserver(() => sync(true), { threshold: 0 }).observe(canvas);
    window.addEventListener('scroll', () => sync(false), { passive: true });
    window.addEventListener('resize', () => sync(true));
    document.addEventListener('visibilitychange', () => sync(true));
    sync(true);
  }

  new ResizeObserver(() => { resize(); if (!raf) render(); sync(true); }).observe(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });

  return {
    setProgress(p) {
      setProgress(p);
      /* Draw immediately rather than waiting on the next animation
         frame — the pose should never lag the scroll, and this rig is
         20 points and 40 line vertices, so the extra pass is free. */
      render();
    },
    get state() { return state; },
    /* exposed for diagnostics — is the gait actually advancing? */
    get gaitPhase() { return gaitPhase; },
    get running() { return raf !== 0; },
    get visible() { return visible; },
  };
}
