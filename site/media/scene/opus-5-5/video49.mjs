// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video49.
// First-person walk up a sloped lane to a double wooden gate (with red "B" mark),
// pushing through the gate, then advancing on a crate stack in a courtyard while
// switching knife -> grenade -> throw -> rifle.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const G = 2.0;      // upper (gate / courtyard) ground level
  const EYE = 1.2;    // eye height above ground (scene units)

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9d8e3);
  const camera = new THREE.PerspectiveCamera(74, width / height, 0.03, 600);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xe8eff5, 0x8a7a60, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
  sun.position.set(35, 60, 28);
  scene.add(sun);
  scene.add(sun.target);

  const matCache = {};
  const M = (hex) => matCache[hex] || (matCache[hex] = new THREE.MeshLambertMaterial({ color: hex }));
  function boxMM(x0, x1, y0, y1, z0, z1, hex, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M(hex));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(m);
    return m;
  }
  function cylY(r, y0, y1, hex, x, z, parent, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg || 28), M(hex));
    m.position.set(x, (y0 + y1) / 2, z);
    (parent || scene).add(m);
    return m;
  }

  const SAND = 0xc2b394, SAND2 = 0xb8a888, BLUE = 0x7a8ca6, DARK = 0x3e3934;

  // ---------------- sky dome ----------------
  {
    const g = new THREE.SphereGeometry(450, 32, 16);
    const pos = g.attributes.position;
    const cols = [];
    const top = new THREE.Color(0x8db3d6), hor = new THREE.Color(0xe4e9ec);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 450;
      const k = Math.min(1, Math.max(0, y * 1.6));
      c.copy(hor).lerp(top, k);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    scene.add(sky);
  }

  // ---------------- lane ground (heightfield ramp) ----------------
  function rampY(z) { return G * Math.min(1, Math.max(0, (3 - z) / 14.0)); }
  function groundH(x, z) { if (z < -18.4) return G; return rampY(z); }
  {
    const x0 = -8, x1 = 18, z0 = 8, z1 = -18.6;
    const g = new THREE.PlaneGeometry(x1 - x0, z0 - z1, 52, 60);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const cols = [];
    const road = new THREE.Color(0x9a958b), sand = new THREE.Color(0xcdbd9c), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2;
      const z = pos.getZ(i) + (z0 + z1) / 2;
      pos.setX(i, x); pos.setZ(i, z);
      pos.setY(i, groundH(x, z));
      const k = Math.min(1, Math.max(0, (x - 1.2) / 0.8));
      c.copy(road).lerp(sand, k);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
  }
  // courtyard ground beyond the gate
  boxMM(-70, 50, G - 0.6, G - 0.004, -130, -18.4, 0x9d9585);

  // ---------------- lane: left side ----------------
  boxMM(-3.9, -2.6, -1, 8.5, -8.2, 9, SAND);                 // near flat left wall
  cylY(1.3, -1, 8.6, SAND2, -2.7, -7.8);                      // round tower protruding into lane
  cylY(1.36, 7.4, 8.4, BLUE, -2.7, -7.8);                     // tower cap band
  boxMM(-8, -4.2, -1, G + 8.5, -18.2, -8.0, SAND);           // tall building along lane
  boxMM(-4.25, -4.15, G + 6.2, G + 7.0, -18.2, -9.4, BLUE);  // blue trim band
  // crates against the left side near the gate
  boxMM(-3.95, -1.8, G, G + 1.7, -13.5, -12.5, 0xb5ab98);   // wide "018001" crate
  boxMM(-1.8, -1.0, G, G + 1.65, -13.3, -12.4, 0xcfcfca);   // tall white crate

  // ---------------- gate wall with pointed arch ----------------
  {
    const sh = new THREE.Shape();
    sh.moveTo(-4.2, 0); sh.lineTo(-2.5, 0); sh.lineTo(-2.5, 3.6);
    sh.quadraticCurveTo(-2.4, 4.5, 0, 4.65);
    sh.quadraticCurveTo(2.4, 4.5, 2.5, 3.6);
    sh.lineTo(2.5, 0); sh.lineTo(14, 0); sh.lineTo(14, 5.2); sh.lineTo(-4.2, 5.2); sh.lineTo(-4.2, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false, curveSegments: 10 });
    const m = new THREE.Mesh(g, M(0xc9bb9c));
    m.position.set(0, G, -19.0);
    scene.add(m);
  }
  // red "B" mark and arrow on the gate wall (simple strokes)
  const RED = 0x8c1f1f;
  boxMM(3.55, 3.7, G + 1.55, G + 2.8, -17.99, -17.95, RED);
  boxMM(3.55, 4.15, G + 2.68, G + 2.8, -17.99, -17.95, RED);
  boxMM(3.55, 4.15, G + 2.12, G + 2.24, -17.99, -17.95, RED);
  boxMM(3.55, 4.15, G + 1.55, G + 1.67, -17.99, -17.95, RED);
  boxMM(4.1, 4.25, G + 1.55, G + 2.8, -17.99, -17.95, RED);
  boxMM(2.95, 3.07, G + 1.05, G + 2.05, -17.99, -17.95, RED);
  // lying barrels at the wall base, right of the arch
  {
    const b1 = cylY(0.42, -0.65, 0.65, 0x4f7273, 0, 0); b1.rotation.set(0, -0.45, Math.PI / 2, 'YXZ'); b1.position.set(3.3, G + 0.42, -17.3);
    const b2 = cylY(0.42, -0.65, 0.65, 0x47628c, 0, 0); b2.rotation.set(0, -0.3, Math.PI / 2, 'YXZ'); b2.position.set(4.6, G + 0.42, -17.55);
  }
  // door leaves, hinged at the back of the arch, swinging away from the camera
  const doorL = new THREE.Group(); doorL.position.set(-2.5, G, -18.93); scene.add(doorL);
  const doorR = new THREE.Group(); doorR.position.set(2.5, G, -18.93); scene.add(doorR);
  const DOORC = 0x4d4842, STRAP = 0x2f2c29;
  boxMM(0, 2.3, 0, 4.3, -0.07, 0.07, DOORC, doorL);
  boxMM(-2.3, 0, 0, 4.3, -0.07, 0.07, DOORC, doorR);
  for (const yy of [0.9, 2.1, 3.3]) {
    boxMM(0.02, 2.28, yy, yy + 0.12, -0.09, 0.09, STRAP, doorL);
    boxMM(-2.28, -0.02, yy, yy + 0.12, -0.09, 0.09, STRAP, doorR);
  }

  // ---------------- lane: right side ----------------
  cylY(0.12, groundH(7.4, -9.8) - 0.1, 10.5, 0x8d8d8a, 7.4, -9.8, scene, 10);   // utility pole
  { const g0 = groundH(4.9, -4.5);
    boxMM(3.9, 5.9, g0 - 0.2, g0 + 0.5, -5.1, -4.0, 0xd2c4a2); }               // stacked sandstone blocks
  { const g1 = groundH(6.0, -8.8);
    boxMM(5.0, 6.8, g1 - 0.2, g1 + 0.45, -9.3, -8.3, 0xd2c4a2); }
  cylY(2.0, -1, 9.5, SAND, 8.0, -6.2);                         // right round building
  cylY(2.06, 7.6, 8.6, BLUE, 8.0, -6.2);
  boxMM(4.7, 23, G, G + 17, -50, -45, 0xdad3cc);                // distant arcaded building

  // ---------------- courtyard (frame anchored at the exit point) ----------------
  const C13 = { x: -0.6, z: -21.0 };
  const PSI_B = 46;
  const bG = new THREE.Group();
  bG.position.set(C13.x, G, C13.z);
  bG.rotation.y = PSI_B * D2R;
  scene.add(bG);
  const FB = { x: -Math.sin(PSI_B * D2R), z: -Math.cos(PSI_B * D2R) };
  const RB = { x: Math.cos(PSI_B * D2R), z: -Math.sin(PSI_B * D2R) };
  function bToWorld(a, b) { return { x: C13.x + a * FB.x + b * RB.x, z: C13.z + a * FB.z + b * RB.z }; }
  // local coords inside bG: x = b (right), y = height, z = -a (forward depth)
  function bBox(b0, b1, h0, h1, a0, a1, hex) { return boxMM(b0, b1, h0, h1, -a1, -a0, hex, bG); }

  // crate with stacked cardboard boxes (central landmark)
  bBox(-0.85, 0.45, 0, 1.15, 8.35, 9.65, 0xdcd7cc);
  bBox(-0.8, 0.4, 1.15, 2.35, 8.45, 9.6, 0x9a7f60);
  // back wall with round-topped arch
  {
    const sh = new THREE.Shape();
    sh.moveTo(-3.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, 2.15);
    sh.absarc(1.25, 2.15, 0.75, Math.PI, 0, true);
    sh.lineTo(2.0, 0); sh.lineTo(6.3, 0); sh.lineTo(6.3, 4.0); sh.lineTo(-3.5, 4.0); sh.lineTo(-3.5, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.0, bevelEnabled: false, curveSegments: 10 });
    const m = new THREE.Mesh(g, M(0xc6b899));
    m.position.set(0, 0, -13);
    bG.add(m);
  }
  bBox(0.4, 2.1, 0, 3.0, 13.0, 14.6, 0x3d3833);              // dark space behind the arch
  // covered passage to the right
  bBox(6.3, 7.0, 0, 3.9, 12, 13, SAND);
  bBox(7.0, 10.6, 2.8, 3.9, 12, 15.5, 0x9c917c);
  bBox(7.0, 10.6, 0, 2.8, 16, 16.6, 0x5a544c);
  bBox(10.6, 11.3, 0, 3.9, 12, 13, SAND);
  bBox(11.3, 22, 0, 4.0, 12, 13, SAND);
  // large building on the left with blue band, plus round corner tower
  bBox(-18, -3.5, 0, 9.0, 8.9, 22, SAND);
  bBox(-18.05, -3.45, 5.4, 6.3, 8.85, 22.05, BLUE);
  bBox(-3.5, 1.5, 0, 7.5, 14, 24, SAND2);
  bBox(-3.55, 1.55, 5.4, 6.3, 13.95, 24.05, BLUE);
  cylY(1.15, 0, 3.3, SAND2, -2.45, -9.9, bG);
  bBox(-3.5, -2.0, 0, 3.3, 9.9, 12.0, SAND2);                // low wall joining tower to back wall
  // concrete barrier slabs along the building front
  bBox(-6.9, -4.6, 0, 1.7, 8.5, 8.85, 0xd9d9d3);
  // abandoned car, side-on, front to image-left
  bBox(-3.9, -1.3, 0.2, 0.75, 5.9, 7.3, 0xbfc2bc);
  bBox(-3.0, -1.6, 0.75, 1.15, 6.0, 7.2, 0xaeb2ac);
  // tree behind the back wall
  cylY(0.35, 0, 6.0, 0x6b5a45, 4.5, -17, bG, 10);
  {
    const f = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 12), M(0x7a8456));
    f.scale.y = 1.25; f.position.set(4.5, 6.4, -17); bG.add(f);
    const p = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), M(0x9a9660));
    p.scale.y = 0.4; p.position.set(4.2, 10.0, -16.5); bG.add(p);
  }

  // ---------------- camera path ----------------
  // corridor keys: world x, z, yaw (deg, + = left), pitch (deg, + = up)
  const camKeys = [
    { t: 0.000, x: 1.0, z: 1.4, psi: 18.5, p: -1.2 },
    { t: 0.267, x: 0.8, z: 0.0, psi: -1.8, p: -1.0 },
    { t: 0.550, x: 0.8, z: -1.8, psi: 0.6, p: -5.6 },
    { t: 0.817, x: 0.6, z: -3.5, psi: 1.7, p: -7.0 },
    { t: 1.100, x: 0.3, z: -5.3, psi: 2.8, p: -1.7 },
    { t: 1.367, x: 0.1, z: -7.0, psi: 2.7, p: 2.5 },
    { t: 1.633, x: 0.0, z: -8.7, psi: 1.4, p: 3.3 },
    { t: 1.917, x: 0.0, z: -10.5, psi: 3.6, p: 0 },
    { t: 2.183, x: -0.1, z: -12.2, psi: 3.3, p: 0 },
    { t: 2.467, x: -0.2, z: -14.0, psi: 0.5, p: 0 },
    { t: 2.733, x: -0.4, z: -15.7, psi: 4.0, p: -1 },
    { t: 3.000, x: -0.4, z: -18.4, psi: 30, p: 0 },
    { t: 3.283, x: -0.5, z: -19.6, psi: 44, p: 0 },
  ];
  // courtyard keys: depth a, lateral b in courtyard frame, relative yaw, pitch
  const bKeys = [
    [3.550, 0.00, 0.0, 0.0, -2.5],
    [3.817, 1.15, 0.0, -4.3, -1],
    [4.100, 1.80, 0.1, -3.0, 0],
    [4.367, 2.50, -0.1, -6.0, 0],
    [4.650, 3.35, -0.5, -10.0, 0],
    [4.917, 3.90, -0.4, -9.0, 0],
    [5.183, 4.55, -0.2, -7.0, 0],
    [5.467, 5.20, -0.1, -5.0, 0],
    [5.733, 5.95, -0.1, -1.0, 0],
    [6.017, 6.70, 0.1, 0.0, -1],
    [6.283, 7.15, 0.35, 6.0, -2],
    [6.400, 7.25, 0.4, 6.5, -2],
  ];
  for (const k of bKeys) {
    const w = bToWorld(k[1], k[2]);
    camKeys.push({ t: k[0], x: w.x, z: w.z, psi: PSI_B + k[3], p: k[4] });
  }
  function herm(keys, ch, t) {
    const n = keys.length;
    if (t <= keys[0].t) return keys[0][ch];
    if (t >= keys[n - 1].t) return keys[n - 1][ch];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const h = k1.t - k0.t, s = (t - k0.t) / h;
    const tan = (j) => {
      if (j <= 0) return (keys[1][ch] - keys[0][ch]) / (keys[1].t - keys[0].t);
      if (j >= n - 1) return (keys[n - 1][ch] - keys[n - 2][ch]) / (keys[n - 1].t - keys[n - 2].t);
      return (keys[j + 1][ch] - keys[j - 1][ch]) / (keys[j + 1].t - keys[j - 1].t);
    };
    const m0 = tan(i) * h, m1 = tan(i + 1) * h;
    const s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * k0[ch] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * k1[ch] + (s3 - s2) * m1;
  }
  function camState(t) {
    const x = herm(camKeys, 'x', t), z = herm(camKeys, 'z', t);
    return { x, y: groundH(x, z) + EYE, z, psi: herm(camKeys, 'psi', t), p: herm(camKeys, 'p', t) };
  }

  // ---------------- door push timing ----------------
  function lerpKeys(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    const n = keys.length;
    if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const a = keys[i], b = keys[i + 1];
    let s = (t - a[0]) / (b[0] - a[0]);
    s = s * s * (3 - 2 * s);
    const out = [];
    for (let j = 1; j < a.length; j++) out.push(a[j] + (b[j] - a[j]) * s);
    return out;
  }
  const doorLKeys = [[0, 10], [2.5, 12], [2.73, 22], [2.88, 32], [3.0, 42], [3.28, 50], [3.55, 52], [6.4, 52]];
  const doorRKeys = [[0, 10], [2.5, 12], [2.73, 40], [2.95, 46], [3.2, 50], [6.4, 50]];

  // ---------------- first-person viewmodel (camera-attached) ----------------
  const vm = new THREE.Group();
  camera.add(vm);
  const SLEEVE = 0x9b946c, GLOVE = 0x5f3f2a;
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14);
  function makeArm() {
    const sleeve = new THREE.Mesh(unitCyl, M(SLEEVE));
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.075), M(GLOVE));
    vm.add(sleeve); vm.add(glove);
    return { sleeve, glove };
  }
  const armR = makeArm(), armL = makeArm();
  const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, -1);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpW = new THREE.Vector3();
  function P(px, py, d, out) { return out.set((px - 480) / 398 * d, (300 - py) / 398 * d, -d); }
  function poseArm(arm, k) {
    P(k[0], k[1], k[2], tmpA); // hand
    P(k[3], k[4], k[5], tmpB); // elbow
    tmpD.subVectors(tmpA, tmpB).normalize();
    tmpW.copy(tmpA).addScaledVector(tmpD, -0.07);
    const len = tmpW.distanceTo(tmpB);
    arm.sleeve.position.addVectors(tmpW, tmpB).multiplyScalar(0.5);
    arm.sleeve.scale.set(0.072, Math.max(0.01, len), 0.072);
    arm.sleeve.quaternion.setFromUnitVectors(UP, tmpD);
    arm.glove.position.copy(tmpA);
    arm.glove.quaternion.setFromUnitVectors(UP, tmpD);
  }
  // keys: [t, hand px, py, depth, elbow px, py, depth] in 960x600 reference pixel space
  const OFF_R = [780, 830, 0.5, 920, 980, 0.45];
  const OFF_L = [240, 830, 0.5, 70, 980, 0.45];
  const rKeys = [
    [0.00, 660, 500, 0.5, 820, 760, 0.45],
    [0.27, 690, 505, 0.5, 850, 760, 0.45],
    [0.40, 700, 560, 0.5, 860, 800, 0.45],
    [0.55, ...OFF_R], [0.85, ...OFF_R],
    [1.05, 635, 545, 0.5, 900, 740, 0.45],
    [1.37, 655, 540, 0.5, 910, 740, 0.45],
    [1.63, 690, 545, 0.5, 930, 740, 0.45],
    [1.80, 650, 500, 0.5, 900, 720, 0.45],
    [1.92, 590, 465, 0.5, 880, 700, 0.45],
    [2.18, 560, 530, 0.5, 800, 760, 0.45],
    [2.36, ...OFF_R], [3.74, ...OFF_R],
    [3.88, 700, 480, 0.55, 960, 640, 0.4],
    [4.08, 585, 325, 0.6, 1000, 600, 0.45],
    [4.30, ...OFF_R], [4.70, ...OFF_R],
    [4.90, 820, 640, 0.5, 940, 800, 0.45],
    [6.40, 820, 640, 0.5, 940, 800, 0.45],
  ];
  const lKeys = [
    [0.00, 330, 520, 0.5, 150, 760, 0.45],
    [0.27, 360, 525, 0.5, 180, 760, 0.45],
    [0.40, 300, 700, 0.5, 110, 900, 0.45],
    [0.55, ...OFF_L], [1.75, ...OFF_L],
    [1.92, 440, 470, 0.5, 250, 720, 0.45],
    [2.18, 470, 525, 0.5, 280, 760, 0.45],
    [2.47, 360, 500, 0.5, 220, 740, 0.45],
    [3.85, 370, 505, 0.5, 220, 740, 0.45],
    [4.00, 300, 700, 0.5, 150, 900, 0.45],
    [4.20, ...OFF_L], [4.75, ...OFF_L],
    [4.92, 520, 445, 0.5, 380, 760, 0.45],
    [5.18, 680, 470, 0.5, 480, 780, 0.45],
    [5.47, 590, 445, 0.6, 500, 780, 0.5],
    [6.40, 590, 445, 0.6, 500, 780, 0.5],
  ];
  // knife blade (attached to right hand)
  const knife = new THREE.Group();
  {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1, 0.008), M(0xb9bec6));
    blade.position.y = 0.5; blade.scale.y = 1; knife.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), M(0x55585c));
    knife.add(guard);
  }
  vm.add(knife);
  const knifeDir = new THREE.Vector3(-0.85, 0.33, -0.4).normalize();
  // held grenade
  const heldNade = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.075, 12), M(0x3d4433));
  vm.add(heldNade);
  // rifle
  const rifle = new THREE.Group();
  {
    const RC = 0x2b2b2b, HC = 0x353433;
    boxMM(-0.05, 0.05, -0.07, 0.07, -0.34, 0, RC, rifle);
    boxMM(-0.042, 0.042, -0.05, 0.05, -0.62, -0.34, HC, rifle);
    boxMM(-0.016, 0.016, -0.016, 0.016, -0.74, -0.62, RC, rifle);
    boxMM(-0.03, 0.03, -0.22, -0.07, -0.26, -0.17, RC, rifle);
    boxMM(-0.02, 0.02, 0.07, 0.13, -0.1, -0.04, RC, rifle);
    boxMM(-0.012, 0.012, 0.05, 0.12, -0.6, -0.57, RC, rifle);
  }
  vm.add(rifle);
  const rifleKeys = [
    [4.60, 620, 750, 0.9, 900, 900, 0.4],
    [4.92, 430, 280, 0.7, 640, 640, 0.45],
    [5.18, 560, 40, 0.6, 720, 580, 0.45],
    [5.42, 600, 385, 0.85, 930, 650, 0.32],
    [5.50, 605, 395, 0.85, 935, 660, 0.32],
    [6.40, 605, 395, 0.85, 935, 660, 0.32],
  ];

  // ---------------- thrown grenade and trail ----------------
  const T_LAUNCH = 3.95, T_FLIGHT = 0.6, GRAV = 28;
  const cs0 = camState(T_LAUNCH);
  const fwd0 = { x: -Math.sin(cs0.psi * D2R), z: -Math.cos(cs0.psi * D2R) };
  const rgt0 = { x: Math.cos(cs0.psi * D2R), z: -Math.sin(cs0.psi * D2R) };
  const L0 = new THREE.Vector3(cs0.x + fwd0.x * 0.35 + rgt0.x * 0.45, cs0.y + 0.3, cs0.z + fwd0.z * 0.35 + rgt0.z * 0.45);
  const landW = bToWorld(12.4, 1.2);
  const L1 = new THREE.Vector3(landW.x, G + 0.06, landW.z);
  const VY = (L1.y - L0.y + 0.5 * GRAV * T_FLIGHT * T_FLIGHT) / T_FLIGHT;
  function traj(tau, out) {
    const s = tau / T_FLIGHT;
    return out.set(L0.x + (L1.x - L0.x) * s, L0.y + VY * tau - 0.5 * GRAV * tau * tau, L0.z + (L1.z - L0.z) * s);
  }
  const nade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 10), M(0x262a22));
  scene.add(nade);
  const TRAIL_N = 40;
  const trailMat = new THREE.MeshBasicMaterial({ color: 0x7d9cff, transparent: true, opacity: 0.85 });
  const trail = [];
  for (let i = 0; i < TRAIL_N; i++) {
    const m = new THREE.Mesh(unitCyl, trailMat);
    m.visible = false; scene.add(m); trail.push(m);
  }
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), dV = new THREE.Vector3();

  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), duration);
    const cs = camState(t);
    camera.position.set(cs.x, cs.y, cs.z);
    camera.rotation.set(cs.p * D2R, cs.psi * D2R, 0, 'YXZ');
    camera.updateMatrixWorld(true);

    doorL.rotation.y = lerpKeys(doorLKeys, t)[0] * D2R;
    doorR.rotation.y = -lerpKeys(doorRKeys, t)[0] * D2R;

    const rk = lerpKeys(rKeys, t), lk = lerpKeys(lKeys, t);
    poseArm(armR, rk);
    poseArm(armL, lk);

    knife.visible = t < 0.5;
    if (knife.visible) {
      P(rk[0], rk[1], rk[2], tmpA);
      knife.position.set(tmpA.x - 0.07, tmpA.y + 0.035, tmpA.z);
      knife.quaternion.setFromUnitVectors(UP, knifeDir);
      knife.scale.set(1, 0.36, 1);
    }
    heldNade.visible = (t >= 0.95 && t < 2.3) || (t >= 3.84 && t < T_LAUNCH);
    if (heldNade.visible) {
      P(rk[0], rk[1], rk[2], tmpA);
      heldNade.position.set(tmpA.x - 0.015, tmpA.y + 0.07, tmpA.z);
    }
    rifle.visible = t >= 4.72;
    if (rifle.visible) {
      const k = lerpKeys(rifleKeys, t);
      P(k[0], k[1], k[2], tmpA); // muzzle
      P(k[3], k[4], k[5], tmpB); // rear
      tmpD.subVectors(tmpA, tmpB).normalize();
      rifle.position.copy(tmpB);
      rifle.quaternion.setFromUnitVectors(FWD, tmpD);
    }

    const tau = t - T_LAUNCH;
    nade.visible = tau >= 0;
    if (nade.visible) {
      traj(Math.min(tau, T_FLIGHT), pA);
      nade.position.copy(pA);
      nade.rotation.set(tau * 9, 0, tau * 5);
    }
    const showTrail = t >= 4.25;
    const tauMax = Math.min(Math.max(tau, 0), T_FLIGHT);
    for (let i = 0; i < TRAIL_N; i++) {
      const m = trail[i];
      if (!showTrail) { m.visible = false; continue; }
      traj(tauMax * i / TRAIL_N, pA);
      traj(tauMax * (i + 1) / TRAIL_N, pB);
      dV.subVectors(pB, pA);
      const len = dV.length();
      if (len < 1e-5) { m.visible = false; continue; }
      m.visible = true;
      m.position.addVectors(pA, pB).multiplyScalar(0.5);
      m.scale.set(0.02, len, 0.02);
      m.quaternion.setFromUnitVectors(UP, dV.normalize());
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
