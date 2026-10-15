export function createScene({ THREE, width, height, fps, duration, seed }) {
  // L1 editable geometric reconstruction. All animation is sampled from absolute time.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb6c2b5);
  scene.fog = new THREE.Fog(0xa6b3a0, 24, 95);
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.025, 180);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const Y = V(0, 1, 0), Z = V(0, 0, 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, q) => a + (b - a) * q;
  const smooth = q => q * q * (3 - 2 * q);
  const sample = (t, keys, eased = true) => {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        let q = (t - a[0]) / (b[0] - a[0]);
        if (eased) q = smooth(q);
        return a.slice(1).map((v, j) => mix(v, b[j + 1], q));
      }
    }
    return keys[keys.length - 1].slice(1);
  };
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.88, metalness: 0.02, ...extra
  });
  const m = {
    roof: material(0x686b5b),
    parapet: material(0x858d7c),
    seam: new THREE.LineBasicMaterial({ color: 0x465449, transparent: true, opacity: 0.62 }),
    glass: material(0x7b8b7d, { roughness: 0.80, metalness: 0.06, emissive: 0x263229, emissiveIntensity: 0.20 }),
    glassSide: material(0x63796c, { roughness: 0.80 }),
    mullion: material(0x929d87),
    stone: material(0x8c927d),
    city: material(0x8d9f93),
    utility: material(0x45483a),
    utilityEdge: material(0x747862),
    pipe: material(0x878d7a, { metalness: 0.45 }),
    coat: material(0x262a24, { side: THREE.DoubleSide }),
    shirt: material(0x36372e),
    trousers: material(0x282e27),
    boots: material(0x1c251e, { roughness: 0.57 }),
    skin: material(0xb8a282),
    hair: material(0x211e16),
    glasses: material(0x131914, { roughness: 0.32 }),
    suit: material(0x514b3d),
    white: material(0xbfc5ae),
    gun: material(0x3d4740, { roughness: 0.38, metalness: 0.48 }),
    muzzle: material(0x050b08),
    helicopter: material(0x3d443d, { roughness: 0.6 }),
    cockpit: material(0x192e2b, { roughness: 0.35, metalness: 0.20 }),
    impact: material(0x47251e),
    shadow: new THREE.MeshBasicMaterial({ color: 0x11170e, transparent: true, opacity: 0.17, depthWrite: false })
  };
  const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function mesh(parent, geometry, mat, name) {
    const o = new THREE.Mesh(geometry, mat);
    o.name = name || '';
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(parent, size, pos, mat, name) {
    const o = mesh(parent, boxGeo, mat, name);
    o.scale.set(...size);
    o.position.set(...pos);
    return o;
  }
  function ellipsoid(parent, size, pos, mat, name) {
    const o = mesh(parent, sphereGeo, mat, name);
    o.scale.set(...size);
    o.position.set(...pos);
    return o;
  }
  function segment(o, a, b, radius, radius2 = radius) {
    const d = b.clone().sub(a);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(Y, d.clone().normalize());
    o.scale.set(radius, Math.max(0.0001, d.length()), radius2);
  }
  function rod(parent, a, b, radius, mat, name) {
    const o = mesh(parent, cylinderGeo, mat, name);
    segment(o, V(...a), V(...b), radius);
    return o;
  }
  function group(parent, name) {
    const o = new THREE.Group();
    o.name = name;
    parent.add(o);
    return o;
  }
  scene.add(new THREE.HemisphereLight(0xe3e8df, 0x727b69, 2.5));
  const sunlight = new THREE.DirectionalLight(0xe8e9dc, 1.45);
  sunlight.position.set(-9, 16, 8);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = -18;
  sunlight.shadow.camera.right = 18;
  sunlight.shadow.camera.top = 18;
  sunlight.shadow.camera.bottom = -18;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.radius = 4.0;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight(0xadc6b9, 0.42);
  fill.position.set(10, 7, -10);
  scene.add(fill);

  const rooftop = group(scene, 'Rooftop and parapets');
  box(rooftop, [29, 0.24, 25], [0, -0.13, 1], m.roof, 'Concrete roof');
  box(rooftop, [29, 0.43, 0.24], [0, 0.215, -11.35], m.parapet, 'Far parapet');
  box(rooftop, [0.27, 0.45, 25], [-14.35, 0.225, 1], m.parapet, 'Left parapet');
  box(rooftop, [0.27, 0.39, 25], [14.35, 0.195, 1], m.parapet, 'Right parapet');
  box(rooftop, [29, 0.46, 0.25], [0, 0.23, 13.35], m.parapet, 'Rear parapet');
  const seamPoints = [];
  for (let x = -14; x <= 14; x += 1.5) seamPoints.push(x, 0.002, -11.2, x, 0.002, 13.2);
  for (let z = -11; z <= 13; z += 1.5) seamPoints.push(-14.2, 0.002, z, 14.2, 0.002, z);
  const seams = new THREE.BufferGeometry();
  seams.setAttribute('position', new THREE.Float32BufferAttribute(seamPoints, 3));
  const seamLines = new THREE.LineSegments(seams, m.seam);
  seamLines.name = 'Large roof slab joints';
  rooftop.add(seamLines);
  for (const x of [-6.2, 8.7]) {
    box(rooftop, [2.3, 0.20, 1.15], [x, 0.10, -10.5], m.parapet, 'Raised roof plinth');
    const hood = box(rooftop, [0.95, 0.60, 0.9], [x - 0.15, 0.40, -10.55], m.parapet, 'Low vent hood');
    hood.rotation.z = -0.24;
  }
  rod(rooftop, [-5.2, 0, -9.8], [-5.2, 1.08, -9.8], 0.11, m.pipe, 'Vent pipe');
  const cap = mesh(rooftop, new THREE.ConeGeometry(0.21, 0.18, 8), m.pipe, 'Vent cap');
  cap.position.set(-5.2, 1.15, -9.8);
  for (const z of [-10, -7, -4, -1, 2, 5]) {
    rod(rooftop, [13.8, 0.4, z], [13.8, 1.0, z], 0.035, m.pipe, 'Railing upright');
  }
  rod(rooftop, [13.8, 1.0, -10], [13.8, 1.0, 5], 0.04, m.pipe, 'Railing top');
  rod(rooftop, [13.8, 0.66, -10], [13.8, 0.66, 5], 0.027, m.pipe, 'Railing lower bar');

  const city = group(scene, 'Simple surrounding architecture');
  box(city, [21, 27, 10], [-1.4, 7.5, -24.0], m.glass, 'Green glass office tower');
  box(city, [0.22, 27, 10.3], [9.20, 7.5, -24.0], m.glassSide, 'Tower side');
  for (let x = -11.8; x <= 9.2; x += 1.65) {
    box(city, [0.027, 27, 0.04], [x, 7.5, -18.975], m.mullion, 'Facade vertical division');
  }
  for (let y = -5.5; y < 21; y += 3.2) {
    box(city, [21, 0.025, 0.045], [-1.4, y, -18.97], m.mullion, 'Facade horizontal division');
  }
  box(city, [0.68, 27, 0.13], [-4.5, 7.5, -18.92], m.stone, 'Broad facade column');
  box(city, [3.6, 17, 5], [17.8, 2, -26], m.stone, 'Distant tan tower');
  for (let y = -5; y < 11; y += 2.1) {
    box(city, [3.85, 0.18, 5.15], [17.8, y, -26], m.stone, 'Tower floor band');
  }
  const blocks = [
    [-23, -4, -37, 5, 12, 8], [-30, -3, 6, 7, 12, 7],
    [-18, -4, 25, 6, 12, 7], [-6, -3, 34, 7, 14, 7],
    [9, -4, 33, 8, 12, 7], [23, -3, 15, 6, 15, 7],
    [29, -5, -8, 8, 11, 9]
  ];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    box(city, b.slice(3), b.slice(0, 3), m.city, 'Distant city block ' + i);
  }

  const utility = group(scene, 'Roof service structure');
  box(utility, [2.9, 5.6, 1.8], [3.25, 2.8, 4.4], m.utility, 'Tall brown service shaft');
  box(utility, [3.8, 3.0, 2.6], [6.55, 1.5, 5.1], m.stone, 'Concrete service room');
  box(utility, [4.05, 0.25, 2.85], [6.55, 3.1, 5.1], m.parapet, 'Service room cap');
  for (const x of [1.86, 3.25, 4.64]) {
    box(utility, [0.07, 5.6, 0.09], [x, 2.8, 3.45], m.utilityEdge, 'Service shaft frame');
  }
  for (const y of [1.4, 3.0, 4.6]) {
    box(utility, [2.9, 0.07, 0.09], [3.25, y, 3.45], m.utilityEdge, 'Service shaft crossbar');
  }
  rod(utility, [1.58, 0, 3.9], [1.58, 5.2, 3.9], 0.07, m.pipe, 'External service pipe');
  rod(utility, [1.58, 5.2, 3.9], [2.0, 5.2, 3.9], 0.07, m.pipe, 'Pipe elbow');
  box(utility, [0.23, 0.48, 0.16], [1.62, 1.65, 3.55], material(0x59372a), 'Muted red utility fitting');

  const helicopter = group(scene, 'Background helicopter proxy');
  helicopter.position.set(-6.2, 2.20, -0.5);
  helicopter.rotation.y = Math.PI / 2;
  ellipsoid(helicopter, [0.90, 0.80, 1.66], [0, 0.20, 0], m.helicopter, 'Helicopter fuselage');
  ellipsoid(helicopter, [0.83, 0.62, 0.83], [0, 0.24, 1.0], m.cockpit, 'Helicopter cockpit');
  box(helicopter, [0.29, 0.28, 3.6], [0, 0.36, -2.3], m.helicopter, 'Helicopter tail boom');
  box(helicopter, [0.09, 1.0, 0.72], [0, 0.76, -3.7], m.helicopter, 'Helicopter tail fin');
  for (const x of [-0.78, 0.78]) {
    rod(helicopter, [x, -0.70, -1.55], [x, -0.70, 1.65], 0.05, m.helicopter, 'Helicopter skid');
    rod(helicopter, [x, -0.70, -0.7], [x * 0.65, -0.25, -0.7], 0.04, m.helicopter, 'Skid support');
    rod(helicopter, [x, -0.70, 0.9], [x * 0.65, -0.25, 0.9], 0.04, m.helicopter, 'Skid support');
  }
  rod(helicopter, [0, 0.85, 0], [0, 1.18, 0], 0.08, m.helicopter, 'Rotor mast');
  const rotor = group(helicopter, 'Rotor');
  rotor.position.y = 1.18;
  box(rotor, [6.8, 0.025, 0.12], [0, 0, 0], m.helicopter, 'Main rotor');
  box(rotor, [0.12, 0.025, 6.8], [0, 0, 0], m.helicopter, 'Cross rotor');

  helicopter.traverse(o => { if (o.isMesh) o.castShadow = false; });

  let hash = ((Number(seed) || 1) >>> 0);
  const random = () => { hash = (1664525 * hash + 1013904223) >>> 0; return hash / 4294967296; };
  const smoke = [];
  for (let i = 0; i < 11; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { tint: { value: new THREE.Color(0xc0c5aa) }, alpha: { value: .10 } },
      vertexShader: 'varying vec3 n; varying vec3 p; void main(){ vec4 q=modelViewMatrix*vec4(position,1.0); p=q.xyz; n=normalMatrix*normal; gl_Position=projectionMatrix*q; }',
      fragmentShader: 'uniform vec3 tint; uniform float alpha; varying vec3 n; varying vec3 p; void main(){ float edge=pow(abs(dot(normalize(n),normalize(-p))),2.4); gl_FragColor=vec4(tint,alpha*edge);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    });
    const x = -4.2 + i * 0.82;
    const z = 2.3 + random() * 2.5;
    const y = 0.55 + random() * 0.55;
    const o = ellipsoid(scene, [1.75 + random(), 0.55 + random() * 0.55, 1.25 + random()], [x, y, z], mat, 'Low drifting rooftop haze ' + i);
    o.castShadow = false;
    smoke.push({ o, x, y, z, phase: random() * Math.PI * 2 });
  }

  function makeGun(name) {
    const root = new THREE.Group();
    root.name = name;
    box(root, [0.085, 0.095, 0.285], [0, 0.075, 0.055], m.gun, 'Pistol slide');
    const grip = box(root, [0.074, 0.165, 0.10], [0, -0.025, -0.045], m.gun, 'Pistol grip');
    grip.rotation.x = -0.14;
    const muzzle = mesh(root, new THREE.CylinderGeometry(0.024, 0.024, 0.006, 12), m.muzzle, 'Dark muzzle opening');
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.075, 0.201);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd994, transparent: true, opacity: 0.8 });
    const flash = mesh(root, new THREE.ConeGeometry(0.06, 0.22, 6), flashMat, 'Brief muzzle flash');
    flash.rotation.x = Math.PI / 2;
    flash.position.set(0, 0.075, 0.30);
    flash.visible = false;
    return { root, flash };
  }
  function makeActor(name, suited) {
    const root = group(scene, name);
    const hip = group(root, 'Pelvis and leg articulation');
    const spine = group(hip, 'Articulated waist and torso');
    spine.rotation.order = 'YXZ';
    box(hip, [0.40, 0.19, 0.30], [0, 0, 0], suited ? m.suit : m.trousers, 'Pelvis');
    ellipsoid(spine, [0.255, 0.34, 0.17], [0, 0.30, 0], suited ? m.suit : m.shirt, 'Torso');
    ellipsoid(spine, [0.30, 0.115, 0.15], [0, 0.51, 0], suited ? m.suit : m.coat, 'Shoulder bridge');
    if (suited) {
      ellipsoid(spine, [0.115, 0.285, 0.035], [0, 0.31, 0.147], m.white, 'White shirt front');
      box(spine, [0.060, 0.43, 0.018], [0, 0.30, 0.194], m.suit, 'Simple dark tie');
    } else {
      ellipsoid(spine, [0.26, 0.34, 0.085], [0, 0.30, -0.10], m.coat, 'Coat back');
    }
    if (!suited) box(hip, [0.43, 0.09, 0.325], [0, 0.055, 0], m.boots, 'Broad belt');
    rod(spine, [0, 0.59, 0], [0, 0.69, 0], 0.075, m.skin, 'Neck');
    const head = group(spine, 'Head');
    head.position.set(0, suited ? 0.82 : 0.81, 0.012);
    ellipsoid(head, [suited ? .130 : .119, suited ? .178 : .168, suited ? .136 : .125], [0, 0, 0], m.skin, 'Plain proxy head');
    ellipsoid(head, [suited ? .134 : .124, suited ? .079 : .075, suited ? .140 : .130], [0, suited ? .116 : .110, -.020], m.hair, 'Simple hair cap');
    ellipsoid(head, [suited ? .129 : .119, suited ? .146 : .140, .087], [0, .030, -.066], m.hair, 'Hair at back of head');
    box(head, [0.225, 0.035, 0.018], [0, 0.039, 0.132], m.glasses, 'Single sunglasses band');
    const arms = [];
    for (const sign of [1, -1]) {
      const upper = mesh(spine, cylinderGeo, suited ? m.suit : m.coat, 'Upper arm ' + sign);
      const fore = mesh(spine, cylinderGeo, suited ? m.suit : m.coat, 'Forearm ' + sign);
      const joint = ellipsoid(spine, [0.086, 0.086, 0.086], [0, 0, 0], suited ? m.suit : m.coat, 'Elbow ' + sign);
      const wrist = group(spine, 'Hand attachment ' + sign);
      ellipsoid(wrist, [0.058, 0.090, 0.034], [0, 0, 0], m.skin, 'Simple hand ' + sign);
      arms.push({ sign, upper, fore, joint, wrist });
    }
    const legs = [];
    for (const sign of [1, -1]) {
      const thigh = mesh(hip, cylinderGeo, suited ? m.suit : m.trousers, 'Thigh ' + sign);
      const shin = mesh(hip, cylinderGeo, suited ? m.suit : m.trousers, 'Lower leg ' + sign);
      const boot = mesh(hip, cylinderGeo, m.boots, 'Boot shaft ' + sign);
      const foot = box(hip, [0.17, 0.12, 0.28], [0, 0, 0], m.boots, 'Foot ' + sign);
      legs.push({ sign, thigh, shin, boot, foot });
    }
    const tails = [];
    if (!suited) {
      for (const sign of [1, -1]) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(5 * 6 * 3), 3));
        const indices = [];
        for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
          const a = r * 5 + c, b = a + 1, d = a + 5, e = d + 1;
          indices.push(a, d, b, b, d, e);
        }
        geo.setIndex(indices);
        const o = mesh(hip, geo, m.coat, 'Broad deformable coat tail ' + sign);
        o.frustumCulled = false;
        tails.push({ sign, o, geo });
      }
    }
    const shadow = mesh(scene, new THREE.CircleGeometry(1, 32), m.shadow, name + ' ground shadow');
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.castShadow = false;
    shadow.visible = false;
    return { root, hip, spine, head, arms, legs, tails, shadow };
  }
  const coated = makeActor('Black-coated man', false);
  coated.root.rotation.y = Math.PI;
  const suited = makeActor('Suited gunman', true);
  suited.root.position.set(-1.1, 0, -8.5);
  const heroGuns = [makeGun('Dropped pistol image-left'), makeGun('Dropped pistol image-right')];
  heroGuns.forEach(g => { scene.add(g.root); g.root.scale.setScalar(.85); });
  const shooterGun = makeGun('Suited gunman pistol');
  suited.arms[1].wrist.add(shooterGun.root);

  function poseArms(actor, a, wristAngle = 0, openHands = false) {
    for (let i = 0; i < 2; i++) {
      const arm = actor.arms[i], k = i * 6;
      const shoulder = V(arm.sign * 0.285, 0.55, 0);
      const elbow = V(a[k], a[k + 1], a[k + 2]);
      const hand = V(a[k + 3], a[k + 4], a[k + 5]);
      segment(arm.upper, shoulder, elbow, 0.088);
      segment(arm.fore, elbow, hand, 0.077);
      arm.joint.position.copy(elbow);
      arm.wrist.position.copy(hand);
      arm.wrist.rotation.set(wristAngle, 0, 0);
      if (openHands) arm.wrist.quaternion.setFromUnitVectors(Y, hand.clone().sub(elbow).normalize());
    }
  }
  function poseLegs(actor, hipHeight, stance, footZ, fall, t = 0) {
    for (const leg of actor.legs) {
      const a = V(leg.sign * 0.15, -0.015, 0);
      const b = V(leg.sign * stance * 0.5, 0.105 - hipHeight, footZ);
      if (actor === coated && fall > 0) {
        const f = sample(t, [[13.35,.48,.28,-.48,.28],[14.88,.70,.55,-.40,.72],[15.26525,.90,.58,-.43,.86],[15.97429,.38,.92,-.44,.86]]);
        const j = leg.sign > 0 ? 0 : 2;
        b.x = mix(b.x, f[j], fall);
        b.z = mix(b.z, f[j + 1], fall);
      }
      const ab = b.clone().sub(a);
      const distance = ab.length();
      const d = ab.clone().normalize();
      const L1 = actor === coated ? 0.50 : 0.46, L2 = actor === coated ? 0.52 : 0.48;
      const limited = Math.min(distance, L1 + L2 - 0.001);
      const along = (L1 * L1 - L2 * L2 + limited * limited) / (2 * limited);
      const height = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      const pole = V(leg.sign * .85 * fall, .35 * fall, 1 - .9 * fall);
      pole.addScaledVector(d, -pole.dot(d)).normalize();
      const knee = a.clone().addScaledVector(d, along).addScaledVector(pole, height);
      segment(leg.thigh, a, knee, 0.105);
      segment(leg.shin, knee, b, 0.087);
      const bootTop = b.clone().addScaledVector(knee.clone().sub(b).normalize(), 0.265);
      segment(leg.boot, b, bootTop, 0.105);
      leg.foot.position.set(b.x, 0.065 - hipHeight, b.z + 0.08);
      leg.foot.rotation.set(0, leg.sign * 0.11, 0);
    }
  }
  function poseCoat(actor, t, hipHeight, bend, flare, fall) {
    const length = mix(.90, .78, smooth(clamp((t - 2.0) / 1.1, 0, 1)));
    for (const tail of actor.tails) {
      const a = tail.geo.attributes.position;
      for (let r = 0; r < 6; r++) {
        const v = r / 5;
        for (let c = 0; c < 5; c++) {
          const u = c / 4, theta = u * 2.08;
          const radius = mix(.225, .41 + .20 * flare, v);
          const wave = .075 * Math.sin(t * 1.7 + u * 3.0 + tail.sign) * v
            + .10 * flare * Math.sin(v * 6.28 + u * 3.0 + tail.sign) * v;
          let x = tail.sign * Math.sin(theta) * (radius + .09 * Math.sin(v * Math.PI))
            + .15 * flare * Math.sin(u * Math.PI) * Math.sin(t * 1.3 + tail.sign) * v;
          let y = Math.max(.055 - hipHeight, .025 - length * v +
            .46 * flare * v * v * (.55 + .45 * Math.sin(u * Math.PI)) +
            .11 * flare * Math.sin(v * Math.PI) + wave);
          let z = -Math.cos(theta) * radius - .55 * bend * v * v +
            .15 * flare * Math.sin(v * Math.PI) * Math.sin(u * Math.PI);
          const flatX = tail.sign * u * mix(.25, .72, v) + .28 * v;
          const flatY = mix(.015, .035 - hipHeight, v) +
            .065 * Math.sin(v * 6.28 + u * 4.0) * Math.sin(v * Math.PI);
          const flatZ = -.12 - .96 * v + .10 * Math.sin(u * Math.PI);
          x = mix(x, flatX, fall); y = mix(y, flatY, fall); z = mix(z, flatZ, fall);
          a.setXYZ(r * 5 + c, x, y, z);
        }
      }
      a.needsUpdate = true;
      tail.geo.computeVertexNormals();
    }
  }
  const bodyKeys = [
    [0,.96,0,0,0,1.05,.02,0],
    [.40,.95,0,0,0,1.05,.02,.05],
    [1.05,.95,.02,0,0,1.02,.02,.10],
    [1.50,.97,.02,0,0,.82,.05,.15],
    [3.08,.93,.10,-.10,.08,.80,.02,.20],
    [3.46179,.88,.20,-.16,.12,.88,.02,.30],
    [4.17083,.82,.28,-.18,.06,.95,.02,.45],
    [4.879875,.76,.38,-.15,.06,.95,.02,.65],
    [5.54721,.72,.48,-.08,.04,.95,.05,.85],
    [6.25625,.71,.63,0,0,.93,.10,1],
    [6.96529,.73,.83,.02,0,.88,.16,1],
    [7.632625,.72,1.07,.04,-.02,.87,.12,1],
    [8.34167,.73,1.30,.04,-.03,.86,.15,1],
    [9.009,.77,1.40,.03,-.02,.86,.24,1],
    [9.71804,.81,1.46,.02,-.02,.98,.28,1],
    [10.42708,.81,1.46,.02,-.02,1.00,.28,1],
    [11.80346,.80,1.46,.02,-.02,1.00,.28,1],
    [12.5125,.78,1.45,.03,-.02,1.00,.28,1],
    [13.17983,.74,1.40,.10,-.08,.90,.40,1],
    [13.50,.69,1.36,.10,-.10,.90,.42,1],
    [14.22,.54,1.48,.02,-.10,.92,.50,.80],
    [14.88,.30,1.54,-.14,-.10,.95,.65,.50],
    [15.26525,.22,1.52,.15,-.12,.98,.78,.30],
    [15.97429,.22,1.56,-.18,-.08,.90,.85,0]
  ];
  const armKeys = [
    [0,.23,.52,.32,.18,.55,.66,-.23,.52,.32,-.18,.55,.66],
    [.40,.23,.52,.32,.18,.55,.66,-.23,.52,.32,-.18,.55,.66],
    [1.02,.23,.52,.32,.18,.55,.66,-.23,.52,.32,-.18,.55,.66],
    [1.376375,.34,.32,.16,.40,.08,.18,-.34,.32,.10,-.35,.15,.18],
    [1.65,.37,.24,.08,.40,-.08,.10,-.37,.24,.08,-.40,-.08,.10],
    [3.08,.44,.53,.20,.49,.64,.35,-.43,.24,-.05,-.49,-.07,-.04],
    [3.46179,.45,.56,.17,.48,.67,.23,-.43,.18,-.06,-.48,-.08,-.03],
    [4.17083,.38,.65,.10,.57,.89,.15,-.48,.28,-.12,-.67,.15,-.10],
    [4.879875,.32,.74,.12,.26,.96,.29,-.50,.30,-.15,-.63,.08,-.10],
    [5.54721,.49,.29,-.10,.67,.06,-.13,-.41,.80,.18,-.38,1.02,.24],
    [6.25625,.53,.57,.10,.84,.56,.17,-.52,.62,.09,-.86,.67,.17],
    [6.96529,.45,.75,.18,.50,1.02,.24,-.49,.39,-.15,-.72,.20,-.12],
    [7.632625,.44,.80,.34,.44,1.07,.65,-.49,.39,-.15,-.74,.22,-.12],
    [8.34167,.46,.80,.34,.50,1.10,.65,-.51,.50,-.12,-.82,.45,-.12],
    [9.71804,.48,.73,.36,.52,1.02,.70,-.53,.50,-.02,-.86,.53,-.02],
    [10.42708,.48,.60,.20,.68,.62,.30,-.57,.60,.20,-1.00,.62,.30],
    [11.09442,.50,.60,-.04,.70,.76,-.10,-.48,.59,.36,-.66,.67,.70],
    [11.80346,.52,.70,-.06,.80,.97,-.14,-.48,.58,.36,-.66,.63,.70],
    [12.5125,.50,.77,-.06,.62,1.10,-.18,-.48,.58,.36,-.66,.63,.70],
    [13.17983,.65,.60,-.20,1.00,.60,-.30,-.49,.76,.30,-.63,.98,.55],
    [14.22,.45,.65,.16,.35,.91,.28,-.50,.75,.18,-.64,1.04,.20],
    [15.26525,.38,.68,.15,-.20,.90,.20,-.65,.72,.03,-.90,1.02,.03],
    [15.97429,.60,.40,.01,1.08,.40,.02,-.65,.72,.03,-.90,1.02,.03]
  ];
  const cameraKeys = [
    [3.08,0,4.75,1.68,0,1.23,.08],
    [3.46179,0,4.75,1.68,0,1.23,.08],
    [4.17083,0,4.75,1.68,0,1.23,.08],
    [4.879875,0,4.75,1.68,0,1.23,.08],
    [5.54721,.06,4.50,1.68,.08,1.18,.12],
    [6.25625,.20,4.20,1.65,.38,1.14,.15],
    [6.96529,.65,3.80,1.75,.25,1.02,.20],
    [7.632625,1.15,4.05,2.35,.05,.94,.25],
    [8.34167,1.55,3.55,2.50,0,.88,.27],
    [9.009,1.95,3.30,2.10,0,.86,.28],
    [9.71804,2.55,2.80,1.70,0,.80,.27],
    [10.42708,3.22,2.65,1.15,0,.80,.27],
    [11.09442,4.00,2.50,1.12,0,.80,.27],
    [11.80346,4.55,2.50,1.05,0,.79,.27],
    [12.5125,5.05,2.55,1.16,0,.78,.27],
    [13.17983,5.64,2.50,1.12,0,.75,.27],
    [13.50,5.90,2.50,1.12,0,.73,.27]
  ];

  const bulletDefs = [
    [2.64, -1.12, 1.53, 5.10],
    [6.10, .15, .94, 3.00],
    [7.35, -.18, 1.05, 3.10],
    [9.30, .08, .86, 3.00]
  ];
  const bullets = bulletDefs.map((def, i) => {
    const root = group(scene, 'Slow projectile and air wake ' + (i + 1));
    ellipsoid(root, [.012, .012, .030], [0, 0, 0], material(0x9ba49a, { metalness: .65, roughness: .26 }), 'Small projectile');
    const pts = [];
    for (let j = 0; j < 23; j++) {
      const z = -.08 - j * .085;
      const radius = .022 + .075 * Math.sqrt(j / 22);
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, b = (k + 1) / 24 * Math.PI * 2;
        pts.push(Math.cos(a) * radius, Math.sin(a) * radius, z,
          Math.cos(b) * radius, Math.sin(b) * radius, z);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x9aa99b, transparent: true, opacity: .30, depthWrite: false });
    const lines = new THREE.LineSegments(geo, mat);
    lines.name = 'Procedural concentric air disturbance';
    root.add(lines);
    const start = V(-1.26, 1.79, -7.60);
    const direction = V(def[1], def[2], 1.0).sub(start).normalize();
    root.quaternion.setFromUnitVectors(Z, direction);
    return { root, start, direction, def, mat };
  });
  const impact = ellipsoid(coated.spine, [.018, .025, .008], [.13, .28, .151], m.impact, 'Small clothing impact');
  const impactHazeMat = new THREE.MeshBasicMaterial({ color: 0x766255, transparent: true, opacity: 0, depthWrite: false });
  const impactHaze = ellipsoid(coated.spine, [.16, .15, .11], [.13, .28, .23], impactHazeMat, 'Brief impact dust');
  impactHaze.castShadow = false;

  const aim = (position, target, fov, up = Y) => {
    camera.position.copy(position);
    camera.up.copy(up);
    camera.fov = fov;
    camera.aspect = width / height;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  };
  const flashAt = (t, moments, length) => moments.some(s => t >= s && t < s + length);

  function update(time, frame) {
    const t = clamp(Number.isFinite(time) ? time : frame / fps, 0, duration);
    const p = sample(t, bodyKeys);
    const hipHeight = p[0], bend = p[1], fall = smooth(clamp((t - 13.35) / 2.40, 0, 1));
    coated.root.position.set(0, 0, 0);
    coated.root.rotation.set(0, Math.PI, 0);
    coated.hip.position.set(0, hipHeight, 0);
    coated.hip.rotation.set(0, 0, 0);
    coated.spine.rotation.set(-bend, p[3], p[2], 'YXZ');
    coated.head.rotation.set(mix(0, -.10, clamp((t - 5) / 3, 0, 1)), 0, 0);
    const a = sample(t, armKeys);
    if (t >= .40 && t <= 1.05) {
      const kick = .018 * Math.sin(t * 53);
      a[4] += kick;
      a[10] -= kick;
    }
    poseArms(coated, a, t < 1.10 ? 0 : mix(0, 1.20, clamp((t - 1.10) / .32, 0, 1)), t >= 3.08);
    poseLegs(coated, hipHeight, p[4], p[5], fall, t);
    poseCoat(coated, t, hipHeight, bend, p[6], fall);
    coated.shadow.position.set(0, .006, mix(.08, .43, clamp(bend, 0, 1)));
    coated.shadow.scale.set(mix(.50, .89, clamp(bend, 0, 1)), mix(.25, .84, clamp(bend, 0, 1)), 1);

    suited.root.position.set(-1.1, 0, -8.5);
    suited.root.rotation.set(0, 0, 0);
    suited.hip.position.set(0, .96, 0);
    suited.spine.rotation.set(0, 0, 0, 'YXZ');
    suited.head.rotation.set(0, 0, 0);
    const raise = smooth(clamp(t / .36, 0, 1));
    const recoil = flashAt(t, [2.56, 2.69, 6.10, 7.35, 9.30], .11) ? .026 : 0;
    poseArms(suited, [
      .34, .24, .02, .36, -.08, .04,
      -.28, mix(.29, .61, raise), mix(.18, .33, raise),
      -.16, mix(-.07, .76, raise) + recoil, mix(.60, .68, raise)
    ], .025 - recoil * 2.0);
    poseLegs(suited, .96, .40, .01, 0);
    suited.shadow.position.set(0, .006, -8.5);
    suited.shadow.scale.set(.43, .28, 1);
    shooterGun.flash.visible = flashAt(t, [2.56, 2.69, 6.10, 7.35, 9.30], .052);

    scene.updateMatrixWorld(true);
    heroGuns.forEach((g, i) => {
      if (t <= 1.48) {
        coated.arms[i].wrist.getWorldPosition(g.root.position);
        coated.arms[i].wrist.getWorldQuaternion(g.root.quaternion);
      } else {
        const q = clamp((t - 1.48) / .65, 0, 1);
        const sign = i === 0 ? -1 : 1;
        g.root.position.set(mix(sign * .42, sign * 1.05, q),
          mix(1.02, .06, q) + .15 * Math.sin(q * Math.PI),
          mix(-.14, -.62, q));
        g.root.rotation.set(.38 * Math.sin(q * Math.PI), mix(Math.PI, i === 0 ? Math.PI / 2 : 2.0, q), q * Math.PI / 2, 'YXZ');
      }
      g.flash.visible = t < 1.10 && flashAt(t, i === 0 ? [.54, .83] : [.65, .95], .040);
    });

    for (const b of bullets) {
      const age = t - b.def[0];
      b.root.visible = age >= 0 && age <= 4.15 && t >= 3.08 && t < 13.50;
      b.root.position.copy(b.start).addScaledVector(b.direction, age * b.def[3]);
      b.mat.opacity = .32 * Math.min(1, Math.max(0, age) * 4);
    }
    for (const s of smoke) {
      s.o.position.set(s.x + .22 * Math.sin(t * .34 + s.phase),
        s.y + .13 * Math.sin(t * .28 + s.phase),
        s.z + .21 * Math.sin(t * .31 + s.phase));
      s.o.material.uniforms.alpha.value = t < 1.72 ? .36 : t > 8.6 && t < 13.5 ? .30 : .08;
    }
    rotor.rotation.y = t * 19.0;
    impact.visible = t >= 13.50 && t < 14.22;
    impactHaze.visible = t >= 13.50 && t < 14.88;
    impactHazeMat.opacity = t >= 13.50 && t < 14.88 ? .20 * Math.exp(-((t - 13.72) * (t - 13.72)) / .14) : 0;
    const dustScale = 1 + clamp(t - 13.50, 0, 1) * 2;
    impactHaze.scale.set(.16 * dustScale, .15 * dustScale, .11 * dustScale);

    scene.updateMatrixWorld(true);
    if (t < .40) {
      aim(V(.10, 1.18, -6.05), V(-1.50, 1.38, -8.5), 27);
    } else if (t < 1.72) {
      aim(V(.06, 1.08, -4.45), V(0, 1.05, 0), 29);
    } else if (t < 3.08) {
      const drift = .014 * Math.sin((t - 1.72) * 3);
      aim(V(-1.15 + drift * .25, 1.72, -3.90), V(-1.15, 1.72, -7.65), 4.5);
    } else if (t < 13.50) {
      const c = sample(t, cameraKeys, false);
      const framing = sample(t, [[3.08,0,0],[6.96529,.05,0],[7.632625,.10,-.10],
        [8.34167,.22,-.02],[9.009,.24,0],[9.71804,.12,-.02],[10.42708,.10,0],
        [11.09442,.22,-.20],[11.80346,.20,-.15],[12.5125,.23,0],[13.17983,.08,.12],[13.50,.08,.12]], false);
      aim(V(Math.sin(c[0]) * c[1], c[2], .15 + Math.cos(c[0]) * c[1]),
        V(c[3] + Math.cos(c[0]) * framing[0], c[4] + framing[1],
          c[5] - Math.sin(c[0]) * framing[0]), 36);
    } else if (t < 14.22) {
      const target = coated.spine.localToWorld(V(.09, .20, .13));
      const position = coated.spine.localToWorld(V(.42, .30, .62));
      const up = V(0, 1, 0).applyQuaternion(coated.spine.getWorldQuaternion(new THREE.Quaternion()));
      aim(position, target, 29, up);
      camera.rotateZ(-.55);
    } else if (t < 14.88) {
      const target = coated.spine.localToWorld(V(.48, .60, .13));
      const position = coated.spine.localToWorld(V(.77, .66, .45));
      const up = V(0, 1, 0).applyQuaternion(coated.spine.getWorldQuaternion(new THREE.Quaternion()));
      aim(position, target, 31, up);
      camera.rotateZ(.60);
    } else {
      aim(V(0, 3.55, -.65), V(0, 0, .25), 38, V(0, 0, 1));
    }
  }
  update(0, 0);
  return { scene, camera, update };
}
