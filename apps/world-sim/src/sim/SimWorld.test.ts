import { describe, expect, it } from 'vitest';
import { type SimCommand, SimWorld } from './index';

describe('SimWorld deterministic replay', () => {
  it('produces the same replay snapshot for the same seed and commands', () => {
    const first = runReplay();
    const second = runReplay();

    expect(second).toBe(first);
  });

  it('accepts god commands through the command queue', () => {
    const world = new SimWorld({ seed: 'commands', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 10, y: 9 },
        count: 3,
      },
    });
    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 10, y: 9 },
        amount: 30,
        radius: 1,
      },
    });

    world.step();
    const projection = world.project();

    expect(projection.stats.population).toBeGreaterThanOrEqual(3);
    expect(projection.stats.totalFood).toBeGreaterThan(0);
    expect(projection.recentEvents.some((event) => event.type === 'command_accepted')).toBe(true);
  });

  it('rejects invalid god commands without mutating the world', () => {
    const world = new SimWorld({ seed: 'reject', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-invalid-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: -1, y: 2 },
        count: 3,
      },
    });

    world.step();
    const projection = world.project();

    expect(projection.stats.population).toBe(0);
    expect(projection.recentEvents.some((event) => event.type === 'command_rejected')).toBe(true);
  });

  it('does not let fresh spawn commands reproduce in the same tick', () => {
    const world = new SimWorld({ seed: 'spawn-pacing', width: 24, height: 18, initialUnits: 0 });

    world.enqueue({
      id: 'cmd-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 12, y: 9 },
        count: 10,
      },
    });
    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 12, y: 9 },
        amount: 500,
        radius: 6,
      },
    });

    world.step();

    expect(world.project().stats.population).toBe(10);
  });
});

describe('SimWorld life loop', () => {
  it('declines when food is removed and units starve', () => {
    const world = new SimWorld({ seed: 'starve', width: 24, height: 18, initialUnits: 12 });

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    const initialPopulation = world.project().stats.population;

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
    }

    expect(world.project().stats.population).toBeLessThan(initialPopulation);
  });

  it('can grow when local food is abundant', () => {
    const world = new SimWorld({ seed: 'growth', width: 24, height: 18, initialUnits: 18 });

    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 12, y: 9 },
        amount: 200,
        radius: 4,
      },
    });

    world.step();
    const initialPopulation = world.project().stats.population;

    for (let tick = 0; tick < 1800; tick += 1) {
      world.step();
    }

    expect(world.project().stats.population).toBeGreaterThan(initialPopulation);
  });

  it('keeps routine eating out of recent projection events', () => {
    const world = new SimWorld({
      seed: 'quiet-eating-events',
      width: 24,
      height: 18,
      initialUnits: 0,
    });

    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 12, y: 9 },
        amount: 200,
        radius: 4,
      },
    });
    world.enqueue({
      id: 'cmd-settlers',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 12, y: 9 },
        count: 8,
      },
    });

    for (let tick = 0; tick < 80; tick += 1) {
      world.step();
    }

    expect(world.project().recentEvents.some((event) => event.type === 'unit_ate')).toBe(false);
  });

  it('keeps noisy life and pressure ticks out of recent projection events', () => {
    const world = foundRivalKingdoms('quiet-recent-events', {
      leftFood: 80,
      rightFood: 760,
      distance: 24,
    });

    for (let tick = 0; tick < 520; tick += 1) {
      world.step();
    }

    const recentTypes = world.project().recentEvents.map((event) => event.type);

    expect(recentTypes).not.toContain('unit_died');
    expect(recentTypes).not.toContain('diplomacy_pressure');
    expect(recentTypes).toContain('war_declared');
  });

  it('runs 1000 units in pure simulation within the foundation budget', () => {
    const world = new SimWorld({ seed: 'scale-1000', width: 128, height: 128, initialUnits: 1000 });
    const start = performance.now();

    for (let tick = 0; tick < 40; tick += 1) {
      world.step();
    }

    const elapsedMs = performance.now() - start;

    expect(world.project().stats.population).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(500);
  });
});

