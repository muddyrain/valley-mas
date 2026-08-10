import { describe, expect, it } from 'vitest';
import { colorFormatForShift, formatPickedColor, rgbToHex } from './color';

describe('picked color formatting', () => {
  it('formats bounded RGB channels as uppercase HEX and CSS RGB', () => {
    expect(rgbToHex({ r: 10, g: 127, b: 255 })).toBe('#0A7FFF');
    expect(formatPickedColor({ r: 10, g: 127, b: 255 }, 'rgb')).toBe('rgb(10, 127, 255)');
  });

  it('rounds and clamps sampled channel values', () => {
    expect(rgbToHex({ r: -4, g: 12.6, b: 999 })).toBe('#000DFF');
  });

  it('uses HEX by default, switches to RGB only while Shift is held, then returns to HEX', () => {
    expect(colorFormatForShift(false)).toBe('hex');
    expect(colorFormatForShift(true)).toBe('rgb');
    expect(colorFormatForShift(false)).toBe('hex');
  });
});
