import {
  Apple,
  Archive,
  BadgeAlert,
  Camera,
  Check,
  ClipboardList,
  Home,
  Milk,
  PackagePlus,
  Pill,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { LoadErrorState } from '@/components/LoadErrorState';
import { PantryHouseholdDetailSheet } from '@/components/PantryHouseholdDetailSheet';
import { PantryHouseholdSheet } from '@/components/PantryHouseholdSheet';
import { PantryItemDrawer } from '@/components/PantryItemDrawer';
import { PantryTransferSheet } from '@/components/PantryTransferSheet';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePantryHouseholdManager } from '@/hooks/usePantryHouseholdManager';
import {
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

// 首次加载用库存卡骨架占位，刷新时保留已有列表，避免空白、假零值和跳闪。
function PantryListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <output className="block space-y-3" aria-label="库存加载中" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} className="overflow-hidden p-0">
          <div className="flex min-h-[8.5rem] items-stretch">
            <div className="grid w-26 shrink-0 place-items-center bg-secondary max-[360px]:w-24">
              <div className="size-14 animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />
            </div>
            <div className="min-w-0 flex-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex gap-2">
                    <span className="h-6 w-14 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                    <span className="h-6 w-16 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                  </div>
                  <div className="h-4 w-32 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                </div>
                <div className="size-5 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                <div className="h-3 w-40 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px border-t border-border bg-border/60">
            {Array.from({ length: 3 }, (_, actionIndex) => (
              <div key={actionIndex} className="grid h-11 place-items-center bg-card">
                <div className="h-3 w-10 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </output>
  );
}

function InlineValueSkeleton({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-3 animate-pulse rounded-full bg-current/20 align-middle motion-reduce:animate-none',
        className,
      )}
    />
  );
}

function PantrySummaryValue({
  loading,
  value,
  skeletonClassName,
}: {
  loading: boolean;
  value: string | number;
  skeletonClassName: string;
}) {
  if (loading) {
    return <InlineValueSkeleton className={skeletonClassName} />;
  }

  return <>{value}</>;
}

