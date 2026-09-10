/* ═══════════════════════════════════════════════════════════
   robot.js — the hero subject.

   The quadruped stands still; only the props drift, on long
   irregular periods. Geometry, materials and lighting all come
   from kit.js, which the research stage shares.
   ═══════════════════════════════════════════════════════════ */

import { THREE, makeMaterials, makeHalo, buildQuadruped, box } from './kit.js?v=7dc2c391';

/* seed 0's own learning curve, rollout/ep_rew_mean sampled to 40
   points from logs/seed_0/progress.csv in the research repo. Real
   numbers: the sparkline prop is not decoration. */
const REWARD = [-5.7, -0.8, 6.4, 8.7, 13.8, 19.9, 32.5, 59, 90.8, 165.2, 277.1,
  382.4, 450.9, 502.3, 511.8, 513.2, 530.7, 528.2, 516.6, 531.3, 561.4, 554.8,
  558.8, 563, 556.4, 584.1, 594, 619.5, 619.3, 612.4, 631, 639.8, 626.8, 643,
  655.4, 660.7, 673.6, 670.9, 668.8, 684.5];

const VERT = `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = `
  uniform vec3  uBase;
  uniform vec3  uRim;
  uniform vec3  uKey;
  uniform vec3  uCam;
  uniform float uAmb;
  uniform float uRimStr;
  uniform float uRimPow;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vW);
    vec3 L = normalize(uKey);
    float d = max(dot(N, L), 0.0);
    /* a weak second bounce from below keeps the underside from
       going to pure black against the panel */
    float b = max(dot(N, vec3(-0.2, -1.0, 0.3)), 0.0) * 0.12;
    float f = pow(1.0 - max(dot(N, V), 0.0), uRimPow);
    vec3 col = uBase * (uAmb + (1.0 - uAmb) * d + b) + uRim * f * uRimStr;
    gl_FragColor = vec4(col, 1.0);
  }`;

const HALO_FRAG = `
  uniform vec3  uRim;
  uniform float uStr;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - r, 0.0), 2.2) * uStr;
    gl_FragColor = vec4(uRim, a);
  }`;

const HALO_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export function initRobot(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(3.05, 0.86, 4.05);
  camera.lookAt(0, -0.02, 0);

  const M = makeMaterials(camera);

  const halo = makeHalo(M.LIMB);
  halo.position.set(-0.10, 0.12, -1.5);
  scene.add(halo);

  const { group: robot } = buildQuadruped(M);
  robot.rotation.y = -0.42;
  robot.rotation.z = 0.05;
  robot.position.y = 0.30;
  robot.scale.setScalar(0.74);
  scene.add(robot);

  /* ── orbiting props ────────────────────────────────────────
     Six, at varied depth. Placed clear of the wordmark's two
     bands so nothing lands on a letterform. */
  const props = [];
  const addProp = (mesh, { pos, spin = [0, 0, 0], period, amp = 0.10, phase = 0 }) => {
    mesh.position.set(...pos);
    mesh.rotation.set(...spin);
    scene.add(mesh);
    props.push({ mesh, base: mesh.position.clone(), period, amp, phase });
    return mesh;
  };

  addProp(new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.055, 14, 40), M.STRUCT),
    { pos: [0.88, 0.58, 0.55], spin: [0.9, 0.4, 0.2], period: 8.4, amp: 0.11, phase: 0.0 });

  /* a capsule actuator, the part the fault model actually breaks */
  addProp(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.26, 6, 16), M.JOINT),
    { pos: [0.95, -0.52, 0.30], spin: [0.2, 0, -0.7], period: 10.6, amp: 0.09, phase: 1.9 });

  /* hex bolt */
  addProp(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.10, 6), M.SHELL),
    { pos: [-0.06, -0.95, 0.75], spin: [0.5, 0.3, 0.35], period: 7.2, amp: 0.12, phase: 3.4 });

  /* Σ plate */
  addProp(new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), glyphMat('Σ')),
    { pos: [0.30, -0.98, 0.20], spin: [0, 0.34, -0.10], period: 9.5, amp: 0.10, phase: 2.4 });

  /* the sparkline card — seed 0's real reward curve */
  addProp(new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.43), sparkMat()),
    { pos: [0.10, 1.02, -0.35], spin: [0, 0.30, 0.06], period: 11.0, amp: 0.08, phase: 4.8 });

  /* a finned heat sink */
  const sink = new THREE.Group();
  sink.add(box(0.26, 0.05, 0.20, M.STRUCT));
  for (let i = 0; i < 5; i++) {
    const fin = box(0.018, 0.15, 0.19, M.SHELL);
    fin.position.set(-0.10 + i * 0.05, 0.10, 0);
    sink.add(fin);
  }
  addProp(sink, { pos: [-0.75, -0.80, -0.55], spin: [0.34, 0.26, -0.30], period: 6.4, amp: 0.13, phase: 5.6 });

  /* ── canvas-texture props ──────────────────────────────── */
  function glyphMat(ch) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#20262E';
    roundRect(g, 4, 4, 248, 248, 26); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2;
    roundRect(g, 5, 5, 246, 246, 26); g.stroke();
    g.fillStyle = '#8FE0F5';
    g.font = '600 150px "JetBrains Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 128, 138);
    return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true });
  }

  function sparkMat() {
    const W = 512, H = 300;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#20262E';
    roundRect(g, 4, 4, W - 8, H - 8, 26); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2;
    roundRect(g, 5, 5, W - 10, H - 10, 26); g.stroke();

    g.fillStyle = '#8C95A1';
    g.font = '500 26px "JetBrains Mono", monospace';
    g.fillText('seed 0 · ep_rew_mean', 30, 52);

    const lo = Math.min(...REWARD), hi = Math.max(...REWARD);
    const x = (i) => 30 + (i / (REWARD.length - 1)) * (W - 60);
    const y = (v) => H - 46 - ((v - lo) / (hi - lo)) * (H - 130);

    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const gy = 74 + (i / 4) * (H - 120);
      g.beginPath(); g.moveTo(30, gy); g.lineTo(W - 30, gy); g.stroke();
    }

    g.strokeStyle = '#4A9EE0'; g.lineWidth = 5; g.lineJoin = 'round';
    g.beginPath();
    REWARD.forEach((v, i) => (i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v))));
    g.stroke();
    g.fillStyle = '#8FE0F5';
    g.beginPath(); g.arc(x(REWARD.length - 1), y(REWARD[REWARD.length - 1]), 7, 0, 7); g.fill();

    return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true });
  }

  function tex(c) {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ── size ──────────────────────────────────────────────── */
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const m of M.all) m.uniforms.uCam.value.copy(camera.position);
  };
  resize();
  addEventListener('resize', resize);

  /* ── loop. Only the props move, on long irregular periods.
     Capped at 30fps and parked whenever the tab is hidden. ── */
  let raf = 0, last = 0, scrollShift = 0;
  const t0 = performance.now();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    const t = (now - t0) / 1000;
    for (const p of props) {
      const a = Math.sin((t / p.period) * Math.PI * 2 + p.phase);
      const e = a * a * a * 0.35 + a * 0.65;           /* eased, not a pure sine */
      p.mesh.position.y = p.base.y + e * p.amp + scrollShift * 0.4;
      p.mesh.position.x = p.base.x + Math.cos((t / (p.period * 1.37)) * Math.PI * 2 + p.phase) * p.amp * 0.4;
      p.mesh.rotation.z += 0.0006;
    }
    renderer.render(scene, camera);
  };

  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (reducedMotion) {
    renderer.render(scene, camera);
  } else {
    addEventListener('scroll', () => {
      scrollShift = Math.min(scrollY / 900, 1) * 0.5;
    }, { passive: true });
    start();
  }

  /* one synchronous render so the first frame is never empty */
  renderer.render(scene, camera);

  return {
    canvas,
    renderer,
    /* used once, to bake the poster */
    snapshot: () => { renderer.render(scene, camera); return canvas.toDataURL('image/webp', 0.86); },
  };
}
