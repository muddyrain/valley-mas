import { describe, expect, it } from 'vitest';
import { BuildingType, EntityKind, Profession, ResidentSex, TerrainType } from '@/shared/gameTypes';
import { ANIMAL_LIFECYCLE_RULES } from '../rules/ecologyRules';
import { refreshEcologyDiagnostics } from '../systems/ecology';
import { createWorldSimulation } from './worldSimulation';

function livingKind(
  simulation: ReturnType<typeof createWorldSimulation>,
  kind: EntityKind,
): number[] {
  const result: number[] = [];
  for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
    if (
      simulation.state.entities.active[entityId] === 1 &&
      simulation.state.entities.kind[entityId] === kind
    ) {
      result.push(entityId);
    }
  }
  return result;
}

function stepUntil(
  simulation: ReturnType<typeof createWorldSimulation>,
  predicate: () => boolean,
  limit = 1_200,
): void {
  for (let tick = 0; tick < limit && !predicate(); tick += 1) simulation.step();
  expect(predicate()).toBe(true);
}

function findShorePair(simulation: ReturnType<typeof createWorldSimulation>): {
  landCell: number;
  waterCell: number;
} {
  const { map } = simulation.state;
  for (let landCell = 0; landCell < map.terrain.length; landCell += 1) {
    if ((map.navigation.cost[landCell] ?? 0) <= 0) continue;
    const x = landCell % map.size;
    const z = Math.floor(landCell / map.size);
    for (const [offsetX, offsetZ] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const waterX = x + offsetX;
      const waterZ = z + offsetZ;
      if (waterX < 0 || waterZ < 0 || waterX >= map.size || waterZ >= map.size) continue;
      const waterCell = waterZ * map.size + waterX;
      if (
        map.terrain[waterCell] === TerrainType.Ocean ||
        map.terrain[waterCell] === TerrainType.ShallowOcean
      ) {
        return { landCell, waterCell };
      }
    }
  }
  throw new Error('测试地图缺少可达岸线');
}

function findDeliveryCell(
  simulation: ReturnType<typeof createWorldSimulation>,
  originCell: number,
): number {
  const { map } = simulation.state;
  const originX = originCell % map.size;
  const originZ = Math.floor(originCell / map.size);
  for (let cell = 0; cell < map.terrain.length; cell += 1) {
    if ((map.navigation.cost[cell] ?? 0) <= 0) continue;
    const distance = Math.hypot((cell % map.size) - originX, Math.floor(cell / map.size) - originZ);
    if (distance >= 6 && distance <= 12) return cell;
  }
  throw new Error('测试地图缺少可用入库点');
}

