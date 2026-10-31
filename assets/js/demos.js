/* ═══════════════════════════════════════════════════════════
   demos.js — the two research demonstrations, in 3D.

   Drawn for this site, not carried over: a dark drawing-sheet stage,
   off-white and graphite parts, the site's one blue as the working
   colour, and its one warm hue reserved for the two things that
   matter in these projects, a fault and a burn.

     initQuadruped   a quadruped trotting under a base policy. One knee
                     seizes; the correction re-levels the body. Driven
                     by progress 0 → 1 along the trial, fault at 0.40
                     (step 200 of 500). A schematic of the mechanism,
                     not a replay of a trial, and labelled as one
                     wherever it is shown.

     initFlyby       one flyby past a planet, flown by the Oberth
                     atlas's own simulator (oberth.js, vendored) for
                     three burn lengths, Π = 1, 10 and 100. The path,
                     the burn arc, η and the loss are its output; only
                     the planet's size is artistic, since the model
                     treats it as a point mass.

   Each returns { start, stop, … } and renders only while its canvas
   is on screen and the tab is visible. Under reduced motion nothing
   loops: each change of state renders a single settled frame.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from './three.module.min.js?v=39b3c8e2';
import { simulate, fromTargets } from './oberth.js?v=39b3c8e2';

const COL = {
  bg: 0x08090b,
  shell: 0xe9e8e2,
  graphite: 0x2a2c31,
  rubber: 0x121315,
  accent: 0x5b7cff,
  warm: 0xff7a45,
};

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const ramp = (p, a, b) => { const t = clamp01((p - a) / (b - a)); return t * t * (3 - 2 * t); };
const damp = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / tau));

/* ── shared stage ────────────────────────────────────────── */
function stage(canvas, { fov, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1.6, 0.05, 80);

  /* pointer parallax: the stage leans a little toward the pointer */
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    lean.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    lean.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, { passive: true });
  host.addEventListener('pointerleave', () => { lean.tx = 0; lean.ty = 0; });

  let aspect = 1.6;
  let onResize = () => {};
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    onResize(aspect);
  };

  /* the loop: wall-clock time, capped steps, off while unseen */
  let raf = 0, last = 0, visible = true, render = () => {};
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    render(dt, now / 1000);
  };
  const start = () => {
    if (raf || !visible || document.hidden || reducedMotion) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const once = () => render(10, performance.now() / 1000);

  new ResizeObserver(() => { resize(); if (!raf) once(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { rootMargin: '120px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  return {
    renderer, scene, camera, lean, start, stop, once,
    get aspect() { return aspect; },
    set render(fn) { render = fn; },
    set onResize(fn) { onResize = fn; resize(); },
  };
}

/* a box with rounded edges, from an extruded rounded rectangle */
function roundedBox(w, h, d, r) {
  const b = r * 0.6, rc = r * 0.5;
  const W = w - 2 * b, H = h - 2 * b;
  const s = new THREE.Shape();
  s.moveTo(-W / 2, -H / 2 + rc);
  s.lineTo(-W / 2, H / 2 - rc); s.quadraticCurveTo(-W / 2, H / 2, -W / 2 + rc, H / 2);
  s.lineTo(W / 2 - rc, H / 2); s.quadraticCurveTo(W / 2, H / 2, W / 2, H / 2 - rc);
  s.lineTo(W / 2, -H / 2 + rc); s.quadraticCurveTo(W / 2, -H / 2, W / 2 - rc, -H / 2);
  s.lineTo(-W / 2 + rc, -H / 2); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2, -H / 2 + rc);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, d - 2 * b), bevelEnabled: true,
    bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 6,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

/* ═══ A · the quadruped ═════════════════════════════════════ */
export function initQuadruped(canvas, { reducedMotion = false } = {}) {
  const S = stage(canvas, { fov: 26, reducedMotion });
  const { scene, camera, renderer } = S;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.fog = new THREE.Fog(COL.bg, 4.2, 8.5);

  /* light: a soft sky, one key that casts, a cool rim from behind */
  scene.add(new THREE.HemisphereLight(0xe4e8ff, 0x0d0e11, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2.4, 4.2, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 12 });
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight(COL.accent, 1.8);
  rim.position.set(-3, 1.6, -2.8);
  scene.add(rim);

  /* materials */
  const shell = new THREE.MeshStandardMaterial({ color: COL.shell, roughness: 0.42, metalness: 0.0 });
  const graphite = new THREE.MeshStandardMaterial({ color: COL.graphite, roughness: 0.34, metalness: 0.55 });
  const rubber = new THREE.MeshStandardMaterial({ color: COL.rubber, roughness: 0.9, metalness: 0 });
  const led = new THREE.MeshStandardMaterial({ color: COL.accent, emissive: COL.accent, emissiveIntensity: 1.6, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.08, metalness: 0.2, emissive: COL.accent, emissiveIntensity: 0.35 });
  const fault = new THREE.MeshStandardMaterial({ color: COL.warm, emissive: COL.warm, emissiveIntensity: 1.2, roughness: 0.35, metalness: 0.2 });

  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

  /* ── the robot: a stand-in in Laikago proportions ──────── */
  const robot = new THREE.Group();
  const body = new THREE.Group();
  robot.add(body);

  body.add(mesh(roundedBox(1.22, 0.27, 0.46, 0.09), shell));
  const deck = mesh(roundedBox(0.86, 0.045, 0.32, 0.02), graphite); deck.position.y = 0.148; body.add(deck);
  const belly = mesh(roundedBox(1.0, 0.06, 0.34, 0.02), graphite); belly.position.y = -0.15; body.add(belly);
  for (const z of [-1, 1]) {
    const strip = mesh(new THREE.BoxGeometry(0.46, 0.016, 0.006), led);
    strip.position.set(-0.1, 0.035, z * 0.231);
    body.add(strip);
  }
  const head = mesh(roundedBox(0.2, 0.17, 0.32, 0.05), graphite); head.position.set(0.68, 0.01, 0); body.add(head);
  for (const z of [-1, 1]) {
    const eye = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 24), glass);
    eye.rotation.z = Math.PI / 2;
    eye.position.set(0.785, 0.03, z * 0.075);
    body.add(eye);
  }

  /* legs: FL, FR, RL, RR. Trot pairs FL+RR and FR+RL. */
  const REST_HIP = -0.6, REST_KNEE = 1.2;
  const LEGS = [
    { x: 0.44, z: 0.29, phase: 0 },
    { x: 0.44, z: -0.29, phase: Math.PI },
    { x: -0.44, z: 0.29, phase: Math.PI },
    { x: -0.44, z: -0.29, phase: 0 },
  ];
  const ringGeo = new THREE.TorusGeometry(0.086, 0.007, 8, 40);
  const legs = LEGS.map((L) => {
    const hip = new THREE.Group();
    hip.position.set(L.x, -0.07, L.z);
    const motor = mesh(new THREE.CylinderGeometry(0.084, 0.084, 0.12, 32), graphite);
    motor.rotation.x = Math.PI / 2;
    hip.add(motor);
    const band = new THREE.Mesh(ringGeo, led);
    band.position.z = Math.sign(L.z) * 0.061;
    hip.add(band);
    const thigh = mesh(new THREE.CapsuleGeometry(0.052, 0.28, 6, 16), shell);
    thigh.position.y = -0.19; thigh.position.z = Math.sign(L.z) * 0.03;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.38, Math.sign(L.z) * 0.03);
    const kneeMotor = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.1, 28), graphite);
    kneeMotor.rotation.x = Math.PI / 2;
    knee.add(kneeMotor);
    const shank = mesh(new THREE.CapsuleGeometry(0.03, 0.3, 6, 12), graphite);
    shank.position.y = -0.19;
    knee.add(shank);
    const foot = mesh(new THREE.SphereGeometry(0.044, 20, 14), rubber);
    foot.position.y = -0.37;
    knee.add(foot);
    hip.add(knee);
    body.add(hip);
    return { hip, knee, kneeMotor, L };
  });

  /* the leg that fails: front-left, the one nearest the camera */
  const LOCKED = 0;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.006, 8, 48),
    new THREE.MeshBasicMaterial({ color: COL.warm, transparent: true, opacity: 0, depthTest: false, fog: false })
  );
  halo.renderOrder = 10;
  legs[LOCKED].knee.add(halo);

  scene.add(robot);

  /* ground: shadow catcher and a drawing grid that slides past */
  const GROUND = -0.74;
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.42 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = GROUND;
  catcher.receiveShadow = true;
  scene.add(catcher);

  const SP = 0.25, N = 16;
  const gridPts = [];
  for (let i = -N; i <= N; i++) {
    gridPts.push(i * SP, 0, -N * SP, i * SP, 0, N * SP);
    gridPts.push(-N * SP, 0, i * SP, N * SP, 0, i * SP);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x3a3c44, transparent: true, opacity: 0.55 }));
  grid.position.y = GROUND + 0.001;
  scene.add(grid);

  /* ── the trial ───────────────────────────────────────────
     progress 0 → 1 is the trial, steps 0 → 500. The fault lands at
     0.40, step 200; the correction ramps in from 0.52. */
  const FAULT_AT = 0.4, FIX_FROM = 0.52, FIX_TO = 0.66;
  const state = { progress: 0, speed: 1 };
  let target = 0;
  let gaitT = 0, slide = 0;
  const speedFor = (p) => 1 - ramp(p, FAULT_AT, FAULT_AT + 0.08) * 0.62 + ramp(p, FIX_FROM, FIX_TO) * 0.5;

  function pose(dt) {
    const p = state.progress;
    const f = ramp(p, FAULT_AT, FAULT_AT + 0.06);
    const c = ramp(p, FIX_FROM, FIX_TO);
    const sp = state.speed;
    gaitT += dt * 7.2 * (0.55 + 0.45 * sp);

    legs.forEach((leg, i) => {
      const ph = gaitT + leg.L.phase;
      if (i === LOCKED && f > 0) {
        /* a seized joint holds: it eases to its locked angle and stays */
        const lockHip = REST_HIP + 0.18, lockKnee = REST_KNEE - 0.35;
        const hipFree = REST_HIP + Math.sin(ph) * 0.32 * sp;
        const kneeFree = REST_KNEE + Math.max(0, Math.cos(ph)) * 0.5 * sp;
        leg.hip.rotation.z = hipFree + (lockHip - hipFree) * f;
        leg.knee.rotation.z = kneeFree + (lockKnee - kneeFree) * f;
        return;
      }
      /* the healthy legs widen their stride once the correction carries
         the locked one */
      const amp = (0.32 + c * 0.1) * sp;
      leg.hip.rotation.z = REST_HIP + Math.sin(ph) * amp;
      leg.knee.rotation.z = REST_KNEE + Math.max(0, Math.cos(ph)) * 0.5 * sp;
    });

    /* body: a trot bob, and the fault's roll and sag, which the
       correction takes most of the way back out */
    const off = f * (1 - c * 0.8);
    body.position.y = Math.sin(gaitT * 2) * 0.012 * sp - off * 0.05;
    body.rotation.x = off * 0.16;
    body.rotation.z = Math.sin(gaitT) * 0.012 - off * 0.05;

    /* the fault, made visible */
    legs[LOCKED].kneeMotor.material = f > 0.02 ? fault : graphite;
    fault.emissiveIntensity = 0.9 + Math.sin(performance.now() / 160) * 0.35;
    halo.material.opacity = f * (0.6 + 0.4 * Math.sin(performance.now() / 220));
    halo.scale.setScalar(1 + (1 - f) * 1.4);
    halo.quaternion.copy(camera.quaternion);

    /* the grid slides under the feet: forward travel */
    slide = (slide + dt * 0.55 * sp) % SP;
    grid.position.x = -slide;
  }

  /* camera: three-quarter front, a slow drift, a lean to the pointer */
  let dist = 4.1;
  /* closer on a wide strip (the write-up's stage), further back when
     the frame is narrow, so the robot always fills it sensibly */
  S.onResize = (a) => { dist = a > 2.4 ? 3.2 : 4.1 * Math.max(1, 1.45 / a); };
  const look = new THREE.Vector3(0.05, -0.28, 0);
  function aim(t) {
    const az = 0.72 + Math.sin(t * 0.12) * 0.1 + S.lean.x * 0.16;
    const el = 0.2 - S.lean.y * 0.06;
    camera.position.set(Math.sin(az) * dist, look.y + Math.sin(el) * dist + 0.25, Math.cos(az) * dist);
    camera.lookAt(look);
  }

  S.render = (dt, t) => {
    if (reducedMotion) state.progress = target;
    else state.progress = damp(state.progress, target, dt, 0.25);
    state.speed = speedFor(state.progress);
    S.lean.x = damp(S.lean.x, S.lean.tx, dt, 0.4);
    S.lean.y = damp(S.lean.y, S.lean.ty, dt, 0.4);
    pose(reducedMotion ? 0.35 : dt);
    aim(t);
    renderer.render(scene, camera);
  };

  S.once();
  S.start();

  return {
    state,
    setProgress(p) { target = clamp01(p); if (reducedMotion) S.once(); },
    /* the three slide states: nominal, faulted, correcting */
    setStep(n) { this.setProgress([0.2, 0.45, 0.8][Math.min(3, Math.max(1, n)) - 1]); },
    start: S.start,
    stop: S.stop,
  };
}

