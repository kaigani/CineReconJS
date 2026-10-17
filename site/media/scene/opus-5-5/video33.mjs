// CineRecon Three.js sampled-frame baseline - L1 proxy reconstruction of video33
// Goose carries a toilet-roll pack along a street behind a foreground roof; a woman
// notices, rushes over, takes the pack back and walks off toward the market while
// the goose flaps and follows. Single continuous follow-camera shot (no cuts).

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7f7f89);

  const camera = new THREE.PerspectiveCamera(9.9, width / height, 1, 300);

  // ---------- lights (revision-aware intensity scaling) ----------
  const rev = parseInt(THREE.REVISION, 10) || 150;
  const LI = rev >= 155 ? Math.PI : 1;
  scene.add(new THREE.AmbientLight(0xffffff, 0.66 * LI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.3 * LI);
  sun.position.set(-4, 10, 5);
  scene.add(sun);

  // ---------- helpers ----------
  const matCache = {};
  function mat(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    return matCache[hex];
  }
  function basic(hex) {
    return new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide });
  }
  function box(w, h, d, hex) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
  }
  function cyl(rt, rb, h, hex, seg) {
    return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat(hex));
  }
  function sph(r, hex) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat(hex));
  }
  function place(obj, x, y, z, parent) {
    obj.position.set(x, y, z);
    (parent || scene).add(obj);
    return obj;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function lerp(a, b, s) { return a + (b - a) * s; }

  // Monotone piecewise-cubic (PCHIP) track over multi-dimensional keys [t, v0, v1, ...]
  function track(keys) {
    const n = keys.length;
    const times = keys.map(k => k[0]);
    const dims = keys[0].length - 1;
    const slopes = [];
    for (let d = 0; d < dims; d++) {
      const y = keys.map(k => k[d + 1]);
      const h = [], del = [];
      for (let i = 0; i < n - 1; i++) { h.push(times[i + 1] - times[i]); del.push((y[i + 1] - y[i]) / h[i]); }
      const m = new Array(n).fill(0);
      if (n === 2) { m[0] = m[1] = del[0]; }
      else {
        m[0] = del[0]; m[n - 1] = del[n - 2];
        for (let i = 1; i < n - 1; i++) {
          if (del[i - 1] * del[i] <= 0) m[i] = 0;
          else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]); }
        }
        if (del[0] * m[0] < 0) m[0] = 0;
      }
      slopes.push(m);
    }
    return function (t) {
      const out = new Array(dims);
      if (t <= times[0]) { for (let d = 0; d < dims; d++) out[d] = keys[0][d + 1]; return out; }
      if (t >= times[n - 1]) { for (let d = 0; d < dims; d++) out[d] = keys[n - 1][d + 1]; return out; }
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
      const h = times[hi] - times[lo], s = (t - times[lo]) / h;
      const s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      for (let d = 0; d < dims; d++) out[d] = h00 * keys[lo][d + 1] + h10 * h * slopes[d][lo] + h01 * keys[hi][d + 1] + h11 * h * slopes[d][hi];
      return out;
    };
  }
  function speedOf(tr, t) {
    const a = tr(t - 0.03), b = tr(t + 0.03);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.06;
  }
  // absolute path length from t=0 (fixed-step, order independent)
  function distAlong(tr, t) {
    if (t <= 0) return 0;
    const step = 1 / 30;
    let d = 0, prev = tr(0);
    const N = Math.ceil(t / step);
    for (let i = 1; i <= N; i++) {
      const p = tr(Math.min(t, i * step));
      d += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    return d;
  }

  // ---------- colours ----------
  const C = {
    street: 0x787b83, paving: 0x818287, grass: 0x8aa38c, curb: 0xb8b3a5, pond: 0x768eb4,
    roof: 0x55565a, ridge: 0x77777c, brick: 0x9a4c3c, pot: 0xa8603e, cap: 0x8a857c, band: 0x3a3436,
    goose: 0xf2f2f2, orange: 0xe8823a,
    packCream: 0xe8e2c4, packBlue: 0x7a90c8,
    vest: 0x4a2a30, sleeve: 0x84648a, trousers: 0x7d6a5e, shoe: 0x2a2426, skin: 0xd8a888, hair: 0x4e362c,
    cloth: 0xbe5359, wood: 0x7a5a42, tray: 0x34557e, crate: 0x343236, cartRed: 0xb84a4a, planter: 0x3a3532,
    plant: 0x5a8a4a, board: 0x2b2b2e, frame: 0x6b4434, bench: 0x99836c, iron: 0x2a2a2a, toy: 0x6aa6d8,
    pole: 0x8a94a4, post: 0x3a5a44, orangeCrate: 0xd85a40, blueCrate: 0x4a8ad0, hedge: 0x6a9a5e,
    building: 0x9a5040, door: 0x3d5a40, girlTop: 0xeee6e6, girlShoe: 0xc84848, ball: 0xf4f4f4, silver: 0xbfc3ca
  };

  // ---------- roof / ridge geometry ----------
  // ridge line (x ascending), z of the ridge crest; crest height HR above the street
  const HR = 0.93, SLOPE = 35 * D2R;
  const ridge = [[-16, -1.5], [-5, -1.33], [-3, -1.26], [-1.4, -1.13], [-0.62, -1.08], [-0.6, -0.76],
    [0, -0.75], [4, -0.55], [9, -0.42], [16, -0.32]];

  // street: polygon bounded on the near side by the ridge crest
  {
    const sh = new THREE.Shape();
    sh.moveTo(-16, 40);
    sh.lineTo(16, 40);
    for (let i = ridge.length - 1; i >= 0; i--) sh.lineTo(ridge[i][0], -ridge[i][1]);
    sh.lineTo(-16, 40);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(C.street));
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
  }
  // roof planes sloping down toward the camera
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x0, z0] = ridge[i], [x1, z1] = ridge[i + 1];
    let dx = x1 - x0, dz = z1 - z0;
    if (Math.abs(dx) < 1e-3) dx = 1e-3;
    const L = Math.hypot(dx, dz);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, HR, (z0 + z1) / 2);
    g.rotation.y = Math.atan2(-dz, dx);
    const geo = new THREE.BoxGeometry(L + 0.04, 0.08, 9);
    geo.translate(0, -0.04, 4.5);
    const slab = new THREE.Mesh(geo, mat(C.roof));
    slab.rotation.x = SLOPE;
    g.add(slab);
    const crest = box(L + 0.04, 0.05, 0.07, C.ridge);
    crest.rotation.x = SLOPE;
    g.add(crest);
    scene.add(g);
  }

  function chimney(x, z, pots, capW) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const bw = capW - 0.1;
    place(box(bw, 2.3, bw, C.brick), 0, 0.4, 0, g);
    place(box(bw + 0.02, 0.07, bw + 0.02, C.band), 0, 1.47, 0, g);
    place(box(capW, 0.08, capW, C.cap), 0, 1.59, 0, g);
    for (const [px, pz] of pots) {
      place(cyl(0.085, 0.092, 0.27, C.pot), px, 1.765, pz, g);
      place(cyl(0.05, 0.05, 0.012, 0x2a2020), px, 1.903, pz, g);
    }
    scene.add(g);
    return g;
  }
  chimney(-0.62, -0.1, [[-0.075, 0.085], [0.07, -0.075]], 0.54);
  chimney(4.4, 0.7, [[-0.075, 0.085], [0.07, -0.075]], 0.54);
  chimney(-5.24, -1.05, [[-0.1, 0.1], [0.1, 0.1], [-0.1, -0.1], [0.1, -0.1]], 0.6);

  // ---------- far side: market paving, grass, pond, buildings ----------
  function flatPoly(pts, hex, y) {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], -pts[i][1]);
    sh.lineTo(pts[0][0], -pts[0][1]);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(hex));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    scene.add(m);
    return m;
  }
  flatPoly([[-1.0, -5.45], [4.2, -5.12], [4.9, -6.54], [12, -6.54], [12, -16], [-1.0, -16]], C.paving, 0.004);
  const grassPts = [[-5.53, -6.2], [-1.5, -5.8], [-1.12, -7.35], [-1.12, -9.7], [-5.2, -9.7]];
  flatPoly(grassPts, C.grass, 0.03);
  for (let i = 0; i < grassPts.length; i++) {
    const a = grassPts[i], b = grassPts[(i + 1) % grassPts.length];
    if (i === 3) continue;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const c = box(L + 0.1, 0.06, 0.1, C.curb);
    c.position.set((a[0] + b[0]) / 2, 0.03, (a[1] + b[1]) / 2);
    c.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    scene.add(c);
  }
  {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat(C.pond));
    pond.rotation.x = -Math.PI / 2;
    pond.scale.set(1.3, 1.0, 1);
    pond.position.set(-7.75, 0.008, -5.6);
    scene.add(pond);
    place(box(0.45, 0.02, 0.22, 0x3a3a40), -8.5, 0.015, -6.1);
  }
  place(box(2.2, 2.0, 2.4, C.building), -9.6, 1.0, -8.0);
  place(box(0.4, 0.8, 0.05, C.door), -8.9, 0.4, -6.78);
  // bench with toy plane
  {
    const g = new THREE.Group();
    g.position.set(-2.73, 0, -6.84);
    g.rotation.y = -5.6 * D2R;
    place(box(1.55, 0.05, 0.36, C.bench), 0, 0.33, 0, g);
    place(box(1.55, 0.16, 0.04, C.bench), 0, 0.56, -0.2, g);
    for (const sx of [-0.61, 0.61]) {
      place(box(0.06, 0.33, 0.3, C.iron), sx, 0.165, 0, g);
      place(box(0.05, 0.3, 0.04, C.iron), sx, 0.5, -0.19, g);
    }
    place(box(0.18, 0.03, 0.05, C.toy), 0.55, 0.37, 0.03, g);
    place(box(0.05, 0.02, 0.2, C.toy), 0.57, 0.38, 0.03, g);
    scene.add(g);
  }
  place(cyl(0.035, 0.04, 3.6, C.pole), -1.5, 1.8, -6.86);
  place(cyl(0.11, 0.12, 3.2, C.post), -4.6, 1.6, -7.32);
  place(cyl(0.15, 0.16, 0.3, 0x1f2220), -4.6, 0.15, -7.32);

  // market stall group
  {
    // black crates (stacked)
    place(box(0.34, 0.36, 0.3, C.crate), 0.0, 0.18, -6.15);
    // plant cart
    place(box(0.95, 0.06, 0.28, C.cartRed), 0.68, 0.22, -6.12);
    place(cyl(0.02, 0.02, 0.2, C.cartRed), 0.25, 0.1, -6.12);
    const wheel = cyl(0.1, 0.1, 0.05, 0x7a2a2a);
    wheel.rotation.x = Math.PI / 2;
    place(wheel, 1.12, 0.1, -5.98);
    for (let i = 0; i < 3; i++) place(box(0.3, 0.13, 0.26, C.planter), 0.36 + i * 0.31, 0.32, -6.12);
    place(cyl(0.0, 0.16, 0.45, C.plant, 8), 0.36, 0.62, -6.12);
    place(cyl(0.0, 0.14, 0.4, C.plant, 8), 0.62, 0.6, -6.15);
    place(box(0.26, 0.06, 0.2, C.plant), 0.98, 0.42, -6.12);
    // table with red cloth and three trays
    for (const lx of [1.35, 2.7]) for (const lz of [-5.82, -6.34]) place(box(0.04, 0.4, 0.04, C.wood), lx, 0.2, lz);
    place(box(1.5, 0.26, 0.62, C.cloth), 2.02, 0.48, -6.08);
    place(box(1.5, 0.02, 0.64, 0xf2eeee), 2.02, 0.345, -6.08);
    for (let i = 0; i < 3; i++) {
      const tr = box(0.34, 0.05, 0.3, C.tray);
      tr.rotation.y = (i - 1) * 0.08;
      place(tr, 1.55 + i * 0.47, 0.635, -6.06);
    }
    // toilet-roll stack
    place(box(0.56, 0.42, 0.46, C.packCream), 3.12, 0.21, -5.86);
    place(box(0.57, 0.05, 0.47, C.packBlue), 3.12, 0.1, -5.86);
    place(box(0.57, 0.05, 0.47, C.packBlue), 3.12, 0.31, -5.86);
    // A-board sign
    const ab = new THREE.Group();
    ab.position.set(3.82, 0, -5.9);
    ab.rotation.y = -25 * D2R;
    for (const s of [1, -1]) {
      const p = new THREE.Group();
      p.rotation.x = s * 0.2;
      const fr = box(0.46, 0.66, 0.04, C.frame);
      fr.position.set(0, 0.33, 0);
      p.add(fr);
      const bd = box(0.36, 0.5, 0.01, C.board);
      bd.position.set(0, 0.35, s * 0.025);
      p.add(bd);
      p.position.z = s * 0.07;
      ab.add(p);
    }
    scene.add(ab);
    // back crates
    place(box(1.5, 0.5, 0.6, C.orangeCrate), 1.5, 0.25, -8.4);
    place(box(0.6, 0.45, 0.5, C.wood), 2.6, 0.225, -8.4);
    place(box(0.3, 0.26, 0.3, C.blueCrate), 4.29, 0.13, -8.55);
    place(box(2.2, 0.18, 0.5, C.hedge), 4.6, 0.09, -9.4);
  }
  // spectacles-like small item on the street
  place(box(0.13, 0.02, 0.05, C.silver), 2.15, 0.01, -2.98);

  // ---------- goose (model faces +x) ----------
  const goose = new THREE.Group();
  const gBody = new THREE.Group();
  goose.add(gBody);
  {
    const body = sph(1, C.goose);
    body.scale.set(0.15, 0.088, 0.092);
    place(body, -0.02, 0.2, 0, gBody);
    place(sph(0.07, C.goose), 0.06, 0.2, 0, gBody);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 10), mat(C.goose));
    tail.rotation.z = Math.PI / 2 + 0.35;
    place(tail, -0.18, 0.235, 0, gBody);
  }
  const gNeck = new THREE.Group();
  place(gNeck, 0.09, 0.235, 0, gBody);
  {
    const n = cyl(0.027, 0.033, 0.2, C.goose);
    n.position.y = 0.1;
    gNeck.add(n);
  }
  const gHead = new THREE.Group();
  place(gHead, 0, 0.2, 0, gNeck);
  gHead.add(sph(0.042, C.goose));
  {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 10), mat(C.orange));
    beak.rotation.z = -Math.PI / 2;
    place(beak, 0.064, -0.006, 0, gHead);
  }
  const gBeakAnchor = new THREE.Object3D();
  place(gBeakAnchor, 0.15, -0.02, 0, gHead);
  const gLegs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    place(hip, 0.0, 0.125, s * 0.045, gBody);
    const leg = cyl(0.011, 0.011, 0.12, C.orange, 8);
    leg.position.y = -0.06;
    hip.add(leg);
    place(box(0.07, 0.012, 0.055, C.orange), 0.022, -0.119, 0, hip);
    gLegs.push(hip);
  }
  const gWings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    place(w, 0.04, 0.25, s * 0.083, gBody);
    const wm = sph(1, C.goose);
    wm.scale.set(0.135, 0.058, 0.013);
    wm.position.set(-0.105, -0.025, 0);
    w.add(wm);
    w.userData.s = s;
    gWings.push(w);
  }
  scene.add(goose);

  // ---------- toilet-roll pack (two rolls + blue band) ----------
  const pack = new THREE.Group();
  for (const px of [-0.06, 0.06]) {
    const r = cyl(0.06, 0.06, 0.14, C.packCream, 18);
    r.rotation.x = Math.PI / 2;
    place(r, px, 0, 0, pack);
  }
  place(box(0.245, 0.126, 0.045, C.packBlue), 0, 0, 0, pack);
  place(box(0.12, 0.122, 0.142, C.packCream), 0, 0, 0, pack);
  scene.add(pack);

  // ---------- woman (model faces +x, left side = -z) ----------
  const woman = new THREE.Group();
  const wPelvis = new THREE.Group();
  woman.add(wPelvis);
  const wThigh = [], wKnee = [];
  for (const s of [-1, 1]) {
    const th = new THREE.Group();
    place(th, 0, 0, s * 0.075, wPelvis);
    const tm = cyl(0.058, 0.05, 0.22, C.trousers);
    tm.position.y = -0.11;
    th.add(tm);
    const kn = new THREE.Group();
    place(kn, 0, -0.22, 0, th);
    const sm = cyl(0.046, 0.04, 0.2, C.trousers);
    sm.position.y = -0.1;
    kn.add(sm);
    place(box(0.13, 0.045, 0.08, C.shoe), 0.03, -0.2, 0, kn);
    wThigh.push(th); wKnee.push(kn);
  }
  const wTorso = new THREE.Group();
  wPelvis.add(wTorso);
  place(box(0.22, 0.1, 0.3, C.trousers), 0, 0.02, 0, wTorso);
  {
    const v = cyl(0.15, 0.185, 0.35, C.vest);
    v.scale.set(0.82, 1, 1);
    place(v, 0.01, 0.2, 0, wTorso);
    place(sph(0.085, C.skin), 0.01, 0.47, 0, wTorso);
    const hair = sph(0.1, C.hair);
    hair.scale.set(1.0, 0.92, 1.1);
    place(hair, -0.03, 0.505, 0, wTorso);
  }
  const wShoulder = [], wElbow = [];
  const wHandAnchor = new THREE.Object3D();
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    place(sh, 0, 0.33, s * 0.19, wTorso);
    const ua = cyl(0.036, 0.033, 0.17, C.sleeve);
    ua.position.y = -0.085;
    sh.add(ua);
    const el = new THREE.Group();
    place(el, 0, -0.17, 0, sh);
    const fa = cyl(0.032, 0.03, 0.16, C.sleeve);
    fa.position.y = -0.08;
    el.add(fa);
    place(sph(0.034, C.skin), 0, -0.175, 0, el);
    if (s === -1) place(wHandAnchor, 0.0, -0.2, 0, el);
    wShoulder.push(sh); wElbow.push(el);
  }
  scene.add(woman);

  // thought bubble (game UI element above the woman)
  const bubble = new THREE.Group();
  {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), basic(0xffffff));
    bubble.add(disc);
    const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.12), basic(0xe4e0c8));
    icon.position.z = 0.002;
    bubble.add(icon);
    const ib = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.03), basic(0x8aa0d0));
    ib.position.set(0, 0.025, 0.004);
    bubble.add(ib);
  }
  scene.add(bubble);

  // ---------- girl with football (background) ----------
  const girl = new THREE.Group();
  const girlLegs = [];
  for (const s of [-1, 1]) {
    const h = new THREE.Group();
    place(h, 0, 0.3, s * 0.045, girl);
    const l = cyl(0.025, 0.022, 0.28, C.skin);
    l.position.y = -0.14;
    h.add(l);
    place(box(0.08, 0.035, 0.05, C.girlShoe), 0.015, -0.29, 0, h);
    girlLegs.push(h);
  }
  place(cyl(0.1, 0.13, 0.14, C.girlTop), 0, 0.36, 0, girl);
  place(cyl(0.08, 0.09, 0.2, C.girlTop), 0, 0.53, 0, girl);
  place(sph(0.07, C.skin), 0, 0.7, 0, girl);
  girl.position.set(-4.42, 0, -9.85);
  girl.rotation.y = -20 * D2R;
  scene.add(girl);
  const ball = sph(0.06, C.ball);
  scene.add(ball);

  // ---------- tracks ----------
  // camera keys: [t, targetX, targetZ, yawDeg, distance, pitchDeg] (fitted to reference landmarks)
  const camTrack = track([
    [0, 3.68, -5.26, 7.66, 14.32, 26.25], [0.817, 2.62, -4.44, 7.82, 19.48, 26.11],
    [1.617, 1.56, -4.38, 9.18, 20.08, 26.46], [2.433, 1.04, -4.16, 10.11, 20.72, 26.34],
    [3.25, 0.26, -3.86, 12.0, 20.0, 26.61], [4.067, 0.22, -3.90, 14.19, 20.04, 26.67],
    [4.867, -0.10, -3.92, 16.05, 20.5, 27.13], [5.683, -1.06, -3.92, 17.61, 20.32, 27.23],
    [6.5, -1.94, -3.96, 19.64, 20.44, 27.58], [7.317, -3.04, -4.16, 21.82, 21.66, 27.77],
    [8.117, -4.50, -4.84, 24.81, 21.34, 26.7], [8.933, -4.58, -5.22, 26.92, 21.12, 26.59],
    [9.75, -4.36, -5.26, 27.92, 21.02, 26.55], [10.567, -4.46, -5.18, 29.28, 20.48, 26.28],
    [11.367, -4.62, -5.12, 30.16, 17.1, 26.69], [12.183, -4.38, -4.70, 30.19, 14.42, 26.68],
    [13.0, -3.94, -4.30, 31.29, 15.72, 25.04], [13.817, -4.12, -3.96, 31.61, 15.32, 25.89],
    [14.617, -3.76, -3.96, 31.73, 14.74, 26.96], [15.433, -2.90, -4.14, 31.6, 13.14, 28.19],
    [16.25, -2.14, -4.60, 27.95, 12.08, 26.97], [17.067, -1.54, -4.44, 25.74, 13.42, 27.47],
    [17.867, -1.10, -4.78, 22.27, 11.94, 27.21], [18.683, -0.54, -4.88, 19.99, 12.3, 26.34]
  ]);
  const goosePos = track([
    [0, 3.6, -4.25], [0.817, 2.81, -3.8], [1.617, 2.01, -3.54], [2.433, 1.38, -3.13],
    [3.25, 0.70, -2.70], [4.067, 0.55, -2.52], [4.867, 0.30, -2.45], [5.683, -0.57, -2.47],
    [6.5, -1.62, -2.55], [7.317, -2.31, -2.55], [7.8, -2.55, -2.6], [8.117, -2.62, -2.62],
    [8.933, -2.6, -2.74], [9.75, -2.68, -2.74], [10.567, -2.96, -2.75], [11.367, -3.3, -2.85],
    [12.183, -3.29, -2.68], [13.0, -3.16, -2.85], [13.817, -3.2, -2.6], [14.617, -2.9, -2.65],
    [15.433, -2.3, -2.98], [16.25, -1.6, -3.4], [17.067, -0.87, -3.4], [17.867, -0.3, -3.54],
    [18.7, 0.35, -3.58]
  ]);
  const gooseYaw = track([
    [0, 160], [0.5, 195], [0.817, 205], [2.433, 210], [3.25, 208], [4.067, 200], [4.867, 195],
    [5.683, 180], [6.5, 176], [7.317, 180], [8.117, 185], [8.933, 162], [9.75, 160], [10.567, 182],
    [11.367, 165], [12.183, 118], [12.45, 118], [12.85, -59], [13.0, -59], [13.817, -58],
    [14.25, 0], [14.617, 55], [15.1, 120], [15.433, 130], [16.25, 118], [16.7, 40], [17.067, 15],
    [17.867, 67], [18.7, 70]
  ]);
  const gooseNeck = track([
    [0, -75], [0.35, -60], [1.617, -60], [2.433, -35], [3.25, -15], [4.867, -20], [5.683, -35],
    [7.317, -35], [8.117, -15], [12.3, -15], [12.55, -45], [12.85, -5], [15.0, -3], [16.25, 0], [16.8, -32], [17.4, -30], [17.867, -5], [18.7, 0]
  ]);
  const womanPos = track([
    [0, -9.9, -5.35], [6.5, -6.68, -5.5], [7.317, -6.26, -5.52], [8.117, -5.82, -5.55],
    [8.933, -5.36, -5.67], [9.75, -4.82, -5.68], [10.567, -4.58, -5.67], [10.85, -4.5, -5.62],
    [11.367, -4.38, -5.37], [12.183, -3.98, -4.19], [12.75, -3.6, -3.6], [13.0, -3.44, -3.48],
    [13.3, -3.37, -3.44], [13.817, -3.72, -3.38], [14.617, -3.41, -3.3], [15.433, -2.97, -3.44],
    [16.25, -2.36, -3.62], [17.067, -2.0, -3.67], [17.867, -1.57, -3.86], [18.7, -1.1, -3.88]
  ]);
  const womanYaw = track([
    [0, 5], [10.567, 5], [10.85, 0], [11.15, -62], [12.6, -62], [12.85, -36], [13.4, -30],
    [13.817, -40], [14.3, -5], [14.617, 10], [15.1, 18], [18.7, 18]
  ]);
  const ballPos = track([[0, -4.03, -9.53], [8.95, -4.03, -9.53], [9.75, -3.16, -8.94], [10.567, -2.82, -8.66], [11.6, -2.6, -8.5], [12.5, -2.52, -8.44]]);

  const PACK_GROUND0 = new THREE.Vector3(3.2, 0.06, -4.45);
  const PACK_DROP = new THREE.Vector3(-2.9, 0.06, -3.22);
  const wingSpreads = [[13.45, 14.25, 1], [15.1, 15.8, 1], [16.0, 16.5, 0.35], [16.7, 18.15, 1]];
  const honks = [[12.9, 13.2], [14.45, 14.75], [15.3, 15.6], [16.1, 16.4], [16.95, 17.15]];

  const vA = new THREE.Vector3(), vB = new THREE.Vector3();

  function update(time, frame) {
    const t = clamp(time, 0, duration);

    // ----- camera -----
    const ck = camTrack(t);
    const a = ck[2] * D2R, d = ck[3], p = ck[4] * D2R;
    camera.position.set(ck[0] + d * Math.sin(a) * Math.cos(p), d * Math.sin(p), ck[1] + d * Math.cos(a) * Math.cos(p));
    camera.up.set(0, 1, 0);
    camera.lookAt(ck[0], 0, ck[1]);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // ----- goose -----
    const gp = goosePos(t);
    goose.position.set(gp[0], 0, gp[1]);
    const gyaw = gooseYaw(t)[0] * D2R;
    goose.rotation.set(0, gyaw, 0);
    const gv = speedOf(goosePos, t);
    const gAmp = clamp(gv / 0.35, 0, 1);
    const gPhase = distAlong(goosePos, t) / 0.11 * Math.PI;
    gLegs[0].rotation.z = 0.55 * gAmp * Math.sin(gPhase);
    gLegs[1].rotation.z = -0.55 * gAmp * Math.sin(gPhase);
    gBody.rotation.set(0.07 * gAmp * Math.sin(gPhase), 0, 0);
    gBody.position.y = 0.008 * gAmp * Math.abs(Math.cos(gPhase));
    const neck = gooseNeck(t)[0] * D2R;
    gNeck.rotation.z = neck;
    let honk = 0;
    for (const [h0, h1] of honks) honk = Math.max(honk, smooth(h0, h0 + 0.08, t) * (1 - smooth(h1 - 0.08, h1, t)));
    gHead.rotation.z = -neck + 0.45 * honk;
    let spread = 0;
    for (const [s0, s1, amt] of wingSpreads) spread = Math.max(spread, amt * smooth(s0, s0 + 0.15, t) * (1 - smooth(s1 - 0.15, s1, t)));
    const flap = Math.sin(2 * Math.PI * 3.2 * t);
    for (const w of gWings) {
      const s = w.userData.s;
      w.rotation.set(-s * spread * (0.3 + 0.4 * flap), s * spread * 1.45, 0);
      w.scale.set(1 + 0.7 * spread, 1 + 0.6 * spread, 1);
    }

    // ----- woman -----
    const wp = womanPos(t);
    woman.position.set(wp[0], 0, wp[1]);
    const wyaw = womanYaw(t)[0] * D2R;
    woman.rotation.set(0, wyaw, 0);
    const wv = speedOf(womanPos, t);
    const wAmp = clamp(wv / 0.5, 0, 1.25);
    const wPhase = distAlong(womanPos, t) / 0.3 * Math.PI;
    const bend = smooth(12.7, 13.0, t) * (1 - smooth(13.3, 13.65, t));
    const crouch = 0.55 * bend;
    const sw = Math.sin(wPhase);
    wPelvis.position.y = 0.42 * Math.cos(crouch) + 0.02 + 0.01 * wAmp * Math.abs(Math.cos(wPhase));
    wThigh[0].rotation.z = 0.45 * wAmp * sw + crouch;
    wThigh[1].rotation.z = -0.45 * wAmp * sw + crouch;
    wKnee[0].rotation.z = -0.55 * wAmp * Math.max(0, Math.cos(wPhase)) - 2 * crouch;
    wKnee[1].rotation.z = -0.55 * wAmp * Math.max(0, -Math.cos(wPhase)) - 2 * crouch;
    const torsoBend = 1.2 * bend + 0.08 * clamp(wv - 0.8, 0, 1);
    wTorso.rotation.z = -torsoBend;
    const running = Math.max(clamp((wv - 0.8) / 0.4, 0, 1), 0.7 * smooth(10.9, 11.1, t) * (1 - smooth(12.55, 12.75, t)));
    const holding = smooth(13.4, 13.6, t);
    // right arm (index 1, +z) swings
    wShoulder[1].rotation.z = 0.38 * wAmp * sw + torsoBend * 0.95 + 0.25 * bend;
    wElbow[1].rotation.z = 0.2 + 1.1 * running;
    // left arm (index 0, -z) swings, then holds the pack in front
    const swingL = -0.38 * wAmp * sw + torsoBend * 0.95 + 0.25 * bend;
    wShoulder[0].rotation.z = lerp(swingL, 0.25, holding);
    wElbow[0].rotation.z = lerp(0.2 + 1.1 * running, 0.45, holding);
    wShoulder[0].rotation.x = 0.35 * running * (1 - holding); wShoulder[1].rotation.x = -0.35 * running;

    // thought bubble
    const bub = smooth(10.4, 10.5, t) * (1 - smooth(13.3, 13.4, t));
    bubble.visible = bub > 0.01;
    bubble.scale.setScalar(Math.max(0.01, bub));

    // ----- girl & ball -----
    const kick = smooth(7.9, 8.15, t) * (1 - smooth(8.6, 8.95, t));
    const kickFwd = smooth(8.75, 8.95, t) * (1 - smooth(9.05, 9.4, t));
    girlLegs[1].rotation.z = -0.7 * kick + 0.8 * kickFwd;
    girlLegs[0].rotation.z = 0;
    const bp = ballPos(t);
    ball.position.set(bp[0], 0.06, bp[1]);

    // ----- world matrices for anchors -----
    scene.updateMatrixWorld(true);

    // bubble above head, facing camera
    woman.localToWorld(vA.set(0, 1.25, 0));
    bubble.position.copy(vA);
    bubble.quaternion.copy(camera.quaternion);

    // ----- pack -----
    gBeakAnchor.getWorldPosition(vA);
    wHandAnchor.getWorldPosition(vB);
    vB.y -= 0.07;
    let px, py, pz, pyaw;
    if (t < 0.4) {
      const s = smooth(0.08, 0.4, t);
      px = lerp(PACK_GROUND0.x, vA.x, s); py = lerp(PACK_GROUND0.y, vA.y, s); pz = lerp(PACK_GROUND0.z, vA.z, s);
      pyaw = gyaw;
    } else if (t < 12.5) {
      px = vA.x; py = vA.y; pz = vA.z; pyaw = gyaw;
    } else if (t < 12.68) {
      const s = (t - 12.5) / 0.18;
      const s2 = s * s;
      px = lerp(vA.x, PACK_DROP.x, s); py = lerp(vA.y, PACK_DROP.y, s2); pz = lerp(vA.z, PACK_DROP.z, s);
      pyaw = lerp(118, 31, s) * D2R;
    } else if (t < 13.3) {
      px = PACK_DROP.x; py = PACK_DROP.y; pz = PACK_DROP.z; pyaw = 31 * D2R;
    } else if (t < 13.5) {
      const s = smooth(13.3, 13.5, t);
      px = lerp(PACK_DROP.x, vB.x, s); py = lerp(PACK_DROP.y, vB.y, s); pz = lerp(PACK_DROP.z, vB.z, s);
      pyaw = lerp(31 * D2R, wyaw, s);
    } else {
      px = vB.x; py = vB.y; pz = vB.z; pyaw = wyaw;
    }
    pack.position.set(px, py, pz);
    pack.rotation.set(0, pyaw, 0);
    pack.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