export function PantryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
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
  const consumePantryItem = useLifeTraceStore((state) => state.consumePantryItem);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [consumeItem, setConsumeItem] = useState<PantryItem | null>(null);
  const [consumeQuantity, setConsumeQuantity] = useState('1');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [transferSheetOpen, setTransferSheetOpen] = useState(false);
  const [transferItems, setTransferItems] = useState<PantryItem[]>([]);
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false);
  const [householdDetailOpen, setHouseholdDetailOpen] = useState(false);
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
  const statusActionInFlightRef = useRef<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const latestSearchParamsRef = useRef(searchParams);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const effectiveHouseholdId = preferredPantryHouseholdId || pantryResolvedHouseholdId;
  const currentHouseholdName =
    pantryResolvedHouseholdName || preferredPantryHouseholdName || '当前空间';
  const selectedItems = useMemo(
    () => pantryList.filter((item) => selectedItemIds.includes(item.id)),
    [pantryList, selectedItemIds],
  );
  const consumeQuantityNumber = Math.min(
    consumeItem?.quantity ?? 1,
    Math.max(1, Number.parseInt(consumeQuantity, 10) || 1),
  );
  const consumeRemainingQuantity = consumeItem
    ? Math.max(0, consumeItem.quantity - consumeQuantityNumber)
    : 0;
  const {
    households,
    householdsLoaded,
    householdsLoading,
    householdError,
    householdMembers,
    householdMembersLoading,
    invitePayload,
    inviteLoading,
    activeHouseholdId,
    currentHousehold,
    loadHouseholds,
    loadHouseholdMembersFor,
    loadHouseholdInvite,
    handleSelectHousehold,
    handleCreateHousehold,
    handleJoinHousehold,
    handleCreateInvite,
    handleRevokeInvite,
    handleLeaveHousehold,
    handleTransferOwner,
    handleDissolveHousehold,
  } = usePantryHouseholdManager();
  const isPersonalScope =
    currentHousehold?.kind === 'personal' || (!currentHousehold && !preferredPantryHouseholdId);
  const canTransferFromCurrentHousehold = isPersonalScope && Boolean(pantryResolvedHouseholdId);
  const currentSpaceMetaText =
    currentHousehold?.kind === 'shared' ? `${currentHousehold.memberCount} 人共享` : '个人空间';

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
      householdId: preferredPantryHouseholdId || undefined,
      status: statusFilter,
      category: categoryFilter,
      q: debouncedSearchQuery.trim() || undefined,
    }),
    [categoryFilter, debouncedSearchQuery, preferredPantryHouseholdId, statusFilter],
  );

  const loadMorePantryItems = useCallback(async () => {
    if (pantryLoading || pantryLoadingMore || !pantryPagination.hasMore) {
      return;
    }

    await loadMorePantryList();
  }, [loadMorePantryList, pantryLoading, pantryLoadingMore, pantryPagination.hasMore]);

  const handleConsumeAction = async (
    item: PantryItem,
    action: 'used' | 'discarded',
    quantity: number,
  ) => {
    const normalizedQuantity = Math.min(item.quantity, Math.max(1, Math.floor(quantity)));
    const actionKey = `${item.id}:consume-${action}`;
    if (pendingActionId || statusActionInFlightRef.current.has(item.id)) {
      return;
    }

    statusActionInFlightRef.current.add(item.id);
    setPendingActionId(actionKey);
    try {
      const updated = await consumePantryItem(
        item.id,
        { action, quantity: normalizedQuantity },
        effectiveHouseholdId || undefined,
      );
      if (updated) {
        const actionLabel = action === 'used' ? '使用' : '丢弃';
        showToast(`已记录${actionLabel} ${normalizedQuantity}${item.unit}`, 'success');
        if (consumeItem?.id === item.id) {
          setConsumeItem(null);
        }
      }
    } finally {
      statusActionInFlightRef.current.delete(item.id);
      setPendingActionId((current) => {
        if (current === actionKey) {
          return null;
        }
        return current;
      });
    }
  };

  const openConsumeSheet = (item: PantryItem) => {
    setConsumeItem(item);
    setConsumeQuantity('1');
  };

  const refreshPantryList = useCallback(async () => {
    await loadPantryList({
      ...pantryQueryOptions,
      pageSize: PANTRY_PAGE_SIZE,
    });
  }, [loadPantryList, pantryQueryOptions]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((current) => {
      if (current) {
        setSelectedItemIds([]);
      }
      return !current;
    });
  }, []);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }, []);

  const handleOpenTransferForItems = useCallback((items: PantryItem[]) => {
    if (!items.length) {
      return;
    }
    setTransferItems(items);
    setTransferSheetOpen(true);
  }, []);

  const handleTransferCompleted = useCallback(async () => {
    await refreshPantryList();
    setSelectionMode(false);
    setSelectedItemIds([]);
    setTransferItems([]);
  }, [refreshPantryList]);

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

    void refreshPantryList();
  }, [refreshPantryList, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded || householdsLoaded || householdsLoading) {
      return;
    }

    void loadHouseholds();
  }, [householdsLoaded, householdsLoading, loadHouseholds, settingsLoaded]);

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

  useEffect(() => {
    const validSelectedIds = selectedItemIds.filter((id) =>
      pantryList.some((item) => item.id === id),
    );
    if (validSelectedIds.length === selectedItemIds.length) {
      return;
    }
    setSelectedItemIds(validSelectedIds);
    if (validSelectedIds.length === 0) {
      setSelectionMode(false);
    }
  }, [pantryList, selectedItemIds]);

  useEffect(() => {
    if (canTransferFromCurrentHousehold) {
      return;
    }

    setSelectionMode(false);
    setSelectedItemIds([]);
    setTransferSheetOpen(false);
    setTransferItems([]);
  }, [canTransferFromCurrentHousehold]);

  useEffect(() => {
    if (!householdSheetOpen) {
      return;
    }

    void (async () => {
      const nextSelectedHouseholdId = await loadHouseholds();
      if (!nextSelectedHouseholdId) {
        return;
      }

      try {
        await loadHouseholdMembersFor(nextSelectedHouseholdId);
      } catch {
        // 错误态在弹层内展示，这里不额外打断流程
      }
    })();
  }, [householdSheetOpen, loadHouseholdMembersFor, loadHouseholds]);

  const initialPantryLoading = pantryLoading && !pantryLoaded;
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
    <SubPageShell
      title="家庭库存"
      eyebrow="Pantry"
      fallbackBackTo="/today"
      action={
        <Button
          type="button"
          variant="ai"
          size="icon"
          aria-label="添加库存"
          onClick={() => {
            setEditingItem(null);
            setDrawerOpen(true);
          }}
        >
          <PackagePlus className="size-4" />
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[1.45rem] border border-life-ai/15 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.14),transparent_30%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(24,24,27,0.92))] p-3 shadow-[0_18px_46px_rgba(0,0,0,0.2)]">
          <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/60 to-transparent" />
          <div className="absolute -right-8 -top-8 size-24 rounded-full bg-life-ai/10 blur-2xl" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-[1.15rem] border border-life-ai/20 bg-life-ai/10 text-life-ai shadow-[0_12px_28px_rgba(6,182,212,0.14)]">
                  {currentHousehold?.kind === 'shared' ? (
                    <Users className="size-5" />
                  ) : (
                    <Home className="size-5" />
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="ai" className="px-2 py-0.5 text-[11px]">
                      当前空间
                    </Badge>
                    {currentHousehold?.kind === 'shared' ? (
                      <Badge tone="default" className="px-2 py-0.5 text-[11px]">
                        共享家庭
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-[1.1rem] font-semibold text-foreground">
                    {currentHouseholdName}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {initialPantryLoading ? (
                      <>
                        <ActionLoadingIcon className="size-3.5" tone="ai" />
                        同步中
                      </>
                    ) : (
                      currentSpaceMetaText
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 px-3 text-xs"
                  disabled={householdsLoading && householdSheetOpen}
                  onClick={() => setHouseholdSheetOpen(true)}
                >
                  {householdsLoading && householdSheetOpen ? (
                    <ActionLoadingIcon className="size-4" tone="ai" />
                  ) : (
                    <Settings2 className="size-4" />
                  )}
                  切换空间
                </Button>
                {currentHousehold?.kind === 'shared' && currentHousehold.status === 'active' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 bg-secondary/45 px-3 text-xs hover:bg-secondary/70"
                    onClick={() => setHouseholdDetailOpen(true)}
                  >
                    <Users className="size-4" />
                    空间详情
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-foreground/88">
                在库{' '}
                <PantrySummaryValue
                  loading={initialPantryLoading}
                  value={pantrySummary.total}
                  skeletonClassName="w-4"
                />
              </span>
              <span className="rounded-full border border-life-health/24 bg-life-health/12 px-2.5 py-1 text-[11px] font-medium text-life-health">
                临期{' '}
                <PantrySummaryValue
                  loading={initialPantryLoading}
                  value={pantrySummary.expiring}
                  skeletonClassName="w-4"
                />
              </span>
              <span className="rounded-full border border-life-alert/24 bg-life-alert/12 px-2.5 py-1 text-[11px] font-medium text-life-alert">
                风险{' '}
                <PantrySummaryValue
                  loading={initialPantryLoading}
                  value={pantrySummary.expired}
                  skeletonClassName="w-4"
                />
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
              <div className="rounded-2xl border border-white/12 bg-secondary/78 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="text-[11px] font-semibold text-muted-foreground">在库</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  <PantrySummaryValue
                    loading={initialPantryLoading}
                    value={`${pantrySummary.total} 件`}
                    skeletonClassName="w-12"
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-life-health/24 bg-life-health/12 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[11px] font-semibold text-muted-foreground">临期</p>
                <p className="mt-1 text-sm font-semibold text-life-health">
                  <PantrySummaryValue
                    loading={initialPantryLoading}
                    value={`${pantrySummary.expiring} 件待处理`}
                    skeletonClassName="w-16"
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-life-alert/24 bg-life-alert/12 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[11px] font-semibold text-muted-foreground">风险</p>
                <p className="mt-1 text-sm font-semibold text-life-alert">
                  <PantrySummaryValue
                    loading={initialPantryLoading}
                    value={`${pantrySummary.expired} 件已过期`}
                    skeletonClassName="w-16"
                  />
                </p>
              </div>
            </div>

            {canTransferFromCurrentHousehold && pantryList.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center border border-dashed border-border bg-secondary/35 text-muted-foreground hover:bg-secondary/65 hover:text-foreground"
                onClick={toggleSelectionMode}
              >
                {selectionMode ? '取消批量选择' : '批量选择后转移到共享家庭'}
              </Button>
            ) : null}
          </div>
        </div>

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
              {selectionMode ? (
                <p className="mt-1 text-xs text-life-ai">
                  已选 {selectedItemIds.length} 条，点卡片继续勾选后再一起转到共享家庭。
                </p>
              ) : null}
            </div>
            <div className="inline-flex min-w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap text-foreground">
              <span>
                <PantrySummaryValue
                  loading={initialPantryLoading}
                  value={pantryPagination.total}
                  skeletonClassName="w-5"
                />
              </span>
              <span className="ml-1 text-muted-foreground">条</span>
            </div>
          </div>

          {activePantryError && !showPantryErrorFallback ? (
            <Card className="border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
              {activePantryError}
            </Card>
          ) : null}

          {listRefreshing ? (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <ActionLoadingIcon className="size-3.5" tone="ai" />
              刷新中
            </div>
          ) : null}

          {initialPantryLoading ? (
            <PantryListSkeleton />
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
            <div
              className={cn(
                'space-y-3 transition-opacity duration-200',
                listRefreshing && 'opacity-95',
              )}
            >
              {pantryList.map((item) => {
                const status = resolvePantryStatus(item);
                const coverUrl = getPantryCoverUrl(item);
                const hasSeparateCover = Boolean(
                  item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl,
                );
                const Icon = categoryIconMap[item.category];
                const actionPending = pendingActionId?.startsWith(`${item.id}:`) ?? false;
                const terminalStatus = status === 'used-up' || status === 'discarded';
                const discardedDisabled = actionPending || terminalStatus;
                const StatusActionIcon = BadgeAlert;
                const consumePending = pendingActionId === `${item.id}:consume-used`;
                const processPending =
                  pendingActionId === `${item.id}:consume-discarded` || consumePending;
                const consumeDisabled = actionPending || processPending || terminalStatus;

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
                        'flex w-full items-start gap-0 text-left',
                        status === 'discarded' && 'opacity-80',
                        selectionMode && selectedItemIds.includes(item.id) && 'bg-life-ai/5',
                      )}
                      onClick={() => {
                        if (selectionMode) {
                          toggleItemSelection(item.id);
                          return;
                        }
                        navigate(`/pantry/${item.id}`);
                      }}
                    >
                      <div className="grid h-44 w-26 shrink-0 place-items-center bg-secondary max-[360px]:h-40 max-[360px]:w-24">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={item.name}
                            className={cn(
                              'h-full w-full',
                              hasSeparateCover ? 'bg-secondary p-2 object-contain' : 'object-cover',
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
                          <div className="flex shrink-0 items-start gap-2">
                            {!selectionMode && hasSeparateCover ? (
                              <Badge tone="ai">
                                <Sparkles className="mr-1 size-3.5" />
                                AI 图
                              </Badge>
                            ) : null}
                            {selectionMode ? (
                              <div
                                className={cn(
                                  'mt-1 grid size-5 place-items-center rounded-md border',
                                  selectedItemIds.includes(item.id)
                                    ? 'border-life-ai bg-life-ai text-background'
                                    : 'border-border bg-card text-transparent',
                                )}
                              >
                                <Check className="size-3.5" />
                              </div>
                            ) : null}
                          </div>
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
                    {selectionMode ? (
                      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                        {selectedItemIds.includes(item.id)
                          ? '已加入本次批量转移。'
                          : '点这张卡片即可加入本次批量转移。'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-px border-t border-border bg-border/60">
                        <button
                          type="button"
                          disabled={consumeDisabled}
                          className={cn(
                            'flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                            status === 'used-up'
                              ? 'text-muted-foreground'
                              : 'text-life-trace hover:bg-life-trace/10',
                          )}
                          onClick={() => void handleConsumeAction(item, 'used', 1)}
                        >
                          {consumePending ? (
                            <ActionLoadingIcon className="size-4" tone="trace" />
                          ) : (
                            <StatusActionIcon className="size-4" />
                          )}
                          <span className="min-w-10 whitespace-nowrap text-center">
                            {status === 'used-up' ? '已用完' : item.quantity > 1 ? '用 1' : '用完'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={discardedDisabled || processPending}
                          className={cn(
                            'flex h-11 items-center justify-center gap-2 bg-card text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
                            status === 'discarded'
                              ? 'text-muted-foreground'
                              : 'text-life-alert hover:bg-life-alert/10',
                          )}
                          onClick={() => openConsumeSheet(item)}
                        >
                          {pendingActionId === `${item.id}:consume-discarded` ? (
                            <ActionLoadingIcon className="size-4" tone="alert" />
                          ) : (
                            <Settings2 className="size-4" />
                          )}
                          <span className="min-w-10 whitespace-nowrap text-center">
                            {status === 'discarded' ? '已丢弃' : '处理'}
                          </span>
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
                    )}
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
                    {pantryLoadingMore ? <ActionLoadingIcon className="size-4" tone="ai" /> : null}
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

        {selectionMode ? (
          <div className="sticky bottom-3 z-20">
            <Card className="border-life-ai/20 bg-card/95 p-3 shadow-[0_18px_50px_rgba(9,9,11,0.42)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 max-[360px]:flex-col max-[360px]:items-stretch">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">批量转移到共享家庭</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    当前页已选 {selectedItemIds.length} 条库存，可先预览冲突再统一处理。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 max-[360px]:grid max-[360px]:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedItemIds(pantryList.map((item) => item.id))}
                  >
                    全选当前页
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedItemIds([])}
                  >
                    清空
                  </Button>
                  <Button
                    type="button"
                    variant="ai"
                    size="sm"
                    disabled={selectedItems.length === 0}
                    className="max-[360px]:col-span-2"
                    onClick={() => handleOpenTransferForItems(selectedItems)}
                  >
                    转移到共享家庭
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        <BottomSheet
          open={Boolean(consumeItem)}
          overlayLabel="关闭库存处理"
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setConsumeItem(null);
            }
          }}
        >
          {consumeItem ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">处理库存</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {consumeItem.name} · {consumeItem.quantity}
                    {consumeItem.unit} · {consumeItem.location}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setConsumeItem(null)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <label className="block text-sm font-semibold text-foreground">
                处理数量
                <input
                  type="number"
                  min="1"
                  max={consumeItem.quantity}
                  value={consumeQuantity}
                  className="mt-2 h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-ring"
                  onChange={(event) => setConsumeQuantity(event.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                剩余 {consumeRemainingQuantity}
                {consumeItem.unit}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={Boolean(pendingActionId)}
                  onClick={() =>
                    void handleConsumeAction(consumeItem, 'used', consumeQuantityNumber)
                  }
                >
                  {pendingActionId === `${consumeItem.id}:consume-used` ? (
                    <ActionLoadingIcon className="size-4" tone="trace" />
                  ) : (
                    <BadgeAlert className="size-4" />
                  )}
                  使用数量
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={Boolean(pendingActionId)}
                  onClick={() =>
                    void handleConsumeAction(consumeItem, 'used', consumeItem.quantity)
                  }
                >
                  全部用完
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-life-alert/30 text-life-alert hover:bg-life-alert/10"
                  disabled={Boolean(pendingActionId)}
                  onClick={() =>
                    void handleConsumeAction(consumeItem, 'discarded', consumeQuantityNumber)
                  }
                >
                  {pendingActionId === `${consumeItem.id}:consume-discarded` ? (
                    <ActionLoadingIcon className="size-4" tone="alert" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  丢弃数量
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 border-life-alert/30 text-life-alert hover:bg-life-alert/10"
                  disabled={Boolean(pendingActionId)}
                  onClick={() =>
                    void handleConsumeAction(consumeItem, 'discarded', consumeItem.quantity)
                  }
                >
                  全部丢弃
                </Button>
              </div>
            </div>
          ) : null}
        </BottomSheet>

        <PantryItemDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          item={editingItem}
          householdId={effectiveHouseholdId || undefined}
          householdName={currentHouseholdName}
          showTransferAction={canTransferFromCurrentHousehold && Boolean(editingItem)}
          onRequestTransfer={(item) => handleOpenTransferForItems([item])}
          onSaved={(message) => {
            showToast(message);
          }}
        />
        <PantryTransferSheet
          open={transferSheetOpen}
          onOpenChange={(nextOpen) => {
            setTransferSheetOpen(nextOpen);
            if (!nextOpen) {
              setTransferItems([]);
            }
          }}
          items={transferItems}
          sourceHouseholdId={pantryResolvedHouseholdId}
          sourceHouseholdName={currentHouseholdName}
          onTransferred={handleTransferCompleted}
        />
        <PantryHouseholdSheet
          open={householdSheetOpen}
          onOpenChange={setHouseholdSheetOpen}
          households={households}
          selectedHouseholdId={activeHouseholdId}
          householdsLoading={householdsLoading}
          onSelectHousehold={handleSelectHousehold}
          onCreateHousehold={async (name) => {
            await handleCreateHousehold(name);
          }}
          onJoinHousehold={async (inviteCode) => {
            await handleJoinHousehold(inviteCode);
          }}
        />
        <PantryHouseholdDetailSheet
          open={householdDetailOpen}
          onOpenChange={setHouseholdDetailOpen}
          household={currentHousehold?.kind === 'shared' ? currentHousehold : null}
          members={householdMembers}
          membersLoading={householdMembersLoading}
          invitePayload={invitePayload}
          inviteLoading={inviteLoading}
          onLoadInvite={loadHouseholdInvite}
          onCreateInvite={async (householdId) => {
            await handleCreateInvite(householdId);
          }}
          onRevokeInvite={async (householdId) => {
            await handleRevokeInvite(householdId);
          }}
          onRefreshMembers={loadHouseholdMembersFor}
          onTransferOwner={handleTransferOwner}
          onLeaveHousehold={handleLeaveHousehold}
          onDissolveHousehold={handleDissolveHousehold}
        />
        {householdError && !householdSheetOpen ? (
          <Card className="border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
            {householdError}
          </Card>
        ) : null}
      </div>
    </SubPageShell>
  );
}
