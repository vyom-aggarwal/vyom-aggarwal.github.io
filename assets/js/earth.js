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

import * as THREE from './three.module.min.js?v=caeddb67';

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
    /* Double-sided parts — the nozzle bell and the dish — show their
       back faces, whose normals point away from the camera. Without
       this flip the fresnel term is inverted and the inside of the
       bell blows out to white. */
    if (!gl_FrontFacing) N = -N;
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
  const partMat = (hex, { amb = 0.05, rimStr = 1.5, side = THREE.FrontSide } = {}) => {
    const m = new THREE.ShaderMaterial({
      side,
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
  const CARBON = partMat('#0E1116', { amb: 0.045, rimStr: 1.5 });
  /* the bell interior and the dish are seen from inside as well as out */
  const BELL   = partMat('#1A1F26', { amb: 0.05, rimStr: 1.7, side: THREE.DoubleSide });
  const DISH   = partMat('#79828B', { amb: 0.07, rimStr: 1.9, side: THREE.DoubleSide });

  /* ── Earth ─────────────────────────────────────────────────
     Off-centre and oversized so the panel crops it: the curve
     leaves the frame rather than sitting inside it. */
  const globe = new THREE.Group();
  globe.position.set(1.02, -0.86, 0);

  const tex = new THREE.TextureLoader().load('assets/img/earth-2k.webp?v=5b8afb06');
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
     An original vehicle, not a recognisable real one, and now the
     only object in the frame besides the planet.

     Forward instrument section, an octagonal service bus under a
     multi-layer-insulation band, two ribbed radiator wings, a
     high-gain dish on a boom, a three-longeron Warren truss
     carrying a pair of propellant tanks, and a lathed nozzle bell.
     It still reads as a silhouette with one limb-lit edge; the
     detail is there so the edge has something to describe.

     +x is forward, so the whole vehicle pitches with one rotation.
     Nothing uses negative scale: a mirrored scale flips the normals
     and the fresnel rim would light the wrong side. */
  const ship = new THREE.Group();
  {
    /* Octagonal prisms read as machined hardware where a box reads
       as a crate, and they give the rim light a facet edge to catch. */
    const prism = (r, len, m, seg = 8) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
      mesh.rotation.z = Math.PI / 2;
      return mesh;
    };
    const UP = new THREE.Vector3(0, 1, 0);
    const aim = (mesh, dir) => {
      mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
      return mesh;
    };

    /* ── service bus ── */
    ship.add(prism(0.078, 0.30, HULL));
    for (const x of [0.158, -0.158]) {
      const cap = prism(0.064, 0.018, HULL);
      cap.position.x = x;
      ship.add(cap);
    }
    /* MLI blanket around the middle of the bus */
    ship.add(prism(0.0815, 0.115, GOLD));
    /* two longitudinal stringers */
    for (const ang of [Math.PI * 0.25, Math.PI * -0.25]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.008, 0.018), DARK);
      st.position.set(0, Math.sin(ang) * 0.080, Math.cos(ang) * 0.080);
      st.rotation.x = -ang;
      ship.add(st);
    }

    /* ── forward instrument section ── */
    const fwd = prism(0.050, 0.11, SHELL);
    fwd.position.x = 0.225;
    ship.add(fwd);
    const collar = prism(0.057, 0.014, DARK);
    collar.position.x = 0.170;
    ship.add(collar);
    const barrel = prism(0.030, 0.042, DARK, 16);
    barrel.position.x = 0.300;
    ship.add(barrel);
    const lens = prism(0.026, 0.006, BLUE, 16);
    lens.position.x = 0.322;
    ship.add(lens);

    /* ── RCS clusters, four around the forward section ── */
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const dir = new THREE.Vector3(0, Math.sin(ang), Math.cos(ang));
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.010, 0.022, 8), DARK);
      aim(pod, dir);
      pod.position.set(0.192, dir.y * 0.058, dir.z * 0.058);
      ship.add(pod);
    }

    /* ── radiator wings ──
       Built per side with explicit sign rather than a mirrored
       scale, for the normals reason above. */
    for (const sy of [1, -1]) {
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.058, 8), SHELL);
      boom.position.set(-0.02, sy * 0.052, 0);
      ship.add(boom);

      const yPanel = sy * 0.098;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.0045, 0.135), GOLD);
      panel.position.set(-0.02, yPanel, 0);
      panel.rotation.x = sy * 0.16;
      ship.add(panel);

      /* ribs: a flat plate with no structure reads as a sticker */
      for (let i = 0; i < 5; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.011, 0.137), CARBON);
        rib.position.set(-0.12 + i * 0.05, yPanel, 0);
        rib.rotation.x = sy * 0.16;
        ship.add(rib);
      }
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.262, 0.012, 0.009), CARBON);
      spar.position.set(-0.02, yPanel, 0);
      spar.rotation.x = sy * 0.16;
      ship.add(spar);
    }

    /* ── high-gain antenna on a boom ── */
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.085, 6), SHELL);
    aim(arm, new THREE.Vector3(0.15, 0.72, 0.68));
    arm.position.set(0.055, 0.040, 0.058);
    ship.add(arm);

    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2.7), DISH);
    aim(dish, new THREE.Vector3(-0.15, -0.72, -0.68));
    dish.position.set(0.078, 0.062, 0.108);
    ship.add(dish);

    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.040, 6), DARK);
    aim(feed, new THREE.Vector3(0.15, 0.72, 0.68));
    feed.position.set(0.072, 0.054, 0.092);
    ship.add(feed);

    /* ── truss: three longerons, ring frames, alternating diagonals ── */
    const TR = 0.048, X0 = -0.178, BAY = 0.070, BAYS = 3;
    const nodes = [];
    for (let b = 0; b <= BAYS; b++) {
      const x = X0 - b * BAY;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(TR, 0.0035, 6, 18), CARBON);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = x;
      ship.add(ring);
      const row = [];
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
        row.push(new THREE.Vector3(x, Math.sin(ang) * TR, Math.cos(ang) * TR));
      }
      nodes.push(row);
    }
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const lon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0046, 0.0046, BAY * BAYS, 6), SHELL);
      lon.rotation.z = Math.PI / 2;
      lon.position.set(X0 - (BAY * BAYS) / 2, Math.sin(ang) * TR, Math.cos(ang) * TR);
      ship.add(lon);
    }
    const strut = (from, to) => {
      const d = new THREE.Vector3().subVectors(to, from);
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0033, 0.0033, d.length(), 5), CARBON);
      aim(m, d);
      m.position.copy(from).add(to).multiplyScalar(0.5);
      ship.add(m);
    };
    for (let b = 0; b < BAYS; b++) {
      for (let i = 0; i < 3; i++) {
        /* handedness alternates bay to bay, which is what makes it
           read as a truss rather than as a cage */
        const j = (b % 2 === 0) ? (i + 1) % 3 : (i + 2) % 3;
        strut(nodes[b][i], nodes[b + 1][j]);
      }
    }

    /* ── propellant tanks flanking the truss ── */
    for (const sz of [1, -1]) {
      const at = new THREE.Vector3(-0.248, -0.012, sz * 0.080);
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.046, 22, 16), SHELL);
      tank.position.copy(at);
      ship.add(tank);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.0475, 0.0035, 6, 18), CARBON);
      strap.rotation.y = Math.PI / 2;
      strap.position.copy(at);
      ship.add(strap);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.115, 5), CARBON);
      line.rotation.z = Math.PI / 2;
      line.position.set(-0.337, -0.012, sz * 0.080);
      ship.add(line);
    }

    /* ── engine: mount, throat, lathed bell ── */
    const mount = prism(0.052, 0.022, SHELL);
    mount.position.x = -0.400;
    ship.add(mount);
    const throat = prism(0.019, 0.032, DARK, 16);
    throat.position.x = -0.421;
    ship.add(throat);

    /* A real bell is a curve. A cone is not, and it shows. */
    const bell = new THREE.Mesh(new THREE.LatheGeometry([
      new THREE.Vector2(0.019, 0),
      new THREE.Vector2(0.023, 0.014),
      new THREE.Vector2(0.031, 0.034),
      new THREE.Vector2(0.042, 0.058),
      new THREE.Vector2(0.054, 0.086),
      new THREE.Vector2(0.064, 0.116),
    ], 28), BELL);
    bell.rotation.z = Math.PI / 2;      /* lathe axis +y maps to -x */
    bell.position.x = -0.436;
    ship.add(bell);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.0036, 6, 26), SHELL);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = -0.552;
    ship.add(lip);

    /* Held to 8% of the window width, which is the cap set for it. */
    ship.scale.setScalar(0.222);
    ship.rotation.set(0.30, 0.86, 0.10);
  }
  scene.add(ship);

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
