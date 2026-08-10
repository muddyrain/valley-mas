const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export function isValidPng(png: Uint8Array): boolean {
  return (
    png.byteLength >= 24 &&
    png.byteLength <= 64 * 1024 * 1024 &&
    PNG_SIGNATURE.every((byte, index) => png[index] === byte)
  );
}
