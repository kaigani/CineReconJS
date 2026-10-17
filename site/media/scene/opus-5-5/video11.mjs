// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video11.
// Single continuous FPV-drone shot over dry grassland with junipers, bare trees,
// dirt tracks and distant buildings. The camera (drone) is the main moving subject.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const rev = parseInt(THREE.REVISION, 10) || 150;
  const LS = rev >= 155 ? Math.PI : 1;

  // ---------- deterministic RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(((seed | 0) ^ 0x5eed11) >>> 0);
  const rr = (a, b) => a + (b - a) * rand();

  // ---------- camera keyframes at the reference sample times ----------
  const FR = [0, 31, 63, 94, 125, 156, 188, 219, 250, 281, 313, 344, 375, 406, 438, 469, 500, 531, 563, 594, 625, 656, 688, 719];
  const T = FR.map((f) => (f * 1001) / 30000);
  // yaw (deg, +left), pitch (deg, negative = looking down), roll (deg, + = camera rolled CCW)
  const YAW = [0, 40, 75, 100, 110, 120, 0, -30, -40, -35, -70, -80, -90, 20, 30, 15, 10, 0, 0, 20, 100, 110, 120, 125];
  const PITCH = [-1, -8.6, -18.4, -20.6, -18.7, -13.9, -33.4, -21.9, -45, -33, -21.5, -27.9, -23.2, -29.5, -31.8, -22.6, -23.8, -21.3, -14.6, -18.1, -2.7, -13.9, -41, -37.5];
  const ROLL_RAW = [120, -16, -38, -6.5, 6.5, 2.7, -80, -7.7, 168, -3.6, -47.8, -41, 2, -4.5, 83.7, 4.8, 1.8, 9, -1.8, -166, -25.6, -4.2, 35.5, 20];
  const ALT = [12, 4, 2.5, 3, 2.5, 2, 5, 7, 8, 7, 4, 3, 2.5, 7, 6, 6, 4, 2, 1.2, 3, 1.5, 1.5, 2.5, 2.5];
  const ROLL = [ROLL_RAW[0]];
  for (let i = 1; i < ROLL_RAW.length; i++) {
    let v = ROLL_RAW[i];
    const prev = ROLL[i - 1];
    while (v - prev > 180) v -= 360;
    while (v - prev < -180) v += 360;
    ROLL.push(v);
  }
  const NK = T.length;

  function cr(arr, t) {
    if (t <= T[0]) return arr[0];
    if (t >= T[NK - 1]) return arr[NK - 1];
    let i = 0;
    while (i < NK - 2 && t > T[i + 1]) i++;
    const u = (t - T[i]) / (T[i + 1] - T[i]);
    const p0 = arr[Math.max(0, i - 1)], p1 = arr[i], p2 = arr[i + 1], p3 = arr[Math.min(NK - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
  }

  // ---------- precomputed ground track (deterministic integration once) ----------
  const SPEED = 10; // m/s
  const RATE = 120;
  const TEND = 24.4;
  const NP = Math.ceil(TEND * RATE) + 2;
  const PX = new Float64Array(NP), PZ = new Float64Array(NP);
  for (let k = 1; k < NP; k++) {
    const tm = (k - 0.5) / RATE;
    const y = cr(YAW, Math.min(tm, T[NK - 1])) * D2R;
    PX[k] = PX[k - 1] - Math.sin(y) * SPEED / RATE;
    PZ[k] = PZ[k - 1] - Math.cos(y) * SPEED / RATE;
  }
  function trackAt(t) {
    const f = Math.max(0, Math.min(NP - 1.001, t * RATE));
    const i = Math.floor(f), u = f - i;
    return { x: PX[i] + (PX[i + 1] - PX[i]) * u, z: PZ[i] + (PZ[i + 1] - PZ[i]) * u };
  }
  function poseAt(t) {
    const p = trackAt(t);
    const y = cr(YAW, t) * D2R;
    return {
      x: p.x, z: p.z, yaw: y,
      fx: -Math.sin(y), fz: -Math.cos(y), // forward
      rx: Math.cos(y), rz: -Math.sin(y),  // right
      alt: Math.max(0.6, cr(ALT, t)),
    };
  }
  // track center
  let cx = 0, cz = 0;
  for (let k = 0; k < NP; k += 10) { cx += PX[k]; cz += PZ[k]; }
  cx /= Math.ceil(NP / 10); cz /= Math.ceil(NP / 10);

  function minTrackDist(x, z, topH) {
    let best = 1e9;
    for (let k = 0; k < NP; k += 6) {
      const t = k / RATE;
      if (topH !== undefined && cr(ALT, Math.min(t, T[NK - 1])) > topH + 1.5) continue;
      const dx = x - PX[k], dz = z - PZ[k];
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return best;
  }
  function nudgeAway(x, z, minD, topH) {
    for (let it = 0; it < 12; it++) {
      let best = 1e9, bk = -1;
      for (let k = 0; k < NP; k += 6) {
        const t = k / RATE;
        if (cr(ALT, Math.min(t, T[NK - 1])) > topH + 1.5) continue;
        const d = Math.hypot(x - PX[k], z - PZ[k]);
        if (d < best) { best = d; bk = k; }
      }
      if (bk < 0 || best >= minD) break;
      let dx = x - PX[bk], dz = z - PZ[bk];
      const L = Math.hypot(dx, dz) || 1;
      dx /= L; dz /= L;
      x = PX[bk] + dx * (minD + 0.3);
      z = PZ[bk] + dz * (minD + 0.3);
    }
    return { x, z };
  }

  // ---------- scene, sun, lights ----------
  const scene = new THREE.Scene();
  const HORIZON = 0xd0d8da;
  scene.background = new THREE.Color(HORIZON);
  scene.fog = new THREE.Fog(HORIZON, 80, 2700);

  const SUN_EL = 20 * D2R, SUN_YAW = 60 * D2R;
  const sunDir = new THREE.Vector3(-Math.sin(SUN_YAW) * Math.cos(SUN_EL), Math.sin(SUN_EL), -Math.cos(SUN_YAW) * Math.cos(SUN_EL)).normalize();
  // ground shadow direction (horizontal, away from sun)
  const shX = -sunDir.x, shZ = -sunDir.z;
  const shL = Math.hypot(shX, shZ);
  const shadowDir = { x: shX / shL, z: shZ / shL };
  const shadowLenPerH = 1 / Math.tan(SUN_EL);

  const hemi = new THREE.HemisphereLight(0xc8d8ee, 0x6b5a3c, 0.75 * LS);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.0 * LS);
  sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(sun);
  scene.add(sun.target);

  function setSRGB(tex) {
    if (THREE.SRGBColorSpace !== undefined && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
  }

  // ---------- sky dome (vertex gradient, follows camera) ----------
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  {
    const R = 9000;
    const g = new THREE.SphereGeometry(R, 96, 48);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cZen = new THREE.Color(0x1c4a80), cMid = new THREE.Color(0x5a8bbe), cHor = new THREE.Color(HORIZON), cSun = new THREE.Color(0xfffbf0);
    const v = new THREE.Vector3(), c = new THREE.Color();
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const e = Math.max(0, v.y);
      c.copy(cHor).lerp(cMid, ss(0.0, 0.18, e)).lerp(cZen, ss(0.15, 0.8, e));
      const sd = Math.max(0, v.dot(sunDir));
      const glow = Math.min(1, Math.pow(sd, 12) * 0.35);
      c.lerp(cSun, glow);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(g, m);
    sky.renderOrder = -10;
    skyGroup.add(sky);
    const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(70, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    sunDisk.position.copy(sunDir).multiplyScalar(8500);
    skyGroup.add(sunDisk);
  }

  // ---------- ground ----------
  function makeGrassTexture() {
    const N = 512;
    const data = new Uint8Array(N * N * 4);
    const lattice = (g, salt) => {
      const r = mulberry32((((seed | 0) * 7919) ^ salt) >>> 0);
      const a = new Float32Array(g * g);
      for (let i = 0; i < g * g; i++) a[i] = r();
      return a;
    };
    const octs = [[32, 0.25], [64, 0.35], [128, 0.3], [256, 0.1]].map(([g, w], k) => ({ g, w, a: lattice(g, 101 + k * 37) }));
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        let v = 0;
        for (const o of octs) {
          const fx = (x / N) * o.g, fy = (y / N) * o.g;
          const ix = Math.floor(fx), iy = Math.floor(fy);
          const ux = smooth(fx - ix), uy = smooth(fy - iy);
          const x0 = ix % o.g, x1 = (ix + 1) % o.g, y0 = iy % o.g, y1 = (iy + 1) % o.g;
          const a = o.a[y0 * o.g + x0], b = o.a[y0 * o.g + x1], c = o.a[y1 * o.g + x0], d = o.a[y1 * o.g + x1];
          v += o.w * ((a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy);
        }
        // clumpy contrast: dark tufts and pale grass
        let s = (v - 0.5) * 2.6 + 0.5;
        s = Math.max(0, Math.min(1, s));
        const lum = 0.26 + 0.74 * s;
        const i = (y * N + x) * 4;
        data[i] = Math.round(255 * lum);
        data[i + 1] = Math.round(255 * lum * 0.97);
        data[i + 2] = Math.round(255 * lum * 0.92);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    setSRGB(tex);
    tex.needsUpdate = true;
    return tex;
  }
  const grassTex = makeGrassTexture();
  const GSIZE = 6400, GSEG = 400;
  grassTex.repeat.set(GSIZE / 6.4, GSIZE / 6.4);
  // seeded hash value noise (absolute, used only at construction)
  function hash2(ix, iz, salt) {
    let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul((seed | 0) + salt, 2246822519)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, z, cell, salt) {
    const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
    let ux = fx - ix, uz = fz - iz; ux = ux * ux * (3 - 2 * ux); uz = uz * uz * (3 - 2 * uz);
    const a = hash2(ix, iz, salt), b = hash2(ix + 1, iz, salt), c = hash2(ix, iz + 1, salt), d = hash2(ix + 1, iz + 1, salt);
    return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
  }
  {
    const g = new THREE.PlaneGeometry(GSIZE, GSIZE, GSEG, GSEG);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
      const n = 0.4 * vnoise(x, z, 150, 11) + 0.35 * vnoise(x, z, 60, 23) + 0.25 * vnoise(x, z, 25, 37);
      const f = 0.68 + 0.6 * n;
      cols[i * 3] = f * 1.01; cols[i * 3 + 1] = f; cols[i * 3 + 2] = f * 0.97;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const m = new THREE.MeshBasicMaterial({ color: 0xc2a77e, map: grassTex, vertexColors: true });
    const ground = new THREE.Mesh(g, m);
    ground.position.set(cx, 0, cz);
    ground.name = 'ground';
    scene.add(ground);
  }

  // ---------- dirt tracks (smoothed polylines on the ground) ----------
  function makeRoad(ctrl, w, color, name) {
    // Catmull-Rom subdivision of control points
    const pts = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      const L = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      const n = Math.max(2, Math.ceil(L / 3));
      for (let k = 0; k < n; k++) {
        const u = k / n, u2 = u * u, u3 = u2 * u;
        const f = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u2 + (-a0 + 3 * a1 - 3 * a2 + a3) * u3);
        pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
      }
    }
    pts.push(ctrl[ctrl.length - 1]);
    const verts = [], uvs = [], idx = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const nx = -dz, nz = dx;
      const ax = pts[i].x + nx * w / 2, az = pts[i].z + nz * w / 2, bx = pts[i].x - nx * w / 2, bz = pts[i].z - nz * w / 2;
      verts.push(ax, 0.05, az, bx, 0.05, bz);
      uvs.push(ax / 3.2, az / 3.2, bx / 3.2, bz / 3.2);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = name;
    scene.add(mesh);
  }
  const at = (t, f, r) => { const p = poseAt(t); return { x: p.x + p.fx * f + p.rx * r, z: p.z + p.fz * f + p.rz * r }; };
  const roadPts = [];
  {
    // track A: straight-ahead dirt road under the drone around 12.5 s
    makeRoad([at(12.51, -25, 1.5), at(12.51, 0, 1.5), at(12.51, 60, 2.0), at(12.51, 230, 4)], 3.6, 0x8a7258, 'dirtTrackA');
    // track B: road the drone joins ~18 s and follows to ~22 s
    const q1 = at(18.79, 0, 1.0), q2 = at(20.85, 0, 0.8), q3 = at(21.89, 0, 1.5);
    const p = poseAt(21.89), yy = p.yaw - 25 * D2R;
    const q4 = { x: q3.x - Math.sin(yy) * 250, z: q3.z - Math.cos(yy) * 250 };
    makeRoad([at(18.79, -45, 1.0), at(18.79, -20, 1.0), q1, q2, q3, q4], 3.6, 0xbaa382, 'dirtTrackB');
  }

  // pale water/flat strip near horizon (seen at ~1 s and ~21 s on image-left)
  {
    const p = poseAt(1.03);
    const y = p.yaw + 55 * D2R;
    const dx = -Math.sin(y), dz = -Math.cos(y);
    const g = new THREE.PlaneGeometry(320, 22);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x95a3ad, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const w = new THREE.Mesh(g, m);
    w.position.set(p.x + dx * 280, 0.06, p.z + dz * 280);
    w.rotation.y = y;
    w.name = 'waterStrip';
    scene.add(w);
  }

  // ---------- vegetation ----------
  const junipers = []; // {x,z,h,w}
  const bigTrees = []; // {x,z,h,w}
  function addJuniper(x, z, h, w, force) {
    if (!force && minTrackDist(x, z, h + 1) < w + 4) return;
    junipers.push({ x, z, h, w, c: rr(0, 1) });
  }
  // featured objects placed relative to the camera pose at sample times
  const featured = [
    { t: 5.2, f: 8, r: 5.5, type: 'j', h: 4.5, w: 2.4 },
    { t: 5.2, f: 16, r: 0.5, type: 'j', h: 3.5, w: 1.8 },
    { t: 7.3, f: 14, r: 0, type: 'j', h: 3.0, w: 1.6 },
    { t: 10.44, f: 35, r: -2, type: 'b', h: 7, w: 3.5 },
    { t: 12.51, f: 6, r: -5.5, type: 'b', h: 7, w: 3.2 },
    { t: 12.51, f: 45, r: 2, type: 'b', h: 7, w: 3.5 },
    { t: 13.55, f: 8, r: 4, type: 'b', h: 5, w: 3.0 },
  ];
  for (const o of featured) {
    const p = poseAt(o.t);
    let x = p.x + p.fx * o.f + p.rx * o.r, z = p.z + p.fz * o.f + p.rz * o.r;
    const q = nudgeAway(x, z, o.w + 1.0, o.h);
    if (o.type === 'j') junipers.push({ x: q.x, z: q.z, h: o.h, w: o.w, c: rr(0, 1) });
    else bigTrees.push({ x: q.x, z: q.z, h: o.h, w: o.w });
  }
  // scattered junipers
  for (let i = 0; i < 900; i++) {
    const x = cx + rr(-650, 650), z = cz + rr(-650, 650);
    const h = rr(1.6, 4.2);
    addJuniper(x, z, h, h * rr(0.32, 0.48), false);
  }
  // rows of junipers (windbreak lines)
  for (let r = 0; r < 14; r++) {
    const ang = rr(0, Math.PI);
    const x0 = cx + rr(-400, 400), z0 = cz + rr(-400, 400);
    const n = Math.floor(rr(8, 18));
    const sp = rr(8, 14);
    for (let k = 0; k < n; k++) {
      const h = rr(2.0, 3.8);
      addJuniper(x0 + Math.cos(ang) * k * sp + rr(-1, 1), z0 + Math.sin(ang) * k * sp + rr(-1, 1), h, h * 0.4, false);
    }
  }
  // a few more bare trees
  for (let i = 0; i < 18; i++) {
    const x = cx + rr(-450, 450), z = cz + rr(-450, 450);
    const h = rr(5, 8), w = h * 0.5;
    if (minTrackDist(x, z, h + 1) < w + 5) continue;
    bigTrees.push({ x, z, h, w });
  }

  {
    const n = junipers.length;
    const g = new THREE.SphereGeometry(1, 12, 9);
    const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const inst = new THREE.InstancedMesh(g, m, n);
    inst.name = 'junipers';
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    const cA = new THREE.Color(0x3d3f22), cB = new THREE.Color(0x56532e);
    junipers.forEach((j, i) => {
      p.set(j.x, j.h * 0.5, j.z); s.set(j.w, j.h * 0.5, j.w);
      mat.compose(p, q, s); inst.setMatrixAt(i, mat);
      col.copy(cA).lerp(cB, j.c); inst.setColorAt(i, col);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }
  {
    const n = bigTrees.length;
    const trunkG = new THREE.CylinderGeometry(0.22, 0.38, 1, 8);
    trunkG.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x4e4032 }), n);
    const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshLambertMaterial({ color: 0x6a5643, transparent: true, opacity: 0.78, depthWrite: false }), n);
    trunks.name = 'bareTreeTrunks'; crowns.name = 'bareTreeCrowns';
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    bigTrees.forEach((b, i) => {
      p.set(b.x, 0, b.z); s.set(1, b.h * 0.55, 1); mat.compose(p, q, s); trunks.setMatrixAt(i, mat);
      p.set(b.x, b.h * 0.62, b.z); s.set(b.w, b.h * 0.38, b.w); mat.compose(p, q, s); crowns.setMatrixAt(i, mat);
    });
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    scene.add(trunks); scene.add(crowns);
  }
  // long fake cast shadows (flat dark ellipses pointing away from the low sun)
  {
    const all = junipers.map((j) => ({ x: j.x, z: j.z, h: j.h, w: j.w * 0.9 })).concat(bigTrees.map((b) => ({ x: b.x, z: b.z, h: b.h, w: b.w * 0.9 })));
    const g = new THREE.CircleGeometry(1, 20);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: 0x2a1f12, transparent: true, opacity: 0.68, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const inst = new THREE.InstancedMesh(g, m, all.length);
    inst.name = 'castShadows';
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(shadowDir.x, shadowDir.z));
    all.forEach((o, i) => {
      const L = o.h * shadowLenPerH;
      p.set(o.x + shadowDir.x * L * 0.5, 0.07, o.z + shadowDir.z * L * 0.5);
      s.set(o.w, 1, L * 0.5 + o.w * 0.3);
      mat.compose(p, q, s); inst.setMatrixAt(i, mat);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.renderOrder = 1;
    scene.add(inst);
  }

  // ---------- distant buildings and tree lines on the horizon ----------
  {
    const blds = [];
    for (let i = 0; i < 110; i++) {
      const a = rr(0, Math.PI * 2), d = rr(850, 1600);
      blds.push({ a, d, w: rr(20, 90), dp: rr(15, 45), h: rr(5, 18), c: rand() < 0.55 ? 0 : (rand() < 0.5 ? 1 : 2) });
    }
    // bright tall cluster (seen ahead-left early in the flight)
    const a0 = (cr(YAW, 4.17) + 18) * D2R;
    blds.push({ a: a0, d: 1100, w: 40, dp: 30, h: 26, c: 0 });
    blds.push({ a: a0 + 0.03, d: 1120, w: 25, dp: 25, h: 30, c: 0 });
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const inst = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff }), blds.length);
    inst.name = 'distantBuildings';
    const cols = [new THREE.Color(0xe6e2da), new THREE.Color(0xa59d90), new THREE.Color(0x8a6450)];
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    blds.forEach((b, i) => {
      p.set(cx - Math.sin(b.a) * b.d, 0, cz - Math.cos(b.a) * b.d);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.a);
      s.set(b.w, b.h, b.dp);
      mat.compose(p, q, s); inst.setMatrixAt(i, mat); inst.setColorAt(i, cols[b.c]);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    scene.add(inst);

    const n = 260;
    const tl = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a4430 }), n);
    tl.name = 'horizonTreeLine';
    for (let i = 0; i < n; i++) {
      const a = rr(0, Math.PI * 2), d = rr(700, 1500);
      p.set(cx - Math.sin(a) * d, 0, cz - Math.cos(a) * d);
      q.identity();
      s.set(rr(8, 25), rr(4, 9), rr(8, 20));
      mat.compose(p, q, s); tl.setMatrixAt(i, mat);
    }
    tl.instanceMatrix.needsUpdate = true;
    scene.add(tl);
  }

  // ---------- camera (FPV action cam, wide FOV) ----------
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.2, 15000);
  camera.rotation.order = 'YXZ';

  function update(time, frame) {
    const t = Math.max(0, Math.min(T[NK - 1], time));
    const p = poseAt(t);
    camera.position.set(p.x, p.alt, p.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(cr(PITCH, t) * D2R, cr(YAW, t) * D2R, cr(ROLL, t) * D2R);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    skyGroup.position.copy(camera.position);
  }

  update(0, 0);
  return { scene, camera, update };
}
