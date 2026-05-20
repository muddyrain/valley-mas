import { describe, expect, it } from 'vitest';
import { type SimCommand, SimWorld } from './index';
import type { Kingdom, Unit, Village, VillageBuilding } from './types';

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

    for (let tick = 0; tick < 31; tick += 1) {
      world.step();
    }

    const depletedFood = world.project().stats.totalVillageFood;

    for (let tick = 0; tick < 10; tick += 1) {
      world.step();
    }

    expect(world.project().stats.totalVillageFood).toBeGreaterThan(depletedFood);
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
    expect(farms).toHaveLength(1);
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

  it('keeps abandoned buildings as ruins-in-progress without active village benefits', () => {
    const world = foundFoodRichVillage('village-abandoned-buildings');
    const mutableWorld = getMutableWorld(world) as unknown as {
      villages: Map<string, Village>;
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
  });

  it('keeps territory stable when villagers move away from the settlement center', () => {
    const world = foundFoodRichVillage('stable-territory');

    for (let tick = 0; tick < 260; tick += 1) {
      world.step();
    }

    const before = serializeTerritory(world.project().territory);

    moveVillageResidents(world, world.project().villages[0].id, { x: 2, y: 2 });

    for (let tick = 0; tick < 20; tick += 1) {
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

  it('lets a mature pressured kingdom found a satellite village on suitable land', () => {
    const world = foundFoodRichVillage('kingdom-satellite-village', { width: 56, height: 32 });
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    prepareVillageForBuildingUpgrades(world, village.id, 24, 1600, 12);
    clearFoodPatches(world);
    placeFoodPatch(world, { x: 36, y: 12 }, 500, 4);

    const parent = getMutableWorld(world).villages.get(village.id);

    if (!parent) {
      throw new Error('Expected parent village');
    }

    parent.housingCapacity = 24;

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

  it('does not found a satellite village when no suitable food site exists', () => {
    const world = foundFoodRichVillage('kingdom-no-satellite-site', { width: 56, height: 32 });
    const village = world.project().villages[0];

    addActiveBuildingToVillage(world, village.id, 'house');
    addActiveBuildingToVillage(world, village.id, 'storage');
    addActiveBuildingToVillage(world, village.id, 'farm');
    prepareVillageForBuildingUpgrades(world, village.id, 24, 1600, 12);
    clearFoodPatches(world);

    const parent = getMutableWorld(world).villages.get(village.id);

    if (!parent) {
      throw new Error('Expected parent village');
    }

    parent.housingCapacity = 24;

    for (let tick = 0; tick < 240; tick += 1) {
      world.step();
    }

    expect(world.project().villages).toHaveLength(1);
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
  const mutableWorld = getMutableWorld(world);
  const village = mutableWorld.villages.get(villageId);

  if (!village) {
    throw new Error(`Expected village ${villageId}`);
  }

  const building = mutableWorld.createBuilding(village, type);
  mutableWorld.buildings.set(building.id, building);
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

function removeWoodSitesNearVillage(world: SimWorld, villageId: string) {
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
    units: Map<string, Unit>;
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
  village.stoneInventory = Math.max(village.stoneInventory, 200);
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
  territory: Array<{ x: number; y: number; villageId: string; kingdomId?: string }>,
) {
  return territory
    .map((tile) => `${tile.x},${tile.y},${tile.villageId},${tile.kingdomId ?? ''}`)
    .sort()
    .join('|');
}
