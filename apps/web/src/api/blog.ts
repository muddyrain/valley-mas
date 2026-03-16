import request from '@/utils/request';

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
}

export interface PostListResponse {
  code: number;
  message: string;
  data: Post[];
  total: number;
  page: number;
  pageSize: number;
}

// 获取文章列表
export function getPosts(params: PostListParams = {}): Promise<PostListResponse> {
  return request.get('/public/blog/posts', { params });
}

// 获取文章详情
export function getPostDetail(
  slug: string,
): Promise<{ code: number; message: string; data: PostDetail }> {
  return request.get(`/public/blog/posts/${slug}`);
}

// 获取分类列表
export function getCategories(): Promise<{
  code: number;
  message: string;
  data: Category[];
}> {
  return request.get('/public/blog/categories');
}

// 获取标签列表
export function getTags(): Promise<{
  code: number;
  message: string;
  data: Tag[];
}> {
  return request.get('/public/blog/tags');
}

// ========== 管理员接口 ==========

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

// 创建文章（管理员）
export function createPost(
  data: CreatePostData,
): Promise<{ code: number; message: string; data: Post }> {
  return request.post('/admin/posts', data);
}

// 更新文章（管理员）
export function updatePost(
  id: string,
  data: Partial<CreatePostData>,
): Promise<{ code: number; message: string }> {
  return request.put(`/admin/posts/${id}`, data);
}

// 删除文章（管理员）
export function deletePost(id: string): Promise<{ code: number; message: string }> {
  return request.delete(`/admin/posts/${id}`);
}

// 获取文章列表（管理员，包含草稿）
export function getAdminPosts(
  params: { page?: number; pageSize?: number; status?: string } = {},
): Promise<PostListResponse> {
  return request.get('/admin/posts', { params });
}
