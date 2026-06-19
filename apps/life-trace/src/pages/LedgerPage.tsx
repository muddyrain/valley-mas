import {
  ChevronLeft,
  CircleDollarSign,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import {
  FormItem,
  SheetActions,
  SheetHeader,
  SheetSelectButton,
  SheetSelectField,
} from '@/components/FormItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  formatLedgerAmount,
  getDefaultLedgerMonth,
  ledgerCategories,
  ledgerDirections,
  summarizeLedgerCategories,
} from '@/lib/ledger';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { LedgerCategory, LedgerDirection, LedgerEntry, NewLedgerEntryInput } from '@/types';

type LedgerFilter = LedgerCategory | 'all';
type LedgerDirectionFilter = LedgerDirection | 'all';

type LedgerFormErrors = Partial<Record<'amount' | 'occurredAt', string>>;

const defaultForm: NewLedgerEntryInput = {
  amount: 0,
  currency: 'CNY',
  direction: '支出',
  category: '吃饭',
  occurredAt: new Date().toISOString(),
  merchant: '',
  location: '',
  note: '',
  imageUrl: '',
};
const ledgerDirectionOptions = ledgerDirections.map((direction) => ({
  label: direction,
  value: direction,
}));
const ledgerDirectionFilterOptions: Array<{ value: LedgerDirectionFilter; label: string }> = [
  { value: 'all', label: '全部方向' },
  ...ledgerDirectionOptions,
];
const ledgerCategoryOptions = ledgerCategories.map((category) => ({
  label: category,
  value: category,
}));

