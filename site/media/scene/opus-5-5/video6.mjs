// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video6.
// One continuous low-angle follow shot: a child on a tricycle rides down a carpeted
// hotel corridor, turns left across a lounge (wood floor, patterned rug), turns right
// through a passage into a second corridor, rides along it and turns right at its end.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2018);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.03, 120);
  camera.rotation.order = 'YXZ';

  // ---------------------------------------------------------------- helpers
  const SRGB = THREE.SRGBColorSpace;
  const lam = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}));
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });

  function box(x0, x1, y0, y1, z0, z1, m, parent) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(mesh);
    return mesh;
  }

  function hPlane(x0, x1, z0, z1, y, m, tileX, tileZ, faceDown) {
    const w = x1 - x0, d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(faceDown ? Math.PI / 2 : -Math.PI / 2);
    if (tileX) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tileX, uv.getY(i) * d / tileZ);
      uv.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    scene.add(mesh);
    return mesh;
  }

  function makeTex(w, h, fn) {
    const data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const c = fn((i + 0.5) / w, (j + 0.5) / h);
        const k = (j * w + i) * 4;
        data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    if (SRGB) t.colorSpace = SRGB;
    t.needsUpdate = true;
    return t;
  }

  // Hexagon carpet (orange / brown / red nested hexagons), tile = 3r x sqrt3 r
  const HEX_R = 0.42;
  const hexTileW = 3 * HEX_R, hexTileH = Math.sqrt(3) * HEX_R;
  const hexTex = makeTex(256, 256, (u, v) => {
    const x = u * 3, y = v * Math.sqrt(3); // in units of r
    let best = 9;
    for (let i = -1; i <= 3; i++) {
      for (let j = -1; j <= 2; j++) {
        const cx = i * 1.5, cy = j * Math.sqrt(3) + ((i & 1) ? Math.sqrt(3) / 2 : 0);
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        const d = Math.max(dy, dx * 0.8660254 + dy * 0.5) / 0.8660254;
        if (d < best) best = d;
      }
    }
    if (best < 0.42) return [152, 36, 40];
    if (best < 0.6) return [96, 60, 40];
    if (best < 0.83) return [215, 106, 52];
    return [90, 56, 36];
  });

  // Navajo-style rug: red / orange bands with cream lines and cross motifs
  const rugTex = makeTex(128, 128, (u, v) => {
    const band = Math.floor(v * 10);
    let c = (band % 2 === 0) ? [186, 66, 42] : [214, 128, 82];
    const fv = (v * 10) % 1;
    if (fv < 0.08) c = [226, 200, 170];
    const cu = Math.abs(((u * 3) % 1) - 0.5), cv = Math.abs(fv - 0.5);
    if (band % 2 === 1 && ((cu < 0.05 && cv < 0.32) || (cv < 0.08 && cu < 0.16))) c = [232, 214, 190];
    if (u < 0.03 || u > 0.97) c = [226, 200, 170];
    return c;
  });

  // ---------------------------------------------------------------- lights
  const LI = 1.15; // calibrated against reference frame brightness
  scene.add(new THREE.AmbientLight(0xfff8f2, 0.6 * LI));
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x5a3a26, 0.4 * LI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.12 * LI);
  sun.position.set(0.3, 1.0, 0.45);
  scene.add(sun);

  // ---------------------------------------------------------------- materials
  const M = {
    wall: lam(0xe8dccc),
    wallLounge: lam(0xc8b8a0),
    ceil: lam(0xe8dccb, { side: THREE.DoubleSide }),
    base: lam(0x3a2216),
    door: lam(0x3e2618),
    wood: lam(0x4a2c1c),
    carpet: lam(0xffffff, { map: hexTex }),
    rug: lam(0xd8d0c8, { map: rugTex }),
    lamp: basic(0xd8ccc8),
    red: lam(0xa0161c),
    pot: lam(0xb0704c),
    leaf: lam(0x3c5a2c),
    brownChair: lam(0x4a3226),
    creamChair: lam(0xd8ccb8),
    black: lam(0x1a1614),
    alcove: lam(0xcabaa2),
    curtain: lam(0xb01818),
    cabinet: lam(0x5a4234),
  };

  // ---------------------------------------------------------------- environment
  // Layout (metres): corridor 1 x[-1.45,1.45] heading -Z from z=5; lounge x[-14,-1.45] z[-19.5,-12];
  // passage x[-9.6,-7.4] through wall z[-19.9,-19.5]; corridor 2 z[-22.5,-19.9] x[-12,5.65];
  // corridor 3 x[2.75,5.65] running +Z from corridor 2.
  const CH = 2.55; // corridor ceiling height
  hPlane(-15, 7, -24, 6, 0, M.wood);
  hPlane(-1.45, 1.45, -19.5, 5, 0.004, M.carpet, hexTileW, hexTileH);
  hPlane(-12, 5.65, -22.5, -19.9, 0.004, M.carpet, hexTileW, hexTileH);
  hPlane(2.75, 5.65, -19.9, -6, 0.004, M.carpet, hexTileW, hexTileH);
  hPlane(-7.0, -2.9, -19.2, -13.6, 0.007, M.rug, 4.1, 5.6);

  // Ceilings
  hPlane(-1.45, 1.45, -12, 5, CH, M.ceil, 0, 0, true);
  hPlane(-14, 1.45, -19.5, -12, 3.2, lam(0xc4b49c, { side: THREE.DoubleSide }), 0, 0, true);
  hPlane(-12, 5.65, -22.5, -19.9, CH, M.ceil, 0, 0, true);
  hPlane(2.75, 5.65, -19.9, -6, CH, M.ceil, 0, 0, true);
  box(-1.45, 1.45, CH, 3.2, -12.15, -11.95, M.wall); // header corridor1 -> lounge

  // Corridor 1 walls
  box(-1.65, -1.45, 0, 3.2, -12, 5, M.wall);              // left wall
  box(-1.75, -1.45, 0, 3.2, -13.3, -12, M.wall);          // pier where the corridor opens to the lounge
  box(1.45, 1.95, 0, 3.2, -6, -1.9, M.wall);              // right wall, middle
  box(1.45, 2.75, 0, 3.2, -19.9, -6, M.wall);             // right wall, south (thick, backs corridor 3)
  box(1.45, 1.95, 0, 3.2, -0.4, 5, M.wall);               // right wall, north
  box(1.45, 1.95, 2.15, 3.2, -1.9, -0.4, M.wall);         // header over green doorway
  box(-1.65, 1.95, 0, 3.2, 5, 5.2, M.wall);               // start end wall
  const greenRoom = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 3.4), lam(0xa8cc78, { side: THREE.BackSide }));
  greenRoom.position.set(2.95, 1.3, -1.1);
  scene.add(greenRoom);
  box(2.3, 2.4, 0.0, 1.0, -2.2, -0.2, lam(0x4a5a3a));      // stair rail hint
  box(-1.45, -1.41, 0, 2.2, -0.3, 1.3, M.red);              // red elevator doors
  box(-1.45, -1.4, 0, 2.3, 1.3, 1.45, M.black);
  box(1.12, 1.45, 0, 0.95, -0.25, 1.1, M.cabinet);          // wooden cabinet
  const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.55, 18), M.pot);
  urn.position.set(-1.17, 0.275, -0.75); scene.add(urn);
  box(-1.41, -1.25, 0, 0.8, -1.6, -1.45, M.black);          // trash stand
  box(-1.45, -1.43, 0, 0.1, -12, 5, M.base);
  box(1.43, 1.45, 0, 0.1, -19.5, -1.9, M.base);
  box(1.43, 1.45, 0, 0.1, -0.4, 5, M.base);
  const doorL = (z) => box(-1.45, -1.41, 0, 2.05, z - 0.45, z + 0.45, M.door);
  const doorR = (z) => box(1.41, 1.45, 0, 2.05, z - 0.45, z + 0.45, M.door);
  [-3.0, -6.6, -10.2].forEach(doorL);
  [-4.6, -8.2, -11.6, -15.2].forEach(doorR);

  // South wall of lounge / end of corridor 1 / north wall of corridor 2 (thick), passage at x[-9.6,-7.4]
  box(-7.4, 1.45, 0, 3.2, -19.9, -19.5, M.wall);
  box(-14.2, -9.6, 0, 3.2, -19.9, -19.5, M.wall);
  box(-9.6, -7.4, 2.3, 3.2, -19.9, -19.5, M.wall);
  box(-0.55, 0.65, 0, 2.15, -19.5, -19.46, M.door);         // double door at end of corridor 1
  // Lounge walls and contents
  box(-14.2, -1.45, 0, 3.2, -12.2, -12.0, M.wallLounge);   // north
  box(-14.2, -14.0, 0, 3.2, -19.9, -12.0, M.wallLounge);   // west
  box(-14.0, -13.92, 0, 2.5, -17.6, -14.4, M.alcove);      // staircase alcove
  box(-13.92, -13.0, 0, 0.6, -17.4, -15.4, lam(0x5a2e22)); // stair landing
  box(-13.5, -13.45, 0.6, 1.5, -15.45, -15.4, M.black);    // rail post
  box(-13.5, -13.45, 1.45, 1.5, -17.4, -15.4, M.black);    // rail
  box(-4.4, -2.9, 0, 0.8, -19.5, -18.7, M.brownChair);     // brown sofa (south wall)
  box(-14.0, -13.1, 0, 0.95, -19.3, -18.4, M.creamChair);  // cream wing chair (west wall)
  box(-11.0, -10.2, 0, 0.95, -19.5, -18.7, M.creamChair);  // cream chair near the passage
  box(-14.0, -13.2, 0, 0.95, -13.3, -12.5, M.creamChair);  // cream chair (north-west)
  box(-12.4, -11.0, 0.7, 0.76, -12.9, -12.2, M.brownChair);// table top
  box(-12.3, -11.1, 0, 0.7, -12.8, -12.3, lam(0x3a2418));  // table body
  box(-5.9, -4.9, 0, 2.4, -19.5, -19.44, M.curtain);       // red curtained doorway
  box(-13.0, -12.4, 0, 2.2, -12.04, -12.0, M.door);
  const chand = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M.lamp);
  chand.scale.y = 0.6; chand.position.set(-7.2, 2.75, -16.0); scene.add(chand);
  box(-7.22, -7.18, 2.85, 3.2, -16.02, -15.98, M.black);
  [[-13.95, -13.0], [-13.95, -18.9]].forEach(([x, z]) => box(x, x + 0.08, 1.9, 2.1, z - 0.06, z + 0.06, M.lamp));
  [[-4.0, -12.0], [-9.0, -12.0]].forEach(([x, z]) => box(x - 0.06, x + 0.06, 1.9, 2.1, z, z - 0.08, M.lamp));

  function plant(x, z, s) {
    s = s || 1;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.15 * s, 0.35 * s, 14), M.pot);
    p.position.set(x, 0.175 * s, z); scene.add(p);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 12, 10), M.leaf);
    f.scale.y = 2.0; f.position.set(x, 0.35 * s + 0.55 * s, z); scene.add(f);
  }
  plant(-1.0, -19.15, 1);
  plant(1.1, -19.15, 1);
  plant(-4.6, -12.45, 1.1);
  plant(-2.3, -18.4, 1.0);
  plant(-12.6, -12.5, 0.9);
  plant(5.3, -22.15, 1.0);

  // Corridor 2 / 3 walls
  box(-12.2, 5.85, 0, 3.2, -22.7, -22.5, M.wall);   // corridor 2 south
  box(-12.2, -12.0, 0, 3.2, -22.7, -19.5, M.wall);  // corridor 2 west end
  box(5.65, 5.85, 0, 3.2, -22.7, -6, M.wall);       // corridor 2 east end + corridor 3 east wall
  box(2.75, 5.65, 0, 3.2, -6.2, -6.0, M.wall);      // corridor 3 far end
  box(-12, 5.65, 0, 0.1, -22.5, -22.48, M.base);
  box(-7.4, 2.75, 0, 0.1, -19.92, -19.9, M.base);
  box(5.63, 5.65, 0, 0.1, -22.5, -6, M.base);
  box(2.75, 2.77, 0, 0.1, -19.9, -6, M.base);
  [-9.0, -4.5, -0.5, 3.3].forEach((x) => box(x - 0.45, x + 0.45, 0, 2.05, -22.5, -22.46, M.door));
  [-6.2, -2.4, 1.2].forEach((x) => box(x - 0.45, x + 0.45, 0, 2.05, -19.94, -19.9, M.door));
  box(5.61, 5.65, 0, 2.05, -22.2, -21.3, M.door);   // end door
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), M.red);
  bell.position.set(5.6, 2.0, -22.25); scene.add(bell);
  [-16.5, -12.0].forEach((z) => box(2.75, 2.79, 0, 2.05, z - 0.45, z + 0.45, M.door));
  [-17.8, -13.4].forEach((z) => box(5.61, 5.65, 0, 2.05, z - 0.45, z + 0.45, M.door));

  function lamp(x, z, y) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8), M.lamp);
    l.scale.y = 0.32; l.position.set(x, (y || CH) - 0.03, z); scene.add(l);
  }
  for (let z = 3.0; z > -12; z -= 3.0) lamp(0, z);
  lamp(0, -15.5, 3.2); lamp(0, -18.0, 3.2);
  for (let x = -10.5; x < 5.5; x += 3.0) lamp(x, -21.2);
  for (let z = -18.5; z > -7; z -= 3.0) lamp(4.2, z);

  // ---------------------------------------------------------------- tricycle + child
  const C = {
    blue: lam(0x4a5cb4), frame: lam(0xc0181c), tire: lam(0x1c1c1e), hub: lam(0x9a9a9a),
    chrome: lam(0xb8b8b8), grip: lam(0xc0141c), sweater: lam(0xa3141e), denim: lam(0x2c3654),
    hair: lam(0x96744c), skin: lam(0xe2b38e), shoe: lam(0xc8202a),
  };
  const zAxis = new THREE.Vector3(0, 0, 1);
  const trike = new THREE.Group();
  scene.add(trike);

  const RW = 0.1, FW = 0.18, HUB_Z = -0.45, TRACK = 0.21;
  // rear axle + frame (red)
  box(-TRACK, TRACK, 0.075, 0.115, -0.03, 0.03, C.frame, trike);
  box(-0.03, 0.03, 0.09, 0.14, -0.42, 0.0, C.frame, trike);
  box(-0.1, 0.1, 0.07, 0.12, -0.02, 0.08, C.frame, trike);
  // blue body / seat
  box(-0.08, 0.08, 0.13, 0.22, -0.4, -0.04, C.blue, trike);
  box(-0.12, 0.12, 0.17, 0.22, -0.16, 0.06, C.blue, trike);
  // tall tapered seatback
  {
    const sh = new THREE.Shape();
    sh.moveTo(-0.155, 0); sh.lineTo(0.155, 0); sh.lineTo(0.085, 0.38); sh.lineTo(-0.085, 0.38); sh.lineTo(-0.155, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: false });
    g.translate(0, 0, -0.0225);
    const sb = new THREE.Mesh(g, C.blue);
    sb.position.set(0, 0.1, 0.07);
    sb.rotation.x = 0.22;
    trike.add(sb);
  }
  const rearWheels = [];
  [-TRACK, TRACK].forEach((x) => {
    const g = new THREE.Group();
    g.position.set(x, RW, 0);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(RW, RW, 0.075, 22), C.tire);
    w.rotation.z = Math.PI / 2; g.add(w);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 12), C.hub);
    h.rotation.z = Math.PI / 2; g.add(h);
    const sx = Math.sign(x);
    box(sx * 0.04 - 0.003, sx * 0.04 + 0.003, 0.025, 0.085, -0.012, 0.012, C.frame, g);
    trike.add(g);
    rearWheels.push(g);
  });
  // steering assembly
  const steer = new THREE.Group();
  steer.position.set(0, FW, HUB_Z);
  trike.add(steer);
  const frontSpin = new THREE.Group();
  steer.add(frontSpin);
  {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(FW, FW, 0.07, 26), C.tire);
    w.rotation.z = Math.PI / 2; frontSpin.add(w);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.075, 14), C.hub);
    h.rotation.z = Math.PI / 2; frontSpin.add(h);
    box(-0.065, -0.05, 0, 0.065, -0.012, 0.012, C.chrome, frontSpin);
    box(0.05, 0.065, -0.065, 0, -0.012, 0.012, C.chrome, frontSpin);
    box(-0.12, -0.065, 0.05, 0.08, -0.03, 0.03, C.frame, frontSpin);
    box(0.065, 0.12, -0.08, -0.05, -0.03, 0.03, C.frame, frontSpin);
  }
  box(-0.05, 0.05, -0.01, 0.22, -0.02, 0.02, C.chrome, steer);
  {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), C.chrome);
    stem.position.set(0, 0.18, 0.06); stem.rotation.x = 0.36; steer.add(stem);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8), C.chrome);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.34, 0.12); steer.add(bar);
    [-0.21, 0.21].forEach((x) => {
      const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.08, 10), C.grip);
      gr.rotation.z = Math.PI / 2; gr.position.set(x, 0.34, 0.12); steer.add(gr);
    });
  }
  const GRIP_LOCAL = [[-0.2, 0.34, 0.12], [0.2, 0.34, 0.12]];

  // child
  const boy = new THREE.Group();
  trike.add(boy);
  box(-0.11, 0.11, 0.19, 0.29, -0.13, 0.04, C.denim, boy); // pelvis
  const torso = new THREE.Group();
  torso.position.set(0, 0.24, -0.03);
  boy.add(torso);
  box(-0.14, 0.14, 0.0, 0.29, -0.085, 0.075, C.sweater, torso);
  box(-0.085, -0.045, 0.02, 0.29, 0.075, 0.09, C.denim, torso);   // strap L
  box(0.045, 0.085, 0.02, 0.29, 0.075, 0.09, C.denim, torso);     // strap R
  box(-0.125, 0.125, 0.0, 0.1, -0.09, 0.085, C.denim, torso);     // overall waist
  const head = new THREE.Group();
  head.position.set(0, 0.29, -0.005);
  torso.add(head);
  {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.04, 12), lam(0x6a6a78));
    head.add(collar);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.076, 16, 12), C.skin);
    face.position.set(0, 0.09, -0.015); head.add(face);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), C.hair);
    hair.scale.set(1.12, 1.1, 1.04);
    hair.position.set(0, 0.105, 0.012); head.add(hair);
  }
  // limbs: cylinder along +Z of unit length, scaled per frame
  const limbMeshes = new Map();
  function makeLimb(radius, mat) {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(radius, radius * 0.9, 1, 10);
    geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    limbMeshes.set(g, m);
    boy.add(g);
    return g;
  }
  const upperArms = [makeLimb(0.045, C.sweater), makeLimb(0.045, C.sweater)];
  const foreArms = [makeLimb(0.04, C.sweater), makeLimb(0.04, C.sweater)];
  const hands = [];
  for (let i = 0; i < 2; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), C.skin);
    boy.add(h); hands.push(h);
  }
  function placeLimb(g, a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(1e-4, dir.length());
    g.position.copy(a);
    g.quaternion.setFromUnitVectors(zAxis, dir.multiplyScalar(1 / len));
    limbMeshes.get(g).scale.set(1, 1, len);
  }
  // legs: thigh group (forward = -Z) and shin group
  const L1 = 0.23, L2 = 0.23;
  function makeLeg() {
    const thigh = new THREE.Group();
    const tg = new THREE.CylinderGeometry(0.05, 0.045, L1, 10);
    tg.rotateX(Math.PI / 2); tg.translate(0, 0, -L1 / 2);
    thigh.add(new THREE.Mesh(tg, C.denim));
    const shin = new THREE.Group();
    shin.position.set(0, 0, -L1);
    thigh.add(shin);
    const sg = new THREE.CylinderGeometry(0.042, 0.036, L2, 10);
    sg.rotateX(Math.PI / 2); sg.translate(0, 0, -L2 / 2);
    shin.add(new THREE.Mesh(sg, C.denim));
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), C.shoe);
    shoe.position.set(0, 0, -L2);
    shin.add(shoe);
    boy.add(thigh);
    return { thigh, shin, shoe };
  }
  const legs = [makeLeg(), makeLeg()];
  const HIP = [[-0.07, 0.24, -0.07], [0.07, 0.24, -0.07]];

  // ---------------------------------------------------------------- path
  // straights and circular arcs; k > 0 = left turn, k < 0 = right turn
  const segs = [
    { k: 0, len: 14.0 },                       // corridor 1 (heading -Z)
    { k: 1 / 2.5, len: 2.5 * Math.PI / 2 },    // left turn into lounge
    { k: 0, len: 5.0 },                        // across the lounge rug (heading -X)
    { k: -1 / 1.0, len: 1.0 * Math.PI / 2 },   // sharp right turn
    { k: 0, len: 2.5 },                        // through the passage (heading -Z)
    { k: -1 / 1.0, len: 1.0 * Math.PI / 2 },   // right into corridor 2
    { k: 0, len: 10.2 },                       // corridor 2 (heading +X)
    { k: -1 / 1.5, len: 1.5 * Math.PI / 2 },   // right at corridor 2 end
    { k: 0, len: 30.0 },
  ];
  function segPoint(sg, u) {
    if (sg.k === 0) {
      return { x: sg.x - Math.sin(sg.phi) * u, z: sg.z - Math.cos(sg.phi) * u, phi: sg.phi, k: 0 };
    }
    const p1 = sg.phi + sg.k * u;
    return {
      x: sg.x + (Math.cos(p1) - Math.cos(sg.phi)) / sg.k,
      z: sg.z - (Math.sin(p1) - Math.sin(sg.phi)) / sg.k,
      phi: p1, k: sg.k,
    };
  }
  {
    let x = 0, z = 0, phi = 0, s0 = 0;
    for (const sg of segs) {
      sg.x = x; sg.z = z; sg.phi = phi; sg.s0 = s0;
      const e = segPoint(sg, sg.len);
      x = e.x; z = e.z; phi = e.phi; s0 += sg.len;
    }
  }
  function pathAt(s) {
    if (s <= 0) return segPoint(segs[0], s);
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      if (s <= sg.s0 + sg.len || i === segs.length - 1) return segPoint(sg, s - sg.s0);
    }
    return segPoint(segs[0], 0);
  }

  // ---------------------------------------------------------------- interpolation
  function makeInterp(keys, extrapolate) {
    const n = keys.length;
    const ts = keys.map((k) => k[0]), vs = keys.map((k) => k[1]);
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (vs[i + 1] - vs[i]) / (ts[i + 1] - ts[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] * d[i] <= 0) ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
      if (q > 9) { const tau = 3 / Math.sqrt(q); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
    }
    return (t) => {
      if (t <= ts[0]) return extrapolate ? vs[0] + m[0] * (t - ts[0]) : vs[0];
      if (t >= ts[n - 1]) return extrapolate ? vs[n - 1] + m[n - 1] * (t - ts[n - 1]) : vs[n - 1];
      let i = 0;
      while (i < n - 2 && t > ts[i + 1]) i++;
      const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h;
      const u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * h * m[i] +
        (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * h * m[i + 1];
    };
  }

  // distance along path vs time (anchored to sample timestamps)
  const sOf = makeInterp([
    [0, 0], [4.17, 6.4], [8.34, 12.7], [9.38, 14.3], [10.44, 16.0], [11.48, 17.9],
    [12.51, 19.9], [13.55, 21.9], [14.61, 24.25], [15.65, 25.1], [16.68, 26.3],
    [17.72, 27.8], [18.79, 29.6], [22.96, 37.4], [24.03, 39.8],
  ], true);
  // camera follow distance (behind the rear axle along a corner-cutting path)
  const camD = makeInterp([
    [0, 1.68], [1.03, 1.6], [2.1, 1.45], [3.14, 1.3], [4.17, 1.12], [5.2, 1.04], [6.27, 1.1],
    [7.31, 1.12], [8.34, 1.1], [9.38, 1.05], [10.44, 1.0], [11.48, 0.95], [12.51, 1.05],
    [13.55, 1.0], [14.61, 1.3], [15.65, 1.05], [16.68, 0.85], [17.72, 0.95], [18.79, 0.8],
    [19.82, 0.82], [20.85, 0.86], [21.89, 0.9], [22.96, 0.92], [24.03, 0.88],
  ]);
  const camH = makeInterp([
    [0, 0.72], [4.17, 0.7], [7.31, 0.68], [8.34, 0.64], [9.38, 0.56], [10.44, 0.5], [11.48, 0.47],
    [13.55, 0.46], [15.65, 0.44], [17.72, 0.43], [24.03, 0.45],
  ]);
  const camPitchDeg = makeInterp([
    [0, -8.5], [4.17, -11], [7.31, -6], [8.34, -5], [9.38, -2], [10.44, 0], [11.48, 2],
    [13.55, 3.5], [14.61, 3], [15.65, 2], [16.68, 0], [17.72, 1], [18.79, 2], [19.82, 2],
    [20.85, 2.5], [21.89, 3], [22.96, 3], [24.03, 2],
  ]);
  const camLat = makeInterp([
    [0, 0], [5.2, 0], [6.27, 0.1], [7.31, 0.2], [8.34, 0.05], [9.38, 0], [15.65, 0], [16.68, 0],
    [17.72, -0.15], [18.79, -0.3], [19.82, -0.25], [20.85, -0.05], [21.89, 0.08], [22.96, 0.22], [24.03, 0.15],
  ]);
  const AIM_AHEAD = 0.25;
  // half-width of the corner-cutting window: wide in the lounge turns, tighter in the corridors
  const smoothW = makeInterp([[0, 2.5], [16.4, 2.5], [17.2, 1.0], [22.0, 1.0], [23.2, 2.0], [24.03, 2.0]]);

  function camBase(sc, SMOOTH_W) {
    // symmetric corner-cutting average of path points around sc
    let x = 0, z = 0, cx = 0, sx = 0, om = 0;
    const N = 21;
    for (let i = 0; i < N; i++) {
      const o = -SMOOTH_W + (2 * SMOOTH_W * i) / (N - 1);
      const p = pathAt(sc + o);
      x += p.x; z += p.z; om += o;
      cx += Math.cos(p.phi); sx += Math.sin(p.phi);
    }
    // remove any along-track bias of the window so straights keep the exact follow distance
    om /= N;
    const p0 = pathAt(sc);
    const fx = -Math.sin(p0.phi), fz = -Math.cos(p0.phi);
    return { x: x / N - fx * om, z: z / N - fz * om, phi: Math.atan2(sx, cx) };
  }

  function update(time, frame) {
    const t = Math.max(0, Math.min(duration, time));
    const s = sOf(t);
    const P = pathAt(s);
    trike.position.set(P.x, 0, P.z);
    trike.rotation.set(0, P.phi, 0);

    // steering from upcoming curvature
    const kAvg = (pathAt(s + 0.05).k + pathAt(s + 0.25).k + pathAt(s + 0.45).k + pathAt(s + 0.65).k) / 4;
    const sigma = Math.max(-0.6, Math.min(0.6, Math.atan(0.6 * kAvg)));
    steer.rotation.set(0, sigma, 0);

    // wheel spin + pedalling
    const c = s / FW;
    frontSpin.rotation.set(-c, 0, 0);
    rearWheels.forEach((w) => w.rotation.set(-s / RW, 0, 0));

    // torso bob / sway, leaning into turns
    const lean = -0.12 + 0.03 * Math.sin(2 * c);
    const sway = 0.05 * Math.sin(c) - sigma * 0.2;
    torso.rotation.set(lean, sigma * 0.3, sway);
    head.rotation.set(0.05, sigma * 0.4, -sway * 0.5);

    // arms: shoulder -> elbow (out and down) -> grip
    const cs = Math.cos(sigma), sn = Math.sin(sigma);
    torso.updateMatrix();
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const sh = new THREE.Vector3(side * 0.15, 0.255, -0.01).applyMatrix4(torso.matrix);
      const gl = GRIP_LOCAL[i];
      const gx = gl[0] * cs + gl[2] * sn, gz = -gl[0] * sn + gl[2] * cs;
      const grip = new THREE.Vector3(gx, FW + gl[1], HUB_Z + gz);
      const elbow = new THREE.Vector3().addVectors(sh, grip).multiplyScalar(0.5);
      elbow.x += side * 0.08; elbow.y -= 0.06;
      placeLimb(upperArms[i], sh, elbow);
      placeLimb(foreArms[i], elbow, grip);
      hands[i].position.copy(grip);
    }

    // legs: analytic two-bone IK in the sagittal plane to the pedals
    const RC = 0.065;
    for (let i = 0; i < 2; i++) {
      const ph = i === 0 ? 0 : Math.PI;
      const px = i === 0 ? -0.095 : 0.095;
      const py = RC * Math.cos(c + ph), pz = -RC * Math.sin(c + ph);
      const fz = HUB_Z + (-px * sn + pz * cs);
      const fy = FW + py;
      const hip = HIP[i];
      const vu = -(fz - hip[2]), vw = fy - hip[1];
      let d = Math.hypot(vu, vw);
      d = Math.max(Math.abs(L1 - L2) + 0.02, Math.min(L1 + L2 - 0.002, d));
      const psi = Math.atan2(vw, vu);
      const alpha = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
      const thA = psi + alpha;
      const ku = L1 * Math.cos(thA), kw = L1 * Math.sin(thA);
      const gam = Math.atan2(vw - kw, vu - ku);
      const lg = legs[i];
      lg.thigh.position.set(hip[0], hip[1], hip[2]);
      lg.thigh.rotation.set(thA, 0, 0);
      lg.shin.rotation.set(gam - thA, 0, 0);
      lg.shoe.rotation.set(-gam, 0, 0);
    }

    // camera: corner-cutting follow path behind the rider, aimed ahead of the rider
    const D = camD(t);
    const B = camBase(s - D, smoothW(t));
    const lat = camLat(t);
    const rx = Math.cos(B.phi), rz = -Math.sin(B.phi);
    const cx = B.x + rx * lat, cz = B.z + rz * lat;
    camera.position.set(cx, camH(t), cz);
    const ax = P.x - Math.sin(P.phi) * AIM_AHEAD, az = P.z - Math.cos(P.phi) * AIM_AHEAD;
    const yaw = Math.atan2(-(ax - cx), -(az - cz));
    camera.rotation.set(camPitchDeg(t) * Math.PI / 180, yaw, 0, 'YXZ');
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
