// CineRecon L1 proxy reconstruction - video25 (dusk circuit chase-cam: yellow car following a white car)
// Three.js sampled-frame baseline. All geometry procedural, deterministic, absolute-time sampled.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 9000);
  camera.rotation.order = 'YXZ';

  // ---------- seeded RNG (build-time only) ----------
  let rs = ((seed | 0) ^ 0x2545f491) >>> 0;
  function rand() {
    rs = (rs + 0x6d2b79f5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rand();

  // ---------- keyframe helpers ----------
  function lin(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * u;
  }
  function cr(keys, t) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const t0 = keys[i][0], t1 = keys[i + 1][0], p0 = keys[i][1], p1 = keys[i + 1][1];
    const h = t1 - t0, u = (t - t0) / h;
    const m0 = i > 0 ? (p1 - keys[i - 1][1]) / (t1 - keys[i - 1][0]) : (p1 - p0) / h;
    const m1 = i < n - 2 ? (keys[i + 2][1] - p0) / (keys[i + 2][0] - t0) : (p1 - p0) / h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
  }

  // ---------- timeline (reference seconds) ----------
  // speed of the yellow car along the track centreline (m/s)
  const SPEED = [[-10, 56], [0, 56], [2.6, 58], [3.6, 32], [4.6, 30], [5.6, 38], [7, 47], [9, 54], [11, 58],
    [12.6, 59], [13.6, 40], [14.6, 28], [15.6, 20], [16.7, 17], [17.7, 20], [19, 28], [21, 37], [24, 44], [30, 50], [80, 50]];
  // yaw rate of the track centreline as travelled (deg/s, + = right turn)
  const YAWR = [[-10, 0], [3.3, 0], [3.8, 30], [4.7, 30], [5.3, 10], [6.5, 6], [7.5, 2], [8.5, 0], [9.8, 0],
    [10.4, -10], [12.0, -12], [12.9, -4], [13.3, 0], [14.0, 8], [15.0, 20], [15.6, 35], [16.2, 55], [17.2, 50],
    [18.0, 35], [18.8, 15], [19.6, 4], [20.2, 0], [80, 0]];
  // yellow car lateral offset from centreline (m, + = right)
  const LATY = [[-10, -5], [0, -5], [1.0, -5.5], [2.1, -5.5], [3.1, -4.5], [4.0, 1], [4.5, 4.6], [5.0, 5], [5.5, 4],
    [6.2, 4.5], [7.3, -1.5], [8.3, 0], [9.4, 0.5], [10.4, 1], [11.5, -3.5], [12.5, -5], [13.5, -5.5], [14.6, -5],
    [15.6, -2], [16.7, 1.8], [17.7, 1.0], [18.7, -4], [19.8, -5.6], [20.9, -5.8], [21.9, -5.2], [22.9, -4.2], [24, -4], [80, -4]];
  // yellow car body slip (rad, + = nose further into the right turn)
  const DRIFT = [[-10, 0], [15.8, 0], [16.7, 0.12], [17.7, 0.12], [18.5, 0], [80, 0]];
  // white car arclength lead over yellow car (m)
  const GAP = [[-10, 112], [0, 112], [3.1, 100], [6.2, 92], [8.3, 85], [9.4, 76], [10.4, 64], [11.5, 50], [12.5, 42],
    [13.5, 33], [14.6, 26], [15.6, 13], [16.7, 8.5], [17.7, 8.5], [18.7, 22], [19.8, 32], [20.9, 40], [21.9, 46],
    [22.9, 48], [24, 48], [30, 55], [80, 60]];
  // white car lateral offset (m)
  const LATW = [[-10, -1], [0, -1], [3.1, -3], [4.2, 4], [5.2, 3], [6.2, 2], [8.3, 0], [10.4, -1], [11.5, -2.5],
    [12.5, -3.5], [13.5, -3], [14.6, -2], [15.6, 1.5], [16.7, 5.2], [17.7, 5.2], [18.7, 2], [19.8, -2], [20.9, -4],
    [21.9, -4], [22.9, -4], [24, -4], [80, -4]];
  // yellow third brake light
  const BRAKE_ON = [12.9, 15.9];

  // ---------- precomputed centreline (deterministic integration) ----------
  const DT = 1 / 240, T0 = -10, T1 = 50;
  const N = Math.round((T1 - T0) / DT) + 1;
  const SS = new Float64Array(N), XS = new Float64Array(N), ZS = new Float64Array(N), HS = new Float64Array(N);
  const i0 = Math.round(-T0 / DT);
  for (let i = i0; i < N - 1; i++) {
    const tm = T0 + (i + 0.5) * DT;
    const v = lin(SPEED, tm), w = lin(YAWR, tm) * D2R;
    const h1 = HS[i] + w * DT, ha = (HS[i] + h1) / 2;
    SS[i + 1] = SS[i] + v * DT;
    XS[i + 1] = XS[i] + v * DT * Math.sin(ha);
    ZS[i + 1] = ZS[i] - v * DT * Math.cos(ha);
    HS[i + 1] = h1;
  }
  for (let i = i0; i > 0; i--) {
    const tm = T0 + (i - 0.5) * DT;
    const v = lin(SPEED, tm), w = lin(YAWR, tm) * D2R;
    const h0 = HS[i] - w * DT, ha = (HS[i] + h0) / 2;
    SS[i - 1] = SS[i] - v * DT;
    XS[i - 1] = XS[i] - v * DT * Math.sin(ha);
    ZS[i - 1] = ZS[i] + v * DT * Math.cos(ha);
    HS[i - 1] = h0;
  }
  function sampleT(arr, t) {
    let f = (t - T0) / DT;
    if (f < 0) f = 0;
    if (f > N - 1) f = N - 1;
    const i = Math.min(N - 2, Math.floor(f));
    const u = f - i;
    return arr[i] * (1 - u) + arr[i + 1] * u;
  }
  const sT = (t) => sampleT(SS, t);
  function centerAtS(s) {
    if (s <= SS[0]) {
      const d = s - SS[0], h = HS[0];
      return { x: XS[0] + d * Math.sin(h), z: ZS[0] - d * Math.cos(h), h };
    }
    if (s >= SS[N - 1]) {
      const d = s - SS[N - 1], h = HS[N - 1];
      return { x: XS[N - 1] + d * Math.sin(h), z: ZS[N - 1] - d * Math.cos(h), h };
    }
    let lo = 0, hi = N - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (SS[m] <= s) lo = m; else hi = m;
    }
    const u = (s - SS[lo]) / (SS[hi] - SS[lo]);
    return { x: XS[lo] + (XS[hi] - XS[lo]) * u, z: ZS[lo] + (ZS[hi] - ZS[lo]) * u, h: HS[lo] + (HS[hi] - HS[lo]) * u };
  }
  // point on track frame: arclength of yellow car at time t, plus along-track offset and lateral offset
  function frameAtT(t, along, lat) {
    const c = centerAtS(sT(t) + (along || 0));
    const l = lat || 0;
    return { x: c.x + Math.cos(c.h) * l, z: c.z + Math.sin(c.h) * l, h: c.h };
  }
  // rigid offset in the local frame of the centreline at time t (forward, right)
  function rigid(t, fwd, right) {
    const c = centerAtS(sT(t));
    return {
      x: c.x + Math.sin(c.h) * fwd + Math.cos(c.h) * right,
      z: c.z - Math.cos(c.h) * fwd + Math.sin(c.h) * right,
      h: c.h,
    };
  }

  const S_END_VIS = sT(24) + 121; // tunnel portal arclength
  const S_MIN = SS[0], S_MAX = S_END_VIS + 40;

  // road sample points for clearance checks
  const RP = [];
  for (let s = S_MIN; s <= S_MAX; s += 5) { const c = centerAtS(s); RP.push(c.x, c.z); }
  function clearOfRoad(x, z, d) {
    const d2 = d * d;
    for (let i = 0; i < RP.length; i += 2) {
      const dx = RP[i] - x, dz = RP[i + 1] - z;
      if (dx * dx + dz * dz < d2) return false;
    }
    return true;
  }

  // ---------- materials ----------
  const C = (hex) => new THREE.Color(hex);
  const lam = (hex, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: hex }, extra || {}));
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

  // ---------- sky / fog / lights ----------
  scene.background = C(0x6c7390);
  scene.fog = new THREE.Fog(0x737a94, 250, 5200);
  {
    const geo = new THREE.SphereGeometry(4200, 48, 24);
    const p = geo.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const zen = C(0x46506c), hor = C(0x8a91aa), glow = C(0xd9c9c4), below = C(0x5a6274);
    const gh = sampleT(HS, 21);
    const gx = Math.sin(gh), gz = -Math.cos(gh);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const L = Math.sqrt(x * x + y * y + z * z);
      const e = y / L;
      if (e < 0) { tmp.copy(below); } else {
        const k = Math.min(1, e / 0.55);
        tmp.copy(hor).lerp(zen, k * k * (3 - 2 * k));
        const hl = Math.sqrt(x * x + z * z) || 1;
        let gd = Math.max(0, (x * gx + z * gz) / hl);
        gd = Math.pow(gd, 3) * Math.max(0, 1 - e / 0.3);
        tmp.lerp(glow, gd * 0.75);
      }
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    var sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
  }
  scene.add(new THREE.HemisphereLight(0xb4bcdc, 0x404a38, 2.0));
  const sun = new THREE.DirectionalLight(0xc8cce4, 1.0);
  sun.position.set(-300, 600, 200);
  scene.add(sun);

  // ---------- ground ----------
  {
    let cx = 0, cz = 0, n = 0;
    for (let i = 0; i < RP.length; i += 2) { cx += RP[i]; cz += RP[i + 1]; n++; }
    cx /= n; cz /= n;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 140, 140), lam(0x3a4834, { polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 4 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(cx, -0.25, cz);
    scene.add(g);
    var CENTROID = { x: cx, z: cz };
  }

  // ---------- track strip builders ----------
  function stripMesh(s0, s1, latA, latB, y, colFn, step) {
    const pos = [], col = [];
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    const ds = (s1 - s0) / n;
    let pa = null, pb = null;
    for (let i = 0; i <= n; i++) {
      const s = s0 + i * ds;
      const c = centerAtS(s);
      const ch = Math.cos(c.h), sh = Math.sin(c.h);
      const a = [c.x + ch * latA, y, c.z + sh * latA];
      const b = [c.x + ch * latB, y, c.z + sh * latB];
      if (pa) {
        const cc = colFn(s - ds / 2);
        pos.push(...pa, ...pb, ...b, ...pa, ...b, ...a);
        for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b);
      }
      pa = a; pb = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, vcMat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  function wallMesh(s0, s1, lat, y0, y1, colFn, step) {
    const pos = [], col = [];
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    const ds = (s1 - s0) / n;
    let pa = null, pb = null;
    for (let i = 0; i <= n; i++) {
      const s = s0 + i * ds;
      const c = centerAtS(s);
      const x = c.x + Math.cos(c.h) * lat, z = c.z + Math.sin(c.h) * lat;
      const a = [x, y0, z], b = [x, y1, z];
      if (pa) {
        const cc = colFn(s - ds / 2);
        pos.push(...pa, ...pb, ...b, ...pa, ...b, ...a);
        for (let k = 0; k < 6; k++) col.push(cc.r, cc.g, cc.b);
      }
      pa = a; pb = b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, vcMat);
    scene.add(m);
    return m;
  }
  const solid = (hex) => { const c = C(hex); return () => c; };
  const stripes = (h1, h2, len) => { const a = C(h1), b = C(h2); return (s) => ((((Math.floor(s / len)) % 2) + 2) % 2 === 0 ? a : b); };

  const HALF = 7.5;
  // asphalt
  stripMesh(S_MIN, S_MAX, -HALF, HALF, 0.02, solid(0x4a4c53), 2);
  // edge lines
  stripMesh(S_MIN, S_MAX, -HALF + 0.15, -HALF + 0.45, 0.04, solid(0xd8d8d8), 2);
  stripMesh(S_MIN, S_MAX, HALF - 0.45, HALF - 0.15, 0.04, solid(0xd8d8d8), 2);
  // dashed lane markings on the fast middle section
  stripMesh(sT(7.0), sT(8.9), 4.6, 4.8, 0.04, stripes(0xd0d0d0, 0x4a4c53, 6), 3);
  stripMesh(sT(8.8), sT(11.2), -3.9, -3.7, 0.04, stripes(0xd0d0d0, 0x4a4c53, 6), 3);

  // kerbs [side, t0, t1]
  const KERBS = [[-1, 0.9, 3.4], [1, 3.7, 4.9], [-1, 4.6, 5.4], [-1, 6.8, 7.8], [-1, 10.8, 15.6], [1, 15.6, 18.0], [-1, 18.8, 22.4]];
  for (const [side, a, b] of KERBS) {
    const la = side < 0 ? -HALF - 1.4 : HALF, lb = side < 0 ? -HALF : HALF + 1.4;
    stripMesh(sT(a), sT(b), la, lb, 0.05, stripes(0xb02a2a, 0xdedede, 2.5), 1.25);
  }
  // green painted run-off strips
  const GREEN = [[-1, 12.8, 15.8], [1, 15.6, 17.8], [-1, 18.8, 21.2], [-1, 1.0, 3.2]];
  for (const [side, a, b] of GREEN) {
    const la = side < 0 ? -HALF - 4.5 : HALF + 1.4, lb = side < 0 ? -HALF - 1.4 : HALF + 4.0;
    stripMesh(sT(a), sT(b), la, lb, 0.03, solid(0x2f6e45), 2);
  }
  // run-off asphalt on the outside of the hairpin
  stripMesh(sT(14.8), sT(18.6), -22, -HALF - 4.5, 0.015, solid(0x45474d), 2);

  // walls [t0, t1, lat, y0, y1, colFn]
  const WALLS = [
    [-10, 3.4, -12, 0, 1.2, solid(0xa4a6aa)],
    [-10, 1.5, 15, 0, 1.3, stripes(0x5aa6a2, 0xd6dada, 9)],
    [1.5, 3.3, 13, 0, 1.1, solid(0x9a9ca0)],
    [3.0, 5.0, -21, 0, 1.1, stripes(0xb02a2a, 0xdedede, 4)],
    [4.6, 6.0, -14, 0, 1.1, stripes(0xb02a2a, 0xdedede, 4)],
    [4.6, 6.8, 10, 0, 1.2, solid(0x2c3e8c)],
    [6.0, 8.5, 9.6, 0, 0.9, solid(0x8a8e94)],
    [6.5, 9.6, -10.5, 0, 0.9, solid(0x8a8e94)],
    [8.5, 12.6, 11, 0, 0.9, solid(0x8a8e94)],
    [9.4, 13.4, -11.5, 0, 1.1, solid(0x9a9ca0)],
    [13.3, 16.0, -26, 0, 1.6, solid(0xd6d6da)],
    [16.0, 18.3, -26, 0, 1.1, stripes(0xb02a2a, 0xdedede, 4)],
    [18.3, 26, -10.5, 0, 1.2, solid(0x9a9ca0)],
    [18.3, 20.2, -10.6, 1.2, 2.8, stripes(0xe2e2e6, 0xe2e2e6, 9)],
    [19.0, 26, 11.5, 0, 0.9, solid(0x8a8e94)],
  ];
  for (const [a, b, lat, y0, y1, cf] of WALLS) wallMesh(sT(a), sT(b), lat, y0, y1, cf, 2);
  // translucent catch fences
  const fenceMat = new THREE.MeshBasicMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
  const FENCES = [[-10, 3.4, -12.2, 5.5], [9.4, 13.4, -11.7, 4.5], [18.3, 24.5, -10.8, 5.5], [2.0, 3.4, 13.2, 3.5]];
  const postPos = [];
  for (const [a, b, lat, hgt] of FENCES) {
    const m = wallMesh(sT(a), sT(b), lat, 1.1, hgt, solid(0x9aa0aa), 4);
    m.material = fenceMat;
    for (let s = sT(a); s < sT(b); s += 8) {
      const c = centerAtS(s);
      postPos.push([c.x + Math.cos(c.h) * lat, c.z + Math.sin(c.h) * lat, hgt]);
    }
  }
  {
    const geo = new THREE.BoxGeometry(0.18, 1, 0.18);
    geo.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(geo, lam(0x6c7078), postPos.length);
    const d = new THREE.Object3D();
    postPos.forEach((p, i) => { d.position.set(p[0], 0, p[1]); d.scale.set(1, p[2], 1); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    scene.add(im);
  }

  // ---------- helper to place an oriented group ----------
  function placed(p, yawExtra) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -(p.h + (yawExtra || 0));
    scene.add(g);
    return g;
  }
  function box(parent, w, h, d, x, y, z, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  const SCREEN2 = rigid(19.8, 60, 32);
  // ---------- grandstands ----------
  const crowdMat = lam(0x5e4a4e), standMat = lam(0x55585f);
  function grandstand(ta, tb, latInner, depth, side) {
    const sa = sT(ta), sb = sT(tb);
    const tilt = 0.45;
    for (let s = sa; s < sb; s += 8) {
      const c = centerAtS(s + 4);
      const g = placed({ x: c.x, z: c.z, h: c.h });
      const wdt = depth / Math.cos(tilt);
      const lc = side * (latInner + depth / 2);
      const b = box(g, wdt, 0.7, 8.4, lc, 1.2 + (depth / 2) * Math.tan(tilt), 0, crowdMat);
      b.rotation.z = side * tilt;
      box(g, 0.6, 1.2 + depth * Math.tan(tilt) + 2, 8.4, side * (latInner + depth), (1.2 + depth * Math.tan(tilt) + 2) / 2, 0, standMat);
    }
  }
  grandstand(-2.0, 0.7, 16, 18, -1);
  grandstand(13.0, 16.0, 30, 16, -1);
  grandstand(16.0, 18.2, 30, 16, -1);
  grandstand(18.3, 20.1, 14, 16, -1);

  // pit building / garages on the right of the start straight
  {
    const sa = sT(-2.5), sb = sT(1.0);
    for (let s = sa; s < sb; s += 20) {
      const c = centerAtS(s + 10);
      const g = placed({ x: c.x, z: c.z, h: c.h });
      box(g, 14, 7, 20.5, 30, 3.5, 0, lam(0x5c606a));
    }
  }

  // ---------- landmark structures ----------
  // "Deep Forest" overhead gantry on the start straight
  {
    const g = placed(frameAtT(0, 50, 0));
    const gm = lam(0x3b3e48);
    box(g, 40, 2.0, 1.6, 3, 7.7, 0, gm);
    box(g, 40, 0.5, 1.2, 3, 9.0, 0, lam(0x2c2f36));
    box(g, 1.2, 8.7, 1.2, -17, 4.35, 0, gm);
    box(g, 1.2, 8.7, 1.2, 23, 4.35, 0, gm);
  }
  // big video screen at the start (right side)
  {
    const g = placed(rigid(0, 50, 35));
    box(g, 17, 10, 0.6, 0, 12, 0, lam(0x30333a));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: 0xe6dcef }));
    scr.position.set(0, 12, 0.35);
    g.add(scr);
    box(g, 1, 7, 1, 0, 3.5, 0, lam(0x30333a));
  }
  // distance boards (start straight and hairpin approach), left side
  const boardMat = lam(0xe4e4e4), poleMat = lam(0x7a7e86);
  const boardSpots = [];
  for (const s of [45, 100, 152, 200]) boardSpots.push(centerAtS(s));
  for (const [t, a] of [[11.5, 42], [12.5, 40], [13.5, 28]]) boardSpots.push(centerAtS(sT(t) + a));
  for (const c of boardSpots) {
    const g = placed({ x: c.x + Math.cos(c.h) * -10.5, z: c.z + Math.sin(c.h) * -10.5, h: c.h });
    box(g, 2.0, 1.0, 0.15, 0, 3.4, 0, boardMat);
    box(g, 0.15, 3.0, 0.15, 0, 1.5, 0, poleMat);
  }
  // overpass bridge crossing turn 1 exit (oblique)
  {
    const g = placed(frameAtT(5.2, 18, 0), 28 * D2R);
    const cm = lam(0x8c9094);
    box(g, 120, 1.6, 11, -35, 8.0, 0, cm);
    box(g, 120, 0.9, 0.3, -35, 9.2, 5.3, lam(0x9a9ea2));
    box(g, 120, 0.9, 0.3, -35, 9.2, -5.3, lam(0x9a9ea2));
    for (const px of [-60, -20, 14]) {
      const a = box(g, 1.4, 8, 2.5, px - 1.2, 4, 0, cm); a.rotation.z = 0.3;
      const b = box(g, 1.4, 8, 2.5, px + 1.2, 4, 0, cm); b.rotation.z = -0.3;
    }
  }
  // sponsor boards on the right after the bridge
  {
    const g = placed(frameAtT(6.25, 45, 16));
    box(g, 8, 3.6, 0.3, 0, 5.5, 0, lam(0xe2e4ea));
    box(g, 0.25, 4, 0.25, -3, 2, 0, poleMat);
    box(g, 0.25, 4, 0.25, 3, 2, 0, poleMat);
  }
  // white billboard on the right before the hairpin
  {
    const g = placed(frameAtT(11.7, 30, 14));
    box(g, 8, 4.5, 0.3, 0, 6, 0, lam(0xd8dce4));
    box(g, 0.3, 4, 0.3, 0, 2, 0, poleMat);
  }
  // large billboard around the hairpin exit (left/outside)
  {
    const g = placed(frameAtT(18.7, 0, -22));
    box(g, 10, 4.2, 0.3, 0, 6.5, 0, lam(0xe8e8ec));
    box(g, 6, 0.9, 0.32, 0.8, 6.5, 0, lam(0xb03030));
    box(g, 0.3, 4.5, 0.3, -3.5, 2.2, 0, poleMat);
    box(g, 0.3, 4.5, 0.3, 3.5, 2.2, 0, poleMat);
  }
  // tall red camera crane beyond the hairpin
  {
    const p = rigid(13.3, 140, 60);
    const g = placed(p);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 42, 8), lam(0xc0442a));
    m.position.set(0, 20, 0);
    m.rotation.z = 0.18;
    g.add(m);
    box(g, 4, 2, 4, 0, 1, 0, lam(0xb05020));
  }
  // GT overhead gantry near the end
  {
    const g = placed(frameAtT(21.9, 46.5, 0));
    const pm = lam(0xd2d6de);
    box(g, 2.6, 10.5, 0.8, -11.8, 5.25, 0, pm);
    box(g, 2.6, 10.5, 0.8, 11.8, 5.25, 0, pm);
    box(g, 24, 2.4, 0.8, 0, 9.6, 0, lam(0x1f2537));
    box(g, 9, 0.6, 0.85, -2, 9.6, 0, lam(0xb8bcc6));
  }
  // big screen on the right of the final straight
  {
    const g = placed(SCREEN2);
    box(g, 15, 9, 0.6, 0, 12.4, 0, lam(0x2a2d34));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0xf0e8f4 }));
    scr.position.set(0, 12.4, 0.35);
    g.add(scr);
    box(g, 12, 8, 3, 0, 4, 0, lam(0x23262c));
  }
  // lattice light tower
  {
    const g = placed(rigid(19.8, 200, 70));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.4, 55, 6), lam(0x8a8e96));
    m.position.y = 27.5;
    g.add(m);
    box(g, 5, 0.6, 0.6, 0, 50, 0, lam(0x8a8e96));
    box(g, 5, 0.6, 0.6, 0, 46, 0, lam(0x8a8e96));
  }
  // tunnel portal at the end of the straight
  {
    const c = centerAtS(S_END_VIS);
    const g = placed({ x: c.x, z: c.z, h: c.h });
    box(g, 46, 14, 40, -1, 7, -20, lam(0x2e3d2a));
    box(g, 22, 10, 1, -1, 5, 0.3, lam(0x5a5e58));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(8, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xe8a448 }));
    hole.position.set(-1, 0, 0.9);
    g.add(hole);
  }

  // ---------- trees ----------
  const coni = [], round = [];
  const noTree = (x, z) => { const dx = x - SCREEN2.x, dz = z - SCREEN2.z; return dx * dx + dz * dz < 40 * 40; };
  function forest(ta, tb, side, la, lb, count, conFrac) {
    let placedN = 0, tries = 0;
    while (placedN < count && tries < count * 8) {
      tries++;
      const t = rr(ta, tb);
      const lat = side * rr(la, lb);
      const p = frameAtT(t, 0, lat);
      if (!clearOfRoad(p.x, p.z, 11.5) || noTree(p.x, p.z)) continue;
      if (rand() < conFrac) coni.push([p.x, p.z, rr(3, 4.5), rr(14, 22)]);
      else round.push([p.x, p.z, rr(4.5, 7.5), rr(1.1, 1.5)]);
      placedN++;
    }
  }
  forest(-6, 3, -1, 40, 140, 50, 0.5);
  forest(3.0, 5.0, -1, 28, 120, 40, 0.5);
  forest(5.0, 10.6, 1, 13, 70, 160, 0.4);
  forest(8.5, 12.0, -1, 60, 140, 20, 0.2);
  forest(12.5, 17.5, -1, 48, 100, 70, 0.5);
  forest(15.5, 18.5, 1, 20, 60, 25, 0.5);
  forest(18.5, 26, -1, 30, 75, 110, 0.4);
  forest(19, 21, 1, 62, 95, 30, 0.35);
  forest(21, 26, 1, 16, 65, 100, 0.35);
  forest(21.5, 27, -1, 13, 40, 70, 0.3);
  forest(22.0, 27, 1, 13, 40, 60, 0.3);
  {
    const d = new THREE.Object3D();
    const cg = new THREE.ConeGeometry(1, 1, 7);
    cg.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(cg, lam(0x2c3e2a), coni.length);
    coni.forEach((q, i) => { d.position.set(q[0], 1.5, q[1]); d.scale.set(q[2], q[3], q[2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    scene.add(im);
    const sg = new THREE.SphereGeometry(1, 8, 6);
    const im2 = new THREE.InstancedMesh(sg, lam(0x33482f), round.length);
    round.forEach((q, i) => { d.position.set(q[0], q[2] * q[3] + 3, q[1]); d.scale.set(q[2], q[2] * q[3], q[2]); d.updateMatrix(); im2.setMatrixAt(i, d.matrix); });
    scene.add(im2);
  }

  // ---------- hills and mountains ----------
  {
    const d = new THREE.Object3D();
    const hills = [];
    let tries = 0;
    while (hills.length < 16 && tries < 400) {
      tries++;
      const a = rand() * Math.PI * 2, r = rr(800, 1600);
      const x = CENTROID.x + Math.cos(a) * r, z = CENTROID.z + Math.sin(a) * r;
      const rad = rr(220, 480);
      if (!clearOfRoad(x, z, rad + 60)) continue;
      hills.push([x, z, rad, rr(0.2, 0.38)]);
    }
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), lam(0x2b3829), hills.length);
    hills.forEach((q, i) => { d.position.set(q[0], 0, q[1]); d.scale.set(q[2], q[2] * q[3], q[2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    scene.add(im);
    const mts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rr(-0.1, 0.1), r = rr(2700, 3700);
      mts.push([CENTROID.x + Math.cos(a) * r, CENTROID.z + Math.sin(a) * r, rr(900, 1500), rr(380, 750)]);
    }
    const mg = new THREE.ConeGeometry(1, 1, 9);
    mg.translate(0, 0.5, 0);
    const im2 = new THREE.InstancedMesh(mg, lam(0x4c566a), mts.length);
    mts.forEach((q, i) => { d.position.set(q[0], -5, q[1]); d.scale.set(q[2], q[3], q[2] * 0.8); d.rotation.set(0, rand() * 6, 0); d.updateMatrix(); im2.setMatrixAt(i, d.matrix); });
    scene.add(im2);
  }

  // ---------- cars ----------
  function makeCar(bodyHex, plateGlow) {
    const g = new THREE.Group();
    const bodyM = lam(bodyHex);
    const glass = lam(0x1c1d22);
    const black = lam(0x141416);
    box(g, 1.95, 0.62, 4.4, 0, 0.45, 0, bodyM);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.44, 2.0), [glass, glass, bodyM, glass, glass, glass]);
    cabin.position.set(0, 0.98, 0.15);
    g.add(cabin);
    box(g, 1.5, 0.14, 0.05, 0, 0.62, 2.215, black);
    const tl = new THREE.MeshLambertMaterial({ color: 0x500000, emissive: 0xff0c06, emissiveIntensity: 1.2 });
    box(g, 0.38, 0.14, 0.05, -0.6, 0.66, 2.22, tl);
    box(g, 0.38, 0.14, 0.05, 0.6, 0.66, 2.22, tl);
    const glowM = new THREE.MeshBasicMaterial({ color: 0xff1008, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-0.6, 0.6]) {
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.19, 16), glowM);
      gl.position.set(sx, 0.66, 2.3);
      g.add(gl);
    }
    if (plateGlow) {
      box(g, 0.5, 0.15, 0.04, 0, 0.42, 2.22, new THREE.MeshLambertMaterial({ color: 0x806020, emissive: 0xffe6a0, emissiveIntensity: 1.2 }));
    }
    box(g, 1.8, 0.16, 0.3, 0, 0.2, 2.1, black);
    box(g, 2.0, 0.05, 0.34, 0, 1.3, 1.95, black);
    box(g, 0.05, 0.32, 0.12, -0.55, 1.13, 1.95, black);
    box(g, 0.05, 0.32, 0.12, 0.55, 1.13, 1.95, black);
    const brakeM = new THREE.MeshLambertMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 0 });
    box(g, 0.34, 0.05, 0.04, 0, 1.18, 1.17, brakeM);
    const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.3, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelM = lam(0x111112);
    const hubM = lam(0x6a6c70);
    const wheels = [], steer = [];
    for (const [wx, wz] of [[-0.88, -1.35], [0.88, -1.35], [-0.88, 1.35], [0.88, 1.35]]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 0.33, wz);
      const w = new THREE.Mesh(wheelGeo, wheelM);
      const hub = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.08), hubM);
      w.add(hub);
      pivot.add(w);
      g.add(pivot);
      wheels.push(w);
      if (wz < 0) steer.push(pivot);
    }
    scene.add(g);
    return { g, wheels, steer, brakeM };
  }
  const yellow = makeCar(0xd6b22c, true);
  const white = makeCar(0xe6e7ea, false);

  // ---------- motion functions ----------
  const latY = (t) => cr(LATY, t);
  const latW = (t) => cr(LATW, t);
  function velHeadingY(t) {
    const h = sampleT(HS, t);
    const v = Math.max(1, lin(SPEED, t));
    const dl = (latY(t + 0.02) - latY(t - 0.02)) / 0.04;
    return h + Math.atan2(dl, v);
  }
  const CAM_BACK = 6.5, CAM_H = 1.75, CAM_PITCH = -0.068;

  function update(time, frame) {
    const t = time;
    // yellow car
    const sY = sT(t);
    const x0 = sampleT(XS, t), z0 = sampleT(ZS, t), h0 = sampleT(HS, t);
    const ly = latY(t);
    const yx = x0 + Math.cos(h0) * ly, yz = z0 + Math.sin(h0) * ly;
    const hv = velHeadingY(t);
    const drift = cr(DRIFT, t);
    yellow.g.position.set(yx, 0, yz);
    yellow.g.rotation.set(0, -(hv + drift), 0);
    const vY = Math.max(1, lin(SPEED, t));
    const yawRate = lin(YAWR, t) * D2R;
    const steerA = Math.atan(2.7 * yawRate / vY) - drift * 0.9;
    for (const w of yellow.wheels) w.rotation.set(-sY / 0.33, 0, 0);
    for (const p of yellow.steer) p.rotation.set(0, -steerA, 0);
    const braking = t >= BRAKE_ON[0] && t <= BRAKE_ON[1];
    yellow.brakeM.emissiveIntensity = braking ? 2.0 : 0.0;

    // white car
    const sW = sY + cr(GAP, t);
    const cw = centerAtS(sW);
    const lw = latW(t);
    const sW2 = sT(t + 0.02) + cr(GAP, t + 0.02), sW1 = sT(t - 0.02) + cr(GAP, t - 0.02);
    const vW = Math.max(1, (sW2 - sW1) / 0.04);
    const dlw = (latW(t + 0.02) - latW(t - 0.02)) / 0.04;
    const hw = cw.h + Math.atan2(dlw, vW);
    white.g.position.set(cw.x + Math.cos(cw.h) * lw, 0, cw.z + Math.sin(cw.h) * lw);
    white.g.rotation.set(0, -hw, 0);
    for (const w of white.wheels) w.rotation.set(-sW / 0.33, 0, 0);
    const kW = (centerAtS(sW + 1).h - centerAtS(sW - 1).h) / 2;
    for (const p of white.steer) p.rotation.set(0, -Math.atan(2.7 * kW), 0);
    white.brakeM.emissiveIntensity = 0;

    // chase camera: lagged heading (box average of the car's velocity heading over the last 0.45 s)
    let sum = 0;
    const K = 10;
    for (let k = 0; k < K; k++) sum += velHeadingY(t - (0.3 * k) / (K - 1));
    const cy = sum / K;
    camera.position.set(yx - Math.sin(cy) * CAM_BACK, CAM_H, yz + Math.cos(cy) * CAM_BACK);
    camera.rotation.set(CAM_PITCH, -cy, 0, 'YXZ');
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);
  }

  update(0, 0);
  return { scene, camera, update };
}
