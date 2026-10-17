// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video5.
// Two astronauts at an orbiting telescope above a shuttle payload bay, Earth overhead.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const aspect = width / height;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(36, aspect, 0.03, 9000);

  // ---------- deterministic RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(((seed | 0) ^ 0x5bd1e995) >>> 0);

  // seamless value noise
  function makeNoise(px, py) {
    const g = new Float32Array(px * py);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const x0 = ((xi % px) + px) % px, y0 = ((yi % py) + py) % py;
      const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
      const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  }
  function makeFbm(bx, by, oct) {
    const ns = [];
    for (let o = 0; o < oct; o++) ns.push(makeNoise(bx << o, by << o));
    return function (u, v) {
      let s = 0, amp = 0.5, tot = 0;
      for (let o = 0; o < oct; o++) {
        s += amp * ns[o](u * (bx << o), v * (by << o));
        tot += amp; amp *= 0.5;
      }
      return s / tot;
    };
  }
  function makeTex(w, h, fn, rx, ry) {
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = fn(x / w, y / h, x, y);
        const i = (y * w + x) * 4;
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.repeat.set(rx || 1, ry || 1);
    tex.needsUpdate = true;
    return tex;
  }
  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- procedural textures ----------
  const cloudN = makeFbm(6, 3, 5);
  const oceanN = makeFbm(3, 2, 3);
  const earthTex = makeTex(512, 256, (u, v) => {
    const c = sstep(0.47, 0.66, cloudN(u, v));
    const o = oceanN(u, v);
    const r = 40 + 30 * o, g = 105 + 35 * o, b = 175 + 30 * o;
    return [clamp255(r + (238 - r) * c), clamp255(g + (242 - g) * c), clamp255(b + (248 - b) * c)];
  }, 3, 2);
  const foilN = makeFbm(8, 8, 4);
  const goldTex = makeTex(128, 128, (u, v) => {
    const n = foilN(u, v);
    const k = 0.55 + 0.9 * n;
    return [clamp255(190 * k), clamp255(150 * k), clamp255(70 * k)];
  }, 1, 1);
  const slatTex = makeTex(64, 64, (u, v) => {
    const s = (Math.floor(v * 8) % 2 === 0) ? 1 : 0;
    const e = (u < 0.08 || u > 0.92) ? 1 : 0;
    const k = s || e ? 150 : 45;
    return [k, k + 4, k + 10];
  }, 1, 1);
  const gridTex = makeTex(64, 64, (u, v) => {
    const line = (u * 8) % 1 < 0.08 || (v * 4) % 1 < 0.08;
    return line ? [190, 170, 120] : [150, 162, 180];
  }, 1, 1);
  const radTex = makeTex(64, 64, (u, v) => {
    const line = (u * 6) % 1 < 0.06;
    return line ? [110, 112, 116] : [150, 154, 160];
  }, 4, 1);

  // ---------- materials ----------
  const M = (color, opts = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.0 }, opts));
  const suitMat = M(0xe4e4e0, { roughness: 0.85 });
  const suitGrey = M(0xb2b3b2, { roughness: 0.8 });
  const packMat = M(0xd6d6d2, { roughness: 0.75 });
  const mmuMat = M(0xc6c7c6, { roughness: 0.6 });
  const visorMat = M(0x6b5a4e, { roughness: 0.3, metalness: 0.1 });
  const redMat = M(0x8a2424, { roughness: 0.8 });
  const goldMat = M(0xffffff, { map: goldTex, roughness: 0.45, metalness: 0.25, emissive: 0x2a1c06 });
  const hubDark = M(0x5b6676, { roughness: 0.5, metalness: 0.2 });
  const hubLight = M(0x969da6, { roughness: 0.45, metalness: 0.2 });
  const bulkMat = M(0x9aa1a8, { roughness: 0.5, metalness: 0.2 });
  const copperMat = M(0xc27b3a, { roughness: 0.4, metalness: 0.3 });
  const slatMat = M(0xffffff, { map: slatTex, roughness: 0.6 });
  const boxMat = M(0x8a8e94, { roughness: 0.6 });
  const solarMat = M(0xffffff, { map: gridTex, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide });
  const shuttleWhite = M(0xdcdcd8, { roughness: 0.8 });
  const bayGrey = M(0x45494f, { roughness: 0.8 });
  const doorMat = M(0xffffff, { map: radTex, roughness: 0.7 });

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  scene.add(new THREE.HemisphereLight(0xa8c4e8, 0x202428, 0.8));
  const fill = new THREE.DirectionalLight(0xdfe8f4, 1.1);
  fill.position.set(-5, -10, 3);
  scene.add(fill);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(9, 5, 8);
  scene.add(sun);
  scene.add(sun.target);

  // ---------- Earth (overhead, +Y) ----------
  const earthGroup = new THREE.Group();
  earthGroup.position.set(0, 2176, 0);
  earthGroup.rotation.z = Math.PI / 2;
  scene.add(earthGroup);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2000, 384, 192), new THREE.MeshBasicMaterial({ map: earthTex }));
  earthGroup.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(2028, 192, 96),
    new THREE.MeshBasicMaterial({ color: 0x5f9cff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  earthGroup.add(atmo);

  // stars
  {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const z = rand() * 2 - 1, th = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
      pos[i * 3] = 6000 * r * Math.cos(th); pos[i * 3 + 1] = 6000 * z; pos[i * 3 + 2] = 6000 * r * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false })));
  }

  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || scene).add(m); return m; };

  // ---------- Telescope (axis +Y, aft bulkhead at y=2) ----------
  const hubble = new THREE.Group();
  scene.add(hubble);
  add(new THREE.CylinderGeometry(2.1, 2.1, 5, 48), hubDark, 0, 4.5, 0, hubble);
  add(new THREE.CylinderGeometry(2.1, 2.1, 8, 48), hubLight, 0, 11, 0, hubble);
  add(new THREE.CylinderGeometry(2.08, 2.08, 0.12, 48), bulkMat, 0, 1.94, 0, hubble);
  { const r = add(new THREE.TorusGeometry(2.15, 0.05, 8, 64), copperMat, 0, 2.3, 0, hubble); r.rotation.x = Math.PI / 2; }
  { const r = add(new THREE.TorusGeometry(2.14, 0.04, 8, 64), copperMat, 0, 7.0, 0, hubble); r.rotation.x = Math.PI / 2; }
  for (const a of [0.5, -1.0, 2.2]) {
    add(new THREE.BoxGeometry(0.06, 4.4, 0.06), copperMat, 2.2 * Math.cos(a), 4.6, 2.2 * Math.sin(a), hubble);
  }
  // open slatted instrument bay on the hull, used in the opening shot
  add(new THREE.BoxGeometry(0.1, 3.0, 0.9), slatMat, 2.14, 9.0, -0.05, hubble);
  { const door = add(new THREE.BoxGeometry(0.04, 3.0, 0.9), hubLight, 2.41, 9.0, -0.86, hubble); door.rotation.y = 2.5; }
  // instrument box handled by astronaut A
  { const bx = add(new THREE.BoxGeometry(0.35, 0.22, 0.4), boxMat, 2.69, 5.79, 1.45, hubble); bx.rotation.y = 0.3; }
  // solar arrays (12 m long wings)
  for (const s of [1, -1]) {
    add(new THREE.BoxGeometry(0.04, 2.5, 12.0), solarMat, 0, 4.6, s * 8.3, hubble);
    const mast = add(new THREE.CylinderGeometry(0.06, 0.06, 2.4), copperMat, 0, 4.6, s * 2.2, hubble);
    mast.rotation.x = Math.PI / 2;
  }

  // gold-foil cradle beneath the telescope
  add(new THREE.BoxGeometry(4.2, 2.6, 4.4), goldMat, 0, -1.0, 0);
  for (const sx of [1, -1]) for (const sz of [1, -1]) add(new THREE.BoxGeometry(0.8, 1.6, 0.8), goldMat, sx * 1.75, 0.1, sz * 1.75);
  // gold-foil equipment tower beside the cradle (work site in the later shots)
  add(new THREE.BoxGeometry(1.8, 4.2, 1.8), goldMat, 3.4, 0.6, 6.5);
  add(new THREE.BoxGeometry(1.2, 1.0, 1.4), goldMat, 3.3, 3.2, 6.7);
  add(new THREE.BoxGeometry(1.4, 0.9, 1.0), goldMat, 2.2, 2.0, 6.2);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.6), bulkMat, 4.38, 0.5, 5.9);

  // ---------- Shuttle payload bay (axis X, open toward +Y) ----------
  add(new THREE.BoxGeometry(21.6, 0.3, 4.8), bayGrey, -8.2, -2.35, 0);
  for (const s of [1, -1]) add(new THREE.BoxGeometry(21.6, 2.5, 0.2), bayGrey, -8.2, -0.95, s * 2.5);
  add(new THREE.BoxGeometry(0.3, 2.5, 5.2), shuttleWhite, 2.75, -0.95, 0);
  add(new THREE.BoxGeometry(0.3, 2.5, 5.2), shuttleWhite, -19.1, -0.95, 0);
  for (const s of [1, -1]) add(new THREE.BoxGeometry(21.6, 0.08, 4.6), doorMat, -8.2, 0.34, s * 4.9);
  add(new THREE.BoxGeometry(25, 2.0, 5.2), shuttleWhite, -9.5, -3.5, 0);
  for (const s of [1, -1]) add(new THREE.BoxGeometry(10, 0.3, 7), shuttleWhite, -6, -4.2, s * 6.0);
  for (const x of [-5.2, -9.6, -14]) add(new THREE.BoxGeometry(3.0, 1.8, 3.6), goldMat, x, -1.3, 0);
  { const arm = add(new THREE.CylinderGeometry(0.17, 0.17, 13), shuttleWhite, -10.5, 0.6, 2.6); arm.rotation.z = Math.PI / 2; }

  // ---------- Astronaut proxy ----------
  function makeAstronaut(withMMU) {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    add(new THREE.BoxGeometry(0.62, 0.72, 0.42), suitMat, 0, 0, 0, body);
    add(new THREE.BoxGeometry(0.5, 0.26, 0.38), suitMat, 0, -0.46, 0, body);
    add(new THREE.BoxGeometry(0.4, 0.2, 0.12), suitGrey, 0, -0.08, 0.25, body);
    add(new THREE.BoxGeometry(0.62, 0.78, 0.28), packMat, 0, 0.05, -0.36, body);
    if (withMMU) {
      add(new THREE.BoxGeometry(0.9, 0.95, 0.3), mmuMat, 0, 0.0, -0.64, body);
      for (const s of [1, -1]) add(new THREE.BoxGeometry(0.1, 0.1, 0.6), mmuMat, s * 0.5, -0.32, -0.32, body);
    }
    add(new THREE.SphereGeometry(0.24, 24, 16), suitMat, 0, 0.5, 0.02, body);
    const vis = add(new THREE.SphereGeometry(0.175, 24, 16), visorMat, 0, 0.49, 0.135, body);
    vis.scale.set(1, 0.95, 0.9);
    const joints = {};
    function arm(side) {
      const sh = new THREE.Group(); sh.position.set(side * 0.4, 0.25, 0); body.add(sh);
      add(new THREE.CylinderGeometry(0.105, 0.1, 0.34, 12), suitMat, 0, -0.17, 0, sh);
      const el = new THREE.Group(); el.position.set(0, -0.34, 0); sh.add(el);
      add(new THREE.CylinderGeometry(0.095, 0.085, 0.3, 12), suitMat, 0, -0.15, 0, el);
      add(new THREE.BoxGeometry(0.13, 0.16, 0.11), suitGrey, 0, -0.37, 0, el);
      return { sh, el };
    }
    function leg(side) {
      const hp = new THREE.Group(); hp.position.set(side * 0.15, -0.56, 0); body.add(hp);
      add(new THREE.CylinderGeometry(0.13, 0.12, 0.44, 12), suitMat, 0, -0.22, 0, hp);
      if (withMMU) add(new THREE.CylinderGeometry(0.133, 0.133, 0.04, 12), redMat, 0, -0.12, 0, hp);
      const kn = new THREE.Group(); kn.position.set(0, -0.44, 0); hp.add(kn);
      add(new THREE.CylinderGeometry(0.115, 0.1, 0.42, 12), suitMat, 0, -0.21, 0, kn);
      add(new THREE.BoxGeometry(0.17, 0.14, 0.3), suitGrey, 0, -0.46, 0.05, kn);
      return { hp, kn };
    }
    joints.la = arm(1); joints.ra = arm(-1); joints.ll = leg(1); joints.rl = leg(-1);
    scene.add(root);
    return { root, joints };
  }
  const astroA = makeAstronaut(false);
  const astroB = makeAstronaut(true);

  function applyPose(a, p) {
    const j = a.joints;
    j.la.sh.rotation.set(p[0], 0, p[1]); j.la.el.rotation.set(p[2], 0, 0);
    j.ra.sh.rotation.set(p[3], 0, -p[4]); j.ra.el.rotation.set(p[5], 0, 0);
    j.ll.hp.rotation.set(p[6], 0, p[7]); j.ll.kn.rotation.set(p[8], 0, 0);
    j.rl.hp.rotation.set(p[9], 0, -p[10]); j.rl.kn.rotation.set(p[11], 0, 0);
  }
  const _y = new THREE.Vector3(), _z = new THREE.Vector3(), _x = new THREE.Vector3(), _m = new THREE.Matrix4(), _o = new THREE.Vector3();
  function placeAstronaut(a, h, up, fwd) {
    _y.set(up[0], up[1], up[2]).normalize();
    _z.set(fwd[0], fwd[1], fwd[2]);
    _z.addScaledVector(_y, -_z.dot(_y));
    if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
    _z.normalize();
    _x.crossVectors(_y, _z).normalize();
    _m.makeBasis(_x, _y, _z);
    a.root.quaternion.setFromRotationMatrix(_m);
    _o.set(0, 0.5, 0.02).applyQuaternion(a.root.quaternion);
    a.root.position.set(h[0] - _o.x, h[1] - _o.y, h[2] - _o.z);
  }

  // ---------- poses: [lsx,lsz,le, rsx,rsz,re, lhx,lhz,lk, rhx,rhz,rk] ----------
  const P_relax = [-0.3, 0.25, -0.5, -0.3, 0.25, -0.5, -0.2, 0.1, 0.4, -0.3, 0.1, 0.5];
  const P_workA = [-1.8, 0.2, -0.6, -1.6, 0.1, -0.8, -0.3, 0.1, 0.5, -0.2, 0.15, 0.4];
  const P_workB = [-1.5, 0.2, -0.6, -1.7, 0.1, -0.5, -0.3, 0.1, 0.5, -0.2, 0.15, 0.4];
  const P_tumble = [-1.2, 0.5, -0.5, -1.7, 0.3, -0.3, -0.4, 0.2, 0.6, -0.1, 0.2, 0.3];
  const P_close = [-1.0, 0.4, -1.2, -0.4, 0.3, -0.5, -0.3, 0.1, 0.5, -0.2, 0.1, 0.4];
  const P_dive = [-2.7, 0.2, -0.2, -2.5, 0.15, -0.3, 0.1, 0.08, 0.3, 0.05, 0.08, 0.4];
  const P_diveReach = [-2.0, 0.2, -0.3, -1.4, 0.2, -0.4, 0.1, 0.08, 0.3, 0.05, 0.08, 0.4];
  const P_fly = [-0.6, 0.2, -0.3, -1.5, 0.2, -0.3, 0.1, 0.1, 0.3, 0.0, 0.1, 0.4];
  const P_hold12 = [-2.6, 0.2, -0.4, -0.3, 1.4, -0.2, -0.3, 0.1, 0.5, -0.1, 0.1, 0.3];
  const P_bothUp = [-2.4, 0.3, -0.7, -2.5, 0.2, -0.8, -0.4, 0.1, 0.6, -0.3, 0.1, 0.5];
  const P_reachL = [-0.5, 1.3, -0.2, -0.4, 0.3, -0.7, -0.4, 0.15, 0.6, -0.2, 0.1, 0.4];
  const P_hold15 = [-0.9, 0.5, -0.3, -0.5, 0.4, -0.6, -0.5, 0.15, 0.7, -0.3, 0.1, 0.5];
  const P_hold16 = [-0.8, 0.6, -0.2, -0.6, 0.5, -0.5, -0.2, 0.2, 0.3, 0.1, 0.15, 0.4];
  const P_reachDown = [-1.2, 0.3, -0.3, -1.0, 0.2, -0.5, -0.4, 0.1, 0.6, -0.3, 0.1, 0.5];
  const P_reachUp = [-2.8, 0.2, -0.3, -2.6, 0.2, -0.4, -0.1, 0.1, 0.3, 0.1, 0.1, 0.2];
  const P_rim = [-0.6, 0.4, -0.6, -1.6, 0.4, -0.5, -0.4, 0.2, 0.6, 0.1, 0.1, 0.3];

  // ---------- shot / key data ----------
  // cam: [ndcX, ndcY, dist, yawDeg, pitchDeg, rollDeg, fovDeg]; subj: 'Bhead' | 'Broot' | [x,y,z]
  const K = (t, B, cam, A) => ({ t, B, cam, A });
  const Bs = (h, up, fwd, pose) => ({ h, up, fwd, pose });
  const shots = [
    { start: 0, end: 3.65, subj: [3.07, 6.07, 0.73], showA: true, keys: [
      K(0.0, Bs([2.99, 6.12, 0.35], [-0.1, 0, 1], [0.25, -0.97, 0], P_workB), [0.057, 0.28, 1.48, 90, 75.5, 0, 38],
        Bs([3.16, 6.01, 1.11], [-0.2, -0.05, -1], [0.25, -0.97, 0], P_workA)),
      K(1.043, Bs([3.0, 6.13, 0.37], [-0.1, 0, 1], [0.25, -0.97, 0], P_workB), [0.03, 0.25, 1.6, 90, 75.5, -1, 38],
        Bs([3.16, 6.0, 1.1], [-0.2, -0.05, -1], [0.25, -0.97, 0], P_workA)),
      K(2.085, Bs([3.01, 6.14, 0.4], [-0.1, 0, 1], [0.25, -0.97, 0], P_workB), [-0.03, 0.22, 1.8, 90, 75, -3, 38],
        Bs([3.16, 6.0, 1.09], [-0.2, -0.05, -1], [0.25, -0.97, 0], P_workA)),
      K(3.128, Bs([3.02, 6.15, 0.42], [-0.1, 0, 1], [0.25, -0.97, 0], P_workB), [-0.09, 0.17, 2.05, 90, 74.5, -5, 38],
        Bs([3.16, 6.0, 1.08], [-0.2, -0.05, -1], [0.25, -0.97, 0], P_workA)),
    ] },
    { start: 3.65, end: 5.73, subj: 'Bhead', keys: [
      K(4.171, Bs([3.5, 9.0, 0.8], [0.8, 0.2, 0.4], [0, -0.9, 0.42], P_tumble), [0.45, 0.15, 1.5, 0, 65, 15, 40]),
      K(5.214, Bs([3.6, 9.2, 0.9], [0.8, -0.6, 0], [0, 0, -1], P_tumble), [0.5, 0.1, 1.7, 180, -6, -143, 40]),
    ] },
    { start: 5.73, end: 6.78, subj: 'Broot', keys: [
      K(5.73, Bs([3.6, 9.4, 1.0], [0.2, 0.9, 0.4], [-0.81, 0.34, -0.47], P_close), [-0.5, 0.2, 1.6, -120, -20, 30, 40]),
      K(6.78, Bs([3.65, 9.45, 1.05], [0.2, 0.9, 0.4], [-0.81, 0.34, -0.47], P_close), [-0.5, 0.2, 1.65, -120, -20, 36, 40]),
    ] },
    { start: 6.78, end: 10.95, subj: 'Broot', keys: [
      K(7.299, Bs([-6.4, 7.6, 5.0], [0.2, -1, 0.2], [1, 0.2, 0], P_dive), [-0.55, 0.35, 2.0, 90, -80, 0, 40]),
      K(8.342, Bs([-5.4, 6.6, 4.5], [0.2, -1, 0], [1, 0.2, 0], P_dive), [-0.3, 0.1, 4.0, 90, -82, 0, 40]),
      K(9.384, Bs([-4.5, 5.6, 3.5], [0.35, -0.95, -0.1], [0.95, 0.35, 0], P_dive), [-0.15, 0.1, 3.4, 90, -78, -28, 40]),
      K(10.427, Bs([-3.4, 4.0, 2.4], [0.6, -0.8, 0], [0.8, 0.6, 0], P_diveReach), [0.05, 0.3, 3.2, 30, -45, 0, 40]),
    ] },
    { start: 10.95, end: 12.0, subj: [-4.1, 2.7, 2.2], keys: [
      K(10.95, Bs([-4.0, 2.6, 2.2], [1, -0.25, 0], [-0.25, -1, 0], P_fly), [-0.25, 0.3, 2.9, 0, -14, 0, 38]),
      K(11.47, Bs([-3.6, 2.6, 2.2], [1, -0.25, 0], [-0.25, -1, 0], P_fly), [-0.25, 0.3, 2.9, 0, -14, 0, 38]),
      K(12.0, Bs([-3.2, 2.6, 2.2], [1, -0.25, 0], [-0.25, -1, 0], P_fly), [-0.25, 0.3, 2.9, 0, -14, 0, 38]),
    ] },
    { start: 12.0, end: 13.03, subj: 'Bhead', keys: [
      K(12.0, Bs([4.95, 1.4, 5.25], [-0.25, 1, 0], [-0.7, 0, 0.7], P_hold12), [-0.2, 0.3, 2.6, 180, 3, -8, 35]),
      K(12.51, Bs([4.9, 1.4, 5.20], [-0.25, 1, 0], [-0.7, 0, 0.7], P_hold12), [-0.2, 0.3, 2.6, 180, 3, -8, 35]),
      K(13.03, Bs([4.85, 1.42, 5.15], [-0.25, 1, 0], [-0.7, 0, 0.7], P_hold12), [-0.2, 0.3, 2.6, 180, 3, -8, 35]),
    ] },
    { start: 13.03, end: 18.25, subj: 'Bhead', keys: [
      K(13.556, Bs([4.8, 1.0, 5.00], [0, 1, 0], [0.7, 0, -0.7], P_bothUp), [-0.42, 0.0, 2.2, 180, 0, 0, 35]),
      K(14.598, Bs([5.0, 1.6, 5.00], [0.6, 0.8, 0], [0, 0, -1], P_reachL), [-0.46, 0.78, 2.4, 180, 0, 0, 35]),
      K(15.641, Bs([4.8, 1.5, 5.10], [-0.5, 0.85, 0], [-0.85, 0, -0.5], P_hold15), [-0.15, 0.75, 2.6, 180, 3, 5, 35]),
      K(16.683, Bs([4.7, 1.2, 4.80], [-0.6, 0.8, 0], [0, 0, -1], P_hold16), [0.06, 0.35, 3.3, 180, 6, 15, 35]),
      K(17.726, Bs([4.8, 1.3, 4.70], [-0.6, 0.8, 0], [0, 0, -1], P_hold16), [0.02, 0.42, 3.0, 180, 6, 15, 35]),
    ] },
    { start: 18.25, end: 20.33, subj: 'Bhead', keys: [
      K(18.769, Bs([4.9, 1.4, 5.00], [-0.95, 0.3, 0], [0, -0.7, -0.7], P_reachDown), [-0.3, 0.55, 2.4, 170, 9, 10, 35]),
      K(19.811, Bs([4.9, 1.5, 4.90], [-0.95, 0.3, 0], [0, -0.7, -0.7], P_reachDown), [-0.3, 0.7, 2.3, 170, 9, 10, 35]),
    ] },
    { start: 20.33, end: 1e9, subj: 'Bhead', keys: [
      K(20.854, Bs([2.16, 2.1, 1.81], [0.4, 0.82, -0.42], [-0.494, 0.24, -0.83], P_rim), [0.0, 0.75, 2.6, 90, 26, 0, 38]),
      K(21.897, Bs([2.14, 2.2, 1.8], [0.4, 0.82, -0.42], [-0.494, 0.24, -0.83], P_rim), [-0.1, 0.4, 3.2, 90, 26, 0, 38]),
      K(22.94, Bs([2.13, 2.25, 1.79], [0.4, 0.82, -0.42], [-0.494, 0.24, -0.83], P_rim), [-0.12, 0.55, 2.9, 90, 26, 3, 38]),
      K(23.982, Bs([2.12, 2.3, 1.78], [0.4, 0.82, -0.42], [-0.494, 0.24, -0.83], P_rim), [-0.15, 0.8, 2.7, 90, 26, 5, 38]),
    ] },
  ];

  const ZERO21 = new Array(21).fill(0);
  const flatB = (b) => b ? [...b.h, ...b.up, ...b.fwd, ...b.pose] : ZERO21;
  for (const s of shots) {
    s.track = s.keys.map((k) => ({ t: k.t, v: [...flatB(k.B), ...k.cam, ...flatB(k.A)] }));
  }

  function sampleTrack(keys, t) {
    const n = keys.length;
    if (n === 1) return keys[0].v.slice();
    const out = new Array(keys[0].v.length);
    if (t <= keys[0].t || t >= keys[n - 1].t) {
      const a = t <= keys[0].t ? keys[0] : keys[n - 2];
      const b = t <= keys[0].t ? keys[1] : keys[n - 1];
      const base = t <= keys[0].t ? a : b;
      const dt = b.t - a.t;
      for (let i = 0; i < out.length; i++) out[i] = base.v[i] + (b.v[i] - a.v[i]) / dt * (t - base.t);
      return out;
    }
    let i = 0;
    while (i < n - 2 && t >= keys[i + 1].t) i++;
    const k1 = keys[i], k2 = keys[i + 1];
    const k0 = keys[i - 1], k3 = keys[i + 2];
    const u = (t - k1.t) / (k2.t - k1.t);
    const u2 = u * u, u3 = u2 * u;
    for (let j = 0; j < out.length; j++) {
      const p1 = k1.v[j], p2 = k2.v[j];
      const p0 = k0 ? k0.v[j] : 2 * p1 - p2;
      const p3 = k3 ? k3.v[j] : 2 * p2 - p1;
      out[j] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
    }
    return out;
  }

  const D2R = Math.PI / 180;
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _b = new THREE.Vector3();
  const _r2 = new THREE.Vector3(), _u2 = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
  function setCamera(subj, nx, ny, d, yawD, pitchD, rollD, fovD) {
    const yaw = yawD * D2R;
    const pitch = Math.max(-88, Math.min(88, pitchD)) * D2R;
    const roll = rollD * D2R;
    _f.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).normalize();
    _r.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    _u.crossVectors(_r, _f).normalize();
    const cr = Math.cos(roll), sr = Math.sin(roll);
    _u2.copy(_u).multiplyScalar(cr).addScaledVector(_r, -sr);
    _r2.copy(_r).multiplyScalar(cr).addScaledVector(_u, sr);
    const fov = Math.max(10, Math.min(90, fovD));
    const tv = Math.tan(fov * D2R / 2), th = tv * aspect;
    const dd = Math.max(0.3, d);
    _c.copy(_f).addScaledVector(_r2, nx * th).addScaledVector(_u2, ny * tv).multiplyScalar(dd);
    camera.position.copy(subj).sub(_c);
    _b.copy(_f).negate();
    _m.makeBasis(_r2, _u2, _b);
    camera.quaternion.setFromRotationMatrix(_m);
    if (camera.fov !== fov || camera.aspect !== aspect) {
      camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    }
  }

  function findShot(t) {
    for (let i = 0; i < shots.length; i++) if (t < shots[i].end) return i;
    return shots.length - 1;
  }

  function update(time, frame) {
    const t = (typeof time === 'number' && isFinite(time)) ? time : (frame || 0) / fps;
    const si = findShot(t);
    const s = shots[si];
    const v = sampleTrack(s.track, t);
    const bh = v.slice(0, 3), bup = v.slice(3, 6), bfwd = v.slice(6, 9), bpose = v.slice(9, 21);
    const cam = v.slice(21, 28);
    // subtle deterministic working motion
    const w = Math.sin(t * 2.4), w2 = Math.sin(t * 1.7 + 1.1);
    bpose[2] += 0.12 * w; bpose[5] += 0.1 * w2; bpose[8] += 0.06 * w2; bpose[11] += 0.06 * w;
    placeAstronaut(astroB, bh, bup, bfwd);
    applyPose(astroB, bpose);
    if (s.showA) {
      astroA.root.visible = true;
      const a = v.slice(28, 49);
      const ap = a.slice(9, 21);
      ap[0] += 0.1 * Math.sin(t * 2.0 + 0.5); ap[2] += 0.15 * Math.sin(t * 2.6);
      placeAstronaut(astroA, a.slice(0, 3), a.slice(3, 6), a.slice(6, 9));
      applyPose(astroA, ap);
    } else {
      astroA.root.visible = false;
    }
    astroB.root.updateMatrixWorld(true);
    if (s.subj === 'Bhead') _s.set(bh[0], bh[1], bh[2]);
    else if (s.subj === 'Broot') _s.copy(astroB.root.position);
    else _s.set(s.subj[0], s.subj[1], s.subj[2]);
    setCamera(_s, cam[0], cam[1], cam[2], cam[3], cam[4], cam[5], cam[6]);
    camera.updateMatrixWorld(true);
  }

  update(0, 0);
  return { scene, camera, update };
}
