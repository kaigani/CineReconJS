// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video7.
// A jogger runs along the inner floor of a rotating centrifuge drum. The jogger stays
// at the bottom of the drum (world origin, facing -Z); the drum (floor, end walls,
// consoles, chairs, hibernation pods) rotates about its X axis underneath him, which
// is equivalent to him running around the ring. Three shots with hard cuts.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const RA = 5.5;       // drum radius of the console sector set (shot 1)
  const RB = 3.2;       // drum radius of the hibernation sector set (shots 2, 3)
  let R = RA;           // radius used by the builders below while constructing
  const HW = 2.6;       // half width of drum (end walls at x = +-HW)
  const T12 = 7.85;     // cut: high rear follow -> low frontal
  const T23 = 15.1;     // cut: low frontal -> low rear follow
  const FOV = 50;
  const rev = parseInt(THREE.REVISION, 10) || 0;
  const LS = rev >= 155 ? Math.PI : 1; // light-unit scale for physically based lights
  const D2R = Math.PI / 180;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1e24);
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.03, 200);
  camera.rotation.order = 'YXZ';

  const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const M = {
    floor: lam(0xe0e5ea, { side: THREE.BackSide }),
    endWall: lam(0xcfd6de),
    cabinet: lam(0xe6eaee),
    dark: lam(0x1b2027),
    seam: lam(0x8f99a4),
    chair: lam(0x141518),
    podFrame: lam(0x232a33),
    pod: lam(0xf1f2f3),
    window: basic(0xbfe2ff),
    lightPanel: basic(0xfbfdff),
    screen: basic(0xdfeaff),
    redLamp: basic(0xff5a3c),
    cyanLamp: basic(0x8fe8ff),
    skin: lam(0xd6a28a),
    shirt: lam(0x15171b),
    shorts: lam(0xf1f1ee),
    sock: lam(0xf6f6f6),
    hair: lam(0x221912),
  };

  // ---------------- drums (rotating) ----------------
  function makeDrum(radius) {
    const pivot = new THREE.Group();
    pivot.position.set(0, radius, 0);
    scene.add(pivot);
    const drum = new THREE.Group();
    pivot.add(drum);
    const floorGeo = new THREE.CylinderGeometry(radius, radius, 2 * HW, 192, 1, true);
    floorGeo.rotateZ(Math.PI / 2);
    drum.add(new THREE.Mesh(floorGeo, M.floor));
    const capL = new THREE.CircleGeometry(radius, 96); capL.rotateY(Math.PI / 2);
    const capR = new THREE.CircleGeometry(radius, 96); capR.rotateY(-Math.PI / 2);
    const capLm = new THREE.Mesh(capL, M.endWall); capLm.position.x = -HW; drum.add(capLm);
    const capRm = new THREE.Mesh(capR, M.endWall); capRm.position.x = HW; drum.add(capRm);
    return { pivot, drum };
  }
  const DA = makeDrum(RA);
  const DB = makeDrum(RB);
  const secA = DA.drum; // galley / console sector (shot 1)
  const secB = DB.drum; // hibernation sector (shots 2, 3)

  // Box bent along the drum floor: lateral center xc, width wx, heights h0..h1 above the
  // floor, drum angles a0..a1 (angle increases in the running direction).
  function bendBox(parent, xc, wx, h0, h1, a0, a1, mat) {
    const arc = a1 - a0;
    const nseg = Math.max(1, Math.ceil(Math.abs(arc) * 24));
    const g = new THREE.BoxGeometry(wx, h1 - h0, 1, 1, 1, nseg);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const a = a0 + (0.5 - z) * arc;
      const h = h0 + (y + (h1 - h0) / 2);
      const r = R - h;
      pos.setXYZ(i, xc + x, -r * Math.cos(a), -r * Math.sin(a));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    parent.add(m);
    return m;
  }
  // Place an object standing on the floor at drum angle a, lateral x, height h, yaw.
  function place(parent, obj, a, x, h, yaw) {
    const r = R - (h || 0);
    obj.position.set(x, -r * Math.cos(a), -r * Math.sin(a));
    obj.rotation.set(a, yaw || 0, 0);
    parent.add(obj);
    return obj;
  }
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function makeChair() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.05, 16), M.chair);
    base.position.y = 0.025; g.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), M.chair);
    post.position.y = 0.25; g.add(post);
    g.add(box(0.56, 0.16, 0.56, M.chair, 0, 0.52, 0));
    g.add(box(0.58, 0.8, 0.18, M.chair, 0, 0.96, 0.24));
    g.add(box(0.1, 0.22, 0.45, M.chair, 0.3, 0.68, 0.02));
    g.add(box(0.1, 0.22, 0.45, M.chair, -0.3, 0.68, 0.02));
    return g;
  }
  function makePodCapsule() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.pod);
    s.scale.set(0.32, 0.26, 0.95);
    s.position.y = 0.3;
    g.add(s);
    return g;
  }
  function pod(parent, a, x) {
    const half = 1.1 / R; // ~2.2 m long recess
    bendBox(parent, x, 0.9, 0.0, 0.34, a - half, a + half, M.podFrame);
    place(parent, makePodCapsule(), a, x, 0.05, 0);
    const d = new THREE.Group();   // head-end status display
    d.add(box(0.5, 0.24, 0.06, M.dark, 0, 0.12, 0));
    d.add(box(0.38, 0.13, 0.02, M.cyanLamp, 0, 0.13, -0.035));
    place(parent, d, a + half + 0.03, x, 0.34, 0);
  }

  // center seam on the walkway (console set)
  R = RA;
  bendBox(secA, 0, 0.025, 0.0, 0.004, 0, Math.PI * 2, M.seam);

  // ----- sector A (shot 1): galley / control consoles; seen for alpha ~ -0.4..2.7 -----
  // left (-x)
  bendBox(secA, -1.9, 1.3, 0, 1.7, -1.2, 0.35, M.cabinet);              // tall cabinets
  bendBox(secA, -1.38, 0.04, 0.3, 1.5, -0.6, -0.45, M.dark);
  bendBox(secA, -1.38, 0.04, 0.3, 1.5, -0.1, 0.05, M.dark);
  bendBox(secA, -1.85, 1.3, 0, 0.8, 0.35, 1.8, M.cabinet);              // console desk
  bendBox(secA, -2.0, 0.8, 0.8, 0.86, 0.38, 1.77, M.dark);              // desk top panel
  bendBox(secA, -2.4, 0.4, 0.86, 1.5, 0.35, 1.8, M.dark);               // instrument back panel
  bendBox(secA, -2.0, 1.2, 1.5, 1.72, 0.35, 1.8, M.cabinet);            // hood
  bendBox(secA, -2.18, 0.04, 1.0, 1.25, 0.5, 0.62, M.redLamp);
  bendBox(secA, -2.18, 0.04, 0.95, 1.3, 0.95, 1.1, M.screen);
  bendBox(secA, -2.18, 0.04, 1.0, 1.25, 1.4, 1.5, M.redLamp);
  bendBox(secA, -1.9, 1.3, 0, 1.7, 1.8, 4.5, M.cabinet);
  bendBox(secA, -1.23, 0.04, 0.4, 1.5, 2.0, 2.2, M.dark);
  bendBox(secA, -1.23, 0.04, 0.4, 1.5, 2.5, 2.7, M.dark);
  for (const a of [0.8, 1.4]) place(secA, makeChair(), a, -0.8, 0, Math.PI / 2);
  // right (+x)
  bendBox(secA, 1.2, 0.5, 0, 0.62, -0.3, -0.05, M.cabinet);             // keypad box
  bendBox(secA, 1.2, 0.4, 0.62, 0.66, -0.28, -0.07, M.dark);
  bendBox(secA, 1.18, 0.03, 0.66, 0.68, -0.22, -0.12, M.cyanLamp);
  bendBox(secA, 1.95, 1.3, 0, 1.9, -1.2, 0.2, M.cabinet);
  bendBox(secA, 2.5, 0.2, 0, 1.9, 0.2, 0.6, M.cabinet);                 // washroom alcove back
  bendBox(secA, 2.15, 0.6, 0.72, 0.88, 0.26, 0.55, M.cabinet);          // sink counter
  bendBox(secA, 1.95, 1.3, 1.9, 2.0, 0.2, 0.6, M.cabinet);              // alcove ceiling
  bendBox(secA, 2.05, 0.7, 1.87, 1.9, 0.28, 0.5, M.lightPanel);         // alcove ceiling light
  bendBox(secA, 1.95, 1.3, 0, 1.9, 0.6, 1.0, M.cabinet);
  bendBox(secA, 1.7, 1.1, 0, 0.5, 1.0, 2.35, M.cabinet);                // console desk
  bendBox(secA, 1.85, 0.9, 0.5, 1.4, 1.0, 2.35, M.dark);                // dark instrument bank
  bendBox(secA, 1.95, 1.3, 1.4, 1.62, 1.0, 2.35, M.cabinet);            // hood
  for (const a of [1.1, 1.35, 1.6, 1.85, 2.1]) bendBox(secA, 1.39, 0.03, 0.8, 1.15, a, a + 0.1, M.screen);
  for (const a of [1.33, 1.5, 2.13]) place(secA, makeChair(), a, 0.65, 0, -Math.PI / 2);
  bendBox(secA, 1.95, 1.3, 0, 1.9, 2.35, 4.5, M.cabinet);
  bendBox(secA, 1.28, 0.04, 0.5, 1.0, 2.5, 2.62, M.dark);
  bendBox(secA, 1.28, 0.04, 0.5, 1.0, 2.8, 2.92, M.dark);

  // ----- sector B (shots 2, 3): hibernation pods (smaller drum) -----
  R = RB;
  bendBox(secB, 0, 0.025, 0.0, 0.004, 0, Math.PI * 2, M.seam);
  for (const a of [0.0, 1.82, 2.65]) pod(secB, a, 1.35);
  for (const a of [0.53, 2.47]) pod(secB, a, -1.35);
  bendBox(secB, 2.3, 0.6, 0, 1.8, -2.6, 3.85, M.cabinet);              // side cabinets
  bendBox(secB, -2.3, 0.6, 0, 1.8, -2.6, 3.55, M.cabinet);
  bendBox(secB, 2.3, 0.6, 0, 1.8, 4.35, 6.0, M.cabinet);
  bendBox(secB, -2.3, 0.6, 0, 1.8, 3.95, 6.0, M.cabinet);
  bendBox(secB, 1.99, 0.03, 0.7, 1.4, -1.0, -0.75, M.dark);
  bendBox(secB, -1.99, 0.03, 0.7, 1.4, 1.1, 1.35, M.dark);
  bendBox(secB, 1.99, 0.03, 0.6, 1.2, 1.15, 1.3, M.dark);
  bendBox(secB, -1.99, 0.03, 0.6, 1.2, 1.7, 1.85, M.dark);
  bendBox(secB, 1.99, 0.03, 1.3, 1.6, 0.6, 0.85, M.lightPanel);
  bendBox(secB, -1.99, 0.03, 1.3, 1.6, 2.7, 2.95, M.lightPanel);
  bendBox(secB, 1.6, 0.8, 0, 0.8, 3.85, 4.35, M.cabinet);               // +x console
  bendBox(secB, 1.6, 0.7, 0.8, 0.85, 3.87, 4.33, M.dark);
  bendBox(secB, 2.3, 0.6, 0.85, 1.6, 3.85, 4.35, M.cabinet);
  bendBox(secB, 1.99, 0.03, 0.95, 1.4, 3.95, 4.25, M.dark);
  bendBox(secB, -1.6, 0.8, 0, 0.8, 3.55, 3.95, M.cabinet);              // -x console
  bendBox(secB, -1.6, 0.7, 0.8, 0.85, 3.57, 3.93, M.dark);
  bendBox(secB, -2.3, 0.6, 0.85, 1.6, 3.55, 3.95, M.dark);
  // two loose swivel chairs; each is only present in the shot where it is observed
  const chairS2 = place(secB, makeChair(), 4.05, -0.75, 0, Math.PI / 2);
  const chairS3 = place(secB, makeChair(), 3.95, 0.75, 0, -Math.PI / 2);

  // ---------------- overhead hub housings (non-rotating) ----------------
  // Two large rounded overhead housings: an outer hood, a lighter oval face with a dark
  // rim ring, and the blue skylight glow. They do not rotate with the drum; their
  // placement is set per shot (FIX) to hold the composition observed in each shot.
  const discGeo = new THREE.CircleGeometry(1, 64);
  const ringGeo = new THREE.RingGeometry(0.84, 0.9, 64);
  const hoodMat = new THREE.MeshBasicMaterial({ color: 0xc9ccd0 });
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xdcdfe2 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x7a838e });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xbfe2ff });
  const fixtures = [];
  for (let i = 0; i < 2; i++) {
    const fx = {
      hood: new THREE.Mesh(discGeo, hoodMat),
      glow: new THREE.Mesh(discGeo, glowMat),
      face: new THREE.Mesh(discGeo, faceMat),
      rim: new THREE.Mesh(ringGeo, rimMat),
    };
    for (const k in fx) scene.add(fx[k]);
    fixtures.push(fx);
  }
  // [cu, cv, ru, rv] in normalized image units; glow has an extra depth offset
  const FIX = {
    1: { d: 1.8,
      L: { hood: [0.19, -0.06, 0.2, 0.43], glow: [0.17, 0.04, 0.075, 0.2, -0.01], face: [0.27, 0.0, 0.105, 0.32] },
      R: { hood: [0.8, -0.06, 0.22, 0.45], glow: [0.76, 0.07, 0.08, 0.22, -0.01], face: [0.65, 0.0, 0.075, 0.3] } },
    2: { d: 2.0,
      L: { hood: [0.29, 0.1, 0.116, 0.375], glow: [0.24, 0.3, 0.09, 0.2, 0.4], face: [0.29, 0.1, 0.11, 0.36] },
      R: { hood: [0.69, 0.1, 0.116, 0.375], glow: [0.78, 0.15, 0.13, 0.33, 0.4], face: [0.69, 0.1, 0.11, 0.36] } },
    3: { d: 2.0,
      L: { hood: [0.177, 0.03, 0.142, 0.355], glow: [0.04, 0.12, 0.08, 0.22, 0.4], face: [0.177, 0.03, 0.135, 0.34] },
      R: { hood: [0.786, 0.04, 0.137, 0.365], glow: [0.9, 0.16, 0.12, 0.3, 0.4], face: [0.786, 0.04, 0.13, 0.35] } },
  };
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
  function placeImg(mesh, p, d) {
    const [cu, cv, ru, rv] = p;
    const tv = Math.tan(camera.fov * D2R / 2), th = tv * camera.aspect;
    _f.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _r.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    mesh.position.copy(camera.position)
      .addScaledVector(_f, d)
      .addScaledVector(_r, (cu - 0.5) * 2 * th * d)
      .addScaledVector(_u, (0.5 - cv) * 2 * tv * d);
    mesh.quaternion.copy(camera.quaternion);
    mesh.scale.set(ru * 2 * th * d, rv * 2 * tv * d, 1);
  }
  function setFixtures(shot) {
    const F = FIX[shot];
    const sides = [F.L, F.R];
    for (let i = 0; i < 2; i++) {
      const S = sides[i], fx = fixtures[i];
      placeImg(fx.hood, S.hood, F.d);
      placeImg(fx.glow, S.glow, F.d + S.glow[4]);
      placeImg(fx.face, S.face, F.d - 0.02);
      placeImg(fx.rim, S.face, F.d - 0.03);
    }
  }

  // ---------------- lights ----------------
  const amb = new THREE.AmbientLight(0xffffff, 0.4 * LS);
  scene.add(amb);
  const axisLight = new THREE.PointLight(0xffffff, 0.5 * LS, 0, 0);
  axisLight.position.set(0, R, 0);
  scene.add(axisLight);
  const key = new THREE.DirectionalLight(0xffffff, 0.22 * LS);
  key.position.set(0.4, 1, 1);
  scene.add(key);
  scene.add(key.target);

  // ---------------- jogger (articulated proxy) ----------------
  function limb(len, r0, r1, mat) {
    const g = new THREE.CylinderGeometry(r0, r1, len, 12);
    g.translate(0, -len / 2, 0);
    return new THREE.Mesh(g, mat);
  }
  const J = {};
  J.root = new THREE.Group();
  scene.add(J.root);
  J.hips = new THREE.Group(); J.root.add(J.hips);
  J.hips.add(box(0.36, 0.27, 0.25, M.shorts, 0, -0.05, 0));
  J.torso = new THREE.Group(); J.torso.position.y = 0.07; J.hips.add(J.torso);
  J.torso.add(box(0.38, 0.52, 0.22, M.shirt, 0, 0.27, 0));
  const neck = limb(0.09, 0.05, 0.05, M.skin); neck.position.y = 0.62; J.torso.add(neck);
  J.head = new THREE.Group(); J.head.position.y = 0.6; J.torso.add(J.head);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), M.skin);
  headM.scale.set(0.95, 1.12, 1.0); headM.position.y = 0.13; J.head.add(headM);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), M.hair);
  hairM.scale.set(1.0, 0.85, 1.02); hairM.position.set(0, 0.18, 0.015); J.head.add(hairM);
  function makeArm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.225, 0.47, 0); J.torso.add(sh);
    sh.add(limb(0.13, 0.062, 0.058, M.shirt));
    sh.add(limb(0.28, 0.047, 0.041, M.skin));
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    el.add(limb(0.25, 0.04, 0.034, M.skin));
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.skin);
    fist.position.y = -0.27; el.add(fist);
    return { sh, el };
  }
  function makeLeg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.08, 0); J.hips.add(hip);
    hip.add(limb(0.43, 0.078, 0.056, M.skin));
    const knee = new THREE.Group(); knee.position.y = -0.43; hip.add(knee);
    knee.add(limb(0.32, 0.056, 0.04, M.skin));
    const sock = limb(0.1, 0.042, 0.04, M.sock); sock.position.y = -0.32; knee.add(sock);
    const ankle = new THREE.Group(); ankle.position.y = -0.42; knee.add(ankle);
    ankle.add(box(0.1, 0.07, 0.25, M.sock, 0, -0.01, -0.06));
    return { hip, knee, ankle };
  }
  J.armR = makeArm(1); J.armL = makeArm(-1);
  J.legR = makeLeg(1); J.legL = makeLeg(-1);

  const pulse = (t, tc, hw) => {
    const d = Math.abs(t - tc);
    return d < hw ? 0.5 * (1 + Math.cos(Math.PI * d / hw)) : 0;
  };
  // raised-fist / punch events (time, half width); right = +x arm, left = -x arm
  const punchesR = [[4.17, 0.45], [8.9, 0.28], [10.43, 0.3], [12.05, 0.28], [13.9, 0.26]];
  const punchesL = [[1.04, 0.45], [9.65, 0.28], [11.48, 0.3], [13.05, 0.28], [14.6, 0.3]];
  const raiseOf = (list, t) => { let v = 0; for (const [c, w] of list) v = Math.max(v, pulse(t, c, w)); return v; };
  const lerp = (a, b, k) => a + (b - a) * k;

  function poseJogger(t, shot) {
    const f = shot === 1 ? 1.3 : 1.4;
    const p = 2 * Math.PI * f * t;
    const s = Math.sin(p), c = Math.cos(p);
    // shot 2 is a high-knee shadowboxing jog; shots 1 and 3 a normal run
    const hipMid = shot === 2 ? 0.35 : 0.05;
    const A = shot === 2 ? 0.6 : (shot === 1 ? 0.42 : 0.5);
    const kneeAmp = shot === 2 ? 1.5 : 1.3;
    J.legL.hip.rotation.x = hipMid + A * s;
    J.legR.hip.rotation.x = hipMid - A * s;
    J.legL.knee.rotation.x = -(0.25 + kneeAmp * Math.pow(Math.max(0, c), 1.2) + (shot === 2 ? 0.5 * Math.max(0, s) : 0));
    J.legR.knee.rotation.x = -(0.25 + kneeAmp * Math.pow(Math.max(0, -c), 1.2) + (shot === 2 ? 0.5 * Math.max(0, -s) : 0));
    J.legL.ankle.rotation.x = 0.15 * Math.max(0, c);
    J.legR.ankle.rotation.x = 0.15 * Math.max(0, -c);
    J.hips.position.y = (shot === 2 ? 0.93 : 0.97) - 0.03 * Math.cos(2 * p);
    J.hips.rotation.y = 0.06 * s;
    const lean = shot === 1 ? -0.2 : (shot === 2 ? -0.08 : -0.22);
    J.torso.rotation.set(lean, -0.1 * s, 0);
    J.head.rotation.set(shot === 2 ? 0.0 : 0.1, 0.06 * s, 0);
    const rR = raiseOf(punchesR, t), rL = raiseOf(punchesL, t);
    const arms = [[J.armR, 1, rR, s], [J.armL, -1, rL, -s]];
    for (const [arm, side, raise, sw] of arms) {
      let sx, sz, el, ez = 0;
      if (shot === 2) { sx = 0.25 + 0.1 * sw; sz = 0.3 * side; el = 1.95; ez = -0.6 * side; }
      else if (shot === 3) { sx = 0.35 * sw + 0.15; sz = 0.4 * side; el = 1.3; }
      else { sx = 0.45 * sw + 0.1; sz = 0.3 * side; el = 1.5; }
      sx = lerp(sx, 2.3, raise); sz = lerp(sz, 0.45 * side, raise); el = lerp(el, 1.0, raise); ez = lerp(ez, 0, raise);
      arm.sh.rotation.set(sx, 0, sz);
      arm.el.rotation.set(el, 0, ez);
    }
  }

  const colA = new THREE.Color(), colB = new THREE.Color();
  function update(time, frame) {
    const t = Math.max(0, time);
    const shot = t < T12 ? 1 : (t < T23 ? 2 : 3);
    // drum phase per shot (drum angle alpha appears at world angle alpha + rot)
    // (both sets move at about 1.0-1.2 m/s floor speed)
    DA.drum.rotation.x = -0.22 * t;
    if (shot === 2) DB.drum.rotation.x = -(3.53 + 0.3 * (t - 12.52));
    else DB.drum.rotation.x = -0.4 * (t - 22.83);
    DA.pivot.visible = shot === 1;
    DB.pivot.visible = shot !== 1;
    chairS2.visible = shot === 2;
    chairS3.visible = shot === 3;
    axisLight.position.set(0, shot === 1 ? RA : RB, 0);
    // in shot 2 the jogger slowly drops back from the retreating camera
    J.root.position.set(0, 0, shot === 2 ? 0.05 * (t - 8.35) : 0);

    if (shot === 1) {
      camera.position.set(0.05, 3.25, 2.95);
      camera.rotation.set(-31 * D2R, 0, 0);
      amb.color.set(0x8fa8cc); axisLight.color.set(0xd5e3f6); key.color.set(0xd0e0ff);
      amb.intensity = 0.3 * LS; axisLight.intensity = 0.75 * LS; key.intensity = 0.12 * LS;
      key.position.set(0.4, 1, 1);
      hoodMat.color.set(0x9db0c3); faceMat.color.set(0xb8c5d1); rimMat.color.set(0x56616e); glowMat.color.set(0x9fd8ff);
    } else if (shot === 2) {
      camera.position.set(0, 0.65, -1.1);
      camera.rotation.set((28.7 + 1.0 * (t - 8.35)) * D2R, Math.PI, 0);
      amb.color.set(0xeee8e2); axisLight.color.set(0xfff8f0); key.color.set(0xfff6ea);
      amb.intensity = 0.38 * LS; axisLight.intensity = 0.58 * LS; key.intensity = 0.25 * LS;
      key.position.set(0.3, 0.8, -1);
      hoodMat.color.set(0xb9bcc0); faceMat.color.set(0xd6d8da); rimMat.color.set(0x7c838b); glowMat.color.set(0xc4e4ff);
    } else {
      camera.position.set(-0.05, 0.75, 1.0);
      camera.rotation.set(40 * D2R, 0, 0);
      const k = Math.min(1, Math.max(0, (t - 20.5) / 2.5));
      colA.set(0xeceff2); colB.set(0xa8bde4); amb.color.copy(colA).lerp(colB, k);
      colA.set(0xffffff); colB.set(0xd0defa); axisLight.color.copy(colA).lerp(colB, k);
      amb.intensity = 0.38 * LS; axisLight.intensity = 0.6 * LS; key.intensity = 0.2 * LS;
      key.color.copy(axisLight.color);
      key.position.set(-0.3, 1, 0.6);
      colA.set(0xd8dbde); colB.set(0xb6c3d6); faceMat.color.copy(colA).lerp(colB, k);
      colA.set(0xbfc3c8); colB.set(0x9fb0c6); hoodMat.color.copy(colA).lerp(colB, k);
      rimMat.color.set(0x76808b); glowMat.color.set(0xbfe0ff);
    }
    camera.fov = FOV;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    setFixtures(shot);
    poseJogger(t, shot);
  }

  update(0, 0);
  return { scene, camera, update };
}