describe('SimWorld projection culling', () => {
  it('keeps global stats while returning only viewport-visible simulation slices', () => {
    const world = new SimWorld({
      seed: 'projection-culling',
      width: 64,
      height: 64,
      initialUnits: 0,
    });

    world.enqueue({
      id: 'cmd-near-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 5, y: 5 },
        count: 1,
      },
    });
    world.enqueue({
      id: 'cmd-far-spawn',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 40, y: 40 },
        count: 1,
      },
    });
    world.enqueue({
      id: 'cmd-terrain',
      type: 'change_terrain',
      issuedAtTick: 0,
      payload: {
        terrain: 'lava',
        position: { x: 5, y: 5 },
        radius: 1,
      },
    });

    world.step();

    const fullProjection = world.project();
    const viewportProjection = world.project({
      viewport: { x: 0, y: 0, width: 10, height: 10, paddingTiles: 0 },
    });

    expect(fullProjection.tiles).toHaveLength(64 * 64);
    expect(viewportProjection.tiles).toHaveLength(100);
    expect(viewportProjection.tiles.every((tile) => tile.x < 10 && tile.y < 10)).toBe(true);
    expect(viewportProjection.units).toHaveLength(1);
    expect(viewportProjection.stats.population).toBe(2);
    expect(viewportProjection.terrainRevision).toBeGreaterThan(0);
  });
});

describe('SimWorld villages', () => {
  it('forms a village from a local population cluster with food pressure', () => {
    const world = new SimWorld({
      seed: 'village-foundation',
      width: 32,
      height: 24,
      initialUnits: 0,
    });

    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 16, y: 12 },
        amount: 120,
        radius: 4,
      },
    });
    world.enqueue({
      id: 'cmd-settlers',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 16, y: 12 },
        count: 10,
      },
    });

    world.step();
    const projection = world.project();

    expect(projection.villages).toHaveLength(1);
    expect(projection.villages[0]).toMatchObject({
      race: 'human',
      status: 'camp',
    });
    expect(projection.villages[0].population).toBeGreaterThanOrEqual(8);
    expect(projection.villages[0].foodInventory).toBeGreaterThan(0);
    expect(projection.villages[0].housingCapacity).toBeGreaterThanOrEqual(
      projection.villages[0].population,
    );
    expect(projection.stats.villages).toBe(1);
  });

  it('marks a village as declining when local food pressure exhausts its inventory', () => {
    const world = new SimWorld({
      seed: 'village-decline',
      width: 32,
      height: 24,
      initialUnits: 0,
    });

    world.enqueue({
      id: 'cmd-food',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 16, y: 12 },
        amount: 50,
        radius: 2,
      },
    });
    world.enqueue({
      id: 'cmd-settlers',
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position: { x: 16, y: 12 },
        count: 8,
      },
    });

    world.step();

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    for (let tick = 0; tick < 120; tick += 1) {
      world.step();
    }

    const village = world.project().villages[0];

    expect(village.status).toBe('declining');
    expect(village.foodInventory).toBe(0);
  });
});

