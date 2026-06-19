import {
  Archive,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  Repeat,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { FormItem, SheetActions, SheetHeader, SheetSelectField } from '@/components/FormItem';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatLedgerAmount, ledgerCategories } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type {
  LedgerCategory,
  NewRecurringPaymentInput,
  RecurringPayment,
  RecurringPaymentDirection,
  RecurringPaymentFrequency,
  SubscriptionReminderRule,
} from '@/types';

type StatusFilter = 'active' | 'archived' | 'all';

type RecurringFormErrors = Partial<Record<'amount' | 'name' | 'startedAt' | 'interval', string>>;

const subscriptionDirections: RecurringPaymentDirection[] = ['支出', '收入'];
const subscriptionFrequencies: RecurringPaymentFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'half_year',
  'yearly',
];
const subscriptionRules: SubscriptionReminderRule[] = ['7d', '3d', 'same-day', 'overdue'];

const directionOptions = subscriptionDirections.map((value) => ({ label: value, value }));
const categoryOptions = ledgerCategories.map((value) => ({ label: value, value }));
const frequencyLabel: Record<RecurringPaymentFrequency, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  quarterly: '每季度',
  half_year: '每半年',
  yearly: '每年',
};
const frequencyOptions = subscriptionFrequencies.map((value) => ({
  label: frequencyLabel[value],
  value,
}));
const ruleLabel: Record<SubscriptionReminderRule, string> = {
  '7d': '7 天前',
  '3d': '3 天前',
  'same-day': '当天',
  overdue: '逾期',
};
const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
];

const defaultForm: NewRecurringPaymentInput = {
  name: '',
  category: '订阅',
  amount: 0,
  currency: 'CNY',
  direction: '支出',
  merchant: '',
  note: '',
  imageUrl: '',
  frequency: 'monthly',
  interval: 1,
  startedAt: new Date().toISOString(),
  endAt: '',
  reminder: {
    enabled: true,
    useDefault: true,
    rules: ['7d', '3d', 'same-day', 'overdue'],
    reminderTime: '09:00',
  },
};

function formatDateLocal(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value?: string) {
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
  }).format(date);
}

function paymentToInput(item: RecurringPayment): NewRecurringPaymentInput {
  return {
    name: item.name,
    category: item.category,
    amount: item.amount,
    currency: item.currency || 'CNY',
    direction: item.direction,
    merchant: item.merchant ?? '',
    note: item.note ?? '',
    imageUrl: item.imageUrl ?? '',
    frequency: item.frequency,
    interval: item.interval || 1,
    startedAt: item.startedAt,
    endAt: item.endAt ?? '',
    reminder: { ...item.reminder },
  };
}

function normalizeFormInput(form: NewRecurringPaymentInput): NewRecurringPaymentInput {
  const startedDate = new Date(form.startedAt);
  const startedAt = Number.isNaN(startedDate.getTime())
    ? new Date().toISOString()
    : startedDate.toISOString();
  const endDate = form.endAt ? new Date(form.endAt) : null;
  const endAt = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString() : '';
  return {
    ...form,
    name: form.name.trim(),
    amount: Number(form.amount),
    currency: form.currency?.trim() || 'CNY',
    merchant: form.merchant?.trim() || '',
    note: form.note?.trim() || '',
    imageUrl: form.imageUrl?.trim() || '',
    interval: Math.max(1, Math.floor(Number(form.interval) || 1)),
    startedAt,
    endAt,
  };
}

