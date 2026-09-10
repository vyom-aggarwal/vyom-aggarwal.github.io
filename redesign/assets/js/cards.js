/* ═══════════════════════════════════════════════════════════
   cards.js — the two project-card models.

   Neither runs by default. Each card ships a poster, and WebGL is
   stood up only when that card is hovered, focused or opened, so
   the page never holds three live contexts at once.

   Both scenes use the same materials and the same single cyan key
   as the hero, because they are objects in the same room.
   ═══════════════════════════════════════════════════════════ */

import { THREE, makeMaterials, makeHalo, buildQuadruped, sph } from './kit.js?v=d40bb7a4';
import { CA, RESIDUES, TRIAD } from './lipase.js?v=d40bb7a4';

/* ── shared scaffolding ──────────────────────────────────── */
function stage(canvas, { fov = 30, at = [2.6, 0.9, 3.4], look = [0, 0, 0] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1.6, 0.1, 100);
  camera.position.set(...at);
  camera.lookAt(...look);

  const M = makeMaterials(camera);

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

  return { renderer, scene, camera, M, resize };
}

/* ── card A: the quadruped, mid-stride ───────────────────── */
function quadruped(canvas) {
  const s = stage(canvas, { fov: 28, at: [2.9, 0.72, 3.6], look: [0, -0.05, 0] });

  const halo = makeHalo(s.M.LIMB, { size: 3.6, strength: 0.20 });
  halo.position.set(-0.15, 0.05, -1.4);
  s.scene.add(halo);

  const { group, legs } = buildQuadruped(s.M);
  group.rotation.y = -0.38;
  group.scale.setScalar(0.78);
  s.scene.add(group);

  /* Held mid-stride rather than walking: the card is a door, and a
     looping gait on a thumbnail is noise. Hover gives it a slow
     turn and a breath, nothing more. */
  legs.forEach((leg, i) => {
    const swing = i === 0 || i === 3 ? -0.30 : 0.24;
    leg.hipG.rotation.z = leg.rest.hip + swing;
    leg.kneeG.rotation.z = -leg.rest.knee + (i % 2 ? 0.16 : 0.06);
  });

  return {
    ...s,
    tick(t, active) {
      group.rotation.y = -0.38 + (active ? Math.sin(t * 0.5) * 0.16 : 0);
      group.position.y = active ? Math.sin(t * 0.9) * 0.012 : 0;
    },
  };
}

/* ── card B: the target, and what the app refuses to do to it ──
   Not a protein for decoration. The model is the seeded target with
   the app's defining behaviour drawn on it:

     · the real backbone of B. subtilis lipase A, from AlphaFold
     · its catalytic triad picked out as the constraint set, which
       the app suggests from annotations and will not apply on your
       behalf, and will not let you mutate once you have set it
     · the catalytic serine carrying two labels at once, Ser77 and
       Ser108, because that residue has two numbers and refusing to
       guess between them is the first thing the product does

   Everything shown is read from the structure file. No score, no
   ranking and no mutation code appears here, because those would be
   predictions and this site does not invent them. */
function protein(canvas) {
  const s = stage(canvas, { fov: 30, at: [0, 0.15, 3.5], look: [0, 0, 0] });

  const halo = makeHalo(s.M.LIMB, { size: 3.6, strength: 0.17 });
  halo.position.set(-0.10, 0.02, -1.4);
  s.scene.add(halo);

  const group = new THREE.Group();

  const at = (i) => new THREE.Vector3(CA[i * 3], CA[i * 3 + 1], CA[i * 3 + 2]);
  const points = [];
  for (let i = 0; i < RESIDUES; i++) points.push(at(i));

  /* The backbone as a tube through the alpha carbons. A CA trace of a
     helix is itself a helix, so the secondary structure reads without
     a cartoon renderer. */
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const ribbon = new THREE.Mesh(
    new THREE.TubeGeometry(curve, RESIDUES * 5, 0.026, 8, false),
    s.M.mat(s.M.SIGNAL.clone(), { amb: 0.20, rimStr: 1.5 })
  );
  group.add(ribbon);

  /* the constraint set: the three residues the app will not touch */
  const LOCK = s.M.mat(s.M.LIMB.clone(), { amb: 0.45, rimStr: 1.1 });
  const labels = [];
  for (const t of TRIAD) {
    const p = at(t.at - 1);                 /* file numbering is 1-based */
    const node = sph(0.075, LOCK);
    node.position.copy(p);
    group.add(node);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.011, 6, 22), LOCK);
    ring.position.copy(p);
    group.add(ring);
    labels.push({ ring });
  }

  /* The serine gets both of its numbers, side by side. This is the
     product's worked example: one residue, two schemes, 31 apart. */
  const ser = at(TRIAD[0].at - 1);
  for (const [text, dy] of [['Ser77 · mature', 0.30], ['Ser108 · precursor', 0.16]]) {
    const tag = makeLabel(text, '#8FE0F5');
    tag.position.set(ser.x + 0.46, ser.y + dy, ser.z);
    group.add(tag);
  }
  const leader = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.34, 4),
    s.M.mat(s.M.LIMB.clone(), { amb: 0.6, rimStr: 0 })
  );
  leader.position.set(ser.x + 0.17, ser.y + 0.09, ser.z);
  leader.rotation.z = -1.05;
  group.add(leader);

  group.rotation.set(0.1, -0.5, 0.15);
  group.position.set(-0.30, -0.05, 0);
  group.scale.setScalar(1.34);
  s.scene.add(group);

  return {
    ...s,
    tick(t, active) {
      group.rotation.y = -0.5 + (active ? Math.sin(t * 0.4) * 0.22 : 0);
      for (const l of labels) l.ring.rotation.z += active ? 0.006 : 0;
    },
  };
}

