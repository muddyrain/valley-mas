import { describe, expect, it } from 'vitest';
import { distributeGalleryResources } from './galleryMasonry';

const resources = [
  { id: 'one', width: 1600, height: 900 },
  { id: 'two', width: 900, height: 1350 },
  { id: 'three', width: 1200, height: 1200 },
  { id: 'four', width: 1920, height: 1080 },
];

function laneByResource(items: typeof resources, columnCount: number) {
  return new Map(
    distributeGalleryResources(items, columnCount).flatMap((column, lane) =>
      column.map((resource) => [resource.id, lane] as const),
    ),
  );
}

describe('distributeGalleryResources', () => {
  it('keeps existing resources in their lanes when a page is appended', () => {
    const initial = laneByResource(resources.slice(0, 3), 3);
    const appended = laneByResource(resources, 3);

    for (const [id, lane] of initial) {
      expect(appended.get(id)).toBe(lane);
    }
  });

  it('falls back deterministically when dimensions are missing', () => {
    const unknown = [{ id: 'unknown-one', width: 0, height: 0 }, { id: 'unknown-two' }];

    expect(distributeGalleryResources(unknown, 2)).toEqual([[unknown[0]], [unknown[1]]]);
  });
});
