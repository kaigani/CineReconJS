// CineRecon Three.js sampled-frame baseline - L1 proxy reconstruction of video3
// Bell-tower stair climb: a man in a dark suit (grey hair) climbs a square wooden
// stairwell inside a stone tower, looks down the shaft (vertigo dolly-zoom POVs),
// a woman (grey suit, light hair) runs ahead in dark intercut shots.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(45, aspect, 0.03, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const D2R = Math.PI / 180;
  const PI = Math.PI;

  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });

  // ---------------- lights ----------------
  const hemi = new THREE.HemisphereLight(0xb4c0d4, 0x2a221c, 1.0);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dc, 1.0);
  scene.add(key);
  scene.add(key.target);

  // ---------------- tower (square stairwell) ----------------
  const tower = new THREE.Group();
  scene.add(tower);
  const w = 1.1, W = 2.6, R = 1.1, NF = 12;
  const stoneM = lam(0x5a5c56), woodM = lam(0x463426), stairM = lam(0x625e56);
  const brickM = lam(0x7e4c3e), railM = lam(0x5c4634), ceilM = lam(0x2a2018);
  const addBox = (sx, sy, sz, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    (parent || tower).add(m);
    return m;
  };
  addBox(0.4, 16, 6.0, stoneM, 2.8, 7.5, 0);
  addBox(0.4, 16, 6.0, stoneM, -2.8, 7.5, 0);
  addBox(6.0, 16, 0.4, stoneM, 0, 7.5, 2.8);
  addBox(6.0, 16, 0.4, stoneM, 0, 7.5, -2.8);
  addBox(5.2, 0.2, 5.2, brickM, 0, -0.1, 0);
  addBox(5.2, 0.2, 5.2, ceilM, 0, 15.6, 0);

  // one extruded stair flight profile (5 steps rising R over run 2w)
  const NSTEP = 5, run = (2 * w) / NSTEP, rise = R / NSTEP, under = 0.35;
  const stairShape = new THREE.Shape();
  stairShape.moveTo(0, 0);
  for (let i = 0; i < NSTEP; i++) {
    stairShape.lineTo(i * run, (i + 1) * rise);
    stairShape.lineTo((i + 1) * run, (i + 1) * rise);
  }
  stairShape.lineTo(NSTEP * run, NSTEP * rise - under);
  stairShape.lineTo(0, -under);
  stairShape.lineTo(0, 0);
  const stairGeo = new THREE.ExtrudeGeometry(stairShape, { depth: W - w, bevelEnabled: false });
  {
    // shade treads light, risers/sides mid, underside dark (vertex colours, no texture)
    const nrm = stairGeo.attributes.normal, cols = new Float32Array(nrm.count * 3);
    for (let i = 0; i < nrm.count; i++) {
      const ny = nrm.getY(i), nz = nrm.getZ(i);
      const c = ny > 0.5 ? 1.0 : ny < -0.3 ? 0.4 : Math.abs(nz) > 0.5 ? 0.62 : 0.5;
      cols[i * 3] = cols[i * 3 + 1] = cols[i * 3 + 2] = c;
    }
    stairGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  const flightM = new THREE.MeshLambertMaterial({ color: 0x56565a, vertexColors: true });

  // sides in climbing order (clockwise seen from above): A (+x band, going -z),
  // B (-z band, going -x), C (-x band, going +z), D (+z band, going +x)
  const SIDES = [
    { th: PI / 2, x: w, z: w, ox: 1, oz: 0, cx: 1.85, cz: 1.85, face: -PI / 2 },
    { th: PI, x: w, z: -w, ox: 0, oz: -1, cx: 1.85, cz: -1.85, face: 0 },
    { th: -PI / 2, x: -w, z: -w, ox: -1, oz: 0, cx: -1.85, cz: -1.85, face: PI / 2 },
    { th: 0, x: -w, z: w, ox: 0, oz: 1, cx: -1.85, cz: 1.85, face: PI },
  ];
  const railGeo = new THREE.BoxGeometry(0.08, 0.08, 1);
  for (let f = 0; f < NF; f++) {
    const s = SIDES[f % 4], e = SIDES[(f + 1) % 4];
    const fl = new THREE.Mesh(stairGeo, flightM);
    fl.position.set(s.x, f * R, s.z);
    fl.rotation.y = s.th;
    tower.add(fl);
    // landing at the start corner
    addBox(1.5, 0.3, 1.5, stairM, s.cx, f * R - 0.15, s.cz);
    // sloped hand rail on the inner (well) edge
    const ax = s.x + s.ox * 0.04, az = s.z + s.oz * 0.04;
    const bx = e.x + s.ox * 0.04, bz = e.z + s.oz * 0.04;
    const A = new THREE.Vector3(ax, f * R + 0.95, az);
    const B = new THREE.Vector3(bx, (f + 1) * R + 0.95, bz);
    const rail = new THREE.Mesh(railGeo, railM);
    rail.scale.z = A.distanceTo(B);
    rail.position.copy(A).add(B).multiplyScalar(0.5);
    tower.add(rail);
    rail.lookAt(B);
    // one baluster a quarter along the flight
    addBox(0.06, 0.95, 0.06, railM, ax + (bx - ax) * 0.25, f * R + R * 0.25 + 0.47, az + (bz - az) * 0.25);
  }
  addBox(1.5, 0.3, 1.5, stairM, SIDES[0].cx, NF * R - 0.15, SIDES[0].cz);
  // four corner posts of the open well
  for (const px of [w, -w]) for (const pz of [w, -w]) addBox(0.18, 15.2, 0.18, woodM, px, 7.6, pz);

  // arched window shape (unit: width 1, height 1)
  const archShape = new THREE.Shape();
  archShape.moveTo(-0.5, 0);
  archShape.lineTo(0.5, 0);
  archShape.lineTo(0.5, 0.7);
  archShape.absellipse(0, 0.7, 0.5, 0.3, 0, PI, false);
  archShape.lineTo(-0.5, 0);
  const archGeo = new THREE.ShapeGeometry(archShape, 12);
  const addWindow = (x, y, z, rw, rh, ry, color) => {
    const m = new THREE.Mesh(archGeo, basic(color));
    m.position.set(x, y, z);
    m.scale.set(rw, rh, 1);
    m.rotation.y = ry;
    tower.add(m);
    return m;
  };
  addWindow(-1.2, 9.6, -2.58, 0.8, 1.4, 0, 0x9aa69a);
  addWindow(0.0, 7.2, 2.58, 0.45, 1.7, PI, 0xb0bccc);
  addWindow(2.58, 6.8, -2.0, 0.6, 1.5, -PI / 2, 0x9aa69a);
  addWindow(-2.58, 10.6, 0.5, 0.8, 1.5, PI / 2, 0xa0a8b0);
  addWindow(-0.5, 1.6, 2.58, 0.8, 1.5, PI, 0x9aa0a6);
  addWindow(0.4, 13.4, -2.58, 0.8, 1.4, 0, 0xa4acb4);

  function flightPoint(f, s, inset) {
    const a = SIDES[f % 4], b = SIDES[(f + 1) % 4];
    return {
      x: a.x + (b.x - a.x) * s + a.ox * inset,
      z: a.z + (b.z - a.z) * s + a.oz * inset,
      y: f * R + s * R,
      climbYaw: [PI, -PI / 2, 0, PI / 2][f % 4],
      faceWell: a.face,
    };
  }

  // ---------------- people (articulated proxies) ----------------
  function makePerson(o) {
    const suit = lam(o.suit), skin = lam(o.skin), hairM = lam(o.hair), shirtM = lam(o.shirt);
    const tieM = lam(o.tie), shoeM = lam(0x121212);
    const root = new THREE.Group();
    scene.add(root);
    const body = [], armParts = [];
    const mk = (geo, mat, parent, x, y, z, list) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      (list || body).push(m);
      return m;
    };
    mk(new THREE.BoxGeometry(0.36, 0.16, 0.22), suit, root, 0, -0.02, 0);
    const legs = [];
    for (const sx of [1, -1]) {
      const hip = new THREE.Group();
      hip.position.set(0.1 * sx, -0.06, 0);
      root.add(hip);
      mk(new THREE.BoxGeometry(0.15, 0.44, 0.17), suit, hip, 0, -0.22, 0);
      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);
      mk(new THREE.BoxGeometry(0.13, 0.42, 0.15), suit, knee, 0, -0.21, 0);
      mk(new THREE.BoxGeometry(0.12, 0.07, 0.27), shoeM, knee, 0, -0.44, 0.05);
      legs.push({ hip, knee });
    }
    const spine = new THREE.Group();
    spine.position.set(0, 0.05, 0);
    root.add(spine);
    mk(new THREE.BoxGeometry(0.44, 0.6, 0.25), suit, spine, 0, 0.3, 0);
    mk(new THREE.BoxGeometry(0.12, 0.24, 0.02), shirtM, spine, 0, 0.47, 0.126);
    mk(new THREE.BoxGeometry(0.04, 0.2, 0.02), tieM, spine, 0, 0.44, 0.135);
    const neck = new THREE.Group();
    neck.position.set(0, 0.62, 0);
    spine.add(neck);
    mk(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10), skin, neck, 0, 0.02, 0);
    const head = mk(new THREE.SphereGeometry(0.105, 16, 12), skin, neck, 0, 0.13, 0.01);
    head.scale.set(0.9, 1.12, 1.0);
    const hair = mk(new THREE.SphereGeometry(o.hairR || 0.11, 16, 12), hairM, neck, 0, 0.16, -0.025);
    if (o.bun) mk(new THREE.SphereGeometry(0.065, 12, 10), hairM, neck, 0, 0.13, -0.13);
    const arms = [];
    for (const sx of [1, -1]) {
      const sh = new THREE.Group();
      sh.position.set(0.27 * sx, 0.55, 0);
      spine.add(sh);
      mk(new THREE.BoxGeometry(0.11, 0.3, 0.12), suit, sh, 0, -0.15, 0);
      const el = new THREE.Group();
      el.position.set(0, -0.3, 0);
      sh.add(el);
      mk(new THREE.BoxGeometry(0.1, 0.26, 0.1), suit, el, 0, -0.13, 0);
      mk(new THREE.BoxGeometry(0.08, 0.1, 0.05), skin, el, 0, -0.31, 0, armParts);
      arms.push({ sh, el, sx });
    }
    root.scale.setScalar(o.scale || 1);
    return { root, spine, neck, head, hair, arms, legs, body, armParts, scale: o.scale || 1 };
  }
  const S = makePerson({ suit: 0x26262c, skin: 0xa87262, hair: 0x7c786e, shirt: 0xb8b6ac, tie: 0x1c1c22 });
  const M = makePerson({ suit: 0x7a7a74, skin: 0xb88a76, hair: 0xb8a074, shirt: 0x8a8a84, tie: 0x8a8a84, scale: 0.94, hairR: 0.125, bun: true });

  function setPov(P, lvl) {
    for (const m of P.body) m.visible = lvl === 0;
    for (const m of P.armParts) m.visible = lvl <= 1;
  }

  function applyPose(P, p) {
    P.root.rotation.set(0, p.yaw || 0, 0);
    P.spine.rotation.set(p.lean || 0, p.twist || 0, p.roll || 0, 'YXZ');
    P.neck.rotation.set(p.hp || 0, p.hy || 0, 0, 'YXZ');
    const la = p.la || [0.08, 0.06, 0.2], ra = p.ra || [0.08, 0.06, 0.2];
    P.arms[0].sh.rotation.set(-la[0], 0, la[1]);
    P.arms[0].el.rotation.set(-la[2], 0, 0);
    P.arms[1].sh.rotation.set(-ra[0], 0, -ra[1]);
    P.arms[1].el.rotation.set(-ra[2], 0, 0);
    const ll = p.ll || [0.05, 0.1], rl = p.rl || [0.05, 0.1];
    P.legs[0].hip.rotation.set(-ll[0], 0, 0);
    P.legs[0].knee.rotation.set(ll[1], 0, 0);
    P.legs[1].hip.rotation.set(-rl[0], 0, 0);
    P.legs[1].knee.rotation.set(rl[1], 0, 0);
  }

  function climbLegs(ph) {
    const a = 0.5 + 0.5 * Math.sin(ph), b = 0.5 + 0.5 * Math.sin(ph + PI);
    return {
      ll: [0.15 + 0.7 * a, 0.15 + 0.95 * a], rl: [0.15 + 0.7 * b, 0.15 + 0.95 * b],
      la: [0.15 + 0.35 * b, 0.08, 0.35], ra: [0.15 + 0.35 * a, 0.08, 0.35],
    };
  }

  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const NEGY = new THREE.Vector3(0, -1, 0), XAX = new THREE.Vector3(1, 0, 0), ZAX = new THREE.Vector3(0, 0, 1);

  // two-bone IK for an arm, target in world space (hand centre)
  function reach(P, idx, target) {
    P.root.updateMatrixWorld(true);
    const arm = P.arms[idx];
    const T = P.spine.worldToLocal(_v1.copy(target));
    T.sub(arm.sh.position);
    const L1 = 0.3, L2 = 0.31;
    let d = T.length();
    d = Math.min(Math.max(d, 0.08), L1 + L2 - 0.002);
    T.normalize();
    const ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const a = Math.acos(Math.min(1, Math.max(-1, ca)));
    const cb = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
    const b = PI - Math.acos(Math.min(1, Math.max(-1, cb)));
    _q1.setFromUnitVectors(NEGY, T);
    _q2.setFromAxisAngle(XAX, a);
    arm.sh.quaternion.copy(_q1).multiply(_q2);
    arm.el.quaternion.setFromAxisAngle(XAX, -b);
    P.root.updateMatrixWorld(true);
  }

  // ---------------- camera helpers ----------------
  function setCam(px, py, pz, yaw, pitch, fov, roll) {
    camera.position.set(px, py, pz);
    camera.rotation.set(pitch, yaw, roll || 0, 'YXZ');
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  // world point at reference-pixel (u,v) of a 960x540 frame, depth d in front of the camera
  function camPoint(u, v, d, out) {
    const tv = Math.tan((camera.fov * D2R) / 2), th = tv * camera.aspect;
    out.set((u / 480 - 1) * d * th, (1 - v / 270) * d * tv, -d);
    return out.applyMatrix4(camera.matrixWorld);
  }
  function placeByHead(P, u, v, d) {
    P.root.position.set(0, 0, 0);
    P.root.updateMatrixWorld(true);
    P.head.getWorldPosition(_v2);
    camPoint(u, v, d, _v3);
    P.root.position.copy(_v3).sub(_v2);
    P.root.updateMatrixWorld(true);
  }
  // aim a camera at pos so that world point tgt lands near reference pixel (u,v)
  function aimAngles(px, py, pz, tgt, u, v, fov) {
    const dx = tgt.x - px, dy = tgt.y - py, dz = tgt.z - pz;
    const tv = Math.tan((fov * D2R) / 2), th = tv * aspect;
    const yaw = Math.atan2(-dx, -dz) + Math.atan((u / 480 - 1) * th);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz)) + Math.atan((v / 270 - 1) * tv);
    return [yaw, pitch];
  }
  function lights(hI, kI, kd, world) {
    hemi.intensity = hI;
    key.intensity = kI;
    _v4.set(kd[0], kd[1], kd[2]).normalize();
    if (!world) _v4.applyQuaternion(camera.quaternion);
    key.target.position.copy(camera.position).add(_v5.set(0, 0, -2).applyQuaternion(camera.quaternion));
    key.position.copy(key.target.position).addScaledVector(_v4, 10);
    key.target.updateMatrixWorld();
  }

  // ---------------- close-up set kit (flats placed in base-camera framing) ----------------
  const kitBox = new THREE.BoxGeometry(1, 1, 1);
  const pool = [], archPool = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(kitBox, new THREE.MeshBasicMaterial({ color: 0 }));
    m.visible = false;
    scene.add(m);
    pool.push(m);
  }
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(archGeo, basic(0xffffff));
    m.visible = false;
    scene.add(m);
    archPool.push(m);
  }
  let pi = 0, ai = 0;
  function kitReset() {
    for (const m of pool) m.visible = false;
    for (const m of archPool) m.visible = false;
    pi = 0;
    ai = 0;
  }
  function bar(u0, v0, u1, v1, thick, d, color) {
    const m = pool[pi++];
    m.visible = true;
    m.material.color.setHex(color);
    camPoint(u0, v0, d, _v1);
    camPoint(u1, v1, d, _v2);
    const s = (d * Math.tan((camera.fov * D2R) / 2)) / 270;
    m.scale.set(_v1.distanceTo(_v2), thick * s, 0.05);
    m.position.copy(_v1).add(_v2).multiplyScalar(0.5);
    const ang = Math.atan2(-(v1 - v0), u1 - u0);
    m.quaternion.copy(camera.quaternion).multiply(_q2.setFromAxisAngle(ZAX, ang));
  }
  function rect(u0, v0, u1, v1, d, color) {
    bar(u0, (v0 + v1) / 2, u1, (v0 + v1) / 2, v1 - v0, d, color);
  }
  function arch(u0, v0, u1, v1, d, color) {
    const m = archPool[ai++];
    m.visible = true;
    m.material.color.setHex(color);
    const s = (d * Math.tan((camera.fov * D2R) / 2)) / 270;
    camPoint((u0 + u1) / 2, v1, d, _v1);
    m.position.copy(_v1);
    m.scale.set((u1 - u0) * s, (v1 - v0) * s, 1);
    m.quaternion.copy(camera.quaternion);
  }

  // ---------------- letterbox bars of the source frame ----------------
  const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false });
  const topBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), barMat);
  const botBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), barMat);
  topBar.renderOrder = botBar.renderOrder = 1000;
  topBar.frustumCulled = botBar.frustumCulled = false;
  camera.add(topBar);
  camera.add(botBar);
  function letterbox() {
    const tv = Math.tan((camera.fov * D2R) / 2), dist = 0.1, hh = dist * tv, hw = hh * camera.aspect * 1.1;
    const th = (10 / 270) * hh, bh = (12 / 270) * hh;
    topBar.scale.set(2 * hw, th, 1);
    topBar.position.set(0, hh - th / 2, -dist);
    botBar.scale.set(2 * hw, bh, 1);
    botBar.position.set(0, -hh + bh / 2, -dist);
  }

  // ---------------- timeline helpers ----------------
  function kfv(t, keys) {
    if (t <= keys[0][0]) return keys[0][1].slice();
    for (let i = 0; i < keys.length - 1; i++) {
      const t0 = keys[i][0], a = keys[i][1], t1 = keys[i + 1][0], b = keys[i + 1][1];
      if (t <= t1) {
        let u = (t - t0) / (t1 - t0);
        u = u * u * (3 - 2 * u);
        return a.map((x, j) => x + (b[j] - x) * u);
      }
    }
    return keys[keys.length - 1][1].slice();
  }
  const kitCam = (yaw, pitch, fov) => setCam(40, 1.6, 0, yaw, pitch, fov);
  const sB = (t) => 0.35 + (t - 0.918) * 0.23; // fraction along flight 5 (climb toward the high camera)

  function placeOnFlight(P, f, s, inset, yaw, t, lean, hp) {
    const fp = flightPoint(f, s, inset);
    const c = climbLegs(t * 2 * PI * 0.9);
    applyPose(P, { yaw: yaw === undefined ? fp.climbYaw : yaw, lean, hp, ll: c.ll, rl: c.rl, la: c.la, ra: c.ra });
    P.root.position.set(fp.x, fp.y + 0.92 * P.scale, fp.z);
    P.root.updateMatrixWorld(true);
  }

  // ---------------- shots ----------------
  const showS = () => { S.root.visible = true; };
  // A: high angle down the dark stairwell
  function shotA(t) {
    tower.visible = true;
    setCam(1.9, 12.4, 1.9, PI / 4, -1.0, 55);
    showS();
    placeOnFlight(S, 5, sB(t), 0.75, undefined, t, 0.3, -0.4);
    M.root.visible = true;
    placeOnFlight(M, 9, 0.3 + t * 0.25, 0.75, undefined, t + 0.3, 0.35, 0);
    lights(0.45, 0.9, [0.3, 1, 0.2], true);
  }
  // B: high angle close on the man climbing up toward camera; camera pans with him
  function shotB(t) {
    tower.visible = true;
    showS();
    const P0 = 0.918, P1 = 1.793, cx = -0.9, cy = 8.7, cz = -2.0;
    placeOnFlight(S, 5, sB(P0), 0.75, undefined, P0, 0.2, -0.85);
    S.head.getWorldPosition(_v6);
    const a0 = aimAngles(cx, cy, cz, _v6, 560, 410, 50);
    placeOnFlight(S, 5, sB(P1), 0.75, undefined, P1, 0.2, -0.85);
    S.head.getWorldPosition(_v6);
    const a1 = aimAngles(cx, cy, cz, _v6, 600, 370, 50);
    placeOnFlight(S, 5, sB(t), 0.75, undefined, t, 0.2, -0.85);
    const u = (t - P0) / (P1 - P0);
    setCam(cx, cy, cz, a0[0] + (a1[0] - a0[0]) * u, a0[1] + (a1[1] - a0[1]) * u, 50);
    lights(0.6, 1.0, [0.3, 1, 0.2], true);
  }
  // C: medium shot, man left of dark beam, bright arch at right; he ducks and peers right
  function shotC(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x121210);
    rect(0, 0, 440, 540, 3.6, 0x3c3c37);
    rect(640, 380, 1000, 560, 3.55, 0x5a5a52);
    rect(790, -20, 1000, 400, 3.4, 0x121210);
    arch(640, 15, 800, 430, 3.5, 0x8c8e80);
    rect(430, -20, 640, 560, 2.6, 0x1e1712);
    showS();
    const k = kfv(t, [[2.711, [330, 130, 0.25, 0.1]], [3.629, [325, 240, 0.6, 0.3]]]);
    applyPose(S, { yaw: 0.9, lean: k[2], hp: k[3], hy: 0.25, la: [0.2, 0.05, 0.4], ra: [0.2, 0.05, 0.4] });
    placeByHead(S, k[0], k[1], 1.3);
    kitCam(-0.0917 * (t - 2.711), 0, 45);
    lights(0.5, 1.0, [1, 0.3, 0.4]);
  }
  // D: POV over the rail down the shaft with hands on the rail, dolly-zoom
  function povFlight(f, lean, hp) {
    const fp = flightPoint(f, 0.5, 0.35);
    applyPose(S, { yaw: fp.faceWell, lean, hp });
    S.root.position.set(fp.x, fp.y + 0.95, fp.z);
    S.root.updateMatrixWorld(true);
    return fp;
  }
  const railTopD = (f, x) => f * R + ((x + w) / (2 * w)) * R + 0.99;
  function shotD(t) {
    tower.visible = true;
    showS();
    povFlight(7, 0.75, 0.5);
    reach(S, 0, _v6.set(0.02, railTopD(7, 0.02) + 0.03, w));
    reach(S, 1, _v6.set(0.19, railTopD(7, 0.19) + 0.03, w));
    setPov(S, 1);
    const fx = 0, fy = railTopD(7, 0) + 0.03, fz = w;
    const k = Math.exp(0.44 * (t - 4.546));
    const fov = (2 * Math.atan(Math.tan(23 * D2R) * k)) / D2R;
    setCam(fx + 0.0, fy + 1.05 / k, fz - 0.4 / k, 0, -(PI / 2 + 0.05), fov);
    lights(0.35, 0.75, [0.2, 1, 0.3], true);
  }
  // E: man seen from behind, leaning toward an opening at right
  function shotE(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x3a3934);
    rect(835, -20, 1000, 560, 4.0, 0x5e6862);
    rect(660, -20, 835, 560, 3.2, 0x77766e);
    rect(-20, -20, 262, 560, 2.2, 0x121110);
    showS();
    applyPose(S, { yaw: 2.4, lean: 0.45, hp: 0.35, hy: 0.2, la: [0.3, 0.1, 0.5], ra: [0.5, 0.1, 0.6] });
    placeByHead(S, 440, 150, 1.35);
    lights(0.5, 1.0, [1, 0.2, -0.3]);
  }
  // F: dark, woman climbing in the gloom
  function shotF(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x0c0b0a);
    rect(650, -20, 1000, 560, 3.6, 0x141311);
    rect(520, -20, 650, 560, 3.4, 0x22201d);
    rect(395, -20, 520, 560, 2.6, 0x181512);
    bar(-20, 250, 400, 560, 70, 2.0, 0x2c2926);
    M.root.visible = true;
    const c = climbLegs(t * 2 * PI * 1.2);
    applyPose(M, { yaw: 0.5, lean: 0.35, hp: -0.1, ll: c.ll, rl: c.rl, la: c.la, ra: c.ra });
    placeByHead(M, 350, 200 - (t - 7.257) * 40, 3.0);
    lights(0.3, 0.5, [-0.5, 0.5, 0.5]);
  }
  // G: dark, woman low at left with a hand raised by her face
  function shotG(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x0b0a09);
    rect(520, 10, 800, 380, 3.4, 0x292723);
    rect(800, -20, 1000, 560, 3.0, 0x161310);
    bar(380, 170, 640, 560, 110, 2.2, 0x17130f);
    bar(90, 530, 330, 270, 45, 1.9, 0x3c3732);
    M.root.visible = true;
    applyPose(M, { yaw: -0.3, lean: 0.3, hp: -0.35 });
    placeByHead(M, 330, 385, 1.6);
    reach(M, 1, camPoint(258, 440, 1.5, _v6));
    lights(0.35, 0.6, [-0.6, 0.4, 0.6]);
  }
  // H: very dark, man in silhouette, small window at left
  function shotH(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x070707);
    rect(15, 88, 85, 310, 4.2, 0x8494ac);
    rect(430, 8, 520, 26, 4.2, 0x8a8a88);
    rect(780, 50, 960, 500, 3.8, 0x2a2824);
    showS();
    applyPose(S, { yaw: -0.6, lean: 0.3, hp: -0.1 });
    placeByHead(S, 430, 210, 1.6);
    lights(0.1, 0.25, [-1, 0.3, 0]);
  }
  // I: very dark, man in silhouette below an arched window
  function shotI(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x070707);
    arch(490, 45, 615, 235, 4.0, 0x6a6860);
    rect(0, 10, 120, 185, 4.2, 0x56544e);
    rect(840, 60, 930, 270, 4.2, 0x3c3a35);
    showS();
    applyPose(S, { yaw: 0.2, lean: 0.2, hp: 0.1 });
    placeByHead(S, 505, 280, 1.8);
    lights(0.08, 0.2, [0, 1, 0.3]);
  }
  // J: man at left edge, woman behind him at centre
  function shotJ(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x0d0d0c);
    rect(0, 10, 450, 330, 3.8, 0x383732);
    rect(550, 10, 700, 380, 3.8, 0x1e1d1a);
    M.root.visible = true;
    applyPose(M, { yaw: 0.2, lean: 0.15, hp: 0.0 });
    placeByHead(M, 320, 230, 2.0);
    reach(M, 0, camPoint(420, 430, 1.8, _v6));
    showS();
    applyPose(S, { yaw: 0.6, lean: 0.15, hp: 0.0 });
    placeByHead(S, 80, 270, 1.5);
    lights(0.3, 0.5, [-0.6, 0.5, -0.3]);
  }
  // K: man left of dark beam and post, bright arch lower right; camera pans/tilts
  function shotK(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x121210);
    rect(745, -20, 1000, 560, 3.9, 0x151412);
    arch(620, 400, 745, 640, 3.8, 0x8a8676);
    rect(-20, -20, 400, 560, 3.6, 0x2e2d29);
    rect(485, -20, 620, 560, 3.0, 0x2a1f19);
    rect(400, -20, 485, 560, 2.9, 0x0e0c0b);
    showS();
    const k = kfv(t, [[11.803, [250, 300]], [12.679, [320, 240]]]);
    applyPose(S, { yaw: 0.8, lean: 0.3, hp: 0.1, hy: 0.2 });
    placeByHead(S, k[0], k[1], 1.3);
    const u = (t - 11.803) / 0.876;
    kitCam(-0.0765 * u, -0.137 * u, 45);
    lights(0.45, 0.9, [1, 0.3, 0.4]);
  }
  // L: man peering down to the right, then leaning in close and reaching
  function shotL(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x0e0e0c);
    arch(470, 380, 610, 640, 3.8, 0x7e7a6c);
    rect(350, -20, 560, 380, 3.7, 0x2a2925);
    rect(-20, -20, 270, 560, 3.6, 0x24231f);
    rect(270, -20, 350, 560, 3.0, 0x0c0b0a);
    showS();
    const k = kfv(t, [[13.597, [490, 310, 1.6]], [14.514, [515, 185, 1.15]]]);
    applyPose(S, { yaw: 1.2, lean: 0.4, hp: 0.45, hy: 0.1 });
    placeByHead(S, k[0], k[1], k[2]);
    const r = kfv(t, [[13.9, [560, 560, 1.4]], [14.514, [700, 520, 0.95]]]);
    reach(S, 1, camPoint(r[0], r[1], r[2], _v6));
    lights(0.45, 0.9, [1, 0.2, 0.5]);
  }
  // M: POV straight down the shaft from high up (no hands)
  function shotM(t) {
    tower.visible = true;
    showS();
    povFlight(11, 0.75, 0.5);
    setPov(S, 2);
    setCam(0, 14.2, 0.8, 0, -(PI / 2 + 0.05), 60);
    lights(0.35, 0.75, [0.2, 1, 0.3], true);
  }
  // N: man between beams, turns and looks up, reaches up-right
  function shotN(t) {
    kitCam(0, 0, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x121210);
    rect(330, -20, 565, 560, 3.7, 0x3a3b32);
    rect(-20, -20, 210, 560, 3.6, 0x2e2e28);
    rect(810, -20, 1000, 560, 3.6, 0x121110);
    rect(565, -20, 655, 560, 3.2, 0x5a574e);
    rect(210, -20, 330, 560, 3.0, 0x110e0c);
    rect(655, -20, 810, 560, 3.0, 0x3c2016);
    const pk = kfv(t, [[17.226, [800, 185, 990, 15, 14]], [18.143, [785, 290, 990, 0, 22]]]);
    bar(pk[0], pk[1], pk[2], pk[3], pk[4], 2.6, 0x6a7488);
    showS();
    const k = kfv(t, [[16.308, [470, 360, 1.6, 2.2, 0.5, 0.3]], [17.226, [440, 220, 1.6, 1.3, 0.05, -0.55]], [18.143, [455, 190, 1.5, 1.1, 0.0, -0.5]]]);
    applyPose(S, { yaw: k[3], lean: k[4], hp: k[5] });
    placeByHead(S, k[0], k[1], k[2]);
    if (t > 17.4) {
      const r = kfv(t, [[17.4, [470, 420, 1.5]], [18.143, [560, 230, 1.3]]]);
      reach(S, 1, camPoint(r[0], r[1], r[2], _v6));
    }
    const u = Math.min(Math.max((t - 17.226) / 0.917, 0), 1.25);
    kitCam(-0.1144 * u, 0, 45);
    lights(0.45, 0.9, [1, 0.5, 0.4]);
  }
  // O: low angle, man climbing beside a diagonal rail, hand to his face
  function shotO(t) {
    kitCam(0, 0.25, 45);
    rect(-60, -60, 1020, 600, 4.5, 0x121110);
    rect(150, -20, 560, 560, 3.6, 0x22201d);
    rect(720, 10, 960, 150, 3.6, 0x5e5c54);
    rect(830, 150, 1000, 560, 3.6, 0x2a2824);
    rect(60, -20, 120, 560, 3.0, 0x38383a);
    rect(400, -20, 525, 560, 2.6, 0x1c1410);
    bar(530, 540, 880, 140, 28, 1.9, 0x5a6a7c);
    showS();
    const c = climbLegs(t * 2 * PI * 0.8);
    applyPose(S, { yaw: 0.9, lean: 0.35, hp: -0.35, ll: c.ll, rl: c.rl });
    placeByHead(S, 500, 130 - (t - 19.061) * 30, 1.6);
    reach(S, 1, camPoint(545, 185, 1.45, _v6));
    reach(S, 0, camPoint(640, 420, 1.9, _v6));
    lights(0.4, 0.9, [0.8, 0.6, 0.3]);
  }
  // P: low angle up the stairwell, man climbing at lower right toward the camera
  function shotP(t) {
    kitCam(0, 0.35, 50);
    rect(-60, -60, 1020, 600, 5.0, 0x0c0b0a);
    rect(850, -20, 1000, 560, 4.6, 0x2a2822);
    arch(625, 40, 790, 600, 4.6, 0x4a4a42);
    rect(815, 70, 850, 300, 4.4, 0xb4c0d8);
    bar(180, 30, 440, 120, 26, 3.6, 0x2e2925);
    bar(-20, 200, 430, 320, 34, 3.4, 0x2c2723);
    bar(-20, 400, 420, 470, 34, 3.4, 0x26221e);
    bar(240, 60, 360, 380, 22, 3.5, 0x34363c);
    rect(150, -20, 190, 560, 3.2, 0x3e424a);
    rect(720, -20, 815, 560, 3.0, 0x3a3e46);
    rect(400, -20, 515, 560, 2.8, 0x3a2418);
    showS();
    const c = climbLegs(t * 2 * PI * 0.8);
    applyPose(S, { yaw: 0.4, lean: 0.35, hp: -0.4, ll: c.ll, rl: c.rl, la: c.la, ra: c.ra });
    const k = kfv(t, [[19.937, [670, 400, 2.4]], [20.854, [710, 500, 2.2]]]);
    placeByHead(S, k[0], k[1], k[2]);
    lights(0.35, 0.8, [0.6, 0.4, 0.5]);
  }

  const SHOTS = [
    [0.459, shotA], [2.252, shotB], [4.088, shotC], [5.881, shotD], [6.798, shotE],
    [7.716, shotF], [8.613, shotG], [9.509, shotH], [10.427, shotI], [11.345, shotJ],
    [13.138, shotK], [14.973, shotL], [15.870, shotM], [18.602, shotN], [19.499, shotO],
    [1e9, shotP],
  ];

  function update(time, frame) {
    const t = Math.max(0, time);
    kitReset();
    tower.visible = false;
    M.root.visible = false;
    S.root.visible = false;
    setPov(S, 0);
    setPov(M, 0);
    for (const [end, fn] of SHOTS) {
      if (t < end) {
        fn(t);
        break;
      }
    }
    letterbox();
    scene.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
