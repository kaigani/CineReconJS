// L1 proxy reconstruction: helmet-cam POV urban downhill MTB run (single continuous shot).
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4f92dc);
  scene.fog = new THREE.Fog(0xa8c4e0, 70, 220);

  // ---------- deterministic PRNG ----------
  let st = (seed >>> 0) || 12345;
  function rnd() {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const D2R = Math.PI / 180;

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x7a6a58, 1.0));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
  sun.position.set(-40, 60, 30);
  scene.add(sun);

  // ---------- material cache ----------
  const mats = {};
  function mat(c) {
    if (!mats[c]) mats[c] = new THREE.MeshLambertMaterial({ color: c });
    return mats[c];
  }
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const cylG = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const sphG = new THREE.SphereGeometry(0.5, 10, 8);
  function box(parent, w, h, d, x, y, z, c) {
    const m = new THREE.Mesh(boxG, mat(c));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------- course path (precomputed by integrating heading/grade) ----------
  // turn > 0 = left turn. grade = dy/ds (negative = downhill)
  const segs = [
    { len: 8, turn: -10, grade: -0.06 },  // A start road
    { len: 6, turn: 5, grade: -0.15 },    // B alley with white fence
    { len: 24, turn: 0, grade: -0.3 },    // C steep narrow path along walls
    { len: 6, turn: 40, grade: -0.15 },   // D left merge onto road
    { len: 36, turn: -15, grade: -0.13 }, // E road: crowd left, stone wall right
    { len: 8, turn: 45, grade: -0.08 },   // F wooden berm (left-hand)
    { len: 34, turn: 5, grade: -0.22 },   // G cobblestone descent
  ];
  const DS = 0.25;
  const PX = [0], PY = [0], PZ = [0], PH = [0], PG = [segs[0].grade];
  {
    let x = 0, y = 0, z = 0, h = 0;
    for (const sg of segs) {
      const n = Math.round(sg.len / DS);
      const dh = (sg.turn * D2R) / n;
      for (let i = 0; i < n; i++) {
        h += dh;
        x += -Math.sin(h) * DS;
        z += -Math.cos(h) * DS;
        y += sg.grade * DS;
        PX.push(x); PY.push(y); PZ.push(z); PH.push(h); PG.push(sg.grade);
      }
    }
  }
  const SMAX = (PX.length - 1) * DS;
  function samplePath(s) {
    s = Math.max(0, Math.min(SMAX - 1e-6, s));
    const f = s / DS, i = Math.floor(f), u = f - i;
    const L = (a) => a[i] + (a[i + 1] - a[i]) * u;
    let g = 0, cnt = 0;
    for (let k = -8; k <= 8; k++) {
      const j = Math.max(0, Math.min(PG.length - 1, i + k));
      g += PG[j]; cnt++;
    }
    return { x: L(PX), y: L(PY), z: L(PZ), h: L(PH), g: g / cnt };
  }

  // ---------- zones ----------
  function zoneAt(s) {
    if (s < 8) return 'A';
    if (s < 14) return 'B';
    if (s < 38) return 'C';
    if (s < 44) return 'D';
    if (s < 80) return 'E';
    if (s < 88) return 'F';
    return 'G';
  }
  const crowdCols = [0x1b1b22, 0xd0d0d0, 0xb02a2a, 0x2a4a9a, 0x2f6a3a, 0xe0c040, 0x6a4a3a, 0x303030, 0xc0603a, 0xe8e8f0, 0x222228, 0x444450];
  const skinCols = [0xc89a78, 0x9a6a4a, 0xb88060, 0x5a3a2a, 0x2a2018];

  function person(parent, x, y, z, raise) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const c = crowdCols[Math.floor(rnd() * crowdCols.length)];
    const body = new THREE.Mesh(cylG, mat(c));
    body.scale.set(0.42, 0.75, 0.3);
    body.position.y = 1.12;
    g.add(body);
    const legs = new THREE.Mesh(boxG, mat(0x2a2a35));
    legs.scale.set(0.34, 0.75, 0.24);
    legs.position.y = 0.37;
    g.add(legs);
    const head = new THREE.Mesh(sphG, mat(skinCols[Math.floor(rnd() * skinCols.length)]));
    head.scale.setScalar(0.22);
    head.position.y = 1.62;
    g.add(head);
    if (raise) {
      const arm = new THREE.Mesh(boxG, mat(skinCols[0]));
      arm.scale.set(0.08, 0.55, 0.08);
      arm.position.set(0.22, 1.7, 0.05);
      arm.rotation.z = -0.35;
      g.add(arm);
    }
    parent.add(g);
  }
  const meshMat = new THREE.MeshLambertMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.3, depthWrite: false });
  function barrier(parent, x, len, y) {
    box(parent, 0.05, 0.05, len, x, y + 1.05, 0, 0xc8c8cc);
    box(parent, 0.05, 0.05, len, x, y + 0.15, 0, 0xc8c8cc);
    const pm = new THREE.Mesh(boxG, meshMat);
    pm.scale.set(0.02, 0.85, len); pm.position.set(x, y + 0.6, 0); parent.add(pm);
    for (let k = -1; k <= 1; k += 2) box(parent, 0.05, 1.05, 0.05, x, y + 0.55, k * len * 0.45, 0xb8b8bc);
  }
  function crowdRow(parent, x0, len, y, n, depth, side) {
    const sgn = side || -1;
    for (let i = 0; i < n; i++) {
      for (let r = 0; r < depth; r++) {
        const z = -len / 2 + (i + 0.2 + rnd() * 0.6) * (len / n);
        person(parent, x0 + sgn * (r * 0.6 + rnd() * 0.2), y + r * 0.1, z, rnd() < 0.18);
      }
    }
  }
  function slab(parent, w, top, L, cx, c) {
    box(parent, w, 4, L, cx, top - 2, 0, c);
  }

  // ---------- build the course in 2 m chunks ----------
  const CH = 2;
  const houseColsE = [0x3f6aa8, 0xc9c1a8, 0x9a4a3a, 0xd8d2c0, 0x4a8a5a];
  const houseColsG = [0x3a6ad0, 0xe0c040, 0xc84040, 0x7fb8e0, 0x50a070, 0xe0d8c8, 0xd88aa0];
  for (let s0 = -10; s0 < SMAX + 30; s0 += CH) {
    const sm = s0 + CH / 2;
    const p = samplePath(Math.max(0, Math.min(SMAX - 0.01, sm)));
    let px = p.x, py = p.y, pz = p.z;
    if (sm < 0 || sm > SMAX) {
      const ext = sm < 0 ? sm : sm - SMAX;
      px += -Math.sin(p.h) * ext;
      pz += -Math.cos(p.h) * ext;
      py += p.g * ext;
    }
    const g = new THREE.Group();
    g.position.set(px, py, pz);
    g.rotation.order = 'YXZ';
    g.rotation.y = p.h;
    g.rotation.x = Math.atan(p.g);
    scene.add(g);
    const zone = zoneAt(sm);
    const L = CH + 0.7;

    if (zone === 'A') {
      slab(g, 14, 0, L, -1, 0x76726c);
      slab(g, 10, 0.18, L, -13, 0x9a948a);
      slab(g, 10, 0.05, L, 11, 0x8a8478);
      box(g, 0.3, 0.2, L, -8, 0.1, 0, 0xd0ccc0); // curb
      crowdRow(g, -11.5, L, 0.18, 3, 2);
      if (Math.floor(s0) % 4 === 0) {
        const tr = new THREE.Mesh(cylG, mat(0x5a4632)); tr.scale.set(0.3, 3, 0.3); tr.position.set(-9.5, 1.5, 0); g.add(tr);
        const cr = new THREE.Mesh(sphG, mat(0x2f5a2a)); cr.scale.set(4, 3, 4); cr.position.set(-9.5, 4.4, 0); g.add(cr);
      }
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), mat(0xf05a20));
      cone.position.set(5.5, 0.28, 0); g.add(cone);
      barrier(g, 6.5, L, 0);
      crowdRow(g, 7.2, L, 0, 3, 2, 1);
      box(g, 5, 6, L, 14, 3, 0, 0xd9cfb0);
    } else if (zone === 'B') {
      slab(g, 3.4, 0, L, 0, 0xa49c8c);
      slab(g, 12, 0, L, -8, 0x8e887c);
      barrier(g, -1.9, L, 0);
      box(g, 0.05, 0.9, L, -1.95, 0.55, 0, rnd() < 0.5 ? 0x1e2a50 : 0xb02028);
      crowdRow(g, -2.5, L, 0, 3, 3);
      box(g, 4, 4.5, L, -11, 2.25, 0, 0xc8b890);
      // right: white corrugated fence
      box(g, 0.1, 3.2, L, 1.75, 1.6, 0, 0xdedad0);
      for (let k = 0; k < 4; k++) box(g, 0.05, 3.2, 0.05, 1.68, 1.6, -L / 2 + k * 0.6, 0x8a8a88);
      slab(g, 8, 0, L, 6, 0x9a9488);
    } else if (zone === 'C') {
      slab(g, 2.8, 0, L, 0, 0xab9c80);
      box(g, 0.25, 0.4, L, -1.45, 0.1, 0, 0x9a8a70);
      // left drop to lower street (crowd on lower level)
      slab(g, 14, -1.9, L, -8.5, 0x7c766c);
      barrier(g, -2.4, L, -1.9);
      crowdRow(g, -3.0, L, -1.9, 3, 3);
      box(g, 5, 5, L, -13, -1.9 + 2.5, 0, sm < 25 ? 0xc8b48a : 0xd6c9a2);
      let wc = 0xc8b48c;
      if (sm >= 21 && sm < 23) wc = 0xb4643c;
      else if (sm >= 23 && sm < 25) wc = 0xd890b0;
      else if (sm >= 25 && sm < 27) wc = 0xb8b0a0;
      else if (sm >= 27 && sm < 31) wc = 0x8ec070;
      else if (sm >= 31) wc = 0xe070a8;
      box(g, 0.5, 3.4, L, 1.6, 1.5, 0, wc);
      slab(g, 8, 0.5, L, 5.8, 0x9a8a70);
      if (sm >= 27) box(g, 0.05, 1.0, L * 0.5, 1.33, 1.0 + rnd() * 1.4, 0, sm < 31 ? 0x3a5ab0 : 0xe8d040);
      if (sm >= 30) box(g, 0.8, 1.0, L, -1.0, 0.5, 0, 0x4a7a30); // hedge
      if (sm >= 34) box(g, 0.05, 1.2, L, 1.33, 2.2, 0, 0xe8d040);
    } else if (zone === 'D') {
      slab(g, 6, 0, L, 0, 0x9a8a72);
      slab(g, 14, -0.4, L, -10, 0x6c6864);
      box(g, 0.4, 1.4, L, 3.2, 0.6, 0, sm < 37 ? 0xe8c040 : 0xb8a888);
      box(g, 0.05, 1.4, L, 3.2, 2.0, 0, 0x6a6a6a);
      slab(g, 10, -0.6, L, 8.5, 0x9a8060);
      barrier(g, -3.2, L, -0.4);
      crowdRow(g, -3.8, L, -0.4, 3, 3);
      box(g, 5, 6, L, -10, 2.6, 0, 0x3a64b0);
    } else if (zone === 'E') {
      slab(g, 5.4, 0, L, 0, 0x6c6864);
      slab(g, 12, 0, L, -8.7, 0x88827a);
      box(g, 0.14, 0.2, L, 2.7, 0.05, 0, 0xd8d4cc); // curb
      slab(g, 1.4, 0.15, L, 3.45, 0xa88a64);       // dirt shoulder
      box(g, 1.2, 6.5 + rnd() * 0.8, L, 4.75, 3.0, 0, sm > 70 ? 0xb8b088 : (sm > 61 && sm < 66 ? 0x3a3a34 : 0x7e7466));
      barrier(g, -2.8, L, 0);
      if (sm > 68) box(g, 0.05, 0.85, L, -2.85, 0.55, 0, [0x2050c0, 0xe8c020, 0xf0f0f0][Math.floor(rnd() * 3)]);
      crowdRow(g, -3.3, L, 0, 3, 3);
      box(g, 4.5, 5 + rnd() * 1.5, L, -9.5, 2.8, 0, houseColsE[Math.floor((sm / 8) % houseColsE.length)]);
    } else if (zone === 'F') {
      slab(g, 6, 0, L, 0, 0x6c6864);
      slab(g, 12, 0, L, -9, 0x88827a);
      // continuous wooden berm on the outer (right) side, banked ~47 deg
      slab(g, 8, -0.2, L, 8, 0x7a6a54);
      box(g, 5, 7, L, 11, 3, 0, 0xe2c450);
      barrier(g, -3.2, L, 0);
      box(g, 0.05, 0.85, L, -3.25, 0.55, 0, rnd() < 0.5 ? 0xd0d8e8 : 0x2a62b8);
      crowdRow(g, -3.8, L, 0, 3, 2);
      box(g, 5, 6, L, -11, 3, 0, 0xe0d8c8);
    } else {
      slab(g, 7, 0, L, 0, 0x5e564e);
      box(g, 1.6, 0.22, L, 2.6, -0.09, 0, 0x8a7a68); // lighter cobble edge strip
      slab(g, 12, 0, L, -9.5, 0x4e4a46);
      barrier(g, -3.4, L, 0);
      crowdRow(g, -4.0, L, 0, 3, 3);
      box(g, 5, 5 + rnd() * 2, L, -11, 3, 0, houseColsG[Math.floor((sm / 6) % houseColsG.length)]);
      // right: barrier, terrace dropping away, low houses
      barrier(g, 3.5, L, 0);
      if (rnd() < 0.3) person(g, 4.3, 0, 0, false);
      slab(g, 3, 0.1, L, 5.1, 0x9a7050);
      slab(g, 10, -1.5, L, 11.5, 0x8a7a68);
      box(g, 5, 4 + rnd() * 2, L, 11, 0.5, 0, sm > 108 ? 0x80c0e8 : houseColsG[Math.floor((sm / 6 + 3) % houseColsG.length)]);
    }
  }
  // continuous wooden berm (wall ride) on the outer right side, banked ~47 deg
  for (let s0 = 77; s0 < 90; s0 += 0.5) {
    const p = samplePath(s0 + 0.25);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = p.h;
    g.rotation.x = Math.atan(p.g);
    scene.add(g);
    const piv = new THREE.Group();
    piv.position.set(2.3, 0, 0);
    piv.rotation.z = -0.72;
    g.add(piv);
    box(piv, 0.15, 3.8, 0.62, 0.08, 1.9, 0, ((s0 * 2) | 0) % 2 ? 0x5a544c : 0x68625a);
  }
  // distant city / hills
  for (let i = 0; i < 30; i++) {
    const p = samplePath(SMAX);
    const a = p.h + (rnd() - 0.5) * 2.2;
    const r = 70 + rnd() * 60;
    box(scene, 8 + rnd() * 10, 6 + rnd() * 10, 8 + rnd() * 10,
      p.x - Math.sin(a) * r, p.y - 22 + rnd() * 6, p.z - Math.cos(a) * r,
      [0xd8d0c0, 0xc8b8a0, 0x9ab0c8, 0xe0c8a0][i % 4]);
  }

  // ---------- rider rig ----------
  const rider = new THREE.Group();
  rider.rotation.order = 'YXZ';
  scene.add(rider);

  const camera = new THREE.PerspectiveCamera(80, width / height, 0.05, 400);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.5, 0.0);
  rider.add(camera);

  // Bike cockpit is held in a level frame attached to the head camera so the
  // handlebar / tyre composition stays near the reference image location.
  const NOM_PITCH = -24 * D2R;
  const bike = new THREE.Group();
  bike.rotation.x = -NOM_PITCH; // undo nominal head pitch -> level frame at eye
  camera.add(bike);
  const black = 0x141418, red = 0xc8202a, white = 0xf2f2f2;
  // front tyre (vertical plane containing forward axis)
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.06, 8, 28), mat(0x1a1a1a));
  tire.rotation.y = Math.PI / 2 - 0.3;
  tire.position.set(0, -1.02, -1.28);
  bike.add(tire);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10), mat(0x555558));
  disc.rotation.z = Math.PI / 2;
  disc.position.copy(tire.position);
  bike.add(disc);
  // fork legs (red) from crown to axle
  for (const sx of [-0.07, 0.07]) {
    const a = new THREE.Vector3(sx, -0.6, -0.62), b = new THREE.Vector3(sx, -1.02, -1.28);
    const m = new THREE.Mesh(cylG, mat(red));
    const d = b.clone().sub(a);
    m.scale.set(0.045, d.length(), 0.045);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    bike.add(m);
  }
  box(bike, 0.16, 0.04, 0.08, 0, -0.58, -0.6, red); // crown
  box(bike, 0.07, 0.07, 0.14, 0, -0.52, -0.52, black); // stem
  const bar = new THREE.Mesh(cylG, mat(black));
  bar.scale.set(0.03, 0.82, 0.03);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, -0.5, -0.5);
  bike.add(bar);
  // down tube / frame below bar (red/black)
  box(bike, 0.06, 0.06, 0.5, 0, -0.8, -0.35, black);
  box(bike, 0.05, 0.05, 0.14, 0, -0.78, -0.5, red);
  // gloves
  box(bike, 0.11, 0.08, 0.13, -0.37, -0.48, -0.5, white);
  box(bike, 0.11, 0.08, 0.13, 0.37, -0.48, -0.5, white);
  // arms from out-of-frame shoulders to the grips
  function arm(sx) {
    const a = new THREE.Vector3(sx * 0.3, -0.5, 0.15);
    const b = new THREE.Vector3(sx * 0.37, -0.49, -0.44);
    const m = new THREE.Mesh(cylG, mat(0x0e0e12));
    const d = b.clone().sub(a);
    m.scale.set(0.1, d.length(), 0.1);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    bike.add(m);
  }
  arm(-1); arm(1);

  // fake rider shadow on the ground (sun behind-left) - simple dark proxies in rider frame
  const shMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false });
  const shadow = new THREE.Group();
  rider.add(shadow);
  // shadow laid out along its own -Z (away from sun): wheels then rider body further out
  const flat = (geo, x, z, sx, sz) => { const m = new THREE.Mesh(geo, shMat); m.rotation.x = -Math.PI / 2; m.scale.set(sx, sz, 1); m.position.set(x, 0, z); shadow.add(m); return m; };
  const ringG = new THREE.RingGeometry(0.26, 0.36, 20), discG = new THREE.CircleGeometry(0.5, 18);
  flat(ringG, 0.15, -0.2, 0.55, 1.15);
  flat(ringG, 0.15, -1.5, 0.55, 1.15);
  flat(discG, 0.1, -2.6, 0.75, 1.5);
  flat(discG, 0.1, -3.4, 0.45, 0.45);
  flat(discG, 0.15, -0.85, 0.12, 1.3);

  // ---------- timeline keys ----------
  const sKeys = [[0, 0], [1.1, 8], [2.4, 17], [5.0, 35], [5.8, 41], [10.8, 76], [12.4, 88], [15.92, 118]];
  function lin(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1][0]) {
        const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
        return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * u;
      }
    }
    return keys[keys.length - 1][1];
  }
  function smooth(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1][0]) {
        let u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
        u = u * u * (3 - 2 * u);
        return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * u;
      }
    }
    return keys[keys.length - 1][1];
  }
  // head yaw offset (deg, +left), head pitch rel. to slope (deg), rider lean (deg, +left), extra camera roll
  const yawK = [[0, 4], [0.7, -6], [1.37, 4], [2.07, 0], [2.77, 0], [3.44, 2], [4.14, 2], [4.84, 6], [5.54, 12], [6.2, 0], [6.9, 0], [7.6, 0], [8.27, 2], [8.98, 0], [9.68, 2], [10.34, 0], [11.04, 4], [11.75, 22], [12.45, 6], [13.11, 0], [15.92, 0]];
  const pitchK = [[0, -24], [0.7, -24], [1.37, -22], [2.07, -30], [2.77, -34], [3.44, -30], [4.14, -30], [4.84, -24], [5.54, -28], [6.2, -28], [6.9, -27], [7.6, -25], [8.27, -26], [8.98, -27], [9.68, -26], [10.34, -24], [11.04, -24], [11.75, -18], [12.45, -52], [13.11, -31], [13.81, -31], [14.51, -31], [15.18, -30], [15.92, -30]];
  const leanK = [[0, 0], [0.7, -4], [1.37, 0], [2.07, -10], [2.77, -14], [3.44, -6], [4.14, 0], [4.84, 4], [5.54, 6], [6.2, 4], [6.9, 0], [8.27, 2], [9.68, -2], [10.34, 0], [11.04, 0], [11.4, 18], [11.75, 38], [12.1, 18], [12.45, 8], [13.11, 0], [15.92, 0]];
  const rollK = [[0, 0], [2.07, -4], [2.77, -4], [3.44, 0], [6.2, 4], [7.6, 0], [15.92, 0]];
  // berm ride lateral offset (m, +right) and elevation (m); jump at ~12.45 s
  const latK = [[0, 0.3], [1.1, 0], [5.8, 0.4], [6.6, 1.5], [10.5, 1.5], [11.15, 1.0], [11.75, 2.3], [12.15, 1.2], [12.6, 0.8], [13.1, 1.2], [15.92, 1.2]];
  const elK = [[0, 0], [11.15, 0], [11.75, 0.5], [12.15, 1.2], [12.45, 2.0], [12.95, 0], [15.92, 0]];
  // shadow direction relative to rider heading (deg, +left), read from the visible rider shadow
  const shK = [[0, -55], [0.7, -50], [1.37, -40], [2.07, -25], [2.77, -15], [3.44, -15], [4.14, -25], [4.84, -30], [5.54, -30], [6.2, -15], [6.9, -8], [7.6, -5], [8.27, 0], [9.68, 0], [11.04, 0], [11.75, 30], [12.45, 0], [13.11, -20], [14.51, -30], [15.18, -12], [15.92, -5]];

  function update(time) {
    const t = Math.max(0, Math.min(duration, time));
    const s = lin(sKeys, t);
    const p = samplePath(s);
    const lat = smooth(latK, t), el = smooth(elK, t);
    const rx = Math.cos(p.h), rz = -Math.sin(p.h);
    const vib = 0.012 * Math.sin(t * 37.0) + 0.008 * Math.sin(t * 23.0 + 1.3);
    rider.position.set(p.x + rx * lat, p.y + el + vib, p.z + rz * lat);
    rider.rotation.set(Math.atan(p.g), p.h, smooth(leanK, t) * D2R, 'YXZ');
    camera.rotation.set(
      (smooth(pitchK, t) + 0.6 * Math.sin(t * 29.0)) * D2R,
      smooth(yawK, t) * D2R,
      smooth(rollK, t) * D2R,
      'YXZ'
    );
    // shadow stays on the ground: hide while airborne/on the wall
    shadow.visible = el < 0.3;
    const sh = smooth(shK, t) * D2R;
    shadow.position.set(-Math.sin(sh) * 0.6, 0.05, -Math.cos(sh) * 0.6);
    shadow.rotation.y = sh;
  }
  update(0);
  return { scene, camera, update };
}
