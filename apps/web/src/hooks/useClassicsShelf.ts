/**
 * CLR-3：书架与最近阅读 localStorage Hook
 */

import {
  addMyClassicsShelf,
  type ClassicsReadProgress,
  type ClassicsRecentItem,
  getMyClassicsAiExplored,
  getMyClassicsProgress,
  getMyClassicsRecent,
  getMyClassicsShelf,
  removeMyClassicsShelf,
  saveMyClassicsAiExplored,
  saveMyClassicsProgress,
  saveMyClassicsRecent,
} from '@/api/classics';
import { useAuthStore } from '@/stores/useAuthStore';

export interface RecentBook {
  id: string;
  title: string;
  coverUrl?: string;
  authorNames: string;
  dynasty?: string;
  editionId: string;
  chapterIndex: number;
  chapterTitle?: string;
  savedAt: number;
}

export interface ReadProgress {
  editionId: string;
  chapterIndex: number;
  chapterTitle?: string;
  savedAt: number;
}

const RECENT_KEY = 'classics_recent';
const SHELF_KEY = 'classics_shelf';
const PROGRESS_KEY = (id: string) => `classics_progress_${id}`;
const RECENT_MAX = 10;
const QUIET_REQUEST = { suppressErrorToast: true } as const;

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function dedupeChapterIndexes(chapterIndexes: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const chapterIndex of chapterIndexes) {
    if (!Number.isInteger(chapterIndex) || chapterIndex < 0 || seen.has(chapterIndex)) continue;
    seen.add(chapterIndex);
    result.push(chapterIndex);
  }
  return result.sort((a, b) => a - b);
}

function saveShelfIds(ids: string[]): void {
  try {
    localStorage.setItem(SHELF_KEY, JSON.stringify(dedupeIds(ids)));
  } catch {}
}

function shouldUseCloudShelf(): boolean {
  const auth = useAuthStore.getState();
  return auth.hasHydrated && auth.isAuthenticated && Boolean(auth.user?.id);
}

function toReadProgress(item: ClassicsReadProgress): ReadProgress {
  return {
    editionId: item.editionId,
    chapterIndex: item.chapterIndex,
    chapterTitle: item.chapterTitle,
    savedAt: item.savedAt,
  };
}

function dedupeRecentBooks(books: RecentBook[]): RecentBook[] {
  const seenId = new Set<string>();
  const seenIdentity = new Set<string>();
  const result: RecentBook[] = [];
  const sorted = [...books].sort((a, b) => b.savedAt - a.savedAt);
  for (const item of sorted) {
    const idKey = item.id?.trim();
    const titleKey = item.title?.trim().toLowerCase() ?? '';
    const authorKey = item.authorNames?.trim().toLowerCase() ?? '';
    const dynastyKey = item.dynasty?.trim().toLowerCase() ?? '';
    const identityKey = `${titleKey}::${authorKey}::${dynastyKey}`;

    if (idKey && seenId.has(idKey)) continue;
    if (titleKey && seenIdentity.has(identityKey)) continue;

    if (idKey) seenId.add(idKey);
    if (titleKey) seenIdentity.add(identityKey);
    result.push(item);
  }
  return result;
}

function saveRecentBooks(books: RecentBook[]): void {
  try {
    const normalized = dedupeRecentBooks(books)
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(normalized));
  } catch {}
}

function toRecentBook(item: ClassicsRecentItem): RecentBook {
  return {
    id: item.bookId,
    title: item.title,
    coverUrl: item.coverUrl,
    authorNames: item.authorNames,
    dynasty: item.dynasty,
    editionId: item.editionId,
    chapterIndex: item.chapterIndex,
    chapterTitle: item.chapterTitle,
    savedAt: item.savedAt,
  };
}

function toRecentSavePayload(book: RecentBook) {
  return {
    bookId: book.id,
    editionId: book.editionId,
    chapterIndex: book.chapterIndex,
    chapterTitle: book.chapterTitle,
    savedAt: book.savedAt,
  };
}

// ---- 最近阅读 ----

