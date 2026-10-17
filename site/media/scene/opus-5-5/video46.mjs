// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video46.
// Single continuous third-person shot: runner climbs a gate, a guard on top is
// killed, runner drops onto a terrace, climbs stairs, sneaks along a fence and
// runs down a walled walkway.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const PI = Math.PI;
  const scene = new THREE.Scene();
  const SKY = 0xe8dfcf;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 40, 230);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 600);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0xc09a80, 1.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
  sun.position.set(-22, 48, 32);
  sun.target.position.set(-8, 0, -4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
  scene.add(sun); scene.add(sun.target);

  // ---------- helpers ----------
  const matCache = new Map();
  function mat(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.92, metalness: 0 }, extra || {})));
    }
    return matCache.get(key);
  }
  function mesh(geo, color, parent, x = 0, y = 0, z = 0, extra) {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  }
  function boxMM(x0, x1, y0, y1, z0, z1, color, parent) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    return mesh(new THREE.BoxGeometry(bx - ax, y1 - y0, bz - az), color, parent,
      (ax + bx) / 2, (y0 + y1) / 2, (az + bz) / 2);
  }
  // Local frame of the upper complex (stairs / platform / walkway):
  // u = forward along world -x, v = right along world -z, origin at stair base.
  const LX = (u) => -2.5 - u;
  const LZ = (v) => -6.5 - v;
  function boxL(u0, u1, v0, v1, y0, y1, color) {
    return boxMM(LX(u0), LX(u1), y0, y1, LZ(v0), LZ(v1), color);
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
  }
  // merlon parapet along a line
  function merlons(x0, z0, x1, z1, yBase, opts = {}) {
    const color = opts.color || 0xd9b9a2;
    const w = opts.w || 0.8, gap = opts.gap || 0.32, h = opts.h || 0.75, th = opts.th || 0.5;
    const baseH = opts.baseH !== undefined ? opts.baseH : 0.45;
    const dx = x1 - x0, dz = z1 - z0; const len = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx);
    if (baseH > 0) {
      const g = group(scene, (x0 + x1) / 2, yBase + baseH / 2, (z0 + z1) / 2);
      g.rotation.y = -a;
      mesh(new THREE.BoxGeometry(len, baseH, th + 0.06), color, g);
    }
    const n = Math.max(1, Math.floor((len + gap) / (w + gap)));
    const used = n * w + (n - 1) * gap; const start = (len - used) / 2 + w / 2;
    for (let i = 0; i < n; i++) {
      const s = (start + i * (w + gap)) / len;
      const g = group(scene, x0 + dx * s, yBase + baseH, z0 + dz * s);
      g.rotation.y = -a;
      mesh(new THREE.BoxGeometry(w, h - w / 2, th), color, g, 0, (h - w / 2) / 2, 0);
      const c = mesh(new THREE.CylinderGeometry(w / 2, w / 2, th, 12), color, g, 0, h - w / 2, 0);
      c.rotation.x = PI / 2;
    }
  }
  // procedural vertical-slat texture for reed/wood fences (generated in memory)
  let rs = (seed >>> 0) || 1;
  const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const slatData = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) {
    const slat = Math.floor(i / 8), inSlat = i % 8;
    const v = inSlat === 0 ? 120 : 200 + Math.floor((slat * 37 % 7) * 6) - 15 + Math.floor(rnd() * 10);
    slatData[i * 4] = v; slatData[i * 4 + 1] = Math.floor(v * 0.93); slatData[i * 4 + 2] = Math.floor(v * 0.84); slatData[i * 4 + 3] = 255;
  }
  const slatTex = new THREE.DataTexture(slatData, 64, 1, THREE.RGBAFormat);
  slatTex.wrapS = THREE.RepeatWrapping; slatTex.wrapT = THREE.RepeatWrapping;
  if ('colorSpace' in slatTex && THREE.SRGBColorSpace) slatTex.colorSpace = THREE.SRGBColorSpace;
  slatTex.needsUpdate = true;
  function fence(x0, z0, x1, z1, yBase, h = 1.45) {
    const dx = x1 - x0, dz = z1 - z0; const len = Math.hypot(dx, dz);
    const g = group(scene, (x0 + x1) / 2, yBase + h / 2, (z0 + z1) / 2);
    g.rotation.y = -Math.atan2(dz, dx);
    const ft = slatTex.clone(); ft.needsUpdate = true; ft.repeat.set(len / 0.8, 1);
    const fm = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xd8c8b4, map: ft, roughness: 0.95 }));
    fm.castShadow = true; fm.receiveShadow = true; g.add(fm);
    mesh(new THREE.BoxGeometry(len, 0.08, 0.16), 0x7d6a58, g, 0, h * 0.25, 0);
    mesh(new THREE.BoxGeometry(len, 0.08, 0.16), 0x7d6a58, g, 0, h * 0.2 + 0.2, 0);
  }
  function brazier(x, y, z) {
    const g = group(scene, x, y, z);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), 0x2a2724, g, 0, 0.25, 0);
    mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 10, 1, true), 0x2c2a27, g, 0, 0.75, 0, { side: THREE.DoubleSide });
    mesh(new THREE.SphereGeometry(0.17, 10, 8), 0xff8a30, g, 0, 0.72, 0, { emissive: 0xff6a10, emissiveIntensity: 1.2 });
    return g;
  }
  function palm(x, z, h) {
    const g = group(scene, x, 0, z);
    const tr = mesh(new THREE.CylinderGeometry(0.22, 0.32, h, 8), 0x8a6c4c, g, 0, h / 2, 0);
    tr.rotation.z = 0.05;
    const c = mesh(new THREE.SphereGeometry(1, 12, 8), 0x5f7a32, g, 0, h, 0);
    c.scale.set(2.4, 0.7, 2.4);
  }

  // ---------- ground & far landscape ----------
  const ground = mesh(new THREE.PlaneGeometry(700, 700), 0xd8b796);
  ground.rotation.x = -PI / 2;
  // vegetation / water flats left of the walkway (world +z, far -x)
  const green = mesh(new THREE.PlaneGeometry(100, 70), 0x8c8e52);
  green.rotation.x = -PI / 2; green.position.set(-62, 0.03, 38);
  const water = mesh(new THREE.PlaneGeometry(120, 12), 0x95a59c);
  water.rotation.x = -PI / 2; water.position.set(LX(60), 0.06, LZ(-28));
  // hills
  const hill1 = mesh(new THREE.SphereGeometry(40, 20, 12), 0xd2b090, scene, LX(95), -2, LZ(-55));
  hill1.scale.set(1.3, 0.5, 1.0);
    // red-brown rock cliffs (right of the gate in the opening view)
  boxMM(6.6, 15, 0, 8, -3, 3.2, 0xb27358);
  boxMM(10, 28, 0, 15, -35, -2, 0xa96a52);
  boxMM(14, 26, 0, 18, -2, 8, 0xb67a5e);
  // distant buildings behind the gate (opening view, world -z)
  boxMM(2.5, 6.5, 0, 8.5, -14, -18, 0xc79c86);
  boxMM(-1.5, 2.5, 0, 11, -30, -34, 0xbf9580);
  boxMM(6.5, 9.5, 0, 12, -22, -25, 0x9c7a64);

  // ---------- gate wall (z = 0) ----------
  const STONE = 0xd2aa94, STONE2 = 0xc9a08a;
  boxMM(-11, -1.75, 0, 2.4, -0.4, 0.4, STONE2);            // left wall
  boxMM(1.75, 6.8, 0, 2.9, -0.4, 0.4, STONE2);             // right wall
  merlons(2.0, 0, 6.6, 0, 2.9, { w: 0.55, gap: 0.22, h: 0.85, th: 0.45, baseH: 0, color: 0xd6b29b });
  boxMM(-1.75, 1.75, 0, 3.45, -1.4, 0.45, STONE);         // gate block (pillars + top slab)
  boxMM(-0.72, 0.72, 0, 3.15, 0.45, 0.48, 0xcaa58f);        // closed door panel
  boxMM(-0.84, -0.7, 0, 3.15, 0.45, 0.55, 0x4a4038);     // dark door posts
  boxMM(0.7, 0.84, 0, 3.15, 0.45, 0.55, 0x4a4038);
  boxMM(-0.35, -0.2, 0, 3.15, 0.48, 0.5, 0xb06a55);       // faded red stripes
  boxMM(0.2, 0.35, 0, 3.15, 0.48, 0.5, 0xb06a55);
  boxMM(-2.05, 2.05, 3.15, 3.45, 0.3, 0.62, 0xb8735c);      // reddish lintel beam

  // tree left of the gate
  mesh(new THREE.CylinderGeometry(0.15, 0.25, 3.0, 8), 0x6b5440, scene, -4.4, 1.5, 3.0);
  const can = mesh(new THREE.SphereGeometry(1, 14, 10), 0x7f8c4c, scene, -4.8, 3.9, 3.0);
  can.scale.set(2.0, 1.4, 1.8);

  // ---------- lower terrace behind the gate (top y = 2.0) ----------
  const FLOOR = 0xd9bca6;
  boxMM(-9.2, 8, 0, 2.0, -10.5, -0.4, FLOOR);
  merlons(-2.6, -1.5, -2.6, -4.6, 2.0);
  merlons(2.6, -1.5, 2.6, -5.2, 2.0);
  fence(-2.2, -8.6, 8, -8.6, 2.0, 1.4);
  brazier(-1.6, 2.0, -3.9);

  // ---------- stairs (climb toward world -x) ----------
  const STEPS = 14, RUN = 6.5 / STEPS, RISE = 3.5 / STEPS;
  for (let i = 0; i < STEPS; i++) {
    boxL(i * RUN, (i + 1) * RUN, -1.5, 1.5, 2.0, 2.0 + (i + 1) * RISE, i % 2 ? 0xd8b7a0 : 0xd2b09a);
  }
  const slopeLen = Math.hypot(6.5, 3.5);
  for (const v of [-1.78, 1.78]) {
    const b = mesh(new THREE.BoxGeometry(slopeLen + 0.6, 1.3, 0.55), 0xd0a891, scene, LX(3.25), 2.0 + 1.75 + 0.25, LZ(v));
    b.rotation.z = -Math.atan2(3.5, 6.5);
  }

  // ---------- upper platform (top y = 5.5) ----------
  const UP = 5.5;
  boxL(6.5, 13.6, -4.5, 4.6, 0, UP, 0xd6b8a2);
  merlons(LX(6.5), LZ(-1.5), LX(10.8), LZ(-1.5), UP);
  fence(LX(13.25), LZ(-4.2), LX(13.25), LZ(4.6), UP);     // fence ahead
  fence(LX(6.6), LZ(4.6), LX(13.25), LZ(4.6), UP);        // fence on right
  brazier(LX(12.7), UP, LZ(3.9));
  // walkway along world -x with merlons on its left side
  boxL(9, 48, -9.6, -4.0, 0, UP, 0xd6b8a2);
  merlons(LX(9), LZ(-9.35), LX(48), LZ(-9.35), UP);
  fence(LX(13.25), LZ(-4.2), LX(23), LZ(-4.2), UP);       // fence right of walkway
  boxL(23, 48, -4.3, -3.9, UP, UP + 0.7, 0xcfa58e);       // low wall continuing
  brazier(LX(24), UP, LZ(-8.7));
  boxL(42, 43.2, -9.6, -8.4, UP, UP + 4.2, 0xc07862);     // pillars at walkway end
  boxL(42, 43.2, -5.2, -4.0, UP, UP + 4.2, 0xc07862);

  // thatched-roof yard building (below platform, behind the fence)
  boxL(15, 22, 0.5, 7.5, 0, 3.8, 0xc49882);
  boxL(14.6, 22.4, 0.1, 7.9, 3.8, 4.1, 0x9b6c52);
  const bush = mesh(new THREE.SphereGeometry(1.4, 10, 8), 0x8a8c3e, scene, LX(14.5), 1.0, LZ(-1.0));
  bush.scale.set(1.4, 0.8, 1.2);
  // far town in the later view (world -x)
  boxL(25, 60, 7, 9.5, 0, 4.5, 0xc59a85);                // long reddish wall
  boxL(32, 46, 12, 26, 0, 6.5, 0xb89884);
  boxL(48, 62, 12, 22, 0, 8, 0xa98a78);
  boxL(72, 78, -1, 5, 0, 17, 0xb98a72);                  // tall tower
  boxL(73, 77, 0, 4, 17, 19.5, 0xab7a64);
  boxL(55, 65, -14, -9, 0, 6, 0xb08c76);
  // palms left of the walkway
  palm(LX(27), LZ(-11), 10);
  palm(LX(30), LZ(-12.5), 9);
  palm(LX(26), LZ(-13.5), 8);

  // ---------- articulated human proxy ----------
  function makeHuman(c) {
    const H = {};
    H.root = new THREE.Group(); scene.add(H.root);
    H.hips = group(H.root, 0, 1.0, 0);
    mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), c.pelvis, H.hips);
    if (c.skirt) mesh(new THREE.BoxGeometry(0.4, 0.34, 0.28), c.skirt, H.hips, 0, -0.17, 0);
    H.spine = group(H.hips, 0, 0.08, 0);
    mesh(new THREE.BoxGeometry(0.44, 0.52, 0.27), c.torso, H.spine, 0, 0.3, 0);
    H.neck = group(H.spine, 0, 0.6, 0);
    mesh(new THREE.SphereGeometry(0.135, 12, 10), c.head, H.neck, 0, 0.1, 0);
    if (c.bow) {
      const bw = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.3, 6), c.bow, H.spine, 0.05, 0.38, 0.18);
      bw.rotation.z = 0.55;
      const q = mesh(new THREE.BoxGeometry(0.13, 0.42, 0.1), 0x3c3a2a, H.spine, -0.08, 0.36, 0.18);
      q.rotation.z = -0.35;
    }
    function arm(side) {
      const sh = group(H.spine, side * 0.28, 0.5, 0);
      mesh(new THREE.BoxGeometry(0.11, 0.31, 0.11), c.arm, sh, 0, -0.15, 0);
      const el = group(sh, 0, -0.3, 0);
      mesh(new THREE.BoxGeometry(0.095, 0.29, 0.095), c.arm, el, 0, -0.145, 0);
      return [sh, el];
    }
    [H.shL, H.elL] = arm(-1); [H.shR, H.elR] = arm(1);
    function leg(side) {
      const hp = group(H.hips, side * 0.1, -0.05, 0);
      mesh(new THREE.BoxGeometry(0.15, 0.45, 0.15), c.leg, hp, 0, -0.225, 0);
      const kn = group(hp, 0, -0.45, 0);
      mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), c.leg, kn, 0, -0.21, 0);
      mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), c.foot, kn, 0, -0.45, -0.05);
      return [hp, kn];
    }
    [H.hipL, H.kneeL] = leg(-1); [H.hipR, H.kneeR] = leg(1);
    if (c.cape) {
      H.cape = group(H.hips, -0.06, 0.04, 0.13);
      mesh(new THREE.BoxGeometry(0.26, 0.7, 0.03), c.cape, H.cape, 0, -0.35, 0);
    }
    return H;
  }
  const hero = makeHuman({ pelvis: 0x5a4a3a, skirt: 0xdcd6c8, torso: 0x3a3129, head: 0xd8d5ca, arm: 0x6b4a36,
    leg: 0x463c34, foot: 0x332a22, cape: 0xd09a36, bow: 0x6a5a3a });
  const guardOuter = group(scene, 0, 0, 0);
  const guard = makeHuman({ pelvis: 0x564a3c, torso: 0x48433b, head: 0x6a5c46, arm: 0x5c4838,
    leg: 0x3b3631, foot: 0x2e2a26 });
  scene.remove(guard.root); guardOuter.add(guard.root);

  // ---------- poses ----------
  const legDepth = (h, k) => 0.05 + 0.45 * Math.cos(h) + 0.49 * Math.cos(h + k);
  function base() {
    return { hipsY: 1.0, lean: 0, hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0.1, shR: 0.1,
      abL: 0.08, abR: 0.08, elL: 0.3, elR: 0.3, cape: -0.15 };
  }
  function ground_(p, lift = 0) { p.hipsY = Math.max(legDepth(p.hipL, p.kneeL), legDepth(p.hipR, p.kneeR)) + lift; return p; }
  function run(ph, hipOff = 0) {
    const p = base(), s = Math.sin(ph), c = Math.cos(ph);
    p.hipL = hipOff + 0.85 * s; p.hipR = hipOff - 0.85 * s;
    p.kneeL = -0.3 - hipOff * 0.8 - 1.3 * Math.max(0, c); p.kneeR = -0.3 - hipOff * 0.8 - 1.3 * Math.max(0, -c);
    p.shL = -0.65 * s; p.shR = 0.65 * s; p.elL = 1.3; p.elR = 1.3; p.lean = -0.32; p.cape = -0.75 - 0.1 * s;
    return ground_(p, 0.04 * Math.abs(s));
  }
  function crouch(ph) {
    const p = base(), s = Math.sin(ph), c = Math.cos(ph);
    p.hipL = 1.0 + 0.35 * s; p.hipR = 1.0 - 0.35 * s;
    p.kneeL = -1.5 - 0.35 * Math.max(0, c); p.kneeR = -1.5 - 0.35 * Math.max(0, -c);
    p.lean = -0.85; p.shL = 0.6 - 0.3 * s; p.shR = 0.55 + 0.3 * s; p.elL = 0.9; p.elR = 0.9; p.cape = -0.4;
    return ground_(p);
  }
  function climb(ph) {
    const p = base(), s = Math.sin(ph);
    p.shL = 2.8 + 0.25 * s; p.shR = 2.8 - 0.25 * s; p.elL = 0.35 - 0.2 * s; p.elR = 0.35 + 0.2 * s;
    p.abL = 0.15; p.abR = 0.15;
    p.hipL = 0.75 + 0.5 * s; p.hipR = 0.75 - 0.5 * s; p.kneeL = -1.25; p.kneeR = -1.25; p.lean = 0.05;
    p.hipsY = 1.0; p.cape = -0.05;
    return p;
  }
  function leap() {
    const p = base();
    p.hipL = 0.9; p.kneeL = -1.1; p.hipR = -0.2; p.kneeR = -0.6; p.shL = 2.2; p.shR = 2.0; p.elL = 0.4; p.elR = 0.4;
    p.lean = -0.1; p.hipsY = 1.0; p.cape = -0.6; return p;
  }
  function crouchTop() {
    const p = base();
    p.hipL = 1.3; p.kneeL = -2.0; p.hipR = 1.0; p.kneeR = -1.75; p.lean = -0.6;
    p.shL = 0.6; p.shR = 1.35; p.elL = 0.7; p.elR = 0.3; p.cape = -0.25; return ground_(p);
  }
  function standTop() {
    const p = base();
    p.hipL = 0.3; p.kneeL = -0.45; p.hipR = 0.1; p.kneeR = -0.25; p.lean = -0.3;
    p.shL = 0.4; p.shR = 0.35; p.elL = 0.6; p.elR = 0.6; p.abL = 0.25; p.abR = 0.25; p.cape = -0.2; return ground_(p);
  }
  function jumpAir() {
    const p = base();
    p.hipL = 0.9; p.kneeL = -1.2; p.hipR = -0.3; p.kneeR = -0.9; p.shL = 1.4; p.shR = 0.8; p.abL = 0.5; p.abR = 0.5;
    p.elL = 0.4; p.elR = 0.4; p.lean = -0.15; p.hipsY = 1.0; p.cape = -1.0; return p;
  }
  function land() {
    const p = base();
    p.hipL = 1.25; p.kneeL = -1.95; p.hipR = 1.15; p.kneeR = -1.85; p.lean = -0.75; p.shL = 0.7; p.shR = 0.7;
    p.elL = 0.5; p.elR = 0.5; p.cape = -0.5; return ground_(p);
  }
  function kneel() {
    const p = base();
    p.hipL = 1.5; p.kneeL = -1.55; p.hipR = -0.05; p.kneeR = -1.5; p.lean = -0.3; p.shL = 0.5; p.shR = 0.6;
    p.elL = 0.8; p.elR = 0.8; return ground_(p);
  }
  function prone() {
    const p = base();
    p.shL = 0.35; p.shR = -0.25; p.elL = 0.4; p.elR = 0.2; p.hipL = 0.1; p.kneeL = -0.2; p.hipsY = 1.0; return p;
  }
  function blendPose(a, b, w) {
    const o = {};
    for (const k in a) o[k] = a[k] + (b[k] - a[k]) * w;
    return o;
  }
  function applyPose(H, p) {
    H.hips.position.y = p.hipsY;
    H.spine.rotation.x = p.lean;
    H.neck.rotation.x = -p.lean * 0.5;
    H.shL.rotation.set(p.shL, 0, -p.abL);
    H.shR.rotation.set(p.shR, 0, p.abR);
    H.elL.rotation.x = p.elL; H.elR.rotation.x = p.elR;
    H.hipL.rotation.x = p.hipL; H.hipR.rotation.x = p.hipR;
    H.kneeL.rotation.x = p.kneeL; H.kneeR.rotation.x = p.kneeR;
    if (H.cape) H.cape.rotation.x = p.cape;
  }

  // ---------- math helpers ----------
  const lerp = (a, b, s) => a + (b - a) * s;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (s) => s * s * (3 - 2 * s);
  function bez(A, C, B, s) {
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    const x = a * A[0] + b * C[0] + c * B[0], z = a * A[1] + b * C[1] + c * B[1];
    const dx = 2 * (1 - s) * (C[0] - A[0]) + 2 * s * (B[0] - C[0]);
    const dz = 2 * (1 - s) * (C[1] - A[1]) + 2 * s * (B[1] - C[1]);
    return { x, z, yaw: Math.atan2(-dx, -dz) };
  }
  const stairY = (x) => 2.0 + 3.5 * clamp01((-2.5 - x) / 6.5);

  // ---------- hero root trajectory (feet point, world) ----------
  const T_END = duration || 10.6;
  const HX = -0.2, CZ = 0.72;
  function heroRoot(t) {
    t = Math.max(0, Math.min(T_END, t));
    if (t < 0.55) { const s = t / 0.55; return { x: HX, y: 0, z: lerp(5.6, 1.0, s), yaw: 0 }; }
    if (t < 0.75) { const s = (t - 0.55) / 0.2; return { x: HX, y: 0.55 * Math.sin(s * PI / 2), z: lerp(1.0, CZ, s), yaw: 0 }; }
    if (t < 1.15) { const s = (t - 0.75) / 0.4; return { x: HX, y: lerp(0.55, 2.5, s), z: CZ, yaw: 0 }; }
    if (t < 1.45) { const s = (t - 1.15) / 0.3; return { x: HX, y: lerp(2.5, 3.45, clamp01(ease(s) * 1.35)), z: lerp(CZ, 0.15, ease(s)), yaw: 0 }; }
    if (t < 1.95) { const s = (t - 1.45) / 0.5; return { x: HX, y: 3.45, z: lerp(0.15, -0.8, ease(s)), yaw: 0 }; }
    if (t < 2.45) { const s = (t - 1.95) / 0.5; return { x: lerp(HX, -0.6, s), y: lerp(3.45, 2.0, s) + 2.0 * s * (1 - s), z: lerp(-0.8, -4.2, s), yaw: 0 }; }
    if (t < 2.6) { const s = (t - 2.45) / 0.15; return { x: -0.6, y: 2.0, z: lerp(-4.2, -4.5, s), yaw: 0 }; }
    if (t < 3.25) { const s = (t - 2.6) / 0.65; const b = bez([-0.6, -4.5], [-0.6, -6.5], [-2.3, -6.5], s); return { x: b.x, y: 2.0, z: b.z, yaw: b.yaw }; }
    if (t < 4.75) { const s = (t - 3.25) / 1.5; const x = lerp(-2.3, -9.2, s); return { x, y: stairY(x), z: -6.5, yaw: PI / 2 }; }
    if (t < 6.2) { const s = (t - 4.75) / 1.45; return { x: lerp(-9.2, -14.0, s), y: UP, z: lerp(-6.5, -6.8, s), yaw: PI / 2 + 0.06 }; }
    if (t < 6.6) { const s = (t - 6.2) / 0.4; const b = bez([-14.0, -6.8], [-14.5, -6.8], [-14.5, -6.0], s); return { x: b.x, y: UP, z: b.z, yaw: b.yaw }; }
    if (t < 8.8) { const s = (t - 6.6) / 2.2; return { x: -14.5, y: UP, z: lerp(-6.0, -1.0, s), yaw: PI }; }
    if (t < 9.3) { const s = (t - 8.8) / 0.5; const b = bez([-14.5, -1.0], [-14.5, 0.1], [-15.3, 0.1], s); return { x: b.x, y: UP, z: b.z, yaw: b.yaw }; }
    if (t < 10.0) { const s = (t - 9.3) / 0.7; return { x: lerp(-15.3, -18.3, s), y: UP, z: 0.1, yaw: PI / 2 }; }
    const s = (t - 10.0) / 0.6; return { x: lerp(-18.3, -19.5, s), y: UP, z: 0.1, yaw: PI / 2 };
  }

  // ---------- hero pose schedule ----------
  const RUNF = 2 * PI * 1.5, CRF = 2 * PI * 0.95;
  const SEG = [
    [0.0, (t) => run(RUNF * t)],
    [0.55, () => leap()],
    [0.75, (t) => climb(2 * PI * 2.0 * (t - 0.75))],
    [1.2, () => crouchTop()],
    [1.6, () => standTop()],
    [1.95, () => jumpAir()],
    [2.42, () => land()],
    [2.68, (t) => run(RUNF * t)],
    [3.25, (t) => run(RUNF * t, 0.35)],
    [4.75, (t) => run(RUNF * t)],
    [4.9, (t) => crouch(CRF * t)],
    [9.3, (t) => run(RUNF * t)],
    [9.9, (t) => crouch(CRF * t)],
  ];
  const FADE = 0.14;
  function heroPose(t) {
    let i = 0;
    while (i + 1 < SEG.length && t >= SEG[i + 1][0]) i++;
    const p = SEG[i][1](t);
    if (i > 0 && t - SEG[i][0] < FADE) {
      const prev = SEG[i - 1][1](t);
      return blendPose(prev, p, ease((t - SEG[i][0]) / FADE));
    }
    return p;
  }

  // ---------- guard (enemy on the gate top) ----------
  const G_KNEEL = { x: 0.5, y: 3.45, z: -0.5 };
  const G_DEAD = { x: 0.22, y: 3.45 + 0.16, z: -0.72 };
  function updateGuard(t) {
    const s = ease(clamp01((t - 1.0) / 0.3));
    guardOuter.position.set(lerp(G_KNEEL.x, G_DEAD.x, s), lerp(G_KNEEL.y, G_DEAD.y, s), lerp(G_KNEEL.z, G_DEAD.z, s));
    guardOuter.rotation.set(0, 0, -PI / 2 * s);
    guard.root.position.set(0, 0, 0);
    guard.root.rotation.set(0, PI + 0.3, 0);
    const pk = kneel(); const pp = prone();
    // when tipped over, keep hips at standing height so the body lies flat
    applyPose(guard, blendPose(pk, pp, s));
  }

  // ---------- camera ----------
  // keys: t, psi (yaw of camera frame), offset (right, up, back), look (right, up, forward)
  const CK = [
    [0.0, 0, 0.3, 2.0, 4.4, 0.0, 1.3, 3],
    [0.47, 0, 0.2, 1.9, 3.1, 0.0, 1.5, 3],
    [0.92, 0, 0.1, 1.9, 3.3, 0.0, 1.8, 3],
    [1.38, 0, 0.0, 1.0, 3.6, 0.0, 0.7, 3],
    [1.83, 0, 0.2, 2.4, 3.0, 0.0, 0.0, 3.5],
    [2.3, 0, 0.2, 2.6, 3.4, 0.0, -0.2, 4],
    [2.77, 0.3, 0.6, 3.3, 3.8, -0.6, 0.0, 3],
    [3.22, 1.35, 0.4, 2.8, 3.8, 0.0, 1.0, 2.0],
    [3.5, PI / 2, 0.3, 3.0, 3.9, 0.0, 1.2, 1.2],
    [4.13, PI / 2, 0.2, 3.0, 4.0, 0.0, 1.2, 1.2],
    [4.6, PI / 2, 0.2, 3.1, 4.2, 0.0, 0.9, 2.0],
    [5.07, PI / 2 + 0.12, 0.2, 3.4, 4.6, 0.0, 0.3, 4],
    [5.5, PI / 2 + 0.15, 0.2, 3.7, 4.8, 0.0, 0.2, 4],
    [6.0, PI / 2 + 0.22, 0.2, 3.8, 5.0, 0.0, 0.2, 4],
    [6.45, PI / 2 + 0.35, 0.2, 3.8, 5.0, 0.0, 0.2, 4],
    [6.9, PI / 2 + 0.28, 0.0, 3.7, 5.0, 0.0, 0.3, 4],
    [7.4, PI / 2 + 0.06, 0.0, 3.6, 5.0, -0.2, 0.3, 4],
    [8.28, PI / 2 + 0.03, 0.2, 3.5, 5.0, -0.3, 0.3, 4],
    [8.75, PI / 2 + 0.02, 0.4, 3.4, 5.0, -0.3, 0.4, 4.5],
    [9.2, PI / 2, 0.3, 3.2, 4.2, 0.0, 0.3, 5],
    [10.6, PI / 2, 0.3, 2.9, 3.6, 0.0, 0.2, 4.5],
  ];
  const NC = CK[0].length;
  const tangents = CK.map((k, i) => {
    const m = new Array(NC).fill(0);
    if (i === 0 || i === CK.length - 1) return m;
    for (let j = 1; j < NC; j++) {
      const d0 = k[j] - CK[i - 1][j], d1 = CK[i + 1][j] - k[j];
      if (d0 * d1 <= 0) m[j] = 0;
      else m[j] = (CK[i + 1][j] - CK[i - 1][j]) / (CK[i + 1][0] - CK[i - 1][0]);
    }
    return m;
  });
  function camKey(t) {
    if (t <= CK[0][0]) return CK[0].slice();
    if (t >= CK[CK.length - 1][0]) return CK[CK.length - 1].slice();
    let i = 0;
    while (t > CK[i + 1][0]) i++;
    const a = CK[i], b = CK[i + 1], ma = tangents[i], mb = tangents[i + 1];
    const dt = b[0] - a[0], s = (t - a[0]) / dt;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s;
    const h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    const o = [t];
    for (let j = 1; j < NC; j++) o.push(h00 * a[j] + h10 * dt * ma[j] + h01 * b[j] + h11 * dt * mb[j]);
    return o;
  }
  function smoothRoot(t) {
    let x = 0, y = 0, z = 0; const N = 7;
    for (let k = 0; k < N; k++) {
      const r = heroRoot(t - 0.05 * k); x += r.x; y += r.y; z += r.z;
    }
    return { x: x / N, y: y / N, z: z / N };
  }
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function updateCamera(t) {
    const k = camKey(t);
    const psi = k[1];
    const F = [-Math.sin(psi), -Math.cos(psi)], R = [Math.cos(psi), -Math.sin(psi)];
    const r = smoothRoot(t);
    camPos.set(r.x + R[0] * k[2] - F[0] * k[4], r.y + k[3], r.z + R[1] * k[2] - F[1] * k[4]);
    camLook.set(r.x + R[0] * k[5] + F[0] * k[7], r.y + k[6], r.z + R[1] * k[5] + F[1] * k[7]);
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(camLook);
    camera.fov = 50;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function update(time, frame) {
    const t = Math.max(0, Math.min(T_END, time));
    const r = heroRoot(t);
    hero.root.position.set(r.x, r.y, r.z);
    hero.root.rotation.set(0, r.yaw, 0);
    applyPose(hero, heroPose(t));
    updateGuard(t);
    updateCamera(t);
  }

  update(0, 0);
  return { scene, camera, update };
}
