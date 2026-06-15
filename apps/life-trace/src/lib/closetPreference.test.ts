import { describe, expect, it } from 'vitest';
import { getClosetPreferenceLabel } from '@/lib/closetPreference';

describe('closetPreference', () => {
  it('maps preference levels to concise labels', () => {
    expect(getClosetPreferenceLabel('favorite')).toBe('常穿');
    expect(getClosetPreferenceLabel('avoid')).toBe('少穿');
    expect(getClosetPreferenceLabel('neutral')).toBe('');
  });
});
