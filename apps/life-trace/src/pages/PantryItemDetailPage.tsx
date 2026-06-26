import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeAlert,
  Barcode,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Home,
  Image as ImageIcon,
  Minus,
  PackageCheck,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPantryItem, getPantryItemTimeline } from '@/api/pantry';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { FormItem, SheetActions, SheetHeader } from '@/components/FormItem';
import { ImagePreview } from '@/components/ImagePreview';
import { LoadErrorState } from '@/components/LoadErrorState';
import { PantryItemDrawer } from '@/components/PantryItemDrawer';
import { PantryTransferSheet } from '@/components/PantryTransferSheet';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  formatPantryReminderSummary,
  getPantryCoverUrl,
  getPantryExpiryText,
  getPantryStatusLabel,
  getPantryStatusTone,
  resolvePantryStatus,
} from '@/lib/pantry';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { HouseholdSummary, PantryItem, Trace } from '@/types';

const timelineIconMap = [
  { pattern: /新增/, icon: PackageCheck, tone: 'text-life-plan' },
  { pattern: /编辑/, icon: Edit3, tone: 'text-life-ai' },
  { pattern: /使用|用完/, icon: CheckCircle2, tone: 'text-life-trace' },
  { pattern: /丢弃/, icon: Trash2, tone: 'text-life-alert' },
  { pattern: /转移|合并/, icon: ArrowRightLeft, tone: 'text-life-health' },
];

