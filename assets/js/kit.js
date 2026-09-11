/* ═══════════════════════════════════════════════════════════
   kit.js — the shared 3D vocabulary.

   Both the hero object and the research stage are the same
   machine under the same light, so the shader, the materials and
   the quadruped itself live here and neither scene keeps its own
   copy of them.

   The lighting model is deliberately not a physical one. On the
   night side the atmosphere is the only source, so there is one
   cyan key from the upper left, a fresnel rim in the same cyan,
   and a weak bounce from below to keep the underside off black.
   ═══════════════════════════════════════════════════════════ */

import * as THREE from './three.module.min.js?v=fa8951bc';

export const KEY = new THREE.Vector3(-0.78, 0.40, 0.52);

/* read the palette off the tokens so this file never holds a
   second copy of the truth */
export const css = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
};

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
    float b = max(dot(N, vec3(-0.2, -1.0, 0.3)), 0.0) * 0.12;
    float f = pow(1.0 - max(dot(N, V), 0.0), uRimPow);
    vec3 col = uBase * (uAmb + (1.0 - uAmb) * d + b) + uRim * f * uRimStr;
    gl_FragColor = vec4(col, 1.0);
  }`;

const HALO_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const HALO_FRAG = `
  uniform vec3  uRim;
  uniform float uStr;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = pow(max(1.0 - r, 0.0), 2.2) * uStr;
    /* Three's canvas is premultiplied, so AdditiveBlending uses
       blendSrc = ONE. Writing vec4(colour, a) adds the full colour
       regardless of a, which blows the halo out to white. */
    gl_FragColor = vec4(uRim * a, a);
  }`;

/* ── materials ────────────────────────────────────────────
   Returns a palette plus the list of materials whose uCam has to
   follow the camera on resize. */
export function makeMaterials(camera) {
  const LIMB = css('--limb', '#8FE0F5');
  const SIGNAL = css('--signal', '#4A9EE0');
  const all = [];

  const mat = (hex, { amb = 0.30, rimStr = 1.0, rimPow = 3.0 } = {}) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uBase:   { value: new THREE.Color(hex) },
        uRim:    { value: LIMB.clone() },
        uKey:    { value: KEY.clone() },
        uCam:    { value: camera.position.clone() },
        uAmb:    { value: amb },
        uRimStr: { value: rimStr },
        uRimPow: { value: rimPow },
      },
    });
    all.push(m);
    return m;
  };

  return {
    LIMB,
    SIGNAL,
    all,
    mat,
    /* Shells stay off-white; against --void they read as luminous
       with no change to albedo. The blue sits on joints only, pulled
       a little toward grey because it gains saturation on a near-black
       ground and otherwise looks like plastic. */
    SHELL:  mat('#E4E7EA', { amb: 0.26, rimStr: 1.15 }),
    STRUCT: mat('#9AA3AD', { amb: 0.24, rimStr: 0.95 }),
    DARK:   mat('#4C545E', { amb: 0.22, rimStr: 0.85 }),
    JOINT:  mat(SIGNAL.clone().lerp(new THREE.Color('#7FA8C6'), 0.22), { amb: 0.34, rimStr: 1.35 }),
    FAULT:  mat('#E0674A', { amb: 0.34, rimStr: 1.35 }),
  };
}

export function makeHalo(LIMB, { size = 2.9, strength = 0.62 } = {}) {
  return new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uRim: { value: LIMB.clone() }, uStr: { value: strength } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
}

/* ── primitives ───────────────────────────────────────── */
export const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
export const cyl = (r, h, m, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
export const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 4, 12), m);
export const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);

/* ── the quadruped ────────────────────────────────────────
   STAND-IN geometry in Laikago proportions, built from primitives.
   The URDF the research actually trains on ships inside pybullet's
   own data directory rather than in the project repo, so its
   redistribution licence is not cleared for a public page. Swap
   this function for a glTF load to replace it.

   Returns the group plus the four hip/knee groups so a caller can
   drive a gait. */
export function buildQuadruped(M) {
  const g = new THREE.Group();

  /* Trunk in three slabs, not one box: a single box has no
     shoulder line for the rim light to catch and reads as a table
     from three-quarters. */
  const trunk = box(1.34, 0.26, 0.52, M.SHELL); trunk.position.y = 0.02; g.add(trunk);
  const deck  = box(1.02, 0.09, 0.40, M.SHELL); deck.position.y = 0.19; g.add(deck);
  const belly = box(1.16, 0.11, 0.42, M.STRUCT); belly.position.y = -0.14; g.add(belly);

  /* one anodised service panel per flank, the way lab hardware gets
     exactly one blue part and nothing else */
  for (const sz of [-1, 1]) {
    const plate = box(0.40, 0.13, 0.02, M.JOINT);
    plate.position.set(-0.16, 0.03, sz * 0.265);
    g.add(plate);
  }

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const housing = box(0.24, 0.22, 0.16, M.SHELL);
    housing.position.set(sx * 0.52, -0.06, sz * 0.33);
    g.add(housing);
  }

  const head = box(0.28, 0.21, 0.32, M.SHELL); head.position.set(0.78, 0.05, 0); g.add(head);
  const visor = box(0.05, 0.10, 0.25, M.DARK); visor.position.set(0.915, 0.05, 0); g.add(visor);
  const sensor = cyl(0.042, 0.06, M.JOINT);
  sensor.rotation.z = Math.PI / 2; sensor.position.set(0.94, 0.15, 0); g.add(sensor);

  /* legs, front-left and rear-right on one diagonal */
  const LEGS = [
    { x:  0.52, z:  0.33, hip: -0.52, knee: 0.92, phase: 0.0 },   /* FL */
    { x:  0.52, z: -0.33, hip:  0.34, knee: 1.24, phase: 0.5 },   /* FR */
    { x: -0.52, z:  0.33, hip:  0.40, knee: 1.16, phase: 0.5 },   /* RL */
    { x: -0.52, z: -0.33, hip: -0.46, knee: 0.86, phase: 0.0 },   /* RR */
  ];

  const legs = [];
  for (const L of LEGS) {
    const hipG = new THREE.Group();
    hipG.position.set(L.x, -0.08, L.z);
    hipG.rotation.z = L.hip;

    const hipJoint = cyl(0.098, 0.17, M.JOINT);
    hipJoint.rotation.x = Math.PI / 2;
    hipG.add(hipJoint);

    const thigh = cap(0.072, 0.40, M.SHELL); thigh.position.y = -0.24; hipG.add(thigh);

    const kneeG = new THREE.Group();
    kneeG.position.y = -0.46;
    kneeG.rotation.z = -L.knee;

    const kneeJoint = sph(0.088, M.JOINT); kneeG.add(kneeJoint);
    const shank = cap(0.048, 0.36, M.STRUCT); shank.position.y = -0.22; kneeG.add(shank);
    const foot = sph(0.062, M.DARK); foot.position.y = -0.43; kneeG.add(foot);

    hipG.add(kneeG);
    g.add(hipG);
    legs.push({ hipG, kneeG, hipJoint, kneeJoint, shank, foot, rest: L });
  }

  return { group: g, legs };
}

export { THREE };
