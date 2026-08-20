export const EON_VALE_DATABASE_NAME = 'eon-vale-kernel-v1' as const;

export type SnapshotKind = 'manual' | 'auto' | 'safety';
export type ManualSlot = 1 | 2 | 3;

export interface SnapshotRecord {
  id: string;
  worldId: string;
  kind: SnapshotKind;
  manualSlot?: ManualSlot;
  createdAt: number;
  snapshot: Blob;
  byteLength: number;
  checksum: string;
  summary?: SnapshotSummary;
}

export interface SnapshotSummary {
  seed: string;
  tick: number;
  humans: number;
}

export interface WorldSnapshotPointers {
  autos: string[];
  safety: string | null;
}

export interface SnapshotManifest {
  version: 1;
  manualSlots: Record<ManualSlot, string | null>;
  worlds: Record<string, WorldSnapshotPointers>;
}

export interface ObservationMetadata {
  cameraX: number;
  cameraY: number;
  zoom: number;
}

export interface WorldStorageTransaction {
  readManifest(): Promise<SnapshotManifest>;
  writeManifest(manifest: SnapshotManifest): Promise<void>;
  readSnapshot(id: string): Promise<SnapshotRecord | null>;
  listSnapshots(): Promise<SnapshotRecord[]>;
  writeSnapshot(record: SnapshotRecord): Promise<void>;
  deleteSnapshot(id: string): Promise<void>;
  readObservationMetadata(worldId: string): Promise<ObservationMetadata | null>;
  writeObservationMetadata(worldId: string, metadata: ObservationMetadata): Promise<void>;
}

export interface WorldStorage {
  transaction<T>(operation: (transaction: WorldStorageTransaction) => Promise<T>): Promise<T>;
}

export interface MemoryWorldStorage extends WorldStorage {
  failNextTransaction(error: Error): void;
}

export interface SaveSnapshotInput {
  kind: SnapshotKind;
  manualSlot?: ManualSlot;
  worldId: string;
  snapshot: Blob;
  checksum: string;
  summary?: SnapshotSummary;
}

export interface WorldRepositoryOptions {
  now?: () => number;
  createId?: () => string;
}

export interface QuotaCleanupResult {
  deletedId: string;
  kind: 'safety' | 'auto';
}

export interface WorldRepository {
  save(input: SaveSnapshotInput): Promise<SnapshotRecord>;
  readManifest(): Promise<SnapshotManifest>;
  listSnapshots(): Promise<SnapshotRecord[]>;
  loadSnapshot(id: string): Promise<SnapshotRecord | null>;
  cleanupOneForQuota(): Promise<QuotaCleanupResult | null>;
  writeObservationMetadata(worldId: string, metadata: ObservationMetadata): Promise<void>;
  readObservationMetadata(worldId: string): Promise<ObservationMetadata | null>;
}

function createEmptyManifest(): SnapshotManifest {
  return {
    version: 1,
    manualSlots: { 1: null, 2: null, 3: null },
    worlds: {},
  };
}

function cloneManifest(manifest: SnapshotManifest): SnapshotManifest {
  return {
    version: 1,
    manualSlots: { ...manifest.manualSlots },
    worlds: Object.fromEntries(
      Object.entries(manifest.worlds).map(([worldId, pointers]) => [
        worldId,
        { autos: [...pointers.autos], safety: pointers.safety },
      ]),
    ),
  };
}

function cloneSnapshot(record: SnapshotRecord): SnapshotRecord {
  return { ...record };
}

export function createMemoryWorldStorage(): MemoryWorldStorage {
  let manifest = createEmptyManifest();
  let snapshots = new Map<string, SnapshotRecord>();
  let observations = new Map<string, ObservationMetadata>();
  let nextFailure: Error | null = null;

  return {
    failNextTransaction(error) {
      nextFailure = error;
    },
    async transaction(operation) {
      const draftManifest = cloneManifest(manifest);
      const draftSnapshots = new Map(
        [...snapshots].map(([id, record]) => [id, cloneSnapshot(record)]),
      );
      const draftObservations = new Map(
        [...observations].map(([worldId, metadata]) => [worldId, { ...metadata }]),
      );
      let currentManifest = draftManifest;
      const transaction: WorldStorageTransaction = {
        async readManifest() {
          return cloneManifest(currentManifest);
        },
        async writeManifest(nextManifest) {
          currentManifest = cloneManifest(nextManifest);
        },
        async readSnapshot(id) {
          const record = draftSnapshots.get(id);
          return record ? cloneSnapshot(record) : null;
        },
        async listSnapshots() {
          return [...draftSnapshots.values()]
            .sort((left, right) => left.createdAt - right.createdAt)
            .map(cloneSnapshot);
        },
        async writeSnapshot(record) {
          draftSnapshots.set(record.id, cloneSnapshot(record));
        },
        async deleteSnapshot(id) {
          draftSnapshots.delete(id);
        },
        async readObservationMetadata(worldId) {
          const metadata = draftObservations.get(worldId);
          return metadata ? { ...metadata } : null;
        },
        async writeObservationMetadata(worldId, metadata) {
          draftObservations.set(worldId, { ...metadata });
        },
      };
      const result = await operation(transaction);
      if (nextFailure) {
        const failure = nextFailure;
        nextFailure = null;
        throw failure;
      }
      manifest = currentManifest;
      snapshots = draftSnapshots;
      observations = draftObservations;
      return result;
    },
  };
}

