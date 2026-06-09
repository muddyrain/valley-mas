import { describe, expect, it } from 'vitest';
import {
  buildLedgerDraftFromInbox,
  formatLedgerAmount,
  getDefaultLedgerMonth,
  summarizeLedgerCategories,
} from '@/lib/ledger';
import type { InboxItem, LedgerEntry } from '@/types';

describe('ledger helpers', () => {
  it('formats ledger amounts with yuan precision', () => {
    expect(formatLedgerAmount(6850)).toBe('¥68.50');
    expect(formatLedgerAmount(-120)).toBe('-¥1.20');
  });

  it('summarizes expense categories only', () => {
    const entries: LedgerEntry[] = [
      buildEntry({ id: '1', amountCents: 3200, direction: '支出', category: '吃饭' }),
      buildEntry({ id: '2', amountCents: 1200, direction: '支出', category: '交通' }),
      buildEntry({ id: '3', amountCents: 900, direction: '收入', category: '其他' }),
      buildEntry({ id: '4', amountCents: 800, direction: '支出', category: '吃饭' }),
    ];

    expect(summarizeLedgerCategories(entries)).toEqual([
      { category: '吃饭', amountCents: 4000, amount: 40, count: 2 },
      { category: '交通', amountCents: 1200, amount: 12, count: 1 },
    ]);
  });

  it('builds an editable ledger draft from inbox text', () => {
    const item: InboxItem = {
      id: '7001',
      title: '午饭 32.5 元',
      content: '小面馆，牛肉面',
      itemType: 'text',
      tags: ['账目'],
      status: 'inbox',
    };

    expect(buildLedgerDraftFromInbox(item)).toMatchObject({
      amount: 32.5,
      direction: '支出',
      category: '吃饭',
      merchant: '午饭',
      note: '小面馆，牛肉面',
      inboxItemId: '7001',
    });
  });

  it('returns current month as yyyy-mm', () => {
    expect(getDefaultLedgerMonth(new Date('2026-06-09T10:00:00+08:00'))).toBe('2026-06');
  });
});

function buildEntry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: 'entry',
    amount: 0,
    amountCents: 0,
    currency: 'CNY',
    direction: '支出',
    category: '其他',
    occurredAt: '2026-06-09T10:00:00+08:00',
    merchant: '',
    location: '',
    note: '',
    ...overrides,
  };
}
