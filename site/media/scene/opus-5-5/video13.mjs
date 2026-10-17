// CineRecon Three.js sampled-frame baseline - L1 proxy reconstruction of video13.mp4
// Football match in an indoor-roof arena: opening wide rail-cam move over the near stand (0-4.26 s),
// cut to the tracking rail camera that follows a counter-attack from the right half to a goal at the left end.
// World: pitch 105 x 68 m, x along length (left goal x=-52.5, right goal x=+52.5), z toward camera side (+z), y up.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x26262a);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1500);
  camera.rotation.order = 'YXZ';

  // ---------- deterministic random ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32((seed | 0) + 1313);

  const SRGB = THREE.SRGBColorSpace;
  function makeDataTex(w, h, fill) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fill(x, y); const i = (y * w + x) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    if (SRGB) tex.colorSpace = SRGB;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }

  // Crowd texture: dark seated spectators with sparse colour, one texture tile ~ 8 m x 8 m
  const crowdTex = makeDataTex(128, 128, (x, y) => {
    const row = y % 8;
    if (row === 0) return [78, 74, 70];
    const r = rand();
    if (r < 0.04) return [70 + rand() * 30 | 0, 105 + rand() * 40 | 0, 70 + rand() * 20 | 0];
    if (r < 0.08) return [150 + rand() * 40 | 0, 140 + rand() * 40 | 0, 130 + rand() * 30 | 0];
    if (r < 0.09) return [130, 55, 50];
    const g = 35 + rand() * 45 | 0; return [g + 6, g, g - 4];
  });
  // Empty grey seats (left end lower tier)
  const seatTex = makeDataTex(64, 64, (x, y) => {
    const row = y % 8;
    if (row < 2) return [72, 70, 66];
    const g = 98 + rand() * 18 | 0; return [g + 2, g, g - 6];
  });
  // Pitch with mowing stripes along x (stripe width 5.25 m) -> texture covers 10.5 m per repeat
  const grassTex = makeDataTex(64, 8, (x) => {
    const n = (rand() - 0.5) * 6;
    return x < 32 ? [96 + n | 0, 126 + n | 0, 49 + n | 0] : [86 + n | 0, 115 + n | 0, 43 + n | 0];
  });

  function lambert(color, opts = {}) { return new THREE.MeshLambertMaterial(Object.assign({ color }, opts)); }
  function basic(color, opts = {}) { return new THREE.MeshBasicMaterial(Object.assign({ color }, opts)); }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(-20, 60, 30);
  scene.add(sun);

  // ---------- ground ----------
  const concourse = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), basic(0x77746c));
  concourse.rotation.x = -Math.PI / 2; concourse.position.y = -0.03; scene.add(concourse);

  const turfGeo = new THREE.PlaneGeometry(116, 80);
  const uv = turfGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 116 / 10.5 + 0.0, uv.getY(i) * 1);
  // offset so that stripe boundaries align with x = 0
  const turf = new THREE.Mesh(turfGeo, basic(0xffffff, { map: grassTex }));
  turf.rotation.x = -Math.PI / 2; turf.position.y = -0.01; scene.add(turf);
  grassTex.offset.set(1 - (58 % 10.5) / 10.5, 0);

  // ---------- pitch lines ----------
  const lineMat = basic(0xf4f4f0);
  const LW = 0.14;
  function lineSeg(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len + LW, LW), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(z2 - z1, x2 - x1);
    m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2);
    scene.add(m);
  }
  function arc(cx, cz, r, a0, a1) {
    const g = new THREE.RingGeometry(r - LW / 2, r + LW / 2, 96, 1, a0, a1 - a0);
    const m = new THREE.Mesh(g, lineMat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.012, cz); scene.add(m);
  }
  const HL = 52.5, HW = 34;
  lineSeg(-HL, -HW, HL, -HW); lineSeg(-HL, HW, HL, HW);
  lineSeg(-HL, -HW, -HL, HW); lineSeg(HL, -HW, HL, HW);
  lineSeg(0, -HW, 0, HW);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  const spot = (x, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.013, z); scene.add(m); };
  spot(0, 0);
  const aD = Math.acos(5.5 / 9.15);
  for (const s of [-1, 1]) {
    const gx = s * HL;
    // penalty area
    lineSeg(gx, -20.16, gx - s * 16.5, -20.16); lineSeg(gx, 20.16, gx - s * 16.5, 20.16); lineSeg(gx - s * 16.5, -20.16, gx - s * 16.5, 20.16);
    // goal area
    lineSeg(gx, -9.16, gx - s * 5.5, -9.16); lineSeg(gx, 9.16, gx - s * 5.5, 9.16); lineSeg(gx - s * 5.5, -9.16, gx - s * 5.5, 9.16);
    spot(gx - s * 11, 0);
    // D arc (outside the area); ring is in XY then rotated: local angle a -> world dir (cos a, -sin a)
    if (s < 0) arc(gx + 11, 0, 9.15, -aD, aD); else arc(gx - 11, 0, 9.15, Math.PI - aD, Math.PI + aD);
  }

  // ---------- goals ----------
  const postMat = lambert(0xffffff);
  const netMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * HL, 0, 0); scene.add(g);
    for (const pz of [-3.66, 3.66]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8), postMat); p.position.set(0, 1.22, pz); g.add(p);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 8), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(0, 2.44, 0); g.add(bar);
    const depth = 2.0;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.0), netMat); back.rotation.y = Math.PI / 2; back.position.set(s * depth, 1.0, 0); g.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(depth, 7.32), netMat); top.rotation.x = -Math.PI / 2; top.position.set(s * depth / 2, 2.2, 0); g.add(top);
    for (const pz of [-3.66, 3.66]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, 2.3), netMat); side.position.set(s * depth / 2, 1.15, pz); g.add(side);
    }
  }

  // ---------- advertising boards ----------
  const boardCols = [0xd6d4cc, 0xd6d4cc, 0xc8c6be, 0x2a2a2a, 0xc8b43a, 0xd6d4cc, 0x2f7a46, 0xd6d4cc];
  function boardRow(x1, z1, x2, z2, h, segLen) {
    const len = Math.hypot(x2 - x1, z2 - z1); const n = Math.max(1, Math.round(len / segLen));
    const ang = Math.atan2(z2 - z1, x2 - x1);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const col = boardCols[(i * 3 + Math.floor(rand() * 2)) % boardCols.length];
      const m = new THREE.Mesh(new THREE.BoxGeometry(len / n - 0.05, h, 0.25), basic(col));
      m.position.set(x1 + (x2 - x1) * f, h / 2, z1 + (z2 - z1) * f); m.rotation.y = -ang; scene.add(m);
    }
  }
  // far side: continuous white LED boards
  { const m = new THREE.Mesh(new THREE.BoxGeometry(112, 0.95, 0.3), basic(0xdcdad2)); m.position.set(0, 0.48, -39.2); scene.add(m); }
  boardRow(-56.5, -36, -56.5, 36, 0.95, 4.5);
  boardRow(56.5, -36, 56.5, 36, 0.95, 4.5);
  boardRow(-56, 38.6, 56, 38.6, 0.95, 6);
  // tilted boards lying on the turf by the left goal corners
  for (const pz of [-13.5, 13.5]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 4.0), lambert(0xf2f2f2)); m.position.set(-54.6, 0.4, pz); m.rotation.z = 0.6; scene.add(m);
  }

  // ---------- stands ----------
  function quad(p1, p2, p3, p4, mat, uScale, vScale) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([...p1, ...p2, ...p3, ...p1, ...p3, ...p4]);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
    const D = Math.hypot(p4[0] - p1[0], p4[1] - p1[1], p4[2] - p1[2]);
    const U = L / uScale, V = D / vScale;
    const uvs = new Float32Array([0, 0, U, 0, U, V, 0, 0, U, V, 0, V]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); scene.add(m); return m;
  }
  const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex, side: THREE.DoubleSide });
  const seatMat = new THREE.MeshBasicMaterial({ map: seatTex, side: THREE.DoubleSide });
  const fasciaMat = basic(0x8a8680, { side: THREE.DoubleSide });
  const darkMat = basic(0x34343a, { side: THREE.DoubleSide });
  // far side (z < 0)
  quad([-64, 0.9, -40.0], [64, 0.9, -40.0], [64, 17, -68], [-64, 17, -68], crowdMat, 8, 8);
  quad([-64, 17, -68], [64, 17, -68], [64, 21, -68.5], [-64, 21, -68.5], fasciaMat, 8, 8);
  quad([-80, 21, -69], [80, 21, -69], [80, 40, -95], [-80, 40, -95], crowdMat, 8, 8);
  quad([-80, 40, -95], [80, 40, -95], [80, 48, -96], [-80, 48, -96], darkMat, 8, 8);
  // near side (z > 0) - the camera rail is above the front of this stand
  quad([-64, 0.6, 40.5], [64, 0.6, 40.5], [64, 8, 53], [-64, 8, 53], crowdMat, 8, 8);
  quad([-64, 8, 53.2], [64, 8, 53.2], [64, 10.6, 53.2], [-64, 10.6, 53.2], fasciaMat, 8, 8);
  quad([-80, 10.6, 53.6], [80, 10.6, 53.6], [80, 32, 84], [-80, 32, 84], crowdMat, 8, 8);
  // right end (x > 0) - home supporters
  quad([60, 1.0, -44], [60, 1.0, 44], [86, 17, 44], [86, 17, -44], crowdMat, 8, 8);
  quad([86, 17, -44], [86, 17, 44], [86.5, 21, 44], [86.5, 21, -44], fasciaMat, 8, 8);
  quad([87, 21, -70], [87, 21, 70], [112, 40, 70], [112, 40, -70], crowdMat, 8, 8);
  // left end (x < 0) - empty grey lower tier, crowd upper tier
  quad([-62, 1.0, -44], [-62, 1.0, 44], [-87, 17, 44], [-87, 17, -44], seatMat, 6, 6);
  quad([-87, 17, -44], [-87, 17, 44], [-87.5, 21, 44], [-87.5, 21, -44], fasciaMat, 8, 8);
  quad([-88, 21, -70], [-88, 21, 70], [-112, 40, 70], [-112, 40, -70], crowdMat, 8, 8);
  // corner fills
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    quad([sx * 60, 1, sz * 44], [sx * 64, 1, sz * 41.5], [sx * 64, 16, sz * 66], [sx * 86, 17, sz * 44], crowdMat, 8, 8);
  }
  // roof ring
  { const m = new THREE.Mesh(new THREE.BoxGeometry(260, 3, 200), lambert(0x303034)); m.position.set(0, 52, 0); scene.add(m); }
  // big screens
  for (const [x, z] of [[-30, -90], [62, -60], [-62, 60]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.5), basic(0xb8d050)); m.position.set(x, 44, z); m.lookAt(0, 30, 0); scene.add(m);
  }

  // ---------- people ----------
  const SKIN = 0xc79a7a;
  function makePerson(shirt, shorts, socks, scale = 1) {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const mShirt = lambert(shirt), mShorts = lambert(shorts), mSocks = lambert(socks), mSkin = lambert(SKIN);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.24), mShirt); torso.position.y = 1.2; body.add(torso);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.24), mShorts); hips.position.y = 0.86; body.add(hips);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mSkin); head.position.y = 1.64; body.add(head);
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 0.11, 0.86, 0); body.add(hip);
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.44, 6), mShorts); thigh.position.y = -0.2; hip.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.44, 6), mSocks); shin.position.y = -0.62; hip.add(shin);
      legs.push(hip);
      const sh = new THREE.Group(); sh.position.set(s * 0.29, 1.45, 0); body.add(sh);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 6), mShirt); arm.position.y = -0.3; sh.add(arm);
      arms.push(sh);
    }
    root.scale.setScalar(scale * 0.87);
    scene.add(root);
    return { root, body, legs, arms };
  }

  // Track helpers: keys = [[t, x, z], ...]
  function buildTrack(keys) {
    const cum = [0];
    for (let i = 1; i < keys.length; i++) cum.push(cum[i - 1] + Math.hypot(keys[i][1] - keys[i - 1][1], keys[i][2] - keys[i - 1][2]));
    return { keys, cum };
  }
  function crPos(tr, t) {
    const k = tr.keys, n = k.length;
    if (n === 1) return [k[0][1], k[0][2]];
    if (t <= k[0][0]) {
      const v = [(k[1][1] - k[0][1]) / (k[1][0] - k[0][0]), (k[1][2] - k[0][2]) / (k[1][0] - k[0][0])];
      const dt = Math.max(t - k[0][0], -0.8) * 0.6;
      return [k[0][1] + v[0] * dt, k[0][2] + v[1] * dt];
    }
    if (t >= k[n - 1][0]) {
      const a = k[n - 2], b = k[n - 1];
      const v = [(b[1] - a[1]) / (b[0] - a[0]), (b[2] - a[2]) / (b[0] - a[0])];
      const T = 1.2; const dt = Math.min(t - b[0], T); const d = dt - dt * dt / (2 * T);
      return [b[1] + v[0] * d * 0.7, b[2] + v[1] * d * 0.7];
    }
    let i = 0; while (i < n - 2 && t > k[i + 1][0]) i++;
    const p0 = k[Math.max(i - 1, 0)], p1 = k[i], p2 = k[i + 1], p3 = k[Math.min(i + 2, n - 1)];
    const u = (t - p1[0]) / (p2[0] - p1[0]);
    const out = [];
    for (const c of [1, 2]) {
      const m1 = (p2[c] - p0[c]) / Math.max(p2[0] - p0[0], 1e-6) * (p2[0] - p1[0]);
      const m2 = (p3[c] - p1[c]) / Math.max(p3[0] - p1[0], 1e-6) * (p2[0] - p1[0]);
      const u2 = u * u, u3 = u2 * u;
      out.push((2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2);
    }
    return out;
  }
  function distAt(tr, t) {
    const k = tr.keys, n = k.length;
    if (n === 1) return 0;
    if (t <= k[0][0]) { const p = crPos(tr, t); return -Math.hypot(p[0] - k[0][1], p[1] - k[0][2]); }
    if (t >= k[n - 1][0]) { const p = crPos(tr, t); return tr.cum[n - 1] + Math.hypot(p[0] - k[n - 1][1], p[1] - k[n - 1][2]); }
    let i = 0; while (i < n - 2 && t > k[i + 1][0]) i++;
    const u = (t - k[i][0]) / (k[i + 1][0] - k[i][0]);
    return tr.cum[i] + (tr.cum[i + 1] - tr.cum[i]) * u;
  }

  const GREEN = [0x45a05a, 0xeeeeee, 0x3a9050];
  const BLUE = [0x1c2a5a, 0x111118, 0x111118];

  // Observed (back-projected) positions at sample times; between samples: spline interpolation.
  const P = [];
  function addP(name, kit, keys, opts = {}) {
    const person = makePerson(kit[0], kit[1], kit[2]);
    P.push(Object.assign({ name, person, tr: buildTrack(keys) }, opts));
  }
  // --- green / white home team (defending the left goal) ---
  addP('G0', GREEN, [[4.64, 28.1, -17.5], [5.4, 25.3, -14.4], [6.16, 22.7, -13.1], [6.96, 19.7, -10.8], [7.72, 16.7, -10.8], [8.48, 11.8, -9.2], [9.28, 6.8, -8.3], [10.04, 1.8, -8], [10.8, -4, -7.6], [11.6, -10.4, -6.5], [12.36, -15.7, -7.1], [13.12, -21.6, -5], [13.88, -26.8, -4.9], [14.68, -33.1, -4.3], [15.44, -39.6, -3.3], [16.2, -45.5, -3.4], [16.6, -49.3, -4.6], [17.0, -50.8, -5.0], [17.4, -52.0, -4.4], [17.76, -52.6, -4.2]], { slide: [16.3, 16.6, 30, 31] });
  addP('G1', GREEN, [[4.64, 31, 0.2], [5.4, 28, 2.2], [6.16, 25.5, 1.8], [6.96, 22.7, 0.8], [7.72, 20.4, -0.1], [8.48, 16.8, 0], [10.04, 11.9, -1.5], [10.8, 9, -2.7]]);
  addP('G2', GREEN, [[4.64, 28.5, 9.1], [5.4, 26.5, 7.1], [6.16, 23.4, 5], [7.72, 18.5, 7.1], [8.48, 14.4, 6.2], [9.28, 10.2, 5.5], [10.04, 6, 5.8], [10.8, 1.2, 5.5], [11.6, -4.1, 5.4], [12.36, -8, 4.6], [13.12, -12.4, 4.3]]);
  addP('G3', GREEN, [[4.64, 18.9, 12.6], [5.4, 18.7, 11.6], [6.16, 18.8, 9.4], [6.96, 19.5, 5.6], [7.72, 18.9, 4.5], [8.48, 17.1, 2.7], [9.28, 16.1, 1.8], [10.04, 15.7, 1.9], [10.8, 14.7, 1.9]]);
  addP('G4', GREEN, [[4.64, 36, 0.2], [5.4, 35, -0.3], [6.16, 34.2, -0.5], [6.96, 32.7, -1.3], [7.72, 31.8, -1.7], [8.48, 30.1, -2.2], [9.28, 28.2, -3.4]]);
  addP('G5', GREEN, [[4.64, 35.4, 9.2], [5.4, 34.5, 10.1], [6.16, 33.4, 10], [6.96, 31.7, 9.9], [7.72, 30.4, 9.9], [8.48, 28.1, 9.8], [9.28, 25.9, 9.9]]);
  addP('G6', GREEN, [[4.64, 33.3, 17.8], [5.4, 32.2, 15.9], [6.16, 31.1, 14.2], [6.96, 29.2, 12.6], [7.72, 27.5, 11.8], [8.48, 24.6, 11.2], [9.28, 22.2, 10.1], [10.04, 20.5, 9.8]]);
  addP('G7', GREEN, [[6.16, 20.7, 20.3], [6.96, 17.8, 20.5], [7.72, 15.4, 19.6], [8.48, 10.3, 19.1], [9.28, 6.2, 18.4], [10.04, 1.7, 18.8], [10.8, -2.9, 17.4], [11.6, -8.1, 15.9], [12.36, -12.2, 14.3], [13.12, -16.1, 13.2], [13.88, -19.9, 11.3]]);
  addP('G_no4', GREEN, [[3.88, 10.3, 10.5], [7.72, 5.8, 15.6], [8.48, 0.6, 15.2], [9.28, -4.1, 14.4], [10.04, -9.4, 13.5], [10.8, -14.7, 11.2], [11.6, -20.2, 9.1], [12.36, -25.1, 7.1], [13.12, -31.1, 7], [13.88, -36.1, 8], [14.68, -41.6, 9.8], [15.44, -44.2, 11.4], [16.2, -45.2, 12], [17.0, -46.1, 11.1], [17.76, -46.4, 10.6]]);
  addP('Gd2', GREEN, [[3.88, 0.5, 3.5], [8.48, -2, 1.1], [9.28, -4.3, 2.7], [10.04, -7.4, 3.3], [10.8, -10.7, 3.7], [11.6, -15.2, 5.8], [12.36, -19.1, 6.2], [13.12, -24.2, 5.6], [13.88, -29.4, 4.6], [14.68, -35.4, 3.1], [15.44, -40.5, 2.2], [16.2, -44.7, 1], [17.0, -48.2, 0.1], [17.76, -50.1, -0.1]]);
  // --- blue / black away team (counter-attacking toward the left goal) ---
  addP('B22', BLUE, [[4.64, 24.3, 0.9], [5.4, 22.5, 0.3], [6.16, 20.2, 1.1], [6.96, 17.1, 1.4], [7.72, 14.6, 3.7], [8.48, 10.1, 6], [9.28, 5, 6], [10.04, -0.4, 6], [10.8, -6.5, 6.6], [11.6, -12.8, 7.4], [12.36, -17.3, 7.2], [13.12, -21.1, 4.5], [13.88, -25.6, 1.4], [14.68, -32.4, 0.1], [15.44, -38.1, 2.1], [16.2, -42.5, 3.8], [17.0, -46.1, 2.4], [17.76, -48.7, 0.1]], { kick: [11.8], celebrate: 17.1 });
  addP('Bscorer', BLUE, [[4.64, 33.5, -1.7], [5.4, 31.8, -2.8], [6.16, 29, -3.2], [6.96, 26.3, -5], [7.72, 23.3, -6.3], [8.48, 18.1, -8], [9.28, 12.2, -9], [10.04, 6.5, -10.3], [10.8, -0.2, -11.3], [11.6, -6.9, -11.4], [12.36, -12.4, -12], [13.12, -18.8, -11], [13.88, -25, -10.5], [14.68, -32.4, -9.2], [15.44, -39.1, -8.3], [16.2, -46.2, -10.5], [17.0, -51.9, -10.9], [17.4, -54.2, -11.8], [17.76, -55.0, -12.2]], { kick: [16.38], celebrate: 16.9, climb: [17.3, 17.7, 0.8] });
  addP('B2', BLUE, [[4.64, 30.5, 4.3], [6.16, 26.9, 4.3], [6.96, 25.2, 5.3], [7.72, 24.7, 5.7], [8.48, 22.3, 6.1], [9.28, 20.1, 5.9], [10.04, 18.4, 6.2]]);
  addP('B3', BLUE, [[4.64, 29.1, 4.8], [5.4, 28.3, 4.1], [6.16, 28.4, 3], [6.96, 28, 1.8], [7.72, 27.2, 1.2], [8.48, 25.6, 0.5], [9.28, 23.8, 0.2], [10.04, 23.2, -1.1]]);
  addP('B4', BLUE, [[4.64, 26.7, 10.8], [5.4, 24.6, 10], [6.16, 22.4, 9.1], [6.96, 20, 7.3], [7.72, 17.6, 7.6], [8.48, 13.8, 7.8], [9.28, 10.2, 8.1], [10.04, 7.2, 8.1], [10.8, 4, 8.3], [11.6, 0.6, 8.1]]);
  addP('B11', BLUE, [[4.64, 24.1, 18.3], [5.4, 23, 18.3], [6.16, 21.6, 17.7], [6.96, 19.5, 16.7], [7.72, 17.6, 15.9], [8.48, 13.2, 15.8], [9.28, 9.2, 15.3], [10.04, 4.9, 14.3], [10.8, 0.1, 12.3], [11.6, -5.3, 10.6], [12.36, -9.6, 8.1], [13.12, -14.5, 6.4]]);
  addP('Bwing', BLUE, [[3.88, 9.5, 20.5], [6.96, 11.2, 19.1], [7.72, 9.8, 18.2], [8.48, 4.4, 18.6], [9.28, -1.4, 18.9], [10.04, -7.4, 19.4], [10.8, -13.1, 17.8], [11.6, -19.2, 15.9], [12.36, -25.1, 15.6], [13.12, -30.5, 13.1], [13.88, -35, 13.8], [14.68, -40, 14.2], [15.44, -43.5, 14.3], [16.2, -45.7, 16.2], [17.0, -46.5, 16.6], [17.76, -46.8, 16.4]], { kick: [15.15] });
  addP('B6', BLUE, [[4.64, 36, 1.1], [5.4, 35.9, 0.9], [6.16, 35.3, 0.5], [6.96, 33.7, -0.2], [7.72, 32.5, -1.2], [8.48, 30.7, -2], [10.04, 27.4, -4.8]]);
  addP('B7', BLUE, [[4.64, 36.3, 8], [5.4, 36, 7.8], [6.16, 35.6, 7.3], [6.96, 34.1, 7.3], [7.72, 33.1, 7.4], [8.48, 31.1, 7.4], [9.28, 29.1, 7.2]]);
  addP('B8', BLUE, [[4.64, 37.3, 15.2], [5.4, 36.4, 14.4], [6.16, 35.5, 14.1], [6.96, 33.2, 14.2], [7.72, 31.8, 14.1], [8.48, 29.1, 14.8], [9.28, 27.4, 14.5]]);
  // --- goalkeepers, referee, assistant ---
  addP('KB_red', [0xd8332b, 0xd8332b, 0xd8332b], [[4.64, 48.9, 0.4], [5.4, 48.8, 0], [6.16, 48.1, 0.5], [6.96, 47.9, -0.4], [7.72, 47.8, -0.8], [8.48, 48.1, -1.2], [10.0, 45.5, -1.0]]);
  addP('KG_orange', [0xf06a28, 0xf06a28, 0xf06a28], [[3.0, -38.2, -3.2], [4.0, -38.0, -3.0], [10.0, -40.5, -1.0], [10.8, -42.1, -0.4], [11.6, -43.2, 0.6], [12.36, -45, 1], [13.12, -47.1, 1.6], [13.88, -48.8, 2.5], [14.68, -50.4, 3.2], [15.44, -50.4, 3.9], [16.2, -50.2, 0.9], [16.5, -50.6, -1.2], [16.75, -51.2, -3.0], [17.0, -51.4, -3.4], [17.76, -51.7, -3.6]], { dive: [16.42, 16.72, 17.2, 17.6], kneel: [17.2, 17.6] });
  addP('Ref', [0xf2e23a, 0x111111, 0x111111], [[4.64, 26.5, -0.6], [5.4, 25.7, -1.7], [6.16, 24.6, -2.6], [6.96, 23.3, -3.5], [7.72, 22, -4.1], [8.48, 19.4, -4.4], [9.28, 14.4, -2.5], [10.04, 11.4, -5], [10.8, 6.4, -4.3], [11.6, 1, -4], [12.36, -3.2, -3.5], [13.12, -7.5, -4], [14.68, -13, -4.5], [17.76, -20, -4.5]]);
  addP('AR', [0xf2e23a, 0x111111, 0x111111], [[0, -6, -35.6], [9.0, -6, -35.6], [13.88, -33.7, -35.6], [14.68, -39.1, -35.6], [17.76, -45, -35.6]]);
  // substitutes warming up along the near touchline (seen in the opening shot), photographers, steward
  const extras = [];
  function addExtra(col, x, z, faceX, sit) {
    const p = makePerson(col, 0x222222, 0x222222); p.root.position.set(x, 0, z); p.root.rotation.y = Math.atan2(faceX[0], faceX[1]);
    if (sit) { p.legs.forEach(l => (l.rotation.x = -1.4)); p.body.position.y = -0.45; }
    extras.push({ p, x, z, sit });
  }
  addExtra(0xc0302a, 25.0, 36.6, [-1, 0], false);
  addExtra(0xc0302a, 26.2, 36.3, [-1, 0], false);
  addExtra(0xc0302a, 27.3, 36.9, [-1, -0.2], false);
  addExtra(0xf07a20, -57.3, 5.0, [1, 0], true);
  addExtra(0xf07a20, -57.3, -8.0, [1, 0], true);
  addExtra(0xe6e030, -59.5, 13.6, [1, 0], false);
  addExtra(0xe6e030, 45, 37.8, [0, -1], false);
  addExtra(0xe6e030, 58.5, -10, [-1, 0], false);

  // ---------- ball ----------
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), basic(0xffffff));
  scene.add(ball);
  // [t, x, z, h]
  const ballKeys = [
    [0, 31.5, -4.0, 0.11], [2.0, 33.0, -5.0, 0.11], [3.6, 34.2, -6.2, 0.11], [3.88, 34.0, -6.0, 0.6], [4.2, 33.4, -4.6, 2.2], [4.64, 31.8, -2.6, 3.0],
    [5.0, 29.8, 0.4, 3.0], [5.4, 27.6, 3.4, 2.1], [5.8, 25.0, 4.0, 0.7], [6.16, 22.8, 4.2, 0.11], [6.96, 18.0, 4.6, 0.11], [7.72, 14.2, 4.2, 0.11],
    [8.48, 9.4, 5.2, 0.11], [9.28, 4.3, 5.9, 0.11], [10.04, -1.3, 6.5, 0.11], [10.8, -7.1, 7.1, 0.11], [11.6, -13.6, 7.8, 0.11], [11.8, -14.6, 7.9, 0.11],
    [12.36, -22.2, 10.6, 0.11], [12.85, -28.6, 12.4, 0.11], [13.12, -30.7, 12.0, 0.11], [13.88, -35.4, 13.5, 0.11], [14.68, -40.9, 13.7, 0.11], [15.15, -43.6, 14.0, 0.11]
  ];
  // lofted cross 15.15 -> 16.2 (analytical parabola)
  for (let i = 1; i <= 6; i++) {
    const s = i / 7; const t = 15.15 + s * (16.2 - 15.15);
    ballKeys.push([t, -43.6 + s * (-47.3 + 43.6), 14.0 + s * (-4.6 - 14.0), 0.11 + 4 * 3.4 * s * (1 - s) + s * 0.9]);
  }
  ballKeys.push([16.2, -47.3, -4.6, 1.0], [16.38, -48.6, -4.3, 0.45], [16.7, -52.6, -2.6, 0.35], [17.0, -54.1, -1.0, 0.2], [17.35, -54.3, 1.2, 0.11], [17.76, -54.0, 3.0, 0.11]);
  function ballAt(t) {
    const k = ballKeys; if (t <= k[0][0]) return k[0].slice(1);
    if (t >= k[k.length - 1][0]) return k[k.length - 1].slice(1);
    let i = 0; while (i < k.length - 2 && t > k[i + 1][0]) i++;
    const u = (t - k[i][0]) / (k[i + 1][0] - k[i][0]);
    return [1, 2, 3].map(c => k[i][c] + (k[i + 1][c] - k[i][c]) * u);
  }

  // ---------- camera path ----------
  // Rail camera at height 16.3 m, 42.5 m from the pitch centre line (z), moving along x.
  const CAM_Y = 16.3, CAM_Z = 42.5, CUT = 4.26;
  // shot A (wide, 61 deg vfov): x = 52.02 - 4.66 t
  const camA = [[0, 115.04, -26.81], [1.56, 83.04, -27.08], [2.32, 66.55, -27.38], [3.08, 51.68, -27.17], [3.88, 39.32, -26.86]];
  // shot B: [t, x, yaw, pitch, vfov]
  const camB = [[4.64, 18.35, -21.2, -20.57, 26.04], [5.4, 15.88, -22.65, -20.92, 26.42], [6.16, 13.42, -23.2, -21.29, 27.46], [6.96, 10.46, -22.09, -22.15, 29.51],
    [7.72, 8.71, -19.87, -23.39, 32.57], [8.48, 4.83, -14.81, -24.67, 36.58], [9.28, 2.73, -5.11, -25.04, 40.74], [10.04, 0.23, 4.87, -25.22, 44.91],
    [10.8, -2.48, 15.19, -25.16, 44.62], [11.6, -6.58, 23.35, -25.39, 42.89], [12.36, -11.11, 25.68, -25.06, 41.22], [13.12, -16.29, 26.53, -24.05, 36.83],
    [13.88, -21.9, 26.77, -23.63, 32.49], [14.68, -28.13, 24.99, -23.51, 28.48], [15.44, -33.82, 19.15, -23.48, 25.08], [16.2, -38.97, 12.96, -23.06, 21.64],
    [17.0, -44.1, 7.92, -19.97, 17.5], [17.76, -49.45, 0.96, -17.81, 12.63]];
  function interpKeys(keys, t, nc) {
    const n = keys.length;
    if (t <= keys[0][0]) {
      const a = keys[0], b = keys[1]; const u = (t - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, c) => v + (b[c + 1] - v) * u);
    }
    if (t >= keys[n - 1][0]) {
      const a = keys[n - 2], b = keys[n - 1]; const u = (t - b[0]) / (b[0] - a[0]);
      return b.slice(1).map((v, c) => v + (v - a[c + 1]) * u);
    }
    let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(i - 1, 0)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(i + 2, n - 1)];
    const u = (t - p1[0]) / (p2[0] - p1[0]); const u2 = u * u, u3 = u2 * u; const h = p2[0] - p1[0];
    const out = [];
    for (let c = 1; c <= nc; c++) {
      const m1 = (p2[c] - p0[c]) / Math.max(p2[0] - p0[0], 1e-6) * h;
      const m2 = (p3[c] - p1[c]) / Math.max(p3[0] - p1[0], 1e-6) * h;
      out.push((2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2);
    }
    return out;
  }
  const D2R = Math.PI / 180;
  function setCamera(t) {
    let x, yaw, pitch, fov;
    if (t < CUT) {
      x = 52.02 - 4.66 * t; const r = interpKeys(camA, t, 2); yaw = r[0]; pitch = r[1]; fov = 61;
    } else {
      const r = interpKeys(camB, t, 4); x = r[0]; yaw = r[1]; pitch = r[2]; fov = r[3];
    }
    camera.position.set(x, CAM_Y, CAM_Z);
    camera.rotation.set(pitch * D2R, yaw * D2R, 0, 'YXZ');
    if (camera.fov !== fov) { camera.fov = fov; }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const smooth = (a, b, x) => { const u = Math.min(Math.max((x - a) / (b - a), 0), 1); return u * u * (3 - 2 * u); };

  function poseAt(entry, t) {
    const { person, tr } = entry;
    const p = crPos(tr, t);
    const pa = crPos(tr, t - 0.15), pb = crPos(tr, t + 0.15);
    const vx = (pb[0] - pa[0]) / 0.3, vz = (pb[1] - pa[1]) / 0.3;
    const speed = Math.hypot(vx, vz);
    let heading;
    if (speed > 0.6) heading = Math.atan2(vx, vz);
    else { const b = ballAt(t); heading = Math.atan2(b[0] - p[0], b[1] - p[1]); }
    person.root.position.set(p[0], 0, p[1]);
    person.root.rotation.set(0, heading, 0);
    const dist = distAt(tr, t);
    const phase = dist / 2.4 * Math.PI * 2;
    const amp = Math.min(speed / 6, 1) * 0.75 + (speed > 0.3 ? 0.08 : 0);
    let lL = amp * Math.sin(phase), lR = -amp * Math.sin(phase);
    let aL = -0.8 * amp * Math.sin(phase), aR = 0.8 * amp * Math.sin(phase);
    let lean = 0.22 * Math.min(speed / 7, 1);
    let tiltZ = 0, lift = 0;
    // kicks: right leg swings through
    if (entry.kick) for (const tk of entry.kick) {
      const d = t - tk;
      if (d > -0.25 && d < 0.3) lR = d < 0 ? 0.9 * ((d + 0.25) / 0.25) : -1.2 * (1 - d / 0.3);
    }
    if (entry.celebrate && t > entry.celebrate) {
      const c = smooth(entry.celebrate, entry.celebrate + 0.4, t);
      aL = aL * (1 - c) - 2.6 * c; aR = aR * (1 - c) - 2.6 * c;
    }
    if (entry.dive) {
      const [d0, d1, d2, d3] = entry.dive;
      const k = smooth(d0, d1, t) * (1 - smooth(d2, d3, t));
      tiltZ = -1.45 * k; lift = 0.12 * k;
      aL = aL * (1 - k) - 2.8 * k; aR = aR * (1 - k) - 2.8 * k; lean = lean * (1 - k);
      // keeper faces the pitch (+x) while diving toward -z
      person.root.rotation.y = Math.PI / 2 * smooth(d0 - 0.3, d0, t) + heading * (1 - smooth(d0 - 0.3, d0, t));
    }
    if (entry.kneel) {
      const kk = smooth(entry.kneel[0], entry.kneel[1], t);
      lL = lL * (1 - kk) - 1.5 * kk; lR = lR * (1 - kk) + 0.2 * kk; lean = lean * (1 - kk) + 0.6 * kk; lift -= 0.42 * kk;
      aL = aL * (1 - kk) - 0.6 * kk; aR = aR * (1 - kk) - 0.6 * kk;
    }
    if (entry.slide) {
      const [s0, s1, s2, s3] = entry.slide;
      const k = smooth(s0, s1, t) * (1 - smooth(s2, s3, t) * 0.6);
      lean = lean * (1 - k) - 1.25 * k; lift = 0.1 * k;
      lL = lL * (1 - k) - 1.3 * k; lR = lR * (1 - k) - 1.0 * k;
    }
    if (entry.climb) {
      const [c0, c1, h] = entry.climb; lift += h * smooth(c0, c1, t);
    }
    person.body.rotation.set(lean, 0, tiltZ);
    person.body.position.y = lift;
    person.legs[0].rotation.set(lL, 0, 0); person.legs[1].rotation.set(lR, 0, 0);
    person.arms[0].rotation.set(aL, 0, entry.dive ? 0 : -0.12); person.arms[1].rotation.set(aR, 0, entry.dive ? 0 : 0.12);
  }

  function update(time, frame) {
    const t = Math.min(Math.max(time, 0), duration);
    setCamera(t);
    for (const e of P) poseAt(e, t);
    // warm-up subs jog in place / side steps (only seen in the opening shot)
    extras.forEach((e, i) => {
      if (e.sit) return;
      const ph = t * 5.5 + i * 1.7;
      if (i < 3) {
        e.p.root.position.set(e.x + 0.6 * Math.sin(t * 0.9 + i), 0, e.z);
        e.p.legs[0].rotation.x = 0.4 * Math.sin(ph); e.p.legs[1].rotation.x = -0.4 * Math.sin(ph);
        e.p.arms[0].rotation.x = -0.3 * Math.sin(ph); e.p.arms[1].rotation.x = 0.3 * Math.sin(ph);
      }
    });
    const b = ballAt(t);
    ball.position.set(b[0], b[2] + 0.05, b[1]);
  }

  update(0, 0);
  return { scene, camera, update };
}
