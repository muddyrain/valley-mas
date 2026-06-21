import { apiRequest } from './client';

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
