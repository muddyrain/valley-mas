import { apiRequest } from '@/api/request';
import type {
  ListPagination,
  NewRecurringPaymentInput,
  RecurringPayment,
  RecurringPaymentSummary,
  SubscriptionReminderRule,
} from '@/types';

export type RecurringPaymentStatusFilter = 'active' | 'archived' | 'all';

export type ListRecurringPaymentsOptions = {
  page?: number;
  pageSize?: number;
  status?: RecurringPaymentStatusFilter;
  category?: string;
  q?: string;
};

type RecurringPaymentResponse = {
  id: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  amountCents: number;
  currency: string;
  direction: string;
  merchant?: string;
  note: string;
  imageUrl?: string;
  frequency: string;
  interval: number;
  startedAt: string;
  nextDueAt: string;
  endAt?: string;
  archived: boolean;
  canceledAt?: string;
  reminderEnabled: boolean;
  reminderUseDefault: boolean;
  reminderRules: string[] | null;
  reminderTime: string;
  createdAt?: string;
  updatedAt?: string;
};

type RecurringPaymentSummaryResponse = {
  total: number;
  activeCount: number;
  overdueCount: number;
  upcomingCount: number;
  monthlyExpenseCents: number;
  upcomingDays: number;
};

const validRules: SubscriptionReminderRule[] = ['7d', '3d', 'same-day', 'overdue'];

function normalizeRules(rules: string[] | null | undefined): SubscriptionReminderRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return ['7d', '3d', 'same-day', 'overdue'];
  }
  const allowed = new Set<string>(validRules);
  const seen = new Set<SubscriptionReminderRule>();
  rules.forEach((rule) => {
    if (allowed.has(rule)) {
      seen.add(rule as SubscriptionReminderRule);
    }
  });
  return seen.size > 0 ? Array.from(seen) : ['7d', '3d', 'same-day', 'overdue'];
}

export function deserializeRecurringPayment(item: RecurringPaymentResponse): RecurringPayment {
  return {
    id: item.id,
    userId: item.userId,
    name: item.name,
    category: item.category as RecurringPayment['category'],
    amount: item.amount,
    amountCents: item.amountCents,
    currency: item.currency || 'CNY',
    direction: item.direction === '收入' ? '收入' : '支出',
    merchant: item.merchant ?? '',
    note: item.note ?? '',
    imageUrl: item.imageUrl ?? '',
    frequency: item.frequency as RecurringPayment['frequency'],
    interval: item.interval || 1,
    startedAt: item.startedAt,
    nextDueAt: item.nextDueAt,
    endAt: item.endAt ?? undefined,
    archived: Boolean(item.archived),
    canceledAt: item.canceledAt ?? undefined,
    reminder: {
      enabled: Boolean(item.reminderEnabled),
      useDefault: Boolean(item.reminderUseDefault),
      rules: normalizeRules(item.reminderRules),
      reminderTime: item.reminderTime || '09:00',
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeRecurringPayment(input: NewRecurringPaymentInput) {
  return {
    name: input.name,
    category: input.category,
    amount: input.amount,
    currency: input.currency ?? 'CNY',
    direction: input.direction,
    merchant: input.merchant ?? '',
    note: input.note ?? '',
    imageUrl: input.imageUrl ?? '',
    frequency: input.frequency,
    interval: input.interval,
    startedAt: input.startedAt,
    endAt: input.endAt ?? '',
    reminder: {
      enabled: input.reminder.enabled,
      useDefault: input.reminder.useDefault,
      rules: input.reminder.rules,
      reminderTime: input.reminder.reminderTime,
    },
  };
}

function buildRecurringPaymentsQuery(options: ListRecurringPaymentsOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options.category) {
    params.set('category', options.category);
  }
  if (options.q) {
    params.set('q', options.q);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function deserializeSummary(summary: RecurringPaymentSummaryResponse): RecurringPaymentSummary {
  return {
    total: summary.total,
    activeCount: summary.activeCount,
    overdueCount: summary.overdueCount,
    upcomingCount: summary.upcomingCount,
    monthlyExpenseCents: summary.monthlyExpenseCents,
    monthlyExpense: Math.round(summary.monthlyExpenseCents) / 100,
    upcomingDays: summary.upcomingDays,
  };
}

export async function listRecurringPayments(
  token: string,
  options: ListRecurringPaymentsOptions = {},
) {
  const data = await apiRequest<{
    list: RecurringPaymentResponse[];
    summary: RecurringPaymentSummaryResponse;
    pagination?: ListPagination;
  }>(`/life-trace/recurring-payments${buildRecurringPaymentsQuery(options)}`, token);
  return {
    list: data.list.map(deserializeRecurringPayment),
    summary: deserializeSummary(data.summary),
    pagination: data.pagination,
  };
}

export async function createRecurringPayment(token: string, input: NewRecurringPaymentInput) {
  const data = await apiRequest<RecurringPaymentResponse>('/life-trace/recurring-payments', token, {
    method: 'POST',
    body: JSON.stringify(serializeRecurringPayment(input)),
  });
  return deserializeRecurringPayment(data);
}

export async function updateRecurringPayment(
  token: string,
  id: string,
  input: NewRecurringPaymentInput,
) {
  const data = await apiRequest<RecurringPaymentResponse>(
    `/life-trace/recurring-payments/${id}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(serializeRecurringPayment(input)),
    },
  );
  return deserializeRecurringPayment(data);
}

export async function archiveRecurringPayment(token: string, id: string) {
  const data = await apiRequest<RecurringPaymentResponse>(
    `/life-trace/recurring-payments/${id}`,
    token,
    {
      method: 'DELETE',
    },
  );
  return deserializeRecurringPayment(data);
}

export async function advanceRecurringPayment(token: string, id: string) {
  const data = await apiRequest<RecurringPaymentResponse>(
    `/life-trace/recurring-payments/${id}/advance`,
    token,
    {
      method: 'POST',
    },
  );
  return deserializeRecurringPayment(data);
}
