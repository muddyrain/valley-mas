import { describe, expect, it } from 'vitest';
import { createSimulationKernel } from '@/simulation/kernel/kernel';
import {
  decodeKernelSnapshot,
  encodeKernelSnapshot,
  restoreSimulationKernel,
} from '@/simulation/persistence/kernelSnapshot';

describe('phase 2 strict kernel snapshots', () => {
  it('persists authority only and rejects legacy or extended schemas', () => {
    const kernel = createSimulationKernel({ seed: 'strict-snapshot', size: 128 });
    kernel.setPlaybackRate(8);
    const encoded = encodeKernelSnapshot(kernel, 'world-strict');
    const raw = JSON.parse(encoded) as Record<string, unknown>;

    expect(raw).toMatchObject({
      format: 'eon-vale.kernel-snapshot',
      version: 1,
      worldId: 'world-strict',
    });
    expect(raw).not.toHaveProperty('playbackRate');
    expect(raw).not.toHaveProperty('commands');
    expect(() => decodeKernelSnapshot(JSON.stringify({ version: 13 }))).toThrow();
    expect(() => decodeKernelSnapshot(JSON.stringify({ ...raw, legacy: true }))).toThrow();
  });

  it('restores the same authoritative state with fresh runtime queues and preferences', () => {
    const kernel = createSimulationKernel({ seed: 'restore-snapshot', size: 128 });
    const cell = kernel.state.world.settleability.regions[0]?.centerCell;
    expect(cell).toBeTypeOf('number');
    if (cell === undefined) return;

    kernel.setPaused(false);
    kernel.runTicks(7);
    kernel.enqueue({ type: 'raise-terrain', sequence: 2, cell, amount: 0.75 });
    kernel.flushCommands();
    kernel.setPlaybackRate(8);

    const expectedChecksum = kernel.checksum();
    const restored = restoreSimulationKernel(encodeKernelSnapshot(kernel, 'world-restore'));

    expect(restored.worldId).toBe('world-restore');
    expect(restored.kernel.checksum()).toBe(expectedChecksum);
    expect(restored.kernel.state.tick).toBe(7);
    expect(restored.kernel.state.paused).toBe(false);
    expect(restored.kernel.playbackRate).toBe(1);
    expect(restored.kernel.state.commands).toEqual({ pending: [], records: [], lastSequence: 0 });
    expect(Array.from(restored.kernel.state.world.elevation)).toEqual(
      Array.from(kernel.state.world.elevation),
    );
  });

  it('rejects corrupted checksums and malformed typed-array lengths', () => {
    const kernel = createSimulationKernel({ seed: 'corrupt-snapshot', size: 128 });
    const raw = JSON.parse(encodeKernelSnapshot(kernel, 'world-corrupt')) as {
      checksum: string;
      world: { elevation: number[] };
    };

    raw.world.elevation[0] = (raw.world.elevation[0] ?? 0) + 1;
    expect(() => decodeKernelSnapshot(JSON.stringify(raw))).toThrow(/checksum/i);

    const malformed = JSON.parse(encodeKernelSnapshot(kernel, 'world-malformed')) as {
      world: { elevation: number[] };
    };
    malformed.world.elevation.pop();
    expect(() => decodeKernelSnapshot(JSON.stringify(malformed))).toThrow(/length/i);
  });
});
