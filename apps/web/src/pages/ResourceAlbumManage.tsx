import { FolderOpen, ImageIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

export default function ResourceAlbumManage() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated, user } = useAuthStore();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [resources, setResources] = useState<MyResource[]>([]);
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
  }, [hasHydrated, isAuthenticated, navigate, user?.role]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [albumData, resourceData] = await Promise.all([
        getMyCreatorAlbums(),
        getMyResources({ page: 1, pageSize: 100 }),
      ]);
      setAlbums(albumData.list || []);
      setResources(resourceData.list || []);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
    }
  };

  const selectedResources = useMemo(
    () => resources.filter((item) => selectedResourceIds.includes(item.id)),
    [resources, selectedResourceIds],
  );

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
    setSelectedResourceIds(album.resources?.map((item) => item.id) || []);
    setCoverResourceId(album.coverResourceId || '');
    setDialogOpen(true);
  };

  const toggleResource = (resourceId: string) => {
    setSelectedResourceIds((prev) => {
      if (prev.includes(resourceId)) {
        const next = prev.filter((id) => id !== resourceId);
        if (coverResourceId === resourceId) {
          setCoverResourceId(next[0] || '');
        }
        return next;
      }
      const next = [...prev, resourceId];
      if (!coverResourceId) {
        setCoverResourceId(resourceId);
      }
      return next;
    });
  };

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
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-slate-900">
                        {album.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {album.description || '暂未填写专辑说明'}
                      </p>
                    </div>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAlbum ? '编辑资源专辑' : '新建资源专辑'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">专辑名称</label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：奶油风头像合集"
                  className="theme-input-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">专辑说明</label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="给访客一句简短说明"
                  className="theme-input-border"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-700">专辑资源</h3>
                  <p className="text-xs text-slate-500">
                    勾选后会出现在这个专辑里，专辑封面也从已选资源里挑。
                  </p>
                </div>
                <span className="rounded-full bg-theme-soft px-3 py-1 text-xs font-medium text-theme-primary">
                  已选 {selectedResourceIds.length} 项
                </span>
              </div>

              {resources.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme-shell-border bg-theme-soft/50 px-4 py-8 text-center text-sm text-slate-500">
                  你还没有可加入专辑的资源，先去创作者空间上传一些作品吧。
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {resources.map((resource) => {
                    const checked = selectedResourceIds.includes(resource.id);
                    const isCover = coverResourceId === resource.id;

                    return (
                      <label
                        key={resource.id}
                        className={`cursor-pointer rounded-2xl border p-3 transition ${
                          checked
                            ? 'border-theme-soft-strong bg-theme-soft/55 shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.10)]'
                            : 'border-slate-200 bg-white hover:border-theme-shell-border'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleResource(resource.id)}
                            className="mt-1 h-4 w-4 accent-[var(--theme-primary)]"
                          />
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {resource.url ? (
                              <img
                                src={resource.url}
                                alt={resource.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-slate-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {resource.title}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {resource.type === 'wallpaper' ? '壁纸' : '头像'}
                            </div>
                            {checked ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  setCoverResourceId(resource.id);
                                }}
                                className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                  isCover
                                    ? 'bg-theme-primary text-white'
                                    : 'bg-white text-theme-primary ring-1 ring-theme-soft-strong hover:bg-theme-soft'
                                }`}
                              >
                                {isCover ? '当前封面' : '设为封面'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedResources.length > 0 ? (
              <div className="rounded-2xl border border-theme-shell-border bg-white/82 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">封面预览</h3>
                    <p className="text-xs text-slate-500">默认使用你设为封面的那项资源。</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {selectedResources.find((item) => item.id === coverResourceId)?.title ||
                      '未选择'}
                  </span>
                </div>
                <div className="h-40 overflow-hidden rounded-2xl bg-theme-soft">
                  {selectedResources.find((item) => item.id === coverResourceId)?.url ? (
                    <img
                      src={selectedResources.find((item) => item.id === coverResourceId)?.url}
                      alt="专辑封面预览"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-theme-primary/50" />
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
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
              确认删除“{deleteTarget?.name}”？专辑会消失，但其中资源本身不会被删除。
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
