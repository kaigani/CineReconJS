// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video35.
// First-person walk: night alley along a brick wall -> through an open side door
// into a storage room -> turn left, through an inner door -> brightly lit store.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020203);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.03, 150);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- deterministic RNG ----------
  let s0 = (seed >>> 0) || 12345;
  function rnd() {
    s0 = (s0 + 0x6D2B79F5) >>> 0;
    let t = s0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- procedural textures (in-memory DataTextures) ----------
  function makeTex(w, h, fill) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = fill(x, y);
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  // brick: 128px = 1.0 m wide, 0.6 m tall (8 courses, 4 bricks per course)
  const brickShade = [];
  for (let i = 0; i < 64; i++) brickShade.push(0.75 + 0.5 * rnd());
  const brickTex = makeTex(128, 128, (x, y) => {
    const row = Math.floor(y / 16);
    const off = (row % 2) * 16;
    const col = Math.floor(((x + off) % 128) / 32);
    const my = y % 16, mx = (x + off) % 32;
    if (my < 3 || mx < 3) return [150, 148, 146];
    const k = brickShade[(row * 4 + col) % 64];
    return [Math.min(255, 82 * k), 22 * k, 26 * k];
  });
  // concrete block wall: 128px = 1.2 m, 4 x 6 blocks
  const blockTex = makeTex(128, 128, (x, y) => {
    const line = (x % 32) < 2 || (y % 21) < 2;
    const n = 215 + Math.floor(25 * Math.sin(x * 0.37 + y * 0.21) * Math.cos(y * 0.13));
    if (line) return [140, 144, 150];
    return [n, n + 3, n + 10];
  });
  // colorful packaged goods: 4 shelf bands, columns of product colours
  const pal = [[220, 50, 70], [240, 140, 40], [70, 180, 80], [40, 120, 220], [40, 190, 200], [230, 80, 160], [150, 200, 60]];
  const colA = [];
  for (let i = 0; i < 64; i++) colA.push(pal[Math.floor(rnd() * pal.length)]);
  const goodsTex = makeTex(64, 64, (x, y) => {
    const band = y % 16;
    if (band < 3) return [235, 235, 238];
    const c = colA[(Math.floor(x / 8) + Math.floor(y / 16) * 8) % 64];
    return band > 12 ? [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8] : c;
  });
  // cup noodle shelving: cream cups with red bands on white shelves
  const cupTex = makeTex(64, 64, (x, y) => {
    const band = y % 16;
    if (band < 3) return [238, 238, 240];
    const cx = x % 10;
    if (cx < 1) return [200, 200, 205];
    if (band > 9 && band < 12) return [190, 60, 60];
    return [236, 228, 214];
  });
  // drinks: dark fridge with lit shelves and green / white bottles
  const drinkTex = makeTex(64, 64, (x, y) => {
    const band = y % 16;
    if (band < 2) return [240, 240, 245];
    if (x % 32 < 2) return [20, 22, 28];
    const b = Math.floor(x / 4) % 3;
    if (band < 5) return [30, 30, 36];
    if (b === 0) return [60, 170, 80];
    if (b === 1) return [200, 210, 220];
    return [40, 120, 70];
  });
  // frozen food tops
  const iceTex = makeTex(32, 32, (x, y) => {
    const bx = Math.floor(x / 8), by = Math.floor(y / 8);
    return ((bx + 2 * by) % 3) ? [95, 130, 205] : [215, 218, 228];
  });

  // ---------- material helpers ----------
  function mat(color, glow = 0, map = null) {
    const p = { color: new THREE.Color(color) };
    if (map) p.map = map;
    if (glow > 0) {
      p.emissive = new THREE.Color(color);
      p.emissiveIntensity = glow;
      if (map) { p.emissive = new THREE.Color(0xffffff); p.emissiveMap = map; }
    }
    return new THREE.MeshLambertMaterial(p);
  }
  function basic(color) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }); }

  function scaleBoxUV(g, w, h, d, tu, tv) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const f = Math.floor(i / 4);
      let su, sv;
      if (f < 2) { su = d / tu; sv = h / tv; }
      else if (f < 4) { su = w / tu; sv = d / tv; }
      else { su = w / tu; sv = h / tv; }
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    uv.needsUpdate = true;
  }

  // world-aligned box from extents
  function wbox(x0, x1, y0, y1, z0, z1, m, tile, parent) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) scaleBoxUV(g, w, h, d, tile[0], tile[1]);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    (parent || scene).add(mesh);
    return mesh;
  }
  // store-local frame: R = right, F = forward when entering the store (world +z)
  const SX = -2.87, SZ = -5.02;
  function sbox(R0, R1, y0, y1, F0, F1, m, tile) {
    return wbox(SX - R1, SX - R0, y0, y1, SZ + F0, SZ + F1, m, tile);
  }

  // ---------- lights ----------
  const amb = new THREE.AmbientLight(0x9098b0, 0.7);
  scene.add(amb);
  const flash = new THREE.SpotLight(0xf4f6ff, 11, 0, 0.62, 0.75, 1.5);
  flash.position.set(0, -0.05, 0);
  camera.add(flash);
  flash.target.position.set(0, -0.05, -1);
  camera.add(flash.target);

  // ================= ALLEY (outdoor, night) =================
  const asphalt = mat(0x2a2e38, 0.15);
  wbox(-1.29, 7, -0.02, 0, -12, 6, asphalt);
  // walkway slabs along the brick wall
  const slabM = mat(0x5c616b, 0.05);
  for (let i = 0; i < 12; i++) {
    const z1 = 4 - i * 1.25, z0 = z1 - 1.18;
    wbox(-1.29, -0.12, 0, 0.02, z0, z1, slabM);
  }
  // brick building wall (outer face x=-1.29, inner face x=-1.59)
  const brickM = mat(0xffffff, 0.05, brickTex);
  wbox(-1.59, -1.29, 0, 3.6, -9.05, 8, brickM, [1.0, 0.6]);
  wbox(-1.59, -1.29, 0, 3.6, -10.6, -10.0, brickM, [1.0, 0.6]);
  wbox(-1.59, -1.29, 2.45, 3.6, -10.0, -9.05, brickM, [1.0, 0.6]);
  // illuminated fascia sign band along the top of the wall
  wbox(-1.29, -1.10, 3.55, 3.95, -10.4, 8, mat(0xf2f6ff, 1.0));
  wbox(-1.105, -1.095, 3.56, 3.62, -10.4, 8, mat(0x2a7bff, 1.0));
  wbox(-1.29, -1.05, 3.95, 4.05, -10.4, 8, mat(0x30333a));
  // dark window opening high on the wall
  wbox(-1.30, -1.28, 2.5, 3.45, -8.0, -6.6, basic(0x07070a));
  // dark doorway jambs (reveal inside the wall thickness)
  const jambM = mat(0x2a2a2e);
  wbox(-1.59, -1.29, 0, 2.45, -9.07, -9.05, jambM);
  wbox(-1.59, -1.29, 0, 2.45, -10.0, -9.98, jambM);
  // entry door: open ~90 deg outward, hinged at the far jamb, facing the camera
  const doorM = mat(0xd9d3c8, 0.3);
  wbox(-1.29, -0.34, 0.02, 2.45, -10.05, -10.0, doorM);
  const knobM = mat(0x9aa0a8, 0.1);
  const knob1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), knobM);
  knob1.position.set(-0.45, 1.05, -9.96); scene.add(knob1);
  wbox(-1.05, -0.58, 0.18, 0.32, -10.0, -9.99, mat(0x8c8a86));
  // concrete-block perimeter walls (lit by distant street light)
  const blockM = mat(0xffffff, 0.42, blockTex);
  wbox(0.45, 5.6, 0, 2.65, -11.0, -10.8, blockM, [1.2, 1.2]);
  wbox(5.6, 5.8, 0, 2.65, -11.0, 5, blockM, [1.2, 1.2]);
  wbox(0.45, 5.8, 2.65, 2.75, -11.0, -10.75, mat(0xc8ccd4, 0.4));
  // grey bin in the near right foreground
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.95, 20), mat(0x868a94, 0.15));
  bin.position.set(1.9, 0.475, -1.9); scene.add(bin);

  // ================= STORAGE ROOM =================
  const stWallM = mat(0xc4c7cd, 0.18);
  const stFloorM = mat(0x3d4047, 0.1);
  const stCeilM = mat(0x4b505c, 0.15);
  wbox(-7.6, -1.59, -0.02, 0, -10.05, -5.27, stFloorM);
  wbox(-7.6, -1.59, 2.9, 2.95, -10.05, -5.27, stCeilM);
  wbox(-7.6, -1.59, 0, 2.95, -10.25, -10.05, stWallM);          // right-hand (-z) wall
  wbox(-7.8, -7.6, 0, 2.95, -10.25, -5.0, stWallM);             // back wall
  wbox(-1.62, -1.59, 0, 2.9, -9.05, -5.27, stWallM);            // lining of alley wall
  // store partition wall (z -5.27 .. -5.02) with doorway x -3.39 .. -2.34
  const storeWhite = mat(0xe6e6ea, 0.85);
  const partM = [stWallM, stWallM, stWallM, stWallM, storeWhite, stWallM];
  wbox(-10.4, -3.39, 0, 3.0, -5.27, -5.02, partM);
  wbox(-2.34, -1.59, 0, 3.0, -5.27, -5.02, partM);
  wbox(-3.39, -2.34, 2.45, 3.0, -5.27, -5.02, partM);
  // back of the walk-in drink cooler (black rack with lit shelves), left of the corridor
  const rackM = mat(0x111419, 0.05);
  wbox(-5.9, -3.9, 0, 2.1, -7.0, -6.55, rackM);
  wbox(-5.9, -3.75, 0, 2.1, -5.75, -5.27, rackM);
  const stripM = mat(0xffffff, 1.0);
  for (let i = 0; i < 5; i++) {
    const y = 0.35 + i * 0.4;
    wbox(-5.85, -3.95, y, y + 0.03, -7.02, -7.0, stripM);
    wbox(-5.85, -3.8, y, y + 0.03, -5.77, -5.75, stripM);
  }
  const bottleM = mat(0x2f7a40, 0.25);
  wbox(-5.8, -4.0, 0.8, 1.1, -7.01, -6.95, bottleM);
  wbox(-5.8, -3.85, 0.8, 1.1, -5.76, -5.7, bottleM);
  wbox(-5.8, -3.85, 1.2, 1.5, -5.76, -5.7, bottleM);
  // dark casing around the store doorway
  const frameM = mat(0x2c2e33, 0.05);
  wbox(-3.47, -3.39, 0, 2.53, -5.33, -5.02, frameM);
  wbox(-2.34, -2.26, 0, 2.53, -5.33, -5.02, frameM);
  wbox(-3.47, -2.26, 2.45, 2.53, -5.33, -5.02, frameM);
  // inner door to the store: hinged at x=-3.39, opened ~100 deg into the storage room
  const innerDoor = new THREE.Group();
  innerDoor.position.set(-3.39, 0, -5.27);
  innerDoor.rotation.y = THREE.MathUtils.degToRad(100);
  scene.add(innerDoor);
  const idoor = new THREE.Mesh(new THREE.BoxGeometry(1.03, 2.43, 0.05), mat(0xd2ccc2, 0.12));
  idoor.position.set(0.53, 1.23, -0.03); innerDoor.add(idoor);
  const knob2 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), knobM);
  knob2.position.set(0.95, 1.05, -0.08); innerDoor.add(knob2);
  const vent2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.01), mat(0x8c8a86));
  vent2.position.set(0.53, 0.25, -0.06); innerDoor.add(vent2);
  // cardboard boxes
  const cardM = mat(0xc9a878, 0.2);
  const cardM2 = mat(0x9a8e7a, 0.0);
  function stack(cx, cz, w, d, h, n, m) {
    for (let i = 0; i < n; i++) {
      wbox(cx - w / 2, cx + w / 2, i * h + 0.005, (i + 1) * h - 0.005, cz - d / 2, cz + d / 2, m);
    }
  }
  stack(-3.95, -7.7, 0.65, 1.0, 0.5, 3, cardM);             // face-mask stack
  wbox(-4.25, -3.68, 1.5, 1.95, -8.15, -7.65, cardM);
  wbox(-4.2, -3.7, 1.5, 1.85, -7.6, -7.22, cardM);
  stack(-6.4, -7.6, 0.6, 0.9, 0.48, 3, cardM);
  stack(-6.9, -8.9, 0.6, 0.8, 0.45, 2, cardM);
  stack(-1.885, -6.0, 0.53, 1.2, 0.5, 4, cardM2);            // ethanol stack by the inner door
  // teal utility cart at the far end
  const cartG = new THREE.Group(); cartG.position.set(-6.2, 0, -9.6); scene.add(cartG);
  const steel = mat(0x9aa4ad, 0.2), teal = mat(0x2c8c8c, 0.25);
  for (const [px, pz] of [[-0.25, -0.38], [0.25, -0.38], [-0.25, 0.38], [0.25, 0.38]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), steel);
    p.position.set(px, 0.5, pz); cartG.add(p);
  }
  for (const y of [0.35, 0.8]) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.76), teal);
    sh.position.set(0, y, 0); cartG.add(sh);
  }

  // ================= STORE (bright interior) =================
  // store frame: R in [-1.28, 5.6] (left wall .. right wall), F in [0, 11]
  const floorS = mat(0xcfccc4, 0.75);
  const ceilS = mat(0xe8e9ee, 0.8);
  const wallS = mat(0xe6e6ea, 0.85);
  sbox(-1.28, 5.1, -0.02, 0, 0, 11.1, floorS);
  sbox(-1.28, 5.1, 3.0, 3.05, 0, 11.1, ceilS);
  sbox(-1.28, -1.25, 0, 3.0, 0, 11.0, wallS);                 // left wall
  sbox(-1.28, 5.1, 0, 3.0, 11.0, 11.1, wallS);                // far wall
  sbox(5.0, 5.1, 2.3, 3.0, 0, 11.0, wallS);                   // right wall upper band
  sbox(4.98, 5.1, 0, 2.3, 0, 11.0, mat(0x16181e, 0.4));       // right wall dark lower
  sbox(3.6, 5.1, 0, 3.0, 8.6, 11.0, mat(0x16181e, 0.4));      // dark back-right block
  // posters
  const posterM = mat(0xf4f1ee, 0.9);
  sbox(4.94, 4.98, 1.8, 2.45, 3.2, 4.6, posterM);
  sbox(4.94, 4.98, 1.8, 2.45, 5.0, 6.4, posterM);
  sbox(3.6, 5.0, 2.3, 2.75, 8.55, 8.6, posterM);
  sbox(4.9, 4.94, 0.9, 1.9, 5.6, 6.4, mat(0x6cc8d8, 0.8));
  // ceiling light panels
  const lightM = mat(0xffffff, 1.2);
  for (const R of [-0.3, 2.0, 4.2]) {
    for (const F of [1.2, 3.6, 6.0, 8.4, 10.5]) sbox(R - 0.6, R + 0.6, 2.96, 3.0, F - 0.3, F + 0.3, lightM);
  }
  // hanging cyan signs
  const signM = mat(0x22c0cc, 0.9);
  for (const [R, F] of [[0.3, 3.2], [2.4, 4.6], [-0.3, 6.6], [3.6, 7.4], [1.4, 9.2]]) {
    sbox(R - 0.4, R + 0.4, 2.3, 2.65, F - 0.02, F + 0.02, signM);
  }
  // open refrigerated case on the left wall (blue base, white body, cyan canopy)
  sbox(-1.25, -0.5, 0, 0.45, 4.2, 9.6, mat(0x1d3fa0, 0.7));
  sbox(-1.25, -1.1, 0.45, 1.9, 4.2, 9.6, mat(0xffffff, 0.8, goodsTex), [0.6, 0.6]);
  sbox(-1.1, -0.6, 1.0, 1.03, 4.2, 9.6, wallS);
  sbox(-1.25, -0.55, 1.9, 2.15, 4.2, 9.6, mat(0xf2f4f6, 0.85));
  sbox(-0.57, -0.53, 1.9, 2.05, 4.2, 9.6, mat(0x20b4d0, 0.9));
  sbox(-1.25, -0.5, 0.45, 2.15, 4.16, 4.2, mat(0xf2f4f6, 0.85));
  // gondola A: cup noodles (long axis along F)
  const cupM = mat(0xffffff, 0.8, cupTex);
  const whiteTop = mat(0xf4f4f6, 0.85);
  sbox(0.05, 1.02, 0, 1.2, 3.6, 7.6, cupM, [0.6, 0.6]);
  sbox(0.02, 1.05, 1.2, 1.25, 3.57, 7.63, whiteTop);
  // gondola B: long colourful face toward the entrance, cup end caps
  const goodsM = mat(0xffffff, 0.8, goodsTex);
  sbox(1.35, 4.2, 0, 1.2, 5.4, 6.4, [cupM, cupM, whiteTop, whiteTop, goodsM, goodsM], [0.6, 0.6]);
  sbox(1.32, 4.23, 1.2, 1.3, 5.37, 6.43, whiteTop);
  // freezer chests
  const chestM = mat(0x262a31, 0.35);
  const iceM = mat(0xffffff, 0.75, iceTex);
  function chest(R0, R1, F0, F1) {
    sbox(R0, R1, 0, 0.85, F0, F1, chestM);
    sbox(R0 + 0.07, R1 - 0.07, 0.85, 0.87, F0 + 0.07, F1 - 0.07, iceM, [0.5, 0.5]);
  }
  chest(0.9, 2.2, 2.0, 3.3);
  chest(3.4, 4.35, 2.0, 3.3);
  chest(1.4, 2.4, 7.4, 8.4);
  // drink fridges on the right wall (glass fronts facing -R)
  const drinkM = mat(0xffffff, 0.85, drinkTex);
  const fridgeFrame = mat(0x14161b, 0.3);
  sbox(4.4, 4.98, 0, 2.15, 0.1, 1.8, [drinkM, fridgeFrame, fridgeFrame, fridgeFrame, fridgeFrame, fridgeFrame], [0.8, 0.8]);
  // dark doorway in the right wall beyond the fridges
  sbox(4.92, 4.98, 0, 2.1, 1.95, 2.4, mat(0x08090b));
  // poster / magazine shelf against the right wall
  sbox(4.4, 4.98, 0, 1.4, 3.4, 4.8, mat(0xf0f0f2, 0.8));
  sbox(4.38, 4.42, 1.4, 1.85, 3.45, 4.75, mat(0xe8d2d0, 0.85));
  sbox(2.6, 3.5, 0, 1.35, 7.0, 7.3, mat(0xf0f0f2, 0.8));
  sbox(2.6, 3.5, 1.35, 1.8, 7.12, 7.18, mat(0xe8d2d0, 0.85));
  // tobacco shelf on the far wall and checkout counter
  sbox(-0.6, 1.4, 1.2, 2.2, 10.7, 11.0, mat(0x2142a8, 0.8));
  sbox(0.2, 2.6, 0, 1.0, 8.6, 9.3, mat(0xf2f2f4, 0.8));
  sbox(0.8, 1.5, 1.0, 1.4, 8.8, 9.1, mat(0xd0362f, 0.7));

  // ---------- HUD centre dot (part of the reference game view) ----------
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }));
  dot.position.set(0, 0, -0.3);
  dot.renderOrder = 999;
  camera.add(dot);

  // ---------- camera keyframes: t, x, z, heading(deg, + = left of -z), pitch(deg) ----------
  const st = (R, F) => [SX - R, SZ + F];
  const K = [
    [0.000, 0.00, 0.00, 2.0, -3],
    [0.333, 0.00, -0.57, -0.3, -3],
    [0.667, 0.00, -1.43, -1.2, -3],
    [1.000, 0.00, -2.28, -1.7, -3],
    [1.333, 0.00, -3.03, -1.5, -3],
    [1.667, 0.00, -3.85, -2.6, -3],
    [2.000, 0.00, -4.63, -2.6, -3],
    [2.333, 0.00, -5.40, -3.5, -3],
    [2.667, 0.00, -6.10, -1.0, -3],
    [3.000, 0.00, -6.90, 2.0, -3],
    [3.333, -0.10, -7.67, 13.0, -3],
    [3.667, -0.35, -8.40, 28.6, -3],
    [4.000, -0.70, -9.00, 59.0, -3],
    [4.170, -1.45, -9.45, 85.0, -3],
    [4.350, -1.95, -8.99, 108.0, -3],
    [4.683, -2.60, -8.90, 150.0, -3],
    [5.017, -3.00, -8.60, 172.0, -3],
    [5.350, -2.90, -7.80, 178.0, -3],
    [5.683, -2.87, -7.32, 180.0, -3],
    [6.017, -2.90, -6.70, 176.0, -3],
    [6.350, ...st(0.45, -0.10), 169.6, -3],
    [6.683, ...st(0.50, 0.90), 164.0, -4],
    [7.017, ...st(0.50, 1.50), 140.0, -4],
    [7.350, ...st(0.50, 1.90), 128.0, -4],
    [7.683, ...st(0.50, 2.20), 118.0, -4],
  ];
  const N = K.length;
  function slope(i, c) {
    if (i <= 0) return (K[1][c] - K[0][c]) / (K[1][0] - K[0][0]);
    if (i >= N - 1) return (K[N - 1][c] - K[N - 2][c]) / (K[N - 1][0] - K[N - 2][0]);
    const a = K[i][c] - K[i - 1][c], b = K[i + 1][c] - K[i][c];
    if (a * b <= 0) return 0;
    return (K[i + 1][c] - K[i - 1][c]) / (K[i + 1][0] - K[i - 1][0]);
  }
  function sample(t, c) {
    if (t <= K[0][0]) return K[0][c];
    if (t >= K[N - 1][0]) return K[N - 1][c];
    let i = 0;
    while (i < N - 2 && t > K[i + 1][0]) i++;
    const t0 = K[i][0], t1 = K[i + 1][0], h = t1 - t0;
    const s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
    const m0 = slope(i, c) * h, m1 = slope(i + 1, c) * h;
    return (2 * s3 - 3 * s2 + 1) * K[i][c] + (s3 - 2 * s2 + s) * m0 +
      (-2 * s3 + 3 * s2) * K[i + 1][c] + (s3 - s2) * m1;
  }

  const D2R = Math.PI / 180;
  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));
    const x = sample(t, 1), z = sample(t, 2), hdg = sample(t, 3), pit = sample(t, 4);
    const bob = 0.012 * Math.sin(t * 2 * Math.PI * 1.8);
    camera.position.set(x, 1.5 + bob, z);
    camera.rotation.set(pit * D2R, hdg * D2R, 0, 'YXZ');
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