function formatDateTimeLocal(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  const hour = String(safeDate.getHours()).padStart(2, '0');
  const minute = String(safeDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatLedgerTime(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function entryToInput(entry: LedgerEntry): NewLedgerEntryInput {
  return {
    amount: entry.amount,
    currency: entry.currency || 'CNY',
    direction: entry.direction,
    category: entry.category,
    occurredAt: entry.occurredAt,
    merchant: entry.merchant ?? '',
    location: entry.location ?? '',
    note: entry.note ?? '',
    imageUrl: entry.imageUrl ?? '',
    inboxItemId: entry.inboxItemId,
    planId: entry.planId,
    traceId: entry.traceId,
    pantryItemId: entry.pantryItemId,
    recurringPaymentId: entry.recurringPaymentId,
  };
}

function normalizeFormInput(form: NewLedgerEntryInput): NewLedgerEntryInput {
  return {
    ...form,
    amount: Number(form.amount),
    currency: form.currency?.trim() || 'CNY',
    occurredAt: new Date(form.occurredAt).toISOString(),
    merchant: form.merchant?.trim() || '',
    location: form.location?.trim() || '',
    note: form.note?.trim() || '',
    imageUrl: form.imageUrl?.trim() || '',
  };
}

export function LedgerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const ledgerEntries = useLifeTraceStore((state) => state.ledgerEntries);
  const ledgerLoaded = useLifeTraceStore((state) => state.ledgerLoaded);
  const ledgerLoading = useLifeTraceStore((state) => state.ledgerLoading);
  const ledgerLoadingMore = useLifeTraceStore((state) => state.ledgerLoadingMore);
  const ledgerError = useLifeTraceStore((state) => state.ledgerError);
  const ledgerPagination = useLifeTraceStore((state) => state.ledgerPagination);
  const ledgerSummary = useLifeTraceStore((state) => state.ledgerSummary);
  const ledgerCreating = useLifeTraceStore((state) => state.ledgerCreating);
  const ledgerUpdatingById = useLifeTraceStore((state) => state.ledgerUpdatingById);
  const ledgerDeletingById = useLifeTraceStore((state) => state.ledgerDeletingById);
  const loadLedgerEntries = useLifeTraceStore((state) => state.loadLedgerEntries);
  const loadMoreLedgerEntries = useLifeTraceStore((state) => state.loadMoreLedgerEntries);
  const addLedgerEntry = useLifeTraceStore((state) => state.addLedgerEntry);
  const editLedgerEntry = useLifeTraceStore((state) => state.editLedgerEntry);
  const removeLedgerEntry = useLifeTraceStore((state) => state.removeLedgerEntry);
  const convertInbox = useLifeTraceStore((state) => state.convertInbox);
  const advanceRecurringPaymentAction = useLifeTraceStore(
    (state) => state.advanceRecurringPaymentAction,
  );
  const [month, setMonth] = useState(getDefaultLedgerMonth());
  const [categoryFilter, setCategoryFilter] = useState<LedgerFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<LedgerDirectionFilter>('all');
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewLedgerEntryInput>({
    ...defaultForm,
    occurredAt: formatDateTimeLocal(),
  });
  const [formErrors, setFormErrors] = useState<LedgerFormErrors>({});

  useEffect(() => {
    void loadLedgerEntries({
      month,
      category: categoryFilter,
      direction: directionFilter,
    });
  }, [categoryFilter, directionFilter, loadLedgerEntries, month]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') !== '1') {
      return;
    }
    const amount = Number(params.get('amount') || '0');
    setEditingEntry(null);
    const category = params.get('category');
    const direction = params.get('direction');
    setForm({
      ...defaultForm,
      amount: Number.isFinite(amount) ? amount : 0,
      direction: ledgerDirections.includes(direction as LedgerDirection)
        ? (direction as LedgerDirection)
        : '支出',
      category: ledgerCategories.includes(category as LedgerCategory)
        ? (category as LedgerCategory)
        : '购物',
      merchant: params.get('merchant') || '',
      note: params.get('note') || '',
      imageUrl: params.get('imageUrl') || '',
      inboxItemId: params.get('inboxItemId') || undefined,
      pantryItemId: params.get('pantryItemId') || undefined,
      recurringPaymentId: params.get('recurringPaymentId') || undefined,
      occurredAt: formatDateTimeLocal(),
    });
    setFormOpen(true);
  }, [location.search]);

  const localCategorySummary = useMemo(
    () => summarizeLedgerCategories(ledgerEntries),
    [ledgerEntries],
  );
  const categorySummary =
    ledgerSummary.categories.length > 0 ? ledgerSummary.categories : localCategorySummary;
  const topCategoryAmount = Math.max(...categorySummary.map((item) => item.amountCents), 1);

  const openCreateForm = () => {
    setEditingEntry(null);
    setForm({
      ...defaultForm,
      occurredAt: formatDateTimeLocal(),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setForm({
      ...entryToInput(entry),
      occurredAt: formatDateTimeLocal(entry.occurredAt),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingEntry(null);
    setFormErrors({});
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    const nextErrors: LedgerFormErrors = {};
    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = '请输入金额';
    }
    if (!form.occurredAt || Number.isNaN(new Date(form.occurredAt).getTime())) {
      nextErrors.occurredAt = '请选择时间';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const input = normalizeFormInput({ ...form, amount });
    const saved = editingEntry
      ? await editLedgerEntry(editingEntry.id, input)
      : await addLedgerEntry(input);
    if (saved) {
      if (!editingEntry && input.inboxItemId) {
        void convertInbox(input.inboxItemId, 'ledger', saved.id);
      }
      if (!editingEntry && input.recurringPaymentId) {
        void advanceRecurringPaymentAction(input.recurringPaymentId);
      }
      closeForm();
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-life-health">
              Ledger
            </p>
            <h1 className="truncate text-2xl font-semibold">轻账本</h1>
          </div>
        </div>
        <Button type="button" variant="ai" size="sm" onClick={openCreateForm}>
          <Plus className="size-4" />
          记一笔
        </Button>
      </header>

      <section className="grid gap-3 md:grid-cols-[1.35fr_1fr]">
        <Card className="relative overflow-hidden border-life-health/20 p-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health/70 to-transparent"
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="health">{ledgerSummary.month || month}</Badge>
              <p className="mt-4 text-sm text-muted-foreground">本月支出</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">
                {formatLedgerAmount(ledgerSummary.expenseCents)}
              </p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <CircleDollarSign className="size-6" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">收入</p>
              <p className="mt-1 text-sm font-semibold">
                {formatLedgerAmount(ledgerSummary.incomeCents)}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">退款</p>
              <p className="mt-1 text-sm font-semibold">
                {formatLedgerAmount(ledgerSummary.refundCents)}
              </p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">结余</p>
              <p className="mt-1 text-sm font-semibold">
                {formatLedgerAmount(ledgerSummary.netCents)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">分类占比</p>
              <p className="mt-1 text-xs text-muted-foreground">按支出统计</p>
            </div>
            <ReceiptText className="size-5 text-life-health" />
          </div>
          {categorySummary.length > 0 ? (
            <div className="space-y-3">
              {categorySummary.slice(0, 5).map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{item.category}</span>
                    <span className="text-muted-foreground">
                      {formatLedgerAmount(item.amountCents)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-life-health"
                      style={{
                        width: `${Math.max(8, (item.amountCents / topCategoryAmount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">本月还没有支出分类。</p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value || getDefaultLedgerMonth())}
            className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(['all', ...ledgerCategories] as LedgerFilter[]).map((category) => (
              <button
                key={category}
                type="button"
                className={cn(
                  'h-9 shrink-0 rounded-xl border px-3 text-sm font-semibold transition',
                  categoryFilter === category
                    ? 'border-life-health/40 bg-life-health/10 text-life-health'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setCategoryFilter(category)}
              >
                {category === 'all' ? '全部' : category}
              </button>
            ))}
          </div>
          <SheetSelectButton
            value={directionFilter}
            options={ledgerDirectionFilterOptions}
            pickerTitle="方向"
            className="h-10 rounded-xl"
            onValueChange={setDirectionFilter}
          />
        </div>

        {ledgerError ? (
          <Card className="border-life-alert/30 bg-life-alert/10 p-4 text-sm text-life-alert">
            {ledgerError}
          </Card>
        ) : null}

        {ledgerLoading && !ledgerLoaded ? (
          <Card className="grid min-h-44 place-items-center p-6 text-sm text-muted-foreground">
            <LoaderCircle className="mb-3 size-6 animate-spin text-life-health motion-reduce:animate-none" />
            正在同步账目
          </Card>
        ) : ledgerEntries.length === 0 ? (
          <EmptyState
            title="还没有账目"
            description="记下一笔生活支出，月底回看会更清楚。"
            eyebrow="轻账本"
            icon={ReceiptText}
            tone="health"
            action={
              <Button type="button" variant="ai" onClick={openCreateForm}>
                <Plus className="size-4" />
                记一笔
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {ledgerEntries.map((entry) => {
              const deleting = Boolean(ledgerDeletingById[entry.id]);
              const updating = Boolean(ledgerUpdatingById[entry.id]);
              const disabled = deleting || updating;
              return (
                <Card key={entry.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={entry.direction === '支出' ? 'health' : 'trace'}>
                          {entry.direction}
                        </Badge>
                        <Badge tone="default">{entry.category}</Badge>
                        {entry.inboxItemId ? <Badge tone="ai">Inbox</Badge> : null}
                        {entry.pantryItemId ? <Badge tone="health">Pantry</Badge> : null}
                      </div>
                      <p className="text-lg font-semibold">
                        {entry.merchant || entry.note || entry.category}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatLedgerTime(entry.occurredAt)}
                        {entry.location ? ` · ${entry.location}` : ''}
                      </p>
                      {entry.note ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-xl font-semibold">
                        {formatLedgerAmount(entry.amountCents)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => openEditForm(entry)}
                        >
                          <Pencil className="size-4" />
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => void removeLedgerEntry(entry.id)}
                        >
                          {deleting ? <ActionLoadingIcon /> : <Trash2 className="size-4" />}
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {ledgerPagination.hasMore ? (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ledgerLoadingMore}
              onClick={() => void loadMoreLedgerEntries()}
            >
              {ledgerLoadingMore ? <ActionLoadingIcon /> : null}
              {ledgerLoadingMore
                ? '加载中'
                : `加载更多 · ${ledgerEntries.length}/${ledgerPagination.total}`}
            </Button>
          </div>
        ) : ledgerEntries.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            已展示 {ledgerEntries.length} 条
          </p>
        ) : null}
      </section>

      <BottomSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        overlayLabel="关闭账目编辑"
        zIndexClassName="z-[70]"
        spacing="compact"
      >
        <SheetHeader
          title={editingEntry ? '编辑账目' : '记一笔'}
          onClose={closeForm}
          className="mb-4"
        />
        <form className="space-y-3.5" onSubmit={submitForm}>
          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="金额" error={formErrors.amount} density="compact">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={(event) => {
                  setForm((current) => ({ ...current, amount: Number(event.target.value) }));
                  setFormErrors((current) => ({ ...current, amount: undefined }));
                }}
                aria-invalid={Boolean(formErrors.amount)}
              />
            </FormItem>
            <FormItem label="时间" error={formErrors.occurredAt} density="compact">
              <Input
                type="datetime-local"
                value={form.occurredAt}
                onChange={(event) => {
                  setForm((current) => ({ ...current, occurredAt: event.target.value }));
                  setFormErrors((current) => ({ ...current, occurredAt: undefined }));
                }}
                aria-invalid={Boolean(formErrors.occurredAt)}
              />
            </FormItem>
          </div>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <SheetSelectField
              label="方向"
              density="compact"
              value={form.direction}
              options={ledgerDirectionOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  direction: value,
                }))
              }
            />
            <SheetSelectField
              label="分类"
              density="compact"
              value={form.category}
              options={ledgerCategoryOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value,
                }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="商家" density="compact">
              <Input
                value={form.merchant}
                onChange={(event) =>
                  setForm((current) => ({ ...current, merchant: event.target.value }))
                }
              />
            </FormItem>
            <FormItem label="地点" density="compact">
              <Input
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
              />
            </FormItem>
          </div>

          <FormItem label="备注" density="compact">
            <Textarea
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            />
          </FormItem>

          <SheetActions className="pt-1.5">
            <Button type="button" variant="secondary" onClick={closeForm}>
              取消
            </Button>
            <Button
              type="submit"
              variant="ai"
              disabled={
                editingEntry ? Boolean(ledgerUpdatingById[editingEntry.id]) : ledgerCreating
              }
            >
              {editingEntry && ledgerUpdatingById[editingEntry.id] ? <ActionLoadingIcon /> : null}
              {!editingEntry && ledgerCreating ? <ActionLoadingIcon /> : null}
              保存账目
            </Button>
          </SheetActions>
        </form>
      </BottomSheet>
    </div>
  );
}
