// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction (video36).
// Bathroom with a wall mirror (towel woman A) and a doorway to a blue hallway (red-dress woman B).
// One continuous handheld shot: over-shoulder mirror view -> whip pan left to the doorway ->
// whip pan right back to woman A, who then walks toward the retreating camera while B walks in.
// The mirror is modelled as an opening into a z-mirrored copy of the room and people.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const W = width || 1280, H = height || 720;
  const aspect = W / H;
  const TANH = 0.4; // tan(horizontal half-fov)
  const vfov = 2 * Math.atan(TANH / aspect) / D2R;
  const DUR = duration || 8.6149;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(vfov, aspect, 0.03, 60);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- letterbox matte (reference is letterboxed, active ~376/540 of height)
  {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false,
      transparent: true, opacity: 1.0 });
    const bd = 0.1;
    const hh = bd * Math.tan(vfov * D2R / 2);
    const active = 376 / 540;
    const barH = hh * (1 - active) + hh * 0.3;
    for (const s of [1, -1]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(bd * TANH * 2.6, barH), barMat);
      bar.position.set(0, s * (hh * active + barH / 2), -bd);
      bar.renderOrder = 1000;
      bar.frustumCulled = false;
      camera.add(bar);
    }
  }

  // ---------- interpolation
  function pchip(keys) {
    const n = keys.length;
    const ts = keys.map(k => k[0]), vs = keys.map(k => k[1]);
    if (n === 1) return () => vs[0];
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]));
    m[0] = 0; m[n - 1] = 0;
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else {
        const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
        const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
      }
    }
    return (t) => {
      if (t <= ts[0]) return vs[0];
      if (t >= ts[n - 1]) return vs[n - 1];
      let i = 0;
      while (i < n - 2 && t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], s = (t - ts[i]) / h;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * vs[i] + (s3 - 2 * s2 + s) * h * m[i] +
        (-2 * s3 + 3 * s2) * vs[i + 1] + (s3 - s2) * h * m[i + 1];
    };
  }

  // ---------- materials
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const C = {
    pink: lam(0xc84c78), pinkDoor: lam(0xc0508e), floor: lam(0x3a2630), ceil: lam(0x6a2a48),
    white: lam(0xdcdcec), black: lam(0x141414), blue: lam(0x2f6cd0), beige: lam(0x9c8478),
    purple: lam(0x4a2c48), wood: lam(0x3a2418), curtain: lam(0xc23c5c), shelf: lam(0x5a86c0),
    towelP: lam(0xe08aa8), towelY: lam(0xd8b060), handMirror: lam(0x2848c0), glass: lam(0xc8d8f0),
    bottle: lam(0x3a70d0),
  };
  const emis = (c) => new THREE.MeshBasicMaterial({ color: c });

  // procedural tile texture (green tile, light grout)
  const TS = 64;
  const tdata = new Uint8Array(TS * TS * 4);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
    const i = (y * TS + x) * 4;
    const grout = x < 4 || y < 4;
    const edge = (x < 8 || y < 8 || x > TS - 4 || y > TS - 4) ? 0.85 : 1.0;
    if (grout) { tdata[i] = 165; tdata[i + 1] = 185; tdata[i + 2] = 172; }
    else { tdata[i] = Math.round(52 * edge); tdata[i + 1] = Math.round(122 * edge); tdata[i + 2] = Math.round(78 * edge); }
    tdata[i + 3] = 255;
  }
  const tileTex = new THREE.DataTexture(tdata, TS, TS, THREE.RGBAFormat);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.magFilter = THREE.LinearFilter;
  tileTex.minFilter = THREE.LinearMipmapLinearFilter;
  tileTex.generateMipmaps = true;
  if (THREE.SRGBColorSpace) tileTex.colorSpace = THREE.SRGBColorSpace;
  tileTex.needsUpdate = true;
  const TILE = 0.1;
  function tileMat(ru, rv) {
    const t = tileTex.clone();
    t.repeat.set(ru, rv);
    t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ color: 0xffffff, map: t });
  }

  function addBox(parent, x0, x1, y0, y1, z0, z1, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parent.add(m);
    return m;
  }
  function tileBoxZ(parent, x0, x1, y0, y1, z0, z1) {
    return addBox(parent, x0, x1, y0, y1, z0, z1, tileMat((x1 - x0) / TILE, (y1 - y0) / TILE));
  }

  // ---------- room (built twice: real, and z-mirrored behind the mirror wall)
  // Coordinates: x east, y up, z south. Mirror wall plane z=-1 (faces +z). Door in south wall z=2.6.
  function buildRoom(P, real) {
    // floor / ceiling
    addBox(P, -2.0, 2.2, -0.02, 0.0, -1.0, 2.62, C.floor);
    addBox(P, -2.0, 2.2, 2.7, 2.72, -1.0, 2.62, C.ceil);
    // west / east walls
    addBox(P, -2.04, -2.0, 0, 2.7, -1.0, 2.62, C.pink);
    addBox(P, 2.2, 2.24, 0, 2.7, -1.0, 2.62, C.pink);
    // south wall with doorway x[-1.13,-0.01], h 2.1
    addBox(P, -2.0, -1.13, 0, 2.7, 2.6, 2.64, C.pinkDoor);
    addBox(P, -0.01, 2.2, 0, 2.7, 2.6, 2.64, C.pinkDoor);
    addBox(P, -1.13, -0.01, 2.1, 2.7, 2.6, 2.64, C.pinkDoor);
    // door trims: white east jamb + head, black banded west jamb
    addBox(P, -0.01, 0.05, 0, 2.16, 2.56, 2.66, C.white);
    addBox(P, -1.19, 0.05, 2.1, 2.16, 2.56, 2.66, C.white);
    addBox(P, -1.19, -1.13, 0, 2.1, 2.55, 2.66, C.black);
    for (let y = 0.3; y < 2.1; y += 0.26) addBox(P, -1.195, -1.125, y, y + 0.012, 2.545, 2.665, C.white);
    // towel shelf (east of door) and sconce / switch plate (west of door)
    addBox(P, 0.07, 0.45, 1.3, 1.33, 2.46, 2.6, C.shelf);
    addBox(P, 0.1, 0.42, 1.33, 1.41, 2.48, 2.6, C.towelP);
    addBox(P, 0.1, 0.42, 1.41, 1.48, 2.48, 2.6, C.towelY);
    addBox(P, 0.11, 0.41, 1.48, 1.52, 2.49, 2.6, C.towelP);
    const sconceS = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), emis(0xfff0dc));
    sconceS.rotation.x = Math.PI; sconceS.position.set(-1.45, 1.82, 2.5); P.add(sconceS);
    addBox(P, -1.38, -1.22, 1.05, 1.27, 2.57, 2.6, C.black);

    // hallway beyond door: x[-1.75,0.65], z[2.64,3.6]
    addBox(P, -1.75, 0.65, -0.02, 0.0, 2.64, 3.6, C.floor);
    addBox(P, -1.75, 0.65, 2.5, 2.52, 2.64, 3.6, C.blue);
    addBox(P, -1.79, -1.75, 0, 2.5, 2.64, 3.6, C.blue);
    addBox(P, 0.65, 0.69, 0, 2.5, 2.64, 3.6, C.blue);
    addBox(P, -0.59, 0.65, 0, 2.5, 3.25, 3.6, C.beige);          // beige panel/closet
    addBox(P, -1.75, -1.05, 0, 2.5, 3.6, 3.64, C.blue);          // blue back wall
    addBox(P, -0.65, -0.59, 0, 2.5, 3.6, 3.64, C.blue);
    addBox(P, -1.05, -0.65, 2.0, 2.5, 3.6, 3.64, C.blue);
    addBox(P, -1.09, -1.05, 0, 2.04, 3.56, 3.62, C.white);       // inner door trim
    addBox(P, -0.65, -0.61, 0, 2.04, 3.56, 3.62, C.white);
    addBox(P, -1.09, -0.61, 2.0, 2.04, 3.56, 3.62, C.white);
    // dim room beyond
    addBox(P, -1.75, -0.4, -0.02, 0.0, 3.64, 5.2, C.wood);
    addBox(P, -1.75, -0.4, 2.5, 2.52, 3.64, 5.2, C.purple);
    addBox(P, -1.75, -0.4, 0, 2.5, 5.2, 5.24, C.purple);
    addBox(P, -1.79, -1.75, 0, 2.5, 3.64, 5.2, C.purple);
    addBox(P, -0.4, -0.36, 0, 2.5, 3.64, 5.2, C.purple);
    addBox(P, -1.4, -0.95, 0, 0.75, 4.75, 5.15, C.wood);         // side table
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 14), emis(0xffd8a0));
    lampShade.position.set(-1.17, 1.0, 4.95); P.add(lampShade);

    // shower stall in SE corner (curtain proxies)
    addBox(P, 0.98, 1.0, 0.15, 2.15, 1.6, 2.6, C.curtain);
    addBox(P, 1.0, 2.2, 0.15, 2.15, 1.58, 1.6, C.curtain);
    addBox(P, 0.97, 2.2, 2.16, 2.18, 1.57, 1.6, C.white);

    // east end of north wall: pink pillar, counter with tile front, hand mirror, sconce
    addBox(P, 0.85, 1.0, 0, 2.7, -1.0, -0.85, C.pink);
    tileBoxZ(P, 1.0, 2.2, 0, 1.12, -1.0, -0.55);
    addBox(P, 1.0, 2.2, 1.12, 1.18, -1.0, -0.53, C.black);
    const hmG = new THREE.Group(); hmG.position.set(1.14, 1.4, -0.72); hmG.rotation.y = -0.6; P.add(hmG);
    const hm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 20), C.handMirror);
    hm.rotation.x = Math.PI / 2; hmG.add(hm);
    const hmg = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.022, 20), C.glass);
    hmg.rotation.x = Math.PI / 2; hmg.position.z = 0.004; hmG.add(hmg);
    addBox(P, 1.13, 1.15, 1.18, 1.35, -0.73, -0.71, C.handMirror);
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), C.bottle);
    bot.position.set(1.06, 1.26, -0.62); P.add(bot);
    const sconceN = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), emis(0xfff0dc));
    sconceN.rotation.x = Math.PI; sconceN.position.set(1.65, 1.95, -0.93); P.add(sconceN);

    if (real) {
      // north wall: pink | tiles with mirror opening x[-0.32,0.32] y[1.2,2.0] | pink
      addBox(P, -2.0, -0.65, 0, 2.7, -1.04, -1.0, C.pink);
      tileBoxZ(P, -0.65, -0.32, 0, 2.7, -1.04, -1.0);
      tileBoxZ(P, 0.32, 0.85, 0, 2.7, -1.04, -1.0);
      tileBoxZ(P, -0.32, 0.32, 0, 1.2, -1.04, -1.0);
      tileBoxZ(P, -0.32, 0.32, 2.0, 2.7, -1.04, -1.0);
      addBox(P, 0.85, 2.2, 0, 2.7, -1.04, -1.0, C.pink);
      addBox(P, -0.34, 0.34, 1.16, 1.2, -1.0, -0.95, C.white);   // mirror ledge
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xf2b6d2, transparent: true, opacity: 0.14, depthWrite: false }));
      fog.position.set(0, 1.6, -0.999); P.add(fog);
    }
  }

  const realRoot = new THREE.Group();
  scene.add(realRoot);
  const mirrorRoot = new THREE.Group();
  mirrorRoot.scale.set(1, 1, -1);   // reflection about plane z = -1
  mirrorRoot.position.z = -2.0;
  scene.add(mirrorRoot);
  buildRoom(realRoot, true);
  buildRoom(mirrorRoot, false);

  // ---------- people (articulated proxies)
  function cylMesh(rt, rb, h, mat, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 14), mat); }
  function sphMesh(r, mat) { return new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat); }
  function put(parent, mesh, x, y, z, sx, sy, sz) {
    mesh.position.set(x, y, z);
    if (sx !== undefined) mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }
  function makePerson(spec) {
    const M = { skin: lam(spec.skin), hair: lam(spec.hair), cloth: lam(spec.cloth), shoe: lam(spec.shoe) };
    const root = new THREE.Group();
    const body = new THREE.Group(); body.scale.setScalar(spec.scale); root.add(body);
    const hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
    const legs = [];
    for (const side of [1, -1]) {
      const th = new THREE.Group(); th.position.set(0.085 * side, -0.02, 0); hips.add(th);
      put(th, cylMesh(0.062, 0.048, 0.46, M.skin), 0, -0.23, 0);
      const kn = new THREE.Group(); kn.position.y = -0.46; th.add(kn);
      put(kn, cylMesh(0.047, 0.034, 0.42, M.skin), 0, -0.21, 0);
      put(kn, new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.2), M.shoe), 0, -0.425, 0.05);
      legs.push({ th, kn, side });
    }
    const spine = new THREE.Group(); hips.add(spine);
    if (spec.kind === 'towel') {
      put(hips, cylMesh(0.158, 0.168, 0.42, M.cloth, 20), 0, -0.17, 0, 1, 1, 0.74);
      put(spine, cylMesh(0.15, 0.158, 0.40, M.cloth, 20), 0, 0.22, 0, 1, 1, 0.72);
      put(spine, cylMesh(0.142, 0.15, 0.13, M.skin, 18), 0, 0.475, 0, 1, 1, 0.66);
    } else {
      put(hips, cylMesh(0.15, 0.21, 0.46, M.cloth, 20), 0, -0.17, 0, 1, 1, 0.8);
      put(spine, cylMesh(0.152, 0.15, 0.40, M.cloth, 20), 0, 0.24, 0, 1, 1, 0.72);
      put(spine, cylMesh(0.14, 0.15, 0.11, M.skin, 18), 0, 0.495, 0, 1, 1, 0.66);
    }
    for (const side of [1, -1]) put(spine, sphMesh(0.045, M.skin), 0.16 * side, 0.49, 0);
    put(spine, cylMesh(0.044, 0.048, 0.08, M.skin), 0, 0.545, 0);
    const head = new THREE.Group(); head.rotation.order = 'YXZ'; head.position.y = 0.57; spine.add(head);
    put(head, sphMesh(0.1, M.skin), 0, 0.1, 0, 0.85, 1.08, 0.95);
    put(head, sphMesh(0.108, M.hair), 0, 0.105, -0.03, 0.95, 1.05, 1.0);
    if (spec.kind === 'towel') {
      put(head, sphMesh(0.055, M.hair), 0, 0.12, -0.135);
    } else {
      put(head, new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.36, 0.09), M.hair), 0, -0.02, -0.075);
      for (const side of [1, -1]) put(head, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.11), M.hair), 0.1 * side, 0.0, -0.005);
    }
    const arms = {};
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0.17 * side, 0.49, 0); spine.add(sh);
      put(sh, cylMesh(0.036, 0.031, 0.27, M.skin), 0, -0.135, 0);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      put(el, cylMesh(0.03, 0.025, 0.25, M.skin), 0, -0.125, 0);
      put(el, sphMesh(0.04, M.skin), 0, -0.27, 0, 0.8, 1.2, 0.6);
      arms[side > 0 ? 'L' : 'R'] = { sh, el };
    }
    return { root, spine, head, legs, arms };
  }
  function applyPose(P, s) {
    P.root.position.set(s.x, 0, s.z);
    P.root.rotation.set(0, s.ry, 0);
    P.spine.rotation.set(s.lean, 0, s.roll);
    P.head.rotation.set(s.hx, s.hy, s.hz);
    const sw = 0.3 * s.w * Math.sin(s.ph);
    P.arms.L.sh.rotation.set(s.lrx + sw, s.lry || 0, s.lrz);
    P.arms.L.el.rotation.set(s.le, 0, 0);
    P.arms.R.sh.rotation.set(s.rrx - sw, s.rry || 0, s.rrz);
    P.arms.R.el.rotation.set(s.re, 0, 0);
    for (const leg of P.legs) {
      const sgn = leg.side > 0 ? -1 : 1;
      leg.th.rotation.set(sgn * 0.42 * s.w * Math.sin(s.ph), 0, 0);
      const kb = leg.side > 0 ? Math.max(0, -Math.cos(s.ph)) : Math.max(0, Math.cos(s.ph));
      leg.kn.rotation.set(s.w * (0.1 + 0.45 * kb), 0, 0);
    }
  }

  const miaSpec = { kind: 'towel', skin: 0xe8a690, hair: 0x9a4826, cloth: 0xf2ecee, shoe: 0xe8a690, scale: 0.97 };
  const bSpec = { kind: 'dress', skin: 0xd99a7c, hair: 0x2a1a12, cloth: 0xc4161c, shoe: 0x401010, scale: 1.0 };
  const miaR = makePerson(miaSpec), miaM = makePerson(miaSpec);
  const bR = makePerson(bSpec), bM = makePerson(bSpec);
  realRoot.add(miaR.root); realRoot.add(bR.root);
  mirrorRoot.add(miaM.root); mirrorRoot.add(bM.root);

  // ---------- lights
  const hemi = new THREE.HemisphereLight(0xffd6e6, 0x502838, 1.6);
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  const mainL = new THREE.PointLight(0xffc4d4, 6.0, 0, 2); mainL.position.set(0.3, 2.45, 0.9);
  const mirL = new THREE.PointLight(0xffd8c8, 1.6, 0, 2); mirL.position.set(0.05, 1.95, -0.98);
  const hallL = new THREE.PointLight(0xb0c8ff, 5.0, 0, 2); hallL.position.set(-0.6, 2.3, 3.15);
  const beyondL = new THREE.PointLight(0xffc080, 1.2, 0, 2); beyondL.position.set(-1.17, 1.3, 4.7);
  const scS = new THREE.PointLight(0xfff0d0, 1.2, 0, 2); scS.position.set(-1.45, 1.85, 2.45);
  const scN = new THREE.PointLight(0xfff0d0, 1.2, 0, 2); scN.position.set(1.65, 1.9, -0.85);
  for (const l of [hemi, amb, mainL, mirL, hallL, beyondL, scS, scN]) scene.add(l);
  const scaled = [[hemi, 1.6], [amb, 0.6], [mainL, 6.0], [hallL, 5.0], [beyondL, 1.2], [scS, 1.2], [scN, 0.6]];

  // ---------- tracks (time in s on the reference timeline)
  const T = pchip;
  // camera yaw (deg, +left; 0 = looking north at mirror wall, 180 = looking south at door)
  const camYaw = T([[0, 20], [1.13, 21.5], [1.32, 25], [1.5, 38], [1.88, 148], [2.22, 167], [2.59, 178.3],
    [2.97, 180], [4.5, 180.5], [4.6, 176], [4.85, 24], [5.23, -9], [5.6, -14.7], [5.98, -18], [7.07, -18],
    [7.44, -18.5], [7.82, -19], [8.2, -20], [8.62, -23.5]]);
  const camX = T([[0, 0.40], [1.3, 0.40], [2.7, -0.55], [4.5, -0.55], [4.85, -0.45], [5.23, -0.35], [5.6, -0.2],
    [5.98, -0.18], [7.0, -0.18], [7.44, -0.235], [7.82, -0.32], [8.2, -0.44], [8.62, -0.62]]);
  const camZ = T([[0, 0.55], [1.3, 0.55], [2.7, 0.75], [4.5, 0.75], [4.85, 1.1], [5.23, 1.45], [5.6, 1.25],
    [5.98, 1.15], [7.0, 1.18], [7.44, 1.32], [7.82, 1.58], [8.2, 1.95], [8.62, 2.5]]);
  const camY = T([[0, 1.58], [1.3, 1.58], [4.5, 1.58], [5.4, 1.5], [8.62, 1.5]]);
  const camP = T([[0, -3.5], [1.3, -3.5], [2.7, -3], [4.5, -3], [5.4, 0], [7.0, 0], [8.62, -3]]);
  const lightK = T([[0, 0.2], [1.35, 0.2], [1.8, 1.0], [4.6, 1.0], [5.3, 0.8], [8.62, 0.8]]);

  // woman A (towel)
  const mX = T([[0, 0], [1.8, 0], [4.8, 0.16], [7.0, 0.14], [7.44, 0.115], [7.82, 0.03], [8.2, -0.11], [8.62, -0.28]]);
  const mZ = T([[0, -0.05], [1.8, -0.05], [4.8, 0.07], [7.0, 0.12], [7.44, 0.25], [7.82, 0.48], [8.2, 0.80], [8.62, 1.30]]);
  const mRy = T([[0, 180], [1.8, 180], [4.6, 312], [5.3, 325], [6.9, 325], [7.4, 338], [8.62, 342]]);
  const mW = T([[0, 0], [7.15, 0], [7.45, 1], [8.62, 1]]);
  const mHy = T([[0, 0], [1.4, 0], [2.4, -30], [4.6, 5], [5.0, 10], [6.7, 10], [7.1, 4], [8.62, 0]]);
  const mHx = T([[0, 4], [1.4, 4], [2.4, 0], [6.8, 0], [7.1, 10], [7.5, 22], [8.62, 24]]);
  const mHz = T([[0, -6], [1.4, -6], [2.4, 0], [8.62, 0]]);
  const mLean = T([[0, 0], [7.0, 0], [7.5, 6], [8.62, 6]]);
  const mRrx = T([[0, 0], [7.0, 0], [7.5, -15], [8.62, -15]]);
  const mRry = T([[0, 0], [7.0, 0], [7.5, 65], [8.62, 65]]);
  const mRrz = T([[0, -6], [7.0, -6], [7.5, 10], [8.62, 10]]);
  const mRe = T([[0, -8], [7.0, -8], [7.5, -125], [8.62, -125]]);
  const mRub = T([[0, 0], [7.5, 0], [7.7, 1], [8.62, 1]]);
  const mLrx = T([[0, 0], [7.6, 0], [8.2, -10], [8.62, -10]]);
  const mLe = T([[0, -8], [7.6, -8], [8.2, -30], [8.62, -30]]);

  // woman B (red dress)
  const bX = T([[0, -0.85], [0.6, -0.85], [1.5, -0.46], [3.3, -0.46], [4.3, -0.31], [4.6, -0.2], [5.0, 0.5],
    [5.5, 1.15], [6.3, 1.3], [6.8, 1.3], [7.4, 1.1], [7.82, 0.72], [8.2, 0.6], [8.62, 0.55]]);
  const bZ = T([[0, 3.4], [0.6, 3.4], [1.5, 2.55], [3.3, 2.55], [4.3, 2.33], [4.6, 2.2], [5.0, 1.75],
    [5.5, 1.4], [6.3, 1.0], [6.8, 0.7], [7.4, 0.45], [7.82, 0.4], [8.2, 0.45], [8.62, 0.4]]);
  const bRy = T([[0, 155], [1.3, 165], [1.6, 180], [3.3, 180], [4.3, 172], [4.6, 130], [5.5, 120], [6.3, 160],
    [6.8, 180], [7.4, 220], [7.82, 250], [8.62, 258]]);
  const bW = T([[0, 0], [0.55, 0], [0.7, 1], [1.4, 1], [1.55, 0], [3.3, 0], [3.5, 0.5], [4.2, 0.5], [4.5, 1],
    [7.9, 1], [8.2, 0.3], [8.62, 0.3]]);
  const bLean = T([[0, 3], [3.3, 3], [4.0, 12], [4.6, 6], [8.62, 4]]);
  const bRoll = T([[0, 0], [1.6, -5], [3.0, -5], [3.4, 0], [8.62, 0]]);
  const bLrz = T([[0, 8], [1.2, 8], [1.65, 72], [3.0, 72], [3.3, 8], [7.5, 8], [8.0, 20], [8.62, 20]]);
  const bLrx = T([[0, 0], [1.2, 0], [1.65, -3], [3.0, -3], [3.3, 0], [7.5, 0], [8.0, -40], [8.62, -40]]);
  const bLe = T([[0, -10], [1.2, -10], [1.65, -15], [3.0, -15], [3.3, -10], [7.5, -10], [8.0, -100], [8.62, -100]]);
  const bRrx = T([[0, 0], [7.5, 0], [8.0, -35], [8.62, -35]]);
  const bRe = T([[0, -10], [7.5, -10], [8.0, -95], [8.62, -95]]);
  const bHy = T([[0, 0], [7.6, 0], [8.0, 35], [8.62, 35]]);
  const bHx = T([[0, 0], [3.4, 0], [4.0, 10], [4.6, 0], [8.62, 0]]);
  const bTalk = T([[0, 0], [1.6, 0], [1.8, 1], [4.4, 1], [4.6, 0], [8.62, 0]]);

  function update(time, frame) {
    const t = Math.max(0, Math.min(Number(time) || 0, DUR));

    camera.position.set(camX(t), camY(t), camZ(t));
    camera.rotation.set(camP(t) * D2R, camYaw(t) * D2R, 0);
    camera.updateProjectionMatrix();

    const k = lightK(t);
    for (const [l, b] of scaled) l.intensity = b * k;

    const mw = mW(t);
    const rub = mRub(t) * 8 * Math.sin(2 * Math.PI * 1.6 * t);
    const ms = {
      x: mX(t), z: mZ(t), ry: mRy(t) * D2R, lean: mLean(t) * D2R, roll: 0,
      hx: mHx(t) * D2R, hy: mHy(t) * D2R, hz: mHz(t) * D2R,
      lrx: mLrx(t) * D2R, lrz: 6 * D2R, le: mLe(t) * D2R,
      rrx: mRrx(t) * D2R, rry: (mRry(t) + rub) * D2R, rrz: mRrz(t) * D2R, re: mRe(t) * D2R,
      w: mw, ph: 2 * Math.PI * 1.8 * t,
    };
    applyPose(miaR, ms); applyPose(miaM, ms);

    const talk = bTalk(t) * 3 * Math.sin(2 * Math.PI * 2.2 * t);
    const bs = {
      x: bX(t), z: bZ(t), ry: bRy(t) * D2R, lean: bLean(t) * D2R, roll: bRoll(t) * D2R,
      hx: (bHx(t) + talk) * D2R, hy: bHy(t) * D2R, hz: 0,
      lrx: bLrx(t) * D2R, lrz: bLrz(t) * D2R, le: bLe(t) * D2R,
      rrx: bRrx(t) * D2R, rrz: -8 * D2R, re: bRe(t) * D2R,
      w: bW(t), ph: 2 * Math.PI * 1.8 * t + 0.7,
    };
    applyPose(bR, bs); applyPose(bM, bs);
  }

  update(0, 0);
  return { scene, camera, update };
}
