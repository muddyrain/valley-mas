import { describe, expect, it } from 'vitest';
import {
  generatePassword,
  generateRandomAscii,
  generateRandomString,
  generateRandomStrings,
  generateRandomToken,
  RANDOM_STRING_PRESETS,
} from '../src/toolbox';

function expectOnlyCharacters(value: string, alphabet: string) {
  const allowed = new Set(Array.from(alphabet));
  expect(Array.from(value).every((char) => allowed.has(char))).toBe(true);
}

describe('random string tools', () => {
  it('generates 32 safe ASCII characters by default', () => {
    const safeAscii = RANDOM_STRING_PRESETS.find((preset) => preset.id === 'safeAscii');
    expect(safeAscii).toBeDefined();

    const value = generateRandomAscii();

    expect(value).toHaveLength(32);
    expectOnlyCharacters(value, safeAscii?.alphabet ?? '');
    expect(value).not.toMatch(/[\s"'\\`]/);
  });

  it('supports printable ASCII, alphanumeric, hex, and Base64URL presets', () => {
    for (const preset of RANDOM_STRING_PRESETS) {
      const value = generateRandomString({ length: 24, preset: preset.id });

      expect(value).toHaveLength(24);
      expectOnlyCharacters(value, preset.alphabet);
    }
  });

  it('generates multiple strings and clamps unsafe counts', () => {
    expect(generateRandomStrings({ count: 3, length: 8, preset: 'hex' })).toHaveLength(3);
    expect(generateRandomStrings({ count: 0, length: 8, preset: 'hex' })).toHaveLength(1);
    expect(generateRandomStrings({ count: 100, length: 8, preset: 'hex' })).toHaveLength(20);
  });

  it('normalizes unsafe lengths', () => {
    expect(generateRandomString({ length: 0, preset: 'alphanumeric' })).toHaveLength(1);
    expect(generateRandomString({ length: 999, preset: 'alphanumeric' })).toHaveLength(256);
  });

  it('keeps existing token and password helpers working', () => {
    expect(generateRandomToken(32)).toHaveLength(32);
    expect(
      generatePassword({
        length: 18,
        upper: true,
        lower: true,
        numbers: true,
        symbols: true,
        readable: false,
      }),
    ).toHaveLength(18);
  });
});
