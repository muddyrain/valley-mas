import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import {
  encodeKernelSnapshot,
  restoreSimulationKernel,
} from '@/simulation/persistence/kernelSnapshot';

describe('phase 3 snapshot continuity', () => {
  it('restores life, tasks, reservations, families, inventory and construction deterministically', () => {
    const kernel = createSimulationKernel({ seed: 'phase-3-snapshot', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell ?? 0;
    kernel.enqueue({ type: 'place-humans', sequence: 1, cell, count: 12 });
    kernel.flushCommands();
    kernel.setPaused(false);
    kernel.runTicks(500);

    const checksumBeforeSave = kernel.checksum();
    const restored = restoreSimulationKernel(encodeKernelSnapshot(kernel, 'phase-3-world')).kernel;
    expect(restored.checksum()).toBe(checksumBeforeSave);
    expect(restored.state.civilization).toEqual(kernel.state.civilization);

    kernel.runTicks(200);
    restored.runTicks(200);
    expect(restored.checksum()).toBe(kernel.checksum());
  });
});
