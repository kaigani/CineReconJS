// CineRecon Three.js sampled-frame baseline, L1 proxy reconstruction of video19.
// Studio: mannequin head on a white two-tier turntable, white backlit backdrop,
// LED light bars on a stand, a Nikon-style camera on a tripod, and an operator's arm.
// Four shots: A (over-the-shoulder close, menu on LCD), B (wider, operator reaches to camera),
// C (low frontal close, turntable starts rotating), D (front medium-wide, letterboxed).

export function createScene({ THREE, width, height, fps, duration, seed }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x24272a);
  const aspect = width / height;
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.01, 60);
  scene.add(camera);

  const std = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------------- Lights ----------------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x35383b, 1.1));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(0.6, 2.2, 1.6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(0.0, 1.2, -2.0);
  scene.add(rim);

  // ---------------- Room ----------------
  const wallMat = std(0x3b4346, 0.95);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), wallMat);
  backWall.position.set(0, 1.0, -0.85);
  scene.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), std(0x353c3f, 0.95));
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.6, 1.0, 1.5);
  scene.add(leftWall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), std(0x1f2124, 0.95));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.75, 1.5);
  scene.add(floor);

  // Table (marble-white top); top surface at y = 0
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 1.95), std(0xc9cbcb, 0.6));
  table.position.set(-0.47, -0.02, 0.225);
  scene.add(table);

  // Backlit white backdrop panel
  const backdropMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  backdropMat.toneMapped = false;
  const backdrop = new THREE.Mesh(new THREE.BoxGeometry(0.93, 0.69, 0.01), backdropMat);
  backdrop.position.set(-0.025, 0.335, -0.5);
  scene.add(backdrop);

  // Light stand (right) + LED bars
  const blackMat = std(0x141516, 0.6, 0.2);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 12), blackMat);
  stand.position.set(0.44, 0.2, 0.05);
  scene.add(stand);
  const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), blackMat);
  clamp1.position.set(0.44, 0.4, 0.05);
  scene.add(clamp1);
  const clamp2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.04), blackMat);
  clamp2.position.set(0.44, 0.78, 0.05);
  scene.add(clamp2);

  const barMat = std(0x232528, 0.5, 0.3);
  function rod(a, b, r, m) {
    const d = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 14), m);
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(1, d.length(), 1);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
    return mesh;
  }
  const bar1A = V(-0.1, 0.575, -0.15), bar1B = V(0.24, 0.63, -0.15);
  scene.add(rod(bar1A, bar1B, 0.022, barMat));
  scene.add(rod(bar1B, V(0.44, 0.78, 0.05), 0.006, blackMat));
  scene.add(rod(V(-0.21, 0.63, 0.3), V(0.18, 0.63, 0.3), 0.03, barMat));

  // ---------------- Turntable + mannequin head ----------------
  const ttWhite = std(0xe4e6e6, 0.55);
  const ttBase = new THREE.Mesh(new THREE.CylinderGeometry(0.295, 0.295, 0.057, 64), ttWhite);
  ttBase.position.set(0, 0.0285, 0);
  scene.add(ttBase);
  const groove = new THREE.Mesh(new THREE.CylinderGeometry(0.287, 0.287, 0.01, 64), std(0x6d7173, 0.8));
  groove.position.set(0, 0.062, 0);
  scene.add(groove);
  const ctrlAng = 32 * Math.PI / 180;
  const ctrl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 24), std(0x1a1b1d, 0.4));
  ctrl.rotation.x = Math.PI / 2;
  ctrl.rotation.z = -ctrlAng;
  ctrl.position.set(0.297 * Math.sin(ctrlAng), 0.03, 0.297 * Math.cos(ctrlAng));
  // orient its face outward (cylinder axis along radial direction)
  ctrl.quaternion.setFromUnitVectors(V(0, 1, 0), V(Math.sin(ctrlAng), 0, Math.cos(ctrlAng)));
  scene.add(ctrl);

  const spin = new THREE.Group(); // rotating platter + head
  scene.add(spin);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 64), ttWhite);
  platter.position.set(0, 0.0825, 0);
  spin.add(platter);

  const headMat = std(0x4a4e54, 0.42, 0.15);
  const bust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.05, 32), headMat);
  bust.scale.z = 0.55;
  bust.position.set(0, 0.125, -0.005);
  spin.add(bust);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 24), headMat);
  neck.position.set(0, 0.19, -0.008);
  spin.add(neck);
  const sph = new THREE.SphereGeometry(1, 32, 24);
  const cranium = new THREE.Mesh(sph, headMat);
  cranium.scale.set(0.07, 0.09, 0.086);
  cranium.position.set(0, 0.29, -0.01);
  spin.add(cranium);
  const jaw = new THREE.Mesh(sph, headMat);
  jaw.scale.set(0.05, 0.066, 0.06);
  jaw.position.set(0, 0.25, 0.026);
  spin.add(jaw);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(sph, headMat);
    ear.scale.set(0.012, 0.024, 0.017);
    ear.position.set(sx * 0.07, 0.28, -0.01);
    spin.add(ear);
  }

  // ---------------- Nikon-style camera on tripod ----------------
  const nikon = new THREE.Group(); // local +z = lens direction, -z = back/LCD
  const camBlack = std(0x18191b, 0.55, 0.1);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.095, 0.065), camBlack);
  nikon.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.08), camBlack);
  grip.position.set(-0.052, -0.003, 0.012);
  nikon.add(grip);
  const hump = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.024, 0.05), camBlack);
  hump.position.set(0.006, 0.0585, -0.004);
  nikon.add(hump);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.14, 28), std(0x1d1e20, 0.5, 0.2));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.008, 0.002, 0.0325 + 0.07);
  nikon.add(lens);
  const lcdPivot = new THREE.Group();
  lcdPivot.position.set(0.02, 0.012, -0.037);
  lcdPivot.rotation.x = 0.65;
  nikon.add(lcdPivot);
  const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.008), camBlack);
  lcd.position.set(0, -0.0325, 0);
  lcdPivot.add(lcd);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x23272e });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.054), screenMat);
  screen.rotation.y = Math.PI;
  screen.position.set(0, -0.0325, -0.0045);
  lcdPivot.add(screen);
  // menu highlight bars (on screen, slightly in front)
  const yellow = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.0075), new THREE.MeshBasicMaterial({ color: 0xe8c21a }));
  yellow.rotation.y = Math.PI;
  lcdPivot.add(yellow);
  const startRow = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.0075), new THREE.MeshBasicMaterial({ color: 0x80858c }));
  startRow.rotation.y = Math.PI;
  lcdPivot.add(startRow);
  // menu rows y positions (pivot space): row0=Start, row1=Choose start, row2=Interval
  const rowY = (i) => -0.0325 + 0.017 - i * 0.0085;
  startRow.position.set(0, rowY(0), -0.0047);

  nikon.position.set(-0.127, 0.205, 1.7);
  nikon.lookAt(0, 0.29, 0);
  scene.add(nikon);
  nikon.updateMatrixWorld(true);
  // tripod: ball head + column
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), camBlack);
  ball.position.set(-0.127, 0.135, 1.7);
  scene.add(ball);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.86, 12), camBlack);
  column.position.set(-0.127, -0.3, 1.7);
  scene.add(column);

  const fingerA = nikon.localToWorld(V(-0.04, -0.004, -0.044));   // back buttons (multi-selector/OK)
  const fingerB = nikon.localToWorld(V(-0.05, 0.056, 0.02));      // top of grip / shutter area

  // ---------------- Operator (articulated proxy) ----------------
  const op = new THREE.Group();
  scene.add(op);
  const sleeve = std(0x18181a, 0.9);
  const skin = std(0xa87a5c, 0.6);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.55, 0.22), sleeve);
  op.add(torso);
  const opHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), sleeve);
  op.add(opHead);
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 16), sleeve);
  op.add(shoulder);
  const cyl1 = new THREE.CylinderGeometry(1, 1, 1, 16);
  const upperArm = new THREE.Mesh(cyl1, sleeve);
  op.add(upperArm);
  const elbowJ = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), sleeve);
  op.add(elbowJ);
  const forearm = new THREE.Mesh(cyl1, sleeve);
  op.add(forearm);
  const palm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), skin);
  op.add(palm);
  const finger = new THREE.Mesh(cyl1, skin);
  op.add(finger);
  const thumb = new THREE.Mesh(cyl1, skin);
  op.add(thumb);

  const UP = V(0, 1, 0);
  const tmp = new THREE.Vector3();
  function placeBone(mesh, a, b, r) {
    tmp.subVectors(b, a);
    const len = Math.max(tmp.length(), 1e-4);
    mesh.position.copy(a).addScaledVector(tmp, 0.5);
    mesh.scale.set(r, len, r);
    mesh.quaternion.setFromUnitVectors(UP, tmp.clone().normalize());
  }
  function placeBox(mesh, a, b, w, t) {
    tmp.subVectors(b, a);
    const len = Math.max(tmp.length(), 1e-4);
    mesh.position.copy(a).addScaledVector(tmp, 0.5);
    mesh.scale.set(w, len, t);
    mesh.quaternion.setFromUnitVectors(UP, tmp.clone().normalize());
  }
  const L1 = 0.31, L2 = 0.29;
  function solveElbow(S, W, pole) {
    const d = new THREE.Vector3().subVectors(W, S);
    let dist = d.length();
    const dir = d.clone().normalize();
    dist = Math.min(Math.max(dist, Math.abs(L1 - L2) + 1e-3), (L1 + L2) * 0.999);
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const p = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    return S.clone().addScaledVector(dir, a).addScaledVector(p, h);
  }

  function lerpKeys(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        let u = (t - t0) / (t1 - t0);
        u = u * u * (3 - 2 * u);
        if (typeof v0 === 'number') return v0 + (v1 - v0) * u;
        return v0.clone().lerp(v1, u);
      }
    }
    return keys[keys.length - 1][1];
  }

  // Shot B arm trajectory (wrist W, fingertip F)
  const bW = [
    [2.30, V(-0.24, 0.33, 2.22)],
    [2.50, V(-0.21, 0.31, 2.14)],
    [2.75, V(-0.18, 0.31, 2.05)],
    [3.00, V(-0.155, 0.31, 1.82)],
    [3.35, V(-0.155, 0.31, 1.82)],
    [3.55, V(-0.20, 0.32, 2.22)],
    [3.70, V(-0.26, 0.34, 2.30)],
  ];
  const bF = [
    [2.30, V(-0.16, 0.22, 2.15)],
    [2.50, V(-0.12, 0.20, 2.08)],
    [2.75, V(-0.08, 0.20, 1.98)],
    [3.00, V(-0.07, 0.18, 1.76)],
    [3.35, V(-0.07, 0.18, 1.76)],
    [3.55, V(-0.11, 0.21, 2.15)],
    [3.70, V(-0.18, 0.23, 2.24)],
  ];

  // ---------------- 2D lower-third / letterbox graphics (camera-attached, no text) ----------------
  const overlay = new THREE.Group();
  camera.add(overlay);
  function ovMat(c) {
    return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false });
  }
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  function ovRect(c) {
    const m = new THREE.Mesh(unitPlane, ovMat(c));
    m.renderOrder = 1000;
    overlay.add(m);
    return m;
  }
  // set rect in 960x540 reference pixel coordinates
  function setRect(m, x0, y0, x1, y1) {
    const cx = ((x0 + x1) / 2) / 960 * 2 - 1;
    const cy = 1 - ((y0 + y1) / 2) / 540 * 2;
    m.position.set(cx * aspect, cy, 0);
    m.scale.set(Math.max((x1 - x0) / 960 * 2 * aspect, 1e-5), Math.max((y1 - y0) / 540 * 2, 1e-5), 1);
  }
  const rcTop = ovRect(0xd0202a), rcBot = ovRect(0xd0202a), rcL = ovRect(0xd0202a), rcR = ovRect(0xd0202a);
  const ecBox = ovRect(0x000000);
  ecBox.renderOrder = 1000;
  const ecT = ovRect(0xffffff), ecB = ovRect(0xffffff), ecL = ovRect(0xffffff), ecR = ovRect(0xffffff);
  for (const m of [ecT, ecB, ecL, ecR]) m.renderOrder = 1001;
  const letterbox = ovRect(0x000000);
  setRect(letterbox, -2, -2, 962, 30);
  setRect(ecBox, 5, 468, 866, 535);
  setRect(ecT, 5, 468, 866, 470);
  setRect(ecB, 5, 533, 866, 535);
  setRect(ecL, 5, 468, 7, 535);
  setRect(ecR, 864, 468, 866, 535);

  // ---------------- Shots ----------------
  const T_AB = 56.5 / fps, T_BC = 87.5 / fps, T_CD = 117.5 / fps;
  const shots = {
    A: { pos: V(0, 0.32, 3.03), tgt: V(-0.082, 0.193, 0), fov: 9.0 },
    B: { pos: V(0, 0.295, 3.03), tgt: V(-0.045, 0.325, 0), fov: 13.1 },
    C: { pos: V(0.1, 0.052, 1.05), tgt: V(0.041, 0.194, 0), fov: 26.4 },
    D: { pos: V(0.127, 0.09, 2.2), tgt: V(0.127, 0.273, 0), fov: 19.0 },
  };

  const yawKeys = [[0, 0], [4.0, 0], [4.30, 8], [4.55, 18], [4.80, 30], [5.05, 33], [5.30, 37], [5.55, 41], [5.84, 47]];
  function yawAt(t) {
    // piecewise linear (no easing) so rotation speed is continuous-ish
    if (t <= yawKeys[0][0]) return yawKeys[0][1];
    for (let i = 1; i < yawKeys.length; i++) {
      if (t <= yawKeys[i][0]) {
        const [t0, v0] = yawKeys[i - 1], [t1, v1] = yawKeys[i];
        return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
      }
    }
    return yawKeys[yawKeys.length - 1][1];
  }

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const pressBump = (t, t0) => { const u = (t - t0) / 0.12; return (u > 0 && u < 1) ? Math.sin(Math.PI * u) : 0; };

  function update(time, frame) {
    const t = Math.max(0, time);
    let shot = 'A';
    if (t >= T_CD) shot = 'D'; else if (t >= T_BC) shot = 'C'; else if (t >= T_AB) shot = 'B';
    const s = shots[shot];
    camera.position.copy(s.pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(s.tgt);
    camera.fov = s.fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    // overlay placement in front of camera
    const dist = 0.05;
    const hh = dist * Math.tan(THREE.MathUtils.degToRad(s.fov) / 2);
    overlay.position.set(0, 0, -dist);
    overlay.scale.set(hh, hh, 1);

    // turntable / head rotation
    spin.rotation.set(0, THREE.MathUtils.degToRad(yawAt(t)), 0);

    // LCD menu state: Interval -> Choose start -> Start -> screen off
    const screenOn = t < 1.88;
    screenMat.color.setHex(screenOn ? 0x23272e : 0x08090a);
    let row = 2;
    if (t >= 0.40) row = 1;
    if (t >= 0.64) row = 0;
    yellow.visible = screenOn;
    startRow.visible = screenOn && row !== 0;
    yellow.position.set(0, rowY(row), -0.0048);

    // operator
    let S, W, F, pole;
    if (shot === 'A') {
      op.visible = true;
      torso.position.set(0.45, -0.1, 2.4);
      opHead.position.set(0.45, 0.32, 2.45);
      S = V(0.22, 0.08, 2.25);
      const press = 0.006 * (pressBump(t, 0.30) + pressBump(t, 0.55) + pressBump(t, 1.74));
      F = fingerA.clone().add(V(0, 0, 0.006 - press));
      W = V(-0.055, 0.175 - 0.004 * clamp01((t - 1.9) / 0.3), 1.83);
      pole = V(1, -1, 0.4);
    } else if (shot === 'B') {
      op.visible = true;
      torso.position.set(-0.55, 0.3, 2.45);
      opHead.position.set(-0.5, 0.68, 2.45);
      S = V(-0.33, 0.52, 2.3);
      W = lerpKeys(bW, t);
      F = lerpKeys(bF, t);
      pole = V(-1, 1, 0);
    } else {
      op.visible = false;
    }
    if (op.visible) {
      shoulder.position.copy(S);
      const E = solveElbow(S, W, pole);
      elbowJ.position.copy(E);
      const thick = shot === 'B' ? 1.3 : 1.0;
      placeBone(upperArm, S, E, 0.055 * thick);
      placeBone(forearm, E, W, 0.04 * thick);
      const M = W.clone().lerp(F, 0.6);
      placeBox(palm, W, M, 0.065 * thick, 0.03);
      placeBone(finger, M, F, 0.009);
      const side = new THREE.Vector3().subVectors(F, W).cross(V(0, 0, 1)).normalize();
      const thumbTip = W.clone().lerp(F, 0.45).addScaledVector(side, 0.035);
      placeBone(thumb, W.clone().lerp(F, 0.15), thumbTip, 0.011);
    }

    // graphics: "REMOTE CONTROL" red frame (text omitted), "Ecommerce" box (text omitted), letterbox
    const pin = clamp01((t - 0.25) / 0.7);
    const pout = clamp01((t - 3.45) / 0.9);
    const rcVis = pin > 0 && pout < 1;
    const xl = 485 + pout * 300, xr = 485 + pin * 320;
    for (const m of [rcTop, rcBot, rcL, rcR]) m.visible = rcVis;
    if (rcVis) {
      setRect(rcTop, xl, 418, Math.max(xl + 1, xr), 420);
      setRect(rcBot, xl, 483, Math.max(xl + 1, Math.min(xr, 565 + pout * 240)), 485);
      rcL.visible = pin > 0.25 && pout < 0.05;
      rcR.visible = pin >= 1 && pout < 0.95;
      setRect(rcL, 485, 418, 487, 485);
      setRect(rcR, 803, 418, 805, 485);
    }
    const ecA = clamp01((t - 4.72) / 0.3);
    for (const m of [ecBox, ecT, ecB, ecL, ecR]) {
      m.visible = ecA > 0;
      m.material.opacity = ecA;
    }
    letterbox.visible = shot === 'D';
  }

  update(0, 0);
  return { scene, camera, update };
}
