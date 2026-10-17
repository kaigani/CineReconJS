// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video16.
// Single continuous shot: a static elevated camera tracks a red taxi driving away
// along a Hong Kong street with an extreme telephoto lens, then zooms out and tilts
// up / pans right to reveal the street canyon, the skyline and a curved flyover with trucks.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const Wpx = width || 1280, Hpx = height || 720;
  const DUR = duration || 5.32;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14);

  const camera = new THREE.PerspectiveCamera(5, Wpx / Hpx, 2, 16000);
  camera.rotation.order = 'YXZ';
  const CAM = new THREE.Vector3(10, 40, 0);
  camera.position.copy(CAM);

  // ---------- seeded RNG (construction time only) ----------
  let rs = ((seed === undefined || seed === null || !isFinite(seed)) ? 12345 : Math.floor(seed)) ^ 0x2f6b9e37;
  rs = rs >>> 0;
  function rand() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rand();
  const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];

  // ---------- lights ----------
  const rev = parseInt(THREE.REVISION, 10) || 160;
  const LF = rev >= 155 ? Math.PI : 1;
  scene.add(new THREE.AmbientLight(0xffffff, 0.78 * LF));
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.6 * LF);
  sun.position.set(-30, 100, 70);
  scene.add(sun);
  scene.add(sun.target);

  // ---------- material / geometry helpers ----------
  const matCache = new Map();
  function lam(hex) {
    const k = 'L' + hex;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color: hex }));
    return matCache.get(k);
  }
  function bas(hex) {
    const k = 'B' + hex;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color: hex }));
    return matCache.get(k);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function boxE(parent, mat, x0, x1, y0, y1, z0, z1) {
    return box(parent, mat, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0),
      (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  function rectGeometry(rects, y) {
    const pos = [], nor = [];
    for (const r of rects) {
      const [x0, x1, z0, z1] = r;
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      for (let i = 0; i < 6; i++) nor.push(0, 1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  }
  function markMat(hex) {
    return new THREE.MeshLambertMaterial({
      color: hex, side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }

  // ---------- sky dome ----------
  {
    const R = 12000;
    const g = new THREE.SphereGeometry(R, 32, 24);
    const pos = g.attributes.position;
    const cols = [];
    const cH = new THREE.Color(0x24384f), cM = new THREE.Color(0x0f1828), cT = new THREE.Color(0x05070c);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / R;
      if (y < 0.02) c.copy(cH);
      else if (y < 0.18) c.copy(cH).lerp(cM, (y - 0.02) / 0.16);
      else c.copy(cM).lerp(cT, Math.min(1, (y - 0.18) / 0.5));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    sky.position.copy(CAM);
    sky.renderOrder = -1;
    scene.add(sky);
  }

  // ---------- ground, street, sidewalks ----------
  // ground split around the street strip so it never overlaps the road (avoids depth fighting)
  {
    const gm = lam(0x1b1d21);
    const gp = (x0, x1, z0, z1) => {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z0 - z1), gm);
      g.rotation.x = -Math.PI / 2;
      g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      scene.add(g);
    };
    gp(-15000, -9.0, 15000, -15000);
    gp(7.6, 15000, 15000, -15000);
    gp(-9.0, 7.6, 15000, 40);
    gp(-9.0, 7.6, -1160, -15000);
  }

  // Road x in [-5.5, 6.4] running along -Z away from the camera.
  const ROAD_L = -5.5, ROAD_R = 6.4, FAC_L = -9.0, FAC_R = 7.6;
  boxE(scene, lam(0x67614f), ROAD_L, ROAD_R, 0, 0.04, 40, -1160);
  boxE(scene, lam(0x6a6864), FAC_L, ROAD_L, 0, 0.18, 40, -1160);
  boxE(scene, lam(0x6a6864), ROAD_R, FAC_R, 0, 0.18, 40, -1160);

  {
    const white = [], yellow = [];
    for (const xl of [-2.8, 0.0, 3.0]) {
      for (let z = -12; z > -1150; z -= 8) white.push([xl - 0.08, xl + 0.08, z, z - 2.5]);
    }
    yellow.push([-5.35, -5.25, 40, -1160], [-5.15, -5.05, 40, -1160]);
    for (let x = -5.0; x < 6.2; x += 1.0) yellow.push([x, x + 0.5, -100.5, -104.0]);
    for (let x = -2.0; x < 6.2; x += 1.3) yellow.push([x, x + 0.6, -246.5, -249.5]);
    scene.add(new THREE.Mesh(rectGeometry(white, 0.06), markMat(0xd6d6cc)));
    scene.add(new THREE.Mesh(rectGeometry(yellow, 0.065), markMat(0xdcc028)));
  }

  // ---------- vehicles ----------
  const wheelGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.22, 12);
  const wheelMat = lam(0x141414);
  const WHEELS = new Map(); // group -> wheel meshes (kept out of userData)
  function makeVehicle(o) {
    const g = new THREE.Group();
    const L = o.L || 4.5, Wd = o.W || 1.75;
    const col = o.color;
    const wheels = [];
    if (o.type === 'van') {
      box(g, lam(col), Wd, 1.25, L, 0, 0.875, 0);
      box(g, lam(0x22262c), Wd - 0.06, 0.55, L * 0.82, 0, 1.775, 0.1);
      box(g, lam(o.roof || col), Wd - 0.04, 0.12, L * 0.86, 0, 2.11, 0.05);
    } else if (o.type === 'truck') {
      const boxL = L - 2.3;
      box(g, lam(o.roof || 0xd8d8d8), Wd + 0.1, 2.7, boxL, 0, 0.75 + 1.35, 1.15);
      box(g, lam(col), Wd, 2.1, 2.1, 0, 0.6 + 1.05, -L / 2 + 1.05);
      box(g, lam(0x202428), Wd - 0.1, 0.6, 0.2, 0, 2.2, -L / 2 + 0.05);
      box(g, lam(0x222222), Wd - 0.3, 0.5, L - 0.4, 0, 0.45, 0);
    } else {
      box(g, lam(col), Wd, 0.62, L, 0, 0.53, 0);
      box(g, lam(0x23272d), Wd - 0.1, 0.5, L * 0.48, 0, 1.09, 0.2);
      box(g, lam(o.roof || col), Wd - 0.16, 0.07, L * 0.4, 0, 1.375, 0.2);
    }
    if (o.type !== 'truck') {
      const tl = bas(0xff2a2a);
      box(g, tl, 0.34, 0.14, 0.06, -(Wd / 2 - 0.22), 0.7, L / 2 + 0.01);
      box(g, tl, 0.34, 0.14, 0.06, (Wd / 2 - 0.22), 0.7, L / 2 + 0.01);
      box(g, bas(0xe8c832), 0.52, 0.14, 0.05, 0, 0.5, L / 2 + 0.02);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * (Wd / 2 - 0.06), 0.31, sz * L * 0.31);
        g.add(w);
        wheels.push(w);
      }
    }
    if (o.taxi) box(g, bas(0xf4f4ec), 0.45, 0.17, 0.3, 0, 1.49, -0.15);
    WHEELS.set(g, wheels);
    return g;
  }

  function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function prof(d0, v1, t1, t2, v2) {
    const a = (v2 - v1) / (t2 - t1);
    const T = t2 - t1;
    return (t) => {
      if (t <= t1) return d0 + v1 * t;
      if (t <= t2) { const u = t - t1; return d0 + v1 * t1 + v1 * u + 0.5 * a * u * u; }
      return d0 + v1 * t1 + v1 * T + 0.5 * a * T * T + v2 * (t - t2);
    };
  }

  // Main subject: red Hong Kong taxi
  const taxiD = prof(100, 95, 1.6, 2.1, 35);
  const taxiX = (t) => -0.6 + 2.2 * smooth01(t / 0.6); // early lane change to the right
  const taxiYawExtra = (t) => -0.14 * Math.exp(-Math.pow((t - 0.24) / 0.16, 2));
  const taxi = makeVehicle({ type: 'car', L: 4.6, W: 1.7, color: 0xb51f2c, roof: 0xcfc6a6, taxi: true });
  scene.add(taxi);
  function taxiCenter(t) { return new THREE.Vector3(taxiX(t), 0.75, -taxiD(t)); }

  const movers = [];
  function addMover(o, x, dfun) {
    const v = makeVehicle(o);
    scene.add(v);
    movers.push({ obj: v, x, d: dfun });
  }
  // silver saloon overtaken by the taxi (~0.58 s); white minibus ahead; distant traffic
  addMover({ type: 'car', L: 4.7, W: 1.8, color: 0x9aa2aa, roof: 0xb0b6bc }, -1.2, prof(126.5, 49, 1.8, 2.3, 25));
  addMover({ type: 'van', L: 5.4, W: 1.95, color: 0xe2e2dc }, -0.8, prof(170.7, 64, 1.84, 2.4, 30));
  addMover({ type: 'car', L: 4.5, W: 1.7, color: 0xb51f2c, roof: 0xcfc6a6, taxi: true }, 1.6, prof(340, 30, 10, 11, 30));
  addMover({ type: 'car', L: 4.5, W: 1.7, color: 0xb51f2c, roof: 0xcfc6a6, taxi: true }, -1.35, prof(390, 28, 10, 11, 28));
  addMover({ type: 'car', L: 4.6, W: 1.8, color: 0xe6e6e2 }, 1.6, prof(420, 30, 10, 11, 30));
  addMover({ type: 'car', L: 4.6, W: 1.8, color: 0x8f969c }, 1.6, prof(470, 28, 10, 11, 28));
  addMover({ type: 'van', L: 5.4, W: 1.95, color: 0xe6e6e0 }, -1.35, prof(520, 26, 10, 11, 26));
  addMover({ type: 'car', L: 4.5, W: 1.7, color: 0xb51f2c, roof: 0xcfc6a6, taxi: true }, -1.35, prof(600, 24, 10, 11, 24));

  const parkedR = [
    [125, 'car', 0xeceae4], [132, 'car', 0x2a2e36], [139.5, 'car', 0x1c1c20], [145.5, 'car', 0x2c3a5a],
    [151.5, 'taxi', 0xc0283a], [157.5, 'car', 0xe6e6e2], [166, 'car', 0xe6e6e2], [175, 'car', 0xe8e8e4],
    [182, 'taxi', 0xb51f2c], [196, 'car', 0xe6e6e2], [210, 'taxi', 0xb51f2c], [217, 'car', 0xa8adb2],
    [234, 'taxi', 0xb51f2c], [241, 'car', 0xe6e6e2], [262, 'car', 0xe6e6e2], [290, 'taxi', 0xb51f2c],
  ];
  for (const [d, ty, c] of parkedR) {
    const isTaxi = ty === 'taxi';
    const v = makeVehicle({ type: ty === 'van' ? 'van' : 'car', L: ty === 'van' ? 5.2 : 4.5, W: ty === 'van' ? 1.95 : 1.75,
      color: c, roof: isTaxi ? 0xcfc6a6 : undefined, taxi: isTaxi });
    v.position.set(5.4, 0, -d);
    scene.add(v);
  }
  const parkedL = [[152, 'van', 0xe8e8e2], [278, 'car', 0x22324a], [284, 'car', 0xe8e8e4], [290.5, 'car', 0xe8e8e4], [297, 'car', 0xe8e8e4]];
  for (const [d, ty, c] of parkedL) {
    const v = makeVehicle({ type: ty, L: ty === 'van' ? 5.2 : 4.5, W: ty === 'van' ? 1.95 : 1.75, color: c });
    v.position.set(-4.1, 0, -d);
    scene.add(v);
  }

  // ---------- overhanging street signs ----------
  function sign(x0, x1, y0, y1, z, hex, side) {
    boxE(scene, bas(hex), x0, x1, y0, y1, z + 0.12, z - 0.12);
    const yb = y1 + 0.1;
    if (side > 0) boxE(scene, lam(0x2a2a2a), x1, FAC_R, yb - 0.05, yb + 0.05, z + 0.05, z - 0.05);
    else boxE(scene, lam(0x2a2a2a), FAC_L, x0, yb - 0.05, yb + 0.05, z + 0.05, z - 0.05);
  }
  sign(3.2, 6.4, 6.4, 7.6, -167.0, 0x8c2a4c, 1);    // maroon sign
  sign(3.7, 6.1, 6.9, 8.1, -178.0, 0xe2c42a, 1);    // yellow estate-agent sign
  sign(-0.6, 4.8, 8.4, 9.6, -189.0, 0x3e9aa4, 1);   // long teal sign
  sign(-3.6, -1.3, 9.5, 10.5, -219.5, 0xa87a48, -1); // brown shoe-shop sign
  sign(-3.8, -1.8, 7.6, 8.4, -221.0, 0xe2b828, -1);  // yellow sign
  sign(1.7, 4.9, 6.2, 7.2, -246.0, 0xe8b0c0, 1);    // pink/white electric shop sign
  sign(2.4, 5.5, 7.3, 8.7, -255.0, 0xeee0c8, 1);    // cream character boxes
  boxE(scene, bas(0xf0a0c0), 5.6, 6.4, 4.0, 10.0, -257.9, -258.1);
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.3, 24), bas(0xff4a5a));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(-0.6, 12, -229);
    scene.add(disc);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.34, 20), bas(0xfff2f2));
    inner.rotation.x = Math.PI / 2;
    inner.position.set(-0.6, 12, -229);
    scene.add(inner);
    boxE(scene, lam(0x2a2a2a), FAC_L, -1.6, 12.0, 12.12, -228.95, -229.05);
  }
  // tall vertical pink/white neon (landmark used to key the zoom-out framing)
  const NEON = new THREE.Vector3(-2.3, 10, -330);
  boxE(scene, bas(0xff7ac0), -3.6, -1.0, 6.0, 14.0, -329.7, -330.3);
  boxE(scene, bas(0xfff0f8), -2.9, -1.7, 6.6, 13.4, -329.6, -330.4);
  boxE(scene, lam(0x2a2a2a), FAC_L, -3.6, 13.5, 13.65, -329.95, -330.05);

  {
    const cols = [0xff4060, 0xff80c0, 0xffd040, 0x40e0ff, 0xf8f8f8, 0xff7030, 0xff3050];
    for (let i = 0; i < 46; i++) {
      const z = -rr(262, 820);
      const left = rand() < 0.5;
      const vertical = rand() < 0.45;
      const w = vertical ? rr(0.8, 1.4) : rr(2.0, 4.5);
      const h = vertical ? rr(3, 8) : rr(0.8, 1.6);
      const y0 = rr(4, 16);
      const c = pick(cols);
      if (Math.abs(z + 330) < 4) continue;
      if (left) boxE(scene, bas(c), FAC_L, FAC_L + w, y0, y0 + h, z + 0.15, z - 0.15);
      else boxE(scene, bas(c), FAC_R - w, FAC_R, y0, y0 + h, z + 0.15, z - 0.15);
    }
  }

  // pedestrians on the left pavement
  {
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.26, 1.25, 8);
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
    const cl = [0x3a6a8a, 0xd8d0c0, 0x2a2a2a, 0xc04040, 0x4a8a6a, 0xe0b040, 0x6a4a8a];
    for (let i = 0; i < 12; i++) {
      const x = rr(-8.3, -5.9), z = -rr(226, 275);
      const b = new THREE.Mesh(bodyGeo, lam(pick(cl)));
      b.position.set(x, 0.18 + 0.85, z);
      scene.add(b);
      const h = new THREE.Mesh(headGeo, lam(0xc89a7a));
      h.position.set(x, 0.18 + 1.62, z);
      scene.add(h);
    }
  }

  // ---------- flyover polyline (curving from the street side toward the right) ----------
  const FLY_PTS = [[15, -55], [14.5, -95], [22, -113], [41.3, -126.3], [67, -142], [92, -154.9],
    [111, -167.4], [130.6, -180.7], [170, -205], [230, -240], [300, -275]];
  const FSEG = [];
  let FLY_LEN = 0;
  for (let i = 0; i < FLY_PTS.length - 1; i++) {
    const [ax, az] = FLY_PTS[i], [bx, bz] = FLY_PTS[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    FSEG.push({ ax, az, dx: (bx - ax) / len, dz: (bz - az) / len, len, s0: FLY_LEN });
    FLY_LEN += len;
  }
  function flyAt(s) {
    let sg = FSEG[0];
    for (const q of FSEG) { if (s >= q.s0) sg = q; }
    const u = Math.max(-5, Math.min(sg.len + 5, s - sg.s0));
    // outward normal (away from camera on the long segments)
    return { x: sg.ax + sg.dx * u, z: sg.az + sg.dz * u, dx: sg.dx, dz: sg.dz, nx: sg.dz, nz: -sg.dx };
  }
  function distToFly(x, z) {
    let best = 1e9;
    for (const q of FSEG) {
      const px = x - q.ax, pz = z - q.az;
      const u = Math.max(0, Math.min(q.len, px * q.dx + pz * q.dz));
      best = Math.min(best, Math.hypot(px - q.dx * u, pz - q.dz * u));
    }
    return best;
  }
  // z of the flyover centreline at a given x (for x beyond the first two segments)
  function flyZ(x) {
    for (const q of FSEG) {
      const bx = q.ax + q.dx * q.len;
      if (q.dx > 0.2 && x >= q.ax && x <= bx) return q.az + q.dz * ((x - q.ax) / q.dx);
    }
    return x < 22 ? -113 : -275 - (x - 300) * 0.5;
  }
  {
    const deckM = lam(0x8a8a86), railM = lam(0x9c9c98), pilM = lam(0x7a7a76);
    const pg = new THREE.CylinderGeometry(1.1, 1.1, 7.8, 10);
    for (const q of FSEG) {
      const ang = Math.atan2(-q.dz, q.dx);
      const cx = q.ax + q.dx * q.len / 2, cz = q.az + q.dz * q.len / 2;
      const d = box(scene, deckM, q.len + 1.2, 1.2, 14, cx, 8.4, cz);
      d.rotation.y = ang;
      for (const side of [-1, 1]) {
        const r = box(scene, railM, q.len + 0.6, 1.0, 0.3, cx + q.dz * 7 * side, 9.5, cz - q.dx * 7 * side);
        r.rotation.y = ang;
      }
    }
    for (let s = 20; s < FLY_LEN; s += 28) {
      const p = flyAt(s);
      const m = new THREE.Mesh(pg, pilM);
      m.position.set(p.x, 3.9, p.z);
      scene.add(m);
    }
  }
  const flyMovers = [];
  function addFly(o, lane, s0, v) {
    const veh = makeVehicle(o);
    scene.add(veh);
    flyMovers.push({ obj: veh, lane, s0, v });
  }
  {
    const truckCols = [[0x2aa8a0, 0x30b0a8], [0x2aa8a0, 0xe8e8e6], [0xe0e0e0, 0x3a7ac0], [0x3a6ab0, 0x2a5aa0], [0xe8e8e8, 0xe8e8e8], [0x6aa060, 0xe0e0e0]];
    [60, 74, 90, 104, 118, 133, 148, 164, 182, 200, 220, 242, 266, 290].forEach((s, i) => {
      const c = s === 90 ? truckCols[0] : truckCols[i % truckCols.length];
      addFly({ type: 'truck', L: 8.5, W: 2.4, color: c[0], roof: c[1] }, 5.25, s, -2.5);
    });
    [66, 80, 96, 112, 128, 145, 162, 180, 200, 222, 246, 270].forEach((s, i) => {
      if (i % 3 === 0) addFly({ type: 'truck', L: 7.0, W: 2.3, color: 0xe6e6e6, roof: 0xe6e6e6 }, 1.75, s, -2.5);
      else addFly({ type: 'van', L: 5.2, W: 1.95, color: i % 2 ? 0xdedede : 0x9aa0a6 }, 1.75, s, -2.5);
    });
    [30, 75, 120, 170].forEach((s, i) => addFly({ type: i % 2 ? 'van' : 'car', L: 4.8, W: 1.85, color: i % 2 ? 0x202a48 : 0x1c1c22 }, -1.75, s, 22));
    [50, 100, 150].forEach((s, i) => addFly({ type: i === 1 ? 'truck' : 'car', L: i === 1 ? 7.5 : 4.6, W: 2.0, color: i === 1 ? 0x3a6ab0 : 0xdedede, roof: 0x3a6ab0 }, -5.25, s, 20));
  }

  // ---------- buildings ----------
  const streetPal = [0x7a5e64, 0x6c625c, 0x505c66, 0x624e56, 0x887a6a, 0x5c5c66, 0x8c6a70, 0x766a5c];
  const darkPal = [0x4a4650, 0x55505a, 0x3e4450, 0x5a5250, 0x464e58, 0x605860, 0x4c5660];
  // tall building on the near left (left frame edge in the wide shot)
  boxE(scene, lam(0x6a6470), -35, -13, 0, 95, -40, -140);
  boxE(scene, lam(0x5e626e), -35, -13, 0, 60, 0, -40);
  boxE(scene, lam(0x7a6a62), -13, FAC_L, 0, 10, -20, -150);
  {
    let z = -150;
    while (z > -1150) {
      const w = rr(10, 22);
      const h = -z > 500 ? rr(18, 45) : rr(12, 28);
      boxE(scene, lam(pick(streetPal)), FAC_L - rr(14, 20), FAC_L, 0, h, z, z - w);
      z -= w;
    }
  }
  // right street-front row; pink corner building first
  boxE(scene, lam(0xa07880), FAC_R, 21, 0, 21, -165, -190);
  boxE(scene, lam(0x8a7e6c), 8.5, 26, 0, 30, -192, -222);
  {
    let z = -222;
    while (z > -1150) {
      const w = rr(10, 22);
      const h = -z > 500 ? rr(20, 45) : rr(15, 35);
      boxE(scene, lam(pick(streetPal)), FAC_R, FAC_R + rr(14, 20), 0, h, z, z - w);
      z -= w;
    }
  }
  for (let i = 0; i < 45; i++) {
    const x = -rr(32, 260), z = -rr(40, 1100);
    const w = rr(15, 30), d = rr(15, 30), h = rr(15, 40);
    box(scene, lam(pick(darkPal)), w, h, d, x, h / 2, z);
  }
  for (let i = 0; i < 90; i++) {
    const x = rr(30, 750), z = -rr(260, 1100);
    const w = rr(15, 30), d = rr(15, 30);
    const h = rand() < 0.08 ? rr(45, 65) : rr(15, 38);
    if (x < 320 && (z + d / 2 > flyZ(x) - 14 || distToFly(x, z) < 26)) continue;
    box(scene, lam(pick(darkPal)), w, h, d, x, h / 2, z);
  }
  boxE(scene, lam(0xb39a98), 45, 78, 0, 16, -205, -232);          // low pink-beige block
  box(scene, lam(0x56687a), 32, 62, 32, 60, 31, -405);             // slender tower (cyan lit)
  box(scene, lam(0xc8ccc6), 34, 58, 34, 244, 29, -560);            // white tower
  box(scene, lam(0xd4d8d2), 22, 55, 22, 130, 27.5, -205);          // white block at right edge
  boxE(scene, lam(0x6a7a8c), 60, 125, 0, 5, -150, -178);           // low shed roof under flyover

  // Far city across the harbour
  {
    const farPal = [0x27324a, 0x2f3b55, 0x3a4660, 0x46506a, 0x525a72, 0x2a4a5a, 0x34445e];
    for (let i = 0; i < 300; i++) {
      const x = rr(-2200, 3200), z = -rr(1150, 3800);
      const w = rr(25, 60), d = rr(25, 60);
      const h = 25 + Math.pow(rand(), 2) * 170;
      const c = rand() < 0.18 ? pick([0x6a8aa0, 0x7a90b8, 0x5a7a90, 0x8a9ab0]) : pick(farPal);
      box(scene, bas(c), w, h, d, x, h / 2, z);
    }
    box(scene, bas(0x34436a), 45, 240, 45, 54.6, 120, -2500);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(26, 50, 4), bas(0xe0c050));
    crown.position.set(54.6, 265, -2500);
    scene.add(crown);
    box(scene, bas(0x8c7c4c), 40, 150, 40, -120, 75, -2300);
    box(scene, bas(0x8c7c4c), 38, 140, 38, -40, 70, -2350);
    box(scene, bas(0x5a6a80), 50, 300, 50, 919, 150, -2455);
    box(scene, bas(0x4a5a70), 60, 470, 60, 1496, 235, -2690);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), bas(0xb8d878));
    dome.position.set(66, -10, -2000);
    scene.add(dome);
    const mx = [-3000, -1200, 600, 2400, 4200, 6000], mh = [450, 600, 650, 700, 600, 500];
    for (let i = 0; i < mx.length; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(2000, mh[i], 6), bas(0x10161f));
      m.position.set(mx[i], mh[i] / 2, -7000);
      scene.add(m);
    }
  }

  // ---------- trees ----------
  {
    const tg = new THREE.SphereGeometry(1, 12, 8);
    const trunkG = new THREE.CylinderGeometry(0.4, 0.5, 1, 6);
    const greens = [0x24461f, 0x2b5226, 0x203e1c];
    const cand = [];
    for (let i = 0; i < 55; i++) cand.push([rr(14, 52), -rr(108, 165), rr(4.5, 6.5)]);
    for (let i = 0; i < 8; i++) cand.push([rr(13, 22), -rr(138, 162), rr(3.5, 4.5)]);
    cand.push([73, -110, 7], [85, -105, 7], [62, -100, 6]);
    for (const [x, z, r] of cand) {
      if (distToFly(x, z) < 8 + r) continue;
      if (x < 22 && z < -163) continue;          // keep clear of the pink corner building
      if (x > 44 && z < -200) continue;
      const t = new THREE.Mesh(tg, lam(pick(greens)));
      t.scale.set(r, r * 0.85, r);
      t.position.set(x, 3 + r * 0.85, z);
      scene.add(t);
      const tr = new THREE.Mesh(trunkG, lam(0x3a3028));
      tr.scale.set(1, 3.2, 1);
      tr.position.set(x, 1.6, z);
      scene.add(tr);
    }
  }

  // ---------- camera keyframes ----------
  const ST = [0, 0.24, 0.44, 0.68, 0.92, 1.16, 1.36, 1.6, 1.84, 2.08, 2.28, 2.52, 2.76, 3.0, 3.2, 3.44,
    3.68, 3.92, 4.12, 4.36, 4.6, 4.84, 5.04, 5.28];
  const TAXI_UV = [[520, 300], [500, 310], [490, 330], [470, 340], [485, 355], [530, 370], [565, 385],
    [610, 395], [655, 415], [645, 510]];
  const TAXI_S = [245, 165, 150, 133, 127, 113, 107, 100, 90, 72];
  const NEON_UV = [[525, 70], [497, 178], [477, 210], [460, 228], [443, 238], [422, 248], [390, 255],
    [360, 262], [330, 268], [297, 270], [270, 272], [245, 277], [225, 282], [215, 285]];
  const LATE_F = [5800, 3500, 2750, 2300, 1950, 1790, 1600, 1500, 1420, 1370, 1300, 1240, 1180, 1150];

  function aim(P, u, v, f) {
    const d = P.clone().sub(CAM).normalize();
    let qx = (u - 480) / f, qy = -(v - 270) / f, qz = -1;
    const n = Math.hypot(qx, qy, qz);
    qx /= n; qy /= n; qz /= n;
    const A = qy, B = -qz;
    const r = Math.hypot(A, B);
    const th = Math.asin(Math.max(-1, Math.min(1, d.y / r))) - Math.atan2(A, B);
    const z2 = qy * Math.sin(th) + qz * Math.cos(th);
    const az = (vx, vz) => Math.atan2(-vx, -vz);
    const psi = az(d.x, d.z) - az(qx, z2);
    return [psi, th];
  }
  function spline(ts, vs, t) {
    const n = ts.length;
    if (t <= ts[0]) return vs[0];
    if (t >= ts[n - 1]) return vs[n - 1];
    let i = 0;
    while (i < n - 2 && t > ts[i + 1]) i++;
    const m = (k) => {
      if (k === 0) return (vs[1] - vs[0]) / (ts[1] - ts[0]);
      if (k === n - 1) return (vs[n - 1] - vs[n - 2]) / (ts[n - 1] - ts[n - 2]);
      return (vs[k + 1] - vs[k - 1]) / (ts[k + 1] - ts[k - 1]);
    };
    const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m(i) +
      (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m(i + 1);
  }

  const logF = [];
  for (let i = 0; i < 10; i++) logF.push(Math.log(TAXI_S[i] * taxiCenter(ST[i]).distanceTo(CAM) / 1.7));
  for (let i = 0; i < LATE_F.length; i++) logF.push(Math.log(LATE_F[i]));
  const T_EARLY = ST.slice(0, 10);
  const U_EARLY = TAXI_UV.map((p) => p[0]);
  const V_EARLY = TAXI_UV.map((p) => p[1]);
  const T_LATE = ST.slice(9);
  const PSI_K = [], TH_K = [];
  {
    const a = aim(taxiCenter(ST[9]), TAXI_UV[9][0], TAXI_UV[9][1], Math.exp(logF[9]));
    PSI_K.push(a[0]); TH_K.push(a[1]);
    for (let i = 0; i < NEON_UV.length; i++) {
      const b = aim(NEON, NEON_UV[i][0], NEON_UV[i][1], LATE_F[i]);
      PSI_K.push(b[0]); TH_K.push(b[1]);
    }
  }

  // ---------- update ----------
  function update(time, frame) {
    const t = Math.max(0, Math.min(DUR, Number.isFinite(time) ? time : 0));

    const d = taxiD(t), x = taxiX(t);
    taxi.position.set(x, 0, -d);
    const e = 0.01, ta = Math.max(0, t - e), tb = t + e;
    const vx = (taxiX(tb) - taxiX(ta)) / (tb - ta);
    const vz = -(taxiD(tb) - taxiD(ta)) / (tb - ta);
    taxi.rotation.y = Math.atan2(-vx, -vz) + taxiYawExtra(t);
    for (const w of WHEELS.get(taxi)) w.rotation.x = -d / 0.31;

    for (const m of movers) {
      const dd = m.d(t);
      m.obj.position.set(m.x, 0, -dd);
      for (const w of WHEELS.get(m.obj)) w.rotation.x = -dd / 0.31;
    }
    for (const m of flyMovers) {
      const s = m.s0 + m.v * t;
      const p = flyAt(s);
      m.obj.position.set(p.x + p.nx * m.lane, 9.0, p.z + p.nz * m.lane);
      const tx = m.v >= 0 ? p.dx : -p.dx, tz = m.v >= 0 ? p.dz : -p.dz;
      m.obj.rotation.set(0, Math.atan2(-tx, -tz), 0);
    }

    const f = Math.exp(spline(ST, logF, t));
    let psi, th;
    if (t <= ST[9]) {
      const u = spline(T_EARLY, U_EARLY, t), v = spline(T_EARLY, V_EARLY, t);
      [psi, th] = aim(taxiCenter(t), u, v, f);
    } else {
      psi = spline(T_LATE, PSI_K, t);
      th = spline(T_LATE, TH_K, t);
    }
    camera.position.copy(CAM);
    camera.rotation.set(th, psi, 0, 'YXZ');
    camera.fov = 2 * Math.atan(270 / f) * 180 / Math.PI;
    camera.aspect = Wpx / Hpx;
    camera.near = f > 5000 ? 20 : 10;
    camera.far = 16000;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
