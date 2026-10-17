// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction.
// First-person walk through a sunny desert bombsite: wooden crate start, quick look right,
// knife swap, AWP shot on an enemy at the ramp top, pass between site crates,
// strafe to the site edge, hop the ledge and drop onto the ramp street.
// World frame: -Z = final viewing direction (toward the sign building), +X = image right.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const DEG = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb2cce6);
  scene.fog = new THREE.Fog(0xd8e2ea, 70, 280);

  const camera = new THREE.PerspectiveCamera(74, width / height, 0.02, 600);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xeef3fa, 0xb09a7c, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2de, 1.5);
  sun.position.set(-30, 45, 22);
  scene.add(sun);

  // ---------- helpers ----------
  const mats = {};
  function mat(c) {
    if (!mats[c]) mats[c] = new THREE.MeshLambertMaterial({ color: c });
    return mats[c];
  }
  function boxR(parent, x0, x1, y0, y1, z0, z1, c) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat(c));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parent.add(m);
    return m;
  }
  function cyl(parent, r, h, c, x, y, z, seg = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(c));
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    return m;
  }
  let rs = (seed >>> 0) || 12345;
  function rand() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, t) => { const s = clamp((t - a) / (b - a), 0, 1); return s * s * (3 - 2 * s); };
  const lerp = (a, b, s) => a + (b - a) * s;

  // ramp/street height (descends toward -Z from the ramp top near z = 4.8)
  const rampY = (z) => -0.25 + 0.065 * (Math.min(z, 4.8) - 4.8);

  // ---------- colours ----------
  const C = {
    floor: 0xc6b49c, floorDark: 0xb9a68c, ledge: 0xd8cfbe, wood: 0xd6bd93, woodDark: 0xb39668,
    sack: 0xa7b1b8, crate: 0xdedfdb, tarp: 0x78bcae, tan: 0xcdb084, tanLight: 0xdcc8a2,
    white: 0xebe6dc, whiteB: 0xdfd8ca, window: 0x58625e, shutterBlue: 0x5b80a9, shutterRed: 0xa03b33,
    asphalt: 0x5a5753, sidewalk: 0xc6bcad, curb: 0xb5463e, green: 0x8ab89f, red: 0xd2382f,
    basket: 0xd0bc8e, enemy: 0x2d3136, enemyLegs: 0x3b3e42, head: 0x3a3836, mate: 0x4a3a2c,
    mateLegs: 0x5c4c3a, car: 0x7ea69f, carGlass: 0x3f4c55, base: 0xa39684,
  };

  // ---------- ground ----------
  boxR(scene, -200, 200, -4.0, -3.6, -200, 200, C.base);                 // far base ground
  boxR(scene, -4.8, 32, -3.6, 0, -13.5, 30, C.floor);                     // bombsite floor
  boxR(scene, -16, -4.8, -3.6, 0.8, 4.8, 30, C.floorDark);                // upper left platform
  boxR(scene, -5.6, -4.8, -3.6, 0.6, -13.5, 4.8, C.ledge);                // site-edge ledge (low wall)
  boxR(scene, -4.8, 7.0, 0, 0.9, -14.0, -13.5, C.ledge);                  // far low wall of site
  // stairs rising toward -X onto the upper platform
  for (let i = 0; i < 4; i++) boxR(scene, -4.8, 1.2 - 0.6 * i, 0, 0.2 * (i + 1), 4.8, 7.4, 0xd0bfa3);
  boxR(scene, -4.8, -1.2, 0, 0.8, 7.4, 30, C.floorDark);
  // right low wall (baskets) running diagonally to the second player's block
  const rw = new THREE.Group();
  rw.position.set(11.7, 0, 0.15);
  rw.rotation.y = 32.7 * DEG;
  scene.add(rw);
  boxR(rw, -5.1, 5.1, 0, 0.9, -0.35, 0.35, C.ledge);
  cyl(scene, 0.38, 0.55, C.basket, 7.95, 0.9, 2.62);
  cyl(scene, 0.38, 0.55, C.basket, 8.6, 0.9, 2.2);
  boxR(scene, 14.6, 16.6, 0, 1.2, -3.45, -1.45, C.ledge);                // block the second player stands on

  // sloped ramp / street (left of the ledge)
  function slopedStrip(x0, x1, z0, z1, lift, c) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 30);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2, z = p.getZ(i) + (z0 + z1) / 2;
      p.setXYZ(i, x, rampY(z) + lift, z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat(c));
    scene.add(m);
    return m;
  }
  slopedStrip(-16, -5.6, -70, 4.8, 0, C.asphalt);
  slopedStrip(-6.8, -5.6, -70, 4.8, 0.12, C.sidewalk);
  slopedStrip(-6.86, -6.8, -70, 4.8, 0.13, C.curb);
  slopedStrip(-20, -14.8, -70, -4.5, 0.15, C.sidewalk);
  slopedStrip(-14.86, -14.8, -70, -4.5, 0.16, C.curb);
  slopedStrip(-10.4, -10.2, -70, -5.0, 0.01, 0xd8d4cc); // lane line

  // ---------- site props ----------
  // tall wooden crate stack at start (faces the initial view direction)
  const woodGrp = new THREE.Group();
  woodGrp.position.set(5.03, 0, 7.53);
  woodGrp.rotation.y = 59 * DEG;
  scene.add(woodGrp);
  boxR(woodGrp, -1.65, 1.65, 0, 2.0, -0.7, 0.7, C.wood);
  boxR(woodGrp, -1.6, 1.6, 2.0, 4.0, -0.65, 0.65, C.wood);
  boxR(woodGrp, -1.67, 1.67, 1.92, 2.08, -0.72, 0.72, C.woodDark); // frame band
  // standing cement sacks + a lying sack
  cyl(scene, 0.42, 0.95, C.sack, 2.78, 0, 6.77);
  cyl(scene, 0.42, 0.95, C.sack, 3.0, 0, 5.9);
  cyl(scene, 0.42, 0.95, C.sack, 3.22, 0, 5.03);
  const lying = boxR(scene, 3.6, 4.6, 0, 0.4, 5.9, 6.5, C.sack);
  lying.rotation.y = 0.4;

  // site crates: white boxes with teal tarp tops
  function crate(x0, x1, z0, z1, h, drapeFront) {
    boxR(scene, x0, x1, 0, h, z0, z1, C.crate);
    boxR(scene, x0 - 0.05, x1 + 0.05, h - 0.06, h + 0.08, z0 - 0.05, z1 + 0.05, C.tarp);
    if (drapeFront) boxR(scene, x0 - 0.05, x1 + 0.05, h - drapeFront, h, Math.max(z0, z1) + 0.02, Math.max(z0, z1) + 0.07, C.tarp);
  }
  crate(0.2, 2.1, -2.3, -0.9, 1.6, 0.6);         // Q: front crate (approached at 3.5-3.8 s)
  crate(-3.55, -1.93, -3.8, -2.0, 2.3, 0.3);     // P: left tall crate
  crate(1.0, 2.9, -4.3, -2.4, 2.3, 0.3);         // R: right tall crate
  crate(-4.5, -2.7, -6.6, -4.8, 2.0, 0.3);       // S: rear crate near ledge
  // bombsite marker on floor
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.16, 40), mat(C.red));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-1.2, 0.03, -3.3);
  scene.add(ring);
  for (const a of [45, -45]) {
    const arm = boxR(scene, -0.95, 0.95, 0.02, 0.04, -0.08, 0.08, C.red);
    arm.position.set(-1.2, 0.03, -3.3);
    arm.rotation.y = a * DEG;
  }
  // small star crate on the ramp sidewalk
  boxR(scene, -6.6, -5.8, rampY(-6.0) + 0.12, rampY(-6.0) + 0.92, -6.4, -5.6, 0xa8865a);

  // ---------- buildings ----------
  // tan wall building with windows at the ramp top (faces the site)
  const tb = new THREE.Group();
  tb.position.set(-9.33, 0, 1.15);
  tb.rotation.y = 64.5 * DEG;
  scene.add(tb);
  boxR(tb, -2.5, 4.5, -3.6, 4.4, -6, 0, C.tan);
  boxR(tb, -2.5, 4.5, 4.4, 5.0, -0.4, 0.05, C.tanLight);
  for (const wx of [-1.0, 1.2, 3.4]) boxR(tb, wx - 0.5, wx + 0.5, 1.6, 3.0, 0, 0.06, C.window);
  boxR(tb, -9, 0, -3.6, 3.0, -14, -6, C.tan); // building mass behind
  // white building with green band and red shutters on the upper platform (door faces +X)
  boxR(scene, -16, -7.5, 0.8, 9.5, 5.5, 15, C.white);
  boxR(scene, -7.56, -7.48, 0.8, 2.6, 5.5, 15, C.green);
  for (const wz of [7, 10, 13]) boxR(scene, -7.58, -7.48, 6.0, 7.6, wz - 0.6, wz + 0.6, C.shutterRed);
  boxR(scene, -7.6, -7.47, 0.8, 3.2, 9.4, 10.6, 0xd7d0c4); // door
  // sign building ("teleboutique") beyond the site
  boxR(scene, -2.5, 7, -3.6, 9.5, -25, -18.8, C.whiteB);
  boxR(scene, 0.3, 7.3, 5.6, 7.6, -18.8, -18.7, 0xede9e1);
  boxR(scene, 1.0, 6.6, 6.0, 7.0, -18.7, -18.66, 0x45525e);
  boxR(scene, 5.0, 6.2, 1.8, 3.6, -18.8, -18.7, C.shutterRed);
  // big white building with blue shutters right of the sign building
  boxR(scene, 7, 18, 0, 11.5, -17, -7, C.white);
  for (const wz of [-14, -11]) boxR(scene, 6.92, 7.0, 6.5, 8.3, wz - 0.6, wz + 0.6, C.shutterBlue);
  for (const wx of [10, 14]) boxR(scene, wx - 0.6, wx + 0.6, 6.5, 8.3, -7.0, -6.92, C.shutterBlue);
  boxR(scene, 7.6, 8.6, 9.0, 9.6, -7.0, -6.6, 0xcfcfcf); // AC unit
  boxR(scene, 18, 26, 0, 9, -6, 8, C.whiteB);
  // left side of the street, beyond the tan building
  boxR(scene, -26, -16, -3.6, 7.5, -16, -6, C.white);
  boxR(scene, -16.1, -16.0, 3.2, 4.6, -12, -10.5, C.shutterBlue);
  boxR(scene, -26, -16, -3.6, 6.5, -30, -17, 0xe1d9cb);
  boxR(scene, -16, -4, -3.6, 8.5, -62, -55, 0xe1d9cb);
  boxR(scene, -4, 6, -3.6, 6, -50, -26, C.white);
  // parked car on the far side of the street
  const car = new THREE.Group();
  car.position.set(-13.2, rampY(-11.5) + 0.05, -11.5);
  car.rotation.x = Math.atan(0.065);
  scene.add(car);
  boxR(car, -0.9, 0.9, 0.25, 1.0, -2.3, 2.3, C.car);
  boxR(car, -0.8, 0.8, 1.0, 1.45, -1.1, 1.0, C.carGlass);
  // utility pole
  cyl(scene, 0.14, 11, 0x8c8a86, -15.2, -1.0, -16, 8);
  boxR(scene, -16.2, -14.2, 8.8, 9.0, -16.1, -15.9, 0x8c8a86);
  // distant skyline (seeded)
  for (let i = 0; i < 26; i++) {
    const ang = (-160 + rand() * 170) * DEG;
    const r = 50 + rand() * 40;
    const cx = Math.sin(ang) * r + 2, cz = -Math.cos(ang) * r - 6;
    if (cz > 14) continue;
    const w = 6 + rand() * 8, d = 6 + rand() * 8, h = 6 + rand() * 12;
    boxR(scene, cx - w / 2, cx + w / 2, -3.6, h, cz - d / 2, cz + d / 2, rand() < 0.6 ? C.white : 0xd8c9ad);
  }

  // ---------- characters ----------
  function makeHuman(cBody, cLegs, cHead) {
    const root = new THREE.Group();
    const faller = new THREE.Group();
    root.add(faller);
    const hip = new THREE.Group();
    hip.position.y = 0.92;
    faller.add(hip);
    const legGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.92, 8);
    legGeo.translate(0, -0.46, 0);
    const legL = new THREE.Mesh(legGeo, mat(cLegs)); legL.position.x = 0.11; hip.add(legL);
    const legR = new THREE.Mesh(legGeo, mat(cLegs)); legR.position.x = -0.11; hip.add(legR);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.27), mat(cBody));
    torso.position.y = 0.31; hip.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(cHead));
    head.position.y = 0.78; hip.add(head);
    const armGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8);
    armGeo.translate(0, -0.31, 0);
    const armL = new THREE.Group(); armL.position.set(0.28, 0.58, 0); hip.add(armL);
    armL.add(new THREE.Mesh(armGeo, mat(cBody)));
    const armR = new THREE.Group(); armR.position.set(-0.28, 0.58, 0); hip.add(armR);
    armR.add(new THREE.Mesh(armGeo, mat(cBody)));
    const gun = boxR(hip, -0.03, 0.03, 0.38, 0.46, 0.05, 0.85, 0x1f1f1f);
    return { root, faller, hip, legL, legR, armL, armR, gun };
  }

  // enemy walking up the ramp, shot at 2.82 s, falls backward
  const enemy = makeHuman(C.enemy, C.enemyLegs, C.head);
  scene.add(enemy.root);
  const SHOT = 2.82;
  const enemyStart = { x: -8.4, z: -10.5 }, enemyEnd = { x: -8.0, z: -4.4 };
  enemy.root.rotation.y = 90 * DEG; // faces the site edge (+X), roughly toward the shooter
  const droppedAwp = boxR(scene, -0.04, 0.04, 0, 0.08, -0.6, 0.6, 0x1f1f1f);
  droppedAwp.position.set(-7.3, rampY(-5.4) + 0.03, -5.4);
  droppedAwp.rotation.set(0, 1.1, 0);

  // second player standing on the block at right (seen during the quick right look)
  const mate = makeHuman(C.mate, C.mateLegs, C.head);
  mate.root.position.set(15.6, 1.2, -2.45);
  mate.root.rotation.y = -120 * DEG;
  mate.armL.rotation.x = -1.2; mate.armR.rotation.x = -1.0;
  mate.hip.position.y = 0.8; mate.legL.rotation.x = -0.6; mate.legR.rotation.x = 0.35;
  scene.add(mate.root);

  // earlier casualty lying on the street near the car
  const body2 = makeHuman(C.enemy, C.enemyLegs, C.head);
  body2.root.position.set(-11.5, rampY(-8.6) + 0.12, -8.6);
  body2.root.rotation.y = 75 * DEG;
  body2.faller.rotation.x = -Math.PI / 2;
  body2.faller.position.y = 0.13;
  body2.armL.rotation.set(-0.5, 0, 1.0); body2.armR.rotation.set(-0.3, 0, -0.8);
  scene.add(body2.root);

  // ---------- first-person viewmodel (child of camera, scaled toward eye; projection unchanged) ----------
  const vm = new THREE.Group();
  vm.scale.setScalar(0.25);
  camera.add(vm);

  const awpHolder = new THREE.Group();
  vm.add(awpHolder);
  const awp = new THREE.Group();
  const rear = new THREE.Vector3(0.50, -0.31, -0.36);
  const tip = new THREE.Vector3(0.36, -0.215, -1.20);
  awp.position.copy(rear);
  awp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tip.clone().sub(rear).normalize());
  awpHolder.add(awp);
  const kick = new THREE.Group();
  awp.add(kick);
  function vbox(p, w, h, d, c, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z); p.add(m); return m;
  }
  function vcyl(p, rTop, rBot, len, c, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 18), mat(c));
    m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m;
  }
  vbox(kick, 0.09, 0.14, 0.56, 0x7b2fbd, 0, -0.05, -0.20);    // purple stock/body
  vbox(kick, 0.092, 0.04, 0.44, 0xa660e6, 0, -0.085, -0.20);  // lighter purple streak
  vcyl(kick, 0.019, 0.019, 0.50, 0x1b1b1d, 0, 0, -0.63);      // barrel
  vcyl(kick, 0.028, 0.028, 0.07, 0x1b1b1d, 0, 0, -0.87);      // muzzle brake
  vcyl(kick, 0.05, 0.05, 0.30, 0x2a2a2d, 0, 0.10, -0.18);     // scope tube
  vcyl(kick, 0.055, 0.085, 0.13, 0x232326, 0, 0.10, -0.38);   // objective bell
  vcyl(kick, 0.086, 0.086, 0.035, 0xc8cc3c, 0, 0.10, -0.405); // yellow logo band
  vcyl(kick, 0.055, 0.055, 0.07, 0x1f1f22, 0, 0.10, -0.02);   // eyepiece
  vbox(kick, 0.045, 0.08, 0.045, 0x151515, 0, 0.045, -0.10);  // mounts
  vbox(kick, 0.045, 0.08, 0.045, 0x151515, 0, 0.045, -0.27);
  vbox(kick, 0.11, 0.13, 0.17, 0x74d23c, -0.01, -0.13, -0.45); // left green glove
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.40, 12), mat(0x63b738));
  fore.rotation.x = -0.6435; fore.position.set(-0.01, -0.29, -0.33); kick.add(fore);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  flash.position.set(0, 0, -0.94); kick.add(flash);

  const knife = new THREE.Group();
  vm.add(knife);
  vbox(knife, 0.22, 0.18, 0.24, 0x74d23c, 0.48, -0.25, -0.46); // glove
  vbox(knife, 0.12, 0.12, 0.30, 0x2b2b2b, 0.55, -0.37, -0.30); // forearm/sleeve
  vbox(knife, 0.035, 0.04, 0.16, 0x303030, 0.39, -0.18, -0.58); // handle
  vbox(knife, 0.012, 0.045, 0.20, 0xa9adb2, 0.37, -0.16, -0.74); // blade

  // tracer (world space)
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffe28a }));
  scene.add(tracer);

  // ---------- camera track ----------
  // [t, x, z, yawRight(deg), pitch(deg)]
  const K = [
    [0.000, 9.2, 7.0, -59, 3],
    [0.283, 9.5, 6.6, -15, 2],
    [0.583, 8.6, 6.4, -41, 0],
    [0.867, 8.0, 6.0, -56, 0],
    [1.167, 6.9, 4.8, -76, -2],
    [1.450, 5.6, 4.9, -54, -2],
    [1.750, 4.3, 4.7, -9, -2],
    [2.033, 3.1, 4.2, -9, -2],
    [2.317, 2.5, 3.85, -79, -1],
    [2.617, 2.1, 3.0, -53.8, -1],
    [2.900, 2.35, 2.1, -57.9, -1],
    [3.200, 3.15, 1.74, -34, -3],
    [3.483, 2.1, 0.8, -20, -5],
    [3.783, 0.65, -0.2, -4, -6],
    [4.067, -0.7, -0.55, 1, -3],
    [4.367, -1.1, 0.0, 0, -2],
    [4.650, -2.1, 0.5, -3.8, -1],
    [4.933, -3.0, 0.6, -3, -1],
    [5.233, -4.1, 0.7, -0.5, -1],
    [5.517, -4.5, 0.6, 0, -2],
    [5.817, -5.2, 0.5, -2.5, -4],
    [6.100, -5.9, -0.2, 4.6, -3],
    [6.400, -6.3, -1.2, 3.6, -2],
    [6.683, -6.6, -2.3, -1, -1],
  ];
  const EY = [[0, 1.65], [5.52, 1.65], [5.66, 2.30], [5.75, 2.36], [5.85, 2.25], [5.98, 2.25], [6.1, 2.02], [6.25, 1.55], [6.4, 1.15], [6.683, 1.06]];

  // monotone cubic (PCHIP) interpolation: no overshoot between keys
  function track(times, vals) {
    const n = times.length, m = new Array(n), d = [], h = [];
    for (let i = 0; i < n - 1; i++) { h[i] = times[i + 1] - times[i]; d[i] = (vals[i + 1] - vals[i]) / h[i]; }
    for (let i = 0; i < n; i++) {
      if (i === 0) m[i] = d[0];
      else if (i === n - 1) m[i] = d[n - 2];
      else if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    if (n > 2) { if (d[0] * m[1] <= 0) m[0] = 0; if (d[n - 2] * m[n - 2] <= 0) m[n - 1] = 0; }
    return (t) => {
      if (t <= times[0]) return vals[0];
      if (t >= times[n - 1]) return vals[n - 1];
      let i = 0;
      while (i < n - 2 && t > times[i + 1]) i++;
      const hh = h[i], s = (t - times[i]) / hh;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * vals[i] + (s3 - 2 * s2 + s) * hh * m[i] + (-2 * s3 + 3 * s2) * vals[i + 1] + (s3 - s2) * hh * m[i + 1];
    };
  }
  const kt = K.map((k) => k[0]);
  const tx = track(kt, K.map((k) => k[1]));
  const tz = track(kt, K.map((k) => k[2]));
  const tyaw = track(kt, K.map((k) => k[3]));
  const tpitch = track(kt, K.map((k) => k[4]));
  const ty = track(EY.map((e) => e[0]), EY.map((e) => e[1]));

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

  function update(time, frame) {
    const t = clamp(time, 0, duration);

    // recoil envelope (peaks ~0.08 s after the shot, gone by ~0.45 s)
    const dt = t - SHOT;
    const k = dt >= 0 ? smooth(0, 0.05, dt) * Math.exp(-Math.max(0, dt - 0.08) / 0.15) : 0;

    camera.position.set(tx(t), ty(t), tz(t));
    camera.rotation.set((tpitch(t) + 2.0 * k) * DEG, -tyaw(t) * DEG, 0);

    // weapon swap: AWP -> knife (1.0-1.55) -> AWP
    const down = smooth(0.90, 1.0, t) * (1 - smooth(1.60, 1.75, t));
    const bob = Math.sin(t * 2 * Math.PI * 1.8);
    awpHolder.position.set(0.006 * bob, -0.45 * down - 0.004 * Math.abs(bob), 0);
    awpHolder.rotation.set(-0.5 * down, 0, 0);
    awpHolder.visible = down < 0.99;
    const kUp = smooth(1.0, 1.1, t) * (1 - smooth(1.42, 1.52, t));
    knife.visible = kUp > 0.01;
    knife.position.set(0.4 * smooth(1.28, 1.45, t), -0.45 * (1 - kUp), 0);
    knife.rotation.set(0, 0, -0.3 * smooth(1.28, 1.45, t));
    kick.rotation.set(0.32 * k, 0, 0);
    kick.position.set(0, 0.05 * k, 0.06 * k);
    flash.visible = dt >= 0 && dt < 0.04;

    // enemy: walk up the ramp, then fall backward when hit
    const ws = clamp((t - 1.3) / (2.75 - 1.3), 0, 1);
    const ex = lerp(enemyStart.x, enemyEnd.x, ws), ez = lerp(enemyStart.z, enemyEnd.z, ws);
    enemy.root.position.set(ex, rampY(ez), ez);
    enemy.root.rotation.y = lerp(10, 50, smooth(1.9, 2.45, t)) * DEG;
    const walking = t < 2.75 ? 1 : 0;
    const phase = Math.sin(t * 2 * Math.PI * 1.6) * walking;
    const f = dt >= 0 ? smooth(0, 0.42, dt) : 0;
    enemy.faller.rotation.set(-Math.PI / 2 * f, 0, 0);
    enemy.faller.position.set(0, 0.13 * f, 0);
    enemy.legL.rotation.set(0.45 * phase * (1 - f) + 0.2 * f, 0, 0);
    enemy.legR.rotation.set(-0.45 * phase * (1 - f) - 0.1 * f, 0, 0);
    enemy.armL.rotation.set(lerp(-1.25, -0.5, f), 0, lerp(0, 1.0, f));
    enemy.armR.rotation.set(lerp(-1.05, -0.4, f), 0, lerp(0, -0.9, f));
    enemy.gun.visible = f < 0.15;
    droppedAwp.visible = f >= 0.15;

    // tracer from muzzle to enemy chest at the shot
    tracer.visible = dt >= 0 && dt < 0.07;
    if (tracer.visible) {
      camera.updateMatrixWorld(true);
      flash.getWorldPosition(tmpA);
      tmpB.set(enemyEnd.x, rampY(enemyEnd.z) + 1.35, enemyEnd.z);
      const dir = tmpB.clone().sub(tmpA);
      const len = dir.length();
      tracer.position.copy(tmpA).addScaledVector(dir, 0.5);
      tracer.quaternion.setFromUnitVectors(up, dir.normalize());
      tracer.scale.set(1, len, 1);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
