import http from '@/utils/request';

export interface PostCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PostTag {
  id: string;
  name: string;
  slug: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover?: string;
  categoryId: string;
  category?: PostCategory;
  tags?: PostTag[];
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  likeCount: number;
  isTop: boolean;
  publishedAt?: string;
  createdAt: string;
}

export interface PostDetail extends Post {
  content: string;
  htmlContent: string;
  author?: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  postCount: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export interface PostListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  keyword?: string;
  status?: string;
}

export interface PostListData {
  list: Post[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePostData {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  cover?: string;
  categoryId: string;
  tagIds?: string[];
  status?: 'draft' | 'published' | 'archived';
  isTop?: boolean;
  publishNow?: boolean;
}

export function getAdminPosts(params: PostListParams = {}) {
  return http.get<unknown, PostListData>('/admin/blog/posts', { params });
}

export function getAdminPostDetail(id: string) {
  return http.get<unknown, PostDetail>(`/admin/blog/posts/${id}`);
}

export function createPost(data: CreatePostData) {
  return http.post<unknown, Post>('/admin/blog/posts', data);
}

export function updatePost(id: string, data: Partial<CreatePostData>) {
  return http.put<unknown, null>(`/admin/blog/posts/${id}`, data);
}

export function deletePost(id: string) {
  return http.delete<unknown, null>(`/admin/blog/posts/${id}`);
}

export function getCategories() {
  return http.get<unknown, Category[]>('/public/blog/categories');
}

export function getTags() {
  return http.get<unknown, Tag[]>('/public/blog/tags');
}
