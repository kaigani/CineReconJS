import test from 'node:test';
import assert from 'node:assert/strict';
import { atStage, classifyRenderError, renderFailure } from '../errors.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { render } from '../render.mjs';
import { parseArgs } from '../config.mjs';

test('launch/server/encode/probe/environment errors never consume scene repair budget', () => {
  for (const stage of ['server-start', 'browser-launch', 'browser-context', 'runtime-load',
    'webgl-initialize', 'screenshot', 'encode', 'probe', 'environment', 'metadata', 'unknown']) {
    assert.deepEqual(classifyRenderError(new Error('fixture'), stage), { stage, kind: 'infrastructure' });
  }
});

test('module/contract/update/browser policy errors after launch are scene failures', () => {
  for (const stage of ['scene-initialize', 'scene-module', 'scene-contract', 'scene-update',
    'scene-export', 'browser-policy', 'browser-console']) {
    assert.deepEqual(classifyRenderError(new Error('fixture'), stage), { stage, kind: 'scene' });
  }
});

test('browser termination and OS faults remain infrastructure during scene work', () => {
  assert.deepEqual(classifyRenderError(new Error('page.evaluate: Target page, context or browser has been closed'),
    'scene-update'), { stage: 'browser-runtime', kind: 'infrastructure' });
  assert.deepEqual(classifyRenderError(new Error('WebGL context lost'), 'scene-update'),
    { stage: 'webgl-runtime', kind: 'infrastructure' });
  assert.deepEqual(classifyRenderError(Object.assign(new Error('disk full'), { code: 'ENOSPC' }), 'scene-export'),
    { stage: 'environment', kind: 'infrastructure' });
  assert.deepEqual(classifyRenderError(new Error('Frame 0 timed out'), 'scene-update'),
    { stage: 'scene-update', kind: 'scene' });
});

test('nested operation stages retain encode/probe classification', async () => {
  await assert.rejects(atStage('probe', () => { throw new Error('bad frame count'); }), error => {
    assert.deepEqual(classifyRenderError(error, 'encode'), { stage: 'probe', kind: 'infrastructure' });
    return true;
  });
  const policyError = renderFailure(new Error('Blocked request'), 'browser-policy', 'scene');
  assert.deepEqual(classifyRenderError(policyError, 'screenshot'), { stage: 'browser-policy', kind: 'scene' });
});

test('filesystem failures emit machine-readable infrastructure errors without launching a browser', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cinerecon-error-test-'));
  const output = path.join(root, 'output');
  try {
    const config = parseArgs(['--scene', path.join(root, 'missing.mjs'), '--output', output,
      '--width', '64', '--height', '64', '--fps', '30', '--frames', '1']);
    await assert.rejects(render(config), /ENOENT/);
    const result = JSON.parse(await readFile(path.join(output, 'renderer-error.json'), 'utf8'));
    assert.equal(result.status, 'failed');
    assert.equal(result.kind, 'infrastructure');
    assert.equal(result.stage, 'environment');
  } finally { await rm(root, { recursive: true, force: true }); }
});