function daysBetween(target: string) {
  const date = new Date(target);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }
  const now = new Date();
  const ms = date.getTime() - now.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function RecurringPaymentsPage() {
  const navigate = useNavigate();
  const recurringPayments = useLifeTraceStore((state) => state.recurringPayments);
  const recurringPaymentsLoaded = useLifeTraceStore((state) => state.recurringPaymentsLoaded);
  const recurringPaymentsLoading = useLifeTraceStore((state) => state.recurringPaymentsLoading);
  const recurringPaymentsError = useLifeTraceStore((state) => state.recurringPaymentsError);
  const recurringPaymentsSummary = useLifeTraceStore((state) => state.recurringPaymentsSummary);
  const recurringPaymentCreating = useLifeTraceStore((state) => state.recurringPaymentCreating);
  const recurringPaymentUpdatingById = useLifeTraceStore(
    (state) => state.recurringPaymentUpdatingById,
  );
  const recurringPaymentArchivingById = useLifeTraceStore(
    (state) => state.recurringPaymentArchivingById,
  );
  const loadRecurringPayments = useLifeTraceStore((state) => state.loadRecurringPayments);
  const addRecurringPayment = useLifeTraceStore((state) => state.addRecurringPayment);
  const editRecurringPayment = useLifeTraceStore((state) => state.editRecurringPayment);
  const archiveRecurringPaymentAction = useLifeTraceStore(
    (state) => state.archiveRecurringPaymentAction,
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [editingItem, setEditingItem] = useState<RecurringPayment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<NewRecurringPaymentInput>({
    ...defaultForm,
    startedAt: formatDateLocal(),
  });
  const [formErrors, setFormErrors] = useState<RecurringFormErrors>({});

  useEffect(() => {
    void loadRecurringPayments({ status: statusFilter });
  }, [loadRecurringPayments, statusFilter]);

  const sortedPayments = useMemo(() => {
    return [...recurringPayments].sort((a, b) => {
      if (a.archived !== b.archived) {
        return a.archived ? 1 : -1;
      }
      const ad = new Date(a.nextDueAt).getTime();
      const bd = new Date(b.nextDueAt).getTime();
      return ad - bd;
    });
  }, [recurringPayments]);

  const monthlyExpenseLabel = formatLedgerAmount(recurringPaymentsSummary.monthlyExpenseCents);

  const openCreateForm = () => {
    setEditingItem(null);
    setForm({
      ...defaultForm,
      startedAt: formatDateLocal(),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (item: RecurringPayment) => {
    setEditingItem(item);
    setForm({
      ...paymentToInput(item),
      startedAt: formatDateLocal(item.startedAt),
      endAt: item.endAt ? formatDateLocal(item.endAt) : '',
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingItem(null);
    setFormErrors({});
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: RecurringFormErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = '请填写订阅名称';
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = '请输入金额';
    }
    if (!form.startedAt) {
      nextErrors.startedAt = '请选择起始日期';
    }
    const interval = Number(form.interval);
    if (!Number.isFinite(interval) || interval <= 0) {
      nextErrors.interval = '请输入正整数';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const input = normalizeFormInput({ ...form, amount, interval });
    const saved = editingItem
      ? await editRecurringPayment(editingItem.id, input)
      : await addRecurringPayment(input);
    if (saved) {
      closeForm();
    }
  };

  const handleAdvance = (item: RecurringPayment) => {
    const params = new URLSearchParams({
      new: '1',
      amount: String(item.amount),
      category: item.category,
      direction: item.direction,
      recurringPaymentId: item.id,
    });
    if (item.merchant) {
      params.set('merchant', item.merchant);
    }
    if (item.name) {
      params.set('note', `${item.name} · ${frequencyLabel[item.frequency]}`);
    }
    navigate(`/ledger?${params.toString()}`);
  };

  const toggleRule = (rule: SubscriptionReminderRule) => {
    setForm((current) => {
      const exists = current.reminder.rules.includes(rule);
      const nextRules = exists
        ? current.reminder.rules.filter((value) => value !== rule)
        : [...current.reminder.rules, rule];
      return {
        ...current,
        reminder: {
          ...current.reminder,
          rules: nextRules.length > 0 ? nextRules : current.reminder.rules,
          useDefault: false,
        },
      };
    });
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
              Subscriptions
            </p>
            <h1 className="truncate text-2xl font-semibold">订阅与续费</h1>
          </div>
        </div>
        <Button type="button" variant="ai" size="sm" onClick={openCreateForm}>
          <Plus className="size-4" />
          新增订阅
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
              <Badge tone="health">每月折算</Badge>
              <p className="mt-4 text-sm text-muted-foreground">订阅与续费支出</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{monthlyExpenseLabel}</p>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl bg-life-health/10 text-life-health">
              <CircleDollarSign className="size-6" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">进行中</p>
              <p className="mt-1 text-sm font-semibold">{recurringPaymentsSummary.activeCount}</p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">即将到期</p>
              <p className="mt-1 text-sm font-semibold">{recurringPaymentsSummary.upcomingCount}</p>
            </div>
            <div className="rounded-2xl bg-secondary px-3 py-3">
              <p className="text-xs text-muted-foreground">已逾期</p>
              <p className="mt-1 text-sm font-semibold">{recurringPaymentsSummary.overdueCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">订阅清单</p>
              <p className="mt-1 text-xs text-muted-foreground">
                未来 {recurringPaymentsSummary.upcomingDays} 天内的提醒
              </p>
            </div>
            <CalendarClock className="size-5 text-life-health" />
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'h-9 rounded-xl border px-3 text-sm font-semibold transition',
                  statusFilter === option.value
                    ? 'border-life-health/40 bg-life-health/10 text-life-health'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            订阅推下一期后，会自动跳转到轻账本继续记一笔。
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        {recurringPaymentsError ? (
          <Card className="border-life-alert/30 bg-life-alert/10 p-4 text-sm text-life-alert">
            {recurringPaymentsError}
          </Card>
        ) : null}

        {recurringPaymentsLoading && !recurringPaymentsLoaded ? (
          <Card className="grid min-h-44 place-items-center p-6 text-sm text-muted-foreground">
            <LoaderCircle className="mb-3 size-6 animate-spin text-life-health motion-reduce:animate-none" />
            正在同步订阅
          </Card>
        ) : sortedPayments.length === 0 ? (
          <EmptyState
            title="还没有订阅"
            description="把会员、续费这类周期性账目记下来，到期前会发提醒。"
            eyebrow="订阅与续费"
            icon={Repeat}
            tone="health"
            action={
              <Button type="button" variant="ai" onClick={openCreateForm}>
                <Plus className="size-4" />
                新增订阅
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {sortedPayments.map((item) => {
              const updating = Boolean(recurringPaymentUpdatingById[item.id]);
              const archiving = Boolean(recurringPaymentArchivingById[item.id]);
              const disabled = updating || archiving;
              const days = daysBetween(item.nextDueAt);
              const dueLabel = item.archived
                ? '已归档'
                : days < 0
                  ? `逾期 ${Math.abs(days)} 天`
                  : days === 0
                    ? '今日到期'
                    : `${days} 天后到期`;
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={item.direction === '支出' ? 'health' : 'trace'}>
                          {item.direction}
                        </Badge>
                        <Badge tone="default">{item.category}</Badge>
                        <Badge tone="ai">{frequencyLabel[item.frequency]}</Badge>
                        {item.archived ? <Badge tone="default">已归档</Badge> : null}
                      </div>
                      <p className="text-lg font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {dueLabel}
                        {item.nextDueAt ? ` · ${formatDateDisplay(item.nextDueAt)}` : ''}
                        {item.merchant ? ` · ${item.merchant}` : ''}
                      </p>
                      {item.note ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-3">
                      <p className="text-xl font-semibold">
                        {formatLedgerAmount(item.amountCents, item.currency)}
                      </p>
                      <div className="flex flex-wrap justify-end gap-2">
                        {!item.archived ? (
                          <Button
                            type="button"
                            variant="ai"
                            size="sm"
                            disabled={disabled}
                            onClick={() => handleAdvance(item)}
                          >
                            <Play className="size-4" />
                            记一笔并推下一期
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => openEditForm(item)}
                        >
                          <Pencil className="size-4" />
                          编辑
                        </Button>
                        {!item.archived ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={() => void archiveRecurringPaymentAction(item.id)}
                          >
                            {archiving ? <ActionLoadingIcon /> : <Archive className="size-4" />}
                            归档
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <BottomSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        overlayLabel="关闭订阅编辑"
        zIndexClassName="z-[70]"
        spacing="compact"
      >
        <SheetHeader
          title={editingItem ? '编辑订阅' : '新增订阅'}
          onClose={closeForm}
          className="mb-4"
        />
        <form className="space-y-3.5" onSubmit={submitForm}>
          <FormItem label="名称" error={formErrors.name} density="compact">
            <Input
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }));
                setFormErrors((current) => ({ ...current, name: undefined }));
              }}
              aria-invalid={Boolean(formErrors.name)}
            />
          </FormItem>

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
            <SheetSelectField
              label="方向"
              density="compact"
              value={form.direction}
              options={directionOptions}
              onValueChange={(value) => setForm((current) => ({ ...current, direction: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <SheetSelectField
              label="分类"
              density="compact"
              value={form.category}
              options={categoryOptions}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  category: value as LedgerCategory,
                }))
              }
            />
            <SheetSelectField
              label="周期"
              density="compact"
              value={form.frequency}
              options={frequencyOptions}
              onValueChange={(value) => setForm((current) => ({ ...current, frequency: value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="间隔" error={formErrors.interval} density="compact">
              <Input
                type="number"
                min="1"
                step="1"
                value={form.interval}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    interval: Math.max(1, Number(event.target.value) || 1),
                  }));
                  setFormErrors((current) => ({ ...current, interval: undefined }));
                }}
                aria-invalid={Boolean(formErrors.interval)}
              />
            </FormItem>
            <FormItem label="起始日期" error={formErrors.startedAt} density="compact">
              <Input
                type="date"
                value={form.startedAt}
                onChange={(event) => {
                  setForm((current) => ({ ...current, startedAt: event.target.value }));
                  setFormErrors((current) => ({ ...current, startedAt: undefined }));
                }}
                aria-invalid={Boolean(formErrors.startedAt)}
              />
            </FormItem>
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
            <FormItem label="结束日期（可选）" density="compact">
              <Input
                type="date"
                value={form.endAt ?? ''}
                onChange={(event) =>
                  setForm((current) => ({ ...current, endAt: event.target.value }))
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

          <FormItem label="提醒节点" density="compact">
            <div className="flex flex-wrap gap-2">
              {subscriptionRules.map((rule) => {
                const active = form.reminder.rules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    className={cn(
                      'h-9 rounded-xl border px-3 text-sm font-semibold transition',
                      active
                        ? 'border-life-health/40 bg-life-health/10 text-life-health'
                        : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => toggleRule(rule)}
                  >
                    {ruleLabel[rule]}
                  </button>
                );
              })}
            </div>
          </FormItem>

          <FormItem label="提醒时间" density="compact">
            <Input
              type="time"
              value={form.reminder.reminderTime}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reminder: { ...current.reminder, reminderTime: event.target.value },
                }))
              }
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
                editingItem
                  ? Boolean(recurringPaymentUpdatingById[editingItem.id])
                  : recurringPaymentCreating
              }
            >
              {editingItem && recurringPaymentUpdatingById[editingItem.id] ? (
                <ActionLoadingIcon />
              ) : null}
              {!editingItem && recurringPaymentCreating ? <ActionLoadingIcon /> : null}
              保存订阅
            </Button>
          </SheetActions>
        </form>
      </BottomSheet>
    </div>
  );
}
