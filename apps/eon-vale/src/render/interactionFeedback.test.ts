import { describe, expect, it } from 'vitest';
import { ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import {
  buildingInteractionGeometry,
  entityInteractionGeometry,
  interactionStrokeWidth,
  resourceInteractionGeometry,
} from './interactionFeedback';

describe('interaction feedback geometry', () => {
  it('keeps hover and selection strokes constant in screen pixels across zoom levels', () => {
    expect(interactionStrokeWidth(1, 'hover')).toBe(1.25);
    expect(interactionStrokeWidth(4, 'hover')).toBe(0.3125);
    expect(interactionStrokeWidth(0.5, 'selected')).toBe(4.5);
  });

  it('encloses the visible entity body instead of marking only its feet', () => {
    const geometry = entityInteractionGeometry();

    expect(geometry.shape).toBe('ellipse');
    expect(geometry.offsetZ).toBeLessThan(-0.5);
    expect(geometry.radiusZ).toBeGreaterThan(geometry.radiusX);
  });

  it('uses building footprints instead of a generic circular radius', () => {
    const geometry = buildingInteractionGeometry(0);

    expect(geometry.shape).toBe('ellipse');
    expect(geometry.radiusX).toBeGreaterThan(geometry.radiusZ);
  });

  it('encloses a mature tree canopy rather than its trunk cell', () => {
    const geometry = resourceInteractionGeometry(ResourceNodeKind.Tree, ResourceNodeStage.Mature);

    expect(geometry.offsetZ).toBeLessThan(-2);
    expect(geometry.radiusX).toBeGreaterThan(1.5);
    expect(geometry.radiusZ).toBeGreaterThan(1.5);
  });
});
