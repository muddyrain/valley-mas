import { describe, expect, it } from 'vitest';
import { type SimCommand, SimWorld } from './index';
import type { ArmyGroup, Kingdom, Unit, Village, VillageBuilding } from './types';

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

  it('uses seeded viable default start positions instead of always spawning at map center', () => {
    const first = new SimWorld({
      seed: 'default-start-west',
      width: 64,
      height: 48,
      initialUnits: 12,
    });
    const second = new SimWorld({
      seed: 'default-start-east',
      width: 64,
      height: 48,
      initialUnits: 12,
    });
    const mapCenter = { x: 32, y: 24 };
    const firstStart = averageUnitPosition(first.project().units);
    const secondStart = averageUnitPosition(second.project().units);

    expect(distanceBetween(firstStart, mapCenter)).toBeGreaterThan(4);
    expect(distanceBetween(secondStart, mapCenter)).toBeGreaterThan(4);
    expect(distanceBetween(firstStart, secondStart)).toBeGreaterThan(4);
    expect(hasFoodNear(first, firstStart, 6)).toBe(true);
    expect(hasFoodNear(second, secondStart, 6)).toBe(true);
  });

  it('spreads larger default populations across distant food-supported start clusters', () => {
    const world = new SimWorld({
      seed: 'default-start-multi-cluster',
      width: 128,
      height: 96,
      initialUnits: 36,
    });
    const units = world.project().units;
    const clusters = groupPositionsByDistance(
      units.map((unit) => unit.position),
      8,
    );

    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(maxDistanceBetween(clusters)).toBeGreaterThan(60);
    expect(clusters.some((cluster) => hasFoodNear(world, cluster, 8))).toBe(true);
    expect(clusters.every((cluster) => hasWoodNear(world, cluster, 24))).toBe(true);
  });

  it('lets distant default start clusters grow into separate kingdoms for rebellion testing', () => {
    const world = new SimWorld({
      seed: 'default-start-multi-kingdom',
      width: 128,
      height: 96,
      initialUnits: 36,
    });

    for (let tick = 0; tick < 520; tick += 1) {
      world.step();
    }

    expect(world.project().kingdoms.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SimWorld life loop', () => {
  it('declines when food is removed and units starve', () => {
    const world = new SimWorld({ seed: 'starve', width: 24, height: 18, initialUnits: 12 });

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    const initialPopulation = world.project().stats.population;

    for (let tick = 0; tick < 520; tick += 1) {
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

  it('lets villagers eat from village stores when nearby food is gone', () => {
    const world = foundFoodRichVillage('village-store-supply');
    const mutableWorld = getMutableWorld(world) as unknown as {
      villages: Map<string, Village>;
      units: Map<string, Unit>;
    };
    const village = world.project().villages[0];
    const unit = [...world.project().units].find(
      (candidate) => candidate.homeVillageId === village.id,
    );

    if (!unit) {
      throw new Error('Expected a village resident');
    }

    removeFoodSitesNearVillage(world, village.id);
    const mutableVillage = mutableWorld.villages.get(village.id);

    if (!mutableVillage) {
      throw new Error(`Expected village ${village.id}`);
    }

    mutableVillage.foodInventory = 80;
    const mutableUnit = mutableWorld.units.get(unit.id);

    if (!mutableUnit) {
      throw new Error(`Expected unit ${unit.id}`);
    }

    mutableUnit.hunger = 60;

    world.step();

    const projection = world.project();
    const updatedVillage = projection.villages[0];
    const updatedUnit = projection.units.find((candidate) => candidate.id === unit.id);

    expect(updatedVillage.foodInventory).toBeLessThan(80);
    expect(updatedUnit?.hunger ?? 0).toBeLessThan(60);
  });

  it('does not double-charge village stores with periodic upkeep while residents are fed', () => {
    const world = foundFoodRichVillage('village-no-double-food-charge');
    const mutableWorld = getMutableWorld(world);
    const village = mutableWorld.villages.values().next().value as Village | undefined;

    if (!village) {
      throw new Error('Expected village');
    }

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    village.foodInventory = 80;
    village.woodInventory = 0;
    village.foundedAtTick = 0;
    mutableWorld.tick = 29;

    for (const unit of mutableWorld.units.values()) {
      if (unit.homeVillageId === village.id) {
        unit.hunger = 0;
      }
    }

    world.step();

    const updatedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(updatedVillage?.foodInventory).toBeGreaterThanOrEqual(80);
    expect(updatedVillage?.status).toBe('stable');
  });

  it('keeps well-fed villagers from seeking food after a short 60 tick window', () => {
    const world = new SimWorld({
      seed: 'unit-slower-hunger-rhythm',
      width: 24,
      height: 18,
      initialUnits: 1,
    });
    const mutableWorld = getMutableWorld(world);
    const unit = mutableWorld.units.values().next().value as Unit | undefined;

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    if (!unit) {
      throw new Error('Expected unit');
    }

    unit.hunger = 0;
    unit.intent = 'idle';

    for (let tick = 0; tick < 60; tick += 1) {
      world.step();
    }

    const updatedUnit = world.project().units.find((candidate) => candidate.id === unit.id);

    expect(updatedUnit).toBeDefined();
    expect(updatedUnit?.hunger ?? 0).toBeLessThan(35);
    expect(updatedUnit?.intent).not.toBe('seek_food');
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
    expect(projection.villages[0].foodReserveTarget).toBe(projection.villages[0].population * 2);
    expect(projection.villages[0].foodReserveBalance).toBeCloseTo(
      projection.villages[0].foodInventory - projection.villages[0].foodReserveTarget,
    );
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
        count: 60,
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
    expect(village.foodInventory).toBeLessThan(village.population * 2);
  });

  it('keeps a default farmer workforce before farms are built', () => {
    const world = new SimWorld({
      seed: 'village-default-farmers',
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
        amount: 60,
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

    const foundedVillage = world.project().villages[0];
    expect(foundedVillage.jobs.farmer).toBeGreaterThan(0);

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
    }

    const village = world.project().villages[0];

    expect(village.foodInventory).toBeGreaterThan(0);
    expect(village.population).toBeGreaterThan(0);
  });
});

describe('SimWorld village buildings and territory', () => {
  it('starts villages with a visible town hall anchor', () => {
    const world = foundFoodRichVillage('village-town-hall');
    const projection = world.project();
    const village = projection.villages[0];
    const townHall = projection.buildings.find((building) => building.type === 'town_hall');

    expect(townHall).toBeDefined();
    expect(townHall).toMatchObject({
      villageId: village.id,
      status: 'active',
      tier: 1,
    });
    expect(townHall?.position).toEqual(village.center);
    expect((village as Village & { woodCapacity?: number }).woodCapacity).toBeGreaterThan(0);
    expect((village as Village & { stoneCapacity?: number }).stoneCapacity).toBeGreaterThan(0);
    expect((village as Village & { ironCapacity?: number }).ironCapacity).toBeGreaterThan(0);
  });

  it('builds functional village buildings from surplus food and projects territory', () => {
    const world = foundFoodRichVillage('village-buildings');
    const initialVillage = world.project().villages[0];

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const village = projection.villages[0];
    const buildingTypes = projection.buildings.map((building) => building.type);
    const houses = projection.buildings.filter((building) => building.type === 'house');

    expect(buildingTypes).toContain('town_hall');
    expect(buildingTypes).toContain('house');
    expect(buildingTypes).toContain('storage');
    expect(houses.every((building) => building.tier && building.tier >= 1)).toBe(true);
    expect(village.housingCapacity).toBeGreaterThan(initialVillage.housingCapacity);
    expect(village.foodCapacity).toBeGreaterThan(initialVillage.foodCapacity);
    expect((village as Village & { woodCapacity?: number }).woodCapacity).toBeGreaterThan(
      (initialVillage as Village & { woodCapacity?: number }).woodCapacity ?? 0,
    );
    expect((village as Village & { stoneCapacity?: number }).stoneCapacity).toBeGreaterThan(
      (initialVillage as Village & { stoneCapacity?: number }).stoneCapacity ?? 0,
    );
    expect((village as Village & { ironCapacity?: number }).ironCapacity).toBeGreaterThan(
      (initialVillage as Village & { ironCapacity?: number }).ironCapacity ?? 0,
    );
    expect(village.territoryTiles).toBeGreaterThan(initialVillage.territoryTiles);
    expect(projection.territory.some((tile) => tile.villageId === village.id)).toBe(true);
    expect(projection.stats.buildings).toBeGreaterThanOrEqual(2);
  });

  it('shows buildings under construction before they become active', () => {
    const world = foundFoodRichVillage('village-construction');
    const initialVillage = world.project().villages[0];

    for (let tick = 0; tick < 59; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const house = projection.buildings.find((building) => building.type === 'house');

    expect(house?.status).toBe('constructing');

    world.step();

    const inProgressProjection = world.project();
    const inProgressHouse = inProgressProjection.buildings.find(
      (building) => building.id === house?.id,
    );

    expect(inProgressHouse?.constructionProgress ?? 0).toBeGreaterThan(0);

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const completedProjection = world.project();
    const completedHouse = completedProjection.buildings.find(
      (building) => building.id === house?.id,
    );

    expect(completedHouse?.status).toBe('active');
    expect(completedProjection.villages[0].housingCapacity).toBeGreaterThan(
      initialVillage.housingCapacity,
    );
  });

  it('raises village level as population, housing, and buildings grow', () => {
    const world = foundFoodRichVillage('village-level-growth');
    const initialLevel = world.project().villages[0].level;
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 8, 2400, 4);

    for (let tick = 0; tick < 240; tick += 1) {
      world.step();
    }

    const updatedVillage = world.project().villages[0];

    expect(updatedVillage.level).toBeGreaterThan(initialLevel);
    expect(updatedVillage.name.length).toBeGreaterThan(0);
    expect(
      world
        .project()
        .recentEvents.some(
          (event) =>
            event.type === 'village_leveled_up' &&
            event.payload?.villageId === updatedVillage.id &&
            event.payload?.level === updatedVillage.level,
        ),
    ).toBe(true);
  });

  it('does not start building when wood materials are missing', () => {
    const world = foundFoodRichVillage('village-no-wood');
    const village = world.project().villages[0];

    removeWoodSitesNearVillage(world, village.id);

    for (let tick = 0; tick < 240; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const builtTypes = projection.buildings.map((building) => building.type);

    expect(builtTypes).toEqual(['town_hall']);
  });

  it('builds houses from wood without spending food', () => {
    const world = foundFoodRichVillage('village-house-material-only');
    const mutableWorld = getMutableWorld(world) as unknown as {
      tick: number;
      tryBuildForVillage(village: Village): void;
      villages: Map<string, Village>;
      buildings: Map<string, VillageBuilding>;
    };
    const village = mutableWorld.villages.values().next().value as Village | undefined;

    if (!village) {
      throw new Error('Expected a village');
    }

    village.foodInventory = 0;
    village.woodInventory = 120;
    village.stoneInventory = 0;
    mutableWorld.tick = 60;

    mutableWorld.tryBuildForVillage(village);

    const house = [...mutableWorld.buildings.values()].find(
      (building) => building.villageId === village.id && building.type === 'house',
    );

    expect(house).toBeDefined();
    expect(village.foodInventory).toBe(0);
  });

  it('keeps new houses off resource deposits while clustering near the village core', () => {
    const world = foundFoodRichVillage('village-house-site-selection');
    const village = world.project().villages[0];
    const defaultRingTile = world.map.tiles.find(
      (tile) =>
        tile.x === Math.floor(village.center.x - 3) && tile.y === Math.floor(village.center.y + 2),
    );

    if (!defaultRingTile) {
      throw new Error('Expected default ring tile');
    }

    clearFoodPatches(world);
    defaultRingTile.terrain = 'grass';
    defaultRingTile.biome = 'temperate';
    defaultRingTile.resource = { type: 'food', amount: 80 };

    const house = createActiveBuildingInVillage(world, village.id, 'house');
    const houseTile = world.map.tiles.find(
      (tile) => tile.x === Math.floor(house.position.x) && tile.y === Math.floor(house.position.y),
    );

    expect(houseTile?.resource).toBeUndefined();
    expect(distanceBetween(house.position, village.center)).toBeLessThanOrEqual(5);
  });

  it('continues the material building chain when food is low', () => {
    const world = foundFoodRichVillage('village-material-chain-low-food');
    const mutableWorld = getMutableWorld(world) as unknown as {
      tick: number;
      tryBuildForVillage(village: Village): void;
      villages: Map<string, Village>;
      buildings: Map<string, VillageBuilding>;
    };
    const village = mutableWorld.villages.values().next().value as Village | undefined;

    if (!village) {
      throw new Error('Expected a village');
    }

    village.foodInventory = 0;
    village.woodInventory = 160;
    mutableWorld.tick = 60;
    mutableWorld.tryBuildForVillage(village);
    mutableWorld.tick = 120;
    mutableWorld.tryBuildForVillage(village);

    const storage = [...mutableWorld.buildings.values()].find(
      (building) => building.villageId === village.id && building.type === 'storage',
    );

    expect(storage).toBeDefined();
    expect(village.foodInventory).toBe(0);
  });

  it('upgrades town halls before unlocking higher house tiers', () => {
    const world = foundFoodRichVillage('village-upgrade-chain');
    const mutableWorld = getMutableWorld(world);
    const village = mutableWorld.villages.values().next().value as Village | undefined;
    const townHall = [...mutableWorld.buildings.values()].find(
      (building) => village && building.villageId === village.id && building.type === 'town_hall',
    );

    if (!village || !townHall) {
      throw new Error('Expected village with town hall');
    }

    village.population = 20;
    village.foodInventory = 3000;
    village.foodCapacity = 3000;
    village.woodInventory = 500;
    village.stoneInventory = 200;
    village.housingCapacity = 40;

    for (let index = 0; index < 8; index += 1) {
      const building = mutableWorld.createBuilding(village, 'house');
      mutableWorld.buildings.set(building.id, building);
    }

    const houses = [...mutableWorld.buildings.values()].filter(
      (building) => building.villageId === village.id && building.type === 'house',
    );
    const sim = world as unknown as {
      tryUpgradeTownHall(village: Village): boolean;
      tryUpgradeHouse(village: Village): boolean;
    };

    expect(sim.tryUpgradeTownHall(village)).toBe(true);
    expect(townHall.tier).toBe(2);
    expect(sim.tryUpgradeHouse(village)).toBe(true);
    expect(sim.tryUpgradeTownHall(village)).toBe(true);
    expect(townHall.tier).toBe(3);
    houses[0].tier = 2;
    houses[1].tier = 2;
    for (let index = 2; index < houses.length; index += 1) {
      houses[index].tier = 3;
    }
    expect(sim.tryUpgradeHouse(village)).toBe(true);

    const projection = world.project();
    const projectedHouses = projection.buildings.filter(
      (building) => building.villageId === village.id && building.type === 'house',
    );

    expect(projectedHouses.some((building) => building.tier === 2)).toBe(true);
    expect(projectedHouses.some((building) => building.tier === 3)).toBe(true);
    expect(
      projection.recentEvents.some(
        (event) => event.type === 'building_upgraded' && event.payload?.tier === 3,
      ),
    ).toBe(true);
  });

  it('does not upgrade houses beyond the active town hall tier', () => {
    const world = foundFoodRichVillage('village-house-gate');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 8, 1600);

    for (let tick = 0; tick < 420; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const townHall = projection.buildings.find(
      (building) => building.villageId === village.id && building.type === 'town_hall',
    );
    const houses = projection.buildings.filter(
      (building) => building.villageId === village.id && building.type === 'house',
    );

    expect(townHall?.tier ?? 1).toBe(1);
    expect(houses.length).toBeGreaterThan(0);
    expect(houses.every((building) => (building.tier ?? 1) <= 1)).toBe(true);
  });

  it('assigns farmers so farm buildings produce food after nearby deposits are exhausted', () => {
    const world = foundFoodRichVillage('village-farm');

    for (let tick = 0; tick < 360; tick += 1) {
      world.step();
    }

    const farmProjection = world.project();
    const village = farmProjection.villages[0];

    expect(farmProjection.buildings.some((building) => building.type === 'farm')).toBe(true);
    expect(village?.jobs.farmer).toBeGreaterThan(0);

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    mutableVillage.foodCapacity = Math.max(mutableVillage.foodCapacity, 1000);
    mutableVillage.foodInventory = Math.min(mutableVillage.foodInventory, 180);

    for (let tick = 0; tick < 31; tick += 1) {
      world.step();
    }

    mutableVillage.foodInventory = Math.max(0, mutableVillage.foodInventory - 50);
    const depletedFood = world.project().stats.totalVillageFood;

    for (let tick = 0; tick < 10; tick += 1) {
      world.step();
    }

    expect(world.project().stats.totalVillageFood).toBeGreaterThan(depletedFood);
  });

  it('places farms near food-rich land instead of a fixed village ring', () => {
    const world = foundFoodRichVillage('village-farm-site-selection');
    const village = world.project().villages[0];
    const foodPatchCenter = {
      x: Math.floor(village.center.x + 7),
      y: Math.floor(village.center.y),
    };

    clearFoodPatches(world);
    placeFoodPatch(world, foodPatchCenter, 500, 1);

    const farm = createActiveBuildingInVillage(world, village.id, 'farm');

    expect(distanceBetween(farm.position, foodPatchCenter)).toBeLessThanOrEqual(2.5);
  });

  it('projects active farms as windmills with surrounding farmland tiles', () => {
    const world = foundFoodRichVillage('village-farm-fields');
    const village = world.project().villages[0];
    const farm = createActiveBuildingInVillage(world, village.id, 'farm');
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    mutableVillage.jobs = {
      farmer: 1,
      builder: 0,
      miner: 0,
      soldier: 0,
      laborer: Math.max(0, mutableVillage.population - 1),
    };

    const projection = world.project();
    const fields = projection.farmland.filter((field) => field.farmId === farm.id);
    const projectedVillage = projection.villages.find((candidate) => candidate.id === village.id);

    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((field) => field.villageId === village.id)).toBe(true);
    expect(projectedVillage?.activeFarmCount).toBe(1);
    expect(projectedVillage?.maintainedFarmCount).toBe(1);
    expect(
      fields.every(
        (field) =>
          Math.abs(field.x - Math.floor(farm.position.x)) <= 2 &&
          Math.abs(field.y - Math.floor(farm.position.y)) <= 2,
      ),
    ).toBe(true);

    farm.status = 'abandoned';

    expect(world.project().farmland.some((field) => field.farmId === farm.id)).toBe(false);
  });

  it('requires assigned farmers for windmill fields to produce stable farm food', () => {
    const world = foundFoodRichVillage('village-farm-requires-maintenance');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    createActiveBuildingInVillage(world, village.id, 'farm');
    mutableVillage.foodCapacity = 1000;
    mutableVillage.foodInventory = 100;
    mutableVillage.jobs = {
      farmer: 0,
      builder: 0,
      miner: 0,
      soldier: 0,
      laborer: mutableVillage.population,
    };

    (
      getMutableWorld(world) as unknown as {
        produceFarmFood(village: Village): void;
      }
    ).produceFarmFood(mutableVillage);

    expect(mutableVillage.foodInventory).toBe(100);

    mutableVillage.jobs = {
      farmer: 1,
      builder: 0,
      miner: 0,
      soldier: 0,
      laborer: Math.max(0, mutableVillage.population - 1),
    };

    (
      getMutableWorld(world) as unknown as {
        produceFarmFood(village: Village): void;
      }
    ).produceFarmFood(mutableVillage);

    expect(mutableVillage.foodInventory).toBeGreaterThan(100);
  });

  it('never places non-town-hall buildings on an occupied building tile', () => {
    const world = foundFoodRichVillage('village-building-no-overlap', { width: 48, height: 32 });
    const village = world.project().villages[0];
    const townHall = world
      .project()
      .buildings.find(
        (building) => building.villageId === village.id && building.type === 'town_hall',
      );

    if (!townHall) {
      throw new Error('Expected town hall');
    }

    const fallbackTile = {
      x: Math.floor(village.center.x + 8),
      y: Math.floor(village.center.y),
    };

    for (const tile of world.map.tiles) {
      if (
        (tile.x === Math.floor(village.center.x) && tile.y === Math.floor(village.center.y)) ||
        (tile.x === fallbackTile.x && tile.y === fallbackTile.y)
      ) {
        tile.terrain = 'grass';
        tile.biome = 'temperate';
        tile.resource = undefined;
        continue;
      }

      if (distanceBetween(tile, village.center) <= 9) {
        tile.terrain = 'water';
        tile.biome = 'coast';
        tile.resource = undefined;
      }
    }

    const storage = createActiveBuildingInVillage(world, village.id, 'storage');

    expect(tileKey(storage.position)).not.toBe(tileKey(townHall.position));
  });

  it('keeps early utility buildings from crowding the town hall tile', () => {
    const world = foundFoodRichVillage('village-building-spacing', { width: 48, height: 32 });
    const village = world.project().villages[0];
    const buildings = [
      ...world.project().buildings.filter((building) => building.villageId === village.id),
      createActiveBuildingInVillage(world, village.id, 'storage'),
      createActiveBuildingInVillage(world, village.id, 'house'),
      createActiveBuildingInVillage(world, village.id, 'farm'),
      createActiveBuildingInVillage(world, village.id, 'barrack'),
    ];

    const minimumSpacing = buildings.reduce((minimum, building, index) => {
      const nearest = buildings
        .slice(index + 1)
        .reduce(
          (nearestDistance, other) =>
            Math.min(nearestDistance, distanceBetween(building.position, other.position)),
          Number.POSITIVE_INFINITY,
        );

      return Math.min(minimum, nearest);
    }, Number.POSITIVE_INFINITY);

    expect(minimumSpacing).toBeGreaterThanOrEqual(3);
  });

  it('assigns builders to gather nearby wood into village stores', () => {
    const world = foundFoodRichVillage('village-wood-jobs');
    const village = world.project().villages[0];

    addWoodSiteNearVillage(world, village.id);

    for (let tick = 0; tick < 20; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const updatedVillage = projection.villages.find((candidate) => candidate.id === village.id);
    const deposit = world.map.tiles.find(
      (tile) =>
        tile.x === Math.floor(village.center.x + 6) && tile.y === Math.floor(village.center.y),
    );

    expect(updatedVillage?.jobs.builder).toBeGreaterThan(0);
    expect(updatedVillage?.woodInventory).toBeGreaterThan(0);
    expect(deposit?.resource?.amount ?? 0).toBeLessThan(80);
    expect(
      projection.workSites.some(
        (site) => site.type === 'wood_gathering' && site.villageId === village.id,
      ),
    ).toBe(true);
    expect(
      projection.territory.some(
        (tile) => tile.villageId === village.id && tile.source === 'work_site',
      ),
    ).toBe(false);
  });

  it('stops gathering wood when village storage capacity is full', () => {
    const world = foundFoodRichVillage('village-wood-capacity');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id) as Village & {
      woodCapacity?: number;
    };

    addWoodSiteNearVillage(world, village.id);
    mutableVillage.woodInventory = 38;
    mutableVillage.woodCapacity = 40;

    for (let tick = 0; tick < 8; tick += 1) {
      world.step();
    }

    const updatedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect((updatedVillage as Village & { woodCapacity?: number })?.woodCapacity).toBe(40);
    expect(updatedVillage?.woodInventory).toBeLessThanOrEqual(40);
  });

  it('accounts for every resident in the village job summary', () => {
    const world = foundFoodRichVillage('village-jobs-account-for-residents');

    for (let tick = 0; tick < 4; tick += 1) {
      world.step();
    }

    const village = world.project().villages[0];
    const assignedJobs =
      village.jobs.farmer +
      village.jobs.builder +
      village.jobs.miner +
      village.jobs.soldier +
      village.jobs.laborer;

    expect(assignedJobs).toBe(village.population);
  });

  it('scouts farther wood sources when a new village has no local construction materials', () => {
    const world = foundFoodRichVillage('village-frontier-wood-jobs', { width: 80, height: 40 });
    const village = world.project().villages[0];
    const frontierWoodX = Math.floor(village.center.x + 28);
    const frontierWoodY = Math.floor(village.center.y);

    clearWoodPatches(world);
    addWoodSiteNearVillage(world, village.id, 28);

    for (let tick = 0; tick < 20; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const updatedVillage = projection.villages.find((candidate) => candidate.id === village.id);
    const deposit = world.map.tiles.find(
      (tile) => tile.x === frontierWoodX && tile.y === frontierWoodY,
    );

    expect(updatedVillage?.woodInventory).toBeGreaterThan(0);
    expect(updatedVillage?.growthBlockers).not.toContain('no_wood_source');
    expect(updatedVillage?.primaryGrowthBlocker).not.toBe('no_wood_source');
    expect(deposit?.resource?.amount ?? 0).toBeLessThan(80);
    expect(
      projection.workSites.some(
        (site) =>
          site.type === 'wood_gathering' &&
          site.villageId === village.id &&
          Math.floor(site.position.x) === frontierWoodX &&
          Math.floor(site.position.y) === frontierWoodY,
      ),
    ).toBe(true);
  });

  it('shows farm tending work sites when farmers maintain active farms', () => {
    const world = foundFoodRichVillage('village-farm-tending-worksite');
    const village = world.project().villages[0];
    const farm = createActiveBuildingInVillage(world, village.id, 'farm');

    for (let tick = 0; tick < 4; tick += 1) {
      world.step();
    }

    const projection = world.project();

    const farmFields = projection.farmland.filter((field) => field.farmId === farm.id);
    const tendedSites = projection.workSites.filter(
      (site) => site.type === 'farm_tending' && site.villageId === village.id,
    );

    expect(farmFields.length).toBeGreaterThan(0);
    expect(
      tendedSites.some((site) =>
        farmFields.some(
          (field) =>
            Math.floor(site.position.x) === field.x && Math.floor(site.position.y) === field.y,
        ),
      ),
    ).toBe(true);
  });

  it('explains growth blockers when a pressured village lacks build materials', () => {
    const world = foundFoodRichVillage('village-growth-blockers');
    const village = world.project().villages[0];

    removeWoodSitesNearVillage(world, village.id);

    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    mutableVillage.woodInventory = 0;
    mutableVillage.housingCapacity = mutableVillage.population;

    for (let tick = 0; tick < 3; tick += 1) {
      world.step();
    }

    const updatedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(updatedVillage?.growthBlockers).toContain('housing_pressure');
    expect(updatedVillage?.growthBlockers).toContain('missing_wood');
    expect(updatedVillage?.growthBlockers).toContain('no_wood_source');
    expect(updatedVillage?.primaryGrowthBlocker).toBe('no_wood_source');
  });

  it('projects readable growth phases and primary intentions for early villages', () => {
    const world = foundFoodRichVillage('village-growth-phase-intention');

    for (let tick = 0; tick < 3; tick += 1) {
      world.step();
    }

    const camp = world.project().villages[0];

    expect(camp?.growthPhase).toBe('camp');
    expect(camp?.primaryIntention).toBe('expand_housing');

    for (let tick = 0; tick < 70; tick += 1) {
      world.step();
    }

    const hamlet = world.project().villages[0];

    expect(hamlet?.growthPhase).toBe('hamlet');
    expect(hamlet?.primaryIntention).toBe('expand_storage');
  });

  it('emits a recent event when a camp becomes a hamlet', () => {
    const world = foundFoodRichVillage('village-growth-phase-event');
    const village = world.project().villages[0];
    let phaseEvent: ReturnType<SimWorld['project']>['recentEvents'][number] | undefined;

    for (let tick = 0; tick < 90 && !phaseEvent; tick += 1) {
      world.step();
      phaseEvent = world
        .project()
        .recentEvents.find((event) => event.type === 'village_phase_changed');
    }

    expect(phaseEvent).toMatchObject({
      type: 'village_phase_changed',
      payload: {
        villageId: village.id,
        name: village.name,
        previousPhase: 'camp',
        phase: 'hamlet',
      },
    });
  });

  it('keeps a rich stable town building even before housing is nearly full', () => {
    const world = foundFoodRichVillage('village-rich-town-continues-building');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    for (const type of [
      'house',
      'house',
      'house',
      'house',
      'storage',
      'farm',
      'farm',
      'mine',
      'barrack',
      'dock',
    ] as const) {
      addActiveBuildingToVillage(world, village.id, type);
    }
    removeDockSitesNearVillage(world, village.id);

    prepareVillageForBuildingUpgrades(world, village.id, 32, 260, 20);
    mutableVillage.foodCapacity = 260;
    mutableVillage.foodInventory = 260;
    mutableVillage.woodInventory = 1750;
    mutableVillage.stoneInventory = 70;
    mutableVillage.ironInventory = 0;
    mutableVillage.housingCapacity = 48;
    mutableVillage.status = 'stable';
    world.step();

    const beforeProjection = world.project();
    const beforeBuildings = beforeProjection.buildings.filter(
      (building) => building.villageId === village.id,
    ).length;

    expect(
      beforeProjection.villages.find((candidate) => candidate.id === village.id)?.population,
    ).toBe(32);
    expect(
      beforeProjection.villages.find((candidate) => candidate.id === village.id)?.buildPlan,
    ).toBe('expand_housing');

    for (let tick = 0; tick < 80; tick += 1) {
      world.step();
    }

    const afterProjection = world.project();
    const afterVillage = afterProjection.villages.find((candidate) => candidate.id === village.id);
    const afterBuildings = afterProjection.buildings.filter(
      (building) => building.villageId === village.id,
    ).length;

    expect(afterVillage?.buildPlan).not.toBe('idle');
    expect(afterVillage?.growthPhase).toBe('town');
    expect(afterVillage?.primaryIntention).not.toBe('idle');
    expect(afterBuildings).toBeGreaterThan(beforeBuildings);
  });

  it('prioritizes storage expansion when village stores are nearly full', () => {
    const world = foundFoodRichVillage('village-storage-pressure-builds-storage');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    for (const type of [
      'house',
      'house',
      'house',
      'house',
      'house',
      'storage',
      'farm',
      'farm',
      'mine',
      'barrack',
      'dock',
    ] as const) {
      addActiveBuildingToVillage(world, village.id, type);
    }

    mutableVillage.status = 'stable';
    mutableVillage.kingdomId = undefined;
    mutableVillage.population = 20;
    mutableVillage.housingCapacity = 27;
    mutableVillage.foodCapacity = 260;
    mutableVillage.foodInventory = 200;
    mutableVillage.woodCapacity = 160;
    mutableVillage.woodInventory = 152;
    mutableVillage.stoneInventory = 0;
    mutableVillage.ironInventory = 0;
    setTownHallTier(world, village.id, 3);

    (
      getMutableWorld(world) as unknown as {
        updateVillageGrowthBlockers(village: Village): void;
      }
    ).updateVillageGrowthBlockers(mutableVillage);

    const pressuredVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(pressuredVillage?.woodCapacity).toBe(160);
    expect(pressuredVillage?.buildPlan).toBe('expand_storage');
    expect(pressuredVillage?.primaryIntention).toBe('expand_storage');
    expect(pressuredVillage?.growthBlockers).toContain('storage_full');
    expect(pressuredVillage?.primaryGrowthBlocker).toBe('storage_full');
  });

  it('expands storage when a town hall upgrade needs more capacity than the village has', () => {
    const world = foundFoodRichVillage('village-storage-capacity-goal');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    for (const type of [
      'house',
      'house',
      'house',
      'house',
      'house',
      'house',
      'storage',
      'storage',
      'farm',
      'farm',
      'mine',
      'barrack',
      'dock',
    ] as const) {
      addActiveBuildingToVillage(world, village.id, type);
    }

    prepareVillageForBuildingUpgrades(world, village.id, 28, 400, 16);
    mutableVillage.status = 'stable';
    mutableVillage.kingdomId = undefined;
    mutableVillage.housingCapacity = 38;
    mutableVillage.population = 28;
    mutableVillage.foodCapacity = 400;
    mutableVillage.foodInventory = 400;
    mutableVillage.woodCapacity = 160;
    mutableVillage.woodInventory = 120;
    mutableVillage.stoneCapacity = 100;
    mutableVillage.stoneInventory = 20;
    mutableVillage.ironInventory = 0;

    (
      getMutableWorld(world) as unknown as {
        updateVillageGrowthBlockers(village: Village): void;
      }
    ).updateVillageGrowthBlockers(mutableVillage);

    const capacityBlockedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(capacityBlockedVillage?.foodCapacity).toBe(400);
    expect(capacityBlockedVillage?.buildPlan).toBe('expand_storage');
    expect(capacityBlockedVillage?.primaryIntention).toBe('expand_storage');
    expect(capacityBlockedVillage?.growthBlockers).toContain('insufficient_storage');
    expect(capacityBlockedVillage?.primaryGrowthBlocker).toBe('insufficient_storage');
  });

  it('lets large settlements expand storage beyond the old fixed six-building cap', () => {
    const world = foundFoodRichVillage('village-large-storage-pressure');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    for (const type of [
      'house',
      'house',
      'house',
      'house',
      'house',
      'house',
      'house',
      'house',
      'storage',
      'storage',
      'storage',
      'storage',
      'storage',
      'storage',
      'storage',
      'farm',
      'farm',
      'farm',
      'mine',
      'barrack',
      'dock',
    ] as const) {
      addActiveBuildingToVillage(world, village.id, type);
    }

    mutableVillage.level = 5;
    mutableVillage.status = 'stable';
    mutableVillage.kingdomId = undefined;
    mutableVillage.population = 32;
    mutableVillage.housingCapacity = 52;
    mutableVillage.territoryTiles = 320;
    mutableVillage.foodCapacity = 1100;
    mutableVillage.foodInventory = 820;
    mutableVillage.woodCapacity = 880;
    mutableVillage.woodInventory = 820;
    mutableVillage.stoneCapacity = 580;
    mutableVillage.stoneInventory = 0;
    mutableVillage.ironInventory = 0;
    setTownHallTier(world, village.id, 3);

    (
      getMutableWorld(world) as unknown as {
        updateVillageGrowthBlockers(village: Village): void;
      }
    ).updateVillageGrowthBlockers(mutableVillage);

    const pressuredVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);
    const storageCount = world
      .project()
      .buildings.filter(
        (building) => building.villageId === village.id && building.type === 'storage',
      ).length;

    expect(storageCount).toBe(7);
    expect(pressuredVillage?.buildPlan).toBe('expand_storage');
    expect(pressuredVillage?.primaryIntention).toBe('expand_storage');
    expect(pressuredVillage?.growthBlockers).toContain('storage_full');
  });

  it('waits for population instead of materials when a resource-rich town is below prosperity size', () => {
    const world = foundFoodRichVillage('village-low-pop-not-materials');
    const village = world.project().villages[0];
    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    for (const type of [
      'house',
      'house',
      'house',
      'house',
      'storage',
      'farm',
      'farm',
      'mine',
      'barrack',
      'dock',
    ] as const) {
      addActiveBuildingToVillage(world, village.id, type);
    }
    removeDockSitesNearVillage(world, village.id);

    prepareVillageForBuildingUpgrades(world, village.id, 13, 260, 1);
    mutableVillage.foodCapacity = 260;
    mutableVillage.foodInventory = 260;
    mutableVillage.woodInventory = 3822;
    mutableVillage.stoneInventory = 275;
    mutableVillage.ironInventory = 135;
    mutableVillage.housingCapacity = 22;
    mutableVillage.status = 'stable';

    world.step();

    const updatedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(updatedVillage?.buildPlan).toBe('waiting_population_pressure');
    expect(updatedVillage?.primaryIntention).toBe('waiting_population_pressure');
    expect(updatedVillage?.growthBlockers).toHaveLength(0);
  });

  it('keeps visible work sites from creating temporary territory islands', () => {
    const world = foundFoodRichVillage('village-worksite-territory');
    const village = world.project().villages[0];
    clearWoodPatches(world);
    addWoodSiteNearVillage(world, village.id);
    const woodPosition = {
      x: Math.floor(village.center.x + 6),
      y: Math.floor(village.center.y),
    };

    world.step();

    const projection = world.project();

    expect(
      projection.workSites.some(
        (site) =>
          site.type === 'wood_gathering' &&
          Math.floor(site.position.x) === woodPosition.x &&
          Math.floor(site.position.y) === woodPosition.y,
      ),
    ).toBe(true);
    expect(
      projection.territory.some(
        (tile) =>
          tile.villageId === village.id &&
          tile.x === woodPosition.x &&
          tile.y === woodPosition.y &&
          tile.source === 'work_site',
      ),
    ).toBe(false);
  });

  it('explains whether territory came from settlement core or buildings', () => {
    const world = foundFoodRichVillage('village-territory-source');
    const village = world.project().villages[0];

    for (let tick = 0; tick < 70; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const coreTerritory = projection.territory.find(
      (tile) => tile.villageId === village.id && tile.source === 'settlement_core',
    );
    const buildingTerritory = projection.territory.find(
      (tile) => tile.villageId === village.id && tile.source === 'building',
    );

    expect(coreTerritory?.source).toBe('settlement_core');
    expect(buildingTerritory?.source).toBe('building');
  });

  it('projects water inside settlement influence as soft territory without counting it as land territory', () => {
    const world = foundFoodRichVillage('village-water-soft-territory');
    const village = world.project().villages[0];
    const waterPosition = {
      x: Math.floor(village.center.x),
      y: Math.floor(village.center.y + 5),
    };
    const waterTile = world.map.tiles.find(
      (tile) => tile.x === waterPosition.x && tile.y === waterPosition.y,
    );

    if (!waterTile) {
      throw new Error('Expected water test tile');
    }

    waterTile.terrain = 'water';
    waterTile.biome = 'coast';
    waterTile.resource = undefined;

    const projection = world.project();
    const projectedWater = projection.territory.find(
      (tile) =>
        tile.villageId === village.id && tile.x === waterPosition.x && tile.y === waterPosition.y,
    );
    const projectedVillage = projection.villages.find((candidate) => candidate.id === village.id);
    const landTerritoryTiles = projection.territory.filter(
      (tile) => tile.villageId === village.id && tile.surface === 'land',
    );

    expect(projectedWater?.surface).toBe('water');
    expect(projectedWater?.source).toBe('settlement_core');
    expect(projectedVillage?.territoryTiles).toBe(landTerritoryTiles.length);
  });

  it('builds a mine when the village has a nearby stone or iron site', () => {
    const world = foundFoodRichVillage('village-mine');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 12, 2000);
    addMineSiteNearVillage(world, village.id, 'stone');

    for (let tick = 0; tick < 330; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const mine = projection.buildings.find((building) => String(building.type) === 'mine');

    expect(mine).toBeDefined();
    expect(mine?.villageId).toBe(village.id);
    expect(
      projection.recentEvents.some(
        (event) => event.type === 'building_built' && event.payload?.type === 'mine',
      ),
    ).toBe(true);

    const viewportProjection = world.project({
      viewport: {
        x: (mine?.position.x ?? 0) - 1,
        y: (mine?.position.y ?? 0) - 1,
        width: 3,
        height: 3,
        paddingTiles: 0,
      },
    });

    expect(viewportProjection.buildings.some((building) => building.id === mine?.id)).toBe(true);
  });

  it('opens an early quarry so normal villages can start mining without rare natural hills', () => {
    const world = foundFoodRichVillage('village-early-quarry');
    const village = world.project().villages[0];

    removeMineSitesNearVillage(world, village.id);

    for (let tick = 0; tick < 270; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const mine = projection.buildings.find((building) => building.type === 'mine');
    const farms = projection.buildings.filter((building) => building.type === 'farm');
    const updatedVillage = projection.villages.find((candidate) => candidate.id === village.id);

    expect(mine).toBeDefined();
    expect(farms.length).toBeGreaterThanOrEqual(1);
    expect(updatedVillage?.jobs.miner).toBeGreaterThan(0);
    expect(updatedVillage?.stoneInventory).toBeGreaterThan(0);
  });

  it('assigns miners to store stone from active mines', () => {
    const world = foundFoodRichVillage('village-mine-stores');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 8, 2400);
    addMineSiteNearVillage(world, village.id, 'stone');

    for (let tick = 0; tick < 340; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const updatedVillage = projection.villages.find((candidate) => candidate.id === village.id);
    const deposit = world.map.tiles.find(
      (tile) =>
        tile.x === Math.floor(village.center.x + 3) && tile.y === Math.floor(village.center.y),
    );

    expect(updatedVillage?.stoneInventory).toBeGreaterThan(0);
    expect(updatedVillage?.ironInventory).toBe(0);
    expect(updatedVillage?.jobs.miner).toBeGreaterThan(0);
    expect(deposit?.resource?.amount ?? 0).toBeLessThan(80);
  });

  it('does not build a mine when no nearby mine or quarry site exists', () => {
    const world = foundFoodRichVillage('village-no-mine');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 12, 2000);
    removeMineSitesNearVillage(world, village.id);
    removeQuarrySitesNearVillage(world, village.id);

    for (let tick = 0; tick < 420; tick += 1) {
      world.step();
    }

    expect(world.project().buildings.some((building) => String(building.type) === 'mine')).toBe(
      false,
    );
  });

  it('can build a barrack from stone mined during the normal village chain', () => {
    const world = foundFoodRichVillage('village-barrack-from-mining');
    const village = world.project().villages[0];

    removeMineSitesNearVillage(world, village.id);
    addWoodSiteNearVillage(world, village.id, -6);

    for (let tick = 0; tick < 430; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const barrack = projection.buildings.find((building) => building.type === 'barrack');
    const updatedVillage = projection.villages.find((candidate) => candidate.id === village.id);

    expect(projection.buildings.some((building) => building.type === 'mine')).toBe(true);
    expect(updatedVillage?.stoneInventory ?? 0).toBeGreaterThanOrEqual(0);
    expect(barrack).toBeDefined();
  });

  it('builds a barrack after the village has a basic food and housing chain', () => {
    const world = foundFoodRichVillage('village-barrack');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 12, 2000);
    removeMineSitesNearVillage(world, village.id);

    for (let tick = 0; tick < 330; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const barrack = projection.buildings.find((building) => String(building.type) === 'barrack');

    expect(barrack).toBeDefined();
    expect(barrack?.villageId).toBe(village.id);
    expect(
      projection.recentEvents.some(
        (event) => event.type === 'building_built' && event.payload?.type === 'barrack',
      ),
    ).toBe(true);
  });

  it('prioritizes another house over mines when housing is nearly full', () => {
    const world = foundFoodRichVillage('village-housing-pressure');
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addMineSiteNearVillage(world, village.id, 'stone');
    prepareVillageForBuildingUpgrades(world, village.id, 20, 800, 8);

    const mutableVillage = getMutableWorld(world).villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    mutableVillage.housingCapacity = 20;

    for (let tick = 0; tick < 70; tick += 1) {
      world.step();
    }

    const buildings = world
      .project()
      .buildings.filter((building) => building.villageId === village.id);
    const houseCount = buildings.filter((building) => building.type === 'house').length;

    expect(houseCount).toBeGreaterThanOrEqual(2);
    expect(buildings.some((building) => building.type === 'mine')).toBe(false);
  });

  it('builds a dock when the village has a nearby shore site', () => {
    const world = foundFoodRichVillage('village-dock');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 8, 2400);
    removeMineSitesNearVillage(world, village.id);
    addDockSiteNearVillage(world, village.id);

    for (let tick = 0; tick < 390; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const dock = projection.buildings.find((building) => String(building.type) === 'dock');

    expect(dock).toBeDefined();
    expect(dock?.villageId).toBe(village.id);
    expect(
      projection.recentEvents.some(
        (event) => event.type === 'building_built' && event.payload?.type === 'dock',
      ),
    ).toBe(true);

    const dockTile = dock
      ? world.map.tiles.find(
          (tile) =>
            tile.x === Math.floor(dock.position.x) && tile.y === Math.floor(dock.position.y),
        )
      : undefined;

    expect(dockTile?.terrain).not.toBe('water');
    expect(hasAdjacentWater(world, dock?.position ?? village.center)).toBe(true);
  });

  it('does not build a dock when no nearby shore site exists', () => {
    const world = foundFoodRichVillage('village-no-dock');
    const village = world.project().villages[0];

    prepareVillageForBuildingUpgrades(world, village.id, 8, 2400);
    removeMineSitesNearVillage(world, village.id);
    removeDockSitesNearVillage(world, village.id);

    for (let tick = 0; tick < 480; tick += 1) {
      world.step();
    }

    expect(world.project().buildings.some((building) => String(building.type) === 'dock')).toBe(
      false,
    );
  });

  it('cuts stored resources down to remaining capacity when storage is abandoned', () => {
    const world = foundFoodRichVillage('village-storage-loss');
    const village = world.project().villages[0];
    const mutableWorld = getMutableWorld(world) as unknown as {
      villages: Map<string, Village>;
      buildings: Map<string, VillageBuilding>;
    };
    const mutableVillage = mutableWorld.villages.get(village.id);

    if (!mutableVillage) {
      throw new Error('Expected village');
    }

    const storage = createActiveBuildingInVillage(world, village.id, 'storage');
    mutableVillage.foodInventory = 240;
    mutableVillage.woodInventory = 150;
    mutableVillage.stoneInventory = 75;
    mutableVillage.ironInventory = 35;
    storage.status = 'abandoned';
    storage.abandonedAtTick = world.currentTick;

    world.step();

    const updatedVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);

    expect(updatedVillage?.foodCapacity).toBe(120);
    expect(updatedVillage?.woodCapacity).toBe(40);
    expect(updatedVillage?.stoneCapacity).toBe(20);
    expect(updatedVillage?.ironCapacity).toBe(10);
    expect(updatedVillage?.foodInventory).toBeLessThanOrEqual(120);
    expect(updatedVillage?.woodInventory).toBeLessThanOrEqual(40);
    expect(updatedVillage?.stoneInventory).toBeLessThanOrEqual(20);
    expect(updatedVillage?.ironInventory).toBeLessThanOrEqual(10);
  });

  it('decays abandoned buildings into ruins without active village benefits', () => {
    const world = foundFoodRichVillage('village-abandoned-buildings');
    const mutableWorld = getMutableWorld(world) as unknown as {
      villages: Map<string, Village>;
      buildings: Map<string, VillageBuilding>;
    };
    const villageId = world.project().villages[0]?.id;

    if (!villageId) {
      throw new Error('Expected a village');
    }

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    expect(world.project().stats.activeBuildings).toBeGreaterThan(0);

    for (const tile of world.map.tiles) {
      tile.resource = undefined;
    }

    for (let tick = 0; tick < 420; tick += 1) {
      world.step();

      const village = mutableWorld.villages.get(villageId);

      if (!village) {
        break;
      }

      village.foodInventory = 0;
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

    for (const building of mutableWorld.buildings.values()) {
      if (building.status === 'abandoned') {
        building.abandonedAtTick = -100000;
      }
    }

    world.step();
    const ruinedProjection = world.project();

    expect(ruinedProjection.stats.activeBuildings).toBe(0);
    expect(ruinedProjection.stats.abandonedBuildings).toBe(0);
    expect(ruinedProjection.stats.ruinedBuildings).toBeGreaterThan(0);
    expect(ruinedProjection.stats.housingCapacity).toBe(0);
    expect(ruinedProjection.stats.territoryTiles).toBe(0);
    expect(ruinedProjection.buildings.every((building) => building.status === 'ruined')).toBe(true);
    expect(ruinedProjection.recentEvents.some((event) => event.type === 'building_ruined')).toBe(
      true,
    );
  });

  it('keeps territory stable when villagers move away from the settlement center', () => {
    const world = foundFoodRichVillage('stable-territory');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const before = serializeStableTerritory(world.project().territory);

    moveVillageResidents(world, world.project().villages[0].id, { x: 2, y: 2 });

    world.step();

    expect(serializeStableTerritory(world.project().territory)).toBe(before);
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

  it('keeps the founding capital stable when a larger member village joins', () => {
    const world = foundTwoFoodRichVillages('kingdom-stable-capital');

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const kingdom = projection.kingdoms[0];
    const foundingCapitalId = kingdom.capitalVillageId;
    const foundingCapital = projection.villages.find((village) => village.id === foundingCapitalId);
    const largerMember = projection.villages.find((village) => village.id !== foundingCapitalId);

    if (!foundingCapital || !largerMember) {
      throw new Error('Expected a kingdom with at least two villages');
    }

    setVillagePopulation(world, largerMember.id, foundingCapital.population + 20);
    refreshProjectedKingdom(world, kingdom.id);

    expect(world.project().kingdoms[0].capitalVillageId).toBe(foundingCapitalId);
  });

  it('projects village loyalty so overextended kingdoms are readable before rebellion exists', () => {
    const world = foundFoodRichVillage('kingdom-loyalty-projection', { width: 128, height: 48 });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const kingdom = world.project().kingdoms[0];

    addVillageToKingdom(world, kingdom.id, {
      id: 'far-frontier',
      position: { x: 104, y: 34 },
      population: 18,
    });

    const projection = world.project();
    const capital = projection.villages.find(
      (village) => village.id === projection.kingdoms[0].capitalVillageId,
    );
    const frontier = projection.villages.find((village) => village.id === 'far-frontier');

    expect(capital?.loyalty).toBe(100);
    expect(capital?.loyaltyReason).toBe('capital');
    expect(frontier?.loyalty).toBeLessThan(80);
    expect(frontier?.loyaltyReason).toBe('capital_distance');
  });

  it('projects low-loyalty unrest before rebellion preparation', () => {
    const world = foundFoodRichVillage('kingdom-rebellion-preparation', {
      width: 128,
      height: 48,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const kingdom = world.project().kingdoms[0];

    addVillageToKingdom(world, kingdom.id, {
      id: 'far-rebel-frontier',
      position: { x: 108, y: 36 },
      population: 22,
    });

    const preparingProjection = world.project();
    const rebel = preparingProjection.villages.find(
      (village) => village.id === 'far-rebel-frontier',
    );

    expect(rebel?.loyalty).toBeLessThan(50);
    expect(rebel?.loyalty).toBeGreaterThanOrEqual(0);
    expect(rebel?.unrestPlan).toBe('low_loyalty');
    expect(rebel?.rebellionPlan).toBeUndefined();
    expect(rebel?.rebellionReason).toBeUndefined();
    expect(preparingProjection.kingdoms).toHaveLength(1);
    expect(rebel?.kingdomId).toBe(kingdom.id);
  });

  it('projects a readable rebellion preparation state only after loyalty falls below zero', () => {
    const world = foundFoodRichVillage('kingdom-negative-loyalty-rebellion-preparation', {
      width: 160,
      height: 64,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const kingdom = world.project().kingdoms[0];

    const frontier = addVillageToKingdom(world, kingdom.id, {
      id: 'negative-loyalty-frontier',
      position: { x: 150, y: 56 },
      population: 120,
    });
    frontier.foodInventory = 0;

    const preparingProjection = world.project();
    const rebel = preparingProjection.villages.find(
      (village) => village.id === 'negative-loyalty-frontier',
    );

    expect(rebel?.loyalty).toBeLessThan(0);
    expect(rebel?.unrestPlan).toBeUndefined();
    expect(rebel?.rebellionPlan).toBe('prepare_rebellion');
    expect(rebel?.rebellionReason).toBe('capital_distance');
    expect(preparingProjection.kingdoms).toHaveLength(1);
    expect(rebel?.kingdomId).toBe(kingdom.id);
  });

  it('accumulates readable rebellion preparation progress without splitting the kingdom yet', () => {
    const world = foundFoodRichVillage('kingdom-rebellion-progress-window', {
      width: 160,
      height: 64,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const kingdom = world.project().kingdoms[0];
    const frontier = addVillageToKingdom(world, kingdom.id, {
      id: 'progress-rebel-frontier',
      position: { x: 150, y: 56 },
      population: 36,
    });
    addResidentUnitsToVillage(world, frontier.id, 36);
    addActiveBuildingToVillage(world, frontier.id, 'barrack');
    prepareVillageForBuildingUpgrades(world, frontier.id, 36, 400);
    frontier.foodInventory = 0;

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const preparingProjection = world.project();
    const rebel = preparingProjection.villages.find(
      (village) => village.id === 'progress-rebel-frontier',
    );

    expect(rebel?.loyalty).toBeLessThan(0);
    expect(rebel?.rebellionPlan).toBe('prepare_rebellion');
    expect(rebel?.rebellionProgress).toBeGreaterThan(0);
    expect(rebel?.rebellionProgress).toBeLessThan(100);
    expect(preparingProjection.kingdoms).toHaveLength(1);
    expect(rebel?.kingdomId).toBe(kingdom.id);
  });

  it('rolls rebellion preparation progress back when loyalty recovers', () => {
    const world = foundFoodRichVillage('kingdom-rebellion-progress-recovers', {
      width: 160,
      height: 64,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const kingdom = projection.kingdoms[0];
    const capital = projection.villages.find((village) => village.id === kingdom.capitalVillageId);

    if (!capital) {
      throw new Error('Expected capital village');
    }

    const frontier = addVillageToKingdom(world, kingdom.id, {
      id: 'recovering-rebel-frontier',
      position: { x: 150, y: 56 },
      population: 36,
    });
    addResidentUnitsToVillage(world, frontier.id, 36);
    addActiveBuildingToVillage(world, frontier.id, 'barrack');
    prepareVillageForBuildingUpgrades(world, frontier.id, 36, 400);
    frontier.foodInventory = 0;

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const progressBeforeRecovery = world
      .project()
      .villages.find((village) => village.id === 'recovering-rebel-frontier')?.rebellionProgress;

    frontier.center = { x: capital.center.x + 2, y: capital.center.y };
    frontier.foodInventory = 500;
    frontier.foodCapacity = 500;
    moveVillageResidents(world, frontier.id, frontier.center);

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const recovered = world
      .project()
      .villages.find((village) => village.id === 'recovering-rebel-frontier');

    expect(progressBeforeRecovery).toBeGreaterThan(0);
    expect(recovered?.loyalty).toBeGreaterThanOrEqual(0);
    expect(recovered?.rebellionPlan).toBeUndefined();
    expect(recovered?.rebellionProgress).toBeLessThan(progressBeforeRecovery ?? 0);
  });

  it('splits a completed rebellion into a new kingdom and starts a rebellion war', () => {
    const world = foundFoodRichVillage('kingdom-rebellion-split-founding', {
      width: 180,
      height: 72,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const parentKingdom = world.project().kingdoms[0];
    const rebelLeader = addVillageToKingdom(world, parentKingdom.id, {
      id: 'completed-rebel-frontier',
      position: { x: 168, y: 62 },
      population: 72,
    });
    const rebelSupporter = addVillageToKingdom(world, parentKingdom.id, {
      id: 'nearby-rebel-supporter',
      position: { x: 158, y: 58 },
      population: 48,
    });

    for (const village of [rebelLeader, rebelSupporter]) {
      addResidentUnitsToVillage(world, village.id, village.population);
      addActiveBuildingToVillage(world, village.id, 'barrack');
      prepareVillageForBuildingUpgrades(world, village.id, village.population, 500);
      village.foodInventory = 0;
    }

    rebelLeader.rebellionProgress = 99;
    world.step();

    const projection = world.project();
    const parentAfterSplit = projection.kingdoms.find((kingdom) => kingdom.id === parentKingdom.id);
    const rebelKingdom = projection.kingdoms.find(
      (kingdom) => kingdom.id !== parentKingdom.id && kingdom.capitalVillageId === rebelLeader.id,
    );
    const rebelLeaderAfterSplit = projection.villages.find(
      (village) => village.id === rebelLeader.id,
    );
    const rebelSupporterAfterSplit = projection.villages.find(
      (village) => village.id === rebelSupporter.id,
    );

    expect(rebelKingdom).toBeDefined();
    expect(parentAfterSplit?.villageIds).not.toContain(rebelLeader.id);
    expect(parentAfterSplit?.villageIds).not.toContain(rebelSupporter.id);
    expect(rebelKingdom?.villageIds).toContain(rebelLeader.id);
    expect(rebelKingdom?.villageIds).toContain(rebelSupporter.id);
    expect(rebelLeaderAfterSplit?.kingdomId).toBe(rebelKingdom?.id);
    expect(rebelLeaderAfterSplit?.rebellionProgress).toBeUndefined();
    expect(rebelSupporterAfterSplit?.kingdomId).toBe(rebelKingdom?.id);
    expect(projection.recentEvents.some((event) => event.type === 'rebellion_succeeded')).toBe(
      true,
    );
    expect(
      projection.recentEvents.some(
        (event) =>
          event.type === 'war_declared' &&
          event.payload?.aggressorKingdomId === parentKingdom.id &&
          event.payload?.targetKingdomId === rebelKingdom?.id,
      ),
    ).toBe(true);
  });

  it('limits completed rebellions to one split per parent kingdom each tick', () => {
    const world = foundFoodRichVillage('kingdom-rebellion-same-tick-limit', {
      width: 220,
      height: 84,
    });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const parentKingdom = world.project().kingdoms[0];
    const firstRebel = addVillageToKingdom(world, parentKingdom.id, {
      id: 'first-same-tick-rebel',
      position: { x: 188, y: 66 },
      population: 72,
    });
    const secondRebel = addVillageToKingdom(world, parentKingdom.id, {
      id: 'second-same-tick-rebel',
      position: { x: 208, y: 72 },
      population: 72,
    });

    for (const village of [firstRebel, secondRebel]) {
      addResidentUnitsToVillage(world, village.id, village.population);
      addActiveBuildingToVillage(world, village.id, 'barrack');
      prepareVillageForBuildingUpgrades(world, village.id, village.population, 500);
      village.foodInventory = 0;
      village.rebellionProgress = 99;
    }

    world.step();

    const projection = world.project();
    const rebellionEvents = projection.recentEvents.filter(
      (event) => event.type === 'rebellion_succeeded',
    );
    const remainingParentVillage = projection.villages.find(
      (village) => village.id === secondRebel.id,
    );

    expect(rebellionEvents).toHaveLength(1);
    expect(projection.kingdoms.filter((kingdom) => kingdom.status !== 'fallen')).toHaveLength(2);
    expect(remainingParentVillage?.kingdomId).toBe(parentKingdom.id);
    expect(remainingParentVillage?.rebellionProgress).toBeGreaterThan(0);
  });

  it('lets a mature pressured kingdom found a satellite village on suitable land', () => {
    const world = foundFoodRichVillage('kingdom-satellite-village', { width: 56, height: 32 });
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'mine');
    addActiveBuildingToVillage(world, village.id, 'barrack');
    addActiveBuildingToVillage(world, village.id, 'dock');
    prepareVillageForBuildingUpgrades(world, village.id, 28, 1600, 16);
    clearFoodPatches(world);
    placeFoodPatch(world, { x: 36, y: 12 }, 500, 4);

    const parent = getMutableWorld(world).villages.get(village.id);

    if (!parent) {
      throw new Error('Expected parent village');
    }

    parent.housingCapacity = 40;

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const preparingVillage = world
      .project()
      .villages.find((candidate) => candidate.id === village.id);
    const preparingEvents = world
      .project()
      .recentEvents.filter((event) => event.type === 'village_expansion_status');

    expect(preparingVillage?.buildPlan).toBe('prepare_expansion');
    expect(preparingVillage?.growthBlockers).toHaveLength(0);
    expect(preparingEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            villageId: village.id,
            plan: 'prepare_expansion',
            reason: 'ready',
          }),
        }),
      ]),
    );

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const kingdom = projection.kingdoms[0];

    expect(projection.villages.length).toBeGreaterThanOrEqual(2);
    expect(kingdom.villageIds).toHaveLength(projection.villages.length);
    expect(projection.villages.every((candidate) => candidate.kingdomId === kingdom.id)).toBe(true);
    expect(
      projection.recentEvents.some(
        (event) =>
          event.type === 'village_founded' &&
          event.payload?.parentVillageId === village.id &&
          event.payload?.kingdomId === kingdom.id,
      ),
    ).toBe(true);
  });

  it('waits through a readable preparation window before founding a satellite village', () => {
    const world = foundFoodRichVillage('kingdom-satellite-preparation-window', {
      width: 56,
      height: 32,
    });
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'mine');
    addActiveBuildingToVillage(world, village.id, 'barrack');
    addActiveBuildingToVillage(world, village.id, 'dock');
    prepareVillageForBuildingUpgrades(world, village.id, 28, 1600, 16);
    clearFoodPatches(world);

    const parent = getMutableWorld(world).villages.get(village.id);

    if (!parent) {
      throw new Error('Expected parent village');
    }

    parent.housingCapacity = 40;

    while (world.currentTick < 115) {
      world.step();
    }

    expect(world.project().villages).toHaveLength(1);
    expect(world.project().villages[0].buildPlan).toBe('waiting_land');

    placeFoodPatch(world, { x: 36, y: 12 }, 500, 4);

    while (world.currentTick < 125) {
      world.step();
    }

    const preparingProjection = world.project();

    expect(preparingProjection.villages).toHaveLength(1);
    expect(preparingProjection.villages[0].buildPlan).toBe('prepare_expansion');
    expect(
      preparingProjection.recentEvents.some(
        (event) =>
          event.type === 'village_expansion_status' &&
          event.payload?.villageId === village.id &&
          event.payload?.plan === 'prepare_expansion',
      ),
    ).toBe(true);

    while (world.currentTick < 250) {
      world.step();
    }

    expect(world.project().villages.length).toBeGreaterThanOrEqual(2);
  });

  it('does not found a satellite village when no suitable food site exists', () => {
    const world = foundFoodRichVillage('kingdom-no-satellite-site', { width: 56, height: 32 });
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'farm');
    addActiveBuildingToVillage(world, village.id, 'mine');
    addActiveBuildingToVillage(world, village.id, 'barrack');
    addActiveBuildingToVillage(world, village.id, 'dock');
    prepareVillageForBuildingUpgrades(world, village.id, 28, 1600, 16);
    clearFoodPatches(world);

    const parent = getMutableWorld(world).villages.get(village.id);

    if (!parent) {
      throw new Error('Expected parent village');
    }

    parent.housingCapacity = 40;

    for (let tick = 0; tick < 5; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const blockedVillage = projection.villages.find((candidate) => candidate.id === village.id);
    const waitingLandEvent = projection.recentEvents.find(
      (event) =>
        event.type === 'village_expansion_status' && event.payload?.plan === 'waiting_land',
    );

    expect(projection.villages).toHaveLength(1);
    expect(blockedVillage?.buildPlan).toBe('waiting_land');
    expect(blockedVillage?.primaryGrowthBlocker).toBe('no_buildable_land');
    expect(waitingLandEvent).toMatchObject({
      payload: {
        villageId: village.id,
        plan: 'waiting_land',
        reason: 'no_site',
      },
    });
  });

  it('does not report expansion status for a young kingdom member that is still growing', () => {
    const world = foundFoodRichVillage('kingdom-young-member-growth', { width: 56, height: 32 });

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const kingdom = world.project().kingdoms[0];

    addVillageToKingdom(world, kingdom.id, {
      id: 'young-member',
      position: { x: 38, y: 18 },
      population: 8,
    });
    addActiveBuildingToVillage(world, 'young-member', 'house');
    addActiveBuildingToVillage(world, 'young-member', 'storage');
    addActiveBuildingToVillage(world, 'young-member', 'farm');
    addActiveBuildingToVillage(world, 'young-member', 'farm');
    addActiveBuildingToVillage(world, 'young-member', 'mine');
    addActiveBuildingToVillage(world, 'young-member', 'barrack');
    prepareVillageForBuildingUpgrades(world, 'young-member', 8, 260, 8);

    const youngMember = getMutableWorld(world).villages.get('young-member');

    if (!youngMember) {
      throw new Error('Expected young member village');
    }

    youngMember.housingCapacity = 18;
    youngMember.foodInventory = 260;
    youngMember.woodInventory = 200;

    world.step();

    const projection = world.project();
    const projectedYoungMember = projection.villages.find(
      (candidate) => candidate.id === 'young-member',
    );

    expect(projectedYoungMember).toBeDefined();
    expect(projectedYoungMember?.expansionPlan).toBeUndefined();
    expect(
      projection.recentEvents.some(
        (event) =>
          event.type === 'village_expansion_status' && event.payload?.villageId === 'young-member',
      ),
    ).toBe(false);
  });

  it('chooses the strongest remaining town as capital only after the current capital is lost', () => {
    const world = foundThreeFoodRichVillages('kingdom-capital-replacement');

    for (let tick = 0; tick < 300; tick += 1) {
      world.step();
    }

    const projection = world.project();
    const kingdom = projection.kingdoms[0];
    const originalCapitalId = kingdom.capitalVillageId;
    const candidates = projection.villages.filter((village) => village.id !== originalCapitalId);

    if (candidates.length < 2) {
      throw new Error('Expected a kingdom with at least two replacement candidates');
    }

    const [townHallCandidate, populationCandidate] = candidates;
    setVillagePopulation(world, townHallCandidate.id, 8);
    setVillagePopulation(world, populationCandidate.id, 40);
    setTownHallTier(world, townHallCandidate.id, 2);
    setTownHallTier(world, populationCandidate.id, 1);
    removeCapitalFromKingdom(world, kingdom.id, originalCapitalId);
    refreshProjectedKingdom(world, kingdom.id);

    expect(world.project().kingdoms[0].capitalVillageId).toBe(townHallCandidate.id);
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
    expect(
      projection.territory.filter(
        (tile) => tile.kingdomId === kingdom.id && tile.surface === 'land',
      ),
    ).toHaveLength(kingdom.territoryTiles);
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
      leftFood: 0,
      rightFood: 620,
      distance: 42,
    });
    const [leftVillage] = world.project().villages;

    if (!leftVillage) {
      throw new Error('Expected a left village');
    }

    removeFoodSitesNearVillage(world, leftVillage.id);
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

  it('uses barracks to mobilize larger army groups from the capital village', () => {
    const plainWorld = foundRivalKingdoms('barrack-army-boost');
    const barrackWorld = foundRivalKingdoms('barrack-army-boost');

    for (let tick = 0; tick < 260; tick += 1) {
      plainWorld.step();
      barrackWorld.step();
    }

    const barrackCapitalId = barrackWorld.project().kingdoms[0].capitalVillageId;
    const plainCapitalId = plainWorld.project().kingdoms[0].capitalVillageId;
    const plainCapital = getMutableWorld(plainWorld).villages.get(plainCapitalId);
    const barrackCapital = getMutableWorld(barrackWorld).villages.get(barrackCapitalId);

    if (!plainCapital || !barrackCapital) {
      throw new Error('Expected capital villages');
    }

    plainCapital.population = 16;
    barrackCapital.population = 16;

    addBarrackToVillage(barrackWorld, barrackCapitalId);

    const plainArmy = formFirstArmyGroup(plainWorld);
    const barrackArmy = formFirstArmyGroup(barrackWorld);

    expect(barrackArmy.soldierCount).toBeGreaterThan(plainArmy.soldierCount);
  });

  it('lets soldier jobs reinforce army mobilization from the capital village', () => {
    const controlWorld = foundRivalKingdoms('soldier-army-boost');
    const trainedWorld = foundRivalKingdoms('soldier-army-boost');

    for (let tick = 0; tick < 260; tick += 1) {
      controlWorld.step();
      trainedWorld.step();
    }

    const controlCapitalId = controlWorld.project().kingdoms[0].capitalVillageId;
    const trainedCapitalId = trainedWorld.project().kingdoms[0].capitalVillageId;

    addBarrackToVillage(controlWorld, controlCapitalId);
    addBarrackToVillage(trainedWorld, trainedCapitalId);

    const controlVillage = getMutableWorld(controlWorld).villages.get(controlCapitalId);
    const trainedVillage = getMutableWorld(trainedWorld).villages.get(trainedCapitalId);

    if (!controlVillage || !trainedVillage) {
      throw new Error('Expected capital villages');
    }

    controlVillage.jobs.soldier = 0;
    trainedVillage.jobs.soldier = 8;

    const controlArmy = formFirstArmyGroup(controlWorld);
    const trainedArmy = formFirstArmyGroup(trainedWorld);

    expect(trainedArmy.soldierCount).toBeGreaterThan(controlArmy.soldierCount);
  });

  it('keeps invading armies fighting across multiple ticks before capture', () => {
    const world = foundRivalKingdoms('minimal-war-occupation', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });

    waitForKingdoms(world);
    formFirstArmyGroup(world);

    let fightingArmy = world.project().armies.find((army) => army.status === 'fighting');
    let sawBattleResolved = false;

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
      const projection = world.project();
      sawBattleResolved ||= projection.recentEvents.some(
        (event) => event.type === 'battle_resolved',
      );
      fightingArmy = projection.armies.find((army) => army.status === 'fighting');

      if (
        fightingArmy &&
        (fightingArmy.occupationProgress ?? 0) > 0 &&
        (fightingArmy.occupationProgress ?? 0) < 100
      ) {
        break;
      }
    }

    expect(fightingArmy).toBeDefined();
    expect(fightingArmy?.occupationProgress).toBeGreaterThan(0);
    expect(fightingArmy?.occupationProgress).toBeLessThan(100);
    expect(sawBattleResolved).toBe(false);
  });

  it('resolves group battles with casualties and village capture', () => {
    const world = foundRivalKingdoms('minimal-war-capture', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    const [aggressor] = world.project().kingdoms;

    if (!aggressor) {
      throw new Error('Expected aggressor kingdom');
    }

    const aggressorCapital = getMutableWorld(world).villages.get(aggressor.capitalVillageId);

    if (!aggressorCapital) {
      throw new Error('Expected aggressor capital');
    }

    aggressorCapital.population = 40;
    aggressorCapital.jobs.soldier = 8;
    addBarrackToVillage(world, aggressor.capitalVillageId);
    formFirstArmyGroup(world);

    const initialPopulation = world.project().stats.population;
    let sawBattleResolved = false;
    let sawVillageCaptured = false;
    let capturePayload: Record<string, string | number | boolean> | undefined;

    for (let tick = 0; tick < 420; tick += 1) {
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

  it('transfers active storage on capture but loses part of stored resources to plunder', () => {
    const world = foundRivalKingdoms('capture-storage-plunder', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    const mutableWorld = getMutableWorld(world);
    const [attacker, defender] = world.project().kingdoms;

    if (!attacker || !defender) {
      throw new Error('Expected rival kingdoms');
    }

    const targetVillage = mutableWorld.villages.get(defender.capitalVillageId);

    if (!targetVillage) {
      throw new Error('Expected target village');
    }

    const storage = createActiveBuildingInVillage(world, targetVillage.id, 'storage');
    targetVillage.foodInventory = 200;
    targetVillage.foodCapacity = 260;
    targetVillage.woodInventory = 120;
    targetVillage.woodCapacity = 160;
    targetVillage.stoneInventory = 80;
    targetVillage.stoneCapacity = 100;
    targetVillage.ironInventory = 40;
    targetVillage.ironCapacity = 50;

    mutableWorld.captureVillage(targetVillage, attacker, defender);

    const projection = world.project();
    const capturedVillage = projection.villages.find((village) => village.id === targetVillage.id);
    const capturedStorage = projection.buildings.find((building) => building.id === storage.id);

    expect(capturedVillage?.kingdomId).toBe(attacker.id);
    expect(capturedStorage).toMatchObject({
      villageId: targetVillage.id,
      type: 'storage',
      status: 'active',
    });
    expect(capturedVillage?.foodInventory).toBe(100);
    expect(capturedVillage?.woodInventory).toBe(60);
    expect(capturedVillage?.stoneInventory).toBe(40);
    expect(capturedVillage?.ironInventory).toBe(20);
  });

  it('can send another army after the first attack is repelled', () => {
    const world = foundRivalKingdoms('minimal-war-rearm', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    const [aggressor, target] = world.project().kingdoms;

    if (!aggressor || !target) {
      throw new Error('Expected rival kingdoms');
    }

    const mutableWorld = getMutableWorld(world);
    const aggressorCapital = mutableWorld.villages.get(aggressor.capitalVillageId);
    const targetCapital = mutableWorld.villages.get(target.capitalVillageId);

    if (!aggressorCapital || !targetCapital) {
      throw new Error('Expected capital villages');
    }

    aggressorCapital.population = 4;
    targetCapital.population = 80;
    const relation = {
      pressure: 140,
      warDeclared: true,
      armyFormed: false,
      pressureReportTier: -1,
      borderReportTier: -1,
      resourceReportTier: -1,
    };

    mutableWorld.formArmyGroup(aggressor, target, relation);
    const firstArmy = getMutableWorld(world).armies.values().next().value;

    if (!firstArmy) {
      throw new Error('Expected first army');
    }

    firstArmy.status = 'disbanded';
    relation.armyFormed = false;

    aggressorCapital.population = 16;
    targetCapital.population = 24;
    mutableWorld.formArmyGroup(aggressor, target, relation);

    const projection = world.project();
    const activeArmies = projection.armies.filter((army) => army.status !== 'disbanded');

    expect(activeArmies).toHaveLength(1);
    expect(activeArmies[0]?.kingdomId).toBe(aggressor.id);
    expect(activeArmies[0]?.targetKingdomId).toBe(target.id);
  });

  it('lets multiple eligible villages send armies into the same war', () => {
    const world = foundRivalKingdoms('multi-village-war', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    const [aggressor, target] = world.project().kingdoms;

    if (!aggressor || !target) {
      throw new Error('Expected rival kingdoms');
    }

    const satellite = addVillageToKingdom(world, aggressor.id, {
      id: 'test-war-satellite',
      position: { x: 18, y: 16 },
      population: 18,
    });
    const relation = {
      pressure: 140,
      warDeclared: true,
      armyFormed: false,
      pressureReportTier: -1,
      borderReportTier: -1,
      resourceReportTier: -1,
    };

    getMutableWorld(world).formArmyGroup(aggressor, target, relation);

    const activeArmies = world
      .project()
      .armies.filter((army) => army.kingdomId === aggressor.id && army.status !== 'disbanded');

    expect(activeArmies.map((army) => army.originVillageId)).toEqual(
      expect.arrayContaining([aggressor.capitalVillageId, satellite.id]),
    );
    expect(new Set(activeArmies.map((army) => army.originVillageId)).size).toBeGreaterThan(1);
  });

  it('projects local attacker and defender battle dots while an army is fighting', () => {
    const world = foundRivalKingdoms('battle-dots', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    formFirstArmyGroup(world);

    let projection = world.project();

    for (let tick = 0; tick < 180; tick += 1) {
      world.step();
      projection = world.project();

      if (projection.armies.some((army) => army.status === 'fighting')) {
        break;
      }
    }

    const fightingArmy = projection.armies.find((army) => army.status === 'fighting');

    expect(fightingArmy).toBeDefined();
    expect(projection.battleMarkers.some((marker) => marker.side === 'attacker')).toBe(true);
    expect(projection.battleMarkers.some((marker) => marker.side === 'defender')).toBe(true);
    expect(projection.battleMarkers.every((marker) => marker.armyId === fightingArmy?.id)).toBe(
      true,
    );
  });

  it('lets god commands force a war between selected kingdoms', () => {
    const world = foundRivalKingdoms('force-war-command', {
      leftFood: 700,
      rightFood: 700,
      distance: 24,
    });
    waitForKingdoms(world);
    const [aggressor, target] = world.project().kingdoms;

    if (!aggressor || !target) {
      throw new Error('Expected rival kingdoms');
    }

    world.enqueue({
      id: 'cmd-force-war',
      type: 'force_war',
      issuedAtTick: world.currentTick,
      payload: {
        aggressorKingdomId: aggressor.id,
        targetKingdomId: target.id,
      },
    });
    world.step();

    const projection = world.project();

    expect(projection.recentEvents.some((event) => event.type === 'war_declared')).toBe(true);
    expect(projection.stats.activeArmies).toBeGreaterThan(0);
    expect(
      projection.armies.some(
        (army) =>
          army.status !== 'disbanded' &&
          army.kingdomId === aggressor.id &&
          army.targetKingdomId === target.id,
      ),
    ).toBe(true);
  });

  it('lets god commands force peace and clear active armies between kingdoms', () => {
    const world = foundRivalKingdoms('force-peace-command', {
      leftFood: 220,
      rightFood: 760,
      distance: 24,
    });
    waitForKingdoms(world);
    const [aggressor, target] = world.project().kingdoms;

    if (!aggressor || !target) {
      throw new Error('Expected rival kingdoms');
    }

    formFirstArmyGroup(world);
    expect(world.project().stats.activeArmies).toBeGreaterThan(0);

    world.enqueue({
      id: 'cmd-force-peace',
      type: 'force_peace',
      issuedAtTick: world.currentTick,
      payload: {
        kingdomAId: aggressor.id,
        kingdomBId: target.id,
      },
    });
    world.step();

    const projection = world.project();

    expect(projection.stats.activeArmies).toBe(0);
    expect(projection.recentEvents.some((event) => event.type === 'peace_forced')).toBe(true);
    expect(
      projection.kingdoms.every(
        (kingdom) =>
          ![aggressor.id, target.id].includes(kingdom.id) ||
          kingdom.diplomacyTargetKingdomId === undefined ||
          kingdom.diplomacyPressure === 0,
      ),
    ).toBe(true);
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

function foundFoodRichVillage(seed: string, options: { width?: number; height?: number } = {}) {
  const world = new SimWorld({
    seed,
    width: options.width ?? 32,
    height: options.height ?? 24,
    initialUnits: 0,
  });

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
  addWoodSiteNearVillage(world, world.project().villages[0].id);

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
  for (const village of world.project().villages) {
    addWoodSiteNearVillage(world, village.id);
  }

  return world;
}

function foundThreeFoodRichVillages(seed: string) {
  const world = new SimWorld({ seed, width: 84, height: 32, initialUnits: 0 });

  for (const [index, position] of [
    { x: 12, y: 10 },
    { x: 42, y: 22 },
    { x: 70, y: 10 },
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
  for (const village of world.project().villages) {
    addWoodSiteNearVillage(world, village.id);
  }

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
  for (const village of world.project().villages) {
    addWoodSiteNearVillage(world, village.id);
  }

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

function setVillagePopulation(world: SimWorld, villageId: string, population: number) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  village.population = population;
}

function addResidentUnitsToVillage(world: SimWorld, villageId: string, count: number) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (let index = 0; index < count; index += 1) {
    const unit = mutableWorld.createUnit({
      race: village.race,
      gender: index % 2 === 0 ? 'female' : 'male',
      position: {
        x: village.center.x + (index % 3) - 1,
        y: village.center.y + Math.floor(index / 3) - 1,
      },
      ageTicks: 12 * 240,
      hunger: 0,
      reproductionCooldownTicks: 0,
      villageId,
      homeVillageId: villageId,
    });

    mutableWorld.units.set(unit.id, unit);
  }
}

function setTownHallTier(world: SimWorld, villageId: string, tier: number) {
  const townHall = [...getMutableWorld(world).buildings.values()].find(
    (building) => building.villageId === villageId && building.type === 'town_hall',
  );

  if (!townHall) {
    throw new Error(`Expected town hall for village ${villageId}`);
  }

  townHall.tier = tier;
}

function addActiveBuildingToVillage(
  world: SimWorld,
  villageId: string,
  type: VillageBuilding['type'],
) {
  createActiveBuildingInVillage(world, villageId, type);
}

function createActiveBuildingInVillage(
  world: SimWorld,
  villageId: string,
  type: VillageBuilding['type'],
) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const building = mutableWorld.createBuilding(village, type);
  mutableWorld.buildings.set(building.id, building);

  return building;
}

function placeFoodPatch(
  world: SimWorld,
  position: { x: number; y: number },
  amount: number,
  radius: number,
) {
  for (const tile of world.map.tiles) {
    const dx = tile.x - position.x;
    const dy = tile.y - position.y;

    if (dx * dx + dy * dy > radius * radius) {
      continue;
    }

    tile.terrain = 'grass';
    tile.biome = 'temperate';

    tile.resource = {
      type: 'food',
      amount,
    };
  }
}

function clearFoodPatches(world: SimWorld) {
  for (const tile of world.map.tiles) {
    if (tile.resource?.type === 'food') {
      tile.resource = undefined;
    }
  }
}

function clearWoodPatches(world: SimWorld) {
  for (const tile of world.map.tiles) {
    if (tile.resource?.type === 'wood') {
      tile.resource = undefined;
    }
  }
}

function addMineSiteNearVillage(
  world: SimWorld,
  villageId: string,
  resourceType: 'stone' | 'iron',
) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const tile = world.map.tiles.find(
    (candidate) =>
      candidate.x === Math.floor(village.center.x + 3) &&
      candidate.y === Math.floor(village.center.y),
  );

  if (!tile) {
    throw new Error('Expected nearby mine tile');
  }

  tile.terrain = 'hill';
  tile.biome = 'highland';
  tile.resource = { type: resourceType, amount: 80 };
}

function addWoodSiteNearVillage(world: SimWorld, villageId: string, xOffset = 6) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const tile = world.map.tiles.find(
    (candidate) =>
      candidate.x === Math.floor(village.center.x + xOffset) &&
      candidate.y === Math.floor(village.center.y),
  );

  if (!tile) {
    throw new Error('Expected nearby wood tile');
  }

  tile.terrain = 'forest';
  tile.biome = 'woodland';
  tile.resource = { type: 'wood', amount: 80 };
}

function removeQuarrySitesNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (const tile of world.map.tiles) {
    const dx = tile.x - village.center.x;
    const dy = tile.y - village.center.y;

    if (dx * dx + dy * dy > 6 * 6) {
      continue;
    }

    tile.terrain = 'water';
    tile.biome = 'coast';
    tile.resource = undefined;
  }
}

function removeWoodSitesNearVillage(world: SimWorld, villageId: string, radius = 18) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (const tile of world.map.tiles) {
    const dx = tile.x - village.center.x;
    const dy = tile.y - village.center.y;

    if (dx * dx + dy * dy > radius * radius) {
      continue;
    }

    if (tile.resource?.type === 'wood') {
      tile.resource = undefined;
    }

    if (tile.terrain === 'forest') {
      tile.terrain = 'grass';
      tile.biome = 'temperate';
    }
  }
}

function removeFoodSitesNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (const tile of world.map.tiles) {
    const dx = tile.x - village.center.x;
    const dy = tile.y - village.center.y;

    if (dx * dx + dy * dy > 8 * 8) {
      continue;
    }

    if (tile.resource?.type === 'food') {
      tile.resource = undefined;
    }
  }
}

function removeMineSitesNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (const tile of world.map.tiles) {
    const dx = tile.x - village.center.x;
    const dy = tile.y - village.center.y;

    if (dx * dx + dy * dy > 8 * 8) {
      continue;
    }

    if (tile.terrain === 'hill') {
      tile.terrain = 'grass';
      tile.biome = 'temperate';
    }

    if (tile.resource?.type === 'stone' || tile.resource?.type === 'iron') {
      tile.resource = undefined;
    }
  }
}

function addDockSiteNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const shore = world.map.tiles.find(
    (candidate) =>
      candidate.x === Math.floor(village.center.x + 4) &&
      candidate.y === Math.floor(village.center.y),
  );
  const water = world.map.tiles.find(
    (candidate) =>
      candidate.x === Math.floor(village.center.x + 5) &&
      candidate.y === Math.floor(village.center.y),
  );

  if (!shore || !water) {
    throw new Error('Expected nearby dock tiles');
  }

  shore.terrain = 'grass';
  shore.biome = 'coast';
  shore.resource = undefined;
  water.terrain = 'water';
  water.biome = 'coast';
  water.resource = undefined;
}

function removeDockSitesNearVillage(world: SimWorld, villageId: string) {
  const village = getMutableWorld(world).villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  for (const tile of world.map.tiles) {
    const dx = tile.x - village.center.x;
    const dy = tile.y - village.center.y;

    if (dx * dx + dy * dy > 9 * 9 || tile.terrain !== 'water') {
      continue;
    }

    tile.terrain = 'grass';
    tile.biome = 'temperate';
  }
}

function hasAdjacentWater(world: SimWorld, position: { x: number; y: number }) {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);

  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].some((candidate) =>
    world.map.tiles.some(
      (tile) => tile.x === candidate.x && tile.y === candidate.y && tile.terrain === 'water',
    ),
  );
}

function addBarrackToVillage(world: SimWorld, villageId: string) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  mutableWorld.buildings.set(`test-barrack-${villageId}`, {
    id: `test-barrack-${villageId}`,
    villageId,
    type: 'barrack' as VillageBuilding['type'],
    status: 'active',
    position: {
      x: village.center.x + 1,
      y: village.center.y,
    },
    builtAtTick: world.currentTick,
  });
}

function addVillageToKingdom(
  world: SimWorld,
  kingdomId: string,
  options: { id: string; position: { x: number; y: number }; population: number },
) {
  const mutableWorld = getMutableWorld(world);
  const kingdom = mutableWorld.kingdoms.get(kingdomId);

  if (!kingdom) {
    throw new Error(`Expected kingdom ${kingdomId}`);
  }

  const village: Village = {
    id: options.id,
    name: 'Test March',
    level: 1,
    race: kingdom.race,
    kingdomId,
    center: { ...options.position },
    population: options.population,
    foodInventory: 120,
    foodCapacity: 180,
    woodInventory: 80,
    woodCapacity: 160,
    stoneInventory: 20,
    stoneCapacity: 80,
    ironInventory: 0,
    ironCapacity: 40,
    jobs: {
      farmer: 3,
      builder: 2,
      miner: 0,
      soldier: 4,
      laborer: Math.max(0, options.population - 9),
    },
    growthPhase: 'village',
    growthBlockers: [],
    primaryGrowthBlocker: undefined,
    buildPlan: 'idle',
    primaryIntention: 'idle',
    housingCapacity: Math.max(24, options.population),
    territoryTiles: 0,
    foundedAtTick: world.currentTick,
    status: 'stable',
  };

  mutableWorld.villages.set(village.id, village);
  kingdom.villageIds.push(village.id);
  mutableWorld.refreshKingdomMembership(kingdom);

  return village;
}

function removeCapitalFromKingdom(world: SimWorld, kingdomId: string, capitalVillageId: string) {
  const mutableWorld = getMutableWorld(world);
  const kingdom = mutableWorld.kingdoms.get(kingdomId);
  const village = mutableWorld.villages.get(capitalVillageId);

  if (!kingdom || !village) {
    throw new Error('Expected capital village and kingdom');
  }

  kingdom.villageIds = kingdom.villageIds.filter((villageId) => villageId !== capitalVillageId);
  village.kingdomId = undefined;
}

function refreshProjectedKingdom(world: SimWorld, kingdomId: string) {
  const mutableWorld = getMutableWorld(world);
  const kingdom = mutableWorld.kingdoms.get(kingdomId);

  if (!kingdom) {
    throw new Error(`Expected kingdom ${kingdomId}`);
  }

  mutableWorld.refreshKingdomMembership(kingdom);
}

function getMutableWorld(world: SimWorld) {
  return world as unknown as {
    villages: Map<string, Village>;
    kingdoms: Map<string, Kingdom>;
    buildings: Map<string, VillageBuilding>;
    armies: Map<string, ArmyGroup>;
    units: Map<string, Unit>;
    tick: number;
    createUnit(options: {
      race: Unit['race'];
      gender: Unit['gender'];
      position: { x: number; y: number };
      ageTicks: number;
      hunger: number;
      reproductionCooldownTicks: number;
      villageId?: string;
      homeVillageId?: string;
    }): Unit;
    createBuilding(village: Village, type: VillageBuilding['type']): VillageBuilding;
    refreshKingdomMembership(kingdom: Kingdom): void;
    captureVillage(village: Village, attacker: Kingdom, defender: Kingdom): void;
    formArmyGroup(
      aggressor: Kingdom,
      target: Kingdom,
      relation: {
        pressure: number;
        warDeclared: boolean;
        armyFormed: boolean;
        pressureReportTier: number;
        borderReportTier: number;
        resourceReportTier: number;
      },
    ): void;
  };
}

function formFirstArmyGroup(world: SimWorld) {
  const [aggressor, target] = world.project().kingdoms;

  if (!aggressor || !target) {
    throw new Error('Expected two kingdoms');
  }

  getMutableWorld(world).formArmyGroup(aggressor, target, {
    pressure: 0,
    warDeclared: true,
    armyFormed: false,
    pressureReportTier: -1,
    borderReportTier: -1,
    resourceReportTier: -1,
  });

  const army = world
    .project()
    .armies.find(
      (candidate) =>
        candidate.kingdomId === aggressor.id && candidate.targetKingdomId === target.id,
    );

  if (!army) {
    throw new Error('Expected army to form');
  }

  return army;
}

function waitForKingdoms(world: SimWorld, expected = 2) {
  for (let tick = 0; tick < 360; tick += 1) {
    if (world.project().kingdoms.length >= expected) {
      return;
    }

    world.step();
  }

  throw new Error(`Expected ${expected} kingdoms`);
}

function prepareVillageForBuildingUpgrades(
  world: SimWorld,
  villageId: string,
  residentsToKeep: number,
  foodInventory: number,
  extraSettlers = 0,
) {
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  village.foodInventory = foodInventory;
  village.foodCapacity = Math.max(village.foodCapacity, foodInventory);
  village.woodInventory = Math.max(village.woodInventory, 500);
  village.woodCapacity = Math.max(village.woodCapacity, village.woodInventory);
  village.stoneInventory = Math.max(village.stoneInventory, 200);
  village.stoneCapacity = Math.max(village.stoneCapacity, village.stoneInventory + 80);
  village.ironCapacity = Math.max(village.ironCapacity, 80);
  village.housingCapacity = Math.max(village.housingCapacity, 24);

  if (extraSettlers > 0) {
    for (let index = 0; index < extraSettlers; index += 1) {
      const unit = mutableWorld.createUnit({
        race: village.race,
        gender: index % 2 === 0 ? 'female' : 'male',
        position: {
          x: village.center.x + (index % 3) - 1,
          y: village.center.y + Math.floor(index / 3) - 1,
        },
        ageTicks: 0,
        hunger: 0,
        reproductionCooldownTicks: 0,
        villageId,
        homeVillageId: villageId,
      });

      mutableWorld.units.set(unit.id, unit);
    }

    let adopted = 0;

    for (const unit of mutableWorld.units.values()) {
      if (unit.homeVillageId === villageId) {
        continue;
      }

      if (adopted >= extraSettlers) {
        break;
      }

      unit.homeVillageId = villageId;
      unit.villageId = villageId;
      unit.position = {
        x: village.center.x + (adopted % 3) - 1,
        y: village.center.y + Math.floor(adopted / 3) - 1,
      };
      adopted += 1;
    }
  }

  let kept = 0;

  for (const unit of mutableWorld.units.values()) {
    if (unit.homeVillageId !== villageId) {
      continue;
    }

    kept += 1;

    if (kept <= residentsToKeep) {
      continue;
    }

    unit.homeVillageId = undefined;
    unit.villageId = undefined;
    unit.position = {
      x: 0,
      y: 0,
    };
  }
}

function serializeTerritory(
  territory: Array<{
    x: number;
    y: number;
    villageId: string;
    kingdomId?: string;
    surface: 'land' | 'water';
    source?: string;
  }>,
) {
  return territory
    .map(
      (tile) =>
        `${tile.x},${tile.y},${tile.villageId},${tile.kingdomId ?? ''},${tile.surface},${
          tile.source ?? ''
        }`,
    )
    .sort()
    .join('|');
}

function serializeStableTerritory(
  territory: Array<{
    x: number;
    y: number;
    villageId: string;
    kingdomId?: string;
    surface: 'land' | 'water';
    source?: string;
  }>,
) {
  return serializeTerritory(
    territory.filter((tile) => tile.source === 'settlement_core' || tile.source === 'building'),
  );
}

function distanceBetween(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function averageUnitPosition(units: Unit[]) {
  const total = units.reduce(
    (sum, unit) => ({
      x: sum.x + unit.position.x,
      y: sum.y + unit.position.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / Math.max(1, units.length),
    y: total.y / Math.max(1, units.length),
  };
}

function groupPositionsByDistance(positions: Array<{ x: number; y: number }>, radius: number) {
  const clusters: Array<{ x: number; y: number; count: number }> = [];

  for (const position of positions) {
    const cluster = clusters.find((candidate) => distanceBetween(candidate, position) <= radius);

    if (!cluster) {
      clusters.push({ ...position, count: 1 });
      continue;
    }

    cluster.x = (cluster.x * cluster.count + position.x) / (cluster.count + 1);
    cluster.y = (cluster.y * cluster.count + position.y) / (cluster.count + 1);
    cluster.count += 1;
  }

  return clusters;
}

function maxDistanceBetween(positions: Array<{ x: number; y: number }>) {
  let maxDistance = 0;

  for (let left = 0; left < positions.length; left += 1) {
    for (let right = left + 1; right < positions.length; right += 1) {
      maxDistance = Math.max(maxDistance, distanceBetween(positions[left], positions[right]));
    }
  }

  return maxDistance;
}

function tileKey(position: { x: number; y: number }) {
  return `${Math.floor(position.x)}:${Math.floor(position.y)}`;
}

function hasFoodNear(world: SimWorld, position: { x: number; y: number }, radius: number) {
  return world.map.tiles.some(
    (tile) =>
      tile.resource?.type === 'food' &&
      tile.resource.amount > 0 &&
      distanceBetween(tile, position) <= radius,
  );
}

function hasWoodNear(world: SimWorld, position: { x: number; y: number }, radius: number) {
  return world.map.tiles.some(
    (tile) =>
      tile.resource?.type === 'wood' &&
      tile.resource.amount > 0 &&
      distanceBetween(tile, position) <= radius,
  );
}
