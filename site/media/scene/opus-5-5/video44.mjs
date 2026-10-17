// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction (video44).
// Meadow scene: scout boy (backpack, bedrolls, stick) and girl (pink dress, basket,
// yellow suitcase) walk toward each other across a field and meet; four shots.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const W = width || 1280, H = height || 720;
  const scene = new THREE.Scene();
  const SKY = 0xd8dacb;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 140, 650);

  const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 1500);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic RNG ----------
  let rs = (((seed === undefined || seed === null) ? 1 : seed) >>> 0) ^ 0x9e3779b9;
  function rnd() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- math helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u); };
  function pwl(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const t0 = keys[i - 1][0], v0 = keys[i - 1][1], t1 = keys[i][0], v1 = keys[i][1];
        return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
      }
    }
    return keys[keys.length - 1][1];
  }
  function spwl(keys, t, h) { return (pwl(keys, t - h) + 2 * pwl(keys, t) + pwl(keys, t + h)) / 4; }
  function easeDist(t, t0, T) {
    if (t <= t0) return 0;
    if (t < t0 + T) return (t - t0) * (t - t0) / (2 * T);
    return t - t0 - T / 2;
  }

  // ---------- materials / primitive helpers ----------
  const matCache = {};
  function M(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    return matCache[hex];
  }
  function seg(parent, len, r0, r1, mat, y0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), mat);
    m.position.y = (y0 || 0) - len / 2; parent.add(m); return m;
  }
  function box(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function ball(parent, r, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function cylX(parent, r, len, mat, x, y, z) { // cylinder with axis along local x
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
    m.rotation.z = Math.PI / 2; m.position.set(x, y, z); parent.add(m); return m;
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xf4f4ea, 0x7a6e3a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff6e8, 0.9);
  sun.position.set(-30, 60, 40);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // ---------- environment ----------
  {
    // ground: darker olive near the camera, golden toward the tree line (seeded speckle)
    const cNear = new THREE.Color(0x8c8a3e), cMid = new THREE.Color(0xae9a46), cFar = new THREE.Color(0xc0a850), c = new THREE.Color();
    function groundColor(z) {
      if (z > -3) c.copy(cNear).lerp(cMid, clamp((1.5 - z) / 4.5, 0, 1));
      else c.copy(cMid).lerp(cFar, clamp((-3 - z) / 25, 0, 1));
      const k = 0.92 + 0.16 * rnd();
      c.r *= k; c.g *= k; c.b *= k;
      return c;
    }
    function groundPlane(w, d, sw, sd, zc, y) {
      const g = new THREE.PlaneGeometry(w, d, sw, sd);
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, zc);
      const pos = g.attributes.position, n = pos.count, cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        groundColor(pos.getZ(i));
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
    }
    groundPlane(900, 900, 90, 90, 0, -0.03);
    groundPlane(120, 60, 120, 120, -10, 0);

    // distant tree line
    const sph = new THREE.SphereGeometry(1, 14, 10);
    for (let x = -170; x < 170;) {
      const h = 3 + rnd() * 3.2, r = 2.2 + rnd() * 3;
      const tr = new THREE.Mesh(sph, M(rnd() < 0.5 ? 0x3d5226 : 0x4b5f2d));
      tr.scale.set(r, h * 0.6, r * 0.8);
      tr.position.set(x, h * 0.45, -136 - rnd() * 14);
      scene.add(tr);
      x += r * (1.0 + rnd() * 1.2);
    }
    box(scene, 700, 2.6, 4, M(0x485a2c), 0, 1.3, -150);
    box(scene, 900, 10, 4, M(0x8e9888), 0, 3, -420); // pale distant shore

    // windmill (far, in front of tree line)
    const wm = new THREE.Group();
    wm.position.set(-5.6, 0, -82);
    seg(wm, 4.8, 0.06, 0.16, M(0x8a8a80), 4.8);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.06, 24), M(0xe2e2da));
    wheel.rotation.x = Math.PI / 2; wheel.position.set(0, 4.8, 0.2); wm.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), M(0x6a6a64));
    hub.rotation.x = Math.PI / 2; hub.position.set(0, 4.8, 0.22); wm.add(hub);
    box(wm, 0.06, 0.5, 1.2, M(0x9a9a92), 0, 4.8, -0.6);
    scene.add(wm);

    // weed clumps in the mid field (behind the subjects' paths)
    const cone = new THREE.ConeGeometry(1, 1, 7);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(cone, M(rnd() < 0.5 ? 0x5a6a2a : 0x6b7430));
      const hh = 0.5 + rnd() * 0.5, rr = 0.06 + rnd() * 0.08;
      m.scale.set(rr, hh, rr);
      m.position.set(-28 + rnd() * 50, hh / 2, -5 - rnd() * 40);
      scene.add(m);
    }
  }

  // ---------- articulated kid skeleton ----------
  function makeKid(d) {
    const J = { d };
    J.root = new THREE.Group();
    J.hips = new THREE.Group(); J.hips.position.y = d.hipH; J.root.add(J.hips);
    J.spine = new THREE.Group(); J.hips.add(J.spine);
    J.head = new THREE.Group(); J.head.position.y = d.neckY; J.spine.add(J.head);
    const sides = [['L', 1], ['R', -1]];
    for (const [s, side] of sides) {
      const hip = new THREE.Group(); hip.position.set(side * d.hipX, 0, 0); J.hips.add(hip);
      const knee = new THREE.Group(); knee.position.y = -d.thigh; hip.add(knee);
      const ankle = new THREE.Group(); ankle.position.y = -d.shin; knee.add(ankle);
      const sh = new THREE.Group(); sh.position.set(side * d.shX, d.shY, 0); J.spine.add(sh);
      const el = new THREE.Group(); el.position.y = -d.upper; sh.add(el);
      const hand = new THREE.Group(); hand.position.y = -d.fore; el.add(hand);
      J['hip' + s] = hip; J['knee' + s] = knee; J['ankle' + s] = ankle;
      J['sh' + s] = sh; J['el' + s] = el; J['hand' + s] = hand;
    }
    scene.add(J.root);
    return J;
  }
  function applyPose(J, p) {
    const d = J.d;
    J.root.position.set(p.x, 0, p.z);
    J.root.rotation.set(0, p.yaw, 0);
    // keep the lower (stance) foot on the ground
    const ext = (hf, kf) => d.thigh * Math.cos(hf) + d.shin * Math.cos(hf - kf);
    J.hips.position.y = Math.max(ext(p.hipL, p.kneeL), ext(p.hipR, p.kneeR)) + d.foot;
    J.spine.rotation.set(p.bend, 0, 0);
    J.head.rotation.set(p.headPitch, p.headYaw || 0, 0);
    for (const s of ['L', 'R']) {
      const side = s === 'L' ? 1 : -1;
      const hf = p['hip' + s], kf = p['knee' + s];
      J['hip' + s].rotation.set(-hf, 0, 0);
      J['knee' + s].rotation.set(kf, 0, 0);
      J['ankle' + s].rotation.set(hf - kf, 0, 0);
      J['sh' + s].rotation.set(-p['sh' + s], 0, side * p['ab' + s]);
      J['el' + s].rotation.set(-p['el' + s], 0, 0);
    }
    J.root.updateMatrixWorld(true);
  }
  function gait(phase, w, A) {
    const s = Math.sin(phase), c = Math.cos(phase);
    return {
      hipL: w * A * s, hipR: -w * A * s,
      kneeL: w * (0.08 + 0.7 * Math.max(0, c)), kneeR: w * (0.08 + 0.7 * Math.max(0, -c)),
      s
    };
  }

  // ---------- BOY (scout) ----------
  const SKIN = M(0xe6b392);
  const boy = makeKid({ hipH: 0.70, hipX: 0.08, thigh: 0.33, shin: 0.32, foot: 0.05, neckY: 0.46, shX: 0.185, shY: 0.41, upper: 0.25, fore: 0.23 });
  {
    const shirt = M(0x8f7f3c), shorts = M(0x83753a), sock = M(0xd8c8a0), band = M(0x6e5232), shoe = M(0x7a4a28);
    for (const s of ['L', 'R']) {
      seg(boy['hip' + s], 0.15, 0.078, 0.072, shorts);
      seg(boy['hip' + s], 0.33, 0.055, 0.05, SKIN);
      seg(boy['knee' + s], 0.32, 0.048, 0.04, sock);
      seg(boy['knee' + s], 0.08, 0.053, 0.051, band, -0.02);
      box(boy['ankle' + s], 0.08, 0.06, 0.19, shoe, 0, -0.02, 0.04);
      seg(boy['sh' + s], 0.25, 0.052, 0.046, shirt, 0.02);
      seg(boy['el' + s], 0.23, 0.04, 0.035, SKIN);
      ball(boy['hand' + s], 0.042, SKIN, 0, 0, 0);
    }
    box(boy.hips, 0.30, 0.17, 0.2, shorts, 0, -0.03, 0);
    box(boy.spine, 0.29, 0.45, 0.16, shirt, 0, 0.225, 0);
    box(boy.spine, 0.17, 0.12, 0.04, M(0xdcb53a), 0, 0.37, 0.095);  // neckerchief
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 16), M(0x8c7c58));
    can.rotation.z = Math.PI / 2; can.position.set(0.17, 0.02, 0.07); boy.hips.add(can); // canteen
    ball(boy.head, 0.1, SKIN, 0, 0.11, 0.035);
    const hatM = M(0x8b7a62);
    seg(boy.head, 0.12, 0.118, 0.118, hatM, 0.25);
    const top = ball(boy.head, 0.118, hatM, 0, 0.25, 0); top.scale.y = 0.45;
    // backpack + rolls + stick
    box(boy.spine, 0.32, 0.42, 0.2, M(0xbd853a), 0, 0.25, -0.18);
    cylX(boy.spine, 0.075, 0.30, M(0xd8b443), 0, 0.48, -0.2);
    cylX(boy.spine, 0.09, 0.36, M(0xae8f55), 0, 0.0, -0.27);
    cylX(boy.spine, 0.09, 0.36, M(0xae8f55), 0, -0.18, -0.25);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 8), M(0x9a9a92));
    stick.position.set(0.19, 0.30, -0.15); stick.rotation.x = 0.15; boy.spine.add(stick);
  }

  // ---------- GIRL ----------
  const girl = makeKid({ hipH: 0.75, hipX: 0.075, thigh: 0.36, shin: 0.34, foot: 0.05, neckY: 0.45, shX: 0.17, shY: 0.38, upper: 0.29, fore: 0.27 });
  {
    const pink = M(0xe2a69b), white = M(0xf1efe6), navy = M(0x2c3550), hair = M(0x9a4724), gskin = M(0xecbca2);
    for (const s of ['L', 'R']) {
      seg(girl['hip' + s], 0.36, 0.06, 0.05, gskin);
      seg(girl['knee' + s], 0.34, 0.046, 0.04, gskin);
      seg(girl['knee' + s], 0.26, 0.05, 0.045, white, -0.08);
      box(girl['ankle' + s], 0.08, 0.06, 0.18, navy, 0, -0.02, 0.04);
      seg(girl['sh' + s], 0.29, 0.048, 0.043, pink, 0.02);
      seg(girl['el' + s], 0.23, 0.04, 0.036, pink);
      seg(girl['el' + s], 0.045, 0.043, 0.043, white, -0.21);
      ball(girl['hand' + s], 0.038, gskin, 0, 0, 0);
    }
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.25, 16), pink);
    skirt.position.y = -0.06; girl.hips.add(skirt);
    box(girl.spine, 0.26, 0.43, 0.14, pink, 0, 0.215, 0);
    ball(girl.head, 0.095, gskin, 0, 0.105, 0.035);
    ball(girl.head, 0.11, hair, 0, 0.125, -0.03);
    box(girl.head, 0.22, 0.27, 0.07, hair, 0, 0.0, -0.07);
    box(girl.hips, 0.25, 0.18, 0.15, M(0xa8672c), -0.17, -0.03, 0.05);   // wicker basket (right hip)
    box(girl.spine, 0.08, 0.09, 0.07, M(0x1c1c1e), -0.09, 0.30, 0.095);  // binoculars
  }

  // ---------- props ----------
  const suitcase = new THREE.Group();
  box(suitcase, 0.52, 0.34, 0.14, M(0xe3c23c), 0, 0, 0);
  box(suitcase, 0.15, 0.035, 0.03, M(0xc8c8c0), 0, 0.19, 0);
  scene.add(suitcase);

  const caseGrp = new THREE.Group(); // teal record-player case + red book, girl's left hand
  box(caseGrp, 0.2, 0.17, 0.08, M(0x2fa2aa), 0, -0.1, 0);
  box(caseGrp, 0.17, 0.22, 0.04, M(0x9e2636), 0.02, -0.13, 0.07);
  scene.add(caseGrp);

  const flowers = new THREE.Group();
  seg(flowers, 0.3, 0.008, 0.012, M(0x4f6a2a), 0.22);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    ball(flowers, 0.035, M(0xf3f2ea), Math.cos(a) * 0.045, 0.2 + (i % 3) * 0.03, Math.sin(a) * 0.045);
  }
  scene.add(flowers);
  const weedUnderFlower = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 1, 6), M(0x4f6226));
  scene.add(weedUnderFlower);

  const mapSmall = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshLambertMaterial({ color: 0xece6d6, side: THREE.DoubleSide }));
  const mapM = new THREE.MeshLambertMaterial({ color: 0xc2a77a, side: THREE.DoubleSide });
  const mapBig = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.34), mapM);
  scene.add(mapSmall); scene.add(mapBig);
  const MAP_LIGHT = new THREE.Color(0xe4dcc6), MAP_DARK = new THREE.Color(0xb09670);

  // letterbox bars of the reference frame (camera-attached)
  {
    const dist = 0.1, halfH = dist * Math.tan(15 * Math.PI / 180), barH = 2 * halfH * (11 / 540);
    const bm = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false });
    for (const sgn of [1, -1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1, barH), bm);
      b.position.set(0, sgn * (halfH - barH / 2), -dist); b.renderOrder = 999;
      camera.add(b);
    }
  }

  // ---------- timeline ----------
  const CUT1 = 4.1, CUT2 = 7.83, CUT3 = 12.33;
  const BOY_X = [[0, 10.1], [2.75, 10.1], [3.0, 9.97], [3.75, 9.53], [8.21, 6.86], [11.96, 4.36], [14.92, 0.97], [15.67, 0.46], [16.15, 0.26], [30, 0.26]];
  const GIRL_X0 = -8.33;
  const GIRL_X = [[0, GIRL_X0], [5.5, GIRL_X0], [5.9, -8.17], [15.0, -0.42], [15.25, -0.36], [30, -0.36]];
  const GIRL_Z = [[0, 0.3], [5.5, 0.3], [6.2, 0.52], [8.0, 0.52], [12.0, 0.2], [30, 0.2]];
  const CAM_DE = [[12.3, -1.85], [12.71, -1.48], [13.42, -0.93], [14.17, -0.48], [14.92, 0.0], [15.4, 0.02], [30, 0.02]];
  const boyX = (t) => spwl(BOY_X, t, 0.12);
  const girlX = (t) => spwl(GIRL_X, t, 0.12);
  const girlZ = (t) => spwl(GIRL_Z, t, 0.12);

  // suitcase rest spots on the ground (from reference framing)
  const SUIT_HALF = 0.17, HANDLE_OFF = 0.215;
  const SUIT_G1 = new THREE.Vector3(-8.23, SUIT_HALF, 0.74);
  const SUIT_G2 = new THREE.Vector3(-0.44, SUIT_HALF, 0.54);

  function boyPose(t) {
    const x = boyX(t);
    const sp = Math.abs(boyX(t + 0.12) - boyX(t - 0.12)) / 0.24;
    const w = clamp(sp / 0.4, 0, 1);
    const g = gait(2 * Math.PI * (10.1 - x) / 0.92, w, 0.36);
    let yaw;
    if (t < CUT1) yaw = -Math.PI / 2 + 0.25;
    else if (t < CUT3) yaw = -Math.PI / 2 + 0.15;
    else yaw = -Math.PI / 2 + lerp(0.3, 0.8, smooth(15.9, 16.4, t));
    // left arm: idle -> reach to pick flowers -> hold bouquet
    const r1 = smooth(1.1, 1.45, t), hold = smooth(1.75, 2.15, t);
    let shL = lerp(lerp(0.2, 1.25, r1), 0.55, hold);
    let elL = lerp(lerp(1.0, 0.15, r1), 1.45, hold);
    let abL = 0.12;
    // right arm: strap/idle, paper in hand from shot C
    const mapHold = smooth(6.5, 7.5, t);
    let shR = lerp(0.15, 0.45, mapHold), elR = lerp(0.85, 1.25, mapHold), abR = 0.1;
    if (t >= CUT3) { shR = 0.25; elR = 1.0; shL = 0.4; elL = 1.3; }
    shL += -0.06 * w * g.s; shR += 0.06 * w * g.s;
    // handover of flowers in shot E
    const ho = smooth(15.7, 15.95, t) * (1 - smooth(16.05, 16.3, t));
    shL = lerp(shL, 1.0, ho); elL = lerp(elL, 0.45, ho);
    // both hands hold the open map
    const mw = smooth(16.05, 16.45, t);
    shL = lerp(shL, 0.45, mw); elL = lerp(elL, 1.0, mw); abL = lerp(abL, -0.25, mw);
    shR = lerp(shR, 0.45, mw); elR = lerp(elR, 1.0, mw); abR = lerp(abR, -0.25, mw);
    let headPitch = 0.1 + 0.3 * r1 * (1 - hold);
    if (t >= CUT2 && t < CUT3) headPitch = 0.28;
    if (t >= CUT3) headPitch = lerp(0.2, 0.45, smooth(15.8, 16.3, t));
    return {
      x, z: 0.45, yaw, hipL: g.hipL, hipR: g.hipR, kneeL: g.kneeL, kneeR: g.kneeR,
      bend: 0.06 * w + 0.15 * r1 * (1 - hold), headPitch, headYaw: 0,
      shL, elL, abL, shR, elR, abR
    };
  }

  function girlYaw(t) {
    let yaw = lerp(Math.PI / 2 - 0.55, Math.PI / 2 - 0.04, smooth(5.4, 6.1, t));
    yaw = lerp(yaw, Math.PI / 2 - 0.75, smooth(15.0, 15.35, t));
    yaw = lerp(yaw, Math.PI / 2 - 0.4, smooth(15.85, 16.2, t));
    return yaw;
  }
  function girlPose(t) {
    const x = girlX(t), z = girlZ(t);
    const dx = girlX(t + 0.12) - girlX(t - 0.12), dz = girlZ(t + 0.12) - girlZ(t - 0.12);
    const sp = Math.sqrt(dx * dx + dz * dz) / 0.24;
    const w = clamp(sp / 0.45, 0, 1);
    const g = gait(2 * Math.PI * (x - GIRL_X0) / 1.04, w, 0.38);
    const b1 = smooth(4.85, 5.15, t) * (1 - smooth(5.45, 5.85, t));
    const b2 = smooth(15.1, 15.45, t) * (1 - smooth(15.75, 16.1, t));
    const b = Math.max(b1, b2);
    let headPitch = t < 5.5 ? 0.45 : 0.05;
    if (t >= 15.0) headPitch = lerp(0.3, 0.45, smooth(15.9, 16.3, t));
    headPitch += 0.1 * b;
    let shR = 0.05 - 0.4 * b, elR = 0.1, abR = 0.13;
    const fl = smooth(15.95, 16.3, t);
    shR = lerp(shR, 0.5, fl); elR = lerp(elR, 1.25, fl); abR = lerp(abR, -0.1, fl);
    const shL = 0.05 - 0.4 * b - 0.18 * w * g.s, elL = 0.18, abL = 0.14;
    return {
      x, z, yaw: girlYaw(t),
      hipL: g.hipL + 0.8 * b, hipR: g.hipR + 0.8 * b,
      kneeL: g.kneeL + 1.4 * b, kneeR: g.kneeR + 1.4 * b,
      bend: 0.6 * b1 + 0.35 * b2 + 0.04 * w, headPitch, headYaw: 0,
      shL, elL, abL, shR, elR, abR
    };
  }

  // simple one-bone reach IK on a shoulder (arm kept nearly straight)
  const vS = new THREE.Vector3(), vD = new THREE.Vector3(), qP = new THREE.Quaternion(), qIK = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0);
  function reachArm(J, s, target, wgt) {
    if (wgt <= 0.0001) return;
    const sh = J['sh' + s];
    sh.getWorldPosition(vS);
    vD.copy(target).sub(vS).normalize();
    sh.parent.getWorldQuaternion(qP);
    vD.applyQuaternion(qP.invert());
    qIK.setFromUnitVectors(DOWN, vD);
    sh.quaternion.slerp(qIK, wgt);
    J['el' + s].rotation.x = lerp(J['el' + s].rotation.x, -0.05, wgt);
    J.root.updateMatrixWorld(true);
  }

  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vT = new THREE.Vector3();
  applyPose(boy, boyPose(1.45));
  boy.handL.getWorldPosition(vA);
  const FLOWER_G = { x: vA.x, y: vA.y, z: vA.z };
  weedUnderFlower.scale.set(1, Math.max(0.3, FLOWER_G.y - 0.05), 1);
  weedUnderFlower.position.set(FLOWER_G.x, Math.max(0.3, FLOWER_G.y - 0.05) / 2, FLOWER_G.z);

  function setCamera(t) {
    let cx, cz, cy = 1.2, pitch = -0.152;
    if (t < CUT1) { cx = 9.4 - 0.7 * easeDist(t, 2.8, 0.6); cz = 3.95; }
    else if (t < CUT2) {
      const a = -7.65, b = girlX(t) + 0.74;
      cx = (a + b + Math.sqrt((a - b) * (a - b) + 0.04)) / 2; cz = 3.6;
    } else if (t < CUT3) {
      cx = boyX(t) - lerp(0.48, 0.70, clamp((t - 8.2) / 2.3, 0, 1)); cz = 0.45 + lerp(3.75, 3.35, smooth(9.2, 10.6, t)); cy = lerp(1.25, 1.13, smooth(9.2, 10.6, t)); pitch = -0.119;
    } else { cx = spwl(CAM_DE, t, 0.2); cz = 3.3; }
    camera.position.set(cx, cy, cz);
    camera.rotation.set(pitch, 0, 0);
    camera.fov = 30; camera.aspect = W / H; camera.near = 0.05; camera.far = 1500;
    camera.updateProjectionMatrix();
  }

  function update(time, frame) {
    const t = clamp(time, 0, 30);
    setCamera(t);
    const bp = boyPose(t), gp = girlPose(t);
    applyPose(boy, bp);
    applyPose(girl, gp);

    // girl's right hand reaches the suitcase handle when picking up / putting down
    const lift = smooth(5.45, 5.75, t);
    const drop = smooth(15.3, 15.55, t);
    const ik1 = smooth(4.85, 5.2, t) * (1 - lift);
    const ik2 = drop * (1 - smooth(15.75, 16.0, t));
    if (ik1 > 0) reachArm(girl, 'R', vT.copy(SUIT_G1).setY(SUIT_HALF + HANDLE_OFF), ik1);
    if (ik2 > 0) reachArm(girl, 'R', vT.copy(SUIT_G2).setY(SUIT_HALF + HANDLE_OFF), ik2);

    // suitcase: ground -> carried in right hand -> ground
    girl.handR.getWorldPosition(vA);
    vA.y = Math.max(SUIT_HALF, vA.y - HANDLE_OFF);
    const carriedYaw = gp.yaw - Math.PI / 2;
    if (t < 5.45) { suitcase.position.copy(SUIT_G1); suitcase.rotation.set(0, 0, 0); }
    else if (t < 5.75) { suitcase.position.copy(SUIT_G1).lerp(vA, lift); suitcase.rotation.set(0, carriedYaw * lift, 0); }
    else if (t < 15.3) { suitcase.position.copy(vA); suitcase.rotation.set(0, carriedYaw, 0); }
    else if (t < 15.55) { suitcase.position.copy(vA).lerp(SUIT_G2, drop); suitcase.rotation.set(0, carriedYaw * (1 - drop), 0); }
    else { suitcase.position.copy(SUIT_G2); suitcase.rotation.set(0, 0, 0); }

    // teal case + red book in girl's left hand
    girl.handL.getWorldPosition(vA);
    caseGrp.position.set(vA.x, Math.max(0.21, vA.y), vA.z);
    caseGrp.rotation.set(0, gp.yaw - Math.PI / 2, 0);

    // flowers: weed plant -> boy's left hand -> girl's right hand
    if (t < 1.45) { flowers.position.set(FLOWER_G.x, FLOWER_G.y, FLOWER_G.z); }
    else if (t < 16.05) { boy.handL.getWorldPosition(vA); flowers.position.copy(vA); }
    else { girl.handR.getWorldPosition(vA); flowers.position.copy(vA); }
    flowers.position.y -= 0.06;
    flowers.rotation.set(0.15, 0, 0.1);

    // map: small letter in shot C, paper then unfolded map in shot E
    mapSmall.visible = t >= 7.0 && t < CUT3;
    mapBig.visible = t >= CUT3;
    boy.handR.getWorldPosition(vA);
    boy.handL.getWorldPosition(vB);
    if (mapSmall.visible) {
      mapSmall.position.set(vA.x - 0.05, vA.y + 0.03, vA.z);
      mapSmall.rotation.set(-0.9, bp.yaw, 0, 'YXZ');
    }
    if (mapBig.visible) {
      const mw = smooth(16.0, 16.45, t);
      const cxm = lerp(vA.x - 0.06, (vA.x + vB.x) / 2 - 0.08, mw);
      const cym = lerp(vA.y + 0.0, (vA.y + vB.y) / 2 + 0.03, mw);
      const czm = lerp(vA.z + 0.1, (vA.z + vB.z) / 2 + 0.08, mw);
      mapBig.position.set(cxm, cym, czm);
      mapBig.rotation.set(lerp(-1.25, -0.95, mw), 0, lerp(0.0, -0.1, mw), 'YXZ');
      const sc = lerp(0.65, 1.0, mw);
      mapBig.scale.set(sc, sc, 1);
      mapM.color.copy(MAP_LIGHT).lerp(MAP_DARK, mw);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
