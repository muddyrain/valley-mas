import type {
  InboxItem,
  LedgerCategory,
  LedgerCategorySummary,
  LedgerDirection,
  LedgerEntry,
  NewLedgerEntryInput,
} from '@/types';

export const ledgerDirections: LedgerDirection[] = ['支出', '收入', '退款', '转账备注'];

export const ledgerCategories: LedgerCategory[] = [
  '吃饭',
  '交通',
  '购物',
  '书影音',
  '订阅',
  '家用',
  '礼物',
  '医疗',
  '其他',
];

const categoryKeywords: Array<{ category: LedgerCategory; keywords: string[] }> = [
  {
    category: '吃饭',
    keywords: ['饭', '餐', '咖啡', '奶茶', '外卖', '面', '火锅', '早餐', '午饭', '晚饭'],
  },
  { category: '交通', keywords: ['地铁', '公交', '打车', '停车', '加油', '机票', '火车'] },
  { category: '购物', keywords: ['买', '购', '超市', '便利店', '商场'] },
  { category: '书影音', keywords: ['电影', '书', '音乐', '游戏', '展'] },
  { category: '订阅', keywords: ['会员', '订阅', '续费'] },
  { category: '家用', keywords: ['家用', '日用品', '水电', '燃气'] },
  { category: '礼物', keywords: ['礼物', '红包'] },
  { category: '医疗', keywords: ['医院', '药', '体检', '牙'] },
];

export function getDefaultLedgerMonth(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatLedgerAmount(amountCents: number, currency = 'CNY') {
  const sign = amountCents < 0 ? '-' : '';
  const amount = Math.abs(amountCents) / 100;
  const symbol = currency === 'CNY' ? '¥' : `${currency} `;
  return `${sign}${symbol}${amount.toFixed(2)}`;
}

export function summarizeLedgerCategories(entries: LedgerEntry[]): LedgerCategorySummary[] {
  const summary = new Map<LedgerCategory, LedgerCategorySummary>();
  for (const entry of entries) {
    if (entry.direction !== '支出') {
      continue;
    }
    const current =
      summary.get(entry.category) ??
      ({
        category: entry.category,
        amountCents: 0,
        amount: 0,
        count: 0,
      } satisfies LedgerCategorySummary);
    current.amountCents += entry.amountCents;
    current.amount = current.amountCents / 100;
    current.count += 1;
    summary.set(entry.category, current);
  }
  return Array.from(summary.values()).sort((a, b) => b.amountCents - a.amountCents);
}

export function getLedgerAmountFromText(text: string) {
  const match =
    text.match(/(?:¥|￥)\s*(\d+(?:\.\d{1,2})?)/) ??
    text.match(/(\d+(?:\.\d{1,2})?)\s*(?:元|块|rmb|RMB)/);
  if (!match) {
    return 0;
  }
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : 0;
}

export function inferLedgerCategory(text: string): LedgerCategory {
  for (const item of categoryKeywords) {
    if (item.keywords.some((keyword) => text.includes(keyword))) {
      return item.category;
    }
  }
  return '其他';
}

export function inferLedgerMerchant(title: string) {
  return title
    .replace(/(?:¥|￥)?\s*\d+(?:\.\d{1,2})?\s*(?:元|块|rmb|RMB)?/g, '')
    .replace(/[，,。；;：:]/g, ' ')
    .trim()
    .slice(0, 80);
}

export function buildLedgerDraftFromInbox(item: InboxItem): Partial<NewLedgerEntryInput> {
  const text = [item.title, item.content, item.linkUrl].filter(Boolean).join('\n');
  return {
    amount: getLedgerAmountFromText(text),
    currency: 'CNY',
    direction: '支出',
    category: inferLedgerCategory(text),
    occurredAt: new Date().toISOString(),
    merchant: inferLedgerMerchant(item.title),
    note: [item.content, item.linkUrl].filter(Boolean).join('\n'),
    inboxItemId: item.id,
  };
}
