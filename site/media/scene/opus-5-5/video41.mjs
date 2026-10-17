// CineRecon Three.js sampled-frame baseline - L1 proxy reconstruction of video41.
// Single continuous night shot: over-the-shoulder from behind a man (foreground,
// image-left) toward a woman wrapped in a red shawl (mid-ground, image-right),
// lit by an off-screen fire. The man slowly turns his head to image-right and
// looks down; the camera tilts down slightly in the second half.

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const FPS = fps || 24000 / 1001;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060403);

  // ---------- deterministic helpers ----------
  let rs = (seed >>> 0) || 12345;
  function rand() {
    rs = (rs * 1664525 + 1013904223) >>> 0;
    return rs / 4294967296;
  }
  const deg = Math.PI / 180;
  const SAMPLE_FRAMES = [0, 9, 18, 27, 37, 46, 55, 64, 73, 82, 91, 100, 110, 119, 128, 137, 146, 155, 164, 173, 183, 192, 201, 210];
  const ts = (i) => SAMPLE_FRAMES[i] / FPS;

  // Monotone cubic (Fritsch-Carlson) track over [time, value] keys.
  function track(keys) {
    const n = keys.length;
    const T = keys.map((k) => k[0]);
    const V = keys.map((k) => k[1]);
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((V[i + 1] - V[i]) / (T[i + 1] - T[i]));
    const m = new Array(n).fill(0);
    if (n > 1) {
      m[0] = d[0];
      m[n - 1] = d[n - 2];
    }
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
      } else {
        const a = m[i] / d[i];
        const b = m[i + 1] / d[i];
        const s = a * a + b * b;
        if (s > 9) {
          const tau = 3 / Math.sqrt(s);
          m[i] = tau * a * d[i];
          m[i + 1] = tau * b * d[i];
        }
      }
    }
    return function (t) {
      if (t <= T[0]) return V[0];
      if (t >= T[n - 1]) return V[n - 1];
      let i = 0;
      while (i < n - 2 && t > T[i + 1]) i++;
      const h = T[i + 1] - T[i];
      const u = (t - T[i]) / h;
      const u2 = u * u;
      const u3 = u2 * u;
      return (
        (2 * u3 - 3 * u2 + 1) * V[i] +
        (u3 - 2 * u2 + u) * h * m[i] +
        (-2 * u3 + 3 * u2) * V[i + 1] +
        (u3 - u2) * h * m[i + 1]
      );
    };
  }
  const sk = (pairs) => track(pairs.map(([i, v]) => [ts(i), v]));

  function mat(hex, rough = 0.9) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0 });
  }
  function mesh(geo, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    return m;
  }

  // ---------- camera ----------
  const CAM_Y = 1.25;
  const camera = new THREE.PerspectiveCamera(18, width / height, 0.05, 60);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, CAM_Y, 0);
  scene.add(camera);

  // Thin letterbox bars present in the reference (attached to the camera).
  {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false, depthWrite: false });
    const dist = 0.5;
    const fh = 2 * dist * Math.tan(9 * deg);
    const fw = fh * (width / height);
    const bh = fh * (10 / 540);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(fw * 1.2, bh * 2), barMat);
    top.position.set(0, fh / 2, -dist);
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(fw * 1.2, bh * 2), barMat);
    bot.position.set(0, -fh / 2, -dist);
    top.renderOrder = bot.renderOrder = 999;
    camera.add(top);
    camera.add(bot);
  }

  // ---------- environment ----------
  // dark ground (kept very dark so no horizon line shows in the night background)
  const ground = mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0x050302 }), 0, 0, -5);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ---------- lights (off-screen campfire between the two people) ----------
  const ambient = new THREE.AmbientLight(0x2a1c14, 0.2);
  scene.add(ambient);
  // fire key, low in front of the woman
  const fire = new THREE.PointLight(0xffd6b4, 4.2, 0, 2);
  fire.position.set(0.15, 0.6, -2.6);
  scene.add(fire);
  // warm side light raking the camera-facing side of the man's head
  const fire2 = new THREE.PointLight(0xffc8a0, 0.42, 0, 2);
  fire2.position.set(0.33, 1.25, -1.12);
  scene.add(fire2);

  // ---------- woman (mid-ground, image right) ----------
  const W_Z = -4.2;
  const woman = new THREE.Group();
  woman.position.set(0, 0, W_Z);
  scene.add(woman);

  const wSkin = mat(0xf0c8aa);
  const wHair = mat(0xd8b888);
  const shawlMat = mat(0xc0644c, 1.0);
  const fringeMat = mat(0xc8a07c, 1.0);
  const trouserMat = mat(0xd8bc98);

  // trousers / legs (beige), reach the ground
  const legs = mesh(new THREE.CylinderGeometry(0.19, 0.17, 1.02, 16), trouserMat, 0.39, 0.51, 0);
  legs.scale.z = 0.6;
  woman.add(legs);

  // upper shawl body (frustum, flattened in depth)
  const shawlTop = mesh(new THREE.CylinderGeometry(0.26, 0.38, 0.51, 20), shawlMat, 0.41, 1.13, 0.02);
  shawlTop.scale.z = 0.55;
  woman.add(shawlTop);
  // rounded shoulders of the shawl
  const shoulders = mesh(new THREE.SphereGeometry(0.26, 20, 12), shawlMat, 0.41, 1.34, 0.02);
  shoulders.scale.set(1.0, 0.22, 0.55);
  woman.add(shoulders);
  // hanging side panels (open front shows the trousers)
  const panelL = mesh(new THREE.BoxGeometry(0.16, 0.26, 0.08), shawlMat, 0.12, 0.75, 0.13);
  woman.add(panelL);
  const panelR = mesh(new THREE.BoxGeometry(0.24, 0.28, 0.08), shawlMat, 0.64, 0.745, 0.11);
  woman.add(panelR);
  const fringeL = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.081), fringeMat, 0.12, 0.6, 0.13);
  woman.add(fringeL);
  const fringeR = mesh(new THREE.BoxGeometry(0.24, 0.04, 0.081), fringeMat, 0.64, 0.585, 0.11);
  woman.add(fringeR);

  // collar: white shirt + tan coat collar (visible in the V above the shawl)
  const shirt = mesh(new THREE.BoxGeometry(0.12, 0.11, 0.05), mat(0xf4ead8), 0.37, 1.385, 0.12);
  woman.add(shirt);
  const coatCollar = mesh(new THREE.BoxGeometry(0.11, 0.1, 0.05), mat(0xb89670), 0.25, 1.37, 0.11);
  coatCollar.rotation.z = 0.35;
  woman.add(coatCollar);

  // head group (pivot at neck) for slight talking/head motion
  const wHead = new THREE.Group();
  wHead.position.set(0.355, 1.38, 0.02);
  woman.add(wHead);
  const wNeck = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), wSkin, 0, 0.0, 0);
  wHead.add(wNeck);
  const hair = mesh(new THREE.SphereGeometry(1, 20, 14), wHair, 0, 0.145, -0.03);
  hair.scale.set(0.15, 0.16, 0.11);
  wHead.add(hair);
  const face = mesh(new THREE.SphereGeometry(1, 20, 14), wSkin, 0, 0.13, 0.03);
  face.scale.set(0.082, 0.108, 0.075);
  wHead.add(face);

  // ---------- man (foreground, image left, back to camera) ----------
  const M_Z = -1.25;
  const man = new THREE.Group();
  man.position.set(0, 0, M_Z);
  scene.add(man);
  const mSkin = mat(0xa06a4c);
  const mHair = mat(0x3c2a1c, 0.7);
  const mCloth = mat(0x0e0a08, 1.0);

  const torso = mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.6, 20), mCloth, -0.4, 0.8, 0.0);
  torso.scale.z = 0.55;
  man.add(torso);
  const shoulderR = mesh(new THREE.SphereGeometry(1, 16, 10), mCloth, -0.22, 1.08, 0.0);
  shoulderR.scale.set(0.08, 0.05, 0.12);
  man.add(shoulderR);

  const mNeckPivot = new THREE.Group(); // neck base; head yaws/pitches about this point
  mNeckPivot.rotation.order = 'YXZ';
  mNeckPivot.position.set(-0.238, 1.135, 0);
  man.add(mNeckPivot);
  const mNeck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 12), mSkin, 0, 0.03, 0.01);
  mNeckPivot.add(mNeck);
  const skull = mesh(new THREE.SphereGeometry(1, 24, 16), mSkin, 0, 0.115, 0);
  skull.scale.set(0.072, 0.112, 0.098);
  mNeckPivot.add(skull);
  // hair: top and back of the head, leaving the face / temple / ear side as skin
  const mHairCap = mesh(new THREE.SphereGeometry(1, 24, 16), mHair, 0, 0.152, 0.022);
  mHairCap.scale.set(0.077, 0.095, 0.097);
  mNeckPivot.add(mHairCap);
  const jaw = mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), mSkin, 0, 0.065, -0.058);
  mNeckPivot.add(jaw);

  // ---------- haze / smoke / breath (soft procedural planes) ----------
  function softTexture() {
    const N = 64;
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (x + 0.5) / N * 2 - 1;
        const dy = (y + 0.5) / N * 2 - 1;
        const r = Math.sqrt(dx * dx + dy * dy);
        const a = Math.max(0, 1 - r);
        const i = (y * N + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.round(255 * a * a * (3 - 2 * a));
      }
    }
    const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }
  const softTex = softTexture();
  function hazePlane(color) {
    const m = new THREE.MeshBasicMaterial({
      color,
      map: softTex,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    scene.add(p);
    return p;
  }
  // low drifting smoke from the fire (between the people, lower frame)
  const smokeA = hazePlane(0xb0a090);
  const smokeB = hazePlane(0xa89888);
  // background haze glow behind the woman
  const bgHaze = hazePlane(0x2a2018);
  bgHaze.position.set(0.6, 1.3, -6.5);
  bgHaze.scale.set(4.0, 2.6, 1);
  bgHaze.material.opacity = 0.12;
  // man's breath plume around 4.8-5.8 s
  const breath = hazePlane(0xc0b0a0);
  const phaseA = rand() * 6.28;
  const phaseB = rand() * 6.28;

  // ---------- animation tracks (keys at reference sample indices) ----------
  // camera pitch (deg, negative = tilt down)
  const camPitch = sk([
    [0, 0], [4, -0.3], [14, -0.32], [15, -0.52], [16, -0.76], [17, -0.84],
    [18, -1.0], [19, -1.12], [20, -1.18], [21, -1.26], [22, -1.32], [23, -1.4],
  ]);
  // woman lateral sway in reference pixels (960-wide scale), converted to metres
  const W_PXM = 405.6;
  const womanX = sk([
    [0, 0], [3, 1], [4, 4], [5, 10], [6, 17], [7, 18], [8, 18], [9, 16], [10, 13], [11, 12],
    [12, 10], [13, 10], [14, 7], [15, 4], [16, 0], [17, -3], [18, -5], [19, -7], [23, -7],
  ]);
  const womanRoll = sk([
    [0, 0], [3, 1], [4, 3], [5, 4], [6, 2], [8, 0], [11, -1], [14, 0], [23, 0],
  ]);
  // man head: lateral position (px of 960 scale at his depth), yaw (deg right), pitch (deg)
  const M_PXM = 1364;
  const manHeadPx = sk([
    [0, 156], [4, 158], [8, 160], [11, 162], [12, 163], [13, 166], [14, 171], [15, 174],
    [16, 176], [17, 177], [23, 178],
  ]);
  const manYaw = sk([
    [0, 20], [4, 22], [8, 24], [11, 26], [12, 28], [13, 37], [14, 47], [15, 54], [16, 58],
    [17, 60], [23, 61],
  ]);
  const manPitch = sk([
    [0, -5], [12, -6], [13, -10], [14, -16], [15, -22], [16, -25], [23, -26],
  ]);

  function update(time, frame) {
    const t = Math.max(0, time);

    camera.position.set(0, CAM_Y, 0);
    camera.rotation.set(camPitch(t) * deg, 0, 0, 'YXZ');
    camera.updateMatrixWorld(true);

    // woman
    woman.position.set(womanX(t) / W_PXM, 0, W_Z);
    wHead.rotation.set(0, 0, -womanRoll(t) * deg);
    // gentle breathing of the shawl
    const br = 1 + 0.006 * Math.sin(t * 2 * Math.PI * 0.3);
    shawlTop.scale.set(br, 1, 0.55 * br);

    // man
    const hx = (manHeadPx(t) - 480) / M_PXM;
    mNeckPivot.position.set(hx, 1.135, 0);
    mNeckPivot.rotation.set(manPitch(t) * deg, -manYaw(t) * deg, 0, 'YXZ');

    // fire flicker (deterministic)
    fire.intensity = 4.2 * (1 + 0.04 * Math.sin(t * 13.0 + phaseA) + 0.03 * Math.sin(t * 29.0 + phaseB));

    // smoke A: rises and drifts right across lower middle
    {
      const c = (t * 0.11) % 1;
      smokeA.position.set(-0.25 + 0.5 * c, 0.85 + 0.25 * c, -2.0);
      smokeA.scale.set(0.9 + 0.5 * c, 0.45 + 0.2 * c, 1);
      smokeA.material.opacity = 0.11 * Math.sin(Math.PI * c);
      const c2 = (t * 0.09 + 0.5) % 1;
      smokeB.position.set(-0.1 + 0.6 * c2, 0.9 + 0.35 * c2, -2.6);
      smokeB.scale.set(1.1 + 0.6 * c2, 0.55 + 0.3 * c2, 1);
      smokeB.material.opacity = 0.09 * Math.sin(Math.PI * c2);
    }

    // breath plume from the man, ~4.75 s to ~5.9 s
    {
      const b0 = 4.75;
      const b1 = 5.9;
      if (t > b0 && t < b1) {
        const u = (t - b0) / (b1 - b0);
        breath.visible = true;
        breath.position.set(hx + 0.13 + 0.25 * u, 1.2 + 0.04 * u, -1.6 - 0.3 * u);
        breath.scale.set(0.18 + 0.35 * u, 0.08 + 0.08 * u, 1);
        breath.material.opacity = 0.22 * Math.sin(Math.PI * u);
      } else {
        breath.visible = false;
        breath.material.opacity = 0;
      }
    }
  }

  update(0, 0);
  return { scene, camera, update };
}
