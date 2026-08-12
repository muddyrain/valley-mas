import { describe, expect, it } from 'vitest';
import { createMemorySaveStorage, createSaveRepository } from './saveSlots';

describe('save repository', () => {
  it('keeps three manual slots and rotates exactly three autosaves', async () => {
    const repository = createSaveRepository(createMemorySaveStorage());
    await repository.writeManual(1, 'manual-one', { seed: 'M1', year: 4, population: 33 });
    await repository.writeManual(3, 'manual-three', { seed: 'M3', year: 8, population: 71 });
    await repository.writeAuto('auto-one', { seed: 'A1', year: 1, population: 10 });
    await repository.writeAuto('auto-two', { seed: 'A2', year: 2, population: 20 });
    await repository.writeAuto('auto-three', { seed: 'A3', year: 3, population: 30 });
    await repository.writeAuto('auto-four', { seed: 'A4', year: 4, population: 40 });

    expect((await repository.readManual(1))?.encoded).toBe('manual-one');
    expect(await repository.readManual(2)).toBeNull();
    expect((await repository.readManual(3))?.encoded).toBe('manual-three');
    expect((await repository.listAutos()).map((save) => save.encoded)).toEqual([
      'auto-four',
      'auto-three',
      'auto-two',
    ]);
  });

  it('uses a pending key so a failed write does not replace the last valid slot', async () => {
    const storage = createMemorySaveStorage();
    const repository = createSaveRepository(storage);
    await repository.writeManual(1, 'stable', { seed: 'stable', year: 1, population: 1 });
    storage.failNextWrite();

    await expect(
      repository.writeManual(1, 'broken', { seed: 'broken', year: 2, population: 2 }),
    ).rejects.toThrow();
    expect((await repository.readManual(1))?.encoded).toBe('stable');
  });

  it('keeps V6 slots isolated from pre-release V3 saves', async () => {
    const storage = createMemorySaveStorage();
    storage.setItem(
      'eon-vale.world.v3.manual.1',
      JSON.stringify({
        encoded: 'legacy-v3',
        summary: { seed: 'legacy', year: 9, population: 99 },
        savedAt: 1,
      }),
    );

    const repository = createSaveRepository(storage);
    expect(await repository.readManual(1)).toBeNull();
  });
});
