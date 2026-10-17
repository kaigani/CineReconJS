// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video47.
// Rider (Aloy-like proxy) runs along a dirt path, a large winged machine lands,
// she leaps onto its back, then (after a cut) the mount takes off and flies away.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9d8e8);
  scene.fog = new THREE.Fog(0xd4dee8, 35, 300);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2500);
  camera.rotation.order = 'YXZ';

  // ---------- helpers ----------
  let rs = (seed >>> 0) || 1234567;
  const rand = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  function tang(k, j, d) {
    const n = k.length;
    if (j <= 0) return (k[1][d] - k[0][d]) / (k[1][0] - k[0][0]);
    if (j >= n - 1) return (k[n - 1][d] - k[n - 2][d]) / (k[n - 1][0] - k[n - 2][0]);
    const a = k[j][d] - k[j - 1][d], b = k[j + 1][d] - k[j][d];
    if (a * b <= 0) return 0;
    return (k[j + 1][d] - k[j - 1][d]) / (k[j + 1][0] - k[j - 1][0]);
  }
  // Hermite keyframe sampler: keys = [[t, v1, v2, ...], ...]
  function sk(k, t) {
    const n = k.length, dim = k[0].length - 1, out = new Array(dim);
    if (t <= k[0][0]) { for (let d = 0; d < dim; d++) out[d] = k[0][d + 1]; return out; }
    if (t >= k[n - 1][0]) { for (let d = 0; d < dim; d++) out[d] = k[n - 1][d + 1]; return out; }
    let i = 0; while (i < n - 2 && t > k[i + 1][0]) i++;
    const h = k[i + 1][0] - k[i][0], u = (t - k[i][0]) / h, u2 = u * u, u3 = u2 * u;
    for (let d = 1; d <= dim; d++) {
      const m0 = tang(k, i, d), m1 = tang(k, i + 1, d);
      out[d - 1] = (2 * u3 - 3 * u2 + 1) * k[i][d] + (u3 - 2 * u2 + u) * h * m0 +
        (-2 * u3 + 3 * u2) * k[i + 1][d] + (u3 - u2) * h * m1;
    }
    return out;
  }
  const s1 = (k, t) => sk(k, t)[0];

  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, metalness: 0.0 }, o));
  function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
  }
  const SPH = new THREE.SphereGeometry(1, 20, 14);
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  function blob(parent, mat, x, y, z, sx, sy, sz) { const m = mesh(SPH, mat, parent, x, y, z); m.scale.set(sx, sy, sz); return m; }
  function slab(parent, mat, x, y, z, sx, sy, sz, ry = 0) { const m = mesh(BOX, mat, parent, x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; return m; }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4d5a32, 1.3);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(0.72, 0.418, -0.553).normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(sun); scene.add(sun.target);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // ---------- sky dome + clouds (global) ----------
  {
    const g = new THREE.SphereGeometry(1200, 32, 20);
    const pos = g.attributes.position, cols = [];
    const top = new THREE.Color(0x4a74ad), hor = new THREE.Color(0xe2eaf2), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1200;
      c.copy(hor).lerp(top, clamp(Math.pow(Math.max(0, y), 0.6) * 1.1, 0, 1));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
    const cm = new THREE.MeshBasicMaterial({ color: 0xf4f6f8, fog: false });
    const cm2 = new THREE.MeshBasicMaterial({ color: 0xd9e0e8, fog: false });
    for (let i = 0; i < 26; i++) {
      const az = rand() * Math.PI * 2, el = (8 + rand() * 30) * D, r = 700;
      const x = Math.cos(el) * Math.sin(az) * r, y = Math.sin(el) * r, z = Math.cos(el) * Math.cos(az) * r;
      const cl = blob(scene, i % 3 ? cm : cm2, x, y, z, 60 + rand() * 70, 18 + rand() * 18, 60 + rand() * 70);
      cl.rotation.y = az;
    }
  }

  const ground = mesh(new THREE.PlaneGeometry(3000, 3000), M(0x557a33), scene, 0, 0, 0);
  ground.rotation.x = -Math.PI / 2;

  // ---------- environment A (run + landing area) ----------
  const envA = new THREE.Group(); scene.add(envA);
  {
    const dirt = M(0xcbb5a2), red = M(0x9c6252), hill = M(0x3f6b2b), hill2 = M(0x3c6229);
    const fern = M(0x4b7d2f), flowers = M(0xab3024), trunk = M(0xa39a8a), canopy = M(0x56853a), rock = M(0xb9b1a2);
    slab(envA, dirt, -0.5, 0.02, -45, 6.5, 0.04, 140);
    slab(envA, red, 7.0, 0.03, -16, 9, 0.05, 30, -0.2);
    blob(envA, hill, 16, -1, -11, 9, 7.5, 10);
    blob(envA, hill2, 8.8, -0.6, -29, 5, 4.8, 6.5);
    blob(envA, hill2, 14, -2, -50, 10, 7, 14);
    blob(envA, fern, 6.5, 0, -6.5, 3.5, 0.5, 2.2);
    blob(envA, flowers, -8, 0, -6, 3, 0.6, 4);
    blob(envA, flowers, -10.5, 0, -17, 3.5, 0.7, 3);
    blob(envA, flowers, -9.5, 0, -40, 5, 0.8, 2.5);
    for (let i = 0; i < 16; i++) blob(envA, fern, -4.3 - rand() * 6, 0, 2 - rand() * 60, 1.2 + rand() * 0.8, 0.35 + rand() * 0.25, 1.2 + rand() * 0.8);
    for (let i = 0; i < 8; i++) blob(envA, fern, 4.5 + rand() * 4, 0, -2 - rand() * 45, 1.2 + rand() * 0.8, 0.35 + rand() * 0.25, 1.2 + rand() * 0.8);
    const tree = (x, z, h, r, b = 0) => {
      const tr = mesh(new THREE.CylinderGeometry(0.2, 0.3, h, 8), trunk, envA, x, b + h / 2, z);
      blob(envA, canopy, x, b + h + r * 0.3, z, r, r * 1.3, r);
      return tr;
    };
    [[-10, -50, 15, 2.6], [-14, -44, 16, 2.8], [-18, -56, 15, 2.8], [-7.5, -60, 14, 2.4], [-22, -48, 17, 3], [-12, -66, 15, 2.6]].forEach(a => tree(...a));
    [[4, -52, 10, 1.5, 2], [7.5, -48, 11, 1.6, 3], [10, -55, 12, 1.6, 4], [13, -50, 11, 1.5, 4.5], [16, -58, 12, 1.7, 5]].forEach(a => tree(...a));
    blob(envA, rock, -16, 2, -95, 9, 13, 6);
    blob(envA, rock, -6, 1, -105, 6, 9, 5);
    const sunDisc = blob(envA, new THREE.MeshBasicMaterial({ color: 0xfffbe8, fog: false }),
      sunDir.x * 650, sunDir.y * 650, -20 + sunDir.z * 650, 14, 14, 14);
    sunDisc.renderOrder = 1;
  }

  // ---------- environment C (takeoff + flight area) ----------
  const envC = new THREE.Group(); scene.add(envC);
  const P0 = { x: -0.3, z: -6.4 }, PD = { x: 0.57, z: -0.82 }, PR = { x: 0.82, z: 0.57 };
  // path polyline: segment 1 heading 35 deg right, bending to 45 deg right after s = 20
  const SB = 20, Q0 = { x: P0.x + PD.x * SB, z: P0.z + PD.z * SB }, QD = { x: Math.sin(45 * D), z: -Math.cos(45 * D) }, QR = { x: Math.cos(45 * D), z: Math.sin(45 * D) };
  const pp = (s, off) => s <= SB ? [P0.x + PD.x * s + PR.x * off, P0.z + PD.z * s + PR.z * off]
    : [Q0.x + QD.x * (s - SB) + QR.x * off, Q0.z + QD.z * (s - SB) + QR.z * off];
  {
    const dirt = M(0xc8b69c), fern = M(0x4e7f30), flowers = M(0xb0281e), trunk = M(0xa0927e), canopy = M(0x4a7a32);
    const rock = M(0xae9f88), cliff = M(0x9f8f78);
    let mid = pp(4, 0);
    slab(envC, dirt, mid[0], 0.02, mid[1], 3.2, 0.04, 33, Math.atan2(-PD.x, -PD.z));
    mid = pp(SB + 70, 0);
    slab(envC, dirt, mid[0], 0.021, mid[1], 3.2, 0.04, 141, Math.atan2(-QD.x, -QD.z));
    const tree = (x, z, h, r) => {
      mesh(new THREE.CylinderGeometry(0.2, 0.32, h, 8), trunk, envC, x, h / 2, z);
      blob(envC, canopy, x, h + r * 0.3, z, r, r * 1.25, r);
    };
    [[-6, -34, 11, 3.5], [-2, -39, 13, 3.8], [2, -33, 10, 3.2], [6, -40, 12, 3.6], [10, -36, 11, 3.2], [-9, -43, 12, 3.4], [13, -45, 13, 3.4], [0, -47, 12, 3.5]].forEach(a => tree(...a));
    [[60, 14], [70, 18], [78, 12], [88, 20], [95, 15], [35, -8], [44, -11], [52, -14], [84, -16]].forEach(([s, o], i) => {
      const p = pp(s, o); tree(p[0], p[1], 10 + (i % 3) * 1.5, 3 + (i % 2) * 0.6);
    });
    [[-15, -25, 2.5, 9], [-18, -31, 3, 12], [-12, -30, 2, 7], [-21, -26, 2.4, 8]].forEach(([x, z, r, h]) => {
      mesh(new THREE.ConeGeometry(r, h, 7), rock, envC, x, h / 2, z);
    });
    blob(envC, rock, -17, 0, -28, 6, 3, 5);
    blob(envC, flowers, -4, 0, -28, 3, 0.7, 1.6);
    blob(envC, flowers, 3, 0, -30, 3.5, 0.7, 1.6);
    blob(envC, flowers, 9, 0, -32, 3, 0.7, 1.6);
    blob(envC, flowers, -5, 0, -7, 1.5, 0.6, 1.2);
    let p = pp(62, -6); blob(envC, cliff, p[0], 0, p[1], 6, 5, 7);
    mesh(new THREE.ConeGeometry(2, 9, 7), rock, envC, p[0] - 2, 4.5, p[1] - 3);
    p = pp(55, 10); blob(envC, flowers, p[0], 0, p[1], 3.5, 0.9, 2);
    p = pp(70, 8); blob(envC, flowers, p[0], 0, p[1], 3, 0.8, 2);
    for (let i = 0; i < 30; i++) {
      const s = -5 + rand() * 90, o = (rand() < 0.5 ? -1 : 1) * (2.6 + rand() * 9);
      const q = pp(s, o); blob(envC, fern, q[0], 0, q[1], 1 + rand(), 0.5 + rand() * 0.4, 1 + rand());
    }
  }

  // ---------- rider proxy (origin at hips) ----------
  const aloy = new THREE.Group(); aloy.rotation.order = 'YXZ'; scene.add(aloy);
  const mOut = M(0x4b2226), mArm = M(0x6e3b2c), mSkin = M(0xc48a6a), mHair = M(0xa8432a), mArmor = M(0x8a5a40), mBoot = M(0x2e1c1a), mBow = M(0x3a2a22);
  slab(aloy, mOut, 0, 0, 0, 0.34, 0.22, 0.22);
  slab(aloy, mArmor, 0, -0.1, 0, 0.42, 0.3, 0.28);
  const torso = new THREE.Group(); torso.position.set(0, 0.1, 0); aloy.add(torso);
  slab(torso, mOut, 0, 0.25, 0, 0.38, 0.5, 0.24);
  const bow = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 6), mBow, torso, 0, 0.3, 0.16); bow.rotation.z = 0.9;
  const headG = new THREE.Group(); headG.position.set(0, 0.52, 0); torso.add(headG);
  mesh(new THREE.SphereGeometry(0.12, 12, 10), mSkin, headG, 0, 0.12, -0.02);
  mesh(new THREE.SphereGeometry(0.135, 12, 10), mHair, headG, 0, 0.15, 0.03);
  slab(headG, mHair, 0, -0.02, 0.1, 0.26, 0.42, 0.13);
  function limb(parent, x, y, z, len, r, mat) {
    const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p);
    mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 8), mat, p, 0, -len / 2, 0);
    const j = new THREE.Group(); j.position.set(0, -len, 0); p.add(j);
    return { p, j };
  }
  const shL = limb(torso, -0.24, 0.46, 0, 0.3, 0.055, mArm), elL = limb(shL.j, 0, 0, 0, 0.28, 0.045, mSkin);
  const shR = limb(torso, 0.24, 0.46, 0, 0.3, 0.055, mArm), elR = limb(shR.j, 0, 0, 0, 0.28, 0.045, mSkin);
  const hpL = limb(aloy, -0.1, -0.05, 0, 0.45, 0.08, mOut), knL = limb(hpL.j, 0, 0, 0, 0.45, 0.06, mBoot);
  const hpR = limb(aloy, 0.1, -0.05, 0, 0.45, 0.08, mOut), knR = limb(hpR.j, 0, 0, 0, 0.45, 0.06, mBoot);
  slab(knL.j, mBoot, 0, -0.03, -0.06, 0.1, 0.06, 0.22);
  slab(knR.j, mBoot, 0, -0.03, -0.06, 0.1, 0.06, 0.22);

  function poseRun(p) {
    const s = Math.sin(p), c = Math.cos(p);
    hpL.p.rotation.set(0.75 * s, 0, 0); hpR.p.rotation.set(-0.75 * s, 0, 0);
    knL.p.rotation.set(-(0.3 + 1.1 * Math.max(0, c)), 0, 0);
    knR.p.rotation.set(-(0.3 + 1.1 * Math.max(0, -c)), 0, 0);
    shL.p.rotation.set(-0.7 * s, 0, -0.12); shR.p.rotation.set(0.7 * s, 0, 0.12);
    elL.p.rotation.set(1.3, 0, 0); elR.p.rotation.set(1.3, 0, 0);
    torso.rotation.set(-0.28, 0, 0); headG.rotation.set(0.15, 0, 0);
  }
  function poseTuck(u) { // u: 0 run-ish -> 1 tucked
    hpL.p.rotation.set(lerp(0.3, 1.7, u), 0, -0.1); hpR.p.rotation.set(lerp(-0.2, 1.6, u), 0, 0.1);
    knL.p.rotation.set(lerp(-0.6, -2.1, u), 0, 0); knR.p.rotation.set(lerp(-0.6, -2.0, u), 0, 0);
    shL.p.rotation.set(lerp(0.3, 2.3, u), 0, -0.2); shR.p.rotation.set(lerp(0.3, 2.3, u), 0, 0.2);
    elL.p.rotation.set(0.6, 0, 0); elR.p.rotation.set(0.6, 0, 0);
    torso.rotation.set(lerp(-0.3, -0.5, u), 0, 0); headG.rotation.set(0.2, 0, 0);
  }
  function poseRide() {
    hpL.p.rotation.set(1.3, 0, -0.55); hpR.p.rotation.set(1.3, 0, 0.55);
    knL.p.rotation.set(-1.6, 0, 0); knR.p.rotation.set(-1.6, 0, 0);
    shL.p.rotation.set(1.0, 0, -0.15); shR.p.rotation.set(1.0, 0, 0.15);
    elL.p.rotation.set(0.6, 0, 0); elR.p.rotation.set(0.6, 0, 0);
    torso.rotation.set(-0.55, 0, 0); headG.rotation.set(0.35, 0, 0);
  }

  // ---------- winged mount proxy (forward = -Z) ----------
  const bird = new THREE.Group(); bird.rotation.order = 'YXZ'; scene.add(bird);
  const mBody = M(0x35324a, { roughness: 0.6, metalness: 0.3 }), mWing = M(0x4a4a7e, { roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const mWingD = M(0x26243a, { side: THREE.DoubleSide }), mGlow = M(0x6080ff, { emissive: 0x2a50ff, emissiveIntensity: 1.6 });
  const mOrange = M(0xc8562a, { emissive: 0x5a1a00 }), mLeg = M(0x3e2a26);
  blob(bird, mBody, 0, 0, 0, 0.9, 0.75, 2.0);
  blob(bird, mOrange, 0, -0.35, -1.0, 0.55, 0.4, 0.6);
  const saddle = new THREE.Object3D(); saddle.position.set(0, 0.78, -0.45); bird.add(saddle);
  const neckP = new THREE.Group(); neckP.position.set(0, 0.3, -1.7); bird.add(neckP);
  const nm = mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.6, 8), mBody, neckP, 0, 0, -0.8); nm.rotation.x = -Math.PI / 2;
  const headB = new THREE.Group(); headB.position.set(0, 0, -1.6); neckP.add(headB);
  const hm = mesh(new THREE.ConeGeometry(0.32, 1.3, 8), mBody, headB, 0, 0, -0.55); hm.rotation.x = -Math.PI / 2;
  const crest = mesh(new THREE.ConeGeometry(0.28, 1.2, 6), mGlow, headB, 0, 0.45, 0.15); crest.rotation.x = 0.5;
  const tailP = new THREE.Group(); tailP.position.set(0, 0.1, 1.8); bird.add(tailP);
  const tm = mesh(new THREE.ConeGeometry(0.35, 3.2, 8), mWingD, tailP, 0, 0, 1.6); tm.rotation.x = Math.PI / 2;
  const wings = [];
  for (const sg of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sg * 0.7, 0.45, -0.6); bird.add(sh);
    blob(sh, mGlow, 0, 0.05, 0, 0.3, 0.3, 0.45);
    slab(sh, mWing, sg * 1.2, 0, 0.35, 2.4, 0.1, 2.0);
    slab(sh, mOrange, sg * 1.2, 0.03, -0.6, 2.4, 0.12, 0.15);
    const el = new THREE.Group(); el.position.set(sg * 2.4, 0, -0.3); sh.add(el);
    slab(el, mWing, sg * 1.2, 0, 0.5, 2.4, 0.08, 1.5);
    for (let i = 0; i < 3; i++) {
      const f = slab(el, mWingD, sg * (2.4 + 0.55), 0, 0.05 + i * 0.45, 1.3, 0.05, 0.22);
      f.rotation.y = -sg * (0.1 + i * 0.12);
    }
    wings.push({ sg, sh, el });
  }
  const legs = [];
  for (const sg of [-1, 1]) {
    const hp = limb(bird, sg * 0.5, -0.4, 0.2, 1.1, 0.17, mLeg);
    blob(hp.p, mOrange, 0, -0.5, -0.1, 0.2, 0.35, 0.2);
    const kn = limb(hp.j, 0, 0, 0, 1.2, 0.11, mOrange);
    slab(kn.j, mLeg, 0, -0.03, -0.2, 0.45, 0.08, 0.7);
    legs.push({ hp, kn });
  }
  function setWings(flapL, flapR, sweep, elbow) { // degrees
    for (const w of wings) {
      const f = w.sg < 0 ? flapL : flapR;
      w.sh.rotation.set(0, -w.sg * sweep * D, w.sg * f * D);
      w.el.rotation.set(0, 0, w.sg * elbow * D);
    }
  }
  function setLegs(th, kn) { for (const l of legs) { l.hp.p.rotation.set(th, 0, 0); l.kn.p.rotation.set(kn, 0, 0); } }
  const SC = 0.7; bird.scale.setScalar(SC);
  const standY = SC * (0.45 + 1.1 * Math.cos(0.5) + 1.2 * Math.cos(0.5 - 0.9));

  // ---------- timeline constants ----------
  const T_BLEND0 = 3.25, T_BLEND1 = 3.55, T_CUT = 5.25;
  const birdBKeys = [[3.0, -5, 13, -24], [3.35, -2.5, 6.5, -26], [3.65, -2.2, 1.8, -26.2], [4.1, 0.2, 2.1, -27.6], [4.45, 1.3, standY, -28], [5.3, 1.3, standY, -28]];
  const birdBPitch = [[3.0, -10], [3.4, 10], [3.8, 25], [4.2, 18], [4.5, 15], [5.3, 15]];
  const BIRD_YAW_B = 100 * D;

  // shot C camera: heading (deg, negative = turn right), speed, height, pitch
  const psiK = [[5.25, 0], [5.94, -4], [6.84, -14], [7.76, -27], [8.68, -34], [10.6, -38]];
  const spdK = [[5.25, 1.5], [5.94, 2.5], [6.39, 3.5], [6.84, 5.5], [7.31, 7.5], [7.76, 9], [8.21, 10], [10.6, 10.5]];
  const camHK = [[5.25, 3.0], [5.94, 3.2], [6.39, 3.5], [6.84, 4.0], [7.31, 4.6], [7.76, 5.1], [8.21, 5.5], [9.13, 6.0], [10.6, 6.5]];
  const camPK = [[5.25, 2], [5.94, 2], [6.39, 2], [6.84, 5], [7.31, 5], [7.76, 3], [8.21, 2], [10.6, 2]];
  const bHK = [[5.25, 1.4], [5.47, 1.45], [5.94, 1.8], [6.39, 3.4], [6.84, 5.3], [7.31, 6.2], [7.76, 5.8], [8.21, 5.9], [8.68, 6.6], [9.13, 6.9], [10.6, 7.3]];
  const bFK = [[5.25, 5.8], [5.94, 6.0], [6.39, 6.3], [7.31, 6.6], [7.76, 6.8], [10.6, 6.6]];
  const bRK = [[5.25, -2.0], [5.94, -2.0], [6.39, -2.4], [6.84, -1.6], [7.76, -2.6], [8.68, -2.9], [10.6, -3.1]];
  const bPitchC = [[5.25, 5], [5.94, 10], [6.39, 18], [6.84, 15], [7.31, 5], [7.76, 0], [10.6, -2]];
  const bRollC = [[5.25, 0], [6.84, 0], [7.76, -8], [8.68, -10], [10.6, -6]];
  const TRAVEL_OFF = -10, BIRD_OFF = -35;
  const C0 = 5.25, C1 = 10.7, CN = 1400, cdt = (C1 - C0) / CN;
  const camX = new Float64Array(CN + 1), camZ = new Float64Array(CN + 1);
  {
    let x = 0, z = 0;
    for (let i = 0; i <= CN; i++) {
      camX[i] = x; camZ[i] = z;
      const tt = C0 + (i + 0.5) * cdt, psi = s1(psiK, tt) * D, v = s1(spdK, tt);
      const pt = psi + TRAVEL_OFF * D; x += -Math.sin(pt) * v * cdt; z += -Math.cos(pt) * v * cdt;
    }
  }
  function camCxz(t) {
    const u = clamp((t - C0) / cdt, 0, CN - 1e-6), i = Math.floor(u), f = u - i;
    return [camX[i] + (camX[i + 1] - camX[i]) * f, camZ[i] + (camZ[i + 1] - camZ[i]) * f];
  }

  // rider ground path (shots A/B)
  function riderXZ(t) {
    if (t < 3.55) return [0, -6 * t];
    const u = clamp((t - 3.55) / 0.75, 0, 1);
    return [lerp(0, -0.6, u), -21.3 - 5.0 * u];
  }
  function camA(t) { const [x, z] = riderXZ(t); return { p: [x + 0.05 * Math.sin(t * 2.1), 2.6, z + 5.0], yaw: -13.4, pitch: -9 }; }
  function camB(t) { const u = clamp((t - 3.55) / 1.7, 0, 1); return { p: [0.3, 2.5, lerp(-19.0, -19.8, u)], yaw: -14, pitch: 4 }; }

  const vS = new THREE.Vector3(), qS = new THREE.Quaternion(), vUp = new THREE.Vector3();

  function update(time, frame) {
    const t = clamp(time, 0, duration);
    const inC = t >= T_CUT;
    envA.visible = !inC; envC.visible = inC;
    bird.visible = t >= 2.9;

    // ----- camera -----
    let cp, cyaw, cpitch;
    if (!inC) {
      if (t < T_BLEND0) { const c = camA(t); cp = c.p; cyaw = c.yaw; cpitch = c.pitch; }
      else if (t >= T_BLEND1) { const c = camB(t); cp = c.p; cyaw = c.yaw; cpitch = c.pitch; }
      else {
        const u = sstep(T_BLEND0, T_BLEND1, t), a = camA(t), b = camB(t);
        cp = [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)];
        cyaw = lerp(a.yaw, b.yaw, u); cpitch = lerp(a.pitch, b.pitch, u);
      }
    } else {
      const xz = camCxz(t);
      cp = [xz[0], s1(camHK, t), xz[1]]; cyaw = s1(psiK, t); cpitch = s1(camPK, t);
    }
    camera.position.set(cp[0], cp[1], cp[2]);
    camera.rotation.set(cpitch * D, cyaw * D, 0);
    camera.updateProjectionMatrix();

    // ----- bird -----
    if (!inC) {
      const p = sk(birdBKeys, t);
      bird.position.set(p[0], p[1], p[2]);
      bird.rotation.set(s1(birdBPitch, t) * D, BIRD_YAW_B, 0);
      // landing flare flapping then fold, then re-open ready to launch
      const flap = 25 + 50 * Math.cos(2 * Math.PI * 1.4 * (t - 4.1));
      const fold = sstep(4.25, 4.7, t), open = sstep(4.8, 5.25, t);
      let fl = lerp(flap, 80, fold), sw = lerp(0, 30, fold), elb = lerp(-10, -50, fold);
      fl = lerp(fl, 30, open); sw = lerp(sw, 10, open); elb = lerp(elb, -20, open);
      setWings(fl, fl, sw, elb);
      const ext = sstep(3.45, 4.05, t);
      setLegs(lerp(-1.1, 0.5, ext), lerp(-0.4, -0.9, ext));
      neckP.rotation.set(lerp(0.2, 1.1, sstep(3.6, 4.5, t)), 0, 0);
      tailP.rotation.set(lerp(0.15, -0.2, ext), 0, 0);
    } else {
      const xz = camCxz(t), psi = s1(psiK, t) * D;
      const F = [-Math.sin(psi), -Math.cos(psi)], R = [Math.cos(psi), -Math.sin(psi)];
      const f = s1(bFK, t), r = s1(bRK, t), ch = s1(camHK, t);
      bird.position.set(xz[0] + F[0] * f + R[0] * r, Math.max(standY - 0.1, ch + (s1(bHK, t) - ch) * 0.72), xz[1] + F[1] * f + R[1] * r);
      bird.rotation.set(s1(bPitchC, t) * D, psi + BIRD_OFF * D * sstep(5.25, 5.6, t) + 5 * D * (1 - sstep(5.25, 5.6, t)), s1(bRollC, t) * D);
      const amp = 45 * sstep(5.9, 6.25, t) * (1 - sstep(8.6, 9.0, t));
      const ph = 2 * Math.PI * (t - 6.84) / 0.92;
      const base = lerp(5, 20, sstep(5.9, 6.25, t) * (1 - sstep(8.6, 9.0, t)));
      const glide = sstep(8.6, 9.0, t);
      const fR = base + amp * Math.cos(ph) - glide * 0, fL = base + amp * Math.cos(ph) + glide * 12;
      const elb = -3 + 0.35 * amp * Math.cos(ph - 0.6);
      setWings(fL, fR, 10, elb);
      const tuck = sstep(5.4, 6.2, t);
      setLegs(lerp(0.5, 0.9, tuck), lerp(-0.9, -2.4, tuck));
      neckP.rotation.set(0.4, 0, 0);
      tailP.rotation.set(0.05, 0, 0);
    }
    bird.updateMatrixWorld(true);
    saddle.getWorldPosition(vS); saddle.getWorldQuaternion(qS);
    vUp.set(0, 0.12, 0).applyQuaternion(qS);
    const seatX = vS.x + vUp.x, seatY = vS.y + vUp.y, seatZ = vS.z + vUp.z;

    // ----- rider -----
    const T_SEAT = 5.2;
    if (t < 4.3) {
      const [x, z] = riderXZ(t), p = 2 * Math.PI * 1.45 * t;
      aloy.position.set(x, 0.95 + 0.05 * Math.abs(Math.cos(p)), z);
      const yaw = t < 3.55 ? 0 : 0.12;
      aloy.rotation.set(0, yaw, 0);
      poseRun(p);
    } else if (t < T_SEAT) {
      const keys = [[4.3, -0.6, 0.95, -26.3], [4.55, -0.45, 1.9, -26.6], [5.0, 0.15, 4.9, -27.4], [T_SEAT, seatX, seatY, seatZ]];
      const p = sk(keys, t);
      aloy.position.set(p[0], p[1], p[2]);
      const flip = -2 * Math.PI * sstep(4.5, 5.15, t);
      aloy.rotation.set(flip, lerp(0.12, BIRD_YAW_B, sstep(4.4, 5.15, t)), 0);
      poseTuck(sstep(4.3, 4.5, t) * (1 - 0.6 * sstep(5.05, 5.2, t)));
    } else {
      aloy.position.set(seatX, seatY, seatZ);
      aloy.quaternion.copy(qS);
      poseRide();
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
