// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video8.
// Single continuous shot from the rear seat of a tandem high-wing light aircraft:
// the camera looks forward over the front pilot's back (green headset, black top,
// shoulder-harness strap hanging from the ceiling) through the tube-braced windscreen,
// side windows and overhead skylight. The aircraft is in a steep nose-down dive
// (0-4 s), pulls out with a slight right bank (4-8 s) and is level / slightly
// climbing afterwards (8-12 s). The pilot turns his head to his left at ~9.6-11.8 s.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, width / height, 0.04, 220000);

  // ---------------------------------------------------------------- utilities
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32((seed | 0) ^ 0x5eed1234);

  const matCache = {};
  function lam(hex) {
    if (!matCache[hex]) matCache[hex] = new THREE.MeshLambertMaterial({ color: hex });
    return matCache[hex];
  }
  function boxMM(parent, x0, x1, y0, y1, z0, z1, hex) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), lam(hex));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    parent.add(m);
    return m;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  function rod(parent, a, b, r, hex) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), lam(hex));
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    parent.add(m);
    return m;
  }
  function strap(parent, a, b, w, th, hex) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, th), lam(hex));
    m.position.copy(A).add(B).multiplyScalar(0.5);
    // keep the strap's width along +X (facing the camera), length along A->B
    const yA = dir.normalize();
    const xA = new THREE.Vector3(1, 0, 0).addScaledVector(yA, -yA.x).normalize();
    const zA = new THREE.Vector3().crossVectors(xA, yA).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
    parent.add(m);
    return m;
  }

  // Cubic Hermite (Catmull-Rom style, non-uniform) keyframe interpolation.
  function makeTrack(times, values) {
    const n = times.length;
    const tang = new Array(n);
    for (let i = 0; i < n; i++) {
      if (i === 0) tang[i] = (values[1] - values[0]) / (times[1] - times[0]);
      else if (i === n - 1) tang[i] = (values[n - 1] - values[n - 2]) / (times[n - 1] - times[n - 2]);
      else tang[i] = (values[i + 1] - values[i - 1]) / (times[i + 1] - times[i - 1]);
    }
    return function (t) {
      if (t <= times[0]) return values[0];
      if (t >= times[n - 1]) return values[n - 1];
      let i = 0;
      while (i < n - 2 && t > times[i + 1]) i++;
      const h = times[i + 1] - times[i];
      const s = (t - times[i]) / h;
      const s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * values[i] + (s3 - 2 * s2 + s) * h * tang[i] +
        (-2 * s3 + 3 * s2) * values[i + 1] + (s3 - s2) * h * tang[i + 1];
    };
  }
  function smooth(e0, e1, x) {
    const s = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return s * s * (3 - 2 * s);
  }

  // Sample timestamps (reference frames 0,16,31,...,359 at 30 fps).
  const T = [0, 0.5333, 1.0333, 1.5667, 2.0667, 2.6, 3.1333, 3.6333, 4.1667, 4.6667, 5.2, 5.7333,
    6.2333, 6.7667, 7.3, 7.8, 8.3333, 8.8333, 9.3667, 9.9, 10.4, 10.9333, 11.4333, 11.9667];

  // Aircraft attitude (deg). pitch: nose up +; bank: right wing down +.
  const acPitch = makeTrack(T, [-35, -38, -45, -60, -68, -66, -66, -64, -50, -38, -30, -28,
    -21, -13.5, -5.5, -3.8, -2, -1.8, -0.5, 1.8, 4, 7, 10, 8]);
  const acBank = makeTrack(T, [5, 12, 2, 7, 10, 7, 7, 7, 12.7, 15, 15, 12, 6.6, 6, 5.2, 4.7, 2.3, 0,
    -0.8, -0.3, 0.5, 0.5, 0.2, -1]);
  // Camera roll relative to the cabin (deg, + = camera rolled counter-clockwise).
  const camRoll = makeTrack(T, [5, 12, 2, 4, 4.7, 1.6, 1.5, 1.5, 2.7, 3, 3, 3, 1.6, 1, 1, 0.5, 0, 0,
    0, 0.5, 1, 1, 1, 0]);
  const acHeading = makeTrack([0, 2, 4, 6, 8, 12], [0, -20, -40, -55, -62, -65]); // negative = right turn
  // Camera pose relative to the cabin (deg). pitch up +, yaw left +.
  const camPitch = makeTrack(T, [-5, -9, 1, 7, 8, 2, 4, 4, -8, -11, -3, -5, -8, -12, -14, -8, -1, 0,
    -5, -7, -10, -15, -20, -20]);
  const camYaw = makeTrack(T, [0, -0.7, 1.5, 14, 15, 12.5, 4.5, 3.7, 5.5, 1, 1.5, 1.8, 1, 0.7, 0.7,
    1.5, 0, 0, 0.7, 1.5, 3.3, 4.8, 4.8, 1.8]);
  // Pilot torso lean toward his right (image right), deg.
  const pilotLean = makeTrack(T, [2, 6.8, 6.8, 5, 5, 5, 3, 2.4, 5, 3.3, 2.4, 1.9, 0.5, 0, 0.8, 0, 0,
    0, 0, 0, 0, 0, 0, 1]);
  function headYawDeg(t) {
    // turn to his left (image left) ~9.45-9.85 s, hold, turn back 11.05-11.85 s
    return 70 * smooth(9.45, 9.85, t) * (1 - smooth(11.05, 11.85, t));
  }
  function altitude(t) { return 1300 - 300 * smooth(0, 8, t) + 15 * Math.max(0, t - 8); }

  // ---------------------------------------------------------------- world
  const hazeHex = 0xc6d1dc;
  scene.fog = new THREE.Fog(hazeHex, 900, 36000);
  scene.background = new THREE.Color(hazeHex);

  // Sky dome with vertex-colour gradient (follows the aircraft).
  {
    const g = new THREE.SphereGeometry(100000, 48, 24);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cHaze = new THREE.Color(0xdde4ec), cMid = new THREE.Color(0x98b8e4), cZen = new THREE.Color(0x4a7fd2);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 100000;
      if (y <= 0.02) c.copy(cHaze);
      else if (y < 0.18) c.copy(cHaze).lerp(cMid, (y - 0.02) / 0.16);
      else c.copy(cMid).lerp(cZen, Math.min(1, (y - 0.18) / 0.4));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    var sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false,
    }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  // Procedural patchwork farmland texture (fields, tree lines, woods, ponds, farm buildings).
  {
    const N = 2048;
    const data = new Uint8Array(N * N * 4);
    const pal = [
      [204, 180, 140], [216, 196, 156], [190, 166, 124], [176, 158, 112], [158, 152, 104],
      [178, 150, 112], [200, 178, 134], [146, 146, 100], [188, 172, 128], [160, 136, 104],
      [210, 188, 146], [168, 160, 118],
    ];
    const woods = [96, 92, 84], treeLine = [108, 104, 92];
    function put(x, y, r, g, b) {
      x = ((x % N) + N) % N; y = ((y % N) + N) % N;
      const k = (y * N + x) * 4;
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 255;
    }
    function fillRect(x0, y0, w, h, col) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, col[0], col[1], col[2]);
    }
    function split(x, y, w, h, depth) {
      const area = w * h;
      if (w < 40 || h < 40 || area < 4500 || (depth > 4 && rng() < 0.3)) {
        const col = rng() < 0.14 ? woods : pal[Math.floor(rng() * pal.length)];
        fillRect(x, y, w, h, col);
        if (rng() < 0.55) {
          const tl = rng() < 0.5 ? woods : treeLine;
          const th = 2 + Math.floor(rng() * 3);
          if (rng() < 0.6) fillRect(x, y, w, th, tl);
          if (rng() < 0.6) fillRect(x, y, th, h, tl);
        }
        return;
      }
      const horiz = w > h ? false : (h > w ? true : rng() < 0.5);
      const f = 0.3 + rng() * 0.4;
      if (horiz) {
        const h1 = Math.floor(h * f);
        split(x, y, w, h1, depth + 1); split(x, y + h1, w, h - h1, depth + 1);
      } else {
        const w1 = Math.floor(w * f);
        split(x, y, w1, h, depth + 1); split(x + w1, y, w - w1, h, depth + 1);
      }
    }
    split(0, 0, N, N, 0);
    // meandering wooded creeks
    for (let k = 0; k < 40; k++) {
      let x = rng() * N, y = rng() * N, a = rng() * Math.PI * 2;
      const steps = 150 + Math.floor(rng() * 350);
      const wdt = 2 + Math.floor(rng() * 4);
      for (let s = 0; s < steps; s++) {
        a += (rng() - 0.5) * 0.5;
        x += Math.cos(a) * 2; y += Math.sin(a) * 2;
        for (let dy = -wdt; dy <= wdt; dy++) for (let dx = -wdt; dx <= wdt; dx++)
          if (dx * dx + dy * dy <= wdt * wdt) put(Math.floor(x + dx), Math.floor(y + dy), 100, 96, 86);
      }
    }
    // woods blobs
    for (let k = 0; k < 70; k++) {
      const cx = Math.floor(rng() * N), cy = Math.floor(rng() * N), r = 8 + Math.floor(rng() * 40);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d < 0.75 + 0.25 * Math.sin(dx * 0.3 + dy * 0.2 + k)) put(cx + dx, cy + dy, 98, 94, 86);
      }
    }
    // ponds
    for (let k = 0; k < 30; k++) {
      const cx = Math.floor(rng() * N), cy = Math.floor(rng() * N), s = 5 + Math.floor(rng() * 8);
      fillRect(cx, cy, s, s, [86, 140, 104]);
    }
    // farm buildings / light roofs
    for (let k = 0; k < 260; k++) {
      const cx = Math.floor(rng() * N), cy = Math.floor(rng() * N);
      const col = rng() < 0.2 ? [170, 60, 50] : [228, 226, 220];
      fillRect(cx, cy, 2 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 3), col);
    }
    // light roads
    for (let k = 0; k < 8; k++) {
      const vertical = rng() < 0.5, p = Math.floor(rng() * N);
      for (let s = 0; s < N; s++) {
        if (vertical) put(p, s, 196, 188, 168);
        else put(s, p, 196, 188, 168);
      }
    }
    // per-texel grain
    for (let i = 0; i < N * N; i++) {
      const n = (rng() - 0.5) * 14;
      const k = i * 4;
      data[k] = Math.max(0, Math.min(255, data[k] + n));
      data[k + 1] = Math.max(0, Math.min(255, data[k + 1] + n));
      data[k + 2] = Math.max(0, Math.min(255, data[k + 2] + n));
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const tileMeters = 6000, groundSize = 90000;
    tex.repeat.set(groundSize / tileMeters, groundSize / tileMeters);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshBasicMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
  }

  // Scattered cumulus (flattened white ellipsoid clusters) above the aircraft altitude.
  {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf3f5f7 });
    const sph = new THREE.SphereGeometry(1, 14, 10);
    for (let k = 0; k < 70; k++) {
      const ang = rng() * Math.PI * 2;
      const dist = 3500 + rng() * 22000;
      const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
      const cy = 1900 + rng() * 900;
      const size = 500 + rng() * 1300;
      const parts = 2 + Math.floor(rng() * 3);
      for (let j = 0; j < parts; j++) {
        const m = new THREE.Mesh(sph, cloudMat);
        m.scale.set(size * (0.6 + rng() * 0.6), size * (0.18 + rng() * 0.12), size * (0.6 + rng() * 0.6));
        m.position.set(cx + (rng() - 0.5) * size * 1.2, cy + rng() * size * 0.15, cz + (rng() - 0.5) * size * 1.2);
        scene.add(m);
      }
    }
  }

  // Lights (world fixed; the sun is high and to the front-left at start).
  scene.add(new THREE.AmbientLight(0xffffff, 2.3));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.5);
  sun.position.set(-0.5, 1.0, 0.4);
  scene.add(sun);

  // ---------------------------------------------------------------- aircraft cabin
  // Cabin frame: camera eye at origin, forward -Z, up +Y, right +X (metres).
  const aircraft = new THREE.Group();
  aircraft.rotation.order = 'YXZ';
  scene.add(aircraft);
  aircraft.add(camera);
  camera.rotation.order = 'YXZ';

  const CREAM = 0xdfe5d3, BLACK = 0x161616, DARK = 0x2c2c2c, RED = 0xc4161f, GREEN_FRAME = 0x3c6a52;
  const W = 0.40, CEIL = 0.33, ZF = -0.86, ZB = 0.5;

  // ceiling with skylight opening (x +-0.30, z -0.60 .. 0.25)
  boxMM(aircraft, -W - 0.02, W + 0.02, CEIL, CEIL + 0.03, ZF, -0.60, CREAM);
  boxMM(aircraft, 0.30, W + 0.02, CEIL, CEIL + 0.03, -0.60, ZB, CREAM);
  boxMM(aircraft, -W - 0.02, -0.30, CEIL, CEIL + 0.03, -0.60, ZB, CREAM);
  boxMM(aircraft, -W - 0.02, W + 0.02, CEIL, CEIL + 0.03, 0.25, ZB, CREAM);
  // skylight frame (green-tinted)
  boxMM(aircraft, -0.30, 0.30, CEIL - 0.012, CEIL + 0.005, -0.625, -0.595, GREEN_FRAME);
  boxMM(aircraft, -0.315, -0.29, CEIL - 0.012, CEIL + 0.005, -0.625, 0.25, GREEN_FRAME);
  boxMM(aircraft, 0.29, 0.315, CEIL - 0.012, CEIL + 0.005, -0.625, 0.25, GREEN_FRAME);

  for (const s of [-1, 1]) {
    const xi = s * W, xo = s * (W + 0.02);
    const xa = Math.min(xi, xo), xb = Math.max(xi, xo);
    // upper side wall (cream) above window
    boxMM(aircraft, xa, xb, 0.12, CEIL + 0.03, ZF, ZB, CREAM);
    // window top / bottom black frames, protruding inward
    const fi = s * (W - 0.012);
    boxMM(aircraft, Math.min(fi, xi), Math.max(fi, xi), 0.105, 0.135, ZF, ZB, BLACK);
    boxMM(aircraft, Math.min(fi, xi), Math.max(fi, xi), -0.32, -0.285, ZF, ZB, BLACK);
    // lower wall
    boxMM(aircraft, xa, xb, -1.0, -0.30, ZF, ZB, DARK);
    // window front post (door frame)
    const fp = s * (W - 0.035);
    boxMM(aircraft, Math.min(fp, xo), Math.max(fp, xo), -0.335, 0.14, ZF, -0.78, BLACK);
    // windscreen side pillar
    boxMM(aircraft, Math.min(s * 0.37, xo), Math.max(s * 0.37, xo), -0.335, CEIL + 0.03, ZF - 0.02, ZF + 0.01, BLACK);
  }
  // windscreen header (top edge)
  boxMM(aircraft, -W, W, CEIL - 0.025, CEIL + 0.03, ZF - 0.02, ZF + 0.02, 0xd4d7c0);
  // instrument panel + gauges
  boxMM(aircraft, -0.33, 0.33, -0.46, -0.13, ZF, -0.80, 0xcfcbb6);
  {
    const gm = lam(0x45484a);
    const gx = [-0.25, -0.17, -0.09, 0.10, 0.18, 0.26];
    for (let i = 0; i < gx.length; i++) {
      for (const gy of [-0.17, -0.235]) {
        const g = new THREE.Mesh(new THREE.CircleGeometry(0.019, 18), gm);
        g.position.set(gx[i], gy, -0.798);
        aircraft.add(g);
      }
    }
    boxMM(aircraft, -0.03, 0.08, -0.25, -0.18, -0.80, -0.795, 0x2a3346); // radio display
  }
  // dark lower front / floor
  boxMM(aircraft, -W, W, -1.0, -0.46, ZF - 0.02, -0.78, 0x252525);
  boxMM(aircraft, -W, W, -1.02, -0.98, ZF, ZB, 0x303030);
  // windscreen tube bracing
  const ZS = -0.84, TR = 0.0085;
  rod(aircraft, [-0.29, -0.14, ZS], [-0.29, 0.20, ZS], TR, BLACK);
  rod(aircraft, [0.29, -0.14, ZS], [0.29, 0.20, ZS], TR, BLACK);
  rod(aircraft, [-0.29, 0.20, ZS], [-0.05, 0.315, ZS], TR, BLACK);
  rod(aircraft, [0.29, 0.20, ZS], [0.05, 0.315, ZS], TR, BLACK);
  rod(aircraft, [-0.05, 0.315, ZS], [0.05, 0.315, ZS], TR, BLACK);
  rod(aircraft, [-0.29, 0.20, ZS], [-0.39, 0.31, ZS + 0.02], TR, BLACK);
  rod(aircraft, [0.29, 0.20, ZS], [0.39, 0.31, ZS + 0.02], TR, BLACK);
  // red vent / handle boxes on the upper side walls
  boxMM(aircraft, -W + 0.005, -W + 0.025, 0.17, 0.29, -0.52, -0.40, RED);
  boxMM(aircraft, W - 0.025, W - 0.005, 0.20, 0.31, -0.64, -0.50, RED);
  // overhead radio console (upper left, close to camera)
  boxMM(aircraft, -W, -0.30, 0.14, CEIL, -0.32, -0.06, 0xebe5c6);
  for (const [ky, kz] of [[0.29, -0.27], [0.29, -0.21], [0.29, -0.15], [0.23, -0.27], [0.23, -0.21], [0.23, -0.15]]) {
    boxMM(aircraft, -0.302, -0.29, ky - 0.012, ky + 0.012, kz - 0.012, kz + 0.012, 0x3a3a38); // knobs
  }
  boxMM(aircraft, -0.302, -0.296, 0.18, 0.195, -0.30, -0.12, 0x9a2a26); // red switch row
  // mirror on the left windscreen corner
  {
    const mir = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), lam(0x5a5e62));
    mir.rotation.x = Math.PI / 2;
    mir.position.set(-0.28, 0.23, -0.60);
    aircraft.add(mir);
    rod(aircraft, [-0.28, 0.23, -0.60], [-0.20, 0.31, -0.62], 0.006, 0x444444);
  }
  // coiled cord + headset cable (left)
  rod(aircraft, [-0.30, 0.16, -0.42], [-0.37, 0.02, -0.36], 0.013, 0x111111);
  rod(aircraft, [-0.37, 0.02, -0.36], [-0.39, 0.14, -0.30], 0.013, 0x111111);
  rod(aircraft, [-0.27, 0.12, -0.40], [-0.25, -0.22, -0.38], 0.004, 0x111111);
  rod(aircraft, [-0.25, -0.22, -0.38], [-0.10, -0.14, -0.36], 0.004, 0x111111);
  // front seat back (light grey)
  boxMM(aircraft, -0.25, 0.25, -0.95, -0.36, -0.33, -0.29, 0x8f9486);
  // ceiling-mounted shoulder harness strap hanging between camera and pilot
  strap(aircraft, [-0.09, CEIL + 0.01, -0.24], [-0.025, -0.13, -0.335], 0.08, 0.008, 0x1b1b1b);

  // ---------------------------------------------------------------- pilot (front seat)
  const pilot = new THREE.Group();
  pilot.position.set(-0.02, -0.75, -0.47);
  aircraft.add(pilot);
  const FLEECE = 0x1f1d1b;
  // torso: back face at z=-0.34 (world), shoulder line at y~-0.16 (world)
  boxMM(pilot, -0.25, 0.25, 0.05, 0.48, -0.07, 0.13, FLEECE);
  {
    // rounded, sloping shoulders: short central roll + two lower shoulder spheres
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 16), lam(FLEECE));
    sh.rotation.z = Math.PI / 2;
    sh.position.set(0, 0.525, 0.03);
    pilot.add(sh);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), lam(FLEECE));
      cap.scale.set(1.15, 1, 1);
      cap.position.set(s * 0.15, 0.48, 0.03);
      pilot.add(cap);
    }
  }
  rod(pilot, [0, 0.55, 0], [0, 0.66, 0], 0.06, 0x151515); // turtleneck collar
  rod(pilot, [0, 0.64, 0], [0, 0.74, 0], 0.048, 0xc39a82); // neck (skin)
  boxMM(pilot, -0.07, -0.022, 0.05, 0.625, 0.13, 0.142, 0x3d443f); // harness straps on back
  boxMM(pilot, 0.0, 0.048, 0.05, 0.625, 0.13, 0.142, 0x3d443f);

  const head = new THREE.Group();
  head.position.set(0.008, 0.71, 0);
  pilot.add(head);
  const SKIN = 0xc79a80, HAIR = 0x8a7560;
  {
    // hair-coloured skull, skin-coloured face poking out at the front (-Z)
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), lam(HAIR));
    sk.scale.set(0.84, 1.0, 1.0);
    sk.position.set(0, 0.075, 0);
    head.add(sk);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.092, 18, 12), lam(SKIN));
    face.scale.set(0.82, 1.0, 1.0);
    face.position.set(0, 0.055, -0.02);
    head.add(face);
    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), lam(SKIN));
    nape.position.set(0, 0.015, 0.012);
    head.add(nape);
    // sunglasses + nose (visible only when the head turns)
    boxMM(head, -0.07, 0.07, 0.085, 0.118, -0.115, -0.085, 0x202022);
    boxMM(head, -0.012, 0.012, 0.035, 0.08, -0.125, -0.095, SKIN);
    // headset: green ear cups and band
    const CUP = 0x8db79d;
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.045, 16), lam(CUP));
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.108, 0.02, 0);
      head.add(cup);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.011, 6, 24, Math.PI), lam(0x2e3330));
    band.scale.set(1, 1.5, 1);
    band.position.set(0, 0.02, 0);
    head.add(band);
    rod(head, [-0.12, 0.0, -0.01], [-0.09, -0.03, -0.11], 0.005, 0x1a1a1a); // mic boom
  }

  // ---------------------------------------------------------------- update
  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), duration);
    aircraft.position.set(0, altitude(t), -40 * t);
    aircraft.rotation.set(acPitch(t) * D2R, acHeading(t) * D2R, -acBank(t) * D2R, 'YXZ');
    camera.position.set(0, 0, 0);
    camera.rotation.set(camPitch(t) * D2R, camYaw(t) * D2R, camRoll(t) * D2R, 'YXZ');
    pilot.rotation.set(0, 0, -pilotLean(t) * D2R);
    head.rotation.set(0, headYawDeg(t) * D2R, 0);
    sky.position.copy(aircraft.position);
    scene.updateMatrixWorld(true);
  }
  update(0, 0);

  return { scene, camera, update };
}
