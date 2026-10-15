import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createScene } from '../scenes/demo.mjs';

test('authored scene camera and articulated motion are absolute-time functions', () => {
  const world = createScene({ THREE, width: 640, height: 360, fps: 30, duration: 2, seed: 0 });
  const arm = world.scene.getObjectByName('Articulated arm');
  world.update(0.25, 8);
  const first = { camera: world.camera.position.toArray(), arm: arm.rotation.z,
    subject: world.scene.getObjectByName('Orange subject').position.toArray() };
  world.update(1.5, 45);
  assert.notDeepEqual(world.camera.position.toArray(), first.camera);
  world.update(0.25, 8);
  assert.deepEqual(world.camera.position.toArray(), first.camera);
  assert.equal(arm.rotation.z, first.arm);
  assert.deepEqual(world.scene.getObjectByName('Orange subject').position.toArray(), first.subject);
  assert.equal(world.camera.aspect, 640 / 360);
  const exported = world.scene.toJSON();
  assert.ok(exported.geometries.length > 0);
  assert.ok(exported.materials.length > 0);
});
