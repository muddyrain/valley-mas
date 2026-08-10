import { describe, expect, it } from 'vitest';
import { canRevealScreenshotEditor } from './screenshot-handoff';

describe('canRevealScreenshotEditor', () => {
  it('only accepts the active editing operation', () => {
    expect(canRevealScreenshotEditor('editing', 'active-operation', 'active-operation')).toBe(true);
    expect(canRevealScreenshotEditor('editing', 'active-operation', 'stale-operation')).toBe(false);
    expect(canRevealScreenshotEditor('capturing', 'active-operation', 'active-operation')).toBe(
      false,
    );
    expect(canRevealScreenshotEditor('editing', undefined, 'active-operation')).toBe(false);
  });
});
