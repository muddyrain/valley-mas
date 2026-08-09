import { describe, expect, it } from 'vitest';
import { isValidPng } from './png';

describe('PNG validation', () => {
  it('accepts a bounded PNG payload before saving or copying it', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(isValidPng(png)).toBe(true);
  });

  it('rejects truncated data and a false PNG prefix', () => {
    expect(isValidPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(isValidPng(new Uint8Array(24))).toBe(false);
  });
});