export function getRecentBooks(): RecentBook[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? dedupeRecentBooks(JSON.parse(raw) as RecentBook[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentBook(book: RecentBook): void {
  try {
    saveRecentBooks([book, ...getRecentBooks()]);
  } catch {}
}

export async function getRecentBooksWithSync(): Promise<RecentBook[]> {
  const localList = getRecentBooks();
  if (!shouldUseCloudShelf()) return localList;

  try {
    const remote = await getMyClassicsRecent({ limit: RECENT_MAX }, QUIET_REQUEST);
    const remoteList = (remote.list ?? []).map(toRecentBook);

    const localMap = new Map<string, RecentBook>();
    const remoteMap = new Map<string, RecentBook>();
    for (const item of localList) localMap.set(item.id, item);
    for (const item of remoteList) remoteMap.set(item.id, item);

    const ids = dedupeIds([
      ...localList.map((item) => item.id),
      ...remoteList.map((item) => item.id),
    ]);
    const mergedMap = new Map<string, RecentBook>();
    const syncTasks: Promise<unknown>[] = [];

    for (const id of ids) {
      const localItem = localMap.get(id);
      const remoteItem = remoteMap.get(id);

      if (localItem && remoteItem) {
        if (localItem.savedAt > remoteItem.savedAt) {
          mergedMap.set(id, localItem);
          syncTasks.push(
            saveMyClassicsRecent(toRecentSavePayload(localItem), QUIET_REQUEST).catch(() => null),
          );
        } else {
          mergedMap.set(id, remoteItem);
        }
      } else if (remoteItem) {
        mergedMap.set(id, remoteItem);
      } else if (localItem) {
        mergedMap.set(id, localItem);
        syncTasks.push(
          saveMyClassicsRecent(toRecentSavePayload(localItem), QUIET_REQUEST).catch(() => null),
        );
      }
    }

    const merged = dedupeRecentBooks(Array.from(mergedMap.values())).slice(0, RECENT_MAX);
    saveRecentBooks(merged);
    if (syncTasks.length > 0) await Promise.all(syncTasks);
    return merged;
  } catch {
    return localList;
  }
}

export async function pushRecentBookWithSync(book: RecentBook): Promise<void> {
  pushRecentBook(book);
  if (!shouldUseCloudShelf()) return;
  try {
    await saveMyClassicsRecent(toRecentSavePayload(book), QUIET_REQUEST);
  } catch {}
}

// ---- 书架 ----

export function getShelfIds(): string[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    return raw ? dedupeIds(JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addToShelf(id: string): void {
  try {
    saveShelfIds([id, ...getShelfIds()]);
  } catch {}
}

export function removeFromShelf(id: string): void {
  try {
    saveShelfIds(getShelfIds().filter((i) => i !== id));
  } catch {}
}

export function isInShelf(id: string): boolean {
  return getShelfIds().includes(id);
}

// 登录态优先云端书架；游客仍走 localStorage
export async function getShelfIdsWithSync(): Promise<string[]> {
  const localIds = getShelfIds();
  if (!shouldUseCloudShelf()) return localIds;

  try {
    const remote = await getMyClassicsShelf(QUIET_REQUEST);
    const remoteIds = dedupeIds(remote.bookIds ?? []);
    const missingOnCloud = localIds.filter((id) => !remoteIds.includes(id));

    if (missingOnCloud.length > 0) {
      await Promise.all(
        missingOnCloud.map(async (id) => {
          try {
            await addMyClassicsShelf(id, QUIET_REQUEST);
          } catch {}
        }),
      );
      const mergedIds = dedupeIds([...localIds, ...remoteIds]);
      saveShelfIds(mergedIds);
      return mergedIds;
    }

    saveShelfIds(remoteIds);
    return remoteIds;
  } catch {
    return localIds;
  }
}

export async function addToShelfWithSync(id: string): Promise<void> {
  addToShelf(id);
  if (!shouldUseCloudShelf()) return;
  try {
    await addMyClassicsShelf(id, QUIET_REQUEST);
  } catch {}
}

export async function removeFromShelfWithSync(id: string): Promise<void> {
  removeFromShelf(id);
  if (!shouldUseCloudShelf()) return;
  try {
    await removeMyClassicsShelf(id, QUIET_REQUEST);
  } catch {}
}

// ---- 阅读进度 ----

export function getProgress(bookId: string): ReadProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(bookId));
    return raw ? (JSON.parse(raw) as ReadProgress) : null;
  } catch {
    return null;
  }
}

export function saveProgress(bookId: string, progress: ReadProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY(bookId), JSON.stringify(progress));
  } catch {}
}

export async function getProgressWithSync(bookId: string): Promise<ReadProgress | null> {
  const localProgress = getProgress(bookId);
  if (!shouldUseCloudShelf()) return localProgress;

  try {
    const remote = await getMyClassicsProgress({ bookId }, QUIET_REQUEST);
    const remoteProgress = remote.list?.[0] ? toReadProgress(remote.list[0]) : null;

    if (remoteProgress && (!localProgress || remoteProgress.savedAt >= localProgress.savedAt)) {
      saveProgress(bookId, remoteProgress);
      return remoteProgress;
    }

    if (localProgress) {
      await saveMyClassicsProgress(
        {
          bookId,
          editionId: localProgress.editionId,
          chapterIndex: localProgress.chapterIndex,
          chapterTitle: localProgress.chapterTitle,
          savedAt: localProgress.savedAt,
        },
        QUIET_REQUEST,
      );
      return localProgress;
    }

    return null;
  } catch {
    return localProgress;
  }
}