/* ═══ B · the flyby ═════════════════════════════════════════ */
/* a slow arrival, so the path visibly turns: about 90° here */
const CASE = { vOverVesc: 0.45, dvOverVp: 0.1, dvOverC: 0.3 };
export const FLYBY_PIS = [1, 10, 100];

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export function fmtPct(frac) {
  if (!Number.isFinite(frac)) return '–';
  const p = 100 * frac;
  if (p >= 10) return p.toFixed(1) + '%';
  if (p >= 1) return p.toFixed(2) + '%';
  if (p >= 0.01) return p.toPrecision(3) + '%';
  if (p <= 0) return '0%';
  const e = Math.floor(Math.log10(p));
  return `${(p / 10 ** e).toFixed(1)}×10${String(e).split('').map((c) => SUP[c] ?? c).join('')}%`;
}
export const fmtEta = (e) => (!Number.isFinite(e) ? '–' : e > 0.99 ? e.toFixed(4) : e.toFixed(3));

function planetTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1d25';
  g.fillRect(0, 0, 512, 256);
  /* latitude bands, a gas giant drawn in the site's greys and blue */
  let y = 0, k = 0;
  while (y < 256) {
    const h = 4 + ((k * 37) % 13);
    const l = 22 + ((k * 53) % 19);
    const blue = (k % 5 === 2) ? 10 : 0;
    g.fillStyle = `rgb(${l} ${l + 3} ${l + 12 + blue})`;
    g.globalAlpha = 0.85;
    g.fillRect(0, y, 512, h);
    y += h; k++;
  }
  g.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

