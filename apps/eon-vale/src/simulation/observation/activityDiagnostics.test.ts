import { describe, expect, it } from 'vitest';
import { AgentState, EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { beginResidentTask } from '../tasks/residentTasks';
import { deriveGroupActivity } from './activityDiagnostics';

describe('group activity diagnostics', () => {
  it('classifies real task state and exposes sustained multi-person blockers', () => {
    const simulation = createWorldSimulation({ seed: 'activity-diagnostics', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 4);
    const residents = simulation.spawn(EntityKind.Human, 64, 64, 4);
    residents.forEach((entityId) => {
      simulation.state.entities.villageIds[entityId] = village.id;
      simulation.state.entities.states[entityId] = AgentState.FindFood;
      simulation.state.entities.hunger[entityId] = 960;
      simulation.state.entities.tasks[entityId] = beginResidentTask(entityId + 1, 100, {
        type: 'eat',
        reason: 'critical-hunger',
        targetKind: 'building',
        targetId: 1,
        targetCell: 64 * simulation.state.map.size + 64,
        expectedResult: '取得一餐并缓解饥饿',
        requiredProgress: 1,
      });
    });
    simulation.state.tick = 180;

    const diagnostics = deriveGroupActivity(simulation.state, { villageId: village.id });

    expect(diagnostics.total).toBe(4);
    expect(diagnostics.categories.find(({ category }) => category === 'survival')?.count).toBe(4);
    expect(diagnostics.alerts[0]).toMatchObject({
      reason: 'critical-hunger',
      count: 4,
      villageId: village.id,
    });
    expect(diagnostics.alerts[0]?.entityIds).toEqual(residents);
  });

  it('classifies expeditions before generic hauling', () => {
    const simulation = createWorldSimulation({ seed: 'activity-migration', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 1);
    const resident = simulation.spawn(EntityKind.Human, 64, 64)[0] as number;
    simulation.state.entities.villageIds[resident] = village.id;
    simulation.state.entities.expeditionIds[resident] = 7;
    simulation.state.entities.states[resident] = AgentState.Haul;

    const diagnostics = deriveGroupActivity(simulation.state, { villageId: village.id });

    expect(
      diagnostics.categories.find(({ category }) => category === 'migration')?.entityIds,
    ).toEqual([resident]);
  });

  it('includes sustained suspended tasks in multi-resident blocker alerts', () => {
    const simulation = createWorldSimulation({ seed: 'activity-blocked', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 3);
    const residents = simulation.spawn(EntityKind.Human, 64, 64, 3);
    simulation.state.tick = 180;
    residents.forEach((entityId) => {
      simulation.state.entities.villageIds[entityId] = village.id;
      const task = beginResidentTask(entityId + 1, 100, {
        type: 'gather',
        reason: 'village-needs-wood',
        targetKind: 'resource-node',
        targetId: entityId + 1,
        targetCell: 64 * simulation.state.map.size + 64,
        expectedResult: '采集并运回木材',
        requiredProgress: 36,
      });
      task.phase = 'suspended';
      task.suspensionReason = 'danger';
      simulation.state.entities.suspendedTasks[entityId] = task;
    });

    const diagnostics = deriveGroupActivity(simulation.state, { villageId: village.id });

    expect(diagnostics.categories.find(({ category }) => category === 'blocked')?.count).toBe(3);
    expect(diagnostics.alerts[0]).toMatchObject({ reason: 'danger', count: 3 });
  });
});
