import { describe, expect, it } from 'vitest';
import { shouldShowSelectionLabel } from './selection-label';

describe('selection label visibility', () => {
  it('hides the label for compact automatic targets', () => {
    expect(shouldShowSelectionLabel({ x: 2400, y: 0, width: 12, height: 25 }, true)).toBe(false);
    expect(shouldShowSelectionLabel({ x: 0, y: 0, width: 2560, height: 25 }, true)).toBe(false);
  });

  it('keeps the label for a normal automatic window target', () => {
    expect(shouldShowSelectionLabel({ x: 120, y: 80, width: 960, height: 720 }, true)).toBe(true);
  });

  it('keeps size feedback while the user draws a compact selection', () => {
    expect(shouldShowSelectionLabel({ x: 30, y: 40, width: 48, height: 32 }, false)).toBe(true);
  });
});
