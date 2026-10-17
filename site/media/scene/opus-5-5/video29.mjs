// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video29.
// One dancer (black shirt/pants, bandana, blue glasses) on a dark glossy stage,
// thick stage smoke, a ring of horizontal white light bars at camera height.
// Camera orbits the dancer to its left (bars sweep image-left), decelerates, stops.
// Dancer: kneel -> low lunge (profile right) -> stands back to camera -> turns
// (profile left) -> jumps and hangs in the air facing camera, arms spread ->
// slowly turns away (profile right -> back to camera) while still airborne.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // ---------- deterministic RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32((seed | 0) ^ 0x2929);

  // ---------- interpolation helpers ----------
  function makeTrack(keys, linear) {
    const n = keys.length;
    const t = keys.map(k => k[0]);
    const p = keys.map(k => k[1]);
    const m = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) { m[i] = 0; continue; }
      const d0 = p[i] - p[i - 1], d1 = p[i + 1] - p[i];
      if (d0 * d1 <= 0) { m[i] = 0; continue; }
      m[i] = (p[i + 1] - p[i - 1]) / (t[i + 1] - t[i - 1]);
    }
    return function (x) {
      if (x <= t[0]) return p[0];
      if (x >= t[n - 1]) return p[n - 1];
      let i = 0;
      while (i < n - 2 && x > t[i + 1]) i++;
      const h = t[i + 1] - t[i];
      const s = (x - t[i]) / h;
      if (linear) return p[i] + (p[i + 1] - p[i]) * s;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * p[i] + (s3 - 2 * s2 + s) * h * m[i] +
        (-2 * s3 + 3 * s2) * p[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const s = clamp((x - a) / (b - a), 0, 1); return s * s * (3 - 2 * s); };

  // ---------- camera model ----------
  const VFOV = 27.6;
  const F = 270 / Math.tan((VFOV * Math.PI / 180) / 2); // focal length in 960x540 pixel units
  const CAM_H = 1.32;
  const PITCH = -35 / F;
  const RB = 20;          // light-bar ring radius
  const NBARS = 22;
  const BAR_LEN = 3.35;
  const BAR_H = 1.32;

  const camera = new THREE.PerspectiveCamera(VFOV, width / height, 0.1, 200);
  scene.add(camera);

  // Observed bar-pattern shift (960-px units, cumulative, unwrapped leftward) at sample frames
  const sKeys = [[0, 0], [8, -121], [16, -249], [24, -355], [33, -498], [41, -621], [49, -748],
    [57, -861], [65, -989], [73, -1060], [81, -1091], [89, -1120], [98, -1154], [106, -1188],
    [114, -1220], [122, -1251], [130, -1284], [138, -1316], [146, -1349], [154, -1316],
    [163, -1350], [171, -1348], [179, -1352], [187, -1354]];
  // Dancer horizontal image offset from center (960-px units) at sample frames
  const xdKeys = [[0, -10], [8, -10], [16, 0], [24, 10], [33, 10], [41, 15], [49, 15], [57, 10],
    [65, 30], [73, 30], [81, 30], [89, 35], [98, 30], [106, 25], [114, 25], [122, 20], [130, 10],
    [138, 10], [146, 5], [154, -10], [163, -30], [171, -35], [179, -35], [187, -35]];
  const rcKeys = [[0, 6.0], [41, 6.0], [49, 5.8], [57, 5.35], [65, 5.15], [73, 5.1], [187, 5.1]];
  const sTrack = makeTrack(sKeys, true);
  const xdTrack = makeTrack(xdKeys, true);
  const rcTrack = makeTrack(rcKeys, false);

  // Precompute orbit azimuth per frame so the bar pattern behind the dancer matches samples.
  const NF = Math.max(200, Math.ceil(duration * fps) + 4);
  const phiTab = new Float64Array(NF + 1);
  {
    let prev = sTrack(0) - xdTrack(0);
    phiTab[0] = 0;
    for (let k = 1; k <= NF; k++) {
      const s = sTrack(k) - xdTrack(k);
      const rc = rcTrack(k);
      phiTab[k] = phiTab[k - 1] + (s - prev) / F * (RB + rc) / RB;
      prev = s;
    }
  }
  function phiAt(fr) {
    const x = clamp(fr, 0, NF);
    const i = Math.min(NF - 1, Math.floor(x));
    const s = x - i;
    return phiTab[i] * (1 - s) + phiTab[i + 1] * s;
  }
  // Bar phase: at frame 0 a bar centre is 63 px left of the dancer direction.
  const delta0 = (63 / F) * (RB + 6.0) / RB;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xc8d4e4, 0x0a0a0c, 0.7);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.8);
  scene.add(rim); scene.add(rim.target);

  // ---------- floor ----------
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64),
    new THREE.MeshBasicMaterial({ color: 0x050506 }));
  floor.rotation.x = -Math.PI / 2;
  floor.material.depthWrite = false; floor.renderOrder = -1;
  scene.add(floor);

  // ---------- light bars (ring) ----------
  function gradTex(w, h, fn) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = clamp(fn(x / (w - 1), y / (h - 1)), 0, 1);
      const i = (y * w + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.needsUpdate = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    return t;
  }
  const glowTex = gradTex(64, 32, (u, v) => {
    const dy = Math.abs(v - 0.5) * 2, dx = Math.max(0, Math.abs(u - 0.5) * 2 - 0.85) / 0.15;
    return Math.pow(1 - Math.min(1, dy), 2.5) * (1 - Math.min(1, dx));
  });
  const barMat = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xc8d6ea, transparent: true,
    opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const barGeo = new THREE.BoxGeometry(BAR_LEN, 0.13, 0.1);
  const glowGeo = new THREE.PlaneGeometry(BAR_LEN * 1.06, 0.7);
  const bars = [];
  for (let j = 0; j < NBARS; j++) {
    const a = Math.PI + delta0 + j * 2 * Math.PI / NBARS;
    const g = new THREE.Group();
    g.position.set(RB * Math.sin(a), BAR_H, RB * Math.cos(a));
    g.rotation.y = a;
    const b = new THREE.Mesh(barGeo, barMat);
    g.add(b);
    const gl = new THREE.Mesh(glowGeo, glowMat);
    gl.rotation.y = Math.PI; gl.position.z = -0.05;
    g.add(gl);
    scene.add(g);
    bars.push({ a, x: RB * Math.sin(a), z: RB * Math.cos(a) });
  }

  // Floor reflections of the bars (view-dependent glossy streaks), procedural.
  const COLS = [0, 0.25, 0.7, 1, 0.7, 0.25, 0];
  const NC = COLS.length;
  const reflMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const refl = [];
  for (let j = 0; j < NBARS; j++) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(3 * NC * 3);
    const col = new Float32Array(3 * NC * 3);
    const idx = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < NC - 1; c++) {
      const f0 = r * NC + c, f1 = f0 + 1, n0 = f0 + NC, n1 = n0 + 1;
      idx.push(f0, n0, f1, f1, n0, n1);
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < NC; c++) {
      const i = r * NC + c;
      const v = COLS[c] * (r === 0 ? 0.0 : r === 1 ? 0.27 : 0.09);
      col[i * 3] = v * 0.95; col[i * 3 + 1] = v * 0.98; col[i * 3 + 2] = v;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, reflMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    refl.push(mesh);
  }

  // ---------- dancer (articulated proxy) ----------
  const M = (c, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0 }, extra || {}));
  const matShirt = M(0x1c1d21), matPants = M(0x151518), matSkin = M(0xc49a80),
    matShoe = M(0x0b0b0c), matBand = M(0x8c8f94), matGlass = M(0x2a70e0, { emissive: 0x16408a, roughness: 0.3 });
  function limb(len, r0, r1, mat) {
    const g = new THREE.CylinderGeometry(r0, r1, len, 10);
    g.translate(0, -len / 2, 0);
    return new THREE.Mesh(g, mat);
  }
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; scene.add(root);
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.21), matPants); root.add(pelvis);
  const spine = new THREE.Group(); spine.position.y = 0.06; spine.rotation.order = 'YXZ'; root.add(spine);
  const torsoGeo = new THREE.BoxGeometry(0.36, 0.52, 0.22); torsoGeo.translate(0, 0.27, 0);
  spine.add(new THREE.Mesh(torsoGeo, matShirt));
  const neck = new THREE.Group(); neck.position.y = 0.52; neck.rotation.order = 'YXZ'; spine.add(neck);
  const neckMesh = limb(0.1, 0.05, 0.05, matSkin); neckMesh.position.y = 0.1; neck.add(neckMesh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 12), matSkin); head.position.y = 0.13; neck.add(head);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), matBand);
  band.position.y = 0.145; neck.add(band);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.113, 14, 10), M(0x2a2420)); hair.position.set(0, 0.135, -0.014); neck.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), matBand); bun.position.set(0, 0.24, -0.07); neck.add(bun);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.03), matGlass); glass.position.set(0, 0.14, 0.1); neck.add(glass);

  function makeArm(side) {
    const sh = new THREE.Group(); sh.position.set(0.2 * side, 0.47, 0); sh.rotation.order = 'YZX'; spine.add(sh);
    sh.add(limb(0.15, 0.06, 0.055, matShirt));
    const up = limb(0.16, 0.042, 0.038, matSkin); up.position.y = -0.14; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
    el.add(limb(0.26, 0.036, 0.03, matSkin));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), matSkin); hand.position.y = -0.3; el.add(hand);
    return { sh, el };
  }
  function makeLeg(side) {
    const hp = new THREE.Group(); hp.position.set(0.1 * side, -0.05, 0); hp.rotation.order = 'ZXY'; root.add(hp);
    hp.add(limb(0.45, 0.085, 0.065, matPants));
    const kn = new THREE.Group(); kn.position.y = -0.45; hp.add(kn);
    kn.add(limb(0.43, 0.062, 0.05, matPants));
    const an = new THREE.Group(); an.position.y = -0.43; kn.add(an);
    const footGeo = new THREE.BoxGeometry(0.1, 0.08, 0.26); footGeo.translate(0, -0.035, 0.07);
    an.add(new THREE.Mesh(footGeo, matShoe));
    return { hp, kn, an };
  }
  const armL = makeArm(1), armR = makeArm(-1);
  const legL = makeLeg(1), legR = makeLeg(-1);

  // ---------- pose keys (frames) ----------
  const PN = ['alpha', 'rootY', 'rootPitch', 'rootRoll', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'hdZ',
    'lsX', 'lsY', 'lsZ', 'leX', 'rsX', 'rsY', 'rsZ', 'reX', 'lhX', 'lhZ', 'lkX', 'laX', 'rhX', 'rhZ', 'rkX', 'raX'];
  const poseKeys = [
    { f: 0, alpha: -10, rootY: 0.55, spX: 1.15, hdX: -0.35, lsX: -1.0, lsZ: 0.45, leX: -0.1, rsX: -0.9, rsZ: -0.4, reX: -0.4,
      lhX: -1.35, lkX: 2.08, laX: -0.73, rhX: 0.15, rkX: 1.35, raX: 1.5 },
    { f: 8, alpha: 15, spX: 1.2, hdX: -0.25 },
    { f: 16, alpha: 50, spX: 1.25, hdX: -0.05 },
    { f: 24, alpha: 70, rootY: 0.72, spX: 0.8, hdX: 0.15, lsX: -0.75, lsZ: 0.15, leX: -0.3, rsX: -0.95, rsZ: -0.15, reX: -0.6,
      lhX: -1.2, lkX: 1.2, laX: 0, rhX: 0.35, rkX: 0.8, raX: -0.7 },
    { f: 33, alpha: 90, rootY: 0.86, spX: 0.72, hdX: 0.15, lsX: -0.65, lsZ: 0.1, leX: -0.25, rsX: -0.7, rsZ: -0.1, reX: -0.3,
      lhX: -0.75, lkX: 1.0, laX: -0.25, rhX: 0.6, rkX: 0.05, raX: -0.4 },
    { f: 41, alpha: 180, rootY: 0.99, spX: 0.15, hdX: 0.35, lsX: -0.1, lsZ: 0.15, leX: -0.2, rsX: -0.1, rsZ: -0.15, reX: -0.2,
      lhX: -0.05, lhZ: 0.12, lkX: 0.1, laX: -0.05, rhX: 0.05, rhZ: -0.1, rkX: 0.1, raX: -0.15 },
    { f: 49, alpha: 200, rootY: 0.98, spX: 0.1, hdX: 0.1, hdY: 1.0, lsZ: 0.25, rsZ: -0.25,
      lhX: 0.12, lhZ: -0.02, lkX: 0.2, laX: -0.3, rhX: -0.15, rhZ: 0.0, rkX: 0.15, raX: 0 },
    { f: 57, alpha: 270, rootY: 1.0, spX: 0.05, hdX: -0.05, hdY: 0, lsX: 0.1, lsZ: 0.08, leX: -0.2, rsX: 0.0, rsZ: -0.08, reX: -0.2,
      lhX: -0.2, lhZ: 0.03, lkX: 0.25, laX: 0.1, rhX: 0.2, rhZ: -0.03, rkX: 0.3, raX: 0.2 },
    { f: 65, alpha: 360, rootY: 1.46, rootRoll: -0.06, spX: -0.05, hdX: -0.15, hdY: 0.2, hdZ: -0.1,
      lsX: 0, lsY: 0, lsZ: 0.9, leX: -0.15, rsX: 0, rsY: -1.2, rsZ: -1.4, reX: -0.3,
      lhX: 0.0, lhZ: 0.03, lkX: 0.1, laX: 1.0, rhX: -0.35, rhZ: -0.05, rkX: 0.7, raX: 0.9 },
    { f: 73, alpha: 362, rootY: 1.48, rootRoll: -0.07, hdZ: -0.12, lsZ: 0.85, rsZ: -1.5, rsY: -1.2, reX: -0.2,
      lhX: 0.0, lhZ: 0.1, lkX: 0.3, rhX: -0.25, rhZ: -0.14, rkX: 0.6 },
    { f: 106, alpha: 363, rootY: 1.48, rsZ: -1.3, rsY: -0.9, reX: -0.15 },
    { f: 130, alpha: 364, rsZ: -1.4, rsY: -0.5, reX: -0.1 },
    { f: 146, alpha: 368, rootY: 1.47, rsZ: -1.45, rsY: -0.4 },
    { f: 154, alpha: 385, rsZ: -1.5, rsY: -0.3, lsZ: 0.6, leX: -0.8 },
    { f: 163, alpha: 450, rootY: 1.48, rsZ: -1.5, rsY: -1.2, reX: -0.1, lsX: -0.5, lsZ: 0.5, leX: -0.8 },
    { f: 171, alpha: 500, hdX: -0.3, rsZ: -1.5, rsY: -1.2, reX: -0.8, lsX: -0.2, lsZ: 0.6, lhX: -0.2, lkX: 0.3 },
    { f: 179, alpha: 540, rootY: 1.5, rootRoll: -0.1, hdX: 0.2, hdY: 0, hdZ: -0.15, rsZ: -1.45, rsY: -1.2, reX: -0.5,
      lsX: 0, lsZ: 0.75, leX: -0.1, lhX: 0.0, lhZ: 0.06, lkX: 0.1, rhX: -0.05, rhZ: -0.06, rkX: 0.15 },
    { f: 187, alpha: 545, rootY: 1.52, hdX: 0.05, rsZ: -1.6, rsY: -0.6, reX: -0.3, lsZ: 0.9, leX: -0.1 },
  ];
  const poseTracks = {};
  {
    const cur = {}; PN.forEach(p => cur[p] = 0); cur.rootY = 1.0;
    const arr = {}; PN.forEach(p => arr[p] = []);
    for (const k of poseKeys) {
      for (const p of PN) if (k[p] !== undefined) cur[p] = k[p];
      for (const p of PN) arr[p].push([k.f, cur[p]]);
    }
    for (const p of PN) poseTracks[p] = makeTrack(arr[p], false);
  }

  // ---------- smoke (seeded sprites with procedural noise textures) ----------
  function makeSmokeTex(r) {
    const S = 128, G = 9;
    const grids = [];
    for (let o = 0; o < 3; o++) {
      const n = G * (1 << o); const g = new Float32Array((n + 1) * (n + 1));
      for (let i = 0; i < g.length; i++) g[i] = r();
      grids.push({ n, g });
    }
    const vn = (gr, u, v) => {
      const x = u * gr.n, y = v * gr.n; const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const W = gr.n + 1; const x1 = Math.min(gr.n, x0 + 1), y1 = Math.min(gr.n, y0 + 1);
      const a = gr.g[y0 * W + x0], b = gr.g[y0 * W + x1], c = gr.g[y1 * W + x0], d = gr.g[y1 * W + x1];
      return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
    };
    const data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / (S - 1), v = y / (S - 1);
      const dx = u - 0.5, dy = v - 0.5; const rr = Math.sqrt(dx * dx + dy * dy) * 2;
      const fall = rr >= 1 ? 0 : Math.pow(1 - rr * rr, 1.6);
      const n = 0.5 * vn(grids[0], u, v) + 0.3 * vn(grids[1], u, v) + 0.2 * vn(grids[2], u, v);
      const a = clamp(fall * smooth(0.32, 0.72, n) * 1.1, 0, 1);
      const i = (y * S + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.needsUpdate = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    return t;
  }
  const smokeTex = [makeSmokeTex(rng), makeSmokeTex(rng), makeSmokeTex(rng), makeSmokeTex(rng)];
  const smoke = [];
  const NSMOKE = 48;
  for (let i = 0; i < NSMOKE; i++) {
    const front = i >= 40;
    const ang = front ? rng() * Math.PI * 2 : Math.PI - 1.9 + rng() * 2.8;
    const rad = front ? 0.5 + rng() * 1.5 : 0.4 + Math.sqrt(rng()) * 3.0;
    const y = front ? 0.3 + rng() * 0.8 : 0.4 + rng() * 2.2;
    const tone = rng();
    let b = tone < 0.8 ? 1.55 : 0.8;
    if (y > 2.2) b *= 0.5;
    const size = 1.4 + rng() * 1.8;
    const yy = Math.max(y, 0.36 * size);
    const mat = new THREE.SpriteMaterial({ map: smokeTex[i % 4], color: new THREE.Color(b * 0.86, b * 0.97, b),
      transparent: true, opacity: 0.3, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    scene.add(sp);
    smoke.push({ sp, mat, x: rad * Math.sin(ang), z: rad * Math.cos(ang), y: yy,
      vx: (rng() - 0.5) * 0.24, vz: (rng() - 0.5) * 0.24, vy: 0.02 + rng() * 0.08,
      size, op: 0.22 + rng() * 0.22, rot: rng() * 6.28, rs: (rng() - 0.5) * 0.3 });
  }
  const densTrack = makeTrack([[0, 1.15], [24, 1.05], [41, 0.85], [65, 0.75], [187, 0.75]], false);
  const frontTrack = makeTrack([[0, 0.45], [24, 0.3], [57, 0.15], [187, 0.15]], false);

  // ---------- update ----------
  const tmp = new THREE.Vector3();
  function update(time, frame) {
    const fr = time * fps;
    const phi = phiAt(fr);
    const rc = rcTrack(fr);
    const xd = xdTrack(fr);
    const pxPerM = F / rc;
    const cx = rc * Math.sin(phi), cz = rc * Math.cos(phi);
    const rx = Math.cos(phi), rz = -Math.sin(phi);
    const off = -xd / pxPerM;
    const px = rx * off, pz = rz * off;
    camera.position.set(cx, CAM_H, cz);
    const yaw = Math.atan2(cx - px, cz - pz);
    camera.rotation.set(PITCH, yaw, 0, 'YXZ');
    camera.fov = VFOV; camera.aspect = width / height; camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    // lights relative to camera (camera-side key, back rim)
    key.position.set(cx * 1.2 + rx * 2.0, 4.0, cz * 1.2 + rz * 2.0);
    key.target.position.set(0, 1.0, 0);
    rim.position.set(-cx * 1.5 - rx * 1.5, 3.0, -cz * 1.5 - rz * 1.5);
    rim.target.position.set(0, 1.0, 0);

    // dancer pose
    const P = {}; for (const p of PN) P[p] = poseTracks[p](fr);
    root.position.set(0, P.rootY, 0);
    root.rotation.set(P.rootPitch, phi + P.alpha * Math.PI / 180, P.rootRoll, 'YXZ');
    spine.rotation.set(P.spX, P.spY, P.spZ, 'YXZ');
    neck.rotation.set(P.hdX, P.hdY, P.hdZ, 'YXZ');
    armL.sh.rotation.set(P.lsX, P.lsY, P.lsZ, 'YZX'); armL.el.rotation.set(P.leX, 0, 0);
    armR.sh.rotation.set(P.rsX, P.rsY, P.rsZ, 'YZX'); armR.el.rotation.set(P.reX, 0, 0);
    legL.hp.rotation.set(P.lhX, 0, P.lhZ, 'ZXY'); legL.kn.rotation.set(P.lkX, 0, 0); legL.an.rotation.set(P.laX, 0, 0);
    legR.hp.rotation.set(P.rhX, 0, P.rhZ, 'ZXY'); legR.kn.rotation.set(P.rkX, 0, 0); legR.an.rotation.set(P.raX, 0, 0);

    // floor reflection streaks of bars, pointing toward camera
    for (let j = 0; j < NBARS; j++) {
      const b = bars[j];
      let ux = b.x - cx, uz = b.z - cz; const D = Math.hypot(ux, uz); ux /= D; uz /= D;
      const wx = -uz, wz = ux;
      const far = D * 0.47, mid = D * 0.40, near = 0.8;
      const hwF = BAR_LEN * 0.55 * far / D, hwM = BAR_LEN * 0.55 * mid / D, hwN = BAR_LEN * 0.55 * near / D;
      const pos = refl[j].geometry.attributes.position;
      for (let c = 0; c < NC; c++) {
        const s = (c / (NC - 1)) * 2 - 1;
        pos.setXYZ(c, cx + ux * far + wx * hwF * s, 0.004, cz + uz * far + wz * hwF * s);
        pos.setXYZ(NC + c, cx + ux * mid + wx * hwM * s, 0.004, cz + uz * mid + wz * hwM * s);
        pos.setXYZ(2 * NC + c, cx + ux * near + wx * hwN * s, 0.004, cz + uz * near + wz * hwN * s);
      }
      pos.needsUpdate = true;
      refl[j].geometry.computeBoundingSphere();
    }

    // smoke
    const dens = densTrack(fr), front = frontTrack(fr);
    const cdx = Math.sin(phi), cdz = Math.cos(phi);
    for (const s of smoke) {
      const x = s.x + s.vx * time, z = s.z + s.vz * time, y = s.y + s.vy * time;
      s.sp.position.set(x, y, z);
      const sc = s.size * (1 + 0.05 * time);
      s.sp.scale.set(sc, sc, 1);
      s.mat.rotation = s.rot + s.rs * time;
      const d = x * cdx + z * cdz; // toward-camera depth relative to dancer
      let f = 1;
      if (d > 0.3) f = front * (y < 0.9 ? 1.6 : 1.0);
      tmp.set(x, y, z);
      const dc = tmp.distanceTo(camera.position);
      f *= smooth(1.6, 3.2, dc);
      s.mat.opacity = clamp(s.op * dens * f, 0, 1);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
