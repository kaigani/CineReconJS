// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video15.
// Helmet-camera POV of a downhill run (Mausefalle -> Karussellkurve -> Steilhang)
// in heavy fog. The course is a procedural snow ribbon that follows a precomputed
// centreline. The camera rides that centreline, and fences, nets, trees, gates and
// signs are simple proxies placed along it.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  const SKY = 0xa9adb9;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.FogExp2(SKY, 0.0125);

  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x8a92a8, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-40, 120, 30);
  scene.add(sun);

  // ---------- deterministic RNG ----------
  let rs = (seed >>> 0) || 12345;
  function rnd() {
    rs = (rs + 0x6d2b79f5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- table helpers ----------
  function lin(tab, x) {
    if (x <= tab[0][0]) return tab[0][1];
    const n = tab.length;
    if (x >= tab[n - 1][0]) return tab[n - 1][1];
    for (let i = 0; i < n - 1; i++) {
      const a = tab[i], b = tab[i + 1];
      if (x <= b[0]) {
        let f = (x - a[0]) / (b[0] - a[0]);
        f = f * f * (3 - 2 * f);
        return a[1] + (b[1] - a[1]) * f;
      }
    }
    return tab[n - 1][1];
  }
  // smoothstep interpolation of component k over keyframes [t, v1, v2, ...]
  function lk(keys, t, k) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][k];
    if (t >= keys[n - 1][0]) return keys[n - 1][k];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    let f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    f = f * f * (3 - 2 * f);
    return keys[i][k] + (keys[i + 1][k] - keys[i][k]) * f;
  }
  // Catmull-Rom over keyframes for component k
  function cr(keys, t, k) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][k];
    if (t >= keys[n - 1][0]) return keys[n - 1][k];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
    const f = (t - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[k] - p0[k]) / Math.max(1e-6, p2[0] - p0[0]) * (p2[0] - p1[0]);
    const m2 = (p3[k] - p1[k]) / Math.max(1e-6, p3[0] - p1[0]) * (p2[0] - p1[0]);
    const f2 = f * f, f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * p1[k] + (f3 - 2 * f2 + f) * m1 + (-2 * f3 + 3 * f2) * p2[k] + (f3 - f2) * m2;
  }

  // ---------- course definition (s = metres along course) ----------
  // heading in degrees (+ = left turn), slope in degrees downhill
  const HEADING = [[-40, 0], [0, 0], [34, 5], [112, 30], [128, 26], [205, -62], [290, -74], [305, -74], [345, -40], [400, -46], [480, -50]];
  const SLOPE = [[-40, 30], [0, 38], [10, 35], [22, 22], [36, 16], [125, 13], [205, 10], [285, 6], [300, 1], [326, 2], [342, 28], [420, 25], [480, 20]];
  // cross slope dh/du (+ = right side higher)
  const BANK = [[-40, -0.05], [34, -0.16], [118, -0.18], [130, -0.05], [145, 0.05], [165, 0.4], [288, 0.4], [305, 0], [325, 0], [345, -0.2], [480, -0.2]];
  const GL = [[-40, 0.2], [34, 0.35], [118, 0.4], [130, 0.1], [145, -0.2], [290, -0.2], [305, 0], [325, 0], [345, 0.4], [480, 0.4]];
  const GR = [[-40, -0.3], [118, -0.35], [140, -0.1], [150, 0.6], [290, 0.8], [305, 0.2], [340, 0.2], [360, -0.3], [480, -0.3]];
  const EDGE_L = [[-40, 14], [120, 14], [128, 9.5], [272, 9.5], [290, 18], [345, 18], [368, 8.5], [388, 6.5], [480, 6.5]];
  const EDGE_R = [[-40, 11.5], [130, 11.5], [145, 8], [290, 7], [300, 10], [315, 8], [350, 8], [365, 12], [480, 12]];

  // integrate centreline
  const S0 = -40, S1 = 480, DS = 0.5;
  const NP = Math.round((S1 - S0) / DS) + 1;
  const PX = new Float64Array(NP), PY = new Float64Array(NP), PZ = new Float64Array(NP), PS = new Float64Array(NP);
  {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < NP; i++) {
      const s = S0 + i * DS;
      PX[i] = x; PY[i] = y; PZ[i] = z; PS[i] = lin(HEADING, s) * D2R;
      const a = lin(SLOPE, s + DS * 0.5) * D2R;
      const ps2 = lin(HEADING, s + DS * 0.5) * D2R;
      x += -Math.sin(ps2) * Math.cos(a) * DS;
      z += -Math.cos(ps2) * Math.cos(a) * DS;
      y -= Math.sin(a) * DS;
    }
  }
  function path(s) {
    let f = (s - S0) / DS;
    f = Math.min(NP - 1.0001, Math.max(0, f));
    const i = Math.floor(f), w = f - i;
    return {
      x: PX[i] + (PX[i + 1] - PX[i]) * w,
      y: PY[i] + (PY[i + 1] - PY[i]) * w,
      z: PZ[i] + (PZ[i + 1] - PZ[i]) * w,
      psi: PS[i] + (PS[i + 1] - PS[i]) * w,
    };
  }
  function sideH(s, u) {
    let h = lin(BANK, s) * u;
    const eL = lin(EDGE_L, s), eR = lin(EDGE_R, s);
    if (u < -eL) h += lin(GL, s) * (-u - eL);
    if (u > eR) h += lin(GR, s) * (u - eR);
    return h;
  }
  function world(s, u, up) {
    const p = path(s);
    const rx = Math.cos(p.psi), rz = -Math.sin(p.psi);
    return { x: p.x + rx * u, y: p.y + sideH(s, u) + (up || 0), z: p.z + rz * u, psi: p.psi };
  }

  // ---------- terrain ribbon ----------
  {
    const US = [];
    for (let u = -50; u <= 50.001; u += 1.5) US.push(u);
    const rows = [];
    for (let s = S0; s <= S1; s += 2) rows.push(s);
    const nu = US.length, nr = rows.length;
    const pos = new Float32Array(nu * nr * 3);
    let k = 0;
    for (let j = 0; j < nr; j++) for (let i = 0; i < nu; i++) {
      const w = world(rows[j], US[i], 0);
      pos[k++] = w.x; pos[k++] = w.y; pos[k++] = w.z;
    }
    const idx = [];
    for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const snow = new THREE.MeshLambertMaterial({ color: 0xd6def6, side: THREE.DoubleSide });
    scene.add(new THREE.Mesh(g, snow));
  }

  // ---------- blue course lines (dye) ----------
  const LINE_A = [[-40, -5], [100, -6], [140, -3], [200, 0], [270, -2], [290, -6], [325, -3], [345, -6], [480, -6]];
  const LINE_B = [[-40, 6], [100, 7], [140, 6], [200, 6], [270, 6], [290, 7], [325, 3], [345, 5], [480, 5]];
  function ribbon(tab, wdt, s0, s1, mat) {
    const pts = [];
    for (let s = s0; s <= s1; s += 1) {
      const u = lin(tab, s);
      pts.push(world(s, u - wdt / 2, 0.04), world(s, u + wdt / 2, 0.04));
    }
    const pos = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; });
    const idx = [];
    for (let i = 0; i < pts.length / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, mat));
  }
  const blueMat = new THREE.MeshLambertMaterial({ color: 0x4a8fd2, side: THREE.DoubleSide });
  ribbon(LINE_A, 0.4, S0, S1, blueMat);
  ribbon(LINE_B, 0.4, S0, S1, blueMat);

  // ---------- fences (instanced boards) ----------
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const FENCES = [
    // side, s0, s1, type, extra offset beyond the course edge
    ['R', -40, 128, 'A1', 0],
    ['L', -40, 124, 'NET', 20],
    ['R', 96, 182, 'NET', 4],
    ['L', 120, 176, 'A1', 0],
    ['L', 122, 176, 'NETLO', 0.8],
    ['L', 176, 199, 'HAHN', 0],
    ['L', 199, 278, 'GEN', 0],
    ['L', 205, 278, 'NETLO', 0.8],
    ['R', 300, 352, 'GEN', 0],
    ['L', 318, 480, 'GEN', 0],
    ['L', 330, 480, 'NETLO', 0.8],
    ['R', 352, 480, 'PINK', 0],
  ];
  const STYLE = {
    A1: { color: 0xf3f3f5, h: 1.0, step: 2.5, len: 2.4 },
    GEN: { color: 0xb3232e, h: 1.15, step: 3.0, len: 2.95 },
    HAHN: { color: 0x2e3546, h: 1.15, step: 3.0, len: 2.95 },
    PINK: { color: 0xe6cdd0, h: 1.0, step: 3.0, len: 2.95 },
    NET: { color: 0xd0574f, h: 3.2, step: 4.0, len: 4.0, opacity: 0.45 },
    NETLO: { color: 0xc8605c, h: 2.6, step: 4.0, len: 4.0, opacity: 0.22 },
  };
  const boardLists = {};
  const markerList = [];
  for (const f of FENCES) {
    const [side, s0, s1, type, off] = f;
    const st = STYLE[type];
    for (let s = s0; s < s1; s += st.step) {
      const sm = s + st.step / 2;
      const u = side === 'L' ? -(lin(EDGE_L, sm) + off) : lin(EDGE_R, sm) + off;
      const w = world(sm, u, 0);
      const a = lin(SLOPE, sm) * D2R;
      (boardLists[type] = boardLists[type] || []).push({ x: w.x, y: w.y + st.h / 2, z: w.z, psi: w.psi, a, sx: 0.12, sy: st.h, sz: st.len });
      if (type === 'A1') {
        const off = side === 'R' ? -0.08 : 0.08;
        const rx = Math.cos(w.psi), rz = -Math.sin(w.psi);
        markerList.push({ x: w.x + rx * off, y: w.y + 0.5, z: w.z + rz * off, psi: w.psi, a, sx: 0.04, sy: 0.5, sz: 0.9 });
      }
    }
  }
  function instanced(list, mat) {
    const im = new THREE.InstancedMesh(unitBox, mat, list.length);
    list.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(-b.a, b.psi, 0);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    return im;
  }
  for (const type in boardLists) {
    const st = STYLE[type];
    const m = new THREE.MeshLambertMaterial({ color: st.color, transparent: !!st.opacity, opacity: st.opacity || 1, depthWrite: !st.opacity, side: THREE.DoubleSide });
    instanced(boardLists[type], m);
  }
  instanced(markerList, new THREE.MeshLambertMaterial({ color: 0xd52838 }));

  // ---------- trees (instanced cones, snow-laden) ----------
  const TREES = [
    // s0, s1, u0, u1, count, hmin, hmax
    [60, 132, 26, 46, 6, 8, 13],
    [150, 210, 15, 44, 50, 9, 14],
    [195, 280, -12, -42, 110, 10, 17],
    [215, 300, 22, 46, 30, 9, 14],
    [292, 330, -30, -46, 18, 9, 14],
    [292, 335, 28, 46, 14, 9, 14],
    [330, 480, -12, -46, 100, 10, 17],
    [352, 480, 16, 45, 50, 9, 15],
    [-20, 125, -40, -48, 10, 8, 12],
  ];
  const treeList = [];
  for (const [s0, s1, u0, u1, n, h0, h1] of TREES) {
    for (let i = 0; i < n; i++) {
      const s = s0 + rnd() * (s1 - s0);
      const u = u0 + rnd() * (u1 - u0);
      const h = h0 + rnd() * (h1 - h0);
      const w = world(s, u, 0);
      treeList.push({ x: w.x, y: w.y, z: w.z, h, r: h * (0.25 + rnd() * 0.06) });
    }
  }
  {
    const cone = new THREE.ConeGeometry(1, 1, 8);
    cone.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x7a8582 });
    const im = new THREE.InstancedMesh(cone, mat, treeList.length);
    const d = new THREE.Object3D();
    treeList.forEach((t, i) => {
      d.position.set(t.x, t.y - 0.3, t.z);
      d.scale.set(t.r, t.h, t.r);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }

  // ---------- gates ----------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0xff3b2f });
  const panelMat = new THREE.MeshLambertMaterial({ color: 0xf2602a });
  const blackMat = new THREE.MeshLambertMaterial({ color: 0x141418 });
  function gate(s, u) {
    const w = world(s, u, 0);
    const g = new THREE.Group();
    g.position.set(w.x, w.y, w.z);
    g.rotation.y = w.psi;
    for (const sx of [-0.8, 0.8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), poleMat);
      p.position.set(sx, 1.15, 0);
      g.add(p);
    }
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.04), panelMat);
    panel.position.set(0, 1.75, 0);
    g.add(panel);
    const lab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 0.06), blackMat);
    lab.position.set(0, 1.78, 0);
    g.add(lab);
    scene.add(g);
  }
  gate(104, -7);
  gate(199, -3.5);
  gate(331, -1);

  // ---------- signs, towers, spectators ----------
  const tealMat = new THREE.MeshLambertMaterial({ color: 0x3f9fae });
  const greyMat = new THREE.MeshLambertMaterial({ color: 0x5b5f66 });
  function teal(s, u, h) {
    const w = world(s, u, 0);
    const g = new THREE.Group();
    g.position.set(w.x, w.y, w.z);
    g.rotation.y = w.psi;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), greyMat);
    post.position.y = h / 2;
    g.add(post);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 0.4), tealMat);
    b.position.y = h + 1.4;
    g.add(b);
    scene.add(g);
  }
  teal(108, 22, 4);
  teal(201, -11.5, 2.5);
  function tower(s, u) {
    const w = world(s, u, 0);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 2), greyMat);
    t1.position.set(w.x, w.y + 4.5, w.z);
    t1.rotation.y = w.psi;
    scene.add(t1);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 3.4), greyMat);
    top.position.set(w.x, w.y + 9.2, w.z);
    top.rotation.y = w.psi;
    scene.add(top);
  }
  tower(132, 21);
  tower(300, 28);
  {
    const specMat = new THREE.MeshLambertMaterial({ color: 0x2a2d36 });
    const geo = new THREE.CylinderGeometry(0.28, 0.28, 1.7, 8);
    geo.translate(0, 0.85, 0);
    const spots = [];
    for (let i = 0; i < 16; i++) spots.push([rnd() * 124, -31 - rnd() * 2]);
    const im = new THREE.InstancedMesh(geo, specMat, spots.length);
    const d = new THREE.Object3D();
    spots.forEach(([s, u], i) => {
      const w = world(s, u, 0);
      d.position.set(w.x, w.y, w.z);
      d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }

  // ---------- camera ----------
  const VFOV = 62;
  const camera = new THREE.PerspectiveCamera(VFOV, width / height, 0.05, 600);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const tanV = Math.tan(VFOV * D2R / 2), aspect = width / height;

  // rider's ski tips, attached to the camera (seen at the bottom of frame)
  const skiMat = new THREE.MeshBasicMaterial({ color: 0xd61f2a, fog: false });
  const skiGeo = new THREE.BoxGeometry(0.07, 1.4, 0.02);
  skiGeo.translate(0, -0.7, 0); // origin at the tip, ski extends downward
  const skis = [new THREE.Mesh(skiGeo, skiMat), new THREE.Mesh(skiGeo, skiMat)];
  skis.forEach((m) => camera.add(m));

  const SPEED = 26; // m/s along the course
  // [t, yawOff deg (+ = look left), pitchOff deg (+ = up), roll deg (+ = horizon falls to right), lateral u]
  const CAMK = [
    [0.0, 0, -12, 3, -2],
    [0.667, 2, -8, 4, -1],
    [1.3, 4, -8, 14, 0],
    [1.967, 2, -8, 14, 0],
    [2.6, 2, -8, 12, 0],
    [3.267, 6, -9, 18, 1],
    [3.9, 10, -10, 14, 0],
    [4.567, 4, -9, 5, 0],
    [5.2, -2, -8, 0, 1],
    [5.867, 0, -7, -10, 2],
    [6.5, 0, -8, -18, 2],
    [7.167, 2, -7, -8, 2],
    [7.8, 22, -8, -3, 1],
    [8.467, 4, -7, -5, 1],
    [9.1, 0, -7, -3, 1],
    [9.767, 0, -6, -20, 1],
    [10.4, -8, -5, -22, 1],
    [11.067, 0, -8, 0, 0],
    [11.7, 0, -6, 0, 0],
    [12.367, 0, -4, 0, 0],
    [13.0, 0, -14, 0, 0],
    [13.667, 0, -12, 8, 0],
    [14.3, 0, -8, 4, 0],
    [14.967, 0, -6, -12, -0.5],
  ];
  // [t, left tip ndcX, ndcY, right tip ndcX, ndcY, tip lean deg (+ = tips lean right)]
  const SKIK = [
    [0.0, -0.2, -1.4, 0.15, -1.4, 0],
    [2.9, 0.1, -1.4, 0.4, -1.4, 0],
    [3.267, 0.125, -0.98, 0.4, -1.2, 0],
    [3.9, 0.125, -0.87, 0.4, -0.96, 0],
    [4.567, 0.035, -0.94, 0.28, -0.94, 0],
    [5.0, 0.0, -1.3, 0.25, -1.3, 0],
    [7.4, -0.4, -1.3, -0.1, -1.3, 15],
    [7.8, -0.46, -0.63, -0.11, -0.52, 24],
    [8.467, -0.135, -0.91, 0.2, -1.15, 5],
    [9.1, -0.31, -0.72, 0.02, -1.1, 3],
    [9.5, -0.3, -1.3, 0.0, -1.3, 0],
    [10.6, -0.25, -1.3, 0.08, -1.3, 0],
    [11.067, -0.256, -0.81, 0.077, -0.76, 0],
    [11.45, -0.2, -1.3, 0.1, -1.3, 0],
    [12.6, 0.2, -1.3, 0.47, -1.3, 0],
    [13.0, 0.198, -0.78, 0.469, -0.94, -3],
    [13.667, 0.204, -0.85, 0.47, -1.1, -3],
    [14.3, 0.115, -0.77, 0.479, -0.93, -3],
    [14.7, 0.1, -1.3, 0.45, -1.3, 0],
    [15.0, 0.1, -1.3, 0.45, -1.3, 0],
  ];
  const SKI_D = 1.5;

  function update(time) {
    const t = Math.max(0, Math.min(duration, time));
    const s = SPEED * t;
    const u = cr(CAMK, t, 4);
    const w = world(s, u, 1.15);
    camera.position.set(w.x, w.y, w.z);
    const ahead = path(s + 3);
    const pA = path(s + 2), pB = path(s + 14);
    const horiz = Math.hypot(pB.x - pA.x, pB.z - pA.z);
    const slope = Math.atan2(pB.y - pA.y, horiz);
    camera.rotation.set(slope + cr(CAMK, t, 2) * D2R, ahead.psi + cr(CAMK, t, 1) * D2R, cr(CAMK, t, 3) * D2R);
    camera.updateMatrixWorld(true);

    const lean = lk(SKIK, t, 5) * D2R;
    for (let i = 0; i < 2; i++) {
      const nx = lk(SKIK, t, 1 + i * 2), ny = lk(SKIK, t, 2 + i * 2);
      const m = skis[i];
      m.visible = ny > -1.0;
      m.position.set(nx * tanV * aspect * SKI_D, ny * tanV * SKI_D, -SKI_D);
      m.rotation.set(-0.5, 0, -lean);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
