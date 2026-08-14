import { describe, expect, it } from 'vitest';
import { getYujiImageTransitionName } from './yujiViewTransition';

describe('getYujiImageTransitionName', () => {
  it('creates a stable safe shared-element name from a resource id', () => {
    expect(getYujiImageTransitionName('2056740780055564288')).toBe(
      'yuji-image-2056740780055564288',
    );
    expect(getYujiImageTransitionName('image / spring')).toBe('yuji-image-image---spring');
  });
});
