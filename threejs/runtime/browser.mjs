// CONFIG is prepended by the host. Generated scene code is never imported by Node.
import * as THREE from '/vendor/three.module.js';

let randomState = CONFIG.seed >>> 0;
Math.random = () => {
  randomState = (randomState + 0x6D2B79F5) >>> 0;
  let t = randomState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
let simulationTime = 0;
const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [simulationTime * 1000])); }
  static now() { return simulationTime * 1000; }
};
Object.defineProperty(performance, 'now', { value: () => simulationTime * 1000 });
globalThis.requestAnimationFrame = () => { throw new Error('requestAnimationFrame is forbidden; animate in update(time, frame)'); };

let initializationStage = 'scene-module';
async function initialize() {
  const { createScene } = await import('/scene.mjs');
  initializationStage = 'scene-contract';
  if (typeof createScene !== 'function') throw new Error('scene.mjs must export createScene');
  const world = createScene({ THREE, width: CONFIG.width, height: CONFIG.height,
    fps: CONFIG.fps, duration: CONFIG.duration, seed: CONFIG.seed });
  if (world?.then) throw new Error('createScene must be synchronous');
  if (!world?.scene?.isScene) throw new Error('createScene must return a THREE.Scene as scene');
  if (!world?.camera?.isCamera) throw new Error('createScene must return a THREE.Camera as camera');
  if (typeof world.update !== 'function') throw new Error('createScene must return update(time, frame)');
  initializationStage = 'webgl-initialize';
  const canvas = document.getElementById('render');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false,
    preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(CONFIG.width, CONFIG.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const metadata = { threeRevision: THREE.REVISION,
    webglVersion: gl.getParameter(gl.VERSION),
    webglVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    webglRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    pixelRatio: renderer.getPixelRatio(), antialias: gl.getContextAttributes().antialias,
    outputColorSpace: renderer.outputColorSpace, toneMapping: 'ACESFilmicToneMapping',
    toneMappingExposure: renderer.toneMappingExposure, shadowMap: 'PCFSoftShadowMap' };
  let expectedFrame = 0;
  Object.defineProperty(globalThis, '__cineRenderFrame', { value: frame => {
    if (frame !== expectedFrame || frame < 0 || frame >= CONFIG.frames) {
      throw new Error(`Expected frame ${expectedFrame}, got ${frame}`);
    }
    simulationTime = frame * CONFIG.fpsDenominator / CONFIG.fpsNumerator;
    const result = world.update(simulationTime, frame);
    if (result?.then) throw new Error('update must be synchronous');
    world.scene.updateMatrixWorld(true);
    world.camera.updateMatrixWorld(true);
    world.camera.updateProjectionMatrix?.();
    renderer.render(world.scene, world.camera);
    gl.finish();
    if (gl.isContextLost()) throw new Error('WebGL context lost');
    expectedFrame++;
    return { frame, time: simulationTime, calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles };
  } });
  Object.defineProperty(globalThis, '__cineExportScene', { value: () => ({
    format: 'cinerecon-threejs-scene-v1', snapshotFrame: expectedFrame - 1,
    source: 'scene.mjs', scene: world.scene.toJSON(), camera: world.camera.toJSON(),
    timeline: CONFIG,
  }) });
  Object.defineProperty(globalThis, '__cineMetadata', { value: metadata });
  globalThis.__cineReady = true;
}

initialize().catch(error => {
  globalThis.__cineError = { message: error?.stack ?? String(error), stage: initializationStage };
});
