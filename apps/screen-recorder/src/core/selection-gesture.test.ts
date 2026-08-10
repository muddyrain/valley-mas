import { describe, expect, it } from 'vitest';
import { canStartSelectionGesture } from './selection-gesture';

describe('selection gesture guard', () => {
  it('starts only from the primary left pointer button', () => {
    expect(canStartSelectionGesture(0, true)).toBe(true);
    expect(canStartSelectionGesture(2, false)).toBe(false);
    expect(canStartSelectionGesture(2, true)).toBe(false);
  });
});
