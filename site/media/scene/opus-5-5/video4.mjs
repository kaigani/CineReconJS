// CineRecon L1 proxy reconstruction - Three.js sampled-frame baseline
// Continuous single take: two soldiers (Blake leading, Schofield behind) walk along a WWI trench.
// Camera leads them backwards (0-6 s), swings round their right side (6-9 s) and then follows
// behind Blake down an open sandbagged trench, with a sergeant walking just ahead (9-24 s).

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  const SKY = 0xa9b3ad;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 26, 95);

  const VFOV = 48;
  const camera = new THREE.PerspectiveCamera(VFOV, width / height, 0.05, 400);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic rng ----------
  let s0 = (seed >>> 0) || 1234567;
  function rng() {
    s0 = (s0 + 0x6D2B79F5) >>> 0;
    let t = s0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- helpers ----------
  const matCache = {};
  function mat(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    return matCache[hex];
  }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function cyl(rt, rb, h, m, seg = 12) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); }
  function sph(r, m) { return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); }
  function dome(r, m) { return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); }
  function add(parent, mesh, x, y, z) { mesh.position.set(x, y, z); parent.add(mesh); return mesh; }

  // ---------- letterbox (2.39-ish matte, part of camera rig) ----------
  {
    const lb = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false });
    const D = 0.1;
    const halfH = D * Math.tan((VFOV * Math.PI) / 360);
    const halfW = halfH * (width / height);
    const barH = 2 * halfH * (93 / 720);
    const ext = barH + 0.05 * halfH;
    for (const sgn of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2.4, ext), lb);
      bar.position.set(0, sgn * (halfH - barH + ext / 2), -D);
      bar.renderOrder = 1000;
      bar.frustumCulled = false;
      camera.add(bar);
    }
  }

  // ---------- lights ----------
  const HEMI = 2.1, AMB = 0.55, SUN = 1.7;
  const hemi = new THREE.HemisphereLight(0xe2e8e4, 0x6a5a48, HEMI);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, AMB);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xfff4e6, SUN);
  sun.position.set(-4, 10, -3);
  scene.add(sun);

  // ---------- environment ----------
  const WALL = 1.35;          // trench half-width
  const Z0 = 40, Z1 = -90;    // trench extent
  const LEN = Z0 - Z1, ZC = (Z0 + Z1) / 2;
  const env = new THREE.Group();
  scene.add(env);

  // floor (mud)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2 + 0.4, LEN), mat(0x5f5952));
  floor.rotation.x = -Math.PI / 2;
  add(env, floor, 0, 0, ZC);
  // duckboard strip
  add(env, box(0.7, 0.04, LEN, mat(0x74685a)), 0.1, 0.02, ZC);

  // trench banks: extruded cross-section (wall face, parapet step, spoil heap, ground)
  function bank(sgn, color) {
    const pts = [[WALL, 0], [WALL, 1.4], [WALL + 0.9, 1.95], [3.8, 2.4], [5.5, 3.3], [8.0, 3.6], [11, 3.0], [16, 2.4], [70, 2.3], [70, -0.5], [WALL, -0.5]];
    const shp = new THREE.Shape();
    pts.forEach(([x, y], i) => (i ? shp.lineTo(sgn * x, y) : shp.moveTo(sgn * x, y)));
    const g = new THREE.ExtrudeGeometry(shp, { depth: LEN, bevelEnabled: false, steps: 1 });
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    m.position.z = Z1;
    env.add(m);
  }
  bank(1, 0x75644f);
  bank(-1, 0x786652);
  for (const sgn of [-1, 1]) {
    // earth wall face (slightly different tone from heap)
    add(env, box(0.06, 1.4, LEN, mat(0x67594b)), sgn * (WALL + 0.02), 0.7, ZC);
    // sandbag parapet rows
    const sb = [0x83735f, 0x7a6b58, 0x887865];
    add(env, box(0.6, 0.26, LEN, mat(sb[0])), sgn * (WALL + 0.22), 1.52, ZC);
    add(env, box(0.6, 0.24, LEN, mat(sb[1])), sgn * (WALL + 0.4), 1.76, ZC);
    add(env, box(0.6, 0.2, LEN, mat(sb[2])), sgn * (WALL + 0.62), 1.95, ZC);
  }
  // grey plank revetment on lower left wall (open section)
  add(env, box(0.06, 1.25, 70, mat(0x6e6c63)), -WALL + 0.03, 0.62, -5 - 35);
  // wooden revetment posts
  for (let z = -6.5; z > -70; z -= 3.2) {
    for (const sgn of [-1, 1]) {
      const h = 1.75 + rng() * 0.45;
      const p = box(0.12, h, 0.12, mat(0x655240));
      p.rotation.z = sgn * (0.04 + rng() * 0.04);
      add(env, p, sgn * (WALL - 0.04), h / 2, z + (rng() - 0.5) * 0.6);
    }
  }
  // section 1: tall timber-lined, partly roofed trench (z +12 .. -4.6)
  const T0 = 12, T1 = -4.6;
  for (const sgn of [-1, 1]) {
    add(env, box(0.12, 3.2, T0 - T1, mat(0x4a4234)), sgn * (WALL - 0.04), 1.6, (T0 + T1) / 2);
    for (let z = T0; z > T1 - 0.1; z -= 1.8) add(env, box(0.16, 3.3, 0.16, mat(0x46392b)), sgn * (WALL - 0.1), 1.65, z);
  }
  // corrugated iron panel (image-right of the early shot)
  add(env, box(0.05, 1.8, 2.4, mat(0x4c4b45)), -WALL + 0.12, 1.0, -2.6);

  // dugouts in the right wall (dark openings with timber frames + benches)
  const dugouts = [[-9.0, -11.0], [-12.0, -14.2], [-15.0, -16.8], [-22.0, -24.5]];
  for (const [za, zb] of dugouts) {
    const L = za - zb, zc = (za + zb) / 2;
    add(env, box(0.04, 1.6, L, mat(0x1c1814)), WALL - 0.01, 0.8, zc);
    add(env, box(0.22, 0.2, L + 0.4, mat(0x5a4836)), WALL - 0.06, 1.7, zc);
    add(env, box(0.14, 1.75, 0.14, mat(0x5a4836)), WALL - 0.08, 0.88, za + 0.1);
    add(env, box(0.14, 1.75, 0.14, mat(0x5a4836)), WALL - 0.08, 0.88, zb - 0.1);
    add(env, box(0.35, 0.42, L, mat(0x564736)), WALL - 0.2, 0.21, zc);
    // sandbag roof of dugout (protrudes a little over the trench)
    add(env, box(1.0, 0.5, L + 0.6, mat(0x83735f)), WALL + 0.1, 1.75, zc);
  }
  // fire step on right further down
  add(env, box(0.45, 0.45, 6, mat(0x65543f)), WALL - 0.22, 0.22, -21.5);

  // telegraph poles + wires
  const poleM = mat(0x3e342a);
  const poles = [[6.8, -14], [7.4, -24], [8.2, -36], [9.2, -50], [-6.5, -33], [-7.5, -52], [5.5, 6]];
  const tops = [];
  for (const [x, z] of poles) {
    const p = cyl(0.09, 0.12, 8.5, poleM, 8);
    add(env, p, x, 6.0, z);
    add(env, box(1.5, 0.08, 0.08, poleM), x, 9.6, z);
    add(env, box(1.2, 0.08, 0.08, poleM), x, 9.1, z);
    tops.push(new THREE.Vector3(x, 9.6, z));
  }
  function wire(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const w = cyl(0.012, 0.012, d.length(), mat(0x2a2622), 4);
    w.position.copy(a).addScaledVector(d, 0.5);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    env.add(w);
  }
  for (const off of [-0.6, 0.6]) {
    for (let i = 0; i < 3; i++) wire(tops[i].clone().add(new THREE.Vector3(off, 0, 0)), tops[i + 1].clone().add(new THREE.Vector3(off, 0, 0)));
    wire(tops[4].clone().add(new THREE.Vector3(off, 0, 0)), tops[5].clone().add(new THREE.Vector3(off, 0, 0)));
    wire(tops[0].clone().add(new THREE.Vector3(off, 0, 0)), tops[4].clone().add(new THREE.Vector3(off, -0.3, 0)));
  }
  // far end mounds closing the view
  add(env, box(40, 4.5, 4, mat(0x7a6049)), 0, 2.2, Z1 + 2);
  add(env, box(40, 4.4, 4, mat(0x5c4f42)), 0, 2.2, 19);
  // spoil heap closing the trench view ahead (trench turns out of sight)
  const endHeap = add(env, sph(1, mat(0x75644f)), 0.5, 0.2, -45);
  endHeap.scale.set(11, 3.4, 6);

  // ---------- soldiers ----------
  function makeSoldier(o) {
    const tunicM = mat(o.tunic), webM = mat(o.web), skinM = mat(0xc49a80), helmM = mat(o.helmet);
    const legM = mat(o.legs || o.tunic), bootM = mat(0x2e261f);
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const pelvis = new THREE.Group(); pelvis.position.y = 0.92; body.add(pelvis);
    const spine = new THREE.Group(); pelvis.add(spine);
    add(spine, box(0.48, 0.54, 0.29, tunicM), 0, 0.26, 0);
    add(spine, box(0.5, o.coat ? 0.5 : 0.24, 0.31, tunicM), 0, o.coat ? -0.2 : -0.08, 0);
    add(spine, box(0.4, 0.36, 0.03, webM), 0, 0.3, 0.155);
    if (o.pack) add(spine, box(0.42, 0.4, 0.2, webM), 0, 0.28, -0.24);
    const legs = [];
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(0.1 * side, -0.02, 0); pelvis.add(hip);
      add(hip, box(0.15, 0.46, 0.16, legM), 0, -0.22, 0);
      const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
      add(knee, box(0.12, 0.42, 0.13, legM), 0, -0.21, 0);
      add(knee, box(0.12, 0.07, 0.26, bootM), 0, -0.42, 0.05);
      legs.push({ hip, knee });
    }
    const arms = [];
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0.3 * side, 0.48, 0); spine.add(sh);
      add(sh, box(0.11, 0.3, 0.12, tunicM), 0, -0.14, 0);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      add(el, box(0.1, 0.27, 0.1, tunicM), 0, -0.13, 0);
      add(el, sph(0.05, skinM), 0, -0.3, 0);
      arms.push({ sh, el });
    }
    add(spine, box(0.2, 0.07, 0.18, tunicM), 0, 0.55, 0); // collar
    const neck = new THREE.Group(); neck.position.y = 0.52; spine.add(neck);
    add(neck, cyl(0.05, 0.055, 0.08, skinM), 0, 0.04, 0);
    const head = new THREE.Group(); head.position.y = 0.06; neck.add(head);
    const skull = add(head, sph(0.097, skinM), 0, 0.1, 0.012);
    skull.scale.set(0.95, 1.12, 1.0);
    const hair = add(head, sph(0.096, mat(0x3b2e24)), 0, 0.115, -0.022);
    hair.scale.set(0.98, 1.0, 0.95);
    const hel = add(head, dome(0.135, helmM), 0, 0.15, -0.01);
    hel.scale.set(1, 0.78, 1.05);
    add(head, cyl(0.17, 0.17, 0.018, helmM, 20), 0, 0.15, -0.01);
    if (o.rifle) {
      const side = o.rifle; // +1 = soldier's left shoulder (+X local), -1 = right
      const r = new THREE.Group(); r.position.set(0.2 * side, 0.2, -0.22); r.rotation.z = -side * 0.12; spine.add(r);
      add(r, box(0.05, 0.75, 0.07, mat(0x5a3d27)), 0, -0.15, 0);
      add(r, box(0.03, 0.42, 0.03, mat(0x2b2a28)), 0, 0.42, 0);
    }
    return { root, body, pelvis, spine, legs, arms, head };
  }

  function pose(s, p) {
    const w = p.walk || 0, ph = p.phase || 0;
    const sw = Math.sin(ph) * 0.42 * w;
    let hipL = -sw, hipR = sw;
    let kneeL = 0.06 + w * 0.7 * Math.max(0, Math.cos(ph + Math.PI / 4));
    let kneeR = 0.06 + w * 0.7 * Math.max(0, Math.cos(ph + Math.PI + Math.PI / 4));
    let armL = sw * 0.7, armR = -sw * 0.7, elL = -0.25, elR = -0.25;
    let pelY = 0.92 - 0.02 * w + 0.025 * w * Math.abs(Math.cos(ph));
    let lean = 0.04 * w;
    if (p.mode === 'sit') {
      hipL = hipR = -1.45; kneeL = kneeR = 1.45; pelY = 0.5; armL = armR = -0.5; elL = elR = -0.9; lean = 0.15;
    } else if (p.mode === 'crouch') {
      hipL = hipR = -1.9; kneeL = kneeR = 2.3; pelY = 0.33; armL = armR = -0.7; elL = elR = -0.9; lean = 0.35;
    } else if (p.mode === 'stand') {
      hipL = hipR = 0; kneeL = kneeR = 0.05; pelY = 0.92; armL = armR = 0.05; elL = elR = -0.2; lean = 0;
    }
    s.legs[0].hip.rotation.x = hipL; s.legs[1].hip.rotation.x = hipR;
    s.legs[0].knee.rotation.x = kneeL; s.legs[1].knee.rotation.x = kneeR;
    s.arms[0].sh.rotation.x = armL; s.arms[1].sh.rotation.x = armR;
    s.arms[0].el.rotation.x = elL; s.arms[1].el.rotation.x = elR;
    s.arms[0].sh.rotation.z = 0.06; s.arms[1].sh.rotation.z = -0.06;
    s.pelvis.position.y = pelY;
    s.spine.rotation.x = lean;
    s.head.rotation.set(p.headPitch || 0, p.headYaw || 0, 0);
  }

  const KHAKI = 0x877660, WEB = 0xa08e70, HELM = 0x687064;
  const blake = makeSoldier({ tunic: 0x86755a, web: 0xa38f6e, helmet: 0x646c60, pack: true, rifle: 1 });
  const scho = makeSoldier({ tunic: 0x8a7a5e, web: 0xa99676, helmet: 0x6c7468, pack: true, rifle: -1 });
  const sarge = makeSoldier({ tunic: 0x8c7856, web: 0x9e8b6a, helmet: 0x60675b, pack: true, rifle: -1, coat: true });
  scene.add(blake.root, scho.root, sarge.root);
  const walkers = [
    makeSoldier({ tunic: KHAKI, web: WEB, helmet: HELM, pack: true, rifle: 1 }),
  ];
  for (const w of walkers) scene.add(w.root);

  // static extras: [x, z, mode, yaw, y, helmetHex]
  const extrasDef = [
    [1.12, -9.9, 'sit', -Math.PI / 2, 0, HELM],
    [1.12, -11.8, 'sit', -Math.PI / 2, 0, 0x767666],
    [1.12, -12.4, 'sit', -Math.PI / 2, 0, HELM],
    [1.2, -13.1, 'stand', -Math.PI / 2 - 0.4, 0, HELM],
    [1.08, -15.9, 'stand', -Math.PI / 2 + 0.5, 0, 0x9a8a62],
    [1.15, -18.8, 'crouch', -Math.PI / 2, 0, HELM],
    [1.2, -21.2, 'stand', -Math.PI / 2, 0.45, 0x9a8a62],
    [1.12, -23.6, 'sit', -Math.PI / 2, 0, HELM],
  ];
  for (const [x, z, mode, yaw, y, hh] of extrasDef) {
    const e = makeSoldier({ tunic: 0x837258, web: 0x998769, helmet: hh, pack: false, rifle: 0 });
    e.root.position.set(x, y, z);
    e.root.rotation.y = yaw;
    pose(e, { mode, headYaw: (rng() - 0.5) * 0.6, headPitch: mode === 'sit' ? 0.2 : 0 });
    scene.add(e.root);
  }

  // ---------- animation tracks ----------
  function track(keys) {
    const n = keys.length, dim = keys[0].length - 1;
    function tan(i, d) {
      if (i === 0 || i === n - 1) return 0;
      const a = keys[i][d] - keys[i - 1][d], b = keys[i + 1][d] - keys[i][d];
      if (a * b <= 0) return 0;
      return (keys[i + 1][d] - keys[i - 1][d]) / (keys[i + 1][0] - keys[i - 1][0]);
    }
    return function (t) {
      if (t <= keys[0][0]) return keys[0].slice(1);
      if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
      let i = 0;
      while (i < n - 2 && t > keys[i + 1][0]) i++;
      const k0 = keys[i], k1 = keys[i + 1];
      const h = k1[0] - k0[0], u = (t - k0[0]) / h, u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      const out = [];
      for (let d = 1; d <= dim; d++) out.push(h00 * k0[d] + h10 * h * tan(i, d) + h01 * k1[d] + h11 * h * tan(i + 1, d));
      return out;
    };
  }
  const PI = Math.PI;
  const SPEED = 0.9, BX = 0.05;
  const blakePos = (t) => [BX, -SPEED * t];

  // camera relative to Blake: t, dx, y, dz, yaw, pitch
  const camT = track([
    [0.00, 0.00, 1.68, -1.65, PI, -0.17],
    [1.04, 0.24, 1.68, -1.63, PI, -0.17],
    [2.09, -0.07, 1.68, -1.42, PI, -0.17],
    [3.13, 0.00, 1.68, -1.25, PI - 0.30, -0.17],
    [4.17, 0.00, 1.68, -1.27, PI - 0.15, -0.17],
    [5.21, 0.00, 1.68, -1.33, PI - 0.12, -0.17],
    [6.26, 0.48, 1.68, -0.96, PI, -0.17],
    [7.30, 0.80, 1.68, 0.46, PI / 2, -0.17],
    [8.34, 0.67, 1.68, 1.00, PI / 2 + 0.22, -0.17],
    [9.38, -0.65, 1.95, 1.47, 0, -0.16],
    [10.43, -0.42, 1.95, 1.70, 0, -0.16],
    [11.47, 0.16, 1.95, 2.20, 0, -0.16],
    [12.51, 0.38, 1.95, 1.92, 0, -0.16],
    [13.56, 0.04, 1.95, 1.84, 0, -0.16],
    [14.60, -0.04, 1.95, 1.38, 0, -0.16],
    [15.64, 0.19, 1.95, 1.10, 0, -0.16],
    [16.68, 0.40, 1.95, 1.00, 0, -0.16],
    [17.73, 0.24, 1.95, 0.79, 0, -0.16],
    [18.77, 0.30, 1.95, 0.76, 0, -0.16],
    [19.81, 0.28, 1.95, 0.67, 0, -0.16],
    [20.85, 0.24, 1.95, 0.82, 0, -0.16],
    [21.90, 0.12, 1.95, 0.85, 0, -0.16],
    [22.94, -0.14, 1.95, 0.92, 0, -0.16],
    [23.98, -0.09, 1.95, 1.16, 0, -0.16],
    [24.10, -0.09, 1.95, 1.18, 0, -0.16],
  ]);
  // Schofield relative to Blake: t, dx, dz, yaw, headYaw
  const schoT = track([
    [0.00, -0.55, 2.15, PI, 0],
    [1.04, -0.68, 1.78, PI, 0],
    [2.09, -0.52, 1.30, PI, 0],
    [3.13, -0.85, 1.12, PI, 0.1],
    [4.17, -0.56, 0.85, PI, 0],
    [5.21, -0.35, 0.98, PI, 0],
    [6.26, -0.10, 0.94, PI - 0.2, -0.2],
    [7.30, -0.43, 0.86, PI - 0.6, -0.9],
    [8.34, -0.20, 1.36, PI + 0.45, 0],
    [9.38, -1.20, 0.37, PI, 0],
    [10.43, -0.86, 0.70, PI, 0],
    [11.47, -0.53, 1.10, PI, -0.2],
    [12.50, -0.75, 1.70, PI, 0],
    [24.10, -0.75, 1.70, PI, 0],
  ]);
  // Blake: t, yaw, headYaw
  const blakeT = track([
    [0.0, PI, 0], [6.4, PI, 0], [7.3, PI + 0.6, 0.7], [8.2, PI, 0.2], [9.38, PI, 0],
    [10.43, PI, 0.8], [11.2, PI, 0], [19.6, PI, 0], [20.85, PI, 0.15], [21.6, PI, 0], [24.1, PI, 0],
  ]);
  // Sergeant relative to Blake: t, dx, dz, yaw
  const sargeT = track([
    [0.0, -0.5, -14.0, 0],
    [6.0, -0.5, -8.0, 0],
    [9.38, -0.70, -2.93, 0],
    [9.8, -0.60, -2.60, 0],
    [10.3, -0.30, -2.60, PI],
    [10.43, -0.12, -2.70, PI],
    [11.47, 0.16, -2.70, PI],
    [12.51, 0.45, -2.50, PI],
    [13.56, 0.53, -1.86, PI],
    [14.60, 0.55, -2.30, PI],
    [15.64, 0.50, -1.85, PI],
    [16.68, 0.50, -1.20, PI],
    [17.73, 0.55, -1.05, PI],
    [18.77, 0.60, -1.08, PI],
    [19.30, 0.62, -0.80, PI],
    [19.81, 0.62, -0.63, PI / 2],
    [20.40, 0.55, -0.50, 0.15],
    [20.85, 0.52, -0.48, 0.10],
    [21.40, 0.60, -0.65, PI],
    [21.90, 0.62, -0.85, PI],
    [22.94, 0.62, -0.92, PI],
    [23.98, 0.35, -1.04, PI],
    [24.10, 0.35, -1.06, PI],
  ]);
  const walkerRel = [[-0.25, -9.0]];

  function worldOf(relTrack, t) {
    const b = blakePos(t), r = relTrack(t);
    return [b[0] + r[0], b[1] + r[1]];
  }
  function speedOf(relTrack, t) {
    const a = worldOf(relTrack, t - 0.08), b = worldOf(relTrack, t + 0.08);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.16;
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const CAD = 2 * PI * 0.9;

  const lightTrack = track([[0, 0.68], [2.0, 0.64], [3.0, 0.48], [5.4, 0.48], [6.3, 1.0], [24.1, 1.0]]);

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));
    const b = blakePos(t);

    // Blake
    const bt = blakeT(t);
    blake.root.position.set(b[0], 0, b[1]);
    blake.root.rotation.y = bt[0];
    pose(blake, { walk: 1, phase: CAD * t, headYaw: bt[1] });

    // Schofield
    const st = schoT(t), sw = worldOf(schoT, t);
    scho.root.position.set(sw[0], 0, sw[1]);
    scho.root.rotation.y = st[2];
    pose(scho, { walk: clamp01(speedOf(schoT, t) / SPEED), phase: CAD * t + 1.4, headYaw: st[3] });

    // Sergeant
    const gt = sargeT(t), gw = worldOf(sargeT, t);
    sarge.root.position.set(gw[0], 0, gw[1]);
    sarge.root.rotation.y = gt[2];
    pose(sarge, { walk: clamp01(speedOf(sargeT, t) / SPEED), phase: CAD * t + 2.6, headYaw: 0 });

    // soldiers walking further ahead
    walkers.forEach((w, i) => {
      const r = walkerRel[i];
      w.root.position.set(b[0] + r[0], 0, b[1] + r[1]);
      w.root.rotation.y = PI;
      pose(w, { walk: 1, phase: CAD * t + 0.7 + i * 2.1 });
    });

    // lighting (dim covered timber section early on)
    const k = lightTrack(t)[0];
    hemi.intensity = HEMI * k;
    amb.intensity = AMB * k;
    sun.intensity = SUN * k;

    // camera
    const c = camT(t);
    const bob = 0.012 * Math.sin(CAD * 2 * t + 0.3);
    const shx = 0.006 * Math.sin(1.7 * t + 0.4) + 0.004 * Math.sin(3.1 * t + 1.1);
    const shy = 0.005 * Math.sin(1.3 * t + 2.0) + 0.003 * Math.sin(2.9 * t);
    camera.position.set(b[0] + c[0], c[1] + bob, b[1] + c[2]);
    camera.rotation.set(c[4] + shy, c[3] + shx, 0.006 * Math.sin(0.9 * t + 0.5));
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
