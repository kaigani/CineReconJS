import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const enabled = process.env.CINERECON_BROWSER_TESTS === '1';
const runner = fileURLToPath(new URL('../render.mjs', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));
const valid = `export function createScene({THREE, width, height}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width/height, 0.1, 100);
  camera.position.z = 3;
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({color:'orange'})));
  return {scene, camera, update(time, frame) { BODY }};
}`;

async function invoke(source) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cinerecon-negative-'));
  try {
    const scene = path.join(dir, 'input.mjs');
    await writeFile(scene, source);
    const args = [runner, '--scene', scene, '--output', path.join(dir, 'run'), '--width', '64',
      '--height', '64', '--fps', '24', '--frames', '2', '--frame-timeout-ms', '3000'];
    if (process.env.CHROMIUM_EXECUTABLE) args.push('--chromium-executable', process.env.CHROMIUM_EXECUTABLE);
    if (process.env.CINERECON_ALLOW_NO_SANDBOX === '1') args.push('--allow-no-sandbox');
    try {
      return await exec(process.execPath, args, { cwd: root, timeout: 15000, maxBuffer: 1024 * 1024 });
    } catch (error) {
      error.rendererError = JSON.parse(await readFile(path.join(dir, 'run', 'renderer-error.json'), 'utf8'));
      throw error;
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('browser smoke emits verified MP4 and pixel-identical repeated PNG frames', { skip: !enabled }, async () => {
  const { stdout } = await exec(process.execPath, ['test/smoke.mjs'], { cwd: root, timeout: 90000 });
  assert.match(stdout, /"status": "passed"/);
});

test('browser resolves a bare three import through the CSP-authorized import map', { skip: !enabled }, async () => {
  const source = 'import * as ImportedTHREE from "three";\n' +
    valid.replace('BODY', 'if (ImportedTHREE.REVISION !== THREE.REVISION) throw new Error("import mismatch");');
  const { stdout } = await invoke(source);
  assert.match(stdout, /"status": "complete"/);
});

for (const [name, source, pattern] of [
  ['missing createScene export', 'export const x = 1;', /must export createScene/],
  ['bad return contract', 'export function createScene() { return {}; }', /THREE.Scene/],
  ['syntax error', 'export function createScene( {', /initialization failed|SyntaxError|Timeout/i],
  ['update exception', valid.replace('BODY', 'throw new Error("fixture failure");'), /fixture failure/],
  ['asynchronous update', valid.replace('BODY', 'return Promise.resolve();'), /must be synchronous/],
  ['realtime animation', valid.replace('BODY', 'requestAnimationFrame(() => {});'), /requestAnimationFrame is forbidden/],
  ['hung update', valid.replace('BODY', 'while (true) {}'), /Frame 0 timed out/],
  ['external network attempt', valid.replace('BODY', 'fetch("https://example.com/private").catch(() => {});'), /Browser runtime error/],
  ['local file request', valid.replace('BODY', 'fetch("/.env").catch(() => {});'), /Browser runtime error/],
  ['external module import', 'import "https://example.com/code.mjs";\n' + valid.replace('BODY', ''), /initialization failed|runtime error/],
]) {
  test(`browser fails closed: ${name}`, { skip: !enabled }, async () => {
    await assert.rejects(invoke(source), error => {
      assert.notEqual(error.code, 0);
      assert.match(error.stderr, pattern);
      assert.equal(error.rendererError.kind, 'scene');
      assert.ok(error.rendererError.stage);
      return true;
    });
  });
}
