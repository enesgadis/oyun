// Generates the PWA icons as real PNGs without any dependency.
// Pixel grid is designed at 64×64 and scaled with nearest-neighbour.

import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'icons');

const COLORS = {
  bg: [8, 13, 22, 255],
  bg2: [13, 22, 38, 255],
  line: [94, 242, 192, 255],
  cyan: [89, 215, 255, 255],
  amber: [255, 200, 87, 255],
  dim: [27, 43, 69, 255],
};

function design(maskable = false) {
  const px = new Uint8ClampedArray(64 * 64 * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= 64 || y >= 64) return;
    const i = (y * 64 + x) * 4;
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
    px[i + 3] = color[3];
  };
  const rect = (x, y, w, h, color) => {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) set(xx, yy, color);
  };
  // Background + subtle vertical bands.
  rect(0, 0, 64, 64, COLORS.bg);
  for (let x = 0; x < 64; x += 8) rect(x, 0, 1, 64, COLORS.bg2);
  for (let y = 0; y < 64; y += 8) rect(0, y, 64, 1, COLORS.bg2);

  if (maskable) {
    // Safe-zone friendly: keep artwork inside the middle 80%.
    rect(0, 0, 64, 64, COLORS.bg);
    for (let x = 0; x < 64; x += 4) rect(x, 0, 1, 64, COLORS.bg2);
    for (let y = 0; y < 64; y += 4) rect(0, y, 64, 1, COLORS.bg2);
    rect(18, 18, 28, 28, COLORS.line);
    rect(21, 21, 22, 22, COLORS.bg);
    rect(25, 25, 4, 4, COLORS.line);
    rect(29, 29, 4, 4, COLORS.line);
    rect(25, 33, 4, 4, COLORS.line);
    rect(33, 37, 8, 3, COLORS.cyan);
    rect(8, 8, 4, 4, COLORS.amber);
    rect(52, 52, 4, 4, COLORS.amber);
    return px;
  }

  // Outer frame.
  rect(3, 3, 58, 58, COLORS.dim);
  rect(4, 4, 56, 56, COLORS.bg);
  rect(4, 4, 56, 2, COLORS.line);
  rect(4, 58, 56, 2, COLORS.line);
  rect(4, 4, 2, 56, COLORS.line);
  rect(58, 4, 2, 56, COLORS.line);

  // Terminal caret ">".
  rect(13, 17, 4, 4, COLORS.line);
  rect(17, 21, 4, 4, COLORS.line);
  rect(21, 25, 4, 4, COLORS.line);
  rect(17, 29, 4, 4, COLORS.line);
  rect(13, 33, 4, 4, COLORS.line);

  // Underscore.
  rect(30, 37, 18, 4, COLORS.cyan);

  // Top data bars.
  rect(36, 13, 14, 3, COLORS.amber);
  rect(42, 20, 8, 3, COLORS.line);

  // Bottom status pips.
  rect(12, 48, 3, 3, COLORS.line);
  rect(18, 48, 3, 3, COLORS.cyan);
  rect(24, 48, 3, 3, COLORS.amber);
  return px;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function scale(px, factor) {
  const size = 64 * factor;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sx = Math.floor(x / factor);
      const sy = Math.floor(y / factor);
      const si = (sy * 64 + sx) * 4;
      const di = (y * size + x) * 4;
      out[di] = px[si];
      out[di + 1] = px[si + 1];
      out[di + 2] = px[si + 2];
      out[di + 3] = px[si + 3];
    }
  }
  return { size, out };
}

await mkdir(OUT, { recursive: true });
for (const [name, factor, maskable] of [
  ['icon-192.png', 3, false],
  ['icon-512.png', 8, false],
  ['icon-maskable-512.png', 8, true],
]) {
  const { size, out } = scale(design(maskable), factor);
  await writeFile(join(OUT, name), png(size, size, out));
  console.log(`icons/${name} — ${size}×${size}`);
}
console.log('PWA ikonları hazır.');