describe('SimWorld village buildings and territory', () => {
  it('builds functional village buildings from surplus food and projects territory', () => {
    const world = foundFoodRichVillage('village-buildings');
    const initialVillage = world.project().villages[0];

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const village = projection.villages[0];
    const buildingTypes = projection.buildings.map((building) => building.type);

    expect(buildingTypes).toContain('hut');
    expect(buildingTypes).toContain('storage');
    expect(village.housingCapacity).toBeGreaterThan(initialVillage.housingCapacity);
    expect(village.foodCapacity).toBeGreaterThan(initialVillage.foodCapacity);
    expect(village.territoryTiles).toBeGreaterThan(initialVillage.territoryTiles);
    expect(projection.territory.some((tile) => tile.villageId === village.id)).toBe(true);
    expect(projection.stats.buildings).toBeGreaterThanOrEqual(2);
  });

  it('lets farm buildings produce village food after nearby deposits are exhausted', () => {
    const world = foundFoodRichVillage('village-farm');

    for (let tick = 0; tick < 360; tick += 1) {
      world.step();
    }

    expect(world.project().buildings.some((building) => building.type === 'farm')).toBe(true);

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    for (let tick = 0; tick < 31; tick += 1) {
      world.step();
    }

    const depletedFood = world.project().stats.totalVillageFood;

    for (let tick = 0; tick < 10; tick += 1) {
      world.step();
    }

    expect(world.project().stats.totalVillageFood).toBeGreaterThan(depletedFood);
  });

  it('keeps abandoned buildings as ruins-in-progress without active village benefits', () => {
    const world = foundFoodRichVillage('village-abandoned-buildings');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    expect(world.project().stats.activeBuildings).toBeGreaterThan(0);

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    for (let tick = 0; tick < 420; tick += 1) {
      world.step();
    }

    const projection = world.project();

    expect(projection.stats.population).toBe(0);
    expect(projection.stats.villages).toBe(0);
    expect(projection.stats.buildings).toBeGreaterThan(0);
    expect(projection.stats.activeBuildings).toBe(0);
    expect(projection.stats.abandonedBuildings).toBeGreaterThan(0);
    expect(projection.stats.housingCapacity).toBe(0);
    expect(projection.stats.totalVillageFood).toBe(0);
    expect(projection.stats.territoryTiles).toBe(0);
    expect(projection.buildings.every((building) => building.status === 'abandoned')).toBe(true);
  });

  it('keeps territory stable when villagers move away from the settlement center', () => {
    const world = foundFoodRichVillage('stable-territory');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const before = serializeTerritory(world.project().territory);

    world.enqueue({
      id: 'cmd-far-food',
      type: 'place_resource',
      issuedAtTick: world.currentTick,
      payload: {
        resourceType: 'food',
        position: { x: 2, y: 2 },
        amount: 400,
        radius: 3,
      },
    });

    for (let tick = 0; tick < 120; tick += 1) {
      world.step();
    }

    expect(serializeTerritory(world.project().territory)).toBe(before);
  });

  it('keeps village population tied to home ownership when residents move away', () => {
    const world = foundFoodRichVillage('stable-home-population');
    const initialVillage = world.project().villages[0];
    const initialPopulation = initialVillage.population;

    moveVillageResidents(world, initialVillage.id, { x: 2, y: 2 });
    world.step();

    const projection = world.project();
    const village = projection.villages.find((candidate) => candidate.id === initialVillage.id);
    const homeResidents = projection.units.filter(
      (unit) => unit.homeVillageId === initialVillage.id,
    );

    expect(village).toBeDefined();
    expect(village?.population).toBe(initialPopulation);
    expect(homeResidents).toHaveLength(initialPopulation);
  });
});

describe('SimWorld kingdoms', () => {
  it('founds a kingdom from a stable village with active buildings', () => {
    const world = foundFoodRichVillage('kingdom-foundation');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const village = projection.villages[0];
    const kingdom = projection.kingdoms[0];

    expect(projection.kingdoms).toHaveLength(1);
    expect(kingdom).toMatchObject({
      race: 'human',
      capitalVillageId: village.id,
      status: 'rising',
    });
    expect(kingdom.villageIds).toContain(village.id);
    expect(kingdom.population).toBe(village.population);
    expect(kingdom.buildingCount).toBe(projection.stats.activeBuildings);
    expect((kingdom as { color?: number }).color).toBeGreaterThan(0);
    expect(projection.stats.kingdoms).toBe(1);
  });

  it('adds nearby same-race villages to an existing kingdom and aggregates summary stats', () => {
    const world = foundTwoFoodRichVillages('kingdom-membership');

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const kingdom = projection.kingdoms[0];
    const villagePopulation = projection.villages.reduce(
      (total, village) => total + village.population,
      0,
    );

    expect(projection.villages.length).toBeGreaterThanOrEqual(2);
    expect(projection.kingdoms).toHaveLength(1);
    expect(kingdom.villageIds.length).toBeGreaterThanOrEqual(2);
    expect(kingdom.population).toBe(villagePopulation);
    expect(kingdom.territoryTiles).toBe(projection.stats.territoryTiles);
    expect(
      projection.territory
        .filter((tile) => kingdom.villageIds.includes(tile.villageId))
        .every((tile) => tile.kingdomId === kingdom.id),
    ).toBe(true);
    expect(projection.territory.filter((tile) => tile.kingdomId === kingdom.id)).toHaveLength(
      kingdom.territoryTiles,
    );
    expect(kingdom.foodInventory).toBe(projection.stats.totalVillageFood);
  });

  it('marks a kingdom as fallen when all member villages are abandoned', () => {
    const world = foundFoodRichVillage('kingdom-fallen');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    expect(world.project().kingdoms[0].status).toBe('rising');

    for (const [index, unit] of world.project().units.entries()) {
      world.enqueue({
        id: `cmd-fall-lightning-${index}`,
        type: 'lightning',
        issuedAtTick: world.currentTick,
        payload: {
          position: unit.position,
          radius: 16,
          damage: 999,
        },
      });
    }

    for (let tick = 0; tick < 20; tick += 1) {
      world.step();
    }

    const projection = world.project();

    expect(projection.stats.villages).toBe(0);
    expect(projection.kingdoms[0].status).toBe('fallen');
    expect(projection.stats.kingdoms).toBe(0);
    expect(projection.stats.fallenKingdoms).toBe(1);
  });
});

