import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three';

export function createRadialAlphaTexture(size = 64): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center) / Math.max(center, 1);
      const intensity = Math.round(Math.max(0, 1 - distance) ** 1.7 * 255);
      const offset = (y * size + x) * 4;
      data[offset] = intensity;
      data[offset + 1] = intensity;
      data[offset + 2] = intensity;
      data[offset + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
