import { describe, expect, it } from 'vitest';
import {
  CarriedResourceKind,
  EntityKind,
  ResourceNodeKind,
  ResourceNodeStage,
} from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { advanceTerritoryClaims } from '../territory/territory';
import {
  collectResourceForCarrier,
  depositCarriedResource,
  villageNeedsResource,
} from './resourceLogistics';
import { addResourceNode } from './resourceNodes';

describe('resource logistics', () => {
  it('keeps harvested material on the resident until it reaches village storage', () => {
    const simulation = createWorldSimulation({
      seed: 'real-carry',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const village = simulation.ensureVillageAt(64, 64, 1);
    const resident = simulation.spawn(EntityKind.Human, 64, 64)[0] ?? -1;
    simulation.state.entities.villageIds[resident] = village.id;
    const tree = addResourceNode(simulation.state.resourceNodes, {
      kind: ResourceNodeKind.Tree,
      x: 64.5,
      z: 64.5,
      amount: 6,
      stage: ResourceNodeStage.Mature,
    });
    const stockBefore = village.resources.wood;

    expect(collectResourceForCarrier(simulation.state, resident, tree, 10)).toBe(3);
    expect(village.resources.wood).toBe(stockBefore);
    expect(simulation.state.entities.carriedResourceKinds[resident]).toBe(CarriedResourceKind.Wood);
    expect(simulation.state.entities.carriedResources[resident]).toBe(3);

    expect(depositCarriedResource(simulation.state, resident)).toBe(3);
    expect(village.resources.wood).toBe(stockBefore + 3);
    expect(simulation.state.entities.carriedResources[resident]).toBe(0);
  });

  it('stops routine harvesting when the sustainable village target is satisfied', () => {
    const simulation = createWorldSimulation({ seed: 'demand-gate', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 12);
    village.resources.wood = 20;
    expect(villageNeedsResource(village, ResourceNodeKind.Tree)).toBe(true);
    village.resources.wood = 160;
    expect(villageNeedsResource(village, ResourceNodeKind.Tree)).toBe(false);
  });

  it('records real food deliveries for the next economy update', () => {
    const simulation = createWorldSimulation({ seed: 'food-throughput', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 1);
    const resident = simulation.spawn(EntityKind.Human, 64, 64)[0] ?? -1;
    simulation.state.entities.villageIds[resident] = village.id;
    simulation.state.entities.carriedResourceKinds[resident] = CarriedResourceKind.Food;
    simulation.state.entities.carriedResources[resident] = 3;

    expect(depositCarriedResource(simulation.state, resident)).toBe(3);
    expect(village.foodProducedSinceUpdate).toBe(3);
  });

  it('prevents residents from harvesting another village territory', () => {
    const simulation = createWorldSimulation({
      seed: 'territory-resource-owner',
      initialHumans: 0,
      mapSize: 128,
      preset: 'continent',
    });
    const owner = simulation.ensureVillageAt(58, 64, 12);
    const neighbour = simulation.ensureVillageAt(78, 64, 12);
    advanceTerritoryClaims(simulation.state, { claimStep: 255, decayStep: 255 });
    const ownerCell = simulation.state.territory.villageIds.indexOf(owner.id);
    expect(ownerCell).toBeGreaterThanOrEqual(0);
    const resident = simulation.spawn(EntityKind.Human, 78, 64)[0] ?? -1;
    simulation.state.entities.villageIds[resident] = neighbour.id;
    const tree = addResourceNode(simulation.state.resourceNodes, {
      kind: ResourceNodeKind.Tree,
      x: (ownerCell % simulation.state.map.size) + 0.5,
      z: Math.floor(ownerCell / simulation.state.map.size) + 0.5,
      amount: 6,
      stage: ResourceNodeStage.Mature,
    });

    expect(collectResourceForCarrier(simulation.state, resident, tree, 10)).toBe(0);
    simulation.state.entities.villageIds[resident] = owner.id;
    expect(collectResourceForCarrier(simulation.state, resident, tree, 10)).toBe(3);
  });
});
