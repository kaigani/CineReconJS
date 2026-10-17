// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video34.
// Hover-bike rider crossing an orange desert canyon floor; continuous follow camera
// that swings from a side view, to behind the bike, then around to a low upward view
// of the striped rock towers. No cuts.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const F = 270 / Math.tan(20 * DEG); // focal length in 960x540 reference pixel units (vfov 40)
  const SEED = Number.isFinite(Number(seed)) ? Number(seed) : 1;
  const hash1 = (i) => { const x = Math.sin(i * 127.1 + SEED * 311.7 + 0.123) * 43758.5453; return x - Math.floor(x); };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9ece0);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 3000);
  camera.rotation.order = 'YXZ';

  // ---------- monotone cubic keyframe curves ----------
  function monoCurve(ts, ys) {
    const n = ts.length, d = new Array(n - 1), m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
        const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    return function (t) {
      if (t <= ts[0]) return ys[0];
      if (t >= ts[n - 1]) return ys[n - 1];
      let i = 0;
      while (i < n - 2 && t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] +
        (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }

  // Keyframes at the reference sample times.
  const KT = [0, 0.35, 0.6833, 1.0333, 1.3667, 1.7167, 2.05, 2.4, 2.75, 3.0833, 3.4333, 3.7667,
    4.1167, 4.45, 4.8, 5.1333, 5.4833, 5.8333, 6.1667, 6.5167, 6.85, 7.2, 7.5333, 7.8833];
  // camera orbit yaw (deg, + = turned left), horizontal distance, height, bike screen u/v (960x540)
  const KC = [0, 0.5, 1, 2, 4, 21, 27, 29, 31, 36, 42, 46, 48, 52, 58, 66, 76, 96, 118, 132, 148, 163, 171, 175];
  const KD = [14, 14, 14.5, 15, 16, 19, 21, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 21, 16, 11, 6.8, 5.0, 5.6];
  const KH = [5, 5, 5.2, 5.4, 5.6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5.5, 4.2, 3.0, 2.0, 1.3, 0.8, 0.7];
  const KU = [525, 520, 515, 510, 505, 490, 485, 490, 485, 480, 478, 478, 475, 475, 472, 475, 475, 465, 455, 450, 430, 390, 350, 300];
  const KV = [345, 340, 350, 345, 340, 340, 340, 340, 340, 335, 335, 330, 335, 335, 335, 335, 335, 340, 345, 365, 395, 430, 490, 515];
  // bike world heading (deg, + = left of initial camera forward)
  // (relative bike-to-camera heading read from the bike's visible side in each sample, plus camera yaw)
  const KB = [72, 70.5, 68, 64, 56, 53, 49, 45, 42, 42, 42, 36, 36, 40, 46, 54, 62, 66, 64, 66, 76, 93, 116, 125];
  // forward speed (m/s): accelerates during the first two seconds
  const speedC = monoCurve([0, 1.0, 1.7, 2.4, 8], [10, 10.5, 13, 14.5, 14.5]);

  const camYawC = monoCurve(KT, KC), camDistC = monoCurve(KT, KD), camHC = monoCurve(KT, KH);
  const camUC = monoCurve(KT, KU), camVC = monoCurve(KT, KV), headC = monoCurve(KT, KB);
  const headingAt = (t) => headC(t) * DEG;
  const turnRate = (t) => (headC(t + 0.05) - headC(t - 0.05)) / 0.1 * DEG; // rad/s

  // ---------- bike path: precomputed deterministic integration of heading ----------
  const DT = 1 / 240, T0 = -3;
  const NS = Math.ceil((9.5 - T0) / DT) + 2;
  const PX = new Float64Array(NS), PZ = new Float64Array(NS);
  const i0 = Math.round(-T0 / DT);
  for (let i = i0 + 1; i < NS; i++) {
    const h = headingAt(T0 + (i - 0.5) * DT);
    const V = speedC(T0 + (i - 0.5) * DT);
    PX[i] = PX[i - 1] - Math.sin(h) * V * DT; PZ[i] = PZ[i - 1] - Math.cos(h) * V * DT;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    const h = headingAt(T0 + (i + 0.5) * DT);
    const V = speedC(T0 + (i + 0.5) * DT);
    PX[i] = PX[i + 1] + Math.sin(h) * V * DT; PZ[i] = PZ[i + 1] + Math.cos(h) * V * DT;
  }
  function bikeXZ(t) {
    let f = (t - T0) / DT;
    f = clamp(f, 0, NS - 1.001);
    const i = Math.floor(f), a = f - i;
    return [PX[i] + (PX[i + 1] - PX[i]) * a, PZ[i] + (PZ[i + 1] - PZ[i]) * a];
  }

  // ---------- camera pose (absolute in time) ----------
  function camPose(t) {
    const [bx, bz] = bikeXZ(t);
    const c = camYawC(t) * DEG, D = camDistC(t), H = camHC(t), u = camUC(t), v = camVC(t);
    const x = bx + Math.sin(c) * D, z = bz + Math.cos(c) * D;
    const yaw = c + Math.atan((u - 480) / F);
    const pitch = Math.atan2(1.0 - H, D) + Math.atan((v - 270) / F);
    return { x, y: H, z, yaw, pitch };
  }
  const _eul = new THREE.Euler(0, 0, 0, 'YXZ');
  function rayDir(cp, px, py) {
    _eul.set(cp.pitch, cp.yaw, 0, 'YXZ');
    return new THREE.Vector3((px - 480) / F, (270 - py) / F, -1).normalize().applyEuler(_eul);
  }
  // world ground point seen at reference pixel (px,py) at time t; optional forced horizontal distance
  function anchor(t, px, py, forceDist, maxDist) {
    const cp = camPose(t);
    const d = rayDir(cp, px, py);
    const hz = Math.hypot(d.x, d.z);
    let dist;
    if (forceDist) dist = forceDist;
    else {
      dist = d.y < -1e-4 ? (cp.y / -d.y) * hz : 1e9;
      if (maxDist && dist > maxDist) dist = maxDist;
    }
    return new THREE.Vector3(cp.x + d.x / hz * dist, 0, cp.z + d.z / hz * dist);
  }
  function anchorSky(t, px, py, dist) {
    const cp = camPose(t);
    const d = rayDir(cp, px, py);
    return new THREE.Vector3(cp.x + d.x * dist, cp.y + d.y * dist, cp.z + d.z * dist);
  }

  // ---------- procedural textures ----------
  function finishTex(tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (THREE.SRGBColorSpace !== undefined && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }
  const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

  function groundTex() {
    const W = 256, data = new Uint8Array(W * W * 4);
    const base = rgb(0xfc8537), dot = rgb(0xc85a28);
    for (let i = 0; i < W * W; i++) { data[i * 4] = base[0]; data[i * 4 + 1] = base[1]; data[i * 4 + 2] = base[2]; data[i * 4 + 3] = 255; }
    for (let k = 0; k < 150; k++) {
      const cx = hash1(k * 3.1 + 1) * W, cy = hash1(k * 5.7 + 2) * W, r = 1.2 + hash1(k * 9.3 + 3) * 1.8;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) {
        if ((dx * dx) / 1.6 + dy * dy > r * r) continue;
        const x = ((Math.floor(cx) + dx) % W + W) % W, y = ((Math.floor(cy) + dy) % W + W) % W;
        const o = (y * W + x) * 4; data[o] = dot[0]; data[o + 1] = dot[1]; data[o + 2] = dot[2];
      }
    }
    return finishTex(new THREE.DataTexture(data, W, W, THREE.RGBAFormat));
  }

  function stripeTex(baseHex, paleHex, lineHex, bands, off) {
    const W = 64, Hh = 256, data = new Uint8Array(W * Hh * 4);
    const cb = rgb(baseHex), cp = rgb(paleHex), cl = rgb(lineHex);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const s = y / Hh, a = x / W;
      const wob = 0.012 * Math.sin(TAU * a * 2 + s * 9 + off) + 0.007 * Math.sin(TAU * a * 5 + s * 23 + off * 2);
      const q = (s + wob) * bands, k = Math.floor(q), f = q - k;
      const kk = ((k % bands) + bands) % bands;
      const thick = 0.14 + 0.28 * hash1(kk * 7.3 + off);
      let c = f < thick ? cp : cb;
      if (f < 0.03 || Math.abs(f - thick) < 0.025) c = cl;
      const o = (y * W + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    return finishTex(new THREE.DataTexture(data, W, Hh, THREE.RGBAFormat));
  }

  const texGround = groundTex();
  texGround.repeat.set(200, 200);
  const texPillar = stripeTex(0xb24a3a, 0xe6ab9c, 0x5a1a14, 6, 1.0);
  const texTower = stripeTex(0xe04a28, 0xf6a383, 0x6a2214, 5, 2.0);

  // ---------- lights & materials ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd08a50, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(60, 100, 40);
  scene.add(sun);
  const lam = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });
  const basic = (hex) => new THREE.MeshBasicMaterial({ color: hex });

  // cylinder with uv v scaled to world height so stripes keep a constant world period
  function stripedCyl(rt, rb, h, y0, mat, period, segs) {
    const g = new THREE.CylinderGeometry(rt, rb, h, segs || 20, 1, false);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * h + y0) / period);
    uv.needsUpdate = true;
    const m = new THREE.Mesh(g, mat);
    m.position.y = y0 + h / 2;
    return m;
  }
  const matPillar = new THREE.MeshLambertMaterial({ map: texPillar });
  const matTower = new THREE.MeshLambertMaterial({ map: texTower });

  // ---------- anchored scenery positions (derived from camera at observed times) ----------
  // Pillars: base pixel ray hits the ground; radius from observed pixel width at that distance.
  const pillarSpec = [[0, 342, 215, 135, 60], [0, 522, 215, 75, 60], [0, 588, 215, 65, 58], [0.35, 930, 205, 75, 60]];
  const pillars = pillarSpec.map(([t, px, py, wpx, h]) => {
    const p = anchor(t, px, py, 0, 110);
    const cp = camPose(t);
    const dist = Math.hypot(p.x - cp.x, p.z - cp.z);
    return { p, r: (wpx / 2) / F * dist, h };
  });
  const pTreeA = anchor(3.4333, 175, 355, 0, 60), pTreeB = anchor(3.4333, 75, 322, 0, 65);
  const pMound = anchor(2.05, -15, 300, 0, 40);
  const pCreature = anchor(2.4, 665, 228, 70);
  const pRocks = [anchor(4.45, 245, 255, 0, 70), anchor(4.45, 295, 270, 0, 70), anchor(4.45, 140, 262, 0, 70),
    anchor(4.8, 60, 225, 0, 90)];
  const pPlant = anchor(4.8, 265, 160, 82);
  // tower complex anchored on the 7.2 s view (all components clearly visible there)
  const T72 = 7.2;
  const pTL = anchor(T72, 225, 400, 60), pTR = anchor(T72, 770, 400, 55);
  const pM1 = anchor(T72, 590, 430, 60), pM0 = anchor(T72, 485, 430, 65);
  const pSlab = anchor(T72, 800, 400, 44.5), pDome = anchor(T72, 230, 420, 40);

  // ---------- ground & canyon wall ----------
  let CX = 0, CZ = 0, NC = 0, maxIn = 0;
  for (let t = 0; t <= 7.9; t += 0.25) { const cp = camPose(t); CX += cp.x; CZ += cp.z; NC++; }
  CX /= NC; CZ /= NC;
  for (let t = -2; t <= 7.9; t += 0.25) {
    const cp = camPose(Math.max(0, t)); const b = bikeXZ(t);
    maxIn = Math.max(maxIn, Math.hypot(cp.x - CX, cp.z - CZ), Math.hypot(b[0] - CX, b[1] - CZ));
  }
  [pTL, pTR, pM0, pM1].forEach((p) => { maxIn = Math.max(maxIn, Math.hypot(p.x - CX, p.z - CZ) + 8); });
  // wall control points: [time, pixel column, distance from camera, wall height, pink-lit amount]
  const wallCtl = [
    [0, 0, 100, 60, 0], [0, 480, 100, 60, 0.15], [0, 960, 95, 60, 0],
    [1.3667, 960, 95, 60, 0],
    [2.05, 0, 105, 60, 0], [2.05, 480, 115, 60, 0], [2.05, 960, 110, 60, 0],
    [3.0833, 480, 115, 60, 0], [3.0833, 960, 110, 60, 0],
    [4.1167, 0, 100, 55, 0.7], [4.1167, 480, 105, 60, 0], [4.1167, 960, 105, 60, 0],
    [5.1333, 480, 100, 55, 0.2], [5.1333, 960, 100, 60, 0],
    [5.8333, 960, 100, 48, 0.4], [6.5167, 960, 100, 36, 0.9],
    [7.2, 480, 110, 30, 1], [7.2, 0, 110, 32, 1], [7.8833, 960, 100, 30, 1]];
  const wpts = wallCtl.map(([t, px, dist, hh, pk]) => {
    const p = anchor(t, px, 270, dist);
    return { phi: Math.atan2(p.z - CZ, p.x - CX), R: Math.max(maxIn + 25, Math.hypot(p.x - CX, p.z - CZ)), h: hh, pk };
  }).sort((a, b) => a.phi - b.phi);
  function wallAt(phi) {
    const n = wpts.length;
    let j = 0;
    while (j < n && wpts[j].phi < phi) j++;
    const A = wpts[(j - 1 + n) % n], B = wpts[j % n];
    let pa = A.phi, pb = B.phi;
    if (j === 0) pa -= TAU;
    if (j === n) pb += TAU;
    const s = pb > pa ? clamp((phi - pa) / (pb - pa), 0, 1) : 0;
    const e = s * s * (3 - 2 * s);
    return { R: A.R + (B.R - A.R) * e, h: A.h + (B.h - A.h) * e, pk: A.pk + (B.pk - A.pk) * e };
  }
  const SKIRT_W = 32, SKIRT_H = 6;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ map: texGround }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(CX, 0, CZ);
  scene.add(ground);

  {
    const g = new THREE.CylinderGeometry(1, 1, 1, 240, 8, true);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cBot = new THREE.Color(0x7d3a2e), cMid = new THREE.Color(0x8b3f30), cTopDark = new THREE.Color(0x904535),
      cTopPink = new THREE.Color(0xe0907e), tmp = new THREE.Color(), tmp2 = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const phi = Math.atan2(z, x), s = y + 0.5;
      const w = wallAt(phi);
      pos.setXYZ(i, CX + w.R * Math.cos(phi), SKIRT_H * 0.6 + s * (w.h - SKIRT_H * 0.6), CZ + w.R * Math.sin(phi));
      tmp2.copy(cTopDark).lerp(cTopPink, w.pk);
      if (s < 0.35) tmp.copy(cBot).lerp(cMid, s / 0.35); else tmp.copy(cMid).lerp(tmp2, Math.pow((s - 0.35) / 0.65, 0.8));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    // shaded talus skirt at the wall foot: rises from the ground to SKIRT_H at the wall
    const sg = new THREE.CylinderGeometry(1, 1, 1, 240, 1, true);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i);
      const phi = Math.atan2(z, x), s = y + 0.5, w = wallAt(phi);
      const rr = w.R - SKIRT_W * (1 - s);
      sp.setXYZ(i, CX + rr * Math.cos(phi), 0.05 + s * SKIRT_H, CZ + rr * Math.sin(phi));
    }
    sg.computeBoundingSphere(); sg.computeBoundingBox();
    scene.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x8c5a2b, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
  }

  // ---------- striped pillars (first part of the shot) ----------
  for (const pl of pillars) {
    const m = stripedCyl(pl.r * 0.85, pl.r, pl.h, 0, matPillar, 7, 22);
    m.position.x = pl.p.x; m.position.z = pl.p.z;
    m.rotation.y = hash1(pl.p.x) * TAU;
    scene.add(m);
  }

  // ---------- dead trees ----------
  const matTree = lam(0xa9a9b5);
  function limb(parent, x, y, len, r0, r1, tilt, lean) {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.rotation.z = tilt; piv.rotation.x = lean || 0;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), matTree); m.position.y = len / 2;
    piv.add(m); parent.add(piv);
    return piv;
  }
  function makeTree(p, yaw, H, variant) {
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = yaw; scene.add(g);
    if (variant === 0) {
      limb(g, 0, 0, 0.55 * H, 1.5, 0.6, -0.05);
      limb(g, 0.25, 0.52 * H, 0.5 * H, 0.6, 0.22, 0.22);
      limb(g, 0.3, 0.42 * H, 0.36 * H, 0.45, 0.14, -0.95);
      limb(g, 0.2, 0.68 * H, 0.32 * H, 0.35, 0.1, -0.55);
      limb(g, -0.3, 0.3 * H, 0.22 * H, 0.4, 0.15, 0.9);
    } else {
      limb(g, 0, 0, 0.5 * H, 1.3, 0.55, 0.05);
      limb(g, -0.2, 0.45 * H, 0.5 * H, 0.45, 0.14, 1.05);
      limb(g, 0.2, 0.48 * H, 0.45 * H, 0.45, 0.16, -0.35);
    }
    return g;
  }
  const yaw275 = camPose(3.0833).yaw;
  makeTree(pTreeA, yaw275, 13.5, 0);
  makeTree(pTreeB, yaw275, 9.5, 1);
  {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2), lam(0xd8d6de));
    m.scale.set(2.4, 1.3, 2.0); m.position.copy(pMound); scene.add(m);
  }

  // ---------- small red creature / plant and rocks ----------
  function makeRedThing(p, s) {
    const g = new THREE.Group(); g.position.copy(p); scene.add(g);
    const mr = lam(0xc2352a), md = lam(0x7a2420);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 10, 8), mr); b.position.y = 0.55 * s; g.add(b);
    for (let k = 0; k < 4; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 1.0 * s, 6), k % 2 ? md : mr);
      c.position.set((k - 1.5) * 0.35 * s, 1.0 * s, 0); c.rotation.z = (k - 1.5) * 0.4; g.add(c);
    }
    return g;
  }
  makeRedThing(pCreature, 1.4);
  makeRedThing(pPlant, 1.8);
  const matRock = lam(0xb4502c);
  pRocks.forEach((p, k) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + 0.3 * hash1(k + 40)), matRock);
    m.scale.y = 0.75; m.position.set(p.x, 0.45, p.z); m.rotation.y = hash1(k + 50) * TAU; scene.add(m);
  });

  // ---------- rock tower complex (end of the shot) ----------
  function makeTower(p, parts, period) {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = hash1(p.z) * TAU; scene.add(g);
    for (const [y0, h, rb, rt] of parts) g.add(stripedCyl(rt, rb, h, y0, matTower, period, 28));
    return g;
  }
  const gTL = makeTower(pTL, [[0, 12, 15.8, 14.5], [12, 9, 14.5, 12.5], [21, 8, 12.5, 8.5], [29, 9, 5.0, 2.2]], 9);
  const gTR = makeTower(pTR, [[0, 15, 9.6, 8.6], [15, 6, 8.6, 10.5], [21, 7, 10.5, 13.5]], 9);
  {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(14.0, 13.5, 1.6, 28), lam(0xf0a8b8));
    cap.position.y = 28.8; gTR.add(cap);
    const wb = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), lam(0xf2f2f0));
    wb.position.set(-8, 32, 2); wb.rotation.z = 0.1; gTL.add(wb);
  }
  makeTower(pM0, [[0, 14.6, 3.6, 3.3]], 7);
  const gM1 = makeTower(pM1, [[0, 15.4, 5.6, 5.2]], 7);
  {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6.5, 12), lam(0xbdbbac));
    tank.rotation.z = Math.PI / 2; tank.position.y = 17.0; gM1.add(tank);
    // pink slab in front of the right tower, facing the 7.2 s camera
    const cp = camPose(T72);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(6.0, 6.6, 1.4), lam(0xf28fbb));
    slab.position.set(pSlab.x, 3.1, pSlab.z);
    slab.rotation.set(-0.12, Math.atan2(cp.x - pSlab.x, cp.z - pSlab.z), 0.05, 'YXZ');
    scene.add(slab);
  }
  {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, TAU, 0, Math.PI / 2), matTower);
    dome.scale.set(10.5, 6.0, 9.0); dome.position.copy(pDome); scene.add(dome);
    const pb = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), lam(0xf28fbb));
    pb.position.set(pDome.x, 6.0, pDome.z); scene.add(pb);
  }
  // clouds behind the towers
  [[anchorSky(7.5333, 40, 100, 420), [80, 28, 45]], [anchorSky(7.5333, 560, 330, 420), [110, 30, 60]]].forEach(([p, s]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), basic(0xffffff));
    m.position.copy(p); m.scale.set(s[0], s[1], s[2]); m.lookAt(camPose(7.5333).x, p.y, camPose(7.5333).z); scene.add(m);
  });

  // ---------- hover bike + rider (articulated) ----------
  const bikeRoot = new THREE.Group(); scene.add(bikeRoot);
  const bank = new THREE.Group(); bikeRoot.add(bank);
  const mBike = lam(0xd6cf98), mBikeShade = lam(0x9d9766), mSeat = lam(0x2e4a52), mStrap = lam(0x9a7038);
  const mShirt = lam(0xeee6d6), mRed = lam(0xc4402c), mPants = lam(0x3e8e8a), mSkin = lam(0xa0603e), mMask = lam(0x8a8f98);
  function box(w, h, d, mat, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m;
  }
  box(1.0, 0.55, 1.7, mBike, 0, 0.85, 0.1, bank);          // main hull
  box(1.2, 0.75, 0.6, mBike, 0, 0.9, -1.05, bank);         // front nacelle
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.5, 10), mBikeShade);
  pod.rotation.x = Math.PI / 2; pod.position.set(0, 0.78, 1.2); bank.add(pod); // rear engine pod
  box(0.5, 0.14, 0.6, mSeat, 0, 1.18, 0.35, bank);         // seat
  box(0.85, 0.07, 0.07, mBikeShade, 0, 1.38, -0.6, bank);   // handlebar
  box(0.08, 0.3, 0.08, mBikeShade, 0, 1.22, -0.6, bank);    // stem
  box(1.05, 0.1, 0.25, mStrap, 0, 1.14, -0.15, bank);       // strap

  const hip = new THREE.Group(); hip.position.set(0, 1.27, 0.35); bank.add(hip);
  const torso = new THREE.Group(); torso.rotation.x = -0.5; hip.add(torso);
  box(0.42, 0.6, 0.26, mShirt, 0, 0.3, 0, torso);
  box(0.46, 0.18, 0.32, mRed, 0, 0.55, 0.02, torso);
  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.66, 0); torso.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mRed); head.position.y = 0.12; headPivot.add(head);
  box(0.2, 0.12, 0.08, mMask, 0, 0.11, -0.15, headPivot);
  const shoulders = [], thighs = [], knees = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(side * 0.25, 0.5, 0); sh.rotation.x = 1.64; torso.add(sh);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.78, 6), mSkin); arm.position.y = -0.39; sh.add(arm);
    shoulders.push(sh);
    const th = new THREE.Group(); th.position.set(side * 0.52, 0, 0); th.rotation.x = 1.25; hip.add(th);
    const thm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.45, 6), mPants); thm.position.y = -0.225; th.add(thm);
    const kn = new THREE.Group(); kn.position.y = -0.45; kn.rotation.x = -1.45; th.add(kn);
    const sm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.45, 6), mPants); sm.position.y = -0.225; kn.add(sm);
    box(0.14, 0.1, 0.24, mStrap, 0, -0.47, -0.05, kn);
    thighs.push(th); knees.push(kn);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0xb8642a, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.8, 1.6, 1); shadow.position.set(0.25, 0.07, 0.15);
  bikeRoot.add(shadow);

  // ---------- dust / exhaust trail (blobs fixed where emitted, growing with age) ----------
  const TRAIL_STEP = 0.05, NB = 34;
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const matDust = lam(0xf5d6a0), matSmoke = lam(0x8c8c95);
  const blobs = [];
  for (let j = 0; j < NB; j++) { const m = new THREE.Mesh(blobGeo, matDust); scene.add(m); blobs.push(m); }

  // ---------- update ----------
  function update(time, frame) {
    const t = time;
    const cp = camPose(t);
    camera.position.set(cp.x, cp.y, cp.z);
    camera.rotation.set(cp.pitch, cp.yaw, 0, 'YXZ');
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const [bx, bz] = bikeXZ(t);
    const h = headingAt(t), tr = turnRate(t);
    bikeRoot.position.set(bx, 0, bz);
    bikeRoot.rotation.set(0, h, 0);
    const climb = 0.13 * clamp((t - 6.3) / 0.6, 0, 1);
    bank.rotation.set(climb + 0.04 * Math.sin(TAU * 0.9 * t), 0, clamp(0.45 * tr, -0.6, 0.6));
    bank.position.y = 0.05 * Math.sin(TAU * 1.4 * t);
    torso.rotation.set(-0.5 - 0.04 * Math.sin(TAU * 0.7 * t + 1.0), 0, clamp(0.15 * tr, -0.2, 0.2));
    headPivot.rotation.set(0.1, clamp(0.35 * tr, -0.5, 0.5), 0);

    const sNow = Math.floor(t / TRAIL_STEP + 1e-9);
    for (let j = 0; j < NB; j++) {
      const idx = sNow - j, st = idx * TRAIL_STEP, age = t - st;
      const m = blobs[j];
      const [sx, sz] = bikeXZ(st);
      const hs = headingAt(st);
      const hr = hash1(idx * 1.37 + 5), hr2 = hash1(idx * 2.71 + 9), hr3 = hash1(idx * 0.61 + 3);
      let r = Math.min(2.6, 0.2 + 1.5 * age) * (0.75 + 0.5 * hr2);
      if (age > 1.45) r *= Math.max(0.2, 1 - (age - 1.45) / 0.3);
      const lat = (hr - 0.5) * 0.9 * r;
      const px = sx + Math.sin(hs) * 1.5 + Math.cos(hs) * lat;
      const pz = sz + Math.cos(hs) * 1.5 - Math.sin(hs) * lat;
      const py = 0.1 + 0.2 * r;
      const dc = Math.hypot(px - cp.x, py - cp.y, pz - cp.z);
      const near = clamp((dc - 1.2) / (r + 1.5), 0, 1);
      const rs = Math.max(0.001, r * near);
      m.material = hr3 < 0.45 ? matSmoke : matDust;
      m.position.set(px, py, pz);
      m.rotation.set(0.3 * hr, hr2 * TAU, 0.2 * hr3);
      m.scale.set(rs * 1.35, rs * 0.4, rs * 1.0);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
