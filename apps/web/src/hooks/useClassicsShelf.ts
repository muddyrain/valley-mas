/**
 * CLR-3：书架与最近阅读 localStorage Hook
 */

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

const RECENT_KEY = 'classics_recent';
const SHELF_KEY = 'classics_shelf';
const RECENT_MAX = 10;

// ---- 最近阅读 ----

export function getRecentBooks(): RecentBook[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentBook[]) : [];
  } catch {
    return [];
  }
}

export function pushRecentBook(book: RecentBook): void {
  try {
    const list = getRecentBooks().filter((b) => b.id !== book.id);
    list.unshift(book); // 最新的排第一
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {}
}

// ---- 书架 ----

export function getShelfIds(): string[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addToShelf(id: string): void {
  try {
    const ids = getShelfIds().filter((i) => i !== id);
    ids.unshift(id);
    localStorage.setItem(SHELF_KEY, JSON.stringify(ids));
  } catch {}
}

export function removeFromShelf(id: string): void {
  try {
    const ids = getShelfIds().filter((i) => i !== id);
    localStorage.setItem(SHELF_KEY, JSON.stringify(ids));
  } catch {}
}

export function isInShelf(id: string): boolean {
  return getShelfIds().includes(id);
}

// ---- CLAI-3：AI 探索记录 ----
// key: classics_ai_explored_{bookId}  value: number[]（chapterIndex 列表）

const aiExploredKey = (bookId: string) => `classics_ai_explored_${bookId}`;

export function getAiExploredChapters(bookId: string): number[] {
  try {
    const raw = localStorage.getItem(aiExploredKey(bookId));
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function markChapterAiExplored(bookId: string, chapterIndex: number): void {
  try {
    const list = getAiExploredChapters(bookId);
    if (!list.includes(chapterIndex)) {
      list.push(chapterIndex);
      localStorage.setItem(aiExploredKey(bookId), JSON.stringify(list));
    }
  } catch {}
}
