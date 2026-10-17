// CineRecon L1 proxy reconstruction - video12: FPV drone-race onboard camera through a
// night football stadium (stands, concourses, field gates) ending in a purple service tunnel.
export function createScene({ THREE, width, height, fps, duration, seed }) {
  const D2R = Math.PI / 180;
  const W = width || 1280, H = height || 720;
  const DUR = duration || 24.024;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060b);
  scene.fog = new THREE.FogExp2(0x07080f, 0.0026);
  const camera = new THREE.PerspectiveCamera(72, W / H, 0.05, 3000);
  scene.add(camera);

  // ---------- deterministic RNG (used only during construction) ----------
  let rs = ((seed | 0) ^ 0x2545f491) >>> 0;
  function rand() {
    rs = (rs + 0x6d2b79f5) | 0;
    let t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sp = (v) => Math.sign(v) * Math.sqrt(Math.abs(v));
  // superellipse (n=4, rounded rectangle) point
  function se(a, b, th) { const t = th * D2R; return [a * sp(Math.cos(t)), b * sp(Math.sin(t))]; }
  // bowl parameter: s=0 at field wall, s=1 at top of lower bowl, s>1 continues outward
  function bp(th, s, y) { const p = se(78 + 28 * s, 48 + 28 * s, th); return V(p[0], y, p[1]); }

  // ---------- materials ----------
  function lam(hex, em, extra) {
    const c = new THREE.Color(hex);
    return new THREE.MeshLambertMaterial(Object.assign({ color: c, emissive: c.clone().multiplyScalar(em === undefined ? 0.3 : em), side: THREE.DoubleSide }, extra || {}));
  }
  function glow(hex, extra) {
    return new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(hex), side: THREE.DoubleSide, toneMapped: false }, extra || {}));
  }
  function dataTex(w, h, fn) {
    const data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const c = fn(i, j); const k = (j * w + i) * 4;
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }
  const seatTex = dataTex(16, 8, (i, j) => (i === 0 ? [235, 235, 235] : (j < 2 ? [95, 95, 95] : [255, 255, 255])));
  const winTex = dataTex(16, 4, (i, j) => ((j === 1 || j === 2) && (i % 4 === 1) ? [255, 196, 110] : [26, 27, 32]));
  const grassTex = dataTex(2, 2, (i) => (i === 0 ? [255, 255, 255] : [212, 212, 212]));
  grassTex.repeat.set(0.1, 0.1);
  function dashTex() { const t = dataTex(2, 1, (i) => (i === 0 ? [235, 200, 40] : [70, 70, 76])); t.repeat.set(36, 1); return t; }

  const seatMat = new THREE.MeshLambertMaterial({ color: 0x168a80, emissive: 0x06302c, map: seatTex, side: THREE.DoubleSide });
  const wallMat = lam(0x22b5a5, 0.4);
  const fasciaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: winTex, side: THREE.DoubleSide, toneMapped: false });
  const whiteMat = lam(0xb8b8bc, 0.25);
  const darkMat = lam(0x202228, 0.2);
  const canopyMat = lam(0x4a4f58, 0.15);
  const facadeMat = lam(0x16171d, 0.15);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a3020, 1.25));
  const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(10, 100, 20); scene.add(dl);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // ---------- helpers ----------
  function without(gaps) {
    const g = gaps.slice().sort((a, b) => a[0] - b[0]);
    const r = []; let cur = 0;
    for (const [a, b] of g) { if (a > cur) r.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < 360) r.push([cur, 360]);
    return r;
  }
  function band(a0, b0, y0, a1, b1, y1, ranges, mat, uRep, vRep) {
    uRep = uRep || 0; vRep = vRep || 1;
    for (const r of ranges) {
      const t0 = r[0], t1 = r[1];
      const n = Math.max(2, Math.ceil((t1 - t0) * 1.5));
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const th = t0 + (t1 - t0) * i / n;
        const p0 = se(a0, b0, th), p1 = se(a1, b1, th);
        pos.push(p0[0], y0, p0[1], p1[0], y1, p1[1]);
        const u = th / 360 * uRep;
        uv.push(u, 0, u, vRep);
      }
      for (let i = 0; i < n; i++) { const k = 2 * i; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, mat));
    }
  }
  const ZAXIS = V(0, 0, 1);
  function beam(parent, p1, p2, th, mat) {
    const d = new THREE.Vector3().subVectors(p2, p1); const len = d.length();
    const m = new THREE.Mesh(new THREE.BoxGeometry(th, th, len), mat);
    m.position.copy(p1).add(p2).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(ZAXIS, d.normalize());
    parent.add(m); return m;
  }
  function box(parent, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function radialYaw(th, s0, s1) { const a = bp(th, s0, 0), b = bp(th, s1, 0); return Math.atan2(b.x - a.x, b.z - a.z); }

  // ---------- ground, track, field ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), lam(0x0b0c10, 0.1));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.08; scene.add(ground);
  function seShape(a, b) {
    const s = new THREE.Shape();
    for (let i = 0; i <= 240; i++) { const p = se(a, b, i * 1.5); if (i === 0) s.moveTo(p[0], -p[1]); else s.lineTo(p[0], -p[1]); }
    return s;
  }
  const asphalt = new THREE.Mesh(new THREE.ShapeGeometry(seShape(78, 48), 1), lam(0x45454b, 0.3));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = 0.0; scene.add(asphalt);
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5cae2e, emissive: 0x1c3a0c, map: grassTex, side: THREE.DoubleSide });
  const grass = new THREE.Mesh(new THREE.ShapeGeometry(seShape(72, 42), 1), grassMat);
  grass.rotation.x = -Math.PI / 2; grass.position.y = 0.03; scene.add(grass);
  for (const zz of [45.2, -45.2]) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(110, 0.25), new THREE.MeshBasicMaterial({ map: dashTex(), toneMapped: false }));
    dash.rotation.x = -Math.PI / 2; dash.position.set(0, 0.05, zz); scene.add(dash);
  }

  // ---------- stadium bowl ----------
  const GAP_SE = [28, 62], GAP_SW = [140, 160], GAP_T = [121, 129];
  const FULL = [[0, 360]];
  band(78, 48, 0, 78, 48, 2.2, without([GAP_T]), wallMat);
  band(78, 48, 2.2, 87.8, 57.8, 8.43, without([GAP_T]), seatMat, 120, 9);
  band(87.8, 57.8, 8.43, 106, 76, 20, FULL, seatMat, 120, 17);
  band(106, 76, 20, 106, 76, 30, without([GAP_SE, GAP_SW]), fasciaMat, 40, 1);
  band(106, 76, 30, 106, 76, 31.5, without([GAP_SE, GAP_SW]), whiteMat);
  band(108, 78, 31.5, 120, 90, 38, without([GAP_SE, GAP_SW]), seatMat, 120, 7);
  band(120, 90, 38, 120, 90, 41, FULL, whiteMat);
  band(121, 91, 41, 146, 116, 60, FULL, seatMat, 140, 22);
  band(146, 116, 60, 146, 116, 66, FULL, darkMat);
  band(96, 66, 74, 154, 124, 68, FULL, canopyMat);
  band(96, 66, 73.0, 97.6, 67.6, 73.0, FULL, glow(0xfffbe8));
  band(146, 116, 0, 146, 116, 18, FULL, facadeMat);
  band(146, 116, 18, 146, 116, 33, without([GAP_SE, GAP_SW]), facadeMat);
  band(146, 116, 33, 146, 116, 60, FULL, facadeMat);
  const floodMat = glow(0xffffff);
  for (let th = 0; th < 360; th += 22.5) {
    const p = se(97, 67, th); const m = box(scene, 4.5, 1.2, 2.5, p[0], 72.6, p[1], floodMat); m.rotation.y = -th * D2R;
  }

  // ---------- concourses (openings behind the lower bowl) ----------
  const concFloor = lam(0x2e2838, 0.25), concCeil = lam(0x6a30b0, 0.8), railMat = lam(0x34343c, 0.3);
  const purpleGlow = glow(0xb048ff), colMat = lam(0x2a2a32, 0.25);
  function concourse(t0, t1) {
    const R = [[t0, t1]];
    band(106, 76, 20, 146, 116, 20, R, concFloor);
    band(106, 76, 31.5, 146, 116, 31.5, R, concCeil);
    band(106, 76, 20, 106, 76, 21.0, R, railMat);
    band(106, 76, 21.0, 106, 76, 21.3, R, purpleGlow);
    band(124, 94, 31.2, 125.5, 95.5, 31.2, R, purpleGlow);
    band(140, 110, 31.2, 141.5, 111.5, 31.2, R, purpleGlow);
    band(146, 116, 20, 146, 116, 21.2, R, railMat);
    for (let th = t0 + 3; th < t1 - 1; th += 7) {
      const p = bp(th, 2.25, 25.75); box(scene, 1.2, 11.5, 1.2, p.x, p.y, p.z, colMat);
    }
  }
  concourse(GAP_SE[0], GAP_SE[1]);
  concourse(GAP_SW[0], GAP_SW[1]);

  // SE exterior lit truss structure (seen 3-4.5 s)
  const yGlow = glow(0xffc828), pGlow = glow(0xb040ff);
  beam(scene, bp(36, 2.75, 6), bp(48, 2.75, 42), 0.9, yGlow);
  beam(scene, bp(44, 2.65, 10), bp(52, 3.05, 40), 0.7, pGlow);
  beam(scene, bp(56, 2.65, 12), bp(42, 3.05, 44), 0.7, pGlow);
  beam(scene, bp(32, 2.85, 30), bp(60, 2.85, 30), 0.8, colMat);
  for (let th = 34; th <= 58; th += 6) beam(scene, bp(th, 2.95, 0), bp(th, 2.95, 46), 0.9, colMat);
  // gate C inside SE concourse
  {
    const g = new THREE.Group(); const p = bp(40, 1.3, 20); g.position.copy(p); g.rotation.y = radialYaw(40, 1.1, 1.6);
    const c = [V(-2.6, 0, 0), V(2.6, 0, 0), V(2.6, 5.2, 0), V(-2.6, 5.2, 0)];
    for (let i = 0; i < 4; i++) beam(g, c[i], c[(i + 1) % 4], 0.4, yGlow);
    const ci = [V(-2.1, 0.4, 0.1), V(2.1, 0.4, 0.1), V(2.1, 4.8, 0.1), V(-2.1, 4.8, 0.1)];
    for (let i = 0; i < 4; i++) beam(g, ci[i], ci[(i + 1) % 4], 0.15, pGlow);
    scene.add(g);
  }
  // SW concourse: stairs, green gate, pink hanging marker
  {
    const g = new THREE.Group(); g.position.copy(bp(143, 1.45, 20)); g.rotation.y = radialYaw(143, 1.2, 1.8);
    for (let i = 0; i < 5; i++) box(g, 5, 0.6 * (i + 1), 1.6, 0, 0.3 * (i + 1), i * 1.6, lam(0x55525e, 0.3));
    beam(g, V(2.6, 0, 0), V(2.6, 3.5, 7), 0.12, lam(0xcfcfcf, 0.5));
    scene.add(g);
    const gg = new THREE.Group(); gg.position.copy(bp(150, 1.75, 21)); gg.rotation.y = radialYaw(150, 1.3, 1.9);
    const gl = glow(0x46ff9a);
    const c = [V(-2, 0, 0), V(2, 0, 0), V(2, 4, 0), V(-2, 4, 0)];
    for (let i = 0; i < 4; i++) beam(gg, c[i], c[(i + 1) % 4], 0.35, gl);
    scene.add(gg);
    const pm = new THREE.Group(); pm.position.set(-91.9, 35, 44.6); pm.lookAt(0, 30, 0);
    const pg = glow(0xff3cd8);
    const q = [V(-1.2, -1.2, 0), V(1.2, -1.2, 0), V(1.2, 1.2, 0), V(-1.2, 1.2, 0)];
    for (let i = 0; i < 4; i++) beam(pm, q[i], q[(i + 1) % 4], 0.35, pg);
    scene.add(pm);
  }

  // ---------- corner video boards ----------
  for (const th of [45, 135, 225, 315]) {
    const p = se(98, 68, th);
    const g = new THREE.Group(); g.position.set(p[0], 54.5, p[1]);
    box(g, 22, 9, 1.2, 0, 0, 0, lam(0x15161a, 0.1));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(21, 8), glow(0x141a26)); scr.position.z = 0.62; g.add(scr);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.8), glow(0xf2f2ff)); bar.position.set(-2.5, 0.8, 0.66); g.add(bar);
    const circ = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), glow(0xf2f2ff)); circ.position.set(6.5, 0.8, 0.66); g.add(circ);
    const red = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.6), glow(0xff5a2a)); red.position.set(-6, -1.8, 0.66); g.add(red);
    scene.add(g); g.lookAt(0, 54.5, 0);
  }

  // ---------- race gates on the field / track ----------
  function pentagonGate(x, z, yawDeg) {
    const g = new THREE.Group();
    const white = lam(0xf5e8f2, 0.6), red = lam(0xb8203c, 0.35), pink = glow(0xff5ad8);
    const pts = [V(-1.7, 0.9, 0), V(1.7, 0.9, 0), V(2.1, 2.9, 0), V(0, 4.4, 0), V(-2.1, 2.9, 0)];
    for (let i = 0; i < 5; i++) beam(g, pts[i], pts[(i + 1) % 5], 0.75, white);
    const c = V(0, 2.55, 0);
    const ip = pts.map((p) => c.clone().add(p.clone().sub(c).multiplyScalar(0.78)));
    for (let i = 0; i < 5; i++) beam(g, ip[i], ip[(i + 1) % 5], 0.16, pink);
    box(g, 1.0, 0.9, 1.2, -1.7, 0.45, 0, red);
    box(g, 1.0, 0.9, 1.2, 1.7, 0.45, 0, red);
    g.position.set(x, 0, z); g.rotation.y = yawDeg * D2R; scene.add(g); return g;
  }
  function towerGate(x, z, yawDeg) {
    const g = new THREE.Group();
    const col = lam(0xa8ecff, 0.85), white = lam(0xf0f0f0, 0.55), pink = glow(0xff3fd2);
    for (const sx of [-2.2, 2.2]) for (const sz of [-1.2, 1.2]) box(g, 0.45, 8, 0.45, sx, 4, sz, col);
    box(g, 5.4, 0.5, 3.2, 0, 8.2, 0, white);
    box(g, 4.4, 0.12, 2.4, 0, 7.9, 0, pink);
    box(g, 4.4, 0.25, 0.25, 0, 7.6, 1.2, pink);
    box(g, 4.4, 0.25, 0.25, 0, 7.6, -1.2, pink);
    const roof = box(g, 5.8, 0.2, 3.8, 0, 9.3, 0.3, white); roof.rotation.x = 0.18;
    g.position.set(x, 0, z); g.rotation.y = yawDeg * D2R; scene.add(g); return g;
  }
  function rectGate(x, z, yawDeg) {
    const g = new THREE.Group(); const pk = glow(0xff44c4), yl = glow(0xf2f04a);
    const c = [V(-3, 0, 0), V(-3, 4.6, 0), V(3, 4.6, 0), V(3, 0, 0)];
    for (let i = 0; i < 3; i++) beam(g, c[i], c[i + 1], 0.4, pk);
    const ci = [V(-2.55, 0, 0.1), V(-2.55, 4.15, 0.1), V(2.55, 4.15, 0.1), V(2.55, 0, 0.1)];
    for (let i = 0; i < 3; i++) beam(g, ci[i], ci[i + 1], 0.16, yl);
    g.position.set(x, 0, z); g.rotation.y = yawDeg * D2R; scene.add(g); return g;
  }
  pentagonGate(-42, 33, 90);   // A1: flown through at ~8.5 s
  pentagonGate(12, 27, 90);    // A2: passed on the left at ~15.6 s
  towerGate(-50, 40, 90);      // B1: tower gate ahead at 7.3 s and 18.8 s, before the tunnel
  towerGate(-14, 44.2, 90);    // B2: tower gate seen from the stands at 14.6 s
  rectGate(4, 45.2, 90);       // D: pink/yellow gate on the south track (~17.8 s)

  // ---------- tunnel under SW stands ----------
  const c0xz = se(78, 48, 125);
  const C0 = V(c0xz[0], 0, c0xz[1]);
  const d1 = V(-0.341, 0, 0.94).normalize();
  const r1 = V(-d1.z, 0, d1.x);
  const cs = Math.cos(50 * D2R), sn = Math.sin(50 * D2R);
  const d2 = V(d1.x * cs + r1.x * sn, 0, d1.z * cs + r1.z * sn).normalize();
  const SEG1 = 20;
  const C1 = C0.clone().addScaledVector(d1, SEG1);
  const TW = 7, TH = 5;
  const tFloor = lam(0x4e3e6e, 0.45), tWall = lam(0x7444cc, 0.55), tCeil = lam(0x1c1028, 0.3), tSkirt = lam(0x1e1430, 0.25);
  const tYellow = glow(0xd8b030), tLight = glow(0xfff4ff), tOrange = glow(0xffa030), tPink = glow(0xff4ce0);
  const CEXT = (TW / 2) * Math.tan(25 * D2R);
  // walls: [leftFrom, leftTo, rightFrom, rightTo] (local +x is left; the bend turns right)
  function tunnelSeg(start, dir, from, to, walls, yFloor, yLineTo) {
    const g = new THREE.Group();
    g.position.copy(start); g.rotation.y = Math.atan2(dir.x, dir.z);
    const len = to - from, mid = (from + to) / 2;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(TW, len), tFloor); fl.rotation.x = -Math.PI / 2; fl.position.set(0, yFloor, mid); g.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(TW, len), tCeil); ce.rotation.x = -Math.PI / 2; ce.position.set(0, TH + yFloor, mid); g.add(ce);
    const sides = [[1, walls[0], walls[1]], [-1, walls[2], walls[3]]];
    for (const [sx, a, b] of sides) {
      const wl = b - a, wm = (a + b) / 2;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(wl, TH), tWall); w.rotation.y = Math.PI / 2; w.position.set(sx * TW / 2, TH / 2, wm); g.add(w);
      const k = new THREE.Mesh(new THREE.PlaneGeometry(wl, 1.6), tSkirt); k.rotation.y = Math.PI / 2; k.position.set(sx * (TW / 2 - 0.03), 0.8, wm); g.add(k);
    }
    const yl0 = Math.max(from, 0), yl1 = Math.min(to, yLineTo);
    const yl = new THREE.Mesh(new THREE.PlaneGeometry(0.22, yl1 - yl0), tYellow); yl.rotation.x = -Math.PI / 2; yl.position.set(TW / 2 - 0.9, yFloor + 0.03, (yl0 + yl1) / 2); g.add(yl);
    for (let z = from + 4; z < to - 2; z += 9) box(g, 1.0, 0.15, 2.2, 0, TH - 0.1, z, tLight);
    for (let z = from + 10; z < to - 4; z += 19) box(g, 0.1, 2.6, 1.8, -TW / 2 + 0.06, 2.4, z, tOrange);
    for (let z = from + 6; z < to - 4; z += 14) box(g, 0.1, 3.2, 0.5, TW / 2 - 0.06, 2.6, z, tPink);
    scene.add(g);
  }
  tunnelSeg(C0, d1, -0.5, SEG1 + 3.5, [-0.5, SEG1 + CEXT, -0.5, SEG1 - CEXT], 0.04, SEG1);
  tunnelSeg(C1, d2, -3.5, 66, [-CEXT, 66, CEXT, 66], 0.05, 66);
  {
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(TW, TH), glow(0xa070e0));
    cap.position.copy(C1.clone().addScaledVector(d2, 66)); cap.position.y = TH / 2; cap.rotation.y = Math.atan2(d2.x, d2.z); scene.add(cap);
    const portal = new THREE.Group(); portal.position.copy(C0); portal.rotation.y = Math.atan2(d1.x, d1.z);
    box(portal, TW + 3, 3.2, 0.8, 0, TH + 1.6, -0.2, lam(0x1a1a22, 0.15));
    box(portal, TW + 1, 0.5, 0.3, 0, TH + 0.3, -0.7, glow(0xff3cd0));
    box(portal, 0.4, TH, 0.3, TW / 2 + 0.3, TH / 2, -0.7, glow(0xff3cd0));
    box(portal, 0.4, TH, 0.3, -TW / 2 - 0.3, TH / 2, -0.7, glow(0xff3cd0));
    scene.add(portal);
  }

  // ---------- distant city lights ----------
  {
    const N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2, r = 240 + rand() * 330;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = rand() < 0.7 ? rand() * 25 : rand() * 70; pos[i * 3 + 2] = Math.sin(a) * r;
      const w = rand(); col[i * 3] = 1; col[i * 3 + 1] = 0.6 + 0.35 * w; col[i * 3 + 2] = 0.25 + 0.6 * w * w;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.5, sizeAttenuation: false, vertexColors: true, fog: false, toneMapped: false })));
  }

  // ---------- camera path (onboard FPV camera of the filmed drone) ----------
  function tunCenter(s, out) {
    if (s <= 16) return out.copy(C0).addScaledVector(d1, s);
    if (s >= 24) return out.copy(C1).addScaledVector(d2, s - SEG1);
    const u = (s - 16) / 8;
    const A = C0.clone().addScaledVector(d1, 16), E = C1.clone().addScaledVector(d2, 4);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    return out.set(A.x * a + C1.x * b + E.x * c, 0, A.z * a + C1.z * b + E.z * c);
  }
  function tunPose(s, P, L) {
    tunCenter(s, P); P.y = s < 4 ? 2.6 + (2.0 - 2.6) * Math.max(0, (s + 8) / 12) : 2.0;
    tunCenter(s + 10, L); L.y = 1.9;
  }
  const T_TUN = 19.82;
  const tp = V(0, 0, 0), tl = V(0, 0, 0); tunPose(-8, tp, tl);
  const KF = [
    [0.000, bp(14, 0.15, 7.0), bp(22, 1.0, 24), 5],
    [1.034, bp(26, 0.50, 14.0), bp(40, 1.3, 25), -8],
    [2.102, bp(36, 0.82, 19.5), bp(39, 1.6, 21.5), 0],
    [3.136, bp(42, 1.35, 23.5), bp(50, 2.0, 29), -55],
    [4.171, bp(52, 1.60, 26.5), bp(60, 2.3, 31), -35],
    [5.205, bp(62, 0.70, 28.0), V(-30, -10, -10), 4],
    [6.273, bp(86, 0.30, 13.0), V(-12, -14, 46), 5],
    [7.307, V(-2, 2.5, 35), V(-52, 3.0, 32.5), 8],
    [8.342, V(-36, 2.2, 33), V(-80, 2.8, 33), 5],
    [9.376, V(-66, 10, 27), V(-104, 44, 42), 10],
    [10.444, bp(175, 0.45, 19), bp(165, 1.4, 31), 13],
    [11.478, bp(150, 1.15, 23), bp(146, 1.8, 22.5), -9],
    [12.513, bp(146, 0.92, 21), bp(128, 1.0, 23), 70],
    [13.547, bp(120, 0.75, 18.5), bp(104, 0.2, 6), 155],
    [14.615, V(-40, 19, 60), V(-14, 1, 43), 0],
    [15.649, V(-4, 3, 40), V(36, 4, 40), 0],
    [16.150, V(16, 3.2, 37), V(34, 3, 50), -45],
    [16.683, V(20, 3.5, 43.5), V(0, 0, 50), -40],
    [17.718, V(8, 3.0, 45.0), V(-24, -16, 44), -15],
    [18.785, V(-20, 2.5, 44.5), V(-60, 4, 42.5), 3],
    [T_TUN, tp.clone(), tl.clone(), -25],
  ];
  const posCurve = new THREE.CatmullRomCurve3(KF.map((k) => k[1]), false, 'centripetal');
  const lookCurve = new THREE.CatmullRomCurve3(KF.map((k) => k[2]), false, 'centripetal');
  const ROLL = KF.map((k) => [k[0], k[3]]).concat([[20.85, -35], [21.89, -8], [22.96, 0], [23.99, 3]]);
  const TUNS = [[19.82, -8], [20.85, 8], [21.89, 24], [22.96, 42], [23.99, 60]];
  function lin(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (t <= keys[i + 1][0]) { const f = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * f; }
    }
    const n = keys.length;
    const slope = (keys[n - 1][1] - keys[n - 2][1]) / (keys[n - 1][0] - keys[n - 2][0]);
    return keys[n - 1][1] + slope * (t - keys[n - 1][0]);
  }
  function kfU(t) {
    if (t <= KF[0][0]) return 0;
    for (let i = 0; i < KF.length - 1; i++) {
      if (t <= KF[i + 1][0]) { const f = (t - KF[i][0]) / (KF[i + 1][0] - KF[i][0]); return (i + f) / (KF.length - 1); }
    }
    return 1;
  }
  function camPose(t, P, L) {
    if (t >= T_TUN) { tunPose(lin(TUNS, t), P, L); }
    else { const u = kfU(t); posCurve.getPoint(u, P); lookCurve.getPoint(u, L); }
  }
  function rollAt(t) { return t >= 23.99 ? 3 : lin(ROLL, t); }

  // ---------- opponent drones (follow the same racing line, ahead) ----------
  function droneMesh(led) {
    const g = new THREE.Group();
    box(g, 0.45, 0.12, 0.45, 0, 0, 0, lam(0x222226, 0.2));
    const rotors = [];
    for (const sx of [-0.32, 0.32]) for (const sz of [-0.32, 0.32]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), lam(0x55555c, 0.3));
      r.position.set(sx, 0.08, sz); g.add(r); rotors.push(r);
    }
    const lg = glow(led);
    box(g, 0.7, 0.07, 0.09, 0, -0.02, 0.33, lg);
    box(g, 0.7, 0.07, 0.09, 0, -0.02, -0.33, lg);
    box(g, 0.3, 0.05, 0.3, 0, -0.08, 0, lg);
    g.scale.setScalar(1.4);
    scene.add(g);
    return g;
  }
  const opps = [
    { mesh: droneMesh(0xff3fd0), lead: 0.5, lat: -1.0, up: 0.4 },
    { mesh: droneMesh(0x5dff6a), lead: 0.85, lat: 1.2, up: 0.2 },
  ];

  // ---------- onboard elements fixed to the camera: own propellers + broadcast lower-third panel ----------
  const HUD_D = 0.2;
  const hudHalfH = HUD_D * Math.tan(camera.fov * D2R / 2), hudHalfW = hudHalfH * camera.aspect;
  const pxc = (px, py) => [(px / 960 * 2 - 1) * hudHalfW, (1 - py / 540 * 2) * hudHalfH];
  function hudRect(x0, y0, x1, y1, color, order) {
    const a = pxc(x0, y0), b = pxc(x1, y1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])),
      new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 1, toneMapped: false, fog: false }));
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -HUD_D); m.renderOrder = order; m.frustumCulled = false;
    camera.add(m);
  }
  function prop(cx, cy, rx, ry) {
    const c = pxc(cx, cy), e = pxc(cx + rx, cy + ry);
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32),
      new THREE.MeshBasicMaterial({ color: 0xb8183e, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    m.scale.set(Math.abs(e[0] - c[0]), Math.abs(e[1] - c[1]), 1);
    m.position.set(c[0], c[1], -HUD_D * 1.01); m.renderOrder = 990; m.frustumCulled = false;
    camera.add(m);
  }
  prop(30, 350, 150, 75);
  prop(935, 345, 120, 60);
  hudRect(228, 465, 740, 545, 0xcbcbcb, 1000);
  hudRect(244, 478, 726, 482, 0xc8642a, 1001);
  hudRect(248, 484, 318, 545, 0x3a3a3c, 1002);
  hudRect(326, 484, 602, 545, 0xe4e4e4, 1002);
  hudRect(608, 484, 725, 545, 0xe8e8e8, 1002);

  // ---------- update ----------
  const P = V(0, 0, 0), L = V(0, 0, 0), A = V(0, 0, 0), B = V(0, 0, 0), T = V(0, 0, 0), UP = V(0, 1, 0);
  function update(time) {
    const t = Math.max(0, Math.min(time, DUR));
    camPose(t, P, L);
    camera.position.copy(P);
    camera.up.set(0, 1, 0);
    camera.lookAt(L);
    camera.rotateZ(rollAt(t) * D2R);
    camera.updateMatrixWorld(true);
    for (const o of opps) {
      camPose(t + o.lead, A, T);
      camPose(t + o.lead + 0.05, B, T);
      const dir = B.clone().sub(A);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, UP);
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
      right.normalize();
      o.mesh.position.copy(A).addScaledVector(right, o.lat).addScaledVector(UP, o.up);
      o.mesh.lookAt(o.mesh.position.clone().add(dir));
      o.mesh.rotateZ(-0.35);
    }
  }
  update(0, 0);
  return { scene, camera, update };
}
