// CineRecon L1 proxy reconstruction - video23 (third-person market-alley gunfight)
// Three.js sampled-frame baseline. World: alley runs along -Z from the player's cover spot at origin.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8c0d6);
  scene.fog = new THREE.Fog(0xb4b0a6, 30, 90);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 300);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xe4ecf4, 0x6a5a48, 1.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.0);
  sun.position.set(10, 16, 6);
  scene.add(sun);

  // ---------- helpers ----------
  const matCache = new Map();
  function mat(color) {
    if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return matCache.get(color);
  }
  function box(w, h, d, color, x, y, z, parent, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    (parent || scene).add(m);
    return m;
  }
  function cyl(r, h, color, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat(color));
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }
  function sph(r, color, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color));
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }
  const clamp01 = (u) => Math.min(1, Math.max(0, u));
  const smooth = (u) => { u = clamp01(u); return u * u * (3 - 2 * u); };
  const lerp = (a, b, w) => a + (b - a) * w;

  // eased hold-to-hold track: keys [[t, v0, v1, ...], ...]
  function stepTrack(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) {
        const w = smooth((t - a[0]) / (b[0] - a[0]));
        const out = [];
        for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * w);
        return out;
      }
    }
    return keys[keys.length - 1].slice(1);
  }
  // non-uniform Catmull-Rom (Hermite) track with zero tangents at holds
  function crTrack(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k1 = keys[i], k2 = keys[i + 1];
    const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
    const h = k2[0] - k1[0];
    const s = (t - k1[0]) / h;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s;
    const h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    const same = (a, b) => { for (let j = 1; j < a.length; j++) if (Math.abs(a[j] - b[j]) > 1e-6) return false; return true; };
    const out = [];
    for (let j = 1; j < k1.length; j++) {
      let m1 = 0, m2 = 0;
      if (k0 !== k1 && !same(k0, k1) && !same(k1, k2)) m1 = (k2[j] - k0[j]) / (k2[0] - k0[0]);
      else if (k0 === k1 && !same(k1, k2)) m1 = (k2[j] - k1[j]) / h;
      if (k3 !== k2 && !same(k2, k3) && !same(k1, k2)) m2 = (k3[j] - k1[j]) / (k3[0] - k1[0]);
      else if (k3 === k2 && !same(k1, k2)) m2 = (k2[j] - k1[j]) / h;
      out.push(h00 * k1[j] + h10 * h * m1 + h01 * k2[j] + h11 * h * m2);
    }
    return out;
  }

  // ---------- environment ----------
  const STEP_FRONT = -10.4, STEP_D = 0.42, STEP_H = 0.22;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 120), mat(0x6e6862));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -20);
  scene.add(ground);
  // puddle and rugs (flat colour patches)
  const puddle = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), mat(0x4c5862));
  puddle.rotation.x = -Math.PI / 2; puddle.position.set(1.0, 0.006, -1.6); scene.add(puddle);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), mat(0x8a4a36));
  rug.rotation.x = -Math.PI / 2; rug.position.set(3.9, 0.007, -2.6); scene.add(rug);

  // left near building (blue)
  box(2, 9, 12, 0x3e4c62, -6.2, 4.5, 0);
  // cover table (teal-green) in front-left of the player
  box(2.4, 0.08, 1.0, 0x4f9c7c, -0.85, 0.86, -0.95);
  for (const [lx, lz] of [[-1.95, -0.55], [0.25, -0.55], [-1.95, -1.35], [0.25, -1.35]]) box(0.08, 0.82, 0.08, 0x3f8a6a, lx, 0.41, lz);
  box(0.6, 0.5, 0.5, 0xc8463a, -0.2, 0.25, -0.95); // red crate under the table
  box(0.9, 0.35, 0.6, 0x9a8a78, -1.6, 1.07, -1.0); // sack on table
  box(1.2, 1.0, 1.0, 0x9a7a5a, -3.0, 0.5, -0.6); // sacks/crates at far left
  // left stall 1 (shelving market stall)
  box(0.1, 2.6, 3.0, 0x5a7a68, -3.4, 1.3, -4.1);
  box(2.6, 0.06, 1.0, 0x8a6a4a, -2.1, 1.0, -4.1);
  box(2.6, 0.06, 1.0, 0x8a6a4a, -2.1, 1.7, -4.1);
  box(3.0, 0.1, 3.4, 0x6a5848, -2.0, 2.7, -4.1);
  for (const [px, pz] of [[-0.75, -2.6], [-0.75, -5.6], [-3.3, -2.6], [-3.3, -5.6]]) box(0.12, 2.7, 0.12, 0x7a5c40, px, 1.35, pz);
  box(0.06, 0.7, 0.5, 0xd8a040, -0.7, 2.0, -5.8); // hanging sign
  box(1.0, 1.4, 0.05, 0x4a8a5a, -1.3, 1.9, -2.65); // green cloth
  box(0.08, 2.4, 1.2, 0x6aa060, -0.72, 1.3, -6.3); // green post panel
  // left stall 2 (corrugated kiosk with red frame and yellow slats)
  box(2.6, 2.6, 2.8, 0x4a9a6a, -2.3, 1.3, -7.0);
  box(0.06, 2.4, 1.3, 0xd8b848, -0.98, 1.2, -7.7);
  box(0.06, 2.4, 1.3, 0xc8463e, -0.98, 1.2, -6.3);
  box(2.6, 0.06, 0.06, 0xc8463e, -2.3, 2.5, -5.58);
  box(3.0, 0.1, 3.2, 0x5a4a3c, -2.3, 2.65, -7.0);
  cyl(0.22, 0.4, 0x4a8a80, -0.7, 0.2, -8.0);
  cyl(0.2, 0.35, 0x3a7a70, -0.8, 0.18, -8.6);
  box(0.4, 0.3, 0.3, 0xe07a40, -0.6, 0.15, -6.9);
  // market hall (pyramid roof building) beyond the steps
  box(10, 2.2, 0.3, 0x8a5a42, -2.0, 5.9, -14.0);
  const roofCone = new THREE.Mesh(new THREE.ConeGeometry(6.5, 4.0, 4), mat(0x8a4a3a));
  roofCone.position.set(-2.0, 9.0, -18.5); roofCone.rotation.y = Math.PI / 4; scene.add(roofCone);
  box(9.2, 0.3, 9.2, 0x4a3e36, -2.0, 7.0, -18.5); // hall ceiling

  // right: table with bottles + cabinet
  box(2.2, 0.06, 0.9, 0xa8b09a, 3.9, 0.9, -3.3);
  for (const [lx, lz] of [[2.9, -2.95], [2.9, -3.65]]) box(0.07, 0.88, 0.07, 0xa8b09a, lx, 0.44, lz);
  box(0.9, 0.86, 0.75, 0xc07a58, 4.5, 0.43, -3.35);
  box(0.6, 0.4, 0.5, 0x8a9aa8, 4.5, 1.13, -3.3);
  for (const [bx, bc] of [[3.1, 0x5a3a22], [3.4, 0xe0c040], [3.65, 0xe0c040], [3.9, 0xc8a050]]) cyl(0.05, 0.25, bc, bx, 1.05, -3.3);
  cyl(0.25, 0.5, 0x50706a, 2.8, 0.25, -2.8);
  // right: green toy stall
  box(0.15, 1.1, 3.0, 0x3a8a68, 4.3, 0.55, -0.5);
  box(0.12, 2.7, 0.12, 0x3a8a68, 4.3, 1.35, 1.0);
  box(0.12, 2.7, 0.12, 0x3a8a68, 4.3, 1.35, -2.0);
  box(1.2, 0.05, 2.9, 0x8a6a4a, 5.0, 1.6, -0.5);
  box(1.2, 0.05, 2.9, 0x8a6a4a, 5.0, 2.1, -0.5);
  box(1.8, 0.1, 3.3, 0x3a8a68, 5.0, 2.75, -0.5);
  box(0.06, 2.4, 3.0, 0x5a3e2e, 5.7, 1.4, -0.5);
  box(0.06, 2.6, 0.1, 0x3a8a68, 4.3, 1.4, -0.5);
  // right near building (ochre with red top)
  box(3, 10, 10, 0xc09a62, 9.0, 5, 0);
  box(3.1, 2.5, 10.1, 0xc8463e, 9.0, 9.5, 0);
  // red shuttered kiosk (front face runs obliquely from (4.4,-4.8) to (2.6,-10.5))
  const kiosk = new THREE.Group();
  kiosk.position.set(5.06, 0, -7.72); kiosk.rotation.y = 0.3; scene.add(kiosk);
  box(3.0, 2.8, 5.2, 0xd2485a, 0, 1.4, 0, kiosk);
  box(3.4, 0.12, 5.6, 0x8a7a6a, 0, 2.86, 0, kiosk);
  box(0.04, 1.6, 1.3, 0x9aa4ac, -1.52, 1.35, -1.8, kiosk); // shutter ("FERME")
  box(0.04, 1.6, 1.8, 0xb6a2a8, -1.52, 1.35, -0.2, kiosk); // graffiti shutter
  box(0.04, 1.3, 1.1, 0x5a4a40, -1.52, 1.5, 1.5, kiosk); // dark window
  box(0.04, 0.4, 5.2, 0x7a6a62, -1.52, 0.4, 0, kiosk); // lower band
  // orange crate with pineapples (in front of the kiosk's near end)
  const crate = new THREE.Group();
  crate.position.set(3.1, 0, -5.2); crate.rotation.y = 0.3; scene.add(crate);
  box(1.7, 1.0, 0.8, 0xe0703a, 0, 0.5, 0, crate);
  sph(0.16, 0x8a9a40, -0.2, 1.12, 0, crate); sph(0.16, 0x8a9a40, 0.25, 1.12, -0.05, crate);
  // far right buildings
  box(4, 7, 8, 0xb08858, 9.0, 3.5, -9.5);
  box(6, 11, 6, 0xd0d0c4, 6.5, 5.5, -18);
  box(6.2, 0.3, 6.2, 0x3a8a6a, 6.5, 4, -18);
  box(6.2, 0.3, 6.2, 0x3a8a6a, 6.5, 7.5, -18);
  box(1.2, 3.2, 3.0, 0x3a8a6a, 4.2, 2.5, -12.6); // green shutter stall right-back (on plaza)
  // steps up to the plaza (4 tiled steps)
  for (let i = 0; i < 4; i++) {
    const front = STEP_FRONT - STEP_D * i, back = -40;
    const hgt = STEP_H * (i + 1);
    box(18, hgt, front - back, 0xb8c2c8, -2, hgt / 2, (front + back) / 2);
    box(18, 0.08, 0.02, 0x4a70a8, -2, hgt - 0.07, front + 0.01);
  }
  // plaza: counter around pillar, pillar, back facade
  const PY = STEP_H * 4;
  box(4.6, 0.8, 3.2, 0x6a5e54, -1.6, PY + 0.4, -15.0);
  box(4.4, 0.1, 3.0, 0x9a3a30, -1.6, PY + 0.85, -15.0);
  box(1.3, 6.2, 1.3, 0xe6e6de, -1.4, PY + 3.1, -15.0);
  box(30, 12, 1, 0x8a7a68, 0, 6, -30);
  box(2.4, 1.6, 1.6, 0x8a6a4a, 3.4, PY + 0.8, -14.5);
  cyl(0.2, 0.35, 0xe0b830, 0.0, PY + 0.18, -13.2);
  box(3.0, 2.0, 2.0, 0x5a5048, -6.0, PY + 1.0, -17); // left market stalls

  // smoke volumes
  function smokeMat(color) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false });
  }
  const redSmokeMat = smokeMat(0xc04a48);
  const redSmoke = [];
  for (const [x, y, z, r] of [[-0.4, 1.4, -3.4, 1.3], [-1.4, 1.1, -2.2, 1.1], [0.1, 2.2, -5.0, 1.1]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), redSmokeMat);
    m.position.set(x, y, z); scene.add(m); redSmoke.push(m);
  }
  const graySmokeMat = smokeMat(0x8c8c88);
  const graySmoke = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 14), graySmokeMat);
  graySmoke.position.set(-0.5, 5.2, -13.5); scene.add(graySmoke);

  // ---------- articulated humans ----------
  function makeHuman(c) {
    const root = new THREE.Group(); scene.add(root);
    const body = new THREE.Group(); root.add(body);
    box(0.36, 0.2, 0.22, c.pants, 0, 0, 0, body);
    const torso = new THREE.Group(); torso.position.y = 0.08; body.add(torso);
    box(0.42, 0.56, 0.24, c.shirt, 0, 0.3, 0, torso);
    if (c.vest) box(0.44, 0.38, 0.27, c.vest, 0, 0.36, 0, torso);
    if (c.strap) { box(0.06, 0.55, 0.26, c.strap, 0.12, 0.3, 0.005, torso); box(0.06, 0.55, 0.26, c.strap, -0.12, 0.3, 0.005, torso); }
    const head = new THREE.Group(); head.position.y = 0.6; torso.add(head);
    box(0.09, 0.08, 0.09, c.skin, 0, 0.02, 0, head);
    sph(0.115, c.skin, 0, 0.15, 0, head);
    if (c.hair) { const hm = sph(0.122, c.hair, 0, 0.18, 0.025, head); hm.scale.set(1, 0.8, 1); }
    if (c.cap) cyl(0.12, 0.08, c.cap, 0, 0.24, 0, head);
    const arms = {}, legs = {};
    for (const [nm, s] of [['L', -1], ['R', 1]]) {
      const sh = new THREE.Group(); sh.rotation.order = 'YXZ'; sh.position.set(0.27 * s, 0.53, 0); torso.add(sh);
      box(0.11, 0.3, 0.11, c.sleeve || c.shirt, 0, -0.15, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      box(0.09, 0.27, 0.09, c.forearm || c.skin, 0, -0.135, 0, el);
      sph(0.05, c.skin, 0, -0.3, 0, el);
      arms[nm] = { sh, el };
      const hp = new THREE.Group(); hp.position.set(0.11 * s, -0.05, 0); body.add(hp);
      box(0.16, 0.45, 0.17, c.pants, 0, -0.225, 0, hp);
      const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
      box(0.13, 0.44, 0.14, c.pants, 0, -0.22, 0, kn);
      box(0.12, 0.07, 0.26, c.shoe, 0, -0.47, -0.06, kn);
      legs[nm] = { hp, kn };
    }
    return { root, body, torso, head, arms, legs };
  }
  function legDrop(a, k) { return 0.05 + 0.45 * Math.cos(a) + 0.505 * Math.cos(a - k); }
  const POSE_KEYS = ['hipL', 'kneeL', 'hipR', 'kneeR', 'lean', 'twist', 'head', 'shL', 'ayL', 'azL', 'elL', 'shR', 'ayR', 'azR', 'elR', 'pitch', 'pelvisY'];
  function resolve(p) {
    const q = {};
    for (const k of POSE_KEYS) q[k] = p[k] || 0;
    q.pelvisY = (p.pelvisY !== undefined) ? p.pelvisY : Math.max(legDrop(q.hipL, q.kneeL), legDrop(q.hipR, q.kneeR));
    return q;
  }
  function lerpPose(a, b, w) {
    const q = {};
    for (const k of POSE_KEYS) q[k] = lerp(a[k], b[k], w);
    return q;
  }
  function applyPose(h, p, x, y, z, yaw) {
    h.root.position.set(x, y, z);
    h.root.rotation.y = yaw;
    h.body.position.y = p.pelvisY;
    h.body.rotation.x = p.pitch;
    h.torso.rotation.set(-p.lean, p.twist, 0);
    h.head.rotation.x = p.head;
    h.legs.L.hp.rotation.x = p.hipL; h.legs.L.kn.rotation.x = -p.kneeL;
    h.legs.R.hp.rotation.x = p.hipR; h.legs.R.kn.rotation.x = -p.kneeR;
    h.arms.L.sh.rotation.set(p.shL, p.ayL, p.azL - 0.08);
    h.arms.R.sh.rotation.set(p.shR, p.ayR, p.azR + 0.08);
    h.arms.L.el.rotation.x = p.elL;
    h.arms.R.el.rotation.x = p.elR;
  }
  function runPose(ph, crouch) {
    const s = Math.sin(ph), c = Math.cos(ph);
    return resolve({
      hipL: 0.3 + 0.75 * s + crouch * 0.6, kneeL: 0.3 + 1.1 * Math.max(0, c) + crouch * 0.9,
      hipR: 0.3 - 0.75 * s + crouch * 0.6, kneeR: 0.3 + 1.1 * Math.max(0, -c) + crouch * 0.9,
      lean: 0.35 + crouch * 0.35, head: 0.25 + crouch * 0.2,
      shL: 0.2 - 0.7 * s, ayL: 0, elL: 1.3,
      shR: 0.5 + 0.35 * s, ayR: 0, elR: 1.1,
    });
  }

  // Nate (player): navy shirt, brown trousers, holster straps
  const nate = makeHuman({ shirt: 0x3c4a62, pants: 0x7a4e34, skin: 0xb07a5a, hair: 0x4a3020, shoe: 0x3a2a20, strap: 0x6a3e22, sleeve: 0x3c4a62, forearm: 0xb07a5a });
  const pistol = box(0.05, 0.18, 0.1, 0x2a2a2c, 0, -0.36, -0.02, nate.arms.R.el);
  const rifle = box(0.06, 0.9, 0.1, 0x3a3028, 0, -0.5, -0.03, nate.arms.R.el);
  const flashCore = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff4c0 }));
  flashCore.position.set(0, -0.58, 0); nate.arms.R.el.add(flashCore);
  const flashGlow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.55, depthWrite: false }));
  flashGlow.position.set(0, -0.58, 0); nate.arms.R.el.add(flashGlow);

  // enemies: grey trousers, light shirt, dark vest, red cap
  const ecol = { shirt: 0xbcbcb6, pants: 0x5e5e62, skin: 0x9a6a50, vest: 0x34343a, cap: 0xc8302a, shoe: 0x2a2a2a, sleeve: 0xbcbcb6, forearm: 0xbcbcb6 };
  const enemies = [];
  // A: runs down the alley, shot ~1.62 s, lies left (body seen at 10.6-12.3 s left of the player)
  // B: further back near the steps, shot ~3.40 s, lies in front of the steps
  // C: behind the orange crate firing, shot ~7.26 s, lies right beside the crate/kiosk
  const edefs = [
    { path: [[0, 0.9, -10.0], [1.55, 0.4, -7.0]], run: true, tDie: 1.62, dead: [-0.2, -7.6], deadYaw: -Math.PI / 2 },
    { path: [[0, 2.8, -9.6], [3.4, 2.2, -9.2]], run: false, tDie: 3.40, dead: [2.2, -9.9], deadYaw: Math.PI / 2 },
    { path: [[0, 2.1, -6.1], [7.26, 2.1, -6.1]], run: false, tDie: 7.26, dead: [2.6, -6.3], deadYaw: -Math.PI / 2 },
  ];
  for (const d of edefs) {
    const h = makeHuman(ecol);
    const gun = box(0.06, 0.8, 0.09, 0x222224, 0, -0.42, -0.04, h.arms.R.el);
    enemies.push({ h, d, gun });
  }
  const E_AIM = resolve({ hipL: 0.15, kneeL: 0.2, hipR: -0.1, kneeR: 0.1, lean: 0.1, shL: 1.3, ayL: -0.5, elL: 0.4, shR: 1.2, ayR: 0.25, elR: 0.6 });
  const E_DEAD = resolve({ hipL: 0.2, kneeL: 0.3, hipR: -0.1, kneeR: 0.2, shL: 0.2, azL: -0.6, elL: 0.2, shR: 0.2, azR: 0.5, elR: 0.3, pitch: Math.PI / 2, pelvisY: 0.14 });

  // ---------- player timeline ----------
  const NATE_PATH = [
    [0, 0, 0], [7.6, 0, 0], [7.85, 0.6, -0.2], [8.4, 2.0, -0.8], [8.97, 2.1, -2.4], [9.52, 0.8, -3.8],
    [10.08, 0.95, -5.0], [10.65, 1.3, -5.4], [11.0, 1.4, -5.6], [11.4, 1.3, -6.2], [11.77, 1.0, -7.1],
    [12.32, 0.9, -9.0], [12.9, 0.8, -10.6],
  ];
  function natePath(t) { const v = crTrack(NATE_PATH, Math.max(0, t)); return { x: v[0], z: v[1] }; }
  function groundY(z) { if (z > STEP_FRONT) return 0; const i = Math.min(3, Math.floor((STEP_FRONT - z) / STEP_D)); return STEP_H * (i + 1); }
  function pathYaw(t) {
    const a = natePath(t - 0.06), b = natePath(t + 0.06);
    const dx = b.x - a.x, dz = b.z - a.z;
    if (dx * dx + dz * dz < 1e-8) return 0;
    return Math.atan2(-dx, -dz);
  }
  const AIM_W = [[0, 0], [0.25, 0], [0.45, 1], [1.9, 1], [2.15, 0], [3.15, 0], [3.32, 1], [4.12, 1], [4.35, 0], [6.45, 0], [6.6, 1], [7.5, 1]];
  const COVER = resolve({ hipL: 1.5, kneeL: 2.3, hipR: 1.3, kneeR: 2.4, lean: 0.55, head: 0.4, shL: 0.8, ayL: -0.3, elL: 1.0, shR: 0.9, ayR: 0.2, elR: 0.7 });
  const AIM = resolve({ hipL: 1.2, kneeL: 1.7, hipR: 0.9, kneeR: 1.5, lean: 0.2, twist: 0.15, head: 0.1, shL: 1.45, ayL: -0.5, elL: 0.3, shR: 1.5, ayR: 0.3, elR: 0.05 });
  const LUNGE = resolve({ hipL: 1.0, kneeL: 1.0, hipR: -0.3, kneeR: 0.6, lean: 0.8, head: 0.5, shL: 0.6, elL: 0.8, shR: 0.9, elR: 0.6 });
  const ROLLP = { hipL: 2.2, kneeL: 2.4, hipR: 2.2, kneeR: 2.4, lean: 0.9, head: -0.3, shL: 1.0, elL: 1.2, shR: 1.0, elR: 1.2, pelvisY: 0.5 };
  const PICK = resolve({ hipL: 1.6, kneeL: 2.4, hipR: 1.0, kneeR: 2.0, lean: 0.9, head: 0.5, shL: 0.9, elL: 0.4, shR: 1.3, ayR: -0.2, elR: 0.2 });
  const STANDR = resolve({ hipL: 0.3, kneeL: 0.5, hipR: 0.1, kneeR: 0.3, lean: 0.35, shL: 1.1, ayL: -0.5, elL: 0.5, shR: 0.8, ayR: 0.3, elR: 0.9 });
  const RUN_W = 2 * Math.PI * 1.45;
  const COVER_YAW = -1.25;
  const AIM_YAW_K = [[0, -0.12], [4.3, -0.12], [6.45, -0.36], [7.5, -0.36]];

  function rollPose(u) {
    let pitch = -2 * Math.PI * smooth(u);
    if (pitch < -Math.PI) pitch += 2 * Math.PI;
    return resolve(Object.assign({}, ROLLP, { pitch }));
  }

  function nateState(t) {
    const p = natePath(t);
    let pose, yaw;
    if (t < 7.5) {
      const w = stepTrack(AIM_W, t)[0];
      pose = lerpPose(COVER, AIM, w); yaw = lerp(COVER_YAW, stepTrack(AIM_YAW_K, t)[0], w);
    } else if (t < 7.7) {
      const w = smooth((t - 7.5) / 0.2);
      pose = lerpPose(AIM, LUNGE, w); yaw = lerp(-0.36, -1.3, w);
    } else if (t < 7.95) {
      pose = LUNGE; yaw = -1.3;
    } else if (t < 8.6) {
      const u = (t - 7.95) / 0.65;
      pose = rollPose(u);
      if (u < 0.15) pose = lerpPose(LUNGE, pose, smooth(u / 0.15));
      if (u > 0.85) pose = lerpPose(pose, runPose(RUN_W * t, 0), smooth((u - 0.85) / 0.15));
      yaw = lerp(-1.3, pathYaw(t), smooth(u));
    } else if (t < 10.9) {
      const crouch = 1.3 * smooth((t - 10.25) / 0.4);
      pose = runPose(RUN_W * t, crouch); yaw = pathYaw(t);
    } else if (t < 11.4) {
      const w = smooth((t - 10.9) / 0.18);
      pose = lerpPose(runPose(RUN_W * t, 1.3), PICK, w); yaw = lerp(pathYaw(10.9), 0.3, w);
    } else if (t < 11.9) {
      const w = smooth((t - 11.4) / 0.2);
      pose = lerpPose(PICK, STANDR, w); yaw = lerp(0.3, 1.0, w);
    } else {
      const w = smooth((t - 11.9) / 0.2);
      pose = lerpPose(STANDR, runPose(RUN_W * t, 0), w); yaw = lerp(1.0, pathYaw(t), w);
    }
    return { x: p.x, z: p.z, y: groundY(p.z), pose, yaw };
  }

  const SHOTS = [0.30, 0.53, 0.80, 1.02, 1.28, 1.45, 1.60, 3.45, 3.70, 3.88, 4.05, 6.70, 6.95, 7.24, 7.42, 7.55];

  // ---------- camera timeline (world-space position / look-at / vertical fov) ----------
  const COV0 = [0.7, 1.8, 3.4, 0.8, 0.8, -16, 55];
  const COV2 = [0.5, 1.8, 3.4, 3.8, 1.6, -16, 55];
  const COVC = [0.55, 1.25, 2.2, 1.2, 0.8, -16, 55];
  const AIM1 = [0.92, 1.35, 1.3, 0.2, 1.25, -15, 45];
  const AIM2 = [0.6, 1.4, 1.5, 4.7, 1.15, -15, 45];
  const CAM_A = [
    [0, ...COV0], [0.25, ...COV0], [0.45, ...AIM1], [1.9, ...AIM1], [2.15, ...COV2], [2.5, ...COV2], [2.8, ...COVC],
    [3.15, ...COVC], [3.32, ...AIM1], [4.12, ...AIM1], [4.35, ...COV2], [6.45, ...COV2],
    [6.6, ...AIM2], [7.5, ...AIM2], [7.7, ...COV2],
  ];
  const CAM_B = [
    [7.7, ...COV2],
    [8.4, 2.4, 1.9, 3.0, 2.2, 1.0, -12, 55],
    [8.97, 2.65, 1.9, 0.8, 2.4, 0.4, -12, 55],
    [9.52, 1.1, 1.9, -0.2, 1.0, -0.2, -12, 55],
    [10.08, 1.2, 1.9, -2.0, 1.1, -0.6, -12, 55],
    [10.65, 1.5, 2.2, -3.0, 1.4, -0.7, -12, 55],
    [11.2, 1.5, 2.25, -3.3, 1.3, -0.8, -12.5, 55],
    [11.77, 1.4, 2.4, -4.6, 1.0, -1.2, -14, 55],
    [12.32, 1.2, 2.4, -5.5, 1.0, -0.6, -14.5, 55],
    [12.9, 1.1, 2.5, -8.0, 0.9, -1.6, -15, 55],
  ];

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));

    // player
    const st = nateState(t);
    applyPose(nate, st.pose, st.x, st.y, st.z, st.yaw);
    pistol.visible = t < 11.05;
    rifle.visible = t >= 11.05;
    let flash = false;
    for (const s of SHOTS) if (t >= s && t < s + 0.06) flash = true;
    flashCore.visible = flash; flashGlow.visible = flash;

    // enemies
    for (const { h, d, gun } of enemies) {
      gun.visible = t < d.tDie + 0.3;
      if (t < d.tDie) {
        const v = stepTrack(d.path, t);
        const yaw = Math.atan2(-(0 - v[0]), -(0 - v[1]));
        const pose = d.run ? runPose(RUN_W * t + 1.3, 0) : E_AIM;
        applyPose(h, pose, v[0], 0, v[1], yaw);
      } else {
        const v0 = stepTrack(d.path, d.tDie);
        const yaw0 = Math.atan2(-(0 - v0[0]), -(0 - v0[1]));
        const u = clamp01((t - d.tDie) / 0.55);
        const w = smooth(u);
        let dy = d.deadYaw - yaw0;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        const yaw = yaw0 + dy * w;
        const pose = lerpPose(E_AIM, E_DEAD, w);
        pose.pitch = (Math.PI / 2) * u * u;
        pose.pelvisY = Math.max(0.14, 0.98 * Math.cos(pose.pitch));
        applyPose(h, pose, lerp(v0[0], d.dead[0], w), 0, lerp(v0[1], d.dead[1], w), yaw);
      }
    }

    // smoke
    redSmokeMat.opacity = 0.3 * (1 - smooth((t - 7.4) / 0.9));
    for (const m of redSmoke) m.visible = redSmokeMat.opacity > 0.005;
    graySmokeMat.opacity = 0.25 * smooth((t - 7.8) / 0.6) * (1 - smooth((t - 10.2) / 0.6));
    graySmoke.visible = graySmokeMat.opacity > 0.005;

    // camera
    const o = t < 7.7 ? stepTrack(CAM_A, t) : crTrack(CAM_B, t);
    camera.position.set(o[0], o[1], o[2]);
    camera.lookAt(o[3], o[4], o[5]);
    camera.fov = o[6];
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  update(0, 0);
  return { scene, camera, update };
}
