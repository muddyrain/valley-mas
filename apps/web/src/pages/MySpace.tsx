import {
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderTree,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Group as BlogGroup,
  type Post as BlogPost,
  deletePost,
  getAdminGroups,
  getAdminPosts,
} from '@/api/blog';
import {
  deleteResource,
  getMyResources,
  type MyResource,
  type ResourceVisibility,
  suggestResourceTitle,
  updateResource,
  uploadResource,
} from '@/api/resource';
import { BlogPostCard, ImageTextPostCard } from '@/components/blog';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/useAuthStore';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const VISIBILITY_OPTIONS: Array<{ label: string; value: ResourceVisibility }> = [
  { label: '私密', value: 'private' },
  { label: '共享', value: 'shared' },
  { label: '公开', value: 'public' },
];

// 文件大小格式化
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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

  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');
  const [myPosts, setMyPosts] = useState<BlogPost[]>([]);
  const [blogGroups, setBlogGroups] = useState<BlogGroup[]>([]);
  const [imageTextGroups, setImageTextGroups] = useState<BlogGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [blogGroupFilter, setBlogGroupFilter] = useState('');
  const [imageTextGroupFilter, setImageTextGroupFilter] = useState('');

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'wallpaper' | 'avatar'>('wallpaper');
  const [uploadVisibility, setUploadVisibility] = useState<ResourceVisibility>('private');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiNaming, setAiNaming] = useState(false);
  const [aiTitles, setAiTitles] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<MyResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletePostTarget, setDeletePostTarget] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  // 编辑弹窗状态
  const [editTarget, setEditTarget] = useState<MyResource | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('');
  const [editVisibility, setEditVisibility] = useState<ResourceVisibility>('private');
  const [editing, setEditing] = useState(false);

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

  const loadResources = useCallback(
    async (type = activeType) => {
      try {
        setLoading(true);
        const data = await getMyResources({ type: type || undefined });
        setResources(data.list || []);
        setTotal(data.total || 0);
      } catch {
        toast.error('加载资源失败');
      } finally {
        setLoading(false);
      }
    },
    [activeType],
  );

  useEffect(() => {
    if (isAuthenticated && user?.role === 'creator') {
      loadResources(activeType);
    }
  }, [isAuthenticated, user, activeType, loadResources]);

  const loadMyPosts = useCallback(async () => {
    try {
      setLoadingPosts(true);
      const [postsData, blogGroupsData, imageTextGroupsData] = await Promise.all([
        getAdminPosts({ page: 1, pageSize: 24 }),
        getAdminGroups({ groupType: 'blog' }),
        getAdminGroups({ groupType: 'image_text' }),
      ]);
      setMyPosts(postsData.list || []);
      setBlogGroups(blogGroupsData || []);
      setImageTextGroups(imageTextGroupsData || []);
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

  const filteredBlogPosts = useMemo(
    () =>
      myPosts.filter((post) => {
        if (post.postType !== 'blog') return false;
        if (blogGroupFilter && post.groupId !== blogGroupFilter) return false;
        return true;
      }),
    [blogGroupFilter, myPosts],
  );

  const filteredImageTextPosts = useMemo(
    () =>
      myPosts.filter((post) => {
        if (post.postType !== 'image_text') return false;
        if (imageTextGroupFilter && post.groupId !== imageTextGroupFilter) return false;
        return true;
      }),
    [imageTextGroupFilter, myPosts],
  );

  // 选择文件
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB');
      return;
    }
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    // 自动填入文件名（去掉扩展名）作为标题
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  // 拖拽上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('仅支持图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件大小不能超过 10MB');
      return;
    }
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    // 自动填入文件名（去掉扩展名）作为标题
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
  };

  // 将图片压缩为小尺寸 base64（给 AI 用，不影响实际上传）
  const resizeImageForAI = (file: File, maxSize = 512): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  // AI 起名
  const handleAiSuggestTitle = async () => {
    if (!uploadFile || !previewUrl) {
      toast.error('请先选择图片');
      return;
    }
    try {
      setAiNaming(true);
      setAiTitles([]);
      // 压缩到 512px 以内再发给 AI，大幅减少传输与解析时间
      const base64 = await resizeImageForAI(uploadFile, 512);
      const result = await suggestResourceTitle(base64, uploadType);
      if (result.titles && result.titles.length > 0) {
        setAiTitles(result.titles);
        setUploadTitle(result.titles[0]);
        toast.success('AI 已生成名称建议，点击选用');
      } else {
        toast.error('AI 未返回有效名称');
      }
    } catch {
      toast.error('AI 起名失败，请稍后重试');
    } finally {
      setAiNaming(false);
    }
  };

  // 提交上传
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('请先选择文件');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadType);
      formData.append('visibility', uploadVisibility);
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDesc.trim());
      await uploadResource(formData);
      toast.success('上传成功');
      setUploadOpen(false);
      resetUploadState();
      loadResources(activeType);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setUploading(false);
    }
  };

  const resetUploadState = () => {
    setUploadFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setUploadType('wallpaper');
    setUploadVisibility('private');
    setUploadTitle('');
    setUploadDesc('');
    setAiTitles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 删除资源
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteResource(deleteTarget.id);
      toast.success('删除成功');
      setDeleteTarget(null);
      loadResources(activeType);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setDeleting(false);
    }
  };

  // 打开编辑弹窗，回填当前值
  const handleOpenEdit = (resource: MyResource) => {
    setEditTarget(resource);
    setEditTitle(resource.title);
    setEditDesc(resource.description ?? '');
    setEditType(resource.type);
    setEditVisibility(resource.visibility || 'private');
  };

  // 提交编辑
  const handleEditSubmit = async () => {
    if (!editTarget) return;
    try {
      setEditing(true);
      await updateResource(editTarget.id, {
        title: editTitle.trim() || undefined,
        description: editDesc.trim() || undefined,
        type: editType || undefined,
        visibility: editVisibility,
      });
      toast.success('修改成功');
      // 本地同步更新，避免重新请求
      setResources((prev) =>
        prev.map((r) =>
          r.id === editTarget.id
            ? {
                ...r,
                title: editTitle.trim() || r.title,
                description: editDesc.trim() || r.description,
                type: editType || r.type,
                visibility: editVisibility,
              }
            : r,
        ),
      );
      setEditTarget(null);
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setEditing(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletePostTarget) return;
    try {
      setDeletingPost(true);
      await deletePost(deletePostTarget.id);
      toast.success('删除成功');
      setDeletePostTarget(null);
      await loadMyPosts();
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setDeletingPost(false);
    }
  };

  const renderPostFooter = (post: BlogPost) => (
    <div className="flex items-center justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-8 rounded-lg"
        onClick={() =>
          navigate(`/blog/${post.id}`, {
            state: { returnTo: '/my-space', returnLabel: '返回创作空间' },
          })
        }
      >
        <ExternalLink className="mr-1 h-3.5 w-3.5" />
        查看
      </Button>
      {post.postType === 'blog' ? (
        <Button
          size="sm"
          className="h-8 rounded-lg"
          onClick={() => navigate(`/my-space/blog-edit/${post.id}`)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          编辑博客
        </Button>
      ) : (
        <Button
          size="sm"
          className="h-8 rounded-lg"
          onClick={() => navigate(`/my-space/image-text-edit/${post.id}`)}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          编辑图文
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        className="h-8 rounded-lg"
        onClick={() => setDeletePostTarget(post)}
      >
        <Trash2 className="mr-1 h-3.5 w-3.5" />
        删除
      </Button>
    </div>
  );

  if (!isAuthenticated || user?.role !== 'creator') {
    return null;
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
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
                  {filteredBlogPosts.length} 篇博客
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <Sparkles className="h-4 w-4 text-theme-primary" />
                  {filteredImageTextPosts.length} 组图文
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

        <section className="mt-24">
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
            <TypeFilterBar
              options={RESOURCE_TYPES}
              value={activeType}
              onChange={setActiveType}
              prefix="资源类型："
              extra={<span className="text-sm text-slate-400">共 {total} 个资源</span>}
              className="mb-6"
            />

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-[32px] bg-white/66 p-4">
                <EmptyState
                  icon={ImageIcon}
                  title="还没有上传任何资源"
                  description="点击上方资源入口，把第一张壁纸或头像先放进来。"
                  actionLabel="立即上传"
                  onAction={() => setUploadOpen(true)}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {resources.map((resource, i) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onDelete={setDeleteTarget}
                    onEdit={handleOpenEdit}
                    showSize
                    showDate
                    showVisibilityTag
                    animationDelay={i * 30}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-24">
          <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <SectionTitle
                  eyebrow="CONTENT"
                  title="博客与图文"
                  description="这里承接当前账号的创作内容。博客和图文保留各自的分组筛选，但继续共存在同一页方便统一管理。"
                />
              </div>
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
                  onClick={() => navigate('/my-space/blog-groups?type=blog')}
                  className="rounded-xl"
                >
                  <FolderTree className="mr-1.5 h-4 w-4" />
                  管理博客分组
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/my-space/blog-groups?type=image_text')}
                  className="rounded-xl"
                >
                  <FolderTree className="mr-1.5 h-4 w-4" />
                  图文分组
                </Button>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-theme-shell-border hover:text-theme-primary">
                  {blogGroupFilter
                    ? blogGroups.find((g) => g.id === blogGroupFilter)?.name || '博客分组'
                    : '全部博客分组'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => setBlogGroupFilter('')}>
                    全部博客分组
                  </DropdownMenuItem>
                  {blogGroups.map((group) => (
                    <DropdownMenuItem key={group.id} onClick={() => setBlogGroupFilter(group.id)}>
                      {group.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <span className="rounded-full bg-theme-soft px-3 py-1.5 text-sm text-theme-primary">
                博客 {filteredBlogPosts.length}
              </span>
              <span className="rounded-full bg-theme-soft px-3 py-1.5 text-sm text-theme-primary-hover">
                图文 {filteredImageTextPosts.length}
              </span>
            </div>

            {loadingPosts ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-theme-soft" />
                ))}
              </div>
            ) : filteredBlogPosts.length === 0 && filteredImageTextPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="text-slate-500">当前筛选下还没有内容，先去发布一篇吧。</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">博客列表</h3>
                      <p className="text-sm text-slate-500">只展示文章内容，方便继续编辑和管理。</p>
                    </div>
                    <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary">
                      {filteredBlogPosts.length} 篇
                    </span>
                  </div>

                  {filteredBlogPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                      当前筛选下还没有博客内容。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredBlogPosts.map((post) => (
                        <BlogPostCard
                          key={post.id}
                          post={post}
                          mode="creator"
                          footer={renderPostFooter(post)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">图文展示列</h3>
                      <p className="text-sm text-slate-500">
                        单独突出图文页数、封面和贴纸信息，不再复用博客卡片。
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-theme-shell-border hover:text-theme-primary">
                          {imageTextGroupFilter
                            ? imageTextGroups.find((g) => g.id === imageTextGroupFilter)?.name ||
                              '图文分组'
                            : '全部图文分组'}
                          <ChevronDown className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 rounded-xl">
                          <DropdownMenuItem onClick={() => setImageTextGroupFilter('')}>
                            全部图文分组
                          </DropdownMenuItem>
                          {imageTextGroups.map((group) => (
                            <DropdownMenuItem
                              key={group.id}
                              onClick={() => setImageTextGroupFilter(group.id)}
                            >
                              {group.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span className="rounded-full bg-theme-soft px-3 py-1 text-sm text-theme-primary-hover">
                        {filteredImageTextPosts.length} 组
                      </span>
                    </div>
                  </div>

                  {filteredImageTextPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft p-6 text-sm text-theme-primary-hover">
                      当前筛选下还没有图文内容。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                      {filteredImageTextPosts.map((post) => (
                        <ImageTextPostCard
                          key={post.id}
                          post={post}
                          mode="creator"
                          footer={renderPostFooter(post)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ===== 上传弹窗 ===== */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) resetUploadState();
          setUploadOpen(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Upload className="h-5 w-5 text-theme-primary" />
              上传新资源
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* 类型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">资源类型</label>
              <div className="flex gap-3">
                {(['wallpaper', 'avatar'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setUploadType(type)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      uploadType === type
                        ? 'border-theme-primary bg-theme-soft text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-theme-shell-border'
                    }`}
                  >
                    {type === 'wallpaper' ? '🖼️ 壁纸' : '🙂 头像'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">可见范围</label>
              <div className="flex gap-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setUploadVisibility(option.value)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      uploadVisibility === option.value
                        ? 'border-theme-primary bg-theme-soft text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-theme-shell-border'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件拖拽区 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">选择图片</label>
              <div
                className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer ${
                  previewUrl
                    ? 'border-theme-primary bg-theme-soft/50'
                    : 'border-gray-300 hover:border-theme-primary hover:bg-theme-soft/30'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="预览"
                      className={`w-full rounded-2xl object-cover ${
                        uploadType === 'wallpaper' ? 'max-h-56' : 'max-h-48'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="p-3 text-center text-xs text-gray-500">
                      {uploadFile?.name} · {formatSize(uploadFile?.size || 0)}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <ImageIcon className="h-12 w-12 mb-3 text-theme-primary opacity-40" />
                    <p className="text-sm font-medium text-gray-600 mb-1">点击或拖拽图片至此处</p>
                    <p className="text-xs">支持 JPG、PNG、WebP，最大 10MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* 标题 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  资源标题 <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAiSuggestTitle}
                  disabled={!uploadFile || aiNaming}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-theme-primary px-2.5 py-1 text-xs font-medium text-theme-primary transition-all
                    hover:bg-theme-primary hover:text-white
                    disabled:opacity-40 disabled:cursor-not-allowed"
                  title={uploadFile ? 'AI 根据图片内容自动起名' : '请先选择图片'}
                >
                  {aiNaming ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>✨</span>}
                  {aiNaming ? 'AI 生成中…' : 'AI 起名'}
                </button>
              </div>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="给这个资源起个名字，如「蓝色星空壁纸」"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary/40 transition"
              />
              {/* AI 名称建议 chips */}
              {aiTitles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aiTitles.map((t, i) => (
                    <button
                      key={i}
                      type={'button'}
                      onClick={() => setUploadTitle(t)}
                      className={
                        t === uploadTitle
                          ? 'rounded-full px-3 py-0.5 text-xs transition-all bg-theme-primary text-white border border-theme-primary'
                          : 'rounded-full border border-theme-primary/50 bg-theme-primary/5 px-3 py-0.5 text-xs text-theme-primary hover:bg-theme-primary hover:text-white transition-all'
                      }
                    >
                      {t}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAiTitles([])}
                    className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 transition-all"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* 描述（可选） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                placeholder="简单描述一下这个资源…"
                maxLength={255}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary/40 transition resize-none"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  resetUploadState();
                  setUploadOpen(false);
                }}
                className="flex-1"
                disabled={uploading}
              >
                取消
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="theme-btn-primary flex-1 font-semibold shadow-md"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    确认上传
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 删除确认弹窗 ===== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              确认删除
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {deleteTarget && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mb-4">
                <img
                  src={deleteTarget.thumbnailUrl ?? deleteTarget.url}
                  alt={deleteTarget.title}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900 text-sm truncate max-w-45">
                    {deleteTarget.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {deleteTarget.downloadCount} 次下载 · {formatSize(deleteTarget.size)}
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600">
              删除后将无法恢复，同时会从存储中永久移除。确认继续？
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="flex-1"
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  确认删除
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 内容删除弹窗 ===== */}
      <Dialog
        open={!!deletePostTarget}
        onOpenChange={(open) => !open && !deletingPost && setDeletePostTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              {'确认删除内容'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {deletePostTarget && (
              <div className="mb-4 rounded-xl bg-gray-50 p-3">
                <p className="line-clamp-2 text-sm font-medium text-gray-900">
                  {deletePostTarget.title}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {deletePostTarget.postType === 'image_text' ? '图文创作' : '博客'}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-600">{'删除后将无法恢复，确认继续？'}</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setDeletePostTarget(null)}
              className="flex-1"
              disabled={deletingPost}
            >
              {'取消'}
            </Button>
            <Button
              onClick={() => void handleDeletePost()}
              disabled={deletingPost}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold"
            >
              {deletingPost ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {'删除中...'}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {'确认删除'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== 编辑弹窗 ===== */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="h-5 w-5 text-theme-primary" />
              编辑资源信息
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* 标题 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">资源标题</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="给这个资源起个名字"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary/40 transition"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="简单描述一下这个资源…"
                maxLength={255}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-theme-primary/40 transition resize-none"
              />
            </div>

            {/* 类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">资源类型</label>
              <div className="flex gap-3">
                {(['wallpaper', 'avatar'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => setEditType(type)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      editType === type
                        ? 'border-theme-primary bg-theme-soft text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-theme-shell-border'
                    }`}
                  >
                    {type === 'wallpaper' ? '🖼️ 壁纸' : '🙂 头像'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">可见范围</label>
              <div className="flex gap-3">
                {VISIBILITY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setEditVisibility(option.value)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${
                      editVisibility === option.value
                        ? 'border-theme-primary bg-theme-soft text-theme-primary'
                        : 'border-gray-200 text-gray-500 hover:border-theme-shell-border'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setEditTarget(null)}
                className="flex-1"
                disabled={editing}
              >
                取消
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={editing}
                className="theme-btn-primary flex-1 font-semibold shadow-md"
              >
                {editing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    保存修改
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
