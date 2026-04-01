import request from '@/utils/request';

export type PostType = 'blog' | 'image_text';
export type Visibility = 'private' | 'shared' | 'public';

export interface ImageTextPage {
  imageUrl?: string;
  text?: string;
}

export interface ImageTextData {
  templateKey?: string;
  partner?: string;
  stickerEmoji?: string;
  images?: string[];
  pages?: ImageTextPage[];
  generatedAt?: string;
}

export interface PostCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PostGroup {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  authorId: string;
  parentId?: string;
  sortOrder?: number;
  postCount?: number;
}

export interface PostTag {
  id: string;
  name: string;
  slug: string;
}

export interface Post {
  id: string;
  title: string;
  slug?: string;
  postType: PostType;
  visibility?: Visibility;
  templateKey?: string;
  templateData?: string;
  imageTextData?: string;
  excerpt: string;
  cover?: string;
  coverStorageKey?: string;
  groupId: string;
  group?: PostGroup;
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
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  postCount: number;
}

export type Group = PostGroup;

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export interface PostListParams {
  page?: number;
  pageSize?: number;
  groupId?: string;
  category?: string;
  tag?: string;
  keyword?: string;
  postType?: PostType;
}

export interface PostListData {
  list: Post[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreatePostData {
  title: string;
  postType?: PostType;
  visibility?: Visibility;
  templateKey?: string;
  templateData?: string;
  imageTextData?: ImageTextData;
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

export function getPosts(params: PostListParams = {}) {
  return request.get<unknown, PostListData>('/public/blog/posts', { params });
}

export function getPostDetailById(id: string) {
  return request.get<unknown, PostDetail>(`/public/blog/posts/id/${id}`);
}

export function getAdminPostDetail(id: string) {
  return request.get<unknown, PostDetail>(`/admin/blog/posts/${id}`);
}

export function getCategories() {
  return request.get<unknown, Category[]>('/public/blog/categories');
}

export function getGroups(params: { authorId?: string } = {}) {
  return request.get<unknown, Group[]>('/public/blog/groups', { params });
}

export function getTags() {
  return request.get<unknown, Tag[]>('/public/blog/tags');
}

export function createPost(data: CreatePostData) {
  return request.post<unknown, Post>('/admin/blog/posts', data);
}

export function uploadBlogCover(formData: FormData) {
  return request.post<
    unknown,
    {
      url: string;
      storageKey: string;
      fileName: string;
      size: number;
      width: number;
      height: number;
    }
  >('/admin/blog/cover/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function updatePost(id: string, data: Partial<CreatePostData>) {
  return request.put<unknown, null>(`/admin/blog/posts/${id}`, data);
}

export function deletePost(id: string) {
  return request.delete<unknown, null>(`/admin/blog/posts/${id}`);
}

export function getAdminPosts(
  params: { page?: number; pageSize?: number; status?: string; postType?: PostType } = {},
) {
  return request.get<unknown, PostListData>('/admin/blog/posts', { params });
}

export function getAdminGroups() {
  return request.get<unknown, Group[]>('/admin/blog/groups');
}

export function createGroup(data: {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}) {
  return request.post<unknown, Group>('/admin/blog/groups', data);
}

export function updateGroup(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    parentId?: string;
    sortOrder?: number;
  },
) {
  return request.put<unknown, null>(`/admin/blog/groups/${id}`, data);
}

export function deleteGroup(id: string) {
  return request.delete<unknown, null>(`/admin/blog/groups/${id}`);
}