describe('wildlife food chain', () => {
  it('starts a normal world with real fish while keeping blank ocean lifeless', () => {
    const simulation = createWorldSimulation({
      seed: 'default-real-fish',
      initialHumans: 0,
      mapSize: 128,
    });
    const fish = livingKind(simulation, EntityKind.Fish);
    expect(fish.length).toBeGreaterThan(0);
    expect(
      fish.every((entityId) => {
        const cell =
          Math.floor(simulation.state.entities.positionsZ[entityId] ?? 0) *
            simulation.state.map.size +
          Math.floor(simulation.state.entities.positionsX[entityId] ?? 0);
        return (
          simulation.state.map.terrain[cell] === TerrainType.Ocean ||
          simulation.state.map.terrain[cell] === TerrainType.ShallowOcean
        );
      }),
    ).toBe(true);

    const blank = createWorldSimulation({
      seed: 'blank-ocean-no-fish',
      initialHumans: 0,
      mapSize: 128,
      preset: 'ocean',
    });
    expect(blank.state.entities.count).toBe(0);
  });

  it('lets a sparse fish population feed from its habitat and reproduce below capacity', () => {
    const simulation = createWorldSimulation({
      seed: 'fish-habitat-recovery',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }
    const waterCell = simulation.state.map.terrain.indexOf(TerrainType.Ocean);
    expect(waterCell).toBeGreaterThanOrEqual(0);
    const waterX = (waterCell % simulation.state.map.size) + 0.5;
    const waterZ = Math.floor(waterCell / simulation.state.map.size) + 0.5;
    const female = simulation.spawn(EntityKind.Fish, waterX, waterZ)[0] as number;
    const male = simulation.spawn(EntityKind.Fish, waterX, waterZ)[0] as number;
    const rules = ANIMAL_LIFECYCLE_RULES[EntityKind.Fish];
    simulation.state.entities.sex[female] = ResidentSex.Female;
    simulation.state.entities.sex[male] = ResidentSex.Male;
    for (const fish of [female, male]) {
      simulation.state.entities.age[fish] = rules.maturityYears;
      simulation.state.entities.hunger[fish] = rules.maximumBreedingHunger;
    }

    for (let tick = 0; tick < 7_200; tick += 1) simulation.step();

    const diagnostics = simulation.state.ecology.species[EntityKind.Fish];
    expect(diagnostics?.births).toBeGreaterThan(0);
    expect(livingKind(simulation, EntityKind.Fish).length).toBeGreaterThan(2);
    expect(livingKind(simulation, EntityKind.Fish).length).toBeLessThanOrEqual(
      diagnostics?.capacity ?? 0,
    );
  });

  it('reduces habitat feeding when a fish population severely exceeds capacity', () => {
    const simulation = createWorldSimulation({
      seed: 'fish-food-competition',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    simulation.state.worldLaws.animalReproduction = false;
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }
    const waterCell = simulation.state.map.terrain.indexOf(TerrainType.Ocean);
    const capacity = simulation.state.ecology.species[EntityKind.Fish]?.capacity ?? 0;
    expect(capacity).toBeGreaterThan(0);
    const fish = simulation.spawn(
      EntityKind.Fish,
      (waterCell % simulation.state.map.size) + 0.5,
      Math.floor(waterCell / simulation.state.map.size) + 0.5,
      capacity * 6,
    );
    refreshEcologyDiagnostics(simulation.state);
    for (const entityId of fish) simulation.state.entities.hunger[entityId] = 500;

    for (let tick = 0; tick < 800; tick += 1) simulation.step();

    const averageHunger =
      fish.reduce((sum, entityId) => sum + (simulation.state.entities.hunger[entityId] ?? 0), 0) /
      fish.length;
    expect(averageHunger).toBeGreaterThan(500);
  });

  it('leaves a fresh carcass after an animal dies and removes it after decay', () => {
    const simulation = createWorldSimulation({
      seed: 'animal-carcass-decay',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    const deer = livingKind(simulation, EntityKind.Deer)[0];
    expect(deer).toBeDefined();
    if (deer === undefined) return;
    simulation.state.entities.hunger[deer] = 1_000;
    simulation.state.entities.health[deer] = 1;
    simulation.state.map.resourceFood.fill(0);

    for (let tick = 0; tick < 40 && simulation.state.entities.active[deer]; tick += 1) {
      simulation.step();
    }

    const carcass = simulation.state.carcasses.find(
      (candidate) => candidate.sourceKind === EntityKind.Deer,
    );
    expect(carcass).toMatchObject({ sourceKind: EntityKind.Deer });
    expect(carcass?.meatRemaining).toBeGreaterThan(0);
    expect(carcass?.decayAtTick).toBeGreaterThan(simulation.state.tick);

    if (!carcass) return;
    carcass.decayAtTick = simulation.state.tick + 1;
    simulation.step();

    expect(simulation.state.carcasses).not.toContainEqual(
      expect.objectContaining({ id: carcass.id }),
    );
  });

  it('does not let hunters target prey younger than the hunting age threshold', () => {
    const simulation = createWorldSimulation({
      seed: 'hunter-skips-juvenile-prey',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    simulation.state.worldLaws.animalPredation = false;
    simulation.state.map.resourceFood.fill(0);
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }

    const hunter = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
    const village = simulation.ensureVillageAt(64, 64, 1);
    simulation.state.entities.villageIds[hunter] = village.id;
    simulation.state.entities.professions[hunter] = Profession.Hunter;
    simulation.state.entities.hunger[hunter] = 0;
    simulation.state.entities.energy[hunter] = 1_000;
    village.resources.food = 0;

    const juvenile = simulation.spawn(EntityKind.Deer, 65, 64)[0] as number;
    simulation.state.entities.age[juvenile] = 2;
    simulation.state.entities.hunger[juvenile] = 0;
    simulation.state.entities.speed[juvenile] = 0;

    for (let tick = 0; tick < 360; tick += 1) simulation.step();

    expect(simulation.state.entities.active[juvenile]).toBe(1);
    expect(simulation.state.ecology.species[EntityKind.Deer]?.deathCauses.hunting).toBe(0);
    expect(simulation.state.entities.tasks[hunter]).not.toMatchObject({
      type: 'hunt',
      targetId: juvenile,
    });
  });

  it('hunts mature prey, butchers its carcass and adds food only after delivery', () => {
    const simulation = createWorldSimulation({
      seed: 'hunter-carcass-delivery',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    simulation.state.worldLaws.animalPredation = false;
    simulation.state.map.resourceFood.fill(0);
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }

    const hunter = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
    const hunterX = simulation.state.entities.positionsX[hunter] ?? 64;
    const hunterZ = simulation.state.entities.positionsZ[hunter] ?? 64;
    const village = simulation.ensureVillageAt(hunterX, hunterZ, 1);
    simulation.state.entities.villageIds[hunter] = village.id;
    simulation.state.entities.professions[hunter] = Profession.Hunter;
    simulation.state.entities.hunger[hunter] = 0;
    simulation.state.entities.energy[hunter] = 1_000;
    village.resources.food = 0;

    const deer = simulation.spawn(EntityKind.Deer, hunterX + 1, hunterZ)[0] as number;
    simulation.state.entities.age[deer] = 3;
    simulation.state.entities.health[deer] = 24;
    simulation.state.entities.speed[deer] = 0;

    stepUntil(simulation, () => simulation.state.carcasses.length > 0);
    expect(simulation.state.ecology.species[EntityKind.Deer]?.deathCauses.hunting).toBe(1);
    expect(village.resources.food).toBe(0);
    expect(simulation.state.entities.carriedResources[hunter]).toBe(0);

    stepUntil(simulation, () => village.resources.food > 0);
    expect(simulation.state.carcasses).toHaveLength(0);
    expect(simulation.state.entities.carriedResources[hunter]).toBe(0);
  });

  it('catches a real fish from land and adds it to food only after delivery', () => {
    const simulation = createWorldSimulation({
      seed: 'shore-fishing-delivery',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.naturalAnimalReturn = false;
    simulation.state.map.resourceFood.fill(0);
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }
    const { landCell, waterCell } = findShorePair(simulation);
    const landX = (landCell % simulation.state.map.size) + 0.5;
    const landZ = Math.floor(landCell / simulation.state.map.size) + 0.5;
    const waterX = (waterCell % simulation.state.map.size) + 0.5;
    const waterZ = Math.floor(waterCell / simulation.state.map.size) + 0.5;
    const fisher = simulation.spawn(EntityKind.Human, landX, landZ)[0] as number;
    simulation.state.entities.positionsX[fisher] = landX;
    simulation.state.entities.positionsZ[fisher] = landZ;
    const deliveryCell = findDeliveryCell(simulation, landCell);
    const village = simulation.ensureVillageAt(
      (deliveryCell % simulation.state.map.size) + 0.5,
      Math.floor(deliveryCell / simulation.state.map.size) + 0.5,
      1,
    );
    simulation.state.entities.villageIds[fisher] = village.id;
    simulation.state.entities.professions[fisher] = Profession.Forager;
    simulation.state.entities.hunger[fisher] = 0;
    simulation.state.entities.energy[fisher] = 1_000;
    village.resources.food = 0;
    const residentHunter = simulation.spawn(EntityKind.Human, village.x, village.z)[0] as number;
    simulation.state.entities.villageIds[residentHunter] = village.id;
    simulation.state.entities.professions[residentHunter] = Profession.Hunter;
    simulation.state.entities.hunger[residentHunter] = 0;
    simulation.state.entities.energy[residentHunter] = 1_000;

    const fish = simulation.spawn(EntityKind.Fish, waterX, waterZ)[0] as number;
    simulation.state.entities.positionsX[fish] = waterX;
    simulation.state.entities.positionsZ[fish] = waterZ;
    simulation.state.entities.speed[fish] = 0;

    stepUntil(
      simulation,
      () =>
        simulation.state.entities.tasks[fisher]?.type === 'fish' &&
        simulation.state.entities.tasks[fisher]?.phase === 'work',
    );
    const fisherCell =
      Math.floor(simulation.state.entities.positionsZ[fisher] ?? 0) * simulation.state.map.size +
      Math.floor(simulation.state.entities.positionsX[fisher] ?? 0);
    expect(simulation.state.map.navigation.cost[fisherCell]).toBeGreaterThan(0);
    expect(simulation.state.entities.active[fish]).toBe(1);
    expect(village.resources.food).toBe(0);

    stepUntil(simulation, () => simulation.state.entities.active[fish] === 0);
    expect(village.resources.food).toBe(0);
    expect(simulation.state.entities.carriedResources[fisher]).toBeGreaterThan(0);

    stepUntil(simulation, () => village.resources.food > 0);
    expect(simulation.state.entities.carriedResources[fisher]).toBe(0);
  });

  it('keeps foragers working an existing farm when forage and shore fish are unavailable', () => {
    const simulation = createWorldSimulation({
      seed: 'forager-farm-fallback',
      initialHumans: 0,
      mapSize: 128,
    });
    simulation.state.worldLaws.hunger = false;
    simulation.state.worldLaws.naturalAnimalReturn = false;
    simulation.state.map.resourceFood.fill(0);
    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      simulation.state.entities.active[entityId] = 0;
    }

    const forager = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
    const foragerX = simulation.state.entities.positionsX[forager] ?? 64;
    const foragerZ = simulation.state.entities.positionsZ[forager] ?? 64;
    const village = simulation.ensureVillageAt(foragerX, foragerZ, 2);
    simulation.state.entities.villageIds[forager] = village.id;
    simulation.state.entities.professions[forager] = Profession.Forager;
    simulation.state.entities.hunger[forager] = 0;
    simulation.state.entities.energy[forager] = 1_000;
    village.resources.food = 0;

    const residentHunter = simulation.spawn(EntityKind.Human, foragerX, foragerZ)[0] as number;
    simulation.state.entities.villageIds[residentHunter] = village.id;
    simulation.state.entities.professions[residentHunter] = Profession.Hunter;
    simulation.state.entities.hunger[residentHunter] = 0;
    simulation.state.entities.energy[residentHunter] = 1_000;

    simulation.state.buildings.push({
      id: 1,
      villageId: village.id,
      type: BuildingType.Farm,
      x: foragerX,
      z: foragerZ,
      stage: 2,
      progress: 100,
      requiredProgress: 100,
      health: 100,
      completed: true,
      constructionPhase: 'complete',
      reservedWood: 0,
      reservedStone: 0,
      deliveredWood: 0,
      deliveredStone: 0,
      inTransitWood: 0,
      inTransitStone: 0,
      clearNodeIds: [],
      assignedWorkerIds: [],
      workSlots: 3,
    });
    village.buildingIds.push(1);

    stepUntil(simulation, () => village.resources.food > 0, 1_200);
  });
});
