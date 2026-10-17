// CineRecon L1 proxy reconstruction - video37
// Single continuous tracking shot: woman (red jacket) and boy (plaid shirt) walk from a
// large wooden hotel, start running right, camera pans right and trucks along a tall
// topiary hedge-maze wall, they turn into the maze gateway arch, the camera settles on a
// roofed wooden map board in the foreground.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const DEG = Math.PI / 180;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c1e2);

  const camera = new THREE.PerspectiveCamera(29.4, width / height, 0.3, 700);
  camera.rotation.order = 'YXZ';

  // ---------- deterministic rng (init only) ----------
  let s0 = (seed >>> 0) || 12345;
  function rand() {
    s0 |= 0; s0 = (s0 + 0x6D2B79F5) | 0;
    let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- helpers ----------
  const matCache = new Map();
  function mat(hex) {
    if (!matCache.has(hex)) matCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
    return matCache.get(hex);
  }
  function addBox(parent, w, h, d, hex, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function boxSpan(parent, x0, x1, y0, y1, z0, z1, hex) {
    return addBox(parent, x1 - x0, y1 - y0, z1 - z0, hex, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  function addCyl(parent, rt, rb, h, hex, x, y, z, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(hex));
    m.position.set(x, y, z); parent.add(m); return m;
  }
  function addCone(parent, r, h, hex, x, yBase, z, seg = 12) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(hex));
    m.position.set(x, yBase + h / 2, z); parent.add(m); return m;
  }
  function addSphere(parent, r, hex, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(hex));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  }
  function prismGeo(w, h, d) { // ridge along local z, base at y=0
    const hw = w / 2, hd = d / 2;
    const A = [-hw, 0, hd], B = [hw, 0, hd], C = [0, h, hd];
    const A2 = [-hw, 0, -hd], B2 = [hw, 0, -hd], C2 = [0, h, -hd];
    const tris = [A, B, C, B2, A2, C2, A, C, C2, A, C2, A2, B, B2, C2, B, C2, C];
    const arr = new Float32Array(tris.length * 3);
    tris.forEach((p, i) => { arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  }
  function addPrism(parent, w, h, d, hex, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(prismGeo(w, h, d), new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m); return m;
  }
  function addGroundRect(x0, x1, z0, z1, y, hex) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat(hex));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(m); return m;
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xdde8ff, 0x55653a, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.0);
  sun.position.set(-40, 60, 45);
  scene.add(sun); scene.add(sun.target);

  // ---------- sky dome (procedural gradient) ----------
  {
    const g = new THREE.SphereGeometry(450, 32, 16);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cH = new THREE.Color(0xa8c0e0), cZ = new THREE.Color(0x5f8ad0), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 450;
      const t = Math.min(1, Math.max(0, y * 3.0));
      c.copy(cH).lerp(cZ, t);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
    sky.renderOrder = -10;
    scene.add(sky);
  }

  // ---------- ground ----------
  addGroundRect(-300, 300, -300, 300, 0, 0x64a046);
  // gravel path along the hedge
  addGroundRect(-6.0, 60, 0.0, 3.85, 0.03, 0xaaa79d);
  // gravel in front of / inside the gateway
  addGroundRect(15.2, 19.0, -5.0, 0.0, 0.03, 0xa3a096);
  // asphalt road running back beside the maze
  addGroundRect(-11.5, -5.5, -60, 16, 0.05, 0x5c5a57);
  // footpath from hotel toward the road
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), mat(0x9e9c94));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(5.5, 13);
    m.position.set(-17.5, 0.04, 0.6); scene.add(m);
  }

  // ---------- distant hill with tree band ----------
  addSphere(scene, 45, 0x72b04e, -5, -2, -75, 1.2, 0.17, 1.0);
  for (let k = 0; k < 44; k++) {
    const x = -48 + k * 2.0 + (rand() - 0.5) * 1.5;
    const z = -50 - rand() * 9;
    const dx = (x + 5) / 1.2, dz = z + 75;
    const inside = Math.max(0, 45 * 45 - dx * dx - dz * dz);
    const y = -2 + 0.17 * Math.sqrt(inside);
    const r = 1.3 + rand() * 0.9;
    addSphere(scene, r, k % 3 === 0 ? 0x355a2c : 0x3f6634, x, y + r * 0.9, z, 0.9, 1.3, 0.9);
  }
  // concrete pipe pile on hill
  for (let k = 0; k < 3; k++) {
    const p = addCyl(scene, 0.6, 0.6, 1.4, 0x9a9890, -14.5 + k * 1.25, 0.6, -37, 12);
    p.rotation.x = Math.PI / 2;
  }
  addCyl(scene, 0.6, 0.6, 1.4, 0x9a9890, -13.9, 1.65, -37, 12).rotation.x = Math.PI / 2;

  // ---------- hotel (proxy blocks) ----------
  {
    const H = new THREE.Group();
    H.position.set(-32.28, 0, -35.35);
    H.rotation.y = 26.2 * DEG;
    scene.add(H);
    const wall = 0x9a9482, wallDark = 0x6c6961, roof = 0x7d6a5a, shingle = 0x94725a;
    // right gable wing
    boxSpan(H, 1.0, 11.2, 0, 10, -18, 0, wall);
    addPrism(H, 11.0, 7.0, 18.6, roof, 6.1, 10, -9);
    boxSpan(H, 6.4, 7.7, 10, 18.4, -7.5, -6.2, 0x8a6a50); // chimney
    // centre section behind porch
    boxSpan(H, -10, 1, 0, 12, -12, -3, 0x7a756a);
    addPrism(H, 9.6, 6.0, 11.4, roof, -4.5, 12, -7.5, Math.PI / 2);
    // porch / entrance
    boxSpan(H, -9.5, 0.5, 0, 4.5, -3, 2.5, 0x7a7266);
    boxSpan(H, -6.8, -3.8, 0, 3.2, 2.5, 2.6, 0x1e1c1a);
    addPrism(H, 10.6, 6.5, 6.0, shingle, -4.5, 4.5, -0.2);
    // left main block (closer, taller)
    boxSpan(H, -38, -10, 0, 14, -6, 7, wallDark);
    addPrism(H, 13.6, 5.5, 28.6, roof, -24, 14, 0.5, Math.PI / 2);
  }

  // ---------- hedge maze ----------
  const HEDGE = 0x4b6a3a, HEDGE2 = 0x45633a, HEDGE_IN = 0x26391f;
  function tower(x, z, hBox, w, coneR, coneH) {
    boxSpan(scene, x - w / 2, x + w / 2, 0, hBox, z - w / 2, z + w / 2, HEDGE2);
    addCyl(scene, coneR * 0.55, coneR * 0.6, 0.25, HEDGE2, x, hBox + 0.12, z);
    addCone(scene, coneR, coneH, HEDGE, x, hBox + 0.22, z);
  }
  boxSpan(scene, -1.1, 14.0, 0, 3.9, -1.5, 0, HEDGE);
  boxSpan(scene, 20.0, 60, 0, 3.9, -1.5, 0, HEDGE);
  boxSpan(scene, -1.1, 0.4, 0, 3.9, -30, -1.5, HEDGE);       // side wall going back
  tower(-0.3, -0.75, 4.6, 1.65, 0.62, 1.25);                  // corner tower A
  tower(7.3, -0.75, 4.6, 1.65, 0.62, 1.25);                   // tower B
  tower(-0.35, -7.5, 4.4, 1.5, 0.55, 1.1);                    // side wall towers
  tower(-0.35, -15.0, 4.4, 1.5, 0.55, 1.1);
  tower(-0.35, -22.5, 4.4, 1.5, 0.55, 1.1);
  tower(27.5, -0.75, 4.6, 1.65, 0.62, 1.25);
  tower(35.0, -0.75, 4.6, 1.65, 0.62, 1.25);
  // gateway arch into the maze
  boxSpan(scene, 14.0, 16.0, 0, 4.6, -1.6, 0.9, HEDGE2);
  boxSpan(scene, 18.1, 20.0, 0, 4.6, -1.6, 0.9, HEDGE2);
  boxSpan(scene, 15.2, 18.9, 3.7, 5.2, -1.6, 0.9, HEDGE2);
  addCyl(scene, 0.3, 0.35, 0.25, HEDGE2, 14.6, 4.72, -0.35);
  addCone(scene, 0.52, 1.0, HEDGE, 14.6, 4.82, -0.35);
  addCyl(scene, 0.35, 0.4, 0.25, HEDGE2, 19.5, 4.72, -0.35);
  addCone(scene, 0.52, 1.0, HEDGE, 19.5, 4.82, -0.35);
  addCyl(scene, 0.4, 0.45, 0.3, HEDGE2, 17.05, 5.35, -0.35);
  addCone(scene, 0.7, 1.5, HEDGE, 17.05, 5.48, -0.35);
  // passage walls & interior hedge seen through the arch
  boxSpan(scene, 14.0, 16.0, 0, 3.9, -4.8, -1.6, HEDGE_IN);
  boxSpan(scene, 18.1, 20.0, 0, 3.9, -4.8, -1.6, HEDGE_IN);
  boxSpan(scene, 13.0, 21.0, 0, 3.0, -6.0, -4.8, HEDGE_IN);

  // ---------- benches ----------
  function bench(x, z, w) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    addBox(g, w, 0.1, 0.45, 0xd8d0b8, 0, 0.45, 0);
    addBox(g, 0.16, 0.4, 0.36, 0xcfc7ae, -w / 2 + 0.25, 0.2, 0);
    addBox(g, 0.16, 0.4, 0.36, 0xcfc7ae, w / 2 - 0.25, 0.2, 0);
  }
  bench(3.3, 0.8, 1.7);
  bench(10.45, 4.0, 1.8);
  bench(17.05, -4.3, 1.6);

  // ---------- waste bins ----------
  function bin(x, z) { addCyl(scene, 0.3, 0.27, 0.8, 0x7a4a2c, x, 0.4, z, 12); }
  bin(7.1, 4.3); bin(-14.5, 1.0); bin(-5.3, -1.0);

  // ---------- lamp posts ----------
  function lamp(x, z, arm) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    addCyl(g, 0.06, 0.08, 2.75, 0x4b5048, 0, 1.375, 0, 8);
    addBox(g, 0.3, 0.38, 0.3, 0xd0d4d0, 0, 2.94, 0);
    addCone(g, 0.24, 0.22, 0x2e322e, 0, 3.13, 0, 8);
    if (arm) {
      addBox(g, 1.0, 0.04, 0.04, 0x4b5048, 0, 2.3, 0);
      addBox(g, 0.38, 0.1, 0.03, 0xd8d8d0, 0.35, 2.15, 0.03);
    }
  }
  lamp(-6.51, 3.75, false);
  lamp(4.0, 3.75, true);
  lamp(13.97, 3.75, true);
  lamp(-14.9, 6.7, false);
  lamp(-20.5, 1.2, false);

  // ---------- rocks ----------
  [[-12.5, 4.8, 0.5], [-10.8, 5.6, 0.4], [-4.3, 5.2, 0.45], [-8.3, 7.6, 0.5], [-16.0, 3.4, 0.35], [-2.5, 5.0, 0.3], [-19.5, -1.5, 0.5]]
    .forEach(([x, z, r]) => addSphere(scene, r * 0.6, 0xb5b0a3, x, r * 0.2, z, 1.4, 0.65, 1.0));

  // ---------- ticket hut ----------
  {
    boxSpan(scene, 9.1, 12.55, 0, 2.0, -1.0, 1.0, 0x6a5846);
    boxSpan(scene, 8.9, 12.75, 1.95, 2.3, -1.2, 1.35, 0x5a4a40);
    addPrism(scene, 3.0, 0.7, 3.85, 0x5a4a40, 10.83, 2.25, 0.05, Math.PI / 2);
    boxSpan(scene, 9.3, 12.35, 1.15, 1.75, 1.0, 1.04, 0x4a4a48);
    boxSpan(scene, 10.4, 10.95, 0.55, 1.35, 1.0, 1.06, 0xa88a5e);
  }

  // ---------- foreground trees near the map board ----------
  addCyl(scene, 0.15, 0.2, 1.2, 0x3a2e24, 17.8, 0.6, 6.5, 8);
  addCone(scene, 0.95, 4.6, 0x2c4424, 17.8, 0.5, 6.5);
  addCyl(scene, 0.2, 0.25, 1.5, 0x3a2e24, 21.8, 0.75, 6.0, 8);
  addCone(scene, 1.4, 6.0, 0x2a4022, 21.8, 0.8, 6.0);
  addSphere(scene, 0.9, 0x2f4a26, 19.2, 0.5, 7.4, 1.4, 0.6, 1.0);

  // ---------- map board (foreground) ----------
  {
    const g = new THREE.Group(); g.position.set(18.76, 0, 9.0); scene.add(g);
    const wood = 0x4a3a2e, woodDark = 0x3a2e26;
    addBox(g, 0.28, 2.65, 0.25, wood, -1.67, 1.32, 0);
    addBox(g, 0.28, 2.65, 0.25, wood, 1.67, 1.32, 0);
    addBox(g, 4.3, 0.4, 1.0, 0x4a4038, 0, 2.82, 0.05);
    addBox(g, 3.9, 0.22, 0.3, woodDark, 0, 2.52, 0);
    addBox(g, 3.06, 1.6, 0.08, 0x4b3a2c, 0, 1.84, 0);
    addBox(g, 3.4, 0.18, 0.25, wood, 0, 0.98, 0);
    // procedural maze poster
    const TW = 96, TH = 72, data = new Uint8Array(TW * TH * 4);
    for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
      const d = Math.min(i, j, TW - 1 - i, TH - 1 - j);
      let c = [200, 178, 122];
      if (d >= 8) {
        const f = d - 8;
        const gap = ((i * 7 + j * 3 + f * 11) % 29) < 2;
        c = (f % 3 === 0 && !gap) ? [205, 190, 135] : [95, 138, 74];
      }
      const k = (j * TW + i) * 4;
      data[k] = c[0]; data[k + 1] = c[1]; data[k + 2] = c[2]; data[k + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat);
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.41), new THREE.MeshLambertMaterial({ map: tex }));
    poster.position.set(0, 1.84, 0.05); g.add(poster);
    for (const sx of [-1.15, 1.15]) for (const yy of [2.3, 1.85, 1.4]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.36), mat(0xdcd6c4));
      p.position.set(sx, yy, 0.05); g.add(p);
    }
  }

  // ---------- articulated human proxies ----------
  function makeHuman(c) {
    const root = new THREE.Group(); scene.add(root);
    const pelvis = new THREE.Group(); root.add(pelvis);
    addBox(pelvis, c.torsoW * 0.9, 0.16, c.torsoD * 0.9, c.legColor, 0, 0, 0);
    const torso = new THREE.Group(); pelvis.add(torso);
    addBox(torso, c.torsoW, c.torsoH + 0.1, c.torsoD, c.torsoColor, 0, c.torsoH / 2 - 0.05, 0);
    addCyl(torso, c.headR * 0.4, c.headR * 0.45, c.neck + 0.04, c.skin, 0, c.torsoH + c.neck / 2, 0, 8);
    const head = new THREE.Group(); head.position.y = c.torsoH + c.neck + c.headR; torso.add(head);
    addSphere(head, c.headR, c.skin, 0, 0, 0.01);
    addSphere(head, c.headR * 1.07, c.hair, 0, c.headR * 0.2, -c.headR * 0.25);
    const legs = [], arms = [];
    for (const side of [1, -1]) {
      const thigh = new THREE.Group(); thigh.position.set(side * c.hipW, 0, 0); pelvis.add(thigh);
      addCyl(thigh, c.legR, c.legR * 0.9, c.thigh, c.legColor, 0, -c.thigh / 2, 0, 8);
      const knee = new THREE.Group(); knee.position.y = -c.thigh; thigh.add(knee);
      addCyl(knee, c.legR * 0.9, c.legR * 0.75, c.shin, c.legColor, 0, -c.shin / 2, 0, 8);
      addBox(knee, c.legR * 2.0, 0.06, c.footL, c.shoe, 0, -c.shin - 0.03, c.footL * 0.3);
      legs.push({ thigh, knee });
      const sh = new THREE.Group(); sh.position.set(side * (c.torsoW / 2 + c.armR), c.torsoH - 0.07, 0); torso.add(sh);
      addCyl(sh, c.armR, c.armR * 0.9, c.upper, c.armColor, 0, -c.upper / 2, 0, 8);
      const el = new THREE.Group(); el.position.y = -c.upper; sh.add(el);
      addCyl(el, c.armR * 0.9, c.armR * 0.8, c.fore, c.armColor, 0, -c.fore / 2, 0, 8);
      addSphere(el, c.armR * 0.95, c.skin, 0, -c.fore - 0.02, 0);
      arms.push({ sh, el, side });
    }
    return { root, pelvis, torso, legs, arms, c };
  }

  const woman = makeHuman({
    thigh: 0.41, shin: 0.39, legR: 0.075, hipW: 0.1, torsoW: 0.42, torsoD: 0.26, torsoH: 0.56,
    neck: 0.05, headR: 0.11, upper: 0.29, fore: 0.27, armR: 0.062, footL: 0.25,
    legColor: 0x2b3350, torsoColor: 0xc8202a, armColor: 0xc8202a, skin: 0xd9a888, hair: 0x2a1c16, shoe: 0xb07a3a,
    walkLen: 1.35, runLen: 2.1, armFwd: 0.9
  });
  const boy = makeHuman({
    thigh: 0.27, shin: 0.27, legR: 0.055, hipW: 0.07, torsoW: 0.30, torsoD: 0.18, torsoH: 0.38,
    neck: 0.03, headR: 0.095, upper: 0.2, fore: 0.19, armR: 0.045, footL: 0.18,
    legColor: 0x6e6a40, torsoColor: 0xa64552, armColor: 0xa64552, skin: 0xe0b090, hair: 0x8c6239, shoe: 0xd8d0c0,
    walkLen: 0.95, runLen: 1.45, armFwd: 0.25
  });

  // ---------- tracks ----------
  function pchip(ts, vs) {
    const n = ts.length, h = [], d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) { h[i] = ts[i + 1] - ts[i]; d[i] = (vs[i + 1] - vs[i]) / h[i]; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    return function (t) {
      if (t <= ts[0]) return vs[0];
      if (t >= ts[n - 1]) return vs[n - 1];
      let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
      const hh = h[i], u = (t - ts[i]) / hh, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * vs[i] + (u3 - 2 * u2 + u) * hh * m[i] + (-2 * u3 + 3 * u2) * vs[i + 1] + (u3 - u2) * hh * m[i + 1];
    };
  }
  const ST = [0, 0.7929, 1.5858, 2.3787, 3.2133, 4.0062, 4.7991, 5.592, 6.3848, 7.1777, 7.9706, 8.7635,
    9.5981, 10.391, 11.1839, 11.9768, 12.7697, 13.5626, 14.3555, 15.1484, 15.983, 16.7759, 17.5688, 18.3616];
  const camX = pchip(ST, [-8.0, -7.95, -7.85, -7.6, -7.1, -6.25, -5.05, -3.49, -1.9, -0.4, 1.75, 3.9, 6.2, 8.5,
    10.7, 12.66, 14.12, 15.23, 16.34, 17.61, 18.41, 18.77, 18.77, 18.77]);
  const camYaw = pchip(ST, [26.2, 26.1, 24.95, 21.0, 13.3, 8.6, 3.6, 1.46, 1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const CAM_Y = 1.5, CAM_Z = 14.0, PITCH = 3.9 * DEG;

  const PT = ST.slice(0, 20).concat([16.0, 18.4]);
  const tracks = [
    {
      P: woman,
      X: pchip(PT, [-18.2, -17.1, -16.1, -13.9, -11.6, -9.6, -7.4, -5.15, -3.1, -1.0, 1.38, 3.47, 5.72, 7.99, 10.0, 11.9, 13.8, 15.86, 17.0, 17.4, 17.4, 17.4]),
      Z: pchip(PT, [0.4, 1.5, 1.9, 2.5, 2.9, 2.7, 2.8, 2.85, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 2.9, 2.6, 1.9, -0.5, -3.0, -3.2])
    },
    {
      P: boy,
      X: pchip(PT, [-17.25, -16.4, -15.3, -13.2, -10.9, -8.9, -6.4, -4.0, -2.0, -0.2, 2.07, 4.44, 6.74, 8.88, 10.77, 12.77, 14.8, 16.4, 16.85, 17.0, 17.0, 17.0]),
      Z: pchip(PT, [0.9, 1.4, 1.6, 1.9, 2.3, 2.3, 2.6, 2.8, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 2.6, 1.9, 1.4, -1.0, -3.5, -3.7])
    }
  ];
  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function vel(tr, t) {
    const e = 0.04;
    return [(tr.X(t + e) - tr.X(t - e)) / (2 * e), (tr.Z(t + e) - tr.Z(t - e)) / (2 * e)];
  }
  // precomputed gait phase tables (deterministic, sampled by absolute time)
  const DT = 1 / 200, NT = Math.ceil(19 / DT) + 2;
  for (const tr of tracks) {
    const ph = new Float32Array(NT);
    let p = 0;
    for (let i = 0; i < NT; i++) {
      ph[i] = p;
      const t = i * DT;
      const v = vel(tr, t), s = Math.hypot(v[0], v[1]);
      const run = smooth(1.3, 2.0, s);
      const len = tr.P.c.walkLen + (tr.P.c.runLen - tr.P.c.walkLen) * run;
      p += (s / len) * DT * 2 * Math.PI;
    }
    tr.phase = ph;
  }
  function phaseAt(tr, t) {
    const f = Math.max(0, t) / DT, i = Math.min(NT - 2, Math.floor(f)), u = Math.min(1, f - i);
    return tr.phase[i] * (1 - u) + tr.phase[i + 1] * u;
  }

  function posePerson(tr, t) {
    const P = tr.P, c = P.c;
    const x = tr.X(t), z = tr.Z(t);
    const v = vel(tr, t), s = Math.hypot(v[0], v[1]);
    let heading;
    if (s > 0.05) heading = Math.atan2(v[0], v[1]);
    else heading = Math.PI; // facing into the maze
    const run = smooth(1.3, 2.0, s);
    const moving = smooth(0.05, 0.5, s);
    const ph = phaseAt(tr, t);
    const sn = Math.sin(ph), cs = Math.cos(ph);
    const thA = (0.36 + 0.4 * run) * moving;
    const kB = 0.06 + 0.3 * run, kA = (0.45 + 0.65 * run) * moving;
    const angs = [
      { th: -thA * sn, k: kB + kA * Math.max(0, cs) },
      { th: thA * sn, k: kB + kA * Math.max(0, -cs) }
    ];
    let ext = 0;
    for (let i = 0; i < 2; i++) {
      P.legs[i].thigh.rotation.x = angs[i].th;
      P.legs[i].knee.rotation.x = angs[i].k;
      const e = c.thigh * Math.cos(angs[i].th) + c.shin * Math.cos(angs[i].th + angs[i].k);
      ext = Math.max(ext, e);
    }
    P.pelvis.position.y = ext + 0.06 + 0.03 * run * Math.abs(cs);
    P.torso.rotation.x = 0.04 + 0.2 * run;
    const armSw = (0.3 + 0.35 * run) * moving;
    for (let i = 0; i < 2; i++) {
      const a = P.arms[i];
      const sgn = i === 0 ? 1 : -1;
      a.sh.rotation.x = -c.armFwd * run + sgn * armSw * sn * (c.armFwd > 0.5 ? 0.5 : 1);
      a.sh.rotation.z = a.side * 0.12;
      a.el.rotation.x = -(0.15 + 1.0 * run);
    }
    P.root.position.set(x, 0, z);
    P.root.rotation.y = heading;
    P.root.visible = t < 15.4;
  }

  function update(time, frame) {
    const t = Math.max(0, Math.min(duration, time));
    camera.position.set(camX(t), CAM_Y, CAM_Z);
    camera.rotation.set(PITCH, camYaw(t) * DEG, 0, 'YXZ');
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const tr of tracks) posePerson(tr, t);
  }

  update(0, 0);
  return { scene, camera, update };
}
