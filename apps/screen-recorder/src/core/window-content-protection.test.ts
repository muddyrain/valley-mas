import { describe, expect, it } from 'vitest';
import { shouldProtectWindowContent } from './window-content-protection';

describe('window content protection', () => {
  it('keeps settings visible to third-party screenshot tools', () => {
    expect(shouldProtectWindowContent('settings')).toBe(false);
  });

  it('still excludes recorder-owned overlays from captured output', () => {
    expect(shouldProtectWindowContent('capture-overlay')).toBe(true);
  });

  it('allows pinned screenshots to appear in later captures', () => {
    expect(shouldProtectWindowContent('pinned-screenshot')).toBe(false);
  });
});
