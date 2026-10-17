// CineRecon Three.js sampled-frame baseline - L1 proxy reconstruction of video10
// Freeway traffic-jam dance number: one continuous steadicam-style take.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const W = width || 1280, H = height || 720;
  const FPS = fps || 23.976023976023978;
  const DUR = duration || 24.024;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c3d8);
  scene.fog = new THREE.Fog(0xbccfdd, 90, 600);
  const FOV = 37.4;
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.05, 2500);
  scene.add(camera);

  // ---------- seeded rng (construction only) ----------
  let rs = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  if (!rs) rs = 0x9e3779b9;
  const rnd = () => {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- shared geometry / materials ----------
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const cylG = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphG = new THREE.SphereGeometry(1, 16, 12);
  const planeG = new THREE.PlaneGeometry(1, 1);
  const matCache = new Map();
  function mat(hex, rough = 0.8, metal = 0) {
    const k = hex + '|' + rough + '|' + metal;
    if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
    return matCache.get(k);
  }
  function mesh(geo, m, sx, sy, sz, px, py, pz, parent) {
    const o = new THREE.Mesh(geo, m);
    o.scale.set(sx, sy, sz);
    o.position.set(px || 0, py || 0, pz || 0);
    if (parent) parent.add(o);
    return o;
  }
  const glassM = mat(0x3a4650, 0.3, 0.2);
  const tireM = mat(0x161616, 0.9);

  // ---------- sky ----------
  {
    const R = 1000;
    const skyGeo = new THREE.SphereGeometry(R, 32, 16);
    const pos = skyGeo.attributes.position;
    const cTop = new THREE.Color(0x3a72ba), cHor = new THREE.Color(0xb2c9db), cLow = new THREE.Color(0xb9c4c8);
    const tmp = new THREE.Color();
    const cols = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / R;
      if (y >= 0) tmp.copy(cHor).lerp(cTop, Math.pow(y, 0.45));
      else tmp.copy(cLow);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xdfe8f3, 0x9a8c74, 1.05));
  const sun = new THREE.DirectionalLight(0xfff2de, 2.0);
  sun.position.set(25, 60, -35);
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-15, 25, 40);
  scene.add(fill);

  // ---------- environment: elevated freeway ----------
  const concrete = mat(0xb9b2a4, 0.95);
  mesh(boxG, concrete, 16.6, 0.1, 560, 0, -0.05, -200, scene);              // main roadway
  mesh(boxG, mat(0xb4a689, 1), 5000, 1, 5000, 0, -9, 0, scene);              // land far below
  mesh(boxG, mat(0xbdb6a8, 0.95), 34, 0.1, 420, 26, -0.05, -250, scene);     // neighbouring roadway R
  mesh(boxG, mat(0xbdb6a8, 0.95), 34, 0.1, 420, -26, -0.05, -250, scene);    // neighbouring roadway L
  mesh(boxG, mat(0xd6cfc2, 0.9), 0.6, 0.85, 560, 0, 0.425, -200, scene);     // central median barrier
  mesh(boxG, mat(0xcbc4b6, 0.9), 0.4, 1.05, 560, 8.1, 0.525, -200, scene);   // right outer wall
  mesh(boxG, mat(0xcbc4b6, 0.9), 0.4, 1.05, 560, -8.1, 0.525, -200, scene);  // left outer wall
  // tree clumps beyond the right wall / horizon
  const treeM = mat(0x3d5432, 1);
  for (let i = 0; i < 30; i++) {
    const s = 2 + rnd() * 2.5;
    mesh(sphG, treeM, s * 2.2, s * 0.8, s * 2.2, 40 + rnd() * 60, -0.5 + s * 0.2, -80 - rnd() * 220, scene);
  }

  // ---------- cars ----------
  function makeCar(color, opt) {
    opt = opt || {};
    const g = new THREE.Group();
    const suv = !!opt.suv;
    const L = suv ? 4.7 : 4.5, Wd = 1.8;
    const bodyH = suv ? 0.8 : 0.66, base = 0.28;
    const paint = mat(color, 0.45, 0.15);
    const top = base + bodyH;
    const cabH = suv ? 0.68 : 0.5, cabL = suv ? L * 0.66 : L * 0.5, cabZ = suv ? -0.3 : -0.15;
    mesh(boxG, paint, Wd, bodyH, L, 0, base + bodyH / 2, 0, g);
    mesh(boxG, glassM, Wd * 0.86, cabH, cabL, 0, top + cabH / 2, cabZ, g);
    mesh(boxG, paint, Wd * 0.9, 0.05, cabL * 0.88, 0, top + cabH + 0.02, cabZ, g);
    if (!opt.simple) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const w = mesh(cylG, tireM, 0.33, 0.22, 0.33, sx * 0.8, 0.33, sz * (L / 2 - 0.85), g);
        w.rotation.z = Math.PI / 2;
      }
      mesh(boxG, mat(0xe9e7df, 0.3), 0.34, 0.12, 0.03, 0.6, base + bodyH * 0.62, L / 2 + 0.005, g);
      mesh(boxG, mat(0xe9e7df, 0.3), 0.34, 0.12, 0.03, -0.6, base + bodyH * 0.62, L / 2 + 0.005, g);
      mesh(boxG, mat(0x2a2a2a, 0.7), Wd * 0.98, 0.14, 0.06, 0, base + 0.08, L / 2 + 0.01, g);
    }
    g.userData = { L, top, cabH, bodyH, roofY: top + cabH + 0.045, cabZ };
    return g;
  }
  const CARS = [];
  function placeCar(color, x, z, opt, y) {
    const c = makeCar(color, opt);
    c.position.set(x, y || 0, z);
    scene.add(c);
    CARS.push(c);
    return c;
  }
  function roofSpot(x, z) {
    let best = null, bd = 1e9;
    for (const c of CARS) {
      if (Math.abs(c.position.x - x) > 0.6 || c.position.y !== 0) continue;
      const d = Math.abs(c.position.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best || bd > 5) return null;
    return [best.position.x, best.userData.roofY, best.position.z + best.userData.cabZ];
  }
  function addDoor(car, side, color) {
    const u = car.userData;
    const hinge = new THREE.Group();
    hinge.position.set(side * (0.9 + 0.03), 0, u.L / 2 - 0.85);
    car.add(hinge);
    const paint = mat(color, 0.45, 0.15);
    const dl = 1.15;
    mesh(boxG, paint, 0.05, u.bodyH - 0.06, dl, 0, 0.28 + u.bodyH / 2, -dl / 2, hinge);
    mesh(boxG, paint, 0.05, 0.05, dl, 0, u.top + u.cabH - 0.03, -dl / 2, hinge);
    mesh(boxG, paint, 0.05, u.cabH, 0.05, 0, u.top + u.cabH / 2, -dl + 0.03, hinge);
    mesh(boxG, paint, 0.05, u.cabH, 0.04, 0, u.top + u.cabH / 2, -0.02, hinge);
    return hinge;
  }
  function makeTruck(color, x, z) {
    const g = new THREE.Group();
    mesh(boxG, mat(0xe0ddd6, 0.6), 2.3, 2.0, 2.2, 0, 1.3, 3.2, g);
    mesh(boxG, mat(color, 0.8), 2.5, 3.0, 6.5, 0, 2.0, -1.2, g);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  const LX = { L2: -6.0, L3: -2.2, R1: 2.2, R2: 6.0 };
  const C_RED = 0x8c2433, C_TEAL = 0x72c4bd, C_WHITE = 0xdedcd6, C_SILVER = 0xb9bcbf,
    C_GREY = 0x8a8d93, C_DARK = 0x2c3037, C_YEL = 0xd2a43c, C_C = 0x6f7883, C_SUV = 0x30353d;

  // hero cars
  const redCar = placeCar(C_RED, LX.L3, 7.0);
  const tealCar = placeCar(C_TEAL, LX.L2, 0.5);
  const tealDoor = addDoor(tealCar, +1, C_TEAL);
  placeCar(C_WHITE, LX.L3, -0.5);          // purple-top dancer's car
  placeCar(C_YEL, LX.L3, -7.3);
  placeCar(C_SILVER, LX.L2, -6.3);
  placeCar(C_WHITE, LX.L2, -13.1);
  placeCar(C_WHITE, LX.R1, 14.5);
  placeCar(C_DARK, LX.R1, 4.5);
  placeCar(C_SILVER, LX.R1, -5.8);         // curly-haired woman leans out
  placeCar(C_SILVER, LX.R1, -11.2);        // blonde in yellow
  placeCar(C_WHITE, LX.R1, -17.0);
  placeCar(C_GREY, LX.R2, 10.5);
  placeCar(C_DARK, LX.R2, 3.0);
  placeCar(C_GREY, LX.R2, -4.0);           // yellow-shirt man's car
  const womanCar = placeCar(C_C, LX.R2, -9.1);
  const womanDoor = addDoor(womanCar, -1, C_C);
  placeCar(C_SUV, LX.R2, -15.6, { suv: true });

  makeTruck(0xe8e6e0, LX.L3, -48);
  makeTruck(0x4a4038, LX.R1, -60);
  makeTruck(0x8a8f96, LX.L2, -74);
  makeTruck(0xdad6cc, LX.R2, -42);
  const truckSpots = [[LX.L3, -48], [LX.R1, -60], [LX.L2, -74], [LX.R2, -42]];

  const palette = [0xdcdcd8, 0xb8bbbe, 0x8b8f95, 0x2e3238, 0x16181c, 0x56606e, 0xe4e2dc, 0x9a2a2e, 0x46566e, 0xc8b48a, 0xd0d0cc];
  const startZ = { L2: -19.9, L3: -14.1, R1: -23.6, R2: -22.4 };
  for (const ln of ['L2', 'L3', 'R1', 'R2']) {
    let z = startZ[ln];
    while (z > -320) {
      const x = LX[ln];
      let clash = false;
      for (const s of truckSpots) if (s[0] === x && Math.abs(s[1] - z) < 6.5) clash = true;
      const col = palette[Math.floor(rnd() * palette.length)];
      const suv = rnd() < 0.2;
      if (!clash) placeCar(col, x + (rnd() - 0.5) * 0.3, z, { suv, simple: z < -60 });
      z -= 6.6 + rnd() * 0.8;
    }
  }
  // neighbouring jammed roadways (distant filler)
  for (const x of [12, 15.5, 19, 22.5, -12, -15.5, -19, -22.5]) {
    let z = -30 - rnd() * 6;
    while (z > -300) {
      placeCar(palette[Math.floor(rnd() * palette.length)], x, z, { simple: true, suv: rnd() < 0.2 });
      z -= 6.8 + rnd() * 1.5;
    }
  }

  // ---------- articulated person proxy ----------
  const PEOPLE = [];
  function makePerson(o) {
    const root = new THREE.Group();
    const skin = mat(o.skin || 0xc48e6c, 0.85);
    const shirt = mat(o.shirt, 0.85);
    const pants = mat(o.pants || 0x222228, 0.85);
    const hairM = mat(o.hair || 0x1a1410, 0.9);
    const shoe = mat(o.shoe || 0x151515, 0.8);
    const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
    mesh(boxG, o.skirt ? mat(o.skirt, 0.85) : pants, 0.34, 0.2, 0.21, 0, 0.02, 0, hips);
    if (o.skirt) mesh(cylG, mat(o.skirt, 0.85), 0.21, 0.4, 0.17, 0, -0.16, 0, hips);
    const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
    mesh(boxG, shirt, 0.36, 0.56, 0.22, 0, 0.28, 0, spine);
    if (o.tie) mesh(boxG, mat(o.tie, 0.7), 0.065, 0.42, 0.02, 0, 0.3, 0.117, spine);
    const head = new THREE.Group(); head.position.y = 0.6; spine.add(head);
    mesh(cylG, skin, 0.045, 0.1, 0.045, 0, 0.0, 0, head);
    mesh(sphG, skin, 0.1, 0.125, 0.11, 0, 0.12, 0, head);
    const hs = o.hairStyle || 'short';
    if (hs === 'short' || hs === 'long' || hs === 'bun') { mesh(sphG, hairM, 0.112, 0.075, 0.12, 0, 0.175, -0.012, head); mesh(sphG, hairM, 0.1, 0.1, 0.07, 0, 0.13, -0.055, head); }
    if (hs === 'long') mesh(boxG, hairM, 0.2, 0.3, 0.09, 0, 0.04, -0.08, head);
    if (hs === 'bun') mesh(sphG, hairM, 0.065, 0.065, 0.065, 0, 0.2, -0.11, head);
    if (hs === 'curly') mesh(sphG, hairM, 0.165, 0.155, 0.16, 0, 0.15, -0.03, head);
    if (o.cap) {
      mesh(cylG, mat(o.cap, 0.8), 0.118, 0.07, 0.122, 0, 0.215, 0, head);
      mesh(boxG, mat(o.cap, 0.8), 0.2, 0.02, 0.13, 0, 0.19, 0.11, head);
    }
    if (o.band) mesh(cylG, mat(o.band, 0.8), 0.118, 0.06, 0.128, 0, 0.19, -0.005, head);
    const sleeve = o.sleeveless ? skin : shirt;
    const fore = o.longSleeve ? shirt : skin;
    function arm(side) {
      const sh = new THREE.Group(); sh.position.set(side * 0.235, 0.5, 0); spine.add(sh);
      mesh(cylG, sleeve, 0.055, 0.3, 0.055, 0, -0.15, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      mesh(cylG, fore, 0.045, 0.27, 0.045, 0, -0.135, 0, el);
      mesh(sphG, skin, 0.05, 0.05, 0.05, 0, -0.3, 0, el);
      return [sh, el];
    }
    function leg(side) {
      const hp = new THREE.Group(); hp.position.set(side * 0.1, -0.04, 0); hips.add(hp);
      mesh(cylG, o.skirt ? skin : pants, 0.08, 0.44, 0.08, 0, -0.22, 0, hp);
      const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
      mesh(cylG, (o.bareLegs || o.skirt) ? skin : pants, 0.065, 0.42, 0.065, 0, -0.21, 0, kn);
      mesh(boxG, shoe, 0.1, 0.07, 0.24, 0, -0.4, 0.05, kn);
      return [hp, kn];
    }
    const [lsh, lel] = arm(+1), [rsh, rel] = arm(-1);
    const [lhip, lkn] = leg(+1), [rhip, rkn] = leg(-1);
    if (o.scale) root.scale.setScalar(o.scale);
    scene.add(root);
    const p = { root, hips, spine, head, lsh, lel, rsh, rel, lhip, lkn, rhip, rkn, ph: o.ph || 0 };
    PEOPLE.push(p);
    return p;
  }

  function applyPose(p, x, y, z, yaw, P, t) {
    const g = (k) => P[k] || 0;
    p.root.position.set(x, y, z);
    p.root.rotation.y = yaw;
    const c = g('crouch'), wk = g('walk'), dn = g('dance'), st = g('seat');
    let hy = 0.9 - 0.3 * c;
    let lhF = g('lhF') + 0.95 * c + 1.5 * st, rhF = g('rhF') + 0.95 * c + 1.5 * st;
    let lK = g('lK') + 1.75 * c + 1.5 * st, rK = g('rK') + 1.75 * c + 1.5 * st;
    let lean = g('lean') + 0.35 * c;
    let lsF = g('lsF'), lsA = g('lsA'), lE = g('lE'), rsF = g('rsF'), rsA = g('rsA'), rE = g('rE');
    const ph = g('ph') + p.ph;
    if (wk) {
      const a = 2 * Math.PI * 0.95 * t + ph;
      const s = Math.sin(a), co = Math.cos(a);
      lhF += wk * 0.42 * s; rhF -= wk * 0.42 * s;
      lK += wk * 0.55 * Math.max(0, co); rK += wk * 0.55 * Math.max(0, -co);
      lsF -= wk * 0.35 * s; rsF += wk * 0.35 * s;
      lE += wk * 0.25; rE += wk * 0.25;
      hy += wk * 0.025 * Math.cos(2 * a);
    }
    if (dn) {
      const a = 2 * Math.PI * 1.05 * t + ph * 1.7;
      lsA += dn * (1.2 + 0.55 * Math.sin(a));
      rsA += dn * (1.2 + 0.55 * Math.sin(a + 2.2));
      lE += dn * 0.5; rE += dn * 0.5;
      const b = 0.5 + 0.5 * Math.sin(2 * a);
      hy += dn * (0.03 * b - 0.03);
      lean += dn * 0.06 * Math.sin(a);
      lK += dn * 0.18 * b; rK += dn * 0.18 * b;
      lhF += dn * 0.09 * b; rhF += dn * 0.09 * b;
    }
    p.hips.position.y = hy;
    p.spine.rotation.set(lean, g('twist'), g('side'));
    p.head.rotation.set(g('hp'), g('hy'), 0);
    p.lsh.rotation.set(-lsF, 0, lsA);
    p.rsh.rotation.set(-rsF, 0, -rsA);
    p.lel.rotation.set(-lE, 0, 0);
    p.rel.rotation.set(-rE, 0, 0);
    p.lhip.rotation.set(-lhF, 0, g('lhA'));
    p.rhip.rotation.set(-rhF, 0, -g('rhA'));
    p.lkn.rotation.set(lK, 0, 0);
    p.rkn.rotation.set(rK, 0, 0);
  }

  // ---------- keyframe sampling (absolute time) ----------
  const smooth = (u) => u * u * (3 - 2 * u);
  function seg(keys, t) {
    const n = keys.length;
    if (n === 1 || t <= keys[0][0]) return [0, 0, 0];
    if (t >= keys[n - 1][0]) return [n - 1, n - 1, 0];
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1][0]) i++;
    return [i, i + 1, (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])];
  }
  function tang(keys, i, c) {
    const n = keys.length;
    if (n < 2) return 0;
    if (i === 0) return (keys[1][c] - keys[0][c]) / (keys[1][0] - keys[0][0]);
    if (i === n - 1) return (keys[n - 1][c] - keys[n - 2][c]) / (keys[n - 1][0] - keys[n - 2][0]);
    return (keys[i + 1][c] - keys[i - 1][c]) / (keys[i + 1][0] - keys[i - 1][0]);
  }
  function herm(keys, i, j, u, c) {
    if (i === j) return keys[i][c];
    const dt = keys[j][0] - keys[i][0];
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * keys[i][c] + (u3 - 2 * u2 + u) * dt * tang(keys, i, c)
      + (-2 * u3 + 3 * u2) * keys[j][c] + (u3 - u2) * dt * tang(keys, j, c);
  }
  function lerp(a, b, s) { return a + (b - a) * s; }
  function sampleChar(keys, t) {
    const [i, j, u] = seg(keys, t);
    const s = smooth(u);
    const a = keys[i], b = keys[j];
    const P = {};
    const pa = a[5] || {}, pb = b[5] || {};
    for (const k in pa) P[k] = lerp(pa[k], pb[k] || 0, s);
    for (const k in pb) if (!(k in pa)) P[k] = lerp(0, pb[k], s);
    return {
      x: herm(keys, i, j, u, 1), y: lerp(a[2], b[2], s), z: herm(keys, i, j, u, 3),
      yaw: lerp(a[4], b[4], s), P
    };
  }
  function ease(t, a, b) { return t <= a ? 0 : t >= b ? 1 : smooth((t - a) / (b - a)); }

  // ---------- characters ----------
  const PI = Math.PI;
  const man = makePerson({ shirt: 0xeeebe8, pants: 0x1c1c20, skin: 0xc48e6c, hair: 0x1a1410, tie: 0x9a1d28, longSleeve: true });
  const woman = makePerson({ shirt: 0x5d84ad, pants: 0x34465e, skin: 0x8c5d40, hair: 0x24170f, hairStyle: 'bun', band: 0xd9a6ab, longSleeve: true, scale: 0.96, ph: 1.3 });
  const redWoman = makePerson({ shirt: 0xb51e24, skirt: 0xb51e24, skin: 0xe5b898, hair: 0xd8a65a, hairStyle: 'curly', longSleeve: true, scale: 0.95, ph: 0.4 });
  const mustard = makePerson({ shirt: 0xb88a33, pants: 0x3b2c22, skin: 0xc89474, hair: 0x3a2a1c, cap: 0xb3202a, longSleeve: true, ph: 2.0 });
  const blueWoman = makePerson({ shirt: 0x2a4fae, pants: 0x1b1f30, skin: 0xc89474, hairStyle: 'bun', bareLegs: true, sleeveless: true, scale: 0.93, ph: 0.9 });
  const blueMan = makePerson({ shirt: 0x8fb2d4, pants: 0x2c2c32, skin: 0xd9a888, hairStyle: 'bald', ph: 2.7 });
  const greenDancer = makePerson({ shirt: 0x6f7c3c, pants: 0x6b3c2c, skin: 0x9a6a4a, longSleeve: true, ph: 1.1 });
  const darkDancer = makePerson({ shirt: 0x2b3346, pants: 0x22252e, skin: 0x9a6a4a, longSleeve: true, ph: 3.3 });
  const yellowDancer = makePerson({ shirt: 0xc9c24a, pants: 0x6b6a40, skin: 0xc89474, hairStyle: 'long', scale: 0.94, ph: 0.2 });
  const redhead = makePerson({ shirt: 0x565a3c, pants: 0x6c6a4a, skin: 0xe0b090, hair: 0xd2622a, hairStyle: 'curly', sleeveless: true, scale: 0.93, ph: 1.9 });
  const purpleWoman = makePerson({ shirt: 0x6b3aa0, pants: 0x151515, skin: 0xc89474, hairStyle: 'long', scale: 0.94, ph: 0.6 });
  const yellowGuy = makePerson({ shirt: 0xe6d22c, pants: 0x2a2a2a, skin: 0x5a3a26, cap: 0x111111, ph: 2.4 });
  const curlyWoman = makePerson({ shirt: 0xb8552a, pants: 0x2a2a2a, skin: 0x7a4a30, hair: 0x20150c, hairStyle: 'curly', scale: 0.93, ph: 1.5 });
  const blondeYellow = makePerson({ shirt: 0xe3c22c, pants: 0x2a2a2a, skin: 0xe0b08e, hair: 0xd8b878, hairStyle: 'long', sleeveless: true, scale: 0.93, ph: 0.8 });

  // [t, x, y, z, yaw, pose]
  const MAN_KEYS = [
    [3.3, -5.6, 0.0, 1.2, 1.4, { crouch: 0.7, lean: 0.6, lsF: 0.5, rsF: 0.3 }],
    [3.45, -5.55, 0.0, 1.2, 1.4, { crouch: 0.6, lean: 0.6, lsF: 0.5, rsF: 0.3 }],
    [3.9, -5.05, 0.0, 1.3, 0.9, { crouch: 0.25, lean: 0.25, lsF: 0.9, lsA: 0.3, lE: 0.6 }],
    [4.17, -4.75, 0.0, 1.35, 0.3, { lsF: 1.3, lsA: 0.35, lE: 0.9, rsF: 0.1, hp: -0.1 }],
    [5.21, -4.6, 0.0, 1.45, 0.4, { lsF: 1.2, lsA: 0.4, lE: 0.7, hp: -0.35, hy: 0.3 }],
    [5.6, -3.85, 0.0, 1.75, 0.6, { walk: 0.8 }],
    [6.26, -4.2, 0.0, 2.6, 0.0, { walk: 1, rsF: 0.3, rE: 0.6 }],
    [7.30, -4.15, 0.0, 3.4, 0.05, { walk: 1, lsF: 0.2 }],
    [7.8, -3.5, 0.0, 3.4, 1.8, { walk: 0.8 }],
    [8.34, -2.35, 0.0, 3.1, 2.3, { walk: 1, rsF: 0.5, rsA: 0.4 }],
    [8.9, -1.05, 0.0, 3.0, 1.9, { crouch: 0.6, lean: 0.4, lsF: -0.6, rsF: -0.6 }],
    [9.38, -0.5, 0.8, 2.8, 1.4, { lhF: 1.2, lK: 1.4, rhF: -0.3, rK: 0.6, lsA: 1.2, rsA: 1.0, lsF: 0.5 }],
    [9.75, 0.0, 0.85, 2.6, 0.4, { crouch: 0.4, lsA: 0.8, rsA: 0.8 }],
    [10.43, 0.0, 0.85, 2.4, -0.3, { lsA: 2.2, rsA: 1.45, rsF: 0.2, lE: 0.2, hp: -0.15, side: 0.05 }],
    [11.0, 0.0, 0.85, 2.2, -0.2, { lsA: 1.8, rsA: 1.8, lsF: 0.3, rsF: 0.3, lE: 1.0, rE: 1.0, crouch: 0.15 }],
    [11.47, 0.0, 0.85, 2.0, -0.1, { lsA: 0.6, rsA: 0.6, lsF: 2.4, rsF: 2.6, lE: 1.3, rE: 1.2, side: -0.1 }],
    [11.8, 0.15, 0.85, 1.8, 1.0, { crouch: 0.5, lsF: -0.5, rsF: -0.5 }],
    [12.05, 0.55, 0.45, 1.4, 1.0, { lhF: 0.6, lK: 0.9, rhF: 0.2, rK: 0.6, lsA: 0.9, rsA: 0.9 }],
    [12.25, 0.8, 0.0, 1.1, 0.6, { crouch: 0.45 }],
    [12.51, 0.85, 0.0, 0.9, 0.1, { lsA: 0.3, rsA: 0.3 }],
    [13.0, 1.9, 0.0, 0.6, 1.5, { walk: 1 }],
    [13.56, 3.3, 0.0, 0.4, 1.1, { walk: 1, lsA: 0.2 }],
    [14.6, 3.9, 0.0, -0.5, 0.15, { rsA: 1.1, rsF: 0.4, rE: 0.3, lE: 0.4, lsF: 0.2, walk: 0.3 }],
    [15.1, 4.05, 0.0, -1.8, 2.8, { walk: 1 }],
    [15.64, 4.1, 0.0, -3.0, 3.14, { walk: 1 }],
    [16.68, 3.9, 0.0, -4.4, 0.7, { lsF: 0.6, lE: 1.2, rsF: 0.4, rE: 1.0, walk: 0.5, hy: 0.4 }],
    [17.2, 4.25, 0.0, -6.2, 2.6, { walk: 1 }],
    [17.73, 4.5, 0.0, -7.3, 2.0, { lean: 0.45, lsF: 1.5, lsA: 0.1, rsF: 1.5, rsA: -0.1, lE: 0.3, rE: 0.3, crouch: 0.2, rhF: -0.3 }],
    [18.2, 3.85, 0.0, -8.3, 3.6, { walk: 0.8 }],
    [18.77, 3.6, 0.0, -8.6, 6.38, { walk: 0.8 }],
    [19.81, 3.3, 0.0, -9.8, 6.73, { lsF: 0.3, rsF: 0.3, lE: 0.5, rE: 0.5 }],
    [20.85, 3.3, 0.0, -7.0, 6.58, { lean: 0.7, crouch: 0.3, lsF: 0.4, rsF: 0.9, rE: 0.6, lE: 0.4 }],
    [21.9, 3.6, 0.0, -6.6, 6.43, { walk: 0.8, rsA: 0.6, rsF: 0.5 }],
    [22.94, 3.6, 0.0, -5.6, 6.33, { walk: 0.8, lsF: 0.3, rsF: 0.3 }],
    [23.98, 3.55, 0.0, -4.7, 6.43, { walk: 0.6, rsF: 0.9, rE: 0.5, rsA: 0.2 }],
    [24.2, 3.55, 0.0, -4.5, 6.43, { walk: 0.6, rsF: 0.9, rE: 0.5, rsA: 0.2 }],
  ];
  const WOMAN_KEYS = [
    [18.3, 5.55, -0.35, -8.4, 0.0, { seat: 1 }],
    [18.9, 5.25, -0.25, -8.4, -1.4, { seat: 1, lean: 0.3 }],
    [19.35, 4.85, 0.0, -8.4, -1.0, { crouch: 0.35, lean: 0.3 }],
    [19.81, 4.55, 0.0, -8.4, -0.3, { lsF: 0.3, rsF: 0.2, hp: -0.1 }],
    [20.3, 3.9, 0.0, -8.2, -1.0, { walk: 0.9 }],
    [20.85, 4.1, 0.0, -7.4, 0.1, { walk: 0.8, lsF: 0.2 }],
    [21.9, 4.35, 0.0, -6.6, -0.1, { walk: 0.8 }],
    [22.94, 4.35, 0.0, -5.6, -0.1, { walk: 0.8 }],
    [23.98, 4.3, 0.0, -4.65, 0.0, { walk: 0.7, lsA: 0.3 }],
    [24.2, 4.3, 0.0, -4.45, 0.0, { walk: 0.7, lsA: 0.3 }],
  ];
  const REDWOMAN_KEYS = [
    [0, -2.2, 0, 9.7, 0.0, { lean: -0.55, lsF: 2.2, lsA: 0.6, lE: 1.2, rsF: 2.0, rsA: 0.4, rE: 1.4, rhF: 0.3, lK: 0.2, hp: -0.3 }],
    [1.04, -2.25, 0, 9.7, 0.2, { lean: -0.7, lsF: 2.4, lsA: 0.4, lE: 1.0, rsF: 1.6, rE: 1.6, lhF: 0.4, lK: 0.5 }],
    [1.6, -2.4, 0, 10.0, 0.9, { lsA: 1.2, rsA: 1.0 }],
    [2.09, -2.7, 0, 10.2, 1.6, { lsF: 1.2, rsF: 1.0, lsA: 0.6, walk: 0.6 }],
    [2.8, -3.6, 0, 10.9, 0.5, { walk: 0.8, lsA: 0.8, rsA: 0.8 }],
    [4.0, -3.8, 0, 12.0, 0.3, { dance: 1 }],
  ];
  const MUSTARD_KEYS = [
    [0, -2.25, 0, 10.15, 3.14, { lean: 0.55, lsF: 1.0, lE: 0.6, rsF: 1.3, rE: 0.4, crouch: 0.15 }],
    [1.04, -2.2, 0, 10.1, 3.0, { lean: 0.7, lsF: 1.2, rsF: 1.0, crouch: 0.2 }],
    [1.6, -2.05, 0, 10.0, 2.4, { lean: 0.1, lsA: 0.5, rsA: 0.8 }],
    [2.09, -2.15, 0, 9.8, 4.6, { lsF: 1.2, lsA: 0.3, rsF: 0.6, rsA: 1.0, walk: 0.6 }],
    [2.8, -2.6, 0, 11.1, 3.9, { walk: 0.8 }],
    [4.0, -2.9, 0, 12.1, 3.6, { dance: 1 }],
  ];
  const BLUEWOMAN_KEYS = [
    [0, -4.0, 0, 8.1, 0.6, { lsA: 2.4, lE: 0.5, rsA: 0.6, lhF: 0.3, rK: 0.6 }],
    [1.04, -4.45, 0.15, 8.7, -1.2, { lhF: 0.9, lK: 0.3, rhF: -0.7, rK: 0.9, lsF: 0.8, rsF: -0.6, lsA: 0.3, rsA: 0.4 }],
    [2.0, -5.3, 0, 9.5, -1.0, { walk: 1 }],
    [3.0, -5.9, 0, 9.8, 0.0, { dance: 1 }],
  ];
  const BLUEMAN_KEYS = [
    [0, -4.9, 0, 8.9, 3.3, { lsA: 1.3, rsA: 0.9, rsF: 0.3 }],
    [1.04, -5.2, 0, 9.3, 3.6, { lsA: 1.6, rsA: 1.3, walk: 0.3 }],
    [2.5, -5.7, 0, 9.9, 3.2, { dance: 1 }],
  ];
  const GREEN_KEYS = [
    [0, -1.75, 0.94, 8.5, 2.8, { lsA: 1.5, rsA: 1.4, lhA: 0.25, rhA: 0.25 }],
    [1.04, -1.9, 0.94, 8.6, 3.0, { lsA: 1.2, rsA: 1.6, lhA: 0.3, rhA: 0.2, lK: 0.3 }],
    [2.09, -1.7, 0.94, 8.4, 2.6, { crouch: 0.6, lsA: 1.0, rsA: 1.0 }],
    [3.0, -1.8, 0.94, 8.5, 0.5, { dance: 1 }],
  ];
  const DARK_KEYS = [
    [0, -2.6, 1.47, 6.9, 2.9, { rsF: 0.6, rsA: 0.9, lsA: 0.3, lhA: 0.15 }],
    [1.04, -2.45, 1.47, 6.8, 3.2, { rsA: 1.4, lsA: 1.2, lhA: 0.2, rhA: 0.2 }],
    [3.0, -2.5, 1.47, 6.9, 0.0, { dance: 1 }],
  ];
  const YELLOWD_KEYS = [
    [0, -6.4, 0, 6.3, 0.8, { dance: 1 }],
    [2.4, -6.2, 0, 6.8, 1.2, { walk: 1 }],
    [3.13, -5.3, 0, 7.9, 1.5, { lean: 0.5, lsF: 0.8, rsF: -0.3, walk: 0.6 }],
    [3.8, -4.7, 0, 8.6, 2.4, { walk: 1 }],
    [4.6, -5.7, 0, 9.5, 1.0, { dance: 1 }],
  ];
  const REDHEAD_KEYS = [
    [0, -3.9, 0, -3.0, 0.2, { dance: 1 }],
    [5.21, -3.75, 0, -2.4, 0.1, { dance: 0.8 }],
    [6.26, -3.65, 0, -1.6, 0.0, { walk: 0.8 }],
    [7.30, -3.7, 0, -1.0, -0.2, { walk: 0.6 }],
    [8.34, -4.3, 0, -0.7, 0.3, { dance: 1 }],
  ];
  const PURPLE_KEYS = [
    [0, -1.2, 0.08, 0.0, PI / 2, { seat: 1, lsA: 2.2, rsA: 2.0, dance: 0.4 }],
    [7.6, -1.2, 0.08, 0.0, PI / 2, { seat: 1, lsA: 1.0, rsA: 1.0 }],
    [8.34, -1.2, 0.08, 0.0, PI / 2, { lhF: 1.6, lK: 0.0, rhF: 1.4, rK: 1.4, lean: -0.3, lsA: 1.0, rsA: 1.0 }],
    [8.9, -1.2, 0.08, 0.0, PI / 2, { lhF: 1.3, lK: 0.2, rhF: 1.6, rK: 0.3, lean: -0.4, lsA: 1.1, rsA: 0.9 }],
    [9.38, -1.2, 0.08, 0.0, PI / 2, { lhF: 1.5, lK: 0.1, rhF: 1.5, rK: 0.1, lean: -0.4, lsA: 0.5 }],
    [10.43, -1.2, 0.08, 0.0, PI / 2, { seat: 1, lean: -0.1, rsF: 1.0, rE: 1.2, lsA: 0.3 }],
    [11.47, -1.2, 0.08, 0.0, PI / 2, { seat: 1, lean: 0.1, rsF: 0.8, lsF: 0.5 }],
    [13.0, -1.2, 0.08, 0.0, PI / 2, { seat: 1, dance: 0.6 }],
  ];

  // ---------- background crowd ----------
  const crowdSpec = [
    [-6.0, 1.47, -6.45, 0xe8e8e8], [-2.2, 1.47, -7.45, 0xc94040], [-4.1, 0, -11.0, 0x3a6a3a],
    [-6.0, 1.47, -13.25, 0xd6c040], [-2.2, 1.47, -14.25, 0x4060a0], [-4.1, 0, -17.0, 0xa05030],
    [2.2, 1.47, -17.15, 0x30384a], [2.2, 1.47, -23.75, 0xe0e0d0], [6.0, 1.78, -15.9, 0xb02a2a],
    [3.9, 0, -14.0, 0x8fb3d8], [4.4, 0, -15.2, 0xe6d460], [4.2, 0, -20.0, 0x303030],
    [-4.1, 0, -24.0, 0xc0a070], [-6.0, 1.47, -20.05, 0x202020], [6.0, 1.47, -22.55, 0xe0e0e0],
    [-2.2, 1.47, -21.05, 0x7a4a8a], [-4.1, 0, -5.5, 0x2e6e7a], [-0.75, 0, -9.0, 0xd07a3a],
    [-4.1, 0, -30.0, 0x993333], [4.1, 0, -27.0, 0x335599], [-6.0, 1.47, -27.0, 0xdddddd],
    [2.2, 1.47, -30.0, 0x444444],
  ];
  const crowd = crowdSpec.map((c, i) => {
    const skins = [0xc48e6c, 0x8c5d40, 0xe0b090, 0x5a3a26];
    const p = makePerson({
      shirt: c[3], pants: [0x22252e, 0x3a3a40, 0x2a3550, 0x5a4a3a][i % 4], skin: skins[i % 4],
      hairStyle: ['short', 'long', 'bun', 'curly', 'short'][i % 5], hair: [0x1a1410, 0x3a2a1c, 0xb8864a][i % 3],
      scale: 0.92 + 0.1 * rnd(), ph: rnd() * 6.28
    });
    let x = c[0], y = c[1], z = c[2] - 14;
    if (y > 0) { const r = roofSpot(x, z); if (r) { x = r[0]; y = r[1]; z = r[2]; } else y = 0; }
    return { p, x, y, z, yaw: (rnd() - 0.5) * 1.2, mode: i % 3, f: 0.9 + 0.5 * rnd() };
  });

  // ---------- camera path (single continuous take) ----------
  // [t, px, py, pz, tx, ty, tz]
  const CAM = [
    [0.00, -3.0, 1.3, 12.3, -1.9, 1.2, 6.5],
    [1.04, -3.4, 1.5, 11.5, -1.9, 1.0, 6.5],
    [1.60, -3.5, 1.45, 11.5, -2.3, 1.2, 8.6],
    [2.09, -3.3, 1.45, 11.4, -2.1, 1.3, 9.7],
    [2.60, -4.0, 1.45, 10.3, -4.6, 1.35, 1.0],
    [3.13, -4.3, 1.45, 9.6, -4.8, 1.45, -8.0],
    [4.17, -3.9, 1.5, 6.6, -4.6, 0.95, 0.0],
    [5.21, -4.2, 1.55, 4.3, -4.5, 1.35, 0.5],
    [6.26, -4.4, 1.55, 5.8, -4.2, 1.35, 1.0],
    [7.30, -4.4, 1.55, 6.0, -4.0, 1.25, 1.5],
    [8.34, -4.3, 1.55, 5.7, -1.0, 1.0, -0.5],
    [8.85, -2.2, 1.45, 3.9, -0.6, 1.4, 2.0],
    [9.10, -0.95, 1.5, 5.4, -0.4, 1.6, 2.0],
    [9.38, -0.9, 1.5, 6.7, -0.4, 1.6, 1.8],
    [10.43, -0.85, 1.45, 6.6, -0.2, 1.8, 1.5],
    [11.47, -0.8, 1.35, 5.6, -0.1, 1.55, 1.5],
    [12.00, 0.9, 1.7, 8.4, 0.8, 1.1, 1.0],
    [12.51, 2.2, 1.95, 8.8, 1.0, 1.0, 0.0],
    [13.56, 4.0, 1.6, 4.8, 3.4, 0.75, -1.0],
    [14.60, 4.0, 1.55, 2.5, 3.9, 1.2, -1.5],
    [15.64, 4.0, 1.55, 0.0, 4.0, 1.2, -4.0],
    [16.68, 4.0, 1.6, -1.7, 3.9, 1.25, -5.5],
    [17.73, 3.8, 1.6, -3.6, 4.3, 1.2, -8.0],
    [18.77, 3.9, 1.5, -5.6, 4.0, 1.2, -9.0],
    [19.81, 3.95, 1.4, -6.6, 4.5, 1.55, -8.6],
    [20.85, 4.0, 1.4, -5.4, 4.0, 1.45, -8.5],
    [21.90, 4.0, 1.35, -4.3, 4.0, 1.45, -7.5],
    [22.94, 4.0, 1.35, -3.3, 4.0, 1.5, -6.5],
    [23.98, 4.0, 1.35, -2.4, 4.0, 1.5, -5.6],
    [24.20, 4.0, 1.35, -2.23, 4.0, 1.5, -5.43],
  ];

  // ---------- letterbox (2.55:1 picture inside 16:9 frame) ----------
  {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false });
    const d = 0.1;
    const halfH = d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfW = halfH * (W / H);
    const edge = halfH * 0.70;
    const bh = (halfH - edge) + halfH * 0.3;
    for (const s of [1, -1]) {
      const bar = new THREE.Mesh(planeG, barMat);
      bar.scale.set(halfW * 2.6, bh, 1);
      bar.position.set(0, s * (edge + bh / 2), -d);
      bar.renderOrder = 9999;
      bar.frustumCulled = false;
      camera.add(bar);
    }
  }
  camera.updateProjectionMatrix();

  function placeChar(p, keys, t) {
    const s = sampleChar(keys, t);
    applyPose(p, s.x, s.y, s.z, s.yaw, s.P, t);
  }

  function update(time, frame) {
    let t = (typeof time === 'number' && isFinite(time)) ? time : (frame || 0) / FPS;
    t = Math.max(0, Math.min(t, DUR));

    // camera
    const [ci, cj, cu] = seg(CAM, t);
    const c = [];
    for (let k = 1; k <= 6; k++) c.push(herm(CAM, ci, cj, cu, k));
    camera.position.set(c[0], c[1], c[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(c[3], c[4], c[5]);
    camera.fov = FOV;
    camera.updateProjectionMatrix();

    // doors
    tealDoor.rotation.y = -1.13 * (ease(t, 2.6, 3.3) - ease(t, 5.8, 6.4));
    womanDoor.rotation.y = 1.22 * (ease(t, 18.0, 18.7) - ease(t, 20.45, 21.3));

    // hero characters
    placeChar(man, MAN_KEYS, t);
    man.root.visible = t >= 3.3;
    placeChar(woman, WOMAN_KEYS, t);
    woman.root.visible = t >= 18.3;
    placeChar(redWoman, REDWOMAN_KEYS, t);
    placeChar(mustard, MUSTARD_KEYS, t);
    placeChar(blueWoman, BLUEWOMAN_KEYS, t);
    placeChar(blueMan, BLUEMAN_KEYS, t);
    placeChar(greenDancer, GREEN_KEYS, t);
    placeChar(darkDancer, DARK_KEYS, t);
    placeChar(yellowDancer, YELLOWD_KEYS, t);
    placeChar(redhead, REDHEAD_KEYS, t);
    placeChar(purpleWoman, PURPLE_KEYS, t);

    // people leaning out of car windows
    const w1 = Math.sin(2 * PI * 0.9 * t);
    applyPose(yellowGuy, 5.4, -0.12, -4.2, -PI / 2, { lean: 0.6 + 0.05 * w1, lsF: 0.9, rsF: 1.1 + 0.3 * w1, lE: 0.6, rE: 0.8, hy: 0.4 * Math.sin(0.7 * t) }, t);
    applyPose(curlyWoman, 2.8, -0.12, -5.5, PI / 2, { lean: 0.55, rsF: 1.0 + 0.4 * Math.sin(2 * PI * 0.8 * t + 1), lsA: 0.5, rE: 0.9, hy: -0.3 }, t);
    applyPose(blondeYellow, 2.8, -0.12, -10.8, PI / 2, { lean: 0.45, rsF: 0.8, lsF: 0.6, lE: 0.9, rE: 0.7, hy: -0.4 }, t);

    // background crowd: waving / bouncing
    for (const cr of crowd) {
      const a = 2 * PI * cr.f * t + cr.p.ph;
      let P;
      if (cr.mode === 0) P = { lsA: 2.5 + 0.35 * Math.sin(a), rsA: 2.4 + 0.35 * Math.sin(a + 1.3), lE: 0.3, rE: 0.3 };
      else if (cr.mode === 1) P = { dance: 1 };
      else P = { lsA: 2.0 + 0.5 * Math.sin(a), rsA: 2.0 + 0.5 * Math.sin(a + PI), lsF: 0.3, rsF: 0.3, lE: 0.7, rE: 0.7, lean: 0.08 * Math.sin(a) };
      applyPose(cr.p, cr.x, cr.y, cr.z, cr.yaw, P, t);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
