import { describe, expect, it } from 'vitest';
import { findSelectionDisplayChange } from './selection-display';

const displays = [
  {
    id: 'retina',
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    scaleFactor: 2,
  },
  {
    id: 'external',
    bounds: { x: 2560, y: 0, width: 2560, height: 1440 },
    scaleFactor: 1,
  },
];

describe('selection display following', () => {
  it('switches an idle selection overlay to the display under the cursor', () => {
    expect(findSelectionDisplayChange(displays, 'retina', { x: 3200, y: 500 }, false)?.id).toBe(
      'external',
    );
  });

  it('does not switch displays during an active selection gesture', () => {
    expect(
      findSelectionDisplayChange(displays, 'retina', { x: 3200, y: 500 }, true),
    ).toBeUndefined();
  });

  it('does not report a change while the cursor stays on the current display', () => {
    expect(
      findSelectionDisplayChange(displays, 'retina', { x: 500, y: 500 }, false),
    ).toBeUndefined();
  });
});
