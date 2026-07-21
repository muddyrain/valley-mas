import type { AdminListParams, AdminListResponse } from '@/types/api';
import http from '@/utils/request';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
  postCount: number;
  createdAt: string;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  createdAt: string;
}

export interface BlogGroup {
  id: string;
  name: string;
  slug: string;
  groupType: 'blog' | 'image_text';
  description?: string;
  sortOrder: number;
  postCount: number;
  createdAt: string;
}

export interface BlogComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { id: string; nickname?: string; username?: string; avatar?: string };
  post?: { id: string; title: string; postType: string };
}

export interface GuestbookMessage {
  id: string;
  userId?: string;
  nickname: string;
  avatar?: string;
  content: string;
  status: 'approved' | 'hidden' | 'rejected';
  isPinned: boolean;
  clientIp?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ResourceTagStat {
  name: string;
  resourceCount: number;
}

export interface UserNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  extraData?: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  logId: string;
  method: string;
  path: string;
  query?: string;
  status: number;
  latencyMs: number;
  ip: string;
  userAgent?: string;
  userId?: string;
  userRole?: string;
  level: string;
  message: string;
  createdAt: string;
}

export interface CodeAccessLog {
  id: string;
  code: string;
  ip: string;
  userAgent?: string;
  createdAt: string;
}

export interface StorageAsset {
  id: string;
  kind: 'resource' | 'avatar' | 'blog-cover';
  source: string;
  ownerId?: string;
  url: string;
  storageKey?: string;
  status?: string;
  referenced: boolean;
  referenceCount: number;
  risk?: string;
  createdAt: string;
}

export interface AdminAIUsageLog {
  id: string;
  feature: string;
  provider: string;
  model?: string;
  userId?: string;
  status: 'success' | 'failed';
  stream: boolean;
  promptChars: number;
  responseChars: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  errorMessage?: string;
  createdAt: string;
}

export interface AdminAIUsageSummary {
  calls: number;
  failures: number;
  failureRate: number;
  promptChars: number;
  responseChars: number;
  totalTokens: number;
  avgLatencyMs: number;
  features: Array<{
    feature: string;
    calls: number;
    failures: number;
    failureRate: number;
    promptChars: number;
    responseChars: number;
    totalTokens: number;
    avgLatencyMs: number;
  }>;
}

export type AIModelCapability = 'text' | 'vision' | 'image_generation' | 'embedding' | 'tool_call';

