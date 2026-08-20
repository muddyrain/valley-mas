import { describe, expect, it } from 'vitest';
import {
  createMemoryWorldStorage,
  createWorldRepository,
  EON_VALE_DATABASE_NAME,
} from '@/simulation/persistence/worldRepository';

function snapshot(label: string): Blob {
  return new Blob([label], { type: 'application/json' });
}

describe('phase 2 atomic world repository', () => {
  it('uses a new namespace and bounds automatic snapshots per world', async () => {
    expect(EON_VALE_DATABASE_NAME).toBe('eon-vale-kernel-v1');
    const storage = createMemoryWorldStorage();
    const repository = createWorldRepository(storage, {
      now: (() => {
        let time = 100;
        return () => ++time;
      })(),
      createId: (() => {
        let id = 0;
        return () => `snapshot-${++id}`;
      })(),
    });

    await repository.save({
      kind: 'auto',
      worldId: 'world-a',
      snapshot: snapshot('auto-1'),
      checksum: '11111111',
    });
    await repository.save({
      kind: 'auto',
      worldId: 'world-a',
      snapshot: snapshot('auto-2'),
      checksum: '22222222',
    });
    await repository.save({
      kind: 'auto',
      worldId: 'world-a',
      snapshot: snapshot('auto-3'),
      checksum: '33333333',
    });
    await repository.save({
      kind: 'safety',
      worldId: 'world-a',
      snapshot: snapshot('safety-1'),
      checksum: '44444444',
    });
    await repository.save({
      kind: 'safety',
      worldId: 'world-a',
      snapshot: snapshot('safety-2'),
      checksum: '55555555',
    });

    const manifest = await repository.readManifest();
    expect(manifest.worlds['world-a']).toEqual({
      autos: ['snapshot-3', 'snapshot-2'],
      safety: 'snapshot-5',
    });
    expect((await repository.listSnapshots()).map((record) => record.id)).toEqual([
      'snapshot-2',
      'snapshot-3',
      'snapshot-5',
    ]);
  });

  it('commits snapshot and manifest atomically so failed saves preserve the old slot', async () => {
    const storage = createMemoryWorldStorage();
    const repository = createWorldRepository(storage, {
      now: () => 200,
      createId: (() => {
        let id = 0;
        return () => `manual-${++id}`;
      })(),
    });
    await repository.save({
      kind: 'manual',
      manualSlot: 1,
      worldId: 'world-a',
      snapshot: snapshot('old'),
      checksum: 'aaaaaaaa',
    });

    storage.failNextTransaction(new Error('manifest write failed'));
    await expect(
      repository.save({
        kind: 'manual',
        manualSlot: 1,
        worldId: 'world-a',
        snapshot: snapshot('new'),
        checksum: 'bbbbbbbb',
      }),
    ).rejects.toThrow('manifest write failed');

    expect((await repository.readManifest()).manualSlots).toEqual({
      1: 'manual-1',
      2: null,
      3: null,
    });
    expect(await (await repository.loadSnapshot('manual-1'))?.snapshot.text()).toBe('old');
    expect(await repository.loadSnapshot('manual-2')).toBeNull();
  });

  it('cleans safety then oldest auto without touching three manual slots', async () => {
    const storage = createMemoryWorldStorage();
    const repository = createWorldRepository(storage, {
      now: (() => {
        let time = 300;
        return () => ++time;
      })(),
      createId: (() => {
        let id = 0;
        return () => `quota-${++id}`;
      })(),
    });
    for (const manualSlot of [1, 2, 3] as const) {
      await repository.save({
        kind: 'manual',
        manualSlot,
        worldId: 'world-a',
        snapshot: snapshot(`manual-${manualSlot}`),
        checksum: `0000000${manualSlot}`,
      });
    }
    await repository.save({
      kind: 'auto',
      worldId: 'world-a',
      snapshot: snapshot('old-auto'),
      checksum: '00000004',
    });
    await repository.save({
      kind: 'auto',
      worldId: 'world-a',
      snapshot: snapshot('new-auto'),
      checksum: '00000005',
    });
    await repository.save({
      kind: 'safety',
      worldId: 'world-a',
      snapshot: snapshot('safety'),
      checksum: '00000006',
    });

    expect(await repository.cleanupOneForQuota()).toEqual({
      deletedId: 'quota-6',
      kind: 'safety',
    });
    expect(await repository.cleanupOneForQuota()).toEqual({
      deletedId: 'quota-4',
      kind: 'auto',
    });
    expect((await repository.readManifest()).manualSlots).toEqual({
      1: 'quota-1',
      2: 'quota-2',
      3: 'quota-3',
    });
  });

  it('cleans one expendable snapshot and retries a quota-failed save', async () => {
    const storage = createMemoryWorldStorage();
    const repository = createWorldRepository(storage, {
      now: () => 400,
      createId: (() => {
        let id = 0;
        return () => `retry-${++id}`;
      })(),
    });
    await repository.save({
      kind: 'safety',
      worldId: 'world-a',
      snapshot: snapshot('expendable'),
      checksum: '00000001',
    });
    storage.failNextTransaction(new DOMException('storage full', 'QuotaExceededError'));

    await expect(
      repository.save({
        kind: 'auto',
        worldId: 'world-a',
        snapshot: snapshot('retained'),
        checksum: '00000002',
      }),
    ).resolves.toMatchObject({ id: 'retry-2' });

    expect((await repository.readManifest()).worlds['world-a']).toEqual({
      autos: ['retry-2'],
      safety: null,
    });
    expect((await repository.listSnapshots()).map((record) => record.id)).toEqual(['retry-2']);
  });

  it('stores observation metadata outside the snapshot manifest', async () => {
    const repository = createWorldRepository(createMemoryWorldStorage());
    const before = await repository.readManifest();

    await repository.writeObservationMetadata('world-a', {
      cameraX: 12,
      cameraY: 34,
      zoom: 1.5,
    });

    expect(await repository.readObservationMetadata('world-a')).toEqual({
      cameraX: 12,
      cameraY: 34,
      zoom: 1.5,
    });
    expect(await repository.readManifest()).toEqual(before);
  });
});
