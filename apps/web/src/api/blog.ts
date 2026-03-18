import request from '@/utils/request';

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
  status?: 'draft' | 'published' | 'archived';
  viewCount: number;
  likeCount: number;
  isTop: boolean;
  publishedAt?: string;
  createdAt: string;
  author?: {
    id: string;
    nickname: string;
    avatar: string;
  };
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

export function getPosts(params: PostListParams = {}) {
  return request.get<unknown, PostListData>('/public/blog/posts', { params });
}

export function getPostDetailById(id: string) {
  return request.get<unknown, PostDetail>(`/public/blog/posts/id/${id}`);
}

export function getCategories() {
  return request.get<unknown, Category[]>('/public/blog/categories');
}

export function getTags() {
  return request.get<unknown, Tag[]>('/public/blog/tags');
}

export function createPost(data: CreatePostData) {
  return request.post<unknown, Post>('/admin/blog/posts', data);
}

export function updatePost(id: string, data: Partial<CreatePostData>) {
  return request.put<unknown, null>(`/admin/blog/posts/${id}`, data);
}

export function deletePost(id: string) {
  return request.delete<unknown, null>(`/admin/blog/posts/${id}`);
}

export function getAdminPosts(params: { page?: number; pageSize?: number; status?: string } = {}) {
  return request.get<unknown, PostListData>('/admin/blog/posts', { params });
}
