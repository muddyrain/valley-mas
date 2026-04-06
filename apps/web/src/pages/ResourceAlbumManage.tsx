import {
  Crown,
  FolderOpen,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  type Album,
  createCreatorAlbum,
  deleteCreatorAlbum,
  getMyCreatorAlbums,
  updateCreatorAlbum,
} from '@/api/creator';
import { getMyResources, type MyResource } from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 28%, white) 44%, var(--theme-page-cool) 100%)',
};

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(135deg, rgba(var(--theme-primary-rgb),0.97) 0%, color-mix(in srgb, rgba(var(--theme-secondary-rgb),1) 36%, var(--theme-primary-hover)) 54%, var(--theme-primary-deep) 100%)',
};

const TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'wallpaper', label: '壁纸' },
  { value: 'avatar', label: '头像' },
];

const PAGE_SIZE = 20;

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatResolution(w: number, h: number): string {
  if (!w || !h) return '—';
  return `${w} × ${h}`;
}

// ─── 资源选择器 ────────────────────────────────────────────────────────────
function ResourcePicker({
  selectedIds,
  coverResourceId,
  onToggle,
  onSetCover,
}: {
  selectedIds: string[];
  coverResourceId: string;
  onToggle: (resource: MyResource) => void;
  onSetCover: (id: string) => void;
}) {
  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [type, setType] = useState('');
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResources = useCallback(async (p: number, kw: string, tp: string) => {
    try {
      setFetching(true);
      const res = await getMyResources({ page: p, pageSize: PAGE_SIZE, type: tp || undefined });
      const list = res.list || [];
      const filtered = kw
        ? list.filter((item) => item.title.toLowerCase().includes(kw.toLowerCase()))
        : list;
      setResources(filtered);
      setTotal(kw ? filtered.length : res.total);
    } catch {
      // 统一处理
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void fetchResources(page, keyword, type);
  }, [fetchResources, page, keyword, type]);

  const handleSearch = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKeyword(val);
      setPage(1);
    }, 300);
  };

  const handleType = (val: string) => {
    setType(val);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 搜索 + 类型筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={inputValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索资源标题…"
            className="theme-input-border h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleType(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                type === opt.value
                  ? 'bg-(--theme-primary) text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 资源网格 */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-2">
        {fetching ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-sm">{keyword ? '没有匹配的资源' : '暂无资源'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resources.map((resource) => {
              const selected = selectedIds.includes(resource.id);
              const isCover = coverResourceId === resource.id;
              return (
                <div
                  key={resource.id}
                  onClick={() => onToggle(resource)}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                    selected
                      ? 'border-(--theme-primary) shadow-[0_0_0_3px_rgba(var(--theme-primary-rgb),0.15)]'
                      : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  <div className="aspect-square bg-slate-100">
                    {resource.url ? (
                      <img
                        src={resource.thumbnailUrl || resource.url}
                        alt={resource.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* 选中角标 */}
                  {selected && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-(--theme-primary) shadow">
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}

                  {/* 封面标记 */}
                  {isCover && (
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                      <Crown className="h-2.5 w-2.5" />
                      封面
                    </div>
                  )}

                  {/* hover 悬浮信息 */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-full bg-linear-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 transition-transform group-hover:translate-y-0">
                    <p className="truncate text-[11px] font-semibold text-white">
                      {resource.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {/* 分类 */}
                      <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] text-white/90">
                        {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                      </span>
                      {/* 扩展名 */}
                      {resource.extension && (
                        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] uppercase text-white/90">
                          {resource.extension}
                        </span>
                      )}
                      {/* 分辨率 */}
                      {resource.width > 0 && resource.height > 0 && (
                        <span className="text-[10px] text-white/75">
                          {formatResolution(resource.width, resource.height)}
                        </span>
                      )}
                      {/* 文件大小 */}
                      {resource.size > 0 && (
                        <span className="text-[10px] text-white/75">
                          {formatSize(resource.size)}
                        </span>
                      )}
                    </div>
                    {selected && !isCover && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetCover(resource.id);
                        }}
                        className="mt-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm hover:bg-white/40"
                      >
                        设为封面
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            第 {page} / {totalPages} 页，共 {total} 项
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1 || fetching}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={page >= totalPages || fetching}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 已选资源列表 ─────────────────────────────────────────────────────────
function SelectedList({
  selectedIds,
  coverResourceId,
  allResources,
  onRemove,
  onSetCover,
}: {
  selectedIds: string[];
  coverResourceId: string;
  allResources: MyResource[];
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
}) {
  const selected = allResources.filter((r) => selectedIds.includes(r.id));

  if (selectedIds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400">
        <FolderOpen className="h-8 w-8 opacity-40" />
        <p className="text-sm">从左侧点击资源加入专辑</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-2xl border border-theme-shell-border bg-white/70 p-2">
      {selected.map((resource) => {
        const isCover = coverResourceId === resource.id;
        return (
          <div
            key={resource.id}
            className="group flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2 shadow-sm transition hover:border-theme-shell-border"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {resource.url ? (
                <img
                  src={resource.thumbnailUrl || resource.url}
                  alt={resource.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="m-auto h-5 w-5 text-slate-300" />
              )}
              {isCover && (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-400/80">
                  <Crown className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-800">{resource.title}</p>
              <p className="text-[11px] text-slate-400">
                {resource.type === 'wallpaper' ? '壁纸' : '头像'}
              </p>
              {!isCover && (
                <button
                  type="button"
                  onClick={() => onSetCover(resource.id)}
                  className="mt-0.5 text-[10px] text-(--theme-primary) hover:underline"
                >
                  设为封面
                </button>
              )}
              {isCover && <span className="text-[10px] font-medium text-amber-500">当前封面</span>}
            </div>

            <button
              type="button"
              onClick={() => onRemove(resource.id)}
              className="shrink-0 rounded-lg p-1 text-slate-300 transition hover:bg-rose-50 hover:text-rose-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export default function ResourceAlbumManage() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated, user } = useAuthStore();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [allResources, setAllResources] = useState<MyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [coverResourceId, setCoverResourceId] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [albumData, resourceData] = await Promise.all([
        getMyCreatorAlbums(),
        getMyResources({ page: 1, pageSize: 100 }),
      ]);
      setAlbums(albumData.list || []);
      setAllResources(resourceData.list || []);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'creator') {
      navigate('/');
      return;
    }
    void loadData();
  }, [hasHydrated, isAuthenticated, navigate, user?.role, loadData]);

  const resetForm = () => {
    setEditingAlbum(null);
    setName('');
    setDescription('');
    setSelectedResourceIds([]);
    setCoverResourceId('');
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (album: Album) => {
    setEditingAlbum(album);
    setName(album.name);
    setDescription(album.description || '');
    const ids = album.resources?.map((item) => item.id) || [];
    setSelectedResourceIds(ids);
    setCoverResourceId(album.coverResourceId || ids[0] || '');
    setDialogOpen(true);
  };

  const toggleResource = useCallback(
    (resource: MyResource) => {
      setAllResources((prev) =>
        prev.some((r) => r.id === resource.id) ? prev : [...prev, resource],
      );
      setSelectedResourceIds((prev) => {
        if (prev.includes(resource.id)) {
          const next = prev.filter((id) => id !== resource.id);
          if (coverResourceId === resource.id) {
            setCoverResourceId(next[0] || '');
          }
          return next;
        }
        const next = [...prev, resource.id];
        if (!coverResourceId) {
          setCoverResourceId(resource.id);
        }
        return next;
      });
    },
    [coverResourceId],
  );

  const removeResource = useCallback(
    (id: string) => {
      setSelectedResourceIds((prev) => {
        const next = prev.filter((rid) => rid !== id);
        if (coverResourceId === id) {
          setCoverResourceId(next[0] || '');
        }
        return next;
      });
    },
    [coverResourceId],
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请输入专辑名称');
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        resourceIds: selectedResourceIds,
        coverResourceId: coverResourceId || undefined,
      };
      if (editingAlbum) {
        await updateCreatorAlbum(editingAlbum.id, payload);
        toast.success('资源专辑已更新');
      } else {
        await createCreatorAlbum(payload);
        toast.success('资源专辑已创建');
      }
      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteCreatorAlbum(deleteTarget.id);
      toast.success('资源专辑已删除');
      setDeleteTarget(null);
      await loadData();
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-10" maxWidth="max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
              <FolderOpen className="h-7 w-7 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">资源专辑管理</h1>
              <p className="mt-1 text-sm text-white/82">
                把作品整理成主题合集，创作者详情页会自动展示这些专辑入口。
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="rounded-2xl bg-white px-5 font-semibold text-theme-primary shadow-lg hover:bg-white/92"
          >
            <Plus className="mr-2 h-4 w-4" />
            新建专辑
          </Button>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm"
              >
                <Skeleton className="h-44 w-full" />
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <EmptyState
              icon={FolderOpen}
              title="还没有资源专辑"
              description="先把壁纸、头像或素材整理成主题合集，创作者详情页会更像真正的作品空间。"
              actionLabel="新建第一个专辑"
              onAction={openCreateDialog}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {albums.map((album) => (
              <Card
                key={album.id}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(var(--theme-primary-rgb),0.16)]"
              >
                <div className="relative h-44 overflow-hidden bg-theme-soft">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-theme-primary/50" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-theme-primary shadow-sm">
                    {album.resourceCount} 项资源
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-slate-900">{album.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                      {album.description || '暂未填写专辑说明'}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(album)}
                      className="rounded-xl border-theme-soft-strong bg-white/75 text-theme-primary hover:bg-theme-soft"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(album)}
                      className="rounded-xl border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── 创建 / 编辑弹窗 ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="flex h-[90vh] w-[90vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="text-base font-semibold">
              {editingAlbum ? '编辑资源专辑' : '新建资源专辑'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* 基本信息栏 */}
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">专辑名称 *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：奶油风头像合集"
                    className="theme-input-border h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600">专辑说明</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="给访客一句简短说明（可选）"
                    className="theme-input-border h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 左右双栏 */}
            <div className="flex min-h-0 flex-1 divide-x divide-slate-100 overflow-hidden">
              {/* 左：资源库 */}
              <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">资源库</p>
                  <span className="text-xs text-slate-400">点击资源即可添加 / 移除</span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ResourcePicker
                    selectedIds={selectedResourceIds}
                    coverResourceId={coverResourceId}
                    onToggle={toggleResource}
                    onSetCover={setCoverResourceId}
                  />
                </div>
              </div>

              {/* 右：已选 */}
              <div className="flex w-56 shrink-0 flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">已选资源</p>
                  <span className="rounded-full bg-theme-soft px-2 py-0.5 text-xs font-medium text-theme-primary">
                    {selectedResourceIds.length} 项
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <SelectedList
                    selectedIds={selectedResourceIds}
                    coverResourceId={coverResourceId}
                    allResources={allResources}
                    onRemove={removeResource}
                    onSetCover={setCoverResourceId}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-400">
              {coverResourceId
                ? `封面：${allResources.find((r) => r.id === coverResourceId)?.title ?? '已设置'}`
                : '未设置封面，将自动使用第一项资源'}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingAlbum ? '保存专辑' : '创建专辑'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 删除确认弹窗 ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除资源专辑</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm leading-6 text-slate-600">
              确认删除「{deleteTarget?.name}」？专辑会消失，但其中资源本身不会被删除。
            </p>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="bg-rose-500 text-white hover:bg-rose-600"
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认删除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
