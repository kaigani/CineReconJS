// CineRecon L1 proxy reconstruction - onboard F1 lap segment (video30)
// Shot 1 (0 - 2.82 s): low camera above the nose, long right-hand corner.
// Shot 2 (2.82 - 10.01 s): cockpit camera (halo, mirrors, steering wheel, gloves),
// short right kink, straight past grandstands, braking, tight left corner
// with a dark rival car ahead.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const rev = parseInt(THREE.REVISION, 10) || 160;
  const LS = rev >= 155 ? 1 : 1 / Math.PI; // light scale for legacy light mode

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(((seed == null ? 1 : seed) >>> 0) ^ 0x5bd1e995);

  function lin(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const u = (t - a[0]) / (b[0] - a[0]);
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---------------- timeline keyframes ----------------
  const TCUT = 2.82; // hard cut from nose camera to cockpit camera
  // yaw rate (deg/s, + = right turn)
  const OMEGA = [[-4, 0], [-2.5, 0], [-1.5, 30], [2.3, 30], [2.95, 12], [3.3, 4], [3.55, 3],
    [3.85, 18], [4.8, 18], [5.3, 3], [5.6, 0], [6.25, 0], [6.5, -3], [6.9, -1], [7.25, -4],
    [7.5, -20], [7.85, -45], [9.3, -45], [10.0, -40], [10.6, -20], [11.4, 0], [26, 0]];
  // speed (m/s)
  const VEL = [[-4, 62], [0, 60], [2.6, 53], [3.0, 50], [4.0, 57], [5.0, 64], [6.0, 72],
    [6.55, 76], [7.4, 38], [7.85, 27], [9.0, 25], [10.0, 29], [12, 42], [16, 60], [26, 75]];
  // ego lateral offset from track centre (m, + = right)
  const LAT = [[-4, 0.5], [2.6, 0.5], [3.3, 1], [4.5, 2], [5.5, 0.5], [6.6, 1.5], [7.4, 3.5],
    [8.0, 0], [8.7, -3.5], [9.3, -3.5], [10.0, -1], [11, 2.5], [26, 2.5]];
  // steering wheel angle (deg, + = counter-clockwise / left)
  const STEER = [[-4, 0], [-2.5, 0], [-1.5, -12], [2.6, -12], [3.04, -10], [3.3, -4], [3.47, -2],
    [3.65, -15], [3.9, -30], [4.34, -35], [4.77, -25], [5.22, -12], [5.5, -3], [5.66, 0],
    [6.09, 1], [6.52, 6], [6.96, 2], [7.2, 5], [7.39, 11], [7.6, 50], [7.82, 78], [8.26, 85],
    [8.69, 90], [9.13, 86], [9.56, 80], [9.99, 80], [10.6, 40], [11.4, 0], [26, 0]];
  // rival car time lead along the same racing line (s)
  const TAU = [[-4, 3.0], [2.8, 2.8], [4.0, 2.4], [6.0, 2.0], [6.96, 1.75], [7.82, 1.9], [8.26, 2.0], [12, 2.0]];

  // ---------------- integrate ego path (deterministic table) ----------------
  const T0 = -4, T1 = 26, DT = 1 / 240;
  const N = Math.round((T1 - T0) / DT) + 1;
  const PX = new Float64Array(N), PZ = new Float64Array(N), PH = new Float64Array(N), PS = new Float64Array(N);
  {
    let x = 0, z = 0, psi = 0, s = 0;
    for (let i = 0; i < N; i++) {
      const t = T0 + i * DT;
      PX[i] = x; PZ[i] = z; PH[i] = psi; PS[i] = s;
      const tm = t + DT / 2;
      const v = lin(VEL, tm), w = lin(OMEGA, tm) * D2R;
      const pm = psi + w * DT / 2;
      x += v * Math.sin(pm) * DT; z -= v * Math.cos(pm) * DT;
      psi += w * DT; s += v * DT;
    }
  }
  function egoAt(t) {
    let f = (t - T0) / DT;
    if (f < 0) f = 0; if (f > N - 1.001) f = N - 1.001;
    const i = Math.floor(f), u = f - i;
    return {
      x: PX[i] + (PX[i + 1] - PX[i]) * u, z: PZ[i] + (PZ[i + 1] - PZ[i]) * u,
      psi: PH[i] + (PH[i + 1] - PH[i]) * u, s: PS[i] + (PS[i + 1] - PS[i]) * u,
    };
  }
  function centerAt(t) {
    const e = egoAt(t), L = lin(LAT, t);
    return { x: e.x - L * Math.cos(e.psi), z: e.z - L * Math.sin(e.psi), psi: e.psi, s: e.s };
  }
  function trackPt(t, L) {
    const c = centerAt(t);
    return { x: c.x + L * Math.cos(c.psi), z: c.z + L * Math.sin(c.psi), psi: c.psi, s: c.s };
  }
  function egoRel(t, fwd, right) {
    const e = egoAt(t);
    return {
      x: e.x + fwd * Math.sin(e.psi) + right * Math.cos(e.psi),
      z: e.z - fwd * Math.cos(e.psi) + right * Math.sin(e.psi), psi: e.psi,
    };
  }
  function faceYaw(fx, fz) { return Math.atan2(-fx, -fz); } // local -Z faces (fx,fz)

  // ---------------- scene, lights, sky ----------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc4d4e6, 250, 2200);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x5b6b45, 1.6 * LS));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.7 * LS);
  sun.position.set(300, 600, 250);
  scene.add(sun);

  const sky = (() => {
    const g = new THREE.SphereGeometry(4000, 32, 16);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const zen = new THREE.Color(0x547bbe), hor = new THREE.Color(0xa6bcd3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const e = Math.max(0, p.getY(i) / 4000);
      c.copy(hor).lerp(zen, Math.pow(Math.min(1, e * 3.0), 0.6));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -1;
    scene.add(m);
    return m;
  })();

  const lam = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, side: THREE.DoubleSide }, extra || {}));
  const offsetMat = (color, f) => lam(color, { polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });

  // ---------------- ground and track ----------------
  {
    const c = egoAt(5);
    const g = new THREE.PlaneGeometry(7000, 7000);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, lam(0x5f6a36));
    m.position.set(c.x, -0.2, c.z);
    scene.add(m);
  }

  function ribbon(tA, tB, La, Lb, ya, yb, mat, vLen) {
    const n = Math.max(2, Math.ceil((tB - tA) / 0.02) + 1);
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const t = tA + (tB - tA) * i / (n - 1);
      const a = trackPt(t, La), b = trackPt(t, Lb);
      pos[i * 6] = a.x; pos[i * 6 + 1] = ya; pos[i * 6 + 2] = a.z;
      pos[i * 6 + 3] = b.x; pos[i * 6 + 4] = yb; pos[i * 6 + 5] = b.z;
      const v = vLen ? a.s / vLen : 0;
      uv[i * 4] = 0; uv[i * 4 + 1] = v; uv[i * 4 + 2] = 1; uv[i * 4 + 3] = v;
    }
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    scene.add(m);
    return m;
  }

  const HW = 6.5; // track half width
  const TA = -3.5, TB = 25;
  const roadMat = offsetMat(0x67656c, 0);
  const lineMat = offsetMat(0xf2f2f2, -2);
  const runoffMat = offsetMat(0x7d7c82, -1);
  const paintMat = offsetMat(0x2f9a5c, -1);
  const kerbTex = (() => {
    const d = new Uint8Array([205, 38, 45, 255, 238, 238, 238, 255]);
    const tx = new THREE.DataTexture(d, 1, 2, THREE.RGBAFormat);
    if (THREE.SRGBColorSpace) tx.colorSpace = THREE.SRGBColorSpace;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.magFilter = tx.minFilter = THREE.NearestFilter;
    tx.generateMipmaps = false;
    tx.needsUpdate = true;
    return tx;
  })();
  const kerbMat = lam(0xffffff, { map: kerbTex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  ribbon(TA, TB, -HW, HW, 0, 0, roadMat);
  ribbon(TA, TB, -HW, -HW + 0.18, 0.005, 0.005, lineMat);
  ribbon(TA, TB, HW - 0.18, HW, 0.005, 0.005, lineMat);
  // kerbs (red / white, 3 m blocks)
  const kerb = (tA, tB, side) => side > 0 ? ribbon(tA, tB, HW, HW + 1.6, 0.03, 0.03, kerbMat, 6)
    : ribbon(tA, tB, -HW - 1.6, -HW, 0.03, 0.03, kerbMat, 6);
  kerb(TA, 3.3, 1);      // long right-hander inside
  kerb(3.7, 5.3, 1);     // right kink inside
  kerb(6.4, 7.7, 1);     // braking zone outside
  kerb(7.9, 9.8, -1);    // left corner apex
  kerb(9.3, 10.9, 1);    // left corner exit
  // run-off areas
  ribbon(TA, 3.0, -34, -10.5, 0.01, 0.01, runoffMat);
  ribbon(3.0, 7.6, -20, -10.5, 0.01, 0.01, runoffMat);
  ribbon(4.9, 7.7, HW + 2.5, 13, 0.01, 0.01, runoffMat);
  ribbon(7.9, 10.2, -13, -HW - 1.6, 0.01, 0.01, paintMat);

  // barriers / advertising boards (vertical ribbons)
  const wall = (tA, tB, L, h, color) => ribbon(tA, tB, L, L, 0, h, lam(color));
  wall(TA, 1.6, -34, 1.1, 0x23307a);   // navy sponsor boards
  wall(1.6, 3.0, -34, 1.1, 0xdedede);  // white barrier
  wall(3.0, 4.4, -20, 1.1, 0xd9d9d9);
  wall(4.4, 7.7, -20, 1.2, 0x1d6a3e);  // green boards
  wall(TA, 4.7, 11.5, 1.2, 0xc8cadc);  // concrete wall, right
  wall(4.9, 7.7, 14, 1.1, 0x1d6a3e);
  wall(7.7, 12.5, 16, 1.2, 0x1d6a3e);
  wall(8.6, 12, -15, 1.1, 0x1d6a3e);
  // catch fences (translucent mesh + posts)
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0x8f959e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  ribbon(TA, 4.7, 11.5, 11.5, 1.2, 4.8, fenceMat);
  ribbon(7.7, 12.5, 16, 16, 1.2, 4.6, fenceMat);
  {
    const posts = [];
    for (let t = TA; t <= 4.7; t += 0.13) posts.push([t, 11.5, 4.8]);
    for (let t = 7.7; t <= 12.5; t += 0.25) posts.push([t, 16, 4.6]);
    const g = new THREE.CylinderGeometry(0.09, 0.09, 1, 6); g.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(g, lam(0x5c6066), posts.length);
    const M = new THREE.Matrix4();
    posts.forEach((p, i) => {
      const q = trackPt(p[0], p[1]);
      M.makeScale(1, p[2], 1); M.setPosition(q.x, 0, q.z);
      im.setMatrixAt(i, M);
    });
    scene.add(im);
  }

  // ---------------- landmarks ----------------
  const box = (w, h, d, color, parent, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
    m.position.set(x || 0, y || 0, z || 0);
    (parent || scene).add(m);
    return m;
  };
  const cyl = (r1, r2, h, color, parent, x, y, z, seg) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg || 8), lam(color));
    m.position.set(x || 0, y || 0, z || 0);
    (parent || scene).add(m);
    return m;
  };

  // grandstand: long axis local X, front (track side) toward local -Z, rising to +Z
  function makeStand(o) {
    const g = new THREE.Group();
    const slope = Math.sqrt(o.h * o.h + o.d * o.d);
    const seat = box(o.len, 0.8, slope, o.seat, g, 0, o.h / 2 + 0.6, 0);
    seat.rotation.x = -Math.atan2(o.h, o.d);
    box(o.len, o.h + 1, 0.6, o.back, g, 0, (o.h + 1) / 2, o.d / 2);
    box(o.len, 1.2, 0.4, o.back, g, 0, 0.6, -o.d / 2);
    if (o.roof) {
      const r = box(o.len + 4, 0.35, o.d + 8, 0xf2f2f2, g, 0, o.h + 8, -1);
      r.rotation.x = -0.08;
      for (let k = 0; k <= 4; k++) cyl(0.35, 0.35, o.h + 8, 0xd8d8d8, g, -o.len / 2 + k * o.len / 4, (o.h + 8) / 2, o.d / 2 + 0.5);
    }
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.yaw;
    scene.add(g);
    return g;
  }
  const exclusions = []; // [x, z, r]

  // Stand A: long covered grandstand on the right of the straight
  {
    const c = egoRel(7.39, 25, 40), h = egoAt(7.0);
    makeStand({ len: 75, d: 16, h: 11, seat: 0xa59ea4, back: 0xb8bcc4, roof: true, x: c.x, z: c.z, yaw: Math.PI / 2 - h.psi });
    exclusions.push([c.x, c.z, 50]);
  }
  // Stand B: steep scaffold grandstand on the outside of the left corner
  {
    const c = egoRel(7.39, 120, 10), a = egoRel(7.39, 40, -25);
    makeStand({ len: 45, d: 22, h: 20, seat: 0xb2a9ae, back: 0xd3d6dc, roof: false, x: c.x, z: c.z, yaw: faceYaw(a.x - c.x, a.z - c.z) });
    exclusions.push([c.x, c.z, 45]);
  }
  // Stand C1: long low stand, far left of the braking zone
  {
    const c = egoRel(7.39, 131, -92), a = egoRel(7.39, 50, -40);
    makeStand({ len: 120, d: 14, h: 9, seat: 0x9c7f7a, back: 0xb9bcc2, roof: false, x: c.x, z: c.z, yaw: faceYaw(a.x - c.x, a.z - c.z) });
    exclusions.push([c.x, c.z, 70]);
  }
  // Stand C2: stand left of the corner exit
  {
    const c = egoRel(9.56, 60, -95), e = egoAt(9.56);
    makeStand({ len: 50, d: 14, h: 9, seat: 0x9c8a86, back: 0xb9bcc2, roof: false, x: c.x, z: c.z, yaw: faceYaw(e.x - c.x, e.z - c.z) });
    exclusions.push([c.x, c.z, 50]);
  }
  // overhead green bridge / gantry across the track
  {
    const c = trackPt(5.0, 0);
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z); g.rotation.y = -c.psi;
    box(30, 1.2, 1.0, 0x1d6a3e, g, 17, 4.1, 0);
    cyl(0.35, 0.35, 4.1, 0x9aa0a8, g, 2.5, 2.05, 0);
    cyl(0.35, 0.35, 4.1, 0x9aa0a8, g, 31.5, 2.05, 0);
    scene.add(g);
  }
  // big video screen on the left after the long right-hander
  {
    const c = egoRel(3.04, 35, -22), f = egoAt(2.6);
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z); g.rotation.y = -f.psi;
    box(8.5, 5.2, 0.5, 0x2b2f36, g, 0, 5.1, 0);
    box(7.8, 4.6, 0.1, 0x6f8ea6, g, 0, 5.1, -0.3);
    cyl(0.25, 0.25, 2.6, 0x6a6e75, g, -3, 1.3, 0.3);
    cyl(0.25, 0.25, 2.6, 0x6a6e75, g, 3, 1.3, 0.3);
    scene.add(g);
    exclusions.push([c.x, c.z, 8]);
  }
  // cherry-picker crane and white buildings far left at the start
  {
    const c = egoRel(0, 140, -54);
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = -c.psi;
    box(3, 2, 5, 0xd8d8d8, g, 0, 1, 0);
    const boom = cyl(0.35, 0.35, 26, 0xc8322d, g, 4, 13, 0); boom.rotation.z = -0.35;
    box(3, 1.8, 2, 0xc8322d, g, 8.5, 25, 0);
    scene.add(g);
    exclusions.push([c.x, c.z, 12]);
    const b1 = egoRel(0, 220, -130), b2 = egoRel(0, 260, -75);
    const m1 = box(25, 6, 12, 0xe6e6e6, null, b1.x, 3, b1.z); m1.rotation.y = -b1.psi;
    const m2 = box(45, 7, 15, 0xe9e9e9, null, b2.x, 3.5, b2.z); m2.rotation.y = -b2.psi;
    exclusions.push([b1.x, b1.z, 25], [b2.x, b2.z, 30]);
  }
  // light poles
  [[2.0, -40], [4.05, -17], [4.9, -17], [5.9, -21], [7.0, -23], [9.45, 18]].forEach(([t, L]) => {
    const c = trackPt(t, L);
    cyl(0.18, 0.25, 16, 0x8d929a, null, c.x, 8, c.z, 6);
    box(1.6, 0.6, 0.6, 0x5a5e66, null, c.x, 16, c.z);
  });
  // distant mountain range (fog-free, hazy colour)
  {
    const e = egoAt(6.96);
    const mm = new THREE.MeshBasicMaterial({ color: 0x8890a6, fog: false });
    [-26, -38, -50, -62, -74, -86, -98].forEach((b, i) => {
      const a = e.psi + b * D2R, R = 2300;
      const m = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 6), mm);
      const h = 130 + 50 * ((i * 37) % 5) / 4;
      m.scale.set(260 + 40 * (i % 3), h, 200);
      m.position.set(e.x + R * Math.sin(a), h / 2 - 20, e.z - R * Math.cos(a));
      m.rotation.y = i;
      scene.add(m);
    });
  }

  // trees (instanced, seeded placement away from the circuit)
  {
    const cl = [];
    for (let t = TA; t <= TB; t += 0.05) { const c = centerAt(t); cl.push(c.x, c.z); }
    const ok = (x, z) => {
      for (let i = 0; i < cl.length; i += 2) {
        const dx = x - cl[i], dz = z - cl[i + 1];
        if (dx * dx + dz * dz < 26 * 26) return false;
      }
      for (const [ex, ez, r] of exclusions) { const dx = x - ex, dz = z - ez; if (dx * dx + dz * dz < r * r) return false; }
      return true;
    };
    const trees = [];
    for (let k = 0; k < 900 && trees.length < 340; k++) {
      const t = -3 + rng() * 21;
      const side = rng() < 0.5 ? -1 : 1;
      const L = side * (28 + rng() * 75);
      const r1 = rng(), r2 = rng(), r3 = rng();
      if (side < 0 && t < 3.3 && L > -50) continue;             // beyond the wide left run-off
      if (side > 0 && t < 4.7 && r3 < 0.6) continue;           // sparse inside first corner
      if (side > 0 && t > 6.4 && t < 7.9 && L < 70) continue;   // grandstand A area
      if (side > 0 && t > 7.9 && L < 70) continue;              // open fence / grass outside the left corner
      const p = trackPt(t, L);
      if (!ok(p.x, p.z)) continue;
      trees.push([p.x, p.z, 3 + r1 * 2.5, 3 + r2 * 2]);
    }
    const tg = new THREE.CylinderGeometry(0.25, 0.4, 1, 6); tg.translate(0, 0.5, 0);
    const cg = new THREE.SphereGeometry(1, 10, 8);
    const trunks = new THREE.InstancedMesh(tg, lam(0x5a4632), trees.length);
    const crowns = new THREE.InstancedMesh(cg, lam(0xffffff), trees.length);
    const M = new THREE.Matrix4(), C = new THREE.Color();
    trees.forEach(([x, z, th, cr], i) => {
      M.makeScale(1, th, 1); M.setPosition(x, 0, z); trunks.setMatrixAt(i, M);
      M.makeScale(cr, cr * 1.15, cr); M.setPosition(x, th + cr * 0.8, z); crowns.setMatrixAt(i, M);
      C.setHex(0x4b7a33).offsetHSL(0, 0, (((i * 53) % 11) - 5) * 0.012);
      crowns.setColorAt(i, C);
    });
    scene.add(trunks, crowns);
  }

  // ---------------- ego car (Williams-blue proxy) ----------------
  const ego = new THREE.Group();
  scene.add(ego);
  const blue = lam(0x46488c);
  const carbon = lam(0x404045);
  function loft(sections, mat) {
    const P = [];
    const cor = (s) => [[-s.w / 2, s.yb, s.z], [s.w / 2, s.yb, s.z], [s.w / 2, s.yt, s.z], [-s.w / 2, s.yt, s.z]];
    const quad = (a, b, c, d) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); };
    for (let i = 0; i < sections.length - 1; i++) {
      const A = cor(sections[i]), B = cor(sections[i + 1]);
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; quad(A[k], A[k2], B[k2], B[k]); }
    }
    const f = cor(sections[0]), l = cor(sections[sections.length - 1]);
    quad(f[0], f[1], f[2], f[3]); quad(l[0], l[1], l[2], l[3]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  // chassis / nose (forward is -Z, driver eye at z = 0)
  ego.add(loft([
    { z: -0.95, w: 0.64, yt: 0.82, yb: 0.14 },
    { z: -1.15, w: 0.60, yt: 0.79, yb: 0.14 },
    { z: -1.70, w: 0.44, yt: 0.62, yb: 0.15 },
    { z: -2.50, w: 0.28, yt: 0.48, yb: 0.18 },
    { z: -3.35, w: 0.15, yt: 0.26, yb: 0.14 },
  ], blue));
  const navy = 0x34345a, navyDark = 0x2a2a40;
  box(0.74, 0.40, 1.5, 0x26262c, ego, 0, 0.30, -0.2);           // cockpit tub interior (legs / floor)
  box(1.10, 0.32, 0.58, navyDark, ego, 0, 0.69, -0.79);          // cockpit front cowl / dash
  box(0.08, 0.10, 1.4, navy, ego, -0.40, 0.75, -0.25);           // cockpit rims
  box(0.08, 0.10, 1.4, navy, ego, 0.40, 0.75, -0.25);
  box(0.46, 0.48, 2.2, navy, ego, -0.67, 0.48, 0.1);              // sidepods
  box(0.46, 0.48, 2.2, navy, ego, 0.67, 0.48, 0.1);
  box(0.50, 0.55, 2.0, navy, ego, 0, 0.62, 1.3);                  // engine cover
  box(2.05, 0.03, 0.30, 0x26272c, ego, 0, 0.12, -3.55);           // front wing
  box(1.45, 0.022, 0.05, 0x26272c, ego, 0, 0.45, -2.35);          // suspension arms
  box(1.0, 0.30, 0.10, 0x16171b, ego, 0, 0.90, 2.05);             // rear wing
  cyl(0.006, 0.006, 0.42, 0x222222, ego, 0, 0.69, -2.5, 4);       // antenna
  function makeWheel(r, w) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), carbon);
    tire.rotation.z = Math.PI / 2; g.add(tire);
    const redMat = lam(0xb8262b);
    [-1, 1].forEach((sd) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, 0.012, 6, 24), redMat);
      ring.rotation.y = Math.PI / 2; ring.position.x = sd * (w / 2 + 0.002); g.add(ring);
    });
    return g;
  }
  const frontL = makeWheel(0.36, 0.38); frontL.position.set(-0.88, 0.36, -2.35); ego.add(frontL);
  const frontR = makeWheel(0.36, 0.38); frontR.position.set(0.88, 0.36, -2.35); ego.add(frontR);
  const rearL = makeWheel(0.36, 0.45); rearL.position.set(-0.82, 0.36, 1.25); ego.add(rearL);
  const rearR = makeWheel(0.36, 0.45); rearR.position.set(0.82, 0.36, 1.25); ego.add(rearR);
  // halo (hoop + centre pillar); front of hoop raised so it reads as a flat band
  const haloMat = new THREE.MeshBasicMaterial({ color: 0x2c2c40 });
  {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.075, 8, 48), haloMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.scale.set(1, 1.1, 1);
    const hg = new THREE.Group();
    hg.add(hoop);
    hg.position.set(0, 1.13, -0.05); hg.rotation.x = 0.125;
    ego.add(hg);
    const a = new THREE.Vector3(0, 1.16, -0.60), b = new THREE.Vector3(0, 0.88, -1.02);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, a.distanceTo(b), 8), haloMat);
    p.position.copy(a).add(b).multiplyScalar(0.5);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    ego.add(p);
  }
  // mirror pods
  box(0.335, 0.16, 0.10, 0x4a4a52, ego, -0.458, 0.86, -0.75);
  box(0.335, 0.16, 0.10, 0x4a4a52, ego, 0.458, 0.86, -0.75);
  // steering column + wheel (articulated) + gloves
  const column = new THREE.Group();
  column.position.set(0, 0.765, -0.45); column.rotation.x = 0.2;
  ego.add(column);
  const wheelRot = new THREE.Group();
  column.add(wheelRot);
  box(0.27, 0.18, 0.035, 0x5a5c64, wheelRot, 0, 0.03, 0);
  box(0.05, 0.15, 0.06, 0x44464d, wheelRot, -0.145, -0.01, 0);
  box(0.05, 0.15, 0.06, 0x44464d, wheelRot, 0.145, -0.01, 0);
  box(0.24, 0.012, 0.02, 0x8e929a, wheelRot, 0, 0.115, 0.01);     // light top bar of the wheel
  box(0.10, 0.06, 0.012, 0x10141c, wheelRot, 0, 0.075, 0.022);    // dash display
  const gloveCol = 0x3c4180;
  box(0.10, 0.125, 0.10, gloveCol, wheelRot, -0.155, -0.01, 0.04);
  box(0.10, 0.125, 0.10, gloveCol, wheelRot, 0.155, -0.01, 0.04);
  const gripL = new THREE.Vector3(-0.155, -0.04, 0.05), gripR = new THREE.Vector3(0.155, -0.04, 0.05);
  const elbowL = new THREE.Vector3(-0.27, 0.50, -0.12), elbowR = new THREE.Vector3(0.27, 0.50, -0.12);
  const armMat = lam(0x36396c);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 1, 10), armMat);
  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 1, 10), armMat);
  ego.add(armL, armR);
  const UP = new THREE.Vector3(0, 1, 0), tmpA = new THREE.Vector3(), tmpD = new THREE.Vector3();
  function setLimb(mesh, a, b) {
    tmpD.copy(b).sub(a);
    const len = tmpD.length();
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(UP, tmpD.normalize());
  }

  // ---------------- rival car (dark proxy) ----------------
  const opp = new THREE.Group();
  scene.add(opp);
  {
    const dark = 0x3a3e46;
    box(0.85, 0.55, 4.6, dark, opp, 0, 0.45, 0);
    box(1.5, 0.45, 1.8, dark, opp, 0, 0.40, 0.4);
    box(0.4, 0.45, 1.4, 0x3a4048, opp, 0, 0.85, 0.8);
    box(1.9, 0.06, 0.45, 0x15171a, opp, 0, 0.12, -2.75);
    box(1.0, 0.32, 0.12, 0x15171a, opp, 0, 0.85, 2.4);
    [[-0.8, -1.8, 0.38], [0.8, -1.8, 0.38], [-0.8, 1.8, 0.45], [0.8, 1.8, 0.45]].forEach(([x, z, w]) => {
      const wh = makeWheel(0.36, w); wh.position.set(x, 0.36, z); opp.add(wh);
    });
  }

  // ---------------- camera ----------------
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 6000);
  camera.rotation.order = 'YXZ';
  const CAM1 = { pos: new THREE.Vector3(0, 1.03, -1.1), pitch: -3.6 * D2R, fov: 60 };
  const CAM2 = { pos: new THREE.Vector3(0, 0.92, 0.0), pitch: 0.6 * D2R, fov: 60 };
  // driver head motion relative to the car in the cockpit shot: [t, forward m, down m, pitch deg]
  // driver head motion relative to the car in the cockpit shot: [t, forward m, down m, pitch deg]
  const HEAD = [[3.0, 0, 0, 0], [6.5, 0, 0, 0], [6.96, 0, 0.032, 0], [7.82, 0, 0.008, 0],
    [8.69, 0, -0.003, 0], [9.56, 0, -0.024, 0], [10.1, 0, -0.02, 0]];
  // whole-car pitch (deg, nose down positive): braking dive and corner attitude
  const CARPITCH = [[-4, 0], [6.5, 0], [6.96, 1.0], [7.82, 1.8], [8.69, 1.6], [9.56, 0.4], [10.1, 0.2]];
  const headK = (k, t) => lin(HEAD.map((r) => [r[0], r[k]]), t);
  const camLocal = new THREE.Vector3();

  function update(time, frame) {
    const t = time;
    const e = egoAt(t);
    ego.position.set(e.x, 0, e.z);
    const carPitch = lin(CARPITCH, t) * D2R; // nose-down positive
    ego.rotation.set(-carPitch, -e.psi, 0, 'YXZ');

    const st = lin(STEER, t) * D2R;
    wheelRot.rotation.set(0, 0, st);
    frontL.rotation.set(0, st / 10, 0);
    frontR.rotation.set(0, st / 10, 0);
    column.updateMatrix(); wheelRot.updateMatrix();
    tmpA.copy(gripL).applyMatrix4(wheelRot.matrix).applyMatrix4(column.matrix);
    setLimb(armL, tmpA.clone(), elbowL);
    tmpA.copy(gripR).applyMatrix4(wheelRot.matrix).applyMatrix4(column.matrix);
    setLimb(armR, tmpA.clone(), elbowR);

    const o = egoAt(t + lin(TAU, t));
    opp.position.set(o.x, 0, o.z);
    opp.rotation.set(0, -o.psi, 0);

    const c = t < TCUT ? CAM1 : CAM2;
    camLocal.copy(c.pos);
    let pitch = c.pitch;
    if (c === CAM2) {
      camLocal.z -= headK(1, t);
      camLocal.y -= headK(2, t);
      pitch += headK(3, t) * D2R;
    }
    pitch -= carPitch; // camera is rigidly attached to the pitching car
    ego.updateMatrixWorld(true);
    camera.position.copy(camLocal).applyMatrix4(ego.matrixWorld);
    camera.rotation.set(pitch, -e.psi, 0, 'YXZ');
    camera.fov = c.fov;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
  }

  update(0, 0);
  return { scene, camera, update };
}
