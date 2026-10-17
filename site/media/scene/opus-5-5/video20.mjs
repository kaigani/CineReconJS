// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video20.
// A heavily armoured gunner mans a twin-barrel pintle turret on a rocky hilltop and
// fires on red-lit robot enemies across a snowy battlefield. Shot A (0-0.27s): low
// rear view into a huge yellow explosion. Shot B (0.27-3.32s): warm-lit near-static
// camera behind-left while the turret swings from pointing right back to forward.
// From 3.32s the camera is rigidly attached behind the turret (cool night grading).

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const W = width || 1280, H = height || 720;
  const FPS = fps || 60;
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 600);
  camera.rotation.order = 'YXZ';

  // ---------- deterministic helpers ----------
  let rs = (((seed | 0) ^ 0x9e3779b9) >>> 0) || 1;
  function rng() {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let t = rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rng();
  function hash(n) { const x = Math.sin(n * 127.1 + ((seed | 0) % 1000) * 3.7 + 11.3) * 43758.5453; return x - Math.floor(x); }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  function track(keys) {
    return function (t) {
      const n = keys.length;
      if (t <= keys[0][0]) return keys[0][1];
      if (t >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0;
      while (i < n - 2 && t > keys[i + 1][0]) i++;
      const t0 = keys[i][0], t1 = keys[i + 1][0];
      const u = (t - t0) / (t1 - t0);
      const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
      const u2 = u * u, u3 = u2 * u;
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
    };
  }
  function linTrack(keys) {
    return function (t) {
      const n = keys.length;
      if (t <= keys[0][0]) return keys[0][1];
      if (t >= keys[n - 1][0]) return keys[n - 1][1];
      let i = 0;
      while (i < n - 2 && t > keys[i + 1][0]) i++;
      const u = smooth((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]));
      return lerp(keys[i][1], keys[i + 1][1], u);
    };
  }
  function std(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0.05 }, o || {})); }
  function basic(color, o) { return new THREE.MeshBasicMaterial(Object.assign({ color }, o || {})); }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m); }
  function sph(r, m, s) { return new THREE.Mesh(new THREE.SphereGeometry(r, s || 16, Math.max(8, (s || 16) >> 1)), m); }

  // ---------- environment ----------
  const fog = new THREE.FogExp2(0x2b3137, 0.022);
  scene.fog = fog;
  const bg = new THREE.Color(0x2b3137);
  scene.background = bg;

  // procedural ground texture: dark rock + snow patches + rust-red scrub
  function grid(G) { const a = new Float32Array(G * G); for (let i = 0; i < G * G; i++) a[i] = rng(); return a; }
  function sampleGrid(a, G, u, v) {
    const fx = u * G, fy = v * G;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const ux = fx - ix, uy = fy - iy;
    const x0 = ((ix % G) + G) % G, y0 = ((iy % G) + G) % G, x1 = (x0 + 1) % G, y1 = (y0 + 1) % G;
    const sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
    return lerp(lerp(a[y0 * G + x0], a[y0 * G + x1], sx), lerp(a[y1 * G + x0], a[y1 * G + x1], sx), sy);
  }
  function makeGroundTex(size) {
    const g1 = grid(6), g2 = grid(13), g3 = grid(31), g4 = grid(7);
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size, v = y / size;
        const fine = sampleGrid(g3, 31, u, v);
        const n = 0.55 * sampleGrid(g1, 6, u, v) + 0.3 * sampleGrid(g2, 13, u, v) + 0.15 * fine;
        const snow = smooth((n - 0.55) / 0.07);
        const redm = smooth((sampleGrid(g4, 7, u, v) - 0.6) / 0.12) * (1 - snow);
        const base = 34 + 34 * fine;
        let R = lerp(base, 178, snow), Gc = lerp(base, 182, snow), B = lerp(base + 4, 188, snow);
        R = lerp(R, 104, redm * 0.75); Gc = lerp(Gc, 46, redm * 0.75); B = lerp(B, 32, redm * 0.75);
        const i = (y * size + x) * 4;
        data[i] = R; data[i + 1] = Gc; data[i + 2] = B; data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  const groundTex = makeGroundTex(256);
  groundTex.repeat.set(26, 26);

  const FIELD_Y = -3.5;
  function hillDome(x, z) {
    const dx = x / 7, dz = (z + 1) / 9;
    const r = 1 - dx * dx - dz * dz;
    return r > 0 ? -5 + 5.2 * Math.sqrt(r) : -99;
  }
  function fieldH(x, z) {
    let h = FIELD_Y + 0.35 * Math.sin(x * 0.31 + 1.3) * Math.sin(z * 0.27 + 0.4) + 0.25 * Math.sin(x * 0.11 - z * 0.07);
    if (z < -55) h += (-z - 55) * 0.12;
    const side = Math.abs(x) - 45;
    if (side > 0) h += side * 0.15;
    return h;
  }
  function groundH(x, z) { return Math.max(fieldH(x, z), hillDome(x, z)); }

  const terrGeo = new THREE.PlaneGeometry(260, 260, 220, 220);
  terrGeo.rotateX(-Math.PI / 2);
  terrGeo.translate(0, 0, -80);
  {
    const pos = terrGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, groundH(pos.getX(i), pos.getZ(i)));
    terrGeo.computeVertexNormals();
  }
  const terrain = new THREE.Mesh(terrGeo, std(0xffffff, { map: groundTex, roughness: 1 }));
  scene.add(terrain);

  const rockMat = std(0x3a3a3c, { flatShading: true, roughness: 1 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  // right-hand rock outcrop next to the turret (persistent landmark)
  const outcropMat = std(0x8a8c90, { map: groundTex, flatShading: true, roughness: 1 });
  const outcrop = new THREE.Mesh(rockGeo, outcropMat);
  outcrop.scale.set(0.6, 1.5, 1.1); outcrop.position.set(2.0, -0.3, -3.5); outcrop.rotation.set(0.1, 0.5, 0.05);
  scene.add(outcrop);
  // rock pedestal for the white mech
  const mechRock = new THREE.Mesh(rockGeo, rockMat);
  mechRock.scale.set(1.4, 1.1, 1.3); mechRock.position.set(-0.3, -2.9, -13); scene.add(mechRock);
  for (let i = 0; i < 70; i++) {
    const x = rr(-45, 45), z = rr(-90, -6);
    if (Math.hypot(x / 7, (z + 1) / 9) < 1.05) continue;
    const s = rr(0.3, 1.4);
    const r = new THREE.Mesh(rockGeo, rockMat);
    r.scale.set(s * rr(0.8, 1.6), s * rr(0.5, 1.0), s * rr(0.8, 1.5));
    r.position.set(x, groundH(x, z) + s * 0.2, z);
    r.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
    scene.add(r);
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0x8090a0, 0x202428, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xa0b0c0, 0.8);
  sun.position.set(-6, 10, -12);
  scene.add(sun);
  scene.add(sun.target);
  const amb = new THREE.AmbientLight(0x404448, 0.3);
  scene.add(amb);

  // ---------- turret + gunner ----------
  const BASE_Y = groundH(0, 0);
  const turret = new THREE.Group();
  turret.position.set(0, BASE_Y, 0);
  scene.add(turret);
  const metalDark = std(0x34342f, { metalness: 0.5, roughness: 0.6 });
  const metalLight = std(0x8e8c82, { metalness: 0.6, roughness: 0.45 });
  const metalMid = std(0x5c5a50, { metalness: 0.5, roughness: 0.55 });
  const pedestal = cyl(0.28, 0.45, 0.72, metalDark, 16); pedestal.position.y = 0.36; turret.add(pedestal);
  const yawG = new THREE.Group(); turret.add(yawG);
  const plate = cyl(0.55, 0.55, 0.08, metalMid, 20); plate.position.y = 0.74; yawG.add(plate);
  const post = cyl(0.12, 0.14, 0.4, metalDark); post.position.set(0, 0.95, -0.05); yawG.add(post);
  const pitchG = new THREE.Group(); pitchG.position.set(0, 1.18, -0.05); yawG.add(pitchG);
  const receiver = box(0.5, 0.26, 0.9, metalMid); receiver.position.set(0, 0, -0.1); pitchG.add(receiver);
  const topCover = box(0.32, 0.12, 0.6, metalLight); topCover.position.set(0, 0.2, -0.12); pitchG.add(topCover);
  const barrels = new THREE.Group(); pitchG.add(barrels);
  for (const s of [-1, 1]) {
    const b = cyl(0.04, 0.04, 1.6, metalLight, 10); b.rotation.x = Math.PI / 2; b.position.set(s * 0.11, 0.03, -1.3); barrels.add(b);
    const mb = cyl(0.055, 0.055, 0.14, metalDark, 10); mb.rotation.x = Math.PI / 2; mb.position.set(s * 0.11, 0.03, -2.08); barrels.add(mb);
  }
  const handleMat = metalDark;
  for (const s of [-1, 1]) {
    const h = cyl(0.03, 0.03, 0.28, handleMat, 8); h.position.set(s * 0.19, 0.12, 0.38); pitchG.add(h);
  }
  const drum = cyl(0.24, 0.24, 0.26, metalDark, 16); drum.rotation.z = Math.PI / 2; drum.position.set(0.36, -0.12, 0.05); pitchG.add(drum);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 8, 64), metalLight);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.86, 0.6); yawG.add(ring);
  const ringStrut = box(0.06, 0.06, 0.9, metalDark); ringStrut.position.set(0, 0.86, -0.3); yawG.add(ringStrut);
  // muzzle flash + light
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.03, -2.2); pitchG.add(muzzle);
  const flashMat = basic(0xfff0c0, { transparent: true, opacity: 0.95, fog: false, depthWrite: false });
  const flash = sph(0.22, flashMat, 12); flash.position.copy(muzzle.position); pitchG.add(flash);
  const flashLight = new THREE.PointLight(0xffd090, 0, 14, 1.5); flashLight.position.set(0, 0.1, -2.35); pitchG.add(flashLight);

  // gunner (articulated)
  const armor = std(0x6e2a22, { roughness: 0.6, metalness: 0.3 });
  const armorDark = std(0x2f2723, { roughness: 0.8, metalness: 0.2 });
  const helmetM = std(0x7a3328, { roughness: 0.5, metalness: 0.4 });
  const gunner = new THREE.Group(); gunner.position.set(0, -0.55, 0.8); gunner.scale.setScalar(1.4); yawG.add(gunner);
  const seat = box(0.42, 0.08, 0.4, metalDark); seat.position.y = 0.66; gunner.add(seat);
  const torsoG = new THREE.Group(); torsoG.position.y = 0.74; gunner.add(torsoG);
  const torso = box(0.5, 0.6, 0.32, armor); torso.position.y = 0.32; torsoG.add(torso);
  const pack = box(0.4, 0.45, 0.18, armorDark); pack.position.set(0, 0.36, 0.24); torsoG.add(pack);
  const head = sph(0.14, helmetM, 14); head.position.y = 0.76; head.scale.set(1, 1.1, 1.05); torsoG.add(head);
  const gArms = [];
  for (const s of [-1, 1]) {
    const pad = box(0.2, 0.12, 0.24, armor); pad.position.set(s * 0.32, 0.6, 0); torsoG.add(pad);
    const sh = new THREE.Group(); sh.position.set(s * 0.3, 0.55, 0); torsoG.add(sh);
    const ua = box(0.13, 0.32, 0.13, armor); ua.position.y = -0.16; sh.add(ua);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    const fa = box(0.11, 0.3, 0.11, armorDark); fa.position.y = -0.15; el.add(fa);
    gArms.push({ sh, el, s });
  }
  const gLegs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.13, 0.74, 0); gunner.add(hip);
    const th = box(0.17, 0.45, 0.19, armorDark); th.position.y = -0.22; hip.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.45; hip.add(kn);
    const shn = box(0.15, 0.48, 0.17, armor); shn.position.y = -0.24; kn.add(shn);
    hip.rotation.x = Math.PI / 2 * 0.95; kn.rotation.x = -1.45;
    gLegs.push({ hip, kn });
  }

  // ---------- infantry allies ----------
  function makeSoldier(c1, c2) {
    const g = new THREE.Group();
    const m1 = std(c1, { roughness: 0.7, metalness: 0.25 }), m2 = std(c2, { roughness: 0.8 });
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.12, 0.95, 0); g.add(hip);
      const th = box(0.16, 0.46, 0.18, m2); th.position.y = -0.23; hip.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.46; hip.add(kn);
      const sh = box(0.15, 0.48, 0.17, m1); sh.position.y = -0.24; kn.add(sh);
      legs.push({ hip, kn });
    }
    const torso = box(0.44, 0.56, 0.28, m1); torso.position.y = 1.25; g.add(torso);
    const pk = box(0.34, 0.42, 0.2, m2); pk.position.set(0, 1.3, 0.23); g.add(pk);
    const hd = sph(0.13, m1, 12); hd.position.y = 1.67; g.add(hd);
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.27, 1.48, 0); g.add(sh);
      const ua = box(0.12, 0.3, 0.12, m1); ua.position.y = -0.15; sh.add(ua);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      const fa = box(0.1, 0.28, 0.1, m2); fa.position.y = -0.14; el.add(fa);
      arms.push({ sh, el });
    }
    const rifle = box(0.07, 0.1, 0.9, std(0x222222)); rifle.position.set(0.06, 1.3, -0.4); g.add(rifle);
    arms[0].sh.rotation.set(1.2, 0, -0.3); arms[0].el.rotation.x = 0.4;
    arms[1].sh.rotation.set(0.7, 0, 0.1); arms[1].el.rotation.x = 1.0;
    scene.add(g);
    return { g, legs, rifle };
  }
  function poseWalk(sol, phase, amp) {
    for (let i = 0; i < 2; i++) {
      const p = phase + i * Math.PI;
      sol.legs[i].hip.rotation.x = amp * Math.sin(p);
      sol.legs[i].kn.rotation.x = -amp * 1.2 * Math.max(0, Math.sin(p + 1.2));
    }
  }
  const ally1 = makeSoldier(0x4a4038, 0x26231f);
  const ally2 = makeSoldier(0x3a3c3a, 0x202220);
  const a1x = track([[0, -1.3], [1.2, -1.4], [2.4, -3.0], [3.3, -3.1], [4.97, -3.6], [7.0, -4.5], [9.0, -5.0], [12.7, -5.0]]);
  const a1z = track([[0, -1.3], [1.2, -1.2], [2.4, -1.0], [3.3, -0.9], [4.97, -2.5], [7.0, -4.0], [9.0, -4.5], [12.7, -4.5]]);

  // ---------- robot enemies ----------
  const redGlow = basic(0xff2a1a, { fog: false });
  function makeRobot(color, scale, emissive) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body); // facing -Z locally
    const mb = std(color, { metalness: 0.4, roughness: 0.55, emissive: emissive || 0x000000 });
    const legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.22, 1.1, 0); body.add(hip);
      const th = box(0.18, 0.6, 0.22, mb); th.position.y = -0.3; hip.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.6; hip.add(kn);
      const sh = box(0.16, 0.5, 0.2, mb); sh.position.y = -0.25; kn.add(sh);
      const ft = box(0.22, 0.08, 0.36, mb); ft.position.set(0, -0.5, -0.05); kn.add(ft);
      legs.push({ hip, kn });
    }
    const torso = box(0.75, 0.7, 0.5, mb); torso.position.y = 1.5; body.add(torso);
    const hd = box(0.32, 0.24, 0.32, mb); hd.position.y = 2.0; body.add(hd);
    const core = sph(0.12, redGlow, 10); core.position.set(0, 1.55, -0.27); body.add(core);
    for (const s of [-1, 1]) {
      const eye = box(0.07, 0.05, 0.04, redGlow); eye.position.set(s * 0.08, 2.02, -0.17); body.add(eye);
      const sl = sph(0.07, redGlow, 8); sl.position.set(s * 0.46, 1.85, -0.1); body.add(sl);
    }
    const arms = [];
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.47, 1.75, 0); body.add(sh);
      const ua = box(0.15, 0.5, 0.15, mb); ua.position.y = -0.25; sh.add(ua);
      arms.push(sh);
    }
    const gun = box(0.13, 0.13, 0.85, mb); gun.position.set(0, -0.48, -0.3); arms[1].add(gun);
    g.scale.setScalar(scale);
    scene.add(g);
    return { g, body, legs, arms, gun };
  }
  const enemyDefs = [
    { p: [-17, -29], walk: 0.5, ph: 0.0 },
    { p: [-12, -24], walk: 0.4, ph: 1.3 },
    { p: [-5, -34], walk: 0.0, ph: 2.0 },
    { p: [2, -36], walk: 0.2, ph: 0.6 },
    { p: [5.5, -17], walk: 0.0, ph: 0.0 }, // launched at 8.55s
    { p: [-21, -36], walk: 0.3, ph: 2.6 },
    { p: [9, -30], walk: 0.2, ph: 1.9 },
  ];
  const enemies = enemyDefs.map((d) => Object.assign(makeRobot(0x242220, 0.95), { d }));
  const LAUNCHED = 4;
  enemies[LAUNCHED].g.scale.setScalar(1.4);
  const flyingGun = box(0.22, 0.22, 1.4, std(0x2a2725, { metalness: 0.4 })); scene.add(flyingGun);
  // late runner enemy (appears center-left late in the shot)
  const runner = makeRobot(0x2d2a28, 1.15);
  const runX = linTrack([[9.6, -13], [12.7, -5]]), runZ = linTrack([[9.6, -27], [12.7, -14.5]]);
  // white mech on the rock, destroyed at ~11.95s
  const mech = makeRobot(0xc8c6be, 1.0, 0x6a6862);

  // ---------- explosions ----------
  const unitSphere = new THREE.SphereGeometry(1, 18, 12);
  const EX = [
    { t: -0.7, p: [0.3, 3.0, -11], r: 13, dur: 1.3, col: 0xfffae8, smoke: { n: 6, col: 0xf0e2bc, r: 6, rise: 2, dur: 1.6, em: 0xc8b890 }, li: 60, debris: 14 },
    { t: 0.05, p: [6.5, -0.5, -6.5], r: 2.2, dur: 3.0, col: 0xffe8b0, smoke: { n: 4, col: 0xb8a070, r: 1.8, rise: 2.5, dur: 3.2 }, li: 25, flicker: true },
    { t: 1.0, p: [6.5, 0.3, -3.5], r: 2.0, dur: 1.9, col: 0xffe0a0, li: 15, flicker: true },
    { t: 4.3, p: [-2, -3.3, -38], r: 3, dur: 0.8, col: 0xffa040, smoke: { n: 6, col: 0x18181a, r: 3.5, rise: 6, dur: 3.5, delay: 0.25 }, li: 30, sparks: { n: 80, speed: 17, life: 1.4 } },
    { t: 5.25, p: [-0.3, -3.2, -26], r: 1.1, dur: 1.5, col: 0xff9a30, li: 12, flicker: true },
    { t: 7.45, p: [5, -3, -23], r: 2.4, dur: 0.9, col: 0xff3a30, smoke: { n: 4, col: 0x8a7a78, r: 2, rise: 2, dur: 2 }, li: 25 },
    { t: 8.0, p: [3.6, 3.0, -27], r: 1.4, dur: 0.6, col: 0xff4a3a, li: 12 },
    { t: 8.1, p: [8.5, -3.2, -27], r: 1.2, dur: 0.6, col: 0xff4a3a, li: 10 },
    { t: 8.5, p: [5.5, -3.4, -17], r: 1.8, dur: 0.5, col: 0xffb060, smoke: { n: 6, col: 0x141416, r: 2.4, rise: 8, dur: 2.2 }, li: 20 },
    { t: 9.85, p: [1.4, -2.8, -16], r: 1.6, dur: 0.6, col: 0xffe0a0, smoke: { n: 4, col: 0x202022, r: 1.8, rise: 3, dur: 1.8, delay: 0.3 }, li: 25, sparks: { n: 60, speed: 11, life: 0.9 } },
    { t: 7.6, p: [-16, -3, -24], r: 0, dur: 0.1, col: 0x000000, smoke: { n: 5, col: 0x161618, r: 3, rise: 8, dur: 4.5 }, li: 0 },
    { t: 11.95, p: [-0.3, -1.5, -13], r: 3.4, dur: 0.9, col: 0xffc070, smoke: { n: 6, col: 0x5a524a, r: 3, rise: 3, dur: 2, delay: 0.55 }, li: 40 },
  ];
  const debrisMat = std(0x2a2620, { flatShading: true });
  for (const e of EX) {
    e.g = new THREE.Group(); e.g.position.set(e.p[0], e.p[1], e.p[2]); scene.add(e.g);
    if (e.r > 0) {
      e.fireMat = basic(e.col, { transparent: true, opacity: 1, fog: false, depthWrite: false });
      e.fire = new THREE.Mesh(unitSphere, e.fireMat); e.g.add(e.fire);
      e.coreMat = basic(0xffffff, { transparent: true, opacity: 1, fog: false, depthWrite: false });
      e.core = new THREE.Mesh(unitSphere, e.coreMat); e.g.add(e.core);
    }
    if (e.li > 0) { e.light = new THREE.PointLight(e.col, 0, e.r * 14 + 10, 1.2); e.light.position.y = 0.5; e.g.add(e.light); }
    if (e.smoke) {
      e.smokeMat = std(e.smoke.col, { transparent: true, opacity: 0, depthWrite: false, roughness: 1, emissive: e.smoke.em || 0x000000 });
      e.puffs = [];
      for (let k = 0; k < e.smoke.n; k++) {
        const m = new THREE.Mesh(unitSphere, e.smokeMat);
        m.userData = { ox: rr(-0.6, 0.6), oz: rr(-0.6, 0.6), f: (k + 0.5) / e.smoke.n, s: rr(0.6, 1.1) };
        e.g.add(m); e.puffs.push(m);
      }
    }
    if (e.sparks) {
      const n = e.sparks.n;
      const arr = new Float32Array(n * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      e.sparkDirs = [];
      for (let k = 0; k < n; k++) {
        const th = rr(0, Math.PI * 2), el = rr(0.15, 1.35);
        const sp = e.sparks.speed * rr(0.4, 1.0);
        e.sparkDirs.push([Math.cos(th) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(th) * Math.cos(el) * sp]);
      }
      e.sparkLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xfff0c8, fog: false, transparent: true }));
      e.sparkLines.frustumCulled = false;
      e.g.add(e.sparkLines);
    }
    if (e.debris) {
      e.rocks = [];
      for (let k = 0; k < e.debris; k++) {
        const m = new THREE.Mesh(rockGeo, debrisMat);
        const s = rr(0.15, 0.45); m.scale.setScalar(s);
        m.userData = { v: [rr(-6, 6), rr(3, 10), rr(-2, 8)], o: [rr(-2, 2), rr(-1, 3), rr(-1, 1)] };
        e.g.add(m); e.rocks.push(m);
      }
    }
  }
  function updateExplosion(e, t) {
    const age = t - e.t;
    const active = age >= 0;
    if (e.fire) {
      const vis = active && age < e.dur;
      e.fire.visible = e.core.visible = vis;
      if (vis) {
        const grow = 0.35 + 0.65 * smooth(age / Math.min(0.3, e.dur * 0.5));
        let fade = 1 - smooth((age - e.dur * 0.35) / (e.dur * 0.65));
        if (e.flicker) fade *= 0.8 + 0.2 * Math.sin(age * 37 + e.p[0]);
        e.fire.scale.setScalar(e.r * grow);
        e.fireMat.opacity = 0.85 * fade;
        e.core.scale.setScalar(e.r * grow * 0.55);
        e.coreMat.opacity = 0.9 * fade * fade;
      }
    }
    if (e.light) {
      let li = 0;
      if (active && age < e.dur * 1.2) li = e.li * (1 - smooth(age / (e.dur * 1.2)));
      if (e.flicker && li > 0) li *= 0.75 + 0.25 * Math.sin(age * 41);
      e.light.intensity = li;
    }
    if (e.puffs) {
      const S = e.smoke;
      const sa = (age - (S.delay || 0)) / S.dur;
      const vis = sa >= 0 && sa < 1;
      for (const m of e.puffs) {
        m.visible = vis;
        if (!vis) continue;
        const u = m.userData;
        const g = smooth(sa * 2.2);
        m.position.set(u.ox * S.r * (0.4 + g), S.rise * u.f * (0.2 + 0.8 * smooth(sa * 1.6)), u.oz * S.r * (0.4 + g));
        m.scale.setScalar(S.r * u.s * (0.35 + 0.65 * g) * (0.6 + 0.4 * u.f));
      }
      if (vis) e.smokeMat.opacity = 0.5 * smooth(sa * 8) * (1 - smooth((sa - 0.6) / 0.4));
    }
    if (e.sparkLines) {
      const life = e.sparks.life;
      const vis = active && age < life;
      e.sparkLines.visible = vis;
      if (vis) {
        const arr = e.sparkLines.geometry.attributes.position.array;
        const a2 = Math.max(0, age - 0.05);
        for (let k = 0; k < e.sparkDirs.length; k++) {
          const v = e.sparkDirs[k];
          arr[k * 6] = v[0] * age; arr[k * 6 + 1] = v[1] * age - 4.9 * age * age; arr[k * 6 + 2] = v[2] * age;
          arr[k * 6 + 3] = v[0] * a2; arr[k * 6 + 4] = v[1] * a2 - 4.9 * a2 * a2; arr[k * 6 + 5] = v[2] * a2;
        }
        e.sparkLines.geometry.attributes.position.needsUpdate = true;
        e.sparkLines.material.opacity = 1 - smooth((age - life * 0.6) / (life * 0.4));
      }
    }
    if (e.rocks) {
      for (const m of e.rocks) {
        const u = m.userData;
        const vis = active && age < 3;
        m.visible = vis;
        if (!vis) continue;
        m.position.set(u.o[0] + u.v[0] * age, u.o[1] + u.v[1] * age - 4.9 * age * age, u.o[2] + u.v[2] * age);
        m.rotation.set(age * 3 + u.o[0], age * 2, age * 4);
      }
    }
  }

  // ---------- laser bolts (enemy red, ally blue) ----------
  const boltGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6); boltGeo.rotateX(Math.PI / 2); boltGeo.translate(0, 0, -0.5);
  const glowGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6); glowGeo.rotateX(Math.PI / 2); glowGeo.translate(0, 0, -0.5);
  const redBoltM = basic(0xff6050, { fog: false }), redGlowM = basic(0xff1a10, { fog: false, transparent: true, opacity: 0.45, depthWrite: false });
  const blueBoltM = basic(0xc0d8ff, { fog: false }), blueGlowM = basic(0x3060ff, { fog: false, transparent: true, opacity: 0.45, depthWrite: false });
  const bolts = [];
  function addBolt(t0, from, to, blue, speed, len) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(boltGeo, blue ? blueBoltM : redBoltM));
    g.add(new THREE.Mesh(glowGeo, blue ? blueGlowM : redGlowM));
    scene.add(g);
    const f = new THREE.Vector3(...from), to3 = new THREE.Vector3(...to);
    const dir = to3.clone().sub(f); const dist = dir.length(); dir.normalize();
    bolts.push({ g, t0, f, dir, dist, speed: speed || 55, len: len || 3 });
  }
  // warm-phase bolts crossing from the left
  for (const [t0, y] of [[0.3, 1.5], [0.6, 0.8], [0.95, 1.2], [1.35, 0.6], [1.55, 1.6], [1.95, 0.4], [2.2, 1.0], [2.55, 0.5], [3.0, 0.8]]) {
    addBolt(t0, [-28, y - 1, -18], [8, y, -3], false, 60, 4);
  }
  // enemy fire from the field toward the hill
  for (let k = 0; k < 40; k++) {
    const e = enemyDefs[Math.floor(rng() * enemyDefs.length)];
    const t0 = rr(1.5, 12.6);
    addBolt(t0, [e.p[0], -1.6, e.p[1]], [rr(-9, 9), rr(-1.5, 1.5), rr(-8, -3)], false, 55, 3);
  }
  // ally2 blue rifle shots
  for (const t0 of [4.15, 4.45, 4.8, 5.1]) addBolt(t0, [6.8, -2.1, -6.4], [-4, -3.0, -32], true, 50, 3.5);
  function updateBolts(t) {
    for (const b of bolts) {
      const s = (t - b.t0) * b.speed;
      const vis = s >= 0 && s <= b.dist;
      b.g.visible = vis;
      if (!vis) continue;
      const head = Math.min(s, b.dist);
      b.g.position.copy(b.f).addScaledVector(b.dir, head);
      b.g.lookAt(b.g.position.x + b.dir.x, b.g.position.y + b.dir.y, b.g.position.z + b.dir.z);
      // lookAt on an Object3D points +Z toward target; geometry extends along -Z (tail behind)
      b.g.scale.set(1, 1, Math.min(b.len, s + 0.01));
    }
  }

  // ---------- turret tracers ----------
  const tracerM = basic(0xfff0b0, { fog: false });
  const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 5); tracerGeo.rotateX(Math.PI / 2); tracerGeo.translate(0, 0, -0.5);
  const NTR = 8, TR_INT = 1 / 15, TR_SPEED = 140, TR_LIFE = 0.28;
  const tracers = [];
  for (let i = 0; i < NTR; i++) { const m = new THREE.Mesh(tracerGeo, tracerM); m.scale.z = 4; scene.add(m); tracers.push(m); }
  const FIRE_WIN = [[0.35, 2.7], [7.95, 12.7]];
  function firingAt(t) { for (const w of FIRE_WIN) if (t >= w[0] && t < w[1]) return w; return null; }

  // ---------- timing tracks ----------
  const CUT = 0.27;
  const LOCK = 3.32;
  const psiTrack = track([[0.27, 85], [0.55, 82], [1.1, 75], [1.65, 72], [2.2, 66], [2.75, 36], [3.32, 0], [3.87, 0], [4.42, -1], [4.97, -2], [5.52, -1], [6.07, 0], [6.62, 6], [7.17, 7], [7.72, 5], [8.27, 3], [8.82, 2], [9.37, 2], [9.93, 1], [10.48, 2], [11.03, 0], [11.58, -2], [12.13, -6], [12.7, -10]]);
  const pitchC = track([[3.32, -7.5], [3.87, -9.5], [4.42, -11.5], [4.97, -13.5], [5.52, -13.5], [6.07, -13.5], [6.62, -12.5], [7.17, -12.5], [7.72, -10.5], [8.27, -10.5], [8.82, -11.5], [9.37, -11.5], [9.93, -11.5], [10.48, -11.5], [11.03, -11.5], [11.58, -13.5], [12.13, -10.5], [12.7, -12.5]]);
  const bX = track([[0.27, -0.6], [0.55, -0.6], [1.1, -0.6], [1.65, -0.35], [2.2, -0.1], [2.75, 0], [3.32, 0]]);
  const bY = track([[0.27, 2.0], [0.55, 2.2], [1.1, 2.5], [1.65, 2.85], [2.2, 3.2], [2.75, 3.45], [3.32, 3.58]]);
  const bZ = track([[0.27, 2.9], [0.55, 3.1], [1.1, 3.5], [1.65, 3.95], [2.2, 4.35], [2.75, 4.55], [3.32, 4.65]]);
  const bYaw = track([[0.27, 14], [0.55, 12], [1.1, 4], [1.65, 2], [2.2, 1], [2.75, 0.5], [3.32, 0]]);
  const bPitch = track([[0.27, -6], [0.55, -7], [1.1, -8], [1.65, -8.5], [2.2, -9], [2.75, -8.5], [3.32, -7.5]]);
  const CAM_H = 3.58, CAM_BACK = 4.65;

  const cWarm = new THREE.Color(0x2e2c28), cCool = new THREE.Color(0x2b3137), cA = new THREE.Color(0xeedcaa);
  const hSkyW = new THREE.Color(0xffd890), hSkyC = new THREE.Color(0x8494a6);
  const hGndW = new THREE.Color(0x5a4020), hGndC = new THREE.Color(0x1e2226);
  const sunW = new THREE.Color(0xffd080), sunC = new THREE.Color(0xa4b2c2);
  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();

  function update(time, frame) {
    const t = Math.max(0, time);
    const f = Number.isFinite(frame) ? frame : Math.round(t * FPS);
    const shotA = t < CUT;

    // ---- grading / lights ----
    const w = shotA ? 1 : 1 - smooth((t - 2.3) / 1.4);
    if (shotA) bg.copy(cA); else bg.copy(cCool).lerp(cWarm, w);
    fog.color.copy(bg);
    fog.density = shotA ? 0.05 : lerp(0.022, 0.016, w);
    hemi.color.copy(hSkyC).lerp(hSkyW, w);
    hemi.groundColor.copy(hGndC).lerp(hGndW, w);
    hemi.intensity = shotA ? 2.6 : lerp(1.0, 1.7, w);
    sun.color.copy(sunC).lerp(sunW, w);
    sun.intensity = shotA ? 3.2 : lerp(0.7, 2.6, w);
    if (shotA) sun.position.set(0, 8, -20);
    else sun.position.set(lerp(-6, 10, w), 10, lerp(-12, -4, w));
    amb.intensity = shotA ? 0.8 : lerp(0.3, 0.5, w);

    // ---- turret ----
    const psi = shotA ? 0 : psiTrack(t);
    const pc = t >= LOCK ? pitchC(t) : -7.5;
    yawG.rotation.y = -psi * D2R;
    const gp = shotA ? 16 : (t < LOCK ? -3 : pc * 0.45);
    pitchG.rotation.x = gp * D2R;
    const win = firingAt(t);
    const flashOn = !!win && (f % 4 < 2);
    flash.visible = flashOn;
    if (flashOn) { const s = 0.7 + 0.6 * hash(f); flash.scale.set(s, s, s * 1.6); }
    flashLight.intensity = flashOn ? 10 : 0;
    barrels.position.z = flashOn ? 0.05 : 0;

    // gunner pose: hands on the rear handles; arms raised in shot A
    const raise = shotA ? 1 : 0;
    torsoG.rotation.x = -0.22 + (flashOn ? 0.02 : 0);
    for (const a of gArms) {
      a.sh.rotation.x = lerp(1.05, 2.2, raise) + (flashOn ? 0.04 : 0);
      a.sh.rotation.z = a.s * lerp(0.12, 0.35, raise);
      a.el.rotation.x = lerp(0.35, 0.7, raise);
    }
    head.rotation.y = 0;

    // ---- camera ----
    let cx, cy, cz, cyaw, cpitch, fov = 50;
    if (shotA) {
      cx = 0.05; cy = BASE_Y + 1.9; cz = 5.2; cyaw = 0; cpitch = 6;
    } else if (t < LOCK) {
      cx = bX(t); cy = BASE_Y + bY(t); cz = bZ(t); cyaw = bYaw(t); cpitch = bPitch(t);
    } else {
      const pr = psi * D2R;
      cx = CAM_BACK * Math.sin(-pr); // camera rides behind the turret yaw
      cz = CAM_BACK * Math.cos(pr);
      cy = BASE_Y + CAM_H;
      cyaw = psi; cpitch = pc;
    }
    if (win && !shotA) {
      cx += 0.006 * Math.sin(f * 2.3); cy += 0.006 * Math.sin(f * 3.1);
      cpitch += 0.12 * Math.sin(f * 1.7);
    }
    if (!shotA && t < 0.9) cyaw += 1.5 * Math.sin(t * 30) * (1 - smooth((t - 0.3) / 0.6)); // whip blur feel
    camera.position.set(cx, cy, cz);
    camera.rotation.set(cpitch * D2R, -cyaw * D2R, 0);
    if (camera.fov !== fov) { camera.fov = fov; }
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    // ---- tracers ----
    turret.updateMatrixWorld(true);
    muzzle.getWorldPosition(tmpV);
    const pr = psi * D2R, gpr = gp * D2R;
    const dir = tmpV2.set(Math.sin(pr) * Math.cos(gpr), Math.sin(gpr), -Math.cos(pr) * Math.cos(gpr));
    for (let i = 0; i < NTR; i++) tracers[i].visible = false;
    if (win) {
      const kNow = Math.floor((t - win[0]) / TR_INT);
      for (let i = 0; i < NTR; i++) {
        const k = kNow - (((kNow - i) % NTR) + NTR) % NTR;
        if (k < 0) continue;
        const age = t - (win[0] + k * TR_INT);
        if (age < 0 || age > TR_LIFE) continue;
        const m = tracers[i];
        m.visible = true;
        m.position.copy(tmpV).addScaledVector(dir, age * TR_SPEED + 3);
        m.lookAt(m.position.x + dir.x, m.position.y + dir.y, m.position.z + dir.z);
      }
    }

    // ---- allies ----
    {
      const x = a1x(t), z = a1z(t);
      const dt = 0.05;
      const vx = (a1x(t + dt) - a1x(t - dt)) / (2 * dt), vz = (a1z(t + dt) - a1z(t - dt)) / (2 * dt);
      const sp = Math.hypot(vx, vz);
      ally1.g.position.set(x, groundH(x, z), z);
      ally1.g.visible = t >= CUT;
      const face = sp > 0.15 ? Math.atan2(-vx, -vz) : (t > 10 ? 0.35 : 0.1);
      ally1.g.rotation.y = face;
      poseWalk(ally1, t * 9, clamp(sp * 0.35, 0, 0.6));
    }
    {
      const x = 7.0, z = -6.0;
      ally2.g.visible = t >= CUT;
      ally2.g.position.set(x, groundH(x, z), z);
      ally2.g.rotation.y = 0.35;
      poseWalk(ally2, 0, 0);
      ally2.legs[0].hip.rotation.x = 0.25; ally2.legs[1].hip.rotation.x = -0.2;
    }

    // ---- enemies ----
    for (let i = 0; i < enemies.length; i++) {
      const en = enemies[i], d = en.d;
      if (i === LAUNCHED) { if (t >= 8.55) continue; if (t < 7.9) { en.g.visible = false; continue; } }
      const adv = d.walk * t;
      const x = d.p[0], z = d.p[1] + adv;
      en.g.visible = true;
      en.g.position.set(x, groundH(x, z), z);
      en.g.rotation.set(0, Math.PI + 0.15 * Math.sin(i * 1.7), 0);
      en.body.rotation.set(0, 0, 0);
      en.body.position.set(0, 0, 0);
      poseWalk(en, t * 5 + d.ph, d.walk > 0 ? 0.45 : 0);
      en.arms[1].rotation.x = 1.3 + 0.05 * Math.sin(t * 6 + i);
      en.arms[0].rotation.x = 0.4;
      en.gun.visible = true;
    }
    {
      // launched robot: ballistic arc 8.55 -> 9.9, tumbling; gun arm flies separately
      const en = enemies[LAUNCHED];
      flyingGun.visible = false;
      if (t >= 8.55) {
        const T = 1.35, a = clamp(t - 8.55, 0, T), g = 26, v0 = g * T / 2;
        const u = a / T;
        const x = lerp(5.5, 1.4, u), z = lerp(-17, -16, u);
        const y = groundH(5.5, -17) + v0 * a - 0.5 * g * a * a;
        en.g.visible = t < 9.95;
        en.g.position.set(x, Math.max(y, groundH(x, z)), z);
        en.g.rotation.set(-a * 2.2, Math.PI + a * 0.8, a * 1.6);
        en.gun.visible = false;
        poseWalk(en, 1.0, 0.5);
        en.arms[1].rotation.x = 2.2;
        // detached gun arm
        const g2 = 22, v2 = 21, a2 = clamp(t - 8.55, 0, 2.0);
        const y2 = groundH(5.5, -17) + 1.8 + v2 * a2 - 0.5 * g2 * a2 * a2;
        if (y2 > FIELD_Y && t < 10.6) {
          flyingGun.visible = true;
          flyingGun.position.set(lerp(5.5, 2.0, a2 / 1.8), y2, lerp(-17, -16.2, a2 / 1.8));
          flyingGun.rotation.set(a2 * 4, a2 * 1.5, a2 * 3 + 0.8);
        }
      }
    }
    {
      // runner approaching late
      runner.g.visible = t >= 9.6;
      const x = runX(t), z = runZ(t);
      runner.g.position.set(x, groundH(x, z), z);
      runner.g.rotation.set(0, Math.PI - 0.5, 0);
      poseWalk(runner, t * 9, 0.6);
      runner.arms[1].rotation.x = 1.3;
    }
    {
      // white mech climbs onto the rock (~11.0-11.35), destroyed at 11.95
      const rise = smooth((t - 10.95) / 0.4);
      mech.g.visible = t >= 10.95 && t < 12.0;
      const topY = -2.9 + 1.1 * 0.8;
      mech.g.position.set(-0.3, lerp(topY - 2.2, topY, rise), -13);
      mech.g.rotation.set(0, Math.PI + 0.2, 0);
      poseWalk(mech, 0.3, 0.15);
      mech.arms[1].rotation.x = 1.4; mech.arms[0].rotation.x = 0.6;
    }

    // ---- explosions & bolts ----
    for (const e of EX) updateExplosion(e, t);
    updateBolts(t);
  }

  update(0, 0);
  return { scene, camera, update };
}
