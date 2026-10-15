// Authored smoke fixture: editable articulated geometry and an absolute-time camera.
// This scene is infrastructure validation, not a benchmark reconstruction result.
export function createScene({ THREE, width, height, duration }) {
  const scene = new THREE.Scene();
  scene.name = 'Articulated motion smoke scene';
  scene.background = new THREE.Color('#a4c0db');
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.name = 'Deterministic camera';
  scene.add(new THREE.HemisphereLight(0xffffff, 0x59634d, 2.0));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-3, 6, 4); light.castShadow = true;
  light.shadow.mapSize.set(512, 512); scene.add(light);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
    new THREE.MeshStandardMaterial({ color: '#879b7d', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'Ground'; scene.add(ground);
  const subject = new THREE.Group(); subject.name = 'Orange subject'; scene.add(subject);
  const orange = new THREE.MeshStandardMaterial({ color: '#e67332', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 0.6), orange);
  body.position.y = 1.3; body.castShadow = true; body.name = 'Torso'; subject.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), orange);
  head.position.y = 2.32; head.castShadow = true; head.name = 'Head'; subject.add(head);
  const arm = new THREE.Group(); arm.name = 'Articulated arm'; arm.position.set(0.6, 1.85, 0); subject.add(arm);
  const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.25), orange);
  forearm.position.y = -0.4; forearm.castShadow = true; arm.add(forearm);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16),
    new THREE.MeshStandardMaterial({ color: '#316abc', roughness: 0.4 }));
  marker.position.set(1.9, 0.35, 0); marker.name = 'Blue marker'; marker.castShadow = true; scene.add(marker);
  return { scene, camera, update(time) {
    const phase = time / Math.max(duration, 0.001);
    subject.position.set(-0.7 + phase * 0.8, 0, 0);
    arm.rotation.z = 0.3 + Math.sin(time * Math.PI * 2) * 0.8;
    camera.position.set(5 + phase * 0.4, 3.4, 7.5 - phase * 0.3);
    camera.lookAt(0.4, 1.0, 0);
  } };
}
