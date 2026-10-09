/* ═══════════════════════════════════════════════════════════
   cards.js — the two project-card models.

   Neither runs by default. Each card ships a poster, and WebGL is
   stood up only when that card is hovered, focused or opened, so
   the page never holds three live contexts at once.

   Both scenes use the same materials and the same single cyan key
   as the hero, because they are objects in the same room.
   ═══════════════════════════════════════════════════════════ */

import { THREE, makeMaterials, makeHalo, buildQuadruped, sph } from './kit.js?v=ade0bd71';
import { simulate, fromTargets } from './oberth.js?v=ade0bd71';

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

/* ── card B: one flyby, with the burn picked out ─────────────
   A planet, the path a spacecraft takes past it, and the stretch of
   that path on which the engine is on.

   The path is not drawn by hand. It is the Oberth atlas's own
   simulator flown once, for a burn lasting three periapsis
   timescales (Π = 3) at an arrival speed of 0.45 of the escape
   speed at periapsis; the bright arc is the segment it reports as
   thrusting. The planet is drawn larger than the point
   mass the model uses, so there is something to look at.

   No number appears here, because the card is a door and the
   numbers are behind it. */
function oberth(canvas) {
  const s = stage(canvas, { fov: 30, at: [0, 0.45, 5.1], look: [0, 0.0, 0] });

  const halo = makeHalo(s.M.LIMB, { size: 4.2, strength: 0.15 });
  halo.position.set(0, -0.2, -1.6);
  s.scene.add(halo);

  const run = simulate({ ...fromTargets(3, 0.45, 0.1, 0.3), record: true });

  /* sim x is toward periapsis and y along the flight; the scene puts
     periapsis above the planet and the flight left to right */
  const pts = { pre: [], burn: [], post: [] };
  const names = ['pre', 'burn', 'post'];
  run.segments.forEach((seg, i) => {
    seg.y.forEach((st, k) => {
      /* the legs are cut where they leave the frame */
      if (Math.hypot(st[0], st[1]) <= 3.0 && (i === 0 || k > 0)) pts[names[i]].push(new THREE.Vector3(st[1], st[0], 0));
    });
  });
  /* each part starts where the last one ended, so the tubes meet */
  pts.burn.unshift(pts.pre[pts.pre.length - 1].clone());
  pts.post.unshift(pts.burn[pts.burn.length - 1].clone());

  const group = new THREE.Group();

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 40, 28),
    s.M.mat('#26303C', { amb: 0.30, rimStr: 1.9, rimPow: 2.4 })
  );
  group.add(planet);

  const coast = s.M.mat(s.M.SIGNAL.clone(), { amb: 0.34, rimStr: 1.4 });
  const burnMat = s.M.mat(s.M.LIMB.clone(), { amb: 0.85, rimStr: 0.6 });
  const tube = (list, radius, mat) => new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(list, false, 'catmullrom', 0.4), list.length * 3, radius, 8, false),
    mat
  );
  group.add(tube(pts.pre, 0.03, coast));
  group.add(tube(pts.post, 0.03, coast));
  group.add(tube(pts.burn, 0.07, burnMat));

  /* the craft rides the whole path when the card is live and rests at
     the middle of the burn when it is not */
  const whole = new THREE.CatmullRomCurve3([...pts.pre, ...pts.burn.slice(1), ...pts.post.slice(1)], false, 'catmullrom', 0.4);
  const craft = sph(0.095, s.M.mat('#E8EBEE', { amb: 0.9, rimStr: 0.5 }));
  group.add(craft);
  const rest = pts.burn[Math.floor(pts.burn.length / 2)];
  craft.position.copy(rest);

  group.rotation.set(-0.30, 0, 0);
  group.position.set(0, -0.38, 0);
  s.scene.add(group);

  return {
    ...s,
    tick(t, active) {
      group.rotation.y = active ? Math.sin(t * 0.35) * 0.22 : 0;
      if (active) craft.position.copy(whole.getPointAt((t * 0.09) % 1));
      else craft.position.copy(rest);
    },
  };
}

/* ── public entry ────────────────────────────────────────── */
const BUILDERS = { quadruped, oberth };

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
