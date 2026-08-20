import {
  EON_VALE_DATABASE_NAME,
  type ObservationMetadata,
  type SnapshotManifest,
  type SnapshotRecord,
  type WorldStorage,
  type WorldStorageTransaction,
} from './worldRepository';

const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = 'snapshots';
const STATE_STORE = 'state';
const OBSERVATION_STORE = 'observations';
const MANIFEST_KEY = 'manifest';

interface StateRecord {
  key: string;
  value: SnapshotManifest;
}

interface ObservationRecord extends ObservationMetadata {
  worldId: string;
}

function emptyManifest(): SnapshotManifest {
  return {
    version: 1,
    manualSlots: { 1: null, 2: null, 3: null },
    worlds: {},
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionCompletion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException('IndexedDB transaction aborted', 'AbortError'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function openDatabase(indexedDb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(EON_VALE_DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(OBSERVATION_STORE)) {
        database.createObjectStore(OBSERVATION_STORE, { keyPath: 'worldId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

export function createIndexedDbWorldStorage(
  indexedDb: IDBFactory | undefined = globalThis.indexedDB,
): WorldStorage {
  if (!indexedDb) throw new Error('IndexedDB is unavailable');
  let databasePromise: Promise<IDBDatabase> | undefined;
  const database = () => (databasePromise ??= openDatabase(indexedDb));

  return {
    async transaction(operation) {
      const connection = await database();
      const transaction = connection.transaction(
        [SNAPSHOT_STORE, STATE_STORE, OBSERVATION_STORE],
        'readwrite',
      );
      const completion = transactionCompletion(transaction);
      const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
      const stateStore = transaction.objectStore(STATE_STORE);
      const observationStore = transaction.objectStore(OBSERVATION_STORE);
      const storageTransaction: WorldStorageTransaction = {
        async readManifest() {
          const record = (await requestResult(stateStore.get(MANIFEST_KEY))) as
            | StateRecord
            | undefined;
          return record?.value ?? emptyManifest();
        },
        async writeManifest(manifest) {
          await requestResult(stateStore.put({ key: MANIFEST_KEY, value: manifest }));
        },
        async readSnapshot(id) {
          const record = (await requestResult(snapshotStore.get(id))) as SnapshotRecord | undefined;
          return record ?? null;
        },
        async listSnapshots() {
          const records = (await requestResult(snapshotStore.getAll())) as SnapshotRecord[];
          return records.sort((left, right) => left.createdAt - right.createdAt);
        },
        async writeSnapshot(record) {
          await requestResult(snapshotStore.put(record));
        },
        async deleteSnapshot(id) {
          await requestResult(snapshotStore.delete(id));
        },
        async readObservationMetadata(worldId) {
          const record = (await requestResult(observationStore.get(worldId))) as
            | ObservationRecord
            | undefined;
          if (!record) return null;
          return { cameraX: record.cameraX, cameraY: record.cameraY, zoom: record.zoom };
        },
        async writeObservationMetadata(worldId, metadata) {
          await requestResult(observationStore.put({ worldId, ...metadata }));
        },
      };

      try {
        const result = await operation(storageTransaction);
        await completion;
        return result;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // The transaction may already have aborted due to the request failure.
        }
        await completion.catch(() => undefined);
        throw error;
      }
    },
  };
}
