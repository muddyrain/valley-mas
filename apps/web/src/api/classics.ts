import http from '@/utils/request';

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
