/* ═══════════════════════════════════════════════════════════
   earth.js — the hero scene.

   The panel is a window, not a card. Earth fills its lower right,
   cropped by the panel edge so the full curve is implied rather
   than drawn. The atmospheric limb is the only light source in
   the frame; everything else is lit by it.

   One texture does day and night: RGB carries the daylit surface,
   alpha carries the city lights. The shader mixes them by sun
   angle at run time, so the terminator travels with the rotation
   instead of being baked into the image. See img/CREDITS.md.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from './three.module.min.js';

const css = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
};

const EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const EARTH_FRAG = `
  uniform sampler2D uMap;
  uniform vec3  uSun;
  uniform vec3  uCam;
  uniform vec3  uLimb;
  uniform vec3  uCity;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;

  void main() {
    vec4 t = texture2D(uMap, vUv);
    vec3 N = normalize(vN);
    vec3 L = normalize(uSun);
    vec3 V = normalize(uCam - vW);

    float sun = dot(N, L);
    /* the terminator is a soft band, not an edge */
    float day = smoothstep(-0.10, 0.52, sun);

    /* Day side, held well down: this is a night-side composition and
       a fully lit crescent would pull the eye off the copy. */
    vec3 dayCol = t.rgb * 0.30;
    dayCol *= mix(vec3(0.80, 0.86, 1.00), vec3(1.0), day);

    /* City lights only where the sun is genuinely off the surface */
    float nightMask = 1.0 - smoothstep(-0.22, 0.05, sun);
    vec3 nightCol = uCity * t.a * 0.62 * nightMask;

    /* the unlit ground is not black, it is very dark blue */
    vec3 base = vec3(0.006, 0.012, 0.022) * (1.0 - day);

    vec3 col = base + nightCol + dayCol * day;

    /* Rim: the atmosphere seen edge-on, brightest where the sun is
       grazing. This is the page's light source, so it gets to be
       generous without becoming a halo. */
    float fres = pow(1.0 - max(dot(N, V), 0.0), 5.5);
    float sunLit = smoothstep(-0.30, 0.55, sun);
    col += uLimb * fres * (0.06 + sunLit * 0.62);

    gl_FragColor = vec4(col, 1.0);
  }`;

/* the outer shell: atmosphere scattered above the surface */
const ATMO_FRAG = `
  uniform vec3  uSun;
  uniform vec3  uCam;
  uniform vec3  uLimb;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vW);
    vec3 L = normalize(uSun);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 9.0);
    float sunLit = smoothstep(-0.28, 0.62, dot(N, L));
    float a = fres * (0.03 + sunLit * 0.78);
    gl_FragColor = vec4(uLimb * a, a);   /* premultiplied */
  }`;

const ATMO_VERT = `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

/* Hard-surface parts: near-silhouette, with the limb picking out the
   edge that faces it. Same idea as the old fresnel material, tuned
   much darker because these objects sit in front of a lit planet. */
const PART_FRAG = `
  uniform vec3  uBase;
  uniform vec3  uRim;
  uniform vec3  uKey;
  uniform vec3  uCam;
  uniform float uAmb;
  uniform float uRimStr;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vW);
    vec3 L = normalize(uKey);
    float d = max(dot(N, L), 0.0);
    float f = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 col = uBase * (uAmb + (1.0 - uAmb) * d) + uRim * f * uRimStr;
    gl_FragColor = vec4(col, 1.0);
  }`;

