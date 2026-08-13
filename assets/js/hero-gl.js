/* ═══════════════════════════════════════════════════════════
   hero-gl.js — the 3D object behind the hero.

   A subdivided icosphere rendered twice: once as wireframe
   edges, once as a glowing point cloud, both displaced along
   their normals by 3D simplex noise so the whole thing
   breathes. A shell of drifting dust sits behind it for depth.

   Raw WebGL2 — no libraries, so there is nothing to fetch and
   nothing that can 404. Degrades to the CSS gradient veil if
   WebGL is unavailable.
   ═══════════════════════════════════════════════════════════ */

/* ── tiny mat4 helpers (column-major, WebGL convention) ──── */

function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function multiply(out, a, b) {
  for (let i = 0; i < 4; i++) {
    const a0 = a[i], a1 = a[i + 4], a2 = a[i + 8], a3 = a[i + 12];
    out[i]      = a0 * b[0]  + a1 * b[1]  + a2 * b[2]  + a3 * b[3];
    out[i + 4]  = a0 * b[4]  + a1 * b[5]  + a2 * b[6]  + a3 * b[7];
    out[i + 8]  = a0 * b[8]  + a1 * b[9]  + a2 * b[10] + a3 * b[11];
    out[i + 12] = a0 * b[12] + a1 * b[13] + a2 * b[14] + a3 * b[15];
  }
  return out;
}

function rotation(out, rx, ry) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  /* Ry * Rx */
  out[0] = cy;       out[1] = 0;   out[2] = -sy;      out[3] = 0;
  out[4] = sy * sx;  out[5] = cx;  out[6] = cy * sx;  out[7] = 0;
  out[8] = sy * cx;  out[9] = -sx; out[10] = cy * cx; out[11] = 0;
  out[12] = 0;       out[13] = 0;  out[14] = 0;       out[15] = 1;
  return out;
}

function view(out, x, y, z) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

/* ── geometry ────────────────────────────────────────────── */

function icosphere(order) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ];
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  const cache = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const va = verts[a], vb = verts[b];
    verts.push([(va[0] + vb[0]) / 2, (va[1] + vb[1]) / 2, (va[2] + vb[2]) / 2]);
    const idx = verts.length - 1;
    cache.set(key, idx);
    return idx;
  };

  for (let i = 0; i < order; i++) {
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }

  const positions = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    positions[i * 3] = v[0] / len;
    positions[i * 3 + 1] = v[1] / len;
    positions[i * 3 + 2] = v[2] / len;
  });

  const seen = new Set();
  const edges = [];
  for (const [a, b, c] of faces) {
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = p < q ? p * 65536 + q : q * 65536 + p;
      if (!seen.has(key)) { seen.add(key); edges.push(p, q); }
    }
  }

  return {
    positions,
    scales: new Float32Array(verts.length).fill(1),
    edges: new Uint16Array(edges),
    count: verts.length,
  };
}

function dustShell(n) {
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    /* uniform point on a sphere */
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = r * Math.cos(phi);
    positions[i * 3 + 1] = u;
    positions[i * 3 + 2] = r * Math.sin(phi);
    scales[i] = 1.45 + Math.random() * 1.7;
  }
  return { positions, scales, count: n };
}

/* ── shaders ─────────────────────────────────────────────── */

/* 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT). */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const VERT = `#version 300 es
precision highp float;
in vec3 aPos;
in float aScale;
uniform mat4 uProj;
uniform mat4 uMV;
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uSize;
uniform float uDpr;
uniform float uScale;
out float vShade;
out float vFog;
${NOISE}
void main(){
  vec3 dir = normalize(aPos);
  float n1 = snoise(dir * uFreq + vec3(0.0, 0.0, uTime * 0.20));
  float n2 = snoise(dir * (uFreq * 2.4) - vec3(uTime * 0.13));
  float n  = n1 * 0.72 + n2 * 0.28;
  vec3 pos = dir * (aScale + uAmp * n) * uScale;
  vec4 mv  = uMV * vec4(pos, 1.0);
  gl_Position = uProj * mv;
  float dist = max(-mv.z, 0.001);
  vFog   = clamp((dist - 2.6) / 4.2, 0.0, 1.0);
  vShade = n * 0.5 + 0.5;
  gl_PointSize = max(1.0, uSize * uDpr / dist);
}`;

