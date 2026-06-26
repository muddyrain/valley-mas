import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceRecurringPayment,
  archiveRecurringPayment,
  createRecurringPayment,
  listRecurringPayments,
  updateRecurringPayment,
} from '../src/api/recurringPayments';
import type { NewRecurringPaymentInput } from '../src/types';

const token = 'test-token';

const recurringPaymentResponse = {
  id: 'recurring-1',
  userId: 'user-1',
  name: '视频会员',
  category: '订阅',
  amount: 29,
  amountCents: 2900,
  currency: 'CNY',
  direction: '支出',
  merchant: 'Example Video',
  note: '家庭共享会员',
  imageUrl: 'https://example.com/logo.png',
  frequency: 'monthly',
  interval: 1,
  startedAt: '2026-06-01T00:00:00.000Z',
  nextDueAt: '2026-07-01T00:00:00.000Z',
  endAt: '',
  archived: false,
  canceledAt: '',
  reminderEnabled: true,
  reminderUseDefault: false,
  reminderRules: ['3d', 'same-day', '3d', 'unknown'],
  reminderTime: '08:30',
  createdAt: '2026-06-01T08:00:00.000Z',
  updatedAt: '2026-06-02T08:00:00.000Z',
};

const recurringPaymentInput: NewRecurringPaymentInput = {
  name: '云盘会员',
  category: '订阅',
  amount: 18,
  currency: 'CNY',
  direction: '支出',
  merchant: 'Cloud Drive',
  note: '资料备份',
  imageUrl: '',
  frequency: 'yearly',
  interval: 1,
  startedAt: '2026-06-20T00:00:00.000Z',
  endAt: '',
  reminder: {
    enabled: true,
    useDefault: false,
    rules: ['7d', 'same-day'],
    reminderTime: '09:15',
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recurring payments api', () => {
  it('lists recurring payments with filters and normalizes reminder rules and summary amounts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          list: [
            recurringPaymentResponse,
            {
              ...recurringPaymentResponse,
              id: 'recurring-2',
              name: '保险年费',
              direction: '收入',
              currency: '',
              merchant: undefined,
              reminderRules: null,
              reminderTime: '',
            },
          ],
          summary: {
            total: 2,
            activeCount: 1,
            overdueCount: 0,
            upcomingCount: 1,
            monthlyExpenseCents: 12345,
            upcomingDays: 14,
          },
          pagination: { page: 2, pageSize: 10, total: 2 },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await listRecurringPayments(token, {
      page: 2,
      pageSize: 10,
      status: 'archived',
      category: '订阅',
      q: '会员 续费',
    });

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string, 'https://life-trace.test');
    expect(requestUrl.pathname).toBe('/api/v1/life-trace/recurring-payments');
    expect(requestUrl.searchParams.get('page')).toBe('2');
    expect(requestUrl.searchParams.get('pageSize')).toBe('10');
    expect(requestUrl.searchParams.get('status')).toBe('archived');
    expect(requestUrl.searchParams.get('category')).toBe('订阅');
    expect(requestUrl.searchParams.get('q')).toBe('会员 续费');

    expect(result.list[0].reminder.rules).toEqual(['3d', 'same-day']);
    expect(result.list[1].direction).toBe('收入');
    expect(result.list[1].currency).toBe('CNY');
    expect(result.list[1].merchant).toBe('');
    expect(result.list[1].reminder.rules).toEqual(['7d', '3d', 'same-day', 'overdue']);
    expect(result.list[1].reminder.reminderTime).toBe('09:00');
    expect(result.summary.monthlyExpenseCents).toBe(12345);
    expect(result.summary.monthlyExpense).toBe(123.45);
    expect(result.pagination?.page).toBe(2);
  });

  it('serializes create and update payloads with the nested reminder contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: recurringPaymentResponse,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { ...recurringPaymentResponse, name: '云盘会员 Pro' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const created = await createRecurringPayment(token, recurringPaymentInput);
    const updated = await updateRecurringPayment(token, 'recurring-1', {
      ...recurringPaymentInput,
      name: '云盘会员 Pro',
    });

    expect(created.name).toBe('视频会员');
    expect(updated.name).toBe('云盘会员 Pro');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/recurring-payments');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/life-trace/recurring-payments/recurring-1');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');

    const createBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(createBody).toEqual({
      name: '云盘会员',
      category: '订阅',
      amount: 18,
      currency: 'CNY',
      direction: '支出',
      merchant: 'Cloud Drive',
      note: '资料备份',
      imageUrl: '',
      frequency: 'yearly',
      interval: 1,
      startedAt: '2026-06-20T00:00:00.000Z',
      endAt: '',
      reminder: {
        enabled: true,
        useDefault: false,
        rules: ['7d', 'same-day'],
        reminderTime: '09:15',
      },
    });
  });

  it('uses the archive and advance endpoints for subscription lifecycle actions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { ...recurringPaymentResponse, archived: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            ...recurringPaymentResponse,
            nextDueAt: '2026-08-01T00:00:00.000Z',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const archived = await archiveRecurringPayment(token, 'recurring-1');
    const advanced = await advanceRecurringPayment(token, 'recurring-1');

    expect(archived.archived).toBe(true);
    expect(advanced.nextDueAt).toBe('2026-08-01T00:00:00.000Z');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/recurring-payments/recurring-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[1][0]).toBe(
      '/api/v1/life-trace/recurring-payments/recurring-1/advance',
    );
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
  });
});
