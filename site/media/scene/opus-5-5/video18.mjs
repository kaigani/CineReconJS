// CineRecon L1 proxy reconstruction - video18
// Drone orbit (camera strafing to its right / yawing left) around a woman standing on a
// bare dirt patch in a dry golden field, with a small tan dog sitting next to a thin post.
// The woman pilots the drone (holds a controller at her chest) and raises/waves her right arm.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const DEG = Math.PI / 180;

  // ---------- deterministic random ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(((seed | 0) ^ 0x5eed18) >>> 0);

  // ---------- helpers ----------
  // psi: azimuth on the ground measured so that the camera at orbit angle theta looks along psi=theta.
  // world direction of psi: (-sin psi, -cos psi) in (x, z)
  function placePsi(psiDeg, D) {
    const p = psiDeg * DEG;
    return [-Math.sin(p) * D, -Math.cos(p) * D];
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function interpTable(table, x) {
    if (x <= table[0][0]) return table[0][1];
    for (let i = 0; i < table.length - 1; i++) {
      if (x <= table[i + 1][0]) {
        const u = (x - table[i][0]) / (table[i + 1][0] - table[i][0]);
        return lerp(table[i][1], table[i + 1][1], u);
      }
    }
    return table[table.length - 1][1];
  }
  function makeMonotone(xs, ys) {
    const n = xs.length; const d = []; const m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] * d[i] <= 0) ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i]; const s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
      if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i]; const t = (x - xs[i]) / h; const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // ---------- scene / camera ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde4e8);
  scene.fog = new THREE.Fog(0xd9d2bf, 45, 380);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.3, 2000);

  const R_ORBIT = 16.8, CAM_H = 3.55, LOOK_Y = 0.85;
  // orbit angle (deg) keyed at reference sample times (estimated from background parallax + dog/woman occlusion)
  const thetaFn = makeMonotone(
    [0, 3.133, 6.267, 9.367, 12.5, 15.633, 18.767, 21.867, 23.967],
    [0, 24, 61, 103, 155, 214, 274, 327, 355]
  );

  // ---------- lights ----------
  const SUN_PSI = 257, SUN_EL = 13;
  const sunDir = new THREE.Vector3(
    -Math.sin(SUN_PSI * DEG) * Math.cos(SUN_EL * DEG),
    Math.sin(SUN_EL * DEG),
    -Math.cos(SUN_PSI * DEG) * Math.cos(SUN_EL * DEG)
  ).normalize();
  const hemi = new THREE.HemisphereLight(0xf6f1ea, 0x7a5c32, 2.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6a0, 3.0);
  sun.position.copy(sunDir).multiplyScalar(200);
  scene.add(sun);
  scene.add(sun.target);

  // ---------- sky dome (vertex-colour gradient, procedural) ----------
  {
    const geo = new THREE.SphereGeometry(900, 48, 24);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const zen = new THREE.Color(0x9ec0e0), hor = new THREE.Color(0xe0e6e8), glow = new THREE.Color(0xfffaf0);
    const c = new THREE.Color(); const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const e = Math.max(0, v.y);
      c.copy(hor).lerp(zen, Math.pow(e, 0.6));
      const ang = Math.acos(Math.min(1, Math.max(-1, v.dot(sunDir))));
      const g = Math.exp(-ang / 0.45) * 0.9;
      c.lerp(glow, Math.min(1, g));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  // sun disc (occluded by trees) + broad additive haze glow (procedural texture)
  {
    const disc = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    disc.position.copy(sunDir).multiplyScalar(800);
    scene.add(disc);
    const N = 64; const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + 0.5) / N * 2 - 1, dy = (y + 0.5) / N * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, 1 - r); const val = Math.pow(a, 2.2);
      const k = (y * N + x) * 4;
      data[k] = 255; data[k + 1] = 255; data[k + 2] = 255; data[k + 3] = Math.round(val * 255);
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const glowMat = new THREE.SpriteMaterial({ map: tex, color: 0xfff1d8, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const glowSpr = new THREE.Sprite(glowMat);
    glowSpr.position.copy(sunDir).multiplyScalar(400);
    glowSpr.scale.set(460, 460, 1);
    glowSpr.renderOrder = 50;
    scene.add(glowSpr);
  }

  // ---------- ground ----------
  function makeNoiseTexture(N, cells, amp1, amp2, base) {
    const grid = []; for (let i = 0; i < cells * cells; i++) grid.push(rand());
    const g = (ix, iy) => grid[((iy % cells + cells) % cells) * cells + ((ix % cells + cells) % cells)];
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * cells, fy = y / N * cells; const ix = Math.floor(fx), iy = Math.floor(fy);
      let ux = fx - ix, uy = fy - iy; ux = ux * ux * (3 - 2 * ux); uy = uy * uy * (3 - 2 * uy);
      const s = lerp(lerp(g(ix, iy), g(ix + 1, iy), ux), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), ux), uy);
      const v = Math.min(1, Math.max(0, base + amp1 * (s - 0.5) + amp2 * (rand() - 0.5)));
      const k = (y * N + x) * 4;
      data[k] = Math.round(v * 255); data[k + 1] = Math.round(v * 250); data[k + 2] = Math.round(v * 240); data[k + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const groundTex = makeNoiseTexture(256, 8, 0.2, 0.12, 0.92);
  groundTex.repeat.set(90, 90);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0xe4a55d, map: groundTex });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 140, 140), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // low grassy ridge / berm behind the field (psi ~ 320..10)
  {
    const ridgeMat = new THREE.MeshLambertMaterial({ color: 0xd09c58 });
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), ridgeMat);
    const [x, z] = placePsi(342, 50);
    ridge.position.set(x, -0.3, z);
    ridge.scale.set(30, 3.2, 11);
    ridge.rotation.y = (342) * DEG; // long axis tangent to the circle around the woman
    scene.add(ridge);
  }

  // overlays: bare dirt patches
  function disc(r, color, opacity, x, z, y, order, sx, sz) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.03, z);
    m.scale.set(sx || 1, sz || 1, 1);
    m.renderOrder = order; scene.add(m); return m;
  }
  disc(1.55, 0xd2c09c, 0.55, 0.1, -0.6, 0.02, 1, 1.0, 0.9);
  disc(1.4, 0xcdb48a, 0.3, -2.0, 1.6, 0.02, 1, 1.2, 0.9);

  // big tree-shadow region on the sun side with jagged crown edge (procedural decal; harness may not enable shadow maps)
  {
    const U = [sunDir.x, sunDir.z]; const ul = Math.hypot(U[0], U[1]); U[0] /= ul; U[1] /= ul;
    const V = [-U[1], U[0]];
    const pts = [];
    const ph1 = rand() * 6.28, ph2 = rand() * 6.28;
    for (let s = -110; s <= 110; s += 1.5) {
      let u0 = 8.3 + Math.max(0, -s - 2) * 0.6 + Math.max(0, s - 3) * 1.0;
      u0 += 1.4 * Math.sin(s * 0.33 + ph1) + 0.9 * Math.sin(s * 0.81 + ph2) + (rand() - 0.5) * 0.8;
      pts.push([U[0] * u0 + V[0] * s, U[1] * u0 + V[1] * s]);
    }
    pts.push([U[0] * 160 + V[0] * 110, U[1] * 160 + V[1] * 110]);
    pts.push([U[0] * 160 - V[0] * 110, U[1] * 160 - V[1] * 110]);
    const shape = new THREE.Shape();
    // shape coords (X, Y) map to world (X, 0, -Y) after rotation.x=-PI/2
    shape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
    shape.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x1a1006, transparent: true, opacity: 0.58, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = 2;
    scene.add(m);
  }

  // ---------- shared geometry / materials for environment ----------
  const coneGeo = new THREE.ConeGeometry(1, 1, 8);
  const sphGeo = new THREE.SphereGeometry(1, 12, 9);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a2c20 });
  const coniferMats = [0x2e3326, 0x363a2a, 0x283024, 0x3e3e2e].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const decidMats = [0x463e2c, 0x54472e, 0x5f4d2a, 0x3d3b29, 0x62502e].map(c => new THREE.MeshLambertMaterial({ color: c }));

  function addMesh(geo, mat, x, y, z, sx, sy, sz, ry) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (ry) m.rotation.y = ry;
    scene.add(m); return m;
  }
  function addConifer(x, z, h, mat) {
    const r = h * (0.12 + rand() * 0.06);
    addMesh(cylGeo, trunkMat, x, h * 0.08, z, h * 0.02 + 0.1, h * 0.16, h * 0.02 + 0.1);
    addMesh(coneGeo, mat, x, h * 0.1 + h * 0.45, z, r, h * 0.9, r);
  }
  function addDecid(x, z, h, mat) {
    const w = h * (0.24 + rand() * 0.12);
    addMesh(cylGeo, trunkMat, x, h * 0.2, z, 0.25, h * 0.4, 0.25);
    addMesh(sphGeo, mat, x, h * 0.55, z, w, h * 0.38, w);
    addMesh(sphGeo, mat, x + (rand() - 0.5) * w * 0.5, h * 0.8, z + (rand() - 0.5) * w * 0.5, w * 0.7, h * 0.22, w * 0.7);
  }

  // treeline around the clearing (distance from the woman by azimuth psi)
  const radiusTable = [[0, 68], [40, 62], [70, 72], [100, 76], [130, 68], [160, 58], [190, 56], [220, 55], [250, 52], [280, 50], [300, 55], [320, 66], [345, 70], [360, 68]];
  for (let psi = 0; psi < 360; psi += 2.0 + rand() * 1.4) {
    const D = interpTable(radiusTable, psi) + rand() * 6;
    const [x, z] = placePsi(psi, D);
    const decidP = (psi > 110 && psi < 235) ? 0.7 : 0.3;
    const tallDecid = (psi > 110 && psi < 235) ? 1.25 : 1.0;
    if (rand() < decidP) addDecid(x, z, (12 + rand() * 7) * tallDecid, decidMats[Math.floor(rand() * decidMats.length)]);
    else addConifer(x, z, 15 + rand() * 13, coniferMats[Math.floor(rand() * coniferMats.length)]);
  }
  for (let psi = 0; psi < 360; psi += 3 + rand() * 2) {
    const D = interpTable(radiusTable, psi) + 9 + rand() * 9;
    const [x, z] = placePsi(psi, D);
    if (rand() < 0.65) addConifer(x, z, 19 + rand() * 14, coniferMats[Math.floor(rand() * coniferMats.length)]);
    else addDecid(x, z, 15 + rand() * 8, decidMats[Math.floor(rand() * decidMats.length)]);
  }
  // large broad tree behind the berm (prominent at start/end)
  { const [x, z] = placePsi(6, 72); addDecid(x, z, 30, coniferMats[1]); }
  // continuous dark forest wall behind trees to close gaps
  {
    const N = 180; const posArr = []; const idx = [];
    for (let i = 0; i <= N; i++) {
      const psi = i / N * 360; const D = interpTable(radiusTable, psi) + 16;
      const [x, z] = placePsi(psi, D); const H = 11 + rand() * 5;
      posArr.push(x, 0, z, x, H, z);
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x262a20, side: THREE.DoubleSide })));
  }

  // young trees, bushes and light stumps in the field (left of frame at start)
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3e4a26 });
  [[41, 40, 3.8, 'b'], [20, 46, 2.6, 'b'], [55, 43, 3.2, 'c'], [64, 46, 4.2, 'c'], [76, 49, 4.6, 'c'], [90, 52, 3.6, 'c'], [100, 50, 3.0, 'b'], [30, 50, 3.4, 'c']].forEach(([psi, D, h, k]) => {
    const [x, z] = placePsi(psi, D);
    if (k === 'b') addMesh(sphGeo, bushMat, x, h * 0.45, z, h * 0.42, h * 0.5, h * 0.42);
    else addMesh(coneGeo, coniferMats[3], x, h * 0.5, z, h * 0.25, h, h * 0.25);
  });
  const stumpMat = new THREE.MeshLambertMaterial({ color: 0xd8cbb0 });
  [[48, 37], [68, 40], [30, 34]].forEach(([psi, D]) => {
    const [x, z] = placePsi(psi, D);
    addMesh(cylGeo, stumpMat, x, 0.3, z, 0.18, 0.6, 0.18);
  });

  // picnic shelter (gazebo)
  {
    const [gx, gz] = placePsi(122, 35);
    const g = new THREE.Group(); g.position.set(gx, 0, gz); g.rotation.y = Math.atan2(-gx, -gz);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a4532 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(boxGeo, postMat); p.position.set(sx * 2.0, 1.15, sz * 1.5); p.scale.set(0.18, 2.3, 0.18); g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.0, 4), new THREE.MeshLambertMaterial({ color: 0x5e5246 }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 0.9); roof.position.y = 2.8; g.add(roof);
    const table = new THREE.Mesh(boxGeo, postMat); table.position.set(0, 0.45, 0); table.scale.set(2.2, 0.9, 1.0); g.add(table);
    scene.add(g);
  }
  // information sign board
  {
    const [sx, sz] = placePsi(173, 50);
    const g = new THREE.Group(); g.position.set(sx, 0, sz); g.rotation.y = Math.atan2(-sx, -sz);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
    for (const lx of [-1.5, 1.5]) { const l = new THREE.Mesh(boxGeo, legMat); l.position.set(lx, 0.8, 0); l.scale.set(0.15, 1.6, 0.15); g.add(l); }
    const board = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6a665e })); board.position.set(0, 1.95, 0); board.scale.set(3.6, 1.0, 0.15); g.add(board);
    const top = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc8c6c0 })); top.position.set(0, 2.5, 0); top.scale.set(3.9, 0.12, 0.5); g.add(top);
    scene.add(g);
  }
  // rock mound and brush piles on the sun side
  {
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x4e4234 });
    let [x, z] = placePsi(314, 21);
    addMesh(sphGeo, rockMat, x, 0, z, 1.7, 1.0, 1.3, 0.4);
    const brushMat = new THREE.MeshLambertMaterial({ color: 0x7c6a4c });
    [[255, 31, 5.5], [275, 27, 6.5], [298, 31, 6], [330, 33, 4]].forEach(([psi, D, w]) => {
      [x, z] = placePsi(psi, D);
      addMesh(sphGeo, brushMat, x, 0, z, w * 0.5, 1.2, w * 0.25, psi * DEG);
    });
  }

  // ---------- woman (articulated proxy) ----------
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf2f0ec });
  const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1c2030 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a080 });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x241a14 });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const ctrlMat = new THREE.MeshLambertMaterial({ color: 0x202020 });

  const woman = new THREE.Group(); scene.add(woman);
  function part(geo, mat, parent, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  }
  for (const s of [-1, 1]) {
    part(cylGeo, pantsMat, woman, s * 0.09, 0.45, 0, 0.068, 0.86, 0.068);
    part(boxGeo, shoeMat, woman, s * 0.09, 0.04, 0.04, 0.1, 0.08, 0.22);
  }
  part(boxGeo, pantsMat, woman, 0, 0.9, 0, 0.32, 0.14, 0.19);
  part(boxGeo, whiteMat, woman, 0, 1.15, 0, 0.36, 0.48, 0.2);
  part(cylGeo, skinMat, woman, 0, 1.43, 0, 0.045, 0.1, 0.045);
  part(sphGeo, skinMat, woman, 0, 1.54, 0.0, 0.1, 0.115, 0.105);
  part(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat, woman, 0, 1.55, -0.01, 0.112, 0.11, 0.115);
  part(boxGeo, hairMat, woman, 0, 1.38, -0.075, 0.26, 0.36, 0.07);

  function makeArm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.215, 1.36, 0); woman.add(shoulder);
    part(cylGeo, whiteMat, shoulder, 0, -0.145, 0, 0.048, 0.29, 0.048);
    const elbow = new THREE.Group(); elbow.position.y = -0.29; shoulder.add(elbow);
    part(cylGeo, whiteMat, elbow, 0, -0.13, 0, 0.042, 0.26, 0.042);
    part(sphGeo, skinMat, elbow, 0, -0.28, 0, 0.045, 0.05, 0.045);
    return { shoulder, elbow, side };
  }
  const armR = makeArm(-1); // her right arm (image-left when she faces the camera)
  const armL = makeArm(1);
  // drone remote controller in her left hand
  part(boxGeo, ctrlMat, armL.elbow, -0.06, -0.3, 0.03, 0.17, 0.035, 0.1);

  // poses: [shoulderPitchForward, shoulderRollOut, elbowBendForward, elbowFoldInPlane]
  const POSES = {
    HOLD: [0.3, 0.12, 1.5, -0.35],
    HEAD: [0.4, 1.4, 0.3, 2.0],
    UPMID: [0.2, 2.0, 0.2, 0.9],
    UP: [-0.15, 2.75, 0.1, 0.25],
    SIDE: [0.1, 1.85, 0.05, 0.1],
    SIDEUP: [0.05, 2.3, 0.05, 0.2],
    FACE: [0.9, 0.5, 1.9, -0.6],
  };
  const R_KEYS = [[0, 'HOLD'], [2.5, 'HOLD'], [2.9, 'HEAD'], [3.4, 'HEAD'], [3.9, 'UPMID'], [4.4, 'UPMID'], [4.9, 'UP'], [6.6, 'UP'], [7.1, 'HOLD'],
    [18.2, 'HOLD'], [18.6, 'UP'], [20.0, 'UP'], [20.5, 'HOLD'], [21.3, 'HOLD'], [21.7, 'SIDE'], [22.2, 'SIDE'], [22.6, 'FACE'], [23.3, 'FACE'], [23.7, 'SIDEUP'], [24.5, 'SIDEUP']];
  const L_KEYS = [[0, 'HOLD'], [22.35, 'HOLD'], [22.7, 'FACE'], [23.3, 'FACE'], [23.7, 'HOLD'], [24.5, 'HOLD']];
  function poseAt(keys, t) {
    if (t <= keys[0][0]) return POSES[keys[0][1]].slice();
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1][0]) {
        let u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); u = u * u * (3 - 2 * u);
        const a = POSES[keys[i][1]], b = POSES[keys[i + 1][1]];
        return a.map((v, k) => lerp(v, b[k], u));
      }
    }
    return POSES[keys[keys.length - 1][1]].slice();
  }
  function applyArm(arm, p, t) {
    let roll = p[1];
    const waveW = Math.min(1, Math.max(0, (roll - 2.3) / 0.4));
    roll += waveW * 0.15 * Math.sin(2 * Math.PI * 1.6 * t);
    arm.shoulder.rotation.set(-p[0], 0, arm.side * roll);
    arm.elbow.rotation.set(-p[2], 0, arm.side * p[3]);
  }

  // ---------- dog (sitting) and post ----------
  const dog = new THREE.Group(); dog.position.set(0.06, 0, -1.05); scene.add(dog);
  const dogMat = new THREE.MeshLambertMaterial({ color: 0xbd8c55 });
  const dogDark = new THREE.MeshLambertMaterial({ color: 0x8a6038 });
  part(sphGeo, dogMat, dog, 0, 0.12, -0.05, 0.13, 0.12, 0.17);           // haunches
  const chest = part(sphGeo, dogMat, dog, 0, 0.27, 0.04, 0.1, 0.17, 0.1); chest.rotation.x = 0.35; // upright chest
  for (const s of [-1, 1]) part(cylGeo, dogMat, dog, s * 0.05, 0.12, 0.1, 0.022, 0.24, 0.022);
  part(sphGeo, dogMat, dog, 0, 0.45, 0.09, 0.075, 0.075, 0.08);           // head
  part(boxGeo, dogDark, dog, 0, 0.43, 0.17, 0.05, 0.045, 0.07);           // muzzle
  for (const s of [-1, 1]) part(boxGeo, dogDark, dog, s * 0.05, 0.5, 0.07, 0.03, 0.07, 0.025); // ears
  part(cylGeo, dogMat, dog, 0, 0.04, -0.2, 0.02, 0.18, 0.02).rotation.x = 1.3; // tail
  const post = new THREE.Mesh(cylGeo, new THREE.MeshLambertMaterial({ color: 0x3a342c }));
  post.position.set(0.04, 0.47, -0.74); post.scale.set(0.022, 0.95, 0.022); scene.add(post);

  // cast shadows (decals) pointing away from the low sun
  {
    const sh = new THREE.MeshBasicMaterial({ color: 0x140c04, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const away = Math.atan2(-sunDir.x, -sunDir.z); // world yaw pointing away from sun
    function shadow(x, z, w, len) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), sh);
      m.rotation.order = 'YXZ'; m.rotation.y = away; m.rotation.x = -Math.PI / 2;
      // plane long axis (local Y) -> after rotations points along 'away' on the ground
      const dx = Math.sin(away), dz = Math.cos(away);
      m.position.set(x + dx * len / 2, 0.07, z + dz * len / 2);
      m.renderOrder = 3; scene.add(m);
    }
    shadow(0, 0, 0.32, 3.2);
    shadow(0.06, -1.05, 0.22, 1.3);
    shadow(0.04, -0.74, 0.04, 2.0);
  }

  // disable tone mapping on all materials so the chosen colours are reproduced directly
  scene.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) { m.toneMapped = false; m.needsUpdate = true; }
  });

  // ---------- update ----------
  function update(time, frame) {
    const t = Math.max(0, Math.min(duration, time));
    const th = thetaFn(t) * DEG;
    camera.position.set(R_ORBIT * Math.sin(th), CAM_H, R_ORBIT * Math.cos(th));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, LOOK_Y, 0);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // woman keeps turning to face the drone she is piloting
    woman.rotation.y = th;
    applyArm(armR, poseAt(R_KEYS, t), t);
    applyArm(armL, poseAt(L_KEYS, t), t);
  }
  update(0, 0);

  return { scene, camera, update };
}
