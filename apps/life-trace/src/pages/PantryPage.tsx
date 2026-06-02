import {
  Apple,
  Archive,
  BadgeAlert,
  Camera,
  ClipboardList,
  Milk,
  PackagePlus,
  Pill,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPantry } from '@/api/pantry';
import { EmptyState } from '@/components/EmptyState';
import { PantryItemDrawer } from '@/components/PantryItemDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  buildPantryTraceInput,
  getPantryCoverUrl,
  getPantryExpiryText,
  getPantryStatusLabel,
  getPantryStatusTone,
  resolvePantryStatus,
} from '@/lib/pantry';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { ListPagination, PantryCategory, PantryItem, PantryItemStatus } from '@/types';

const statusFilters: Array<{ id: PantryItemStatus | 'all'; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'expiring', label: '临期' },
  { id: 'expired', label: '已过期' },
  { id: 'used-up', label: '已用完' },
  { id: 'discarded', label: '已丢弃' },
];

const categoryFilters: Array<PantryCategory | 'all'> = [
  'all',
  '食品',
  '日用品',
  '药品',
  '宠物',
  '其他',
];

const categoryIconMap = {
  食品: Apple,
  日用品: Archive,
  药品: Pill,
  宠物: Milk,
  其他: ClipboardList,
} satisfies Record<PantryCategory, typeof Apple>;

const PANTRY_PAGE_SIZE = 20;
const emptyPagination: ListPagination = {
  page: 1,
  pageSize: PANTRY_PAGE_SIZE,
  total: 0,
  hasMore: false,
};

type PantryOverviewState = {
  total: number;
  expiring: number;
  expired: number;
  active: number;
};

