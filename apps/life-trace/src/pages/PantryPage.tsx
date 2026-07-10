import {
  Apple,
  Archive,
  BadgeAlert,
  CalendarClock,
  Camera,
  Check,
  ClipboardList,
  Home,
  Milk,
  PackageCheck,
  PackagePlus,
  Pill,
  ReceiptText,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { FormItem, SheetActions, SheetHeader } from '@/components/FormItem';
import { LifeList } from '@/components/LifeLayout';
import { LoadErrorState } from '@/components/LoadErrorState';
import { PantryFilterSheet } from '@/components/PantryFilterSheet';
import { PantryHouseholdDetailSheet } from '@/components/PantryHouseholdDetailSheet';
import { PantryHouseholdSheet } from '@/components/PantryHouseholdSheet';
import { PantryItemDrawer } from '@/components/PantryItemDrawer';
import { PantryTransferSheet } from '@/components/PantryTransferSheet';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { usePantryHouseholdManager } from '@/hooks/usePantryHouseholdManager';
import { getLifeTraceScrollMemoryKey, readScrollMemory } from '@/lib/lifeTraceNavigation';
import {
  getPantryCoverUrl,
  getPantryExpiryText,
  getPantryStatusLabel,
  resolvePantryStatus,
} from '@/lib/pantry';
import {
  buildPantryListSearchParams,
  isSamePantryListQuery,
  type PantryListFilters,
  pantryQuickStatuses,
  pantrySortOptions,
  readPantryListFilters,
  toPantryListApiOptions,
} from '@/lib/pantryListFilters';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { PantryCategory, PantryItem } from '@/types';

const categoryIconMap = {
  食品: Apple,
  日用品: Archive,
  药品: Pill,
  宠物: Milk,
  其他: ClipboardList,
} satisfies Record<PantryCategory, typeof Apple>;

const PANTRY_PAGE_SIZE = 20;

const quickStatusLabels = {
  all: '当前库存',
  expiring: '临期',
  expired: '已过期',
} as const;

const filterStatusLabels = {
  all: '当前库存',
  normal: '正常',
  expiring: '临期',
  expired: '已过期',
  'no-expiry': '未设过期',
  kept: '仍在使用',
  'used-up': '已用完',
  discarded: '已丢弃',
} as const;

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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const settingsError = useLifeTraceStore((state) => state.settingsError);
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
  const updatePantryItemStatus = useLifeTraceStore((state) => state.updatePantryItemStatus);
  const addShoppingItem = useLifeTraceStore((state) => state.addShoppingItem);
  const settings = useLifeTraceStore((state) => state.settings);
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const filters = useMemo(
    () =>
      readPantryListFilters(searchParams, {
        includeExpired: settings.pantryListIncludeExpired,
        sort: settings.pantryListSortMode,
      }),
    [searchParams, settings.pantryListIncludeExpired, settings.pantryListSortMode],
  );
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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const statusActionInFlightRef = useRef<Set<string>>(new Set());
  const [shoppingPrompt, setShoppingPrompt] = useState<{
    item: PantryItem;
    action: 'used' | 'discarded';
  } | null>(null);
  const [shoppingPromptLoading, setShoppingPromptLoading] = useState(false);
  const [usedUpConfirm, setUsedUpConfirm] = useState<{
    item: PantryItem;
    quantity: number;
    fromSheet: boolean;
  } | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const effectiveHouseholdId = preferredPantryHouseholdId || pantryResolvedHouseholdId;
  const currentHouseholdName =
    pantryResolvedHouseholdName || preferredPantryHouseholdName || '当前空间';
  const currentSortLabel =
    pantrySortOptions.find((option) => option.id === filters.sort)?.label ??
    pantrySortOptions[0].label;
  const hiddenFilterCount =
    Number(!pantryQuickStatuses.includes(filters.status as (typeof pantryQuickStatuses)[number])) +
    Number(filters.category !== 'all');
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

  const applyFilters = useCallback(
    (nextFilters: PantryListFilters) => {
      const next = buildPantryListSearchParams(nextFilters);
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    const canonical = buildPantryListSearchParams(filters);
    if (canonical.toString() !== searchParams.toString()) {
      setSearchParams(canonical, { replace: true });
    }
  }, [filters, searchParams, setSearchParams, settingsLoaded]);

  useEffect(() => {
    setSearchQuery((current) => (current === filters.q ? current : filters.q));
  }, [filters.q]);

  const pantryQueryOptions = useMemo(
    () => ({
      ...toPantryListApiOptions(filters),
      householdId: preferredPantryHouseholdId || undefined,
    }),
    [filters, preferredPantryHouseholdId],
  );
  const scrollMemoryKey = getLifeTraceScrollMemoryKey(location.pathname, location.search);

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
        if (updated.status === 'used-up' || updated.status === 'discarded') {
          setShoppingPrompt({ item: updated, action });
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

  const handleMarkPantryKept = async (item: PantryItem) => {
    const actionKey = `${item.id}:mark-kept`;
    if (pendingActionId || statusActionInFlightRef.current.has(item.id)) {
      return;
    }

    statusActionInFlightRef.current.add(item.id);
    setPendingActionId(actionKey);
    try {
      const updated = await updatePantryItemStatus(
        item.id,
        'kept',
        effectiveHouseholdId || undefined,
      );
      if (updated) {
        showToast(`已标记「${item.name}」仍在使用`, 'success');
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

  const refreshPantryList = useCallback(async () => {
    const state = useLifeTraceStore.getState();
    const rememberedCount = scrollMemoryKey
      ? (readScrollMemory(scrollMemoryKey)?.loadedItemCount ?? 0)
      : 0;
    const retainedCount = isSamePantryListQuery(state.pantryListOptions, pantryQueryOptions)
      ? state.pantryListItems.length
      : 0;
    await loadPantryList({
      ...pantryQueryOptions,
      pageSize: Math.max(PANTRY_PAGE_SIZE, rememberedCount, retainedCount),
    });
  }, [loadPantryList, pantryQueryOptions, scrollMemoryKey]);

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
      if (searchQuery.trim() !== filters.q) {
        applyFilters({ ...filters, q: searchQuery });
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [applyFilters, filters, searchQuery]);

  useLayoutEffect(() => {
    if (!settingsLoaded) {
      return;
    }

    void refreshPantryList();
  }, [refreshPantryList, settingsLoaded]);

  useEffect(() => {
    if (settingsError) {
      showToast(settingsError, 'error');
    }
  }, [settingsError, showToast]);

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

  const pantrySummaryLoading = !pantryLoaded || (pantryLoading && pantryList.length === 0);
  const pantryListSkeletonLoading = !pantryLoaded || (pantryLoading && pantryList.length === 0);
  const activePantryError = pantryListError;
  const showPantryErrorFallback =
    Boolean(activePantryError) && !pantryLoading && pantryList.length === 0;

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
      <div className="space-y-5" data-scroll-loaded-count={pantryList.length}>
        <div className="relative overflow-hidden rounded-[1.5rem] border border-border/75 bg-[radial-gradient(circle_at_top_right,rgba(95,146,112,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(189,138,36,0.08),transparent_34%),linear-gradient(180deg,rgba(255,253,248,0.94),rgba(250,246,238,0.9))] p-3 shadow-[0_18px_54px_rgba(71,58,42,0.075)] backdrop-blur">
          <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-life-trace/45 to-transparent" />
          <div className="absolute -right-8 -top-8 size-24 rounded-full bg-life-trace/12 blur-2xl" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-[1.25rem] border border-life-trace/20 bg-life-trace/10 text-life-trace shadow-[0_12px_28px_rgba(95,146,112,0.12)]">
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
                    {pantrySummaryLoading ? (
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
              <span className="rounded-full border border-border/70 bg-card/72 px-2.5 py-1 text-[11px] font-medium text-foreground/88">
                当前{' '}
                <PantrySummaryValue
                  loading={pantrySummaryLoading}
                  value={pantrySummary.active}
                  skeletonClassName="w-4"
                />
              </span>
              <span className="rounded-full border border-life-health/24 bg-life-health/12 px-2.5 py-1 text-[11px] font-medium text-life-health">
                临期{' '}
                <PantrySummaryValue
                  loading={pantrySummaryLoading}
                  value={pantrySummary.expiring}
                  skeletonClassName="w-4"
                />
              </span>
              <span className="rounded-full border border-life-alert/24 bg-life-alert/12 px-2.5 py-1 text-[11px] font-medium text-life-alert">
                风险{' '}
                <PantrySummaryValue
                  loading={pantrySummaryLoading}
                  value={pantrySummary.expired}
                  skeletonClassName="w-4"
                />
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-card/72 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <p className="text-[11px] font-semibold text-muted-foreground">当前库存</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  <PantrySummaryValue
                    loading={pantrySummaryLoading}
                    value={`${pantrySummary.active} 件`}
                    skeletonClassName="w-12"
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-life-health/24 bg-life-health/12 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[11px] font-semibold text-muted-foreground">临期</p>
                <p className="mt-1 text-sm font-semibold text-life-health">
                  <PantrySummaryValue
                    loading={pantrySummaryLoading}
                    value={`${pantrySummary.expiring} 件待处理`}
                    skeletonClassName="w-16"
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-life-alert/24 bg-life-alert/12 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[11px] font-semibold text-muted-foreground">风险</p>
                <p className="mt-1 text-sm font-semibold text-life-alert">
                  <PantrySummaryValue
                    loading={pantrySummaryLoading}
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
        </Card>

        <Card className="sticky top-[72px] z-10 space-y-3 bg-card/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{filterStatusLabels[filters.status]}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {filters.category === 'all' ? '全部分类' : filters.category}
                {` · ${currentSortLabel}`}
              </p>
            </div>
            {filters.status !== 'all' || filters.category !== 'all' || searchQuery.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  applyFilters({ ...filters, status: 'all', category: 'all', q: '' });
                }}
              >
                清空
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
            {pantryQuickStatuses.map((status) => {
              const active = filters.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  className={cn(
                    'h-10 rounded-2xl border px-2 text-xs font-semibold transition',
                    active
                      ? 'border-life-ai/45 bg-life-ai/10 text-life-ai'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => applyFilters({ ...filters, status })}
                  aria-pressed={active}
                >
                  {quickStatusLabels[status]}
                </button>
              );
            })}
            <button
              type="button"
              className={cn(
                'relative flex h-10 items-center justify-center gap-1.5 rounded-2xl border px-2 text-xs font-semibold transition',
                hiddenFilterCount > 0
                  ? 'border-life-plan/45 bg-life-plan/10 text-life-plan'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setFilterSheetOpen(true)}
            >
              <SlidersHorizontal className="size-3.5" />
              筛选
              {hiddenFilterCount > 0 ? (
                <span className="grid size-4 place-items-center rounded-full bg-life-plan text-[10px] text-background">
                  {hiddenFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {filters.status === 'all' ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/75 bg-secondary/45 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">包含已过期</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {filters.includeExpired ? '已显示' : '已隐藏'}
                </p>
              </div>
              <Switch
                size="sm"
                checked={filters.includeExpired}
                aria-label="包含已过期"
                onCheckedChange={(checked) => {
                  applyFilters({ ...filters, status: 'all', includeExpired: checked });
                  updateSettings({ pantryListIncludeExpired: checked });
                }}
              />
            </div>
          ) : null}
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
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="刷新库存"
                disabled={pantryLoading}
                onClick={() => void refreshPantryList()}
                className="size-9 rounded-full"
              >
                {pantryLoading ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
              </Button>
              <div className="inline-flex min-w-[4.5rem] items-center justify-center rounded-full bg-secondary px-3 py-2 text-sm font-semibold whitespace-nowrap text-foreground">
                <span>
                  <PantrySummaryValue
                    loading={pantrySummaryLoading}
                    value={pantryPagination.total}
                    skeletonClassName="w-5"
                  />
                </span>
                <span className="ml-1 text-muted-foreground">条</span>
              </div>
            </div>
          </div>

          {activePantryError && !showPantryErrorFallback ? (
            <Card className="border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
              {activePantryError}
            </Card>
          ) : null}

          {pantryListSkeletonLoading ? (
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
                filters.status === 'all' && filters.category === 'all' && !filters.q
                  ? '这个空间还没有在库条目'
                  : '暂无匹配库存'
              }
              description={
                filters.status === 'all' && filters.category === 'all' && !filters.q
                  ? '先加一盒牛奶、一袋生菜或一瓶洗衣液，Life Trace 才能开始提醒你。'
                  : '换个筛选条件，或者把搜索词放宽一点试试。'
              }
              eyebrow={
                filters.status === 'all' && filters.category === 'all' && !filters.q
                  ? '库存为空'
                  : '筛选结果'
              }
              tone="plan"
              icon={PackagePlus}
              action={
                filters.status !== 'all' || filters.category !== 'all' || filters.q ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      applyFilters({ ...filters, status: 'all', category: 'all', q: '' });
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
            <LifeList>
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
                const keepPending = pendingActionId === `${item.id}:mark-kept`;
                const processPending =
                  pendingActionId === `${item.id}:consume-discarded` || consumePending;
                const consumeDisabled = actionPending || processPending || terminalStatus;
                const showKeepAction = status === 'expired' || status === 'kept';

                return (
                  <Card
                    key={item.id}
                    data-scroll-anchor={`pantry:${item.id}`}
                    className={cn(
                      'overflow-hidden rounded-[1.6rem] border-border/80 bg-card/95 p-0 shadow-sm shadow-background/25 transition hover:border-life-health/25 hover:shadow-[0_14px_36px_rgba(71,58,42,0.08)]',
                      status === 'discarded' && 'border-border/70 bg-secondary/20',
                      status === 'used-up' && 'border-border/80 bg-secondary/10',
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-stretch gap-3 p-3 text-left',
                        status === 'discarded' && 'opacity-80',
                        selectionMode && selectedItemIds.includes(item.id) && 'bg-life-ai/5',
                      )}
                      onClick={() => {
                        if (selectionMode) {
                          toggleItemSelection(item.id);
                          return;
                        }
                        navigate(`/pantry/${item.id}`, {
                          state: { pantryListFrom: `${location.pathname}${location.search}` },
                        });
                      }}
                    >
                      <div className="grid h-32 w-[6.75rem] shrink-0 place-items-center overflow-hidden rounded-[1.25rem] border border-border/70 bg-secondary/70 max-[360px]:h-[7.5rem] max-[360px]:w-24">
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
                          <div className="grid size-14 place-items-center rounded-2xl bg-life-health/10 text-life-health">
                            <Icon className="size-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col py-0.5">
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                  status === 'expired'
                                    ? 'bg-life-alert/10 text-life-alert'
                                    : status === 'expiring'
                                      ? 'bg-life-health/10 text-life-health'
                                      : 'bg-life-trace/10 text-life-trace',
                                )}
                              >
                                {getPantryStatusLabel(status)}
                              </span>
                              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                {item.category}
                              </span>
                              {!selectionMode && hasSeparateCover ? (
                                <span className="inline-flex items-center rounded-full bg-life-ai/10 px-2 py-0.5 text-[11px] font-semibold text-life-ai">
                                  <Sparkles className="mr-1 size-3" />
                                  AI 图
                                </span>
                              ) : null}
                            </div>
                            {selectionMode ? (
                              <div
                                className={cn(
                                  'grid size-5 shrink-0 place-items-center rounded-md border',
                                  selectedItemIds.includes(item.id)
                                    ? 'border-life-ai bg-life-ai text-background'
                                    : 'border-border bg-card text-transparent',
                                )}
                              >
                                <Check className="size-3.5" />
                              </div>
                            ) : null}
                          </div>
                          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
                            {item.name}
                          </h3>
                        </div>
                        <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Home className="size-3.5 shrink-0 text-life-trace" />
                            <span className="truncate">
                              {item.location} · {item.quantity}
                              {item.unit}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold',
                              status === 'expired'
                                ? 'bg-life-alert/10 text-life-alert'
                                : status === 'expiring'
                                  ? 'bg-life-health/10 text-life-health'
                                  : 'bg-secondary text-muted-foreground',
                            )}
                          >
                            <CalendarClock className="size-3.5 shrink-0" />
                            <span className="truncate">{getPantryExpiryText(item)}</span>
                          </span>
                        </div>
                        {item.note ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.note}
                          </p>
                        ) : null}
                        {item.tags.length > 0 ? (
                          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-life-trace/15 bg-life-trace/8 px-2 py-0.5 text-[11px] font-medium text-life-trace"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                    {selectionMode ? (
                      <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
                        {selectedItemIds.includes(item.id)
                          ? '已加入本次批量转移。'
                          : '点这张卡片即可加入本次批量转移。'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 border-t border-border/70 bg-card/80">
                        {showKeepAction ? (
                          <button
                            type="button"
                            disabled={actionPending || status === 'kept'}
                            className={cn(
                              'flex h-12 items-center justify-center gap-1.5 border-r border-border/60 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
                              status === 'kept'
                                ? 'text-muted-foreground'
                                : 'text-life-trace hover:bg-life-trace/8',
                            )}
                            onClick={() => {
                              void handleMarkPantryKept(item);
                            }}
                          >
                            {keepPending ? (
                              <ActionLoadingIcon className="size-4" tone="trace" />
                            ) : (
                              <PackageCheck className="size-4" />
                            )}
                            <span className="whitespace-nowrap">
                              {status === 'kept' ? '已确认' : '仍在使用'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={consumeDisabled}
                            className={cn(
                              'flex h-12 items-center justify-center gap-1.5 border-r border-border/60 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
                              status === 'used-up'
                                ? 'text-muted-foreground'
                                : 'text-life-trace hover:bg-life-trace/8',
                            )}
                            onClick={() => {
                              if (item.quantity <= 1) {
                                setUsedUpConfirm({ item, quantity: 1, fromSheet: false });
                                return;
                              }
                              void handleConsumeAction(item, 'used', 1);
                            }}
                          >
                            {consumePending ? (
                              <ActionLoadingIcon className="size-4" tone="trace" />
                            ) : (
                              <StatusActionIcon className="size-4" />
                            )}
                            <span className="whitespace-nowrap">
                              {status === 'used-up'
                                ? '已用完'
                                : item.quantity > 1
                                  ? '用 1'
                                  : '用完'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={discardedDisabled || processPending}
                          className={cn(
                            'flex h-12 items-center justify-center gap-1.5 border-r border-border/60 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55',
                            status === 'discarded'
                              ? 'text-muted-foreground'
                              : 'text-life-alert hover:bg-life-alert/8',
                          )}
                          onClick={() => openConsumeSheet(item)}
                        >
                          {pendingActionId === `${item.id}:consume-discarded` ? (
                            <ActionLoadingIcon className="size-4" tone="alert" />
                          ) : (
                            <Settings2 className="size-4" />
                          )}
                          <span className="whitespace-nowrap">
                            {status === 'discarded' ? '已丢弃' : '处理'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={actionPending}
                          className="flex h-12 items-center justify-center gap-1.5 border-r border-border/60 text-xs font-semibold text-life-ai transition hover:bg-life-ai/8 disabled:cursor-not-allowed disabled:opacity-55"
                          onClick={() => {
                            setEditingItem(item);
                            setDrawerOpen(true);
                          }}
                        >
                          <Camera className="size-4" />
                          编辑
                        </button>
                        <button
                          type="button"
                          className="flex h-12 items-center justify-center gap-1.5 text-xs font-semibold text-life-health transition hover:bg-life-health/8"
                          onClick={() => {
                            const params = new URLSearchParams({
                              new: '1',
                              pantryItemId: item.id,
                              category: item.category === '食品' ? '吃饭' : '购物',
                              merchant: item.name,
                              note: `${item.name} · ${item.quantity}${item.unit}`,
                              imageUrl: item.imageUrl || item.thumbnailUrl || '',
                            });
                            navigate(`/ledger?${params.toString()}`);
                          }}
                        >
                          <ReceiptText className="size-4" />
                          记账
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
            </LifeList>
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
              <SheetHeader
                title="处理库存"
                description={`${consumeItem.name} · ${consumeItem.quantity}${consumeItem.unit} · ${consumeItem.location}`}
                icon={Settings2}
                iconClassName="bg-life-trace/10 text-life-trace"
                onClose={() => setConsumeItem(null)}
              />
              <FormItem
                label="处理数量"
                description={`剩余 ${consumeRemainingQuantity}${consumeItem.unit}`}
              >
                <Input
                  type="number"
                  min="1"
                  max={consumeItem.quantity}
                  value={consumeQuantity}
                  onChange={(event) => setConsumeQuantity(event.target.value)}
                />
              </FormItem>
              <SheetActions>
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
                    setUsedUpConfirm({
                      item: consumeItem,
                      quantity: consumeItem.quantity,
                      fromSheet: true,
                    })
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
              </SheetActions>
              <SheetActions className="pt-0">
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
              </SheetActions>
            </div>
          ) : null}
        </BottomSheet>

        <PantryFilterSheet
          open={filterSheetOpen}
          value={filters}
          onOpenChange={setFilterSheetOpen}
          onApply={(nextFilters) => {
            if (nextFilters.sort !== filters.sort) {
              updateSettings({ pantryListSortMode: nextFilters.sort });
            }
            applyFilters(nextFilters);
            setFilterSheetOpen(false);
          }}
        />
        <PantryItemDrawer
          open={drawerOpen}
          onOpenChange={(nextOpen) => {
            setDrawerOpen(nextOpen);
            if (!nextOpen) {
              setEditingItem(null);
            }
          }}
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

      <ConfirmDialog
        open={Boolean(usedUpConfirm)}
        title="确认标记为用完？"
        description={
          usedUpConfirm ? `${usedUpConfirm.item.name} 将被标记为已用完，可在详情页撤销。` : ''
        }
        confirmLabel="确认用完"
        loadingLabel="处理中"
        loading={Boolean(pendingActionId) && Boolean(usedUpConfirm)}
        onCancel={() => {
          if (!pendingActionId) {
            setUsedUpConfirm(null);
          }
        }}
        onConfirm={() => {
          if (!usedUpConfirm) {
            return;
          }
          const { item, quantity, fromSheet } = usedUpConfirm;
          void (async () => {
            await handleConsumeAction(item, 'used', quantity);
            setUsedUpConfirm(null);
            if (fromSheet) {
              setConsumeItem(null);
            }
          })();
        }}
      />
      <ConfirmDialog
        open={Boolean(shoppingPrompt)}
        title="加入采购清单？"
        description={
          shoppingPrompt
            ? `${shoppingPrompt.item.name} 已${shoppingPrompt.action === 'used' ? '用完' : '丢弃'}，是否加入采购清单方便下次补货？`
            : ''
        }
        confirmLabel="加入清单"
        loadingLabel="加入中"
        loading={shoppingPromptLoading}
        onCancel={() => {
          if (!shoppingPromptLoading) {
            setShoppingPrompt(null);
          }
        }}
        onConfirm={() => {
          if (!shoppingPrompt) {
            return;
          }
          const { item, action } = shoppingPrompt;
          setShoppingPromptLoading(true);
          void (async () => {
            try {
              const saved = await addShoppingItem({
                name: item.name,
                quantity: 1,
                unit: item.unit || '件',
                category: item.category || '食品',
                source: action === 'used' ? 'pantry_used_up' : 'pantry_discard',
                sourcePantryItemId: item.id,
              });
              if (saved) {
                showToast('已加入采购清单', 'success');
                setShoppingPrompt(null);
              }
            } finally {
              setShoppingPromptLoading(false);
            }
          })();
        }}
      />
    </SubPageShell>
  );
}
