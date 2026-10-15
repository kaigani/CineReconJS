import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { encodeFrames } from '../render.mjs';
import { parseArgs } from '../config.mjs';

function png(width, height, color) {
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (name, bytes) => {
    const type = Buffer.from(name), result = Buffer.alloc(bytes.length + 12);
    result.writeUInt32BE(bytes.length); type.copy(result, 4); bytes.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([type, bytes])), bytes.length + 8); return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    rows.set(color, y * (width * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

for (const [width, height] of [[64, 48], [65, 49]]) {
  test(`encoder preserves exact rational timeline and ${width}x${height} shape`, async () => {
    const output = await mkdtemp(path.join(os.tmpdir(), 'cinerecon-encode-'));
    try {
      const framesDir = path.join(output, 'frames'); await mkdir(framesDir);
      for (let frame = 0; frame < 6; frame++) {
        await writeFile(path.join(framesDir, `frame_${String(frame).padStart(6, '0')}.png`),
          png(width, height, [frame * 40, 50, 80]));
      }
      const config = parseArgs(['--scene', '/tmp/source.mjs', '--output', output, '--width', String(width),
        '--height', String(height), '--fps', '30000/1001', '--frames', '6']);
      const result = await encodeFrames(config, framesDir);
      assert.equal(result.videoStream.nb_read_frames, '6');
      assert.equal(result.videoStream.avg_frame_rate, '30000/1001');
      assert.equal(result.pixelFormat, width % 2 ? 'yuv444p' : 'yuv420p');
    } finally { await rm(output, { recursive: true, force: true }); }
  });
}
