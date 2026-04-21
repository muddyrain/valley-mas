import http from '@/utils/request';

// ---- 类型定义 ----

export interface ClassicsBook {
  id: number;
  title: string;
  category: string;
  dynasty: string;
  brief: string;
  coverUrl: string;
  wordCount: number;
  chapterCount: number;
  isPublished: boolean;
  createdAt: string;
  authorNames: string[];
  editions?: ClassicsEdition[];
}

export interface ClassicsEdition {
  id: number;
  bookId: number;
  label: string;
  translator: string;
  publishYear: number;
}

export interface AdminCreateBookReq {
  title: string;
  category: string;
  dynasty?: string;
  brief?: string;
  coverUrl?: string;
  wordCount?: number;
  isPublished?: boolean;
  authorNames?: string[];
  editionLabel: string;
  translator?: string;
  publishYear?: number;
}

export interface AdminUpdateBookReq {
  title?: string;
  category?: string;
  dynasty?: string;
  brief?: string;
  coverUrl?: string;
  wordCount?: number;
  isPublished?: boolean;
}

export interface AdminChapterItem {
  title: string;
  content: string;
}

export interface AdminImportChaptersReq {
  chapters: AdminChapterItem[];
}

export interface AdminImportChaptersResp {
  imported: number;
  totalWords: number;
}

export type AdminClassicsImportJobStatus = 'queued' | 'processing' | 'success' | 'failed';

export interface AdminClassicsImportJob {
  id: number;
  userId: string;
  status: AdminClassicsImportJobStatus;
  stage: string;
  progress: number;
  attempt: number;
  sourceFileName?: string;
  errorMessage?: string;
  createdBookId?: number;
  createdEditionId?: number;
  importedChapters: number;
  totalWords: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreateClassicsImportJobReq {
  title?: string;
  category?: string;
  dynasty?: string;
  brief?: string;
  coverUrl?: string;
  isPublished?: boolean;
  authorNames?: string[];
  editionLabel?: string;
  translator?: string;
  publishYear?: number;
  sourceFileName?: string;
  txtContent: string;
}

// ---- API 函数 ----

export function adminGetClassicsList(params?: {
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  return http.get<unknown, { list: ClassicsBook[]; total: number }>('/admin/classics', { params });
}

export function adminCreateBook(data: AdminCreateBookReq) {
  return http.post<unknown, { id: number; editionId: number }>('/admin/classics', data);
}

export function adminUpdateBook(id: number, data: AdminUpdateBookReq) {
  return http.put<unknown, void>(`/admin/classics/${id}`, data);
}

export function adminDeleteBook(id: number) {
  return http.delete<unknown, void>(`/admin/classics/${id}`);
}

export function adminImportChapters(id: number, editionId: number, data: AdminImportChaptersReq) {
  return http.post<unknown, AdminImportChaptersResp>(
    `/admin/classics/${id}/editions/${editionId}/chapters/import`,
    data,
  );
}

export function adminCreateClassicsImportJob(data: AdminCreateClassicsImportJobReq) {
  return http.post<unknown, AdminClassicsImportJob>('/admin/classics/import-jobs', data);
}

export function adminGetClassicsImportJobs(params?: {
  limit?: number;
  status?: AdminClassicsImportJobStatus;
}) {
  return http.get<unknown, { list: AdminClassicsImportJob[] }>('/admin/classics/import-jobs', {
    params,
  });
}

export function adminGetClassicsImportJob(jobId: number) {
  return http.get<unknown, AdminClassicsImportJob>(`/admin/classics/import-jobs/${jobId}`);
}

export function adminRetryClassicsImportJob(jobId: number) {
  return http.post<unknown, AdminClassicsImportJob>(`/admin/classics/import-jobs/${jobId}/retry`);
}
