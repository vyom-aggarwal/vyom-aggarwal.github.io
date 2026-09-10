/* ═══════════════════════════════════════════════════════════
   rig.js — the research stage.

   Same robot as the hero, same light, but here it walks and the
   scroll position is the trial timeline: steps 0 to 500. One
   joint seizes at the injection point, the gait degrades, and a
   correction redistributes the remaining three legs around the
   locked one.

   This is a schematic of the mechanism, not a replay of a trial.
   The measured numbers live in the table below the stage, and the
   HUD says "Schematic" so the two are never confused.
   ═══════════════════════════════════════════════════════════ */

import { THREE, makeMaterials, makeHalo, buildQuadruped } from './kit.js?v=7dc2c391';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
/* smoothstep between two progress marks */
const ramp = (p, a, b) => {
  const t = clamp01((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function initRig(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(3.4, 0.72, 3.9);
  camera.lookAt(0, -0.06, 0);

  const M = makeMaterials(camera);

  const halo = makeHalo(M.LIMB, { size: 3.4, strength: 0.5 });
  halo.position.set(0, 0.05, -1.6);
  scene.add(halo);

  const { group: robot, legs } = buildQuadruped(M);
  robot.rotation.y = -0.36;
  robot.scale.setScalar(0.82);
  scene.add(robot);

  /* the joint that seizes. Front-left, the leg nearest this camera,
     so the fault colour is actually visible rather than hidden
     behind the trunk. */
  const LOCKED = 0;
  /* Recolour the whole limb, not just the two joints: from a
     three-quarter view either joint can end up behind the trunk,
     and a fault you cannot see is not worth animating. */
  const lockedParts = [
    legs[LOCKED].kneeJoint,
    legs[LOCKED].hipJoint,
    legs[LOCKED].shank,
    legs[LOCKED].foot,
  ];
  const lockedRest = lockedParts.map((m) => m.material);

  /* A callout ring on the seized joint. It draws over the geometry
     rather than behind it, because from a three-quarter view the
     faulted leg can sit behind the trunk and a fault you cannot see
     is not worth animating. */
  const mark = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.012, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xE0674A, transparent: true, opacity: 0, depthTest: false })
  );
  mark.renderOrder = 10;
  legs[LOCKED].kneeG.add(mark);

  const state = { speed: 1, progress: 0 };
  let gaitPhase = 0;

  /* ── ground plane: a thin rule the feet travel over, so the
     forward motion has something to be relative to ────────── */
  const groundGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = -14; i <= 14; i++) pts.push(i * 0.22, -0.92, -1.6, i * 0.22, -0.92, 1.6);
  groundGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ground = new THREE.LineSegments(
    groundGeo,
    new THREE.LineBasicMaterial({ color: M.LIMB, transparent: true, opacity: 0.10 })
  );
  scene.add(ground);

  /* ── gait ──────────────────────────────────────────────────
     A trot: the two diagonals alternate. Amplitude scales with
     speed, so as the fault slows the robot the stride shortens
     rather than the animation simply playing slower. */
  function pose(t) {
    const p = state.progress;
    const amp = 0.34 * state.speed;
    const kneeAmp = 0.30 * state.speed;

    legs.forEach((leg, i) => {
      const locked = i === LOCKED && p > 0.38;
      if (locked) {
        /* a seized joint holds its angle; that is the whole point */
        leg.hipG.rotation.z = lerp(leg.hipG.rotation.z, leg.rest.hip + 0.30, 0.08);
        leg.kneeG.rotation.z = lerp(leg.kneeG.rotation.z, -leg.rest.knee - 0.42, 0.08);
        return;
      }
      const ph = (t * 1.9 * state.speed + leg.rest.phase * Math.PI * 2);
      /* after the correction engages the healthy legs take a wider
         stride to carry the locked one */
      const carry = i === LOCKED ? 0 : ramp(p, 0.52, 0.66) * 0.16;
      leg.hipG.rotation.z = leg.rest.hip + Math.sin(ph) * (amp + carry);
      leg.kneeG.rotation.z = -leg.rest.knee + Math.max(0, Math.cos(ph)) * kneeAmp;
    });

    /* body bob and pitch follow the gait, and the fault throws a
       roll the correction slowly takes back out */
    const fault = ramp(p, 0.38, 0.5);
    const fixed = ramp(p, 0.52, 0.68);
    const tilt = fault * 0.20 * (1 - fixed * 0.82);
    robot.position.y = 0.06 + Math.sin(t * 3.8 * state.speed) * 0.018 * state.speed - fault * 0.05 * (1 - fixed * 0.7);
    robot.rotation.x = tilt * 0.6;
    robot.rotation.z = 0.03 - tilt;
  }

  /* velocity profile across the trial: nominal, collapse at the
     injection, partial recovery once the residual engages */
  function speedFor(p) {
    const drop = ramp(p, 0.38, 0.48);
    const back = ramp(p, 0.52, 0.65);
    return 1 - drop * 0.72 + back * 0.72;
  }

  function setProgress(p) {
    state.progress = clamp01(p);
    state.speed = speedFor(state.progress);
    /* the locked joint turns from signal blue to the fault colour */
    const f = ramp(state.progress, 0.38, 0.46);
    lockedParts.forEach((m, i) => { m.material = f > 0.5 ? M.FAULT : lockedRest[i]; });
    mark.material.opacity = f * 0.95;
    mark.scale.setScalar(1 + (1 - f) * 1.6);
  }

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

  let raf = 0, last = 0, visible = true;
  const t0 = performance.now();

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return;
    last = now;
    const t = (now - t0) / 1000;
    /* the ground slides to read as forward travel */
    ground.position.x = -((t * 0.42 * state.speed) % 0.22);
    mark.quaternion.copy(camera.quaternion);
    pose(t);
    renderer.render(scene, camera);
  };

  const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  /* the stage is one screen tall inside a very long block, so it
     is off-screen most of the page; do not render it then */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    }, { rootMargin: '120px' }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (reducedMotion) {
    pose(0);
    renderer.render(scene, camera);
  } else {
    start();
  }

  return { setProgress, state };
}
