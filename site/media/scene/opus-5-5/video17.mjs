// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video17.
// Night star-tracking time-lapse over a crater lake: the camera sits on the rim and
// rotates about the celestial polar axis (equatorial tracker), so the sky (Milky Way,
// planets, stars) stays fixed in frame while the landscape rolls counter-clockwise
// and slides left. Sequence ends with a fade to black.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const W = width || 1280;
  const H = height || 720;
  const DUR = duration || 583 / 30;
  const LAKE_Y = -35; // lake surface, world units (~10 m) below the camera

  // ---------------------------------------------------------------- helpers
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
  const lin = (c) => { c = clamp01(c); return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  function keyed(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const u = (t - a[0]) / (b[0] - a[0]);
        const out = [];
        for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * u);
        return out;
      }
    }
    return keys[keys.length - 1].slice(1);
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32((seed | 0) ^ 0x51f17);
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // reference sample times (frame / 30)
  const SAMPLE_T = [0, 25, 51, 76, 101, 127, 152, 177, 202, 228, 253, 278, 304, 329, 354, 380, 405, 430, 455, 481, 506, 531, 557, 582].map((f) => f / 30);

  // ---------------------------------------------------------- tracker camera
  // Image-plane constants expressed in 960x540 reference-image units.
  const F_IMG = 376, CX = 480, CY = 270;
  const LAT = 43 * D2R;
  const PITCH = 13.275 * D2R, ROLL = 2.708 * D2R;
  const HA0 = -20.406, HA_RATE = 3.707; // hour-angle offset (deg) and tracking rate (deg/s of output time)
  const POLE = new THREE.Vector3(0, -Math.sin(LAT), -Math.cos(LAT)); // south celestial pole (world -Z = south)
  const F0 = new THREE.Vector3(0, Math.sin(PITCH), -Math.cos(PITCH));
  const R0p = new THREE.Vector3(1, 0, 0);
  const U0p = new THREE.Vector3(0, Math.cos(PITCH), Math.sin(PITCH));
  const R0 = R0p.clone().multiplyScalar(Math.cos(ROLL)).addScaledVector(U0p, Math.sin(ROLL));
  const U0 = R0p.clone().multiplyScalar(-Math.sin(ROLL)).addScaledVector(U0p, Math.cos(ROLL));
  const Q_BASE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(R0, U0, F0.clone().negate()));
  function camQuat(t, out) {
    out.setFromAxisAngle(POLE, (HA0 + HA_RATE * t) * D2R);
    return out.multiply(Q_BASE);
  }
  const localDir = (x, y) => new THREE.Vector3((x - CX) / F_IMG, -(y - CY) / F_IMG, -1).normalize();
  const _q = new THREE.Quaternion();
  function imgDir(si, x, y) { camQuat(SAMPLE_T[si], _q); return localDir(x, y).applyQuaternion(_q); }
  const aeOf = (v) => [Math.atan2(v.x, -v.z) / D2R, Math.asin(Math.max(-1, Math.min(1, v.y))) / D2R];
  const dirAE = (az, el) => new THREE.Vector3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));
  // entries are [sampleIndex, x, y] (position read from that reference sample) or ['w', az, el]
  const AE = (e) => (e[0] === 'w' ? [e[1], e[2]] : aeOf(imgDir(e[0], e[1], e[2])));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  const camera = new THREE.PerspectiveCamera(2 * Math.atan(CY / F_IMG) / D2R, W / H, 0.1, 4000);
  camera.position.set(0, 0, 0);
  scene.add(camera);

  // ------------------------------------------------------------- sky model
  // Sky colours are defined on the celestial sphere in tracker coordinates
  // (which coincide with the camera image plane, since the tracker follows the sky).
  // background gradient in image space: [t, top rgb (y=35), mid rgb (y=125), low rgb (y=225)] (sRGB 0-255)
  const BG_KEYS = [
    [0.0, 70, 138, 190, 116, 148, 194, 104, 110, 142],
    [0.83, 54, 86, 119, 74, 96, 125, 74, 85, 101],
    [1.7, 60, 77, 89, 76, 87, 94, 84, 85, 83],
    [3.37, 53, 73, 86, 65, 85, 92, 83, 89, 86],
    [5.07, 44, 73, 93, 57, 82, 100, 75, 91, 98],
    [5.9, 39, 74, 96, 53, 79, 103, 70, 91, 102],
    [8.43, 36, 74, 103, 43, 83, 112, 68, 88, 114],
    [10.13, 21, 75, 109, 39, 85, 119, 49, 97, 123],
    [11.8, 21, 75, 112, 27, 85, 123, 48, 95, 128],
    [13.5, 10, 85, 117, 18, 90, 126, 24, 101, 132],
    [16.03, 16, 79, 119, 12, 92, 130, 12, 107, 137],
    [18.57, 10, 82, 128, 11, 93, 138, 17, 101, 145],
  ];
  const MW_KEYS = [[0, 0.8], [0.83, 0.9], [1.7, 1.0], [10.1, 1.0], [13.5, 0.85], [18.6, 0.7]];
  const GLOW_KEYS = [ // light domes, airglow band, twilight
    [0, 0.5, 0.0, 1.0], [0.83, 0.8, 0.2, 0.45], [1.7, 1.0, 0.4, 0.1], [3.0, 1.0, 0.5, 0.0],
    [6.0, 1.0, 0.7, 0.0], [10.1, 0.8, 0.9, 0.0], [13.5, 0.6, 1.0, 0.0], [18.6, 0.45, 0.9, 0.0],
  ];
  const MW_LINE = [[-60, 368], [10, 385], [60, 413], [110, 443], [160, 458], [200, 470], [240, 488], [280, 497], [320, 505], [600, 560]];
  const MW_AMP = [[-60, 0.2], [10, 0.25], [60, 0.31], [110, 0.32], [160, 0.3], [200, 0.42], [240, 0.44], [280, 0.32], [310, 0.12], [340, 0.03], [400, 0]];
  function pw(tab, y) {
    if (y <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) {
      const a = tab[i - 1], b = tab[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]);
    }
    return tab[tab.length - 1][1];
  }
  const mwCenter = (y) => pw(MW_LINE, y);
  // seeded value noise for the mottled Milky Way texture
  const NOISE_N = 64;
  const noiseTab = new Float32Array(NOISE_N * NOISE_N);
  for (let i = 0; i < noiseTab.length; i++) noiseTab[i] = rand();
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (a, b) => noiseTab[(((b % NOISE_N) + NOISE_N) % NOISE_N) * NOISE_N + (((a % NOISE_N) + NOISE_N) % NOISE_N)];
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx;
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  }
  function mwRGB(x, y, out) {
    const dx = x - mwCenter(y);
    const A = pw(MW_AMP, y);
    const core = Math.exp(-(((y - 225) / 60) ** 2));
    const n = 0.55 * vnoise(x / 16, y / 16) + 0.45 * vnoise(x / 7 + 17, y / 7 + 5);
    const narrow = Math.exp(-((dx / (21 + 9 * core)) ** 2)) * (0.55 + 0.9 * n);
    const wide = Math.exp(-((dx / (52 + 20 * core)) ** 2)) * (0.75 + 0.5 * n);
    const halo = Math.exp(-((dx / 150) ** 2)) * (y < 300 ? 1 : Math.max(0, 1 - (y - 300) / 60));
    const lobe = Math.exp(-(((dx - 38) / 26) ** 2) - (((y - 205) / 75) ** 2)) * (0.6 + 0.8 * n);
    const blueTop = 0.5 + 0.2 * (1 - core);
    out[0] = A * (0.7 * narrow + 0.3 * wide) + 0.11 * lobe + 0.025 * halo;
    out[1] = A * (0.35 * narrow + 0.15 * wide) + 0.04 * lobe + 0.07 * halo;
    out[2] = A * blueTop * (0.7 * narrow + 0.3 * wide) + 0.04 * lobe + 0.1 * halo;
    return out;
  }
  // world-fixed atmospheric glow (yellow light domes, airglow band, early twilight)
  function glowRGB(az, el, g, out) {
    const vert = (c, s) => Math.exp(-(((el - c) / s) ** 2));
    const d1 = Math.exp(-(((az + 19) / 9) ** 2)) * vert(2.0, 2.6);
    const d2 = Math.exp(-(((az - 39) / 12) ** 2)) * vert(2.5, 2.8);
    const air = g[1] * vert(4, 7) * (0.75 + 0.25 * Math.exp(-(((az + 40) / 40) ** 2)));
    const tw = g[2] * vert(2, 8);
    const orange = g[2] * Math.exp(-(((az - 30) / 25) ** 2)) * vert(0.5, 4);
    out[0] += g[0] * (0.34 * d1 + 0.75 * d2) + air * 0.14 + tw * 0.2 + orange * 0.3;
    out[1] += g[0] * (0.31 * d1 + 0.55 * d2) + air * 0.13 + tw * 0.17 + orange * 0.2;
    out[2] += air * 0.0 + tw * 0.06 - orange * 0.1;
    return out;
  }
  function bgShade(x, y, t) { // early twilight: right-hand sky darker than the left
    const k = t < 1.7 ? 0.38 * (1 - t / 1.7) : 0;
    return 1 - k * clamp01((x - 250) / 650) * (1 - 0.6 * smooth(180, 340, y));
  }
  function bgRGB(bg, y, out) {
    let a, b, u;
    if (y <= 35) { a = 0; b = 0; u = 0; } else if (y <= 125) { a = 0; b = 3; u = (y - 35) / 90; } else if (y <= 225) { a = 3; b = 6; u = (y - 125) / 100; } else { a = 6; b = 6; u = 0; }
    out[0] = (bg[a] + (bg[b] - bg[a]) * u) / 255;
    out[1] = (bg[a + 1] + (bg[b + 1] - bg[a + 1]) * u) / 255;
    out[2] = (bg[a + 2] + (bg[b + 2] - bg[a + 2]) * u) / 255;
    return out;
  }

  // sky shell (part of the celestial sphere seen by the tracker)
  const skyGroup = new THREE.Group();
  scene.add(skyGroup);
  const SH_NX = 181, SH_NY = 112, SH_X0 = -60, SH_X1 = 1020, SH_Y0 = -60, SH_Y1 = 606;
  const shN = SH_NX * SH_NY;
  const shPos = new Float32Array(shN * 3), shCol = new Float32Array(shN * 3);
  const shX = new Float32Array(shN), shY = new Float32Array(shN), shMW = new Float32Array(shN * 3), shDir = new Float32Array(shN * 3);
  {
    const tmp = [0, 0, 0];
    for (let j = 0; j < SH_NY; j++) for (let i = 0; i < SH_NX; i++) {
      const k = j * SH_NX + i;
      const x = SH_X0 + (SH_X1 - SH_X0) * i / (SH_NX - 1);
      const y = SH_Y0 + (SH_Y1 - SH_Y0) * j / (SH_NY - 1);
      const d = localDir(x, y);
      shDir[k * 3] = d.x; shDir[k * 3 + 1] = d.y; shDir[k * 3 + 2] = d.z;
      shPos[k * 3] = d.x * 1000; shPos[k * 3 + 1] = d.y * 1000; shPos[k * 3 + 2] = d.z * 1000;
      shY[k] = y; shX[k] = x;
      mwRGB(x, y, tmp);
      shMW[k * 3] = tmp[0]; shMW[k * 3 + 1] = tmp[1]; shMW[k * 3 + 2] = tmp[2];
    }
  }
  const shIdx = [];
  for (let j = 0; j < SH_NY - 1; j++) for (let i = 0; i < SH_NX - 1; i++) {
    const a = j * SH_NX + i, b = a + 1, c = a + SH_NX, d = c + 1;
    shIdx.push(a, c, b, b, c, d);
  }
  const shGeo = new THREE.BufferGeometry();
  shGeo.setAttribute('position', new THREE.BufferAttribute(shPos, 3));
  const shColAttr = new THREE.BufferAttribute(shCol, 3);
  shGeo.setAttribute('color', shColAttr);
  shGeo.setIndex(shIdx);
  const skyShell = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  skyShell.frustumCulled = false;
  skyShell.renderOrder = -20;
  skyGroup.add(skyShell);

  // round sprite texture for stars and lights (generated in memory)
  const SPR = 32;
  const sprData = new Uint8Array(SPR * SPR * 4);
  for (let j = 0; j < SPR; j++) for (let i = 0; i < SPR; i++) {
    const r = Math.hypot(i + 0.5 - SPR / 2, j + 0.5 - SPR / 2) / (SPR / 2);
    const a = Math.max(0, 1 - r);
    const k = (j * SPR + i) * 4;
    sprData[k] = 255; sprData[k + 1] = 255; sprData[k + 2] = 255;
    sprData[k + 3] = Math.round(255 * Math.min(1, Math.pow(a, 1.6) * 1.6));
  }
  const sprite = new THREE.DataTexture(sprData, SPR, SPR, THREE.RGBAFormat);
  sprite.needsUpdate = true;

  // stars, planets (fixed on the celestial sphere = fixed in frame)
  function makeStars(n, size, bmin, bmax, mwFrac) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, y;
      y = -40 + rand() * 620;
      if (rand() < mwFrac) x = mwCenter(y) + gauss() * 55; else x = -40 + rand() * 1040;
      const d = localDir(x, y).multiplyScalar(950);
      pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
      const b = bmin + (bmax - bmin) * Math.pow(rand(), 2);
      const tint = rand();
      const cr = tint < 0.2 ? 1.0 : tint < 0.35 ? 0.8 : 0.92;
      const cb = tint < 0.2 ? 0.75 : tint < 0.35 ? 1.0 : 0.95;
      col[i * 3] = lin(b * cr); col[i * 3 + 1] = lin(b * 0.95); col[i * 3 + 2] = lin(b * cb);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -10;
    skyGroup.add(p);
    return p;
  }
  const starLayers = [
    makeStars(6500, 1.8, 0.3, 0.62, 0.3),
    makeStars(750, 2.6, 0.5, 0.88, 0.2),
    makeStars(60, 4.0, 0.8, 1.0, 0.1),
  ];
  function makePoint(parent, pos, size, rgb) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([pos.x, pos.y, pos.z]), 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    m.color.setRGB(lin(rgb[0]), lin(rgb[1]), lin(rgb[2]));
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    p.renderOrder = -9;
    parent.add(p);
    return p;
  }
  const jupiter = makePoint(skyGroup, localDir(349, 186).multiplyScalar(940), 11, [1.0, 0.97, 0.9]);
  const saturn = makePoint(skyGroup, localDir(293, 182).multiplyScalar(940), 7, [1.0, 0.92, 0.8]);
  const antares = makePoint(skyGroup, localDir(650, 240).multiplyScalar(940), 6, [1.0, 0.6, 0.45]);
  const planets = [jupiter, saturn, antares];

  // ------------------------------------------------------------- landscape
  function resample(list, step, closed) {
    const out = [];
    const n = list.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = list[i], b = list[(i + 1) % n];
      const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
    }
    if (!closed) out.push(list[n - 1].slice());
    return out;
  }
  function colorArr(rgb255) { return [lin(rgb255[0] / 255), lin(rgb255[1] / 255), lin(rgb255[2] / 255)]; }

  // polygon in (azimuth, elevation) space -> subdivided mesh placed by posFn
  function polyMesh(aeList, posFn, colFn, subdiv) {
    const pts = resample(aeList, 2.0, true);
    const contour = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    const pos = [], col = [], idx = [], aeArr = [];
    const N = subdiv;
    for (const f of faces) {
      const A = pts[f[0]], B = pts[f[1]], C = pts[f[2]];
      const base = pos.length / 3;
      const map = [];
      for (let i = 0; i <= N; i++) {
        map.push([]);
        for (let j = 0; j <= N - i; j++) {
          const a = 1 - (i + j) / N, b = i / N, c = j / N;
          const az = A[0] * a + B[0] * b + C[0] * c;
          const el = A[1] * a + B[1] * b + C[1] * c;
          const v = posFn(az, el);
          const cc = colFn(az, el);
          map[i].push(pos.length / 3);
          aeArr.push(az, el);
          pos.push(v.x, v.y, v.z);
          col.push(cc[0], cc[1], cc[2]);
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
        idx.push(map[i][j], map[i + 1][j], map[i][j + 1]);
        if (j < N - i - 1) idx.push(map[i + 1][j], map[i + 1][j + 1], map[i][j + 1]);
      }
      void base;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    m.userData.ae = aeArr;
    scene.add(m);
    return m;
  }
  const atHD = (az, el, hd) => new THREE.Vector3(Math.sin(az * D2R) * hd, hd * Math.tan(el * D2R), -Math.cos(az * D2R) * hd);
  const keepAboveLake = (el, hd, margin) => (el < 0 ? Math.min(hd, (-LAKE_Y - margin) / Math.tan(-el * D2R)) : hd);

  // far crater rim skyline (east -> west), ends at the near-rim peak K1
  const FAR_SKY = [
    [0, -160, 128], [0, -80, 150], [0, 0, 176], [0, 25, 186], [0, 50, 200], [0, 80, 215], [0, 110, 232], [0, 150, 250], [0, 185, 265],
    [7, 0, 358], [7, 30, 350], [7, 60, 345], [7, 110, 338], [7, 160, 342], [7, 200, 347], [7, 235, 352], [7, 255, 343],
    [7, 290, 345], [7, 330, 343], [7, 370, 355], [7, 420, 360], [7, 500, 360], [7, 560, 362], [7, 620, 360], [7, 660, 355], [7, 700, 345],
    [12, 640, 290],
  ].map(AE);
  let farWall = null;
  const fwAz = [], fwRow = [];
  {
    const pts = resample(FAR_SKY, 1.2, false);
    const pos = [], col = [], idx = [];
    pts.forEach(([az, el], i) => {
      const top = dirAE(az, el).multiplyScalar(700);
      const bot = new THREE.Vector3(Math.sin(az * D2R) * 595, LAKE_Y - 0.3, -Math.cos(az * D2R) * 595);
      const mid = top.clone().lerp(bot, 0.3);
      pos.push(top.x, top.y, top.z, mid.x, mid.y, mid.z, bot.x, bot.y, bot.z);
      col.push(1, 1, 1, 1, 1, 1, 1, 1, 1);
      fwAz.push(az, az, az);
      fwRow.push(1.12, 1.0, 0.85);
      if (i > 0) {
        const a = (i - 1) * 3, b = i * 3;
        idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    farWall = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    scene.add(farWall);
  }

  // near rim on the right (west): crest from K1 rising toward the camera, cliff face down to the lake shore
  const CREST = [
    [12, 640, 290], [12, 700, 250], [12, 760, 248], [12, 840, 235], [16, 790, 180], [16, 850, 150], [22, 705, 60], [22, 725, 0],
    ['w', 88, 18], ['w', 100, 22], ['w', 120, 26], ['w', 150, 26],
  ].map(AE);
  const NEAR_RIM = CREST.concat([
    ['w', 150, -70], ['w', 6, -70], ['w', 6, -58], ['w', 8, -47], ['w', 10.5, -38], ['w', 13, -32],
    [22, 460, 540], [22, 468, 490], [22, 475, 430], [22, 455, 395], ['w', 24.5, -10], [12, 548, 385],
    [22, 405, 350], [12, 560, 340], [12, 600, 315],
  ].map(AE));
  const HD_TABLE = [[20, 250], [37, 250], [45, 110], [55, 45], [65, 20], [75, 10], [85, 7], [100, 5], [150, 4]];
  function hdCliff(az) {
    if (az <= HD_TABLE[0][0]) return HD_TABLE[0][1];
    for (let i = 1; i < HD_TABLE.length; i++) if (az <= HD_TABLE[i][0]) {
      const a = HD_TABLE[i - 1], b = HD_TABLE[i];
      return Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * (az - a[0]) / (b[0] - a[0]));
    }
    return HD_TABLE[HD_TABLE.length - 1][1];
  }
  function crestElAt(az) {
    for (let i = 1; i < CREST.length; i++) if (az <= CREST[i][0]) {
      const a = CREST[i - 1], b = CREST[i]; return a[1] + (b[1] - a[1]) * (az - a[0]) / (b[0] - a[0]);
    }
    return CREST[CREST.length - 1][1];
  }
  const cliffPos = (az, el) => atHD(az, el, keepAboveLake(el, hdCliff(az), 1.0));
  const nearRim = polyMesh(NEAR_RIM, cliffPos, () => [1, 1, 1], 6);

  // left foreground rim ground (rocks under the photographer's viewpoint, east side)
  const LEFT_GROUND = [
    ['w', -100, -24], [0, 0, 470], [0, 60, 470], [0, 110, 440], [0, 130, 415], [0, 170, 420], [0, 215, 440], [0, 240, 440],
    [7, 190, 500], [7, 230, 485], [7, 260, 490], [7, 300, 510], [7, 320, 540], [0, 420, 540],
    ['w', -11, -30], ['w', -8.5, -38], ['w', -6.5, -50], ['w', -5.5, -70], ['w', -100, -70],
  ].map(AE);
  const leftGround = polyMesh(LEFT_GROUND, (az, el) => atHD(az, el, keepAboveLake(el, 6, 2)), (az) => {
    const s = 0.8 + 0.2 * smooth(-50, -30, az);
    return [s, s, s];
  }, 4);

  // lake (polar grid around the camera; colours = dark water + mirrored sky + mist)
  const LK_AZ0 = -92, LK_AZ1 = 62, LK_NA = 124, LK_NR = 42, LK_R0 = 15, LK_R1 = 625;
  const lkN = LK_NA * LK_NR;
  const lkPos = new Float32Array(lkN * 3), lkCol = new Float32Array(lkN * 3);
  const lkAz = new Float32Array(lkN), lkDep = new Float32Array(lkN), lkHd = new Float32Array(lkN), lkDir = new Float32Array(lkN * 3);
  for (let r = 0; r < LK_NR; r++) for (let a = 0; a < LK_NA; a++) {
    const k = r * LK_NA + a;
    const az = LK_AZ0 + (LK_AZ1 - LK_AZ0) * a / (LK_NA - 1);
    const hd = LK_R0 * Math.pow(LK_R1 / LK_R0, r / (LK_NR - 1));
    const p = new THREE.Vector3(Math.sin(az * D2R) * hd, LAKE_Y, -Math.cos(az * D2R) * hd);
    lkPos[k * 3] = p.x; lkPos[k * 3 + 1] = p.y; lkPos[k * 3 + 2] = p.z;
    const d = p.clone().normalize();
    lkDir[k * 3] = d.x; lkDir[k * 3 + 1] = d.y; lkDir[k * 3 + 2] = d.z;
    lkAz[k] = az; lkHd[k] = hd; lkDep[k] = Math.atan2(-LAKE_Y, hd) / D2R;
  }
  // elevation (seen from each lake point, looking outward along the reflected ray) of the terrain
  // that the mirror ray would hit: far crater wall, or the near rim beyond the near-rim peak
  const skyPts = resample(FAR_SKY, 1.0, false);
  function skyElAt(az) {
    if (az <= skyPts[0][0]) return skyPts[0][1];
    for (let i = 1; i < skyPts.length; i++) if (az <= skyPts[i][0]) {
      const a = skyPts[i - 1], b = skyPts[i]; return a[1] + (b[1] - a[1]) * (az - a[0]) / (b[0] - a[0]);
    }
    return skyPts[skyPts.length - 1][1];
  }
  const lkWall = new Float32Array(lkN);
  for (let k = 0; k < lkN; k++) {
    const az = lkAz[k], hd = lkHd[k];
    let hObs, yTop;
    if (az <= 36.7) { hObs = 650; yTop = 700 * Math.sin(skyElAt(az) * D2R); }
    else { hObs = hdCliff(az); yTop = hObs * Math.tan(crestElAt(az) * D2R); }
    lkWall[k] = hObs > hd + 5 ? Math.atan2(yTop - LAKE_Y, hObs - hd) / D2R : 90;
  }
  const lkIdx = [];
  for (let r = 0; r < LK_NR - 1; r++) for (let a = 0; a < LK_NA - 1; a++) {
    const i0 = r * LK_NA + a, i1 = i0 + 1, i2 = i0 + LK_NA, i3 = i2 + 1;
    lkIdx.push(i0, i2, i1, i1, i2, i3);
  }
  const lkGeo = new THREE.BufferGeometry();
  lkGeo.setAttribute('position', new THREE.BufferAttribute(lkPos, 3));
  const lkColAttr = new THREE.BufferAttribute(lkCol, 3);
  lkGeo.setAttribute('color', lkColAttr);
  lkGeo.setIndex(lkIdx);
  const lake = new THREE.Mesh(lkGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
  lake.frustumCulled = false;
  scene.add(lake);
  const FOG_KEYS = [[0, 1.0], [0.83, 0.6], [1.7, 0.3], [3.4, 0.12], [5.0, 0.0]];

  // cinder island: low hull rising from its observed front waterline to its observed ridge line
  // (thick cinder-cone end to the east/left, thin lava tongue reaching the west shore)
  const islandMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide });
  let island;
  {
    const ISL_BOT = [[-18.9, -6.6], [-16.1, -8.6], [-9.3, -10.9], [-2.3, -11.1], [4.7, -9.7], [11.8, -8.3], [18.5, -7.0], [22.5, -5.5]];
    const ISL_TOP = [[-18.9, -6.6], [-16.1, -5.4], [-9.3, -4.4], [-2.3, -3.8], [4.7, -4.1], [11.8, -4.1], [18.5, -4.4], [22.5, -5.5]];
    const pos = [], idx = [];
    const lakeHd = (el) => (-LAKE_Y - 0.2) / Math.tan(-el * D2R);
    for (let i = 0; i < ISL_BOT.length; i++) {
      const [ab, eb] = ISL_BOT[i], [at, et] = ISL_TOP[i];
      const hb = lakeHd(eb);
      const b = atHD(ab, 0, hb); b.y = LAKE_Y + 0.2;
      const ht = (i === 0 || i === ISL_BOT.length - 1) ? hb : hb + 50;
      const tp = atHD(at, et, ht);
      if (i === 0 || i === ISL_BOT.length - 1) tp.copy(b);
      const back = atHD(at, 0, ht + 60); back.y = LAKE_Y + 0.2;
      pos.push(b.x, b.y, b.z, tp.x, tp.y, tp.z, back.x, back.y, back.z);
      if (i > 0) {
        const p = (i - 1) * 3, c = i * 3;
        idx.push(p, c, p + 1, p + 1, c, c + 1, p + 1, c + 1, p + 2, p + 2, c + 1, c + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    island = new THREE.Mesh(g, islandMat);
    scene.add(island);
  }

  // snow patches along the near shore
  const snowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const snowBase = colorArr([125, 130, 145]);
  [[21.2, -6.6, 1.4], [22.2, -8.2, 1.0], [23.6, -10.6, 1.2], [25.0, -13.6, 0.9], [25.6, -16.4, 0.8]].forEach(([az, el, s]) => {
    const p = cliffPos(az, el).multiplyScalar(0.97);
    const dist = p.length();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), snowMat);
    m.scale.set(dist * s * D2R, dist * 0.35 * D2R, 1);
    m.position.copy(p);
    m.lookAt(0, 0, 0);
    scene.add(m);
  });

  // trees (cone crown + thin trunk) and a dead snag
  const treeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const treeBase = colorArr([11, 15, 16]);
  const redTreeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  function addTree(az, elBase, elTop, hd, radius, mat) {
    const yb = hd * Math.tan(elBase * D2R), yt = hd * Math.tan(elTop * D2R);
    const h = yt - yb;
    const x = Math.sin(az * D2R) * hd, z = -Math.cos(az * D2R) * hd;
    const g = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.ConeGeometry(radius, h * 0.85, 10), mat);
    crown.position.y = yb + h * 0.15 + h * 0.85 / 2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.08, radius * 0.1, h * 0.3, 6), mat);
    trunk.position.y = yb + h * 0.15;
    g.add(crown, trunk);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  {
    const t0 = AE([0, 30, 345]), t1 = AE([0, 78, 325]), t2 = AE([0, 205, 355]), t3 = AE([0, 360, 445]);
    addTree(t0[0], -32, t0[1], 6, 0.5, treeMat);
    addTree(t1[0], -32, t1[1], 6, 0.75, treeMat);
    addTree(t2[0], -28, t2[1], 6, 0.5, redTreeMat);
    addTree(t3[0], -22, t3[1], 6, 0.25, treeMat);
    // crest conifers on the near (west) rim
    [[61, 8, 3], [66.5, 9.5, 3], [70, 11, 3.5], [74, 22, 8], [78, 28, 10], [82.5, 33, 10], [88, 36, 10], [95, 38, 10]].forEach(([az, top, wDeg]) => {
      const hd = hdCliff(az) * 0.95;
      addTree(az, crestElAt(az) - 0.5, top, hd, hd * Math.tan(wDeg * 0.5 * D2R), treeMat);
    });
  }
  const snagMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const snagBase = colorArr([112, 106, 106]);
  {
    // leaning dead snag: segment between its observed top and base directions
    const st = AE([0, 335, 372]), sb = AE([0, 327, 520]);
    const top = atHD(st[0], st[1], 6), bot = atHD(sb[0], sb[1], 6);
    const axis = top.clone().sub(bot);
    const snag = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, axis.length(), 6), snagMat);
    snag.position.copy(top).add(bot).multiplyScalar(0.5);
    snag.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    scene.add(snag);
  }

  // transient lights: blue lamp on the far shore, car lights on the west rim road
  const blueLamp = makePoint(scene, dirAE(-7.4, -0.9).multiplyScalar(560), 16, [0.6, 0.9, 1.0]);
  const carPos = atHD(62.5, crestElAt(62.5) - 0.3, hdCliff(62.5) * 0.9);
  const carLight = makePoint(scene, carPos, 18, [1.0, 0.45, 0.3]);
  const pulse = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);

  // final fade to black (cinematic fade, part of the reference sequence)
  const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), fadeMat);
  fade.position.set(0, 0, -0.5);
  fade.renderOrder = 999;
  fade.frustumCulled = false;
  camera.add(fade);

  // ---------------------------------------------------------------- update
  const _v = new THREE.Vector3();
  const _qi = new THREE.Quaternion();
  const tmp = [0, 0, 0];
  // landscape colours (sRGB 0-255) keyed on time, calibrated against the reference samples
  const FW_KEYS = [ // far wall base rgb + extra twilight haze on the east (left) part
    [0, 54, 62, 82, 50, 50, 60], [0.83, 36, 46, 60, 20, 20, 25], [1.7, 28, 40, 50, 5, 5, 5], [5.0, 16, 27, 38, 0, 0, 0],
    [10.1, 8, 20, 36, 0, 0, 0], [13.5, 8, 19, 30, 0, 0, 0], [18.6, 22, 40, 56, 0, 0, 0],
  ];
  const FACE_KEYS = [[0, 12, 11, 15], [8.0, 11, 10, 13], [10.1, 18, 20, 26], [13.5, 60, 64, 68], [18.6, 64, 66, 72]];
  const SLOPE_KEYS = [[0, 10, 9, 12], [8.0, 11, 9, 12], [13.5, 22, 20, 26], [18.6, 26, 25, 33]];
  const LG_KEYS = [[0, 36, 27, 36], [1.7, 22, 21, 24], [5.0, 16, 15, 18], [10.0, 14, 13, 16]];
  const ISL_KEYS = [[0, 20, 30, 45], [1.7, 10, 16, 26], [5.9, 7, 12, 20], [18.6, 8, 14, 22]];
  const fwCol = farWall.geometry.getAttribute('color');
  const nrCol = nearRim.geometry.getAttribute('color');
  const nrAE = nearRim.userData.ae;
  const STAR_KEYS = [[0, 0.45], [0.83, 0.75], [1.7, 1.0], [13.5, 0.9], [18.6, 0.75]];

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, DUR));
    camQuat(t, camera.quaternion);
    camera.updateMatrixWorld(true);
    skyGroup.quaternion.copy(camera.quaternion);
    _qi.copy(camera.quaternion).invert();

    const bg = keyed(BG_KEYS, t);
    const M = keyed(MW_KEYS, t)[0];
    const gk = keyed(GLOW_KEYS, t);

    // sky shell
    for (let k = 0; k < shN; k++) {
      bgRGB(bg, shY[k], tmp);
      const shd = bgShade(shX[k], shY[k], t); tmp[0] *= shd; tmp[1] *= shd; tmp[2] *= shd;
      tmp[0] += M * shMW[k * 3];
      tmp[1] += M * shMW[k * 3 + 1];
      tmp[2] += M * shMW[k * 3 + 2];
      _v.set(shDir[k * 3], shDir[k * 3 + 1], shDir[k * 3 + 2]).applyQuaternion(camera.quaternion);
      const ae = aeOf(_v);
      if (ae[1] > -6) glowRGB(ae[0], Math.max(ae[1], -1), gk, tmp);
      shCol[k * 3] = lin(tmp[0]); shCol[k * 3 + 1] = lin(tmp[1]); shCol[k * 3 + 2] = lin(tmp[2]);
    }
    shColAttr.needsUpdate = true;

    // lake: water + reflection of the (camera-fixed) sky and the world-fixed glow + early mist
    const fogA = keyed(FOG_KEYS, t)[0];
    const fwl = keyed(FW_KEYS, t);
    const wb = [4 / 255, 8 / 255, 16 / 255];
    const sk = [0, 0, 0];
    for (let k = 0; k < lkN; k++) {
      _v.set(lkDir[k * 3], -lkDir[k * 3 + 1], lkDir[k * 3 + 2]).applyQuaternion(_qi);
      let x = 480, y = 120;
      if (_v.z < -0.05) { x = CX + F_IMG * _v.x / -_v.z; y = CY - F_IMG * _v.y / -_v.z; }
      x = Math.max(-400, Math.min(1400, x)); y = Math.max(-400, Math.min(900, y));
      mwRGB(x, y, sk);
      bgRGB(bg, y, tmp);
      const shd2 = bgShade(x, y, t); tmp[0] *= shd2; tmp[1] *= shd2; tmp[2] *= shd2;
      tmp[0] += M * sk[0]; tmp[1] += M * sk[1]; tmp[2] += M * sk[2];
      const dep = lkDep[k], az = lkAz[k], hd = lkHd[k];
      glowRGB(az, dep, gk, tmp);
      // mirror ray hits the dark crater wall instead of the sky near the far shore
      const wHit = 0.6 * (1 - smooth(lkWall[k] - 0.35, lkWall[k] + 0.35, dep));
      if (wHit > 0) {
        tmp[0] += (fwl[0] / 255 - tmp[0]) * wHit;
        tmp[1] += (fwl[1] / 255 - tmp[1]) * wHit;
        tmp[2] += (fwl[2] / 255 - tmp[2]) * wHit;
      }
      const R = 0.42 + 0.15 * Math.exp(-dep / 5);
      let r = wb[0] * (1 - R) + R * tmp[0];
      let g = wb[1] * (1 - R) + R * tmp[1];
      let b = wb[2] * (1 - R) + R * tmp[2];
      if (fogA > 0) {
        const f = fogA * (Math.exp(-(((az + 55) / 22) ** 2)) * smooth(100, 350, hd) + 0.5 * Math.exp(-(((az + 28) / 12) ** 2)) * smooth(150, 300, hd));
        r += f * 0.06; g += f * 0.07; b += f * 0.09;
      }
      lkCol[k * 3] = lin(r); lkCol[k * 3 + 1] = lin(g); lkCol[k * 3 + 2] = lin(b);
    }
    lkColAttr.needsUpdate = true;

    // landscape brightness
    const fw = keyed(FW_KEYS, t);
    for (let k = 0; k < fwAz.length; k++) {
      const w = clamp01((10 - fwAz[k]) / 75), rf = fwRow[k];
      fwCol.setXYZ(k, lin(rf * (fw[0] + fw[3] * w) / 255), lin(rf * (fw[1] + fw[4] * w) / 255), lin(rf * (fw[2] + fw[5] * w) / 255));
    }
    fwCol.needsUpdate = true;
    const fc = keyed(FACE_KEYS, t), sc = keyed(SLOPE_KEYS, t);
    for (let k = 0; k < nrAE.length / 2; k++) {
      const az = nrAE[k * 2], el = nrAE[k * 2 + 1];
      const s = smooth(30, 46, az);
      const kk = 0.85 + 0.15 * smooth(-30, 0, el);
      nrCol.setXYZ(k, lin(kk * (fc[0] + (sc[0] - fc[0]) * s) / 255), lin(kk * (fc[1] + (sc[1] - fc[1]) * s) / 255), lin(kk * (fc[2] + (sc[2] - fc[2]) * s) / 255));
    }
    nrCol.needsUpdate = true;
    const lg = keyed(LG_KEYS, t);
    leftGround.material.color.setRGB(lin(lg[0] / 255), lin(lg[1] / 255), lin(lg[2] / 255));
    const isl = keyed(ISL_KEYS, t);
    islandMat.color.setRGB(lin(isl[0] / 255), lin(isl[1] / 255), lin(isl[2] / 255));
    treeMat.color.setRGB(treeBase[0], treeBase[1], treeBase[2]);
    snowMat.color.setRGB(snowBase[0], snowBase[1], snowBase[2]);
    // red head-lamp sweep on the foreground tree and snag around t = 5.07 s
    const red = pulse(t, 5.07, 0.45);
    redTreeMat.color.setRGB(treeBase[0] + 0.3 * red, treeBase[1] + 0.005 * red, treeBase[2] + 0.005 * red);
    snagMat.color.setRGB(snagBase[0] * (1 - red) + 0.45 * red, snagBase[1] * (1 - red) + 0.02 * red, snagBase[2] * (1 - red) + 0.02 * red);

    // stars and planets
    const sv = keyed(STAR_KEYS, t)[0];
    starLayers.forEach((p) => { p.material.opacity = sv; });
    planets.forEach((p) => { p.material.opacity = Math.min(1, 0.6 + 0.4 * sv); });

    // transient lights
    blueLamp.material.opacity = pulse(t, 1.7, 0.35);
    blueLamp.visible = blueLamp.material.opacity > 0;
    carLight.material.opacity = Math.max(pulse(t, 13.5, 0.35), pulse(t, 16.87, 0.35));
    carLight.visible = carLight.material.opacity > 0;

    // fade to black at the end
    fadeMat.opacity = 0.97 * smooth(18.62, DUR, t);
    fade.visible = fadeMat.opacity > 0.001;
  }

  update(0, 0);
  return { scene, camera, update };
}
