// CineRecon L1 proxy reconstruction - video22 (first-person WWI battlefield sequence)
// Three.js sampled-frame baseline. Simple primitives only.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const Wd = width || 1280, Ht = height || 720;
  const aspect = Wd / Ht;
  const FOV = 45;
  const TANV = Math.tan(FOV * Math.PI / 360);
  const TANH = TANV * aspect;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0x999999, 20, 200);
  scene.fog = fog;
  scene.background = new THREE.Color(0x808080);
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.03, 1500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic RNG (construction only) ----------
  let rs = ((Number(seed) || 0) >>> 0) ^ 0x9e3779b9;
  function rng() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- materials / geometry helpers ----------
  const matCache = new Map();
  function M(hex) {
    let m = matCache.get(hex);
    if (!m) { m = new THREE.MeshLambertMaterial({ color: hex }); matCache.set(hex, m); }
    return m;
  }
  function B(hex, opts) { return new THREE.MeshBasicMaterial(Object.assign({ color: hex, fog: false }, opts || {})); }
  const GBOX = new THREE.BoxGeometry(1, 1, 1);
  const GSPH = new THREE.SphereGeometry(1, 18, 12);
  const GCYL = new THREE.CylinderGeometry(1, 1, 1, 10);
  const GCONE = new THREE.ConeGeometry(1, 1, 10);
  const YAX = new THREE.Vector3(0, 1, 0);

  function add(parent, geo, mat) { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; }
  function box(parent, w, h, d, hex, x, y, z, ry, rx, rz) {
    const m = add(parent, GBOX, M(hex));
    m.scale.set(w, h, d); m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    return m;
  }
  const _d = new THREE.Vector3();
  function segMesh(m, a, b, rx, rz) {
    _d.subVectors(b, a);
    const len = _d.length() || 1e-4;
    m.position.copy(a).addScaledVector(_d, 0.5);
    _d.multiplyScalar(1 / len);
    m.quaternion.setFromUnitVectors(YAX, _d);
    m.scale.set(rx, len, rz);
  }

  // ---------- reference-image placement helpers (960x540 reference pixel space) ----------
  const P = (x, y, z, yaw, pitch, roll) => ({ x, y, z, yaw: yaw || 0, pitch: pitch || 0, roll: roll || 0 });
  const _e = new THREE.Euler(0, 0, 0, 'YXZ');
  function ray(pose, px, py) {
    const v = new THREE.Vector3((px / 480 - 1) * TANH, (1 - py / 270) * TANV, -1);
    _e.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    return v.applyEuler(_e);
  }
  function at(pose, px, py, D) {
    const v = ray(pose, px, py);
    const s = D / Math.hypot(v.x, v.z);
    return new THREE.Vector3(pose.x + v.x * s, pose.y + v.y * s, pose.z + v.z * s);
  }
  function gp(pose, px, D) {
    const v = ray(P(pose.x, pose.y, pose.z, pose.yaw, 0, 0), px, 270);
    const s = D / Math.hypot(v.x, v.z);
    return [pose.x + v.x * s, pose.z + v.z * s];
  }
  function cp(px, py, d) { // camera-space point
    return new THREE.Vector3((px / 480 - 1) * TANH * d, (1 - py / 270) * TANV * d, -d);
  }

  // ---------- builders ----------
  const STONE = 0x4d4b47, STONE2 = 0x5a5955, DIRT = 0x2e2d2a, TREE = 0x2a2724;
  function ruin(parent, x, z, w, h, d, hex, ry, by) {
    return box(parent, w, h, d, hex || STONE, x, (by || 0) + h / 2, z, ry || 0);
  }
  function wallWin(parent, x, z, w, h, d, wins, hex, ry, by) {
    const g = new THREE.Group(); g.position.set(x, by || 0, z); g.rotation.y = ry || 0; parent.add(g);
    const c = hex || STONE;
    let cur = -w / 2;
    const ws = wins.slice().sort((a, b) => a.c - b.c);
    for (const wi of ws) {
      const l = wi.c - wi.w / 2, r = wi.c + wi.w / 2;
      if (l > cur + 1e-3) box(g, l - cur, h, d, c, (cur + l) / 2, h / 2, 0);
      if (wi.y0 > 0) box(g, wi.w, wi.y0, d, c, wi.c, wi.y0 / 2, 0);
      if (wi.y1 < h) box(g, wi.w, h - wi.y1, d, c, wi.c, (wi.y1 + h) / 2, 0);
      cur = r;
    }
    if (cur < w / 2 - 1e-3) box(g, w / 2 - cur, h, d, c, (cur + w / 2) / 2, h / 2, 0);
    return g;
  }
  function tree(parent, x, z, h, r, by, hex) {
    r = r || 0.18;
    const g = new THREE.Group(); g.position.set(x, by || 0, z); parent.add(g);
    const tr = add(g, new THREE.CylinderGeometry(r * 0.3, r, h, 7), M(hex || TREE));
    tr.position.y = h / 2;
    g.rotation.z = (rng() - 0.5) * 0.08;
    g.rotation.y = rng() * 6.28;
    for (let i = 0; i < 2; i++) {
      const bl = h * (0.12 + rng() * 0.1);
      const b = add(g, GCYL, M(hex || TREE));
      const hy = h * (0.55 + 0.3 * rng());
      const ang = (i === 0 ? 1 : -1) * (0.6 + rng() * 0.4);
      const a = new THREE.Vector3(0, hy, 0);
      const dir = new THREE.Vector3(Math.sin(ang), Math.cos(ang), 0).multiplyScalar(bl);
      segMesh(b, a, a.clone().add(dir), r * 0.22, r * 0.22);
    }
    return g;
  }
  const fires = [];
  function fire(parent, x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const o = add(g, GCONE, B(0xff6a1a)); o.scale.set(0.6 * s, 1.4 * s, 0.6 * s); o.position.y = 0.7 * s;
    const i = add(g, GCONE, B(0xffc860)); i.scale.set(0.35 * s, 0.9 * s, 0.35 * s); i.position.y = 0.45 * s;
    fires.push({ s, ph: rng() * 6.28, o, i });
    return g;
  }
  function mound(parent, x, y, z, sx, sy, sz, hex, ry) {
    const m = add(parent, GSPH, M(hex || DIRT)); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry || 0;
    return m;
  }
  const flags = [];
  function flag(parent, x, z, h, by, cw, ch, ry, droop) {
    const g = new THREE.Group(); g.position.set(x, by || 0, z); parent.add(g);
    const pole = add(g, GCYL, M(0x3a3936)); pole.scale.set(0.07, h, 0.07); pole.position.y = h / 2;
    const cl = new THREE.Group(); cl.position.y = h - 0.1; g.add(cl);
    const cloth = add(cl, GBOX, M(0x2a3550)); cloth.scale.set(cw, ch, 0.03); cloth.position.set(cw / 2, -ch / 2, 0);
    const w1 = add(cl, GBOX, M(0xc4c4c0)); w1.scale.set(cw, ch * 0.3, 0.04); w1.position.set(cw / 2, -ch / 2, 0);
    const w2 = add(cl, GBOX, M(0xc4c4c0)); w2.scale.set(cw * 0.2, ch, 0.04); w2.position.set(cw / 2, -ch / 2, 0);
    const c1 = add(cl, GBOX, M(0x8e2a2a)); c1.scale.set(cw, ch * 0.16, 0.05); c1.position.set(cw / 2, -ch / 2, 0);
    const c2 = add(cl, GBOX, M(0x8e2a2a)); c2.scale.set(cw * 0.11, ch, 0.05); c2.position.set(cw / 2, -ch / 2, 0);
    flags.push({ cl, ry: ry || 0, droop: droop || -0.3, ph: rng() * 6.28 });
    return g;
  }
  function soldier(parent, hex) {
    hex = hex || 0x3b3a34;
    const root = new THREE.Group(); parent.add(root);
    const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
    box(hips, 0.42, 0.62, 0.26, hex, 0, 0.32, 0);
    const head = add(hips, GSPH, M(0x5e5246)); head.scale.setScalar(0.12); head.position.set(0, 0.78, 0);
    const helm = add(hips, GSPH, M(0x45463e)); helm.scale.set(0.2, 0.08, 0.2); helm.position.set(0, 0.86, 0);
    function limb(px, py, l1, l2, w) {
      const j1 = new THREE.Group(); j1.position.set(px, py, 0); hips.add(j1);
      box(j1, w, l1, w, hex, 0, -l1 / 2, 0);
      const j2 = new THREE.Group(); j2.position.y = -l1; j1.add(j2);
      box(j2, w * 0.9, l2, w * 0.9, hex, 0, -l2 / 2, 0);
      return [j1, j2];
    }
    const [hl, kl] = limb(-0.11, 0, 0.45, 0.45, 0.15);
    const [hr, kr] = limb(0.11, 0, 0.45, 0.45, 0.15);
    const [sl, el] = limb(-0.27, 0.6, 0.3, 0.3, 0.1);
    const [sr, er] = limb(0.27, 0.6, 0.3, 0.3, 0.1);
    box(er, 0.05, 0.05, 1.0, 0x2a2622, 0, -0.3, 0.2, 0, 1.2, 0);
    return { root, hips, hl, kl, hr, kr, sl, el, sr, er };
  }
  function runPose(s, t, f, amp) {
    const ph = 2 * Math.PI * f * t;
    const sn = Math.sin(ph);
    s.hl.rotation.x = -amp * sn; s.hr.rotation.x = amp * sn;
    s.kl.rotation.x = 0.25 + 0.7 * Math.max(0, Math.sin(ph + 1.3));
    s.kr.rotation.x = 0.25 + 0.7 * Math.max(0, Math.sin(ph + 1.3 + Math.PI));
    s.sl.rotation.x = 0.6 * sn; s.sr.rotation.x = -0.6 * sn - 0.4;
    s.el.rotation.x = -0.9; s.er.rotation.x = -1.0;
    s.hips.position.y = 0.9 + 0.05 * Math.abs(Math.sin(ph));
    s.hips.rotation.x = 0.18;
  }
  const explosions = [];
  function explosion(parent, x, y, z, t0, t1, r, n) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const coreMat = B(0xffa040, { transparent: true, opacity: 1, depthWrite: false });
    const core = add(g, GSPH, coreMat);
    const smokeMat = new THREE.MeshLambertMaterial({ color: 0x3a3836, transparent: true, opacity: 0.6, depthWrite: false });
    const smoke = add(g, GSPH, smokeMat);
    const sparks = [];
    const sm = B(0xffd080);
    for (let i = 0; i < (n || 12); i++) {
      const m = add(g, GBOX, sm); m.scale.setScalar(0.06 + rng() * 0.08);
      const th = rng() * 6.28, el = 0.2 + rng() * 1.1, sp = r * (2.5 + rng() * 3);
      sparks.push({ m, v: new THREE.Vector3(Math.cos(th) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(th) * Math.cos(el) * sp) });
    }
    explosions.push({ g, t0, t1, r, core, coreMat, smoke, smokeMat, sparks });
    return g;
  }
  const debris = [];
  function debrisBurst(parent, o, t0, n, hex) {
    for (let i = 0; i < n; i++) {
      const m = add(parent, GSPH, M(hex || 0x1c1b19));
      const r = 0.15 + rng() * 0.35; m.scale.set(r, r * 0.8, r);
      const v = new THREE.Vector3((rng() - 0.5) * 8, 7 + rng() * 6, (rng() - 0.5) * 6);
      debris.push({ m, o: o.clone(), v, t0 });
    }
  }

  const sets = [];
  function mkSet() { const g = new THREE.Group(); scene.add(g); sets.push(g); return g; }

  // ---------- shared environment ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x2c2b29 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const hemi = new THREE.HemisphereLight(0xcccccc, 0x333333, 1.2);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(amb);
  const LGAIN = 3.6; // light intensity gain (render feedback: scene far too dark)
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hv = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  const skyU = {
    top: { value: new THREE.Vector3() }, hor: { value: new THREE.Vector3() }, bot: { value: new THREE.Vector3() },
    sunDir: { value: new THREE.Vector3(0, 0.3, -1) }, sunCol: { value: new THREE.Vector3(1, 1, 1) }, sunAmt: { value: 0 }
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform vec3 top; uniform vec3 hor; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt;',
      'varying vec3 vDir;',
      'void main(){ vec3 d = normalize(vDir); float h = d.y; vec3 c;',
      ' if (h > 0.0) { c = mix(hor, top, pow(clamp(h * 2.2, 0.0, 1.0), 0.75)); } else { c = mix(hor, bot, clamp(-h * 6.0, 0.0, 1.0)); }',
      ' float s = max(dot(d, normalize(sunDir)), 0.0);',
      ' c += sunCol * (pow(s, 60.0) * 0.6 + pow(s, 8.0) * 0.22) * sunAmt;',
      ' gl_FragColor = vec4(min(c, vec3(1.0)), 1.0); }'
    ].join('\n'),
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // letterbox bars (part of the source composition)
  {
    const dist = 0.05;
    const hh = dist * TANV, hw = hh * aspect;
    const lbMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false, transparent: true, opacity: 1 });
    const topY0 = 0.763 * hh, botY0 = -0.770 * hh, ext = 1.4 * hh;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2.6, ext - topY0), lbMat);
    top.position.set(0, (topY0 + ext) / 2, -dist); top.renderOrder = 1000; camera.add(top);
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2.6, ext + botY0), lbMat);
    bot.position.set(0, (botY0 - ext) / 2, -dist); bot.renderOrder = 1000; camera.add(bot);
  }

  // ---------- first-person rig (camera children) ----------
  const rig = new THREE.Group(); camera.add(rig);
  const gun = add(rig, GBOX, M(0x56585a));
  const handR = add(rig, GBOX, M(0x1e1e1e));
  const handL = add(rig, GBOX, M(0x1e1e1e));
  const armR = add(rig, GBOX, M(0x2e2d29));
  const armL = add(rig, GBOX, M(0x2e2d29));

  // ================= SET A: misty ruined village, flag ahead (0 - 1.57 s) =================
  const setA = mkSet();
  const A0 = P(0, 1.7, 0, 0, -0.03);
  [[412, 55, 5, 4.0, 3], [510, 55, 4, 2.8, 3], [680, 45, 7.0, 4.6, 4], [250, 70, 6, 2.5, 3], [140, 40, 2, 3.5, 2], [865, 50, 6, 3.2, 3], [590, 62, 3, 2.5, 2]]
    .forEach(([px, D, w, h, d]) => { const [x, z] = gp(A0, px, D); ruin(setA, x, z, w, h, d, 0x484643, (rng() - 0.5) * 0.4); });
  [[335, 45, 1.4], [535, 52, 0.8], [940, 22, 1.1], [290, 48, 0.7]]
    .forEach(([px, D, s]) => { const [x, z] = gp(A0, px, D); fire(setA, x, 0, z, s); });
  [[25, 60, 9], [85, 80, 10], [710, 70, 12], [742, 80, 8], [790, 75, 9], [815, 70, 9], [870, 60, 10], [60, 55, 7], [930, 45, 8]]
    .forEach(([px, D, h]) => { const [x, z] = gp(A0, px, D); tree(setA, x, z, h, 0.14); });
  { const [x, z] = gp(A0, 555, 30); flag(setA, x, z, 5.6, 0, 0.9, 1.7, 0.3, -0.9); }
  { const [x, z] = gp(A0, 470, 8); box(setA, 7, 0.02, 5, 0x7d8384, x, 0.02, z); }
  { const [x, z] = gp(A0, 760, 10); box(setA, 5, 0.02, 3, 0x7d8384, x, 0.02, z, 0.3); }
  { const [x, z] = gp(A0, 25, 3); box(setA, 0.4, 1.8, 0.4, 0x2a2826, x, 0.9, z); }
  mound(setA, -1.5, 0, -24, 14, 1.0, 8);
  mound(setA, -14, 0, -22, 7, 1.6, 7);
  mound(setA, 12, 0, -24, 8, 1.2, 6);
  // dead shrub near crouch position
  { const base = new THREE.Vector3(-2.6, 0, -13.5);
    for (let i = 0; i < 4; i++) { const b = add(setA, GCYL, M(0x24221f)); const a = 0.4 + i * 0.35; segMesh(b, base, base.clone().add(new THREE.Vector3(Math.cos(a) * 1.8, 2.4 + i * 0.3, -Math.sin(a) * 0.6)), 0.035, 0.035); } }

  // ================= SET B: green fog, wall left, fire, windowed ruin (1.57 - 4.70) =================
  const setB = mkSet();
  const B0 = P(0, 1.6, 0, 0, 0);
  { const [x, z] = gp(B0, 282, 9); ruin(setB, x, z, 3.3, 5.2, 1.0, 0x3d3c39); }
  { const [x, z] = gp(B0, 895, 6); ruin(setB, x, z, 1.5, 5, 1.5, 0x2a2927); }
  { const [x, z] = gp(B0, 150, 34); flag(setB, x, z, 11, 0.8, 1.2, 2.4, 0.2, -1.1); }
  { const [x, z] = gp(B0, 605, 14); fire(setB, x, 0, z, 1.2); }
  { const [x, z] = gp(B0, 440, 40); wallWin(setB, x, z, 14, 5.5, 1, [{ c: -3.1, w: 1.2, y0: 1.0, y1: 3.0 }, { c: 0.2, w: 1.3, y0: 0.0, y1: 3.2 }, { c: 3.9, w: 1.2, y0: 1.0, y1: 3.0 }], 0x4a4945); }
  [[378, 40, 14], [452, 50, 12], [476, 55, 10], [517, 45, 12], [620, 30, 14], [632, 50, 12], [685, 40, 12], [805, 35, 13], [410, 60, 9], [845, 60, 11], [700, 70, 10], [905, 45, 12], [560, 65, 9]]
    .forEach(([px, D, h]) => { const [x, z] = gp(B0, px, D); tree(setB, x, z, h, 0.14); });
  { const [x, z] = gp(B0, 590, 35); ruin(setB, x, z, 3, 3.5, 2, 0x3e3d3a); }
  { const [x, z] = gp(B0, 90, 60); ruin(setB, x, z, 8, 5, 4, 0x3e3d3a); }
  { const [x, z] = gp(B0, 180, 6); const b = add(setB, GCYL, M(0x55534d)); b.scale.set(0.35, 0.9, 0.35); b.position.set(x, 0.35, z); b.rotation.z = Math.PI / 2; b.rotation.y = 0.4; }
  mound(setB, 1.5, 0, -12, 3, 1.2, 2.5, 0x2a2a28);
  mound(setB, -14, 0, -28, 12, 3, 10, 0x2c2c29);
  mound(setB, 7, 0, -9, 3, 0.8, 2.5, 0x2a2a28);

  // ================= SET C: dark rubble slope, running soldier, explosion (4.70 - 5.73) =================
  const setC = mkSet();
  const C0 = P(0, 1.7, 0, 0, -0.05);
  const cZ0 = -4.5, cZ1 = -21, cH = 4.6;
  const cGround = (z) => (z > cZ0 ? 0 : z > cZ1 ? (cZ0 - z) * cH / (cZ0 - cZ1) : cH);
  {
    const L = Math.hypot(cZ0 - cZ1, cH), ang = Math.atan2(cH, cZ0 - cZ1);
    box(setC, 70, 0.6, L, 0x29292b, 0, cH / 2 - 0.3, (cZ0 + cZ1) / 2, 0, ang, 0);
    box(setC, 90, cH, 60, 0x29292b, 0, cH / 2, cZ1 - 30);
    for (let i = 0; i < 26; i++) {
      const z = -3 - rng() * 17, x = (rng() - 0.5) * 30, s = 0.3 + rng() * 0.7;
      box(setC, s * 1.3, s, s, 0x3c3c3e, x, cGround(z) + s * 0.3, z, rng() * 3, rng() * 0.5, 0);
    }
  }
  box(setC, 1.1, 0.9, 1.0, 0x45464a, -0.9, 0.3, -3, 0.5, 0.2, 0.1);
  box(setC, 1.0, 0.8, 0.9, 0x3d3e42, -3.0, 0.3, -3.6, 0.2, 0, 0.2);
  box(setC, 0.9, 0.7, 0.8, 0x3a3b3f, -3.6, 0.2, -2.2, 0.9, 0.1, 0);
  box(setC, 0.8, 0.6, 0.7, 0x3a3b3f, -1.9, 0.2, -2.0, 0.3, 0, 0.2);
  ruin(setC, 13, -40, 6, 5, 3, 0x3e3f42, 0.2, cH);
  ruin(setC, -8, -45, 10, 3, 3, 0x3a3b3e, -0.1, cH);
  ruin(setC, 3, -52, 4, 6, 3, 0x3a3b3e, 0, cH);
  const S1 = soldier(setC, 0x37362f);
  const S2 = soldier(setC, 0x37362f);
  explosion(setC, -5.6, cGround(-17.6) + 1.3, -17.6, 4.85, 5.8, 0.8, 22);
  { const sm = new THREE.MeshLambertMaterial({ color: 0x6a6c70, transparent: true, opacity: 0.35, depthWrite: false });
    const p = at(C0, 300, 210, 9); const m = add(setC, GSPH, sm); m.scale.set(3.2, 1.2, 2); m.position.copy(p); }

  // ================= SET D: soldier ahead, explosion behind, stone ruins (5.73 - 6.78) =================
  const setD = mkSet();
  const D0 = P(0, 1.6, 0, 0, 0);
  mound(setD, 0, 0, -4.5, 5, 0.45, 2.5, 0x2b2b2b);
  { const [x, z] = gp(D0, 65, 14); ruin(setD, x, z, 5, 3.4, 1.2, 0x55565a, 0.2); }
  { const [x, z] = gp(D0, 300, 25); ruin(setD, x, z, 6, 2.5, 1.5, 0x55565a); }
  { const [x, z] = gp(D0, 420, 22); ruin(setD, x, z, 3, 4.5, 2, 0x4e4f53); }
  { const [x, z] = gp(D0, 667, 22); ruin(setD, x, z, 2.2, 5.5, 2, 0x55565a); }
  { const [x, z] = gp(D0, 825, 15); mound(setD, x, 0, z, 7, 2.8, 3, 0x46474b); }
  { const [x, z] = gp(D0, 900, 9); mound(setD, x, 0, z, 3, 1.6, 2, 0x3e3f43); }
  box(setD, 1.0, 0.9, 0.9, 0x3f4044, -2.6, 0.35, -3.0, 0.4, 0.2, 0);
  box(setD, 0.9, 0.7, 0.8, 0x45464a, -1.4, 0.25, -2.4, 0.9, 0, 0.2);
  box(setD, 1.2, 0.9, 1.0, 0x3a3b3f, -3.2, 0.3, -1.8, 0.2, 0, 0.1);
  const S3 = soldier(setD, 0x3a3933);
  explosion(setD, 0.8, 1.7, -10, 5.95, 6.95, 0.9, 18);

  // ================= SET E: tank crossing over crater rim, flag beyond (6.78 - 10.95) =================
  const setE = mkSet();
  const E3 = P(0, 1.15, 0, 0, 0);
  const tankHead = Math.PI - 0.25;
  mound(setE, -5.5, 0, -6.3, 8.5, 0.8, 3, 0x3a3a37, -0.25);
  mound(setE, 2.5, 0, -3.5, 3, 0.6, 2, 0x2a2a28);
  mound(setE, -9, 0, -8, 5, 1.0, 3, 0x2a2a28, -0.25);
  const FE = gp(E3, 660, 30);
  flag(setE, FE[0], FE[1], 10.4, 0, 3.6, 2.4, 0.15, -0.45);
  wallWin(setE, FE[0] - 1.5, FE[1] - 2, 7, 3.5, 1, [{ c: 0.8, w: 0.8, y0: 1.2, y1: 2.2 }], 0x4a4a47);
  ruin(setE, FE[0] + 7, FE[1] - 3, 2, 3.5, 2, 0x4a4a47);
  tree(setE, FE[0] + 9, FE[1] - 4, 9, 0.16);
  tree(setE, FE[0] + 12, FE[1] - 6, 7, 0.14);
  ruin(setE, FE[0] - 18, FE[1] - 8, 8, 3, 3, 0x40403d);
  // tank (Mark V style rhomboid proxy) : front along local +x
  const tankYaw = new THREE.Group(); setE.add(tankYaw);
  const tankPitch = new THREE.Group(); tankYaw.add(tankPitch);
  {
    const sh = new THREE.Shape();
    const pts = [[-3.0, -1.3], [3.0, -1.3], [4.0, 0.1], [3.4, 1.3], [-3.4, 1.3], [-4.0, 0.1]];
    sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false });
    const tl = add(tankPitch, tg, M(0x6a6b63)); tl.position.z = 1.2;
    const tr = add(tankPitch, tg, M(0x6a6b63)); tr.position.z = -1.8;
    box(tankPitch, 6.4, 1.9, 2.4, 0x7a7b72, 0, 0.1, 0);
    box(tankPitch, 1.5, 0.9, 1.5, 0x76776e, 2.0, 1.45, 0);
    box(tankPitch, 1.4, 0.9, 0.6, 0x6e6f68, 0.4, -0.1, 2.1);
    box(tankPitch, 1.4, 0.9, 0.6, 0x6e6f68, 0.4, -0.1, -2.1);
    const g1 = add(tankPitch, GCYL, M(0x2a2a28)); g1.scale.set(0.08, 1.0, 0.08); g1.position.set(1.5, -0.1, 2.25); g1.rotation.z = Math.PI / 2;
    const g2 = add(tankPitch, GCYL, M(0x2a2a28)); g2.scale.set(0.08, 1.0, 0.08); g2.position.set(1.5, -0.1, -2.25); g2.rotation.z = Math.PI / 2;
    box(tankPitch, 0.3, 0.3, 3.8, 0x2f2f2c, -2.4, 1.5, 0);
    box(tankPitch, 5.5, 0.08, 0.08, 0x2f2f2c, -0.6, 1.75, 1.1);
    box(tankPitch, 5.5, 0.08, 0.08, 0x2f2f2c, -0.6, 1.75, -1.1);
  }
  tankYaw.rotation.y = tankHead;
  tankYaw.scale.setScalar(1.15);

  // ================= SET F: climbing toward flagpole and ruins, low sun (10.95 - 14.08) =================
  const setF = mkSet();
  const F0 = P(0, 1.6, 0, 0, -0.07);
  mound(setF, -1, 0, -17, 18, 0.7, 9, 0x2b2b29);
  mound(setF, 10, 0, -14, 8, 1.2, 8, 0x2d2d2a);
  flag(setF, -3.5, -11.5, 9.5, 0.4, 2.2, 1.7, 0.1, -0.7);
  ruin(setF, -4.5, -14.5, 2.6, 2.2, 1.5, 0x5a5853, 0.1, 0.5);
  box(setF, 1.0, 1.5, 6, 0x4a4844, -4.4, 1.0, -20);
  wallWin(setF, -3.9, -25.7, 4.4, 3.5, 1.0, [{ c: 0.0, w: 0.9, y0: 1.3, y1: 3.0 }], 0x4c4a46, 0.05, 0.3);
  ruin(setF, -1.0, -27.5, 3.0, 3.0, 4, 0x46443f, 0.1, 0.2);
  [[605, 40, 14], [760, 45, 12], [772, 50, 10], [850, 50, 10], [700, 60, 8], [880, 70, 9], [810, 80, 8]]
    .forEach(([px, D, h]) => { const [x, z] = gp(F0, px, D); tree(setF, x, z, h, 0.14); });
  { const [x, z] = gp(F0, 945, 15); tree(setF, x, z, 14, 0.3); }
  { const [x, z] = gp(F0, 575, 40); ruin(setF, x, z, 2.5, 4, 2, 0x55534f); }
  { const [x, z] = gp(F0, 615, 40); fire(setF, x, 0.5, z, 0.8); }
  { const [x, z] = gp(F0, 870, 30); fire(setF, x, 0.2, z, 0.7); }
  { const [ax, az] = gp(F0, 550, 6); const [bx, bz] = gp(F0, 780, 5); const l = add(setF, GCYL, M(0x3a3632)); segMesh(l, new THREE.Vector3(ax, 0.25, az), new THREE.Vector3(bx, 0.3, bz), 0.2, 0.2); }
  { const [x, z] = gp(F0, 650, 10); const s = add(setF, GCYL, M(0x2a2622)); s.scale.set(0.25, 1.6, 0.25); s.position.set(x, 0.8, z); }
  { const [x, z] = gp(F0, 740, 15); const s = add(setF, GCYL, M(0x2a2622)); s.scale.set(0.3, 2.4, 0.3); s.position.set(x, 1.2, z); }

  // ================= SET G: ruined house, into building, aim out window (14.08 - 19.30) =================
  const setG = mkSet();
  const G0 = P(0, 1.6, 0, 0, 0);
  const G4 = P(-1.1, 1.55, -10, -0.05, 0);
  const G3 = P(-0.6, 1.6, -9.0, 0, 0);
  wallWin(setG, 0.05, -7, 3.24, 3.4, 0.45, [{ c: 0.11, w: 0.55, y0: 1.6, y1: 2.75 }], STONE2);
  wallWin(setG, 0.25, -11, 4.5, 3.2, 0.45, [{ c: -1.05, w: 1.4, y0: 0.95, y1: 2.25 }], 0x4a4946);
  box(setG, 0.45, 3.0, 1.0, 0x454441, -2.0, 1.5, -10.5);
  box(setG, 0.45, 2.2, 4.0, 0x4a4946, 2.45, 1.1, -9);
  mound(setG, 0.8, 0, -9, 1.4, 0.4, 1.0, 0x3a3936);
  mound(setG, -4.6, 0, -5.5, 3.5, 0.9, 3, 0x45443f);
  mound(setG, -8, 0, -9, 4, 1.6, 4, 0x34332f);
  mound(setG, 6, 0, -3, 3.5, 1.4, 3, 0x2e2d2a);
  { const [x, z] = gp(G0, 805, 30); ruin(setG, x, z, 2.5, 7, 2.5, 0x45443f); }
  { const [x, z] = gp(G0, 780, 40); tree(setG, x, z, 14, 0.25); }
  { const [x, z] = gp(G0, 680, 35); ruin(setG, x, z, 2, 2.5, 2, 0x45443f); }
  { const [x, z] = gp(G0, 85, 50); fire(setG, x, 0, z, 1.0); }
  [[40, 50, 10], [160, 45, 9], [195, 45, 11], [130, 60, 8], [880, 45, 10]]
    .forEach(([px, D, h]) => { const [x, z] = gp(G0, px, D); tree(setG, x, z, h, 0.13); });
  { const [x, z] = gp(G4, 567, 8); ruin(setG, x, z, 1.4, 2.9, 1.2, 0x4e4d49); }
  { const [x, z] = gp(G4, 790, 9); ruin(setG, x, z, 6, 1.5, 1.5, 0x46453f, -0.2); }
  { const [x, z] = gp(G4, 365, 18); fire(setG, x, 0.3, z, 1.0); }
  { const [x, z] = gp(G4, 365, 60); ruin(setG, x, z, 12, 8, 6, 0x5a5a58); }
  { const [x, z] = gp(G4, 690, 30); fire(setG, x, 0, z, 0.9); }
  { const [x, z] = gp(G4, 920, 25); tree(setG, x, z, 10, 0.25); }
  { const [x, z] = gp(G3, 460, 25); tree(setG, x, z, 12, 0.22); }
  { const [x, z] = gp(G3, 420, 30); tree(setG, x, z, 9, 0.16); }
  { const [x, z] = gp(G3, 390, 30); ruin(setG, x, z, 2, 2.5, 2, 0x4a4945); }
  { const [x, z] = gp(G3, 345, 20); mound(setG, x, 0, z, 2.5, 1.5, 2, 0x8a8a86); }
  { const [x, z] = gp(G3, 250, 14); mound(setG, x, 0, z, 4, 1.4, 2, 0x3e3d3a); }

  // ================= SET H: green-fog no-man's land, shell burst, falling (19.30 - 24.0) =================
  const setH = mkSet();
  const H0 = P(0, 1.5, 0, 0, 0);
  const H1 = P(1, 1.5, -4, -0.35, 0);
  const H3 = P(2.5, 1.4, -9, 0, 0);
  const H4 = P(3, 0.45, -12, -0.1, 0);
  ruin(setH, -4.4, -13.3, 2.8, 7, 2.5, 0x4a4945, 0.1, 0.8);
  mound(setH, -3.5, 0, -12.5, 5, 1.6, 4, 0x2c2c28);
  mound(setH, -2.5, 0, -6.5, 4, 1.5, 3.2, 0x2f2f2a);
  [[505, 25, 12], [560, 30, 13], [700, 20, 15], [740, 35, 11], [920, 30, 14], [60, 35, 12]]
    .forEach(([px, D, h]) => { const [x, z] = gp(H0, px, D); tree(setH, x, z, h, 0.13); });
  { const a = at(H0, 900, 420, 4); const b = at(H0, 760, 300, 8); a.y = 0.2; b.y = 0.9; const l = add(setH, GCYL, M(0x2a2622)); segMesh(l, a, b, 0.16, 0.16); }
  { const [x, z] = gp(H0, 480, 30); fire(setH, x, 0, z, 0.8); }
  { const a = at(H1, 740, 290, 9); a.y = 0; const b = at(H1, 590, 120, 9); const l = add(setH, GCYL, M(0x2c2925)); segMesh(l, a, b, 0.45, 0.45); }
  { const [x, z] = gp(H1, 805, 30); ruin(setH, x, z, 3, 4, 2, 0x55544f); }
  [[160, 25, 14], [240, 25, 14], [380, 30, 12], [745, 35, 12], [920, 40, 12]]
    .forEach(([px, D, h]) => { const [x, z] = gp(H1, px, D); tree(setH, x, z, h, 0.13); });
  { const [x, z] = gp(H1, 415, 18); tree(setH, x, z, 15, 0.35); }
  [[95, 15, 14], [215, 20, 13], [455, 18, 14], [625, 30, 12], [845, 25, 12]]
    .forEach(([px, D, h]) => { const [x, z] = gp(H3, px, D); tree(setH, x, z, h, 0.13); });
  { const [x, z] = gp(H3, 510, 14); tree(setH, x, z, 16, 0.38); }
  [[50, 22, 1.0], [440, 30, 0.6], [740, 28, 0.6]].forEach(([px, D, s]) => { const [x, z] = gp(H3, px, D); fire(setH, x, 0, z, s); });
  { const [x, z] = gp(H3, 590, 20); const s = add(setH, GCYL, M(0x2a2622)); s.scale.set(0.25, 2, 0.25); s.position.set(x, 1, z); }
  { const [x, z] = gp(H3, 700, 22); const s = add(setH, GCYL, M(0x2a2622)); s.scale.set(0.3, 3, 0.3); s.position.set(x, 1.5, z); }
  mound(setH, 0.5, 0, -16.5, 2.5, 1.6, 3.5, 0x33332c);
  mound(setH, 3.5, 0, -19, 3, 0.9, 2, 0x33332c);
  { const [x, z] = gp(H4, 780, 4.5); box(setH, 4, 0.03, 3, 0x6f786c, x + 0.5, 0.03, z - 0.5, 0.2); }
  [[455, 30, 12], [695, 35, 12], [840, 35, 10]]
    .forEach(([px, D, h]) => { const [x, z] = gp(H4, px, D); tree(setH, x, z, h, 0.14); });
  [[780, 30, 3], [815, 30, 4]].forEach(([px, D, h]) => { const [x, z] = gp(H4, px, D); const s = add(setH, GCYL, M(0x2a2622)); s.scale.set(0.25, h, 0.25); s.position.set(x, h / 2, z); });
  debrisBurst(setH, new THREE.Vector3(-1, 0.3, -16), 21.4, 16);
  explosion(setH, -1, 1.0, -16, 21.35, 22.3, 1.6, 10);
  const plumeMat = new THREE.MeshLambertMaterial({ color: 0xc08a5a, transparent: true, opacity: 0.0, depthWrite: false });
  const plume = add(setH, GSPH, plumeMat);
  const plumePos = at(H4, 330, 100, 30);

  // ================= shots =================
  const K = (arr) => arr.map(([t, v, vis]) => ({ t, v, vis: vis === undefined ? 1 : vis }));
  function R(t, m, g, l, w, vis) {
    const ll = l || [g[0] + 0.55 * (m[0] - g[0]), g[1] + 0.55 * (m[1] - g[1]), g[2] + 0.55 * (m[2] - g[2])];
    return { t, v: [m[0], m[1], m[2], g[0], g[1], g[2], ll[0], ll[1], ll[2], w || 0.02], vis: vis === undefined ? 1 : vis };
  }
  function env(o, pose) {
    if (pose && o.sun) o.sunDir = ray(pose, o.sun[0], o.sun[1]).normalize();
    else o.sunDir = new THREE.Vector3(0.3, 0.5, -1).normalize();
    return o;
  }
  const HANDSUP = [[590, 95, 0.8], [870, 215, 0.6], [640, 190, 0.45]];
  const SHOTS = [
    { set: setA, t0: 0, t1: 1.57,
      env: env({ top: 0x7a7d80, hor: 0xd6d6d2, bot: 0x6a6a68, sun: [720, 175], sunAmt: 0.9, sunCol: 0xfff6e0, fog: [0xa9aba9, 8, 130], hemi: [0xd8d8d8, 0x3a3a38, 1.3], dir: [0xfff4e4, 1.2], ground: 0x363532 }, A0),
      cam: K([[0, [0, 1.7, 0, 0, -0.03, 0]], [1.05, [-0.5, 1.0, -12, 0.0, 0.02, 0]], [1.57, [-0.6, 1.0, -14.5, 0.01, 0.02, 0]]]),
      rig: [R(0, [220, 268, 1.1], [400, 470, 0.38]), R(1.05, [10, 268, 0.9], [560, 470, 0.36]), R(1.57, [10, 268, 0.9], [560, 470, 0.36])] },
    { set: setB, t0: 1.57, t1: 4.70,
      env: env({ top: 0x7f8378, hor: 0xb5bb84, bot: 0x5a5e48, sun: [390, 130], sunAmt: 0.7, sunCol: 0xfff4d8, fog: [0x8d9470, 5, 100], hemi: [0xc8cca8, 0x30302a, 1.2], dir: [0xfff0d0, 1.0], ground: 0x33332e }, B0),
      cam: K([[1.57, [0, 1.6, 2.0, -0.02, 0, 0]], [2.08, [0, 1.6, 0, 0, 0, 0]], [3.13, [0, 1.6, -4, 0.03, 0, 0]], [4.17, [0, 1.6, -8, 0.08, 0, 0]], [4.7, [0.1, 1.6, -10, 0.1, 0, 0]]]),
      rig: [R(1.57, [40, 215, 1.0], [340, 470, 0.38]), R(2.08, [20, 215, 1.0], [330, 470, 0.38]), R(3.13, [45, 245, 1.0], [380, 470, 0.38]), R(4.17, [170, 280, 1.0], [470, 470, 0.38]), R(4.7, [170, 280, 1.0], [470, 470, 0.38])] },
    { set: setC, t0: 4.70, t1: 5.73,
      env: env({ top: 0x3a3d40, hor: 0x8a8f94, bot: 0x3a3c3e, sunAmt: 0, sunCol: 0xffffff, fog: [0x5a5e62, 3, 60], hemi: [0xa8aeb4, 0x2a2a2a, 1.15], dir: [0xd0d4d8, 0.5], ground: 0x303134 }),
      cam: K([[4.7, [0, 1.7, 0.5, 0.05, -0.05, 0]], [5.22, [0, 1.7, 0, 0, -0.05, 0]], [5.73, [0, 1.7, -0.5, -0.05, -0.05, 0]]]),
      rig: [R(4.7, [600, 600, 1], [700, 700, 0.4], null, 0.045, 0), R(5.73, [600, 600, 1], [700, 700, 0.4], null, 0.045, 0)] },
    { set: setD, t0: 5.73, t1: 6.78,
      env: env({ top: 0x4a4d52, hor: 0xc4c5c4, bot: 0x707070, sun: [500, 140], sunAmt: 0.3, sunCol: 0xffffff, fog: [0x8c8f91, 12, 120], hemi: [0xc8cacc, 0x303030, 1.1], dir: [0xffffff, 0.8], ground: 0x2a2a2a }, D0),
      cam: K([[5.73, [0, 1.6, 0.5, 0.03, 0, 0]], [6.25, [0, 1.6, 0, 0, 0, 0]], [6.78, [0, 1.6, -0.5, -0.03, 0, 0]]]),
      rig: [R(5.73, [600, 290, 1.0], [790, 470, 0.4]), R(6.78, [600, 290, 1.0], [790, 470, 0.4])] },
    { set: setE, t0: 6.78, t1: 10.95,
      env: env({ top: 0x45484a, hor: 0x8f9292, bot: 0x5a5c5c, sunAmt: 0, sunCol: 0xffffff, fog: [0x6c6f6f, 6, 95], hemi: [0xb0b4b4, 0x2a2a2a, 1.0], dir: [0xe8eaea, 0.6], ground: 0x2c2d2b }),
      cam: K([[6.78, [0, 0.8, 0.3, 0.18, 0.28, -0.08]], [7.3, [0, 0.8, 0, 0.15, 0.25, -0.1]], [8.35, [0, 1.1, 0, 0.35, 0.08, 0]], [9.38, [-0.6, 1.15, 4, 0, 0, 0]], [10.43, [-2.2, 1.15, 6, -0.1, 0.02, 0]], [10.95, [-2.8, 1.15, 6.8, -0.12, 0.02, 0]]]),
      rig: [R(6.78, HANDSUP[0], HANDSUP[1], HANDSUP[2]), R(7.3, HANDSUP[0], HANDSUP[1], HANDSUP[2]),
        R(8.35, [722, 200, 0.6], [765, 330, 0.45], [790, 400, 0.42], 0.022), R(9.38, [585, 325, 0.7], [620, 420, 0.45], [640, 460, 0.42], 0.022),
        R(10.0, [585, 600, 0.7], [620, 700, 0.45], [640, 720, 0.42], 0.04, 0), R(10.95, [585, 600, 0.7], [620, 700, 0.45], [640, 720, 0.42], 0.04, 0)] },
    { set: setF, t0: 10.95, t1: 14.08,
      env: env({ top: 0x575a5e, hor: 0xd8d5ce, bot: 0x777774, sun: [760, 180], sunAmt: 1.0, sunCol: 0xfff2dc, fog: [0xadadaa, 8, 140], hemi: [0xd0d0cc, 0x333331, 1.3], dir: [0xfff2dc, 1.3], ground: 0x343432 }, F0),
      cam: K([[10.95, [0, 1.6, 2.5, 0, -0.07, 0]], [11.47, [0, 1.6, 0, 0, -0.07, 0]], [12.52, [-0.2, 1.65, -6, 0.06, -0.08, 0]], [13.55, [-0.5, 2.2, -12, -0.03, -0.03, 0]], [14.08, [-0.6, 2.25, -14.5, -0.05, -0.03, 0]]]),
      rig: [R(10.95, [450, 270, 1.1], [620, 470, 0.4]), R(11.47, [450, 270, 1.1], [620, 470, 0.4]), R(12.52, [80, 365, 0.9], [330, 470, 0.36]), R(13.55, [150, 245, 1.0], [450, 470, 0.38]), R(14.08, [150, 245, 1.0], [450, 470, 0.38])] },
    { set: setG, t0: 14.08, t1: 19.30,
      env: env({ top: 0x494c50, hor: 0xb0b1b2, bot: 0x6e6f70, sun: [700, 120], sunAmt: 0.4, sunCol: 0xfff8f0, fog: [0x8f9193, 6, 110], hemi: [0xc4c6c8, 0x2e2e2e, 1.2], dir: [0xf4f0ea, 0.9], ground: 0x353534 }, G0),
      cam: K([[14.08, [0, 1.6, 1.5, 0.02, 0, 0]], [14.6, [0, 1.6, 0, 0, 0, 0]], [15.63, [-1.87, 1.75, -4, -0.04, -0.02, 0]], [16.68, [-2.0, 1.6, -8.5, 0.35, 0, 0]], [17.73, [-0.6, 1.6, -9.0, 0, -0.02, 0]], [18.77, [-1.1, 1.55, -10.0, -0.05, 0, 0]], [19.3, [-1.1, 1.55, -10.05, -0.06, 0, 0]]]),
      rig: [R(14.08, [490, 305, 1.0], [700, 470, 0.38]), R(14.6, [490, 305, 1.0], [700, 470, 0.38]), R(15.63, [455, 315, 1.0], [660, 470, 0.38]), R(16.68, [480, 290, 1.0], [760, 470, 0.38]), R(17.73, [450, 320, 1.0], [650, 470, 0.38]), R(18.77, [490, 360, 0.6], [500, 470, 0.3], [600, 440, 0.35], 0.07), R(19.3, [490, 360, 0.6], [500, 470, 0.3], [600, 440, 0.35], 0.07)] },
    { set: setH, t0: 19.30, t1: 24.5,
      env: env({ top: 0x6a6e44, hor: 0xccd088, bot: 0x5c6040, sun: [600, 150], sunAmt: 0.3, sunCol: 0xfffff0, fog: [0xa2a874, 6, 100], hemi: [0xd0d4a0, 0x2a2a24, 1.15], dir: [0xf0f0c8, 0.7], ground: 0x34342d }, H0),
      cam: K([[19.3, [-0.5, 1.5, 1.0, 0.05, -0.03, 0.05]], [19.82, [0, 1.5, 0, 0, -0.03, 0.08]], [20.85, [1, 1.5, -4, -0.35, 0, 0]], [21.9, [1.5, 0.5, -6, 0.15, 0.05, 0.1]], [22.93, [2.5, 1.4, -9, 0, 0.03, 0]], [23.98, [3, 0.45, -12, -0.1, 0.08, 0.04]], [24.5, [3, 0.45, -12.1, -0.1, 0.08, 0.04]]]),
      rig: [R(19.3, [735, 70, 0.8], [960, 240, 0.55]), R(19.82, [735, 70, 0.8], [960, 240, 0.55]), R(20.85, [470, 280, 1.1], [700, 470, 0.4]), R(21.9, [120, 370, 0.8], [330, 470, 0.35]), R(22.93, [170, 190, 1.0], [560, 470, 0.4]), R(23.5, [100, 600, 1.0], [400, 700, 0.4], null, 0.045, 0), R(24.5, [100, 600, 1.0], [400, 700, 0.4], null, 0.045, 0)] }
  ];
  for (const s of SHOTS) s.envV = { top: hv(s.env.top), hor: hv(s.env.hor), bot: hv(s.env.bot), sunCol: hv(s.env.sunCol) };

  // ---------- keyframe sampling ----------
  function sampleKeys(keys, t) {
    const n = keys.length;
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1].t) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const dt = k2.t - k1.t;
    const u = (t - k1.t) / dt, u2 = u * u, u3 = u2 * u;
    return k1.v.map((p1, j) => {
      const p0 = k0.v[j], p2 = k2.v[j], p3 = k3.v[j];
      const m1 = (k0 === k1) ? (p2 - p1) : (p2 - p0) / (k2.t - k0.t) * dt;
      const m2 = (k3 === k2) ? (p2 - p1) : (p3 - p1) / (k3.t - k1.t) * dt;
      return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
    });
  }
  function linKeys(keys, t) {
    const n = keys.length;
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1];
    const u = (t - a.t) / (b.t - a.t);
    return a.v.map((x, j) => x + (b.v[j] - x) * u);
  }
  function stepVis(keys, t) {
    let v = keys[0].vis;
    for (const k of keys) if (t >= k.t) v = k.vis;
    return v;
  }

  const tankKeys = K([[6.78, [1.0, 2.6, -9.0, 0.25, 3.9]], [7.3, [-0.6, 2.4, -8.0, 0.2, 3.70]], [8.35, [-4.66, 2.1, -6.14, 0.0, Math.PI - 0.25]], [9.38, [-5.42, 2.05, -6.14, -0.04, Math.PI - 0.25]], [10.43, [-7.09, 1.9, -6.64, -0.12, Math.PI - 0.25]], [10.95, [-7.6, 1.8, -6.8, -0.14, Math.PI - 0.25]]]);

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _s = new THREE.Vector3();
  const _el = new THREE.Vector3();

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, 24));
    let shot = SHOTS[SHOTS.length - 1];
    for (const s of SHOTS) { if (t >= s.t0 && t < s.t1) { shot = s; break; } }
    for (const g of sets) g.visible = (g === shot.set);

    // environment
    const e = shot.env, ev = shot.envV;
    skyU.top.value.copy(ev.top); skyU.hor.value.copy(ev.hor); skyU.bot.value.copy(ev.bot);
    skyU.sunCol.value.copy(ev.sunCol); skyU.sunAmt.value = e.sunAmt; skyU.sunDir.value.copy(e.sunDir);
    fog.color.setHex(e.fog[0]); fog.near = e.fog[1]; fog.far = e.fog[2];
    if (shot.set === setE) {
      const k = Math.min(1, Math.max(0, (t - 9.6) / 0.8));
      fog.far = 95 - 45 * k; fog.near = 6 - 3 * k;
    }
    scene.background.setHex(e.fog[0]);
    hemi.color.setHex(e.hemi[0]); hemi.groundColor.setHex(e.hemi[1]); hemi.intensity = e.hemi[2] * LGAIN;
    amb.color.setHex(e.fog[0]); amb.intensity = 0.45 * e.hemi[2] * LGAIN;
    sunLight.color.setHex(e.dir[0]); sunLight.intensity = e.dir[1] * LGAIN;
    sunLight.position.copy(e.sunDir).multiplyScalar(100); sunLight.position.y = Math.abs(sunLight.position.y) + 40;
    ground.material.color.setHex(e.ground);

    // camera
    const c = sampleKeys(shot.cam, t);
    camera.position.set(c[0], c[1], c[2]);
    camera.rotation.set(c[4], c[3], c[5], 'YXZ');
    camera.fov = FOV; camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    sky.position.copy(camera.position);

    // first-person rig
    const rv = linKeys(shot.rig, t);
    const vis = stepVis(shot.rig, t) === 1;
    rig.visible = vis;
    if (vis) {
      const m = cp(rv[0], rv[1], rv[2]), g = cp(rv[3], rv[4], rv[5]), l = cp(rv[6], rv[7], rv[8]);
      const w = rv[9];
      _s.subVectors(m, g);
      _a.copy(g).addScaledVector(_s, -0.22);
      segMesh(gun, _a, m, w, w * 1.3);
      handR.position.copy(g); handR.quaternion.copy(gun.quaternion); handR.scale.set(0.05, 0.065, 0.055);
      handL.position.copy(l); handL.quaternion.copy(gun.quaternion); handL.scale.set(0.048, 0.06, 0.052);
      _el.set(g.x + 0.03, g.y - 0.22, g.z + 0.05); segMesh(armR, g, _el, 0.055, 0.055);
      _el.set(l.x - 0.03, l.y - 0.22, l.z + 0.05); segMesh(armL, l, _el, 0.05, 0.05);
    }

    // fires flicker
    for (const f of fires) {
      const k = 1 + 0.15 * Math.sin(t * 11 + f.ph) + 0.1 * Math.sin(t * 17.3 + f.ph * 2);
      f.o.scale.y = 1.4 * f.s * k; f.o.position.y = 0.7 * f.s * k;
      f.i.scale.y = 0.9 * f.s * (2 - k); f.i.position.y = 0.45 * f.s * (2 - k);
    }
    // flags
    for (const f of flags) {
      f.cl.rotation.y = f.ry + 0.25 * Math.sin(1.6 * t + f.ph);
      f.cl.rotation.z = f.droop + 0.08 * Math.sin(2.3 * t + f.ph);
      f.cl.rotation.x = 0.1 * Math.sin(1.9 * t + f.ph * 0.7);
    }
    // explosions
    for (const x of explosions) {
      const tau = (t - x.t0) / (x.t1 - x.t0);
      const on = tau >= 0 && tau <= 1;
      x.g.visible = on;
      if (!on) continue;
      const grow = Math.sqrt(Math.min(1, tau * 3));
      x.core.scale.setScalar(x.r * (0.35 + 0.65 * grow));
      x.coreMat.opacity = Math.max(0, 1 - tau * 1.25);
      x.core.visible = x.coreMat.opacity > 0.01;
      x.smoke.scale.setScalar(x.r * (0.4 + 0.9 * tau));
      x.smoke.position.y = x.r * 0.8 * tau;
      x.smokeMat.opacity = 0.35 * Math.min(1, tau * 4) * (1 - tau);
      const dt = t - x.t0;
      for (const sp of x.sparks) {
        sp.m.position.set(sp.v.x * dt, sp.v.y * dt - 4.9 * dt * dt, sp.v.z * dt);
        sp.m.visible = tau < 0.8;
      }
    }
    // debris (ballistic, absolute time)
    for (const d of debris) {
      const dt = t - d.t0;
      if (dt < 0) { d.m.visible = false; continue; }
      const y = d.o.y + d.v.y * dt - 4.9 * dt * dt;
      d.m.visible = y > -0.3;
      d.m.position.set(d.o.x + d.v.x * dt, y, d.o.z + d.v.z * dt);
      d.m.rotation.set(dt * 3, dt * 2, 0);
    }
    // plume
    {
      const tau = (t - 23.2) / 0.8;
      plume.visible = tau > 0;
      const k = Math.min(1, Math.max(0, tau));
      plume.position.set(plumePos.x, plumePos.y + 2 * k, plumePos.z);
      plume.scale.set(1.6 + 1.2 * k, 1.1 + 0.8 * k, 1.6 + 1.2 * k);
      plumeMat.opacity = 0.75 * k;
    }

    // soldiers
    {
      const x1 = 0.5 + 3.5 * (t - 5.22), z1 = -5.7;
      S1.root.position.set(x1, cGround(z1), z1);
      S1.root.rotation.y = Math.PI / 2 - 0.3;
      runPose(S1, t, 1.6, 0.75);
      S2.root.position.set(-4.5, cGround(-17.4), -17.4);
      S2.root.rotation.y = 0.6;
      runPose(S2, t * 0.3, 0.5, 0.2);
      S2.sr.rotation.x = -2.6 + 0.4 * Math.sin(t * 3); S2.er.rotation.x = -0.6;
      const x3 = -0.32 - 1.8 * (t - 6.25);
      S3.root.position.set(x3, 0.4, -4.5);
      S3.root.rotation.y = -Math.PI / 2 + 0.35;
      runPose(S3, t, 1.5, 0.6);
    }
    // tank
    {
      const v = sampleKeys(tankKeys, t);
      tankYaw.position.set(v[0], v[1], v[2]);
      tankYaw.rotation.y = v[4];
      tankPitch.rotation.z = v[3];
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
