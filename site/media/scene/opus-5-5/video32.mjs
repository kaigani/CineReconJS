// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video32.
// Goose flaps off a wading gardener at a pond, lands, crosses the lawn and path,
// honks at an open wooden garden gate and walks through onto stepping slabs.
// Camera: fixed-pitch high follow camera that pans right/away with slight yaw drift and zoom.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  // Colors are sRGB hex values (converted to linear by THREE.Color). Materials opt out of tone
  // mapping and the lights sum to ~PI so a lit upward face shows its albedo color directly.
  function col(hex) { return new THREE.Color(hex); }
  const scene = new THREE.Scene();
  scene.background = col(0x6f9e7a);

  const camera = new THREE.PerspectiveCamera(14, width / height, 0.1, 200);

  // ---------- helpers ----------
  const D2R = Math.PI / 180;
  const matCache = {};
  function mat(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: col(hex), toneMapped: false });
    return matCache[hex];
  }
  function box(w, h, d, color) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  }
  function cyl(rt, rb, h, color, seg = 10) {
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  }
  function sph(r, color, ws = 14, hs = 10) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat(color));
  }
  function add(parent, obj, x = 0, y = 0, z = 0) {
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  // Cubic Hermite (Catmull-Rom tangents) over non-uniform keyframes: keys = [[t, v0, v1, ...], ...]
  function sampleKeys(keys, t) {
    const n = keys.length;
    const dim = keys[0].length - 1;
    const out = new Array(dim);
    if (t <= keys[0][0]) { for (let d = 0; d < dim; d++) out[d] = keys[0][d + 1]; return out; }
    if (t >= keys[n - 1][0]) { for (let d = 0; d < dim; d++) out[d] = keys[n - 1][d + 1]; return out; }
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const kp = keys[Math.max(0, i - 1)], kn = keys[Math.min(n - 1, i + 2)];
    const h = k1[0] - k0[0];
    const s = (t - k0[0]) / h;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s;
    const h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    for (let d = 1; d <= dim; d++) {
      const m0 = (k1[d] - kp[d]) / (k1[0] - kp[0] || 1);
      const m1 = (kn[d] - k0[d]) / (kn[0] - k0[0] || 1);
      out[d - 1] = h00 * k0[d] + h10 * h * m0 + h01 * k1[d] + h11 * h * m1;
    }
    return out;
  }
  // deterministic seeded rng (used only at build time)
  let rs = (seed >>> 0) || 12345;
  function rnd() { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; }

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.8 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.25 * Math.PI);
  sun.position.set(-4, 8, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- ground ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat(0x6f9e7a));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // flat polygon on ground from xz points
  function groundPoly(pts, color, y) {
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
    shape.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape),
      new THREE.MeshLambertMaterial({ color: col(color), side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; // shape (x, y) -> world (x, -y) on z ... y=-z
    m.position.y = y;
    scene.add(m);
    return m;
  }
  // ribbon along a polyline (path)
  function ribbon(pts, w, color, y) {
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const nx = -dz, nz = dx;
      left.push([pts[i][0] + nx * w / 2, pts[i][1] + nz * w / 2]);
      right.push([pts[i][0] - nx * w / 2, pts[i][1] - nz * w / 2]);
    }
    const poly = left.concat(right.reverse());
    return groundPoly(poly, color, y);
  }

  // Pond (water) - lower left of the opening shots
  groundPoly([[-5, -1.4], [-2.6, -1.6], [-1.9, -1.75], [-0.85, -2.05], [0.0, -2.2], [0.6, -2.34],
    [1.2, -2.48], [1.8, -2.48], [2.2, -2.3], [2.6, -2.05], [2.95, -1.85], [3.3, -1.6], [3.7, -1.2],
    [4.0, -0.5], [4.0, 1.5], [-5, 1.5]], 0x85a1c9, 0.012);

  // Paths (grey)
  ribbon([[-4.5, -3.5], [-3.5, -3.85], [-2.5, -4.25], [-1.4, -4.6], [-0.2, -4.77], [1.0, -4.8], [2.2, -4.82],
    [3.2, -4.75], [4.0, -4.6], [4.6, -4.4], [5.2, -4.18], [5.8, -3.9], [6.6, -3.5], [7.6, -3.0], [8.6, -2.4]],
    0.8, 0xaca8a5, 0.006);
  ribbon([[0.0, -4.8], [-0.15, -5.4], [-0.35, -6.1], [-0.6, -7.0], [-0.9, -8.0]], 0.8, 0xaca8a5, 0.007);

  // Rocks around pond edge
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  [[-0.48, -2.13, 0.30, 0.17, 0.2], [-0.2, -2.2, 0.12, 0.1, 0.1], [1.07, -2.62, 0.25, 0.15, 0.16],
   [1.42, -2.56, 0.15, 0.15, 0.13], [1.78, -2.5, 0.2, 0.2, 0.17], [2.06, -2.35, 0.1, 0.08, 0.09],
   [-1.0, -1.95, 0.12, 0.08, 0.1]].forEach(([x, z, sx, sy, sz]) => {
    const r = new THREE.Mesh(rockGeo, mat(0xcfcdc8));
    r.scale.set(sx, sy * 0.8, sz);
    r.rotation.set(rnd() * 0.3, rnd() * 3, rnd() * 0.2);
    add(scene, r, x, sy * 0.45, z);
  });

  // Wooden dock at left of pond
  const dock = new THREE.Group();
  add(dock, box(1.2, 0.1, 0.42, 0xa08770), 0, 0.14, 0);
  add(dock, box(0.08, 0.3, 0.08, 0x8a6448), -0.5, 0.05, 0.17);
  add(dock, box(0.08, 0.3, 0.08, 0x8a6448), 0.5, 0.05, 0.17);
  add(dock, cyl(0.025, 0.025, 0.5, 0x6e5a48, 6), -0.15, 0.35, -0.12);
  dock.position.set(-1.4, 0, -2.05);
  dock.rotation.y = 11 * D2R;
  scene.add(dock);

  // Reeds
  function reeds(x, z, n, hgt) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.025, hgt * (0.7 + 0.3 * rnd()), 4), mat(0xa4ae84));
      c.position.set((rnd() - 0.5) * 0.12, hgt * 0.4, (rnd() - 0.5) * 0.1);
      c.rotation.z = (rnd() - 0.5) * 0.5;
      c.rotation.x = (rnd() - 0.5) * 0.3;
      g.add(c);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  reeds(-1.49, -1.71, 4, 0.55); reeds(-1.3, -1.88, 4, 0.5); reeds(-1.07, -1.76, 3, 0.5);
  reeds(1.15, -2.48, 4, 0.5); reeds(0.92, -2.3, 3, 0.4);

  // Lily pads + flower
  [[0.15, -1.66, 0.11], [0.48, -1.42, 0.09], [-0.3, -1.3, 0.09]].forEach(([x, z, r]) => {
    add(scene, cyl(r, r, 0.01, 0x5d9267, 14), x, 0.02, z);
  });
  add(scene, sph(0.03, 0xf4f2e8, 8, 6), 0.40, 0.04, -1.55);

  // Tree trunk (upper left, leaning)
  const trunk = new THREE.Group();
  add(trunk, cyl(0.1, 0.12, 0.55, 0x7d7262, 8), 0, 0.275, 0);
  add(trunk, cyl(0.035, 0.05, 2.2, 0x5e5850, 8), 0, 1.6, 0);
  trunk.position.set(0.76, 0, -5.38);
  trunk.rotation.set(-0.12, 0, 0.3);
  scene.add(trunk);

  // ---------- bench ----------
  const bench = new THREE.Group();
  const WOOD = 0x7a5e47;
  add(bench, box(1.4, 0.06, 0.45, WOOD), 0, 0.45, 0);
  for (const sx of [-0.65, 0.65]) {
    add(bench, box(0.07, 0.45, 0.07, WOOD), sx, 0.225, 0.19);
    add(bench, box(0.07, 0.95, 0.07, WOOD), sx, 0.475, -0.2);
    add(bench, box(0.06, 0.06, 0.45, WOOD), sx * 1.04, 0.68, -0.01);
    add(bench, box(0.06, 0.22, 0.06, WOOD), sx * 1.04, 0.57, 0.19);
  }
  add(bench, box(1.4, 0.07, 0.05, WOOD), 0, 0.93, -0.21);
  add(bench, box(1.3, 0.05, 0.04, WOOD), 0, 0.58, -0.21);
  for (let i = 0; i < 8; i++) add(bench, box(0.06, 0.33, 0.03, WOOD), -0.53 + i * 0.151, 0.76, -0.21);
  const cloth = add(bench, box(0.38, 0.012, 0.34, 0xa9bfe0), -0.42, 0.485, 0.04);
  cloth.rotation.y = 0.25;
  const cloth2 = add(bench, box(0.3, 0.014, 0.26, 0x5f7cb0), -0.42, 0.49, 0.04);
  cloth2.rotation.y = 0.25;
  bench.position.set(3.33, 0, -2.7);
  bench.rotation.y = -21 * D2R;
  bench.scale.set(1, 0.85, 0.95);
  scene.add(bench);

  // ---------- garden: sacks, walls, hedge, hose, gate, slabs, board, mower, beds ----------
  function sack(x, z, ry) {
    const g = new THREE.Group();
    add(g, box(0.42, 0.1, 0.56, 0xe4e7ec), 0, 0.05, 0);
    add(g, box(0.34, 0.08, 0.07, 0x567aa3), 0, 0.045, 0.255);
    add(g, box(0.2, 0.01, 0.14, 0xc85a5a), 0, 0.105, -0.06);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
  }
  sack(3.52, -6.16, 0.55);
  sack(3.95, -6.68, 1.15);

  function wallSeg(x0, z0, x1, z1, h, t, color) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const m = box(L, h, t, color);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    scene.add(m);
    return m;
  }
  const BRICK = 0x7e483c, HEDGE = 0x517243;
  // left wall up to gate hinge, hedge behind
  wallSeg(-1.0, -7.8, 3.5, -7.25, 0.45, 0.22, BRICK);
  wallSeg(3.5, -7.25, 5.05, -6.78, 0.45, 0.22, BRICK);
  wallSeg(-1.0, -8.1, 3.4, -7.52, 0.62, 0.36, HEDGE);
  wallSeg(3.4, -7.52, 4.95, -7.08, 0.62, 0.36, HEDGE);
  // wall cap darker bricks
  wallSeg(3.6, -7.22, 4.9, -6.84, 0.5, 0.24, 0x6e3e34);
  // right wall from pillar, hedge behind
  add(scene, box(0.24, 0.66, 0.24, BRICK), 6.22, 0.33, -6.08);
  wallSeg(6.3, -6.1, 8.6, -5.55, 0.42, 0.22, BRICK);
  wallSeg(6.3, -6.38, 8.6, -5.83, 0.62, 0.36, HEDGE);
  // hinge post
  add(scene, box(0.08, 0.9, 0.08, 0x9c7a5c), 5.07, 0.45, -6.68);
  // shovel leaning on the wall beside the gate
  const shovel = new THREE.Group();
  add(shovel, cyl(0.02, 0.02, 1.0, 0x6e5a48, 6), 0, 0.5, 0);
  add(shovel, box(0.15, 0.2, 0.025, 0x5a5a5a), 0, 0.05, 0);
  add(shovel, box(0.13, 0.04, 0.04, 0x3a3a3a), 0, 1.01, 0);
  shovel.position.set(4.85, 0.05, -6.62);
  shovel.rotation.set(0.15, 0.3, -0.25);
  scene.add(shovel);

  // orange hose
  const hoseCurve = new THREE.CatmullRomCurve3([
    [-0.5, -7.45], [1.0, -7.3], [1.8, -7.2], [2.8, -7.05], [3.6, -6.85], [4.2, -6.65], [4.6, -6.5],
    [5.0, -6.45], [5.25, -6.6], [5.15, -6.85], [4.9, -6.95], [4.7, -7.1]
  ].map(([x, z]) => new THREE.Vector3(x, 0.03, z)));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 60, 0.025, 6, false), mat(0xd8653a)));

  // gate (open, swung toward camera, hinged at wall end)
  const gate = new THREE.Group();
  const GW = 0x98826a;
  const gatePanel = new THREE.Group();
  add(gatePanel, box(1.02, 0.07, 0.05, GW), 0.53, 0.25, 0);
  add(gatePanel, box(1.02, 0.07, 0.05, GW), 0.53, 0.72, 0);
  for (let i = 0; i < 6; i++) {
    const hgt = 0.85 + (i % 2) * 0.08;
    add(gatePanel, box(0.12, hgt, 0.035, 0xa38c72), 0.1 + i * 0.172, hgt / 2 + 0.03, 0.03);
  }
  gate.add(gatePanel);
  gate.position.set(5.05, 0, -6.62);
  gate.rotation.y = -119.7 * D2R;
  scene.add(gate);

  // stepping slabs
  [[5.35, -6.36, 0.3], [5.82, -6.17, 0.2], [5.62, -6.99, 0.1], [6.02, -7.71, 0.35], [6.6, -8.3, 0.1]].forEach(([x, z, r]) => {
    const s = box(0.48, 0.03, 0.42, 0xaba99d);
    s.position.set(x, 0.015, z);
    s.rotation.y = r;
    scene.add(s);
  });

  // notice board
  const board = new THREE.Group();
  add(board, box(0.07, 1.6, 0.07, 0xa88a68), -0.25, 0.8, 0);
  add(board, box(0.07, 1.6, 0.07, 0xa88a68), 0.25, 0.8, 0);
  add(board, box(0.8, 0.75, 0.06, 0xa88a68), 0, 1.15, 0.04);
  add(board, box(0.34, 0.62, 0.02, 0x4566a6), -0.18, 1.13, 0.08);
  add(board, box(0.34, 0.62, 0.02, 0xc6d6e6), 0.18, 1.13, 0.08);
  add(board, box(0.12, 0.1, 0.01, 0xead0c8), 0.12, 1.2, 0.095);
  add(board, box(0.14, 0.1, 0.01, 0xf2f0e8), 0.22, 1.0, 0.095);
  add(board, box(0.9, 0.08, 0.16, 0x9c7c5c), 0, 1.56, 0.05);
  add(board, box(0.2, 0.04, 0.01, 0xd8c070), 0, 1.6, 0.135);
  board.position.set(6.9, 0, -5.78);
  board.rotation.y = 10 * D2R;
  scene.add(board);

  // lawn mower
  const mower = new THREE.Group();
  add(mower, box(0.5, 0.18, 0.55, 0xbc4140), 0, 0.17, 0);
  add(mower, cyl(0.12, 0.12, 0.14, 0x4a4a4a, 12), 0, 0.33, 0);
  for (const [wx, wz] of [[-0.27, 0.2], [0.27, 0.2], [-0.27, -0.2], [0.27, -0.2]]) {
    const w = cyl(0.08, 0.08, 0.05, 0x222222, 10);
    w.rotation.z = Math.PI / 2;
    add(mower, w, wx, 0.08, wz);
  }
  for (const hx of [-0.2, 0.2]) {
    const h = box(0.025, 0.9, 0.025, 0x555555);
    h.rotation.x = -0.7;
    add(mower, h, hx, 0.5, -0.55);
  }
  add(mower, box(0.42, 0.025, 0.025, 0x555555), 0, 0.84, -0.84);
  mower.position.set(7.2, 0, -4.85);
  mower.rotation.y = 30 * D2R;
  mower.scale.setScalar(0.78);
  scene.add(mower);

  // raised carrot bed
  const bed = new THREE.Group();
  add(bed, box(1.9, 0.25, 1.1, 0xa88a6c), 0, 0.125, 0);
  add(bed, box(1.75, 0.02, 0.95, 0x5e4a3c), 0, 0.255, 0);
  for (let i = 0; i < 5; i++) {
    const cx = -0.65 + i * 0.32, cz = (i % 2 ? 0.15 : -0.2);
    add(bed, sph(0.11, 0x3f8a48, 8, 6), cx, 0.38, cz);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 6), mat(0xe2782e));
    c.rotation.x = Math.PI;
    add(bed, c, cx, 0.25, cz + 0.08);
  }
  bed.position.set(5.5, 0, -8.5);
  bed.rotation.y = 8 * D2R;
  scene.add(bed);

  // wooden planter (top right)
  const planter = new THREE.Group();
  add(planter, box(1.8, 0.85, 1.1, 0xa88a6c), 0, 0.425, 0);
  add(planter, box(1.7, 0.2, 1.0, 0x3f7a48), 0, 0.92, 0);
  planter.position.set(7.95, 0, -8.15);
  planter.rotation.y = 12 * D2R;
  scene.add(planter);

  // ---------- gardener (articulated proxy) ----------
  const OVER = 0x6b7d66, SHIRT = 0xb3c5db, SKIN = 0x8a6248, CAP = 0x653f32, BOOT = 0x34473a;
  const gard = new THREE.Group();
  const gBody = new THREE.Group();
  gard.add(gBody);
  // pelvis / overalls trunk
  add(gBody, box(0.38, 0.32, 0.25, OVER), 0, 1.0, 0);
  add(gBody, box(0.4, 0.26, 0.26, SHIRT), 0, 1.33, 0);
  add(gBody, box(0.3, 0.22, 0.04, OVER), 0, 1.3, 0.12);   // bib front
  add(gBody, box(0.3, 0.26, 0.04, OVER), 0, 1.3, -0.12);  // bib back
  add(gBody, box(0.16, 0.08, 0.02, 0x5f7a58), 0, 1.2, 0.145); // pocket
  const neck = add(gBody, cyl(0.05, 0.05, 0.08, SKIN, 8), 0, 1.5, 0);
  const headG = add(gBody, new THREE.Group(), 0, 1.6, 0);
  add(headG, sph(0.12, SKIN, 12, 10), 0, 0.0, 0).scale.set(0.95, 1.1, 1.0);
  add(headG, cyl(0.14, 0.15, 0.08, CAP, 14), 0, 0.12, -0.01).scale.set(1, 1, 1.05);
  add(headG, box(0.16, 0.025, 0.08, CAP), 0, 0.09, 0.13);
  // arms
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.24, 1.43, 0);
    add(sh, cyl(0.055, 0.05, 0.3, SHIRT, 8), 0, -0.15, 0);
    const el = add(sh, new THREE.Group(), 0, -0.3, 0);
    add(el, cyl(0.05, 0.045, 0.27, SHIRT, 8), 0, -0.135, 0);
    const hand = add(el, sph(0.055, 0x6e4a33, 8, 6), 0, -0.3, 0);
    gBody.add(sh);
    return { sh, el, hand };
  }
  const armL = makeArm(1);   // gardener's left (local +x)
  const armR = makeArm(-1);  // gardener's right
  // radio in left hand
  const radio = new THREE.Group();
  add(radio, box(0.08, 0.2, 0.13, 0xb9b9b9), 0, -0.1, 0);
  add(radio, box(0.085, 0.05, 0.06, 0xd13a30), 0, -0.04, 0.03);
  armL.el.add(radio);
  radio.position.set(0, -0.32, 0.02);
  // legs
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.86, 0);
    add(hip, cyl(0.085, 0.075, 0.44, OVER, 8), 0, -0.22, 0);
    const knee = add(hip, new THREE.Group(), 0, -0.44, 0);
    add(knee, cyl(0.075, 0.07, 0.24, OVER, 8), 0, -0.1, 0);
    add(knee, cyl(0.075, 0.08, 0.2, BOOT, 8), 0, -0.3, 0);
    add(knee, box(0.13, 0.07, 0.24, BOOT), 0, -0.38, 0.05);
    gBody.add(hip);
    return { hip, knee };
  }
  const legL = makeLeg(1), legR = makeLeg(-1);
  const upperG = new THREE.Group();
  upperG.position.y = 0.86;
  [...gBody.children].forEach((c) => {
    if (c !== legL.hip && c !== legR.hip) { gBody.remove(c); c.position.y -= 0.86; upperG.add(c); }
  });
  gBody.add(upperG);
  gard.scale.setScalar(0.74);
  scene.add(gard);
  const gShadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
  gShadow.rotation.x = -Math.PI / 2;
  scene.add(gShadow);

  // ---------- goose (articulated proxy) ----------
  const WHITE = 0xf2f2f0, ORANGE = 0xf08a2a;
  const goose = new THREE.Group();
  const gooseBody = new THREE.Group();
  goose.add(gooseBody);
  const gb = add(gooseBody, sph(1, WHITE, 16, 12), 0, 0.32, 0);
  gb.scale.set(0.15, 0.14, 0.23);
  const tail = add(gooseBody, new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 8), mat(WHITE)), 0, 0.37, -0.24);
  tail.rotation.x = -Math.PI / 2 - 0.4;
  const neckG = add(gooseBody, new THREE.Group(), 0, 0.38, 0.17);
  add(neckG, cyl(0.045, 0.06, 0.32, WHITE, 8), 0, 0.16, 0);
  const gHead = add(neckG, new THREE.Group(), 0, 0.32, 0);
  add(gHead, sph(0.065, WHITE, 10, 8), 0, 0, 0).scale.set(0.9, 0.9, 1.15);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 8), mat(ORANGE));
  beak.rotation.x = Math.PI / 2;
  add(gHead, beak, 0, -0.01, 0.11);
  add(gHead, sph(0.012, 0x111111, 6, 4), 0.05, 0.02, 0.03);
  add(gHead, sph(0.012, 0x111111, 6, 4), -0.05, 0.02, 0.03);
  // honk burst lines (attached in front of the beak)
  const burst = add(gHead, new THREE.Group(), 0, 0.0, 0.2);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = box(0.012, 0.07, 0.012, 0xffffff);
    s.material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    s.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
    s.rotation.z = a - Math.PI / 2;
    burst.add(s);
  }
  burst.visible = false;
  // wings
  function makeWing(side) {
    const p = new THREE.Group();
    p.position.set(side * 0.12, 0.42, 0.02);
    const w = sph(1, 0xeeeeec, 12, 8);
    w.scale.set(0.17, 0.02, 0.12);
    w.position.set(side * 0.17, 0, -0.03);
    p.add(w);
    gooseBody.add(p);
    return p;
  }
  const wingL = makeWing(1), wingR = makeWing(-1);
  function makeGLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.07, 0.22, 0.02);
    add(hip, cyl(0.018, 0.018, 0.2, ORANGE, 6), 0, -0.1, 0);
    add(hip, box(0.08, 0.02, 0.1, ORANGE), 0, -0.21, 0.03);
    gooseBody.add(hip);
    return hip;
  }
  const gLegL = makeGLeg(1), gLegR = makeGLeg(-1);
  goose.scale.setScalar(0.68);
  scene.add(goose);
  const goShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
  goShadow.rotation.x = -Math.PI / 2;
  goShadow.scale.set(0.8, 1.2, 1);
  scene.add(goShadow);

  // ---------- keyframes ----------
  // camera: t, targetX, targetZ, yawDeg, distance  (pitch fixed 45 deg, vfov 14)
  const camKeys = [
    [0, 0.154, -2.962, 0.0, 10.16], [0.2, 0.418, -3.026, 0.1, 10.32], [0.433, 0.768, -3.086, 0.3, 10.36],
    [0.633, 1.034, -3.151, 0.6, 10.48], [0.833, 1.253, -3.207, 1.0, 10.51], [1.067, 1.411, -3.296, 1.35, 10.59],
    [1.267, 1.549, -3.386, 1.6, 10.59], [1.467, 1.692, -3.507, 1.85, 10.55], [1.7, 1.865, -3.652, 2.3, 10.45],
    [1.9, 1.996, -3.779, 2.9, 10.50], [2.1, 2.134, -3.919, 3.5, 10.53], [2.333, 2.322, -4.107, 3.9, 10.88],
    [2.533, 2.493, -4.251, 4.15, 11.41], [2.767, 2.701, -4.416, 4.35, 12.23], [2.967, 2.891, -4.542, 4.6, 12.87],
    [3.167, 3.056, -4.638, 4.8, 13.20], [3.4, 3.225, -4.760, 5.0, 13.35], [3.6, 3.342, -4.852, 5.2, 13.11],
    [3.8, 3.508, -4.981, 5.4, 12.05], [4.033, 4.116, -5.316, 6.1, 11.00], [4.233, 4.683, -5.733, 6.8, 10.97],
    [4.433, 5.128, -6.078, 7.4, 11.02], [4.667, 5.526, -6.441, 7.8, 11.00], [4.867, 5.819, -6.665, 7.9, 11.01],
    [5.0, 5.98, -6.78, 7.9, 11.01]
  ];
  const PITCH = 45 * D2R;

  // gardener ground track: t, x, z, facingDeg (0 = toward camera, 90 = image right, 180 = away)
  const gardKeys = [
    [0, 0.57, -2.07, 25], [0.2, 0.53, -2.09, 20], [0.433, 0.50, -2.11, 15], [0.633, 0.49, -2.12, 85],
    [0.833, 0.53, -2.15, 115], [1.067, 0.59, -2.24, 135], [1.267, 0.65, -2.32, 145], [1.467, 0.72, -2.43, 150],
    [1.7, 0.81, -2.58, 150], [1.9, 0.86, -2.67, 150], [2.1, 0.90, -2.74, 152], [2.333, 0.96, -2.88, 152],
    [2.533, 1.04, -3.05, 150], [2.767, 1.11, -3.21, 150], [2.967, 1.17, -3.32, 150], [3.167, 1.22, -3.43, 148],
    [3.4, 1.32, -3.58, 148], [3.6, 1.39, -3.68, 148], [3.8, 1.45, -3.75, 148], [4.033, 1.52, -3.83, 148],
    [4.867, 1.72, -4.05, 148]
  ];
  // goose: t, x, z, bodyHeightOffset, headingDeg (0 = +x/image right, 90 = away), neckTilt(rad), headYawDeg
  const gooseKeys = [
    [0, -0.02, -2.10, 0.62, 15, 0.55, 0], [0.2, 0.33, -2.22, 0.6, 20, 0.5, 0],
    [0.433, 0.52, -2.32, 0.45, 15, 0.45, 0], [0.55, 0.66, -2.75, 0.2, 12, 0.5, 0],
    [0.633, 0.77, -3.03, 0.0, 12, 0.8, 0], [0.833, 0.99, -3.15, 0.0, 20, 0.95, 0],
    [1.067, 1.22, -3.33, 0.0, 30, 1.0, 0], [1.267, 1.42, -3.48, 0.0, 32, 1.0, 0],
    [1.467, 1.63, -3.66, 0.0, 33, 0.95, 0], [1.7, 1.93, -3.85, 0.0, 35, 1.0, 0],
    [1.9, 2.12, -4.05, 0.0, 35, 1.05, 0], [2.1, 2.32, -4.22, 0.0, 32, 1.0, 0],
    [2.333, 2.62, -4.37, 0.0, 28, 1.0, 0], [2.533, 2.92, -4.50, 0.0, 25, 1.05, 0],
    [2.767, 3.19, -4.58, 0.0, 22, 1.05, 0], [2.967, 3.48, -4.65, 0.0, 22, 1.0, 0],
    [3.167, 3.74, -4.73, 0.0, 28, 0.9, 0], [3.4, 4.01, -4.86, 0.0, 55, 0.6, 0],
    [3.6, 4.24, -5.02, 0.0, 85, 0.25, 0], [3.8, 4.45, -5.22, 0.0, 100, 0.35, 0],
    [4.033, 4.70, -5.43, 0.0, 85, 0.3, 10], [4.233, 4.95, -5.62, 0.0, 65, 0.05, 20],
    [4.433, 5.17, -5.88, 0.0, 60, 0.0, 25], [4.667, 5.42, -6.08, 0.0, 55, 0.0, 45],
    [4.867, 5.59, -6.30, 0.0, 45, 0.05, 55]
  ];

  const tmpV = new THREE.Vector3();

  function update(time, frame) {
    const t = clamp(time, 0, duration);

    // ----- camera -----
    const [tx, tz, yawDeg, D] = sampleKeys(camKeys, t);
    const yw = yawDeg * D2R;
    const fx = -Math.sin(yw) * Math.cos(PITCH), fy = -Math.sin(PITCH), fz = -Math.cos(yw) * Math.cos(PITCH);
    camera.position.set(tx - D * fx, -D * fy, tz - D * fz);
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, 0, tz);
    camera.updateProjectionMatrix();
    sun.target.position.set(tx, 0, tz);
    sun.position.set(tx - 4, 8, tz + 1);
    sun.target.updateMatrixWorld();

    // ----- gardener -----
    const [gx, gz, gfac] = sampleKeys(gardKeys, t);
    const inWater = 1 - smooth(1.0, 1.55, t);
    gard.position.set(gx, -0.09 * inWater, gz);
    gard.rotation.y = gfac * D2R;
    gShadow.position.set(gx, 0.015, gz);
    gShadow.visible = false;

    const walkAmt = smooth(0.85, 1.1, t);
    const wph = 2 * Math.PI * 1.45 * (t - 1.0);
    const sw = Math.sin(wph);
    let thL = -0.35 * sw * walkAmt, thR = 0.35 * sw * walkAmt;
    let knL = Math.max(0, Math.cos(wph)) * 0.5 * walkAmt + 0.05;
    let knR = Math.max(0, -Math.cos(wph)) * 0.5 * walkAmt + 0.05;
    // high step out of the pond (right leg lifts onto bank)
    const step = smooth(1.1, 1.3, t) * (1 - smooth(1.45, 1.7, t));
    thR = thR * (1 - step) - 1.1 * step;
    knR = knR * (1 - step) + 1.3 * step;
    // turning shuffle at the start
    const shuffle = smooth(0.4, 0.55, t) * (1 - smooth(0.75, 0.9, t));
    thL += -0.25 * shuffle; knL += 0.3 * shuffle;
    legL.hip.rotation.x = thL; legL.knee.rotation.x = knL;
    legR.hip.rotation.x = thR; legR.knee.rotation.x = knR;
    gBody.position.y = 0.02 * Math.abs(Math.cos(wph)) * walkAmt;
    gBody.rotation.x = 0.04 + 0.1 * step;
    upperG.rotation.x = sampleKeys([[0, 0.35], [0.2, 0.06], [0.433, 0.05], [0.633, 0.08], [1.0, 0.06], [4.9, 0.06]], t)[0];

    // arms: right arm flails toward the goose at start, then swings
    const ra = sampleKeys([[0, -0.9, -0.35, -1.0], [0.2, -2.5, -0.5, -1.4], [0.433, 0.3, -0.6, -1.5],
      [0.633, 0.1, -0.3, -0.7], [0.9, 0.0, -0.12, -0.3], [4.9, 0.0, -0.12, -0.3]], t);
    armR.sh.rotation.set(ra[0] + 0.3 * sw * walkAmt, 0, ra[1]);
    armR.el.rotation.x = ra[2];
    armL.sh.rotation.set(-0.1 - 0.25 * sw * walkAmt, 0, 0.18);
    armL.el.rotation.x = -0.35;
    headG.rotation.y = sampleKeys([[0, 0.5], [0.2, 0.6], [0.433, 0.4], [0.633, 0.3], [1.0, 0.2], [4.9, 0.25]], t)[0];

    // ----- goose -----
    const [ox, oz, oy, hdg, tilt, hyaw] = sampleKeys(gooseKeys, t);
    goose.position.set(ox, oy, oz);
    const hr = hdg * D2R;
    goose.rotation.y = Math.atan2(Math.cos(hr), -Math.sin(hr));
    goShadow.position.set(ox, 0.016, oz);
    goShadow.rotation.z = goose.rotation.y;
    goShadow.visible = false;

    const gwalk = smooth(0.6, 0.75, t);
    const gph = 2 * Math.PI * 3.3 * t;
    gLegL.rotation.x = 0.55 * Math.sin(gph) * gwalk;
    gLegR.rotation.x = -0.55 * Math.sin(gph) * gwalk;
    const air = 1 - smooth(0.55, 0.65, t);
    gLegL.rotation.x += 0.5 * air; gLegR.rotation.x += 0.7 * air;
    gooseBody.position.y = 0.012 * Math.abs(Math.cos(gph)) * gwalk;
    gooseBody.rotation.x = -0.25 * air;
    gooseBody.rotation.z = 0.05 * Math.sin(gph) * gwalk;

    neckG.rotation.x = tilt;
    neckG.rotation.y = hyaw * D2R;
    gHead.rotation.x = -tilt * 0.8;

    // wings: flapping while airborne / landing, folded afterwards
    const flapAmt = 1 - smooth(0.42, 0.58, t);
    const flap = Math.sin(2 * Math.PI * 3.0 * t + 1.2);
    const spread = 0.6 + 0.6 * flap;      // radians upward
    const folded = -1.35;
    const wAng = folded * (1 - flapAmt) + spread * flapAmt;
    wingL.rotation.z = wAng;
    wingR.rotation.z = -wAng;
    wingL.rotation.y = -0.2 * (1 - flapAmt);
    wingR.rotation.y = 0.2 * (1 - flapAmt);
    wingL.visible = wingR.visible = flapAmt > 0.03;

    // honk / grab burst at the gate edge
    const honk = (t > 3.7 && t < 3.92) || (t > 3.97 && t < 4.12);
    burst.visible = honk;
    if (honk) {
      const k = (t > 3.95 ? (t - 3.97) / 0.15 : (t - 3.7) / 0.22);
      burst.scale.setScalar(0.8 + 0.6 * k);
    }
  }

  scene.traverse((o) => {
    if (o.isMesh) {
      const flat = o.geometry && (o.geometry.type === 'ShapeGeometry' || o.geometry.type === 'PlaneGeometry');
      o.castShadow = !flat && o !== gShadow && o !== goShadow;
      o.receiveShadow = true;
    }
  });
  burst.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  update(0, 0);
  return { scene, camera, update };
}