export interface AdminAIModel {
  id: string;
  provider: 'siliconflow' | 'amux' | 'ark';
  modelId: string;
  displayName: string;
  capabilities: AIModelCapability[];
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationFavorite {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
  user?: { id: string; nickname?: string; avatar?: string };
  resource?: { id: string; title: string; url: string; type: string };
}

export interface RelationFollow {
  id: string;
  userId: string;
  targetId: string;
  createdAt: string;
  user?: { id: string; nickname?: string; avatar?: string };
}

export interface LifeTraceOpsRecord {
  id: string;
  type: string;
  userId?: string;
  userName?: string;
  title: string;
  status?: string;
  source?: string;
  createdAt: string;
  updatedAt?: string;
  detail: Record<string, unknown>;
}

export interface AdminUserOperations {
  user: {
    id: string;
    nickname?: string;
    username?: string;
    avatar?: string;
    role?: string;
    platform?: string;
    openid?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
    createdAt?: string;
  };
  summary: Record<string, number>;
  downloads: Array<Record<string, unknown>>;
  favorites: Array<Record<string, unknown>>;
  follows: Array<Record<string, unknown>>;
  notifications: UserNotification[];
  comments: BlogComment[];
  guestbookMessages: GuestbookMessage[];
  lifeTrace: Record<string, number>;
}

export interface AdminResourceOperations {
  resource: Record<string, unknown>;
  tags: string[];
  albums: Array<{ id: string; name: string }>;
  downloads: Array<Record<string, unknown>>;
  favorites: Array<Record<string, unknown>>;
  downloadCount: number;
  favoriteCount: number;
}

export interface MindArenaDebate {
  id: string;
  topic: string;
  mode: string;
  status: string;
  personaCount: number;
  currentRound: number;
  lastCompletedRound: number;
  awaitingSupport: boolean;
  personas: Array<{ id: string; name: string; stance?: string }>;
  messages: Array<{
    id: string;
    round: number;
    personaName: string;
    content: string;
    createdAt: string;
  }>;
  result?: {
    winner: string;
    finalAdvice: string;
    quote: string;
    scores: Array<{ persona: string; personaId?: string; score: number }>;
  };
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export function listBlogCategories(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<BlogCategory>>('/admin/blog/categories', { params });
}

export function createBlogCategory(data: Partial<BlogCategory>) {
  return http.post<unknown, BlogCategory>('/admin/blog/categories', data);
}

export function updateBlogCategory(id: string, data: Partial<BlogCategory>) {
  return http.put<unknown, BlogCategory>(`/admin/blog/categories/${id}`, data);
}

export function deleteBlogCategory(id: string) {
  return http.delete<unknown, null>(`/admin/blog/categories/${id}`);
}

export function listBlogTags(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<BlogTag>>('/admin/blog/tags', { params });
}

export function createBlogTag(data: Partial<BlogTag>) {
  return http.post<unknown, BlogTag>('/admin/blog/tags', data);
}

export function updateBlogTag(id: string, data: Partial<BlogTag>) {
  return http.put<unknown, BlogTag>(`/admin/blog/tags/${id}`, data);
}

export function deleteBlogTag(id: string) {
  return http.delete<unknown, null>(`/admin/blog/tags/${id}`);
}

export function listBlogGroups(params: { groupType?: string }) {
  return http.get<unknown, BlogGroup[]>('/admin/blog/groups', { params });
}

export function createBlogGroup(data: Partial<BlogGroup>) {
  return http.post<unknown, BlogGroup>('/admin/blog/groups', data);
}

export function updateBlogGroup(id: string, data: Partial<BlogGroup>) {
  return http.put<unknown, null>(`/admin/blog/groups/${id}`, data);
}

export function deleteBlogGroup(id: string) {
  return http.delete<unknown, null>(`/admin/blog/groups/${id}`);
}

export function listBlogComments(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<BlogComment>>('/admin/blog/comments', { params });
}

export function deleteBlogComment(id: string) {
  return http.delete<unknown, { deleted: boolean }>(`/admin/blog/comments/${id}`);
}

export function listGuestbookMessages(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<GuestbookMessage>>('/admin/guestbook/messages', {
    params,
  });
}

export function updateGuestbookStatus(id: string, status: GuestbookMessage['status']) {
  return http.patch<unknown, GuestbookMessage>(`/admin/guestbook/messages/${id}/status`, {
    status,
  });
}

export function updateGuestbookPin(id: string, isPinned: boolean) {
  return http.patch<unknown, { message: GuestbookMessage }>(`/admin/guestbook/messages/${id}/pin`, {
    isPinned,
  });
}

export function deleteGuestbookMessage(id: string) {
  return http.delete<unknown, { deleted: boolean }>(`/admin/guestbook/messages/${id}`);
}

export function listResourceTagStats(params: { keyword?: string; limit?: number }) {
  return http.get<unknown, AdminListResponse<ResourceTagStat>>('/admin/resource-tags/stats', {
    params,
  });
}

export function listNotifications(params: AdminListParams & { isRead?: string }) {
  return http.get<unknown, AdminListResponse<UserNotification>>('/admin/notifications', { params });
}

export function createNotification(data: Partial<UserNotification>) {
  return http.post<unknown, UserNotification>('/admin/notifications', data);
}

export function updateNotificationReadState(id: string, isRead: boolean) {
  return http.patch<unknown, UserNotification>(`/admin/notifications/${id}/read-state`, {
    isRead,
  });
}

export function listOperationLogs(params: AdminListParams & { level?: string }) {
  return http.get<unknown, AdminListResponse<OperationLog>>('/admin/audit/operation-logs', {
    params,
  });
}

export function listCodeAccessLogs(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<CodeAccessLog>>('/admin/audit/code-access-logs', {
    params,
  });
}

export function listStorageAssets(params: AdminListParams & { kind?: string }) {
  return http.get<unknown, AdminListResponse<StorageAsset>>('/admin/audit/storage-assets', {
    params,
  });
}

export function listAIUsageLogs(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<AdminAIUsageLog>>('/admin/ai/usage-logs', {
    params,
  });
}

export function getAIUsageSummary(params: AdminListParams) {
  return http.get<unknown, AdminAIUsageSummary>('/admin/ai/usage-summary', { params });
}

export function listAIModels(provider?: string) {
  return http.get<unknown, { list: AdminAIModel[] }>('/admin/ai/models', { params: { provider } });
}

export function createAIModel(payload: Omit<AdminAIModel, 'id' | 'createdAt' | 'updatedAt'>) {
  return http.post<unknown, AdminAIModel>('/admin/ai/models', payload);
}

export function updateAIModel(
  id: string,
  payload: Omit<AdminAIModel, 'id' | 'createdAt' | 'updatedAt'>,
) {
  return http.put<unknown, AdminAIModel>(`/admin/ai/models/${id}`, payload);
}

export function testAIModelConnection(payload: Pick<AdminAIModel, 'provider' | 'modelId'>) {
  return http.post<
    unknown,
    { provider: string; modelId: string; available: boolean; latencyMs: number }
  >('/admin/ai/models/test-connection', payload);
}

export function previewAIProviderModels(provider: 'siliconflow' | 'amux') {
  return http.get<unknown, { provider: string; models: string[] }>(
    `/admin/ai/providers/${provider}/models-preview`,
  );
}

export function listFavorites(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<RelationFavorite>>('/admin/relations/favorites', {
    params,
  });
}

export function listFollows(params: AdminListParams) {
  return http.get<unknown, AdminListResponse<RelationFollow>>('/admin/relations/follows', {
    params,
  });
}

export function listLifeTraceOps(path: string, params: AdminListParams) {
  return http.get<unknown, AdminListResponse<LifeTraceOpsRecord>>(`/admin/life-trace/${path}`, {
    params,
  });
}

export function getUserOperations(id: string) {
  return http.get<unknown, AdminUserOperations>(`/admin/users/${id}/operations`);
}

export function getResourceOperations(id: string) {
  return http.get<unknown, AdminResourceOperations>(`/admin/resources/${id}/operations`);
}

export function listMindArenaDebates(params: AdminListParams & { mode?: string }) {
  return http.get<unknown, AdminListResponse<MindArenaDebate>>('/admin/mind-arena/debates', {
    params,
  });
}

export function getMindArenaDebate(id: string) {
  return http.get<unknown, MindArenaDebate>(`/admin/mind-arena/debates/${id}`);
}