describe('SimWorld diplomacy pressure', () => {
  it('builds border friction and eventually declares war between nearby rival kingdoms', () => {
    const world = foundRivalKingdoms('diplomacy-border');
    let sawBorderFriction = false;
    let sawWarDeclaration = false;

    for (let tick = 0; tick < 420; tick += 1) {
      world.step();
      const recentEvents = world.project().recentEvents;
      sawBorderFriction ||= recentEvents.some((event) => event.type === 'border_friction');
      sawWarDeclaration ||= recentEvents.some((event) => event.type === 'war_declared');

      if (sawBorderFriction && sawWarDeclaration) {
        break;
      }
    }

    const projection = world.project();

    expect(projection.kingdoms).toHaveLength(2);
    expect(
      Math.max(...projection.kingdoms.map((kingdom) => kingdom.diplomacyPressure)),
    ).toBeGreaterThan(0);
    expect(sawBorderFriction).toBe(true);
    expect(sawWarDeclaration).toBe(true);
  });

  it('adds resource pressure when a rival kingdom falls behind on food', () => {
    const world = foundRivalKingdoms('diplomacy-resource', {
      leftFood: 180,
      rightFood: 620,
      distance: 42,
    });
    let sawResourcePressure = false;

    for (let tick = 0; tick < 360; tick += 1) {
      world.step();
      sawResourcePressure ||= world
        .project()
        .recentEvents.some((event) => event.type === 'resource_pressure');

      if (sawResourcePressure) {
        break;
      }
    }

    const projection = world.project();

    expect(projection.kingdoms).toHaveLength(2);
    expect(
      Math.max(...projection.kingdoms.map((kingdom) => kingdom.diplomacyPressure)),
    ).toBeGreaterThan(0);
    expect(sawResourcePressure).toBe(true);
  });
});

describe('SimWorld minimal war', () => {
  it('forms army groups after a war declaration', () => {
    const world = foundRivalKingdoms('minimal-war-army');
    let sawWarDeclaration = false;
    let sawArmyFormed = false;

    for (let tick = 0; tick < 480; tick += 1) {
      world.step();
      const recentEvents = world.project().recentEvents;
      sawWarDeclaration ||= recentEvents.some((event) => event.type === 'war_declared');
      sawArmyFormed ||= recentEvents.some((event) => event.type === 'army_formed');

      if (sawWarDeclaration && sawArmyFormed) {
        break;
      }
    }

    const projection = world.project();

    expect(sawWarDeclaration).toBe(true);
    expect(sawArmyFormed).toBe(true);
    expect(projection.armies.length).toBeGreaterThan(0);
    expect(projection.stats.activeArmies).toBeGreaterThan(0);
    expect(projection.armies.every((army) => army.soldierCount > 0)).toBe(true);
  });

  it('resolves group battles with casualties and village capture', () => {
    const world = foundRivalKingdoms('minimal-war-capture', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    const initialPopulation = world.project().stats.population;
    let sawBattleResolved = false;
    let sawVillageCaptured = false;
    let capturePayload: Record<string, string | number | boolean> | undefined;

    for (let tick = 0; tick < 900; tick += 1) {
      world.step();
      const recentEvents = world.project().recentEvents;
      sawBattleResolved ||= recentEvents.some((event) => event.type === 'battle_resolved');
      sawVillageCaptured ||= recentEvents.some((event) => event.type === 'village_captured');
      capturePayload ??= recentEvents.find((event) => event.type === 'village_captured')?.payload;

      if (sawBattleResolved && sawVillageCaptured) {
        break;
      }
    }

    const projection = world.project();

    expect(sawBattleResolved).toBe(true);
    expect(sawVillageCaptured).toBe(true);
    expect(capturePayload).toBeDefined();
    expect(projection.stats.population).toBeLessThan(initialPopulation);
    expect(projection.armies.every((army) => army.status !== 'fighting')).toBe(true);

    if (!capturePayload) {
      throw new Error('Expected village capture payload');
    }

    const capturedVillageId = String(capturePayload.villageId);
    const attackerKingdomId = String(capturePayload.attackerKingdomId);
    const capturedTerritory = projection.territory.filter(
      (tile) => tile.villageId === capturedVillageId,
    );

    expect(capturedTerritory.length).toBeGreaterThan(0);
    expect(capturedTerritory.every((tile) => tile.kingdomId === attackerKingdomId)).toBe(true);
  });
});

function runReplay() {
  const world = new SimWorld({ seed: 'replay', width: 32, height: 24, initialUnits: 8 });
  const commands: SimCommand[] = [
    {
      id: 'cmd-1',
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position: { x: 16, y: 12 },
        amount: 40,
        radius: 2,
      },
    },
    {
      id: 'cmd-2',
      type: 'spawn_unit',
      issuedAtTick: 2,
      payload: {
        race: 'orc',
        position: { x: 18, y: 12 },
        count: 2,
      },
    },
    {
      id: 'cmd-3',
      type: 'lightning',
      issuedAtTick: 5,
      payload: {
        position: { x: 18, y: 12 },
        radius: 2,
      },
    },
  ];

  for (let tick = 0; tick < 60; tick += 1) {
    for (const command of commands) {
      if (command.issuedAtTick === tick) {
        world.enqueue(command);
      }
    }

    world.step();
  }

  return world.serializeForReplay();
}