export async function getProgressMapWithSync(
  bookIds: string[],
): Promise<Record<string, ReadProgress>> {
  const ids = dedupeIds(bookIds);
  if (ids.length === 0) return {};

  const localMap: Record<string, ReadProgress> = {};
  for (const id of ids) {
    const progress = getProgress(id);
    if (progress) localMap[id] = progress;
  }
  if (!shouldUseCloudShelf()) return localMap;

  try {
    const remote = await getMyClassicsProgress({ bookIds: ids }, QUIET_REQUEST);
    const remoteMap: Record<string, ReadProgress> = {};
    for (const item of remote.list ?? []) {
      remoteMap[item.bookId] = toReadProgress(item);
    }

    const finalMap: Record<string, ReadProgress> = {};
    const syncTasks: Promise<unknown>[] = [];

    for (const id of ids) {
      const localProgress = localMap[id];
      const remoteProgress = remoteMap[id];

      if (localProgress && remoteProgress) {
        if (localProgress.savedAt > remoteProgress.savedAt) {
          finalMap[id] = localProgress;
          syncTasks.push(
            saveMyClassicsProgress(
              {
                bookId: id,
                editionId: localProgress.editionId,
                chapterIndex: localProgress.chapterIndex,
                chapterTitle: localProgress.chapterTitle,
                savedAt: localProgress.savedAt,
              },
              QUIET_REQUEST,
            ).catch(() => null),
          );
        } else {
          finalMap[id] = remoteProgress;
        }
      } else if (remoteProgress) {
        finalMap[id] = remoteProgress;
      } else if (localProgress) {
        finalMap[id] = localProgress;
        syncTasks.push(
          saveMyClassicsProgress(
            {
              bookId: id,
              editionId: localProgress.editionId,
              chapterIndex: localProgress.chapterIndex,
              chapterTitle: localProgress.chapterTitle,
              savedAt: localProgress.savedAt,
            },
            QUIET_REQUEST,
          ).catch(() => null),
        );
      }
    }

    for (const [id, progress] of Object.entries(finalMap)) {
      saveProgress(id, progress);
    }
    if (syncTasks.length > 0) await Promise.all(syncTasks);

    return finalMap;
  } catch {
    return localMap;
  }
}

export async function saveProgressWithSync(bookId: string, progress: ReadProgress): Promise<void> {
  saveProgress(bookId, progress);
  if (!shouldUseCloudShelf()) return;
  try {
    await saveMyClassicsProgress(
      {
        bookId,
        editionId: progress.editionId,
        chapterIndex: progress.chapterIndex,
        chapterTitle: progress.chapterTitle,
        savedAt: progress.savedAt,
      },
      QUIET_REQUEST,
    );
  } catch {}
}

// ---- CLAI-3：AI 探索记录 ----
// key: classics_ai_explored_{bookId}  value: number[]（chapterIndex 列表）

const aiExploredKey = (bookId: string) => `classics_ai_explored_${bookId}`;

function saveAiExploredChapters(bookId: string, chapterIndexes: number[]): void {
  try {
    localStorage.setItem(
      aiExploredKey(bookId),
      JSON.stringify(dedupeChapterIndexes(chapterIndexes)),
    );
  } catch {}
}

export function getAiExploredChapters(bookId: string): number[] {
  try {
    const raw = localStorage.getItem(aiExploredKey(bookId));
    return raw ? dedupeChapterIndexes(JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function markChapterAiExplored(bookId: string, chapterIndex: number): void {
  try {
    saveAiExploredChapters(bookId, [...getAiExploredChapters(bookId), chapterIndex]);
  } catch {}
}

export async function getAiExploredChaptersWithSync(bookId: string): Promise<number[]> {
  const localList = getAiExploredChapters(bookId);
  if (!shouldUseCloudShelf()) return localList;

  try {
    const remote = await getMyClassicsAiExplored({ bookId }, QUIET_REQUEST);
    const remoteList = dedupeChapterIndexes(remote.list?.[0]?.chapterIndexes ?? []);
    const merged = dedupeChapterIndexes([...localList, ...remoteList]);
    saveAiExploredChapters(bookId, merged);

    const remoteSet = new Set<number>(remoteList);
    const missingOnCloud = merged.filter((chapterIndex) => !remoteSet.has(chapterIndex));
    if (missingOnCloud.length > 0) {
      await Promise.all(
        missingOnCloud.map((chapterIndex) =>
          saveMyClassicsAiExplored({ bookId, chapterIndex }, QUIET_REQUEST).catch(() => null),
        ),
      );
    }

    return merged;
  } catch {
    return localList;
  }
}

export async function markChapterAiExploredWithSync(
  bookId: string,
  chapterIndex: number,
): Promise<void> {
  markChapterAiExplored(bookId, chapterIndex);
  if (!shouldUseCloudShelf()) return;
  try {
    await saveMyClassicsAiExplored({ bookId, chapterIndex }, QUIET_REQUEST);
  } catch {}
}
