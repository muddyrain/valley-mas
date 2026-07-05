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
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import UploadResourceDialog from '@/components/UploadResourceDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { enumParam, useUrlPaginationQuery, useUrlQueryState } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, hsl(var(--primary) / 0.15) 28%, hsl(var(--background))) 44%, var(--background) 100%)',
};

const TYPE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'wallpaper', label: '壁纸' },
  { value: 'avatar', label: '头像' },
];

const PAGE_SIZE = 20;
const RESOURCE_PICKER_QUERY_SCHEMA = {
  type: enumParam(['', 'wallpaper', 'avatar'] as const, '', { resetPageOnChange: true }),
};

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
  refreshToken = 0,
}: {
  selectedIds: string[];
  coverResourceId: string;
  onToggle: (resource: MyResource) => void;
  onSetCover: (id: string) => void;
  refreshToken?: number;
}) {
  const {
    page: currentPage,
    keyword: currentKeyword,
    setPage,
    setKeyword,
  } = useUrlPaginationQuery();
  const {
    values: { type },
    setValue,
  } = useUrlQueryState(RESOURCE_PICKER_QUERY_SCHEMA);
  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [inputValue, setInputValue] = useState(currentKeyword);
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
    setInputValue(currentKeyword);
  }, [currentKeyword]);

  useEffect(() => {
    void fetchResources(currentPage, currentKeyword, type);
  }, [fetchResources, currentPage, currentKeyword, type, refreshToken]);

  const handleSearch = (val: string) => {
    setInputValue(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKeyword(val, true);
    }, 300);
  };

  const handleType = (val: string) => {
    setValue('type', val as '' | 'wallpaper' | 'avatar');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="relative flex h-full flex-col gap-3">
      {/* 搜索 + 类型筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputValue}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索资源标题…"
            className="h-8 pl-8 text-sm"
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
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 资源网格 */}
      <div className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-muted/60 p-2">
        {fetching && resources.length === 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-sm">{currentKeyword ? '没有匹配的资源' : '暂无资源'}</span>
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
                      ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary) / 0.15)]'
                      : 'border-transparent hover:border-border'
                  }`}
                >
                  <div className="aspect-square bg-muted">
                    {resource.url ? (
                      <img
                        src={resource.thumbnailUrl || resource.url}
                        alt={resource.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                    )}
                  </div>

                  {/* 选中角标 */}
                  {selected && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow">
                      <svg
                        className="h-3 w-3 text-primary-foreground"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
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
                    <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                      <Crown className="h-2.5 w-2.5" />
                      封面
                    </div>
                  )}

                  {/* hover 悬浮信息 */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-full bg-linear-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 transition-transform group-hover:translate-y-0">
                    <p className="truncate text-[11px] font-semibold text-foreground">
                      {resource.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {/* 分类 */}
                      <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/90">
                        {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                      </span>
                      {/* 扩展名 */}
                      {resource.extension && (
                        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] uppercase text-foreground/90">
                          {resource.extension}
                        </span>
                      )}
                      {/* 分辨率 */}
                      {resource.width > 0 && resource.height > 0 && (
                        <span className="text-[10px] text-foreground/75">
                          {formatResolution(resource.width, resource.height)}
                        </span>
                      )}
                      {/* 文件大小 */}
                      {resource.size > 0 && (
                        <span className="text-[10px] text-foreground/75">
                          {formatSize(resource.size)}
                        </span>
                      )}
                    </div>
                    {resource.tags && resource.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {resource.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-foreground/18 bg-foreground/10 px-1.5 py-0.5 text-[10px] text-foreground/92 backdrop-blur-sm"
                          >
                            #{tag}
                          </span>
                        ))}
                        {resource.tags.length > 2 && (
                          <span className="text-[10px] text-foreground/75">
                            +{resource.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    {selected && !isCover && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetCover(resource.id);
                        }}
                        className="mt-1.5 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] text-foreground backdrop-blur-sm hover:bg-foreground/20"
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            第 {currentPage} / {totalPages} 页，共 {total} 项
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={currentPage <= 1 || fetching}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              className="rounded-lg px-2.5 py-1 hover:bg-accent disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || fetching}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              className="rounded-lg px-2.5 py-1 hover:bg-accent disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </div>
      )}
      <BoxLoadingOverlay
        show={fetching}
        title="正在同步资源库..."
        hint="筛选结果更新中"
        compact
        className="rounded-2xl"
      />
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
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 text-muted-foreground">
        <FolderOpen className="h-8 w-8 opacity-40" />
        <p className="text-sm">从左侧点击资源加入专辑</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-2xl border border-border bg-card/70 p-2">
      {selected.map((resource) => {
        const isCover = coverResourceId === resource.id;
        return (
          <div
            key={resource.id}
            className="group flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 shadow-sm transition hover:border-border"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              {resource.url ? (
                <img
                  src={resource.thumbnailUrl || resource.url}
                  alt={resource.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="m-auto h-5 w-5 text-muted-foreground/60" />
              )}
              {isCover && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/80">
                  <Crown className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{resource.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {resource.type === 'wallpaper' ? '壁纸' : '头像'}
              </p>
              {!isCover && (
                <button
                  type="button"
                  onClick={() => onSetCover(resource.id)}
                  className="mt-0.5 text-[10px] text-primary hover:underline"
                >
                  设为封面
                </button>
              )}
              {isCover && <span className="text-[10px] font-medium text-primary">当前封面</span>}
            </div>

            <button
              type="button"
              onClick={() => onRemove(resource.id)}
              className="shrink-0 rounded-lg p-1 text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive"
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
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [allResources, setAllResources] = useState<MyResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [albumUploadOpen, setAlbumUploadOpen] = useState(false);
  const [pickerRefreshToken, setPickerRefreshToken] = useState(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [coverResourceId, setCoverResourceId] = useState('');
  const coverTitle = allResources.find((r) => r.id === coverResourceId)?.title || '已设置';

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

  const refreshResourcePool = useCallback(async () => {
    try {
      const resourceData = await getMyResources({ page: 1, pageSize: 100 });
      setAllResources(resourceData.list || []);
    } catch {
      // request.ts 已统一处理
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void loadData();
  }, [hasHydrated, isAuthenticated, navigate, loadData]);

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

  const handleDelete = async (target: Album) => {
    try {
      setDeleting(true);
      await deleteCreatorAlbum(target.id);
      toast.success('资源专辑已删除');
      await loadData();
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteConfirm = (target: Album) => {
    if (deleting) return;
    openConfirmToast({
      title: `确认删除「${target.name}」？`,
      description: '专辑会消失，但其中资源本身不会被删除。',
      confirmText: '确认删除',
      cancelText: '取消',
      confirmVariant: 'danger',
      onConfirm: () => handleDelete(target),
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner padding="py-10" maxWidth="max-w-6xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-foreground/15 bg-foreground/10 p-3 shadow-lg backdrop-blur-md">
              <FolderOpen className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-primary-foreground">
              <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">资源专辑管理</h1>
              <p className="mt-1 text-sm text-primary-foreground/82">
                把作品整理成主题合集，创作者详情页会自动展示这些专辑入口。
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="rounded-2xl bg-card px-5 font-semibold text-primary shadow-lg hover:bg-card/92"
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
                className="overflow-hidden rounded-2xl border border-border bg-card/86 shadow-[0_18px_40px_hsl(var(--primary) / 0.10)] backdrop-blur-sm"
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
          <div className="rounded-[28px] border border-border bg-card/72 px-6 shadow-[0_20px_50px_hsl(var(--primary) / 0.10)] backdrop-blur-sm">
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
                className="overflow-hidden rounded-2xl border border-border bg-card/86 shadow-[0_18px_40px_hsl(var(--primary) / 0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_hsl(var(--primary) / 0.16)]"
              >
                <div className="relative h-44 overflow-hidden bg-accent">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-card/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                    {album.resourceCount} 项资源
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-foreground">{album.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {album.description || '暂未填写专辑说明'}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(album)}
                      className="rounded-xl border-accent bg-card/75 text-primary hover:bg-accent"
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteConfirm(album)}
                      className="rounded-xl border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
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
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle className="text-base font-semibold">
              {editingAlbum ? '编辑资源专辑' : '新建资源专辑'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* 基本信息栏 */}
            <div className="shrink-0 border-b border-border bg-muted/60 px-6 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">专辑名称 *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="例如：奶油风头像合集"
                    className="border-input h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">专辑说明</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="给访客一句简短说明（可选）"
                    className="border-input h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 左右双栏 */}
            <div className="flex min-h-0 flex-1 divide-x divide-border overflow-hidden">
              {/* 左：资源库 */}
              <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">资源库</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAlbumUploadOpen(true)}
                      className="h-7 rounded-lg border-accent bg-card/80 px-2.5 text-xs text-primary hover:bg-accent"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      新增资源
                    </Button>
                    <span className="text-xs text-muted-foreground">点击资源即可添加 / 移除</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ResourcePicker
                    selectedIds={selectedResourceIds}
                    coverResourceId={coverResourceId}
                    onToggle={toggleResource}
                    onSetCover={setCoverResourceId}
                    refreshToken={pickerRefreshToken}
                  />
                </div>
              </div>

              {/* 右：已选 */}
              <div className="flex w-56 shrink-0 flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">已选资源</p>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">
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
          <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">
              {coverResourceId ? `封面：${coverTitle}` : '未设置封面，将自动使用第一项资源'}
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

      <UploadResourceDialog
        open={albumUploadOpen}
        onOpenChange={setAlbumUploadOpen}
        onSuccess={() => {
          void refreshResourcePool();
          setPickerRefreshToken((prev) => prev + 1);
        }}
      />
    </div>
  );
}
