/* ═══════════════════════════════════════════════════════════
   terrain.js — the hero's potential field.

   A scalar field drawn as contour lines, in one fragment shader
   on a full-screen triangle. No Three.js: this is the only thing
   on the first screen that needs the GPU, so it carries nothing
   it does not use.

     φ = one broad, smooth fbm field (features ~2/3 of the hero's
         height, no warping, so the lines run long and calm)
       + a wide softened well that follows the pointer
       + up to eight smaller wells dropped by clicks, which fade

   Minor contours every 1/18 of the range, an index contour every
   fifth, both a constant pixel width at any density via fwidth.
   Inside a well the lines take the accent and the levels fill in
   alternate bands, like the tints on a survey map.

   It is still unless something happens. Time only advances for a
   few seconds after load and after each interaction, then eases to
   a stop, so the page is quiet while it is being read.

   Decorative: the field stands for nothing and claims nothing. The
   canvas is aria-hidden, and with WebGL unavailable the hero is
   simply the type on the sheet.
   ═══════════════════════════════════════════════════════════ */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uPtr;          /* x, y in device px (y up), depth */
uniform vec4  uWells[8];     /* x, y, depth, radius (device px) */
uniform vec3  uInk;
uniform vec3  uAcc;
uniform float uStrength;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(17.3, 9.1); a *= 0.5; }
  return v;
}
/* a line one level apart, 'w' pixels wide, whatever the density */
float iso(float k, float w) {
  float f = abs(fract(k + 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, fwidth(k) * w, f);
}
/* a softened point-mass well, tapered so its tail does not bend
   the whole sheet */
float well(vec2 d, float r) {
  float q = dot(d, d) / (r * r);
  return inversesqrt(1.0 + q * 4.0) * exp(-q * 0.35);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes.y;

  float w = uPtr.z * well(frag - uPtr.xy, 0.36 * uRes.y);
  for (int i = 0; i < 8; i++) w += uWells[i].z * well(frag - uWells[i].xy, uWells[i].w);

  float h = fbm(uv * 1.3 + vec2(uTime * 0.016, uTime * 0.009)) - w * 0.5;
  float k = h * 18.0;

  float minor = iso(k, 1.15);
  float major = iso(k / 5.0, 1.9);
  float lit = clamp(w * 1.7, 0.0, 1.0);
  float band = step(0.5, fract(k * 0.5));

  /* quiet behind the headline on the left and toward the foot, so
     the type and the buttons sit on still ground */
  float vig = (smoothstep(0.22, 0.86, frag.x / uRes.x) * 0.86 + 0.14)
            * smoothstep(0.0, 0.32, frag.y / uRes.y);

  float a = (minor * 0.30 + major * 0.55 + lit * minor * 0.45 + band * lit * 0.09);
  a *= max(vig, lit * 0.9) * uStrength;
  vec3 col = mix(uInk, uAcc, lit);
  gl_FragColor = vec4(col * a, a);
}
`;

/* any CSS colour to 0–1 rgb, via the browser's own parser */
const rgb = (css, el) => {
  const probe = document.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  el.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g) || ['237', '237', '231'];
  probe.remove();
  return m.slice(0, 3).map((n) => Number(n) / 255);
};

export function initTerrain(canvas, { reducedMotion = false, onRead = () => {} } = {}) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
  if (!gl || !gl.getExtension('OES_standard_derivatives')) return null;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  /* one triangle that covers the viewport */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uTime', 'uPtr', 'uWells', 'uInk', 'uAcc', 'uStrength']) U[n] = gl.getUniformLocation(prog, n);

  /* ── colour, re-read when the theme flips ─────────────── */
  const readColours = () => {
    const cs = getComputedStyle(canvas);
    gl.uniform3fv(U.uInk, rgb(cs.getPropertyValue('--terrain-ink').trim() || '#EDEDE7', canvas.parentElement));
    gl.uniform3fv(U.uAcc, rgb(cs.getPropertyValue('--terrain-acc').trim() || '#5B7CFF', canvas.parentElement));
    gl.uniform1f(U.uStrength, parseFloat(cs.getPropertyValue('--terrain-strength')) || 1);
  };
  readColours();
  new MutationObserver(() => { readColours(); kick(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── size ─────────────────────────────────────────────── */
  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    kick();
  };

  /* ── the pointer and the dropped masses ───────────────── */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, depth: 0, target: 0, inside: false };
  const masses = [];          /* { x, y, peak, born, r, el } in css px, y down */
  let count = 0;
  const RISE = 700, LIFE = 9000;
  let awakeUntil = performance.now() + 3500;      /* the opening drift */
  const wake = (ms) => { awakeUntil = Math.max(awakeUntil, performance.now() + ms); };

  const host = canvas.parentElement;
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;          /* a finger scrolls; it does not hover */
    const [x, y] = local(e);
    ptr.tx = x; ptr.ty = y; ptr.target = 1;
    if (!ptr.inside) { ptr.inside = true; if (ptr.depth < 0.02) { ptr.x = x; ptr.y = y; } }
    if (reducedMotion) { ptr.x = x; ptr.y = y; ptr.depth = 1; }
    wake(1500);
    kick();
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    ptr.inside = false; ptr.target = 0;
    if (reducedMotion) ptr.depth = 0;
    kick();
  });
  host.addEventListener('pointerdown', (e) => {
    /* presses on links and buttons are for them, not for the field */
    if (e.target.closest('a, button, input, dialog, [data-no-terrain]')) return;
    const [x, y] = local(e);
    const m = { x, y, born: performance.now(), r: 70 + Math.random() * 50, peak: 0.55 + Math.random() * 0.35 };
    m.el = document.createElement('span');
    m.el.className = 'mass mono';
    m.el.setAttribute('aria-hidden', 'true');
    m.el.style.left = `${x}px`; m.el.style.top = `${y}px`;
    m.el.innerHTML = `<i></i><b>m${++count} · ${m.peak.toFixed(2)}</b>`;
    host.appendChild(m.el);
    if (masses.length >= 8) masses.shift().el.remove();
    masses.push(m);
    wake(LIFE);
    kick();
  });

  const depthOf = (m, now) => {
    const age = now - m.born;
    if (age >= LIFE) return 0;
    if (reducedMotion) return m.peak;
    if (age < RISE) return m.peak * (1 - (1 - age / RISE) ** 3);
    return m.peak * (1 - (age - RISE) / (LIFE - RISE)) ** 2;
  };

  /* ── draw ─────────────────────────────────────────────── */
  const wellData = new Float32Array(32);
  let t = 0, last = performance.now(), raf = 0, visible = true;

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(now - last, 50) / 1000;
    last = now;

    /* time runs only while awake, and eases out over the last second */
    const awake = reducedMotion ? 0 : Math.min(1, Math.max(0, (awakeUntil - now) / 1000)) ** 2;
    t += dt * awake;

    if (reducedMotion) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
    else {
      ptr.x += (ptr.tx - ptr.x) * 0.09;
      ptr.y += (ptr.ty - ptr.y) * 0.09;
      ptr.depth += (ptr.target - ptr.depth) * 0.05;
    }

    wellData.fill(0);
    for (let i = masses.length - 1; i >= 0; i--) {
      if (now - masses[i].born >= LIFE) { masses[i].el.remove(); masses.splice(i, 1); }
    }
    masses.forEach((m, i) => {
      const d = depthOf(m, now);
      wellData.set([m.x * dpr, (h - m.y) * dpr, d, m.r * dpr], i * 4);
      m.el.style.opacity = String(Math.min(1, d / m.peak + 0.1));
    });

    gl.uniform1f(U.uTime, t);
    gl.uniform3f(U.uPtr, ptr.x * dpr, (h - ptr.y) * dpr, ptr.depth);
    gl.uniform4fv(U.uWells, wellData);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    onRead({
      inside: ptr.inside, x: ptr.tx, y: ptr.ty, w, h,
      phi: ptr.depth + masses.reduce((s, m) => {
        const q = ((m.x - ptr.tx) ** 2 + (m.y - ptr.ty) ** 2) / (m.r * m.r);
        return s + depthOf(m, now) / Math.sqrt(1 + q * 4) * Math.exp(-q * 0.35);
      }, 0),
      masses: masses.length,
    });

    /* keep going only while something is still changing */
    const settling = Math.abs(ptr.target - ptr.depth) > 0.002
      || Math.abs(ptr.tx - ptr.x) > 0.3 || Math.abs(ptr.ty - ptr.y) > 0.3;
    if (!reducedMotion && (awake > 0 || settling || masses.length)) kick();
  }
  function kick() {
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.classList.remove('is-on'); });

  resize();
  /* the first frame now, not on the next animation frame, so the map
     is there the moment the hero is */
  frame(performance.now());
  canvas.classList.add('is-on');
  return { kick };
}
