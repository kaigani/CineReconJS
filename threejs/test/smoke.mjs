import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../config.mjs';
import { render } from '../render.mjs';

// No model/API call. Preserve artifacts for inspection; print their actual path.
const root = process.env.CINERECON_SMOKE_OUTPUT ?? await mkdtemp(path.join(os.tmpdir(), 'cinerecon-smoke-'));
const scene = fileURLToPath(new URL('../scenes/demo.mjs', import.meta.url));
const base = ['--scene', scene, '--width', '160', '--height', '90', '--fps', '30000/1001',
  '--frames', '6', '--seed', '7'];
if (process.env.CHROMIUM_EXECUTABLE) base.push('--chromium-executable', process.env.CHROMIUM_EXECUTABLE);
if (process.env.CINERECON_ALLOW_NO_SANDBOX === '1') base.push('--allow-no-sandbox');
const first = await render(parseArgs([...base, '--output', path.join(root, 'first')]));
const second = await render(parseArgs([...base, '--output', path.join(root, 'second')]));
assert.deepEqual(first.frameRecords.map(f => f.sha256), second.frameRecords.map(f => f.sha256),
  'Repeated runs must have identical frame pixels in this environment');
assert.ok(new Set(first.frameRecords.map(f => f.sha256)).size > 1, 'Animation frames must change');
const snapshot = JSON.parse(await readFile(path.join(root, 'first', 'scene.json'), 'utf8'));
assert.equal(snapshot.snapshotFrame, 0);
assert.equal(snapshot.scene.object.type, 'Scene');
assert.equal(snapshot.camera.object.type, 'PerspectiveCamera');
assert.equal(first.frames, 6);
assert.equal(first.fps, '30000/1001');
assert.equal(first.frameRecords[5].time, 5 * 1001 / 30000);
console.log(JSON.stringify({ status: 'passed', output: root,
  repeatedFrameHashesMatch: true, frames: first.frames, fps: first.fps }, null, 2));