function formatDateTime(value?: string) {
  if (!value) {
    return '未记录';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActionHouseholdId(household?: HouseholdSummary | null) {
  if (!household || household.kind === 'personal') {
    return undefined;
  }
  return household.id;
}

function getTransferSourceHouseholdId(household?: HouseholdSummary | null) {
  if (!household || household.kind === 'personal') {
    return '';
  }
  return household.id;
}

function buildQuantityLabel(item: PantryItem) {
  return `${item.quantity}${item.unit}`;
}

function TimelineIcon({ trace }: { trace: Trace }) {
  const matched = timelineIconMap.find((item) =>
    item.pattern.test(`${trace.title} ${trace.tags.join(' ')}`),
  );
  const Icon = matched?.icon ?? Clock3;
  return (
    <span
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-2xl bg-secondary',
        matched?.tone ?? 'text-muted-foreground',
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

function DetailField({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 truncate text-sm font-semibold',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function PantryItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const consumePantryItem = useLifeTraceStore((state) => state.consumePantryItem);
  const loadPantryList = useLifeTraceStore((state) => state.loadPantryList);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const [item, setItem] = useState<PantryItem | null>(null);
  const [household, setHousehold] = useState<HouseholdSummary | null>(null);
  const [timeline, setTimeline] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quantitySheetOpen, setQuantitySheetOpen] = useState(false);
  const [quantityText, setQuantityText] = useState('1');
  const [transferOpen, setTransferOpen] = useState(false);
  const [usedUpConfirmQuantity, setUsedUpConfirmQuantity] = useState<number | null>(null);

  const status = item ? resolvePantryStatus(item) : 'normal';
  const coverUrl = item ? getPantryCoverUrl(item) : '';
  const hasSeparateCover = Boolean(item?.thumbnailUrl && item.thumbnailUrl !== item.imageUrl);
  const terminalStatus = status === 'used-up' || status === 'discarded';
  const actionHouseholdId = getActionHouseholdId(household);
  const transferSupported = household?.kind === 'personal';
  const quantityNumber = item
    ? Math.min(item.quantity, Math.max(1, Number.parseInt(quantityText, 10) || 1))
    : 1;
  const remainingAfterUse = item ? Math.max(0, item.quantity - quantityNumber) : 0;

  const refreshTimeline = useCallback(async () => {
    if (!token || !itemId) {
      setTimeline([]);
      return;
    }
    setTimelineLoading(true);
    try {
      const result = await getPantryItemTimeline(token, itemId);
      setTimeline(result.list);
    } finally {
      setTimelineLoading(false);
    }
  }, [itemId, token]);

  const refreshDetail = useCallback(async () => {
    if (!token || !itemId) {
      setLoading(false);
      setError('请先登录');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPantryItem(token, itemId);
      setItem(result.item);
      setHousehold(result.household);
      const timelineResult = await getPantryItemTimeline(token, itemId);
      setTimeline(timelineResult.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '库存详情加载失败');
      setItem(null);
      setHousehold(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [itemId, token]);

  useEffect(() => {
    void refreshDetail();
  }, [refreshDetail]);

  useEffect(() => {
    if (!item) {
      return;
    }
    setQuantityText(String(Math.min(1, item.quantity)));
  }, [item]);

  const runConsumeAction = async (
    action: 'used' | 'discarded',
    quantity: number,
    actionKey: string,
  ) => {
    if (!item || actionId || terminalStatus) {
      return;
    }
    const normalizedQuantity = Math.min(item.quantity, Math.max(1, Math.floor(quantity)));
    setActionId(actionKey);
    try {
      const updated = await consumePantryItem(
        item.id,
        { action, quantity: normalizedQuantity },
        actionHouseholdId,
      );
      if (updated) {
        setItem(updated);
        setQuantitySheetOpen(false);
        showToast(
          action === 'used'
            ? `已记录使用 ${normalizedQuantity}${item.unit}`
            : `已丢弃 ${normalizedQuantity}${item.unit}`,
          'success',
        );
        await refreshTimeline();
        await loadPantryList({
          householdId: preferredPantryHouseholdId || undefined,
        });
      }
    } finally {
      setActionId(null);
    }
  };

  const detailRows = useMemo(() => {
    if (!item) {
      return [];
    }
    return [
      { label: '数量', value: buildQuantityLabel(item) },
      { label: '分类', value: item.category },
      { label: '位置', value: item.location },
      { label: '所属空间', value: household?.name || '当前空间' },
      { label: '开封日期', value: item.openedAt || '未记录', muted: !item.openedAt },
      { label: '更新时间', value: formatDateTime(item.updatedAt) },
    ];
  }, [household?.name, item]);

  if (!itemId) {
    return (
      <EmptyState
        title="库存不存在"
        description="这条库存链接没有可识别的条目。"
        tone="default"
        icon={AlertTriangle}
      />
    );
  }

  return (
    <SubPageShell
      title={item?.name || '库存详情'}
      eyebrow="Pantry"
      fallbackBackTo="/pantry"
      action={
        item ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="编辑库存"
            onClick={() => setDrawerOpen(true)}
          >
            <Edit3 className="size-4" />
          </Button>
        ) : null
      }
    >
      {loading ? (
        <output className="block space-y-4" aria-busy="true" aria-label="库存详情加载中">
          <Card className="h-72 animate-pulse bg-secondary motion-reduce:animate-none" />
          <Card className="h-40 animate-pulse bg-secondary motion-reduce:animate-none" />
          <Card className="h-52 animate-pulse bg-secondary motion-reduce:animate-none" />
        </output>
      ) : error ? (
        <LoadErrorState
          title="库存详情加载失败"
          description="重新加载后会再同步这条库存和相关记录。"
          error={error}
          retrying={loading}
          onRetry={() => void refreshDetail()}
        />
      ) : item ? (
        <div className="space-y-5 pb-4">
          <section className="overflow-hidden rounded-[1.25rem] border border-border bg-card">
            <div className="grid min-h-64 place-items-center bg-secondary/60">
              {coverUrl ? (
                <ImagePreview
                  src={coverUrl}
                  alt={item.name}
                  title={item.name}
                  subtitle={hasSeparateCover ? '透明封面' : '真实图片'}
                  className="block w-full"
                  imageClassName={cn(
                    'max-h-72 w-full object-contain',
                    hasSeparateCover
                      ? 'bg-[linear-gradient(45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.08)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.08)_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px] p-4'
                      : 'object-cover',
                  )}
                />
              ) : (
                <div className="grid size-20 place-items-center rounded-[1.5rem] bg-life-ai/10 text-life-ai">
                  <ImageIcon className="size-9" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={getPantryStatusTone(status)}>{getPantryStatusLabel(status)}</Badge>
                <Badge tone="default">{item.category}</Badge>
                {item.tags.map((tag) => (
                  <Badge key={tag} tone="trace">
                    {tag}
                  </Badge>
                ))}
                {household?.kind === 'shared' ? (
                  <Badge tone="ai">
                    <Users className="mr-1 size-3.5" />
                    共享家庭
                  </Badge>
                ) : (
                  <Badge tone="plan">
                    <Home className="mr-1 size-3.5" />
                    个人空间
                  </Badge>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold tracking-tight">{item.name}</h2>
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
              </div>
              <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
                <Button
                  type="button"
                  variant="outline"
                  className="border-life-trace/30 bg-life-trace/10 text-life-trace hover:bg-life-trace/15"
                  disabled={terminalStatus || Boolean(actionId)}
                  onClick={() => {
                    if (item.quantity <= 1) {
                      setUsedUpConfirmQuantity(item.quantity);
                      return;
                    }
                    void runConsumeAction('used', 1, 'use-one');
                  }}
                >
                  {actionId === 'use-one' ? (
                    <ActionLoadingIcon className="size-4" tone="trace" />
                  ) : (
                    <Minus className="size-4" />
                  )}
                  {item.quantity > 1 ? '用 1' : '用完'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={terminalStatus || Boolean(actionId)}
                  onClick={() => {
                    setQuantityText('1');
                    setQuantitySheetOpen(true);
                  }}
                >
                  <BadgeAlert className="size-4" />
                  使用数量
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-life-alert/30 bg-life-alert/10 text-life-alert hover:bg-life-alert/15"
                  disabled={terminalStatus || Boolean(actionId)}
                  onClick={() => void runConsumeAction('discarded', item.quantity, 'discard')}
                >
                  {actionId === 'discard' ? (
                    <ActionLoadingIcon className="size-4" tone="alert" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  丢弃
                </Button>
                <Button
                  type="button"
                  variant="ai"
                  disabled={!transferSupported || Boolean(actionId)}
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft className="size-4" />
                  转移
                </Button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
            {detailRows.map((row) => (
              <DetailField key={row.label} label={row.label} value={row.value} muted={row.muted} />
            ))}
          </section>

          <section className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-life-health" />
                <h3 className="text-sm font-semibold">提醒规则</h3>
              </div>
              <p className="text-sm text-foreground">
                {formatPantryReminderSummary(item.reminder)}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.reminder.enabled ? `${item.reminder.reminderTime} 提醒` : '未开启'}
                {item.reminder.useDefault ? ' · 使用默认' : ' · 单独设置'}
              </p>
            </Card>

            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Barcode className="size-4 text-life-ai" />
                <h3 className="text-sm font-semibold">条码</h3>
              </div>
              <p
                className={cn(
                  'break-all text-sm font-semibold',
                  !item.barcodeValue && 'text-muted-foreground',
                )}
              >
                {item.barcodeValue || '未记录'}
              </p>
              {item.barcodeFormat ? (
                <p className="text-xs text-muted-foreground">{item.barcodeFormat}</p>
              ) : null}
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-3 max-[380px]:grid-cols-1">
            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 text-life-plan" />
                <h3 className="text-sm font-semibold">图片</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                  {item.imageUrl ? (
                    <ImagePreview
                      src={item.imageUrl}
                      alt={`${item.name}实拍图`}
                      title={item.name}
                      subtitle="实拍图"
                      imageClassName="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-xs text-muted-foreground">
                      实拍图
                    </div>
                  )}
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                  {item.thumbnailUrl ? (
                    <ImagePreview
                      src={item.thumbnailUrl}
                      alt={`${item.name}封面`}
                      title={item.name}
                      subtitle="封面"
                      imageClassName="aspect-square w-full object-contain p-2"
                    />
                  ) : (
                    <div className="grid aspect-square place-items-center text-xs text-muted-foreground">
                      封面
                    </div>
                  )}
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-life-trace" />
                <h3 className="text-sm font-semibold">备注</h3>
              </div>
              <p
                className={cn(
                  'whitespace-pre-wrap text-sm leading-6',
                  !item.note && 'text-muted-foreground',
                )}
              >
                {item.note || '未记录'}
              </p>
            </Card>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">操作时间线</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {timelineLoading ? '同步中' : `${timeline.length} 条记录`}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={timelineLoading}
                onClick={() => void refreshTimeline()}
              >
                {timelineLoading ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <Clock3 className="size-4" />
                )}
                刷新
              </Button>
            </div>
            {timeline.length === 0 ? (
              <Card className="p-4 text-sm text-muted-foreground">暂无操作记录</Card>
            ) : (
              <div className="space-y-3">
                {timeline.map((trace) => (
                  <Card key={trace.id} className="p-4">
                    <div className="flex gap-3">
                      <TimelineIcon trace={trace} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {trace.title}
                          </h3>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDateTime(trace.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {trace.summary}
                        </p>
                        {trace.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {trace.tags.map((tag) => (
                              <Badge key={tag} tone="default" className="px-2 py-0.5 text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <PantryItemDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            item={item}
            householdId={actionHouseholdId}
            householdName={household?.name}
            showTransferAction={transferSupported}
            onRequestTransfer={() => setTransferOpen(true)}
            onDeleted={(message) => {
              showToast(message, 'success');
              void loadPantryList({ householdId: preferredPantryHouseholdId || undefined });
              navigate('/pantry', { replace: true });
            }}
            onSaved={(message) => {
              showToast(message, 'success');
              void refreshDetail();
              void loadPantryList({ householdId: preferredPantryHouseholdId || undefined });
            }}
          />

          <PantryTransferSheet
            open={transferOpen}
            onOpenChange={setTransferOpen}
            items={[item]}
            sourceHouseholdId={getTransferSourceHouseholdId(household)}
            sourceHouseholdName={household?.name || '我的空间'}
            onTransferred={async () => {
              await refreshDetail();
              await loadPantryList({ householdId: preferredPantryHouseholdId || undefined });
            }}
          />

          <BottomSheet
            open={quantitySheetOpen}
            overlayLabel="关闭使用数量"
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setQuantitySheetOpen(false);
              }
            }}
          >
            <div className="space-y-4">
              <SheetHeader
                title="使用数量"
                description={`${item.name} · 当前 ${buildQuantityLabel(item)}`}
                icon={BadgeAlert}
                iconClassName="bg-life-trace/10 text-life-trace"
                onClose={() => setQuantitySheetOpen(false)}
              />
              <FormItem label="数量">
                <Input
                  type="number"
                  min="1"
                  max={item.quantity}
                  step="1"
                  value={quantityText}
                  onChange={(event) => setQuantityText(event.target.value)}
                />
              </FormItem>
              <Card className="border-life-trace/20 bg-life-trace/10 p-3 text-sm text-life-trace">
                本次使用 {quantityNumber}
                {item.unit}，处理后剩余 {remainingAfterUse}
                {item.unit}。
              </Card>
              <SheetActions className="gap-2 pt-0">
                <Button type="button" variant="outline" onClick={() => setQuantitySheetOpen(false)}>
                  取消
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-life-trace/30 bg-life-trace/10 text-life-trace hover:bg-life-trace/15"
                  disabled={Boolean(actionId)}
                  onClick={() => void runConsumeAction('used', quantityNumber, 'use-custom')}
                >
                  {actionId === 'use-custom' ? (
                    <ActionLoadingIcon className="size-4" tone="trace" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  确认使用
                </Button>
              </SheetActions>
            </div>
          </BottomSheet>
        </div>
      ) : (
        <EmptyState
          title="库存不存在"
          description="这条库存可能已删除，返回列表后可以重新查看当前空间。"
          tone="default"
          icon={AlertTriangle}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/pantry')}>
              返回库存列表
            </Button>
          }
        />
      )}
      <ConfirmDialog
        open={usedUpConfirmQuantity !== null}
        title="确认标记为用完？"
        description={
          item && usedUpConfirmQuantity !== null
            ? `${item.name} 将被标记为已用完，可在时间线撤销。`
            : ''
        }
        confirmLabel="确认用完"
        loadingLabel="处理中"
        loading={Boolean(actionId) && usedUpConfirmQuantity !== null}
        onCancel={() => {
          if (!actionId) {
            setUsedUpConfirmQuantity(null);
          }
        }}
        onConfirm={() => {
          if (usedUpConfirmQuantity === null) {
            return;
          }
          const quantity = usedUpConfirmQuantity;
          void (async () => {
            await runConsumeAction('used', quantity, 'use-one');
            setUsedUpConfirmQuantity(null);
          })();
        }}
      />
    </SubPageShell>
  );
}
