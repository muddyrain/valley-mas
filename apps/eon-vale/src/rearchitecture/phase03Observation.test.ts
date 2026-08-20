import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import {
  projectKernelInspection,
  projectKernelSnapshot,
} from '@/worker/kernelCompatibilityProjection';

describe('phase 3 life observation contracts', () => {
  it('projects the same resident and settlement facts into render and inspection views', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-observation', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 1 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(45);

    const snapshot = projectKernelSnapshot(kernel, { tickMs: 0, averageTickMs: 0 });
    const inspection = projectKernelInspection(kernel, 'entity', 0);
    const villageInspection = projectKernelInspection(kernel, 'village', 1);
    const buildingFact = kernel.state.civilization.buildings[0];
    const buildingInspection = projectKernelInspection(kernel, 'building', buildingFact?.id ?? -1);
    expect(snapshot.population).toBe(1);
    expect(snapshot.stats).toMatchObject({ humans: 1, villages: 1 });
    expect(snapshot.positionsX[0]).toBe(
      ((kernel.state.civilization.life[0]?.cell ?? 0) % 128) + 0.5,
    );
    expect(inspection).toMatchObject({
      type: 'entity',
      id: 0,
      lifeId: 0,
      name: kernel.state.civilization.life[0]?.name,
      villageName: kernel.state.civilization.settlements[0]?.name,
    });
    expect(villageInspection).toMatchObject({
      type: 'village',
      village: {
        id: snapshot.villages[0]?.id,
        population: snapshot.villages[0]?.population,
        resources: snapshot.villages[0]?.resources,
      },
      completedBuildings: 3,
    });
    expect(buildingInspection).toMatchObject({
      type: 'building',
      id: buildingFact?.id,
      building: snapshot.buildings.find((building) => building.id === buildingFact?.id),
      villageName: kernel.state.civilization.settlements[0]?.name,
    });
  });
});
