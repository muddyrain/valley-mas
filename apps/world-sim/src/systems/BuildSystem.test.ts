import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../config/buildings';
import { createSmallTestMap } from '../test/createTestMap';
import { BuildSystem } from './BuildSystem';
import { ResourceSystem } from './ResourceSystem';

describe('BuildSystem', () => {
  it('queues the first hut only when enough wood is available', () => {
    const resourceSystem = new ResourceSystem(createSmallTestMap([]));
    const buildSystem = new BuildSystem(resourceSystem, new Phaser.Math.Vector2(24, 24));

    expect(buildSystem.hasBuildTask()).toBe(true);
    expect(buildSystem.getBuildings()).toHaveLength(1);
    expect(buildSystem.getBuildings()[0]).toMatchObject({
      type: 'hut',
      status: 'queued',
      hp: BUILDING_DEFS.hut.hp,
      progress: 0,
      progressRequired: BUILDING_DEFS.hut.buildProgressRequired,
    });
  });

  it('spends resources when construction starts and completes after enough progress', () => {
    const resourceSystem = new ResourceSystem(createSmallTestMap([]));
    const buildPoint = new Phaser.Math.Vector2(24, 24);
    const buildSystem = new BuildSystem(resourceSystem, buildPoint);

    const firstResult = buildSystem.buildAt(buildPoint, 1000);

    expect(firstResult).toBe(false);
    expect(resourceSystem.getInventory().wood).toBe(0);
    expect(buildSystem.getBuildings()[0]).toMatchObject({
      status: 'building',
      progress: 35,
    });

    const completed = buildSystem.buildAt(buildPoint, 2000);

    expect(completed).toBe(true);
    expect(buildSystem.getBuildings()[0]).toMatchObject({
      status: 'complete',
      progress: BUILDING_DEFS.hut.buildProgressRequired,
    });
    expect(buildSystem.getSummary()).toBe('建造：木屋 已完成');
  });

  it('does not build when the unit is too far from the target', () => {
    const resourceSystem = new ResourceSystem(createSmallTestMap([]));
    const buildPoint = new Phaser.Math.Vector2(24, 24);
    const buildSystem = new BuildSystem(resourceSystem, buildPoint);

    const result = buildSystem.buildAt(new Phaser.Math.Vector2(80, 80), 1000);

    expect(result).toBe(false);
    expect(resourceSystem.getInventory().wood).toBe(10);
    expect(buildSystem.getBuildings()[0]).toMatchObject({
      status: 'queued',
      progress: 0,
    });
  });

  it('tracks the owning faction and removes a building when it is destroyed', () => {
    const resourceSystem = new ResourceSystem(createSmallTestMap([]));
    const buildSystem = new BuildSystem(
      resourceSystem,
      new Phaser.Math.Vector2(24, 24),
      'faction-2',
    );

    expect(buildSystem.hasBuildTask()).toBe(true);
    const buildings = buildSystem.getBuildings();
    expect(buildings[0]).toMatchObject({
      factionId: 'faction-2',
      type: 'hut',
    });

    const destroyed = buildSystem.damageBuilding(buildings[0].id, 999);

    expect(destroyed).toBe(true);
    expect(buildSystem.getBuildings()).toHaveLength(0);
  });

  it('queues additional huts when population exceeds the current housing demand', () => {
    const resourceSystem = new ResourceSystem(
      createSmallTestMap(
        [
          {
            x: 0,
            y: 0,
            terrainType: 'forest',
            resourceType: 'wood',
            resourceAmount: 10,
          },
        ],
        4,
      ),
    );
    const buildPoint = new Phaser.Math.Vector2(24, 24);
    const buildSystem = new BuildSystem(resourceSystem, buildPoint);

    buildSystem.setPopulationDemand(10);
    expect(buildSystem.hasBuildTask()).toBe(true);
    expect(buildSystem.buildAt(buildPoint, 3000)).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      resourceSystem.harvestAt(new Phaser.Math.Vector2(8, 8));
    }

    expect(buildSystem.hasBuildTask()).toBe(true);
    expect(buildSystem.getBuildings()).toHaveLength(2);
    expect(buildSystem.getBuildings()[1]).toMatchObject({
      type: 'hut',
      status: 'queued',
    });
    expect(buildSystem.getBuildings()[1].position).not.toEqual(buildPoint);
  });
});
