import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  deleteResource,
  getMyResources,
  type MyResource,
  type ResourceVisibility,
} from '@/api/resource';
import EditResourceDialog from '@/components/EditResourceDialog';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { enumParam, numberParam, useUrlQueryState } from '@/hooks/useUrlPaginationQuery';

const PAGE_SIZE = 24;

const TYPE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const VISIBILITY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '私密', value: 'private' },
  { label: '共享', value: 'shared' },
  { label: '公开', value: 'public' },
];

const QUERY_SCHEMA = {
  page: numberParam(1, { min: 1 }),
  type: enumParam(['', 'wallpaper', 'avatar'] as const, '', { resetPageOnChange: true }),
  visibility: enumParam(['', 'private', 'shared', 'public'] as const, '', {
    resetPageOnChange: true,
  }),
};

export default function StudioImageLibrary() {
  const navigate = useNavigate();
  const {
    values: { page, type, visibility },
    setValue,
  } = useUrlQueryState(QUERY_SCHEMA, { pageKey: 'page' });
  const requestSequence = useRef(0);
  const [resources, setResources] = useState<MyResource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editTarget, setEditTarget] = useState<MyResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MyResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const requestParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      type: type || undefined,
      visibility: (visibility || undefined) as ResourceVisibility | undefined,
    }),
    [page, type, visibility],
  );

  const loadResources = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await getMyResources(requestParams);
      if (sequence !== requestSequence.current) return;
      setResources(result.list || []);
      setTotal(result.total || 0);
    } catch {
      if (sequence === requestSequence.current) {
        toast.error('暂时无法读取图片，请稍后重试');
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [requestParams]);

  useEffect(() => {
    void loadResources();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadResources]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadResources();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteResource(deleteTarget.id);
      toast.success('图片已删除');
      setDeleteTarget(null);
      if (resources.length === 1 && page > 1) {
        setValue('page', page - 1);
      } else {
        await loadResources();
      }
    } catch {
      // 统一请求层已展示错误提示，保留当前确认上下文便于重试。
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <header className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
            IMAGE LIBRARY
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
            图片库
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            在这里查看全部图片，调整展示方式与访问范围。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} />
            刷新
          </Button>
          <Button type="button" onClick={() => navigate('/studio/images/import')}>
            <ImagePlus />
            导入图片
          </Button>
        </div>
      </header>

      <section className="py-7" aria-label="图片筛选">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TypeFilterBar
              options={TYPE_OPTIONS}
              value={type}
              onChange={(value) => setValue('type', value as '' | 'wallpaper' | 'avatar')}
              prefix="类型"
            />
            <TypeFilterBar
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(value) =>
                setValue('visibility', value as '' | 'private' | 'shared' | 'public')
              }
              prefix="范围"
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? '正在读取图片…' : `共 ${total} 张`}
          </p>
        </div>
      </section>

      <section className="min-h-[28rem]" aria-label="我的图片">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <ResourceCardSkeleton key={index} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6">
            <EmptyState
              icon={Images}
              title={type || visibility ? '没有符合条件的图片' : '还没有导入图片'}
              description={
                type || visibility
                  ? '换一个筛选条件，或去导入新的图片。'
                  : '选择一批图片整理后，它们会出现在这里。'
              }
              actionLabel="导入图片"
              onAction={() => navigate('/studio/images/import')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {resources.map((resource, index) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onClick={setEditTarget}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                showVisibilityTag
                showDate
                showSize
                showTags
                enablePreview={false}
                animationDelay={Math.min(index, 8) * 35}
              />
            ))}
          </div>
        )}
      </section>

      {!loading && total > 0 ? (
        <nav
          className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
          aria-label="图片列表分页"
        >
          <p className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setValue('page', page - 1)}
            >
              <ChevronLeft />
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setValue('page', page + 1)}
            >
              下一页
              <ChevronRight />
            </Button>
          </div>
        </nav>
      ) : null}

      <EditResourceDialog
        resource={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSuccess={(updated) => {
          setResources((current) =>
            current.map((resource) =>
              resource.id === updated.id ? { ...resource, ...updated } : resource,
            ),
          );
          setEditTarget(null);
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除这张图片？</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}”会从图片库中永久删除，已引用它的页面也可能失去图片。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              删除图片
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
