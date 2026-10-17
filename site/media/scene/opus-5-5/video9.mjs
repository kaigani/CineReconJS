// CineRecon L1 proxy reconstruction (Three.js sampled-frame baseline) - video9
// Hotel-lobby walk-and-talk: concierge (purple tailcoat) + lobby boy, five shots.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const W = width || 1280, H = height || 720;
  const aspect = W / H;
  const DUR = duration || 23.982291666666665;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');

  // ---------- deterministic rng ----------
  let rs = ((seed === undefined ? 1 : seed) >>> 0) || 1;
  function rng() {
    rs = (rs + 0x6D2B79F5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- materials / primitives ----------
  const cache = new Map();
  function lam(c) {
    const k = 'l' + c;
    if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color: new THREE.Color(c) }));
    return cache.get(k);
  }
  function emi(c) {
    const k = 'b' + c;
    if (!cache.has(k)) cache.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(c) }));
    return cache.get(k);
  }
  const M = (c) => (typeof c === 'string' ? lam(c) : c);
  function box(w, h, d, c, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
    m.position.set(x, y, z);
    if (parent) parent.add(m);
    return m;
  }
  function cyl(rt, rb, h, c, parent, x = 0, y = 0, z = 0, seg = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c));
    m.position.set(x, y, z);
    if (parent) parent.add(m);
    return m;
  }
  function sph(r, c, parent, x = 0, y = 0, z = 0, seg = 14) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), M(c));
    m.position.set(x, y, z);
    if (parent) parent.add(m);
    return m;
  }

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight('#ffe6dc', 0.5));
  scene.add(new THREE.HemisphereLight('#ffe8e0', '#b06058', 1.7));
  const key = new THREE.DirectionalLight('#fff0e4', 1.4);
  key.position.set(-3, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffe0d8', 0.7);
  fill.position.set(5, 5, -6);
  scene.add(fill);

  // ---------- camera + pillarbox mask ----------
  const camera = new THREE.PerspectiveCamera(40, aspect, 0.05, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false });
  const maskPlanes = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), maskMat);
    m.renderOrder = 10000;
    m.frustumCulled = false;
    camera.add(m);
    maskPlanes.push(m);
  }
  // content window of the reference (pillarboxed ~1.37:1 inside 16:9), NDC
  const CL = -0.735, CR = 0.729, CB = -0.956, CT = 0.963;
  function updateMask() {
    const d = 0.1;
    const hh = d * Math.tan((camera.fov * Math.PI) / 360);
    const hw = hh * camera.aspect;
    const rects = [[-1.6, CL, -1.6, 1.6], [CR, 1.6, -1.6, 1.6], [-1.6, 1.6, CT, 1.6], [-1.6, 1.6, -1.6, CB]];
    rects.forEach((r, i) => {
      const m = maskPlanes[i];
      m.position.set(((r[0] + r[1]) / 2) * hw, ((r[2] + r[3]) / 2) * hh, -d);
      m.scale.set((r[1] - r[0]) * hw, (r[3] - r[2]) * hh, 1);
    });
  }

  // ---------- environment: main lobby hall (runs along z) ----------
  const WALL = '#d9a294', ARCHIN = '#f2cbb6', BULB = '#fff3dc';
  // floor
  box(17, 0.02, 72, '#a01c24', scene, -0.75, -0.01, 1);
  box(2.6, 0.012, 72, '#c25a5e', scene, 0, 0.004, 1); // runner
  box(0.16, 0.014, 72, '#6a0f15', scene, -1.22, 0.006, 1);
  box(0.16, 0.014, 72, '#6a0f15', scene, 1.22, 0.006, 1);
  box(6.4, 0.012, 72, '#cfa596', scene, -5.9, 0.004, 1); // marble side floor
  // walls / ceiling
  box(0.3, 6.6, 72, WALL, scene, 7.65, 3.3, 1);
  box(0.3, 6.6, 72, WALL, scene, -9.15, 3.3, 1);
  box(17, 6.6, 0.3, WALL, scene, -0.75, 3.3, -33.1);
  box(17, 6.6, 0.3, WALL, scene, -0.75, 3.3, 35.1);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(17, 72), emi('#cf9e8e'));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-0.75, 6.55, 1);
  scene.add(ceil);
  box(17, 0.35, 0.4, '#efd2c2', scene, -0.75, 6.2, -32.8);

  function addArch(x, z, rotY, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    scene.add(g);
    box(2.2, 2.8, 0.03, ARCHIN, g, 0, 1.4, 0.0);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24, 0, Math.PI), lam(ARCHIN));
    disc.position.set(0, 2.8, 0.02);
    g.add(disc);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(1.17, 0.05, 6, 30, Math.PI), emi(BULB));
    tor.position.set(0, 2.8, 0.06);
    g.add(tor);
    box(0.08, 1.1, 0.05, emi(BULB), g, -1.17, 2.25, 0.06);
    box(0.08, 1.1, 0.05, emi(BULB), g, 1.17, 2.25, 0.06);
    sph(0.15, emi(BULB), g, 0, 3.2, 0.35, 12);
    return g;
  }
  for (let z = -30; z <= 33; z += 3.4) addArch(7.48, z, -Math.PI / 2);
  for (let z = -29; z <= 33; z += 4.2) addArch(-8.98, z, Math.PI / 2);
  for (const x of [-5.5, -1.8, 1.9, 5.4]) addArch(x, -32.93, 0);
  for (const x of [-5.5, -1.8, 1.9, 5.4]) addArch(x, 34.93, Math.PI);

  // square marble pillars + palms along left of runner
  function addPalm(x, z, sc = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(sc);
    scene.add(g);
    cyl(0.36, 0.28, 0.6, '#a87a3c', g, 0, 0.3, 0);
    cyl(0.33, 0.33, 0.04, '#3a2a1a', g, 0, 0.6, 0);
    cyl(0.04, 0.06, 1.2, '#5b4a2c', g, 0, 1.2, 0);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng() * 0.5;
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.75, 0);
      pivot.rotation.set(0, a, 0);
      g.add(pivot);
      const tilt = new THREE.Group();
      tilt.rotation.x = 0.7 + rng() * 0.6;
      pivot.add(tilt);
      const fr = new THREE.Mesh(new THREE.ConeGeometry(0.17, 1.5, 4), lam('#40592a'));
      fr.scale.set(1, 1, 0.25);
      fr.position.set(0, 0.7, 0);
      tilt.add(fr);
    }
    return g;
  }
  for (let z = -27; z <= 30; z += 7) {
    box(0.7, 6.6, 0.7, '#9a6648', scene, -2.5, 3.3, z);
    addPalm(-1.85, z + 0.75, 1.0);
  }
  // B-region marble pillar + palm on the right of the walk path
  box(0.9, 6.6, 0.9, '#b48464', scene, 1.95, 3.3, -5.6);
  addPalm(1.45, -7.75, 1.05);
  addPalm(2.3, -3.6, 0.95);

  // chandeliers
  for (let z = -29; z <= 32; z += 6.2) {
    const g = new THREE.Group();
    g.position.set(1.0, 0, z);
    scene.add(g);
    cyl(0.012, 0.012, 1.8, '#5a4030', g, 0, 5.65, 0, 6);
    cyl(0.32, 0.32, 0.02, '#8a6a40', g, 0, 4.75, 0, 16);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      sph(0.1, emi(BULB), g, Math.cos(a) * 0.34, 4.6, Math.sin(a) * 0.34, 10);
      sph(0.085, emi(BULB), g, Math.cos(a + 0.5) * 0.2, 4.25, Math.sin(a + 0.5) * 0.2, 10);
    }
    sph(0.12, emi(BULB), g, 0, 3.95, 0, 10);
  }
  // reception desk at far end
  box(2.6, 1.0, 1.0, '#dcbca0', scene, 3.4, 0.5, -25.0);

  // ---------- people ----------
  const persons = [];
  function makePerson(o) {
    const s = o.h / 1.85;
    const root = new THREE.Group();
    scene.add(root);
    const body = new THREE.Group();
    root.add(body);
    const hips = new THREE.Group();
    hips.position.y = 0.88 * s;
    body.add(hips);
    box(0.34 * s, 0.16 * s, 0.22 * s, o.leg, hips, 0, -0.03 * s, 0);
    const legs = {};
    for (const [nm, side] of [['R', -1], ['L', 1]]) {
      const thigh = new THREE.Group();
      thigh.position.set(side * 0.095 * s, -0.02 * s, 0);
      hips.add(thigh);
      box(0.15 * s, 0.44 * s, 0.16 * s, o.leg, thigh, 0, -0.22 * s, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.44 * s;
      thigh.add(knee);
      box(0.12 * s, 0.42 * s, 0.13 * s, o.leg, knee, 0, -0.21 * s, 0);
      box(0.11 * s, 0.07 * s, 0.26 * s, o.shoe || '#151012', knee, 0, -0.395 * s, 0.05 * s);
      legs[nm] = { thigh, knee };
    }
    if (o.longCoat) cyl(0.22 * s, 0.27 * s, o.longCoat * s, o.coat, hips, 0, -(o.longCoat / 2) * s + 0.02 * s, 0);
    if (o.skirt) cyl(0.2 * s, 0.3 * s, 0.84 * s, o.skirt, hips, 0, -0.42 * s + 0.02 * s, 0);
    if (o.coatSkirt) cyl(0.22 * s, 0.29 * s, 0.5 * s, o.coat, hips, 0, -0.2 * s, 0);
    if (o.tunic) box(0.38 * s, 0.32 * s, 0.25 * s, o.coat, hips, 0, -0.1 * s, 0);
    if (o.apron) cyl(0.21 * s, 0.26 * s, 0.62 * s, o.coat, hips, 0, -0.3 * s, 0);
    if (o.tails) box(0.36 * s, 0.52 * s, 0.05 * s, o.coat, hips, 0, -0.25 * s, -0.115 * s);

    const torso = new THREE.Group();
    hips.add(torso);
    box(0.36 * s, 0.62 * s, 0.23 * s, o.coat, torso, 0, 0.31 * s, 0);
    if (o.shirtFront) {
      box(0.15 * s, 0.26 * s, 0.02 * s, '#f1ebe6', torso, 0, 0.46 * s, 0.123 * s);
      box(0.17 * s, 0.2 * s, 0.02 * s, '#9a96a0', torso, 0, 0.22 * s, 0.123 * s);
      box(0.11 * s, 0.04 * s, 0.03 * s, '#141012', torso, 0, 0.58 * s, 0.135 * s);
    }
    const neck = new THREE.Group();
    neck.position.y = 0.62 * s;
    torso.add(neck);
    cyl(0.055 * s, 0.06 * s, 0.07 * s, o.collar || o.skin, neck, 0, 0.02 * s, 0, 10);
    const head = new THREE.Group();
    head.position.y = 0.015 * s;
    head.rotation.order = 'YXZ';
    neck.add(head);
    const hm = sph(0.115 * s, o.skin, head, 0, 0.115 * s, 0.01 * s, 16);
    hm.scale.set(0.74, 1.0, 0.86);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.121 * s, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), lam(o.hair || '#2a1c14'));
    hair.position.set(0, 0.125 * s, -0.005 * s);
    hair.rotation.x = -0.8;
    hair.scale.set(0.78, 1.0, 0.92);
    head.add(hair);
    const hatG = new THREE.Group();
    hatG.position.set(0, 0.2 * s, 0);
    head.add(hatG);
    if (o.hat === 'pillbox') {
      const hb = cyl(0.088 * s, 0.09 * s, 0.12 * s, o.hatColor || '#4c2052', hatG, 0, 0.03 * s, 0, 18);
      hatG.rotation.set(-0.12, 0, 0.12);
      cyl(0.091 * s, 0.091 * s, 0.025 * s, '#8d7438', hatG, 0, 0.06 * s, 0, 18);
      hb.userData.k = 1;
    } else if (o.hat === 'tophat') {
      cyl(0.1 * s, 0.1 * s, 0.2 * s, '#141014', hatG, 0, 0.08 * s, 0, 16);
      cyl(0.16 * s, 0.16 * s, 0.012 * s, '#141014', hatG, 0, -0.02 * s, 0, 16);
    } else if (o.hat === 'bowler') {
      const b = sph(0.12 * s, '#141014', hatG, 0, 0.0, 0, 14);
      b.scale.set(1, 0.7, 1.05);
    } else if (o.hat === 'toque') {
      cyl(0.11 * s, 0.095 * s, 0.22 * s, '#f4f0ea', hatG, 0, 0.07 * s, 0, 16);
    } else if (o.hat === 'fur') {
      cyl(0.13 * s, 0.12 * s, 0.12 * s, '#1c1416', hatG, 0, 0.02 * s, 0, 16);
    }
    const arms = {};
    for (const [nm, side] of [['R', -1], ['L', 1]]) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.22 * s, 0.56 * s, 0);
      torso.add(sh);
      box(0.1 * s, 0.31 * s, 0.11 * s, o.coat, sh, 0, -0.14 * s, 0);
      const el = new THREE.Group();
      el.position.y = -0.29 * s;
      sh.add(el);
      box(0.095 * s, 0.27 * s, 0.1 * s, o.coat, el, 0, -0.13 * s, 0);
      const hand = new THREE.Group();
      hand.position.y = -0.29 * s;
      el.add(hand);
      sph(0.047 * s, o.handColor || o.skin, hand, 0, 0, 0, 10);
      arms[nm] = { sh, el, hand };
    }
    const headC = new THREE.Object3D();
    headC.position.set(0, 0.115 * s, 0);
    head.add(headC);
    const P = { headC, s, o, root, body, hips, hipY: 0.88 * s, legs, torso, neck, head, hatG, arms, headY: 1.63 * s };
    persons.push(P);
    return P;
  }

  const DEF_R = { x: 0, z: -0.06, e: -0.15 }, DEF_L = { x: 0, z: 0.06, e: -0.15 };
  function setArm(A, a) {
    A.sh.rotation.set(a.x, 0, a.z);
    A.el.rotation.set(a.e, 0, 0);
  }
  function mixArm(a, b, w) {
    if (!b || w <= 0) return a;
    if (w >= 1) return b;
    return { x: a.x + (b.x - a.x) * w, z: a.z + (b.z - a.z) * w, e: a.e + (b.e - a.e) * w };
  }
  function pose(P, st) {
    const ph = st.phase || 0;
    const a = st.amp === undefined ? 0 : st.amp;
    const sn = Math.sin(ph), cs = Math.cos(ph);
    if (st.seated) {
      P.legs.R.thigh.rotation.set(-1.5, 0, 0.05);
      P.legs.L.thigh.rotation.set(-1.5, 0, -0.05);
      P.legs.R.knee.rotation.set(1.45, 0, 0);
      P.legs.L.knee.rotation.set(1.45, 0, 0);
      P.hips.position.y = P.hipY;
    } else {
      P.legs.R.thigh.rotation.set(-0.42 * a * sn, 0, 0);
      P.legs.L.thigh.rotation.set(0.42 * a * sn, 0, 0);
      P.legs.R.knee.rotation.set(0.55 * a * Math.max(0, cs), 0, 0);
      P.legs.L.knee.rotation.set(0.55 * a * Math.max(0, -cs), 0, 0);
      P.hips.position.y = P.hipY - 0.012 * a * Math.abs(sn);
    }
    const swR = { x: 0.32 * a * sn, z: -0.06, e: -0.15 - 0.1 * a };
    const swL = { x: -0.32 * a * sn, z: 0.06, e: -0.15 - 0.1 * a };
    setArm(P.arms.R, mixArm(swR, st.armR, st.wR === undefined ? 1 : st.wR));
    setArm(P.arms.L, mixArm(swL, st.armL, st.wL === undefined ? 1 : st.wL));
    P.head.rotation.set(st.pitch || 0, st.yaw || 0, 0);
    P.body.rotation.y = st.bodyYaw || 0;
    P.torso.rotation.x = st.lean || 0;
  }

  // main characters
  const G = makePerson({ h: 1.9, collar: '#f1ebe6', coat: '#4e1e56', leg: '#8f8b94', skin: '#e3ab94', hair: '#8e683c', shirtFront: true, tails: true });
  const Z = makePerson({ h: 1.78, collar: '#47204e', coat: '#47204e', leg: '#3a1a3e', skin: '#b67d5e', hair: '#16100e', hat: 'pillbox', hatColor: '#55225d', tunic: true });
  const BB = makePerson({ h: 1.76, collar: '#3c1a3c', coat: '#3c1a3c', leg: '#3c1a3c', skin: '#d79f86', hair: '#2a1a12', hat: 'pillbox', hatColor: '#3a173b', tunic: true, handColor: '#d8d0c8' });
  const LADY = makePerson({ h: 1.62, coat: '#cdb48e', leg: '#1a1416', skin: '#e2b09c', hair: '#cfc0b0', hat: 'fur', skirt: '#1c1418', coatSkirt: true });
  const CHEF = makePerson({ h: 1.74, coat: '#efe9e2', leg: '#2c2626', skin: '#dca088', hair: '#6a5040', hat: 'toque', apron: true });
  const DARK = makePerson({ h: 1.82, coat: '#2e201d', leg: '#231816', skin: '#d29a82', hair: '#1e1612', longCoat: 0.62 });
  const DM1 = makePerson({ h: 1.8, coat: '#3a1e40', leg: '#3a1e40', skin: '#e0a890', hair: '#2a1c18', hat: 'bowler', longCoat: 0.55 });
  const DM2 = makePerson({ h: 1.82, coat: '#55306e', leg: '#3a2050', skin: '#e8b4a0', hair: '#e6ddd4', hat: 'tophat', longCoat: 0.62 });
  const CLADY = makePerson({ h: 1.66, coat: '#2a2022', leg: '#1a1416', skin: '#e0b0a0', hair: '#3a2a20', hat: 'fur', skirt: '#1a1416' });

  // props
  const notebook = box(0.11, 0.15, 0.016, '#f2ede6', G.arms.L.hand, 0.0, -0.05, 0.03);
  const pen = cyl(0.005, 0.005, 0.12, '#1a1a1a', G.arms.R.hand, 0.0, -0.03, 0.03, 6);
  pen.rotation.x = 0.8;
  const dog = new THREE.Group();
  LADY.torso.add(dog);
  const dogBody = sph(1, '#141012', dog, 0, 0, 0, 14);
  dogBody.scale.set(0.22, 0.12, 0.13);
  sph(0.065, '#141012', dog, -0.22, 0.05, 0.02, 12);
  dog.position.set(-0.12 * LADY.s, 0.3 * LADY.s, 0.24 * LADY.s);
  dog.rotation.y = 0.2;
  box(0.2, 0.16, 0.07, '#121012', LADY.torso, 0.27, 0.02, 0.05); // handbag
  const chefBox = box(0.33, 0.4, 0.04, '#c9a26c', CHEF.torso, 0, 0.26, 0.3);
  const bouquet = new THREE.Group();
  DM2.torso.add(bouquet);
  bouquet.position.set(0.08, 0.36, 0.26);
  for (let i = 0; i < 7; i++) sph(0.055, '#f4efe6', bouquet, (rng() - 0.5) * 0.16, (rng() - 0.3) * 0.14, (rng() - 0.5) * 0.12, 8);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8), lam('#3e5a2c'));
  cone.rotation.x = Math.PI;
  cone.position.y = -0.17;
  bouquet.add(cone);
  // doorman 1 hat: one on head, one in hand (visibility swap)
  const dm1HatHand = sph(0.12 * DM1.s, '#141014', DM1.arms.R.hand, 0, -0.05, 0.05, 14);
  dm1HatHand.scale.set(1, 0.7, 1.05);

  // ---------- furniture + seated / standing extras ----------
  function chair(x, z, yaw, col = '#c4ab8e') {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    box(0.56, 0.12, 0.52, col, g, 0, 0.4, 0);
    box(0.56, 0.62, 0.1, col, g, 0, 0.75, -0.25);
    box(0.06, 0.38, 0.06, '#5a3420', g, -0.24, 0.17, 0.2);
    box(0.06, 0.38, 0.06, '#5a3420', g, 0.24, 0.17, 0.2);
    box(0.06, 0.38, 0.06, '#5a3420', g, -0.24, 0.17, -0.2);
    box(0.06, 0.38, 0.06, '#5a3420', g, 0.24, 0.17, -0.2);
    return g;
  }
  function table(x, z, r = 0.42) {
    cyl(r, r, 0.04, '#6e3c22', scene, x, 0.73, z, 20);
    cyl(0.05, 0.08, 0.72, '#4a2816', scene, x, 0.36, z, 8);
    sph(0.06, '#e8e0d8', scene, x + 0.1, 0.8, z, 8);
  }
  const suitCols = ['#2a2228', '#3a3032', '#4a4448', '#2a2420', '#5a4a42'];
  const hairCols = ['#bcb4ac', '#2a1c14', '#8a7a6a', '#d8d0c8', '#4a3a2a'];
  function seated(x, z, yaw, opt = {}) {
    chair(x, z, yaw, opt.chair);
    const h = 1.74 + rng() * 0.1;
    const P = makePerson({ h, coat: opt.coat || suitCols[Math.floor(rng() * suitCols.length)], leg: opt.leg || '#2a2426', skin: '#ddaa92', hair: hairCols[Math.floor(rng() * hairCols.length)], hat: opt.hat, skirt: opt.skirt });
    P.root.position.set(x, 0.47 - 0.86 * P.s, z);
    P.root.rotation.y = yaw;
    pose(P, { seated: true, armR: { x: -0.7, z: 0.1, e: -0.7 }, armL: { x: -0.7, z: -0.1, e: -0.7 }, lean: -0.08, yaw: (rng() - 0.5) * 0.6 });
    return P;
  }
  function standing(x, z, yaw, opt = {}) {
    const P = makePerson({ h: opt.h || 1.78, coat: opt.coat || '#2a2228', leg: opt.leg || '#2a2426', skin: '#ddaa92', hair: opt.hair || '#3a2a20', hat: opt.hat, longCoat: opt.longCoat, apron: opt.apron, skirt: opt.skirt, tunic: opt.tunic, hatColor: opt.hatColor });
    P.root.position.set(x, 0, z);
    P.root.rotation.y = yaw;
    pose(P, { amp: 0, armR: { x: -0.3, z: 0.15, e: -0.9 }, armL: { x: -0.3, z: -0.15, e: -0.9 } });
    return P;
  }
  const HPI = Math.PI / 2;
  // A region (shot A background)
  seated(1.45, -15.0, -HPI, { chair: '#c8b496' });
  table(2.0, -15.6, 0.3);
  table(3.0, -18.6); seated(3.6, -18.6, -HPI); seated(3.0, -19.3, 0);
  table(4.6, -21.6); seated(5.2, -21.6, -HPI); seated(4.6, -20.9, Math.PI);
  standing(-5.2, -24.5, 0.3, { hat: 'tophat', longCoat: 0.6 });
  standing(2.6, -23.6, 0, { coat: '#3a1a3c', leg: '#3a1a3c', hat: 'pillbox', tunic: true, h: 1.7 });
  standing(4.4, -23.8, -0.3, { coat: '#1e1a1c' });
  standing(5.4, -19.0, -1.2, { coat: '#1e1a1c' });
  // B region (side tracking shot background)
  table(2.8, -9.4); seated(3.4, -9.4, -HPI); seated(2.8, -8.7, Math.PI);
  table(3.6, -11.6); seated(4.2, -11.6, -HPI);
  table(3.3, -4.6); seated(3.9, -4.6, -HPI); seated(2.7, -4.6, HPI);
  table(4.9, -7.0); seated(5.5, -7.0, -HPI); seated(4.9, -6.3, Math.PI, { skirt: '#3a2a30', coat: '#6a4a50' });
  // D/C region
  seated(1.6, 4.4, -HPI, { chair: '#c8b496' });
  table(2.05, 3.7, 0.3); seated(2.6, 3.4, -HPI);
  table(2.7, 0.6); seated(3.3, 0.6, -HPI); seated(2.7, -0.1, 0);
  table(3.6, 6.6); seated(4.2, 6.6, -HPI); seated(3.6, 7.3, Math.PI);
  table(2.1, 8.4, 0.36); seated(2.75, 8.4, -HPI); seated(2.2, 9.1, Math.PI);
  table(3.4, 12.0); seated(4.0, 12.0, -HPI);
  standing(0.9, 18.0, Math.PI, { coat: '#2a2228' });
  standing(-0.7, 21.0, Math.PI, { coat: '#3a3032' });
  standing(1.8, 23.5, Math.PI, { coat: '#3a1a3c', hat: 'pillbox', tunic: true });
  box(2.6, 1.0, 1.0, '#dcbca0', scene, 1.0, 0.5, 26.0);

  // ---------- E salon (separate set at x ~ 40) ----------
  box(12, 0.02, 24, '#9a2228', scene, 40, -0.01, 20);
  box(0.2, 4.2, 26, '#ead0c4', scene, 43.85, 2.1, 20);
  for (let z = 8; z <= 32; z += 1.45) box(0.06, 4.2, 0.12, '#f3e2d2', scene, 43.72, 2.1, z);
  box(0.25, 0.25, 26, '#f3e2d2', scene, 43.7, 3.7, 20);
  box(0.12, 4.2, 26, '#ead0c4', scene, 40, 4.3, 20);
  // mural
  box(0.03, 2.2, 1.8, '#8d929a', scene, 43.68, 2.0, 16.15);
  box(0.035, 1.6, 0.5, '#5a4a40', scene, 43.67, 2.3, 16.5);
  box(0.035, 0.5, 1.6, '#c9c6c2', scene, 43.66, 1.1, 16.15);
  // doors
  function door(z) {
    box(0.08, 2.7, 1.35, '#efdcc0', scene, 43.66, 1.35, z);
    box(0.03, 1.5, 0.45, emi('#f2e6dc'), scene, 43.6, 1.65, z - 0.3);
    box(0.03, 1.5, 0.45, emi('#f2e6dc'), scene, 43.6, 1.65, z + 0.3);
  }
  door(19.9);
  door(23.8);
  // stove column, sofa, table, lamp
  box(0.6, 3.2, 0.6, '#4a3a30', scene, 43.0, 1.6, 14.0);
  box(0.75, 0.45, 1.7, '#a8aeb2', scene, 43.2, 0.23, 22.1);
  box(0.22, 0.55, 1.7, '#a8aeb2', scene, 43.52, 0.7, 22.1);
  table(42.45, 21.8, 0.48);
  cyl(0.02, 0.03, 2.1, '#3a2a1a', scene, 43.25, 1.05, 23.1, 6);
  sph(0.12, emi('#fff3dc'), scene, 43.25, 2.15, 23.1, 10);
  for (const z of [15.1, 17.8, 21.5, 25.1]) sph(0.09, emi('#fff3dc'), scene, 43.62, 2.5, z, 10);
  seated(41.8, 14.5, -HPI, { hat: 'fur', skirt: '#4a3a32', coat: '#6a5a4a' });
  seated(42.4, 17.8, -HPI, { coat: '#1a1618' });
  seated(42.2, 21.0, -HPI, { coat: '#3a3a3a' });
  seated(41.4, 24.6, -HPI, { coat: '#a8423a', skirt: '#a8423a' });

  // ---------- timeline helpers ----------
  function interp(keys, t) {
    const n = keys.length;
    const dim = keys[0].length - 1;
    if (n === 1 || t <= keys[0][0]) return keys[0].slice(1);
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const h = k1[0] - k0[0];
    const u = (t - k0[0]) / h;
    const slope = (j, d) => {
      if (j <= 0 || j >= n - 1) return 0;
      return (keys[j + 1][d] - keys[j - 1][d]) / (keys[j + 1][0] - keys[j - 1][0]);
    };
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const out = [];
    for (let d = 1; d <= dim; d++) {
      out.push(h00 * k0[d] + h10 * h * slope(i, d) + h01 * k1[d] + h11 * h * slope(i + 1, d));
    }
    return out;
  }
  const sstep = (a, b, x) => {
    const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const win = (t, a, b, c, d) => sstep(a, b, t) * (1 - sstep(c, d, t));

  // camera basis
  const cam = { pos: [0, 0, 0], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], tanV: 0.36, tanH: 0.64 };
  function setCamBasis(yaw, pitch, vfov) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    cam.f = [-Math.sin(yaw) * cp, sp, -Math.cos(yaw) * cp];
    cam.r = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const r = cam.r, f = cam.f;
    cam.u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    cam.tanV = Math.tan((vfov * Math.PI) / 360);
    cam.tanH = cam.tanV * aspect;
    camera.fov = vfov;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  // place camera so that world point P projects at 960x540-pixel (px,py) at depth D
  function camFromTarget(P, px, py, D) {
    const uf = (px - 480) / 480, vf = (270 - py) / 270;
    const a = uf * cam.tanH * D, b = vf * cam.tanV * D;
    cam.pos = [0, 1, 2].map((k) => P[k] - D * cam.f[k] - a * cam.r[k] - b * cam.u[k]);
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  }
  function groundFromScreen(px, D) {
    const uf = (px - 480) / 480;
    const a = uf * cam.tanH * D;
    return [cam.pos[0] + D * cam.f[0] + a * cam.r[0], cam.pos[2] + D * cam.f[2] + a * cam.r[2]];
  }

  const _hv = new THREE.Vector3();
  function gHead() {
    G.root.updateMatrixWorld(true);
    G.headC.getWorldPosition(_hv);
    return [_hv.x, _hv.y, _hv.z];
  }
  // ---------- shot plan ----------
  const T_AB = 3.65, T_BC = 9.9, T_CD = 10.95, T_DE = 17.2;
  const WRITE_L = { x: -0.55, z: -0.28, e: -1.45 };
  const WRITE_R = { x: -0.5, z: 0.32, e: -1.5 };
  const POINT_R = { x: -0.95, z: -0.35, e: -1.95 };
  const CLASP_L = { x: -0.32, z: -0.22, e: -1.05 };
  const CLASP_R = { x: -0.32, z: 0.22, e: -1.05 };

  const K = {
    A_G: [[0, 520, 137], [1.04, 490, 145], [2.09, 490, 150], [3.13, 480, 145]],
    A_Z: [[0, 598, 3.6], [1.04, 596, 3.6], [2.09, 586, 3.55], [3.13, 584, 3.55]],
    A_Gh: [[0, 0.05, 0.12], [1.04, 0.0, 0.15], [2.09, -0.25, 0.0], [3.13, 0.0, 0.4]],
    B_G: [[4.17, 320, 175], [5.21, 295, 160], [6.26, 275, 150], [7.30, 325, 135], [8.34, 355, 132], [9.38, 380, 135]],
    B_Z: [[4.17, 450, 1.8], [5.21, 490, 1.8], [6.26, 500, 1.8], [7.30, 535, 1.8], [8.34, 540, 1.8], [9.38, 535, 1.8]],
    B_Gh: [[4.17, 0, 0.35], [5.21, 0, 0.32], [6.26, 0, 0.2], [7.30, 0, 0.42], [8.34, 0, 0.45], [9.38, 0, 0.42]],
    B_Zh: [[4.17, -0.5, 0.4], [5.21, -0.5, 0.45], [6.26, -0.35, 0.15], [7.30, -1.0, 0.0], [8.34, -0.8, -0.05], [9.38, -0.5, 0.4]],
    D_G: [[11.47, 470, 142], [12.47, 450, 141], [13.51, 450, 137], [14.56, 440, 137], [15.6, 465, 142], [16.64, 470, 150]],
    D_Z: [[11.47, 620, 3.6], [12.47, 610, 3.6], [13.51, 582, 3.6], [14.56, 568, 3.6], [15.6, 566, 3.6], [16.64, 580, 3.6]],
    D_B: [[11.47, -60, 2.2], [12.47, 195, 2.5], [13.51, 325, 2.7], [14.56, 385, 3.8], [15.6, 410, 4.2], [16.64, 400, 4.4]],
    D_L: [[12.47, 1050, 2.2], [13.51, 790, 2.3], [14.56, 690, 2.6], [15.6, 665, 2.75], [16.64, 680, 3.0]],
    D_C: [[13.51, -120, 2.4], [14.56, 205, 2.5], [15.6, 265, 2.45], [16.64, 295, 2.3]],
    D_Gh: [[11.47, 0.15, 0.15], [12.47, -0.4, 0.05], [13.51, 0.3, 0.05], [14.56, 0.45, 0.1], [15.6, 0.5, 0.12], [16.64, -0.4, 0.35]],
    E_G: [[17.68, 425, 175], [18.73, 350, 188], [19.77, 325, 155], [20.81, 290, 125], [21.86, 290, 132], [22.90, 302, 148], [23.94, 395, 168]],
    E_Z: [[17.68, 545, 1.85], [18.73, 490, 1.85], [19.77, 470, 1.85], [20.81, 480, 1.85], [21.86, 480, 1.85], [22.90, 520, 1.85], [23.94, 565, 1.85]],
    E_Gh: [[17.68, 0, 0.45], [18.73, 0, 0.4], [19.77, 0.05, 0.35], [20.81, 0.35, 0.1], [21.86, 0.45, 0.05], [22.90, 0.4, 0.05], [23.94, 0.1, 0.35]],
    E_Zh: [[17.68, -0.5, 0.3], [18.73, -0.9, 0], [19.77, -0.5, 0.4], [20.81, -0.4, 0.45], [21.86, -0.9, 0], [22.90, -0.85, 0], [23.94, -0.8, 0.05]],
  };

  const shotVis = [G, Z, BB, LADY, CHEF, DARK, CLADY];

  function update(time, frame) {
    let t = typeof time === 'number' ? time : (frame || 0) / (fps || 23.976);
    t = Math.min(Math.max(t, 0), DUR);
    const shot = t < T_AB ? 'A' : t < T_BC ? 'B' : t < T_CD ? 'C' : t < T_DE ? 'D' : 'E';
    for (const P of shotVis) P.root.visible = false;

    const gPh = 2 * Math.PI * 0.72 * t;
    const zPh = 2 * Math.PI * 0.76 * t + 1.1;
    const writeR = { x: WRITE_R.x, z: WRITE_R.z, e: WRITE_R.e + 0.07 * Math.sin(2 * Math.PI * 2.6 * t) };

    // doorman 1 raises hat in shot A window
    const wHat = win(t, 0.55, 0.95, 2.45, 2.95);
    pose(DM1, { amp: 0, armR: { x: -2.3, z: -0.25, e: -0.6 }, wR: wHat, armL: { x: -0.2, z: -0.1, e: -0.5 }, yaw: -0.2, bodyYaw: 0 });
    DM1.root.position.set(1.5, 0, -14.0);
    DM1.root.rotation.y = -0.5;
    DM1.hatG.visible = wHat < 0.5;
    dm1HatHand.visible = wHat >= 0.5;
    // doorman 2 (flowers) static
    DM2.root.position.set(-1.35, 0, -12.5);
    DM2.root.rotation.y = 0.45;
    pose(DM2, { amp: 0, armR: { x: -0.55, z: 0.25, e: -1.3 }, armL: { x: -0.5, z: -0.2, e: -1.3 }, yaw: 0.2, pitch: 0.1 });

    if (shot === 'A') {
      setCamBasis(0, -0.04, 40);
      const zG = -14 + 0.9 * t;
      G.root.visible = true; Z.root.visible = true; DARK.root.visible = true;
      G.root.position.set(0, 0, zG); G.root.rotation.y = 0;
      const [gy, gp] = interp(K.A_Gh, t);
      const wPt = win(t, 1.5, 1.85, 2.6, 3.2);
      pose(G, { phase: gPh, amp: 1, armL: WRITE_L, armR: mixArm(writeR, POINT_R, wPt), yaw: gy, pitch: gp });
      const [px, py] = interp(K.A_G, t);
      camFromTarget(gHead(), px, py, 2.3);
      const [zpx, zd] = interp(K.A_Z, t);
      const zp = groundFromScreen(zpx, zd);
      Z.root.position.set(zp[0], 0, zp[1]); Z.root.rotation.y = 0;
      pose(Z, { phase: zPh, amp: 0.9, armL: CLASP_L, armR: CLASP_R, yaw: -0.1, pitch: 0.12 });
      DARK.root.position.set(-0.75 + 0.12 * t, 0, -11.0 - 1.3 * t);
      DARK.root.rotation.y = Math.PI;
      pose(DARK, { phase: 2 * Math.PI * 0.9 * t, amp: 1, yaw: t < 1.7 ? -0.6 : -0.1, armR: { x: -0.6, z: 0.1, e: -0.9 }, wR: 1 });
    } else if (shot === 'B' || shot === 'E') {
      const isB = shot === 'B';
      setCamBasis(-Math.PI / 2 + 0.12, 0.0, 30);
      const zG = isB ? -10 + 0.8 * (t - T_AB) : 16 + 1.0 * (t - T_DE);
      const xG = isB ? 0 : 40;
      G.root.visible = true; Z.root.visible = true;
      G.root.position.set(xG, 0, zG); G.root.rotation.y = 0;
      const [gy, gp] = interp(isB ? K.B_Gh : K.E_Gh, t);
      pose(G, { phase: gPh, amp: 0.8, armL: WRITE_L, armR: writeR, yaw: gy + 0.2, pitch: gp, bodyYaw: -0.4, lean: 0.08 });
      const [px, py] = interp(isB ? K.B_G : K.E_G, t);
      camFromTarget(gHead(), px, py, 1.25);
      const [zpx, zd] = interp(isB ? K.B_Z : K.E_Z, t);
      const zp = groundFromScreen(zpx, zd);
      Z.root.position.set(zp[0], 0, zp[1]); Z.root.rotation.y = 0;
      const [zy, zpch] = interp(isB ? K.B_Zh : K.E_Zh, t);
      pose(Z, { phase: zPh, amp: 0.8, armL: CLASP_L, armR: CLASP_R, yaw: zy + 0.3, pitch: zpch, bodyYaw: -0.6 });
    } else if (shot === 'C') {
      setCamBasis(Math.PI, -0.094, 40);
      cam.pos = [0.3, 1.3, 4.5];
      camera.position.set(0.3, 1.3, 4.5);
      BB.root.visible = true; CHEF.root.visible = true; CLADY.root.visible = true;
      BB.root.position.set(0.08, 0, 8.6 - 1.0 * (t - 10.43));
      BB.root.rotation.y = Math.PI;
      pose(BB, { phase: 2 * Math.PI * 0.8 * t, amp: 1, armR: { x: -0.25, z: -0.15, e: -0.5 }, armL: { x: -0.25, z: 0.15, e: -0.5 } });
      CHEF.root.position.set(-1.06, 0, 14.1);
      CHEF.root.rotation.y = Math.PI - 0.2;
      chefBox.visible = false;
      pose(CHEF, { amp: 0, armR: { x: -0.4, z: 0.2, e: -1.0 }, armL: { x: -0.4, z: -0.2, e: -1.0 } });
      CLADY.root.position.set(1.68, 0, 12.1);
      CLADY.root.rotation.y = Math.PI + 0.6;
      pose(CLADY, { amp: 0, armR: { x: -0.5, z: 0.2, e: -1.2 }, armL: { x: -0.5, z: -0.2, e: -1.2 } });
    } else {
      // shot D: dolly back ahead of the group
      setCamBasis(0, -0.06, 40);
      const zG = 4 + 0.9 * (t - T_CD);
      G.root.visible = true; Z.root.visible = true; BB.root.visible = true; LADY.root.visible = true; CHEF.root.visible = true;
      G.root.position.set(0, 0, zG); G.root.rotation.y = 0;
      const [gy, gp] = interp(K.D_Gh, t);
      pose(G, { phase: gPh, amp: 1, armL: WRITE_L, armR: writeR, yaw: gy, pitch: gp, bodyYaw: t > 16.0 ? -0.15 * sstep(16.0, 16.5, t) : 0 });
      const [px, py] = interp(K.D_G, t);
      camFromTarget(gHead(), px, py, 2.4);
      const place = (P, keys) => {
        const [qpx, qd] = interp(keys, t);
        const q = groundFromScreen(qpx, qd);
        P.root.position.set(q[0], 0, q[1]);
        P.root.rotation.y = 0;
      };
      place(Z, K.D_Z); place(BB, K.D_B); place(LADY, K.D_L); place(CHEF, K.D_C);
      pose(Z, { phase: zPh, amp: 0.9, armL: CLASP_L, armR: CLASP_R, yaw: t < 13 ? -0.2 : -0.05, pitch: 0.1 });
      pose(BB, { phase: 2 * Math.PI * 0.8 * t + 0.5, amp: 1, yaw: t < 13 ? 0.35 : 0.1, armR: { x: -0.3, z: 0.05, e: -0.7 } });
      pose(LADY, { phase: 2 * Math.PI * 0.85 * t + 2.0, amp: 0.7, bodyYaw: -0.45, yaw: -0.35, armR: { x: -0.65, z: 0.35, e: -1.55 }, armL: { x: -0.6, z: -0.45, e: -1.6 } });
      const off = sstep(15.8, 16.5, t);
      chefBox.visible = true;
      chefBox.position.set(0.22 * off, 0.26 + 0.08 * off, 0.3 + 0.12 * off);
      chefBox.rotation.y = 0.5 * off;
      pose(CHEF, { phase: 2 * Math.PI * 0.8 * t + 2.6, amp: 0.8, bodyYaw: 0.15 + 0.7 * off, yaw: 0.15 + 0.2 * off, pitch: 0.2,
        armR: { x: -0.55 - 0.2 * off, z: 0.25, e: -1.15 + 0.2 * off }, armL: { x: -0.55 - 0.2 * off, z: -0.25 + 0.15 * off, e: -1.15 + 0.25 * off } });
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    updateMask();
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
