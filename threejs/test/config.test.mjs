import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseFps, frameTime, assertVideoProbe } from '../config.mjs';
import { withTimeout } from '../render.mjs';

const args = ['--scene', '/tmp/scene.mjs', '--output', '/tmp/render', '--width', '640',
  '--height', '360', '--fps', '30000/1001', '--frames', '60'];

test('rational FPS is normalized without decimal rounding', () => {
  assert.deepEqual(parseFps('60000/2002'), {
    numerator: 30000, denominator: 1001, value: 30000 / 1001, rational: '30000/1001',
  });
  const config = parseArgs(args);
  assert.equal(config.duration, 2.002);
  assert.equal(frameTime(59, config.fps), 59 * 1001 / 30000);
  assert.equal(frameTime(0, config.fps), 0);
});

test('invalid timelines, missing arguments, duplicates and unknown flags fail', () => {
  for (const fps of ['0', '-2', '30/0', '29.97', 'NaN', 'Infinity', '241', '1/1000001', '1/1/1']) {
    assert.throws(() => parseFps(fps));
  }
  assert.throws(() => parseArgs([]), /required/);
  assert.throws(() => parseArgs([...args, '--frames', '3']), /Duplicate/);
  assert.throws(() => parseArgs([...args, '--bogus', '3']), /Unknown/);
  assert.throws(() => parseArgs([...args.slice(0, -1), '0']), /frames/);
  assert.throws(() => parseArgs([...args, '--seed', '-1']), /seed/);
  assert.throws(() => parseArgs([...args, '--frame-timeout-ms']), /Missing value/);
  assert.equal(parseArgs(args).allowNoSandbox, false);
  assert.equal(parseArgs([...args, '--allow-no-sandbox']).allowNoSandbox, true);
  assert.throws(() => parseArgs([...args, '--allow-no-sandbox', '--allow-no-sandbox']), /Duplicate/);
});

test('probe rejects wrong shape, count, fps and duration', () => {
  const config = parseArgs(args);
  const stream = { codec_type: 'video', width: 640, height: 360,
    nb_read_frames: '60', avg_frame_rate: '30000/1001', time_base: '1/30000', duration: '2.002000' };
  assert.equal(assertVideoProbe({ streams: [stream] }, config), stream);
  for (const change of [{ width: 320 }, { height: 180 }, { nb_read_frames: '59' },
    { avg_frame_rate: '30/1' }, { duration: '2.1' }, { duration: undefined }]) {
    assert.throws(() => assertVideoProbe({ streams: [{ ...stream, ...change }] }, config));
  }
  assert.throws(() => assertVideoProbe({ streams: [] }, config));
});

test('hung operations have a bounded timeout', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, 'test frame'), /test frame timed out/);
  assert.equal(await withTimeout(Promise.resolve(42), 1000, 'test'), 42);
});
