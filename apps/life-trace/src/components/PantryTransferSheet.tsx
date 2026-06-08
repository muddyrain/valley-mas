import { AlertTriangle, ArrowRightLeft, Check, ChevronsRight, Copy, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { listHouseholds } from '@/api/household';
import {
  type PantryTransferConflictPolicy,
  type PantryTransferMode,
  type PantryTransferPreviewResponse,
  type PantryTransferResponse,
  previewPantryTransfer,
  transferPantryItems,
} from '@/api/pantry';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { HouseholdSummary, PantryItem } from '@/types';

type PantryTransferSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PantryItem[];
  sourceHouseholdId: string;
  sourceHouseholdName: string;
  onTransferred?: (response: PantryTransferResponse) => void | Promise<void>;
};

const modeOptions: Array<{
  value: PantryTransferMode;
  label: string;
  description: string;
}> = [
  {
    value: 'move',
    label: '移动',
    description: '个人库存移走后，当前空间里不再保留源条目。',
  },
  {
    value: 'copy',
    label: '复制',
    description: '把同一件物品同步一份到共享家庭，个人空间继续保留。',
  },
];

const conflictPolicyOptions: Array<{
  value: PantryTransferConflictPolicy;
  label: string;
  description: string;
}> = [
  {
    value: 'merge',
    label: '合并数量',
    description: '把同名同位置的重复条目合并到共享家庭现有库存里。',
  },
  {
    value: 'keep-both',
    label: '保留两条',
    description: '共享家庭里继续新增一条，不改现有库存。',
  },
];

function buildTransferSuccessMessage(response: PantryTransferResponse) {
  const actionLabel = response.mode === 'move' ? '移动' : '复制';
  const mergedSuffix =
    response.mergedCount > 0 ? `，其中 ${response.mergedCount} 条按共享库存合并` : '';
  return `已${actionLabel} ${response.processedCount} 条库存到「${response.targetHouseholdName}」${mergedSuffix}`;
}

