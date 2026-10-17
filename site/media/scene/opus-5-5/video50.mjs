// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video50.
// Single continuous over-the-shoulder shot: bald warrior (foreground, back to camera,
// axe on back, spear in right hand), an archer drawing a bow ahead of him, and a
// mounted big-cat beast with rider that circles to image-right and then turns to face
// the camera. The camera yaws right ~35 degrees following the beast.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121a1e);
  scene.fog = new THREE.Fog(0x1e2a2c, 20, 65);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 250);
  camera.rotation.order = 'YXZ';

  // ---------- deterministic RNG ----------
  let rs = (seed >>> 0) || 12345;
  function rnd() {
    rs |= 0; rs = (rs + 0x6D2B79F5) | 0;
    let x = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- helpers ----------
  const matCache = {};
  function mat(c, e) {
    const k = c + '_' + (e || 0);
    if (!matCache[k]) matCache[k] = new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
    return matCache[k];
  }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function sph(r, m) { return new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); }
  function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m); }
  const UPV = new THREE.Vector3(0, 1, 0);
  function limb(r, m) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 1, 10), m); }
  const _d = new THREE.Vector3();
  function setLimb(mesh, a, b) {
    _d.subVectors(b, a);
    const len = Math.max(_d.length(), 1e-4);
    mesh.position.copy(a).addScaledVector(_d, 0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(UPV, _d.normalize());
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // monotone cubic keyframe track
  function track(keys) {
    const n = keys.length, ts = keys.map(k => k[0]), vs = keys.map(k => k[1]);
    const dl = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) dl.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
    for (let i = 1; i < n - 1; i++) m[i] = dl[i - 1] * dl[i] <= 0 ? 0 : (dl[i - 1] + dl[i]) / 2;
    m[0] = 0; m[n - 1] = 0;
    for (let i = 0; i < n - 1; i++) {
      if (dl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / dl[i], b = m[i + 1] / dl[i], s = a * a + b * b;
      if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * dl[i]; m[i + 1] = tau * b * dl[i]; }
    }
    return function (t) {
      if (t <= ts[0]) return vs[0];
      if (t >= ts[n - 1]) return vs[n - 1];
      let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }
  const smooth = (a, b, t) => { const x = Math.min(Math.max((t - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); };

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x9ab0c0, 0x3a4a34, 1.7));
  const key = new THREE.DirectionalLight(0xffd2aa, 1.3);
  key.position.set(-6, 6, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9aacc8, 0.7);
  fill.position.set(7, 6, -6); scene.add(fill);
  const amb = new THREE.AmbientLight(0x404850, 0.8); scene.add(amb);

  // ---------- environment ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x40583c));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(7.5, 48), mat(0x5a7a5e));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(2.5, 0.01, -2.5); scene.add(plaza);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.05, 6, 48), mat(0x6a2a24));
  ring.rotation.x = -Math.PI / 2; ring.position.set(4.7, 0.03, -3.2); scene.add(ring);
  // grass strip in front of the gate
  const grass = box(14, 0.05, 6, mat(0x557a38)); grass.position.set(4, 0.02, -12); scene.add(grass);

  // stone gate with glowing wooden stakes
  const stone = mat(0x6a6a52), stoneDark = mat(0x45473a);
  const gate = new THREE.Group(); gate.position.set(4.25, 0, -17.8); scene.add(gate);
  const pL = box(0.9, 4.8, 1.0, stone); pL.position.set(-4.75, 2.4, 0); gate.add(pL);
  const pR = box(0.9, 4.8, 1.0, stone); pR.position.set(4.75, 2.4, 0); gate.add(pR);
  const lintel = box(10.6, 0.7, 1.1, stone); lintel.position.set(0, 4.55, 0); gate.add(lintel);
  const leftWall = box(3.4, 4.2, 0.6, stoneDark); leftWall.position.set(-2.6, 2.1, -0.2); gate.add(leftWall);
  const stakes = box(6.0, 3.9, 0.3, mat(0x8a4a1c, 0x5a2408)); stakes.position.set(1.7, 1.95, -0.1); gate.add(stakes);
  const wallL = box(9, 3.6, 0.8, stoneDark); wallL.position.set(-9.5, 1.8, 0.2); gate.add(wallL);
  const torch = sph(0.18, mat(0xffa040, 0xff8020)); torch.position.set(4.2, 2.1, 0.7); gate.add(torch);
  const torchLight = new THREE.PointLight(0xff8a3a, 6, 18, 1.5); torchLight.position.set(4.25 + 3.0, 2.2, -16.5); scene.add(torchLight);
  const gateLight = new THREE.PointLight(0xff8a3a, 4, 14, 1.5); gateLight.position.set(5.5, 2.0, -16.4); scene.add(gateLight);

  // crates and barrel left of path
  const crateM = mat(0x4a3020);
  const c1 = box(1.0, 0.7, 0.7, crateM); c1.position.set(-2.8, 0.35, -10.0); scene.add(c1);
  const c2 = box(0.9, 0.6, 0.8, crateM); c2.position.set(-3.9, 0.3, -9.3); scene.add(c2);
  const barrel = cyl(0.35, 0.35, 0.85, mat(0x2e2a26)); barrel.position.set(-1.3, 0.43, -10.4); scene.add(barrel);

  // huge root-covered tree/rock mass on the right
  const greenA = mat(0x3c4e46), greenB = mat(0x485c52), greenDark = mat(0x222e2a);
  const massBack = box(4, 16, 22, greenDark); massBack.position.set(16, 8, -8); massBack.rotation.y = -0.35; scene.add(massBack);
  const trunks = [[11.0, -15.5, 2.2], [13.2, -11.0, 2.0], [14.0, -6.5, 2.4], [13.6, -2.0, 2.0], [12.8, 2.5, 1.8]];
  trunks.forEach((p, i) => {
    const c = cyl(p[2] * 0.8, p[2], 16, i % 2 ? greenA : greenB, 10);
    c.position.set(p[0], 8, p[1]); scene.add(c);
  });

  // red-leaved trees (canopy proxies)
  const redM = mat(0x8a1a2a, 0x1a0306), trunkM = mat(0x2a1a18);
  const trees = [[-3, 7.5, -7, 3.5], [1.5, 8.5, -11, 4], [-7, 6.5, -4, 3.5], [8, 10, -24, 4.5], [13, 10.5, -21, 4], [-6, 8, -15, 4.5], [4, 10, -13, 3.0]];
  trees.forEach(p => {
    const s = sph(p[3], redM); s.position.set(p[0], p[1], p[2]); s.scale.set(1.2, 0.75, 1.0); scene.add(s);
  });

  // red mushroom cluster
  const mushM = mat(0x9a2a24, 0x1a0402);
  for (let i = 0; i < 9; i++) {
    const h = 0.1 + rnd() * 0.14;
    const m = cyl(0.045 + rnd() * 0.03, 0.03, h, mushM, 8);
    m.position.set(4.9 + (rnd() - 0.5) * 2.2, h / 2, -2.9 + (rnd() - 0.5) * 1.4);
    scene.add(m);
  }

  // ---------- Kratos-like warrior (local forward -z, right +x) ----------
  const skin = mat(0xc8a28a), leather = mat(0x4a3024), steel = mat(0x9aa2aa), wood = mat(0x5a2a1c);
  const kratos = new THREE.Group(); scene.add(kratos);
  const kLegL = box(0.19, 0.85, 0.22, leather); kLegL.position.set(-0.13, 0.43, 0); kratos.add(kLegL);
  const kLegR = box(0.19, 0.85, 0.22, leather); kLegR.position.set(0.13, 0.43, 0); kratos.add(kLegR);
  const kSkirt = cyl(0.27, 0.33, 0.35, leather); kSkirt.position.set(0, 0.85, 0); kratos.add(kSkirt);
  const kBelt = box(0.52, 0.18, 0.36, mat(0x5a3420)); kBelt.position.set(0, 1.06, 0); kratos.add(kBelt);
  const kTorso = box(0.5, 0.46, 0.32, skin); kTorso.position.set(0, 1.29, 0); kratos.add(kTorso);
  const kDeltL = sph(0.11, skin); kDeltL.position.set(-0.25, 1.46, 0); kratos.add(kDeltL);
  const kDeltR = sph(0.11, skin); kDeltR.position.set(0.25, 1.46, 0); kratos.add(kDeltR);
  const kTrap = box(0.3, 0.1, 0.22, skin); kTrap.position.set(0, 1.53, 0); kratos.add(kTrap);
  const kNeck = cyl(0.075, 0.09, 0.1, skin); kNeck.position.set(0, 1.57, -0.01); kratos.add(kNeck);
  const kHead = sph(0.095, skin); kHead.position.set(0, 1.69, -0.02); kHead.scale.set(1, 1.12, 1.08); kratos.add(kHead);
  const kUpL = limb(0.06, skin), kFoL = limb(0.055, skin), kUpR = limb(0.06, skin), kFoR = limb(0.055, leather);
  kratos.add(kUpL, kFoL, kUpR, kFoR);
  // axe strapped on back
  const axeHandle = limb(0.025, wood); kratos.add(axeHandle);
  setLimb(axeHandle, V(0.2, 1.62, 0.2), V(0.33, 0.85, 0.2));
  const axeBlade = box(0.2, 0.26, 0.035, steel); axeBlade.position.set(0.25, 1.42, 0.23); axeBlade.rotation.z = -0.25; kratos.add(axeBlade);
  const strap = limb(0.02, leather); kratos.add(strap);
  setLimb(strap, V(-0.16, 1.54, 0.17), V(0.22, 1.2, 0.18));
  // spear held in right hand (positioned in update)
  const spear = new THREE.Group(); kratos.add(spear);
  const spearShaft = cyl(0.015, 0.015, 2.2, mat(0x6a5a48), 6); spearShaft.rotation.x = -Math.PI / 2; spearShaft.position.z = -0.6; spear.add(spearShaft);
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 6), steel); spearTip.rotation.x = -Math.PI / 2; spearTip.position.z = -1.8; spear.add(spearTip);
  const cloth = box(0.09, 0.5, 0.012, mat(0x7a1020)); kratos.add(cloth);

  // ---------- archer (local forward -z) ----------
  const aCloth = mat(0x56686a), aSkirt = mat(0x44585c), aHair = mat(0x1e1c1c), aArm = mat(0x667270), aSkin = mat(0xa88a76);
  const archer = new THREE.Group(); scene.add(archer);
  const aLegL = box(0.12, 0.8, 0.13, mat(0x3e4a4e)); aLegL.position.set(-0.1, 0.4, 0.04); aLegL.rotation.x = -0.1; archer.add(aLegL);
  const aLegR = box(0.12, 0.8, 0.13, mat(0x3e4a4e)); aLegR.position.set(0.1, 0.4, -0.04); aLegR.rotation.x = 0.1; archer.add(aLegR);
  const aSk = cyl(0.17, 0.27, 0.42, aSkirt); aSk.position.set(0, 0.86, 0); archer.add(aSk);
  const aTorso = box(0.33, 0.44, 0.2, aCloth); aTorso.position.set(0, 1.28, 0); archer.add(aTorso);
  const aHead = sph(0.1, aSkin); aHead.position.set(0, 1.58, -0.01); archer.add(aHead);
  const aHairM = box(0.22, 0.55, 0.07, aHair); aHairM.position.set(0, 1.35, 0.1); archer.add(aHairM);
  const aHairTop = sph(0.11, aHair); aHairTop.position.set(0, 1.6, 0.02); archer.add(aHairTop);
  const aim = V(Math.sin(40 * D2R), 0.03, -Math.cos(40 * D2R)).normalize();
  const aSR = V(0.17, 1.42, 0), aSL = V(-0.17, 1.42, 0);
  const aHR = aSR.clone().addScaledVector(aim, 0.62);
  const anchor = V(0.0, 1.5, -0.08);
  const aEL = anchor.clone().addScaledVector(aim, -0.4);
  const aArmR = limb(0.04, aArm); setLimb(aArmR, aSR, aHR); archer.add(aArmR);
  const aUpL = limb(0.045, aArm); setLimb(aUpL, aSL, aEL); archer.add(aUpL);
  const aFoL = limb(0.04, aArm); setLimb(aFoL, aEL, anchor); archer.add(aFoL);
  const bowM = mat(0x5a5040);
  const bowUp = limb(0.018, bowM); setLimb(bowUp, aHR, aHR.clone().add(V(0.0, 0.68, 0.05))); archer.add(bowUp);
  const bowLo = limb(0.018, bowM); setLimb(bowLo, aHR, aHR.clone().add(V(0.0, -0.68, 0.05))); archer.add(bowLo);
  const strM = mat(0xb0a890);
  const strUp = limb(0.004, strM); setLimb(strUp, aHR.clone().add(V(0, 0.68, 0.05)), anchor); archer.add(strUp);
  const strLo = limb(0.004, strM); setLimb(strLo, aHR.clone().add(V(0, -0.68, 0.05)), anchor); archer.add(strLo);
  const arrow = limb(0.006, mat(0x6a6050)); setLimb(arrow, anchor, aHR.clone().addScaledVector(aim, 0.12)); archer.add(arrow);

  // ---------- beast with rider (local forward +z, beast's left = +x) ----------
  const bodyM = mat(0xb6aa9e), goldM = mat(0xa8843a), armorM = mat(0x6e5e3c), legM = mat(0x6a5e54), hornM = mat(0x6a5030);
  const beast = new THREE.Group(); scene.add(beast);
  const bBody = new THREE.Group(); beast.add(bBody);
  const torsoB = sph(0.5, bodyM); torsoB.scale.set(0.95, 0.92, 2.0); torsoB.position.set(0, 1.0, -0.1); bBody.add(torsoB);
  const chestB = sph(0.5, bodyM); chestB.scale.set(1.08, 1.12, 1.0); chestB.position.set(0, 1.06, 0.6); bBody.add(chestB);
  const headB = box(0.7, 0.64, 0.6, goldM); headB.position.set(0, 1.0, 1.3); bBody.add(headB);
  const snoutB = box(0.46, 0.3, 0.3, mat(0x8a6a32)); snoutB.position.set(0, 0.78, 1.58); bBody.add(snoutB);
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 8), hornM); hornL.position.set(0.32, 1.38, 1.15); hornL.rotation.set(-0.9, 0, -0.6); bBody.add(hornL);
  const hornR = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 8), hornM); hornR.position.set(-0.32, 1.38, 1.15); hornR.rotation.set(-0.9, 0, 0.6); bBody.add(hornR);
  const saddle = box(0.9, 0.2, 1.3, armorM); saddle.position.set(0, 1.45, 0.1); bBody.add(saddle);
  for (let i = 0; i < 4; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), goldM);
    sp.position.set((i % 2 ? 0.25 : -0.25), 1.62, -0.55 + i * 0.35); bBody.add(sp);
  }
  const legs = [];
  [[0.33, 0.72], [-0.33, 0.72], [0.33, -0.72], [-0.33, -0.72]].forEach(p => {
    const g = new THREE.Group(); g.position.set(p[0], 0.78, p[1]); bBody.add(g);
    const lg = cyl(0.17, 0.13, 0.74, legM, 10); lg.position.y = -0.37; g.add(lg);
    const paw = box(0.24, 0.08, 0.3, legM); paw.position.set(0, -0.74, 0.05); g.add(paw);
    legs.push(g);
  });
  const tail = new THREE.Group(); tail.position.set(0, 1.2, -0.98); bBody.add(tail);
  const tailM = cyl(0.04, 0.07, 1.25, bodyM, 8); tailM.rotation.x = Math.PI / 2; tailM.position.z = -0.62; tail.add(tailM);
  const tuft = sph(0.09, mat(0x6a5a48)); tuft.position.z = -1.25; tail.add(tuft);
  // rider
  const rider = new THREE.Group(); rider.position.set(0, 1.52, 0.3); bBody.add(rider);
  const shirt = mat(0xc8c8cc), pants = mat(0x2a2a30), rSkin = mat(0xb08068);
  const rTorso = box(0.34, 0.45, 0.22, shirt); rTorso.position.set(0, 0.36, 0); rider.add(rTorso);
  const rHead = sph(0.1, rSkin); rHead.position.set(0, 0.72, 0.02); rider.add(rHead);
  const rHair = sph(0.095, mat(0x3a2a20)); rHair.position.set(0, 0.76, -0.02); rider.add(rHair);
  const rThL = box(0.14, 0.5, 0.16, pants); rThL.position.set(0.36, 0.0, 0.12); rThL.rotation.z = 0.15; rider.add(rThL);
  const rThR = box(0.14, 0.5, 0.16, pants); rThR.position.set(-0.36, 0.0, 0.12); rThR.rotation.z = -0.15; rider.add(rThR);
  const rArmL = limb(0.04, shirt), rArmR = limb(0.04, shirt); rider.add(rArmL, rArmR);

  // ---------- timelines (observed sample times) ----------
  const T = [0.0, 0.7007, 1.38472, 2.08542, 2.78612, 3.47013, 4.17083, 4.87153, 5.57223, 6.25625, 6.95695, 7.65765,
    8.34167, 9.04237, 9.74307, 10.42708, 11.12778, 11.82848, 12.52918, 13.2132, 13.9139, 14.6146, 15.29862, 15.99932];
  const psiV = [0, -3.2, -5.0, -4.4, -2.6, 0.0, 2.7, 6.2, 10.5, 15.0, 18.0, 22.7, 25.8, 26.6, 28.9, 33.4, 36.3, 36.3, 35.6, 34.1, 34.1, 34.1, 33.4, 34.0];
  const kTanV = [-0.404, -0.364, -0.351, -0.364, -0.364, -0.391, -0.364, -0.175, -0.108, -0.162, -0.189, -0.202,
    -0.297, -0.297, -0.31, -0.35, -0.391, -0.418, -0.418, -0.364, -0.351, -0.377, -0.404, -0.445];
  const camPsi = track(T.map((t, i) => [t, psiV[i]]));
  const camK = track(T.map((t, i) => [t, kTanV[i]]));
  const camD = track([[0, 1.2], [4.17, 1.2], [4.87, 1.35], [5.57, 1.45], [10.0, 1.45], [11.13, 1.35], [11.83, 1.3], [14.6, 1.3], [15.3, 1.22], [16.0, 0.95]]);
  const camP = track([[0, -2.7], [14.6, -2.7], [15.3, -3.4], [16.0, -7.0]]);
  const camH = track([[0, 1.53], [16, 1.53]]);

  const archX = track([[0, 0.9], [0.7007, 0.84], [1.385, 0.79], [2.786, 0.69], [4.171, 0.62], [4.872, 0.55], [5.572, 0.45], [6.5, 0.32], [16, 0.3]]);
  const beastX = track([[0, 2.87], [2.085, 2.88], [3.47, 2.92], [4.171, 2.96], [5.572, 3.45], [7.658, 4.36], [10.427, 5.54], [11.828, 6.64], [12.529, 7.32], [14.615, 7.09], [16.0, 6.36]]);
  const beastZ = track([[0, -6.45], [2.085, -6.42], [3.47, -6.36], [4.171, -6.32], [5.572, -5.75], [7.658, -4.58], [10.427, -3.84], [11.828, -4.11], [12.529, -4.31], [14.615, -4.2], [16.0, -3.97]]);
  const beastBeta = track([[0, -20], [0.7, -18], [1.385, -12], [2.085, 0], [2.786, 30], [3.47, 55], [4.171, 72], [4.872, 82], [5.572, 85], [9.743, 85], [10.427, 72], [11.128, 50], [11.828, 32], [12.529, 15], [13.213, 6], [16, 5]]);
  const walkW = track([[0, 0], [2.0, 0], [2.6, 0.55], [4.3, 1.0], [12.3, 0.9], [13.2, 0.45], [14.6, 0.55], [16, 0.6]]);
  const spearUp = (t) => smooth(6.3, 8.2, t);
  const riderGesture = track([[0, 0], [13.0, 0], [13.9, 1], [15.0, 1], [16, 0.6]]);

  const shR = V(0.25, 1.45, 0), shL = V(-0.25, 1.45, 0);
  const elR = V(0, 0, 0), hR = V(0, 0, 0), dirS = V(0, 0, 0);
  const dirPre = V(0.35, 0.06, -1).normalize(), dirPost = V(0.25, 0.12, -1).normalize();
  const hPre = V(0.36, 0.98, -0.26), hPost = V(0.38, 1.2, -0.3);
  const elPre = V(0.33, 1.17, -0.02), elPost = V(0.36, 1.18, 0.02);
  const lookTmp = new THREE.Object3D();

  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), duration);

    // camera rig: third-person orbit around the warrior
    const psi = camPsi(t) * D2R, D = camD(t), L = -camK(t) * D, H = camH(t), pitch = camP(t) * D2R;
    const fx = Math.sin(psi), fz = -Math.cos(psi), rx = Math.cos(psi), rz = Math.sin(psi);
    camera.position.set(rx * L - fx * D, H, rz * L - fz * D);
    camera.rotation.set(pitch, -psi, 0);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // warrior: faces the camera's look direction
    kratos.position.set(0, 0, 0);
    kratos.rotation.y = -psi;
    const breath = Math.sin(t * 2 * Math.PI * 0.3);
    kTorso.scale.set(1 + 0.01 * breath, 1, 1 + 0.015 * breath);
    const u = spearUp(t);
    hR.lerpVectors(hPre, hPost, u);
    elR.lerpVectors(elPre, elPost, u);
    dirS.lerpVectors(dirPre, dirPost, u).normalize();
    setLimb(kUpR, shR, elR); setLimb(kFoR, elR, hR);
    setLimb(kUpL, shL, V(-0.33, 1.17, 0.02)); setLimb(kFoL, V(-0.33, 1.17, 0.02), V(-0.36, 0.95, -0.14));
    spear.position.copy(hR);
    lookTmp.position.set(0, 0, 0);
    lookTmp.lookAt(dirS.x, dirS.y, dirS.z); // +z toward dir
    spear.quaternion.copy(lookTmp.quaternion);
    spear.rotateY(Math.PI); // local -z toward dir
    spear.position.addScaledVector(dirS, 0.0);
    cloth.position.set(hR.x + dirS.x * 0.12, hR.y + dirS.y * 0.12 - 0.26, hR.z + dirS.z * 0.12);
    cloth.rotation.set(0, Math.atan2(dirS.x, dirS.z), 0.04 * Math.sin(t * 1.7));

    // beast and rider
    const bx = beastX(t), bz = beastZ(t);
    const phiFC = Math.atan2(camera.position.x - bx, camera.position.z - bz);
    const phi = phiFC + beastBeta(t) * D2R;
    const w = walkW(t);
    const ph = 2 * Math.PI * 0.85 * t;
    beast.position.set(bx, 0, bz);
    beast.rotation.y = phi;
    bBody.position.y = 0.03 * w * Math.abs(Math.sin(ph));
    const A = 0.42 * w;
    legs[0].rotation.x = A * Math.sin(ph);
    legs[3].rotation.x = A * Math.sin(ph);
    legs[1].rotation.x = A * Math.sin(ph + Math.PI);
    legs[2].rotation.x = A * Math.sin(ph + Math.PI);
    tail.rotation.set(-0.75 + 0.08 * Math.sin(t * 1.9), 0.25 * Math.sin(t * 1.3), 0);
    headB.rotation.y = 0.08 * Math.sin(t * 0.9);
    // rider arms
    const g = riderGesture(t);
    setLimb(rArmL, V(0.19, 0.55, 0), V(0.16, 0.28, 0.3));
    const handR = V(-0.16 + (-0.45) * g, 0.28 + 0.27 * g, 0.3 - 0.15 * g);
    setLimb(rArmR, V(-0.19, 0.55, 0), handR);
    rider.rotation.x = 0.05 * Math.sin(ph) * w + 0.12 * smooth(15.0, 16.0, t);

    // archer: holds full draw, slowly sidesteps left, tracks the rider
    const ax = archX(t), az = -2.5;
    archer.position.set(ax, 0, az);
    const aimBearing = Math.atan2(bx - ax, -(bz - az));
    const bodyBearing = aimBearing - 40 * D2R;
    archer.rotation.y = -bodyBearing;
    aTorso.scale.y = 1 + 0.01 * Math.sin(t * 2.2);
  }

  update(0, 0);
  return { scene, camera, update };
}