const FRAG_POINT = `#version 300 es
precision highp float;
in float vShade;
in float vFog;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
out vec4 frag;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.015, d) * uOpacity * (1.0 - vFog * 0.9);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.22, 0.86, vShade));
  frag = vec4(col * a, a);            /* premultiplied */
}`;

const FRAG_LINE = `#version 300 es
precision highp float;
in float vShade;
in float vFog;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
out vec4 frag;
void main(){
  float a = uOpacity * (1.0 - vFog);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.22, 0.86, vShade));
  frag = vec4(col * a, a);
}`;

/* ── program plumbing ────────────────────────────────────── */

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[hero-gl] shader:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl, vs, fragSrc) {
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('[hero-gl] link:', gl.getProgramInfoLog(p));
    return null;
  }
  const uniforms = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { p, u: uniforms };
}

function hexToRgb(hex, fallback) {
  const m = /^#?([\da-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  const int = parseInt(m[1], 16);
  /* approximate sRGB → linear so the additive blend stays clean */
  return [
    ((int >> 16 & 255) / 255) ** 2.2,
    ((int >> 8 & 255) / 255) ** 2.2,
    ((int & 255) / 255) ** 2.2,
  ];
}

/* ── main ────────────────────────────────────────────────── */

export function initHero(canvas, { reducedMotion = false } = {}) {
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return;                       /* CSS veil carries the hero */

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  if (!vs) return;
  const pointProg = program(gl, vs, FRAG_POINT);
  const lineProg = program(gl, vs, FRAG_LINE);
  gl.deleteShader(vs);
  if (!pointProg || !lineProg) return;

  const sphere = icosphere(3);           /* 642 verts · 1920 edges */
  const dust = dustShell(520);

  /* one VAO per (geometry × program) pair */
  function makeVao(prog, geo, indices) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog.p, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const scaleBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.scales, gl.STATIC_DRAW);
    const aScale = gl.getAttribLocation(prog.p, 'aScale');
    gl.enableVertexAttribArray(aScale);
    gl.vertexAttribPointer(aScale, 1, gl.FLOAT, false, 0, 0);

    if (indices) {
      const idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    gl.bindVertexArray(null);
    return vao;
  }

  const vaoWire = makeVao(lineProg, sphere, sphere.edges);
  const vaoDots = makeVao(pointProg, sphere, null);
  const vaoDust = makeVao(pointProg, dust, null);

  /* ── theme colours ─────────────────────────────────────── */
  const theme = { a: [0, 0, 0], b: [0, 0, 0], opacity: 1, additive: true };
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    theme.a = hexToRgb(cs.getPropertyValue('--accent-2'), [0.08, 0.19, 1]);
    theme.b = hexToRgb(cs.getPropertyValue('--accent'), [1, 0.1, 0.02]);
    theme.additive = document.documentElement.dataset.theme !== 'light';
    theme.opacity = theme.additive ? 0.9 : 0.62;
    gl.blendFunc(gl.ONE, theme.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.enable(gl.BLEND);
  readTheme();
  document.addEventListener('themechange', readTheme);

  /* ── sizing ────────────────────────────────────────────── */
  const proj = new Float32Array(16);
  const viewM = new Float32Array(16);
  const rotM = new Float32Array(16);
  const mv = new Float32Array(16);
  const mvDust = new Float32Array(16);

  const FOV = 0.74;                     /* ~42° */
  const DIST = 4.4;
  let dpr = 1, w = 1, h = 1;
  let offX = 0, offY = 0, objScale = 1;
  /* narrow layouts stack the object behind the headline, so it
     has to step back to keep the type readable */
  let screenFade = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(rect.width);
    h = Math.round(rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    const aspect = w / h;
    perspective(proj, FOV, aspect, 0.1, 24);

    const halfH = Math.tan(FOV / 2) * DIST;
    const halfW = halfH * aspect;

    /* park the object clear of the headline on wide screens, and
       keep its noise-displaced silhouette inside the frustum */
    const wide = w > 900;
    const fx = wide ? 0.72 : 0.5;
    const fy = wide ? 0.44 : 0.26;
    offX = (fx - 0.5) * 2 * halfW;
    offY = (0.5 - fy) * 2 * halfH;

    const room = Math.min(halfW - Math.abs(offX), halfH * 0.98) / 1.3;
    objScale = Math.max(0.55, Math.min(wide ? 1.05 : 0.82, room));
    screenFade = wide ? 1 : 0.6;

    view(viewM, offX, offY, -DIST);
  }

  /* ── pointer + scroll ──────────────────────────────────── */
  let px = 0, py = 0, tx = 0, ty = 0;
  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  let scrollFade = 1;
  const onScroll = () => {
    const t = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    scrollFade = 1 - t;
    canvas.style.setProperty('--gl-opacity', (0.08 + scrollFade * 0.92).toFixed(3));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── draw ──────────────────────────────────────────────── */
  /* A driver is free to optimise an unused uniform out of the
     program, which leaves its location undefined — skip those
     rather than handing WebGL a bad location. */
  const f1 = (loc, v) => { if (loc) gl.uniform1f(loc, v); };
  const f3 = (loc, v) => { if (loc) gl.uniform3fv(loc, v); };
  const m4 = (loc, v) => { if (loc) gl.uniformMatrix4fv(loc, false, v); };

  function drawPass(prog, vao, { amp, freq, size, scale, opacity, matrix, mode, count, indexed }) {
    gl.useProgram(prog.p);
    gl.bindVertexArray(vao);
    m4(prog.u.uProj, proj);
    m4(prog.u.uMV, matrix);
    f1(prog.u.uTime, time);
    f1(prog.u.uAmp, amp);
    f1(prog.u.uFreq, freq);
    f1(prog.u.uSize, size);
    f1(prog.u.uDpr, dpr);
    f1(prog.u.uScale, scale);
    f1(prog.u.uOpacity, opacity * screenFade);
    f3(prog.u.uColorA, theme.a);
    f3(prog.u.uColorB, theme.b);
    if (indexed) gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);
    else gl.drawArrays(mode, 0, count);
  }

  let time = 0;
  function render() {
    /* eased pointer parallax */
    px += (tx - px) * 0.045;
    py += (ty - py) * 0.045;

    const spin = reducedMotion ? 0.6 : time * 0.11;
    rotation(rotM, -py * 0.42 + 0.16, spin + px * 0.5);
    multiply(mv, viewM, rotM);

    rotation(rotM, -py * 0.16, spin * 0.32 + px * 0.18);
    multiply(mvDust, viewM, rotM);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawPass(lineProg, vaoWire, {
      amp: 0.24, freq: 1.5, size: 1, scale: objScale,
      opacity: theme.opacity * 0.15, matrix: mv,
      mode: gl.LINES, count: sphere.edges.length, indexed: true,
    });

    drawPass(pointProg, vaoDust, {
      amp: 0.08, freq: 0.9, size: 4.6, scale: objScale,
      opacity: theme.opacity * 0.38, matrix: mvDust,
      mode: gl.POINTS, count: dust.count, indexed: false,
    });

    drawPass(pointProg, vaoDots, {
      amp: 0.24, freq: 1.5, size: 9.5, scale: objScale,
      opacity: theme.opacity, matrix: mv,
      mode: gl.POINTS, count: sphere.count, indexed: false,
    });
  }

  /* ── loop ──────────────────────────────────────────────── */
  let raf = 0, last = 0, visible = true;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    render();
  }

  function start() {
    if (raf || reducedMotion) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  render();
  canvas.classList.add('is-ready');

  if (reducedMotion) {
    /* one static frame, no loop */
  } else {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0 }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      document.hidden || !visible ? stop() : start();
    });
    start();
  }

  const ro = new ResizeObserver(() => { resize(); if (!raf) render(); });
  ro.observe(canvas);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
}
