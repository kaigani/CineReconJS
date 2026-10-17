// CineRecon L1 proxy reconstruction - first-person facility walkthrough (video28)
// Three.js sampled-frame baseline. All geometry is procedural boxes/cylinders/spheres.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d0d);

  const camera = new THREE.PerspectiveCamera(74, width / height, 0.03, 200);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.55);
  dir.position.set(3, 8, 5);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.25);
  dir2.position.set(-5, 4, -3);
  scene.add(dir2);
  const headLamp = new THREE.PointLight(0xffffff, 0.35, 0, 0);
  camera.add(headLamp);
  const flashLight = new THREE.PointLight(0xffd8a0, 0, 0, 0);
  flashLight.position.set(-20.5, 5.6, -8.6);
  scene.add(flashLight);

  // ---------- deterministic rng ----------
  let rs = (seed >>> 0) || 12345;
  function rng() {
    rs |= 0; rs = (rs + 0x6D2B79F5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- materials ----------
  const L = (hex) => new THREE.MeshLambertMaterial({ color: hex });
  const E = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const mat = {
    grayWall: L(0x7c8690), grayFloor: L(0x75787a), grayCeil: L(0x3a3d40),
    darkMetal: L(0x34383c), grate: L(0x4a4c4e), panel: L(0x34404c), screen: E(0xdde6ee),
    tealWall: L(0x527f76), tealFloor: L(0x48665f), tealCeil: L(0x2c3a36), tealPillar: L(0x6a958d),
    upWall: L(0x8492a6), upFloor: L(0x66625c), upCeil: L(0x4a4a38), trim: L(0x5a626c), shaft: L(0x1e2a27), darkWall: L(0x3a4048),
    barrel: L(0xb4bcb8), cyl: L(0xc4ccd0), cylBand: L(0x4a5054), red: L(0xb02424), ladder: L(0x5a6266),
    yellow: L(0xe0c020), black: L(0x151515),
    greenLight: E(0x50e0a0), cyanLight: E(0x70e8f0), warmLight: E(0xf0e0b0),
    coat: L(0xd6dce2), shirt: L(0x5a80c8), tie: L(0x9a2a40), skin: L(0xc0a294), hair: L(0xd0d0cc),
    pants: L(0x8a7f5e), shoe: L(0x4a2a1e),
    zBody: L(0xa88060), zPants: L(0x6a5a48), zArm: L(0x9a6a50), zClaw: L(0x8a3a2a), zRed: L(0x9a3020),
    crab: L(0xd8ccb0), crabLeg: L(0x9a4a30), crabDead: L(0xa05028),
    gun: L(0x2a2e32), gunDark: L(0x1c1f22), glove: L(0x3a3228), sleeve: L(0x8a6a2a),
    debris: L(0x8a9090), splat: L(0xc8c070),
  };

  const unit = new THREE.BoxGeometry(1, 1, 1);
  function B(x0, x1, y0, y1, z0, z1, m, parent) {
    const me = new THREE.Mesh(unit, m);
    me.scale.set(x1 - x0, y1 - y0, z1 - z0);
    me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(me);
    return me;
  }
  function C(w, h, d, x, y, z, m, parent) {
    const me = new THREE.Mesh(unit, m);
    me.scale.set(w, h, d);
    me.position.set(x, y, z);
    (parent || scene).add(me);
    return me;
  }
  function cyl(r, h, x, y0, z, m, seg) {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 16), m);
    me.position.set(x, y0 + h / 2, z);
    scene.add(me);
    return me;
  }

  // =====================================================================
  // LOWER LEVEL (floor y=0)
  // teal wall helper: teal panel up to 2.5 m, dark cornice band above
  function TW(x0, x1, z0, z1, top, m) {
    B(x0, x1, 0, 2.5, z0, z1, m || mat.tealWall);
    B(x0, x1, 2.5, top, z0, z1, mat.tealCeil);
  }
  // Room A (grey start room): x[-1,5] z[-3,3.5]
  B(-1, 5, -0.2, 0, -3, 3.5, mat.grayFloor);
  B(-1, 5, 3.9, 4.1, -3, 3.5, mat.grayCeil);
  B(-1.3, -1, 0, 4.1, -3.8, 3.8, mat.grayWall);
  B(5, 5.3, 0, 4.1, -3.8, 3.8, mat.grayWall);
  B(-1.3, 5.3, 0, 4.1, 3.5, 3.8, mat.grayWall);
  // thick wall between A and B with doorway x[-0.4,1.8], height 3.4
  B(-2.5, -0.4, 0, 4.1, -3.8, -3.0, mat.grayWall);
  B(1.8, 5.3, 0, 4.1, -3.8, -3.0, mat.grayWall);
  B(-0.4, 1.8, 3.4, 4.1, -3.8, -3.0, mat.grayWall);
  // dark metal door frame protruding into room A
  B(-0.8, -0.4, 0, 3.75, -3.0, -2.65, mat.darkMetal);
  B(1.8, 2.2, 0, 3.75, -3.0, -2.65, mat.darkMetal);
  B(-0.4, 1.8, 3.4, 3.75, -3.0, -2.65, mat.darkMetal);
  B(-1, -0.8, 0, 0.25, -3.0, -2.85, mat.darkMetal); // baseboard
  B(2.2, 5, 0, 0.25, -3.0, -2.85, mat.darkMetal);
  B(-0.3, 1.7, 0, 0.12, -2.65, -2.0, mat.grate); // floor grate step
  // hazard sign (yellow triangle with black inner)
  {
    const tri = new THREE.Mesh(new THREE.CircleGeometry(0.4, 3), mat.yellow);
    tri.rotation.z = Math.PI / 2;
    tri.position.set(2.8, 2.1, -2.97);
    scene.add(tri);
    const tri2 = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), mat.black);
    tri2.rotation.z = Math.PI / 2;
    tri2.position.set(2.8, 2.08, -2.96);
    scene.add(tri2);
  }
  // low console box near the left wall (lit white screen facing +x)
  B(-1.0, -0.55, 0, 0.6, -1.5, -0.8, mat.panel);
  B(-0.55, -0.53, 0.08, 0.55, -1.45, -0.85, mat.screen);

  // Room B (teal): x[-2.2,2.9] z[-10.4,-3.8]; opening in west wall z[-9.0,-6.4]
  B(-2.2, 6.9, -0.2, 0, -10.4, -3.8, mat.tealFloor);
  B(-2.2, 6.9, 3.5, 3.7, -10.4, -3.8, mat.tealCeil);
  TW(6.9, 7.2, -10.7, -3.8, 3.7);
  TW(-2.5, 7.2, -10.7, -10.4, 3.7);
  TW(5.3, 7.2, -3.8, -3.5, 3.7);
  TW(-2.5, -2.2, -10.7, -9.0, 3.7, mat.tealPillar);
  TW(-2.5, -2.2, -6.4, -3.8, 3.7);
  // barrels against back wall
  for (const bx of [5.0, 6.25]) {
    cyl(0.52, 1.35, bx, 0, -9.8, mat.barrel, 8);
  }
  C(0.5, 0.06, 0.3, 0.5, 3.47, -6.5, mat.greenLight);
  C(0.5, 0.06, 0.3, 4.5, 3.47, -7.0, mat.greenLight);
  // dead headcrab on floor (visible through doorway at start)
  {
    const dh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat.crabDead);
    dh.scale.set(1.2, 0.45, 1.0);
    dh.position.set(0.4, 0.08, -9.9);
    scene.add(dh);
  }

  // Corridor C1 heading -x: x[-8,-2.2] z[-9.0,-6.4]
  B(-8, -2.2, -0.2, 0, -9.0, -6.4, mat.tealFloor);
  B(-8, -2.2, 3.5, 3.7, -9.0, -6.4, mat.tealCeil);
  TW(-7.85, -2.35, -9.3, -9.0, 3.7);
  TW(-7.85, -2.35, -6.4, -6.1, 3.7);
  C(0.5, 0.06, 0.3, -4.5, 3.47, -7.7, mat.greenLight);

  // Hall H: x[-15,-8] z[-12,-4]; ceiling hole for ladder x[-15,-13.6] z[-9.4,-7.8]
  B(-15, -8, -0.2, 0, -12, -4, mat.tealFloor);
  B(-13.6, -8, 3.5, 3.85, -12, -4, mat.tealCeil);
  B(-15, -13.6, 3.5, 3.85, -12, -9.7, mat.tealCeil);
  B(-15, -13.6, 3.5, 3.85, -7.5, -4, mat.tealCeil);
  TW(-8, -7.7, -12.3, -9.0, 3.85);
  TW(-8, -7.7, -6.4, -3.7, 3.85);
  TW(-15.3, -15, -12.3, -3.7, 3.85);
  TW(-15, -7.7, -12.3, -12, 3.85);
  TW(-15, -7.7, -4, -3.7, 3.85);
  // free-standing block, corner toward the corridor
  {
    const blk = C(1.6, 3.5, 1.6, -9.9, 1.75, -7.7, mat.tealPillar);
    blk.rotation.y = Math.PI / 4;
  }
  // ladder niche side walls (rise to the upper floor)
  B(-15, -13.6, 0, 3.9, -9.7, -9.4, mat.tealWall);
  B(-15, -13.6, 0, 3.9, -7.8, -7.5, mat.tealWall);
  B(-13.6, -13.5, 3.2, 3.5, -9.4, -7.8, mat.trim); // thin lip on the hall side of the hatch
  B(-15, -14.98, 0, 3.9, -9.4, -7.8, mat.shaft); // shadowed wall behind the ladder
  C(0.5, 0.06, 0.3, -11.5, 3.47, -10.5, mat.greenLight);
  C(0.5, 0.06, 0.3, -11.5, 3.47, -5.2, mat.greenLight);

  // Ladder against west wall of hall, rising into upper room
  B(-14.9, -14.8, 0, 5.05, -9.2, -9.1, mat.ladder);
  B(-14.9, -14.8, 0, 5.05, -8.1, -8.0, mat.ladder);
  for (let y = 0.35; y < 3.95; y += 0.35) {
    B(-14.89, -14.81, y - 0.03, y + 0.03, -9.1, -8.1, mat.ladder);
  }
  for (const z0 of [-9.2, -8.1]) {
    B(-15.5, -14.8, 5.0, 5.1, z0, z0 + 0.1, mat.ladder);
    B(-15.5, -15.4, 3.95, 5.05, z0, z0 + 0.1, mat.ladder);
  }

  // =====================================================================
  // UPPER LEVEL (floor y=4)
  // Room U1: x[-22,-13.2] z[-11,-6.2], floor hole above ladder
  B(-22, -15, 3.9, 4.0, -11, -6.2, mat.upFloor);
  B(-15, -13.6, 3.9, 4.0, -11, -9.4, mat.upFloor);
  B(-15, -13.6, 3.9, 4.0, -7.8, -6.2, mat.upFloor);
  B(-13.6, -13.2, 3.9, 4.0, -11, -6.2, mat.upFloor);
  B(-22, -13.2, 7.4, 7.6, -11, -6.2, mat.upCeil);
  B(-13.2, -12.9, 3.9, 7.6, -11.3, -5.9, mat.upWall);
  B(-22.3, -22, 3.9, 7.6, -11.3, -5.9, mat.upWall);
  B(-22.3, -12.9, 3.9, 7.6, -6.2, -5.9, mat.upWall);
  B(-22.3, -20.6, 3.9, 7.6, -11.3, -11.0, mat.upWall);
  B(-17.9, -12.9, 3.9, 7.6, -11.3, -11.0, mat.upWall);
  B(-20.6, -17.9, 7.0, 7.6, -11.3, -11.0, mat.upWall);
  // cornice trim
  B(-22, -13.2, 7.1, 7.4, -6.4, -6.2, mat.trim);
  B(-22, -13.2, 7.1, 7.4, -11.0, -10.8, mat.trim);
  B(-22, -21.8, 7.1, 7.4, -11.0, -6.2, mat.trim);
  B(-13.4, -13.2, 7.1, 7.4, -11.0, -6.2, mat.trim);
  C(0.6, 0.08, 0.45, -15.8, 7.36, -8.6, mat.cyanLight);
  C(0.6, 0.08, 0.35, -19.2, 7.36, -8.6, mat.warmLight);

  // Scientist alcove room S: x[-20.6,-17.9] z[-15,-11] (east wall in shadow)
  B(-20.6, -17.9, 3.9, 4.0, -15, -11, mat.upFloor);
  B(-20.6, -17.9, 7.2, 7.4, -15, -11, mat.upCeil);
  B(-20.9, -20.6, 3.9, 7.4, -15.3, -11.0, mat.upWall);
  B(-17.9, -17.6, 3.9, 7.4, -15.3, -11.0, mat.darkWall);
  B(-20.9, -17.6, 3.9, 7.4, -15.3, -15.0, mat.upWall);
  B(-20.6, -17.9, 6.95, 7.2, -15.0, -14.8, mat.trim);
  B(-20.6, -20.4, 6.95, 7.2, -15.0, -11.0, mat.trim);
  C(0.5, 0.1, 0.35, -19.25, 7.15, -12.8, mat.cyanLight);

  // gas cylinders (explode)
  const cylinders = [];
  for (const z of [-9.6, -8.95, -8.3, -7.65]) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.5, 14), mat.cyl);
    body.position.y = 1.25;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8), mat.cylBand);
    cap.position.y = 2.6;
    g.add(cap);
    g.position.set(-21.55, 4.0, z);
    scene.add(g);
    cylinders.push(g);
  }
  const dangerBar = new THREE.Group();
  C(0.06, 0.18, 3.3, 0, 0, 0, mat.red, dangerBar);
  C(0.06, 0.05, 3.3, 0, -0.11, 0, mat.black, dangerBar);
  dangerBar.position.set(-20.95, 5.05, -8.6);
  scene.add(dangerBar);

  // ---------- explosion ----------
  const T_EXP = 8.95;
  const EXP_O = new THREE.Vector3(-21.3, 5.3, -8.6);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending }));
  flash.position.copy(EXP_O);
  scene.add(flash);
  const debris = [];
  for (let i = 0; i < 14; i++) {
    const s = 0.12 + rng() * 0.25;
    const m = new THREE.Mesh(unit, i % 3 === 0 ? mat.cyl : mat.debris);
    m.scale.set(s, s * 0.35, s * 0.8);
    scene.add(m);
    const v = new THREE.Vector3(0.3 + rng() * 2.0, 1.5 + rng() * 3.5, (rng() - 0.5) * 5.0);
    const o = EXP_O.clone().add(new THREE.Vector3(rng() * 0.4, (rng() - 0.5) * 0.8, (rng() - 0.5) * 1.6));
    const half = s * 0.175;
    const g = -9.8;
    // landing time: o.y + v.y t + g t^2/2 = 4.0 + half
    const a = 0.5 * g, b = v.y, c = o.y - (4.0 + half);
    const tl = (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const spin = new THREE.Vector3(rng() * 12 - 6, rng() * 12 - 6, rng() * 12 - 6);
    const rest = new THREE.Vector3(rng() * 0.3, rng() * 3, rng() * 0.3);
    debris.push({ m, v, o, tl, spin, rest, half });
  }
  // persistent wreck pile and splats after explosion
  const afterGroup = new THREE.Group();
  scene.add(afterGroup);
  for (let i = 0; i < 9; i++) {
    const s = 0.25 + rng() * 0.35;
    const m = C(s, 0.06, s * 0.6, -21.6 + rng() * 1.8, 4.03, -10.4 + rng() * 3.6, i % 2 ? mat.debris : mat.cyl, afterGroup);
    m.rotation.y = rng() * 3;
    m.rotation.z = (rng() - 0.5) * 0.4;
  }
  const splatGeo = new THREE.CircleGeometry(1, 9);
  const splatSpots = [[-20.8, -6.7, 0.35], [-20.2, -10.5, 0.35], [-19.3, -6.6, 0.25], [-21.2, -9.9, 0.3],
    [-20.0, -8.4, 0.3], [-18.6, -10.6, 0.22], [-18.0, -6.6, 0.2]];
  for (const [x, z, r] of splatSpots) {
    const sp = new THREE.Mesh(splatGeo, mat.splat);
    sp.rotation.x = -Math.PI / 2;
    sp.scale.set(r * (1 + rng() * 0.5), r, 1);
    sp.position.set(x, 4.012, z);
    afterGroup.add(sp);
  }

  // ---------- articulated figure builder ----------
  function pivot(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  // Scientist (faces +z)
  const sci = new THREE.Group();
  sci.position.set(-19.2, 4.0, -14.45);
  scene.add(sci);
  const sPelvis = pivot(sci, 0, 0.95, 0);
  const sTorso = pivot(sPelvis, 0, 0, 0);
  C(0.44, 0.6, 0.26, 0, 0.31, 0, mat.coat, sTorso);
  C(0.24, 0.56, 0.02, 0, 0.3, 0.135, mat.shirt, sTorso);
  C(0.075, 0.42, 0.025, 0, 0.32, 0.148, mat.tie, sTorso);
  C(0.46, 0.34, 0.28, 0, -0.14, 0, mat.coat, sPelvis);
  const sHead = pivot(sTorso, 0, 0.62, 0);
  {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), mat.skin);
    h.position.set(0, 0.12, 0.015);
    h.scale.set(1, 1.15, 1);
    sHead.add(h);
    const hr = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mat.hair);
    hr.position.set(0, 0.17, -0.045);
    hr.scale.set(1.35, 0.85, 1.0);
    sHead.add(hr);
  }
  function leg(parent, sx, mThigh, mShin, mShoe) {
    const hip = pivot(parent, sx, -0.02, 0);
    C(0.15, 0.46, 0.16, 0, -0.23, 0, mThigh, hip);
    const knee = pivot(hip, 0, -0.46, 0);
    C(0.13, 0.44, 0.14, 0, -0.22, 0, mShin, knee);
    C(0.12, 0.08, 0.26, 0, -0.46, 0.05, mShoe, knee);
    return { hip, knee };
  }
  function arm(parent, sx, mUp, mLow, mHand, len) {
    const sh = pivot(parent, sx, 0.55, 0);
    C(0.12, 0.32 * len, 0.13, 0, -0.16 * len, 0, mUp, sh);
    const el = pivot(sh, 0, -0.32 * len, 0);
    C(0.11, 0.28 * len, 0.12, 0, -0.14 * len, 0, mLow, el);
    const hand = C(0.08, 0.1, 0.06, 0, -0.28 * len - 0.05, 0, mHand, el);
    return { sh, el, hand };
  }
  const sLegL = leg(sPelvis, 0.11, mat.pants, mat.pants, mat.shoe);
  const sLegR = leg(sPelvis, -0.11, mat.pants, mat.pants, mat.shoe);
  const sArmL = arm(sTorso, 0.27, mat.coat, mat.coat, mat.skin, 1);
  const sArmR = arm(sTorso, -0.27, mat.coat, mat.coat, mat.skin, 1);

  // Zombie (faces +x toward the ladder)
  const zom = new THREE.Group();
  zom.position.set(-20.9, 4.0, -7.0);
  zom.rotation.y = Math.PI / 2;
  scene.add(zom);
  const zPelvis = pivot(zom, 0, 0.92, 0);
  const zTorso = pivot(zPelvis, 0, 0, 0);
  C(0.42, 0.6, 0.26, 0, 0.31, 0, mat.zBody, zTorso);
  C(0.3, 0.3, 0.02, 0, 0.3, 0.135, mat.zRed, zTorso);
  const zHead = pivot(zTorso, 0, 0.62, 0);
  {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat.crab);
    h.scale.set(1.1, 0.7, 1.2);
    h.position.set(0, 0.12, 0.03);
    zHead.add(h);
  }
  const zLegL = leg(zPelvis, 0.11, mat.zPants, mat.zPants, mat.zPants);
  const zLegR = leg(zPelvis, -0.11, mat.zPants, mat.zPants, mat.zPants);
  const zArmL = arm(zTorso, 0.27, mat.zArm, mat.zArm, mat.zClaw, 1.15);
  const zArmR = arm(zTorso, -0.27, mat.zArm, mat.zArm, mat.zClaw, 1.15);
  for (const a of [zArmL, zArmR]) {
    for (const dx of [-0.04, 0.0, 0.04]) {
      const cl = C(0.015, 0.22, 0.015, dx, -0.32 * 1.15 - 0.17, 0.04, mat.zClaw, a.el);
      cl.rotation.x = 0.4;
    }
  }

  // Headcrabs on upper floor
  function headcrab(x, z, ry) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat.crab);
    b.scale.set(1.0, 0.6, 1.15);
    b.position.y = 0.14;
    g.add(b);
    for (const [lx, lz] of [[0.16, 0.12], [-0.16, 0.12], [0.16, -0.1], [-0.16, -0.1]]) {
      const l = C(0.03, 0.03, 0.22, lx, 0.06, lz, mat.crabLeg, g);
      l.rotation.y = Math.atan2(lx, lz);
    }
    g.position.set(x, 4.0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
  }
  const crabs = [headcrab(-20.4, -8.5, Math.PI / 2), headcrab(-20.0, -9.8, Math.PI / 2.4)];

  // ---------- first-person weapons (children of camera) ----------
  const pistol = new THREE.Group();
  camera.add(pistol);
  const pistolInner = new THREE.Group();
  pistol.add(pistolInner);
  C(0.055, 0.05, 0.24, 0, 0.03, 0, mat.gun, pistolInner);      // slide
  C(0.05, 0.045, 0.2, 0, -0.015, 0.01, mat.gunDark, pistolInner); // frame
  {
    const grip = C(0.05, 0.15, 0.07, 0, -0.1, 0.08, mat.gunDark, pistolInner);
    grip.rotation.x = -0.3;
    C(0.1, 0.1, 0.13, 0.0, -0.16, 0.13, mat.glove, pistolInner);
    C(0.11, 0.11, 0.22, 0.01, -0.2, 0.28, mat.sleeve, pistolInner);
  }
  const mp5 = new THREE.Group();
  camera.add(mp5);
  const mp5Inner = new THREE.Group();
  mp5.add(mp5Inner);
  C(0.2, 0.22, 0.6, 0, 0, 0, mat.gun, mp5Inner);
  C(0.09, 0.22, 0.1, 0, -0.17, 0.12, mat.gunDark, mp5Inner);
  C(0.07, 0.07, 0.22, 0, 0.02, -0.42, mat.gunDark, mp5Inner);
  C(0.16, 0.16, 0.24, 0, -0.14, 0.32, mat.glove, mp5Inner);

  // ---------- camera keyframes: t, x, y, z, yaw(deg, +left), pitch(deg, +up) ----------
  const K = [
    [0.0, 0.4, 1.6, 1.0, 0, -8],
    [0.45, 1.0, 1.6, -0.5, -3, -4],
    [0.9, 1.4, 1.6, -2.0, -8, 0],
    [1.25, 1.5, 1.6, -4.1, 0, -6],
    [1.8, 4.6, 1.6, -6.5, -3, -14],
    [2.7, -1.0, 1.6, -9.45, 85, -4],
    [3.6, -0.8, 1.6, -8.7, 92, -3],
    [4.5, -8.0, 1.6, -7.7, 90, -2],
    [5.0, -10.2, 1.6, -9.6, 110, 8],
    [5.45, -13.3, 1.6, -8.65, 90, 27],
    [6.35, -14.2, 2.7, -8.75, 90, 45],
    [6.9, -14.3, 4.3, -8.8, 90, 20],
    [7.27, -14.3, 5.4, -8.8, 90, -4],
    [8.17, -14.3, 5.35, -8.8, 90, -4],
    [9.08, -14.3, 5.35, -8.8, 90, -3],
    [9.5, -14.3, 4.2, -8.8, 90, 0],
    [9.98, -14.3, 2.6, -8.8, 90, 0],
    [10.4, -14.1, 2.5, -8.8, 90, 20],
    [10.9, -14.0, 3.3, -8.8, 90, 55],
    [11.4, -14.3, 4.5, -8.8, 90, 15],
    [11.8, -14.3, 5.4, -8.8, 90, -4],
    [12.7, -15.6, 5.6, -8.5, 100, -12],
    [13.6, -17.0, 5.6, -8.6, 88, -5],
    [14.0, -18.4, 5.6, -8.6, 45, -4],
    [14.5, -19.0, 5.6, -8.6, -3, -4],
    [15.43, -19.3, 5.6, -12.1, -2, -24],
    [16.0, -19.3, 5.6, -13.0, -4, -40],
    [16.35, -19.3, 5.6, -13.5, -8, -52],
    [16.8, -19.25, 5.6, -13.3, -4, -46],
    [17.25, -19.2, 5.6, -12.9, 0, -40],
    [18.17, -19.2, 5.6, -13.05, 0, -3],
    [19.07, -19.2, 5.6, -13.05, 0, -2],
    [19.98, -19.2, 5.6, -13.05, 1, -2],
    [20.3, -19.2, 5.6, -12.85, 1, -2],
    [20.9, -19.3, 5.6, -11.6, 2, 0],
  ];
  const NK = K.length;
  function slope(i, c) {
    if (i <= 0 || i >= NK - 1) return 0;
    const a = K[i - 1], b = K[i + 1], m = K[i];
    const d1 = (m[c] - a[c]) / (m[0] - a[0]);
    const d2 = (b[c] - m[c]) / (b[0] - m[0]);
    if (d1 * d2 <= 0) return 0; // hold extremes (no overshoot)
    return (b[c] - a[c]) / (b[0] - a[0]);
  }
  function sampleK(t, c) {
    if (t <= K[0][0]) return K[0][c];
    if (t >= K[NK - 1][0]) return K[NK - 1][c];
    let i = 0;
    while (i < NK - 2 && t > K[i + 1][0]) i++;
    const k0 = K[i], k1 = K[i + 1];
    const dt = k1[0] - k0[0];
    const s = (t - k0[0]) / dt;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return h00 * k0[c] + h10 * dt * slope(i, c) + h01 * k1[c] + h11 * dt * slope(i + 1, c);
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, s) => a + (b - a) * s;
  const D = Math.PI / 180;

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));

    // ---- camera ----
    let kick = 0;
    for (const ts of [8.62, 8.84]) {
      const d = t - ts;
      if (d >= 0 && d < 0.25) kick += Math.exp(-d * 18) * 2.0;
    }
    camera.position.set(sampleK(t, 1), sampleK(t, 2), sampleK(t, 3));
    camera.rotation.set((sampleK(t, 5) + kick) * D, sampleK(t, 4) * D, 0);
    camera.fov = 74;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // ---- weapons ----
    const mpOut = smooth(t / 0.4);       // MP5 lowers away
    const piIn = smooth((t - 0.35) / 0.4); // pistol raises
    mp5.visible = t < 0.42;
    mp5.position.set(0.36, -0.26 - 0.5 * mpOut, -0.5);
    mp5Inner.rotation.set(1.05 - 0.5 * mpOut, 0.25, 0.05);
    pistol.visible = t >= 0.35;
    let recoil = 0;
    for (const ts of [8.62, 8.84]) {
      const d = t - ts;
      if (d >= 0 && d < 0.3) recoil += Math.exp(-d * 14);
    }
    const bob = 0.006 * Math.sin(t * 9.0);
    pistol.position.set(0.21, -0.2 - 0.35 * (1 - piIn) + bob - 0.012 * recoil, -0.44 + 0.03 * recoil);
    pistolInner.rotation.set(0.28 + 0.35 * recoil, 0.12, 0.0);

    // ---- explosion / gas cylinders ----
    const te = t - T_EXP;
    for (const c of cylinders) c.visible = te < 0;
    dangerBar.visible = te < 0;
    afterGroup.visible = te >= 0;
    if (te >= 0 && te < 0.8) {
      const s = te / 0.8;
      flash.visible = true;
      flash.scale.setScalar(0.6 + 3.2 * Math.sqrt(s));
      flash.material.opacity = 0.55 * (1 - s) * (1 - s);
      flashLight.intensity = 1.2 * (1 - s);
    } else {
      flash.visible = false;
      flash.material.opacity = 0;
      flashLight.intensity = 0;
    }
    for (const d of debris) {
      d.m.visible = te >= 0;
      if (te < 0) continue;
      const tt = Math.min(te, d.tl);
      let x = d.o.x + d.v.x * tt;
      const y = d.o.y + d.v.y * tt - 4.9 * tt * tt;
      let z = d.o.z + d.v.z * tt;
      x = Math.max(-21.85, Math.min(-15.2, x));
      z = Math.max(-10.85, Math.min(-6.35, z));
      d.m.position.set(x, Math.max(4.0 + d.half, y), z);
      if (te < d.tl) d.m.rotation.set(d.spin.x * te, d.spin.y * te, d.spin.z * te);
      else d.m.rotation.set(d.rest.x, d.rest.y, d.rest.z);
    }

    // ---- zombie ----
    zom.visible = t < 9.45;
    const zs = Math.sin(t * 2.2);
    const zf = smooth((t - 9.12) / 0.3); // blown back by explosion
    zom.position.set(-20.9 + 0.5 * zf, 4.0, -7.0);
    zom.rotation.set(0, Math.PI / 2, 0);
    zPelvis.rotation.set(-1.2 * zf, 0, 0);
    zPelvis.position.y = 0.92 - 0.5 * zf;
    zTorso.rotation.set(0.12 + 0.03 * zs, 0.05 * zs, 0);
    zHead.rotation.set(0.1, 0, 0);
    zArmL.sh.rotation.set(-0.25 + 0.05 * zs, 0, 0.55);
    zArmR.sh.rotation.set(-0.25 - 0.05 * zs, 0, -0.55);
    zArmL.el.rotation.set(-0.5, 0, -0.2);
    zArmR.el.rotation.set(-0.5, 0, 0.2);
    zLegL.hip.rotation.set(0, 0, 0.08);
    zLegR.hip.rotation.set(0, 0, -0.08);
    zLegL.knee.rotation.set(0.1, 0, 0);
    zLegR.knee.rotation.set(0.1, 0, 0);

    // ---- headcrabs (idle, gibbed by explosion) ----
    for (let i = 0; i < crabs.length; i++) {
      crabs[i].visible = te < 0;
      crabs[i].position.y = 4.0 + 0.01 * Math.sin(t * 6 + i);
    }

    // ---- scientist: sitting -> stands up 16.5..17.15 ----
    const st = smooth((t - 16.5) / 0.65);
    const sway = (t > 17.2) ? Math.sin((t - 17.2) * 1.3) : 0;
    sPelvis.position.set(0, lerp(0.1, 0.95, st), lerp(-0.15, 0.08, st));
    sTorso.rotation.set(lerp(0.15, 0.0, st), 0.03 * sway, 0);
    sHead.rotation.set(lerp(0.55, -0.05, st), 0.05 * sway, 0);
    sLegL.hip.rotation.set(lerp(-2.3, 0, st), 0, lerp(0.5, 0.04, st));
    sLegR.hip.rotation.set(lerp(-2.3, 0, st), 0, lerp(-0.5, -0.04, st));
    sLegL.knee.rotation.set(lerp(1.55, 0, st), 0, 0);
    sLegR.knee.rotation.set(lerp(1.55, 0, st), 0, 0);
    sArmL.sh.rotation.set(lerp(-0.9, 0.02 * sway, st), 0, lerp(-0.25, 0.1, st));
    sArmR.sh.rotation.set(lerp(-0.9, -0.02 * sway, st), 0, lerp(0.25, -0.1, st));
    sArmL.el.rotation.set(lerp(-0.35, -0.12, st), 0, 0);
    sArmR.el.rotation.set(lerp(-0.35, -0.12, st), 0, 0);
  }

  update(0, 0);
  return { scene, camera, update };
}
