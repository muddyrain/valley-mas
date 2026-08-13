import { describe, expect, it } from 'vitest';
import {
  type Building,
  BuildingType,
  CarriedResourceKind,
  EntityKind,
  Profession,
  ResourceNodeKind,
} from '@/shared/gameTypes';
import { addResourceNode } from '../resources/resourceNodes';
import { assignVillageHomesAndWorkplaces } from '../settlements/settlementOperations';
import { createWorldSimulation } from './worldSimulation';

function completedBuilding(
  id: number,
  villageId: number,
  type: BuildingType,
  x: number,
  z: number,
): Building {
  return {
    id,
    villageId,
    type,
    x,
    z,
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
    workSlots: 0,
  };
}

function stepUntil(
  simulation: ReturnType<typeof createWorldSimulation>,
  predicate: () => boolean,
  limit = 800,
): void {
  for (let tick = 0; tick < limit && !predicate(); tick += 1) simulation.step();
  expect(predicate()).toBe(true);
}

function preparedWorker(seed: string, profession: Profession, workplaceType: BuildingType) {
  const simulation = createWorldSimulation({ seed, initialHumans: 0 });
  const resident = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
  const x = Math.floor(simulation.state.entities.positionsX[resident] ?? 0);
  const z = Math.floor(simulation.state.entities.positionsZ[resident] ?? 0);
  const village = simulation.ensureVillageAt(x, z, 1);
  simulation.state.entities.villageIds[resident] = village.id;
  simulation.state.entities.professions[resident] = profession;
  simulation.state.entities.hunger[resident] = 0;
  simulation.state.entities.energy[resident] = 1_000;
  const workplace = completedBuilding(1, village.id, workplaceType, x, z);
  const storage = completedBuilding(2, village.id, BuildingType.Storage, x, z);
  simulation.state.buildings.push(workplace, storage);
  village.buildingIds.push(workplace.id, storage.id);
  assignVillageHomesAndWorkplaces(simulation.state, village);
  return { simulation, resident, village, workplace, x, z };
}

describe('resident work lifecycle', () => {
  it('works a tree for 36 ticks before carrying and depositing wood', () => {
    const { simulation, resident, village, x, z } = preparedWorker(
      'work-chop',
      Profession.Woodcutter,
      BuildingType.LoggingCamp,
    );
    village.resources.wood = 0;
    addResourceNode(simulation.state.resourceNodes, {
      kind: ResourceNodeKind.Tree,
      x: x + 0.5,
      z: z + 0.5,
      amount: 6,
    });

    stepUntil(simulation, () => simulation.state.entities.tasks[resident]?.phase === 'work');
    const progress = simulation.state.entities.tasks[resident]?.progress ?? 0;
    for (let tick = progress; tick < 35; tick += 1) simulation.step();
    expect(village.resources.wood).toBe(0);
    expect(simulation.state.entities.carriedResources[resident]).toBe(0);

    stepUntil(simulation, () => village.resources.wood >= 3);
    expect(village.resources.wood).toBeGreaterThanOrEqual(3);
    expect(village.resources.wood).toBe(3);
  });

  it('harvests a mature farm for 36 ticks and adds food only after delivery', () => {
    const { simulation, resident, village, x, z } = preparedWorker(
      'work-farm',
      Profession.Farmer,
      BuildingType.Farm,
    );
    village.resources.food = 10;
    const cell = z * simulation.state.map.size + x;
    simulation.state.map.crops[cell] = 180;

    stepUntil(simulation, () => simulation.state.entities.tasks[resident]?.phase === 'work');
    const progress = simulation.state.entities.tasks[resident]?.progress ?? 0;
    for (let tick = progress; tick < 35; tick += 1) simulation.step();
    expect(village.resources.food).toBe(10);

    stepUntil(simulation, () => village.resources.food >= 14);
    expect(simulation.state.map.crops[cell]).toBeLessThan(180);
  });

  it('carries workshop inputs to the workbench before crafting and depositing a tool', () => {
    const { simulation, resident, village } = preparedWorker(
      'work-craft',
      Profession.Blacksmith,
      BuildingType.Workshop,
    );
    village.resources.wood = 5;
    village.resources.metal = 10;
    village.resources.tools = 0;

    stepUntil(
      simulation,
      () =>
        simulation.state.entities.tasks[resident]?.phase === 'delivery' &&
        simulation.state.entities.carriedResourceKinds[resident] ===
          CarriedResourceKind.CraftInputs,
    );
    expect(village.resources.wood).toBe(4);
    expect(village.resources.metal).toBe(8);
    expect(village.resources.tools).toBe(0);

    stepUntil(simulation, () => simulation.state.entities.tasks[resident]?.phase === 'work');
    expect(simulation.state.entities.carriedResources[resident]).toBe(0);

    stepUntil(simulation, () => village.resources.tools >= 1);
  });

  it('advances construction by one progress per worker tick instead of on arrival', () => {
    const { simulation, resident, workplace } = preparedWorker(
      'work-build',
      Profession.Builder,
      BuildingType.TownCenter,
    );
    workplace.completed = false;
    workplace.stage = 0;
    workplace.progress = 0;
    workplace.requiredProgress = 100;
    workplace.constructionPhase = 'building';

    stepUntil(simulation, () => simulation.state.entities.tasks[resident]?.phase === 'work');
    expect(workplace.progress).toBeLessThanOrEqual(1);
    for (let tick = 0; tick < 9; tick += 1) simulation.step();
    expect(workplace.progress).toBeGreaterThanOrEqual(9);
    expect(workplace.progress).toBeLessThanOrEqual(10);
  });

  it('walks to storage before loading reserved construction material', () => {
    const { simulation, resident, village, workplace, x, z } = preparedWorker(
      'work-haul-pickup',
      Profession.Builder,
      BuildingType.TownCenter,
    );
    workplace.completed = false;
    workplace.constructionPhase = 'delivery';
    workplace.reservedWood = 12;
    workplace.deliveredWood = 0;
    workplace.inTransitWood = 0;
    const storage = simulation.state.buildings[1];
    if (!storage) throw new Error('测试世界缺少仓库');
    storage.x = x + 5;
    storage.z = z;
    workplace.x = x + 9;
    workplace.z = z;
    simulation.state.entities.positionsX[resident] = x + 0.5;
    simulation.state.entities.positionsZ[resident] = z + 0.5;
    village.resources.wood = 0;

    stepUntil(
      simulation,
      () =>
        simulation.state.entities.tasks[resident]?.phase === 'travel' &&
        simulation.state.entities.tasks[resident]?.targetId === storage.id,
    );
    expect(simulation.state.entities.carriedResources[resident]).toBe(0);

    stepUntil(simulation, () => simulation.state.entities.carriedResources[resident] > 0);
    expect(simulation.state.entities.tasks[resident]).toMatchObject({
      phase: 'delivery',
      targetId: workplace.id,
    });
    expect(workplace.inTransitWood).toBeGreaterThan(0);
    expect(workplace.deliveredWood).toBe(0);

    stepUntil(simulation, () => workplace.constructionPhase === 'building');
    stepUntil(simulation, () => workplace.progress > 0);
  });
});
