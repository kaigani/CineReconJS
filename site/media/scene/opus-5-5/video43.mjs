// CineRecon L1 proxy reconstruction - video43
// Single continuous shot: camera fixed on an overpass above a desert highway,
// tilting up from a steep down-view of the road to a near-horizontal sunset view
// while a yellow/white van drives away from beneath the camera in the right lane.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();

  // ---------- camera ----------
  const FPX = 2100; // focal length in px for a 720-px-tall frame
  const VFOV = (2 * Math.atan(360 / FPX) * 180) / Math.PI;
  const camera = new THREE.PerspectiveCamera(VFOV, width / height, 0.5, 30000);
  const CAM_X = -0.25;
  const CAM_H = 8.7;
  camera.position.set(CAM_X, CAM_H, 0);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  // ---------- seeded RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32((seed | 0) + 4343);

  const col = (r, g, b) => (THREE.SRGBColorSpace
    ? new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace)
    : new THREE.Color(r / 255, g / 255, b / 255));
  // materials affected by the global exposure ramp are registered here
  const exposed = [];
  const basic = (r, g, b, extra = {}) => {
    const m = new THREE.MeshBasicMaterial({ color: col(r, g, b), toneMapped: false, ...extra });
    if (extra.fog !== false) exposed.push([m, m.color.clone()]);
    return m;
  };

  // ---------- fog ----------
  scene.fog = new THREE.Fog(col(70, 54, 47), 30, 3000);
  scene.background = col(92, 60, 52);

  // ---------- ground strips (cross-section of highway & desert) ----------
  const Z_NEAR = 80, Z_FAR = -12000;
  const pos = [], cols = [];
  // sheen: near pavement (seen steeply from above) is darker than distant pavement
  // seen at grazing angles; vertex brightness ramps with distance ahead of the camera.
  const sstep = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const gain = (z, sheen) => Math.pow(1 - sheen + sheen * sstep(16, 100, -z), 2.2);
  function quad1(x0, x1, z0, z1, c, sheen, y = 0) {
    const g0 = gain(z0, sheen), g1 = gain(z1, sheen);
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1);
    const gs = [g0, g0, g1, g0, g1, g1];
    for (let i = 0; i < 6; i++) cols.push(c.r * gs[i], c.g * gs[i], c.b * gs[i]);
  }
  const ZB = [80, 10, 0, -8, -12, -16, -20, -25, -30, -35, -40, -45, -50, -55, -60, -66, -72, -80, -90, -100, -12000];
  function quad(x0, x1, z0, z1, c, sheen = 0) {
    if (sheen === 0) { quad1(x0, x1, z0, z1, c, 0); return; }
    // split along z at the breakpoints inside [z1, z0]
    const cuts = [z0, ...ZB.filter((z) => z < z0 && z > z1), z1];
    for (let i = 0; i < cuts.length - 1; i++) quad1(x0, x1, cuts[i], cuts[i + 1], c, sheen);
  }
  const C = {
    desert: col(92, 64, 42),
    desertFar: col(56, 46, 37),
    gravel: col(50, 55, 51),
    shoulder: col(56, 60, 57),
    rumble: col(36, 40, 38),
    asphalt: col(66, 68, 64),
    yellow: col(170, 135, 55),
    white: col(165, 165, 158),
    road2: col(62, 62, 60),
  };
  // strips: [x0, x1, color, sheen]
  const strips = [
    [-14000, -67.5, C.desertFar, 0],
    [-67.5, -57.5, C.road2, 0],
    [-57.5, -8.0, C.desert, 0],
    [-8.0, -5.3, C.gravel, 0.1],
    [-5.3, -4.9, C.shoulder, 0.25],
    [-4.9, -4.05, C.rumble, 0.2],
    [-4.05, -3.80, C.shoulder, 0.25],
    [-3.80, -3.65, C.yellow, 0.3],
    [-3.65, -0.07, C.asphalt, 0.42],
    [0.07, 3.65, C.asphalt, 0.42],
    [3.65, 3.80, C.white, 0.3],
    [3.80, 4.35, C.shoulder, 0.25],
    [4.35, 5.75, C.rumble, 0.2],
    [5.75, 6.8, C.shoulder, 0.25],
    [6.8, 9.0, C.gravel, 0.1],
    [9.0, 14000, C.desert, 0],
  ];
  for (const [x0, x1, c, sh] of strips) quad(x0, x1, Z_NEAR, Z_FAR, c, sh);
  // centre dashed line: 3.05 m dash per 12.2 m period
  const PERIOD = 12.2, DASH = 3.05, PHASE = -17.6;
  for (let k = -6; k < 260; k++) {
    const zs = PHASE - k * PERIOD; // near end of dash (z negative = ahead)
    const ze = zs - DASH;
    const zg = ze - (PERIOD - DASH);
    quad(-0.07, 0.07, zs, ze, C.white, 0.3);
    quad(-0.07, 0.07, ze, zg, C.asphalt, 0.42);
  }
  quad(-0.07, 0.07, Z_NEAR, PHASE + 6 * PERIOD, C.asphalt, 0.42);
  quad(-0.07, 0.07, PHASE - 260 * PERIOD, Z_FAR, C.asphalt, 0.42);
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  gGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const groundMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  exposed.push([groundMat, new THREE.Color(1, 1, 1)]);
  const ground = new THREE.Mesh(gGeo, groundMat);
  scene.add(ground);

  // ---------- shrubs (instanced flattened spheres) ----------
  const shrubSpecs = [];
  function addShrubs(n, xa, xb, za, zb, smin, smax) {
    for (let i = 0; i < n; i++) {
      const x = xa + (xb - xa) * rand();
      const z = za + (zb - za) * Math.pow(rand(), 1.4);
      const s = smin + (smax - smin) * rand();
      shrubSpecs.push([x, z, s, rand()]);
    }
  }
  addShrubs(440, 9.5, 24, -5, -900, 0.9, 2.0);   // dense right roadside band
  addShrubs(150, 24, 60, -5, -900, 0.8, 1.8);
  addShrubs(300, -20, -8.5, -5, -900, 0.8, 1.6); // left roadside band
  addShrubs(320, 60, 600, -20, -2500, 1.0, 2.4);   // sparse right desert
  addShrubs(400, -600, -22, -20, -2500, 1.0, 2.4); // sparse left desert
  const shrubGeo = new THREE.SphereGeometry(1, 10, 6);
  const shrubMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  exposed.push([shrubMat, new THREE.Color(1, 1, 1)]);
  const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubSpecs.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const tmpc = new THREE.Color();
  shrubSpecs.forEach(([x, z, s, r], i) => {
    m4.compose(new THREE.Vector3(x, 0.15 * s, z), q, new THREE.Vector3(s * 1.3, s * 0.55, s));
    shrubs.setMatrixAt(i, m4);
    const v = 0.8 + 0.4 * r;
    tmpc.copy(col(28 * v, 36 * v, 15 * v));
    shrubs.setColorAt(i, tmpc);
  });
  shrubs.instanceMatrix.needsUpdate = true;
  if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
  scene.add(shrubs);

  // ---------- mountains ----------
  const deg = Math.PI / 180;
  const MR = 10000;
  function mountain(azDeg, hDeg, wDeg, c) {
    const h = MR * Math.tan(hDeg * deg);
    const r = MR * Math.tan(wDeg * deg);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h + 40, 24, 1), new THREE.MeshBasicMaterial({ color: col(c[0], c[1], c[2]), fog: false, toneMapped: false }));
    const a = azDeg * deg;
    m.position.set(MR * Math.sin(a), (h + 40) / 2 - 40, -MR * Math.cos(a));
    scene.add(m);
  }
  const mR = [112, 64, 62], mM = [120, 78, 78], mL = [96, 84, 98];
  mountain(8.6, 0.78, 2.6, mR);
  mountain(10.4, 0.55, 2.2, mR);
  mountain(11.6, 0.68, 2.4, mR);
  mountain(13.6, 0.45, 2.2, mR);
  mountain(15.2, 0.6, 2.6, mR);
  mountain(17.8, 0.5, 2.8, mR);
  mountain(1.4, 0.28, 1.6, mM);
  mountain(4.0, 0.2, 3.5, mM);
  mountain(-4.5, 0.16, 3.5, mL);
  mountain(-8.5, 0.22, 3.2, mL);
  mountain(-12.5, 0.18, 3.5, mL);
  mountain(-16.5, 0.15, 3.5, mL);
  // continuous low distant ridge along the left horizon
  {
    const rr = 9000, hh = rr * Math.tan(0.16 * deg);
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(rr, rr, hh + 40, 64, 1, true, Math.PI + 2 * deg, 22 * deg),
      new THREE.MeshBasicMaterial({ color: col(72, 66, 74), fog: false, toneMapped: false, side: THREE.DoubleSide }));
    ridge.position.set(0, (hh + 40) / 2 - 40, 0);
    scene.add(ridge);
  }

  // ---------- sky dome (procedural shader, sRGB output) ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vDir = normalize(wp.xyz - cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }
      vec3 rgb(float r, float g, float b){ return vec3(r,g,b)/255.0; }
      void main(){
        vec3 d = normalize(vDir);
        float el = degrees(asin(clamp(d.y,-1.0,1.0)));
        float az = degrees(atan(d.x, -d.z));
        float sunAz = 10.7, sunEl = 3.85;
        vec3 low = mix(rgb(185.0,122.0,114.0), rgb(222.0,150.0,124.0), smoothstep(-9.0,-3.0,az));
        low = mix(low, rgb(250.0,245.0,190.0), smoothstep(-4.0, 4.0, az));
        vec3 mid = mix(rgb(100.0,86.0,92.0), rgb(165.0,118.0,104.0), smoothstep(-14.0,-3.0,az));
        mid = mix(mid, rgb(235.0,172.0,138.0), smoothstep(-2.0, 6.0, az));
        vec3 top = mix(rgb(68.0,68.0,80.0), rgb(165.0,138.0,114.0), smoothstep(-15.0,-5.0,az));
        top = mix(top, rgb(160.0,124.0,102.0), smoothstep(4.0, 10.0, az));
        top = mix(top, rgb(240.0,222.0,180.0), smoothstep(12.0, 17.0, az));
        vec3 c = mix(low, mid, smoothstep(1.2, 2.0, el));
        c = mix(c, top, smoothstep(3.2, 6.8, el));
        c = mix(c, rgb(70.0,64.0,78.0), smoothstep(7.0, 14.0, el));
        float n = noise(vec2(az*0.35, el*2.2))*0.6 + noise(vec2(az*1.3, el*7.0))*0.4;
        float band = exp(-pow((el-3.5)/0.3, 2.0)) * smoothstep(-8.0, -4.0, az) * (1.0 - smoothstep(8.0, 10.5, az));
        c = mix(c, rgb(140.0,100.0,98.0), clamp(band*0.9*(0.6+0.4*n), 0.0, 0.85));
        c *= 0.88 + 0.24*n;
        c *= 0.87;
        vec2 sd = vec2((az-sunAz)/3.4, (el-sunEl)/1.0);
        float s = exp(-dot(sd,sd));
        float s2 = exp(-length(vec2((az-sunAz)/9.0, (el-sunEl)/5.0)));
        c = mix(c, rgb(254.0,254.0,215.0), clamp(1.4*s, 0.0, 1.0));
        c += rgb(60.0,40.0,20.0) * s2;
        c = mix(c, rgb(252.0,252.0,200.0), clamp(exp(-pow((az-8.0)/7.0,2.0)) * (1.0 - smoothstep(0.4, 2.2, el)) * 0.9, 0.0, 1.0));
        if (el < 0.0) c = mix(c, rgb(92.0,60.0,52.0), clamp(-el*6.0,0.0,1.0));
        // thin dark streak crossing the right sky just under the sun
        float streak = exp(-pow((el-(sunEl-0.75))/0.18, 2.0)) * smoothstep(13.0, 16.0, az);
        c = mix(c, rgb(150.0,100.0,95.0), clamp(streak*0.7*(0.6+0.4*n), 0.0, 0.7));
        gl_FragColor = vec4(min(c, vec3(1.0)), 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(20000, 64, 32), skyMat);
  sky.position.copy(camera.position);
  sky.renderOrder = -10;
  scene.add(sky);

  // ---------- vehicle builders ----------
  function boxMat6(cSide, cTop, cBack, cFront) {
    // order: +x, -x, +y, -y, +z, -z
    return [basic(...cSide), basic(...cSide), basic(...cTop), basic(15, 15, 15), basic(...cBack), basic(...cFront)];
  }
  function box(w, h, l, mats, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mats);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  const wheelMat = basic(25, 25, 25);
  function wheel(parent, x, z, r, w) {
    const piv = new THREE.Group();
    piv.position.set(x, r, z);
    const m = new THREE.Mesh(wheelGeo, wheelMat);
    m.scale.set(r, w, r);
    m.rotation.z = Math.PI / 2;
    piv.add(m);
    parent.add(piv);
    return piv;
  }

  // Van (VW-bus proxy): origin = rear-bottom centre, body extends toward -z (forward)
  const van = new THREE.Group();
  const VL = 4.5, VW = 1.72;
  box(VW, 0.95, VL, boxMat6([70, 60, 10], [120, 100, 30], [62, 54, 8], [120, 100, 30]), 0, 0.3 + 0.475, -VL / 2, van);
  box(VW - 0.06, 0.68, VL - 0.15, boxMat6([120, 122, 116], [242, 228, 216], [108, 118, 114], [200, 190, 180]), 0, 1.25 + 0.34, -VL / 2 - 0.08, van);
  box(VW - 0.36, 0.34, 0.04, basic(8, 17, 12), 0, 1.58, -0.06, van); // rear window
  box(0.03, 0.36, VL - 0.9, basic(30, 34, 34), VW / 2 - 0.02, 1.6, -VL / 2, van);
  box(0.03, 0.36, VL - 0.9, basic(30, 34, 34), -VW / 2 + 0.02, 1.6, -VL / 2, van);
  box(VW + 0.04, 0.12, 0.12, basic(110, 112, 108), 0, 0.38, 0.0, van); // bumper
  box(0.16, 0.22, 0.04, basic(70, 14, 8), VW / 2 - 0.15, 0.95, 0.01, van);
  box(0.16, 0.22, 0.04, basic(70, 14, 8), -VW / 2 + 0.15, 0.95, 0.01, van);
  const vanWheels = [
    wheel(van, VW / 2 - 0.12, -0.75, 0.34, 0.22), wheel(van, -VW / 2 + 0.12, -0.75, 0.34, 0.22),
    wheel(van, VW / 2 - 0.12, -VL + 0.85, 0.34, 0.22), wheel(van, -VW / 2 + 0.12, -VL + 0.85, 0.34, 0.22),
  ];
  van.position.set(1.85, 0, 0);
  scene.add(van);

  // White SUV-like car ahead in left lane
  const wheelSets = new Map();
  function car(cBody, cTop, cBack, len, wid, hgt, lights) {
    const g = new THREE.Group();
    box(wid, hgt * 0.45, len, boxMat6(cBody, cTop, cBack, cTop), 0, 0.28 + hgt * 0.225, -len / 2, g);
    box(wid - 0.1, hgt * 0.4, len * 0.62, boxMat6(cBody, cTop, cBack, cTop), 0, 0.28 + hgt * 0.45 + hgt * 0.2, -len * 0.45, g);
    box(wid - 0.3, hgt * 0.28, 0.04, basic(20, 22, 22), 0, 0.28 + hgt * 0.65, -len * 0.45 + len * 0.31 + 0.01, g);
    if (lights === 'tail') {
      box(0.2, 0.14, 0.04, basic(110, 25, 20), wid / 2 - 0.15, 0.28 + hgt * 0.35, 0.01, g);
      box(0.2, 0.14, 0.04, basic(110, 25, 20), -wid / 2 + 0.15, 0.28 + hgt * 0.35, 0.01, g);
    } else if (lights === 'head') {
      box(0.35, 0.25, 0.05, basic(255, 245, 215, { fog: false }), wid / 2 - 0.2, 0.6, -len - 0.01, g);
      box(0.35, 0.25, 0.05, basic(255, 245, 215, { fog: false }), -wid / 2 + 0.2, 0.6, -len - 0.01, g);
    }
    const ws = [
      wheel(g, wid / 2 - 0.1, -0.8, 0.33, 0.2), wheel(g, -wid / 2 + 0.1, -0.8, 0.33, 0.2),
      wheel(g, wid / 2 - 0.1, -len + 0.9, 0.33, 0.2), wheel(g, -wid / 2 + 0.1, -len + 0.9, 0.33, 0.2),
    ];
    wheelSets.set(g, ws);
    scene.add(g);
    return g;
  }
  const whiteCar = car([110, 106, 106], [162, 150, 146], [84, 96, 96], 4.7, 1.85, 1.7, 'tail');
  whiteCar.position.x = -1.85;

  // distant truck far ahead (dark box near vanishing point)
  const farTruck = new THREE.Group();
  box(2.5, 3.6, 15, basic(45, 40, 38), 0, 2.0, -7.5, farTruck);
  farTruck.position.x = -1.85;
  scene.add(farTruck);

  // Semi-truck on the far (opposite) carriageway, oncoming (front toward +z)
  const semi = new THREE.Group();
  box(2.6, 3.9, 15.5, boxMat6([120, 122, 122], [140, 130, 132], [90, 95, 95], [90, 95, 95]), 0, 0.6 + 1.95, -2.0 - 7.75, semi); // trailer behind cab
  box(2.5, 2.8, 2.6, boxMat6([95, 98, 98], [120, 115, 115], [60, 65, 65], [60, 65, 65]), 0, 0.5 + 1.4, -1.3, semi); // cab (front toward +z)
  semi.rotation.y = 0; // front faces +z (cab at smallest +z offset)
  semi.position.x = -61;
  scene.add(semi);

  // Oncoming cars with headlights on far carriageway (rotate 180 so front faces +z)
  const oncoming = [];
  const oncomingSpecs = [
    { lat: -60.5, d0: 368, t0: 2.13, v: 30.5 },
    { lat: -61.5, d0: 560, t0: 2.13, v: 30 },
    { lat: -60.5, d0: 820, t0: 2.13, v: 31 },
    { lat: -64.5, d0: 300, t0: 0, v: 28 },
  ];
  for (const s of oncomingSpecs) {
    const g = car([40, 40, 42], [60, 58, 60], [40, 40, 42], 4.5, 1.8, 1.5, 'head');
    g.rotation.y = Math.PI;
    g.position.x = s.lat;
    oncoming.push([g, s]);
  }

  // ---------- letterbox bars (camera-attached, 2.40:1) ----------
  const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  const BAR_D = 0.6;
  const halfH = BAR_D * Math.tan((VFOV / 2) * deg);
  const halfW = halfH * (width / height);
  const activeHalf = halfH * ((width / 2.4) / height);
  const barH = halfH - activeHalf;
  for (const sgn of [1, -1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2.4, barH * 1.02), barMat);
    b.position.set(0, sgn * (activeHalf + barH * 0.51), -BAR_D);
    b.renderOrder = 100;
    camera.add(b);
  }

  // ---------- timing curves ----------
  // horizon offset (px above frame centre, 720-px frame) observed per reference sample
  const KT = [0, 0.2085, 0.4171, 0.6256, 0.8342, 1.0427, 1.293, 1.5015, 1.71, 1.9186, 2.1271, 2.3357, 2.5442,
    2.7528, 2.9613, 3.1698, 3.3784, 3.5869, 3.8372, 4.0457, 4.2543, 4.4628, 4.6713, 4.8799];
  const KO = [823, 820, 732, 639, 532, 420, 325, 229, 180, 149, 119, 99, 80, 67, 55, 44, 36, 31, 25, 23, 21, 20, 20, 20];
  const KP = KO.map((o) => Math.atan(o / FPX));
  // monotone cubic (Fritsch-Carlson)
  function monotone(xs, ys) {
    const n = xs.length, dx = [], m = [], tg = new Array(n);
    for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); m.push((ys[i + 1] - ys[i]) / dx[i]); }
    tg[0] = m[0]; tg[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) tg[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
      const a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); tg[i] = t * a * m[i]; tg[i + 1] = t * b * m[i]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
      const h = dx[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * tg[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * tg[i + 1];
    };
  }
  const pitchAt = monotone(KT, KP);
  const P0 = KP[0];

  // van rear distance: constant ~25.7 m/s, passing beneath the camera just before t=0
  function vanDist(t) { return 4.8 + 26.0 * t; }

  function setWheels(ws, d, r) { for (const w of ws) w.rotation.x = -d / r; }

  function update(time, frame) {
    const t = Math.max(0, Math.min(time, duration));
    // camera tilt (pan slightly with tilt)
    const p = pitchAt(t);
    camera.position.set(CAM_X, CAM_H, 0);
    camera.rotation.set(-p, -(0.8 + 0.45 * (p / P0)) * deg, 0, 'YXZ');
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    // global exposure ramp (ground/vehicles darker in the early down-view)
    const k = 1.0 + 0.06 * Math.min(1, Math.max(0, (t - 1.4) / 3.0));
    for (const [m, c0] of exposed) m.color.setRGB(c0.r * k, c0.g * k, c0.b * k);

    // van (rear at distance D ahead of camera foot)
    const dv = vanDist(t);
    van.position.z = -dv;
    setWheels(vanWheels, dv, 0.34);

    const dw = 148 + 35 * (t - 2.13);
    whiteCar.position.z = -dw;
    setWheels(wheelSets.get(whiteCar), dw, 0.33);

    farTruck.position.z = -(650 + 28 * t);

    const ds = 234 - 35 * (t - 1.29); // front of semi
    semi.position.z = -ds;

    for (const [g, s] of oncoming) {
      const d = s.d0 - s.v * (t - s.t0);
      g.position.z = -d; // group origin at its rear (rotated), approximate
      setWheels(wheelSets.get(g), -d, 0.33);
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