/* a flat mono tag that always faces the camera */
function makeLabel(text, colour) {
  const pad = 18, size = 34;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `500 ${size}px "JetBrains Mono", monospace`;
  const w = Math.ceil(m.measureText(text).width) + pad * 2;
  const h = size + pad * 2;

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,16,23,.88)';
  g.strokeStyle = 'rgba(143,224,245,.34)';
  g.lineWidth = 2;
  const r = 14;
  g.beginPath();
  g.moveTo(r, 1); g.arcTo(w - 1, 1, w - 1, h - 1, r); g.arcTo(w - 1, h - 1, 1, h - 1, r);
  g.arcTo(1, h - 1, 1, 1, r); g.arcTo(1, 1, w - 1, 1, r); g.closePath();
  g.fill(); g.stroke();

  g.fillStyle = colour;
  g.font = `500 ${size}px "JetBrains Mono", monospace`;
  g.textBaseline = 'middle';
  g.fillText(text, pad, h / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 5;
  sprite.scale.set((w / h) * 0.115, 0.115, 1);
  return sprite;
}

/* ── public entry ────────────────────────────────────────── */
const BUILDERS = { quadruped, protein, scan: initProteinScan };

export function initCardModel(canvas, kind) {
  const build = BUILDERS[kind];
  if (!build) return null;

  const rig = build(canvas);
  rig.resize();
  addEventListener('resize', rig.resize);

  let raf = 0, last = 0, active = false;
  const t0 = performance.now();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    rig.tick((now - t0) / 1000, active);
    rig.renderer.render(rig.scene, rig.camera);
  };

  rig.tick(0, false);
  rig.renderer.render(rig.scene, rig.camera);
  raf = requestAnimationFrame(frame);

  return {
    setActive(v) { active = v; },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    /* Used once, to bake the poster. The render and the read have to
       happen in the same task: WebGL clears the drawing buffer after
       compositing, so a toDataURL a tick later returns an empty
       image. */
    snapshot() {
      rig.tick(0, false);
      rig.renderer.render(rig.scene, rig.camera);
      return canvas.toDataURL('image/webp', 0.88);
    },
  };
}

/* ═══════════════════════════════════════════════════════════
   The project-B simulation: scoring the substitution space.

   The app scores every single-point substitution and then
   narrows. This runs that sweep down the chain — a marker
   travelling residue by residue, each scored position left
   behind as a dot — and when it reaches one of the three
   constrained residues it refuses and steps over it.

   Nothing here is a prediction. A dot means "this position was
   visited", not "this substitution is good"; the constrained
   three are the ones the README says the app will not touch.
   ═══════════════════════════════════════════════════════════ */

