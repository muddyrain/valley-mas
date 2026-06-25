import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');
const profilePageSource = readFileSync(resolve(__dirname, '../src/pages/ProfilePage.tsx'), 'utf8');
const ledgerPageSource = readFileSync(resolve(__dirname, '../src/pages/LedgerPage.tsx'), 'utf8');
const recurringPaymentsPagePath = resolve(__dirname, '../src/pages/RecurringPaymentsPage.tsx');
const recurringPaymentsPageSource = readFileSync(recurringPaymentsPagePath, 'utf8');
const recurringPaymentsApiSource = readFileSync(
  resolve(__dirname, '../src/api/recurringPayments.ts'),
  'utf8',
);

describe('recurring payments page surface', () => {
  it('registers the subscription page route and exposes the profile entry', () => {
    expect(existsSync(recurringPaymentsPagePath)).toBe(true);
    expect(appSource).toContain('path="/recurring-payments"');
    expect(appSource).toContain('<RecurringPaymentsPage />');
    expect(profilePageSource).toContain("navigate('/recurring-payments')");
    expect(profilePageSource).toContain('订阅与续费');
    expect(profilePageSource).toContain('统一管理周期性支出，到期前会发提醒。');
  });

  it('keeps the page wired to recurring payment store actions and backend endpoints', () => {
    expect(recurringPaymentsPageSource).toContain(
      'loadRecurringPayments({ status: statusFilter })',
    );
    expect(recurringPaymentsPageSource).toContain('addRecurringPayment(input)');
    expect(recurringPaymentsPageSource).toContain('editRecurringPayment(editingItem.id, input)');
    expect(recurringPaymentsPageSource).toContain('archiveRecurringPaymentAction(item.id)');
    expect(recurringPaymentsApiSource).toContain('/life-trace/recurring-payments');
    expect(recurringPaymentsApiSource).toContain(
      '/life-trace/recurring-payments/$' + '{id}/advance',
    );
  });

  it('keeps renewal recording handed off to Ledger before advancing the subscription', () => {
    expect(recurringPaymentsPageSource).toContain('navigate(`/ledger?$' + '{params.toString()}`)');
    expect(recurringPaymentsPageSource).toContain('recurringPaymentId: item.id');
    expect(ledgerPageSource).toContain("params.get('recurringPaymentId') || undefined");
    expect(ledgerPageSource).toContain('advanceRecurringPaymentAction(input.recurringPaymentId)');
    expect(ledgerPageSource).toContain('if (!editingEntry && input.recurringPaymentId)');
  });
});
