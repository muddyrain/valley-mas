import {
  ChevronRight,
  FileText,
  FolderOpen,
  FolderTree,
  Image as ImageIcon,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type Group as BlogGroup, type Post as BlogPost, getAdminPosts } from '@/api/blog';
import { getMyResources, type MyResource } from '@/api/resource';
import { BlogPostCard, ImageTextPostCard } from '@/components/blog';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import UploadResourceDialog from '@/components/UploadResourceDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="theme-eyebrow inline-flex items-center rounded-full border bg-white/82 px-4 py-1.5 text-[11px] tracking-[0.32em] uppercase shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)] backdrop-blur">
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[40px]">
          {title}
        </h2>
        <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">{description}</p>
      </div>
    </div>
  );
}

export default function MySpace() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  // 资源（只取最新 8 条用于预览）
  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // 博客/图文（各取最新 4 条用于预览）
  const [myPosts, setMyPosts] = useState<BlogPost[]>([]);
  const [blogGroups] = useState<BlogGroup[]>([]);
  const [imageTextGroups] = useState<BlogGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);

  // 权限检查
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator') {
      toast.error('该页面仅创作者可访问');
      navigate('/');
    }
  }, [isAuthenticated, user, navigate]);

  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyResources({ pageSize: 8 });
      setResources(data.list || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('加载资源失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'creator') {
      loadResources();
    }
  }, [isAuthenticated, user, loadResources]);

  const loadMyPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const postsData = await getAdminPosts({ page: 1, pageSize: 8 });
      setMyPosts(postsData.list || []);
    } catch {
      toast.error('加载博客内容失败');
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'creator') {
      void loadMyPosts();
    }
  }, [isAuthenticated, user, loadMyPosts]);

  const previewBlogPosts = useMemo(
    () => myPosts.filter((p) => p.postType === 'blog').slice(0, 4),
    [myPosts],
  );
  const previewImageTextPosts = useMemo(
    () => myPosts.filter((p) => p.postType === 'image_text').slice(0, 4),
    [myPosts],
  );

  // 统计数（从 posts 中算）
  const blogCount = useMemo(() => myPosts.filter((p) => p.postType === 'blog').length, [myPosts]);
  const imageTextCount = useMemo(
    () => myPosts.filter((p) => p.postType === 'image_text').length,
    [myPosts],
  );

  // ===== 上传相关 =====
  // （逻辑已封装至 UploadResourceDialog 组件）

  if (!isAuthenticated || user?.role !== 'creator') return null;

  // 用于消除 blogGroups / imageTextGroups 的 unused 警告（已移至 MyPosts.tsx）
  void blogGroups;
  void imageTextGroups;

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        {/* ===== Hero ===== */}
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_88%_20%,rgba(96,165,250,0.18),transparent_22%),radial-gradient(circle_at_80%_72%,rgba(251,191,36,0.1),transparent_28%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <SectionTitle
                eyebrow="CREATOR"
                title="创作者空间"
                description="这里承接你的资源、博客和图文内容，方便继续整理、编辑、发布和回看每一条创作记录。"
              />
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <ImageIcon className="text-theme-primary h-4 w-4" />共 {total} 项资源
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  {blogCount} 篇博客
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <Sparkles className="h-4 w-4 text-theme-primary" />
                  {imageTextCount} 组图文
                </div>
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
                <SectionTitle
                  eyebrow="RESOURCES"
                  title="我的资源"
                  description="最近上传的资源预览，点击「管理全部」查看完整列表并进行编辑、删除操作。"
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {resources.map((resource, i) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      showSize
                      showDate
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
              <SectionTitle
                eyebrow="CONTENT"
                title="博客与图文"
                description="最近发布的内容预览，点击「管理全部」进入完整内容管理页。"
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
                    {blogCount} 篇
                  </span>
                </h3>
                {blogCount > 4 && (
                  <button
                    type="button"
                    onClick={() => navigate('/my-space/posts')}
                    className="inline-flex items-center gap-1 text-sm text-theme-primary hover:underline"
                  >
                    查看全部 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {loadingPosts ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                  ))}
                </div>
              ) : previewBlogPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  还没有博客内容，先去发布一篇吧。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {previewBlogPosts.map((post) => (
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
                    {imageTextCount} 组
                  </span>
                </h3>
                {imageTextCount > 4 && (
                  <button
                    type="button"
                    onClick={() => navigate('/my-space/posts')}
                    className="inline-flex items-center gap-1 text-sm text-theme-primary hover:underline"
                  >
                    查看全部 <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {loadingPosts ? (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                  ))}
                </div>
              ) : previewImageTextPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft p-6 text-center text-sm text-theme-primary-hover">
                  还没有图文内容。
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {previewImageTextPosts.map((post) => (
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
              <SectionTitle
                eyebrow="TOOLS"
                title="管理工具"
                description="资源专辑、博客分组等管理入口。"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
