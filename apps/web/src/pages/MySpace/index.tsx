import {
  ChevronRight,
  FileText,
  FolderOpen,
  FolderTree,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Post as BlogPost, getAdminPosts } from '@/api/blog';
import { getMyResources, type MyResource } from '@/api/resource';
import { BlogPostCard, ImageTextPostCard } from '@/components/blog';
import HeroSectionTitle from '@/components/page/HeroSectionTitle';
import HeroStatChip from '@/components/page/HeroStatChip';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import UploadResourceDialog from '@/components/UploadResourceDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePageRoleGuard } from '@/hooks/usePageRoleGuard';

const BLOG_PREVIEW_SIZE = 6;
const IMAGE_TEXT_PREVIEW_SIZE = 2;

export default function MySpace() {
  const navigate = useNavigate();
  const { canAccess, user } = usePageRoleGuard({
    allowRoles: ['creator'],
    unauthorizedMessage: '该页面仅创作者可访问',
  });

  // 资源（只取最新 8 条用于预览）
  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 博客/图文：分开请求，博客默认 4 条，图文默认 2 条
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [imageTextPosts, setImageTextPosts] = useState<BlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [imageTextTotal, setImageTextTotal] = useState(0);
  const [loadingBlogPosts, setLoadingBlogPosts] = useState(true);
  const [loadingImageTextPosts, setLoadingImageTextPosts] = useState(true);

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyResources({ pageSize: 8 });
      setResources(data.list || []);
      setTotal(data.total || 0);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      void loadResources();
    }
  }, [canAccess, loadResources]);

  const loadBlogPosts = useCallback(async () => {
    try {
      setLoadingBlogPosts(true);
      const postsData = await getAdminPosts({
        page: 1,
        pageSize: BLOG_PREVIEW_SIZE,
        postType: 'blog',
      });
      setBlogPosts(postsData.list || []);
      setBlogTotal(postsData.total || 0);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoadingBlogPosts(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      void loadBlogPosts();
    }
  }, [canAccess, loadBlogPosts]);

  const loadImageTextPosts = useCallback(async () => {
    try {
      setLoadingImageTextPosts(true);
      const postsData = await getAdminPosts({
        page: 1,
        pageSize: IMAGE_TEXT_PREVIEW_SIZE,
        postType: 'image_text',
      });
      setImageTextPosts(postsData.list || []);
      setImageTextTotal(postsData.total || 0);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoadingImageTextPosts(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      void loadImageTextPosts();
    }
  }, [canAccess, loadImageTextPosts]);

  // ===== 上传相关 =====
  // （逻辑已封装至 UploadResourceDialog 组件）

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        {/* ===== Hero ===== */}
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_88%_20%,rgba(96,165,250,0.18),transparent_22%),radial-gradient(circle_at_80%_72%,rgba(251,191,36,0.1),transparent_28%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <HeroSectionTitle
                eyebrow="CREATOR"
                title="创作者空间"
                description="这里承接你的资源、博客和图文内容，方便继续整理、编辑、发布和回看每一条创作记录。"
                eyebrowClassName="theme-eyebrow text-theme-primary"
                titleClassName="text-[34px] md:text-[40px]"
              />
              <div className="flex flex-wrap gap-3">
                <HeroStatChip icon={<ImageIcon className="text-theme-primary h-4 w-4" />}>
                  共 {total} 项资源
                </HeroStatChip>
                <HeroStatChip icon={<FileText className="h-4 w-4 text-emerald-500" />}>
                  {blogTotal} 篇博客
                </HeroStatChip>
                <HeroStatChip icon={<Sparkles className="h-4 w-4 text-theme-primary" />}>
                  {imageTextTotal} 组图文
                </HeroStatChip>
              </div>
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)] backdrop-blur">
                <div className="flex items-center gap-4">
                  <Avatar className="h-18 w-18 border-4 border-white shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
                    <AvatarImage src={user?.avatar} className="object-cover" />
                    <AvatarFallback className="bg-[linear-gradient(135deg,#f59e0b,#7c3aed)] text-xl font-bold text-white">
                      {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-900">
                      {user?.nickname || user?.username}
                    </div>
                    <div className="mt-1 text-sm leading-7 text-slate-500">
                      继续在这里处理上传后的资源、博客编辑和图文创作，所有内容都会保留自己的管理入口。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => navigate('/my-space/blog-create')}
                className="rounded-[28px] border border-white/80 bg-white/82 p-5 text-left shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(148,163,184,0.12)]"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  博客入口
                </div>
                <div className="text-lg font-semibold text-slate-900">新建博客</div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  继续整理文章内容、摘要与封面。
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/my-space/image-text')}
                className="rounded-[28px] border border-white/80 bg-white/82 p-5 text-left shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(148,163,184,0.12)]"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <Sparkles className="h-3.5 w-3.5" />
                  图文入口
                </div>
                <div className="text-lg font-semibold text-slate-900">新建图文</div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  继续编辑分页、模板和图文成片。
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="rounded-[28px] border border-white/80 bg-white/82 p-5 text-left shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(148,163,184,0.12)]"
              >
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#eefcf5] px-3 py-1 text-xs text-emerald-700">
                  <Plus className="h-3.5 w-3.5" />
                  资源入口
                </div>
                <div className="text-lg font-semibold text-slate-900">上传资源</div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  把新壁纸、头像或图像素材加入资源库。
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/my-space/resource-albums')}
                className="rounded-[28px] border border-white/80 bg-white/82 p-5 text-left shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(148,163,184,0.12)]"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <FolderOpen className="h-3.5 w-3.5" />
                  专辑入口
                </div>
                <div className="text-lg font-semibold text-slate-900">管理资源专辑</div>
                <div className="mt-2 text-sm leading-7 text-slate-500">
                  把现有资源整理成系列合集，给创作者详情页补上更清晰的浏览入口。
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* ===== 资源预览 ===== */}
        <section className="mt-24">
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <HeroSectionTitle
                  eyebrow="RESOURCES"
                  title="我的资源"
                  description="最近上传的资源预览，点击「管理全部」查看完整列表并进行编辑、删除操作。"
                  titleClassName="text-[30px] md:text-[34px]"
                  descriptionClassName="max-w-xl"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  上传
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => navigate('/my-space/resources')}
                >
                  管理全部
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                <ImageIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500">还没有上传任何资源</p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl"
                  onClick={() => setUploadOpen(true)}
                >
                  立即上传
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                  {resources.map((resource, i) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      showSize
                      showDate
                      showTags
                      showVisibilityTag
                      animationDelay={i * 30}
                    />
                  ))}
                </div>
                {total > 8 && (
                  <div className="mt-6 flex justify-center">
                    <Button
                      variant="outline"
                      className="rounded-xl gap-1.5 px-6"
                      onClick={() => navigate('/my-space/resources')}
                    >
                      查看全部 {total} 个资源
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* ===== 内容预览 ===== */}
        <section className="mt-24">
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <HeroSectionTitle
                eyebrow="CONTENT"
                title="博客与图文"
                description="最近发布的内容预览，点击「管理全部」进入完整内容管理页。"
                titleClassName="text-[30px] md:text-[34px]"
                descriptionClassName="max-w-xl"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/blog-create')}
                  className="rounded-xl"
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  新建博客
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/image-text')}
                  className="rounded-xl"
                >
                  <ImageIcon className="mr-1.5 h-4 w-4" />
                  新建图文
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => navigate('/my-space/posts')}
                >
                  管理全部
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 博客预览 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                  <FileText className="h-4 w-4 text-theme-primary" />
                  博客
                  <span className="rounded-full bg-theme-soft px-2.5 py-0.5 text-xs text-theme-primary">
                    {blogTotal} 篇
                  </span>
                </h3>
                {blogTotal > BLOG_PREVIEW_SIZE && (
                  <button
                    type="button"
                    onClick={() => navigate('/my-space/posts')}
                    className="inline-flex items-center gap-1 text-sm text-theme-primary hover:underline"
                  >
                    查看全部 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {loadingBlogPosts ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: BLOG_PREVIEW_SIZE }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                  ))}
                </div>
              ) : blogPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  还没有博客内容，先去发布一篇吧。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {blogPosts.map((post) => (
                    <BlogPostCard key={post.id} post={post} mode="creator" />
                  ))}
                </div>
              )}
            </div>

            {/* 图文预览 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-theme-primary" />
                  图文
                  <span className="rounded-full bg-theme-soft px-2.5 py-0.5 text-xs text-theme-primary-hover">
                    {imageTextTotal} 组
                  </span>
                </h3>
                {imageTextTotal > IMAGE_TEXT_PREVIEW_SIZE && (
                  <button
                    type="button"
                    onClick={() => navigate('/my-space/posts')}
                    className="inline-flex items-center gap-1 text-sm text-theme-primary hover:underline"
                  >
                    查看全部 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {loadingImageTextPosts ? (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {Array.from({ length: IMAGE_TEXT_PREVIEW_SIZE }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                  ))}
                </div>
              ) : imageTextPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft p-6 text-center text-sm text-theme-primary-hover">
                  还没有图文内容。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {imageTextPosts.map((post) => (
                    <ImageTextPostCard key={post.id} post={post} mode="creator" />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                className="rounded-xl gap-1.5 px-8"
                onClick={() => navigate('/my-space/posts')}
              >
                进入内容管理
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ===== 工具入口 ===== */}
        <section className="mt-24">
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
            <div className="mb-5">
              <HeroSectionTitle
                eyebrow="TOOLS"
                title="管理工具"
                description="资源专辑、博客分组等管理入口。"
                titleClassName="text-[30px] md:text-[34px]"
                descriptionClassName="max-w-xl"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => navigate('/my-space/resource-albums')}
                className="rounded-[24px] border border-white/80 bg-white/82 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <FolderOpen className="h-3.5 w-3.5" />
                  专辑管理
                </div>
                <div className="font-semibold text-slate-900">资源专辑</div>
                <div className="mt-1 text-sm text-slate-500">把资源整理成系列合集</div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/my-space/blog-groups?type=blog')}
                className="rounded-[24px] border border-white/80 bg-white/82 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <FolderTree className="h-3.5 w-3.5" />
                  分组管理
                </div>
                <div className="font-semibold text-slate-900">博客分组</div>
                <div className="mt-1 text-sm text-slate-500">对博客文章进行分类归档</div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/my-space/blog-groups?type=image_text')}
                className="rounded-[24px] border border-white/80 bg-white/82 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <FolderTree className="h-3.5 w-3.5" />
                  分组管理
                </div>
                <div className="font-semibold text-slate-900">图文分组</div>
                <div className="mt-1 text-sm text-slate-500">对图文创作进行分类归档</div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/my-space/resources')}
                className="rounded-[24px] border border-white/80 bg-white/82 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <ImageIcon className="h-3.5 w-3.5" />
                  资源管理
                </div>
                <div className="font-semibold text-slate-900">全部资源</div>
                <div className="mt-1 text-sm text-slate-500">查看并管理所有上传资源</div>
              </button>
              <button
                type="button"
                onClick={() => navigate('/my-space/resource-tags')}
                className="rounded-[24px] border border-white/80 bg-white/82 p-5 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="bg-theme-soft text-theme-primary mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                  <Tag className="h-3.5 w-3.5" />
                  标签管理
                </div>
                <div className="font-semibold text-slate-900">资源标签</div>
                <div className="mt-1 text-sm text-slate-500">为资源添加标签，支持 AI 自动匹配</div>
              </button>
            </div>
          </div>
        </section>
      </div>

      <UploadResourceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={loadResources}
      />
    </div>
  );
}
