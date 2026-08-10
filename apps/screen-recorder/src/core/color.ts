export type RgbColor = { r: number; g: number; b: number };
export type ColorFormat = 'hex' | 'rgb';

export function colorFormatForShift(shiftKey: boolean): ColorFormat {
  return shiftKey ? 'rgb' : 'hex';
}

function channel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(color: RgbColor): string {
  const parts = [color.r, color.g, color.b].map((value) =>
    channel(value).toString(16).padStart(2, '0').toUpperCase(),
  );
  return `#${parts.join('')}`;
}

export function formatPickedColor(color: RgbColor, format: ColorFormat): string {
  if (format === 'hex') return rgbToHex(color);
  return `rgb(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)})`;
}

export function isSupportedColorText(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^#[\dA-F]{6}$/i.test(value)) return true;
  const match = value.match(/^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i);
  return Boolean(match?.slice(1).every((part) => Number(part) <= 255));
}