function foundFoodRichVillage(seed: string) {
  const world = new SimWorld({ seed, width: 32, height: 24, initialUnits: 0 });

  world.enqueue({
    id: 'cmd-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: { x: 16, y: 12 },
      amount: 600,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'cmd-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: { x: 16, y: 12 },
      count: 12,
    },
  });
  world.step();

  return world;
}

function foundTwoFoodRichVillages(seed: string) {
  const world = new SimWorld({ seed, width: 56, height: 32, initialUnits: 0 });

  for (const [index, position] of [
    { x: 12, y: 10 },
    { x: 42, y: 22 },
  ].entries()) {
    world.enqueue({
      id: `cmd-food-${index}`,
      type: 'place_resource',
      issuedAtTick: 0,
      payload: {
        resourceType: 'food',
        position,
        amount: 700,
        radius: 5,
      },
    });
    world.enqueue({
      id: `cmd-settlers-${index}`,
      type: 'spawn_unit',
      issuedAtTick: 0,
      payload: {
        race: 'human',
        position,
        count: 12,
      },
    });
  }

  world.step();

  return world;
}

function foundRivalKingdoms(
  seed: string,
  options?: {
    leftFood?: number;
    rightFood?: number;
    distance?: number;
  },
) {
  const world = new SimWorld({ seed, width: 64, height: 32, initialUnits: 0 });
  const leftPosition = { x: 12, y: 10 };
  const rightPosition = {
    x: options?.distance ? leftPosition.x + options.distance : 36,
    y: 10,
  };

  world.enqueue({
    id: 'cmd-left-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: leftPosition,
      amount: options?.leftFood ?? 700,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'cmd-left-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'human',
      position: leftPosition,
      count: 12,
    },
  });
  world.enqueue({
    id: 'cmd-right-food',
    type: 'place_resource',
    issuedAtTick: 0,
    payload: {
      resourceType: 'food',
      position: rightPosition,
      amount: options?.rightFood ?? 700,
      radius: 5,
    },
  });
  world.enqueue({
    id: 'cmd-right-settlers',
    type: 'spawn_unit',
    issuedAtTick: 0,
    payload: {
      race: 'orc',
      position: rightPosition,
      count: 12,
    },
  });

  world.step();

  return world;
}

function moveVillageResidents(
  world: SimWorld,
  villageId: string,
  position: { x: number; y: number },
) {
  const mutableWorld = world as unknown as {
    units: Map<string, { villageId?: string; position: { x: number; y: number } }>;
  };

  for (const unit of mutableWorld.units.values()) {
    if (unit.villageId === villageId) {
      unit.position = { ...position };
    }
  }
}

function serializeTerritory(
  territory: Array<{ x: number; y: number; villageId: string; kingdomId?: string }>,
) {
  return territory
    .map((tile) => `${tile.x},${tile.y},${tile.villageId},${tile.kingdomId ?? ''}`)
    .sort()
    .join('|');
}
