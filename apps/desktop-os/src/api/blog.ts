import { ApiError, type ApiResponse, apiRequest, getApiBaseUrl } from './client';

export type BlogPostSort = 'newest' | 'oldest';
export type BlogPostType = 'blog' | 'image_text';
export type BlogVisibility = 'private' | 'shared' | 'public';

export interface BlogAuthor {
  id: string;
  nickname: string;
  avatar?: string;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  postCount?: number;
}

export interface BlogGroup {
  id: string;
  name: string;
  slug?: string;
  groupType?: BlogPostType;
  description?: string;
  authorId?: string;
  parentId?: string;
  sortOrder?: number;
  postCount?: number;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug?: string;
  postType: BlogPostType;
  visibility?: BlogVisibility;
  excerpt?: string;
  cover?: string;
  coverStorageKey?: string;
  groupId?: string;
  group?: BlogGroup;
  categoryId?: string;
  category?: BlogCategory;
  tags?: BlogTag[];
  status?: 'draft' | 'published' | 'archived';
  author?: BlogAuthor;
  viewCount: number;
  likeCount: number;
  isTop: boolean;
  sortOrder?: number;
  groupSortOrder?: number;
  publishedAt?: string;
  createdAt: string;
}

export interface BlogPostDetail extends BlogPost {
  content: string;
  htmlContent?: string;
  prevPost?: BlogPost;
  nextPost?: BlogPost;
}

export interface BlogPostListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupId?: string;
  category?: string;
  tag?: string;
  sort?: BlogPostSort;
}

export interface BlogPostListResponse {
  list: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateBlogPostInput {
  title: string;
  postType?: BlogPostType;
  visibility?: BlogVisibility;
  content: string;
  excerpt?: string;
  cover?: string;
  coverStorageKey?: string;
  groupId?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: 'draft' | 'published' | 'archived';
  isTop?: boolean;
  publishNow?: boolean;
}

export interface BlogCoverUploadResponse {
  url: string;
  storageKey: string;
  fileName: string;
  size: number;
  width: number;
  height: number;
  extension: string;
  contentType: string;
}

export function listBlogPosts(params: BlogPostListParams = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 12),
    postType: 'blog',
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.groupId) query.set('groupId', params.groupId);
  if (params.category) query.set('category', params.category);
  if (params.tag) query.set('tag', params.tag);
  if (params.sort) query.set('sort', params.sort);
  return apiRequest<BlogPostListResponse>(`/public/blog/posts?${query.toString()}`);
}

export function getBlogPostDetail(id: string) {
  return apiRequest<BlogPostDetail>(`/public/blog/posts/id/${id}`);
}

export function listBlogGroups() {
  return apiRequest<BlogGroup[]>('/public/blog/groups?groupType=blog');
}

export function listBlogCategories() {
  return apiRequest<BlogCategory[]>('/public/blog/categories');
}

export function listBlogTags() {
  return apiRequest<BlogTag[]>('/public/blog/tags');
}

export function createBlogPost(input: CreateBlogPostInput, token: string) {
  return apiRequest<BlogPost>('/admin/blog/posts', {
    method: 'POST',
    body: input,
    token,
  });
}

export async function uploadBlogCover(file: File, token: string) {
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/admin/blog/cover/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: formData,
    });
  } catch {
    throw new ApiError('无法连接到服务器');
  }

  let payload: Partial<ApiResponse<BlogCoverUploadResponse>> | null = null;
  try {
    payload = (await response.json()) as Partial<ApiResponse<BlogCoverUploadResponse>>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || '封面上传失败', response.status);
  }
  if (payload?.code !== 0) {
    throw new ApiError(payload?.message || '封面上传失败', payload?.code);
  }
  return payload.data as BlogCoverUploadResponse;
}
