import { describe, expect, it } from 'vitest';
import { BuildingType, ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import { pickWorldObject } from './worldPicking';

describe('world object picking', () => {
  it('keeps every rendered settlement resident pickable regardless of entity id', () => {
    const picked = pickWorldObject({
      viewLevel: 'settlement',
      point: { x: 10, z: 10 },
      entities: [{ id: 3, x: 10, z: 10, active: true, health: 1_000 }],
      buildings: [],
      resources: [],
    });

    expect(picked).toEqual({ kind: 'entity', id: 3 });
  });

  it('selects a visible settlement resource instead of making trees click-through', () => {
    const picked = pickWorldObject({
      viewLevel: 'settlement',
      point: { x: 20, z: 18.7 },
      entities: [],
      buildings: [],
      resources: [
        {
          id: 3,
          x: 20,
          z: 20,
          active: true,
          kind: ResourceNodeKind.Tree,
          stage: ResourceNodeStage.Mature,
          variant: 0,
        },
      ],
    });

    expect(picked).toEqual({ kind: 'resource', id: 3 });
  });

  it('uses object silhouettes and visual order to resolve overlaps', () => {
    const picked = pickWorldObject({
      viewLevel: 'resident',
      point: { x: 30.1, z: 29.2 },
      entities: [{ id: 7, x: 30.1, z: 30, active: true, health: 1_000 }],
      buildings: [
        {
          id: 2,
          villageId: 1,
          type: BuildingType.Home,
          x: 30,
          z: 30,
          health: 100,
        },
      ],
      resources: [],
    });

    expect(picked).toEqual({ kind: 'entity', id: 7 });
  });
});
