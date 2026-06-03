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
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { LoadErrorState } from '@/components/LoadErrorState';
import { PantryItemDrawer } from '@/components/PantryItemDrawer';
import { SyncState } from '@/components/SyncState';
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
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { PantryCategory, PantryItem, PantryItemStatus } from '@/types';

const statusFilters: Array<{ id: PantryItemStatus | 'all'; label: string }> = [
  { id: 'all', label: '在库' },
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

function readStatusFilter(params: URLSearchParams): PantryItemStatus | 'all' {
  const value = params.get('status');
  if (value && statusFilters.some((item) => item.id === value)) {
    return value as PantryItemStatus | 'all';
  }
  return 'all';
}

function readCategoryFilter(params: URLSearchParams): PantryCategory | 'all' {
  const value = params.get('category');
  if (value && categoryFilters.includes(value as PantryCategory | 'all')) {
    return value as PantryCategory | 'all';
  }
  return 'all';
}

function readQueryText(params: URLSearchParams) {
  return params.get('q')?.trim() ?? '';
}

function updateSearchParams(
  current: URLSearchParams,
  updates: {
    status?: PantryItemStatus | 'all';
    category?: PantryCategory | 'all';
    q?: string;
  },
) {
  const next = new URLSearchParams(current);

  if (updates.status !== undefined) {
    if (updates.status === 'all') {
      next.delete('status');
    } else {
      next.set('status', updates.status);
    }
  }

  if (updates.category !== undefined) {
    if (updates.category === 'all') {
      next.delete('category');
    } else {
      next.set('category', updates.category);
    }
  }

  if (updates.q !== undefined) {
    const value = updates.q.trim();
    if (value) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
  }

  return next;
}

export function PantryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const pantryList = useLifeTraceStore((state) => state.pantryListItems);
  const pantryLoaded = useLifeTraceStore((state) => state.pantryListLoaded);
  const pantryLoading = useLifeTraceStore((state) => state.pantryListLoading);
  const pantryLoadingMore = useLifeTraceStore((state) => state.pantryListLoadingMore);
  const pantryListError = useLifeTraceStore((state) => state.pantryListError);
  const pantryPagination = useLifeTraceStore((state) => state.pantryListPagination);
  const pantryResolvedHouseholdId = useLifeTraceStore(
    (state) => state.pantryListResolvedHouseholdId,
  );
  const pantryResolvedHouseholdName = useLifeTraceStore(
    (state) => state.pantryListResolvedHouseholdName,
  );
  const pantrySummary = useLifeTraceStore((state) => state.pantryListSummary);
  const loadPantryList = useLifeTraceStore((state) => state.loadPantryList);
  const loadMorePantryList = useLifeTraceStore((state) => state.loadMorePantryList);
  const updatePantryItemStatus = useLifeTraceStore((state) => state.updatePantryItemStatus);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<PantryItemStatus | 'all'>(() =>
    readStatusFilter(new URLSearchParams(window.location.search)),
  );
  const [categoryFilter, setCategoryFilter] = useState<PantryCategory | 'all'>(() =>
    readCategoryFilter(new URLSearchParams(window.location.search)),
  );
  const [searchQuery, setSearchQuery] = useState(() =>
    readQueryText(new URLSearchParams(window.location.search)),
  );
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() =>
    readQueryText(new URLSearchParams(window.location.search)),
  );
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const latestSearchParamsRef = useRef(searchParams);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const effectiveHouseholdId = preferredPantryHouseholdId || pantryResolvedHouseholdId;
  const currentHouseholdName =
    pantryResolvedHouseholdName || preferredPantryHouseholdName || '当前空间';

  const syncUrlState = useCallback(
    (updates: {
      status?: PantryItemStatus | 'all';
      category?: PantryCategory | 'all';
      q?: string;
    }) => {
      const current = latestSearchParamsRef.current;
      const next = updateSearchParams(current, updates);
      if (next.toString() !== current.toString()) {
        setSearchParams(next, { replace: true });
      }
    },
    [setSearchParams],
  );

  useEffect(() => {
    latestSearchParamsRef.current = searchParams;
  }, [searchParams]);

  useEffect(() => {
    const nextStatus = readStatusFilter(searchParams);
    const nextCategory = readCategoryFilter(searchParams);
    const nextQuery = readQueryText(searchParams);

    setStatusFilter((current) => (current === nextStatus ? current : nextStatus));
    setCategoryFilter((current) => (current === nextCategory ? current : nextCategory));
    setSearchQuery((current) => (current === nextQuery ? current : nextQuery));
    setDebouncedSearchQuery((current) => (current === nextQuery ? current : nextQuery));
  }, [searchParams]);

  useEffect(() => {
    if (!searchParams.has('householdId')) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.delete('householdId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const pantryQueryOptions = useMemo(
    () => ({
      householdId: effectiveHouseholdId || undefined,
      status: statusFilter,
      category: categoryFilter,
      q: debouncedSearchQuery.trim() || undefined,
    }),
    [categoryFilter, debouncedSearchQuery, effectiveHouseholdId, statusFilter],
  );

  const loadMorePantryItems = useCallback(async () => {
    if (pantryLoading || pantryLoadingMore || !pantryPagination.hasMore) {
      return;
    }

    await loadMorePantryList();
  }, [loadMorePantryList, pantryLoading, pantryLoadingMore, pantryPagination.hasMore]);

  const handleStatusAction = async (item: PantryItem, status: 'used-up' | 'discarded') => {
    if (pendingActionId) {
      return;
    }

    setPendingActionId(`${item.id}:${status}`);
    try {
      const updated = await updatePantryItemStatus(
        item.id,
        status,
        effectiveHouseholdId || undefined,
      );
      if (!updated) {
        return;
      }
      await addTrace(buildPantryTraceInput(updated, status));
    } finally {
      setPendingActionId(null);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      syncUrlState({ q: searchQuery });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchQuery, syncUrlState]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    void loadPantryList({
      ...pantryQueryOptions,
      pageSize: PANTRY_PAGE_SIZE,
    });
  }, [loadPantryList, pantryQueryOptions, settingsLoaded]);

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

  const listRefreshing = pantryLoading && pantryLoaded;
  const activePantryError = pantryListError;
  const showPantryErrorFallback =
    Boolean(activePantryError) && !listRefreshing && !pantryLoading && pantryList.length === 0;

  const handleRetryPantryLoad = useCallback(() => {
    void loadPantryList({
      ...pantryQueryOptions,
      pageSize: PANTRY_PAGE_SIZE,
    });
  }, [loadPantryList, pantryQueryOptions]);

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
            直接跟随你在我的页设置的当前空间，打开就能看临期、补货和今晚该先处理什么。
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

      <Card className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone="ai">当前空间</Badge>
            <h2 className="mt-2 truncate text-xl font-semibold">
              {pantryLoading && !pantryLoaded ? '正在同步当前空间' : currentHouseholdName}
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/profile#space-management')}
          >
            <Settings2 className="size-4" />
            去设置
          </Button>
        </div>
      </Card>

      <section className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
        <Card className="border-life-health/20 bg-life-health/10 p-4">
          <p className="text-sm font-semibold text-life-health">临期</p>
          <p className="mt-2 text-2xl font-bold">{pantrySummary.expiring}</p>
          <p className="mt-1 text-xs text-muted-foreground">7 天内需要处理</p>
        </Card>
        <Card className="border-life-alert/20 bg-life-alert/10 p-4">
          <p className="text-sm font-semibold text-life-alert">已过期</p>
          <p className="mt-2 text-2xl font-bold">{pantrySummary.expired}</p>
          <p className="mt-1 text-xs text-muted-foreground">需要尽快确认</p>
        </Card>
        <Card className="border-life-ai/20 bg-life-ai/10 p-4">
          <p className="text-sm font-semibold text-life-ai">在库总数</p>
          <p className="mt-2 text-2xl font-bold">{pantrySummary.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">当前空间仍在管理中的条目</p>
        </Card>
      </section>

      <Card className="space-y-4 p-4">
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
              {statusFilter === 'all'
                ? '只看在库条目'
                : `状态：${getPantryStatusLabel(statusFilter)}`}
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
                setDebouncedSearchQuery('');
                syncUrlState({ status: 'all', category: 'all', q: '' });
              }}
            >
              清空
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">状态</span>
            {statusFilters.map((filter) => {
              const active = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition',
                    active
                      ? 'border-life-ai/45 bg-life-ai/10 text-life-ai'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => {
                    setStatusFilter(filter.id);
                    syncUrlState({ status: filter.id });
                  }}
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
                  onClick={() => {
                    setCategoryFilter(category);
                    syncUrlState({ category });
                  }}
                  aria-pressed={active}
                >
                  {category === 'all' ? '全部分类' : category}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">库存列表</h2>
          </div>
          <div className="inline-flex min-w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap text-foreground">
            <span>{pantryPagination.total}</span>
            <span className="ml-1 text-muted-foreground">条</span>
          </div>
        </div>

        {activePantryError && !showPantryErrorFallback ? (
          <Card className="border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
            {activePantryError}
          </Card>
        ) : null}

        {listRefreshing ? (
          <div className="space-y-3">
            <SyncState
              title="正在更新库存列表"
              description={`正在同步${currentHouseholdName}的最新库存。`}
              tone="default"
              showRail={false}
            />
            <SyncState
              title="正在刷新筛选结果"
              tone="default"
              variant="skeleton-list"
              rows={2}
              showRail={false}
            />
          </div>
        ) : pantryLoading && !pantryLoaded ? (
          <Card className="p-5 text-sm text-muted-foreground">
            正在同步{currentHouseholdName}库存...
          </Card>
        ) : showPantryErrorFallback ? (
          <LoadErrorState
            title="库存列表加载失败"
            description="这次库存没有顺利从云端同步下来，重新加载后会再拉一次当前空间的数据。"
            error={activePantryError}
            retrying={pantryLoading || pantryLoadingMore}
            onRetry={handleRetryPantryLoad}
          />
        ) : pantryList.length === 0 ? (
          <EmptyState
            title={
              statusFilter === 'all' && categoryFilter === 'all' && !debouncedSearchQuery
                ? '这个空间还没有在库条目'
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
                    setDebouncedSearchQuery('');
                    syncUrlState({ status: 'all', category: 'all', q: '' });
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
              const terminalStatus = status === 'used-up' || status === 'discarded';
              const usedUpDisabled = actionPending || terminalStatus;
              const discardedDisabled = actionPending || terminalStatus;

              return (
                <Card
                  key={item.id}
                  className={cn(
                    'overflow-hidden p-0',
                    status === 'discarded' && 'border-border/70 bg-secondary/20',
                    status === 'used-up' && 'border-border/80 bg-secondary/10',
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-stretch gap-0 text-left',
                      status === 'discarded' && 'opacity-80',
                    )}
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
                      disabled={usedUpDisabled}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                        status === 'used-up'
                          ? 'text-muted-foreground'
                          : 'text-life-trace hover:bg-life-trace/10',
                      )}
                      onClick={() => void handleStatusAction(item, 'used-up')}
                    >
                      <BadgeAlert className="size-4" />
                      {usedUpPending ? '处理中...' : status === 'used-up' ? '已用完' : '用完'}
                    </button>
                    <button
                      type="button"
                      disabled={discardedDisabled}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                        status === 'discarded'
                          ? 'text-muted-foreground'
                          : 'text-life-alert hover:bg-life-alert/10',
                      )}
                      onClick={() => void handleStatusAction(item, 'discarded')}
                    >
                      <Trash2 className="size-4" />
                      {discardedPending ? '处理中...' : status === 'discarded' ? '已丢弃' : '丢弃'}
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
        householdId={effectiveHouseholdId || undefined}
        householdName={currentHouseholdName}
        onSaved={(message) => {
          showToast(message);
        }}
      />
    </div>
  );
}
