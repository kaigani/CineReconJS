import path from 'node:path';

const OPTIONS = new Set(['scene', 'output', 'width', 'height', 'fps', 'frames', 'seed',
  'chromium-executable', 'frame-timeout-ms', 'allow-no-sandbox']);

export const USAGE = `Usage: node threejs/render.mjs --scene scene.mjs --output run-dir
  --width 640 --height 360 --fps 30000/1001 --frames 60
  [--seed 0] [--chromium-executable /usr/bin/chromium] [--frame-timeout-ms 30000]
  [--allow-no-sandbox] (only inside an already-isolated disposable container)
Generated code runs in a browser, but this is NOT a security sandbox.
Use a disposable, network-isolated container without credentials for untrusted scenes.`;

function integer(value, label, min, max) {
  if (!/^\d+$/.test(String(value))) throw new Error(`${label} must be an integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }

export function parseFps(value) {
  if (!/^\d+(\/\d+)?$/.test(String(value))) {
    throw new Error('fps must be a positive integer or rational such as 30000/1001');
  }
  const [n, d = '1'] = String(value).split('/');
  const numerator = integer(n, 'fps numerator', 1, 1000000);
  const denominator = integer(d, 'fps denominator', 1, 1000000);
  const divisor = gcd(numerator, denominator);
  if (numerator / denominator > 240) throw new Error('fps must be at most 240');
  return { numerator: numerator / divisor, denominator: denominator / divisor,
    value: numerator / denominator, rational: `${numerator / divisor}/${denominator / divisor}` };
}

export function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i]?.replace(/^--/, '');
    if (!args[i]?.startsWith('--') || !OPTIONS.has(key)) throw new Error(`Unknown option: ${args[i]}`);
    if (Object.hasOwn(values, key)) throw new Error(`Duplicate option: --${key}`);
    if (key === 'allow-no-sandbox') { values[key] = true; continue; }
    if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error(`Missing value for --${key}`);
    values[key] = args[++i];
  }
  for (const key of ['scene', 'output', 'width', 'height', 'fps', 'frames']) {
    if (!values[key]) throw new Error(`Missing required --${key}`);
  }
  const fps = parseFps(values.fps);
  const frames = integer(values.frames, 'frames', 1, 1000000);
  return {
    scene: path.resolve(values.scene), output: path.resolve(values.output),
    width: integer(values.width, 'width', 1, 8192),
    height: integer(values.height, 'height', 1, 8192), fps, frames,
    seed: integer(values.seed ?? '0', 'seed', 0, 4294967295),
    frameTimeoutMs: integer(values['frame-timeout-ms'] ?? '30000', 'frame-timeout-ms', 100, 300000),
    chromiumExecutable: values['chromium-executable'],
    allowNoSandbox: values['allow-no-sandbox'] === true,
    duration: frames * fps.denominator / fps.numerator,
  };
}

export function frameTime(frame, fps) { return frame * fps.denominator / fps.numerator; }

export function assertVideoProbe(probe, config) {
  const streams = probe.streams?.filter(s => s.codec_type === 'video') ?? [];
  if (streams.length !== 1) throw new Error('Encoded video must contain exactly one video stream');
  const stream = streams[0];
  if (stream.width !== config.width || stream.height !== config.height) {
    throw new Error(`Encoded video dimensions mismatch: ${stream.width}x${stream.height}`);
  }
  if (Number(stream.nb_read_frames) !== config.frames) {
    throw new Error(`Encoded video frame count mismatch: ${stream.nb_read_frames}`);
  }
  if (parseFps(stream.avg_frame_rate).rational !== config.fps.rational) {
    throw new Error(`Encoded video FPS mismatch: ${stream.avg_frame_rate}`);
  }
  // MP4 duration is represented in integer stream ticks. Half a frame is far too
  // permissive; allow only one microsecond plus one stream time-base tick.
  const [tn, td] = (stream.time_base ?? '1/1000000').split('/').map(Number);
  if (!Number.isFinite(Number(stream.duration)) ||
      Math.abs(Number(stream.duration) - config.duration) > tn / td + 0.000001) {
    throw new Error(`Encoded video duration mismatch: ${stream.duration}`);
  }
  if (probe.frames) {
    if (probe.frames.length !== config.frames) throw new Error('Decoded frame timestamp count mismatch');
    for (let frame = 0; frame < config.frames; frame++) {
      const timestamp = Number(probe.frames[frame].best_effort_timestamp) * tn / td;
      if (!Number.isFinite(timestamp) || Math.abs(timestamp - frameTime(frame, config.fps)) > 0.000001) {
        throw new Error(`Encoded video timestamp mismatch at frame ${frame}: ${timestamp}`);
      }
    }
  }
  return stream;
}
