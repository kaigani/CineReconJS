// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video26.
// Open-wheel race replay: blue hero car through five TV-camera shots.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const V3 = THREE.Vector3;
  const aspect = width / height;
  const DEG = Math.PI / 180;
  const CAR_L = 4.5, CAR_W = 2.0, AIM_H = 0.45;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaab6c2);
  const camera = new THREE.PerspectiveCamera(20, aspect, 1, 4000);

  scene.add(new THREE.HemisphereLight(0xe8eef5, 0x56613f, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.25);
  sun.position.set(-300, 600, 250);
  scene.add(sun);

  // ---------- materials / helpers ----------
  const matCache = new Map();
  function mat(color) {
    if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return matCache.get(color);
  }
  function box(w, h, d, color, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function interpKeys(keys, t, k = 1) {
    const n = keys.length;
    if (n === 1 || t <= keys[0][0]) return keys[0][k];
    if (t >= keys[n - 1][0]) return keys[n - 1][k];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const slope = (j) => {
      if (j <= 0) return (keys[1][k] - keys[0][k]) / (keys[1][0] - keys[0][0]);
      if (j >= n - 1) return (keys[n - 1][k] - keys[n - 2][k]) / (keys[n - 1][0] - keys[n - 2][0]);
      return (keys[j + 1][k] - keys[j - 1][k]) / (keys[j + 1][0] - keys[j - 1][0]);
    };
    const t0 = keys[i][0], t1 = keys[i + 1][0], h = t1 - t0, u = (t - t0) / h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * keys[i][k] + (u3 - 2 * u2 + u) * h * slope(i) +
      (-2 * u3 + 3 * u2) * keys[i + 1][k] + (u3 - u2) * h * slope(i + 1);
  }

  // ---------- car proxy ----------
  function makeCar(c) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    box(1.3, 0.05, 2.9, 0x1a1a1a, 0, 0.07, -0.2, body); // floor
    box(0.78, 0.5, 1.5, c.body, 0, 0.42, 0.15, body); // tub / cockpit
    box(0.36, 0.28, 1.4, c.body, 0, 0.38, 1.55, body); // nose
    if (c.stripe) box(0.1, 0.02, 1.4, c.stripe, 0, 0.53, 1.55, body);
    box(1.45, 0.42, 1.5, c.side, 0, 0.32, -0.35, body); // sidepods
    if (c.sideStripe) box(1.47, 0.1, 1.5, c.sideStripe, 0, 0.16, -0.35, body);
    box(0.5, 0.42, 1.5, c.cover, 0, 0.78, -0.75, body); // engine cover / airbox
    box(0.3, 0.22, 0.9, c.cover, 0, 0.55, -1.7, body); // gearbox
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(c.helmet));
    helmet.position.set(0, 0.82, 0.38);
    body.add(helmet);
    box(1.85, 0.05, 0.42, c.fwing, 0, 0.12, 2.02, body); // front wing
    box(0.05, 0.22, 0.5, c.fwingEnd, 0.93, 0.18, 2.0, body);
    box(0.05, 0.22, 0.5, c.fwingEnd, -0.93, 0.18, 2.0, body);
    box(0.05, 0.62, 0.7, c.rwingEnd, 0.5, 0.72, -2.0, body); // rear wing endplates
    box(0.05, 0.62, 0.7, c.rwingEnd, -0.5, 0.72, -2.0, body);
    box(0.96, 0.28, 0.3, c.rwing, 0, 0.92, -2.0, body); // rear wing element
    const wheels = [];
    function wheel(r, w, x, z, front) {
      const steer = new THREE.Group();
      steer.position.set(x, r, z);
      root.add(steer);
      const spin = new THREE.Group();
      steer.add(spin);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), mat(0x161616));
      tyre.rotation.z = Math.PI / 2;
      spin.add(tyre);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 14), mat(0x3a3a3a));
      hub.rotation.z = Math.PI / 2;
      spin.add(hub);
      box(w + 0.04, 0.05, r * 1.0, 0x9a9a9a, 0, 0, 0, spin);
      wheels.push({ steer, spin, r, front });
    }
    wheel(0.33, 0.3, 0.8, 1.4, true);
    wheel(0.33, 0.3, -0.8, 1.4, true);
    wheel(0.34, 0.4, 0.78, -1.3, false);
    wheel(0.34, 0.4, -0.78, -1.3, false);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    root.add(shadow);
    scene.add(root);
    return { root, wheels };
  }

  const cars = {
    blue: makeCar({ body: 0x2346b0, side: 0x2346b0, sideStripe: 0xf0f2f5, cover: 0x2a52c4, fwing: 0xf0f2f5, fwingEnd: 0x2346b0, rwing: 0xf0f2f5, rwingEnd: 0x2346b0, helmet: 0xf2f2f2 }),
    red: makeCar({ body: 0xcc1a14, side: 0xcc1a14, stripe: 0xf0c419, cover: 0xcc1a14, fwing: 0xcc1a14, fwingEnd: 0x222222, rwing: 0xcc1a14, rwingEnd: 0x222222, helmet: 0x303030 }),
    yA: makeCar({ body: 0x3060c8, side: 0x3060c8, sideStripe: 0xe8d020, cover: 0x3060c8, fwing: 0x3a7ae0, fwingEnd: 0x3060c8, rwing: 0xe8d020, rwingEnd: 0x222222, helmet: 0xe8d020 }),
    yB: makeCar({ body: 0x3060c8, side: 0x3060c8, sideStripe: 0xe8d020, cover: 0x3060c8, fwing: 0x3a7ae0, fwingEnd: 0x3060c8, rwing: 0xe8d020, rwingEnd: 0x222222, helmet: 0xe8d020 }),
    yC: makeCar({ body: 0x3060c8, side: 0x3060c8, sideStripe: 0xe8d020, cover: 0x3060c8, fwing: 0x3a7ae0, fwingEnd: 0x3060c8, rwing: 0xe8d020, rwingEnd: 0x222222, helmet: 0xe8d020 }),
  };

  // ---------- ground ----------
  function overlayMat(color, level, vertexColors) {
    return new THREE.MeshLambertMaterial({
      color: vertexColors ? 0xffffff : color, vertexColors: !!vertexColors, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2 * level, polygonOffsetUnits: -4 * level,
    });
  }

  // ---------- shot definitions (camera fixed per shot, car path integrated) ----------
  const SHOTS = [
    {
      t0: 0, t1: 1.2, ox: 0, h: 8.8, tRef: 0, d: 38, phi: 0, v: 14, extB: 5, extA: 5, near: 4,
      alpha: [[0, 2], [0.467, 25], [0.933, 52], [1.2, 62]],
      scr: [[0, 478, 325], [0.467, 467, 320], [0.933, 450, 310], [1.2, 445, 308]],
      frac: [[0, 0.219], [0.467, 0.29], [0.933, 0.368], [1.2, 0.39]],
      track: { left: 3.0, right: 9.0, kerb: 'L', kerbW: 1.5, paintW: 0 },
      cars: [['blue', 0, 0], ['red', 12, 0]],
    },
    {
      t0: 1.2, t1: 2.6, ox: 3000, h: 12, tRef: 1.9, d: 28, phi: 0, v: 14, extB: 5, extA: 5, near: 3,
      alpha: [[1.2, 62], [1.433, 70], [1.9, 90], [2.367, 110], [2.6, 116]],
      scr: [[1.433, 440, 310], [1.9, 430, 305], [2.367, 440, 300]],
      frac: [[1.433, 0.447], [1.9, 0.451], [2.367, 0.411]],
      track: { left: 10.0, right: 2.6, kerb: 'R', kerbW: 1.5, paintW: 0 },
      cars: [['blue', 0, 0]],
    },
    {
      t0: 2.6, t1: 4.9667, ox: 6000, h: 14, tRef: 3.767, d: 60, phi: 0, v: 14, extB: 5, extA: 5, near: 4,
      alpha: [[2.6, 118], [2.833, 125], [3.3, 150], [3.767, 178], [4.267, 175], [4.733, 158], [4.97, 150]],
      scr: [[2.833, 455, 295], [3.3, 462, 290], [3.767, 475, 290], [4.267, 480, 290], [4.733, 455, 282]],
      frac: [[2.833, 0.342], [3.3, 0.245], [3.767, 0.193], [4.267, 0.184], [4.733, 0.201]],
      track: { left: 4.0, right: 8.0, kerb: 'L', kerbW: 1.3, paintW: 3.0 },
      cars: [['blue', 0, 0]],
    },
    {
      t0: 4.9667, t1: 7.8, ox: 9000, h: 11, tRef: 7.567, d: 90, phi: 0,
      v: [[4.9, 30], [6.1, 24], [7.6, 22]], extB: 10, extA: 4, near: 4,
      alpha: [[4.95, 60], [5.2, 55], [5.667, 35], [6.133, 12], [6.6, 2], [7.1, -6], [7.567, -12], [7.8, -14]],
      scr: [[5.2, 480, 285], [5.667, 482, 282], [6.133, 483, 283], [6.6, 478, 285], [7.1, 470, 290], [7.567, 472, 290]],
      frac: [[5.2, 0.158], [5.667, 0.149], [6.133, 0.141], [6.6, 0.135], [7.1, 0.165], [7.567, 0.203]],
      track: { left: 11.0, right: 1.3, kerb: 'R', kerbW: 1.6, paintW: 2.5 },
      cars: [['blue', 0, 0], ['red', 24, 0], ['yC', 50, 1.5]],
    },
    {
      t0: 7.8, t1: 11.0, ox: 12000, h: 2.4, tRef: 9.933, d: 10, phi: 0, v: 13.5, extB: 5, extA: 5, near: 1, preTurn: -9,
      hKeys: [[7.8, 5.0], [8.5, 4.2], [9.0, 3.2], [9.5, 2.4], [9.933, 2.0], [10.4, 2.2], [10.867, 3.0]],
      alpha: [[8.033, -20], [8.5, -30], [8.967, -41], [9.433, -55], [9.933, -90], [10.4, -118], [10.867, -140], [10.95, -142]],
      scr: [[8.033, 478, 295], [8.5, 478, 305], [8.967, 470, 335], [9.433, 490, 340], [9.933, 390, 370], [10.4, 510, 350], [10.867, 480, 310]],
      frac: [[8.033, 0.26], [8.5, 0.355], [8.967, 0.523], [9.433, 0.89], [9.933, 1.2], [10.4, 0.91], [10.867, 0.44]],
      track: { left: 6.0, right: 4.0, kerb: 'L', kerbW: 1.3, paintW: 0, kerbFromT: 9.6 },
      cars: [['blue', 0, 0]],
    },
  ];

  // ---------- deterministic path integration ----------
  function integrate(cfg) {
    const dt = 1 / 240;
    const tA = cfg.t0 - cfg.extB, tB = cfg.t1 + cfg.extA;
    const kA = cfg.alpha[0][0], kB = cfg.alpha[cfg.alpha.length - 1][0];
    const nB = Math.ceil((cfg.tRef - tA) / dt), nF = Math.ceil((tB - cfg.tRef) / dt);
    const N = nB + nF + 1;
    const X = new Float64Array(N), Z = new Float64Array(N), P = new Float64Array(N), S = new Float64Array(N);
    const vAt = (t) => (Array.isArray(cfg.v) ? interpKeys(cfg.v, t) : cfg.v);
    const unwrap = (p, ref) => { while (p - ref > Math.PI) p -= 2 * Math.PI; while (p - ref < -Math.PI) p += 2 * Math.PI; return p; };
    const psiFor = (x, z, t, ref) => unwrap(Math.atan2(x, z) + Math.PI - interpKeys(cfg.alpha, t) * DEG, ref);
    const inR = (t) => t >= kA && t <= kB;
    X[nB] = cfg.d * Math.sin(cfg.phi * DEG);
    Z[nB] = cfg.d * Math.cos(cfg.phi * DEG);
    P[nB] = psiFor(X[nB], Z[nB], cfg.tRef, Math.PI);
    for (let i = nB + 1; i < N; i++) {
      const t = cfg.tRef + (i - 1 - nB) * dt;
      const psi = inR(t) ? psiFor(X[i - 1], Z[i - 1], t, P[i - 1]) : P[i - 1];
      const v = vAt(t);
      X[i] = X[i - 1] + v * Math.sin(psi) * dt;
      Z[i] = Z[i - 1] + v * Math.cos(psi) * dt;
      P[i] = inR(t + dt) ? psiFor(X[i], Z[i], t + dt, psi) : psi;
    }
    for (let i = nB - 1; i >= 0; i--) {
      const t = cfg.tRef + (i + 1 - nB) * dt;
      const psi = inR(t) ? psiFor(X[i + 1], Z[i + 1], t, P[i + 1]) : P[i + 1] + (cfg.preTurn || 0) * DEG * dt;
      const v = vAt(t);
      X[i] = X[i + 1] - v * Math.sin(psi) * dt;
      Z[i] = Z[i + 1] - v * Math.cos(psi) * dt;
      P[i] = inR(t - dt) ? psiFor(X[i], Z[i], t - dt, psi) : psi;
    }
    S[0] = 0;
    for (let i = 1; i < N; i++) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
    return { X, Z, P, S, N, nB, dt, tRef: cfg.tRef };
  }

  function sampleT(path, t) {
    let f = (t - path.tRef) / path.dt + path.nB;
    f = Math.max(0, Math.min(path.N - 1.000001, f));
    const i = Math.floor(f), u = f - i;
    const L = (A) => A[i] + (A[i + 1] - A[i]) * u;
    return { x: L(path.X), z: L(path.Z), psi: L(path.P), s: L(path.S) };
  }
  function sampleS(path, s) {
    const S = path.S;
    if (s <= S[0]) {
      const p = path.P[0];
      const back = S[0] - s;
      return { x: path.X[0] - Math.sin(p) * back, z: path.Z[0] - Math.cos(p) * back, psi: p, s };
    }
    if (s >= S[path.N - 1]) {
      const j = path.N - 1, p = path.P[j], fw = s - S[j];
      return { x: path.X[j] + Math.sin(p) * fw, z: path.Z[j] + Math.cos(p) * fw, psi: p, s };
    }
    let lo = 0, hi = path.N - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const u = (s - S[lo]) / Math.max(1e-9, S[hi] - S[lo]);
    return { x: path.X[lo] + (path.X[hi] - path.X[lo]) * u, z: path.Z[lo] + (path.Z[hi] - path.Z[lo]) * u, psi: path.P[lo] + (path.P[hi] - path.P[lo]) * u, s };
  }

  for (const sh of SHOTS) sh.path = integrate(sh);

  // ---------- camera rig ----------
  function applyCam(cam, sh, t) {
    const st = sampleT(sh.path, t);
    const C = new V3(sh.ox, sh.hKeys ? interpKeys(sh.hKeys, t) : sh.h, 0);
    const B = new V3(sh.ox + st.x, AIM_H, st.z);
    const R = C.distanceTo(B);
    const a = Math.atan2(st.x, st.z) + Math.PI - st.psi;
    const X = CAR_L * Math.abs(Math.sin(a)) + CAR_W * Math.abs(Math.cos(a));
    const frac = interpKeys(sh.frac, t);
    const K = X / (R * frac);
    const tanV = K / (2 * aspect);
    cam.fov = 2 * Math.atan(tanV) / DEG;
    cam.aspect = aspect;
    cam.near = sh.near;
    cam.far = 4000;
    cam.position.copy(C);
    cam.up.set(0, 1, 0);
    cam.lookAt(B);
    const sx = interpKeys(sh.scr, t, 1), sy = interpKeys(sh.scr, t, 2);
    const nx = sx / 480 - 1, ny = 1 - sy / 270;
    cam.rotateY(Math.atan(nx * K / 2));
    cam.rotateX(Math.atan(-ny * tanV));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }

  const tmpCam = new THREE.PerspectiveCamera(20, aspect, 0.5, 4000);
  function pixelRay(sh, t, sx, sy) {
    applyCam(tmpCam, sh, t);
    const p = new V3(sx / 480 - 1, 1 - sy / 270, 0.5).unproject(tmpCam);
    const dir = p.sub(tmpCam.position).normalize();
    return { C: tmpCam.position.clone(), dir };
  }
  function groundPoint(sh, t, sx, sy) {
    const { C, dir } = pixelRay(sh, t, sx, sy);
    if (dir.y > -1e-4) dir.y = -1e-4;
    const s = -C.y / dir.y;
    return C.clone().addScaledVector(dir, s).setY(0);
  }
  function heightAt(sh, t, base, sx, syTop) {
    const { C, dir } = pixelRay(sh, t, sx, syTop);
    const hb = Math.hypot(base.x - C.x, base.z - C.z);
    const hd = Math.hypot(dir.x, dir.z);
    return C.y + (hb / hd) * dir.y;
  }
  function pxToM(sh, t, point, px) {
    applyCam(tmpCam, sh, t);
    const R = tmpCam.position.distanceTo(point);
    const K = 2 * Math.tan(tmpCam.fov * DEG / 2) * aspect;
    return (px / 960) * K * R;
  }

  // ---------- track geometry ----------
  function levelOf(y) { return y >= 0.07 ? 3 : y >= 0.05 ? 2 : 1; }
  function stripMesh(sh, a, b, y, color, ds = 0.75) {
    const path = sh.path, s0 = path.S[0], s1 = path.S[path.N - 1];
    const n = Math.max(2, Math.ceil((s1 - s0) / ds) + 1);
    const pos = [], idx = [];
    for (let k = 0; k < n; k++) {
      const st = sampleS(path, s0 + (s1 - s0) * k / (n - 1));
      const lx = Math.cos(st.psi), lz = -Math.sin(st.psi);
      pos.push(sh.ox + st.x + a * lx, y, st.z + a * lz, sh.ox + st.x + b * lx, y, st.z + b * lz);
      if (k > 0) { const q = 2 * (k - 1); idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, overlayMat(color, levelOf(y)));
  }
  function stripedMesh(sh, a, b, y, cA, cB, len) {
    const path = sh.path, s1 = path.S[path.N - 1];
    const s0 = sh.track.kerbFromT !== undefined ? sampleT(path, sh.track.kerbFromT).s : path.S[0];
    const pos = [], col = [];
    const A = new THREE.Color(cA), Bc = new THREE.Color(cB);
    let k = 0;
    for (let s = s0; s < s1; s += len, k++) {
      const p0 = sampleS(path, s), p1 = sampleS(path, Math.min(s1, s + len));
      const c = k % 2 ? A : Bc;
      const q = (st, o) => [sh.ox + st.x + o * Math.cos(st.psi), y, st.z - o * Math.sin(st.psi)];
      const v00 = q(p0, a), v01 = q(p0, b), v10 = q(p1, a), v11 = q(p1, b);
      pos.push(...v00, ...v10, ...v01, ...v01, ...v10, ...v11);
      for (let r = 0; r < 6; r++) col.push(c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, overlayMat(0xffffff, levelOf(y), true));
  }
  // vertical ribbon wall following the path at lateral offset `lat`, between arc lengths sA..sB
  function pathWall(sh, lat, sA, sB, y0, y1, color) {
    const path = sh.path;
    const n = Math.max(2, Math.ceil((sB - sA) / 1.0) + 1);
    const pos = [], idx = [];
    for (let k = 0; k < n; k++) {
      const st = sampleS(path, sA + (sB - sA) * k / (n - 1));
      const x = sh.ox + st.x + lat * Math.cos(st.psi), z = st.z - lat * Math.sin(st.psi);
      pos.push(x, y0, z, x, y1, z);
      if (k > 0) { const q = 2 * (k - 1); idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  }

  function addBox(group, p, w, h, d, color, yaw) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(p.x, p.y + h / 2, p.z);
    m.rotation.y = yaw;
    group.add(m);
    return m;
  }
  function facingYaw(sh, p) { return Math.atan2(sh.ox - p.x, 0 - p.z); }
  function wallAlong(group, A, Bp, ext, h, y0, color) {
    const dx = Bp.x - A.x, dz = Bp.z - A.z, L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    const len = L + 2 * ext;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.4), mat(color));
    m.position.set((A.x + Bp.x) / 2, y0 + h / 2, (A.z + Bp.z) / 2);
    m.rotation.y = Math.atan2(-uz, ux);
    group.add(m);
    return m;
  }

  const signMat = new THREE.MeshBasicMaterial({ color: 0xe4e6e8 });
  function addSign(group, p, w, h, yaw) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), signMat);
    m.position.set(p.x, p.y + h / 2, p.z);
    m.rotation.y = yaw;
    group.add(m);
  }
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5f8a3a });
  const envGroups = SHOTS.map((sh) => {
    const g = new THREE.Group();
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800, 36, 36), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(sh.ox, 0, 0);
    g.add(grass);
    const tr = sh.track;
    g.add(stripMesh(sh, -tr.right, tr.left, 0.03, 0x6c6c6e));
    g.add(stripMesh(sh, tr.left - 0.3, tr.left, 0.08, 0xeeeeee));
    g.add(stripMesh(sh, -tr.right, -tr.right + 0.3, 0.08, 0xeeeeee));
    if (tr.kerb === 'L') {
      g.add(stripedMesh(sh, tr.left, tr.left + tr.kerbW, 0.06, 0x4a7fb5, 0xe9eef2, 1.0));
      if (tr.paintW) g.add(stripMesh(sh, tr.left + tr.kerbW, tr.left + tr.kerbW + tr.paintW, 0.03, 0x62b97e));
    } else if (tr.kerb === 'R') {
      g.add(stripedMesh(sh, -tr.right - tr.kerbW, -tr.right, 0.06, 0x4a7fb5, 0xe9eef2, 1.0));
      if (tr.paintW) g.add(stripMesh(sh, -tr.right - tr.kerbW - tr.paintW, -tr.right - tr.kerbW, 0.03, 0x62b97e));
    }
    scene.add(g);
    return g;
  });
  const sAt = (sh, t) => sampleT(sh.path, t).s;

  // Shot 1: grey-blue trackside board (top right of frame 0)
  {
    const sh = SHOTS[0];
    const p = groundPoint(sh, 0, 928, 112);
    const w = pxToM(sh, 0, p, 70);
    addBox(envGroups[0], p, w, w, 0.3, 0x8ea4bc, facingYaw(sh, p));
  }
  // Shot 2: low orange rail behind the far (right-side) kerb
  {
    const sh = SHOTS[1];
    envGroups[1].add(pathWall(sh, -(sh.track.right + sh.track.kerbW + 0.8), sAt(sh, 1.6), sAt(sh, 4.5), 0, 0.35, 0xd8782e));
  }
  // Shot 4: FANATEC wall (black lower wall, fence, black banner), Reiza board, two cars ahead
  const nearCars = [];
  {
    const sh = SHOTS[3], t = 6.133;
    const A = groundPoint(sh, t, 140, 200), Bp = groundPoint(sh, t, 960, 196);
    const hLow = heightAt(sh, t, A, 140, 125);
    const hFence = heightAt(sh, t, A, 140, 18);
    const g = envGroups[3];
    wallAlong(g, A, Bp, 500, hLow, 0, 0x16191f);
    wallAlong(g, A, Bp, 500, hLow * 2.0, hLow, 0xc6cacf);
    wallAlong(g, A, Bp, 500, hLow * 1.6, hLow * 3.0, 0x16191f);
    const sp = groundPoint(sh, 6.6, 425, 530);
    const sw = pxToM(sh, 6.6, sp, 118), shh = pxToM(sh, 6.6, sp, 75);
    addSign(g, sp, sw, shh, facingYaw(sh, sp));
    const tK = 5.667;
    for (const [key, sx, sy] of [['yA', 300, 520], ['yB', 495, 548]]) {
      const p = groundPoint(sh, tK, sx, sy);
      const toCam = Math.atan2(sh.ox - p.x, -p.z);
      nearCars.push({ key, p, psi: toCam - 8 * DEG, v: 30, tK });
    }
  }
  // Shot 5: white striped barrier on far (left) side, trackside board
  {
    const sh = SHOTS[4];
    const g = envGroups[4];
    const lat = sh.track.left + sh.track.kerbW + 10;
    const sA = sAt(sh, 8.6), sB = sAt(sh, 15.8);
    g.add(pathWall(sh, lat, sA, sB, 0, 2.6, 0xe6e8ea));
    for (const f of [0.2, 0.4, 0.6, 0.8]) g.add(pathWall(sh, lat - 0.08, sA, sB, 2.6 * f, 2.6 * f + 0.12, 0x80868e));
    g.add(pathWall(sh, lat + 0.3, sA, sB, 2.6, 7.0, 0xaab3ad));
  }

  // ---------- update ----------
  const CUTS = [1.2, 2.6, 4.9667, 7.8];
  function shotIndex(t) {
    let i = 0;
    while (i < CUTS.length && t >= CUTS[i] - 1e-4) i++;
    return i;
  }
  function poseCar(car, x, z, psi, s, steer) {
    car.root.visible = true;
    car.root.position.set(x, 0, z);
    car.root.rotation.set(0, psi, 0);
    for (const w of car.wheels) {
      w.spin.rotation.x = s / w.r;
      w.steer.rotation.y = w.front ? steer : 0;
    }
  }

  function update(time, frame) {
    const t = time;
    const si = shotIndex(t);
    const sh = SHOTS[si];
    envGroups.forEach((g, i) => { g.visible = i === si; });
    for (const k in cars) cars[k].root.visible = false;
    const st = sampleT(sh.path, t);
    for (const [key, gap, lat] of sh.cars) {
      const q = sampleS(sh.path, st.s - gap);
      const qa = sampleS(sh.path, st.s - gap - 0.5), qb = sampleS(sh.path, st.s - gap + 0.5);
      const curv = (qb.psi - qa.psi) / 1.0;
      const steer = Math.max(-0.35, Math.min(0.35, Math.atan(2.7 * curv)));
      const lx = Math.cos(q.psi), lz = -Math.sin(q.psi);
      poseCar(cars[key], sh.ox + q.x + lat * lx, q.z + lat * lz, q.psi, q.s, steer);
    }
    if (si === 3 && t > 5.4 && t < 6.0) {
      for (const nc of nearCars) {
        const d = nc.v * (t - nc.tK);
        poseCar(cars[nc.key], nc.p.x + Math.sin(nc.psi) * d, nc.p.z + Math.cos(nc.psi) * d, nc.psi, d + 50, 0);
      }
    }
    applyCam(camera, sh, t);
  }

  update(0, 0);
  return { scene, camera, update };
}
