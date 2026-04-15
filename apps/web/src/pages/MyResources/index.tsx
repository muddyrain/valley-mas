import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type Album, getMyCreatorAlbums } from '@/api/creator';
import {
  batchDeleteResources,
  batchUpdateVisibility,
  deleteResource,
  getMyResources,
  type MyResource,
  type ResourceVisibility,
} from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import EditResourceDialog from '@/components/EditResourceDialog';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import UploadResourceDialog from '@/components/UploadResourceDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePageRoleGuard } from '@/hooks/usePageRoleGuard';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];
const PAGE_SIZE = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MyResources() {
  const navigate = useNavigate();
  const location = useLocation();
  const { page: currentPage, setPage } = useUrlPaginationQuery();
  const { canAccess } = usePageRoleGuard({
    allowRoles: ['creator'],
    unauthorizedMessage: '该页面仅创作者可访问',
  });

  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');

  // 上传弹窗状态
  const [uploadOpen, setUploadOpen] = useState(false);

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<MyResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 编辑弹窗状态
  const [editTarget, setEditTarget] = useState<MyResource | null>(null);

  // 专辑筛选
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [activeAlbumId, setActiveAlbumId] = useState('');

  // 批量操作状态
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchUpdatingVisibility, setBatchUpdatingVisibility] = useState(false);
  const [batchVisibilityOpen, setBatchVisibilityOpen] = useState(false);

  // 刷新状态
  const [refreshing, setRefreshing] = useState(false);

  const loadAlbums = useCallback(async () => {
    try {
      setAlbumsLoading(true);
      const data = await getMyCreatorAlbums();
      setAlbums(data.list || []);
    } catch {
      // 静默失败
    } finally {
      setAlbumsLoading(false);
    }
  }, []);
  const loadResources = useCallback(
    async (type = activeType, albumId = activeAlbumId, nextPage = currentPage) => {
      try {
        setLoading(true);
        const data = await getMyResources({
          page: nextPage,
          pageSize: PAGE_SIZE,
          type: type || undefined,
          albumId: albumId || undefined,
        });
        setResources(data.list || []);
        setTotal(data.total || 0);
      } catch {
        toast.error('加载资源失败');
      } finally {
        setLoading(false);
      }
    },
    [activeType, activeAlbumId, currentPage],
  );
  const loadResource = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadResources(activeType, activeAlbumId, currentPage);
    } finally {
      setRefreshing(false);
    }
  }, [activeAlbumId, activeType, loadResources, currentPage]);

  useEffect(() => {
    if (canAccess) {
      void loadAlbums();
    }
  }, [canAccess, loadAlbums]);

  useEffect(() => {
    if (canAccess) {
      void loadResources(activeType, activeAlbumId, currentPage);
    }
  }, [activeAlbumId, activeType, canAccess, loadResources, currentPage]);

  // 从详情页跳转过来时自动打开编辑弹框
  useEffect(() => {
    const editId = (location.state as { editResourceId?: string } | null)?.editResourceId;
    if (!editId || resources.length === 0) return;
    const target = resources.find((r) => r.id === editId);
    if (target) {
      handleOpenEdit(target);
      // 清掉 state，防止刷新再次触发
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, location.state]);

  // 删除资源
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteResource(deleteTarget.id);
      toast.success('删除成功');
      setDeleteTarget(null);
      if (resources.length === 1 && currentPage > 1) {
        setPage(currentPage - 1);
      } else {
        void loadResources(activeType, activeAlbumId, currentPage);
      }
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setDeleting(false);
    }
  };

  // 批量选择
  const handleSelect = (resource: MyResource, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(resource.id);
      else next.delete(resource.id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === resources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(resources.map((r) => r.id)));
    }
  };

  const handleExitBatch = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  // 批量删除
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBatchDeleting(true);
      const result = await batchDeleteResources(ids);
      toast.success(`已删除 ${result.deleted} 个资源`);
      handleExitBatch();
      if (selectedIds.size >= resources.length && currentPage > 1) {
        setPage(currentPage - 1);
      } else {
        void loadResources(activeType, activeAlbumId, currentPage);
      }
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setBatchDeleting(false);
    }
  };

  // 批量设置访问范围
  const handleBatchVisibility = async (visibility: ResourceVisibility) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      setBatchUpdatingVisibility(true);
      const result = await batchUpdateVisibility(ids, visibility);
      toast.success(`已更新 ${result.updated} 个资源的访问范围`);
      // 本地同步更新
      setResources((prev) => prev.map((r) => (selectedIds.has(r.id) ? { ...r, visibility } : r)));
      setBatchVisibilityOpen(false);
      handleExitBatch();
    } catch {
      // 错误已在 request.ts 中通过 toast 显示
    } finally {
      setBatchUpdatingVisibility(false);
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (resource: MyResource) => {
    setEditTarget(resource);
  };

  if (!canAccess) return null;

  const selectedCount = selectedIds.size;
  const allSelected = resources.length > 0 && selectedIds.size === resources.length;
  const activeAlbum = albums.find((a) => a.id === activeAlbumId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleAlbumClick = (albumId: string) => {
    if (batchMode) handleExitBatch();
    setPage(1);
    setActiveAlbumId(albumId);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        {/* 页头 */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/my-space')}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-theme-primary transition-colors"
            >
              ← 返回创作空间
            </button>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">资源管理</h1>
            <p className="mt-1 text-sm text-slate-500">管理你上传的全部壁纸与头像资源</p>
          </div>
          <div className="flex items-center gap-3">
            {!batchMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    loadResource();
                  }}
                  disabled={refreshing || loading}
                  className="gap-2 border-slate-200 text-slate-600 hover:border-theme-soft-strong hover:text-theme-primary"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  刷新
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBatchMode(true)}
                  className="gap-2 border-slate-200 text-slate-600 hover:border-theme-soft-strong hover:text-theme-primary"
                  disabled={resources.length === 0}
                >
                  <CheckSquare className="h-4 w-4" />
                  批量操作
                </Button>
                <Button
                  onClick={() => setUploadOpen(true)}
                  className="theme-btn-primary gap-2 font-semibold shadow-md"
                >
                  <Plus className="h-4 w-4" />
                  上传新资源
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={handleExitBatch}
                className="gap-2 border-slate-200 text-slate-500"
              >
                <X className="h-4 w-4" />
                退出批量
              </Button>
            )}
          </div>
        </div>

        {/* ── 左右分栏 ── */}
        <div className="flex gap-5 items-start">
          {/* ── 左侧专辑侧边栏 ── */}
          <aside className="w-52 shrink-0 sticky top-6">
            <div className="rounded-[28px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.98),rgba(255,255,255,0.92))] p-3 shadow-[0_18px_48px_rgba(148,163,184,0.10)]">
              {/* 侧边栏头 */}
              <div className="mb-2 flex items-center justify-between px-1 py-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  专辑分类
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/my-space/albums')}
                  className="text-[11px] text-theme-primary hover:underline"
                >
                  管理
                </button>
              </div>

              {/* 全部资源 */}
              <button
                type="button"
                onClick={() => handleAlbumClick('')}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all ${
                  activeAlbumId === ''
                    ? 'bg-theme-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate font-medium">全部资源</span>
                {activeAlbumId === '' && (
                  <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-medium">
                    {total}
                  </span>
                )}
              </button>

              {/* 专辑列表 */}
              {albumsLoading ? (
                <div className="space-y-1.5 px-1 py-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : albums.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-2 py-5 text-center">
                  <FolderOpen className="h-7 w-7 text-slate-300" />
                  <p className="text-xs text-slate-400 leading-relaxed">暂无专辑，去管理页创建吧</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {albums.map((album) => (
                    <button
                      key={album.id}
                      type="button"
                      onClick={() => handleAlbumClick(album.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-all ${
                        activeAlbumId === album.id
                          ? 'bg-theme-primary text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-md bg-slate-200">
                        {album.coverUrl ? (
                          <img
                            src={album.coverUrl}
                            alt={album.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FolderOpen
                            className={`h-full w-full p-1 ${activeAlbumId === album.id ? 'text-white/70' : 'text-slate-400'}`}
                          />
                        )}
                      </div>
                      <span className="flex-1 truncate font-medium">{album.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          activeAlbumId === album.id
                            ? 'bg-white/25 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {album.resourceCount}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* ── 右侧资源区 ── */}
          <div className="min-w-0 flex-1">
            <div className="rounded-[36px] border border-[#d9e7f3] bg-[linear-gradient(180deg,rgba(248,252,255,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_22px_56px_rgba(148,163,184,0.1)] md:p-6">
              {/* 专辑标题提示 */}
              {activeAlbum && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-theme-soft-strong bg-theme-soft/50 px-4 py-2">
                    <FolderOpen className="h-4 w-4 text-theme-primary" />
                    <span className="text-sm font-semibold text-theme-primary">
                      {activeAlbum.name}
                    </span>
                    {activeAlbum.description && (
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        · {activeAlbum.description}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAlbumClick('')}
                    className="text-xs text-slate-400 transition-colors hover:text-slate-600"
                  >
                    × 清除
                  </button>
                </div>
              )}

              <TypeFilterBar
                options={RESOURCE_TYPES}
                value={activeType}
                onChange={(v) => {
                  setPage(1);
                  setActiveType(v);
                  if (batchMode) handleExitBatch();
                }}
                prefix="资源类型："
                extra={<span className="text-sm text-slate-400">共 {total} 个资源</span>}
                className="mb-6"
              />

              <div className="relative min-h-[320px]">
                {loading ? (
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <ResourceCardSkeleton key={i} />
                    ))}
                  </div>
                ) : resources.length === 0 ? (
                  <div className="rounded-4xl bg-white/60 p-4">
                    <EmptyState
                      icon={activeAlbum ? FolderOpen : ImageIcon}
                      title={
                        activeAlbum ? `专辑「${activeAlbum.name}」暂无资源` : '还没有上传任何资源'
                      }
                      description={
                        activeAlbum
                          ? '可以前往专辑管理页把资源加入此专辑。'
                          : '点击右上角「上传新资源」，把第一张壁纸或头像放进来。'
                      }
                      actionLabel={activeAlbum ? '管理专辑' : '立即上传'}
                      onAction={
                        activeAlbum ? () => navigate('/my-space/albums') : () => setUploadOpen(true)
                      }
                    />
                  </div>
                ) : (
                  <>
                    {/* 批量操作工具栏 */}
                    {batchMode && (
                      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-theme-soft-strong bg-theme-soft/40 px-4 py-3">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-theme-primary transition-colors"
                        >
                          {allSelected ? (
                            <CheckSquare className="h-4 w-4 text-theme-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          {allSelected ? '取消全选' : '全选'}
                        </button>
                        <span className="text-sm text-slate-400">
                          已选{' '}
                          <span className="font-semibold text-theme-primary">{selectedCount}</span>{' '}
                          个
                        </span>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={selectedCount === 0 || batchUpdatingVisibility}
                            onClick={() => setBatchVisibilityOpen(true)}
                            className="gap-1.5 text-slate-600 hover:border-theme-soft-strong hover:text-theme-primary"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            设置访问范围
                          </Button>
                          <Button
                            size="sm"
                            disabled={selectedCount === 0 || batchDeleting}
                            onClick={handleBatchDelete}
                            className="gap-1.5 bg-red-500 text-white hover:bg-red-600"
                          >
                            {batchDeleting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            批量删除
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                      {resources.map((resource, i) => (
                        <ResourceCard
                          key={resource.id}
                          resource={resource}
                          onDelete={batchMode ? undefined : setDeleteTarget}
                          onEdit={batchMode ? undefined : handleOpenEdit}
                          showSize
                          showDate
                          showVisibilityTag
                          showTags
                          animationDelay={i * 30}
                          selectable={batchMode}
                          selected={selectedIds.has(resource.id)}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-6 flex items-center justify-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage <= 1 || loading}
                          onClick={() => {
                            if (batchMode) handleExitBatch();
                            setPage(Math.max(1, currentPage - 1));
                          }}
                          className="gap-1.5"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          上一页
                        </Button>
                        <span className="text-sm text-slate-500">
                          第 {currentPage} / {totalPages} 页，共 {total} 项
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage >= totalPages || loading}
                          onClick={() => {
                            if (batchMode) handleExitBatch();
                            setPage(Math.min(totalPages, currentPage + 1));
                          }}
                          className="gap-1.5"
                        >
                          下一页
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <BoxLoadingOverlay
                  show={loading}
                  title={resources.length > 0 ? '正在同步资源列表...' : '正在加载资源列表...'}
                  hint={resources.length > 0 ? '分页和筛选结果更新中' : '首次加载可能稍慢，请稍候'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <UploadResourceDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          setPage(1);
          void loadResources(activeType, activeAlbumId, 1);
        }}
      />

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

      {/* ===== 编辑弹窗（抽离为独立组件） ===== */}
      <EditResourceDialog
        resource={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSuccess={(updated) => {
          setResources((prev) =>
            prev.map((r) =>
              r.id === updated.id
                ? {
                    ...r,
                    title: updated.title,
                    description: updated.description,
                    type: updated.type as MyResource['type'],
                    visibility: updated.visibility,
                  }
                : r,
            ),
          );
          loadResource();
        }}
      />

      {/* ===== 批量设置访问范围弹窗 ===== */}
      <Dialog open={batchVisibilityOpen} onOpenChange={setBatchVisibilityOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Globe className="h-5 w-5 text-theme-primary" />
              批量设置访问范围
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500">
              将以下 <span className="font-semibold text-slate-700">{selectedCount}</span>{' '}
              个资源统一设为：
            </p>
            <div className="flex flex-col gap-2.5">
              {[
                {
                  value: 'public' as const,
                  icon: Globe,
                  label: '🌐 公开',
                  desc: '所有人可见，出现在资源广场',
                  color:
                    'text-emerald-600 border-emerald-200 bg-emerald-50 hover:border-emerald-400',
                },
                {
                  value: 'shared' as const,
                  icon: Users,
                  label: '🔗 共享',
                  desc: '有链接或口令才可访问',
                  color: 'text-sky-600 border-sky-200 bg-sky-50 hover:border-sky-400',
                },
                {
                  value: 'private' as const,
                  icon: Lock,
                  label: '🔒 私密',
                  desc: '仅自己可见',
                  color: 'text-slate-600 border-slate-200 bg-slate-50 hover:border-slate-400',
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={batchUpdatingVisibility}
                  onClick={() => void handleBatchVisibility(opt.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all disabled:opacity-60 ${opt.color}`}
                >
                  <opt.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-70">{opt.desc}</div>
                  </div>
                  {batchUpdatingVisibility && (
                    <Loader2 className="ml-auto mt-0.5 h-4 w-4 animate-spin opacity-60" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setBatchVisibilityOpen(false)}
            disabled={batchUpdatingVisibility}
          >
            取消
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
