// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video1.
// Rooftop standoff: an agent fires at a long-coated figure who dodges and bends
// backward in a slow-motion orbiting shot, then falls onto his back.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const V3 = THREE.Vector3;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const scene = new THREE.Scene();
  const SKY = 0xc4ccc6;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 45, 300);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.03, 900);

  // ---------- seeded RNG (construction time only) ----------
  let rs = ((seed | 0) ^ 0x9e3779b9) >>> 0;
  if (rs === 0) rs = 123456789;
  const rand = () => {
    rs ^= rs << 13; rs >>>= 0;
    rs ^= rs >>> 17;
    rs ^= rs << 5; rs >>>= 0;
    return rs / 4294967296;
  };

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xe8eee8, 0x5e5a4c, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.3);
  sun.position.set(-20, 40, 15);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));

  function gridTexture(base, line, n, lw, rx, ry, noise) {
    const data = new Uint8Array(n * n * 4);
    const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
    const lr = (line >> 16) & 255, lg = (line >> 8) & 255, lb = line & 255;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const on = x < lw || y < lw;
        const k = 1 + (rand() - 0.5) * noise;
        const i = (y * n + x) * 4;
        data[i] = clamp((on ? lr : br) * k, 0, 255);
        data[i + 1] = clamp((on ? lg : bg) * k, 0, 255);
        data[i + 2] = clamp((on ? lb : bb) * k, 0, 255);
        data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx, ry);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBox(cx, cy, cz, sx, sy, sz, mat, parent) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.position.set(cx, cy, cz);
    m.scale.set(sx, sy, sz);
    (parent || scene).add(m);
    return m;
  }

  // ---------- environment: rooftop ----------
  // Roof deck spans x [-20, 8], z [-12, 12]; floor y = 0.
  const floorTex = gridTexture(0x85816e, 0x6e6b60, 64, 2, 28 / 1.2, 24 / 1.2, 0.08);
  const floorMat = lam(0xffffff, { map: floorTex });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(-6, 0, 0);
  scene.add(floor);

  const parapetMat = lam(0xaaa48a);
  addBox(-6, 0.4, -12.2, 28.8, 0.8, 0.4, parapetMat);
  addBox(-6, 0.4, 12.2, 28.8, 0.8, 0.4, parapetMat);
  addBox(-20.2, 0.4, 0, 0.4, 0.8, 24.8, parapetMat);
  addBox(8.2, 0.4, 0, 0.4, 0.8, 24.8, parapetMat);

  // railing on right parapet
  const railMat = lam(0x8f9188);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  for (let z = -12; z <= -1; z += 1.6) {
    const p = new THREE.Mesh(cylGeo, railMat);
    p.position.set(8.2, 1.3, z);
    p.scale.set(0.03, 1.0, 0.03);
    scene.add(p);
  }
  const rail = new THREE.Mesh(cylGeo, railMat);
  rail.position.set(8.2, 1.8, -6.5);
  rail.rotation.x = Math.PI / 2;
  rail.scale.set(0.035, 11, 0.035);
  scene.add(rail);

  // elevated helipad slab with stairs, helicopter on top
  const padMat = lam(0xb4b496);
  addBox(-12.5, 0.65, -5, 13, 1.3, 18, padMat);
  addBox(-5.5, 0.33, -11, 1.0, 0.66, 1.6, padMat);
  addBox(-5.0, 0.16, -11, 0.6, 0.33, 1.6, padMat);

  const heli = new THREE.Group();
  heli.position.set(-9.0, 1.3, -5.0);
  heli.rotation.y = 0.15;
  scene.add(heli);
  const heliMat = lam(0x2c2c2c);
  const sphGeo = new THREE.SphereGeometry(1, 20, 14);
  const cabin = new THREE.Mesh(sphGeo, heliMat);
  cabin.position.set(0, 1.25, 0);
  cabin.scale.set(1.1, 1.0, 1.8);
  heli.add(cabin);
  const boom = new THREE.Mesh(cylGeo, heliMat);
  boom.position.set(0, 1.45, 3.4);
  boom.rotation.x = Math.PI / 2;
  boom.scale.set(0.2, 3.6, 0.2);
  heli.add(boom);
  for (const sx of [-0.95, 0.95]) {
    const sk = new THREE.Mesh(cylGeo, heliMat);
    sk.position.set(sx, 0.08, 0);
    sk.rotation.x = Math.PI / 2;
    sk.scale.set(0.05, 3.4, 0.05);
    heli.add(sk);
    const st = new THREE.Mesh(cylGeo, heliMat);
    st.position.set(sx * 0.8, 0.35, 0);
    st.scale.set(0.04, 0.6, 0.04);
    heli.add(st);
  }
  addBox(0, 2.35, 0, 0.25, 0.05, 10, heliMat, heli).rotation.y = 0.5;

  // water tank (behind the figure, image-left in the front shot)
  addBox(3.4, 3.0, 7.5, 3.0, 6.0, 3.0, lam(0x54412f));
  const pipe = new THREE.Mesh(cylGeo, lam(0x6a6a64));
  pipe.position.set(1.72, 3.0, 6.6);
  pipe.scale.set(0.12, 6.0, 0.12);
  scene.add(pipe);
  addBox(1.8, 1.3, 6.35, 0.25, 0.35, 0.25, lam(0xa02020));

  // glass tower behind the agent
  const glassTex = gridTexture(0x748c86, 0x93a39b, 64, 3, 13, 25, 0.05);
  addBox(-5, 20, -32, 40, 100, 4, lam(0xffffff, { map: glassTex }));
  addBox(-9, 20, -29.8, 2.2, 100, 0.8, lam(0xb6aa82));
  const glassTex2 = gridTexture(0x667e78, 0x8e9c94, 64, 4, 3, 30, 0.05);
  addBox(12.5, 20, -29, 5, 100, 3, lam(0xffffff, { map: glassTex2 }));
  addBox(15.3, 20, -29, 0.8, 100, 3.2, lam(0xb0aa90));
  const towerTex = gridTexture(0x9c9282, 0x7e776a, 32, 6, 4, 26, 0.05);
  addBox(22, 10, -52, 8, 80, 8, lam(0xffffff, { map: towerTex }));

  // distant white office block and city (below roof level, hazy)
  addBox(-7, -15, 78, 14, 46, 10, lam(0xdcdcd2));
  const cityMats = [lam(0x9a9c94), lam(0x8c8f88), lam(0xa8a69c), lam(0x7f847e)];
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const r = 55 + rand() * 120;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (z < -24 && x > -30 && x < 30) continue;
    const w = 8 + rand() * 14, d = 8 + rand() * 14;
    const top = -28 + rand() * 30;
    const hgt = top + 80;
    addBox(x, top - hgt / 2, z, w, hgt, d, cityMats[i % cityMats.length]);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), lam(0x858c84));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -78;
  scene.add(ground);

  // steam puffs (visible in the front shot and late in the slow-motion orbit)
  const steam = new THREE.Group();
  scene.add(steam);
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xdde2dc, transparent: true, opacity: 0.22, depthWrite: false });
  const puffs = [[2.0, 0.6, 2.6, 1.5], [3.4, 1.3, 3.6, 1.9], [1.0, 0.3, 1.6, 0.9], [-2.4, 0.6, 2.8, 1.7],
    [-3.8, 1.2, 4.6, 2.2], [-1.4, 0.3, 1.7, 0.9], [0.4, 0.4, 3.6, 1.3], [5.0, 1.0, 1.0, 1.8], [-5.5, 1.0, 1.0, 2.0]];
  for (const [x, y, z, r] of puffs) {
    const p = new THREE.Mesh(sphGeo, steamMat);
    p.position.set(x, y, z);
    p.scale.set(r * 1.2, r * 0.8, r);
    steam.add(p);
  }

  // ---------- articulated human proxy ----------
  const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0), NEGZ = new V3(0, 0, -1), POSZ = new V3(0, 0, 1);
  const M4 = new THREE.Matrix4();
  const tA = new V3(), tB = new V3(), tC = new V3();

  function placeSeg(mesh, a, b, r) {
    tA.subVectors(b, a);
    const len = tA.length();
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, tA.divideScalar(len));
    mesh.scale.set(r, Math.max(len, 1e-3), r);
  }
  function placeBasis(mesh, c, x, y, z, sx, sy, sz) {
    M4.makeBasis(x, y, z);
    mesh.quaternion.setFromRotationMatrix(M4);
    mesh.position.copy(c);
    mesh.scale.set(sx, sy, sz);
  }
  function ik(hip, foot, a, b, hint, outKnee) {
    tA.subVectors(foot, hip);
    let L = tA.length();
    const dir = tB.copy(tA).divideScalar(L > 1e-6 ? L : 1);
    L = clamp(L, Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const x = (a * a - b * b + L * L) / (2 * L);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    tC.copy(hint).addScaledVector(dir, -hint.dot(dir));
    if (tC.lengthSq() < 1e-8) tC.set(0, 0, -1);
    tC.normalize();
    outKnee.copy(hip).addScaledVector(dir, x).addScaledVector(tC, h);
  }

  function makeHuman(o) {
    const g = new THREE.Group();
    const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
    const torso = add(boxGeo, o.torsoMat);
    const pelvis = add(boxGeo, o.legMat);
    const neck = add(cylGeo, o.skinMat);
    const head = add(sphGeo, o.skinMat);
    const hair = add(sphGeo, o.hairMat);
    const shirt = o.shirtMat ? add(boxGeo, o.shirtMat) : null;
    const uArm = [add(cylGeo, o.armMat), add(cylGeo, o.armMat)];
    const fArm = [add(cylGeo, o.armMat), add(cylGeo, o.armMat)];
    const hand = [add(sphGeo, o.skinMat), add(sphGeo, o.skinMat)];
    const thigh = [add(cylGeo, o.legMat), add(cylGeo, o.legMat)];
    const shin = [add(cylGeo, o.legMat), add(cylGeo, o.legMat)];
    const foot = [add(boxGeo, o.shoeMat), add(boxGeo, o.shoeMat)];
    let coat = null;
    if (o.coatMat) {
      const gap = 70 * D2R;
      const cg = new THREE.CylinderGeometry(0.19, 0.38, 1, 18, 1, true, Math.PI + gap / 2, Math.PI * 2 - gap);
      cg.translate(0, -0.5, 0);
      coat = add(cg, o.coatMat);
    }

    const P = new V3(), T = new V3(), lat = new V3(), back = new V3(), N = new V3(), Hc = new V3();
    const S = [new V3(), new V3()], E = [new V3(), new V3()], Hd = [new V3(), new V3()], dirs = [new V3(), new V3()];
    const Hip = [new V3(), new V3()], K = [new V3(), new V3()], F = [new V3(), new V3()];
    const hint = new V3(), fl = new V3(), tmp = new V3(), tmp2 = new V3();

    function apply(v) {
      P.set(v[0], v[1], v[2]);
      const pitch = v[3] * D2R, roll = v[4] * D2R, yaw = v[5] * D2R;
      T.set(Math.sin(roll), Math.cos(pitch) * Math.cos(roll), Math.sin(pitch) * Math.cos(roll)).normalize();
      lat.set(Math.cos(yaw), 0, Math.sin(yaw));
      lat.addScaledVector(T, -lat.dot(T)).normalize();
      back.crossVectors(lat, T).normalize();

      placeBasis(torso, tmp.copy(P).addScaledVector(T, 0.28), lat, T, back, 0.40, 0.50, 0.23);
      placeBasis(pelvis, P, lat, T, back, 0.36, 0.2, 0.24);
      N.copy(P).addScaledVector(T, 0.52);
      placeSeg(neck, tmp.copy(N).addScaledVector(T, -0.03), tmp2.copy(N).addScaledVector(T, 0.07), 0.05);
      Hc.copy(N).addScaledVector(T, 0.16);
      placeBasis(head, Hc, lat, T, back, 0.1, 0.12, 0.11);
      placeBasis(hair, tmp.copy(Hc).addScaledVector(T, 0.025).addScaledVector(back, 0.018), lat, T, back, 0.106, 0.106, 0.112);
      if (shirt) placeBasis(shirt, tmp.copy(P).addScaledVector(T, 0.38).addScaledVector(back, -0.118), lat, T, back, 0.13, 0.26, 0.01);

      for (let i = 0; i < 2; i++) {
        const sgn = i === 0 ? 1 : -1; // 0 = right (+lat), 1 = left
        S[i].copy(N).addScaledVector(T, -0.06).addScaledVector(lat, 0.21 * sgn);
        dirs[i].set(v[6 + i * 3], v[7 + i * 3], v[8 + i * 3]);
        if (dirs[i].lengthSq() < 1e-8) dirs[i].set(0, -1, 0);
        dirs[i].normalize();
        E[i].copy(S[i]).addScaledVector(dirs[i], 0.3);
        E[i].y -= 0.02;
        Hd[i].copy(S[i]).addScaledVector(dirs[i], 0.6);
        placeSeg(uArm[i], S[i], E[i], 0.058);
        placeSeg(fArm[i], E[i], Hd[i], 0.047);
        hand[i].position.copy(Hd[i]).addScaledVector(dirs[i], 0.035);
        hand[i].scale.set(0.045, 0.045, 0.045);

        Hip[i].copy(P).addScaledVector(lat, 0.11 * sgn);
        F[i].set(v[12 + i * 3], v[13 + i * 3], v[14 + i * 3]);
        hint.set(v[18] * sgn, v[19], v[20]);
        if (hint.lengthSq() < 1e-8) hint.set(0, 0, -1);
        hint.normalize();
        ik(Hip[i], F[i], 0.47, 0.47, hint, K[i]);
        placeSeg(thigh[i], Hip[i], K[i], 0.078);
        placeSeg(shin[i], K[i], F[i], 0.06);
        foot[i].position.copy(F[i]).addScaledVector(hint, 0.07);
        foot[i].quaternion.setFromUnitVectors(POSZ, tmp.copy(hint).negate());
        foot[i].scale.set(0.1, 0.08, 0.26);
      }

      if (coat) {
        // coat hangs from the upper back (below the shoulders when bent backward)
        const top = tmp.copy(P).addScaledVector(T, 0.38).addScaledVector(back, 0.1);
        fl.set(v[21], v[22], v[23]);
        const D = tmp2.copy(DOWN).add(fl).normalize();
        let len = 1.2;
        if (D.y < -0.05) len = Math.min(len, (top.y - 0.03) / -D.y);
        len = Math.max(len, 0.25);
        const rsc = clamp(top.y / 0.6, 0.45, 1); // bunches up when lying on the floor
        coat.position.copy(top);
        coat.quaternion.setFromUnitVectors(DOWN, D);
        coat.scale.set(rsc, len, rsc);
      }
    }
    return {
      group: g, apply,
      handR: Hd[0], handL: Hd[1], dirR: dirs[0], dirL: dirs[1],
      shoulderL: S[1], hipL: Hip[1], kneeL: K[1],
    };
  }

  // ---------- keyframe sampling (Hermite / Catmull-Rom, absolute time) ----------
  function sampleKeys(keys, t, out) {
    const n = keys.length;
    const dim = keys[0].v.length;
    out = out || new Array(dim);
    if (t <= keys[0].t) { for (let j = 0; j < dim; j++) out[j] = keys[0].v[j]; return out; }
    if (t >= keys[n - 1].t) { for (let j = 0; j < dim; j++) out[j] = keys[n - 1].v[j]; return out; }
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1].t) i++;
    const k0 = keys[Math.max(i - 1, 0)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(i + 2, n - 1)];
    const dt = k2.t - k1.t;
    const u = (t - k1.t) / dt;
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    for (let j = 0; j < dim; j++) {
      const m1 = (k0 === k1) ? (k2.v[j] - k1.v[j]) : (k2.v[j] - k0.v[j]) / (k2.t - k0.t) * dt;
      const m2 = (k3 === k2) ? (k2.v[j] - k1.v[j]) : (k3.v[j] - k1.v[j]) / (k3.t - k1.t) * dt;
      out[j] = h00 * k1.v[j] + h10 * m1 + h01 * k2.v[j] + h11 * m2;
    }
    return out;
  }

  function buildPoseKeys(list, defaults) {
    let prev = Object.assign({}, defaults);
    return list.map(([t, o]) => {
      const c = Object.assign({}, prev, o);
      prev = c;
      return { t, v: [...c.p, ...c.a, ...c.rA, ...c.lA, ...c.rF, ...c.lF, ...c.kh, ...c.fl] };
    });
  }

  // ---------- Neo (black long coat) ----------
  const black = lam(0x161616);
  const neo = makeHuman({
    torsoMat: black, legMat: lam(0x121212), armMat: black, skinMat: lam(0xc49a80),
    hairMat: lam(0x0c0a08), shoeMat: lam(0x0a0a0a), coatMat: lam(0x141414, { side: THREE.DoubleSide }),
  });
  scene.add(neo.group);

  const AIM = { p: [0, 0.93, 0], a: [0, 0, 0], rA: [-0.1, 0.0, -1], lA: [0.1, 0.0, -1],
    rF: [0.33, 0.06, 0.05], lF: [-0.33, 0.06, -0.05], kh: [0, 0, -1], fl: [0, 0, 0] };
  const LEANF = { rF: [0.28, 0.06, -0.05], lF: [-0.28, 0.06, -0.05], kh: [0.3, 0, -1] };
  const neoKeys = buildPoseKeys([
    [0.0, {}],
    [0.71, {}],
    [1.0, { rA: [-0.05, -0.1, -1], lA: [0.05, -0.1, -1] }],
    [1.38, { p: [0, 0.94, 0], rA: [0.35, -0.85, -0.35], lA: [-0.35, -0.85, -0.35] }],
    [2.6, {}],
    [3.46, { p: [0.05, 0.68, 0.05], a: [-5, -8, -25], rA: [0.6, -0.5, 0.3], lA: [-0.6, 0.2, -0.8],
      rF: [0.45, 0.06, 0.1], lF: [-0.35, 0.06, -0.1], kh: [0.7, 0, -0.7], fl: [0.5, 0, 0.3] }],
    [4.17, { p: [0, 0.56, 0.05], a: [-5, -5, -30], rA: [0.8, -0.3, 0.2], lA: [-0.7, 0.4, -0.5],
      rF: [0.45, 0.06, 0.1], lF: [-0.4, 0.06, -0.05], fl: [0.4, 0, 0.4] }],
    [4.88, { p: [-0.03, 0.5, 0.05], a: [-15, -20, -10], rA: [0.4, -0.7, 0.3], lA: [-0.4, 0.8, -0.2], fl: [0.4, 0, 0.3] }],
    [5.55, { p: [0, 0.5, 0.03], a: [-5, 10, 15], rA: [0.1, 0.95, -0.1], lA: [-0.7, -0.6, -0.2],
      rF: [0.3, 0.06, 0.15], lF: [-0.65, 0.06, -0.25], fl: [-0.2, 0, 0.4] }],
    [6.26, { p: [0, 0.62, 0.08], a: [22, 0, 0], rA: [1, 0.25, -0.1], lA: [-1, 0.1, 0.15],
      rF: [0.3, 0.06, -0.1], lF: [-0.3, 0.06, -0.1], kh: [0.4, 0, -0.9], fl: [0, 0, 0.6] }],
    [6.97, Object.assign({ p: [0, 0.7, 0.12], a: [36, 0, 0], rA: [0.5, -0.6, 0.3], lA: [-0.7, 0.6, 0.3], fl: [0, 0, 0.7] }, LEANF)],
    [7.63, { p: [0, 0.7, 0.18], a: [52, 0, 0], rA: [0.5, -0.5, 0.5], lA: [-0.1, 1, 0.1], fl: [0, 0, 0.6] }],
    [8.34, { p: [0, 0.68, 0.22], a: [64, 0, 0], rA: [0.4, -0.6, 0.6], lA: [-0.05, 1, 0.05] }],
    [9.0, { p: [0, 0.67, 0.25], a: [74, 0, 0], rA: [0.45, -0.55, 0.6], lA: [0, 1, 0] }],
    [9.72, { p: [0, 0.66, 0.27], a: [82, 0, 0], rA: [0.8, -0.2, 0.5], lA: [0, 1, -0.05], fl: [0, 0, 0.5] }],
    [10.43, { p: [0, 0.66, 0.27], a: [87, 0, 0], rA: [0.9, 0.2, 0.3], lA: [0, 1, -0.1] }],
    [11.09, { p: [0, 0.66, 0.27], a: [90, 0, 0], rA: [0.4, -0.1, 0.9] }],
    [11.8, { a: [92, 0, 0] }],
    [12.51, { a: [92, 0, 0], rA: [0.2, -0.2, 1] }],
    [13.18, { p: [0, 0.65, 0.27], a: [94, 0, 0], rA: [-0.2, -0.3, 0.9] }],
    [13.6, {}],
    [14.3, { p: [0, 0.4, 0.42], a: [92, -10, 0], rA: [0.6, 0.3, 0.6], lA: [-0.6, 0.3, 0.4],
      rF: [0.35, 0.06, -0.3], lF: [-0.35, 0.06, -0.3], kh: [0, 1, -0.5], fl: [-1.5, 0, 0.8] }],
    [14.9, { p: [0, 0.14, 0.52], a: [90, -15, 0], rA: [0.5, 0.4, 0.6], lA: [-0.8, 0.1, -0.2],
      rF: [0.4, 0.06, -0.25], lF: [-0.4, 0.06, -0.25], kh: [0, 1, -0.3], fl: [-3, 0, 0.5] }],
    [15.27, { p: [0, 0.13, 0.53], a: [90, -18, 0], rA: [-0.4, 0.7, 0.6], lA: [-0.7, -0.1, -0.5],
      rF: [0.25, 0.06, -0.25], lF: [-0.45, 0.06, -0.28] }],
    [15.97, { p: [0, 0.13, 0.55], a: [90, -25, 0], rA: [0.82, -0.08, 0.56], lA: [-0.93, -0.07, -0.36],
      rF: [0.53, 0.06, -0.18], lF: [-0.35, 0.06, -0.18], kh: [0.2, 1, -0.3] }],
    [16.1, {}],
  ], AIM);

  // ---------- Agent (olive-brown suit) ----------
  const agent = makeHuman({
    torsoMat: lam(0x524a3a), legMat: lam(0x3f392d), armMat: lam(0x524a3a), skinMat: lam(0xcc9e80),
    hairMat: lam(0x5a3e28), shoeMat: lam(0x151210), shirtMat: lam(0xe8e8e2),
  });
  const AGX = -1.9, AGZ = -10;
  agent.group.position.set(AGX, 0, AGZ);
  agent.group.rotation.y = Math.PI + Math.atan2(-AGX, -AGZ); // faces Neo
  scene.add(agent.group);
  agent.group.updateMatrixWorld(true);
  const agentKeys = buildPoseKeys([
    [0.0, {}],
    [0.45, { rA: [0, 0, -1] }],
    [16.1, {}],
  ], { p: [0, 0.97, 0], a: [0, 0, 0], rA: [-0.35, -0.6, -0.72], lA: [-0.12, -1, 0.05],
    rF: [0.14, 0.06, 0.02], lF: [-0.14, 0.06, -0.02], kh: [0, 0, -1], fl: [0, 0, 0] });
  const aw = (x, y, z) => agent.group.localToWorld(new V3(x, y, z));
  const CAM_A_POS = aw(-0.15, 1.0, -1.1), CAM_A_TGT = aw(0.2, 1.36, 0);
  const CAM_C_POS0 = aw(0.197, 1.44, -1.2), CAM_C_POS1 = aw(0.185, 1.44, -1.15), CAM_C_TGT = aw(0.131, 1.464, 0);

  // ---------- guns ----------
  const gunMat = lam(0x1c1c1e);
  function makeGun(parent) {
    const g = new THREE.Group();
    addBox(0, 0.055, -0.06, 0.032, 0.04, 0.2, gunMat, g);
    const grip = addBox(0, 0.0, 0.0, 0.03, 0.11, 0.045, gunMat, g);
    grip.rotation.x = -0.2;
    parent.add(g);
    return g;
  }
  const gunNR = makeGun(neo.group), gunNL = makeGun(neo.group);
  const gunA = makeGun(agent.group);
  const floorGun1 = makeGun(scene), floorGun2 = makeGun(scene);
  floorGun1.position.set(0.74, 0.02, 0.17);
  floorGun1.rotation.set(0, 0.6, Math.PI / 2, 'YXZ');
  floorGun2.position.set(-0.94, 0.02, 0.1);
  floorGun2.rotation.set(0, -0.9, -Math.PI / 2, 'YXZ');
  function attachGun(g, hand, dir) {
    g.position.copy(hand).addScaledVector(dir, 0.035);
    g.quaternion.setFromUnitVectors(NEGZ, dir);
  }

  // ---------- slow-motion bullets with ripple trails ----------
  const MUZZLE = aw(0.21, 1.485, -0.795);
  const BV = 1.0; // m/s in bullet time
  const NR = 12;
  const ringGeo = new THREE.TorusGeometry(1, 0.12, 6, 20);
  const ringMats = [];
  for (let k = 0; k < NR; k++) {
    ringMats.push(new THREE.MeshBasicMaterial({ color: 0xd2dad2, transparent: true, opacity: 0.55 * (1 - k / NR), depthWrite: false }));
  }
  const bulletMat = lam(0x8a8a80);
  const bullets = [
    [7.4, 0.0, 1.25], [8.9, 0.1, 1.12], [10.3, -0.1, 1.05], [11.8, 0.05, 1.0], [13.1, 0.0, 1.12],
  ].map(([tp, x, y]) => {
    const Q = new V3(x, y, 0.3);
    const dir = new V3().subVectors(Q, MUZZLE);
    const back = dir.length();
    dir.normalize();
    const body = new THREE.Mesh(sphGeo, bulletMat);
    body.scale.set(0.012, 0.012, 0.03);
    body.quaternion.setFromUnitVectors(POSZ, dir);
    scene.add(body);
    const rings = [];
    for (let k = 0; k < NR; k++) {
      const r = new THREE.Mesh(ringGeo, ringMats[k]);
      r.quaternion.setFromUnitVectors(POSZ, dir);
      const rad = 0.03 + 0.008 * k;
      r.scale.set(rad, rad, rad);
      scene.add(r);
      rings.push(r);
    }
    return { tp, Q, dir, back, body, rings };
  });

  // ---------- camera keyframes ----------
  // E1: long-lens tracking shot behind-right of Neo: [t, px, py, pz, tx, ty, tz]
  const trackKeys = [
    [5.9, 1.28, 1.25, 4.47, 0.34, 1.05, -1.46],
    [6.26, 1.573, 1.22, 4.323, 0.2, 1.03, -1.52],
    [6.97, 2.83, 1.55, 3.62, -0.28, 0.91, -1.51],
    [7.3, 3.165, 1.6, 3.056, -0.61, 0.88, -1.61],
  ].map((r) => ({ t: r[0], v: r.slice(1) }));
  // E2: bullet-time orbit: [t, theta(deg, 0 = behind Neo at +Z, 90 = +X side), R, height, tx, ty, tz]
  const orbitKeys = [
    [7.3, 75, 2.8, 1.75, 0, 1.1, 0.1],
    [7.63, 85, 2.7, 1.7, 0, 1.15, 0.15],
    [8.34, 95, 2.6, 2.0, 0, 0.85, 0.2],
    [9.0, 105, 2.4, 2.1, 0, 0.75, 0.25],
    [9.72, 118, 2.3, 0.85, 0, 0.75, 0.4],
    [10.43, 180, 2.0, 0.45, 0, 0.75, 0.3],
    [11.09, 250, 2.1, 0.6, 0, 0.8, 0.45],
    [11.8, 262, 2.2, 0.6, 0, 0.8, 0.45],
    [12.51, 272, 1.9, 0.45, 0, 0.85, 0.7],
    [13.18, 290, 1.4, 0.7, 0, 0.85, 0.75],
    [13.6, 298, 1.3, 0.75, 0, 0.8, 0.8],
  ].map((r) => ({ t: r[0], v: r.slice(1) }));
  // H: oblique overhead from the feet side: [t, px, py, pz, tx, ty, tz]
  const topKeys = [
    [14.95, 0.0, 2.0, -0.35, 0.05, 0.0, 0.66],
    [15.27, 0.02, 1.9, -0.37, 0.02, 0.0, 0.62],
    [15.97, 0.05, 1.8, -0.4, -0.05, 0.0, 0.6],
  ].map((r) => ({ t: r[0], v: r.slice(1) }));

  const neoPose = new Array(24), agentPose = new Array(24), orb = new Array(6);
  const FLOOR_WIDE = new THREE.Color(0xffffff), FLOOR_TOP = new THREE.Color(0x9aa49a);
  const camPos = new V3(), camTgt = new V3(), tmpV = new V3();

  function update(time, frame) {
    const t = clamp(time, 0, duration);

    neo.apply(sampleKeys(neoKeys, t, neoPose));
    agent.apply(sampleKeys(agentKeys, t, agentPose));

    const neoHasGuns = t < 1.75;
    gunNR.visible = gunNL.visible = neoHasGuns;
    attachGun(gunNR, neo.handR, neo.dirR);
    attachGun(gunNL, neo.handL, neo.dirL);
    floorGun1.visible = floorGun2.visible = t >= 14.95;
    attachGun(gunA, agent.handR, agent.dirR);
    floorMat.color.copy(t >= 14.95 ? FLOOR_TOP : FLOOR_WIDE);

    const bulletOn = t >= 5.9 && t < 13.6;
    for (const b of bullets) {
      const s = (t - b.tp) * BV;
      const okB = bulletOn && s >= -b.back && s < 14;
      b.body.visible = okB;
      b.body.position.copy(b.Q).addScaledVector(b.dir, s);
      for (let k = 0; k < NR; k++) {
        const sk = s - (k + 1) * 0.09;
        const r = b.rings[k];
        r.visible = okB && sk >= -b.back;
        r.position.copy(b.Q).addScaledVector(b.dir, sk);
      }
    }

    steam.visible = (t >= 0.4 && t < 1.75) || (t >= 9.4 && t < 13.6);

    camera.up.set(0, 1, 0);
    let fov = 40;
    if (t < 0.4) {
      // A: low-angle medium shot of the agent raising his pistol
      camPos.copy(CAM_A_POS);
      camTgt.copy(CAM_A_TGT);
      fov = 42;
    } else if (t < 1.75) {
      // B: frontal full shot of Neo in the steam, aiming two pistols then lowering them
      const u = (t - 0.4) / 1.35;
      camPos.set(0.3, 1.0, -4.65 + 0.15 * u);
      camTgt.set(0.05, 1.0, 0);
      fov = 26;
    } else if (t < 3.1) {
      // C: extreme close-up down the agent's gun barrel
      const u = (t - 1.75) / 1.35;
      camPos.lerpVectors(CAM_C_POS0, CAM_C_POS1, u);
      camTgt.copy(CAM_C_TGT);
      fov = 24;
    } else if (t < 5.9) {
      // D: wide shot from behind Neo toward the agent and the glass tower
      const u = (t - 3.1) / 2.8;
      camPos.set(0.3 + 0.15 * u, 1.0, 3.3 + 0.2 * u);
      camTgt.set(-0.61 - 0.1 * u, 1.16, -10.0);
      fov = 38;
    } else if (t < 7.3) {
      // E1: long-lens tracking shot arcing to Neo's right as he leans back
      sampleKeys(trackKeys, t, orb);
      camPos.set(orb[0], orb[1], orb[2]);
      camTgt.set(orb[3], orb[4], orb[5]);
      fov = 30;
    } else if (t < 13.6) {
      // E2: slow-motion orbit around the backward-bending figure
      sampleKeys(orbitKeys, t, orb);
      const th = orb[0] * D2R;
      camPos.set(Math.sin(th) * orb[1], Math.max(0.25, orb[2]), 0.15 + Math.cos(th) * orb[1]);
      camTgt.set(orb[3], orb[4], orb[5]);
      fov = 40;
    } else if (t < 14.25) {
      // F: extreme close-up looking down on the grazed shoulder
      camTgt.copy(neo.shoulderL);
      camPos.copy(camTgt).add(tmpV.set(-0.12, 0.32, 0.05));
      fov = 40;
    } else if (t < 14.95) {
      // G: extreme close-up of the thigh with the floor beyond
      camTgt.copy(neo.hipL).add(neo.kneeL).multiplyScalar(0.5);
      camTgt.x -= 0.25;
      camTgt.y = Math.max(0, camTgt.y - 0.3);
      camPos.copy(neo.hipL).add(neo.kneeL).multiplyScalar(0.5).add(tmpV.set(0.05, 0.3, -0.1));
      camera.up.set(0, 0, 1);
      fov = 45;
    } else {
      // H: oblique overhead from the feet side; Neo on his back between the two dropped pistols
      sampleKeys(topKeys, t, orb);
      camPos.set(orb[0], orb[1], orb[2]);
      camTgt.set(orb[3], orb[4], orb[5]);
      fov = 40;
    }
    camera.position.copy(camPos);
    camera.fov = fov;
    camera.aspect = width / height;
    camera.lookAt(camTgt);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
