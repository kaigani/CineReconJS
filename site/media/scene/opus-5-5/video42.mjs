// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video42.
// Continuous overhead (top-down) tracking shot: two blonde figures tumble down a
// stairwell, the camera travels image-right over a cutaway wall into a bedroom,
// the olive-sweater figure (A) pins the pale figure (V) on the bed, then the
// camera rises/tilts toward the back wall, shelf and lamp.
// World: +X = image right, -Z = image up (camera up vector is -Z), Y up.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030302);

  const VFOV = 36;
  const camera = new THREE.PerspectiveCamera(VFOV, width / height, 0.04, 80);
  camera.up.set(0, 0, -1);
  scene.add(camera);

  // ---- letterbox bars (reference is 2.40:1 inside a 16:9 frame) ----
  {
    const lbMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false });
    const dist = 0.1;
    const halfH = dist * Math.tan((VFOV / 2) * D);
    const halfW = halfH * (width / height);
    const barH = 2 * halfH * (93 / 720);
    for (const s of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2.5, barH * 2), lbMat);
      bar.position.set(0, s * halfH, -dist);
      bar.renderOrder = 999;
      bar.frustumCulled = false;
      camera.add(bar);
    }
  }

  // ---- helpers ----
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.88, metalness: 0 }, o));
  const E = (c) => new THREE.MeshBasicMaterial({ color: c });
  function boxMM(x0, x1, y0, y1, z0, z1, mat, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(m);
    return m;
  }
  function cylBetween(a, b, r, mat) {
    const va = new THREE.Vector3(a[0], a[1], a[2]);
    const vb = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    scene.add(m);
    return m;
  }

  // ---- lights (dark, practical-lit look) ----
  scene.add(new THREE.HemisphereLight(0xbfb890, 0x100e08, 0.14));
  const key = new THREE.DirectionalLight(0xffd99a, 0.12);
  key.position.set(-1.5, 6, 2);
  key.target.position.set(0, 0, 0);
  scene.add(key, key.target);
  const bedLight = new THREE.PointLight(0xffc468, 12, 0, 2);
  bedLight.position.set(-0.4, 3.3, 0.4);
  scene.add(bedLight);
  const floorLight = new THREE.PointLight(0xffc070, 4.5, 0, 2);
  floorLight.position.set(-1.6, 2.6, 0.2);
  scene.add(floorLight);
  const stairLight = new THREE.PointLight(0xc8f0b0, 2.4, 0, 2);
  stairLight.position.set(-3.8, 2.2, -1.2);
  scene.add(stairLight);
  const tubeLight = new THREE.PointLight(0xd8ff90, 1.6, 0, 2);
  tubeLight.position.set(-2.6, 1.8, -0.5);
  scene.add(tubeLight);
  const lampLight = new THREE.PointLight(0xffe0a0, 1.6, 0, 2);
  lampLight.position.set(1.85, 1.7, -0.4);
  scene.add(lampLight);

  // ---- environment ----
  const wood = M(0x4a3220);
  const darkWood = M(0x3c2a1a);
  boxMM(-8, 8, -0.2, -0.06, -6, 6, M(0x080705)); // void ground
  boxMM(-3.2, 2.45, -0.05, 0, -1.6, 2.0, wood); // room floor
  boxMM(-4.37, -3.2, -0.05, 0, -0.3, 2.0, M(0x262e24)); // stair landing

  // stairwell: stairs ascend toward image-up (-Z)
  const SX0 = -4.17, SX1 = -3.4;
  const stepMat = M(0x3e463a);
  const riserMat = M(0x525c4c);
  for (let i = 0; i < 9; i++) {
    const z1 = -0.3 - i * 0.255;
    const z0 = z1 - 0.255;
    const h = 0.19 * (i + 1);
    boxMM(SX0, SX1, 0, h, z0, z1, i % 2 ? stepMat : riserMat);
  }
  boxMM(SX0, SX1, 0, 1.71, -3.6, -2.595, stepMat); // top landing
  boxMM(-4.37, SX0, 0, 2.4, -3.6, 1.2, M(0x3e4834)); // left wall
  boxMM(-4.95, -4.37, 0, 2.28, -3.6, 1.2, M(0x3e4a30)); // outer wall block under window
  boxMM(-4.175, -4.165, 1.3, 2.3, -2.2, -0.9, E(0xcfd8cf)); // window glow on left wall face
  boxMM(-4.165, -4.0, 1.24, 1.3, -2.25, -0.85, M(0x8a8a72)); // window sill
  cylBetween([-3.75, 1.9, -2.4], [-4.1, 1.0, 0.5], 0.025, M(0x5a5a48)); // handrail
  boxMM(SX1, -3.2, 0, 2.4, -3.6, -1.4, M(0x52603c)); // right wall (green)
  // fluorescent tubes on the cutaway divider
  cylBetween([-2.947, 2.0, -2.5], [-2.947, 2.0, 1.2], 0.03, E(0xd0e8d4));
  cylBetween([-2.86, 2.0, -0.58], [-2.37, 2.0, -0.58], 0.03, E(0xd8f0e0));
  // dark near-camera beam passing at t~2-3 s
  boxMM(-2.68, -2.6, 2.89, 3.0, -1.5, 0.1, M(0x070706));
  // dark railing rods near camera height (pass at t~3-5 s)
  const rodMat = M(0x0a0a08);
  for (const x of [-1.2, -1.11, -1.06, -1.93]) cylBetween([x, 2.76, -2.0], [x, 2.76, 1.5], 0.018, rodMat);
  cylBetween([-2.2, 2.76, -0.45], [-1.45, 2.76, -0.45], 0.028, rodMat);

  // turntable / amplifier panel on stand
  boxMM(-1.5, -0.8, 0, 0.82, -1.1, -0.7, darkWood);
  boxMM(-1.45, -0.85, 0.82, 0.9, -1.05, -0.75, E(0xd8d8cc));
  const discMat = M(0x0c0c0e);
  for (const [x, r] of [[-0.98, 0.12], [-1.2, 0.06], [-1.35, 0.025]]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 24), discMat);
    d.position.set(x, 0.906, -0.9);
    scene.add(d);
  }
  {
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.014, 16), M(0xb09a40));
    lab.position.set(-0.98, 0.907, -0.9);
    scene.add(lab);
  }

  // bed
  boxMM(-0.55, 2.3, 0, 0.38, -0.3, 1.4, M(0x5a3e2a));
  boxMM(-0.55, 0.15, 0.38, 0.45, 0.3, 1.4, M(0xa8502e)); // orange blanket
  const stripe = M(0x2a7a50);
  for (const z of [0.42, 0.62, 0.85, 1.08]) boxMM(-0.55, 0.15, 0.45, 0.456, z, z + 0.06, stripe);
  boxMM(-0.2, 0.55, 0.38, 0.47, -0.25, 0.75, M(0xb8a878)); // cream sheet
  boxMM(0.45, 1.3, 0.38, 0.52, -0.25, 0.9, M(0x5f7a30)); // green duvet
  boxMM(1.0, 2.3, 0.38, 0.44, -0.15, 1.4, M(0x36601e)); // green fuzzy cover
  boxMM(0.2, 1.1, 0.38, 0.52, -0.32, -0.22, M(0x6a4c34)); // bed rail

  // toy shelf (tall cubby unit), lamp, plate
  boxMM(1.1, 1.75, 0, 1.4, -0.68, -0.32, M(0x5e4430));
  boxMM(1.12, 1.73, 0.68, 0.72, -0.32, -0.3, M(0x4a3424)); // cubby divider edge
  {
    const toy = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), M(0xb02018));
    toy.position.set(1.3, 1.47, -0.45);
    scene.add(toy);
    boxMM(1.5, 1.62, 1.4, 1.5, -0.5, -0.38, M(0x3f8a3a));
    const toy2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xc8b040));
    toy2.position.set(1.45, 1.45, -0.6);
    scene.add(toy2);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.26, 20), M(0x9a8058, { emissive: 0x3a2508 }));
    shade.position.set(1.88, 1.68, -0.68);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), E(0xfff4d0));
    bulb.position.set(1.85, 1.7, -0.55);
    scene.add(bulb);
    boxMM(1.8, 1.96, 0, 1.55, -0.76, -0.6, M(0x4a3626)); // lamp stand
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 24), M(0xd8d4c4));
    plate.position.set(1.55, 1.85, -0.72);
    plate.rotation.x = 60 * D;
    scene.add(plate);
  }
  // back wall, right wall, wall shelf
  boxMM(-3.2, 2.45, 0, 3.6, -1.6, -1.45, M(0x4e4234));
  boxMM(-3.2, 2.45, 0, 0.9, -1.45, -1.43, M(0x2e2318));
  boxMM(2.3, 2.45, 0, 3.6, -1.6, 1.5, M(0x5e5040)); // right wall
  boxMM(-1.1, -0.5, 1.45, 1.48, -1.45, -1.25, M(0xa09880));
  {
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), M(0x7a2a38));
    plant.position.set(-0.8, 1.58, -1.35);
    scene.add(plant);
  }

  // ---- articulated figures ----
  function limb(len, r, mat) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 10), mat);
    g.position.y = -len / 2;
    return g;
  }
  function makeFigure(p) {
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    scene.add(root);
    root.add(new THREE.Mesh(new THREE.BoxGeometry(p.hipW, p.pelH, p.dep), p.legMat));
    const spine = new THREE.Group();
    spine.position.y = p.pelH * 0.3;
    root.add(spine);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(p.torW, p.torL, p.dep), p.topMat);
    torso.position.y = p.torL / 2;
    spine.add(torso);
    const neck = new THREE.Group();
    neck.position.y = p.torL;
    spine.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(p.headR, 16, 12), p.skinMat);
    head.position.y = p.headR + 0.03;
    neck.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(p.headR, 16, 12), p.hairMat);
    hair.scale.set(p.hairS[0], p.hairS[1], p.hairS[2]);
    hair.position.set(0, p.headR + 0.05, p.hairOff !== undefined ? p.hairOff : -p.headR * 0.25);
    neck.add(hair);
    const lh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), p.hairMat);
    lh.scale.set(p.hairW || p.torW * 1.05, p.longHair, p.headR * 0.9);
    lh.position.set(0, p.headR - p.longHair / 2 + 0.05, -p.headR * 0.6);
    neck.add(lh);
    const out = { root, spine, neck };
    for (const side of [1, -1]) {
      const sh = new THREE.Group();
      sh.position.set(side * (p.torW / 2 + p.armR), p.torL - p.armR * 1.2, 0);
      spine.add(sh);
      sh.add(limb(p.ua, p.armR, p.topMat));
      const el = new THREE.Group();
      el.position.y = -p.ua;
      sh.add(el);
      el.add(limb(p.fa, p.armR * 0.9, p.topMat));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(p.armR * 1.1, 10, 8), p.skinMat);
      hand.position.y = -p.fa;
      el.add(hand);
      const hip = new THREE.Group();
      hip.position.set(side * p.hipW * 0.27, -p.pelH * 0.3, 0);
      root.add(hip);
      hip.add(limb(p.th, p.legR, p.legMat));
      const kn = new THREE.Group();
      kn.position.y = -p.th;
      hip.add(kn);
      kn.add(limb(p.sh, p.legR * 0.8, p.legMat));
      boxMM(-p.legR, p.legR, -p.sh - p.legR * 0.6, -p.sh + p.legR * 0.6, -0.04, 0.14, p.footMat, kn);
      const k = side > 0 ? 'l' : 'r';
      out[k + 'Sh'] = sh; out[k + 'El'] = el; out[k + 'Hip'] = hip; out[k + 'Kn'] = kn;
    }
    return out;
  }

  // A: adult, olive sweater, long wavy blonde hair (aggressor)
  const figA = makeFigure({
    hipW: 0.32, pelH: 0.16, dep: 0.2, torL: 0.5, torW: 0.36, headR: 0.105,
    ua: 0.29, fa: 0.27, armR: 0.045, th: 0.44, sh: 0.42, legR: 0.065,
    hairS: [1.75, 1.55, 1.75], hairOff: 0.0, longHair: 0.46, hairW: 0.42,
    topMat: M(0x57542a), legMat: M(0x4c4826), skinMat: M(0xc8a080), hairMat: M(0xd8c898), footMat: M(0x2a2418),
  });
  // V: smaller, cream clothing, pale blonde hair (victim)
  const figV = makeFigure({
    hipW: 0.26, pelH: 0.13, dep: 0.16, torL: 0.4, torW: 0.28, headR: 0.095,
    ua: 0.23, fa: 0.21, armR: 0.038, th: 0.34, sh: 0.33, legR: 0.055,
    hairS: [1.35, 1.15, 1.35], longHair: 0.2,
    topMat: M(0xd2c69e), legMat: M(0xc8bc94), skinMat: M(0xd8b898), hairMat: M(0xe2d8b4), footMat: M(0xc0b490),
  });

  const CH = ['x', 'y', 'z', 'yaw', 'pitch', 'roll', 'spine', 'neck', 'lSh', 'lAb', 'lEl', 'rSh', 'rAb', 'rEl',
    'lHip', 'lHab', 'lKn', 'rHip', 'rHab', 'rKn'];
  const DEF = { x: 0, y: 0.9, z: 0, yaw: 0, pitch: 0, roll: 0, spine: 0, neck: 0, lSh: 0, lAb: 8, lEl: 10, rSh: 0, rAb: 8, rEl: 10,
    lHip: 0, lHab: 4, lKn: 0, rHip: 0, rHab: 4, rKn: 0 };
  const P = (...o) => Object.assign({}, DEF, ...o);

  const A_CRAWL = { y: 0.5, pitch: 65, spine: 10, neck: 10, lHip: 65, rHip: 72, lKn: 95, rKn: 90, lSh: 75, rSh: 95, lEl: 15, rEl: 10, lAb: 10, rAb: 14 };
  const A_KNEEL = { y: 0.78, pitch: 0, neck: 15, lSh: 55, rSh: 55, lAb: 12, rAb: 12, lEl: 25, rEl: 25,
    lHip: 45, rHip: 45, lHab: 22, rHab: 22, lKn: 135, rKn: 135 };
  const V_CRAWL = { y: 0.42, pitch: 70, spine: 5, neck: 15, lHip: 70, rHip: 70, lKn: 92, rKn: 92, lSh: 75, rSh: 75, lEl: 10, rEl: 10 };
  const V_CURL = { pitch: 45, spine: 25, neck: -20, lSh: 150, rSh: 150, lAb: 30, rAb: 30, lEl: 110, rEl: 110, lHip: 100, rHip: 100, lKn: 120, rKn: 120 };
  const V_LIE = { x: -0.22, y: 0.53, z: 0.07, yaw: -90, pitch: -90, lHip: 50, rHip: 55, lHab: 10, rHab: 10, lKn: 105, rKn: 110,
    lSh: 30, rSh: 40, lAb: 15, rAb: 15, lEl: 80, rEl: 70 };

  const AK = [
    [0.00, P({ x: -3.48, y: 1.15, z: -1.30, yaw: 0, pitch: 140, spine: 20, neck: 15, lSh: 160, lAb: 15, lEl: 40, rSh: 165, rAb: 35, rEl: 15, lHip: 40, rHip: 20, lKn: 90, rKn: 60 })],
    [0.54, P({ x: -3.59, y: 0.85, z: -1.12, yaw: 10, pitch: 120, spine: 25, neck: 20, lSh: 150, lAb: 20, lEl: 50, rSh: 170, rAb: 40, rEl: 10, lHip: 50, rHip: 30, lKn: 100, rKn: 80 })],
    [1.08, P(A_CRAWL, { x: -3.73, y: 0.77, z: -0.66, yaw: 50, pitch: 55, lHip: 60, rHip: 50 })],
    [1.58, P(A_CRAWL, { x: -3.74, y: 0.82, z: -0.75, yaw: 75, rSh: 100, rAb: 35 })],
    [2.13, P(A_CRAWL, { x: -3.51, y: 0.83, z: -0.75, yaw: 80, rSh: 95, rAb: 40 })],
    [2.67, P(A_CRAWL, { x: -3.36, y: 0.5, z: -0.72, yaw: 85 })],
    [3.21, P(A_CRAWL, { x: -3.05, y: 0.5, z: -0.60, yaw: 90 })],
    [3.71, P(A_CRAWL, { x: -2.75, z: -0.45, yaw: 90, lSh: 100, rSh: 115 })],
    [4.25, P(A_CRAWL, { x: -2.16, z: 0.10, yaw: 80, lSh: 135, rSh: 100 })],
    [4.80, P(A_CRAWL, { x: -1.88, z: 0.35, yaw: 70 })],
    [5.34, P(A_CRAWL, { x: -1.72, z: 0.32, yaw: 70, lSh: 110, rSh: 120 })],
    [5.88, P({ x: -1.05, y: 0.75, z: -0.05, yaw: 85, pitch: 65, spine: 10, lSh: 150, rSh: 150, lEl: 20, rEl: 20, lHip: 60, rHip: 30, lKn: 80, rKn: 40 })],
    [6.38, P(A_KNEEL, { x: -0.55, z: -0.08, yaw: 95, spine: 48 })],
    [6.92, P(A_KNEEL, { x: -0.50, z: -0.08, yaw: 110, spine: 68, lSh: 85, rSh: 85 })],
    [7.47, P(A_KNEEL, { x: -0.55, z: -0.06, yaw: 110, spine: 54 })],
    [8.01, P(A_KNEEL, { x: -0.57, z: -0.05, yaw: 105, spine: 50 })],
    [8.55, P(A_KNEEL, { x: -0.57, z: -0.06, yaw: 105, spine: 47 })],
    [9.05, P(A_KNEEL, { x: -0.58, z: -0.07, yaw: 105, spine: 42 })],
    [9.59, P(A_KNEEL, { x: -0.58, z: -0.06, yaw: 100, spine: 34 })],
    [10.68, P(A_KNEEL, { x: -0.57, z: -0.05, yaw: 100, spine: 40 })],
    [12.31, P(A_KNEEL, { x: -0.56, z: -0.05, yaw: 100, spine: 42 })],
  ];
  const V_UP = { y: 0.42, pitch: 50, spine: 5, neck: 15, lHip: 50, rHip: 50, lKn: 92, rKn: 92, lSh: 60, rSh: 60, lEl: 10, rEl: 10 };
  const VK = [
    [0.00, P(V_CURL, { x: -4.02, y: 0.45, z: -0.44, yaw: 40 })],
    [0.54, P(V_CURL, { x: -3.88, y: 0.35, z: -0.26, yaw: 60, pitch: 50 })],
    [1.08, P(V_UP, { x: -3.44, y: 1.0, z: -1.09, yaw: 180 })],
    [1.58, P(V_UP, { x: -3.59, y: 1.06, z: -1.16, yaw: 180 })],
    [2.13, P(V_UP, { x: -3.60, y: 1.1, z: -1.22, yaw: 175 })],
    [2.67, P(V_UP, { x: -3.46, y: 1.1, z: -1.25, yaw: 130 })],
    [3.21, P(V_CRAWL, { x: -3.10, y: 0.42, z: -1.00, yaw: 95 })],
    [3.71, P({ x: -2.50, y: 0.55, z: -0.80, yaw: 70, pitch: 35, spine: 15, lHip: 80, rHip: 60, lKn: 110, rKn: 80, lSh: 40, rSh: 60, lEl: 30, rEl: 30 })],
    [4.25, P({ x: -2.20, y: 0.55, z: -0.40, yaw: 70, pitch: 35, spine: 15, lHip: 60, rHip: 80, lKn: 80, rKn: 110, lSh: 60, rSh: 40, lEl: 30, rEl: 30 })],
    [4.80, P(V_CRAWL, { x: -1.75, z: 0.05, yaw: 80 })],
    [5.34, P({ x: -1.35, y: 0.42, z: 0.25, yaw: 20, pitch: 10, spine: 5, lHip: 10, rHip: 10, lKn: 95, rKn: 95, lSh: 60, rSh: 60, lEl: 40, rEl: 40 })],
    [5.88, P({ x: -0.72, y: 0.62, z: 0.14, yaw: -60, pitch: -55, spine: -5, lHip: 70, rHip: 70, lKn: 90, rKn: 90, lSh: 110, rSh: 110, lAb: 30, rAb: 30, lEl: 30, rEl: 30 })],
    [6.38, P(V_LIE)],
    [8.01, P(V_LIE, { neck: 5 })],
    [12.31, P(V_LIE, { neck: 0 })],
  ];

  function samplePose(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    const n = keys.length;
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const [t0, a] = keys[i];
    const [t1, b] = keys[i + 1];
    const u = (t - t0) / (t1 - t0);
    const o = {};
    for (const c of CH) o[c] = a[c] + (b[c] - a[c]) * u;
    return o;
  }
  function applyPose(f, p) {
    f.root.position.set(p.x, p.y, p.z);
    f.root.rotation.set(p.pitch * D, p.yaw * D, p.roll * D, 'YXZ');
    f.spine.rotation.set(p.spine * D, 0, 0);
    f.neck.rotation.set(p.neck * D, 0, 0);
    f.lSh.rotation.set(-p.lSh * D, 0, p.lAb * D);
    f.rSh.rotation.set(-p.rSh * D, 0, -p.rAb * D);
    f.lEl.rotation.set(-p.lEl * D, 0, 0);
    f.rEl.rotation.set(-p.rEl * D, 0, 0);
    f.lHip.rotation.set(-p.lHip * D, 0, p.lHab * D);
    f.rHip.rotation.set(-p.rHip * D, 0, -p.rHab * D);
    f.lKn.rotation.set(p.lKn * D, 0, 0);
    f.rKn.rotation.set(p.rKn * D, 0, 0);
  }

  // ---- camera track: [t, x, y, z, tilt(deg toward -Z from straight down)] ----
  const CK = [
    [0.00, -3.56, 3.95, -0.80, 0],
    [0.54, -3.42, 3.95, -0.80, 0],
    [1.08, -3.23, 3.95, -0.80, 0],
    [1.58, -2.95, 3.95, -0.80, 0],
    [2.13, -2.64, 3.95, -0.80, 0],
    [2.67, -2.36, 3.95, -0.78, 0],
    [3.21, -1.78, 3.95, -0.52, 0],
    [3.71, -1.37, 3.95, -0.34, 0],
    [4.25, -0.87, 3.95, -0.08, 0],
    [4.80, -0.50, 3.95, 0.03, 0],
    [5.34, -0.16, 3.95, -0.05, 0],
    [5.88, 0.03, 3.55, -0.08, 0],
    [6.38, 0.11, 3.25, -0.11, 0],
    [6.92, 0.07, 3.10, -0.12, 0],
    [7.47, 0.02, 2.87, -0.11, 0],
    [8.01, 0.00, 2.75, -0.03, 0],
    [8.55, 0.02, 2.75, -0.03, 0],
    [9.05, 0.04, 2.75, -0.06, 0],
    [9.59, -0.03, 2.87, -0.14, 0],
    [10.14, 0.10, 3.40, 0.00, 6],
    [10.68, 0.45, 4.00, 0.08, 10],
    [11.18, 0.55, 4.00, 0.23, 15],
    [11.72, 0.82, 4.20, -0.05, 15],
    [12.26, 1.50, 4.30, -0.01, 20],
    [12.40, 1.62, 4.32, 0.0, 21],
  ];
  function sampleCam(t) {
    const n = CK.length;
    if (t <= CK[0][0]) return CK[0].slice(1);
    if (t >= CK[n - 1][0]) return CK[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && t > CK[i + 1][0]) i++;
    const k0 = CK[Math.max(0, i - 1)], k1 = CK[i], k2 = CK[i + 1], k3 = CK[Math.min(n - 1, i + 2)];
    const dt = k2[0] - k1[0];
    const u = (t - k1[0]) / dt;
    const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u;
    const h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
    const out = [];
    for (let c = 1; c <= 4; c++) {
      const m1 = (k2[c] - k0[c]) / Math.max(1e-6, k2[0] - k0[0]);
      const m2 = (k3[c] - k1[c]) / Math.max(1e-6, k3[0] - k1[0]);
      out.push(h00 * k1[c] + h10 * dt * m1 + h01 * k2[c] + h11 * dt * m2);
    }
    return out;
  }
  const tgt = new THREE.Vector3();

  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), duration);
    const [cx, cy, cz, tilt] = sampleCam(t);
    camera.position.set(cx, cy, cz);
    camera.up.set(0, 0, -1);
    tgt.set(cx, cy - Math.cos(tilt * D), cz - Math.sin(tilt * D));
    camera.lookAt(tgt);
    camera.updateMatrixWorld(true);
    applyPose(figA, samplePose(AK, t));
    applyPose(figV, samplePose(VK, t));
  }

  camera.updateProjectionMatrix();
  update(0, 0);
  return { scene, camera, update };
}
