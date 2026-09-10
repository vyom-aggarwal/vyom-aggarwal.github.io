/* ═══════════════════════════════════════════════════════════
   cards.js — the two project-card models.

   Neither runs by default. Each card ships a poster, and WebGL is
   stood up only when that card is hovered, focused or opened, so
   the page never holds three live contexts at once.

   Both scenes use the same materials and the same single cyan key
   as the hero, because they are objects in the same room.
   ═══════════════════════════════════════════════════════════ */

import { THREE, makeMaterials, makeHalo, buildQuadruped, box, cyl } from './kit.js?v=8b45094b';

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

/* ── card B: the console slab ────────────────────────────────
   A hard-surface device tilted in space with the application's own
   screen on its face, so the model is both an object in the scene
   and an honest picture of the interface. The amber bar is on it
   because the seeded providers are synthetic and hiding that would
   be the exact fabrication the app exists to prevent. */
function consoleSlab(canvas) {
  const s = stage(canvas, { fov: 30, at: [2.1, 0.95, 3.6], look: [0, -0.02, 0] });

  const halo = makeHalo(s.M.LIMB, { size: 3.6, strength: 0.17 });
  halo.position.set(-0.10, 0.02, -1.4);
  s.scene.add(halo);

  const slab = new THREE.Group();

  /* body and bezel */
  const bodyMat = s.M.mat('#1B212A', { amb: 0.10, rimStr: 1.9 });
  slab.add(box(2.08, 1.34, 0.075, bodyMat));
  const back = box(1.30, 0.72, 0.05, s.M.STRUCT);
  back.position.z = -0.062;
  slab.add(back);

  /* the screen itself */
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.96, 1.22),
    new THREE.MeshBasicMaterial({ map: screenTexture(), transparent: true })
  );
  screen.position.z = 0.0395;
  slab.add(screen);

  /* one anodised detail and a pair of feet, so it reads as hardware
     rather than as a floating rectangle */
  const strip = box(0.30, 0.035, 0.012, s.M.JOINT);
  strip.position.set(-0.80, -0.625, 0.045);
  slab.add(strip);
  for (const sx of [-1, 1]) {
    const foot = cyl(0.045, 0.16, s.M.SHELL, 12);
    foot.rotation.z = 0;
    foot.position.set(sx * 0.72, -0.75, -0.02);
    slab.add(foot);
  }

  slab.rotation.set(0.10, -0.42, 0.03);
  slab.scale.setScalar(0.72);
  s.scene.add(slab);

  return {
    ...s,
    tick(t, active) {
      slab.rotation.y = -0.42 + (active ? Math.sin(t * 0.45) * 0.14 : 0);
      slab.rotation.x = 0.10 + (active ? Math.sin(t * 0.7) * 0.03 : 0);
    },
  };
}

/* The workbench, drawn rather than screenshotted, so it stays legible
   at card size and carries no numbers this site cannot support. */
function screenTexture() {
  const W = 1024, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#0C1017';
  g.fillRect(0, 0, W, H);

  /* title bar */
  g.fillStyle = '#151B24';
  g.fillRect(0, 0, W, 58);
  g.fillStyle = '#8C95A1';
  g.font = '500 22px "JetBrains Mono", monospace';
  g.fillText('codon lab  ·  variant workbench', 26, 37);
  g.fillStyle = '#4A9EE0';
  g.fillText('10,450', W - 210, 37);
  g.fillStyle = '#5A6470';
  g.fillText('ranked', W - 120, 37);

  /* the synthetic-data bar */
  g.fillStyle = '#3A2A12';
  g.fillRect(0, 58, W, 40);
  g.fillStyle = '#E0A24A';
  g.fillRect(0, 58, 5, 40);
  g.font = '500 19px "JetBrains Mono", monospace';
  g.fillText('synthetic providers — every number badged', 24, 85);

  /* column heads */
  const X = [30, 250, 430, 610, 800];
  g.fillStyle = '#5A6470';
  g.font = '500 17px "JetBrains Mono", monospace';
  ['variant', 'ddG kcal/mol', 'agreement', 'rsa', 'rank'].forEach((h, i) => g.fillText(h, X[i], 132));
  g.strokeStyle = 'rgba(255,255,255,.12)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(24, 148); g.lineTo(W - 24, 148); g.stroke();

  /* rows */
  const rows = [
    ['S77A', '-1.42', '2 / 3', '0.08', '01'],
    ['L142V', '-1.18', '3 / 3', '0.11', '02'],
    ['T96S', '-0.94', '2 / 3', '0.31', '03'],
    ['A209G', '-0.71', '2 / 3', '0.44', '04'],
    ['V54I', '-0.66', '1 / 3', '0.06', '05'],
    ['N118D', '-0.52', '3 / 3', '0.52', '06'],
    ['G163A', '-0.35', '2 / 3', '0.19', '07'],
    ['I88L', '—', '—', '0.27', '08'],
  ];
  rows.forEach((r, i) => {
    const y = 190 + i * 52;
    if (i % 2 === 1) { g.fillStyle = 'rgba(255,255,255,.02)'; g.fillRect(24, y - 32, W - 48, 46); }
    g.font = '500 20px "JetBrains Mono", monospace';
    g.fillStyle = i === 0 ? '#E8EBEE' : '#A3ACB6';
    g.fillText(r[0], X[0], y);
    g.fillStyle = r[1] === '—' ? '#5A6470' : '#A3ACB6';
    g.fillText(r[1], X[1], y);
    /* the badge that marks an invented number */
    if (r[1] !== '—') {
      g.fillStyle = '#E0A24A';
      g.beginPath(); g.arc(X[1] + 108, y - 12, 4, 0, 7); g.fill();
    }
    g.fillStyle = '#5A6470';
    g.fillText(r[2], X[2], y);
    g.fillText(r[3], X[3], y);
    g.fillStyle = '#4A9EE0';
    g.fillText(r[4], X[4], y);
  });

  /* the left rule marking the row in focus */
  g.fillStyle = '#4A9EE0';
  g.fillRect(24, 158, 3, 46);

  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── public entry ────────────────────────────────────────── */
const BUILDERS = { quadruped, console: consoleSlab };

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