const SCAN_VERT = `
  attribute float aOn;
  varying float vOn;
  void main() {
    vOn = aOn;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (3.0 + aOn * 7.0) * (2.6 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const SCAN_FRAG = `
  uniform vec3 uDim;
  uniform vec3 uHot;
  varying float vOn;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float edge = smoothstep(0.5, 0.34, r);
    vec3 col = mix(uDim, uHot, vOn);
    float a = edge * (0.16 + vOn * 0.84);
    gl_FragColor = vec4(col * a, a);        /* premultiplied */
  }`;

export function initProteinScan(canvas, { reducedMotion = false } = {}) {
  const s = stage(canvas, { fov: 30, at: [0, 0.1, 3.15], look: [0, 0, 0] });

  const halo = makeHalo(s.M.LIMB, { size: 3.8, strength: 0.16 });
  halo.position.set(0, 0, -1.5);
  s.scene.add(halo);

  const group = new THREE.Group();
  const at = (i) => new THREE.Vector3(CA[i * 3], CA[i * 3 + 1], CA[i * 3 + 2]);
  const points = [];
  for (let i = 0; i < RESIDUES; i++) points.push(at(i));

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  group.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve, RESIDUES * 5, 0.022, 8, false),
    s.M.mat(s.M.SIGNAL.clone(), { amb: 0.16, rimStr: 1.3 })
  ));

  /* one dot per residue, lit as the sweep passes it */
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const on = new Float32Array(RESIDUES);
  geo.setAttribute('aOn', new THREE.BufferAttribute(on, 1));
  const dots = new THREE.Points(geo, new THREE.ShaderMaterial({
    vertexShader: SCAN_VERT,
    fragmentShader: SCAN_FRAG,
    uniforms: {
      uDim: { value: new THREE.Color('#3E5568') },
      uHot: { value: s.M.LIMB.clone() },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  group.add(dots);

  /* the constraint set, refused rather than scored */
  const LOCK = s.M.mat('#E0674A', { amb: 0.5, rimStr: 1.0 });
  const locked = new Set(TRIAD.map((t) => t.at - 1));
  const rings = TRIAD.map((t) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.010, 6, 22), LOCK);
    ring.position.copy(at(t.at - 1));
    group.add(ring);
    return ring;
  });

  group.rotation.set(0.08, -0.5, 0.12);
  group.position.set(-1.05, 0, 0);
  group.scale.setScalar(1.45);
  s.scene.add(group);

  /* readout, redrawn a few times a second rather than every frame */
  const read = document.createElement('canvas');
  read.width = 512; read.height = 96;
  const rg = read.getContext('2d');
  const readTex = new THREE.CanvasTexture(read);
  readTex.colorSpace = THREE.SRGBColorSpace;
  const readout = new THREE.Sprite(new THREE.SpriteMaterial({ map: readTex, transparent: true, depthTest: false }));
  readout.renderOrder = 6;
  readout.scale.set(1.62, 0.304, 1);
  readout.position.set(0.85, 0.06, 0);
  s.scene.add(readout);

  let lastText = '';
  const draw = (text, refusing) => {
    if (text === lastText) return;
    lastText = text;
    rg.clearRect(0, 0, 512, 96);
    rg.fillStyle = 'rgba(12,16,23,.86)';
    rg.strokeStyle = refusing ? 'rgba(224,103,74,.5)' : 'rgba(143,224,245,.28)';
    rg.lineWidth = 2;
    rg.beginPath(); rg.roundRect(1, 1, 510, 94, 16); rg.fill(); rg.stroke();
    rg.fillStyle = refusing ? '#E0674A' : '#8FE0F5';
    rg.font = '500 30px "JetBrains Mono", monospace';
    rg.textBaseline = 'middle';
    rg.fillText(text, 26, 50);
    readTex.needsUpdate = true;
  };

  let i = 0, acc = 0, hold = 0, refusing = false;
  const step = () => {
    if (hold > 0) { hold -= 1; return; }
    if (locked.has(i)) {
      refusing = true;
      hold = 26;                       /* stop, say why, then step over */
      const t = TRIAD.find((x) => x.at - 1 === i);
      draw('refused · ' + t.code + ' · constrained', true);
      i += 1;
      return;
    }
    refusing = false;
    on[i] = 1;
    draw('scoring ' + String(i + 1).padStart(3, '0') + ' / ' + RESIDUES, false);
    i += 1;
    if (i >= RESIDUES) { i = 0; on.fill(0); }
    geo.attributes.aOn.needsUpdate = true;
  };

  draw('scoring 001 / ' + RESIDUES, false);

  return {
    ...s,
    tick(t, active) {
      group.rotation.y = -0.5 + Math.sin(t * 0.16) * 0.34;
      for (const r of rings) r.rotation.z += 0.02;
      if (reducedMotion) return;
      acc += 1;
      if (acc % 2 === 0) step();
    },
  };
}
