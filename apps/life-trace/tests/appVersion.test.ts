import { describe, expect, it } from 'vitest';
import { formatAppVersion, normalizeBuildId, normalizeVersion } from '../src/lib/appVersion';

describe('app version label', () => {
  it('formats product version with build metadata', () => {
    expect(formatAppVersion('0.1.0', 'abc1234')).toBe('v0.1.0+abc1234');
  });

  it('normalizes version prefixes and empty build ids', () => {
    expect(formatAppVersion('v1.2.3', '')).toBe('v1.2.3+local');
    expect(normalizeVersion('')).toBe('0.0.0');
    expect(normalizeBuildId(undefined)).toBe('local');
  });
});
