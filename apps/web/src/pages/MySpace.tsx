import {
  Calendar,
  ChevronDown,
  ExternalLink,
  FileText,
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
  getAdminGroups,
  getAdminPosts,
} from '@/api/blog';
import {
  deleteResource,
  getMyResources,
  type MyResource,
  updateResource,
  uploadResource,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDate } from '@/utils/blog';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

// 文件大小格式化
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getPostStatusMeta(status?: string) {
  if (status === 'published') {
    return {
      label: '已发布',
      className: 'bg-emerald-100 text-emerald-700',
    };
  }
  if (status === 'archived') {
    return {
      label: '已归档',
      className: 'bg-slate-200 text-slate-700',
    };
  }
  return {
    label: '草稿',
    className: 'bg-amber-100 text-amber-700',
  };
}

export default function MySpace() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');
  const [myPosts, setMyPosts] = useState<BlogPost[]>([]);
  const [myGroups, setMyGroups] = useState<BlogGroup[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'blog' | 'image_text'>('all');
  const [postGroupFilter, setPostGroupFilter] = useState('');

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'wallpaper' | 'avatar'>('wallpaper');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<MyResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑弹窗状态
  const [editTarget, setEditTarget] = useState<MyResource | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editType, setEditType] = useState('');
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
      const [postsData, groupsData] = await Promise.all([
        getAdminPosts({ page: 1, pageSize: 24 }),
        getAdminGroups(),
      ]);
      setMyPosts(postsData.list || []);
      setMyGroups(groupsData || []);
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

  const filteredPosts = useMemo(() => {
    return myPosts.filter((post) => {
      if (postTypeFilter !== 'all' && post.postType !== postTypeFilter) return false;
      if (postGroupFilter && post.groupId !== postGroupFilter) return false;
      return true;
    });
  }, [myPosts, postGroupFilter, postTypeFilter]);

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
    setUploadTitle('');
    setUploadDesc('');
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
      });
      toast.success('修改成功');
      // 本地同步更新，避免重新请求
      setResources((prev) =>
        prev.map((r) =>
          r.id === editTarget.id
            ? { ...r, title: editTitle.trim() || r.title, type: editType || r.type }
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

  if (!isAuthenticated || user?.role !== 'creator') {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* 头部 Banner */}
      <PageBanner>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* 头像 */}
          <div className="relative">
            <div className="absolute -inset-2 bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full opacity-75 blur-xl" />
            <Avatar className="relative h-24 w-24 border-4 border-white/30 shadow-2xl ring-4 ring-purple-500/30">
              <AvatarImage src={user?.avatar} className="object-cover" />
              <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-600 text-white text-3xl font-bold">
                {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* 信息 */}
          <div className="flex-1 text-white">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                {user?.nickname || user?.username}
              </h1>
              <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 px-3 py-1">
                <Sparkles className="h-3 w-3 mr-1" />
                我的创作空间
              </Badge>
            </div>
            <p className="text-purple-100 text-sm mb-5">
              在这里管理你上传的所有资源，上传新作品或删除旧内容。
            </p>
            {/* 统计 */}
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-xl px-5 py-3 border border-white/20">
                <div className="flex items-center gap-2 text-purple-200 mb-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">作品总数</span>
                </div>
                <div className="text-2xl font-bold">{total}</div>
              </div>
            </div>
          </div>

          {/* 快捷创作按钮 */}
          <div className="flex flex-col gap-2 md:items-end">
            <Button
              onClick={() => navigate('/my-space/blog-create')}
              size="lg"
              variant="outline"
              className="w-full border-white/35 bg-white/90 text-purple-700 hover:bg-white"
            >
              写博客
            </Button>
            <Button
              onClick={() => navigate('/my-space/image-text')}
              size="lg"
              variant="outline"
              className="w-full border-white/35 bg-white/90 text-purple-700 hover:bg-white"
            >
              图文创作
            </Button>
            <Button
              onClick={() => setUploadOpen(true)}
              size="lg"
              className="w-full bg-white text-purple-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl font-semibold px-8 transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              上传新资源
            </Button>
          </div>
        </div>
      </PageBanner>

      {/* 内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 分类筛选 */}
        <TypeFilterBar
          options={RESOURCE_TYPES}
          value={activeType}
          onChange={setActiveType}
          prefix="筛选："
          extra={<span className="text-sm text-gray-400">共 {total} 个资源</span>}
          className="mb-6"
        />

        {/* 资源列表 */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="还没有上传任何资源"
            description="点击上方按钮，上传你的第一个作品吧！"
            actionLabel="立即上传"
            onAction={() => setUploadOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {resources.map((resource, i) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDelete={setDeleteTarget}
                onEdit={handleOpenEdit}
                showSize
                animationDelay={i * 30}
              />
            ))}
          </div>
        )}

        <section className="mt-12">
          <div className="rounded-3xl border border-violet-200/70 bg-white/90 p-6 shadow-[0_14px_32px_rgba(88,76,155,0.1)]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">我的博客与图文</h2>
                <p className="mt-1 text-sm text-slate-500">
                  当前账号的全部创作内容，支持按分组与类型查看
                </p>
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
                  onClick={() => navigate('/my-space/blog-groups')}
                  className="rounded-xl"
                >
                  <FolderTree className="mr-1.5 h-4 w-4" />
                  管理分组
                </Button>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { label: '全部', value: 'all' },
                { label: '博客', value: 'blog' },
                { label: '图文', value: 'image_text' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setPostTypeFilter(item.value as 'all' | 'blog' | 'image_text')}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    postTypeFilter === item.value
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
                  {postGroupFilter
                    ? myGroups.find((g) => g.id === postGroupFilter)?.name || '分组'
                    : '全部分组'}
                  <ChevronDown className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => setPostGroupFilter('')}>
                    全部分组
                  </DropdownMenuItem>
                  {myGroups.map((group) => (
                    <DropdownMenuItem key={group.id} onClick={() => setPostGroupFilter(group.id)}>
                      {group.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loadingPosts ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="text-slate-500">当前筛选下还没有内容，先去发布一篇吧。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_16px_34px_rgba(91,78,167,0.15)]"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      {(() => {
                        const statusMeta = getPostStatusMeta(post.status);
                        return (
                          <>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs ${
                                post.postType === 'image_text'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-violet-100 text-violet-700'
                              }`}
                            >
                              {post.postType === 'image_text' ? '图文创作' : '博客'}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    <h3 className="line-clamp-2 text-lg font-semibold text-slate-900 group-hover:text-violet-700">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 min-h-[66px] text-sm leading-6 text-slate-600">
                      {post.excerpt || '暂无摘要，点击查看详情内容。'}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <div className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(post.publishedAt || post.createdAt)}
                      </div>
                      {post.group?.name && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          {post.group.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg"
                        onClick={() => navigate(`/blog/${post.id}`)}
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        查看
                      </Button>
                      {post.postType === 'blog' && (
                        <Button
                          size="sm"
                          className="h-8 rounded-lg"
                          onClick={() => navigate(`/my-space/blog-edit/${post.id}`)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          编辑博客
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
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
              <Upload className="h-5 w-5 text-purple-600" />
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
                        ? 'border-purple-600 bg-purple-50 text-purple-600'
                        : 'border-gray-200 text-gray-500 hover:border-purple-300'
                    }`}
                  >
                    {type === 'wallpaper' ? '🖼️ 壁纸' : '🙂 头像'}
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
                    ? 'border-purple-400 bg-purple-50/50'
                    : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
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
                    <ImageIcon className="h-12 w-12 mb-3 text-purple-300" />
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                资源标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="给这个资源起个名字，如「蓝色星空壁纸」"
                maxLength={100}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
              />
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition resize-none"
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
                className="flex-1 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-md"
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
                  src={deleteTarget.url}
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

      {/* ===== 编辑弹窗 ===== */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="h-5 w-5 text-blue-600" />
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none"
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
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-500 hover:border-blue-300'
                    }`}
                  >
                    {type === 'wallpaper' ? '🖼️ 壁纸' : '🙂 头像'}
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
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
