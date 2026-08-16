import { describe, expect, it } from 'vitest';
import { EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from './worldSimulation';

describe('long-journey rations', () => {
  it('feeds a relocating resident from reserved expedition supplies', () => {
    const simulation = createWorldSimulation({ seed: 'rationed-relocation', initialHumans: 0 });
    const origin = simulation.ensureVillageAt(56, 64, 1);
    const destination = simulation.ensureVillageAt(72, 64, 1);
    origin.kingdomId = 1;
    destination.kingdomId = 1;
    const resident = simulation.spawn(EntityKind.Human, origin.x, origin.z)[0] as number;
    simulation.state.entities.villageIds[resident] = origin.id;
    simulation.state.entities.kingdomIds[resident] = 1;
    simulation.state.entities.hunger[resident] = 700;
    simulation.state.expeditions.push({
      id: 1,
      originVillageId: origin.id,
      destinationVillageId: destination.id,
      kingdomId: 1,
      memberIds: [resident],
      targetX: destination.x,
      targetZ: destination.z,
      targetCell: Math.floor(destination.z) * simulation.state.map.size + Math.floor(destination.x),
      startedAtTick: 0,
      supplies: 1,
    });
    simulation.state.entities.expeditionIds[resident] = 1;

    simulation.step();

    expect(simulation.state.expeditions[0]?.supplies).toBe(0);
    expect(simulation.state.entities.hunger[resident]).toBeLessThan(100);
  });
});