function requireManualSlot(input: SaveSnapshotInput): ManualSlot {
  if (input.kind !== 'manual') throw new Error('Manual slot is only valid for manual snapshots');
  if (input.manualSlot !== 1 && input.manualSlot !== 2 && input.manualSlot !== 3) {
    throw new Error('Manual snapshot requires slot 1, 2, or 3');
  }
  return input.manualSlot;
}

function worldPointers(manifest: SnapshotManifest, worldId: string): WorldSnapshotPointers {
  const existing = manifest.worlds[worldId];
  if (existing) return existing;
  const created = { autos: [], safety: null };
  manifest.worlds[worldId] = created;
  return created;
}

function defaultId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `snapshot-${Date.now()}-${Math.random()}`;
}

export function createWorldRepository(
  storage: WorldStorage,
  options: WorldRepositoryOptions = {},
): WorldRepository {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? defaultId;

  const writeRecord = (record: SnapshotRecord): Promise<SnapshotRecord> =>
    storage.transaction(async (transaction) => {
      const manifest = await transaction.readManifest();
      await transaction.writeSnapshot(record);
      if (record.kind === 'manual' && record.manualSlot !== undefined) {
        const replaced = manifest.manualSlots[record.manualSlot];
        manifest.manualSlots[record.manualSlot] = record.id;
        if (replaced) await transaction.deleteSnapshot(replaced);
      } else if (record.kind === 'auto') {
        const pointers = worldPointers(manifest, record.worldId);
        const retained = [record.id, ...pointers.autos].slice(0, 2);
        const removed = pointers.autos.filter((id) => !retained.includes(id));
        pointers.autos = retained;
        for (const id of removed) await transaction.deleteSnapshot(id);
      } else {
        const pointers = worldPointers(manifest, record.worldId);
        const replaced = pointers.safety;
        pointers.safety = record.id;
        if (replaced) await transaction.deleteSnapshot(replaced);
      }
      await transaction.writeManifest(manifest);
      return cloneSnapshot(record);
    });

  const cleanupOneForQuota = (): Promise<QuotaCleanupResult | null> =>
    storage.transaction(async (transaction) => {
      const manifest = await transaction.readManifest();
      const records = await transaction.listSnapshots();
      const byId = new Map(records.map((record) => [record.id, record]));
      const safetyPointers = Object.values(manifest.worlds)
        .map((pointers) => pointers.safety)
        .filter((id): id is string => id !== null)
        .sort(
          (left, right) => (byId.get(left)?.createdAt ?? 0) - (byId.get(right)?.createdAt ?? 0),
        );
      const safetyId = safetyPointers[0];
      if (safetyId) {
        for (const pointers of Object.values(manifest.worlds)) {
          if (pointers.safety === safetyId) pointers.safety = null;
        }
        await transaction.deleteSnapshot(safetyId);
        await transaction.writeManifest(manifest);
        return { deletedId: safetyId, kind: 'safety' };
      }

      const autoIds = Object.values(manifest.worlds)
        .flatMap((pointers) => pointers.autos)
        .sort(
          (left, right) => (byId.get(left)?.createdAt ?? 0) - (byId.get(right)?.createdAt ?? 0),
        );
      const autoId = autoIds[0];
      if (!autoId) return null;
      for (const pointers of Object.values(manifest.worlds)) {
        pointers.autos = pointers.autos.filter((id) => id !== autoId);
      }
      await transaction.deleteSnapshot(autoId);
      await transaction.writeManifest(manifest);
      return { deletedId: autoId, kind: 'auto' };
    });

  return {
    async save(input) {
      if (!input.worldId) throw new Error('Snapshot worldId is required');
      const manualSlot = input.kind === 'manual' ? requireManualSlot(input) : undefined;
      const record: SnapshotRecord = {
        id: createId(),
        worldId: input.worldId,
        kind: input.kind,
        ...(manualSlot === undefined ? {} : { manualSlot }),
        createdAt: now(),
        snapshot: input.snapshot,
        byteLength: input.snapshot.size,
        checksum: input.checksum,
        ...(input.summary ? { summary: { ...input.summary } } : {}),
      };

      try {
        return await writeRecord(record);
      } catch (error) {
        if ((error as { name?: unknown })?.name !== 'QuotaExceededError') throw error;
        const cleaned = await cleanupOneForQuota();
        if (!cleaned) throw error;
        return writeRecord(record);
      }
    },
    readManifest() {
      return storage.transaction((transaction) => transaction.readManifest());
    },
    listSnapshots() {
      return storage.transaction((transaction) => transaction.listSnapshots());
    },
    loadSnapshot(id) {
      return storage.transaction((transaction) => transaction.readSnapshot(id));
    },
    cleanupOneForQuota,
    writeObservationMetadata(worldId, metadata) {
      return storage.transaction((transaction) =>
        transaction.writeObservationMetadata(worldId, metadata),
      );
    },
    readObservationMetadata(worldId) {
      return storage.transaction((transaction) => transaction.readObservationMetadata(worldId));
    },
  };
}
