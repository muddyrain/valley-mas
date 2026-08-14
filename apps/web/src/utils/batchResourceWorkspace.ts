import type { ResourceVisibility } from '@/api/resource';

const DATABASE_NAME = 'valley-web-batch-resource-workspace';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'workspaces';
const WORKSPACE_KEY_PREFIX = 'resource-import:';

export type BatchResourceAIWorkspaceMetadata = {
  title: string;
  tags: string[];
  modelId: string;
  resourceType: 'wallpaper' | 'avatar';
  fileFingerprint: string;
};

export type BatchResourceWorkspaceItem = {
  file: File;
  base64: string;
  uploadKey: string;
  title: string;
  tags: string[];
  status: 'pending' | 'running' | 'confirming' | 'error';
  error?: string;
  aiMetadata?: BatchResourceAIWorkspaceMetadata;
};

export type BatchResourceWorkspaceSnapshot = {
  version: 1;
  uploadType: 'wallpaper' | 'avatar';
  visibility: ResourceVisibility;
  visionModelId: string;
  updatedAt: number;
  items: BatchResourceWorkspaceItem[];
};

export interface BatchResourceWorkspaceStore {
  load(ownerId: string): Promise<BatchResourceWorkspaceSnapshot | null>;
  save(ownerId: string, snapshot: BatchResourceWorkspaceSnapshot): Promise<void>;
  clear(ownerId: string): Promise<void>;
}

export function getBatchResourceWorkspaceKey(ownerId: string) {
  return `${WORKSPACE_KEY_PREFIX}${ownerId.trim()}`;
}

function isFile(value: unknown): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function normalizeAIWorkspaceMetadata(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const metadata = value as Partial<BatchResourceAIWorkspaceMetadata>;
  if (
    typeof metadata.title !== 'string' ||
    !Array.isArray(metadata.tags) ||
    typeof metadata.modelId !== 'string' ||
    (metadata.resourceType !== 'wallpaper' && metadata.resourceType !== 'avatar') ||
    typeof metadata.fileFingerprint !== 'string'
  ) {
    return undefined;
  }
  return {
    title: metadata.title,
    tags: metadata.tags.filter((tag): tag is string => typeof tag === 'string'),
    modelId: metadata.modelId,
    resourceType: metadata.resourceType,
    fileFingerprint: metadata.fileFingerprint,
  } satisfies BatchResourceAIWorkspaceMetadata;
}

/** Normalizes interrupted requests back to a retryable state and drops completed items. */
export function normalizeBatchResourceWorkspace(
  value: unknown,
): BatchResourceWorkspaceSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<BatchResourceWorkspaceSnapshot>;
  if (snapshot.version !== 1 || !Array.isArray(snapshot.items)) return null;

  const uploadType = snapshot.uploadType === 'avatar' ? 'avatar' : 'wallpaper';
  const visibility: ResourceVisibility = ['private', 'shared', 'public'].includes(
    snapshot.visibility ?? '',
  )
    ? (snapshot.visibility as ResourceVisibility)
    : 'private';
  const items = snapshot.items.flatMap((candidate) => {
    if (!candidate || !isFile(candidate.file) || typeof candidate.uploadKey !== 'string') return [];
    if ((candidate as { status?: string }).status === 'success') return [];
    const status = candidate.status === 'error' ? 'error' : 'pending';
    const aiMetadata = normalizeAIWorkspaceMetadata(candidate.aiMetadata);
    return [
      {
        file: candidate.file,
        base64: typeof candidate.base64 === 'string' ? candidate.base64 : '',
        uploadKey: candidate.uploadKey,
        title: typeof candidate.title === 'string' ? candidate.title : '',
        tags: Array.isArray(candidate.tags)
          ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
        status,
        ...(status === 'error' && typeof candidate.error === 'string'
          ? { error: candidate.error }
          : {}),
        ...(aiMetadata ? { aiMetadata } : {}),
      } satisfies BatchResourceWorkspaceItem,
    ];
  });

  return {
    version: 1,
    uploadType,
    visibility,
    visionModelId: typeof snapshot.visionModelId === 'string' ? snapshot.visionModelId : '',
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : Date.now(),
    items,
  };
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openWorkspaceDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        request.result.createObjectStore(OBJECT_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });
}

async function withWorkspaceStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openWorkspaceDatabase();
  try {
    const store = database.transaction(OBJECT_STORE_NAME, mode).objectStore(OBJECT_STORE_NAME);
    return await requestResult(operation(store));
  } finally {
    database.close();
  }
}

export const batchResourceWorkspaceStore: BatchResourceWorkspaceStore = {
  async load(ownerId) {
    const value = await withWorkspaceStore('readonly', (store) =>
      store.get(getBatchResourceWorkspaceKey(ownerId)),
    );
    return normalizeBatchResourceWorkspace(value);
  },
  async save(ownerId, snapshot) {
    await withWorkspaceStore('readwrite', (store) =>
      store.put(snapshot, getBatchResourceWorkspaceKey(ownerId)),
    );
  },
  async clear(ownerId) {
    await withWorkspaceStore('readwrite', (store) =>
      store.delete(getBatchResourceWorkspaceKey(ownerId)),
    );
  },
};
