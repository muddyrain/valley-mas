import { describe, expect, it } from 'vitest';
import { CarriedResourceKind, VillageTier } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { formKingdoms } from '../kingdoms/kingdoms';
import { beginResidentTask } from '../tasks/residentTasks';
import { loadWorldSave, serializeWorld } from './save';

describe('world persistence', () => {
  it('round-trips the current world without tick history', () => {
    const simulation = createWorldSimulation({ seed: 'archive', initialHumans: 48 });
    for (let tick = 0; tick < 300; tick += 1) simulation.step();
    const encoded = serializeWorld(simulation.state);
    const restored = loadWorldSave(encoded);

    expect(JSON.parse(encoded).version).toBe(10);
    expect(restored.seed).toBe(simulation.state.seed);
    expect(restored.tick).toBe(simulation.state.tick);
    expect(restored.entities.count).toBe(simulation.state.entities.count);
    expect(restored.entities.sex).toEqual(simulation.state.entities.sex);
    expect(restored.entities.familyIds).toEqual(simulation.state.entities.familyIds);
    expect(restored.population).toEqual(simulation.state.population);
    expect(restored.worldLaws).toEqual(simulation.state.worldLaws);
    expect(restored.ecology).toEqual(simulation.state.ecology);
    expect(restored.wars).toEqual(simulation.state.wars);
    expect(restored.truces).toEqual(simulation.state.truces);
    expect(restored.map.terrain).toEqual(simulation.state.map.terrain);
    expect(restored.resourceNodes.count).toBe(simulation.state.resourceNodes.count);
    expect(restored.resourceNodes.kind.slice(0, restored.resourceNodes.count)).toEqual(
      simulation.state.resourceNodes.kind.slice(0, simulation.state.resourceNodes.count),
    );
    expect(restored.resourceNodes.chunkHeads.some((nodeId) => nodeId >= 0)).toBe(true);
    expect(restored.territory.villageIds).toEqual(simulation.state.territory.villageIds);
    expect(restored.territory.claimStrength).toEqual(simulation.state.territory.claimStrength);
    expect(restored.territory.planningZoneKinds).toEqual(
      simulation.state.territory.planningZoneKinds,
    );
    expect(restored.territory.dirtyCells).toEqual([]);
    expect(restored.entities.carriedResourceKinds).toEqual(
      simulation.state.entities.carriedResourceKinds,
    );
    expect(encoded).not.toContain('tickHistory');
    expect(encoded).not.toContain('mapVersion":');
    expect(restored.entities.paths.every((path) => path === null)).toBe(true);
  });

  it('fails safely for damaged and unsupported saves', () => {
    expect(() => loadWorldSave('{broken')).toThrow(/存档损坏/);
    expect(() => loadWorldSave(JSON.stringify({ version: 1 }))).toThrow(/存档版本/);
    expect(() => loadWorldSave(JSON.stringify({ version: 999 }))).toThrow(/存档版本/);
  });

  it('strictly validates the persisted world-law state', () => {
    const simulation = createWorldSimulation({ seed: 'world-laws-save', initialHumans: 24 });
    const missingLaw = JSON.parse(serializeWorld(simulation.state));
    delete missingLaw.worldLaws.naturalAnimalReturn;

    expect(() => loadWorldSave(JSON.stringify(missingLaw))).toThrow(/数据校验失败/);

    const invalidLaw = JSON.parse(serializeWorld(simulation.state));
    invalidLaw.worldLaws.civilizationRestart = 'enabled';

    expect(() => loadWorldSave(JSON.stringify(invalidLaw))).toThrow(/数据校验失败/);
  });

  it('strictly rejects V9 and malformed V10 semantic fields', () => {
    const simulation = createWorldSimulation({ seed: 'v10-task-save', initialHumans: 24 });
    simulation.step();
    const valid = JSON.parse(serializeWorld(simulation.state));
    expect(valid.entities.tasks).toHaveLength(simulation.state.entities.count);

    const v9 = { ...valid, version: 9 };
    expect(() => loadWorldSave(JSON.stringify(v9))).toThrow(/存档版本/);

    valid.entities.tasks[0] = { type: 'imaginary-work' };
    expect(() => loadWorldSave(JSON.stringify(valid))).toThrow(/数据校验失败/);

    const invalidVillage = JSON.parse(serializeWorld(simulation.state));
    if (invalidVillage.villages[0]) delete invalidVillage.villages[0].outdoorStockpile;
    else invalidVillage.villages = [{ id: 1 }];
    expect(() => loadWorldSave(JSON.stringify(invalidVillage))).toThrow(/数据校验失败/);

    const invalidTerritory = JSON.parse(serializeWorld(simulation.state));
    invalidTerritory.territory.villageIds.pop();
    expect(() => loadWorldSave(JSON.stringify(invalidTerritory))).toThrow(/地图尺寸不匹配/);
  });

  it('round-trips the durable capital and rejects malformed kingdom observation state', () => {
    const simulation = createWorldSimulation({ seed: 'v10-capital-save', initialHumans: 24 });
    const village = simulation.ensureVillageAt(64, 64, 24);
    village.tier = VillageTier.Hamlet;
    formKingdoms(simulation.state);
    const encoded = serializeWorld(simulation.state);
    const valid = JSON.parse(encoded);
    const kingdom = valid.kingdoms[0];
    expect(kingdom?.capitalVillageId).toBe(village.id);
    expect(loadWorldSave(encoded).kingdoms[0]?.capitalVillageId).toBe(village.id);

    delete kingdom.capitalVillageId;
    expect(() => loadWorldSave(JSON.stringify(valid))).toThrow(/数据校验失败/);
  });

  it('restores every semantic task phase and durable second-batch assignment', () => {
    const phases = ['reserved', 'travel', 'pickup', 'work', 'delivery', 'suspended'] as const;
    for (const phase of phases) {
      const simulation = createWorldSimulation({ seed: `v8-${phase}`, initialHumans: 24 });
      const entityId = 0;
      const village = simulation.ensureVillageAt(
        simulation.state.entities.positionsX[entityId] ?? 64,
        simulation.state.entities.positionsZ[entityId] ?? 64,
        24,
      );
      simulation.state.entities.villageIds[entityId] = village.id;
      const task = beginResidentTask(99, simulation.state.tick, {
        type: 'craft',
        reason: 'village-needs-tools',
        targetKind: 'building',
        targetId: 1,
        targetCell: 32,
        expectedResult: '制作并入库一件工具',
        requiredProgress: 72,
      });
      task.phase = phase;
      task.progress = 31;
      if (phase === 'suspended') task.suspendedUntilTick = 120;
      simulation.state.entities.tasks[entityId] = phase === 'suspended' ? null : task;
      simulation.state.entities.suspendedTasks[entityId] = phase === 'suspended' ? task : null;
      simulation.state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.CraftInputs;
      simulation.state.entities.carriedResources[entityId] = 1;
      simulation.state.entities.homeBuildingIds[entityId] = 3;
      simulation.state.entities.workBuildingIds[entityId] = 4;
      village.constructionPriority = 'production';
      village.outdoorStockpile.wood = 7;

      const restored = loadWorldSave(serializeWorld(simulation.state));
      const restoredTask =
        phase === 'suspended'
          ? restored.entities.suspendedTasks[entityId]
          : restored.entities.tasks[entityId];
      expect(restoredTask).toMatchObject({ phase, progress: 31, targetId: 1 });
      expect(restored.entities.carriedResourceKinds[entityId]).toBe(
        CarriedResourceKind.CraftInputs,
      );
      expect(restored.entities.homeBuildingIds[entityId]).toBe(3);
      expect(restored.entities.workBuildingIds[entityId]).toBe(4);
      expect(restored.villages[0]?.constructionPriority).toBe('production');
      expect(restored.villages[0]?.outdoorStockpile.wood).toBe(7);
      expect(restored.entities.paths[entityId]).toBeNull();
    }
  });
});
