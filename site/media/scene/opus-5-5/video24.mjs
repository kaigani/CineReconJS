// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video24.
// Two fighters (A = "Nate": blue-grey shirt; B = "Rafe": black shirt) duel with swords and fists
// on a burning, coin-strewn wooden deck. Proxy humanoids with IK-driven limbs, keyed per shot.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const DUR = duration || 24.024;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120604);
  scene.fog = new THREE.Fog(0x0e0402, 5, 20);
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 200);

  // ---------- deterministic RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(((seed | 0) ^ 0x2545f491) >>> 0);
  const UP = new THREE.Vector3(0, 1, 0);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const SRGB = THREE.SRGBColorSpace;

  // ---------- procedural textures ----------
  function makeTex(data, S, rep) {
    const tx = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(rep, rep);
    tx.magFilter = THREE.LinearFilter;
    tx.minFilter = THREE.LinearMipmapLinearFilter;
    tx.generateMipmaps = true;
    tx.needsUpdate = true;
    return tx;
  }
  function floorTextures() {
    const S = 256, col = new Uint8Array(S * S * 4), emi = new Uint8Array(S * S * 4);
    const plankW = 32, nP = S / plankW;
    const pv = [], po = [];
    for (let i = 0; i < nP; i++) { pv.push(rand() * 30 - 15); po.push(Math.floor(rand() * 256)); }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = Math.floor(x / plankW);
      let v = pv[p] + Math.sin((x * 0.7 + y * 0.05) + p) * 4;
      let r = 52 + v * 0.7, g = 24 + v * 0.35, b = 12 + v * 0.15;
      if (x % plankW < 2 || (y + po[p]) % 128 < 2) { r *= 0.35; g *= 0.35; b *= 0.35; }
      const i = (y * S + x) * 4;
      col[i] = r; col[i + 1] = g; col[i + 2] = b; col[i + 3] = 255;
      emi[i] = 0; emi[i + 1] = 0; emi[i + 2] = 0; emi[i + 3] = 255;
    }
    for (let n = 0; n < 520; n++) {
      const cx = rand() * S, cy = rand() * S, rr = 1.3 + rand() * 1.4, k = 0.15 + rand() * 0.7;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        const x = (Math.floor(cx + dx) + S) % S, y = (Math.floor(cy + dy) + S) % S, i = (y * S + x) * 4;
        col[i] = 150; col[i + 1] = 95; col[i + 2] = 35;
        emi[i] = 255 * k; emi[i + 1] = 140 * k; emi[i + 2] = 30 * k;
      }
    }
    const c = makeTex(col, S, 15), e = makeTex(emi, S, 15);
    if (SRGB) { c.colorSpace = SRGB; e.colorSpace = SRGB; }
    return [c, e];
  }
  const [floorCol, floorEmi] = floorTextures();

  // ---------- environment ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: floorCol, emissiveMap: floorEmi, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.75, metalness: 0.1 }));
  scene.add(floor);

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x170a05, roughness: 0.95 });
  const woodMid = new THREE.MeshStandardMaterial({ color: 0x2e160a, roughness: 0.9 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x3a1c0c, roughness: 0.6, emissive: 0x3a1806, emissiveIntensity: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd09040, roughness: 0.4, metalness: 0.3, emissive: 0xa05010, emissiveIntensity: 0.5 });
  function addBox(w, h, d, x, y, z, mat, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); if (ry) m.rotation.y = ry; scene.add(m); return m;
  }
  // walls and ceiling
  addBox(17, 6, 0.3, 0.5, 3, -7.6, woodDark);
  addBox(17, 6, 0.3, 0.5, 3, 7.6, woodDark);
  addBox(0.3, 6, 15.4, -7.6, 3, 0, woodDark);
  addBox(0.3, 6, 15.4, 8.6, 3, 0, woodDark);
  addBox(17, 0.2, 15.4, 0.5, 5.6, 0, new THREE.MeshStandardMaterial({ color: 0x0e0503, roughness: 1 }));
  // pillars with decorated panels
  const pillars = [[-2.6, -3.3], [-0.9, -5.2], [2.3, -4.6], [-4.8, -4.6], [5.2, -3.6], [-5.2, 3.6], [1.2, 6.2], [7.2, 3.0], [6.8, -1.0], [-3.2, -6.4]];
  for (const [x, z] of pillars) {
    addBox(0.4, 5.4, 0.4, x, 2.7, z, woodMid);
    addBox(0.3, 1.0, 0.05, x, 2.4, z + 0.22, panelMat);
  }
  // back-wall decorated panels
  for (let i = 0; i < 7; i++) addBox(0.6, 1.3, 0.06, -5 + i * 2, 2.6, -7.4, panelMat);
  for (let i = 0; i < 5; i++) addBox(0.06, 1.3, 0.6, -7.4, 2.6, -5 + i * 2.2, panelMat);
  // staircase on the back right, with railing
  for (let i = 0; i < 9; i++) addBox(2.4, 0.2 + i * 0.22, 0.32, 3.2, (0.2 + i * 0.22) / 2, -3.9 - i * 0.32, woodMid);
  addBox(0.08, 1.0, 3.0, 1.95, 1.4, -5.2, woodDark);
  addBox(4.5, 0.08, 0.08, 5.0, 1.0, -3.4, woodDark);
  for (let i = 0; i < 6; i++) addBox(0.06, 1.0, 0.06, 3.0 + i * 0.8, 0.5, -3.4, woodDark);
  // stairs on back left
  for (let i = 0; i < 7; i++) addBox(2.0, 0.2 + i * 0.22, 0.32, -4.2, (0.2 + i * 0.22) / 2, -5.0 - i * 0.32, woodMid);
  // crates with pattern
  const crateTex = (() => {
    const S = 32, d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const on = ((x >> 2) + (y >> 2)) % 2 === 0, i = (y * S + x) * 4;
      d[i] = on ? 170 : 70; d[i + 1] = on ? 90 : 30; d[i + 2] = on ? 40 : 15; d[i + 3] = 255;
    }
    const t = makeTex(d, S, 1); t.magFilter = THREE.NearestFilter; if (SRGB) t.colorSpace = SRGB; return t;
  })();
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, color: 0x4a3028, emissive: 0x200a03, emissiveIntensity: 0.2 });
  addBox(1.0, 0.9, 1.0, -4.0, 0.45, -2.2, crateMat, 0.3);
  addBox(0.9, 0.8, 0.9, -5.2, 0.4, -1.0, crateMat, -0.2);
  addBox(0.8, 0.8, 0.8, -3.6, 1.3, -2.4, crateMat, 0.1);
  addBox(1.0, 0.9, 1.0, 6.5, 0.45, 4.8, crateMat, 0.4);
  // cage / shelving rack (seen at the end, left of frame)
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.5, metalness: 0.4 });
  const rx0 = 3.97, rz0 = 1.56;
  for (const [dx, dz] of [[0, 0], [0.6, 0], [0, 0.7], [0.6, 0.7]]) addBox(0.05, 2.3, 0.05, rx0 + dx, 1.15, rz0 + dz, rackMat);
  for (let i = 0; i < 4; i++) addBox(0.66, 0.04, 0.76, rx0 + 0.3, 0.3 + i * 0.6, rz0 + 0.35, rackMat);
  for (let i = 0; i < 3; i++) addBox(0.4, 0.25, 0.5, rx0 + 0.3, 0.45 + i * 0.6, rz0 + 0.35, woodMid);
  // coin heaps
  const heapMat = new THREE.MeshStandardMaterial({ map: floorCol, emissiveMap: floorEmi, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.5, color: 0xa07040 });
  for (const [x, z, r, h] of [[-1.9, -0.3, 0.8, 0.22], [-0.8, -3.6, 0.7, 0.2]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), heapMat);
    m.scale.set(r, h, r); m.position.set(x, 0, z); scene.add(m);
  }

  // ---------- fire ----------
  const flameGeo = new THREE.ConeGeometry(1, 1, 8, 1, true).translate(0, 0.5, 0);
  const flameOuter = new THREE.MeshBasicMaterial({ color: 0xff5a10, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flameInner = new THREE.MeshBasicMaterial({ color: 0xffc040, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const flames = [];
  function addFire(x, y, z, sx, sz, w, h, n) {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const fx = x + sx * u + (rand() - 0.5) * 0.2, fz = z + sz * u + (rand() - 0.5) * 0.2;
      const hh = h * (0.55 + rand() * 0.45), ww = w * (0.6 + rand() * 0.4);
      const o = new THREE.Mesh(flameGeo, flameOuter); o.position.set(fx, y, fz); scene.add(o);
      const inn = new THREE.Mesh(flameGeo, flameInner); inn.position.set(fx, y, fz); scene.add(inn);
      flames.push({ o, inn, w: ww, h: hh, ph: rand() * 6.28 });
    }
  }
  addFire(-3.0, 0, -7.2, 3, 0, 0.5, 2.2, 6);
  addFire(3.3, 0.9, -5.0, 2.2, 0, 0.35, 1.0, 6);
  addFire(4.8, 0.6, -3.5, 3.5, 0, 0.3, 0.9, 7);
  addFire(5.5, 0, -7.2, 3, 0, 0.5, 2.4, 5);
  addFire(-4.2, 0, -1.3, 0.8, 0.8, 0.7, 2.8, 5);
  addFire(-7.2, 0, -2, 0, 3, 0.6, 2.4, 5);
  addFire(-7.2, 0, 2.5, 0, 3, 0.6, 2.0, 4);
  addFire(8.2, 0, -2.5, 0, 4, 0.6, 2.6, 6);
  addFire(8.2, 0, 3.0, 0, 3, 0.6, 2.2, 4);
  addFire(-2.0, 0, 7.2, 3, 0, 0.6, 2.2, 4);
  addFire(3.5, 0, 7.2, 3, 0, 0.6, 2.4, 4);
  addFire(-4.2, 0.8, -5.6, 1.6, 0, 0.35, 1.0, 4);
  addFire(-0.9, 3.0, -5.0, 0.2, 0, 0.3, 1.2, 2);

  // embers
  const EMB = 220, embBase = [];
  for (let i = 0; i < EMB; i++) embBase.push([rand() * 15 - 7, rand() * 14 - 7, rand() * 4, 0.3 + rand() * 0.6, rand() * 6.28]);
  const embGeo = new THREE.BufferGeometry();
  const embPos = new Float32Array(EMB * 3);
  embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3));
  const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.04, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false;
  scene.add(embers);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xff8a50, 0x1a0803, 0.35));
  const lightDefs = [
    [0.5, 2.2, -5.6, 0xff7a2a, 70], [-4.0, 2.0, -1.4, 0xff6a1a, 45], [6.8, 2.0, -2.2, 0xff6a1a, 45],
    [0.0, 2.6, 6.6, 0xff7020, 35], [0.3, 3.4, 1.4, 0xff9a55, 14], [5.0, 3.0, 1.2, 0xff9050, 18], [-6.5, 2.2, 2.5, 0xff6a1a, 30],
  ];
  const lights = lightDefs.map(([x, y, z, c, I], k) => {
    const l = new THREE.PointLight(c, I * 0.55, 0, 2); l.position.set(x, y, z); scene.add(l);
    return { l, I: I * 0.55, ph: k * 1.7 };
  });

  // ---------- characters ----------
  function makeChar(c) {
    const root = new THREE.Group(); root.rotation.order = 'YXZ'; scene.add(root);
    const mat = (col, r = 0.8) => new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: 0 });
    const shirt = mat(c.shirt), pants = mat(c.pants), skin = mat(c.skin, 0.6), hairM = mat(c.hair), boots = mat(c.boots);
    const add = (geo, m) => { const me = new THREE.Mesh(geo, m); root.add(me); return me; };
    const cyl = (r1, r2, m) => add(new THREE.CylinderGeometry(r1, r2, 1, 10), m);
    const P = {
      pelvis: add(new THREE.BoxGeometry(0.34, 0.2, 0.22), pants),
      torso: add(new THREE.BoxGeometry(0.42, 0.56, 0.25), shirt),
      head: add(new THREE.SphereGeometry(0.115, 16, 12), skin),
      uaL: cyl(0.05, 0.058, shirt), uaR: cyl(0.05, 0.058, shirt),
      faL: cyl(0.04, 0.046, skin), faR: cyl(0.04, 0.046, skin),
      hdL: add(new THREE.SphereGeometry(0.05, 10, 8), skin), hdR: add(new THREE.SphereGeometry(0.05, 10, 8), skin),
      thL: cyl(0.075, 0.09, pants), thR: cyl(0.075, 0.09, pants),
      shL: cyl(0.058, 0.07, pants), shR: cyl(0.058, 0.07, pants),
      ftL: add(new THREE.BoxGeometry(0.11, 0.09, 0.26), boots), ftR: add(new THREE.BoxGeometry(0.11, 0.09, 0.26), boots),
    };
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.68), hairM);
    hair.position.set(0, 0.01, -0.015); hair.rotation.x = -0.7; P.head.add(hair);
    if (c.holster) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.13), mat(0x4a3020)); h.position.set(-0.2, -0.08, 0); P.pelvis.add(h); }
    return { root, P, handR: V(0, 0, 0), handL: V(0, 0, 0) };
  }
  const nate = makeChar({ shirt: 0x4a6280, pants: 0x2c3646, skin: 0x9a6a50, hair: 0x3b2a1d, boots: 0x3a2a1e, holster: true });
  const rafe = makeChar({ shirt: 0x161719, pants: 0x18181b, skin: 0xa07258, hair: 0x241810, boots: 0x101010, holster: false });

  function ik(a, target, l1, l2, pole, outJ, outE) {
    const d = target.clone().sub(a); let L = d.length();
    const dn = L > 1e-6 ? d.divideScalar(L) : V(0, -1, 0);
    L = Math.min(Math.max(L, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.002);
    const x = (L * L + l1 * l1 - l2 * l2) / (2 * L), r = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    const p = pole.clone().addScaledVector(dn, -pole.dot(dn));
    if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
    outJ.copy(a).addScaledVector(dn, x).addScaledVector(p, r);
    outE.copy(a).addScaledVector(dn, L);
  }
  function seg(mesh, p, q) {
    const d = q.clone().sub(p), len = Math.max(d.length(), 1e-4);
    mesh.position.copy(p).add(q).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
    mesh.scale.set(1, len, 1);
  }
  const arr = (a) => V(a[0], a[1], a[2]);
  function applyChar(ch, s, t, ph) {
    const P = s.pose, M = ch.P;
    ch.root.position.set(s.x, s.y, s.z);
    ch.root.rotation.set(s.tilt, s.yaw, 0);
    const br = Math.sin(t * 2.3 + ph) * 0.012;
    const hip = V(0, P.h + br * 0.5, 0);
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.lean, P.twist, P.side, 'YXZ'));
    const pq = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, P.twist * 0.3, 0));
    M.pelvis.position.copy(hip); M.pelvis.quaternion.copy(pq);
    M.torso.position.copy(hip).add(V(0, 0.3, 0).applyQuaternion(tq)); M.torso.quaternion.copy(tq);
    M.head.position.copy(hip).add(V(0, 0.71, 0.03).applyQuaternion(tq)); M.head.quaternion.copy(tq);
    const sL = hip.clone().add(V(0.2, 0.52, 0).applyQuaternion(tq));
    const sR = hip.clone().add(V(-0.2, 0.52, 0).applyQuaternion(tq));
    const j = V(0, 0, 0), e = V(0, 0, 0);
    const hl = arr(P.hL).add(V(0, br, 0)), hr = arr(P.hR).add(V(0, -br, 0));
    ik(sL, hl, 0.3, 0.29, V(0.6, -0.8, -0.3), j, e); seg(M.uaL, sL, j); seg(M.faL, j, e); M.hdL.position.copy(e); ch.handL.copy(e);
    ik(sR, hr, 0.3, 0.29, V(-0.6, -0.8, -0.3), j, e); seg(M.uaR, sR, j); seg(M.faR, j, e); M.hdR.position.copy(e); ch.handR.copy(e);
    const hjL = hip.clone().add(V(0.1, -0.06, 0).applyQuaternion(pq));
    const hjR = hip.clone().add(V(-0.1, -0.06, 0).applyQuaternion(pq));
    ik(hjL, arr(P.fL), 0.46, 0.45, V(0.1, 0.1, 1), j, e); seg(M.thL, hjL, j); seg(M.shL, j, e);
    M.ftL.position.copy(e).add(V(0, -0.03, 0.06)); M.ftL.rotation.set(0, 0, 0);
    ik(hjR, arr(P.fR), 0.46, 0.45, V(-0.1, 0.1, 1), j, e); seg(M.thR, hjR, j); seg(M.shR, j, e);
    M.ftR.position.copy(e).add(V(0, -0.03, 0.06)); M.ftR.rotation.set(0, 0, 0);
  }

  // ---------- swords ----------
  function makeSword() {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xc4c4cc, roughness: 0.3, metalness: 0.3, emissive: 0x2a2018, emissiveIntensity: 1 }));
    blade.position.y = 0.52; g.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), goldMat); guard.position.y = 0.08; g.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x3a2214 })); grip.position.y = 0; g.add(grip);
    scene.add(g); return g;
  }
  const swordN = makeSword(), swordR = makeSword();
  // segments: [t0, t1, mode, floorOffsetLocal[x,z], floorAngle]
  const swordSegN = [[0, 1.45, 'hand'], [1.45, 4.55, 'floor', [0.6, 0.5], 0.7], [4.55, 5.85, 'hand'], [5.85, 12.75, 'floor', [0.7, -0.3], 1.9], [12.75, 20.4, 'hand'], [20.4, 99, 'floor', [0.6, 0.6], 0.4]];
  const swordSegR = [[0, 5.85, 'hand'], [5.85, 12.75, 'floor', [-0.6, 0.4], -0.9], [12.75, 20.4, 'hand'], [20.4, 99, 'floor', [-0.7, 0.3], 2.2]];

  // ---------- poses (character-local: +x = character's left, +z = forward, y up) ----------
  const base = { h: 0.93, lean: 0.05, twist: 0, side: 0, fL: [0.13, 0.08, 0.04], fR: [-0.13, 0.08, -0.04], hL: [0.27, 0.82, 0.05], hR: [-0.27, 0.82, 0.05], sR: [0.2, -0.5, 0.85] };
  const guardP = { h: 0.86, lean: 0.18, twist: 0.15, fL: [0.2, 0.08, 0.3], fR: [-0.2, 0.08, -0.28], hL: [0.12, 1.36, 0.4], hR: [-0.14, 1.3, 0.3] };
  const POSES = {
    stand: {},
    guard: guardP,
    punchL: Object.assign({}, guardP, { twist: -0.35, lean: 0.3, hL: [0.02, 1.42, 0.72] }),
    punchR: Object.assign({}, guardP, { twist: 0.45, lean: 0.3, hR: [0.0, 1.42, 0.74] }),
    armOutL: Object.assign({}, guardP, { twist: 0.35, hL: [0.68, 1.25, 0.1], hR: [-0.15, 1.1, 0.45], sR: [0.3, 0.3, 0.9] }),
    swordReady: { h: 0.82, lean: 0.25, twist: 0.2, fL: [0.22, 0.08, 0.38], fR: [-0.22, 0.08, -0.32], hL: [0.25, 1.0, 0.2], hR: [-0.12, 1.02, 0.45], sR: [0.2, 0.5, 0.85] },
    swordLow: { h: 0.84, lean: 0.3, twist: 0.25, fL: [0.22, 0.08, 0.35], fR: [-0.22, 0.08, -0.3], hL: [0.3, 0.95, 0.15], hR: [-0.25, 0.8, 0.35], sR: [0.55, -0.2, 0.8] },
    swordHigh: { h: 0.84, lean: 0.25, twist: 0.45, fL: [0.2, 0.08, 0.4], fR: [-0.22, 0.08, -0.3], hL: [0.3, 1.1, 0.25], hR: [-0.32, 1.75, -0.05], sR: [0.3, 0.75, 0.6] },
    swordStrike: { h: 0.74, lean: 0.55, twist: -0.25, fL: [0.2, 0.08, 0.55], fR: [-0.2, 0.08, -0.45], hL: [0.3, 0.95, 0.1], hR: [-0.05, 0.95, 0.65], sR: [0.1, -0.45, 0.9] },
    swordVert: { h: 0.84, lean: 0.15, twist: 0.1, fL: [0.2, 0.08, 0.3], fR: [-0.2, 0.08, -0.3], hL: [0.3, 1.0, 0.2], hR: [-0.08, 1.15, 0.38], sR: [0.05, 1, 0.15] },
    lungeSword: { h: 0.66, lean: 0.4, twist: 0.3, fL: [0.18, 0.08, 0.75], fR: [-0.2, 0.08, -0.6], hL: [0.45, 1.05, -0.15], hR: [-0.02, 1.2, 0.75], sR: [0.1, 0.05, 1] },
    lungeWide: { h: 0.64, lean: 0.3, twist: 0.15, fL: [0.35, 0.08, 0.55], fR: [-0.35, 0.08, -0.5], hL: [0.15, 1.15, 0.45], hR: [-0.15, 1.1, 0.45], sR: [0.1, 0.3, 0.95] },
    lungeLow: { h: 0.6, lean: 0.6, twist: 0.2, fL: [0.25, 0.08, 0.6], fR: [-0.3, 0.08, -0.55], hL: [0.15, 0.95, 0.5], hR: [-0.1, 0.9, 0.55], sR: [0.15, -0.2, 1] },
    lungeFist: { h: 0.66, lean: 0.35, twist: 0.2, fL: [0.3, 0.08, 0.55], fR: [-0.3, 0.08, -0.5], hL: [0.1, 1.25, 0.55], hR: [-0.15, 1.15, 0.35] },
    walk: { h: 0.91, lean: 0.08, fL: [0.13, 0.08, 0.28], fR: [-0.13, 0.08, -0.25], hL: [0.27, 0.85, -0.1], hR: [-0.27, 0.85, 0.15] },
    walkSword: { h: 0.9, lean: 0.1, twist: 0.05, fL: [0.13, 0.08, 0.3], fR: [-0.13, 0.08, -0.25], hL: [0.28, 0.85, -0.05], hR: [-0.3, 0.85, 0.15], sR: [0.15, -0.6, 0.8] },
    stumble: { h: 0.8, lean: 0.45, twist: -0.3, side: 0.35, fL: [0.25, 0.08, 0.2], fR: [-0.15, 0.2, -0.45], hL: [0.5, 1.0, 0.1], hR: [-0.5, 1.1, 0.1] },
    lying: { h: 0.93, lean: 0, fL: [0.15, 0.08, 0.05], fR: [-0.12, 0.3, 0.25], hL: [0.35, 1.3, 0.35], hR: [-0.35, 1.25, 0.3] },
    lyingCurl: { h: 0.93, lean: 0.2, fL: [0.15, 0.3, 0.35], fR: [-0.12, 0.15, 0.2], hL: [0.15, 1.2, 0.3], hR: [-0.15, 1.15, 0.35] },
    overPin: { h: 0.88, lean: 0.55, twist: 0.3, fL: [0.2, 0.08, 0.35], fR: [-0.2, 0.08, -0.3], hL: [0.1, 0.85, 0.6], hR: [-0.3, 1.7, 0.2], sR: [0.9, 0.3, -0.2] },
    kneelHigh: { h: 0.52, lean: 0.2, fL: [0.18, 0.08, 0.38], fR: [-0.16, 0.1, -0.5], hL: [0.05, 1.45, 0.35], hR: [-0.05, 1.45, 0.35], sR: [0, 0.3, -0.95] },
    kneelStab: { h: 0.5, lean: 0.45, fL: [0.18, 0.08, 0.38], fR: [-0.16, 0.1, -0.5], hL: [0.04, 0.7, 0.55], hR: [-0.04, 0.72, 0.55], sR: [0, -1, 0.1] },
    crawl: { h: 0.55, lean: 1.15, fL: [0.15, 0.08, 0.25], fR: [-0.15, 0.12, -0.45], hL: [0.25, 0.15, 0.55], hR: [-0.25, 0.2, 0.5] },
    crouchUp: { h: 0.7, lean: 0.7, fL: [0.18, 0.08, 0.3], fR: [-0.18, 0.08, -0.3], hL: [0.3, 0.55, 0.5], hR: [-0.3, 0.55, 0.45] },
    bent: { h: 0.85, lean: 1.2, fL: [0.18, 0.08, 0.15], fR: [-0.18, 0.08, -0.15], hL: [0.18, 0.35, 0.55], hR: [-0.2, 0.3, 0.6] },
    tackle: { h: 0.75, lean: 0.95, fL: [0.15, 0.08, 0.45], fR: [-0.15, 0.15, -0.7], hL: [0.2, 1.0, 0.75], hR: [-0.2, 1.1, 0.75] },
    leanBack: { h: 0.86, lean: -0.35, twist: 0.2, side: 0.1, fL: [0.2, 0.08, 0.25], fR: [-0.2, 0.08, -0.35], hL: [0.3, 1.2, 0.05], hR: [-0.35, 1.3, -0.05] },
    bentHit: { h: 0.75, lean: 0.95, twist: 0.1, fL: [0.2, 0.08, 0.25], fR: [-0.2, 0.08, -0.2], hL: [0.2, 0.9, 0.4], hR: [-0.2, 0.9, 0.4] },
    grabDown: { h: 0.86, lean: 0.45, twist: -0.2, fL: [0.22, 0.08, 0.3], fR: [-0.2, 0.08, -0.3], hL: [0.1, 1.0, 0.6], hR: [-0.1, 1.45, 0.3] },
    headlock: { h: 0.86, lean: 0.2, twist: -0.25, fL: [0.2, 0.08, 0.25], fR: [-0.2, 0.08, -0.25], hL: [0.55, 1.1, 0.05], hR: [-0.5, 1.45, 0.25] },
    struggle: { h: 0.82, lean: 0.35, twist: 0.2, fL: [0.22, 0.08, 0.3], fR: [-0.22, 0.08, -0.3], hL: [0.2, 1.2, 0.35], hR: [-0.62, 1.2, 0.1] },
    armsUp: { h: 0.88, lean: 0.05, twist: -0.2, fL: [0.2, 0.08, 0.2], fR: [-0.2, 0.08, -0.25], hL: [0.15, 1.85, 0.25], hR: [-0.2, 1.5, 0.4] },
    spin: { h: 0.85, lean: 0.35, twist: -0.5, side: -0.2, fL: [0.25, 0.08, 0.3], fR: [-0.2, 0.08, -0.35], hL: [0.5, 1.3, 0.2], hR: [-0.4, 1.0, 0.4] },
    shove: { h: 0.86, lean: 0.3, twist: 0.2, fL: [0.2, 0.08, 0.3], fR: [-0.2, 0.08, -0.3], hL: [0.15, 1.3, 0.55], hR: [-0.05, 1.25, 0.65] },
  };
  for (const k in POSES) POSES[k] = Object.assign({}, base, POSES[k]);

  // ---------- shots (hard cuts) ----------
  const SHOTS = [0, 1.55, 2.62, 3.65, 4.7, 8.85, 9.9, 10.95, 12.0, 13.05, 20.3, 21.4, 22.4, 1e9];
  const shotOf = (t) => { for (let i = 0; i < SHOTS.length - 1; i++) if (t < SHOTS[i + 1]) return i; return SHOTS.length - 2; };

  // keys: [t, cam [px,py,pz, tx,ty,tz, fov], N spec, R spec]
  // character spec: p [x,z] world, or sc [screenX(-1..1), depth m] placed relative to that key's camera;
  // yaw (world), yc (relative to camera heading; 0 = facing away from camera), default = face the other fighter.
  const PI = Math.PI;
  const OS = [0.0, 1.35, 3.6, 0.0, 1.1, 0.3, 45]; // standard over-shoulder framing
  const os = (dx, dy, dz, ty) => [OS[0] + dx, OS[1] + dy, OS[2] + dz, OS[3] + dx, ty === undefined ? OS[4] + dy : ty, OS[5], 45];
  const KEYS = [
    // A: opening over-shoulder, Rafe swings down at Nate, Nate staggers left
    [0.0, os(0.1, 0.05, 0), { sc: [-0.44, 1.7], pose: 'swordLow', yawOff: -0.5 }, { sc: [0.0, 3.0], pose: 'swordHigh' }],
    [0.5, os(0.12, 0.02, 0), { sc: [-0.55, 1.6], pose: 'stumble' }, { sc: [-0.05, 2.8], pose: 'swordStrike' }],
    [1.03, os(0.2, -0.05, 0, 1.0), { sc: [-0.85, 1.4], pose: 'stumble', yawOff: -0.6 }, { sc: [0.23, 4.0], pose: 'walkSword' }],
    [1.5, os(0.22, -0.05, 0, 1.0), { sc: [-0.95, 1.4], pose: 'stumble', yawOff: -0.8 }, { sc: [0.2, 3.8], pose: 'walkSword' }],
    // B1: top-down, Nate on his back, Rafe stands over him with raised sword
    [1.6, [-0.2, 3.3, 2.3, 0.1, 0.2, -0.25, 45], { p: [-0.3, 1.3], y: 0.13, yaw: 0, tilt: -PI / 2, pose: 'lying' }, { p: [0.45, 0.35], yaw: -1.75, pose: 'overPin' }],
    [2.1, [-0.18, 3.25, 2.28, 0.1, 0.2, -0.25, 45], {}, {}],
    [2.6, [-0.15, 3.2, 2.25, 0.1, 0.2, -0.25, 45], { pose: 'lyingCurl' }, { pose: 'kneelHigh' }],
    // B2: top-down rotated, Rafe kneels and stabs the deck, Nate rolled aside
    [2.7, [0.2, 2.7, 2.2, 0.1, 0.1, 0.1, 45], { p: [0.4, 0.35], y: 0.13, yaw: PI / 2, tilt: -PI / 2, pose: 'lyingCurl' }, { p: [1.25, -0.05], yaw: -PI / 2, pose: 'kneelHigh' }],
    [3.14, [0.2, 2.65, 2.15, 0.1, 0.1, 0.1, 45], { p: [0.35, 0.5], pose: 'lying' }, { pose: 'kneelStab' }],
    [3.6, [0.2, 2.6, 2.1, 0.1, 0.1, 0.1, 45], {}, {}],
    // C: low behind Nate getting up, Rafe's legs walking in background
    [3.7, [-0.9, 1.3, 2.9, 0.6, -0.74, -1.2, 45], { sc: [-0.35, 1.3], yc: -1.1, pose: 'crawl' }, { sc: [0.2, 4.2], pose: 'walk' }],
    [4.17, [-0.9, 1.3, 2.9, 0.6, -0.74, -1.2, 45], { pose: 'crouchUp' }, { sc: [0.18, 4.0], pose: 'walkSword' }],
    [4.65, [-0.88, 1.32, 2.9, 0.6, -0.6, -1.2, 45], { pose: 'guard' }, { sc: [0.15, 3.7] }],
    // D: over-shoulder duel, swords lost, fist fight, Nate charges
    [4.75, os(0, 0, 0), { sc: [-0.25, 1.8], pose: 'swordReady', yawOff: -0.6 }, { sc: [0.25, 4.2], pose: 'walkSword' }],
    [5.2, os(0, 0, 0), { sc: [-0.23, 1.8] }, { sc: [0.23, 3.9], pose: 'swordHigh' }],
    [5.75, os(-0.02, 0, -0.02), { sc: [-0.28, 1.8], pose: 'swordStrike' }, { sc: [0.2, 3.5], pose: 'swordStrike' }],
    [6.27, os(-0.05, 0, -0.05), { sc: [-0.31, 1.8], pose: 'guard' }, { sc: [0.25, 3.35], pose: 'guard' }],
    [6.8, os(-0.05, 0, -0.05), {}, { sc: [0.2, 3.3], pose: 'punchL' }],
    [7.3, os(-0.04, 0, -0.06), { sc: [-0.29, 1.8], pose: 'guard' }, { sc: [0.15, 3.3], pose: 'punchL' }],
    [7.85, os(-0.03, 0, -0.08), { sc: [-0.27, 1.85], pose: 'punchR' }, { sc: [0.25, 3.1], pose: 'guard' }],
    [8.34, os(0, 0, -0.1), { sc: [-0.3, 2.0], pose: 'tackle' }, { sc: [0.35, 2.9], pose: 'leanBack' }],
    [8.8, os(0, 0, -0.1), { sc: [-0.15, 2.2] }, { sc: [0.4, 2.9] }],
    // E: higher angle, Nate doubled over, Rafe grabs and strikes down
    [8.9, [0.9, 2.1, 2.4, 0.2, 0.55, -0.3, 45], { sc: [-0.12, 2.6], pose: 'bentHit' }, { sc: [0.15, 3.3], pose: 'grabDown' }],
    [9.38, [0.88, 2.08, 2.38, 0.2, 0.55, -0.3, 45], {}, {}],
    [9.85, [0.85, 2.05, 2.35, 0.2, 0.55, -0.3, 45], {}, { pose: 'punchR' }],
    // F1: close behind Nate, Rafe low on the right
    [9.95, [-0.6, 1.65, 2.8, 0.3, 1.0, 0.0, 45], { sc: [-0.35, 1.4], pose: 'armOutL' }, { sc: [0.25, 2.4], pose: 'lungeFist' }],
    [10.44, [-0.58, 1.65, 2.78, 0.3, 1.0, 0.0, 45], {}, {}],
    [10.9, [-0.55, 1.65, 2.75, 0.3, 1.0, 0.0, 45], { pose: 'headlock' }, { sc: [0.25, 2.0], pose: 'struggle' }],
    // F2: close behind both, grappling side by side, backs to camera
    [11.0, [0.05, 1.75, 2.3, 0.1, 1.25, -0.3, 45], { sc: [-0.25, 1.0], yc: 0, pose: 'headlock' }, { sc: [0.32, 1.2], yc: 0.3, pose: 'struggle' }],
    [11.48, [0.05, 1.75, 2.28, 0.1, 1.25, -0.3, 45], {}, {}],
    [11.95, [0.05, 1.75, 2.25, 0.1, 1.25, -0.3, 45], { pose: 'shove' }, { pose: 'stumble', sc: [0.42, 1.35] }],
    // G: high angle, both bend down to recover swords
    [12.05, [1.1, 2.4, 1.9, 0.0, 0.4, -0.3, 45], { sc: [-0.3, 3.0], yc: -1.4, pose: 'bent' }, { sc: [0.5, 1.6], yc: 1.9, pose: 'crawl' }],
    [12.5, [1.08, 2.38, 1.88, 0.0, 0.4, -0.3, 45], {}, {}],
    [13.0, [1.05, 2.35, 1.85, 0.0, 0.4, -0.3, 45], { pose: 'crouchUp' }, { pose: 'crouchUp' }],
    // H: over-shoulder sword duel
    [13.1, os(0, -0.5, 0, 0.8), { sc: [-0.4, 1.7], pose: 'swordReady', yawOff: -0.6 }, { sc: [0.31, 4.7], pose: 'walkSword' }],
    [13.55, os(0, -0.5, 0, 0.8), {}, { sc: [0.31, 4.6] }],
    [14.1, os(0, -0.2, 0, 1.0), {}, { sc: [0.25, 4.4] }],
    [14.6, os(0, -0.05, 0), { sc: [-0.31, 1.7], pose: 'swordLow' }, { sc: [0.19, 4.2], pose: 'swordHigh' }],
    [15.1, os(0, -0.05, 0), { pose: 'swordVert' }, { sc: [0.22, 3.6], pose: 'swordStrike' }],
    [15.65, os(0, -0.05, 0, 1.05), { sc: [-0.5, 1.5], pose: 'armOutL' }, { sc: [0.27, 3.2], pose: 'lungeLow' }],
    [16.2, os(0, 0, 0), {}, { sc: [0.15, 3.2], pose: 'swordHigh' }],
    [16.7, os(0, 0, 0), { sc: [-0.46, 1.7], pose: 'swordVert' }, { sc: [0.0, 3.0], pose: 'lungeSword' }],
    [17.2, os(0, 0, 0), {}, { sc: [0.15, 3.3], pose: 'swordReady' }],
    [17.7, os(0, -0.03, 0), { sc: [-0.44, 1.7], pose: 'swordLow' }, { sc: [0.1, 3.4], pose: 'lungeWide' }],
    [18.25, os(0, 0, 0), { pose: 'swordReady' }, {}],
    [18.8, os(0, 0.02, 0), { sc: [-0.4, 1.7], pose: 'swordReady' }, { sc: [-0.02, 3.15], pose: 'lungeSword' }],
    [19.3, os(0, 0, 0), {}, { sc: [0.1, 3.3], pose: 'swordReady' }],
    [19.8, os(0, -0.05, 0), { sc: [-0.44, 1.7], pose: 'armOutL' }, { sc: [0.08, 3.1], pose: 'lungeLow' }],
    [20.25, os(0, -0.05, 0), { pose: 'stumble' }, { sc: [0.05, 2.9], pose: 'lungeSword' }],
    // I: whip-pan, Nate spinning away (Rafe off-frame right)
    [20.35, [0.6, 1.5, 2.9, -0.6, 1.0, 0.0, 45], { p: [0.0, 1.1], yaw: -2.4, pose: 'spin' }, { p: [1.7, 0.3], pose: 'guard' }],
    [20.85, [0.5, 1.45, 2.8, -0.4, 0.95, 0.2, 45], {}, {}],
    [21.35, [0.3, 1.45, 2.7, -0.2, 0.95, 0.4, 45], { yaw: -2.0 }, {}],
    // J1: close, behind Nate (dark, left foreground); Rafe faces camera on the right with raised arms
    [21.45, [2.8, 1.6, 1.9, 3.83, 1.4, -0.92, 45], { sc: [-0.75, 0.6], pose: 'guard' }, { sc: [0.62, 1.6], pose: 'armsUp' }],
    [21.9, [2.8, 1.6, 1.9, 3.83, 1.4, -0.92, 45], {}, {}],
    [22.35, [2.8, 1.6, 1.9, 3.83, 1.4, -0.92, 45], { pose: 'punchR' }, { pose: 'guard' }],
    // J2: reverse close-up by the rack: Nate (left, facing camera side) strikes Rafe (right, back to camera)
    [22.45, [6.1, 1.55, 0.6, 3.13, 1.4, 1.04, 45], { sc: [-0.75, 1.35], pose: 'shove' }, { sc: [0.6, 0.95], pose: 'guard' }],
    [22.96, [6.1, 1.55, 0.6, 3.13, 1.4, 1.04, 45], { pose: 'punchR' }, {}],
    [23.5, [6.08, 1.55, 0.61, 3.12, 1.4, 1.05, 45], { sc: [-0.6, 1.3], pose: 'shove' }, { pose: 'stumble' }],
    [24.0, [6.05, 1.55, 0.62, 3.1, 1.4, 1.06, 45], { sc: [-0.45, 1.3], pose: 'shove' }, { sc: [0.65, 0.95], pose: 'guard' }],
  ];

  // resolve keys (inherit within a shot)
  const shotKeys = SHOTS.slice(0, -1).map(() => []);
  let prev = null, prevShot = -1;
  for (const [t, cam, ns, rs] of KEYS) {
    const s = shotOf(t);
    const inherit = s === prevShot && prev;
    let fx = cam[3] - cam[0], fz = cam[5] - cam[2]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    const rx = -fz, rz = fx; // camera right (horizontal)
    const tanH = (width / height) * Math.tan(cam[6] * PI / 360);
    const camYaw = Math.atan2(fx, fz);
    const mk = (spec, old) => {
      const o = Object.assign({ y: 0, tilt: 0, yawOff: 0 }, inherit ? old : {}, spec);
      if ('sc' in spec) {
        const [sx, d] = spec.sc, lat = sx * tanH * d;
        o.p = [cam[0] + fx * d + rx * lat, cam[2] + fz * d + rz * lat];
      }
      if ('yaw' in spec) o.yawExplicit = true;
      else if ('yc' in spec) { o.yaw = camYaw + spec.yc; o.yawExplicit = true; }
      else if (inherit && old.yawExplicit) o.yawExplicit = true;
      else { delete o.yaw; o.yawExplicit = false; }
      if (!('yawOff' in spec)) o.yawOff = inherit ? old.yawOff : 0;
      return o;
    };
    const N = mk(ns, prev && prev.N), R = mk(rs, prev && prev.R);
    for (const [A, B] of [[N, R], [R, N]]) {
      if (!A.yawExplicit) A.yaw = Math.atan2(B.p[0] - A.p[0], B.p[1] - A.p[1]) + A.yawOff;
    }
    const k = { t, cam, N, R };
    shotKeys[s].push(k); prev = k; prevShot = s;
  }

  const lerp = (a, b, u) => a + (b - a) * u;
  const lerpA = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));
  const lerpAng = (a, b, u) => { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return a + d * u; };
  const smooth = (u) => u * u * (3 - 2 * u);
  function lerpPose(a, b, u) {
    const o = {};
    for (const k in a) o[k] = Array.isArray(a[k]) ? lerpA(a[k], b[k], u) : lerp(a[k], b[k], u);
    return o;
  }
  function charState(a, b, u) {
    const pa = POSES[a.pose], pb = POSES[b.pose];
    return {
      x: lerp(a.p[0], b.p[0], u), z: lerp(a.p[1], b.p[1], u), y: lerp(a.y, b.y, u),
      yaw: lerpAng(a.yaw, b.yaw, u), tilt: lerp(a.tilt, b.tilt, u), pose: lerpPose(pa, pb, u),
    };
  }
  function evalKeys(t) {
    const ks = shotKeys[shotOf(t)];
    if (t <= ks[0].t) return [ks[0], ks[0], 0];
    for (let i = 0; i < ks.length - 1; i++) {
      if (t >= ks[i].t && t < ks[i + 1].t) return [ks[i], ks[i + 1], smooth((t - ks[i].t) / (ks[i + 1].t - ks[i].t))];
    }
    const l = ks[ks.length - 1]; return [l, l, 0];
  }

  const tmpQ = new THREE.Quaternion();
  function placeSword(sw, segs, ch, st, t) {
    let sg = segs[segs.length - 1];
    for (const s of segs) if (t >= s[0] && t < s[1]) { sg = s; break; }
    if (sg[2] === 'hand') {
      ch.root.updateMatrixWorld(true);
      const hw = ch.root.localToWorld(ch.handR.clone());
      const dir = arr(st.pose.sR).normalize().applyQuaternion(ch.root.quaternion);
      sw.position.copy(hw);
      sw.quaternion.setFromUnitVectors(UP, dir);
    } else {
      const off = sg[3], ang = sg[4], c = Math.cos(st.yaw), s = Math.sin(st.yaw);
      // local (x,z) rotated by yaw: world = (x c + z s, -x s + z c)
      const wx = st.x + off[0] * c + off[1] * s, wz = st.z - off[0] * s + off[1] * c;
      sw.position.set(wx, 0.03, wz);
      const a = ang + st.yaw;
      sw.quaternion.setFromUnitVectors(UP, V(Math.cos(a), 0, Math.sin(a)));
    }
  }

  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), DUR);
    const [a, b, u] = evalKeys(t);
    const c = lerpA(a.cam, b.cam, u);
    const sh = 0.008;
    camera.position.set(c[0] + Math.sin(t * 3.1) * sh, c[1] + Math.sin(t * 2.3 + 1) * sh, c[2] + Math.sin(t * 1.7 + 2) * sh);
    camera.fov = c[6]; camera.aspect = width / height; camera.updateProjectionMatrix();
    camera.lookAt(c[3], c[4], c[5]);

    const sN = charState(a.N, b.N, u), sR = charState(a.R, b.R, u);
    applyChar(nate, sN, t, 0.0);
    applyChar(rafe, sR, t, 1.3);
    placeSword(swordN, swordSegN, nate, sN, t);
    placeSword(swordR, swordSegR, rafe, sR, t);

    for (const f of flames) {
      const s = 1 + 0.22 * Math.sin(t * 8 + f.ph) + 0.1 * Math.sin(t * 13.7 + f.ph * 2);
      const w = f.w * (1 + 0.06 * Math.sin(t * 11 + f.ph));
      f.o.scale.set(w, f.h * s, w);
      f.inn.scale.set(w * 0.55, f.h * s * 0.65, w * 0.55);
    }
    for (const L of lights) L.l.intensity = L.I * (1 + 0.12 * Math.sin(t * 9 + L.ph) + 0.06 * Math.sin(t * 17 + L.ph * 3));
    for (let i = 0; i < EMB; i++) {
      const e = embBase[i];
      const y = (e[2] + t * e[3]) % 4.5;
      embPos[i * 3] = e[0] + Math.sin(t * 0.8 + e[4]) * 0.3;
      embPos[i * 3 + 1] = y;
      embPos[i * 3 + 2] = e[1] + Math.cos(t * 0.6 + e[4]) * 0.3;
    }
    embGeo.attributes.position.needsUpdate = true;
  }

  update(0, 0);
  return { scene, camera, update };
}
