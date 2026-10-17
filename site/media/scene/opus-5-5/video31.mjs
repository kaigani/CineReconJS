// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video31.
// First-person walk through tall rock-canyon corridors: left turn, a guard runs in,
// is shot and falls, the player turns right into a narrow canyon ending at a sunlit
// wall, turns left, steps down a ledge and veers right to a pale-blue doorway with
// red stairs and a second guard.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5e96e0);
  scene.fog = new THREE.Fog(0x283633, 3, 30);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.03, 300);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- seeded procedural banding texture for rock walls (horizontal strata)
  let rs = (seed >>> 0) || 12345;
  const rnd = () => {
    rs = (rs + 0x6D2B79F5) >>> 0;
    let q = rs;
    q = Math.imul(q ^ (q >>> 15), q | 1);
    q ^= q + Math.imul(q ^ (q >>> 7), q | 61);
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  };
  const TW = 32, TH = 256;
  const tdata = new Uint8Array(TW * TH * 4);
  {
    const rowv = new Float32Array(TH);
    const knots = [];
    for (let k = 0; k <= 48; k++) knots.push(rnd());
    for (let y = 0; y < TH; y++) {
      const f = (y / TH) * 48, i = Math.floor(f), s = f - i;
      const a = knots[i], b = knots[Math.min(48, i + 1)];
      const v = a + (b - a) * (s * s * (3 - 2 * s));
      rowv[y] = 0.62 + 0.45 * v;
    }
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const v = Math.min(1, rowv[y] * (0.93 + 0.07 * rnd()));
        const o = (y * TW + x) * 4;
        tdata[o] = tdata[o + 1] = tdata[o + 2] = Math.round(v * 255);
        tdata[o + 3] = 255;
      }
    }
  }
  const bandTex = new THREE.DataTexture(tdata, TW, TH, THREE.RGBAFormat);
  bandTex.wrapS = THREE.RepeatWrapping;
  bandTex.wrapT = THREE.RepeatWrapping;
  bandTex.magFilter = THREE.LinearFilter;
  bandTex.minFilter = THREE.LinearFilter;
  bandTex.generateMipmaps = false;
  bandTex.needsUpdate = true;

  // ---------- materials (unlit, per-face shading so result is light-model independent)
  const FACE = [0.86, 0.76, 1.0, 0.5, 0.95, 0.72]; // +x -x +y -y +z -z
  const matCache = new Map();
  function faceMats(hex, textured) {
    const key = hex + (textured ? 't' : 'p');
    if (matCache.has(key)) return matCache.get(key);
    const arr = FACE.map((f) => {
      const c = new THREE.Color(hex);
      c.multiplyScalar(f);
      const p = { color: c };
      if (textured) p.map = bandTex;
      return new THREE.MeshBasicMaterial(p);
    });
    matCache.set(key, arr);
    return arr;
  }
  function boxMesh(w, h, d, hex, textured) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faceMats(hex, textured));
  }
  function box(x1, x2, y1, y2, z1, z2, hex, textured) {
    const m = boxMesh(x2 - x1, y2 - y1, z2 - z1, hex, textured);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    scene.add(m);
    return m;
  }
  const wall = (x1, x2, z1, z2, hex, y1 = -1.3, y2 = 14) => box(x1, x2, y1, y2, z1, z2, hex, true);

  // ---------- environment (top-down: x east, z south; corridor A heads north = -z)
  const WALL1 = 0x4a5444, WALL2 = 0x434c3d, TAN = 0xa8844c, TAN_SH = 0x525540;
  const FLOOR = 0x3c5050, SLAB = 0x587070;

  // floors
  box(-30, 3, -0.3, 0, -17.5, 8, FLOOR);             // A, B, C, guard passage
  box(-10, 1, -0.3, 0, -23, -17.5, FLOOR);            // D upper section
  box(1, 23, -1.1, -0.8, -23, -14, FLOOR);            // D lower section (after ledge) + bay
  box(-6.8, 1.75, 0, 0.2, -11.75, -7.5, SLAB);        // raised walkway slab in corner/B

  // corridor A
  wall(1.75, 3, -13, 8, WALL1);                      // east (right) wall
  wall(-3, -1.75, -8.25, 8, WALL2);                  // west (left) wall
  // B north wall at the corner, sunlit top band seen at frame 0
  wall(-6, 3, -13, -11.75, WALL2, -1.3, 6);
  box(-6, 3, 6, 9.5, -13, -11.75, TAN, true);
  // corridor B (heading west)
  wall(-12.5, -8.5, -13, -11.75, WALL1);             // north wall between C and guard passage
  wall(-27, -14.5, -13, -11.75, WALL1);              // north wall west of guard passage
  wall(-25, -1.75, -8.25, -7, WALL2);                // south wall
  wall(-27, -25, -13, -7, WALL1);                    // west end
  // guard side passage (north of B)
  wall(-15.75, -14.5, -16.25, -11.75, WALL2);
  wall(-12.5, -11.25, -16.25, -11.75, WALL2);
  wall(-15.75, -11.25, -17.5, -16.25, WALL1);
  // corridor C (heading north from B)
  wall(-9.75, -8.5, -22.75, -11.75, WALL2);          // west wall (full length)
  wall(-6, -4.75, -17.5, -11.75, WALL1);             // east wall (opens to D)
  // end wall of C / north wall of D: sunlit face with shadowed right part, sky above
  wall(-9.75, -3.0, -22.75, -21.3, WALL1, -1.3, 0.7);
  box(-9.75, -7.0, 0.7, 6.2, -22.75, -21.3, TAN, true);
  box(-7.0, -3.0, 0.7, 6.2, -22.75, -21.3, TAN_SH, true);
  wall(-3.0, 11, -22.75, -21.3, WALL2);              // D north (left) wall
  // corridor D (heading east), ledge at x = 1 (end of upper floor)
  wall(-6, 6.6, -18.2, -16.25, WALL1);               // D south (right) wall
  wall(6.6, 7.2, -19.9, -14.3, WALL2);               // rock fin hiding the doorway
  wall(7.2, 11, -15.5, -14.3, WALL1);                // south wall of the bay beyond the fin

  // doorway in a rock face at the east end, pale-blue stair hall behind it
  const BLUE = 0x9db8d8, BLUE2 = 0x88a4c6, STAIR = 0x8c3424;
  const DZ1 = -20.0, DZ2 = -18.1, DTOP = 2.7;
  wall(11, 11.5, -22.75, DZ1, WALL2);                // rock face left of door (north)
  wall(11, 11.5, DZ2, -14.3, WALL2);                 // rock face right of door (south)
  wall(11, 11.5, DZ1, DZ2, WALL2, DTOP, 14);         // rock above door
  box(11.5, 12.7, -1.1, DTOP + 0.4, -20.6, DZ1, BLUE);  // pale-blue porch reveal walls
  box(11.5, 12.7, -1.1, DTOP + 0.4, DZ2, -17.5, BLUE);
  box(11.5, 12.7, DTOP, DTOP + 0.4, DZ1, DZ2, 0xb2cae6); // porch ceiling
  box(12.7, 22, -1.1, 4.2, -21.4, -20.9, BLUE2);     // hall walls
  box(12.7, 22, -1.1, 4.2, -17.2, -16.7, BLUE2);
  box(12.7, 22, 3.8, 4.2, -20.9, -17.2, 0xaec6e4);   // hall ceiling
  box(22, 22.5, -1.1, 4.2, -21.4, -16.7, BLUE);      // back wall
  for (let i = 0; i < 6; i++) {
    box(12.7 + i * 0.63, 16.5, -1.1, -0.8 + (i + 1) * 0.37, -20.1, -18.0, STAIR);
  }
  box(16.5, 22, -1.1, 1.42, -20.9, -17.2, 0x7a8ea6); // upper landing

  // ---------- guard builder (articulated proxy)
  const SUIT = 0x1d2534, SKIN = 0xb88a6a, HAIR = 0x1a1612;
  function makeGuard() {
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    root.add(tilt);
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    tilt.add(hips);
    const pelvis = boxMesh(0.38, 0.18, 0.22, SUIT);
    hips.add(pelvis);
    const spine = new THREE.Group();
    hips.add(spine);
    const torso = boxMesh(0.44, 0.62, 0.25, SUIT);
    torso.position.y = 0.31;
    spine.add(torso);
    const head = new THREE.Group();
    head.position.y = 0.64;
    spine.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: SKIN }));
    skull.position.y = 0.14;
    skull.scale.set(0.9, 1.1, 1.0);
    head.add(skull);
    const hair = boxMesh(0.2, 0.08, 0.22, HAIR);
    hair.position.set(0, 0.26, -0.02);
    head.add(hair);
    function arm(side) {
      const sh = new THREE.Group();
      sh.position.set(side * 0.28, 0.56, 0);
      spine.add(sh);
      const up = boxMesh(0.12, 0.32, 0.13, SUIT);
      up.position.y = -0.16;
      sh.add(up);
      const el = new THREE.Group();
      el.position.y = -0.32;
      sh.add(el);
      const fo = boxMesh(0.1, 0.3, 0.11, SUIT);
      fo.position.y = -0.15;
      el.add(fo);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: SKIN }));
      hand.position.y = -0.33;
      el.add(hand);
      return { sh, el };
    }
    function leg(side) {
      const hp = new THREE.Group();
      hp.position.set(side * 0.11, -0.02, 0);
      hips.add(hp);
      const th = boxMesh(0.16, 0.46, 0.18, SUIT);
      th.position.y = -0.23;
      hp.add(th);
      const kn = new THREE.Group();
      kn.position.y = -0.46;
      hp.add(kn);
      const sh = boxMesh(0.14, 0.44, 0.15, SUIT);
      sh.position.y = -0.22;
      kn.add(sh);
      const ft = boxMesh(0.13, 0.08, 0.26, 0x101010);
      ft.position.set(0, -0.46, 0.05);
      kn.add(ft);
      return { hp, kn };
    }
    const R = arm(-1), L = arm(1); // guard's right arm is local -x
    const RL = leg(-1), LL = leg(1);
    const gun = boxMesh(0.05, 0.1, 0.28, 0x151515);
    gun.position.set(0, -0.34, 0.1);
    R.el.add(gun);
    return {
      root, tilt, hips, spine, head, gun,
      shR: R.sh, elR: R.el, shL: L.sh, elL: L.el,
      hipR: RL.hp, knR: RL.kn, hipL: LL.hp, knL: LL.kn,
    };
  }
  function resetPose(g) {
    for (const k of ['tilt', 'spine', 'head', 'shR', 'elR', 'shL', 'elL', 'hipR', 'knR', 'hipL', 'knL']) {
      g[k].rotation.set(0, 0, 0);
    }
    g.tilt.quaternion.identity();
    g.hips.position.y = 0.95;
  }
  function legsCycle(g, ph, amp, knee) {
    const s = Math.sin(ph);
    g.hipR.rotation.x = -amp * s;
    g.hipL.rotation.x = amp * s;
    g.knR.rotation.x = knee * Math.max(0, Math.sin(ph + 1.2));
    g.knL.rotation.x = knee * Math.max(0, Math.sin(ph + 1.2 + Math.PI));
    g.hips.position.y = 0.95 - 0.03 * Math.abs(Math.cos(ph));
  }

  const g1 = makeGuard();
  scene.add(g1.root);
  const g2 = makeGuard();
  scene.add(g2.root);

  // dropped gun (separate object, shown after the guard loses his weapon)
  const dropGun = boxMesh(0.05, 0.1, 0.28, 0x151515);
  scene.add(dropGun);

  // bullet sparks around guard 1
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff2a0, fog: false });
  const sparks = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), sparkMat);
    const a = (i / 10) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.38, 1.25 + Math.sin(a) * 0.45, 0.2);
    g1.root.add(s);
    sparks.push(s);
  }
  // smoke puff from head hit
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.7, depthWrite: false });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), smokeMat);
  smoke.position.set(0, 0.16, 0.12);
  g1.head.add(smoke);

  // ---------- first-person weapon (child of camera)
  const gunRig = new THREE.Group();
  camera.add(gunRig);
  const gunGroup = new THREE.Group();
  gunRig.add(gunGroup);
  {
    const near = new THREE.Vector3(0.245, -0.31, -0.40);
    const far = new THREE.Vector3(0.150, -0.165, -0.82);
    const dir = far.clone().sub(near);
    const len = dir.length();
    dir.normalize();
    gunGroup.position.copy(near).add(far).multiplyScalar(0.5);
    gunGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    const body = boxMesh(0.07, 0.1, len, 0x26304e);
    gunGroup.add(body);
    const sight = boxMesh(0.09, 0.015, 0.13, 0x34405e);
    sight.position.set(0, 0.065, -len / 2 + 0.12);
    gunGroup.add(sight);
    const grip = boxMesh(0.05, 0.12, 0.06, 0x1a2038);
    grip.position.set(-0.02, -0.1, -len / 2 + 0.08);
    gunGroup.add(grip);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe860, fog: false }));
    flash.scale.set(1.0, 1.0, 0.6);
    flash.position.set(0, 0.03, -len / 2 - 0.06);
    flash.name = 'flash';
    gunGroup.add(flash);
  }
  const flash = gunGroup.getObjectByName('flash');

  // ---------- helpers
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, s) => a + (b - a) * s;
  const smooth = (s) => { s = clamp(s, 0, 1); return s * s * (3 - 2 * s); };
  function hermite(keys, t, col) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][col];
    if (t >= keys[n - 1][0]) return keys[n - 1][col];
    let i = 0;
    while (i < n - 2 && t > keys[i + 1][0]) i++;
    const t0 = keys[i][0], t1 = keys[i + 1][0];
    const tan = (j) => {
      const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)];
      return (b[col] - a[col]) / (b[0] - a[0]);
    };
    const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[i][col] + (s3 - 2 * s2 + s) * h * tan(i)
      + (-2 * s3 + 3 * s2) * keys[i + 1][col] + (s3 - s2) * h * tan(i + 1);
  }

  // camera keyframes: [t, x, eyeY, z, yaw, pitch]  (yaw +: turned left; yaw 0 faces -z)
  const CAM = [
    [0.00, 0.00, 1.30, 0.0, 0.10, -0.02],
    [0.37, 0.00, 1.30, -2.1, 0.18, -0.02],
    [0.73, -0.10, 1.30, -4.3, 0.47, -0.03],
    [1.10, -0.20, 1.32, -6.6, 0.55, -0.03],
    [1.48, 0.10, 1.50, -8.45, 1.27, -0.04],
    [1.85, -1.00, 1.50, -9.7, 1.52, -0.04],
    [2.22, -1.80, 1.50, -10.0, 1.58, -0.05],
    [2.58, -2.60, 1.50, -10.0, 1.58, -0.05],
    [2.95, -3.40, 1.50, -10.0, 1.60, -0.06],
    [3.32, -4.60, 1.50, -10.05, 1.62, -0.06],
    [3.68, -5.60, 1.50, -10.1, 1.62, -0.08],
    [4.05, -6.40, 1.40, -10.1, 1.20, -0.05],
    [4.43, -7.25, 1.30, -12.3, 0.00, -0.02],
    [4.80, -7.25, 1.30, -13.9, 0.00, -0.02],
    [5.17, -7.20, 1.30, -15.7, 0.00, -0.02],
    [5.53, -6.80, 1.30, -17.8, -0.05, -0.03],
    [5.90, -6.50, 1.30, -19.3, -0.90, -0.05],
    [6.27, -5.30, 1.30, -19.5, -1.57, -0.08],
    [6.63, -3.50, 1.30, -19.5, -1.57, -0.10],
    [7.00, -1.70, 1.30, -19.6, -1.57, -0.10],
    [7.38, 0.20, 1.30, -19.8, -1.60, -0.06],
    [7.75, 2.20, 0.50, -20.1, -1.68, -0.03],
    [8.12, 4.00, 0.50, -20.4, -1.78, -0.02],
    [8.48, 5.80, 0.50, -20.6, -1.86, -0.02],
    [8.50, 5.90, 0.50, -20.6, -1.86, -0.02],
  ];

  const AXIS_FALL = new THREE.Vector3(-0.75, 0, 0.66).normalize();

  function updateGuard1(t) {
    const g = g1;
    resetPose(g);
    let x, z, yaw;
    if (t < 1.05) {
      x = -13.5; z = -15.5; yaw = 0.3;
    } else if (t < 1.9) {
      const s = (t - 1.05) / 0.85;
      x = lerp(-13.5, -11.8, s); z = lerp(-15.5, -9.7, s);
      yaw = lerp(0.3, Math.PI / 2, smooth((t - 1.6) / 0.3));
      legsCycle(g, t * 2 * Math.PI * 2.4, 0.85, 1.1);
      const sw = Math.sin(t * 2 * Math.PI * 2.4);
      g.shR.rotation.x = 0.7 * sw; g.shL.rotation.x = -0.7 * sw;
      g.elR.rotation.x = -0.9; g.elL.rotation.x = -0.9;
      g.spine.rotation.x = 0.3;
    } else if (t < 2.5) {
      const s = smooth((t - 1.9) / 0.6);
      x = lerp(-11.8, -8.8, Math.sqrt(s)); z = lerp(-9.7, -9.9, s);
      yaw = Math.PI / 2;
      legsCycle(g, t * 2 * Math.PI * 1.8, 0.5 * (1 - s) + 0.1, 0.6);
      g.shR.rotation.x = -1.35; g.elR.rotation.x = -0.15;
      g.shL.rotation.x = -1.0; g.shL.rotation.z = -0.35; g.elL.rotation.x = -0.4;
      g.spine.rotation.x = 0.1;
    } else if (t < 2.9) {
      x = lerp(-8.8, -8.9, (t - 2.5) / 0.4); z = -9.9; yaw = Math.PI / 2;
      const j = Math.abs(Math.sin(t * 26));
      g.spine.rotation.x = -0.18 * j;
      g.spine.rotation.z = 0.08 * Math.sin(t * 19);
      g.shR.rotation.x = -1.1 + 0.3 * j; g.elR.rotation.x = -0.2;
      g.shL.rotation.x = -0.7; g.shL.rotation.z = 0.2;
      g.hipR.rotation.x = -0.1; g.hipL.rotation.x = 0.15;
    } else if (t < 3.15) {
      const s = (t - 2.9) / 0.25;
      x = lerp(-8.9, -9.0, s); z = lerp(-9.9, -9.8, s); yaw = Math.PI / 2 + 0.25 * s;
      g.spine.rotation.x = -0.25; g.spine.rotation.z = 0.25 * Math.sin(s * Math.PI);
      g.shR.rotation.x = -0.5; g.shR.rotation.z = -0.6; g.elR.rotation.x = -0.6;
      g.shL.rotation.z = 0.9; g.elL.rotation.x = -0.3;
      g.hipR.rotation.x = 0.2; g.hipL.rotation.x = -0.25; g.knL.rotation.x = 0.3;
    } else if (t < 3.75) {
      const s = (t - 3.15) / 0.6;
      x = lerp(-9.0, -7.7, s); z = lerp(-9.8, -9.55, s); yaw = Math.PI / 2 + 0.25 - 0.15 * s;
      legsCycle(g, (t - 3.15) * 2 * Math.PI * 1.3, 0.35, 0.4);
      g.shR.rotation.x = -2.3; g.shR.rotation.z = 0.45; g.elR.rotation.x = -1.9;
      g.shL.rotation.x = -0.3; g.shL.rotation.z = 0.7; g.elL.rotation.x = -0.4;
      g.spine.rotation.x = 0.25 + 0.3 * s; g.head.rotation.x = 0.3;
    } else {
      x = -7.7; z = -9.55; yaw = Math.PI / 2 + 0.1;
      const s = clamp((t - 3.75) / 0.7, 0, 1);
      const phi = 1.4 * s * s;
      g.tilt.quaternion.setFromAxisAngle(AXIS_FALL, phi);
      g.shR.rotation.x = lerp(-2.3, -2.8, s); g.shR.rotation.z = 0.45; g.elR.rotation.x = -1.6;
      g.shL.rotation.z = lerp(0.7, 1.3, s);
      g.spine.rotation.x = -0.25; g.head.rotation.x = -0.4;
      g.knR.rotation.x = 0.4 * (1 - s) + 0.1; g.knL.rotation.x = 0.5 * (1 - s) + 0.1;
      g.hips.position.y = 0.95 - 0.12 * s;
    }
    g.root.position.set(x, 0, z);
    g.root.rotation.set(0, yaw, 0);
    g.gun.visible = t < 2.9;

    // dropped gun trajectory
    dropGun.visible = t >= 2.9;
    if (t >= 2.9) {
      const u = t - 2.9;
      const s = clamp(u / 0.67, 0, 1);
      const y = Math.max(0.05, 1.2 + 1.5 * u - 4.9 * u * u);
      dropGun.position.set(lerp(-8.6, -8.8, s), y, lerp(-9.6, -8.6, s));
      const spin = 6 * Math.min(u, 0.67);
      dropGun.rotation.set(spin, 0.4, s >= 1 ? Math.PI / 2 : spin * 0.5);
    }
    // sparks
    for (let i = 0; i < sparks.length; i++) {
      sparks[i].visible = t >= 2.1 && t < 3.0 && (Math.floor(t * 30 + i * 1.7) % 3 === 0);
    }
    // smoke from head hit
    if (t >= 3.45 && t < 4.4) {
      const u = (t - 3.45) / 0.95;
      smoke.visible = true;
      smoke.scale.setScalar(0.12 + 0.28 * u);
      smokeMat.opacity = 0.75 * (1 - u);
    } else {
      smoke.visible = false;
    }
  }

  function updateGuard2(t) {
    const g = g2;
    resetPose(g);
    g.root.position.set(18.7, 1.42, -19.05);
    g.root.rotation.set(0, -Math.PI / 2 - 0.15, 0);
    g.shR.rotation.x = -2.5; g.shR.rotation.z = 0.35; g.elR.rotation.x = -1.5;
    g.shL.rotation.z = 0.1;
    g.head.rotation.x = 0.05 * Math.sin(t * 2);
  }

  function update(time, frame) {
    const t = clamp(time, 0, duration);
    const x = hermite(CAM, t, 1);
    const y = hermite(CAM, t, 2);
    const z = hermite(CAM, t, 3);
    const yaw = hermite(CAM, t, 4);
    const pitch = hermite(CAM, t, 5);
    const bob = 0.03 * Math.sin(t * 2 * Math.PI * 1.9);
    camera.position.set(x, y + bob, z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.fov = 60;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // weapon sway + recoil
    const firing = (t >= 2.05 && t < 3.0) || (t >= 3.38 && t < 3.62);
    const on = firing && (Math.floor(t * 20) % 2 === 0);
    gunRig.position.set(0.01 * Math.sin(t * 2 * Math.PI * 0.95), 0.012 * Math.abs(Math.sin(t * 2 * Math.PI * 0.95)), on ? 0.02 : 0);
    flash.visible = on;

    updateGuard1(t);
    updateGuard2(t);
  }

  update(0, 0);
  return { scene, camera, update };
}
