import http, { type RequestConfig } from '@/utils/request';

// ---- 类型定义 ----

export interface ClassicsAuthor {
  id: string;
  name: string;
  dynasty?: string; // 朝代 / 国别
  brief?: string;
}

export interface ClassicsEdition {
  id: string;
  label: string; // 如"人民文学出版社 2008 版"
  translator?: string;
  publishYear?: number;
  isDefault?: boolean;
}

export interface ClassicsBook {
  id: string;
  title: string;
  coverUrl?: string;
  authors: ClassicsAuthor[];
  category: string; // 如 "古典文学" "外国文学" "诗词歌赋"
  dynasty?: string;
  brief?: string;
  wordCount?: number;
  chapterCount?: number;
  editions: ClassicsEdition[];
  tags?: string[];
  createdAt: string;
}

export interface ClassicsChapter {
  index: number;
  title: string;
  content?: string; // 详情页才返回
  wordCount?: number;
}

interface ListResponse<T> {
  list: T[];
  total: number;
}

// ---- API 方法 ----

/** 名著列表 */
export const getClassicsList = (
  params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    category?: string;
    dynasty?: string;
  } = {},
) => {
  const { page = 1, pageSize = 20, keyword, category, dynasty } = params;
  const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (keyword) q.set('keyword', keyword);
  if (category) q.set('category', category);
  if (dynasty) q.set('dynasty', dynasty);
  return http.get<unknown, ListResponse<ClassicsBook>>(`/public/classics?${q.toString()}`);
};

/** 名著详情 */
export const getClassicsDetail = (id: string) => {
  return http.get<unknown, ClassicsBook>(`/public/classics/${id}`);
};

/** 指定版本的章节列表 */
export const getClassicsChapters = (id: string, editionId: string) => {
  return http.get<unknown, ClassicsChapter[]>(
    `/public/classics/${id}/editions/${editionId}/chapters`,
  );
};

/** 单章正文 */
export const getClassicsChapter = (id: string, editionId: string, index: number) => {
  return http.get<unknown, ClassicsChapter>(
    `/public/classics/${id}/editions/${editionId}/chapters/${index}`,
  );
};

// ---- AI 伴读 ----

export interface ClassicsChapterGuide {
  guide: string;
  highlights: string[];
  model?: string;
}

export interface ClassicsAskCitation {
  heading: string;
  quote: string;
}

export interface ClassicsAskResponse {
  answer: string;
  citations?: ClassicsAskCitation[];
  model?: string;
}

/** 章节 AI 导读 */
export const getClassicsChapterGuide = (id: string, editionId: string, index: number) => {
  return http.post<unknown, ClassicsChapterGuide>(
    `/public/classics/${id}/editions/${editionId}/chapters/${index}/ai/guide`,
  );
};

/** 问章节 */
export const askClassicsChapter = (
  id: string,
  editionId: string,
  index: number,
  question: string,
) => {
  return http.post<unknown, ClassicsAskResponse>(
    `/public/classics/${id}/editions/${editionId}/chapters/${index}/ai/ask`,
    { question },
  );
};

// ---- 用户书架（登录态）----

export interface ClassicsShelfResponse {
  bookIds: string[];
}

export const getMyClassicsShelf = (config?: RequestConfig) => {
  return http.get<unknown, ClassicsShelfResponse>('/user/classics/shelf', config);
};

export const addMyClassicsShelf = (bookId: string, config?: RequestConfig) => {
  return http.post<unknown, { bookId: string }>('/user/classics/shelf', { bookId }, config);
};

export const removeMyClassicsShelf = (bookId: string, config?: RequestConfig) => {
  return http.delete<unknown, { bookId: string }>(`/user/classics/shelf/${bookId}`, config);
};

// ---- 用户阅读进度（登录态）----

export interface ClassicsReadProgress {
  bookId: string;
  editionId: string;
  chapterIndex: number;
  chapterTitle?: string;
  savedAt: number;
}

export interface ClassicsProgressListResponse {
  list: ClassicsReadProgress[];
}

export const getMyClassicsProgress = (
  params: { bookId?: string; bookIds?: string[] } = {},
  config?: RequestConfig,
) => {
  const q = new URLSearchParams();
  if (params.bookId) q.set('bookId', params.bookId);
  if (params.bookIds && params.bookIds.length > 0) q.set('bookIds', params.bookIds.join(','));
  const query = q.toString();
  return http.get<unknown, ClassicsProgressListResponse>(
    `/user/classics/progress${query ? `?${query}` : ''}`,
    config,
  );
};

export const saveMyClassicsProgress = (
  progress: Omit<ClassicsReadProgress, 'savedAt'> & { savedAt?: number },
  config?: RequestConfig,
) => {
  return http.post<unknown, ClassicsReadProgress>('/user/classics/progress', progress, config);
};

// ---- 用户最近阅读（登录态）----

export interface ClassicsRecentItem {
  bookId: string;
  title: string;
  coverUrl?: string;
  authorNames: string;
  dynasty?: string;
  editionId: string;
  chapterIndex: number;
  chapterTitle?: string;
  savedAt: number;
}

export interface ClassicsRecentListResponse {
  list: ClassicsRecentItem[];
}

export const getMyClassicsRecent = (params: { limit?: number } = {}, config?: RequestConfig) => {
  const q = new URLSearchParams();
  if (params.limit != null) q.set('limit', String(params.limit));
  const query = q.toString();
  return http.get<unknown, ClassicsRecentListResponse>(
    `/user/classics/recent${query ? `?${query}` : ''}`,
    config,
  );
};

export const saveMyClassicsRecent = (
  recent: Omit<ClassicsRecentItem, 'title' | 'coverUrl' | 'authorNames' | 'dynasty'>,
  config?: RequestConfig,
) => {
  return http.post<unknown, ClassicsRecentItem>('/user/classics/recent', recent, config);
};

// ---- 用户 AI 探索记录（登录态）----

export interface ClassicsAiExploredItem {
  bookId: string;
  chapterIndexes: number[];
}

export interface ClassicsAiExploredListResponse {
  list: ClassicsAiExploredItem[];
}

export const getMyClassicsAiExplored = (
  params: { bookId?: string; bookIds?: string[] } = {},
  config?: RequestConfig,
) => {
  const q = new URLSearchParams();
  if (params.bookId) q.set('bookId', params.bookId);
  if (params.bookIds && params.bookIds.length > 0) q.set('bookIds', params.bookIds.join(','));
  const query = q.toString();
  return http.get<unknown, ClassicsAiExploredListResponse>(
    `/user/classics/ai-explored${query ? `?${query}` : ''}`,
    config,
  );
};

export const saveMyClassicsAiExplored = (
  payload: { bookId: string; chapterIndex: number; savedAt?: number },
  config?: RequestConfig,
) => {
  return http.post<unknown, { bookId: string; chapterIndex: number; savedAt: number }>(
    '/user/classics/ai-explored',
    payload,
    config,
  );
};