export function initEarth(canvas, { reducedMotion = false } = {}) {
  const LIMB = css('--limb', '#8FE0F5');
  const SIGNAL = css('--signal', '#4A9EE0');
  /* City lights are the one warm note in the frame. They are a
     photographic fact about Earth at night, not a fourth accent, and
     they are held dim enough never to compete with the limb. */
  const CITY = new THREE.Color('#FFCF9A');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);
  camera.position.set(0, 0, 3.15);
  camera.lookAt(0, 0, 0);

  /* the sun sits behind and to the left, so we get the night face
     with the terminator running through the frame */
  const SUN = new THREE.Vector3(-0.42, 0.26, -0.94).normalize();

  const parts = [];
  const partMat = (hex, { amb = 0.05, rimStr = 1.5 } = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: PART_FRAG,
      uniforms: {
        uBase:   { value: new THREE.Color(hex) },
        uRim:    { value: LIMB.clone() },
        uKey:    { value: SUN.clone().multiplyScalar(-1) },
        uCam:    { value: camera.position.clone() },
        uAmb:    { value: amb },
        uRimStr: { value: rimStr },
      },
    });
    parts.push(m);
    return m;
  };

  const SHELL = partMat('#79828B', { amb: 0.06, rimStr: 1.9 });
  const HULL  = partMat('#AEB7C0', { amb: 0.10, rimStr: 2.1 });
  const DARK  = partMat('#11151A', { amb: 0.05, rimStr: 1.8 });
  const GOLD  = partMat('#6A5730', { amb: 0.09, rimStr: 1.6 });
  const BLUE  = partMat(SIGNAL.clone().multiplyScalar(0.72), { amb: 0.11, rimStr: 1.05 });
  const CHAR  = partMat('#241A15', { amb: 0.07, rimStr: 1.6 });

  /* ── Earth ─────────────────────────────────────────────────
     Off-centre and oversized so the panel crops it: the curve
     leaves the frame rather than sitting inside it. */
  const globe = new THREE.Group();
  globe.position.set(1.02, -0.86, 0);

  const tex = new THREE.TextureLoader().load('assets/img/earth-2k.webp');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const earthMat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uMap:  { value: tex },
      uSun:  { value: SUN.clone() },
      uCam:  { value: camera.position.clone() },
      uLimb: { value: LIMB.clone() },
      uCity: { value: CITY.clone() },
    },
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.05, 96, 64), earthMat);
  earth.rotation.z = 0.41;                 /* axial tilt, roughly */
  globe.add(earth);

  const atmoMat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uSun:  { value: SUN.clone() },
      uCam:  { value: camera.position.clone() },
      uLimb: { value: LIMB.clone() },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1.071, 64, 48), atmoMat));

  /* the bloom: a ring gradient sitting behind the planet, peaking just
     outside its edge and falling off into black. Weighted toward the
     sunlit side so the glow is not a uniform halo. */
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.40, 3.40),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uLimb; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec2 d = vUv - 0.5;
          float r = length(d) * 2.0;
          /* The planet edge sits at 0.617 of this plane's half-extent.
             The glow starts there and is gone within 0.06 of it, which
             is about 0.14 world units — air, not a halo. */
          float t = clamp((r - 0.617) / 0.075, 0.0, 1.0);
          /* smoothstep in, not step: a hard inner edge reads as a
             second ring sitting outside the first */
          float band = pow(1.0 - t, 4.0) * smoothstep(0.610, 0.626, r);
          float side = 0.22 + 0.78 * smoothstep(-0.45, 0.85, dot(normalize(d + 1e-5), uDir));
          float a = band * side * 0.44;
          gl_FragColor = vec4(uLimb * a, a);   /* premultiplied */
        }`,
      uniforms: { uLimb: { value: LIMB.clone() }, uDir: { value: new THREE.Vector2(-0.55, 0.83).normalize() } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  glow.position.z = -0.02;
  globe.add(glow);

  scene.add(globe);

  /* ── the spacecraft ────────────────────────────────────────
     An original vehicle, not a real one: a bus, a truss, a
     radiator wing and a nozzle bell. It reads as a silhouette with
     one lit edge and is there for scale, not for detail. */
  const ship = new THREE.Group();
  {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.12), HULL);
    ship.add(bus);

    /* truss aft */
    for (const dz of [-0.035, 0.035]) for (const dy of [-0.032, 0.032]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.20, 6), DARK);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(-0.19, dy, dz);
      ship.add(rail);
    }
    for (let i = 0; i < 4; i++) {
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.085, 5), DARK);
      brace.rotation.x = Math.PI / 4;
      brace.position.set(-0.255 + i * 0.045, 0, 0);
      ship.add(brace);
    }

    /* radiator wing, gold-foil side toward the planet */
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.115), GOLD);
    rad.position.set(-0.04, 0.085, 0);
    rad.rotation.z = 0.16;
    ship.add(rad);
    const rad2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.115), GOLD);
    rad2.position.set(-0.04, -0.085, 0);
    rad2.rotation.z = -0.16;
    ship.add(rad2);

    /* nozzle bell */
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.021, 0.10, 20, 1, true), SHELL);
    bell.rotation.z = Math.PI / 2;
    bell.position.set(-0.37, 0, 0);
    ship.add(bell);

    /* one blue detail, the same anodised part the robot carries */
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.02), BLUE);
    port.position.set(0.055, 0.058, 0.055);
    ship.add(port);

    ship.scale.setScalar(0.20);
    ship.rotation.set(0.30, 0.86, 0.10);
  }
  scene.add(ship);

  /* ── props ─────────────────────────────────────────────────
     Seven, at varied depth, each catching the limb on the side
     that faces it. */
  const props = [];
  const addProp = (mesh, { pos, spin = [0, 0, 0], period, amp = 0.05, phase = 0 }) => {
    mesh.position.set(...pos);
    mesh.rotation.set(...spin);
    scene.add(mesh);
    props.push({ mesh, base: mesh.position.clone(), period, amp, phase });
    return mesh;
  };

  /* reaction wheel */
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.026, 10, 28), SHELL));
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.055, 12), DARK));
  wheel.children[1].rotation.x = Math.PI / 2;
  addProp(wheel, { pos: [0.35, 0.45, 0.35], spin: [0.9, 0.3, 0.2], period: 9.0, amp: 0.05, phase: 0.2 });

  /* CubeSat, 1U, one panel deployed */
  const cube = new THREE.Group();
  cube.add(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.10), SHELL));
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.10, 0.20), BLUE);
  panel.position.set(0.055, 0, 0.14);
  panel.rotation.y = -0.30;
  cube.add(panel);
  addProp(cube, { pos: [-1.10, 0.52, -0.30], spin: [0.35, 0.6, 0.1], period: 11.0, amp: 0.045, phase: 2.1 });

  /* parabolic antenna */
  const dish = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.10, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), SHELL);
  bowl.rotation.x = Math.PI;
  dish.add(bowl);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), DARK);
  boom.position.y = -0.045;
  dish.add(boom);
  addProp(dish, { pos: [1.12, 0.44, 0.55], spin: [1.15, 0.35, 0.4], period: 8.0, amp: 0.055, phase: 3.6 });

  /* nozzle bell, loose */
  const bell2 = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.028, 0.13, 18, 1, true), SHELL);
  addProp(bell2, { pos: [0.30, -0.90, 0.20], spin: [0.4, 0.3, -0.9], period: 10.2, amp: 0.05, phase: 5.0 });

  /* star tracker: a small barrel with a stray-light baffle */
  const tracker = new THREE.Group();
  tracker.add(new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.07, 12), SHELL));
  const baffle = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.030, 0.06, 12, 1, true), DARK);
  baffle.position.y = 0.062;
  tracker.add(baffle);
  addProp(tracker, { pos: [0.95, 0.50, -0.20], spin: [0.3, 0.4, 0.55], period: 7.4, amp: 0.05, phase: 1.2 });

  /* the heat-shield tile — the one prop allowed a joke. It is a
     spare that has already flown: one edge is charred. */
  const tile = new THREE.Group();
  tile.add(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 6), SHELL));
  const scorch = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.070, 0.010, 6), CHAR);
  scorch.position.y = -0.014;
  tile.add(scorch);
  addProp(tile, { pos: [1.15, -0.80, 0.60], spin: [1.30, 0.15, 0.30], period: 6.6, amp: 0.06, phase: 4.2 });

  /* transfer-ellipse plate */
  addProp(new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.30), transferMat()),
    { pos: [-0.42, 0.55, -0.45], spin: [0, 0.28, 0.05], period: 12.0, amp: 0.04, phase: 0.9 });

  function transferMat() {
    const W = 440, H = 300;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#0C1017';
    rr(g, 3, 3, W - 6, H - 6, 20); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 2;
    rr(g, 4, 4, W - 8, H - 8, 20); g.stroke();

    const cx = W * 0.46, cy = H * 0.54;
    /* inner and outer circular orbits */
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.stroke();
    g.beginPath(); g.arc(cx, cy, 108, 0, 7); g.stroke();
    /* the transfer ellipse, tangent to both */
    g.strokeStyle = '#4A9EE0'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx + 37, cy, 71, 62, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#8FE0F5';
    g.beginPath(); g.arc(cx - 34, cy, 5, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + 108, cy, 5, 0, 7); g.fill();

    g.fillStyle = '#8C95A1';
    g.font = '500 21px "JetBrains Mono", monospace';
    g.fillText('LEO → GEO', 24, 40);
    g.fillStyle = '#E8EBEE';
    g.font = '500 25px "JetBrains Mono", monospace';
    g.fillText('Δv 3.89 km/s', 24, H - 28);
    return new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true });
  }

  function canvasTex(c) {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function rr(g, x, y, w, h, r) {
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
    earthMat.uniforms.uCam.value.copy(camera.position);
    atmoMat.uniforms.uCam.value.copy(camera.position);
    for (const m of parts) m.uniforms.uCam.value.copy(camera.position);
  };
  resize();
  addEventListener('resize', resize);

  /* ── motion ────────────────────────────────────────────────
     Earth turns once every four minutes. The ship makes exactly
     one pass on load and then holds; it never loops. */
  const SHIP_FROM = new THREE.Vector3(-1.15, 0.14, 1.60);
  const SHIP_TO = new THREE.Vector3(0.22, -0.16, 1.60);
  const PASS_MS = 9000;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const settle = () => {
    ship.position.copy(SHIP_TO);
    ship.rotation.set(0.30, 0.86, 0.10);
  };

  /* ?still is the capture mode: land on the settled state rather than
     on frame one. Headless Chrome barely runs requestAnimationFrame, so
     without this the entrance pass never advances and the ship is
     photographed still off-frame. */
  const still = new URLSearchParams(location.search).has('still');

  let raf = 0, last = 0;
  const t0 = performance.now();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    const t = (now - t0) / 1000;

    /* 1 revolution / 240s */
    earth.rotation.y = (t / 240) * Math.PI * 2;

    const pass = still ? 1 : Math.min((now - t0) / PASS_MS, 1);
    if (!still) ship.position.lerpVectors(SHIP_FROM, SHIP_TO, ease(pass));
    /* after the pass it drifts, it does not fly again */
    if (pass >= 1) {
      ship.position.x = SHIP_TO.x + Math.sin(t / 14) * 0.035;
      ship.position.y = SHIP_TO.y + Math.sin(t / 11 + 1.4) * 0.022;
    }

    for (const p of props) {
      const a = Math.sin((t / p.period) * Math.PI * 2 + p.phase);
      const e = a * a * a * 0.35 + a * 0.65;
      p.mesh.position.y = p.base.y + e * p.amp;
      p.mesh.position.x = p.base.x + Math.cos((t / (p.period * 1.37)) * Math.PI * 2 + p.phase) * p.amp * 0.4;
      p.mesh.rotation.z += 0.0004;
    }

    renderer.render(scene, camera);
  };

  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (reducedMotion || still) {
    settle();
    renderer.render(scene, camera);
    if (!reducedMotion) start();
  } else {
    settle();
    ship.position.copy(SHIP_FROM);
    start();
  }

  const ready = new Promise((res) => {
    if (tex.image) return res();
    tex.addEventListener?.('load', res);
    const iv = setInterval(() => { if (tex.image) { clearInterval(iv); res(); } }, 60);
    setTimeout(() => { clearInterval(iv); res(); }, 6000);
  });

  return {
    canvas,
    renderer,
    ready,
    /* used once, to bake the poster */
    snapshot: () => {
      settle();
      earth.rotation.y = 0.6;
      renderer.render(scene, camera);
      return canvas.toDataURL('image/webp', 0.84);
    },
  };
}
