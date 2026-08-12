export interface SaveStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface SaveSummary {
  seed: string;
  year: number;
  population: number;
}

export interface StoredWorldSave extends SaveSummary {
  encoded: string;
  savedAt: number;
}

interface SaveEnvelope {
  encoded: string;
  summary: SaveSummary;
  savedAt: number;
}

const PREFIX = 'eon-vale.world.v6';
const AUTO_SLOTS = 3;
const MANUAL_SLOTS = 3;

export interface SaveRepository {
  writeManual(slot: 1 | 2 | 3, encoded: string, summary: SaveSummary): Promise<void>;
  readManual(slot: 1 | 2 | 3): Promise<StoredWorldSave | null>;
  listManuals(): Promise<Array<StoredWorldSave | null>>;
  writeAuto(encoded: string, summary: SaveSummary): Promise<void>;
  listAutos(): Promise<StoredWorldSave[]>;
  clearAll(): Promise<void>;
}

function manualKey(slot: number): string {
  return `${PREFIX}.manual.${slot}`;
}

function autoKey(slot: number): string {
  return `${PREFIX}.auto.${slot}`;
}

function pendingKey(key: string): string {
  return `${key}.pending`;
}

function decodeEnvelope(raw: string | null): StoredWorldSave | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as SaveEnvelope;
    if (
      typeof envelope.encoded !== 'string' ||
      typeof envelope.savedAt !== 'number' ||
      typeof envelope.summary?.seed !== 'string'
    ) {
      return null;
    }
    return { encoded: envelope.encoded, savedAt: envelope.savedAt, ...envelope.summary };
  } catch {
    return null;
  }
}

export function createSaveRepository(storage: SaveStorage): SaveRepository {
  let writeSequence = 0;
  const atomicWrite = async (key: string, encoded: string, summary: SaveSummary): Promise<void> => {
    writeSequence += 1;
    const envelope: SaveEnvelope = {
      encoded,
      summary,
      savedAt: Date.now() * 100 + (writeSequence % 100),
    };
    const serialized = JSON.stringify(envelope);
    await storage.setItem(pendingKey(key), serialized);
    try {
      await storage.setItem(key, serialized);
    } finally {
      await storage.removeItem(pendingKey(key));
    }
  };

  return {
    async writeManual(slot, encoded, summary) {
      await atomicWrite(manualKey(slot), encoded, summary);
    },
    async readManual(slot) {
      return decodeEnvelope(await storage.getItem(manualKey(slot)));
    },
    async listManuals() {
      return Promise.all(
        Array.from({ length: MANUAL_SLOTS }, async (_, index) =>
          decodeEnvelope(await storage.getItem(manualKey(index + 1))),
        ),
      );
    },
    async writeAuto(encoded, summary) {
      for (let slot = AUTO_SLOTS; slot >= 2; slot -= 1) {
        const previous = await storage.getItem(autoKey(slot - 1));
        if (previous) await storage.setItem(autoKey(slot), previous);
        else await storage.removeItem(autoKey(slot));
      }
      await atomicWrite(autoKey(1), encoded, summary);
    },
    async listAutos() {
      const saves = await Promise.all(
        Array.from({ length: AUTO_SLOTS }, async (_, index) =>
          decodeEnvelope(await storage.getItem(autoKey(index + 1))),
        ),
      );
      return saves.filter((save): save is StoredWorldSave => save !== null);
    },
    async clearAll() {
      for (let slot = 1; slot <= MANUAL_SLOTS; slot += 1) await storage.removeItem(manualKey(slot));
      for (let slot = 1; slot <= AUTO_SLOTS; slot += 1) await storage.removeItem(autoKey(slot));
    },
  };
}

const DATABASE_NAME = 'eon-vale-saves-v6';
const DATABASE_STORE = 'world-saves';

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('存档数据库操作失败'));
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('存档数据库写入失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('存档数据库写入中止'));
  });
}

export function createIndexedDbSaveStorage(indexedDb: IDBFactory = indexedDB): SaveStorage {
  const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
        request.result.createObjectStore(DATABASE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开世界存档数据库'));
  });

  return {
    async getItem(key) {
      const db = await database;
      const transaction = db.transaction(DATABASE_STORE, 'readonly');
      const value = await waitForRequest(transaction.objectStore(DATABASE_STORE).get(key));
      await waitForTransaction(transaction);
      return typeof value === 'string' ? value : null;
    },
    async setItem(key, value) {
      const db = await database;
      const transaction = db.transaction(DATABASE_STORE, 'readwrite');
      transaction.objectStore(DATABASE_STORE).put(value, key);
      await waitForTransaction(transaction);
    },
    async removeItem(key) {
      const db = await database;
      const transaction = db.transaction(DATABASE_STORE, 'readwrite');
      transaction.objectStore(DATABASE_STORE).delete(key);
      await waitForTransaction(transaction);
    },
  };
}

export function createMemorySaveStorage(): SaveStorage & { failNextWrite(): void } {
  const values = new Map<string, string>();
  let shouldFail = false;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (shouldFail) {
        shouldFail = false;
        throw new Error('storage write failed');
      }
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    failNextWrite: () => {
      shouldFail = true;
    },
  };
}
