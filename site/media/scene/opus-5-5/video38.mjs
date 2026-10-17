// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video38.
// Single locked low-angle wide shot: a woman sits on a dirt road in front of a
// weathered farmhouse; a man walks in from the right foreground, stops beside her
// feet, turns, bends over and crouches with a hand on the ground.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const W = width || 1280;
  const H = height || 720;
  const DUR = duration || 12.637625;

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => u * u * (3 - 2 * u);
  const frac = (x) => x - Math.floor(x);

  function keyVec(K, t) {
    const n = K[0].length - 1;
    if (t <= K[0][0]) return K[0].slice(1);
    for (let i = 0; i < K.length - 1; i++) {
      if (t <= K[i + 1][0]) {
        const u = (t - K[i][0]) / (K[i + 1][0] - K[i][0]);
        const out = new Array(n);
        for (let k = 0; k < n; k++) out[k] = lerp(K[i][k + 1], K[i + 1][k + 1], u);
        return out;
      }
    }
    return K[K.length - 1].slice(1);
  }
  // box-filtered linear keys: smooth, deterministic, absolute in time
  const OFFS = [-0.2, -0.1, 0, 0.1, 0.2];
  function keySmooth(K, t) {
    const n = K[0].length - 1;
    const acc = new Array(n).fill(0);
    for (const d of OFFS) {
      const v = keyVec(K, t + d);
      for (let k = 0; k < n; k++) acc[k] += v[k] / OFFS.length;
    }
    return acc;
  }
  const key1 = (K, t) => keyVec(K, t)[0];
  const key1s = (K, t) => keySmooth(K, t)[0];

  // 2-bone planar IK in a (y, z) sagittal plane. Angles are measured from
  // straight down, positive toward +z (forward). bend=+1 knee forward, -1 elbow back.
  function ik2(sy, sz, ty, tz, L1, L2, bend) {
    const dy = ty - sy, dz = tz - sz;
    let D = Math.hypot(dy, dz);
    D = clamp(D, Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
    const alpha = Math.atan2(dz, -dy);
    const cb = clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1);
    const a1 = alpha + bend * Math.acos(cb);
    const ey = sy - L1 * Math.cos(a1);
    const ez = sz + L1 * Math.sin(a1);
    const a2 = Math.atan2(tz - ez, -(ty - ey));
    return { a1, a2, ey, ez };
  }

  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  function box(w, h, d, mat, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function limbGeo(rTop, rBot, len) {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 12);
    g.translate(0, -len / 2, 0);
    return g;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  function segment(a, b, r0, r1, mat, parent) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const d = new THREE.Vector3().subVectors(B, A);
    const len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 10), mat);
    m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.clone().normalize());
    parent.add(m);
    return m;
  }

  // ---------------------------------------------------------------- scene / camera
  const scene = new THREE.Scene();
  const SKY = 0xc8cfd1;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 70, 330);

  const FOCAL = 1650; // focal length in pixels at 720 px frame height
  const vfov = (2 * Math.atan(360 / FOCAL) * 180) / Math.PI;
  const CAM_H = 0.42;
  const CAM_PITCH = Math.atan(40 / FOCAL); // horizon sits ~40 px below centre
  const camera = new THREE.PerspectiveCamera(vfov, W / H, 0.05, 600);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, CAM_H, 0);
  camera.rotation.set(CAM_PITCH, 0, 0);
  camera.updateProjectionMatrix();
  scene.add(camera);

  // cinemascope letterbox bars (part of the reference picture), attached to camera
  {
    const hh = 0.1 * Math.tan((vfov * Math.PI) / 360);
    const hw = (hh * W) / H;
    const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false });
    const bar = (y0, y1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(hw * 4, y1 - y0), barMat);
      m.position.set(0, (y0 + y1) / 2, -0.1);
      m.renderOrder = 999;
      m.frustumCulled = false;
      camera.add(m);
    };
    bar(hh * (1 - (2 * 88) / 720), hh * 2);
    bar(-hh * 2, -hh * (1 - (2 * 89) / 720));
  }

  // lights: flat overcast
  scene.add(new THREE.HemisphereLight(0xeef2f4, 0x8c7e6c, 2.0));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-3, 8, 8);
  scene.add(sun);

  // ---------------------------------------------------------------- environment
  const matGrass = M(0x63743a);
  const matDirt = M(0xb8a996);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), matGrass);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  function flatPoly(pts, mat, y) {
    const s = new THREE.Shape();
    pts.forEach((p, i) => (i ? s.lineTo(p[0], -p[1]) : s.moveTo(p[0], -p[1])));
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.y = y;
    scene.add(m);
    return m;
  }
  matDirt.side = THREE.DoubleSide;
  matDirt.polygonOffset = true;
  matDirt.polygonOffsetFactor = -2;
  matDirt.polygonOffsetUnits = -2;
  // dirt road / yard (x, z)
  flatPoly(
    [
      [-1.55, 0.5], [-1.67, -4.3], [-1.9, -13.0], [-1.2, -15.6], [3.4, -15.2],
      [14, -24], [16.5, -22], [3.7, -13.6], [1.2, -5.2], [2.0, -4.6], [5.5, -2.4], [5.5, 0.5],
    ],
    matDirt,
    0.004
  );

  // distant tree line and haze band
  box(400, 1.2, 2, M(0x56664a), scene, 0, 0.6, -95);
  box(60, 0.9, 2, M(0x5d6a4a), scene, -40, 0.45, -70);

  // ---- farmhouse (gable front faces camera, facade plane z = -26)
  const matWall = M(0xd8d8d0);
  const matWallShade = M(0xa9a8a0);
  const matRoof = M(0x5e5751);
  const matRust = M(0x7c5646);
  const matWin = M(0x474a49);
  const house = new THREE.Group();
  scene.add(house);
  box(6.7, 2.95, 7, matWall, house, 0, 1.475, -29.5);
  {
    const s = new THREE.Shape();
    s.moveTo(-3.4, 0);
    s.lineTo(3.4, 0);
    s.lineTo(0, 1.65);
    s.lineTo(-3.4, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 7.2, bevelEnabled: false });
    const gable = new THREE.Mesh(g, matWall);
    gable.position.set(0, 2.95, -33.2);
    house.add(gable);
    const slope = Math.atan2(1.65, 3.45);
    const L = Math.hypot(1.65, 3.45) + 0.25;
    const r1 = box(L, 0.1, 7.6, matRoof, house, -1.72, 3.82, -29.5);
    r1.rotation.z = slope;
    const r2 = box(L, 0.1, 7.6, matRoof, house, 1.72, 3.82, -29.5);
    r2.rotation.z = -slope;
  }
  box(0.7, 0.95, 0.06, matWin, house, -1.75, 2.05, -25.98);
  box(0.7, 0.98, 0.06, matWin, house, 1.77, 2.04, -25.98);
  // right lean-to extension
  box(1.1, 2.65, 6, matWallShade, house, 3.9, 1.325, -29.5);
  {
    const r = box(1.5, 0.12, 6.2, matRust, house, 3.95, 2.8, -29.4);
    r.rotation.z = -0.32;
  }
  // left porch wing
  box(3.55, 2.45, 5, M(0xa3a29a), house, -5.12, 1.225, -29.7);
  box(0.7, 2.0, 0.05, M(0x34443c), house, -3.95, 1.05, -27.17);
  box(0.5, 0.8, 0.05, M(0x3e403f), house, -5.6, 1.6, -27.17);
  {
    const pr = box(3.9, 0.1, 1.75, matRust, house, -5.12, 2.86, -26.55);
    pr.rotation.x = 0.53;
  }
  box(3.7, 0.4, 1.3, M(0x7d776d), house, -5.12, 0.2, -26.55);
  {
    const postMat = M(0xa9a8a0);
    for (const px of [-6.65, -4.85]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.45, 8), postMat);
      p.position.set(px, 1.22, -25.9);
      house.add(p);
    }
  }
  box(0.55, 1.3, 0.55, M(0x6b4b40), house, -5.7, 3.25, -28.6); // chimney

  // weeds / bushes around the house base
  {
    const bushMat = M(0x4f6038);
    const dryMat = M(0x8b7a55);
    const bush = (x, z, sx, sy, sz, mat) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
      b.scale.set(sx, sy, sz);
      b.position.set(x, sy * 0.35, z);
      scene.add(b);
    };
    bush(0.8, -22, 0.8, 0.75, 0.6, bushMat);
    bush(2.4, -21.5, 0.9, 0.55, 0.6, bushMat);
    bush(-2.4, -21, 0.7, 0.8, 0.5, dryMat);
    bush(-6.5, -22, 1.4, 0.35, 0.8, dryMat);
    bush(-10.5, -24, 1.6, 0.4, 0.9, bushMat);
    bush(6.5, -22, 1.2, 0.4, 0.6, bushMat);
  }

  // dead tree (left) and broken stump
  {
    const treeMat = M(0x777066);
    const tree = new THREE.Group();
    tree.position.set(-8.1, 0, -25);
    scene.add(tree);
    segment([0, 0, 0], [0.1, 5.0, 0], 0.2, 0.07, treeMat, tree);
    segment([0.05, 2.0, 0], [2.5, 3.1, 0], 0.08, 0.03, treeMat, tree);
    segment([2.5, 3.1, 0], [3.7, 3.5, 0], 0.03, 0.015, treeMat, tree);
    segment([0.08, 3.5, 0], [1.0, 4.6, 0], 0.06, 0.02, treeMat, tree);
    segment([0.1, 4.2, 0], [-0.7, 5.0, 0], 0.05, 0.02, treeMat, tree);
    segment([0.05, 2.6, 0], [-1.0, 3.3, 0], 0.05, 0.02, treeMat, tree);
    segment([-6.4 + 8.1, 0, 7], [-6.85 + 8.1, 1.1, 7], 0.1, 0.06, treeMat, tree);
  }

  // background sheds on the right
  {
    const shedMat = M(0x7a7368);
    const shedRoof = M(0x574c45);
    box(3.9, 1.6, 3, shedMat, scene, 11.5, 0.8, -41.5);
    const r = box(4.3, 0.15, 3.4, shedRoof, scene, 11.5, 1.72, -41.5);
    r.rotation.z = 0.06;
    box(1.1, 1.2, 1.2, M(0x6b4535), scene, 8.8, 0.6, -40);
    box(2.6, 1.8, 2.5, M(0x6d655b), scene, 12.3, 0.9, -30);
    const r2 = box(2.9, 0.15, 2.8, shedRoof, scene, 12.3, 1.9, -30);
    r2.rotation.z = -0.1;
  }

  // ---------------------------------------------------------------- woman (seated, static base)
  const matSkinW = M(0xd6a68a);
  const matSkirt = M(0xe7e3dc);
  const matBlouse = M(0xd9c6aa);
  const matHairW = M(0xb8975f);
  const woman = new THREE.Group();
  woman.position.set(-0.45, 0, -5.0);
  woman.rotation.y = 1.3; // facing image-right, slightly toward camera
  scene.add(woman);
  box(0.36, 0.2, 0.36, matSkirt, woman, 0, 0.1, 0);
  box(0.46, 0.07, 0.5, matSkirt, woman, 0, 0.035, 0.08);
  for (const s of [-1, 1]) {
    const hip = [s * 0.09, 0.13, 0.06];
    const knee = [s * 0.085, 0.34, 0.41];
    const ankle = [s * 0.08, 0.08, 0.74];
    const mid = [lerp(knee[0], ankle[0], 0.6), lerp(knee[1], ankle[1], 0.6), lerp(knee[2], ankle[2], 0.6)];
    segment(hip, knee, 0.1, 0.085, matSkirt, woman);
    segment(knee, mid, 0.09, 0.095, matSkirt, woman);
    segment(mid, ankle, 0.04, 0.035, matSkinW, woman);
    const foot = box(0.08, 0.06, 0.2, matSkinW, woman, s * 0.08, 0.04, 0.81);
    foot.rotation.x = -0.2;
  }
  const wTorso = new THREE.Group();
  wTorso.position.set(0, 0.18, -0.03);
  wTorso.rotation.x = 0.5;
  woman.add(wTorso);
  box(0.34, 0.44, 0.2, matBlouse, wTorso, 0, 0.22, 0);
  {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.1, 8), matSkinW);
    n.position.set(0, 0.48, 0.01);
    wTorso.add(n);
  }
  const wHead = new THREE.Group();
  wHead.position.set(0, 0.5, 0.03);
  wTorso.add(wHead);
  {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), matSkinW);
    h.position.set(0, 0.09, 0.02);
    wHead.add(h);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), matHairW);
    hair.position.set(0, 0.115, -0.015);
    wHead.add(hair);
    box(0.24, 0.3, 0.09, matHairW, wHead, 0, -0.03, -0.075);
    box(0.035, 0.2, 0.13, matHairW, wHead, -0.095, 0.03, 0.03);
    box(0.035, 0.2, 0.13, matHairW, wHead, 0.095, 0.03, 0.03);
  }
  // woman arms: dynamic segments in her root frame (shoulder -> elbow -> hand),
  // so forearms can fold across the knees and the near hand can reach her face
  const _d = new THREE.Vector3();
  function dynSeg(r0, r1, mat) {
    const g = new THREE.CylinderGeometry(r1, r0, 1, 10);
    const m = new THREE.Mesh(g, mat);
    woman.add(m);
    return m;
  }
  function placeSeg(m, A, B) {
    _d.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const len = Math.max(1e-4, _d.length());
    m.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
    m.quaternion.setFromUnitVectors(UP, _d.normalize());
    m.scale.set(1, len, 1);
  }
  function makeWomanArm(sh) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), matBlouse);
    puff.position.set(sh[0], sh[1] - 0.02, sh[2]);
    woman.add(puff);
    const up = dynSeg(0.045, 0.038, matSkinW);
    const fo = dynSeg(0.037, 0.03, matSkinW);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), matSkinW);
    hand.scale.set(1, 0.8, 1.4);
    woman.add(hand);
    return { sh, up, fo, hand };
  }
  function poseWomanArm(arm, E, Hd) {
    placeSeg(arm.up, arm.sh, E);
    placeSeg(arm.fo, E, Hd);
    arm.hand.position.set(Hd[0], Hd[1], Hd[2]);
  }
  const wArmR = makeWomanArm([-0.19, 0.53, 0.16]); // her right = near side (toward camera)
  const wArmL = makeWomanArm([0.19, 0.53, 0.16]);

  // ---------------------------------------------------------------- man (articulated)
  const matShirt = M(0x91a6d4);
  const matPants = M(0x5c3a27);
  const matShoe = M(0x43281a);
  const matSkinM = M(0xc28c6c);
  const matHairM = M(0x3a2a20);
  const man = new THREE.Group();
  scene.add(man);
  const pelvis = box(0.34, 0.22, 0.24, matPants, man, 0, 0.95, 0);
  const torso = new THREE.Group();
  man.add(torso);
  box(0.37, 0.5, 0.24, matShirt, torso, 0, 0.25, 0);
  {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), matSkinM);
    n.position.set(0, 0.54, 0.01);
    torso.add(n);
  }
  const mHead = new THREE.Group();
  mHead.position.set(0, 0.56, 0.01);
  torso.add(mHead);
  {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), matSkinM);
    h.position.set(0, 0.11, 0.01);
    mHead.add(h);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 12), matHairM);
    hair.scale.set(1, 0.7, 1);
    hair.position.set(0, 0.15, -0.02);
    mHead.add(hair);
  }
  const ARM_L1 = 0.35, ARM_L2 = 0.32;
  const SH_Y = 0.47, SH_X = 0.225;
  function makeManArm(s) {
    const up = new THREE.Group();
    up.position.set(s * SH_X, SH_Y, 0);
    torso.add(up);
    up.add(new THREE.Mesh(limbGeo(0.07, 0.064, 0.17), matShirt));
    up.add(new THREE.Mesh(limbGeo(0.05, 0.045, ARM_L1), matSkinM));
    const fo = new THREE.Group();
    fo.position.set(0, -ARM_L1, 0);
    up.add(fo);
    fo.add(new THREE.Mesh(limbGeo(0.045, 0.038, ARM_L2), matSkinM));
    box(0.06, 0.13, 0.09, matSkinM, fo, 0, -ARM_L2 - 0.06, 0);
    return { up, fo };
  }
  const mArmR = makeManArm(-1);
  const mArmL = makeManArm(1);
  const LEG_L1 = 0.47, LEG_L2 = 0.46, ANKLE = 0.09;
  function makeManLeg(s) {
    const hip = new THREE.Group();
    man.add(hip);
    hip.add(new THREE.Mesh(limbGeo(0.09, 0.078, LEG_L1), matPants));
    const shin = new THREE.Group();
    shin.position.set(0, -LEG_L1, 0);
    hip.add(shin);
    shin.add(new THREE.Mesh(limbGeo(0.075, 0.082, LEG_L2), matPants));
    const foot = new THREE.Group();
    foot.position.set(0, -LEG_L2, 0);
    shin.add(foot);
    box(0.11, 0.09, 0.28, matShoe, foot, 0, -0.045, 0.07);
    return { s, hip, shin, foot };
  }
  const mLegR = makeManLeg(-1);
  const mLegL = makeManLeg(1);

  // ---------------------------------------------------------------- timing data
  // man feet-centre path: [t, x, depth]; world z = -depth (observed from foot
  // positions in the samples, linear between, ~0.77 m/s walk)
  const PATH = [
    [0.0, 0.8, 0.8],
    [1.08, 0.78, 1.63],
    [2.21, 0.7, 2.5],
    [3.29, 0.71, 3.33],
    [4.38, 0.75, 4.17],
    [5.2, 0.83, 4.8],
    [5.7, 0.86, 5.05],
    [6.1, 0.76, 5.15],
    [6.6, 0.64, 5.12],
    [7.2, 0.61, 5.1],
    [7.7, 0.56, 5.1],
    [8.3, 0.47, 5.1],
    [20.0, 0.47, 5.1],
  ];
  const CUM = [0];
  for (let i = 1; i < PATH.length; i++) {
    CUM.push(CUM[i - 1] + Math.hypot(PATH[i][1] - PATH[i - 1][1], PATH[i][2] - PATH[i - 1][2]));
  }
  function pathDist(t) {
    if (t <= PATH[0][0]) return 0;
    for (let i = 0; i < PATH.length - 1; i++) {
      if (t <= PATH[i + 1][0]) {
        const u = (t - PATH[i][0]) / (PATH[i + 1][0] - PATH[i][0]);
        return lerp(CUM[i], CUM[i + 1], u);
      }
    }
    return CUM[CUM.length - 1];
  }
  const PATH_XZ = PATH.map((p) => [p[0], p[1], p[2]]);
  const WALK = [[0, 1], [5.2, 1], [6.1, 0.6], [6.7, 0.25], [8.3, 0.2], [8.6, 0], [20, 0]];
  const YAW = [[0, Math.PI], [5.2, Math.PI], [6.1, 1.5 * Math.PI], [7.3, 4.85], [8.2, 5.55], [9.8, 5.7], [11, 5.75], [20, 5.75]];
  // [t, hipY, hipZ, torsoPitch]
  const POSE = [
    [0, 0.95, 0, 0.06],
    [7.9, 0.95, 0, 0.06],
    [8.22, 0.95, -0.02, 0.15],
    [8.76, 0.94, -0.05, 0.28],
    [9.3, 0.92, -0.08, 0.42],
    [9.84, 0.89, -0.12, 0.75],
    [10.39, 0.8, -0.18, 1.12],
    [10.97, 0.52, -0.24, 0.98],
    [11.5, 0.46, -0.25, 0.95],
    [20, 0.45, -0.25, 0.95],
  ];
  const IKW = [[0, 0], [8.1, 0], [8.75, 1], [20, 1]];
  const THIGH_S = [[0, 0.3], [8.2, 0.35], [9.3, 0.7], [10.0, 1.0], [20, 1.0]];
  const GROUND_HAND = [[0, 0], [10.45, 0], [10.97, 1], [20, 1]];
  const SPREAD = [[0, 0.09], [10.2, 0.09], [10.9, 0.14], [20, 0.14]];
  const HEADYAW = [[0, 0], [10.4, 0], [11.2, -0.3], [20, -0.3]];

  const CYCLE = 1.1; // metres per gait cycle (two steps)
  function footPattern(q) {
    if (q < 0.6) return { z: 0.3 - (q / 0.6) * 0.6, lift: 0 };
    const s = (q - 0.6) / 0.4;
    return { z: -0.3 + 0.6 * smooth(s), lift: 0.11 * Math.sin(Math.PI * s) };
  }

  function poseLeg(leg, hipY, hipZ, spread, ankY, ankZ) {
    leg.hip.position.set(leg.s * 0.1, hipY, hipZ);
    const r = ik2(hipY, hipZ, ankY, ankZ, LEG_L1, LEG_L2, 1);
    leg.hip.rotation.set(-r.a1, 0, 0);
    leg.shin.rotation.set(-(r.a2 - r.a1), 0, 0);
    leg.foot.rotation.set(r.a2, 0, 0);
    // slight splay so feet sit at the requested lateral spread
    leg.hip.rotation.z = leg.s * Math.atan2(spread - 0.1, LEG_L1 + LEG_L2);
    return r;
  }

  // ---------------------------------------------------------------- update
  function update(time, frame) {
    const t = clamp(time, 0, DUR);

    // ----- camera (single locked shot)
    camera.position.set(0, CAM_H, 0);
    camera.rotation.set(CAM_PITCH, 0, 0);

    // ----- woman
    {
      const u = smooth(clamp((t - 2.85) / 0.45, 0, 1)); // hand drops from face to knees
      const Pw = 0.5;
      wTorso.rotation.x = Pw;
      wHead.rotation.set(lerp(0.32, 0.45, u), lerp(0.08, 0, u), 0);
      const L3 = (A, B) => [lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)];
      // near arm: elbow on knee, hand at face (A) -> forearm across the knees (B)
      poseWomanArm(wArmR, L3([-0.14, 0.36, 0.37], [-0.16, 0.36, 0.39]), L3([-0.03, 0.62, 0.37], [0.03, 0.41, 0.47]));
      poseWomanArm(wArmL, [0.17, 0.36, 0.39], [0.0, 0.40, 0.48]);
    }

    // ----- man root
    const pxz = keySmooth(PATH_XZ, t);
    man.position.set(pxz[0], 0, -pxz[1]);
    man.rotation.set(0, key1s(YAW, t), 0);
    const w = key1(WALK, t);
    const phase = pathDist(t) / CYCLE;
    const pose = keySmooth(POSE, t);
    let hipY = pose[0] - 0.02 * w * (0.5 - 0.5 * Math.cos(4 * Math.PI * phase));
    const hipZ = pose[1];
    const P = pose[2];
    const spread = key1(SPREAD, t);

    pelvis.position.set(0, hipY + 0.03, hipZ);
    pelvis.rotation.set(P * 0.25, 0, 0);
    torso.position.set(0, hipY + 0.05, hipZ);
    torso.rotation.set(P, 0, 0);
    mHead.rotation.set(-0.45 * P, key1s(HEADYAW, t), 0);

    const fL = footPattern(frac(phase));
    const fR = footPattern(frac(phase + 0.5));
    const rL = poseLeg(mLegL, hipY, hipZ, spread, ANKLE + w * fL.lift, w * fL.z);
    const rR = poseLeg(mLegR, hipY, hipZ, spread, ANKLE + w * fR.lift, w * fR.z);

    // ----- arms: FK swing while walking/standing, IK to thighs/knees/ground when bending
    const ikw = smooth(clamp(key1(IKW, t), 0, 1));
    const shY = hipY + 0.05 + SH_Y * Math.cos(P);
    const shZ = hipZ + SH_Y * Math.sin(P);
    const sThigh = key1(THIGH_S, t);
    const gnd = smooth(clamp(key1(GROUND_HAND, t), 0, 1));
    function armAngles(legR, footOpp, isLeft) {
      const fkU = 0.9 * w * footOpp.z + 0.04;
      const fkL = fkU + 0.22;
      // target along front of the same-side thigh
      const ky = lerp(hipY, legR.ey, sThigh) + 0.05;
      const kz = lerp(hipZ, legR.ez, sThigh) + 0.07;
      let ty = ky, tz = kz;
      // both hands come down to the ground in front of the feet in the crouch
      ty = lerp(ky, 0.13, gnd);
      tz = lerp(kz, isLeft ? 0.2 : 0.17, gnd);
      const r = ik2(shY, shZ, ty, tz, ARM_L1, ARM_L2, -1);
      return [lerp(fkU, r.a1, ikw), lerp(fkL, r.a2, ikw)];
    }
    const aR = armAngles(rR, fL, false);
    const aL = armAngles(rL, fR, true);
    mArmR.up.rotation.set(-aR[0] - P, 0, -0.06);
    mArmR.fo.rotation.set(-(aR[1] - aR[0]), 0, 0);
    mArmL.up.rotation.set(-aL[0] - P, 0, 0.06);
    mArmL.fo.rotation.set(-(aL[1] - aL[0]), 0, 0);
  }

  update(0, 0);
  return { scene, camera, update };
}
