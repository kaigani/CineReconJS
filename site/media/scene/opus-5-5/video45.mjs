// CineRecon L1 proxy reconstruction - first-person locker-room sequence (video45)
// Coordinates: metres, +x east, +y up, +z south. Camera yaw 0 = facing north (-z), positive yaw = turn left.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8e6e1);
  const camera = new THREE.PerspectiveCamera(52, width / height, 0.02, 200);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic rng (construction only) ----------
  let rs = ((seed | 0) ^ 0x9e3779b9) >>> 0;
  if (rs === 0) rs = 12345;
  const rand = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };

  // ---------- helpers ----------
  const matCache = {};
  const lam = (c) => matCache['l' + c] || (matCache['l' + c] = new THREE.MeshLambertMaterial({ color: c }));
  const basic = (c) => matCache['b' + c] || (matCache['b' + c] = new THREE.MeshBasicMaterial({ color: c }));
  function bx(x0, x1, y0, y1, z0, z1, m, parent) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    const me = new THREE.Mesh(g, typeof m === 'number' ? lam(m) : m);
    me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(me);
    return me;
  }
  function box(w, h, d, m, x, y, z, parent) {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'number' ? lam(m) : m);
    me.position.set(x, y, z);
    (parent || scene).add(me);
    return me;
  }
  // wall perpendicular to z (spans x), holes = [{x0,x1,y0,y1}]
  function wallZ(z0, z1, x0, x1, h, holes, c) {
    let cur = x0;
    for (const o of holes) {
      if (o.x0 > cur) bx(cur, o.x0, 0, h, z0, z1, c);
      if (o.y0 > 0) bx(o.x0, o.x1, 0, o.y0, z0, z1, c);
      if (o.y1 < h) bx(o.x0, o.x1, o.y1, h, z0, z1, c);
      cur = o.x1;
    }
    if (x1 > cur) bx(cur, x1, 0, h, z0, z1, c);
  }
  // procedural scribble texture (graffiti proxy), drawn into memory
  function scribbleTex(r, g, b, strokes) {
    const W = 128, H = 64, data = new Uint8Array(W * H * 4);
    const dot = (cx, cy, rad) => {
      for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(H - 1, Math.ceil(cy + rad)); y++)
        for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(W - 1, Math.ceil(cx + rad)); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rad * rad) {
            const i = (y * W + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 235;
          }
    };
    for (let s = 0; s < strokes; s++) {
      let x = 8 + rand() * (W - 16), y = 8 + rand() * (H - 16);
      let a = rand() * Math.PI * 2;
      const n = 10 + Math.floor(rand() * 14);
      for (let k = 0; k < n; k++) {
        a += (rand() - 0.5) * 1.6;
        const nx = Math.min(W - 3, Math.max(3, x + Math.cos(a) * 4)), ny = Math.min(H - 3, Math.max(3, y + Math.sin(a) * 4));
        for (let q = 0; q <= 4; q++) dot(x + (nx - x) * q / 4, y + (ny - y) * q / 4, 1.6);
        x = nx; y = ny;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.flipY = false; t.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
  }
  function decal(mat, w, h, x, y, z, rotY) {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    me.position.set(x, y, z); me.rotation.y = rotY; scene.add(me); return me;
  }

  // ---------- colours ----------
  const WALL = 0xd9d1c4, HALLWALL = 0xd2d4d8, LOCKER = 0xe9e5dd, FLOOR = 0xb6a896, HALLFLOOR = 0x9ea2aa;
  const CEIL = 0x4c4b4a, YEL = 0xe0b31c;

  // ---------- locker room: x[-8,5], z[-6,6.5], h 3.4 ----------
  const RH = 3.8, EX = 6.5;
  bx(-8, EX, -0.05, 0, -6, 6.5, FLOOR);
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x77736e, emissive: 0x2e2c2a });
  bx(-8, EX, RH, RH + 0.1, -6, 6.5, ceilMat);
  // north wall with window
  wallZ(-6.3, -6.0, -8, EX, RH, [{ x0: -0.1, x1: 3.1, y0: 0.75, y1: 2.95 }], WALL);
  // window frame + divider
  const FR = 0x8c8f93;
  bx(-0.15, 3.15, 0.68, 0.75, -6.1, -5.95, FR); bx(-0.15, 3.15, 2.95, 3.02, -6.1, -5.95, FR);
  bx(-0.17, -0.1, 0.68, 3.02, -6.1, -5.95, FR); bx(3.1, 3.17, 0.68, 3.02, -6.1, -5.95, FR);
  bx(1.36, 1.44, 0.75, 2.95, -6.12, -5.97, FR);
  const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
  bx(-0.1, 3.1, 0.75, 2.95, -6.16, -6.14, glass);
  // north pillar
  bx(3.6, 4.1, 0, RH, -6.0, -5.62, 0xd3cbbf);
  // south wall with big doorway to hall
  wallZ(6.5, 6.8, -8, EX, RH, [{ x0: -4.4, x1: 0.2, y0: 0, y1: 3.3 }], WALL);
  bx(-4.5, -4.4, 0, 3.4, 6.4, 6.85, 0xeeeeec); bx(0.2, 0.3, 0, 3.4, 6.4, 6.85, 0xeeeeec);
  bx(-4.5, 0.3, 3.3, 3.4, 6.4, 6.85, 0xeeeeec);
  // east / west walls
  bx(EX, EX + 0.3, 0, RH, -6, 6.5, WALL);
  bx(-8.3, -8, 0, RH, -6, 6.5, WALL);
  // baseboards
  bx(-8, EX, 0, 0.12, -6.0, -5.95, 0x5a5048); bx(EX - 0.05, EX, 0, 0.12, -6, 6.5, 0x5a5048);
  bx(-8, EX, 0, 0.12, 6.45, 6.5, 0x5a5048);

  // lockers: bank along x at face z = zf, facing +z (dir=1) or -z (dir=-1)
  function lockers(x0, n, w, zf, dir) {
    const d = 0.45, zb = zf - dir * d;
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * w;
      bx(xa + 0.008, xa + w - 0.008, 0.15, 2.2, Math.min(zf, zb), Math.max(zf, zb), LOCKER);
      bx(xa + w * 0.42, xa + w * 0.58, 1.0, 1.12, zf - 0.01 * dir, zf + 0.012 * dir, 0x8b7b5e); // handle
    }
    bx(x0, x0 + n * w, 0.0, 0.15, Math.min(zf, zb) + 0.05, Math.max(zf, zb) - 0.05, 0x9a958c); // base
    bx(x0, x0 + n * w, 2.2, 2.25, Math.min(zf, zb), Math.max(zf, zb), 0xdedad2); // top trim
  }
  // north bank: 9 lockers x[-4.4,-0.62]
  lockers(-4.74, 9, 0.46, -5.55, 1);
  bx(-0.62, -0.5, 0.15, 2.25, -6.0, -5.5, 0xbab4aa); // side panel
  decal(scribbleTex(70, 80, 190, 9), 2.3, 1.1, -2.8, 1.45, -5.535, 0); // blue graffiti
  // tall white cabinet west of lockers
  bx(-5.9, -5.2, 0, 2.3, -6.0, -5.45, 0xe4e1da);
  // south bank: 9 lockers x[0.5,3.9], facing -z
  lockers(0.5, 9, 0.378, 6.05, -1);
  decal(scribbleTex(20, 20, 20, 10), 1.6, 0.9, 1.45, 1.45, 6.035, Math.PI); // black graffiti (west part)
  decal(scribbleTex(200, 45, 50, 7), 1.2, 1.2, 3.2, 1.35, 6.035, Math.PI); // red graffiti (east part)
  // signs west of door on south wall
  bx(-5.4, -4.8, 1.9, 2.95, 6.46, 6.5, 0xf2f2f2); bx(-6.7, -5.4, 1.9, 2.95, 6.46, 6.5, 0x23407e);
  bx(-5.3, -4.9, 2.47, 2.87, 6.44, 6.46, 0x2a4f9a); bx(-5.3, -4.9, 1.98, 2.38, 6.44, 6.46, 0x2a4f9a);
  bx(-6.6, -5.5, 2.42, 2.44, 6.44, 6.46, 0xf2f2f2);
  bx(-5.7, -5.2, 1.2, 1.6, 6.4, 6.5, 0xc9c7c2);
  bx(-7.4, -6.8, 0, RH, 6.1, 6.5, 0xd3cbbf); // pillar SW
  bx(-8, -7.4, 0.8, 1.0, 5.0, 6.5, 0xa9abad); // counter SW
  // suits on wall hooks: one at north-east, two at south-east (fronto-parallel), helmets on shelf
  const suit = (x, zc, dir) => {
    bx(x - 0.3, x + 0.3, 0.95, 2.2, zc - 0.06, zc + 0.06, 0xf0f0ee);
    const hm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), lam(0xf4f4f2));
    hm.position.set(x, 2.62, zc + dir * 0.05); scene.add(hm);
  };
  suit(5.5, -5.85, 1); suit(4.75, 6.38, -1); suit(5.65, 6.38, -1);
  bx(4.9, 6.2, 2.42, 2.46, -6.0, -5.75, 0x3a3a3a); bx(4.2, 6.2, 2.42, 2.46, 6.2, 6.5, 0x3a3a3a);
  bx(4.2, 6.3, 0.42, 0.5, 5.95, 6.45, 0x8a6a48);
  // west wall sinks + plaques + bin
  for (const zc of [-3.7, -1.7, 0.3]) {
    bx(-8, -7.4, 0.72, 0.95, zc - 0.9, zc + 0.9, 0xb0b2b4);
    bx(-7.98, -7.95, 1.25, 1.75, zc - 0.85, zc + 0.85, 0xf2efe6);
  }
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), lam(0xf0f0ee));
  bin.position.set(-7.3, 0.45, 2.2); scene.add(bin);
  // ceiling vents + lights
  bx(-7, 4, RH - 0.25, RH - 0.2, -5.6, -4.6, 0x2c2c2e); bx(-7, 4, RH - 0.25, RH - 0.2, 4.2, 5.4, 0x2c2c2e);
  for (const [x, z] of [[-4, -2], [1, -2], [-4, 2.5], [1, 2.5]]) bx(x - 0.07, x + 0.07, RH - 0.12, RH - 0.06, z - 0.8, z + 0.8, basic(0xffffff));
  // yellow floor lines
  bx(-0.05, 0.05, 0.001, 0.006, -6, -3.2, lam(YEL));
  bx(0.2, 4.6, 0.001, 0.006, 5.45, 5.55, lam(YEL)); bx(4.5, 4.6, 0.001, 0.006, 5.5, 6.5, lam(YEL));
  bx(-4.4, 0.2, 0.001, 0.006, 6.0, 6.08, lam(YEL));
  bx(-7.9, -7.8, 0.001, 0.006, -6, 6.5, lam(YEL));

  // ---------- outside (seen through window) ----------
  bx(-40, 40, -0.6, -0.5, -70, -6.3, 0x8f9194);
  bx(1.4, 12, -0.5, 16, -40, -9, 0x3b3c3e);
  bx(1.35, 1.4, 0, 14, -40, -9, 0x6d7074);
  bx(-0.7, 0.9, -0.5, 1.9, -26, -22, 0xcfd0d1);
  bx(-14, -6, -0.5, 7, -45, -30, 0xb9bbbd);

  // ---------- hall south of door: x[-7,4], z[6.8,15], h 3.6 ----------
  const HH = 3.6;
  bx(-7, 4, -0.05, 0, 6.8, 15, HALLFLOOR);
  bx(-7, 4, HH, HH + 0.1, 6.8, 15, 0xcfcfd1);
  bx(-7.3, -7, 0, HH, 6.8, 15, HALLWALL); bx(4, 4.3, 0, HH, 6.8, 15, HALLWALL);
  wallZ(15, 15.3, -7, 4, HH, [{ x0: -1.0, x1: 1.3, y0: 0, y1: 2.6 }], HALLWALL);
  bx(-1.1, -1.0, 0, 2.7, 14.9, 15.35, 0xf2f2f2); bx(1.3, 1.4, 0, 2.7, 14.9, 15.35, 0xf2f2f2);
  bx(-4.0, -3.6, 0, HH, 14.6, 15, 0xe6e6e6); // pillar right of skull
  const skull = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), basic(0xf4f4f4));
  skull.position.set(-2.5, 2.35, 14.98); skull.rotation.y = Math.PI; scene.add(skull);
  bx(-2.8, -2.2, 1.95, 2.12, 14.96, 14.99, basic(0xf4f4f4));
  bx(-3.25, -1.75, 1.25, 1.75, 14.96, 14.99, lam(0x6458b4));
  bx(-6.98, -6.95, 2.15, 2.4, 11.6, 12.4, basic(0x2f9a50)); // exit sign
  // hall floor yellow rectangle
  bx(-3.2, 1.0, 0.001, 0.007, 8.2, 8.3, lam(YEL)); bx(-3.2, -3.1, 0.001, 0.007, 8.2, 13.5, lam(YEL));
  bx(-3.2, 1.0, 0.001, 0.007, 13.4, 13.5, lam(YEL));
  for (const z of [8.5, 11.5, 14]) bx(-3, 0, HH - 0.08, HH - 0.03, z - 0.08, z + 0.08, basic(0xffffff));
  bx(-6.5, 3.5, HH - 0.3, HH - 0.25, 9.5, 10.5, 0x6a6a6e);
  // far room beyond second doorway
  bx(-5, 5, -0.05, 0, 15.3, 24, 0xa8a9ab);
  bx(-5, 5, 0, 3.4, 24, 24.3, 0xe7e5df); bx(-5.3, -5, 0, 3.4, 15.3, 24, 0xdedcd6); bx(5, 5.3, 0, 3.4, 15.3, 24, 0xdedcd6);
  bx(-5, 5, 3.4, 3.5, 15.3, 24, 0xd8d8d8);
  bx(-1.5, 1.5, 0, 2.2, 23.9, 24, 0xf3f1ea);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb3a58f, 1.75));
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.6);
  sun.position.set(3, 8, -12); scene.add(sun); scene.add(sun.target);
  const hallLight = new THREE.PointLight(0xffffff, 0.5, 18, 0);
  hallLight.position.set(-1, 3.2, 11); scene.add(hallLight);

  // ---------- enemies (articulated proxies) ----------
  function makeEnemy(bodyC) {
    const root = new THREE.Group(); scene.add(root);
    const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
    const torso = box(0.42, 0.62, 0.26, bodyC, 0, 0.33, 0, hips);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), lam(0x6e5a48)); head.position.set(0, 0.78, 0); hips.add(head);
    const legs = [], arms = [];
    for (const sx of [-1, 1]) {
      const lg = new THREE.Group(); lg.position.set(0.11 * sx, 0, 0); hips.add(lg);
      box(0.16, 0.92, 0.18, 0x2d2c28, 0, -0.46, 0, lg); legs.push(lg);
      const ar = new THREE.Group(); ar.position.set(0.25 * sx, 0.58, 0); hips.add(ar);
      box(0.1, 0.58, 0.11, bodyC, 0, -0.29, 0, ar); arms.push(ar);
    }
    const gun = box(0.06, 0.08, 0.32, 0x151515, 0, 0.3, 0.42, hips);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), basic(0xfff1b8));
    flash.position.set(0, 0.3, 0.65); hips.add(flash);
    return { root, hips, legs, arms, torso, gun, flash };
  }
  const enA = makeEnemy(0x37332b), enB = makeEnemy(0x3d3d3a);

  // ---------- first-person viewmodel (camera children) ----------
  const vm = new THREE.Group(); vm.scale.setScalar(0.45); camera.add(vm);
  const GLOVE = 0x4b2a70, SKIN = 0xc98a5c, GOLD = 0xd2bd86;
  function forearm(parent, x, y, z, rx, rz) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, 0, rz); parent.add(g);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.4, 10), lam(SKIN)); c.position.y = 0.24; g.add(c);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.04, 10), lam(0x1a1a1a)); w.position.y = 0.06; g.add(w);
    return g;
  }
  const gunG = new THREE.Group(); vm.add(gunG);
  box(0.036, 0.042, 0.23, GOLD, 0, 0.07, -0.085, gunG);              // slide
  box(0.03, 0.03, 0.2, 0xb8a272, 0, 0.038, -0.08, gunG);             // frame
  const grip = box(0.032, 0.11, 0.05, 0xa8925e, 0, -0.005, 0.0, gunG); grip.rotation.x = 0.25;
  box(0.06, 0.085, 0.085, GLOVE, 0.006, -0.015, 0.012, gunG);        // right glove
  box(0.055, 0.075, 0.085, GLOVE, -0.04, -0.03, 0.02, gunG);         // left glove
  forearm(gunG, 0.015, -0.05, 0.04, 2.25, -0.15);
  forearm(gunG, -0.045, -0.055, 0.05, 2.25, 0.2);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), basic(0xffe7a0));
  muzzle.position.set(0, 0.07, -0.24); gunG.add(muzzle);
  const knifeG = new THREE.Group(); vm.add(knifeG);
  box(0.07, 0.09, 0.08, GLOVE, 0, 0, 0, knifeG);
  box(0.03, 0.09, 0.03, 0x22182a, 0, 0.07, 0, knifeG);
  const blade = box(0.016, 0.24, 0.045, 0x6b3dd0, 0, 0.23, 0, knifeG);
  forearm(knifeG, 0, -0.05, 0.02, 2.3, -0.1);

  // ---------- keyframe sampling (absolute in time) ----------
  function sampleKeys(keys, t) {
    const n = keys.length, dim = keys[0].length - 1, out = new Array(dim);
    if (t <= keys[0][0]) { for (let d = 0; d < dim; d++) out[d] = keys[0][d + 1]; return out; }
    if (t >= keys[n - 1][0]) { for (let d = 0; d < dim; d++) out[d] = keys[n - 1][d + 1]; return out; }
    let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1], h = k1[0] - k0[0], u = (t - k0[0]) / h;
    const km = keys[Math.max(0, i - 1)], kp = keys[Math.min(n - 1, i + 2)];
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    for (let d = 1; d <= dim; d++) {
      const m0 = i === 0 ? 0 : (k1[d] - km[d]) / (k1[0] - km[0]);
      const m1 = i + 1 === n - 1 ? 0 : (kp[d] - k0[d]) / (kp[0] - k0[0]);
      out[d - 1] = h00 * k0[d] + h10 * h * m0 + h01 * k1[d] + h11 * h * m1;
    }
    return out;
  }
  function lin(keys, t) {
    const n = keys.length, dim = keys[0].length - 1, out = new Array(dim);
    if (t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
    const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    for (let d = 1; d <= dim; d++) out[d - 1] = keys[i][d] + (keys[i + 1][d] - keys[i][d]) * u;
    return out;
  }
  const D = Math.PI / 180;
  // camera: t, x, z, yawDeg, pitchDeg  (eye height EYE)
  const EYE = 1.6;
  const CAM = [
    [0.00, 0.15, -2.95, -2, 0], [0.63, 0.0, -4.2, -2, 0], [1.23, 0.25, -3.7, -2, 0], [1.87, 1.0, -2.95, 0, 0],
    [2.47, 0.5, -2.6, -3, -2], [3.10, 1.6, -4.4, 52, 2], [3.73, 2.5, -5.3, 70, 0], [4.33, 1.1, -4.6, -5, -2],
    [4.97, 1.5, 2.5, 132, 8], [5.57, 0.55, -0.5, 360, 4], [6.20, 3.3, 5.0, 450, 6], [6.83, 1.5, 5.3, 540, 0],
    [7.43, 0.0, 5.3, 557, 3], [8.07, -0.4, 5.9, 541, 6], [8.70, 1.5, 4.2, 540, 2], [9.30, -0.35, 1.9, 540, 1],
    [9.93, 0.57, 2.55, 540, 2], [10.53, -0.33, 2.27, 540, 2], [11.17, 0.0, 2.75, 540, 0], [11.80, -0.5, 1.2, 528, 0],
    [12.40, -1.0, 0.0, 540, 3], [13.03, -1.0, -0.2, 539, 3], [13.63, -0.9, 0.1, 541, 3], [14.30, -0.9, 0.2, 541, 3],
  ];
  // gun pose: t, x, y, z, rx, ry, rz (viewmodel units, group scaled 0.45)
  const AIM = [0.27, -0.28, -0.66, 0.3, 0.25, 0.05];
  const GUN = [
    [0.00, 0.40, -0.40, -0.82, 1.0, 0.5, 0.7], [0.50, ...AIM], [4.55, ...AIM], [4.75, 0.29, -0.67, -0.73, 0.9, 0.1, 0.0],
    [7.10, 0.29, -0.67, -0.73, 0.9, 0.1, 0.0], [7.43, 0.32, -0.27, -0.77, 1.0, 0.1, -0.25], [8.07, 0.37, -0.16, -0.69, 1.25, 0.35, -0.5],
    [8.70, 0.40, -0.21, -0.73, 0.6, -0.4, 0.6], [9.30, 0.32, -0.19, -0.77, 1.35, 0.0, 0.1], [9.70, ...AIM],
    [11.55, ...AIM], [11.80, 0.36, -0.16, -0.73, 0.7, 0.2, -0.35], [12.20, ...AIM], [14.30, ...AIM],
  ];
  // knife/hand pose
  const KNF = [
    [4.70, 0.33, -0.73, -0.8, 0.3, 0, 0], [4.97, 0.29, -0.21, -0.82, 0.25, 0, 0.05], [5.57, 0.34, -0.36, -0.8, 0.3, 0, 1.0],
    [6.20, 0.33, -0.3, -0.8, 0.1, 0, 0.1], [6.83, 0.36, -0.56, -0.8, 0.6, 0, 0.3], [7.10, 0.36, -0.8, -0.8, 0.8, 0, 0.3],
  ];
  const SHOTS = [9.80, 10.50, 11.45, 13.50];
  const recoil = (t) => { let r = 0; for (const s of SHOTS) { const d = t - s; if (d >= 0 && d < 0.6) r = Math.max(r, d < 0.04 ? d / 0.04 : Math.exp(-(d - 0.04) * 9)); } return r; };
  // enemy A: t, x, y, z, headingRad ; walking flag via keys
  const EA = [
    [0, 2.6, 0, 19.2, -Math.PI / 2], [7.4, 2.6, 0, 19.2, -Math.PI / 2], [8.07, 0.75, 0, 19.0, -Math.PI / 2], [9.30, -1.0, 0, 18.5, -Math.PI / 2],
    [9.93, -0.5, 0, 16.2, Math.PI], [10.53, -0.3, 0, 15.0, Math.PI], [11.0, -0.6, 0, 13.0, Math.PI], [11.17, -0.9, 0.9, 12.0, Math.PI],
    [11.35, -1.0, 0, 11.2, Math.PI], [14.3, -1.0, 0, 11.2, Math.PI],
  ];
  const EB = [[0, -1.8, 0, 19.0, Math.PI / 2], [12.5, -1.8, 0, 19.0, Math.PI / 2], [13.6, -0.9, 0, 19.0, Math.PI / 2], [14.3, 0.1, 0, 19.4, Math.PI / 2]];

  function poseEnemy(e, keys, t, visible, opts) {
    e.root.visible = visible;
    if (!visible) return;
    const p = lin(keys, t);
    e.root.position.set(p[0], 0, p[2]);
    e.root.rotation.set(0, p[3], 0);
    e.hips.position.y = 0.95 + p[1];
    e.hips.rotation.set(0, 0, 0);
    const moving = opts.moving(t);
    const ph = t * 9.0;
    const sw = moving ? 0.5 * Math.sin(ph) : 0;
    e.legs[0].rotation.set(sw, 0, 0); e.legs[1].rotation.set(-sw, 0, 0);
    e.arms[0].rotation.set(-1.35, 0, 0.15); e.arms[1].rotation.set(-1.35, 0, -0.15);
    if (opts.jump && opts.jump(t)) { e.legs[0].rotation.set(-0.5, 0, -0.45); e.legs[1].rotation.set(0.3, 0, 0.45); }
    const fall = opts.fall ? opts.fall(t) : 0;
    if (fall > 0) {
      e.hips.rotation.x = -fall * Math.PI / 2;
      e.hips.position.y = 0.95 * (1 - fall) + 0.15 * fall;
      e.arms[0].rotation.set(-1.35 - fall * 1.2, 0, 0.6 * fall); e.arms[1].rotation.set(-1.35 - fall * 1.2, 0, -0.6 * fall);
    }
    e.flash.visible = opts.flash ? opts.flash(t) : false;
  }
  const flashA = (t) => [10.95, 11.15].some((s) => t >= s && t < s + 0.06);

  function update(time, frame) {
    const t = Math.max(0, Math.min(duration, time));
    // camera
    const c = sampleKeys(CAM, t);
    const rc = recoil(t);
    const eu = Math.min(1, Math.max(0, (t - 0.65) / 0.4));
    camera.position.set(c[0], 1.15 + (EYE - 1.15) * eu * eu * (3 - 2 * eu), c[1]); // crouched at start, stands by 1.05 s
    camera.rotation.set((c[3] + rc * 1.2) * D, c[2] * D, 0);
    camera.updateMatrixWorld();
    // weapons
    const gunOn = t < 4.75 || t >= 7.1;
    gunG.visible = gunOn; knifeG.visible = !gunOn;
    if (gunOn) {
      const g = sampleKeys(GUN, t);
      gunG.position.set(g[0], g[1] + rc * 0.035, g[2] + rc * 0.06);
      gunG.rotation.set(g[3] + rc * 0.55, g[4], g[5]);
      muzzle.visible = SHOTS.some((s) => t >= s && t < s + 0.067);
    } else {
      const k = sampleKeys(KNF, t);
      knifeG.position.set(k[0], k[1], k[2]);
      knifeG.rotation.set(k[3], k[4], k[5]);
      blade.visible = t >= 5.05;
      muzzle.visible = false;
    }
    // enemies
    poseEnemy(enA, EA, t, t < 12.1, {
      moving: (u) => (u > 7.4 && u < 11.0),
      jump: (u) => u >= 11.0 && u < 11.35,
      fall: (u) => (u < 11.45 ? 0 : Math.min(1, (u - 11.45) / 0.4)),
      flash: flashA,
    });
    poseEnemy(enB, EB, t, t >= 12.5, { moving: (u) => u > 12.5 });
    if (enA.root.visible && t >= 11.0 && t < 11.35) {
      const u = (t - 11.0) / 0.35; enA.hips.position.y = 0.95 + 0.95 * 4 * u * (1 - u);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