export function PantryPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const pantryError = useLifeTraceStore((state) => state.pantryError);
  const updatePantryItemStatus = useLifeTraceStore((state) => state.updatePantryItemStatus);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<PantryItemStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<PantryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [pantryList, setPantryList] = useState<PantryItem[]>([]);
  const [pantryLoaded, setPantryLoaded] = useState(false);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [pantryLoadingMore, setPantryLoadingMore] = useState(false);
  const [pantryListError, setPantryListError] = useState('');
  const [pantryPagination, setPantryPagination] = useState<ListPagination>(emptyPagination);
  const [overview, setOverview] = useState<PantryOverviewState>({
    total: 0,
    expiring: 0,
    expired: 0,
    active: 0,
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const pantryRequestIdRef = useRef(0);

  const pantryQueryOptions = useMemo(
    () => ({
      status: statusFilter,
      category: categoryFilter,
      q: debouncedSearchQuery.trim() || undefined,
    }),
    [categoryFilter, debouncedSearchQuery, statusFilter],
  );

  const loadPantryPage = useCallback(
    async (page: number, mode: 'replace' | 'append') => {
      if (!token) {
        setPantryList([]);
        setPantryLoaded(true);
        setPantryLoading(false);
        setPantryLoadingMore(false);
        setPantryListError('');
        setPantryPagination(emptyPagination);
        return;
      }

      const requestId = ++pantryRequestIdRef.current;
      if (mode === 'append') {
        setPantryLoadingMore(true);
      } else {
        setPantryLoading(true);
      }
      setPantryListError('');

      try {
        const { list, pagination } = await listPantry(token, {
          page,
          pageSize: PANTRY_PAGE_SIZE,
          ...pantryQueryOptions,
        });
        if (requestId !== pantryRequestIdRef.current) {
          return;
        }

        const nextPagination = pagination ?? {
          page,
          pageSize: PANTRY_PAGE_SIZE,
          total: list.length,
          hasMore: false,
        };

        setPantryLoaded(true);
        setPantryPagination(nextPagination);
        setPantryList((current) => {
          if (mode === 'replace') {
            return list;
          }
          const existingIds = new Set(current.map((item) => item.id));
          return [...current, ...list.filter((item) => !existingIds.has(item.id))];
        });
      } catch (error) {
        if (requestId !== pantryRequestIdRef.current) {
          return;
        }
        setPantryLoaded(true);
        setPantryListError(error instanceof Error ? error.message : '获取库存失败');
      } finally {
        if (requestId === pantryRequestIdRef.current) {
          setPantryLoading(false);
          setPantryLoadingMore(false);
        }
      }
    },
    [pantryQueryOptions, token],
  );

  const refreshOverview = useCallback(async () => {
    if (!token) {
      setOverview({ total: 0, expiring: 0, expired: 0, active: 0 });
      return;
    }

    try {
      const [allResult, expiringResult, expiredResult] = await Promise.all([
        listPantry(token, { page: 1, pageSize: 1 }),
        listPantry(token, { page: 1, pageSize: 1, status: 'expiring' }),
        listPantry(token, { page: 1, pageSize: 1, status: 'expired' }),
      ]);

      const total = allResult.pagination?.total ?? allResult.list.length;
      const expiring = expiringResult.pagination?.total ?? expiringResult.list.length;
      const expired = expiredResult.pagination?.total ?? expiredResult.list.length;
      setOverview({
        total,
        expiring,
        expired,
        active: Math.max(total - expired, 0),
      });
    } catch {
      // Ignore overview refresh failures and keep the last successful snapshot.
    }
  }, [token]);

  const loadMorePantryItems = useCallback(async () => {
    if (pantryLoading || pantryLoadingMore || !pantryPagination.hasMore) {
      return;
    }

    await loadPantryPage(pantryPagination.page + 1, 'append');
  }, [loadPantryPage, pantryLoading, pantryLoadingMore, pantryPagination]);

  const handleStatusAction = async (item: PantryItem, status: 'used-up' | 'discarded') => {
    if (pendingActionId) {
      return;
    }

    setPendingActionId(`${item.id}:${status}`);
    try {
      const updated = await updatePantryItemStatus(item.id, status);
      if (!updated) {
        return;
      }
      await addTrace(buildPantryTraceInput(updated, status));
      void loadPantryPage(1, 'replace');
      void refreshOverview();
    } finally {
      setPendingActionId(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 240);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    void loadPantryPage(1, 'replace');
  }, [loadPantryPage]);

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  useEffect(() => {
    if (!saveMessage) {
      return;
    }

    const timer = window.setTimeout(() => setSaveMessage(''), 1800);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  useEffect(() => {
    if (pantryLoading || pantryLoadingMore || !pantryPagination.hasMore) {
      return;
    }

    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMorePantryItems();
        }
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMorePantryItems, pantryLoading, pantryLoadingMore, pantryPagination.hasMore]);

  const activePantryError = pantryListError || pantryError;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className="text-sm text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/today')}
          >
            返回今日
          </button>
          <h1 className="mt-2 text-3xl font-bold tracking-tight max-[360px]:text-2xl">家庭库存</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            先看临期，再决定今晚该吃什么、该补什么。
          </p>
        </div>
        <Button
          type="button"
          variant="ai"
          size="sm"
          onClick={() => {
            setEditingItem(null);
            setDrawerOpen(true);
          }}
        >
          <PackagePlus className="size-4" />
          添加
        </Button>
      </header>

      <section className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
        <Card className="border-life-health/20 bg-life-health/10 p-4">
          <p className="text-sm font-semibold text-life-health">临期</p>
          <p className="mt-2 text-2xl font-bold">{overview.expiring}</p>
          <p className="mt-1 text-xs text-muted-foreground">7 天内需要处理</p>
        </Card>
        <Card className="border-life-alert/20 bg-life-alert/10 p-4">
          <p className="text-sm font-semibold text-life-alert">已过期</p>
          <p className="mt-2 text-2xl font-bold">{overview.expired}</p>
          <p className="mt-1 text-xs text-muted-foreground">需要尽快确认</p>
        </Card>
        <Card className="border-life-ai/20 bg-life-ai/10 p-4">
          <p className="text-sm font-semibold text-life-ai">库存总数</p>
          <p className="mt-2 text-2xl font-bold">{overview.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">当前可管理条目</p>
        </Card>
      </section>

      <Card className="space-y-3 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜名称、位置或备注"
            className="h-11 w-full rounded-2xl border border-border bg-secondary pr-4 pl-10 text-sm outline-none transition focus:border-ring"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">筛选</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {statusFilter === 'all' ? '全部状态' : `状态：${getPantryStatusLabel(statusFilter)}`}
              {categoryFilter === 'all' ? ' · 全部分类' : ` · 分类：${categoryFilter}`}
            </p>
          </div>
          {statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
            >
              清空
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 rounded-2xl bg-secondary p-1 text-sm font-semibold text-muted-foreground max-[360px]:grid-cols-2">
          {statusFilters.map((filter) => {
            const active = statusFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                className={cn(
                  'min-h-10 rounded-xl px-2 py-2 transition',
                  active ? 'bg-card text-foreground shadow-sm' : 'hover:text-foreground',
                )}
                onClick={() => setStatusFilter(filter.id)}
                aria-pressed={active}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">分类</span>
          {categoryFilters.map((category) => {
            const active = categoryFilter === category;
            return (
              <button
                key={category}
                type="button"
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition',
                  active
                    ? 'border-life-plan/45 bg-life-plan/10 text-life-plan'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setCategoryFilter(category)}
                aria-pressed={active}
              >
                {category === 'all' ? '全部分类' : category}
              </button>
            );
          })}
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">库存列表</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              列表优先展示真实图片，没有 `imageUrl` 才会回退到 AI 缩略图。
            </p>
          </div>
          <div className="inline-flex min-w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap text-foreground">
            <span>{pantryPagination.total}</span>
            <span className="ml-1 text-muted-foreground">条</span>
          </div>
        </div>

        {activePantryError ? (
          <Card className="border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
            {activePantryError}
          </Card>
        ) : null}

        {pantryLoading && !pantryLoaded ? (
          <Card className="p-5 text-sm text-muted-foreground">正在同步家庭库存...</Card>
        ) : pantryList.length === 0 ? (
          <EmptyState
            title={
              statusFilter === 'all' && categoryFilter === 'all' && !debouncedSearchQuery
                ? '还没有库存条目'
                : '暂无匹配库存'
            }
            description={
              statusFilter === 'all' && categoryFilter === 'all' && !debouncedSearchQuery
                ? '先加一盒牛奶、一袋生菜或一瓶洗衣液，Life Trace 才能开始提醒你。'
                : '换个筛选条件，或者把搜索词放宽一点试试。'
            }
            eyebrow={
              statusFilter === 'all' && categoryFilter === 'all' && !debouncedSearchQuery
                ? '库存为空'
                : '筛选结果'
            }
            tone="plan"
            icon={PackagePlus}
            action={
              statusFilter !== 'all' || categoryFilter !== 'all' || debouncedSearchQuery ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setSearchQuery('');
                  }}
                >
                  清空筛选
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ai"
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setDrawerOpen(true);
                  }}
                >
                  <PackagePlus className="size-4" />
                  添加库存
                </Button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {pantryList.map((item) => {
              const status = resolvePantryStatus(item);
              const coverUrl = getPantryCoverUrl(item);
              const useContainedCover = !item.imageUrl && Boolean(item.thumbnailUrl);
              const Icon = categoryIconMap[item.category];
              const usedUpPending = pendingActionId === `${item.id}:used-up`;
              const discardedPending = pendingActionId === `${item.id}:discarded`;
              const actionPending = usedUpPending || discardedPending;

              return (
                <Card key={item.id} className="overflow-hidden p-0">
                  <button
                    type="button"
                    className="flex w-full items-stretch gap-0 text-left"
                    onClick={() => {
                      setEditingItem(item);
                      setDrawerOpen(true);
                    }}
                  >
                    <div className="grid w-26 shrink-0 place-items-center bg-secondary max-[360px]:w-24">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={item.name}
                          className={cn(
                            'h-full min-h-28 w-full',
                            useContainedCover ? 'bg-secondary p-2 object-contain' : 'object-cover',
                          )}
                        />
                      ) : (
                        <div className="grid size-14 place-items-center rounded-3xl bg-life-ai/10 text-life-ai">
                          <Icon className="size-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={getPantryStatusTone(status)}>
                              {getPantryStatusLabel(status)}
                            </Badge>
                            <Badge tone="default">{item.category}</Badge>
                          </div>
                          <h3 className="mt-2 truncate text-base font-semibold">{item.name}</h3>
                        </div>
                        {!item.imageUrl && item.thumbnailUrl ? (
                          <Badge tone="ai">
                            <Sparkles className="mr-1 size-3.5" />
                            AI 图
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.location} · {item.quantity}
                        {item.unit}
                      </p>
                      <p
                        className={cn(
                          'mt-1 text-sm',
                          status === 'expired'
                            ? 'text-life-alert'
                            : status === 'expiring'
                              ? 'text-life-health'
                              : 'text-muted-foreground',
                        )}
                      >
                        {getPantryExpiryText(item)}
                      </p>
                      {item.note ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <div className="grid grid-cols-3 gap-px border-t border-border bg-border/60">
                    <button
                      type="button"
                      disabled={actionPending}
                      className="flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold text-life-trace transition hover:bg-life-trace/10 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => handleStatusAction(item, 'used-up')}
                    >
                      <BadgeAlert className="size-4" />
                      {usedUpPending ? '处理中...' : '用完'}
                    </button>
                    <button
                      type="button"
                      disabled={actionPending}
                      className="flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold text-life-alert transition hover:bg-life-alert/10 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => handleStatusAction(item, 'discarded')}
                    >
                      <Trash2 className="size-4" />
                      {discardedPending ? '处理中...' : '丢弃'}
                    </button>
                    <button
                      type="button"
                      disabled={actionPending}
                      className="flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold text-life-ai transition hover:bg-life-ai/10 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        setEditingItem(item);
                        setDrawerOpen(true);
                      }}
                    >
                      <Camera className="size-4" />
                      编辑
                    </button>
                  </div>
                </Card>
              );
            })}
            {pantryPagination.hasMore ? (
              <div ref={loadMoreRef} className="flex flex-col items-center gap-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  {pantryLoadingMore
                    ? '正在加载更多库存...'
                    : `已加载 ${pantryList.length}/${pantryPagination.total}`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pantryLoadingMore}
                  onClick={() => void loadMorePantryItems()}
                >
                  {pantryLoadingMore ? '加载中...' : '加载更多'}
                </Button>
              </div>
            ) : pantryList.length > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                已展示全部 {pantryPagination.total} 条库存
              </p>
            ) : null}
          </div>
        )}
      </section>

      <PantryItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        item={editingItem}
        onSaved={(message) => {
          setSaveMessage(message);
          void loadPantryPage(1, 'replace');
          void refreshOverview();
        }}
      />
      {saveMessage ? (
        <div className="fixed right-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] left-4 z-30 mx-auto max-w-[360px] rounded-2xl border border-life-trace/30 bg-card px-4 py-3 text-center text-sm font-medium text-life-trace shadow-2xl">
          {saveMessage}
        </div>
      ) : null}
    </div>
  );
}
