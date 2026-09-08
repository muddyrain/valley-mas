// Electron's supported macOS/Windows targets expose opaque screen pixels as BGRA.
// A top-down 32-bit BMP carries these pixels without PNG compression or color loss.
export function encodeCaptureBitmap(
  pixels: Buffer,
  size: { width: number; height: number },
): Buffer<ArrayBuffer> {
  const { width, height } = size;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.length !== width * height * 4
  ) {
    throw new Error('Invalid capture bitmap dimensions');
  }
  const header = Buffer.alloc(54);
  header.write('BM');
  header.writeUInt32LE(header.length + pixels.length, 2);
  header.writeUInt32LE(header.length, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(-height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28);
  header.writeUInt32LE(pixels.length, 34);
  return Buffer.concat([header, pixels]);
}
