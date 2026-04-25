export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function base64ToImageFile(base64: string, mimeType: string, fileName: string) {
  const normalized = base64.includes(',') ? (base64.split(',').pop() ?? '') : base64;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export function waitNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
