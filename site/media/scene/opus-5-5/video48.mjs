// CineRecon L1 proxy reconstruction - video48 (web-swinging hero chased by a third-person camera
// through a city street canyon). Three.js sampled-frame baseline.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  const FOG_COL = 0x9a9ca2;
  scene.background = new THREE.Color(FOG_COL);
  scene.fog = new THREE.Fog(FOG_COL, 60, 1000);

  const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 6000);

  // ---------- deterministic RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32((seed | 0) + 4848);

  // ---------- monotone cubic track ----------
  function track(keys) {
    const n = keys.length;
    const T = keys.map((k) => k[0]);
    const V = keys.map((k) => k[1]);
    const dl = [];
    for (let i = 0; i < n - 1; i++) dl.push((V[i + 1] - V[i]) / (T[i + 1] - T[i]));
    const m = new Array(n);
    m[0] = dl[0]; m[n - 1] = dl[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (dl[i - 1] + dl[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (dl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / dl[i], b = m[i + 1] / dl[i];
      const s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * dl[i]; m[i + 1] = tau * b * dl[i]; }
    }
    return function (t) {
      if (t <= T[0]) return V[0];
      if (t >= T[n - 1]) return V[n - 1];
      let i = 0;
      while (i < n - 2 && t > T[i + 1]) i++;
      const h = T[i + 1] - T[i];
      const u = (t - T[i]) / h;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * V[i] + (u3 - 2 * u2 + u) * h * m[i] +
        (-2 * u3 + 3 * u2) * V[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }
  function tracksFrom(rows, cols) {
    const out = {};
    cols.forEach((name, ci) => {
      if (name) out[name] = track(rows.map((r) => [r[0], r[ci + 1]]));
    });
    return out;
  }

  // ---------- timeline ----------
  // Pass A: 0 .. TC. Pass B (after an inferred hard cut): TC .. end, revisiting the same street.
  const TC = 10.85;
  // camera: t, z (progress along street, -Z forward), height, pitch, yaw, lateral x, roll (deg)
  const camA = tracksFrom([
    [0.00, 0, 50, -1, 0, 0, 0],
    [0.58, -32, 42, -2.5, 0, 0, 0],
    [1.17, -64, 32, -4, 4, 4, 0],
    [1.77, -93, 26, -4, 0, -2, 0],
    [2.35, -122, 20, -2, -2.4, 0, 0],
    [2.94, -152, 18, 8, -3, 0, 0],
    [3.52, -180, 14, 78, -3, 0, 30],
    [4.10, -201, 40, 34, -30, 0, 0],
    [4.69, -222, 92, 16, 0, 0, 0],
    [5.29, -243, 105, -60, -2, 0, 0],
    [5.87, -263, 95, -66, -2, 0, 0],
    [6.46, -288, 80, -70, -2, 1, 0],
    [7.04, -312, 60, -68, -2, 4, 0],
    [7.62, -349, 28, -4, -6, 11, 0],
    [8.21, -386, 32, 0, -5.5, 8, 0],
    [8.81, -423, 45, 15, -5.5, 2, 0],
    [9.39, -459, 64, 9, -5.5, 0, 0],
    [9.98, -486, 70, 5, -5, 0, 0],
    [10.56, -512, 62, 2, -4, 0, 0],
    [10.85, -525, 58, -4, -4, 0, 0],
  ], ['z', 'h', 'p', 'y', 'x', 'r']);
  const camB = tracksFrom([
    [10.85, -301, 54, -30, 0, 6, 0],
    [11.14, -318, 46, -25, 1, 7, 0],
    [11.73, -362, 28, -2, -1.2, 7, 0],
    [12.33, -405, 30, 15, -2.4, 0, 0],
    [12.91, -462, 42, 7, 1.2, -2, 0],
    [13.52, -510, 44, -3, 1.8, -7, 0],
  ], ['z', 'h', 'p', 'y', 'x', 'r']);

  // hero: t, screen x, screen y (960x540 reference space), depth along view axis, body pitch, roll
  const heroAkeys = [
    [0.00, 475, 200, 20, 0, -15, 'reach'],
    [0.58, 480, 212, 18, 5, 0, 'vee'],
    [1.17, 485, 250, 11, 0, 0, 'hang'],
    [1.77, 485, 280, 9, -5, 0, 'hang'],
    [2.35, 485, 345, 10, 5, 0, 'hang'],
    [2.94, 470, 300, 13, -25, 0, 'hang'],
    [3.52, 475, 280, 12, -10, 0, 'hang'],
    [4.10, 480, 140, 24, -70, 0, 'spread'],
    [4.69, 475, 100, 8, -170, 20, 'split'],
    [5.29, 480, 230, 6.5, -120, 0, 'dive'],
    [5.87, 475, 230, 7, -120, 0, 'dive'],
    [6.46, 475, 340, 10, -115, 0, 'dive'],
    [7.04, 475, 370, 11, -110, 0, 'dive'],
    [7.62, 478, 340, 7, 0, 0, 'hang'],
    [8.21, 490, 300, 13, -20, 0, 'hang'],
    [8.81, 485, 255, 15, 90, 0, 'tuck'],
    [9.39, 490, 250, 8.5, 180, 0, 'invert'],
    [9.98, 480, 270, 10, 180, 0, 'invert'],
    [10.56, 470, 290, 11, 200, 0, 'invert'],
    [10.85, 465, 280, 12, 215, 0, 'dive'],
  ];
  const heroBkeys = [
    [10.85, 462, 270, 13, 220, 0, 'dive'],
    [11.14, 460, 270, 13, 230, 0, 'dive'],
    [11.73, 475, 285, 13, 360, 0, 'hang'],
    [12.33, 475, 265, 12, 370, 0, 'reach'],
    [12.91, 478, 240, 19, 345, 0, 'spread'],
    [13.52, 480, 215, 38, 300, 0, 'spread'],
  ];
  const heroA = tracksFrom(heroAkeys, ['sx', 'sy', 'd', 'rx', 'rz']);
  const heroB = tracksFrom(heroBkeys, ['sx', 'sy', 'd', 'rx', 'rz']);

  // pose presets: [rAbd,rFlex,rElb, lAbd,lFlex,lElb, rHipAbd,rHipFlex,rKnee, lHipAbd,lHipFlex,lKnee] (deg)
  const POSES = {
    reach: [160, 10, 10, 70, 20, 40, 15, 40, 70, 10, 10, 30],
    vee: [145, 10, 10, 145, 10, 10, 20, 15, 25, 20, 15, 25],
    hang: [170, 15, 5, 160, 20, 15, 8, 35, 50, 8, 10, 20],
    spread: [95, 0, 15, 95, 0, 15, 25, 10, 30, 25, 10, 30],
    dive: [100, -20, 10, 100, -20, 10, 10, -5, 15, 10, -5, 15],
    split: [60, 10, 20, 120, 10, 20, 10, 100, 0, 10, -30, 60],
    invert: [80, 0, 10, 40, 0, 10, 3, 0, 5, 3, 0, 5],
    tuck: [50, 60, 60, 50, 60, 60, 15, 100, 110, 15, 100, 110],
  };
  function poseAt(keys, t, out) {
    let i = 0;
    if (t <= keys[0][0]) { const p = POSES[keys[0][6]]; for (let k = 0; k < 12; k++) out[k] = p[k]; return out; }
    if (t >= keys[keys.length - 1][0]) { const p = POSES[keys[keys.length - 1][6]]; for (let k = 0; k < 12; k++) out[k] = p[k]; return out; }
    while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    let u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    u = u * u * (3 - 2 * u);
    const a = POSES[keys[i][6]], b = POSES[keys[i + 1][6]];
    for (let k = 0; k < 12; k++) out[k] = a[k] + (b[k] - a[k]) * u;
    return out;
  }

  const FOCAL = 487; // px in 960x540 reference space (vfov 58 deg)
  const _e = new THREE.Euler();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  function camState(t, pos, quat) {
    const c = t < TC ? camA : camB;
    pos.set(c.x(t), c.h(t), c.z(t));
    _e.set(c.p(t) * D2R, c.y(t) * D2R, c.r(t) * D2R, 'YXZ');
    quat.setFromEuler(_e);
    return c;
  }
  const _cp = new THREE.Vector3();
  const _cq = new THREE.Quaternion();
  function heroPos(t, out) {
    camState(t, _cp, _cq);
    const hz = t < TC ? heroA : heroB;
    const d = hz.d(t);
    _v.set((hz.sx(t) - 480) / FOCAL * d, -(hz.sy(t) - 270) / FOCAL * d, -d);
    _v.applyQuaternion(_cq);
    return out.copy(_cp).add(_v);
  }

  // ---------- environment ----------
  const hemi = new THREE.HemisphereLight(0xe6e8ee, 0x5a5854, 2.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-200, 400, 150);
  scene.add(sun);

  // sky dome with vertical gradient (overcast)
  {
    const g = new THREE.SphereGeometry(4500, 32, 16);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0x56595f), hor = new THREE.Color(0xa0a2a8), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 4500;
      const k = Math.pow(Math.max(0, y), 0.5);
      c.copy(hor).lerp(top, k);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    var sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  const HALF = 16; // facade line of the main street (|x|)
  // ground, road, water
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x77787b }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -800);
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 2400), new THREE.MeshLambertMaterial({ color: 0x505155 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -800);
  scene.add(road);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 6000), new THREE.MeshLambertMaterial({ color: 0x5f6770 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(-480 - 1500, 0.1, -900);
  scene.add(water);

  // buildings (single instanced mesh with per-instance color)
  const PAL = [0x8a5248, 0x6e4842, 0x8a8c90, 0xa6a6a8, 0x50565f, 0x9a8c78, 0x7c7e66, 0x7a5a50, 0x62666c];
  const lots = [];
  const TOWER = { x: -15, z: -128, w: 15, d: 15, h: 92 };
  // height overrides for lots fronting the main street: [side, zFrom, zTo, hMin, hMax]
  const OVR = [
    [-1, -100, 80, 0, 24], [-1, -138, -118, 0, 26],
    [-1, -215, -160, 58, 66], [1, -215, -160, 55, 64],
    [1, -370, -300, 58, 70], [-1, -350, -300, 0, 36],
    [-1, -412, -355, 48, 56], [1, -440, -366, 0, 22], [1, -600, -440, 0, 34],
    [-1, -458, -430, 54, 60], [-1, -490, -462, 0, 38], [-1, -525, -490, 44, 48],
    [1, -1000, -600, 55, 100],
    [-1, -720, -696, 30, 999], [1, -720, -696, 30, 999],
  ];
  function overlapZ(z0, z1, a, b) { return Math.min(z0, z1) < Math.max(a, b) && Math.max(z0, z1) > Math.min(a, b); }
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      const xin = HALF + i * 74, xout = xin + 60;
      if (side < 0 && xout > 470) continue; // river on the left
      for (let j = 0; j < 24; j++) {
        const zA = 70 - j * 84, zB = zA - 70;
        const nz = 2 + Math.floor(rnd() * 3);
        const cuts = [zA];
        for (let k = 1; k < nz; k++) cuts.push(zA - (70 * k) / nz + (rnd() - 0.5) * 8);
        cuts.push(zB);
        for (let k = 0; k < nz; k++) {
          for (let s = 0; s < 2; s++) {
            const xa = xin + s * 30, xb = xa + 30;
            const za = cuts[k], zb = cuts[k + 1];
            const inner = i === 0 && s === 0;
            let h;
            if (inner) h = 18 + rnd() * 26;
            else if (xa > 150 && rnd() < 0.08) h = 60 + rnd() * 80;
            else h = 10 + rnd() * 28;
            if (inner) {
              for (const o of OVR) {
                if (o[0] === side && overlapZ(za, zb, o[1], o[2])) h = Math.max(o[3], Math.min(o[4], h));
              }
            }
            if (side > 0 && i <= 1 && !inner && overlapZ(za, zb, -1000, -600)) h = 50 + rnd() * 60;
            const col = PAL[Math.floor(rnd() * PAL.length)];
            lots.push([side * (xa + xb) / 2, (za + zb) / 2, xb - xa, Math.abs(za - zb), h, col]);
          }
        }
      }
    }
  }
  // distant skyline
  for (let k = 0; k < 160; k++) {
    const x = -300 + rnd() * 1900, z = -1900 - rnd() * 1300;
    lots.push([x, z, 30 + rnd() * 40, 30 + rnd() * 40, 40 + rnd() * 180, PAL[Math.floor(rnd() * PAL.length)]]);
  }
  for (let k = 0; k < 80; k++) {
    const x = 620 + rnd() * 900, z = 100 - rnd() * 2000;
    lots.push([x, z, 30 + rnd() * 40, 30 + rnd() * 40, 40 + rnd() * 160, PAL[Math.floor(rnd() * PAL.length)]]);
  }
  // landmark dark glass tower on the left of the street near the start
  lots.push([TOWER.x, TOWER.z, TOWER.w, TOWER.d, TOWER.h, 0x40464f]);
  // near right-hand walls of the first street (0.6-1.8 s): red brick then gray
  lots.push([20, -70, 20, 30, 52, 0x8a4a40]);
  lots.push([20, -106, 20, 34, 46, 0x8a8c90]);
  // dark glass block on the right, seen from below during the upward launch (~4.1 s)
  lots.push([HALF + 12, -252, 24, 24, 75, 0x3c424b]);
  {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(g, mat, lots.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    const p = new THREE.Vector3(), s = new THREE.Vector3(), q = new THREE.Quaternion();
    lots.forEach((L, idx) => {
      p.set(L[0], 0, L[1]); s.set(L[2] - 0.6, L[4], L[3] - 0.6);
      m4.compose(p, q, s);
      inst.setMatrixAt(idx, m4);
      c.setHex(L[5]);
      c.offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      inst.setColorAt(idx, c);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }
  // tower antenna
  {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 20, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }));
    ant.position.set(TOWER.x, TOWER.h + 10, TOWER.z);
    scene.add(ant);
  }
  // skybridge across the street far ahead
  {
    const br = new THREE.Mesh(new THREE.BoxGeometry(2 * HALF + 1, 3.5, 4), new THREE.MeshLambertMaterial({ color: 0x45474c }));
    br.position.set(0, 24, -708);
    scene.add(br);
  }
  // billboards on the left facade (W sign and purple sign)
  {
    const wy = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshBasicMaterial({ color: 0xe0a83a }));
    wy.rotation.y = Math.PI / 2; wy.position.set(-HALF + 0.05, 15.5, -397);
    scene.add(wy);
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), new THREE.MeshBasicMaterial({ color: 0x3a4aa0 }));
    wb.rotation.y = Math.PI / 2; wb.position.set(-HALF + 0.05, 15.5, -404.5);
    scene.add(wb);
    const pu = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), new THREE.MeshBasicMaterial({ color: 0xa8389e }));
    pu.rotation.y = Math.PI / 2; pu.position.set(-HALF + 0.05, 44, -442);
    scene.add(pu);
  }
  // street trees
  {
    const pts = [];
    for (let side = -1; side <= 1; side += 2) {
      for (let z = 60; z > -1500; z -= 13) {
        if (rnd() < 0.2) continue;
        if (side < 0 && z < -112 && z > -144) continue; // tower footprint
        if (side > 0 && z < -52 && z > -126) continue; // near right walls
        pts.push([side * 10.5, z + (rnd() - 0.5) * 4]);
      }
    }
    const g = new THREE.SphereGeometry(2.6, 10, 8);
    const inst = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x6a8442 }), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach((P, i) => { m4.makeScale(1, 1.15, 1); m4.setPosition(P[0], 5, P[1]); inst.setMatrixAt(i, m4); });
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
  }
  // cars
  {
    const n = 200;
    const g = new THREE.BoxGeometry(1.9, 1.5, 4.4);
    const inst = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
    const CC = [0xd8d8d8, 0x9a9a9a, 0x2a2a2e, 0xc8c040, 0x9ec03a, 0x4a5a7a];
    const lanes = [-6, -2.2, 2.2, 6];
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      m4.makeTranslation(lanes[Math.floor(rnd() * 4)], 0.78, 60 - rnd() * 1560);
      inst.setMatrixAt(i, m4);
      c.setHex(CC[Math.floor(rnd() * CC.length)]);
      inst.setColorAt(i, c);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  // ---------- hero proxy (articulated) ----------
  const RED = new THREE.MeshLambertMaterial({ color: 0xb4221e });
  const BLUE = new THREE.MeshLambertMaterial({ color: 0x1f3c8c });
  const hero = new THREE.Group();
  scene.add(hero);
  const body = new THREE.Group();
  hero.add(body);
  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  box(0.4, 0.56, 0.24, RED, 0, 0.18, 0, body);       // torso
  box(0.35, 0.2, 0.22, BLUE, 0, -0.14, 0, body);     // pelvis
  {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), RED);
    head.position.set(0, 0.6, 0); body.add(head);
  }
  function limb(parent, x, y, upLen, loLen, upMat, loMat, r) {
    const j1 = new THREE.Group(); j1.position.set(x, y, 0); j1.rotation.order = 'ZXY'; parent.add(j1);
    box(r, upLen, r, upMat, 0, -upLen / 2, 0, j1);
    const j2 = new THREE.Group(); j2.position.set(0, -upLen, 0); j1.add(j2);
    box(r * 0.9, loLen, r * 0.9, loMat, 0, -loLen / 2, 0, j2);
    const end = new THREE.Object3D(); end.position.set(0, -loLen, 0); j2.add(end);
    return { j1, j2, end };
  }
  const rArm = limb(body, 0.25, 0.42, 0.3, 0.3, BLUE, RED, 0.1);
  const lArm = limb(body, -0.25, 0.42, 0.3, 0.3, BLUE, RED, 0.1);
  const rLeg = limb(body, 0.1, -0.22, 0.42, 0.44, BLUE, BLUE, 0.13);
  const lLeg = limb(body, -0.1, -0.22, 0.42, 0.44, BLUE, BLUE, 0.13);
  const rFoot = box(0.12, 0.08, 0.2, RED, 0, -0.02, -0.05, rLeg.end);
  const lFoot = box(0.12, 0.08, 0.2, RED, 0, -0.02, -0.05, lLeg.end);

  // ---------- web line ----------
  const web = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 5), new THREE.MeshBasicMaterial({ color: 0xe6e6ea }));
  scene.add(web);
  const tmp = new THREE.Vector3();
  function anchorAt(ta, x, dy, dz) { heroPos(ta, tmp); return new THREE.Vector3(x, tmp.y + dy, tmp.z + dz); }
  const WEBS = [
    { t0: 0.0, t1: 1.0, a: new THREE.Vector3(-7.5, 72, -121) },
    { t0: 1.05, t1: 3.35, a: anchorAt(2.6, -HALF, 45, -25) },
    { t0: 7.25, t1: 8.95, a: anchorAt(8.2, HALF, 35, -25) },
    { t0: 11.35, t1: 12.05, a: anchorAt(11.7, HALF, 35, -25) },
    { t0: 12.6, t1: 13.25, a: anchorAt(12.9, -HALF, 30, -30) },
  ];
  const _hand = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  const pose = new Array(12).fill(0);
  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));
    const c = camState(t, camera.position, camera.quaternion);
    camera.updateMatrixWorld(true);
    sky.position.copy(camera.position);

    // hero
    heroPos(t, hero.position);
    const hz = t < TC ? heroA : heroB;
    const keys = t < TC ? heroAkeys : heroBkeys;
    body.rotation.set(hz.rx(t) * D2R, c.y(t) * D2R, hz.rz(t) * D2R, 'YXZ');
    poseAt(keys, t, pose);
    rArm.j1.rotation.set(pose[1] * D2R, 0, pose[0] * D2R);
    rArm.j2.rotation.set(pose[2] * D2R, 0, 0);
    lArm.j1.rotation.set(pose[4] * D2R, 0, -pose[3] * D2R);
    lArm.j2.rotation.set(pose[5] * D2R, 0, 0);
    rLeg.j1.rotation.set(pose[7] * D2R, 0, pose[6] * D2R);
    rLeg.j2.rotation.set(-pose[8] * D2R, 0, 0);
    lLeg.j1.rotation.set(pose[10] * D2R, 0, -pose[9] * D2R);
    lLeg.j2.rotation.set(-pose[11] * D2R, 0, 0);
    hero.updateMatrixWorld(true);

    // web
    let w = null;
    for (const s of WEBS) if (t >= s.t0 && t <= s.t1) { w = s; break; }
    if (w) {
      rArm.end.getWorldPosition(_hand);
      _dir.copy(w.a).sub(_hand);
      const len = _dir.length();
      web.visible = true;
      web.position.copy(_hand).addScaledVector(_dir, 0.5);
      web.quaternion.setFromUnitVectors(_up, _dir.normalize());
      web.scale.set(1, len, 1);
    } else {
      web.visible = false;
      web.position.set(0, -100, 0);
      web.scale.set(1, 1, 1);
    }
  }
  update(0, 0);
  return { scene, camera, update };
}
