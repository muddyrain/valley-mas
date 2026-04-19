import request, { type RequestConfig } from '@/utils/request';

export type PostType = 'blog' | 'image_text';
export type Visibility = 'private' | 'shared' | 'public';
export type GroupType = PostType;

export interface ImageTextPage {
  imageUrl?: string;
  imageKey?: string;
  text?: string;
  highlightText?: string;
  highlightStart?: number;
  highlightEnd?: number;
  fontSize?: number;
  highlightFontSize?: number;
  textStyles?: Array<{
    start?: number;
    end?: number;
    fontSize?: number;
  }>;
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
  groupType?: GroupType;
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

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

export interface PostCommentListData {
  list: PostComment[];
  total: number;
  postType: PostType;
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
  sort?: 'newest' | 'oldest';
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

export interface BlogAIExcerptResponse {
  excerpt: string;
  model?: string;
}

export interface BlogAICoverResponse {
  prompt?: string;
  imageBase64?: string;
  imageUrl?: string;
  mimeType?: string;
  size?: string;
  model?: string;
}

export interface BlogReaderGuideResponse {
  guide: string;
  highlights: string[];
  path: string;
  model?: string;
}

export interface BlogAskCitation {
  heading: string;
  quote: string;
}

export interface BlogAskResponse {
  answer: string;
  citations?: BlogAskCitation[];
  model?: string;
}

export interface BlogRecommendItem {
  postId: string;
  title: string;
  excerpt: string;
  groupName?: string;
  readMinutes: number;
  reason: string;
}

export interface BlogRecommendResponse {
  items: BlogRecommendItem[];
  model?: string;
}

export function getPosts(params: PostListParams = {}) {
  return request.get<unknown, PostListData>('/public/blog/posts', { params });
}

export function getPostDetailById(id: string, config?: RequestConfig) {
  return request.get<unknown, PostDetail>(`/public/blog/posts/id/${id}`, config);
}

export function getPostComments(id: string, config?: RequestConfig) {
  return request.get<unknown, PostCommentListData>(`/public/blog/posts/id/${id}/comments`, config);
}

export function getAdminPostDetail(id: string, config?: RequestConfig) {
  return request.get<unknown, PostDetail>(`/admin/blog/posts/${id}`, config);
}

export function createPostComment(id: string, data: { content: string }) {
  return request.post<unknown, PostComment>(`/blog/posts/${id}/comments`, data);
}

export function deletePostComment(commentId: string) {
  return request.delete<unknown, { deleted: boolean }>(`/blog/comments/${commentId}`);
}

export function getCategories() {
  return request.get<unknown, Category[]>('/public/blog/categories');
}

export function getGroups(params: { authorId?: string; groupType?: GroupType } = {}) {
  return request.get<unknown, Group[]>('/public/blog/groups', { params });
}

export function getTags() {
  return request.get<unknown, Tag[]>('/public/blog/tags');
}

export function createPost(data: CreatePostData) {
  return request.post<unknown, Post>('/admin/blog/posts', data);
}

export function uploadImageTextAsset(formData: FormData) {
  return request.post<
    unknown,
    {
      url: string;
      key: string;
      fileName: string;
      size: number;
      width: number;
      height: number;
    }
  >('/admin/blog/image-text/assets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

export function uploadBlogCoverByUrl(data: { url: string }) {
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
  >('/admin/blog/cover/upload-by-url', data);
}

export function generateBlogExcerpt(data: { title?: string; content: string }) {
  return request.post<unknown, BlogAIExcerptResponse>('/admin/blog/ai/excerpt', data);
}

export function generateBlogCover(data: { title?: string; excerpt?: string; content: string }) {
  return request.post<unknown, BlogAICoverResponse>('/admin/blog/ai/cover', data);
}

export function generateBlogReaderGuide(postId: string) {
  return request.post<unknown, BlogReaderGuideResponse>(
    `/public/blog/posts/id/${postId}/ai/guide`,
    {},
  );
}

export function askBlogPost(postId: string, data: { question: string }) {
  return request.post<unknown, BlogAskResponse>(`/public/blog/posts/id/${postId}/ai/ask`, data);
}

export function recommendBlogPosts(data: {
  prompt: string;
  groupId?: string;
  keyword?: string;
  sort?: 'newest' | 'oldest';
}) {
  return request.post<unknown, BlogRecommendResponse>('/public/blog/ai/recommend', data);
}

export function updatePost(id: string, data: Partial<CreatePostData>) {
  return request.put<unknown, null>(`/admin/blog/posts/${id}`, data);
}

export function deletePost(id: string) {
  return request.delete<unknown, null>(`/admin/blog/posts/${id}`);
}

export function getAdminPosts(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    postType?: PostType;
    groupId?: string;
  } = {},
) {
  return request.get<unknown, PostListData>('/admin/blog/posts', { params });
}

export function getAdminGroups(params: { groupType?: GroupType } = {}) {
  return request.get<unknown, Group[]>('/admin/blog/groups', { params });
}

export function createGroup(data: {
  name: string;
  groupType?: GroupType;
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
    groupType?: GroupType;
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
