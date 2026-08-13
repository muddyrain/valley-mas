import { describe, expect, it } from 'vitest';
import { AgentState, BuildingType, EntityKind, PlanningZoneKind } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import {
  collectVillageWorkHotspots,
  findPreferredPlanningSite,
  paintVillagePlanningZone,
  planningZoneForBuilding,
} from './spatialPlanning';

describe('settlement spatial planning', () => {
  it('paints only cells owned by the selected village and can clear them', () => {
    const simulation = createWorldSimulation({
      seed: 'planning-paint',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const village = simulation.ensureVillageAt(64, 64, 0);
    const center = 64 * simulation.state.map.size + 64;
    simulation.state.map.navigation.cost[center] = 1;
    simulation.state.map.navigation.cost[center + 1] = 1;
    simulation.state.map.navigation.cost[center - 1] = 1;
    simulation.state.territory.villageIds[center] = village.id;
    simulation.state.territory.villageIds[center + 1] = village.id;
    simulation.state.territory.villageIds[center - 1] = village.id + 1;

    expect(
      paintVillagePlanningZone(
        simulation.state,
        village.id,
        PlanningZoneKind.Residential,
        center,
        1,
      ),
    ).toBe(2);
    expect(simulation.state.territory.planningZoneKinds[center]).toBe(PlanningZoneKind.Residential);
    expect(simulation.state.territory.planningZoneKinds[center - 1]).toBe(PlanningZoneKind.None);

    expect(
      paintVillagePlanningZone(simulation.state, village.id, PlanningZoneKind.None, center, 1),
    ).toBe(2);
    expect(simulation.state.territory.planningZoneKinds[center]).toBe(PlanningZoneKind.None);
  });

  it('uses matching zones as a preference without changing building suitability rules', () => {
    const simulation = createWorldSimulation({
      seed: 'planning-site',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const village = simulation.ensureVillageAt(64, 64, 0);
    const plannedCell = 64 * simulation.state.map.size + 70;
    simulation.state.map.navigation.cost[plannedCell] = 1;
    simulation.state.territory.villageIds[plannedCell] = village.id;
    simulation.state.territory.planningZoneKinds[plannedCell] = PlanningZoneKind.Residential;

    expect(planningZoneForBuilding(BuildingType.Home)).toBe(PlanningZoneKind.Residential);
    expect(planningZoneForBuilding(BuildingType.Workshop)).toBe(PlanningZoneKind.Production);
    expect(planningZoneForBuilding(BuildingType.Watchtower)).toBe(PlanningZoneKind.Defense);
    expect(findPreferredPlanningSite(simulation.state, village, BuildingType.Home, [])).toEqual({
      x: 70,
      z: 64,
    });
    expect(
      findPreferredPlanningSite(simulation.state, village, BuildingType.Workshop, []),
    ).toBeNull();
  });

  it('groups active work into readable village hotspots with participant counts', () => {
    const simulation = createWorldSimulation({ seed: 'work-hotspots', initialHumans: 0 });
    const village = simulation.ensureVillageAt(32, 32, 0);
    const residents = simulation.spawn(EntityKind.Human, 35, 34, 4);
    for (const [index, entityId] of residents.entries()) {
      simulation.state.entities.villageIds[entityId] = village.id;
      simulation.state.entities.positionsX[entityId] = 35 + index * 0.2;
      simulation.state.entities.positionsZ[entityId] = 34;
      simulation.state.entities.states[entityId] =
        index < 3 ? AgentState.Build : AgentState.GatherWood;
    }

    expect(collectVillageWorkHotspots(simulation.state, village.id)).toMatchObject([
      { kind: 'construction', count: 3 },
      { kind: 'production', count: 1 },
    ]);
  });
});
