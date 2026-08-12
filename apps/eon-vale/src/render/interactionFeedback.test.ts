import { describe, expect, it } from 'vitest';
import {
  buildingInteractionGeometry,
  entityInteractionGeometry,
  interactionStrokeWidth,
} from './interactionFeedback';

describe('interaction feedback geometry', () => {
  it('keeps hover and selection strokes constant in screen pixels across zoom levels', () => {
    expect(interactionStrokeWidth(1, 'hover')).toBe(1);
    expect(interactionStrokeWidth(4, 'hover')).toBe(0.25);
    expect(interactionStrokeWidth(0.5, 'selected')).toBe(3);
  });

  it('centers a thin entity ellipse on the visible ground footprint', () => {
    const geometry = entityInteractionGeometry();

    expect(geometry.shape).toBe('ellipse');
    expect(geometry.offsetZ).toBeLessThan(0);
    expect(geometry.radiusX).toBeGreaterThan(geometry.radiusZ * 2);
  });

  it('uses building footprints instead of a generic circular radius', () => {
    const geometry = buildingInteractionGeometry(0);

    expect(geometry.shape).toBe('ellipse');
    expect(geometry.radiusX).toBeGreaterThan(geometry.radiusZ);
  });
});
