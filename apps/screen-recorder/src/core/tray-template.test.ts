import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

function paeth(left: number, above: number, upperLeft: number): number {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodeRgbaPixels(png: Buffer): { width: number; height: number; pixels: Buffer } {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const imageData: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
    } else if (type === 'IDAT') {
      imageData.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  expect({ bitDepth, colorType }).toEqual({ bitDepth: 8, colorType: 6 });
  const source = inflateSync(Buffer.concat(imageData));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = source[sourceOffset] ?? 0;
    sourceOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const raw = source[sourceOffset + x] ?? 0;
      const left = x >= bytesPerPixel ? (pixels[y * stride + x - bytesPerPixel] ?? 0) : 0;
      const above = y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel ? (pixels[(y - 1) * stride + x - bytesPerPixel] ?? 0) : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : paeth(left, above, upperLeft);
      pixels[y * stride + x] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }
  return { width, height, pixels };
}

describe('macOS tray template bitmaps', () => {
  it.each([
    ['trayTemplate.png', 16],
    ['trayTemplate@2x.png', 32],
  ])('keeps %s transparent outside the line artwork', async (filename, expectedSize) => {
    const png = await readFile(new URL(`../../assets/${filename}`, import.meta.url));
    const { width, height, pixels } = decodeRgbaPixels(png);
    expect([width, height]).toEqual([expectedSize, expectedSize]);

    const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
    expect([
      alphaAt(0, 0),
      alphaAt(width - 1, 0),
      alphaAt(0, height - 1),
      alphaAt(width - 1, height - 1),
    ]).toEqual([0, 0, 0, 0]);
    expect(Array.from({ length: width * height }, (_, index) => pixels[index * 4 + 3])).toContain(
      255,
    );
  });
});
