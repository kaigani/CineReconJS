// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video2.
// Single continuous shot: rooftop/terrace parapet above a Paris boulevard.
// Camera starts between two men at the railing looking down the street, dollies
// backward to reveal them, then performs a dolly-out + zoom-in ("vertigo") move
// while a third man walks past in front of them (L->R, later R->L, re-enters at left).

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const SKY = 0xc0c0c0;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 120, 2200);

  const rev = parseInt(String(THREE.REVISION || '150'), 10);
  const LS = rev >= 155 ? Math.PI : 1;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.0 * LS);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.45 * LS);
  sun.position.set(-6, 10, 12);
  scene.add(sun);
  scene.add(sun.target);

  // ---------- helpers ----------
  let s0 = (Number(seed) >>> 0) || 12345;
  function rnd() {
    s0 = (s0 + 0x6D2B79F5) >>> 0;
    let t = s0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const gray = (v) => {
    v = Math.max(0, Math.min(255, Math.round(v)));
    return (v << 16) | (v << 8) | v;
  };
  const matCache = new Map();
  function mat(hex) {
    if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return matCache.get(hex);
  }
  function box(w, h, d, hex, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }
  function boxMM(x0, x1, y0, y1, z0, z1, hex, parent) {
    return box(x1 - x0, y1 - y0, z1 - z0, hex, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
  }
  function sphere(r, hex, x, y, z, parent, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat(hex));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    (parent || scene).add(m);
    return m;
  }
  function cyl(rt, rb, h, hex, x, y, z, parent, seg = 14) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(hex));
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }
  const D2R = Math.PI / 180;
  const lerp = (a, b, u) => a + (b - a) * u;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Monotone cubic (Fritsch-Carlson) scalar track sampled by absolute time.
  function mono(keys) {
    const n = keys.length;
    const T = keys.map((k) => k[0]);
    const V = keys.map((k) => k[1]);
    if (n === 1) return () => V[0];
    const d = new Array(n - 1);
    const m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (V[i + 1] - V[i]) / (T[i + 1] - T[i]);
    m[0] = d[0];
    m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * d[i];
        m[i + 1] = tau * b * d[i];
      }
    }
    return (t) => {
      if (t <= T[0]) return V[0];
      if (t >= T[n - 1]) return V[n - 1];
      let i = 0;
      while (i < n - 2 && t > T[i + 1]) i++;
      const h = T[i + 1] - T[i];
      const u = (t - T[i]) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * V[i] + (u3 - 2 * u2 + u) * h * m[i] +
        (-2 * u3 + 3 * u2) * V[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }
  const deriv = (f, t) => (f(t + 0.04) - f(t - 0.04)) / 0.08;

  // ---------- world layout ----------
  // Terrace floor y=0, parapet front face at z=0, street 12 m below, street runs toward -z.
  const STREET = -12;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 2600), mat(0x5e5e5e));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, STREET, -1300);
  scene.add(ground);

  // terrace floor
  boxMM(-16, 16, -0.3, 0, -0.25, 30, 0xa4a4a4);

  // parapet: light base, dark wall band, coping, railing with posts
  boxMM(-16, 16, 0, 0.40, -0.25, 0, 0xa8a8a8);
  boxMM(-16, 16, 0.40, 0.68, -0.25, 0, 0x272727);
  boxMM(-16, 16, 0.68, 0.71, -0.27, 0.02, 0x333333);
  boxMM(-16, 16, 0.93, 0.97, -0.14, -0.08, 0x1a1a1a);
  for (let k = -12; k <= 13; k++) {
    const x = -0.26 + 1.18 * k;
    boxMM(x - 0.025, x + 0.025, 0.71, 0.93, -0.135, -0.085, 0x1a1a1a);
  }

  // buildings
  function building(x0, x1, z0, z1, h, facade, roofHex) {
    const top = STREET + h;
    boxMM(x0, x1, STREET, top - 3.5, z0, z1, facade);
    boxMM(x0 + 0.6, x1 - 0.6, top - 3.5, top, z0 + 0.6, z1 - 0.6, roofHex);
  }
  // near-left corner block (bank facade facing the camera) + rooftop billboard
  building(-90, -17.7, -100, -67, 23.6, 0x7a7a7a, 0x4a4a4a);
  boxMM(-31, -19.5, 11.6, 16.5, -68.4, -68.0, 0xaaaaaa);
  boxMM(-31.3, -19.2, 11.4, 11.7, -68.5, -67.9, 0x555555);
  // left side of boulevard
  {
    let z = -100;
    let i = 0;
    while (z > -960) {
      const d = 24 + rnd() * 22;
      const h = i === 0 ? 30 : i === 1 ? 27 : 20 + rnd() * 6;
      const xf = -17.7 - (i < 2 ? 0 : rnd() * 1.2);
      building(xf - 30, xf, z - d, z, h, gray(100 + rnd() * 25), gray(68 + rnd() * 14));
      z -= d;
      i++;
    }
  }
  // right side: France Telecom corner block with roof sign, white building, then row
  building(15.6, 80, -110, -78, 25.9, 0x6e6e6e, 0x464646);
  boxMM(21, 43, 16.3, 18.6, -78.6, -78.2, 0xdedede);
  boxMM(21, 43, 14.0, 14.3, -78.6, -78.2, 0x555555);
  building(9.4, 15.6, -130, -88, 23, 0xa8a8a8, 0x606060);
  {
    let z = -130;
    let i = 0;
    while (z > -960) {
      const d = 24 + rnd() * 22;
      const h = 20 + rnd() * 6;
      const xf = 9.4 + rnd() * 1.0;
      building(xf, xf + 30, z - d, z, h, gray(100 + rnd() * 25), gray(68 + rnd() * 14));
      z -= d;
      i++;
    }
  }
  // church at the end of the boulevard with spire on the street axis
  boxMM(-12, 12, STREET, STREET + 26, -870, -830, 0x707070);
  boxMM(-5.4, 1.6, STREET, STREET + 30, -836, -822, 0x6c6c6c);
  {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(5, 22, 4), mat(0x585858));
    sp.position.set(-1.9, STREET + 30 + 10.5, -829);
    sp.rotation.y = Math.PI / 4;
    scene.add(sp);
  }
  // distant fill behind the church
  boxMM(-70, -6, STREET, STREET + 23, -1150, -880, 0x858585);
  boxMM(4, 70, STREET, STREET + 21, -1150, -880, 0x858585);

  // trees on the square
  function tree(x, z, r, h) {
    cyl(0.25, 0.35, h - r, 0x3c3c3c, x, STREET + (h - r) / 2, z);
    sphere(r, 0x535353, x, STREET + h - r * 0.85, z, null, 1.3, 0.85, 1.3);
  }
  tree(-15, -61, 3, 14);
  tree(-9, -60, 3, 13.5);
  tree(15, -66, 3.2, 14);
  tree(22, -64, 3.2, 14.5);
  tree(29, -66, 3.2, 14);

  // tall street lamps on the square
  function lamp(x, z) {
    cyl(0.15, 0.2, 13.4, 0x2a2a2a, x, STREET + 6.7, z);
    cyl(0.75, 0.75, 0.25, 0x9a9a9a, x, 1.55, z, null, 20);
  }
  lamp(-4.16, -38);
  lamp(9.2, -38);

  // traffic (static proxies)
  function car(x, z, hex, along) {
    const g = new THREE.Group();
    box(4.2, 0.8, 1.75, hex, 0, 0.6, 0, g);
    box(2.3, 0.6, 1.6, gray(70), -0.2, 1.25, 0, g);
    g.position.set(x, STREET, z);
    if (along) g.rotation.y = Math.PI / 2;
    scene.add(g);
  }
  function bus(x, z, len, hex) {
    box(len, 2.0, 2.6, hex, x, STREET + 1.2, z);
    box(len + 0.05, 0.85, 2.65, 0x4a4a4a, x, STREET + 2.0, z);
    box(len, 0.25, 2.6, hex, x, STREET + 2.75, z);
  }
  bus(-12.8, -51, 17.6, 0xd6d6d6);
  bus(10, -57, 12, 0xd6d6d6);
  car(3.1, -39, 0x3a3a3a);
  car(-2.8, -44, 0xcfcfcf);
  car(-6.2, -46.5, 0xc8c8c8);
  car(-14.9, -41, 0xbdbdbd);
  car(-24.8, -54, 0xc6c6c6);
  car(19, -39, 0x404040);
  car(-5.4, -61, 0xd2d2d2);
  car(-1.5, -62, 0xd0d0d0);
  car(5.2, -61.5, 0xd4d4d4);
  car(13.5, -48, 0x9a9a9a);
  for (let i = 0; i < 34; i++) {
    const z = -110 - rnd() * 620;
    const lane = [-13, -9, -5, -1, 3, 6][Math.floor(rnd() * 6)];
    car(lane, z, rnd() < 0.5 ? gray(55 + rnd() * 30) : gray(170 + rnd() * 40), true);
  }

  // ---------- articulated people ----------
  function makePerson(o) {
    const root = new THREE.Group();
    scene.add(root);
    const hips = new THREE.Group();
    root.add(hips);
    box(o.torsoW * 0.92, 0.2, o.torsoD * 0.9, o.pants, 0, -0.03, 0, hips);
    const torso = new THREE.Group();
    hips.add(torso);
    box(o.torsoW, o.torsoLen, o.torsoD, o.jacket, 0, o.torsoLen / 2, 0, torso);
    if (o.coatSkirt) box(o.torsoW * 1.02, 0.32, o.torsoD * 1.02, o.jacket, 0, -0.12, 0, torso);
    if (o.hem) box(o.torsoW * 1.07, 0.08, o.torsoD * 1.07, o.hem, 0, -0.27, 0, torso);
    if (o.front) box(o.torsoW * 0.3,o.torsoLen * 0.85, 0.02, o.front, 0, o.torsoLen * 0.5, o.torsoD / 2 + 0.006, torso);
    if (o.collar) box(o.torsoW * 0.8, 0.13, o.torsoD * 1.1, o.collar, 0, o.torsoLen - 0.01, 0, torso);
    const neck = new THREE.Group();
    neck.position.set(0, o.torsoLen, 0);
    torso.add(neck);
    cyl(0.055, 0.06, 0.1, o.skin, 0, 0.04, 0, neck);
    const head = new THREE.Group();
    head.rotation.order = 'YXZ';
    head.position.set(0, 0.06, 0);
    neck.add(head);
    const hr = o.headR;
    sphere(hr, o.skin, 0, hr * 1.1, 0.01, head, 0.9, 1.12, 1.0);
    if (o.hair) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.04, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(o.hair));
      cap.position.set(0, hr * 1.2, -0.005);
      cap.scale.set(0.92, 1.1, 1.02);
      cap.rotation.x = -0.4;
      head.add(cap);
    }
    if (o.beanie) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(hr * 1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(o.beanie));
      cap.position.set(0, hr * 1.25, -0.005);
      cap.scale.set(0.95, o.beanieTall || 1.1, 1.03);
      cap.rotation.x = -0.25;
      head.add(cap);
      if (o.bobble) sphere(0.045, o.beanie, 0, hr * 1.25 + hr * 1.1 * (o.beanieTall || 1.1) + 0.02, -0.02, head);
    }
    function arm(s) {
      const sh = new THREE.Group();
      sh.position.set(s * (o.torsoW / 2 + 0.055), o.torsoLen - 0.07, 0);
      torso.add(sh);
      box(0.12, 0.31, 0.125, o.jacket, 0, -0.155, 0, sh);
      const el = new THREE.Group();
      el.position.set(0, -0.31, 0);
      sh.add(el);
      box(0.11, 0.27, 0.115, o.jacket, 0, -0.135, 0, el);
      sphere(0.05, o.hand || o.skin, 0, -0.3, 0, el, 0.9, 1.2, 0.8);
      return { sh, el };
    }
    function leg(s) {
      const hp = new THREE.Group();
      hp.position.set(s * o.torsoW * 0.23, 0, 0);
      hips.add(hp);
      box(0.16, o.thigh, 0.17, o.pants, 0, -o.thigh / 2, 0, hp);
      const kn = new THREE.Group();
      kn.position.set(0, -o.thigh, 0);
      hp.add(kn);
      box(0.145, o.shin, 0.15, o.pants, 0, -o.shin / 2, 0, kn);
      box(0.11, 0.08, 0.27, o.shoe, 0, -o.shin, 0.06, kn);
      return { hp, kn };
    }
    return { root, hips, torso, head, armR: arm(-1), armL: arm(1), legR: leg(-1), legL: leg(1) };
  }
  // R = person's right side (local -x, image-left when facing camera)
  function applyPose(P, q) {
    P.root.visible = q.visible !== false;
    P.root.position.set(q.x, 0, q.z);
    P.root.rotation.set(0, q.yaw, 0);
    P.hips.position.set(0, q.hipH, q.hipZ || 0);
    P.torso.rotation.set(q.tp || 0, q.ty || 0, q.tr || 0);
    P.head.rotation.set(q.hp || 0, q.hy || 0, 0);
    // shoulder: [flex(+back/-forward), abduction(outward), elbow flex(-forward), elbow inward swing]
    P.armR.sh.rotation.set(q.aR[0], 0, -q.aR[1]);
    P.armR.el.rotation.set(q.aR[2], 0, q.aR[3] || 0);
    P.armL.sh.rotation.set(q.aL[0], 0, q.aL[1]);
    P.armL.el.rotation.set(q.aL[2], 0, -(q.aL[3] || 0));
    P.legR.hp.rotation.set(q.lR[0], 0, 0);
    P.legR.kn.rotation.set(q.lR[1], 0, 0);
    P.legL.hp.rotation.set(q.lL[0], 0, 0);
    P.legL.kn.rotation.set(q.lL[1], 0, 0);
  }

  // Vinz: image-left man, short dark hair, black bomber jacket, dark jeans.
  const vinz = makePerson({
    jacket: 0x1e1e1e, pants: 0x2e2e2e, skin: 0xb0b0b0, hair: 0x2a2a2a, shoe: 0x1a1a1a,
    torsoW: 0.48, torsoD: 0.27, torsoLen: 0.53, headR: 0.105, thigh: 0.46, shin: 0.46,
  });
  // Said: image-right man, black beanie, leather jacket with fur collar, light track top, light trousers.
  const said = makePerson({
    jacket: 0x2a2a2a, pants: 0xcacaca, skin: 0xb0b0b0, beanie: 0x161616, collar: 0x111111,
    front: 0xd6d6d6, shoe: 0x2a2a2a,
    torsoW: 0.5, torsoD: 0.3, torsoLen: 0.5, headR: 0.105, thigh: 0.44, shin: 0.44,
  });
  // Hubert: third man, tall, bobble beanie, sheepskin coat with light fleece trim, camo trousers.
  const hubert = makePerson({
    jacket: 0x5a5a5a, pants: 0x444444, skin: 0x404040, beanie: 0x141414, beanieTall: 1.45, bobble: true,
    collar: 0xc8c8c8, hem: 0xc0c0c0, coatSkirt: true, shoe: 0x222222,
    torsoW: 0.55, torsoD: 0.33, torsoLen: 0.55, headR: 0.11, thigh: 0.47, shin: 0.47,
  });

  // ---------- animation tracks (seconds) ----------
  // Camera: dolly back with constant lens, then dolly-out + zoom-in.
  const CZ = mono([[0, 0.62], [0.751, 1.1], [1.543, 1.6], [2.294, 2.15], [3.045, 2.65], [3.795, 3.35],
    [4.588, 4.12], [5.339, 4.72], [6.089, 5.61], [6.84, 6.68], [7.633, 8.05], [8.383, 9.27], [9.134, 10.34],
    [9.885, 11.4], [10.677, 12.32], [11.428, 13.24], [12.179, 14.15], [12.93, 14.91], [13.722, 15.37],
    [14.473, 15.68], [15.224, 15.83], [15.974, 15.98], [16.767, 16.04], [17.5175, 16.13]]);
  const MAG = mono([[0, 1.0], [1.543, 1.0], [2.294, 1.02], [3.045, 1.05], [3.795, 1.1], [4.588, 1.3],
    [5.339, 1.5], [6.089, 1.8], [6.84, 2.15], [7.633, 2.6], [8.383, 3.0], [9.134, 3.35], [9.885, 3.7],
    [10.677, 4.0], [11.428, 4.3], [12.179, 4.6], [12.93, 4.85], [13.722, 5.0], [14.473, 5.1],
    [15.224, 5.15], [15.974, 5.2], [16.767, 5.22], [17.5175, 5.25]]);
  const CY = mono([[0, 1.54], [2.294, 1.54], [4.588, 1.5], [17.5175, 1.46]]);
  const PIT = mono([[0, -3.68], [2.294, -3.6], [3.795, -3.0], [4.588, -2.4], [6.089, -2.2], [7.633, -2.2],
    [9.134, -1.8], [10.677, -1.25], [12.179, -1.1], [17.5175, -1.12]]);
  const TAN0 = Math.tan(17 * D2R); // base vertical half-FOV 17 deg

  // Vinz
  const VX = mono([[0, -0.55], [2.294, -0.55], [3.795, -0.53], [4.588, -0.52], [5.339, -0.5], [6.84, -0.53], [7.633, -0.56], [8.383, -0.64],
    [9.134, -0.64], [9.885, -0.65], [10.677, -0.58], [11.428, -0.57], [12.179, -0.69], [12.93, -0.79],
    [13.722, -0.6], [14.473, -0.53], [15.224, -0.78], [15.974, -0.575], [16.767, -0.54], [17.5175, -0.575]]);
  const VZ = mono([[0, 0.4], [6.84, 0.42], [8.383, 0.9], [12.179, 1.0], [14.473, 1.3], [17.5175, 1.25]]);
  const VYAW = mono([[0, 120], [1.543, 115], [2.294, 100], [3.795, 55], [4.588, 35], [6.84, 30], [7.633, 15],
    [8.383, 5], [10.677, 10], [12.179, -10], [12.93, -15], [13.722, 0], [14.473, 5], [15.224, -5],
    [15.974, 5], [17.5175, 0]]);
  const VHY = mono([[0, -25], [2.294, -10], [3.795, 30], [4.588, 45], [6.84, 45], [7.633, 40], [8.383, 0],
    [9.885, 0], [10.677, 25], [11.428, 10], [12.179, 0], [12.93, 25], [13.722, 10], [14.473, 0], [17.5175, 0]]);
  const VHP = mono([[0, 0.1], [6.089, 0.25], [7.633, 0.2], [8.383, 0.0], [9.134, 0.05], [9.885, 0.25],
    [10.677, 0.1], [12.179, 0.45], [12.93, 0.25], [13.722, 0.35], [14.473, 0.0], [17.5175, -0.05]]);
  const VTP = mono([[0, 0.05], [11.428, 0.03], [12.179, 0.18], [12.93, 0.1], [13.722, 0.12], [14.473, 0.0],
    [17.5175, 0.0]]);

  // Said
  const SX = mono([[0, 0.68], [0.751, 0.68], [1.543, 0.61], [2.294, 0.6], [3.045, 0.55], [3.795, 0.46], [4.588, 0.44], [17.5175, 0.44]]);
  const SZ = mono([[0, 0.3], [3.045, 0.3], [4.588, 0.42], [17.5175, 0.42]]);
  const SYAW = mono([[0, -130], [2.294, -120], [3.045, -75], [3.795, -40], [4.588, -15], [17.5175, -12]]);
  const SHY = mono([[0, 40], [2.294, 30], [3.045, -15], [3.795, -40], [4.588, -45], [5.339, -30], [6.089, -5],
    [7.633, 5], [8.383, 15], [9.134, 12], [9.885, -25], [10.677, -30], [11.428, -38], [12.179, -28],
    [12.93, -33], [13.722, 2], [14.473, 12], [16.767, 12], [17.5175, 22]]);
  const SHP = mono([[0, 0.05], [10.677, 0.1], [12.179, 0.2], [12.93, 0.15], [13.722, 0.0], [16.767, 0.0],
    [17.5175, -0.3]]);
  const SB = mono([[0, 0], [3.045, 0.1], [4.2, 1], [17.5175, 1]]); // 0 = facing rail, 1 = leaning back on it

  // Hubert passes
  const H2X = mono([[8.0, 2.3], [9.134, 1.2], [9.885, 0.55], [10.677, -0.36], [11.428, -1.25], [12.9, -2.75]]);
  const H2Z = mono([[8.0, 1.8], [12.9, 1.6]]);
  const H2Y = mono([[8.0, -80], [9.885, -90], [10.677, -115], [11.428, -125], [12.9, -125]]);
  const H3X = mono([[15.6, -3.0], [16.767, -1.9], [17.5175, -1.3]]);

  function walkLegs(phase, amp) {
    const r = [-amp * Math.sin(phase), 0.08 + 1.3 * amp * Math.max(0, Math.cos(phase))];
    const l = [amp * Math.sin(phase), 0.08 + 1.3 * amp * Math.max(0, -Math.cos(phase))];
    return [r, l];
  }

  // ---------- camera + letterbox ----------
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 3000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false });
  const barGeo = new THREE.PlaneGeometry(1, 1);
  const barTop = new THREE.Mesh(barGeo, barMat);
  const barBot = new THREE.Mesh(barGeo, barMat);
  barTop.renderOrder = 999;
  barBot.renderOrder = 999;
  barTop.frustumCulled = false;
  barBot.frustumCulled = false;
  camera.add(barTop);
  camera.add(barBot);
  const BAR_FRAC = 16 / 720;

  function update(time, frame) {
    const t = clamp(Number(time) || 0, 0, duration);

    // gradual darkening of sky/haze and light level as the long lens closes in
    {
      const u = clamp((t - 3) / 9, 0, 1);
      const e = u * u * (3 - 2 * u);
      const sv = lerp(0xc4, 0x74, e) / 255;
      scene.background.setRGB(sv, sv, sv, THREE.SRGBColorSpace);
      scene.fog.color.setRGB(sv, sv, sv, THREE.SRGBColorSpace);
      const k = lerp(1.0, 0.72, e);
      hemi.intensity = 0.6 * LS * k;
      sun.intensity = 0.3 * LS * k;
    }

    // camera
    const m = MAG(t);
    const fov = 2 * Math.atan(TAN0 / m) / D2R;
    camera.fov = fov;
    camera.aspect = width / height;
    camera.position.set(0, CY(t), CZ(t));
    camera.rotation.set(PIT(t) * D2R, 0, 0);
    camera.updateProjectionMatrix();
    const dd = 0.5;
    const hh = dd * Math.tan((fov / 2) * D2R);
    const hw = hh * camera.aspect;
    const bh = 2 * hh * BAR_FRAC;
    barTop.scale.set(hw * 2.4, bh, 1);
    barBot.scale.set(hw * 2.4, bh, 1);
    barTop.position.set(0, hh - bh / 2, -dd);
    barBot.position.set(0, -hh + bh / 2, -dd);

    // Vinz: stands near the rail, turns from facing Said/street to facing camera, paces late.
    {
      const vx = VX(t);
      const v = deriv(VX, t);
      const amp = Math.min(1, Math.abs(v) / 0.6) * 0.3;
      const [lR, lL] = walkLegs((2 * Math.PI * vx) / 0.65, amp);
      applyPose(vinz, {
        x: vx, z: VZ(t), yaw: VYAW(t) * D2R, hipH: 0.96, tp: VTP(t), hy: VHY(t) * D2R, hp: VHP(t),
        aR: [0.25, 0.3, -0.75, 0.7], aL: [0.25, 0.3, -0.75, 0.7], lR, lL,
      });
    }

    // Said: first faces the rail beside Vinz, then turns and leans back on it, right elbow on the rail.
    {
      const b = clamp(SB(t), 0, 1);
      const L3 = (a, c) => [lerp(a[0], c[0], b), lerp(a[1], c[1], b), lerp(a[2], c[2], b), lerp(a[3], c[3], b)];
      applyPose(said, {
        x: SX(t), z: SZ(t), yaw: SYAW(t) * D2R,
        hipH: lerp(0.84, 0.86, b), hipZ: lerp(0, -0.25, b),
        tp: lerp(0.3, -0.12, b), tr: lerp(0, 0.14, b),
        hy: SHY(t) * D2R, hp: SHP(t),
        aR: L3([-0.75, 0.1, -0.5, 0], [0.45, 0.62, -1.0, 0.55]),
        aL: L3([-0.35, 0.12, -0.7, 0], [0.2, 0.3, -0.55, 0.2]),
        lR: [lerp(-0.35, -0.3, b), lerp(0.7, 0.05, b)],
        lL: [lerp(-0.35, -0.7, b), lerp(0.7, 1.45, b)],
      });
    }

    // Hubert: walks across in front (L->R), later back (R->L), then re-enters from the left.
    {
      let vis = false;
      let x = -5, z = 1.5, yaw = 0, s = 0, v = 0;
      if (t >= 1.2 && t <= 5.8) {
        vis = true; x = -0.25 + 1.25 * (t - 3.045); z = 1.1; yaw = 100 * D2R; s = x + 3; v = 1.25;
      } else if (t >= 8.0 && t <= 12.9) {
        vis = true; x = H2X(t); z = H2Z(t); yaw = H2Y(t) * D2R; s = 2.3 - x; v = Math.abs(deriv(H2X, t));
      } else if (t >= 15.6) {
        vis = true; x = H3X(t); z = 1.6; yaw = 105 * D2R; s = x + 3; v = Math.abs(deriv(H3X, t));
      }
      const ph = (2 * Math.PI * s) / 1.35;
      const amp = 0.38 * Math.min(1, v / 0.9);
      const [lR, lL] = walkLegs(ph, amp);
      applyPose(hubert, {
        visible: vis, x, z, yaw, hipH: 0.975 + 0.015 * Math.cos(2 * ph), tp: 0.06, hy: 0, hp: 0.15,
        aR: [-0.15 + 0.05 * Math.sin(ph), -0.25, -2.0, 0], aL: [-0.15 - 0.05 * Math.sin(ph), -0.25, -2.0, 0],
        lR, lL,
      });
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