export function initFlyby(canvas, { reducedMotion = false, hud = null } = {}) {
  const S = stage(canvas, { fov: 30, reducedMotion });
  const { scene, camera, renderer } = S;

  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x0a0b0e, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-5, 2.5, 3);
  scene.add(sun);

  /* stars, faint and few */
  const starPts = [];
  for (let i = 0; i < 420; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 28;
    const s = Math.sqrt(1 - u * u);
    starPts.push(r * s * Math.cos(a), r * u, r * s * Math.sin(a));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8a8a84, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false })));

  /* the system: the orbital plane faces the viewer, tipped back a
     little so the arc has depth */
  const sys = new THREE.Group();
  sys.rotation.x = -0.5;
  scene.add(sys);

  /* the planet. The model's planet is a point mass; this one is drawn
     at 0.42 of the periapsis radius so there is something to see. */
  const tex = planetTexture();
  tex.colorSpace = THREE.SRGBColorSpace;
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 64, 40),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 })
  );
  planet.rotation.x = 0.7;   /* bands roughly level on screen */
  sys.add(planet);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(0.455, 64, 40),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(COL.accent) } },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6);
          gl_FragColor = vec4(uColor * f * 1.4, f * 1.4);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  sys.add(atmo);

  /* periapsis marker: a short tick at r = 1, above the planet */
  const tickGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.94, 0)]);
  sys.add(new THREE.Line(tickGeo, new THREE.LineDashedMaterial({ color: 0x5a5c64, dashSize: 0.04, gapSize: 0.04 })).computeLineDistances());

  /* ── the three flights ─────────────────────────────────── */
  const CLIP = 4.6;
  const runs = FLYBY_PIS.map((pi) => {
    const res = simulate({ ...fromTargets(pi, CASE.vOverVesc, CASE.dvOverVp, CASE.dvOverC), record: true });
    const track = [];
    let b0 = 0, b1 = 0;
    res.segments.forEach((seg, si) => {
      seg.t.forEach((t, i) => {
        if (si > 0 && i === 0) return;
        const y = seg.y[i];
        track.push({ t, p: new THREE.Vector3(y[1], y[0], 0) });
      });
      if (seg.burn) { b0 = seg.t[0]; b1 = seg.t[seg.t.length - 1]; }
    });
    const inside = track.filter((s) => s.p.length() <= CLIP);
    const tA = inside[0].t, tB = inside[inside.length - 1].t;

    const group = new THREE.Group();
    const mats = [];
    const tube = (pts, radius, mat) => {
      if (pts.length < 2) return;
      const step = Math.max(1, Math.floor(pts.length / 260));
      const thin = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
      const curve = new THREE.CatmullRomCurve3(thin, false, 'centripetal');
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(700, thin.length * 3), radius, 10, false), mat));
    };
    const coastMat = new THREE.MeshBasicMaterial({ color: COL.accent, transparent: true, opacity: 0.9 });
    const burnMat = new THREE.MeshBasicMaterial({ color: COL.warm, transparent: true, opacity: 1 });
    const glowMat = new THREE.MeshBasicMaterial({ color: COL.warm, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    mats.push([coastMat, 0.9], [burnMat, 1], [glowMat, 0.16]);

    const pre = inside.filter((s) => s.t <= b0).map((s) => s.p);
    const burn = inside.filter((s) => s.t >= b0 && s.t <= b1).map((s) => s.p);
    const post = inside.filter((s) => s.t >= b1).map((s) => s.p);
    tube(pre, 0.011, coastMat);
    tube(post, 0.011, coastMat);
    tube(burn, 0.024, burnMat);
    tube(burn, 0.06, glowMat);
    sys.add(group);

    return { pi, res, track, b0, b1, tA, tB, group, mats, fade: 0 };
  });

  /* ── the craft: a bus, two panels, a nozzle, and a plume ─── */
  const craft = new THREE.Group();
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 16), new THREE.MeshStandardMaterial({ color: COL.shell, roughness: 0.4 }));
  bus.rotation.z = Math.PI / 2;
  craft.add(bus);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d2a66, roughness: 0.3, metalness: 0.4, emissive: COL.accent, emissiveIntensity: 0.25 });
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.003, 0.11), panelMat);
    panel.position.z = s * 0.085;
    craft.add(panel);
  }
  const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.03, 16, 1, true), new THREE.MeshStandardMaterial({ color: COL.graphite, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }));
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.x = -0.058;
  craft.add(nozzle);
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.024, 0.16, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: COL.warm, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  plume.rotation.z = -Math.PI / 2;
  plume.position.x = -0.15;
  craft.add(plume);
  craft.scale.setScalar(2.4);
  sys.add(craft);

  /* position along a run at simulator time t, linear between the
     integrator's accepted steps, so the craft is fast at periapsis
     and slow far out, as it is in the run */
  function at(run, t) {
    const tr = run.track;
    let lo = 0, hi = tr.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m].t <= t) lo = m; else hi = m; }
    const a = tr[lo], b = tr[hi];
    const u = b.t > a.t ? clamp01((t - a.t) / (b.t - a.t)) : 0;
    return a.p.clone().lerp(b.p, u);
  }

  /* ── state ─────────────────────────────────────────────── */
  let idx = 1, clock = 0;
  const LOOP = 7.5;

  function readout() {
    if (!hud) return;
    const r = runs[idx].res;
    const set = (sel, v) => { const el = hud.querySelector(sel); if (el) el.textContent = v; };
    set('[data-demo-pi]', String(runs[idx].pi));
    set('[data-demo-eta]', fmtEta(r.eta));
    set('[data-demo-loss]', fmtPct(r.loss_rel));
  }

  let dist = 8.6;
  S.onResize = (a) => { dist = 8.6 * Math.max(1, 1.5 / a); };
  const look = new THREE.Vector3(0, -0.35, 0);

  S.render = (dt, t) => {
    runs.forEach((r, i) => {
      const want = i === idx ? 1 : 0;
      r.fade = reducedMotion ? want : damp(r.fade, want, dt, 0.18);
      r.group.visible = r.fade > 0.01;
      r.mats.forEach(([m, base]) => { m.opacity = base * r.fade; });
    });

    const run = runs[idx];
    clock = reducedMotion ? LOOP * 0.5 : (clock + dt) % LOOP;
    /* linear in the simulator's own time, so the craft keeps the
       run's real pace: fastest at periapsis */
    const u = clock / LOOP;
    const simT = run.tA + (run.tB - run.tA) * u;
    const pos = at(run, simT);
    const ahead = at(run, simT + (run.tB - run.tA) * 0.004);
    craft.position.copy(pos);
    const dir = ahead.sub(pos);
    if (dir.lengthSq() > 1e-10) craft.rotation.z = Math.atan2(dir.y, dir.x);
    const burning = simT >= run.b0 && simT <= run.b1;
    plume.visible = burning;
    plume.scale.y = 0.8 + Math.random() * 0.4;

    planet.rotation.y += dt * 0.05;
    S.lean.x = damp(S.lean.x, S.lean.tx, dt, 0.5);
    S.lean.y = damp(S.lean.y, S.lean.ty, dt, 0.5);
    const az = Math.sin(t * 0.08) * 0.12 + S.lean.x * 0.18;
    camera.position.set(Math.sin(az) * dist, 0.9 - S.lean.y * 0.3, Math.cos(az) * dist);
    camera.lookAt(look);
    renderer.render(scene, camera);
  };

  readout();
  S.once();
  S.start();

  return {
    runs,
    setStep(n) {
      const next = Math.min(3, Math.max(1, n)) - 1;
      if (next !== idx) { idx = next; clock = 0; readout(); }
      if (reducedMotion) S.once();
    },
    start: S.start,
    stop: S.stop,
  };
}
