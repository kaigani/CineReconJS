// CineRecon L1 proxy reconstruction - video21 (first-person walk into a derelict corridor)
// Three.js sampled-frame baseline. Single continuous handheld shot, no cuts.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.03, 80);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic PRNG ----------
  let s = (seed >>> 0) || 12345;
  function rand() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- materials ----------
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const M = {
    orange: lam(0x8c6c3c),
    w1grey: lam(0x7e8474),
    darkStrip: lam(0x3a2c1c),
    rwLower: lam(0x3c4544),
    rwUpper: lam(0x5e5f58),
    rwUpperFar: lam(0x3c3f3b),
    lw: lam(0x353b38),
    alcove: lam(0x3a423f),
    floor: lam(0x393a36),
    ceil: lam(0x3e3e3a),
    windowGlass: basic(0xeef0ee),
    mullion: lam(0x2a2c2a),
    radiator: lam(0x8a8a84),
    door: lam(0x9c9684),
    doorSlit: lam(0x3c4040),
    pallet: lam(0x7a6650),
    pipeRust: lam(0x5a3020),
    pipeGrey: lam(0x6e6e6a),
    pipeWhite: lam(0x9a9a96),
    endWall: lam(0x6e6a62),
    doorLeaf: lam(0x34332f),
    backRoom: basic(0x8a8a84),
    backFloor: basic(0x76766f),
    cabinet: basic(0x4a4e4a),
    lamp: basic(0xfff6e6),
    strip: basic(0xe6e6e2),
    panel: lam(0x8e8e88),
    debris: lam(0x82827c),
    debrisBright: lam(0xa8a8a2),
    mound: lam(0x55534e),
    shelf: lam(0x2e3230),
    cable: lam(0x111111),
    gun: lam(0x141414),
  };

  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    scene.add(m);
    return m;
  }
  function boxE(x0, x1, y0, y1, z0, z1, mat) {
    return box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  function cyl(r, len, mat, x, y, z, axis) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    scene.add(m);
    return m;
  }

  // ---------- environment ----------
  // Corridor along -Z: x in [-2, 2], floor y=0, ceiling y=3, end wall at z=-14.
  // Start area (z > 0) right of the corridor mouth, facing painted wall W1 at z=0 (x 2..6.5).
  // A window alcove opens off the corridor's left wall (x -5.6..-2, z -6.5..-2.5).
  boxE(-5.8, 6.5, -0.1, 0, -14.2, 4.5, M.floor);
  boxE(-5.8, 6.5, 3.0, 3.1, -14.2, 4.5, M.ceil);

  // W1 painted front wall (paint line 1.63 m)
  const PL = 1.63;
  boxE(2.0, 6.5, 0, PL, -0.2, 0, M.orange);
  boxE(2.0, 6.5, PL, 3.0, -0.2, 0, M.w1grey);
  boxE(2.45, 2.57, 0, 3.0, 0, 0.05, M.darkStrip);
  boxE(6.5, 6.7, 0, 3.0, -0.2, 4.5, M.rwUpper);
  boxE(-2.4, 6.7, 0, 3.0, 4.5, 4.7, M.lw);

  // Right corridor wall x = 2
  boxE(2.0, 2.2, 0, PL, -0.6, 0, M.orange);
  boxE(2.0, 2.2, PL, 3.0, -0.6, 0, M.w1grey);
  boxE(2.0, 2.2, 0, 1.5, -14, -0.6, M.rwLower);
  boxE(2.0, 2.2, 1.5, 3.0, -5.0, -0.6, M.rwUpper);
  boxE(2.0, 2.2, 1.5, 3.0, -14, -5.0, M.rwUpperFar);
  boxE(1.95, 2.0, 0, 2.1, -2.3, -1.4, M.door);
  boxE(1.93, 1.95, 1.1, 1.7, -2.05, -1.75, M.doorSlit);
  cyl(0.045, 3.0, M.pipeWhite, 1.9, 1.5, -4.0, 'y');
  cyl(0.045, 3.0, M.pipeWhite, 1.9, 1.5, -4.12, 'y');
  cyl(0.07, 16, M.pipeRust, 1.82, 2.82, -6.0, 'z');
  cyl(0.08, 16, M.pipeGrey, 1.7, 2.6, -6.0, 'z');
  cyl(0.035, 16, M.mullion, 1.92, 2.35, -6.0, 'z');
  box(0.1, 1.25, 1.1, M.pallet, 1.72, 0.6, -3.1, 0, 0, 0.32);
  box(1.0, 0.14, 1.2, M.pallet, 1.35, 0.07, -3.8, 0, 0.2, 0);
  box(0.5, 0.3, 0.4, M.radiator, 1.55, 0.15, -4.5, 0, 0.3, 0);
  box(0.1, 2.0, 1.3, M.shelf, 1.55, 1.0, -10.5, 0, 0, 0.35); // fallen shelving

  // Left corridor wall x = -2 with alcove opening z -5.5..-2.8
  boxE(-2.2, -2.0, 0, 3.0, -2.8, 4.5, M.lw);
  boxE(-2.2, -2.0, 0, 3.0, -14, -5.5, M.lw);
  // alcove walls
  boxE(-5.6, -2.0, 0, 3.0, -2.8, -2.6, M.alcove);     // near side wall
  boxE(-5.8, -5.6, 0, 3.0, -5.7, -2.6, M.alcove);     // far-left wall
  // window wall at z=-5.5 facing +Z with window x -5.3..-2.3, y 1.0..2.8
  const WZ = -5.5, WB = 0.9, WT = 2.95;
  boxE(-5.6, -2.0, 0, WB, WZ - 0.2, WZ, M.alcove);
  boxE(-5.6, -2.0, WT, 3.0, WZ - 0.2, WZ, M.alcove);
  boxE(-5.6, -5.3, WB, WT, WZ - 0.2, WZ, M.alcove);
  boxE(-2.1, -2.0, WB, WT, WZ - 0.2, WZ, M.alcove);
  boxE(-5.3, -2.1, WB, WT, WZ - 0.3, WZ - 0.25, M.windowGlass);
  boxE(-4.33, -4.27, WB, WT, WZ - 0.16, WZ - 0.1, M.mullion);
  boxE(-3.33, -3.27, WB, WT, WZ - 0.16, WZ - 0.1, M.mullion);
  for (let i = 0; i < 5; i++) {
    const yy = 1.3 + i * 0.3;
    boxE(-5.3, -2.1, yy, yy + 0.02, WZ - 0.14, WZ - 0.1, M.mullion);
  }
  boxE(-2.9, -2.2, 0.2, 0.85, WZ, WZ + 0.15, M.radiator);
  boxE(-2.2, -1.9, 0, 3.0, WZ - 0.4, WZ, M.lw); // dark column

  // hanging broken ceiling panel near the corridor mouth
  box(1.5, 0.03, 1.0, M.panel, -0.5, 2.6, -4.0, 0.25, 0.1, -0.45);

  // End wall at z = -14: closed leaf x -1.2..-0.15, lit opening x -0.15..1.6, height 2.0
  boxE(-2.0, -0.15, 0, 3.0, -14.2, -14.0, M.endWall);
  boxE(1.6, 2.0, 0, 3.0, -14.2, -14.0, M.endWall);
  boxE(-0.15, 1.6, 2.0, 3.0, -14.2, -14.0, M.endWall);
  boxE(-1.2, -0.15, 0, 2.0, -14.0, -13.95, M.doorLeaf);
  // bright back room
  boxE(-1.4, 2.8, -0.02, 0, -17.5, -14.2, M.backFloor);
  boxE(-1.4, 2.8, 0, 3.0, -17.7, -17.5, M.backRoom);
  boxE(-1.6, -1.4, 0, 3.0, -17.5, -14.2, M.backRoom);
  boxE(2.8, 3.0, 0, 3.0, -17.5, -14.2, M.backRoom);
  boxE(-1.4, 2.8, 3.0, 3.1, -17.5, -14.2, M.backRoom);
  boxE(0.3, 1.0, 0.0, 1.9, -17.5, -17.2, M.cabinet);
  boxE(-0.1, -0.05, 0, 2.6, -16.5, -15.0, M.cabinet);
  boxE(1.55, 1.6, 0, 2.0, -15.0, -14.2, M.doorLeaf); // opened leaf
  // wall lamp
  boxE(-1.95, -1.65, 2.53, 2.67, -13.98, -13.9, M.lamp);
  // debris mound before the doorway
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.mound);
  mound.scale.set(0.9, 0.35, 0.8);
  mound.position.set(-1.4, 0, -12.8);
  scene.add(mound);
  // fluorescent strip, hanging panel, cables
  boxE(-0.9, 0.5, 2.93, 2.98, -8.86, -8.74, M.strip);
  box(0.9, 0.03, 0.7, M.panel, 1.0, 2.65, -8.9, 0.5, 0.3, 0.2);
  cyl(0.015, 1.0, M.cable, -0.6, 2.5, -12.4, 'y');
  cyl(0.015, 0.7, M.cable, -0.3, 2.65, -12.6, 'y');
  cyl(0.015, 0.9, M.cable, 0.2, 2.55, -12.2, 'y');

  // floor debris slabs (seeded)
  function slab(x, z, sz, mat) {
    box(sz * (0.7 + rand() * 0.6), 0.03, sz * (0.5 + rand() * 0.5), mat,
      x, 0.03, z, (rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.25);
  }
  for (let i = 0; i < 40; i++) slab(-1.8 + rand() * 3.4, -13.3 + rand() * 7.3, 0.3 + rand() * 0.45, M.debris);
  for (let i = 0; i < 10; i++) slab(-1.8 + rand() * 2.6, -6.8 + rand() * 5.6, 0.35 + rand() * 0.45, M.debris);
  for (let i = 0; i < 6; i++) slab(-4.8 + rand() * 3.6, -5.2 + rand() * 2.2, 0.4 + rand() * 0.5, M.debrisBright);
  slab(-0.6, -2.4, 1.0, M.debrisBright);
  slab(-1.4, -3.4, 0.9, M.debrisBright);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x9aa0a0, 0x202020, 0.35));
  const startLight = new THREE.PointLight(0xfff0dc, 34, 9, 2);
  startLight.position.set(1.4, 1.9, 3.6);
  scene.add(startLight);
  const winLight = new THREE.PointLight(0xe8eef0, 26, 5.5, 2);
  winLight.position.set(-3.6, 1.9, -4.6);
  scene.add(winLight);
  const midLight = new THREE.PointLight(0xe0e4e0, 14, 7, 2);
  midLight.position.set(0.3, 2.6, -2.6);
  scene.add(midLight);
  const stripLight = new THREE.PointLight(0xe8ece8, 6, 6.0, 2);
  stripLight.position.set(-0.4, 2.7, -8.8);
  scene.add(stripLight);
  const lampLight = new THREE.PointLight(0xfff2dd, 9, 5.5, 2);
  lampLight.position.set(-1.6, 2.4, -13.6);
  scene.add(lampLight);
  const backLight = new THREE.PointLight(0xffffff, 6, 5, 2);
  backLight.position.set(0.7, 2.0, -14.6);
  scene.add(backLight);

  // ---------- first-person rifle (camera child), barrel aligned so it reads vertical in frame ----------
  const gun = new THREE.Group();
  camera.add(gun);
  const front = new THREE.Vector3(0.079, -0.215, -0.555);
  const back = new THREE.Vector3(0.0143, -0.31, -0.10);
  const axis = back.clone().sub(front);
  const len = axis.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  function gunPart(w, h, s0, s1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len * (s1 - s0)), M.gun);
    m.quaternion.copy(q);
    m.position.copy(front).addScaledVector(axis, (s0 + s1) / 2);
    gun.add(m);
    return m;
  }
  gunPart(0.03, 0.04, 0.0, 0.06);     // front sight base
  gunPart(0.055, 0.055, 0.05, 0.4);   // handguard
  gunPart(0.07, 0.07, 0.38, 1.0);     // receiver
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.03, 0.007), M.gun);
  post.position.set(0.079, -0.183, -0.555);
  gun.add(post);
  for (const dx of [-0.011, 0.011]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.022, 0.012), M.gun);
    ear.position.set(0.079 + dx, -0.188, -0.555);
    gun.add(ear);
  }

  // ---------- camera keyframes ----------
  // t, x, y(eye), z, yawRight(deg), pitchUp(deg)
  const K = [
    [0.000, 2.82, 1.60, 1.40, 0.0, -10.0],
    [0.458, 2.78, 1.60, 1.38, 1.5, -9.5],
    [0.917, 2.72, 1.61, 1.36, 3.5, -9.0],
    [1.375, 2.58, 1.62, 1.30, 6.0, -8.5],
    [1.833, 2.04, 1.58, 0.92, 6.0, -12.0],
    [2.292, 0.90, 1.58, 0.55, 22.0, -5.0],
    [2.708, 0.75, 1.60, 0.00, 26.0, -4.0],
    [3.167, 0.70, 1.60, -0.55, 19.0, -3.0],
    [3.625, 0.70, 1.60, -1.05, 17.7, -2.0],
    [4.083, 0.70, 1.60, -1.50, 12.4, -1.5],
    [4.542, 0.70, 1.60, -1.92, 11.2, -1.5],
    [5.000, 0.70, 1.60, -2.35, 17.7, -1.5],
    [5.458, 0.70, 1.60, -2.77, 11.8, -1.5],
    [5.917, 0.70, 1.60, -3.20, 7.5, -1.5],
    [6.375, 0.70, 1.60, -3.62, -4.4, -1.5],
    [6.833, 0.70, 1.60, -4.04, 0.3, -1.5],
    [7.292, 0.70, 1.60, -4.47, 16.5, -1.5],
    [7.750, 0.70, 1.60, -4.89, 8.1, -1.5],
    [8.167, 0.70, 1.60, -5.28, -3.1, -1.5],
    [8.625, 0.70, 1.60, -5.70, 1.0, -1.5],
    [9.083, 0.70, 1.60, -6.13, 16.2, -1.5],
    [9.542, 0.70, 1.60, -6.55, -0.4, -1.5],
    [10.000, 0.70, 1.60, -6.97, -2.3, -1.5],
    [10.458, 0.70, 1.60, -7.40, 1.9, -1.5],
  ];
  const N = K.length;
  function sample(t, c) {
    if (t <= K[0][0]) return K[0][c];
    if (t >= K[N - 1][0]) return K[N - 1][c];
    let i = 0;
    while (i < N - 2 && t > K[i + 1][0]) i++;
    const t0 = K[i][0], t1 = K[i + 1][0];
    const p0 = K[i][c], p1 = K[i + 1][c];
    const h = t1 - t0;
    const m0 = i > 0 ? (K[i + 1][c] - K[i - 1][c]) / (K[i + 1][0] - K[i - 1][0]) : (p1 - p0) / h;
    const m1 = i + 2 < N ? (K[i + 2][c] - K[i][c]) / (K[i + 2][0] - K[i][0]) : (p1 - p0) / h;
    const u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
  }

  const D2R = Math.PI / 180;
  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));
    const walk = Math.min(1, Math.max(0, (t - 1.6) / 0.8));
    const bob = 0.018 * walk * Math.sin(2 * Math.PI * 1.8 * t);
    camera.position.set(sample(t, 1), sample(t, 2) + bob, sample(t, 3));
    camera.rotation.set(sample(t, 5) * D2R, -sample(t, 4) * D2R, 0.006 * walk * Math.sin(2 * Math.PI * 0.9 * t));
    camera.updateProjectionMatrix();
    gun.position.set(0.005 * walk * Math.sin(2 * Math.PI * 0.9 * t), 0.005 * walk * Math.sin(2 * Math.PI * 1.8 * t + 0.6), 0);
    gun.rotation.set(0, 0, 0.025 * walk * Math.sin(2 * Math.PI * 0.9 * t + 0.3));
  }

  update(0, 0);
  return { scene, camera, update };
}
