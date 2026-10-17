// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction (video27).
// Single continuous bumper-camera shot of a racing car lapping a mountain/lake circuit:
// fast downhill left/right sweepers, braking into a left turn, a slow right hairpin,
// a long tunnel (yellow rival car draws alongside on the left), exit into a cutting
// with an overpass ahead.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const FOV = 79;          // wide bumper-camera lens (estimated from rival-car wheel geometry)
  const CAM_H = 1.4;
  const CAM_TILT = -2 * Math.PI / 180;
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.3, 9000);
  scene.add(camera);

  const SKY_HORIZON = new THREE.Color(0xaec6e6);
  scene.background = SKY_HORIZON.clone();
  scene.fog = new THREE.Fog(0xaac2e2, 400, 5600);

  // ---------- deterministic rng ----------
  let rs = (seed >>> 0) || 12345;
  function rng() {
    rs = (rs + 0x6d2b79f5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- monotone cubic interpolation ----------
  function pchip(keys) {
    const n = keys.length;
    const xs = keys.map((k) => k[0]);
    const ys = keys.map((k) => k[1]);
    const h = [], d = [];
    for (let i = 0; i < n - 1; i++) {
      h[i] = xs[i + 1] - xs[i];
      d[i] = (ys[i + 1] - ys[i]) / h[i];
    }
    const m = new Array(n).fill(0);
    if (n > 1) {
      m[0] = d[0];
      m[n - 1] = d[n - 2];
      for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) m[i] = 0;
        else {
          const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
          m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
        }
      }
    }
    return function (t) {
      if (t <= xs[0]) return ys[0];
      if (t >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (i < n - 2 && t > xs[i + 1]) i++;
      const hh = h[i], u = (t - xs[i]) / hh;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * hh * m[i] +
        (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * hh * m[i + 1];
    };
  }

  // ---------- speed profile (km/h, read from observed samples) ----------
  const SPEED = pchip([
    [0.0, 183], [0.844, 182], [1.648, 180], [2.492, 148], [3.336, 120], [4.139, 123],
    [4.983, 115], [5.827, 82], [6.631, 62], [7.475, 52], [8.319, 65], [9.123, 67],
    [9.967, 78], [10.771, 89], [11.615, 101], [12.459, 108], [13.262, 115], [14.106, 123],
    [14.950, 126], [15.754, 129], [16.598, 128], [17.442, 131], [18.246, 134], [19.090, 136],
  ]);

  const T0 = -8, T1 = 34, DT = 0.005;
  const NT = Math.round((T1 - T0) / DT) + 1;
  const Stab = new Float64Array(NT);
  {
    const i0 = Math.round((0 - T0) / DT);
    Stab[i0] = 0;
    for (let i = i0 + 1; i < NT; i++) {
      const ta = T0 + (i - 1) * DT, tb = T0 + i * DT;
      Stab[i] = Stab[i - 1] + 0.5 * (SPEED(ta) + SPEED(tb)) / 3.6 * DT;
    }
    for (let i = i0 - 1; i >= 0; i--) {
      const ta = T0 + i * DT, tb = T0 + (i + 1) * DT;
      Stab[i] = Stab[i + 1] - 0.5 * (SPEED(ta) + SPEED(tb)) / 3.6 * DT;
    }
  }
  function S(t) {
    const f = (t - T0) / DT;
    if (f <= 0) return Stab[0] + (t - T0) * SPEED(T0) / 3.6;
    if (f >= NT - 1) return Stab[NT - 1] + (t - T1) * SPEED(T1) / 3.6;
    const i = Math.floor(f), a = f - i;
    return Stab[i] * (1 - a) + Stab[i + 1] * a;
  }
  function Sinv(s) {
    if (s <= Stab[0]) return T0 + (s - Stab[0]) / (SPEED(T0) / 3.6);
    if (s >= Stab[NT - 1]) return T1 + (s - Stab[NT - 1]) / (SPEED(T1) / 3.6);
    let lo = 0, hi = NT - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (Stab[mid] <= s) lo = mid; else hi = mid;
    }
    const a = (s - Stab[lo]) / Math.max(1e-9, Stab[hi] - Stab[lo]);
    return T0 + (lo + a) * DT;
  }

  // ---------- track centreline ----------
  // turn segments keyed by the time the camera car traverses them (deg, + = right turn)
  const TURNS = [
    [-1.0, 0.85, -40],
    [0.85, 1.7, 12],
    [1.7, 5.7, -105],
    [5.6, 9.3, 122],
    [11.3, 15.0, -38],
    [15.0, 16.4, 18],
    [16.5, 18.6, -22],
    [19.6, 26.0, 12],
  ].map(([ta, tb, deg]) => ({ s0: S(ta), s1: S(tb), A: deg * Math.PI / 180 }));
  const RAMP = 0.25;
  function sstep(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
  function curvature(s) {
    let k = 0;
    for (const seg of TURNS) {
      if (s < seg.s0 || s > seg.s1) continue;
      const L = seg.s1 - seg.s0;
      const u = (s - seg.s0) / L;
      const w = Math.min(sstep(u / RAMP), sstep((1 - u) / RAMP));
      k += seg.A / ((1 - RAMP) * L) * w;
    }
    return k;
  }
  // grade (rise/run) keyed by time; camera pitch follows it (horizon sits high in early samples)
  const GRADE = pchip([
    [-4, -0.07], [0, -0.10], [2.5, -0.11], [3.34, -0.13], [4.14, -0.10], [4.98, -0.10],
    [5.83, -0.06], [7.5, -0.03], [9.0, -0.03], [12.0, -0.03], [14.1, -0.07],
    [14.95, -0.10], [15.75, -0.07], [16.6, -0.05], [17.44, -0.01], [18.25, 0.02], [19.1, -0.02], [20, -0.04], [24, -0.02],
  ]);

  const SMIN = S(-3.2) - 10;
  const SMAX = S(19.2) + 480;
  const DS = 0.5;
  const NS = Math.ceil((SMAX - SMIN) / DS) + 1;
  const PX = new Float64Array(NS), PZ = new Float64Array(NS), PY = new Float64Array(NS);
  const PTH = new Float64Array(NS), PG = new Float64Array(NS);
  {
    const i0 = Math.round((0 - SMIN) / DS);
    PX[i0] = 0; PZ[i0] = 0; PY[i0] = 0; PTH[i0] = 0;
    for (let i = 0; i < NS; i++) PG[i] = GRADE(Sinv(SMIN + i * DS));
    for (let i = i0 + 1; i < NS; i++) {
      const sm = SMIN + (i - 0.5) * DS;
      const th = PTH[i - 1] + curvature(sm) * DS;
      const thm = 0.5 * (PTH[i - 1] + th);
      PTH[i] = th;
      PX[i] = PX[i - 1] + Math.sin(thm) * DS;
      PZ[i] = PZ[i - 1] - Math.cos(thm) * DS;
      PY[i] = PY[i - 1] + 0.5 * (PG[i - 1] + PG[i]) * DS;
    }
    for (let i = i0 - 1; i >= 0; i--) {
      const sm = SMIN + (i + 0.5) * DS;
      const th = PTH[i + 1] - curvature(sm) * DS;
      const thm = 0.5 * (PTH[i + 1] + th);
      PTH[i] = th;
      PX[i] = PX[i + 1] - Math.sin(thm) * DS;
      PZ[i] = PZ[i + 1] + Math.cos(thm) * DS;
      PY[i] = PY[i + 1] - 0.5 * (PG[i + 1] + PG[i]) * DS;
    }
  }
  function frameAt(s) {
    let f = (s - SMIN) / DS;
    f = Math.min(NS - 1.000001, Math.max(0, f));
    const i = Math.floor(f), a = f - i;
    return {
      x: PX[i] * (1 - a) + PX[i + 1] * a,
      z: PZ[i] * (1 - a) + PZ[i + 1] * a,
      y: PY[i] * (1 - a) + PY[i + 1] * a,
      th: PTH[i] * (1 - a) + PTH[i + 1] * a,
      g: PG[i] * (1 - a) + PG[i + 1] * a,
    };
  }

  // ---------- camera-car lateral position (m, + = right of centreline; road half-width 6) ----------
  const LAT = pchip([
    [-3, -1.5], [0.0, -1.5], [0.844, -2.1], [1.648, 0.5], [2.492, 2.3], [3.336, 0.5],
    [4.139, 0.7], [4.983, 0.8], [5.827, -1.9], [6.631, -2.3], [7.475, -2.85], [8.319, -2.97],
    [9.123, -1.5], [9.967, -0.3], [10.771, -0.3], [11.615, 0.0], [12.459, 0.3], [13.262, 0.5],
    [14.106, 0.5], [14.950, 0.3], [15.754, 0.5], [16.598, 0.9], [17.442, 1.3], [18.246, 2.6],
    [19.090, 2.9], [22, 2.9],
  ]);

  function poseAt(t, obj) {
    const s = S(t);
    const fr = frameAt(s);
    const lat = LAT(t);
    const px = fr.x + Math.cos(fr.th) * lat;
    const pz = fr.z + Math.sin(fr.th) * lat;
    const py = fr.y + CAM_H;
    const ds = Math.max(0.05, S(t + 0.05) - S(t - 0.05));
    const yawLat = Math.atan((LAT(t + 0.05) - LAT(t - 0.05)) / ds);
    const th = frameAt(s + 1.0).th + yawLat;
    const pitch = Math.atan(fr.g) + CAM_TILT;
    const fx = Math.sin(th) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(th) * Math.cos(pitch);
    obj.position.set(px, py, pz);
    obj.up.set(0, 1, 0);
    obj.lookAt(px + fx, py + fy, pz + fz);
    return { s, th, lat };
  }

  // ---------- textures ----------
  function makeTex(w, h, fn) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      const o = (y * w + x) * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const curbTex = makeTex(2, 1, (x) => (x === 0 ? [196, 40, 44] : [232, 232, 232]));
  const chevTex = makeTex(32, 8, (x, y) => (((x + Math.abs(y - 3.5) * 1.6) % 16) < 7 ? [24, 24, 24] : [226, 196, 30]));

  // ---------- materials ----------
  const lam = (c, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c, side: THREE.DoubleSide }, extra));
  const M = {
    road: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    line: lam(0xeeeeee, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    curb: lam(0xffffff, { map: curbTex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    verge: lam(0x52702f),
    outer: lam(0x47632c),
    forest: lam(0x2b4320),
    hill: lam(0x3a5628),
    hillEnd: lam(0x3e5c2a),
    rail: lam(0xa4a6aa),
    chev: lam(0xffffff, { map: chevTex }),
    ledge: lam(0xa0a09c, { emissive: 0x303030 }),
    wall: lam(0x9e9e9a, { emissive: 0x383836 }),
    ceil: lam(0x8a8a88, { emissive: 0x3a3a38 }),
    concrete: lam(0x8a8a86),
    dark: lam(0x4a4c4e),
    white: lam(0xf2f2f2),
    red: lam(0xd02020),
    blue: lam(0x2040a0),
    signYellow: lam(0xe0c020),
    black: lam(0x161616),
    post: lam(0x6a6a6a),
    lake: new THREE.MeshLambertMaterial({ color: 0x8c9fb4 }),
    ground: new THREE.MeshLambertMaterial({ color: 0x4a6630 }),
    mountain: new THREE.MeshLambertMaterial({ color: 0x5f6590, flatShading: true }),
    carYellow: lam(0xd8c02a, { emissive: 0x4a4008 }),
    glass: lam(0x3a4452, { emissive: 0x181c22 }),
    tire: lam(0x1c1c1c),
    hub: lam(0xc0c0c4, { emissive: 0x303030 }),
  };

  // ---------- strip builder ----------
  function strip(s0, s1, A, B, mat, opts = {}) {
    const uLen = opts.uLen || 4, step = opts.step || 1;
    s0 = Math.max(s0, SMIN); s1 = Math.min(s1, SMAX);
    if (s1 <= s0) return null;
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    const pos = [], uv = [], col = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + (s1 - s0) * i / n;
      const fr = frameAt(s);
      const c = Math.cos(fr.th), sn = Math.sin(fr.th);
      [A, B].forEach((P, j) => {
        pos.push(fr.x + c * P[0], fr.y + P[1], fr.z + sn * P[0]);
        uv.push(s / uLen, j);
        if (opts.colorFn) { const cc = opts.colorFn(s); col.push(cc.r, cc.g, cc.b); }
      });
      if (i < n) {
        const a = 2 * i;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (opts.colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    scene.add(mesh);
    return mesh;
  }

  // ---------- key track positions ----------
  const sT0 = S(9.25);   // tunnel entrance
  const sT1 = S(14.5);  // tunnel exit
  const sHair0 = S(5.5), sHair1 = S(9.4);
  const sLeft0 = S(1.6), sLeft1 = S(5.8);
  const RW = 6;         // road half-width
  const TW = 7.8;       // tunnel half-width (wall face)
  const TH_WALL = 6.0, TH_CEIL = 7.2;

  const cRoad = new THREE.Color(0x86868a), cTun = new THREE.Color(0x56565a);
  strip(SMIN, SMAX, [-RW, 0], [RW, 0], M.road, {
    step: 1,
    colorFn: (s) => {
      const k = sstep((s - sT0 + 2) / 6) * (1 - sstep((s - sT1 + 4) / 6));
      return cRoad.clone().lerp(cTun, k);
    },
  });
  strip(SMIN, SMAX, [-RW + 0.05, 0.01], [-RW + 0.3, 0.01], M.line);
  strip(SMIN, SMAX, [RW - 0.3, 0.01], [RW - 0.05, 0.01], M.line);
  // red/white kerbs
  strip(SMIN, sT0 + 18, [-RW - 1.2, 0.03], [-RW, 0.01], M.curb, { uLen: 3 });
  strip(sT1 - 4, SMAX, [-RW - 1.2, 0.03], [-RW, 0.01], M.curb, { uLen: 3 });
  strip(SMIN, sT0, [RW, 0.01], [RW + 1.2, 0.03], M.curb, { uLen: 3 });
  strip(sT1 - 4, SMAX, [RW, 0.01], [RW + 1.2, 0.03], M.curb, { uLen: 3 });
  // grass verges
  strip(SMIN, SMAX, [-16, -0.06], [-RW - 0.5, -0.06], M.verge);
  strip(SMIN, SMAX, [RW + 0.5, -0.06], [16, -0.06], M.verge);
  // outer falling terrain (shortened on the inside of tight bends to avoid folding)
  strip(SMIN, sLeft0, [-75, -10], [-16, -0.06], M.outer, { step: 2 });
  strip(sLeft0, sLeft1, [-40, -5], [-16, -0.06], M.outer, { step: 2 });
  strip(sLeft1, SMAX, [-75, -10], [-16, -0.06], M.outer, { step: 2 });
  strip(SMIN, sHair0, [16, -0.06], [75, -10], M.outer, { step: 2 });
  strip(sHair0, sHair1, [15, -0.06], [16, -0.06], M.outer, { step: 1 });
  strip(sHair1, SMAX, [16, -0.06], [75, -10], M.outer, { step: 2 });

  // guardrails
  const railRanges = [
    [-1, SMIN, S(5.7)], [-1, S(8.6), sT0], [-1, sT1, SMAX],
    [1, SMIN, S(3.3)], [1, S(5.7), sT0], [1, sT1, SMAX],
  ];
  for (const [side, a, b] of railRanges) {
    strip(a, b, [side * 8.5, 0.35], [side * 8.5, 0.9], M.rail);
  }
  // yellow/black chevron boards: outside of the left turn (right side), outside of hairpin (left side)
  strip(S(3.4), S(5.6), [10.5, 0.2], [10.5, 1.4], M.chev, { uLen: 5 });
  strip(S(5.8), S(8.5), [-14, 0.3], [-14, 1.6], M.chev, { uLen: 5 });

  // hills / forest embankments (relative to road level)
  strip(SMIN, S(2.2), [-46, 24], [-18, 0], M.forest, { step: 2 });
  strip(S(2.2), S(5.6), [-38, 18], [-16, 0], M.forest, { step: 2 });
  strip(S(5.9), sT0 + 2, [-50, 22], [-18, 0], M.hill, { step: 2 });
  strip(sT1, SMAX, [-32, 42], [-10, 0], M.hillEnd, { step: 2 });
  strip(S(16.8), SMAX, [10, 0], [32, 42], M.hillEnd, { step: 2 });

  // ---------- tunnel ----------
  strip(sT0, sT1, [-TW, 0.25], [-RW, 0.25], M.ledge);
  strip(sT0, sT1, [RW, 0.25], [TW, 0.25], M.ledge);
  strip(sT0, sT1, [-RW, 0], [-RW, 0.25], M.ledge);
  strip(sT0, sT1, [RW, 0], [RW, 0.25], M.ledge);
  strip(sT0, sT1, [-TW, 0.25], [-TW, TH_WALL], M.wall, { uLen: 3 });
  strip(sT0, sT1, [TW, 0.25], [TW, TH_WALL], M.wall, { uLen: 3 });
  strip(sT0, sT1, [-TW, TH_WALL], [-RW, TH_CEIL], M.wall);
  strip(sT0, sT1, [TW, TH_WALL], [RW, TH_CEIL], M.wall);
  strip(sT0, sT1, [-RW, TH_CEIL], [RW, TH_CEIL], M.ceil);

  function placeAligned(obj, s, off, h) {
    const fr = frameAt(s);
    obj.position.set(fr.x + Math.cos(fr.th) * off, fr.y + h, fr.z + Math.sin(fr.th) * off);
    obj.rotation.set(0, -fr.th, 0);
    scene.add(obj);
    return obj;
  }
  function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
  // entrance portal: concrete face around the opening, forest cap above
  placeAligned(box(22, 24, 4, M.concrete), sT0 + 2, -(TW + 11), 12);
  placeAligned(box(8, TH_CEIL, 4, M.concrete), sT0 + 2, TW + 4, TH_CEIL / 2);
  placeAligned(box(2 * TW + 8, 16.8, 4, M.concrete), sT0 + 2, 0, TH_CEIL + 8.4);
  // exit portal
  placeAligned(box(14, TH_CEIL, 3, M.concrete), sT1 - 1.5, -(TW + 7), TH_CEIL / 2);
  placeAligned(box(14, TH_CEIL, 3, M.concrete), sT1 - 1.5, TW + 7, TH_CEIL / 2);
  placeAligned(box(2 * TW + 28, 8, 3, M.concrete), sT1 - 1.5, 0, TH_CEIL + 4);

  // ---------- overpass at the end (spans the cutting between the hills) ----------
  const sB = S(19.13) + 38;
  placeAligned(box(34, 9, 8, M.dark), sB, 4, 9 + 4.5);

  // ---------- roadside signs, anchored from observed image positions ----------
  const fPix = (height / 2) / Math.tan((FOV / 2) * Math.PI / 180);
  const dummy = new THREE.PerspectiveCamera(FOV, width / height, 0.3, 100);
  function anchor(t, px, py, d, minOff) {
    poseAt(t, dummy);
    dummy.updateMatrixWorld(true);
    const sx = width / 660, sy = height / 480;
    const xc = (px * sx - width / 2) / fPix * d;
    const yc = (height / 2 - py * sy) / fPix * d;
    const p = new THREE.Vector3(xc, yc, -d).applyMatrix4(dummy.matrixWorld);
    let best = 1e18, bi = 0;
    for (let i = 0; i < NS; i += 2) {
      const dx = p.x - PX[i], dz = p.z - PZ[i];
      const dd = dx * dx + dz * dz;
      if (dd < best) { best = dd; bi = i; }
    }
    const c = Math.cos(PTH[bi]), sn = Math.sin(PTH[bi]);
    const off = (p.x - PX[bi]) * c + (p.z - PZ[bi]) * sn;
    if (Math.abs(off) < minOff) {
      const sgn = off < 0 ? -1 : 1;
      const push = sgn * minOff - off;
      p.x += c * push; p.z += sn * push;
    }
    const camDir = new THREE.Vector3();
    dummy.getWorldDirection(camDir);
    return { p, groundY: PY[bi], yaw: Math.atan2(-camDir.x, -camDir.z) };
  }
  function sign(t, px, py, d, w, h, faceMat, decorate, minOff = 7.5) {
    const a = anchor(t, px, py, d, minOff);
    const g = new THREE.Group();
    g.position.copy(a.p);
    if (g.position.y - h / 2 < a.groundY + 0.4) g.position.y = a.groundY + 0.4 + h / 2;
    g.rotation.y = a.yaw;
    g.add(box(w, h, 0.25, faceMat));
    if (decorate) decorate(g, w, h);
    const bottom = g.position.y - h / 2;
    const postH = Math.max(0.2, bottom - a.groundY + 0.5);
    for (const sx of [-w * 0.3, w * 0.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, postH, 8), M.post);
      post.position.set(sx, -h / 2 - postH / 2, -0.1);
      g.add(post);
    }
    scene.add(g);
    return g;
  }
  const essoDeco = (g, w, h) => {
    const r = box(w * 0.7, h * 0.32, 0.1, M.red); r.position.z = 0.15; g.add(r);
    const b = box(w * 0.82, h * 0.07, 0.1, M.blue); b.position.set(0, -h * 0.3, 0.15); g.add(b);
    const b2 = box(w * 0.82, h * 0.07, 0.1, M.blue); b2.position.set(0, h * 0.3, 0.15); g.add(b2);
  };
  const arrowDeco = (g) => { const ar = box(0.7, 0.18, 0.1, M.black); ar.position.z = 0.15; g.add(ar); };
  sign(2.492, 362, 200, 33, 4, 3, M.white, essoDeco);          // Esso board far ahead at t=2.49
  sign(2.492, 450, 232, 14, 1.2, 1.6, M.signYellow, arrowDeco); // arrow board at t=2.49
  sign(3.336, 367, 203, 11.6, 1.2, 1.6, M.signYellow, arrowDeco); // arrow board at t=3.34
  sign(6.631, 530, 76, 9.7, 5, 3.4, M.white, (g) => {           // Advan board (anchored at t=6.63)
    const tri = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.0, 3), M.dark);
    tri.position.set(0, 0.3, 0.2); g.add(tri);
  }, 0);
  sign(5.827, 502, 90, 13.5, 6.5, 4.4, M.white, essoDeco, 0);      // Esso board at t=5.83

  // ---------- ground, lake, mountains, sky ----------
  let minY = 0;
  for (let i = 0; i < NS; i++) minY = Math.min(minY, PY[i]);
  const baseY = minY - 14;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = baseY;
  scene.add(ground);
  {
    const fr = frameAt(S(3.5));
    const cx = fr.x + Math.cos(fr.th) * 600, cz = fr.z + Math.sin(fr.th) * 600;
    let md = 1e18;
    for (let i = 0; i < NS; i += 4) md = Math.min(md, Math.hypot(PX[i] - cx, PZ[i] - cz));
    const R = Math.max(150, Math.min(900, md - 85));
    const lake = new THREE.Mesh(new THREE.CircleGeometry(R, 48), M.lake);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(cx, baseY + 2, cz);
    scene.add(lake);
  }
  {
    let cx = 0, cz = 0;
    for (let i = 0; i < NS; i++) { cx += PX[i]; cz += PZ[i]; }
    cx /= NS; cz /= NS;
    for (let k = 0; k < 22; k++) {
      const ang = (k / 22) * Math.PI * 2 + rng() * 0.2;
      const rad = 2300 + rng() * 700;
      const hgt = 320 + rng() * 260;
      const br = 700 + rng() * 450;
      const m = new THREE.Mesh(new THREE.ConeGeometry(br, hgt, 7), M.mountain);
      m.position.set(cx + Math.cos(ang) * rad, baseY + hgt / 2, cz + Math.sin(ang) * rad);
      m.rotation.y = rng() * Math.PI;
      scene.add(m);
    }
  }
  const skyGeo = new THREE.SphereGeometry(7000, 32, 16);
  {
    const top = new THREE.Color(0x2a5fcf), hor = new THREE.Color(0xb4cbe8);
    const pos = skyGeo.attributes.position;
    const cols = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 7000;
      const k = Math.pow(Math.max(0, y), 0.55);
      const c = hor.clone().lerp(top, Math.min(1, k * 1.25));
      cols.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x8a8a84, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-300, 600, 250);
  scene.add(sun);

  // ---------- yellow rival car (low sports car, articulated wheels) ----------
  const car = new THREE.Group();
  const body = box(1.76, 0.58, 4.3, M.carYellow); body.position.y = 0.55; car.add(body);
  const cabin = box(1.3, 0.36, 1.8, M.glass); cabin.position.set(0, 1.02, 0.35); car.add(cabin);
  const roof = box(1.2, 0.06, 1.2, M.carYellow); roof.position.set(0, 1.22, 0.45); car.add(roof);
  const wheels = [];
  for (const wx of [-0.78, 0.78]) for (const wz of [-1.25, 1.3]) {
    const piv = new THREE.Group();
    piv.position.set(wx, 0.32, wz);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16), M.tire);
    tire.rotation.z = Math.PI / 2; piv.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 10), M.hub);
    hub.rotation.z = Math.PI / 2; piv.add(hub);
    const spoke = box(0.27, 0.34, 0.06, M.tire); piv.add(spoke);
    car.add(piv);
    wheels.push(piv);
  }
  scene.add(car);
  // rear bumper position relative to the camera (m, + = ahead), lateral centre offset, yaw offset
  const Y_REAR = pchip([
    [0, -14], [10.5, -14], [11.615, -4.5], [12.459, -1.0], [13.262, -0.9], [14.106, -0.8],
    [14.950, 0.85], [15.754, 1.0], [16.598, 0.1], [17.442, -1.0], [18.246, -4.5], [19.13, -8.0], [22, -12],
  ]);
  const Y_LAT = pchip([
    [0, -2.6], [11.6, -2.8], [12.459, -2.85], [13.262, -2.1], [14.106, -1.9], [14.950, -2.3],
    [15.754, -2.3], [16.598, -1.95], [17.442, -2.2], [18.246, -2.6], [22, -2.6],
  ]);
  const Y_YAW = pchip([[0, 0], [13.3, 0], [14.106, 0.05], [14.95, 0.2], [15.754, 0.08], [16.598, 0.1], [17.442, 0.03], [18.3, 0], [22, 0]]);

  // ---------- camera-attached frame elements (pillarbox bars + mirror housing) ----------
  {
    const D = 0.5;
    const halfH = D * Math.tan((FOV / 2) * Math.PI / 180);
    const halfW = halfH * (width / height);
    const X = (px) => (px / 660 - 0.5) * 2 * halfW;
    const Yp = (py) => (0.5 - py / 480) * 2 * halfH;
    function overlay(x0, y0, x1, y1, color, order) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(X(x1) - X(x0), Yp(y0) - Yp(y1)),
        new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, fog: false })
      );
      m.position.set((X(x0) + X(x1)) / 2, (Yp(y0) + Yp(y1)) / 2, -D);
      m.renderOrder = order;
      camera.add(m);
    }
    overlay(-2, -2, 47, 482, 0x000000, 1000);
    overlay(645, -2, 662, 482, 0x000000, 1000);
    overlay(235, 52, 459, 112, 0x0a0a0a, 1001);
    overlay(239, 56, 455, 108, 0x606264, 1002);
  }

  function update(time, frame) {
    const t = Math.max(0, time);
    poseAt(t, camera);
    camera.updateMatrixWorld(true);
    sky.position.copy(camera.position);

    const sCam = S(t);
    const sCar = sCam + Y_REAR(t) + 2.15;
    const fr = frameAt(sCar);
    const lat = LAT(t) + Y_LAT(t);
    const cx = fr.x + Math.cos(fr.th) * lat, cz = fr.z + Math.sin(fr.th) * lat;
    car.position.set(cx, fr.y, cz);
    const yaw = fr.th + Y_YAW(t);
    const pitch = Math.atan(fr.g);
    car.up.set(0, 1, 0);
    car.lookAt(cx - Math.sin(yaw) * Math.cos(pitch), fr.y - Math.sin(pitch), cz + Math.cos(yaw) * Math.cos(pitch));
    const spin = -(sCar - SMIN) / 0.32;
    for (const w of wheels) w.rotation.x = spin;
  }

  update(0, 0);
  return { scene, camera, update };
}
