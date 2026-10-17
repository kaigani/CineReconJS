// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video39.
// One continuous third-person follow shot: a woman in a pointed hat walks away
// from the camera, diagonally from a dirt path onto and then along a long stone bridge.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb6d4d6);
  scene.fog = new THREE.Fog(0xa6c5c8, 10, 230);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 3000);

  // ---------- helpers ----------
  const mat = (c, opts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.0, ...opts });
  function box(w, h, d, m, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function boxB(x0, x1, y0, y1, z0, z1, m) {
    return box(x1 - x0, y1 - y0, Math.abs(z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xd8eef2, 0x4a5030, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
  sun.position.set(-25, 45, 15);
  scene.add(sun);

  // ---------- sky dome (procedural gradient) ----------
  {
    const g = new THREE.SphereGeometry(1500, 32, 16);
    const cols = [];
    const pos = g.attributes.position;
    const top = new THREE.Color(0x6fa9bd), hor = new THREE.Color(0xd2e6e3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1500;
      const t = Math.min(1, Math.max(0, y * 2.2));
      const c = hor.clone().lerp(top, t);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1;
    scene.add(sky);
  }

  // ---------- materials ----------
  const mGrass = mat(0x4f5a2f);
  const mGrassFar = mat(0x5d6d3e);
  const mDirt = mat(0x4a4434);
  const mRock = mat(0x5f665d);
  const mRockDark = mat(0x41463f);
  const mWater = mat(0xa9c4c5, { roughness: 0.4 });
  const mDeck = mat(0x4f5b57);
  const mBrickL = mat(0xa8695c);
  const mBrickR = mat(0x735a55);
  const mPillar = mat(0x9b5a4a);
  const mMoss = mat(0x66763a);
  const mWood = mat(0x4a3a2a);
  const mHill = mat(0x6a7b70);
  const mHillTop = mat(0x6b7c52);
  const mTree = mat(0x34502f);
  const mMesa = mat(0x8fa8aa);

  // ---------- bridge layout constants ----------
  const Z0 = 0.45, Z1 = -30.0;          // entrance (pillar line) and far end
  const LEN = Z0 - Z1, ZM = (Z0 + Z1) / 2;
  const XL = -1.75, XR = 1.22;          // railing centre lines

  // ---------- terrain ----------
  {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mWater);
    w.rotation.x = -Math.PI / 2;
    w.position.y = -6;
    scene.add(w);
  }
  boxB(-8, 70, -6, 0, Z0, 60, mGrass);          // near land (path side)
  boxB(1.6, 70, -6, 0, -1.0, Z0, mGrass);       // right of the entrance
  {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 16), mDirt);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = -0.45;
    p.position.set(1.8, 0.01, 6.5);
    scene.add(p);
  }
  boxB(-16, 4.4, -6, 0, -120, Z1, mGrassFar);   // land beyond the far end
  {
    // right plateau across the ravine (low grassy top, rock face toward the bridge)
    const g = new THREE.BoxGeometry(80, 6.3, 120);
    const m = new THREE.Mesh(g, [mRock, mRock, mGrassFar, mRock, mRock, mRock]);
    m.position.set(4.6 + 40, 0.3 - 3.15, -1.0 - 60);
    scene.add(m);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.5, 26), mRock);
    bank.position.set(3.6, -3.2, -14);
    bank.rotation.z = 0.35;
    scene.add(bank);
  }
  {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mRockDark);
    b.scale.set(6.2, 3.8, 5.0);
    b.position.set(21.5, 4.4, -39);
    b.rotation.set(0.2, 0.5, 0.1);
    scene.add(b);
    const b2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), mRock);
    b2.scale.set(2.6, 1.4, 2.6);
    b2.position.set(8.0, 0.6, -18);
    scene.add(b2);
  }
  box(4.0, 4.4, 3.0, mMoss, 7.5, 2.5, -49);      // mossy ruin arch far right

  // ---------- background mountains ----------
  box(130, 22, 60, mHill, -5, 10, -125);
  box(70, 3, 40, mHillTop, -2, 22, -122);
  {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(16, 28, 16, 7), mHill);
    top.position.set(-2, 29, -128);
    scene.add(top);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 9, 6), mWood);
    trunk.position.set(-2, 41, -125);
    scene.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), mTree);
    crown.scale.set(1.1, 0.9, 1.0);
    crown.position.set(-2, 51, -125);
    scene.add(crown);
    const small = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), mTree);
    small.position.set(-27, 39, -126);
    scene.add(small);
  }
  box(64, 20, 40, mHill, -62, 7, -95);   // layered left cliffs
  box(40, 12, 30, mHill, -68, 21, -102);
  {
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(70, 110, 150, 7), mMesa);
    mesa.position.set(-175, 69, -340);
    scene.add(mesa);
    const mesa2 = new THREE.Mesh(new THREE.CylinderGeometry(80, 140, 80, 7), mMesa);
    mesa2.position.set(-360, 34, -300);
    scene.add(mesa2);
  }
  box(320, 12, 90, mHillTop, 160, 0, -270);

  // ---------- bridge ----------
  boxB(-2.5, 1.55, -0.9, 0.0, Z1, Z0, mDeck);
  boxB(-2.6, -1.95, -0.25, 0.04, Z1, Z0, mBrickL);   // outer salmon ledge, left
  // left arched railing: top beam + posts (top at 0.95 m)
  box(0.42, 0.2, LEN, mBrickL, XL, 0.85, ZM);
  for (let z = Z0 - 1.0; z > Z1; z -= 1.3) box(0.36, 0.76, 0.42, mBrickL, XL, 0.38, z);
  // right railing: base curb, posts, bulky rounded top beam (crest 0.85 m)
  box(0.55, 0.16, LEN, mBrickR, XR, 0.08, ZM);
  for (let z = Z0 - 0.9; z > Z1; z -= 1.0) box(0.4, 0.5, 0.45, mBrickR, XR, 0.28, z);
  {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, LEN, 10), mBrickR);
    beam.rotation.x = Math.PI / 2;
    beam.scale.set(1, 1, 0.7);
    beam.position.set(XR, 0.85 - 0.28 * 0.7, ZM);
    scene.add(beam);
  }
  // entrance pillars (brick stacks with moss caps)
  box(0.85, 0.75, 0.9, mPillar, XL + 0.01, 0.375, Z0);
  box(0.89, 0.06, 0.94, mMoss, XL + 0.01, 0.77, Z0);
  box(0.92, 0.72, 0.95, mPillar, XR - 0.02, 0.36, Z0);
  box(0.96, 0.06, 0.99, mMoss, XR - 0.02, 0.75, Z0);

  // lantern post at the path side (left)
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.4, 6), mWood);
    post.position.set(-4.0, 1.2, 0.2);
    scene.add(post);
    box(0.22, 0.32, 0.22, mat(0x3a3b33), -3.8, 1.85, 0.2);
  }

  // ---------- woman (articulated proxy), faces -Z locally ----------
  const mHat = mat(0x6e5e48);
  const mHair = mat(0xb89a6a);
  const mBlouse = mat(0xb5b8a4);
  const mVest = mat(0x4a3826);
  const mSkirt = mat(0x5a4029);
  const mBoot = mat(0x1f1d1a);
  const mSkin = mat(0xd9b49a);

  const woman = new THREE.Group();
  scene.add(woman);
  const body = new THREE.Group();
  woman.add(body);

  // long skirt: hem 0.15 m, high waist 1.15 m
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.27, 1.0, 16), mSkirt);
  skirt.position.y = 0.65;
  body.add(skirt);
  box(0.3, 0.36, 0.19, mBlouse, 0, 1.31, 0, body);
  box(0.24, 0.32, 0.21, mVest, 0, 1.29, 0.0, body);
  box(0.08, 0.08, 0.08, mSkin, 0, 1.52, 0, body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mHair);
  head.position.set(0, 1.61, 0);
  body.add(head);
  const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.36, 6), mHair);
  braid.position.set(-0.03, 1.41, 0.11);
  braid.rotation.z = 0.08;
  body.add(braid);
  const hat = new THREE.Group();
  hat.position.set(0, 1.68, 0.01);
  hat.rotation.x = 0.12;
  body.add(hat);
  {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.025, 16), mHat);
    hat.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 12), mHat);
    cone.position.y = 0.11;
    cone.rotation.x = 0.15;
    hat.add(cone);
  }

  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(0.18 * side, 1.46, 0);
    body.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.27, 8), mBlouse);
    up.position.y = -0.135;
    sh.add(up);
    const el = new THREE.Group();
    el.position.y = -0.27;
    sh.add(el);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 8), mBlouse);
    lo.position.y = -0.12;
    el.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mSkin);
    hand.position.y = -0.27;
    el.add(hand);
    sh.rotation.z = 0.1 * side;
    return { sh, el };
  }
  const armL = makeArm(-1), armR = makeArm(1);

  const HIP = 0.88, THIGH = 0.43, SHIN = 0.40;
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.09 * side, HIP, 0);
    body.add(hip);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, THIGH, 8), mSkirt);
    th.position.y = -THIGH / 2;
    hip.add(th);
    const knee = new THREE.Group();
    knee.position.y = -THIGH;
    hip.add(knee);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, SHIN, 8), mBoot);
    sh.position.y = -SHIN / 2;
    knee.add(sh);
    box(0.09, 0.05, 0.2, mBoot, 0, -SHIN - 0.025, -0.05, knee);
    return { hip, knee };
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  // ---------- motion model (absolute in time) ----------
  const DEG = Math.PI / 180;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // monotone cubic (Fritsch-Carlson) interpolation through keyframes
  function makeMonotone(xs, ys) {
    const n = xs.length, d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] * d[i] <= 0) ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  // camera yaw (degrees, +left of the bridge axis), estimated from the hill/tree bearing per sample
  const camYawDeg = makeMonotone(
    [0.0, 0.7, 1.4, 2.117, 2.817, 3.517, 4.217, 16.2],
    [22.7, 20.8, 12.4, 4.5, -1.0, -1.2, -1.5, -1.8]);

  // woman: constant walking speed; heading turns from ~46 deg left onto the bridge axis.
  const SPEED = 1.3;
  const headingW = (t) => 46 * DEG * (1 - smooth(0.9, 2.6, t));
  // precompute the deterministic path by integrating the analytic heading (fixed step)
  const DT = 1 / 600, NS = Math.ceil((duration + 0.5) / DT) + 2;
  const PX = new Float32Array(NS), PZ = new Float32Array(NS);
  for (let i = 1; i < NS; i++) {
    const tm = (i - 0.5) * DT, h = headingW(tm);
    PX[i] = PX[i - 1] - SPEED * Math.sin(h) * DT;
    PZ[i] = PZ[i - 1] - SPEED * Math.cos(h) * DT;
  }
  const sample = (arr, t) => {
    const f = Math.max(0, Math.min(NS - 1.001, t / DT)), i = Math.floor(f), a = f - i;
    return arr[i] * (1 - a) + arr[i + 1] * a;
  };
  // anchor: on the bridge she walks at x = -0.45; at t = 2.117 she is at z = 0.8 (just before the pillars)
  const X_OFF = -0.45 - PX[NS - 1];
  const Z_OFF = 0.8 - sample(PZ, 2.117);

  const CAM_BACK = 3.3, CAM_SIDE = 0.94, CAM_H = 1.34, PITCH = -0.8 * DEG;
  const STEP_PERIOD = 1.05;

  function update(time, frame) {
    const t = Math.max(0, Math.min(duration, time));
    const wx = sample(PX, t) + X_OFF, wz = sample(PZ, t) + Z_OFF;
    woman.position.set(wx, 0, wz);
    woman.rotation.set(0, headingW(t), 0);

    // gait
    const ph = 2 * Math.PI * t / STEP_PERIOD;
    const s = Math.sin(ph), c = Math.cos(ph);
    const amp = 0.26;
    const aL = amp * s, aR = -amp * s;
    legL.hip.rotation.x = aL;
    legR.hip.rotation.x = aR;
    legL.knee.rotation.x = -Math.max(0, c) * 0.5;
    legR.knee.rotation.x = -Math.max(0, -c) * 0.5;
    body.position.y = (THIGH + SHIN) * (Math.cos(Math.abs(aL)) - 1);
    armL.sh.rotation.x = -0.2 * s;
    armR.sh.rotation.x = 0.2 * s;
    armL.el.rotation.x = 0.15 + 0.1 * Math.max(0, -s);
    armR.el.rotation.x = 0.15 + 0.1 * Math.max(0, s);
    skirt.rotation.z = 0.03 * s;
    body.rotation.y = 0.05 * s;

    // follow camera orbiting the woman
    const psi = camYawDeg(t) * DEG;
    const fx = -Math.sin(psi), fz = -Math.cos(psi);
    const rx = Math.cos(psi), rz = -Math.sin(psi);
    const cx = wx + CAM_SIDE * rx - CAM_BACK * fx;
    const cz = wz + CAM_SIDE * rz - CAM_BACK * fz;
    camera.position.set(cx, CAM_H, cz);
    camera.lookAt(cx + fx, CAM_H + Math.tan(PITCH), cz + fz);
    camera.updateProjectionMatrix();
  }

  update(0, 0);
  return { scene, camera, update };
}
