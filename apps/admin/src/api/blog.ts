import http from '@/utils/request';

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover?: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  tags?: {
    id: string;
    name: string;
    slug: string;
  }[];
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

// 获取文章列表（管理员）
export function getAdminPosts(params: PostListParams = {}) {
  return http.get('/admin/posts', { params });
}

// 获取文章详情（管理员）
export function getAdminPostDetail(id: string) {
  return http.get(`/admin/posts/${id}`);
}

// 创建文章
export interface CreatePostData {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  cover?: string;
  categoryId: number;
  tagIds?: number[];
  status?: 'draft' | 'published' | 'archived';
  isTop?: boolean;
  publishNow?: boolean;
}

export function createPost(data: CreatePostData) {
  return http.post('/admin/posts', data);
}

// 更新文章
export function updatePost(id: string, data: Partial<CreatePostData>) {
  return http.put(`/admin/posts/${id}`, data);
}

// 删除文章
export function deletePost(id: string) {
  return http.delete(`/admin/posts/${id}`);
}

// 获取分类列表
export function getCategories() {
  return http.get<unknown, Category[]>('/public/categories');
}

// 获取标签列表
export function getTags() {
  return http.get<unknown, Tag[]>('/public/tags');
}
