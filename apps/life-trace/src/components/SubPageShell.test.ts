import { describe, expect, it } from 'vitest';
import { canNavigateBackFromState } from './SubPageShell';

describe('canNavigateBackFromState', () => {
  it('allows history back only when the router history index is positive', () => {
    expect(canNavigateBackFromState({ idx: 2 })).toBe(true);
    expect(canNavigateBackFromState({ idx: 0 })).toBe(false);
    expect(canNavigateBackFromState(null)).toBe(false);
  });
});