export function PantryTransferSheet({
  open,
  onOpenChange,
  items,
  sourceHouseholdId,
  sourceHouseholdName,
  onTransferred,
}: PantryTransferSheetProps) {
  const token = useAuthStore((state) => state.token);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const [householdsLoading, setHouseholdsLoading] = useState(false);
  const [targetHouseholds, setTargetHouseholds] = useState<HouseholdSummary[]>([]);
  const [targetHouseholdId, setTargetHouseholdId] = useState('');
  const [mode, setMode] = useState<PantryTransferMode>('move');
  const [conflictPolicy, setConflictPolicy] = useState<PantryTransferConflictPolicy | ''>('');
  const [preview, setPreview] = useState<PantryTransferPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemCount = items.length;

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setPreviewLoading(false);
      setSubmitting(false);
      setSheetError('');
      setTargetHouseholdId('');
      setTargetHouseholds([]);
      setMode('move');
      setConflictPolicy('');
      return;
    }

    if (!token) {
      setSheetError('请先登录后再转移库存。');
      setTargetHouseholds([]);
      return;
    }

    if (itemCount === 0) {
      setTargetHouseholds([]);
      setSheetError('当前没有可转移的库存条目。');
      return;
    }

    let active = true;
    setHouseholdsLoading(true);
    setSheetError('');
    void listHouseholds(token)
      .then((response) => {
        if (!active) {
          return;
        }
        const sharedHouseholds = response.list.filter(
          (household) =>
            household.kind === 'shared' &&
            household.status === 'active' &&
            household.id !== sourceHouseholdId,
        );
        setTargetHouseholds(sharedHouseholds);
        setTargetHouseholdId(sharedHouseholds[0]?.id ?? '');
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSheetError(getLifeTraceErrorMessage(error, '读取共享家庭失败'));
        setTargetHouseholds([]);
      })
      .finally(() => {
        if (active) {
          setHouseholdsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [itemCount, open, sourceHouseholdId, token]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setPreview(null);
    setConflictPolicy('');
    setSheetError('');
  }, [open]);

  const selectedTargetHousehold = useMemo(
    () => targetHouseholds.find((household) => household.id === targetHouseholdId) ?? null,
    [targetHouseholdId, targetHouseholds],
  );

  const previewReady =
    preview &&
    preview.targetHouseholdId === targetHouseholdId &&
    preview.mode === mode &&
    preview.itemCount === itemCount;
  const conflictsDetected = Boolean(previewReady && preview.conflictCount > 0);
  const submitDisabled =
    submitting ||
    previewLoading ||
    !previewReady ||
    !selectedTargetHousehold ||
    itemCount === 0 ||
    (conflictsDetected && !conflictPolicy);

  const handlePreview = async () => {
    if (!token) {
      setSheetError('请先登录后再转移库存。');
      return;
    }
    if (!selectedTargetHousehold) {
      setSheetError('请先选择一个共享家庭。');
      return;
    }
    if (itemCount === 0) {
      setSheetError('当前没有可转移的库存条目。');
      return;
    }

    setPreviewLoading(true);
    setSheetError('');
    try {
      const result = await previewPantryTransfer(token, {
        sourceHouseholdId,
        targetHouseholdId: selectedTargetHousehold.id,
        itemIds,
        mode,
      });
      setPreview(result);
      setConflictPolicy('');
    } catch (error) {
      setPreview(null);
      setConflictPolicy('');
      setSheetError(getLifeTraceErrorMessage(error, '预览库存转移失败'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!token) {
      setSheetError('请先登录后再转移库存。');
      return;
    }
    if (!previewReady || !selectedTargetHousehold) {
      setSheetError('请先预览这次库存转移。');
      return;
    }
    if (conflictsDetected && !conflictPolicy) {
      setSheetError('发现重复库存后，需要先决定是合并数量还是保留两条。');
      return;
    }

    setSubmitting(true);
    setSheetError('');
    try {
      const response = await transferPantryItems(token, {
        sourceHouseholdId,
        targetHouseholdId: selectedTargetHousehold.id,
        itemIds,
        mode,
        conflictPolicy: conflictsDetected ? conflictPolicy || undefined : undefined,
      });
      showToast(buildTransferSuccessMessage(response), 'success');
      await onTransferred?.(response);
      onOpenChange(false);
    } catch (error) {
      setSheetError(getLifeTraceErrorMessage(error, '执行库存转移失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭库存转移"
      zIndexClassName="z-[80]"
      portal
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">转移到共享家庭</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            先预览重复库存，再决定是复制还是移动到共享家庭空间。
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="size-5" />
        </Button>
      </div>

      {sheetError ? (
        <Card className="mb-4 border-life-alert/20 bg-life-alert/10 p-4 text-sm text-life-alert">
          {sheetError}
        </Card>
      ) : null}

      <div className="space-y-4 pb-5">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">本次转移</p>
              <p className="mt-1 text-xs text-muted-foreground">
                从「{sourceHouseholdName}」带 {itemCount} 条库存去共享家庭。
              </p>
            </div>
            <Badge tone="ai" className="shrink-0 whitespace-nowrap">
              {itemCount} 条
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {items.slice(0, 4).map((item) => (
              <Badge key={item.id} tone="default" className="max-w-full">
                <span className="truncate">
                  {item.name} · {item.quantity}
                  {item.unit}
                </span>
              </Badge>
            ))}
            {itemCount > 4 ? <Badge tone="default">+{itemCount - 4} 条</Badge> : null}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
              <Users className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold">目标共享家庭</p>
              <p className="text-xs text-muted-foreground">只展示你当前可访问的共享家庭空间。</p>
            </div>
          </div>
          {householdsLoading ? (
            <Card className="border-border/80 bg-secondary/40 p-4 text-sm text-muted-foreground">
              正在同步共享家庭列表...
            </Card>
          ) : targetHouseholds.length === 0 ? (
            <EmptyState
              title="还没有可转移的共享家庭"
              description="先去创建或加入一个共享家庭，再把个人库存带过去。"
              eyebrow="共享家庭为空"
              tone="ai"
              icon={Users}
            />
          ) : (
            <div className="space-y-2">
              {targetHouseholds.map((household) => {
                const selected = household.id === targetHouseholdId;
                return (
                  <button
                    key={household.id}
                    type="button"
                    className={cn(
                      'w-full rounded-[1.25rem] border p-4 text-left transition',
                      selected
                        ? 'border-life-ai/35 bg-life-ai/10 shadow-[0_16px_40px_rgba(6,182,212,0.08)]'
                        : 'border-border bg-card hover:border-foreground/15',
                    )}
                    onClick={() => setTargetHouseholdId(household.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge tone="ai">共享家庭</Badge>
                          <Badge tone="default">{household.memberCount} 人</Badge>
                        </div>
                        <p className="mt-2 truncate text-base font-semibold">{household.name}</p>
                      </div>
                      <div
                        className={cn(
                          'mt-1 grid size-5 shrink-0 place-items-center rounded-md border',
                          selected
                            ? 'border-life-ai bg-life-ai text-background'
                            : 'border-border bg-card text-transparent',
                        )}
                      >
                        <Check className="size-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-2xl bg-life-plan/10 text-life-plan">
              <ArrowRightLeft className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold">转移方式</p>
              <p className="text-xs text-muted-foreground">先决定保留个人空间，还是直接搬走。</p>
            </div>
          </div>
          <div className="grid gap-2">
            {modeOptions.map((option) => {
              const selected = option.value === mode;
              const Icon = option.value === 'move' ? ChevronsRight : Copy;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    'rounded-[1.25rem] border px-4 py-3 text-left transition',
                    selected
                      ? 'border-life-plan/35 bg-life-plan/10'
                      : 'border-border bg-card hover:border-foreground/15',
                  )}
                  onClick={() => setMode(option.value)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 grid size-9 shrink-0 place-items-center rounded-2xl',
                        selected
                          ? 'bg-life-plan text-background'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {previewReady ? (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">预览结果</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {preview.sourceHouseholdName} {'->'} {preview.targetHouseholdName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="ai">{preview.itemCount} 条待处理</Badge>
                <Badge tone={preview.conflictCount > 0 ? 'alert' : 'trace'}>
                  {preview.conflictCount > 0 ? `${preview.conflictCount} 条冲突` : '无重复库存'}
                </Badge>
              </div>
            </div>

            {preview.conflicts.length > 0 ? (
              <>
                <div className="space-y-2">
                  {preview.conflicts.map((conflict) => (
                    <div
                      key={`${conflict.sourceItem.id}:${conflict.targetItem.id}`}
                      className="rounded-[1.25rem] border border-life-alert/20 bg-life-alert/5 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-life-alert" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {conflict.sourceItem.name}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            个人空间 {conflict.sourceItem.quantity}
                            {conflict.sourceItem.unit} {'->'} 共享家庭现有{' '}
                            {conflict.targetItem.quantity}
                            {conflict.targetItem.unit}
                          </p>
                          <p className="mt-1 text-xs text-life-alert">{conflict.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">重复库存怎么处理</p>
                  {conflictPolicyOptions.map((option) => {
                    const selected = conflictPolicy === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          'w-full rounded-[1.25rem] border px-4 py-3 text-left transition',
                          selected
                            ? 'border-life-ai/35 bg-life-ai/10'
                            : 'border-border bg-card hover:border-foreground/15',
                        )}
                        onClick={() => setConflictPolicy(option.value)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{option.label}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {option.description}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'mt-1 grid size-5 shrink-0 place-items-center rounded-md border',
                              selected
                                ? 'border-life-ai bg-life-ai text-background'
                                : 'border-border bg-card text-transparent',
                            )}
                          >
                            <Check className="size-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="rounded-[1.25rem] border border-life-trace/20 bg-life-trace/5 px-4 py-3 text-sm text-life-trace">
                这批库存在目标共享家庭里没有重复条目，可以直接执行
                {mode === 'move' ? '移动' : '复制'}。
              </div>
            )}
          </Card>
        ) : null}

        <div className="flex gap-3 max-[360px]:flex-col">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={
              householdsLoading ||
              previewLoading ||
              submitting ||
              itemCount === 0 ||
              !selectedTargetHousehold
            }
            onClick={() => void handlePreview()}
          >
            {previewLoading ? <ActionLoadingIcon className="size-4" tone="ai" /> : null}
            {previewLoading ? '预览中...' : '先预览冲突'}
          </Button>
          <Button
            type="button"
            variant="ai"
            className="flex-1"
            disabled={submitDisabled}
            onClick={() => void handleTransfer()}
          >
            {submitting ? <ActionLoadingIcon className="size-4" tone="ai" /> : null}
            {submitting ? '转移中...' : mode === 'move' ? '确认移动' : '确认复制'}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
