import { describe, expect, it } from 'vitest';
import { buildFrontlineSegments, type FrontlineCell } from './frontlineOverlay';

function createCell(pushDirection: FrontlineCell['pushDirection']): FrontlineCell {
  return {
    x: 10,
    y: 6,
    leadingFactionId: 'faction-a',
    contestedStrength: 4,
    pushDirection,
  };
}

describe('frontlineOverlay', () => {
  it('anchors vertical frontlines to the shared east-west border instead of inside a region', () => {
    const [segment] = buildFrontlineSegments([createCell('east')]);

    expect(segment).toMatchObject({
      x1: 11,
      y1: 6,
      x2: 11,
      y2: 7,
    });
  });

  it('anchors horizontal frontlines to the shared north-south border instead of inside a region', () => {
    const [segment] = buildFrontlineSegments([createCell('south')]);

    expect(segment).toMatchObject({
      x1: 10,
      y1: 7,
      x2: 11,
      y2: 7,
    });
  });
});
