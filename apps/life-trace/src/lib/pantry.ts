import type {
  NewPantryItemInput,
  NewTraceInput,
  PantryCategory,
  PantryItem,
  PantryItemStatus,
  PantryLocation,
  PantryPreferences,
  PantryReminderConfig,
  PantryReminderRule,
} from '@/types';
import { formatPantryTagText, normalizePantryTags } from './pantryTags';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const pantryReminderRuleLabels: Record<PantryReminderRule, string> = {
  '7d': '7 天前',
  '3d': '3 天前',
  'same-day': '当天',
  expired: '已过期',
};

export function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function parsePantryDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPantryDaysUntilExpiry(item: PantryItem, now = new Date()) {
  const expiryDate = parsePantryDate(item.expiresAt);
  if (!expiryDate) {
    return null;
  }

  const today = startOfDay(now);
  return Math.round((expiryDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function formatCalendarDuration(fromDate: Date, toDate: Date) {
  if (toDate < fromDate) {
    return formatCalendarDuration(toDate, fromDate);
  }

  let years = toDate.getFullYear() - fromDate.getFullYear();
  let months = toDate.getMonth() - fromDate.getMonth();
  let days = toDate.getDate() - fromDate.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonthLastDay = new Date(toDate.getFullYear(), toDate.getMonth(), 0).getDate();
    days += previousMonthLastDay;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years}年`);
  }
  if (months > 0) {
    parts.push(`${months}个月`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${days}天`);
  }
  return parts.join('');
}

export function resolvePantryStatus(item: PantryItem, now = new Date()): PantryItemStatus {
  if (item.status === 'used-up' || item.status === 'discarded' || item.status === 'kept') {
    return item.status;
  }

  const daysUntilExpiry = getPantryDaysUntilExpiry(item, now);
  if (daysUntilExpiry === null) {
    return 'normal';
  }
  if (daysUntilExpiry < 0) {
    return 'expired';
  }
  if (daysUntilExpiry <= 7) {
    return 'expiring';
  }
  return 'normal';
}

export function getPantryPersistedStatus(status: PantryItemStatus): PantryItemStatus {
  if (status === 'used-up' || status === 'discarded' || status === 'kept') {
    return status;
  }
  return 'normal';
}

export function getPantryStatusLabel(status: PantryItemStatus) {
  switch (status) {
    case 'expiring':
      return '临期';
    case 'expired':
      return '已过期';
    case 'kept':
      return '仍在使用';
    case 'used-up':
      return '已用完';
    case 'discarded':
      return '已丢弃';
    default:
      return '正常';
  }
}

export function getPantryStatusTone(status: PantryItemStatus) {
  switch (status) {
    case 'expiring':
      return 'health';
    case 'expired':
      return 'alert';
    case 'kept':
      return 'plan';
    case 'used-up':
      return 'trace';
    case 'discarded':
      return 'default';
    default:
      return 'plan';
  }
}

export function getPantryExpiryText(item: PantryItem, now = new Date()) {
  const daysUntilExpiry = getPantryDaysUntilExpiry(item, now);
  if (daysUntilExpiry === null) {
    return '未设置过期日';
  }
  const today = startOfDay(now);
  const expiryDate = parsePantryDate(item.expiresAt);
  const durationText =
    expiryDate && Math.abs(daysUntilExpiry) >= 30
      ? formatCalendarDuration(today, expiryDate)
      : `${Math.abs(daysUntilExpiry)}天`;
  if (daysUntilExpiry < 0) {
    return `已过期${durationText}`;
  }
  if (daysUntilExpiry === 0) {
    return '今天到期';
  }
  return `${durationText}后到期`;
}

export function getPantryCoverUrl(item: PantryItem) {
  return item.thumbnailUrl || item.imageUrl || '';
}

export function formatPantryReminderSummary(reminder: PantryReminderConfig) {
  if (!reminder.enabled || reminder.rules.length === 0) {
    return '不提醒';
  }
  const labels = reminder.rules.map((rule) => pantryReminderRuleLabels[rule]);
  return labels.join(' / ');
}

export function buildDefaultPantryReminder(
  preferences: PantryPreferences,
  enabled = preferences.defaultReminderEnabled,
): PantryReminderConfig {
  return {
    enabled,
    useDefault: true,
    rules: preferences.defaultReminderRules,
    reminderTime: preferences.defaultReminderTime,
  };
}

export function sortPantryItems(items: PantryItem[], now = new Date()) {
  const priority = {
    expired: 0,
    expiring: 1,
    normal: 2,
    kept: 2,
    'used-up': 3,
    discarded: 4,
  } satisfies Record<PantryItemStatus, number>;

  return [...items].sort((left, right) => {
    const leftStatus = resolvePantryStatus(left, now);
    const rightStatus = resolvePantryStatus(right, now);
    if (priority[leftStatus] !== priority[rightStatus]) {
      return priority[leftStatus] - priority[rightStatus];
    }

    const leftDays = getPantryDaysUntilExpiry(left, now);
    const rightDays = getPantryDaysUntilExpiry(right, now);
    if (leftDays !== rightDays) {
      return (leftDays ?? Number.POSITIVE_INFINITY) - (rightDays ?? Number.POSITIVE_INFINITY);
    }

    return left.name.localeCompare(right.name, 'zh-CN');
  });
}

export function getPantryOverview(items: PantryItem[], now = new Date()) {
  const statuses = items.map((item) => resolvePantryStatus(item, now));
  return {
    total: items.length,
    expiring: statuses.filter((status) => status === 'expiring').length,
    expired: statuses.filter((status) => status === 'expired').length,
    active: statuses.filter(
      (status) => status === 'normal' || status === 'expiring' || status === 'kept',
    ).length,
  };
}

export function generatePantryThumbnailDataUrl(name: string, category: PantryItem['category']) {
  const palette: Record<PantryItem['category'], [string, string]> = {
    食品: ['#10b981', '#0f172a'],
    日用品: ['#06b6d4', '#0f172a'],
    药品: ['#f97316', '#0f172a'],
    宠物: ['#8b5cf6', '#0f172a'],
    其他: ['#64748b', '#0f172a'],
  };
  const [accent, deep] = palette[category];
  const first = Array.from(name.trim())[0] ?? category[0];
  const label = name.trim().slice(0, 10) || category;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.88" />
          <stop offset="100%" stop-color="${deep}" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect width="720" height="480" rx="48" fill="url(#bg)" />
      <circle cx="564" cy="114" r="92" fill="#ffffff" fill-opacity="0.08" />
      <circle cx="134" cy="400" r="118" fill="#ffffff" fill-opacity="0.06" />
      <text x="72" y="118" fill="#f8fafc" fill-opacity="0.78" font-family="Arial, sans-serif" font-size="28">AI 缩略图</text>
      <text x="72" y="270" fill="#ffffff" font-family="Arial, sans-serif" font-size="160" font-weight="700">${first}</text>
      <text x="72" y="360" fill="#f8fafc" font-family="Arial, sans-serif" font-size="54" font-weight="700">${label}</text>
      <text x="72" y="408" fill="#e2e8f0" fill-opacity="0.88" font-family="Arial, sans-serif" font-size="28">${category}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function formatPantryTraceTime(now = new Date()) {
  return now.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildPantryTraceInput(
  item: PantryItem,
  action: 'used-up' | 'discarded',
  now = new Date(),
): NewTraceInput {
  const actionLabel = action === 'used-up' ? '用完' : '丢弃';
  const quantityText = `${item.quantity}${item.unit}`;
  return {
    title: `${action === 'used-up' ? '已用完' : '已丢弃'}：${item.name}`,
    summary:
      action === 'used-up'
        ? `已将「${item.name}」标记为已用完，处理数量为 ${quantityText}。`
        : `已将「${item.name}」标记为已丢弃，处理数量为 ${quantityText}。`,
    timeLabel: formatPantryTraceTime(now),
    location: item.location,
    imageUrl: getPantryCoverUrl(item),
    mood: action === 'used-up' ? '踏实' : '提醒',
    tags: [item.category, ...item.tags, '家庭库存', actionLabel],
    source: '库存',
  };
}

export function buildPantryCreatedTraceInput(item: PantryItem, now = new Date()): NewTraceInput {
  const expiryText = item.expiresAt ? `，保质期记录到 ${item.expiresAt}` : '';
  return {
    title: `新增库存：${item.name}`,
    summary: `已将「${item.name}」新增到「${item.householdId ? '共享空间' : '我的空间'}」，数量为 ${item.quantity}${item.unit}${expiryText}。`,
    timeLabel: formatPantryTraceTime(now),
    location: item.location,
    imageUrl: getPantryCoverUrl(item),
    mood: '踏实',
    tags: [item.category, ...item.tags, '家庭库存', '新增库存'],
    source: '库存',
  };
}

const pantryCategoryAllowList: readonly PantryCategory[] = [
  '食品',
  '日用品',
  '药品',
  '宠物',
  '其他',
];
const pantryLocationAllowList: readonly PantryLocation[] = [
  '冷藏',
  '冷冻',
  '厨房',
  '储物柜',
  '卫生间',
  '玄关',
  '其他',
];

export type PantryAiFieldKey =
  | 'name'
  | 'category'
  | 'location'
  | 'quantity'
  | 'unit'
  | 'expiresAt'
  | 'openedAt'
  | 'tags'
  | 'note';

const pantryAiFieldLabels: Record<PantryAiFieldKey, string> = {
  name: '名称',
  category: '分类',
  location: '位置',
  quantity: '数量',
  unit: '单位',
  expiresAt: '过期日期',
  openedAt: '开封日期',
  tags: '标签',
  note: '备注',
};

export type PantryAiFieldSuggestion = {
  key: PantryAiFieldKey;
  label: string;
  currentDisplay: string;
  suggestionDisplay: string;
  defaultChecked: boolean;
  apply: (form: NewPantryItemInput) => NewPantryItemInput;
};

type PantryAiSource = {
  name?: string;
  category?: string;
  brand?: string;
  spec?: string;
  quantity?: number;
  unit?: string;
  storageLocation?: string;
  expiresAt?: string;
  productionDate?: string;
  purchaseDate?: string;
  tags?: string[];
  summary?: string;
};

function isEmptyText(value?: string) {
  return !value || !value.trim();
}

function pickEnumValue<T extends string>(allowList: readonly T[], raw?: string): T | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  return (allowList as readonly string[]).includes(trimmed) ? (trimmed as T) : null;
}

export function buildPantryAiFieldDiff(
  form: NewPantryItemInput,
  ai: PantryAiSource,
): PantryAiFieldSuggestion[] {
  const suggestions: PantryAiFieldSuggestion[] = [];

  const aiName = ai.name?.trim();
  if (aiName && aiName !== form.name.trim()) {
    suggestions.push({
      key: 'name',
      label: pantryAiFieldLabels.name,
      currentDisplay: form.name.trim() || '未填写',
      suggestionDisplay: aiName,
      defaultChecked: isEmptyText(form.name),
      apply: (current) => ({ ...current, name: aiName }),
    });
  }

  const aiCategory = pickEnumValue(pantryCategoryAllowList, ai.category);
  if (aiCategory && aiCategory !== form.category) {
    suggestions.push({
      key: 'category',
      label: pantryAiFieldLabels.category,
      currentDisplay: form.category,
      suggestionDisplay: aiCategory,
      defaultChecked: false,
      apply: (current) => ({ ...current, category: aiCategory }),
    });
  }

  const aiLocation = pickEnumValue(pantryLocationAllowList, ai.storageLocation);
  if (aiLocation && aiLocation !== form.location) {
    suggestions.push({
      key: 'location',
      label: pantryAiFieldLabels.location,
      currentDisplay: form.location,
      suggestionDisplay: aiLocation,
      defaultChecked: false,
      apply: (current) => ({ ...current, location: aiLocation }),
    });
  }

  if (typeof ai.quantity === 'number' && ai.quantity > 0 && ai.quantity !== form.quantity) {
    const aiQuantity = ai.quantity;
    suggestions.push({
      key: 'quantity',
      label: pantryAiFieldLabels.quantity,
      currentDisplay: String(form.quantity),
      suggestionDisplay: String(aiQuantity),
      defaultChecked: form.quantity <= 1,
      apply: (current) => ({ ...current, quantity: aiQuantity }),
    });
  }

  const aiUnit = ai.unit?.trim();
  if (aiUnit && aiUnit !== form.unit.trim()) {
    suggestions.push({
      key: 'unit',
      label: pantryAiFieldLabels.unit,
      currentDisplay: form.unit || '未填写',
      suggestionDisplay: aiUnit,
      defaultChecked: !form.unit || form.unit === '件',
      apply: (current) => ({ ...current, unit: aiUnit }),
    });
  }

  const aiExpires = ai.expiresAt?.trim();
  if (aiExpires && aiExpires !== (form.expiresAt || '')) {
    suggestions.push({
      key: 'expiresAt',
      label: pantryAiFieldLabels.expiresAt,
      currentDisplay: form.expiresAt || '未填写',
      suggestionDisplay: aiExpires,
      defaultChecked: isEmptyText(form.expiresAt),
      apply: (current) => ({ ...current, expiresAt: aiExpires }),
    });
  }

  const aiOpenedAt = ai.purchaseDate?.trim();
  if (aiOpenedAt && aiOpenedAt !== (form.openedAt || '')) {
    suggestions.push({
      key: 'openedAt',
      label: pantryAiFieldLabels.openedAt,
      currentDisplay: form.openedAt || '未填写',
      suggestionDisplay: aiOpenedAt,
      defaultChecked: isEmptyText(form.openedAt),
      apply: (current) => ({ ...current, openedAt: aiOpenedAt }),
    });
  }

  const aiTags = normalizePantryTags(Array.isArray(ai.tags) ? ai.tags : []);
  const currentTags = normalizePantryTags(form.tags ?? []);
  if (aiTags.length > 0 && formatPantryTagText(aiTags) !== formatPantryTagText(currentTags)) {
    suggestions.push({
      key: 'tags',
      label: pantryAiFieldLabels.tags,
      currentDisplay: formatPantryTagText(currentTags) || '未填写',
      suggestionDisplay: formatPantryTagText(aiTags),
      defaultChecked: currentTags.length === 0,
      apply: (current) => ({ ...current, tags: aiTags }),
    });
  }

  const aiNote = ai.summary?.trim();
  if (aiNote && aiNote !== form.note.trim()) {
    suggestions.push({
      key: 'note',
      label: pantryAiFieldLabels.note,
      currentDisplay: form.note.trim() || '未填写',
      suggestionDisplay: aiNote,
      defaultChecked: isEmptyText(form.note),
      apply: (current) => ({ ...current, note: aiNote }),
    });
  }

  return suggestions;
}

export function applyPantryAiFieldSuggestions(
  form: NewPantryItemInput,
  suggestions: PantryAiFieldSuggestion[],
  selectedKeys: ReadonlySet<PantryAiFieldKey>,
): NewPantryItemInput {
  return suggestions.reduce<NewPantryItemInput>((current, suggestion) => {
    if (!selectedKeys.has(suggestion.key)) {
      return current;
    }
    return suggestion.apply(current);
  }, form);
}

type PantryShelfLifeRule = {
  keywords: string[];
  category?: PantryCategory;
  maxDays: number;
  label: string;
};

const pantryShelfLifeRules: PantryShelfLifeRule[] = [
  { keywords: ['鲜奶', '低温奶', '巴氏奶'], category: '食品', maxDays: 30, label: '鲜奶' },
  { keywords: ['酸奶', '老酸奶'], category: '食品', maxDays: 45, label: '酸奶' },
  { keywords: ['鸡蛋', '鸭蛋', '鹅蛋'], category: '食品', maxDays: 60, label: '鲜蛋' },
  { keywords: ['豆腐', '豆浆'], category: '食品', maxDays: 14, label: '豆制品' },
  { keywords: ['面包', '吐司', '蛋糕'], category: '食品', maxDays: 30, label: '烘焙食品' },
  { keywords: ['卤味', '熟食', '凉拌'], category: '食品', maxDays: 7, label: '熟食/卤味' },
  { keywords: ['鲜肉', '冷鲜肉'], category: '食品', maxDays: 7, label: '冷鲜肉' },
  { keywords: ['冷冻肉', '速冻'], category: '食品', maxDays: 365, label: '冷冻食品' },
  { keywords: ['绿叶菜', '青菜', '生菜', '菠菜'], category: '食品', maxDays: 14, label: '叶菜' },
  { keywords: ['草莓', '蓝莓', '樱桃'], category: '食品', maxDays: 14, label: '浆果' },
];

const pantryCategoryFallbackMaxDays: Record<PantryCategory, number> = {
  食品: 730,
  日用品: 1825,
  药品: 1095,
  宠物: 1095,
  其他: 1825,
};

export type PantryShelfLifeWarning = {
  severity: 'warning';
  message: string;
};

export function validatePantryShelfLife(input: {
  name: string;
  category: PantryCategory;
  expiresAt: string;
  now?: Date;
}): PantryShelfLifeWarning | null {
  const trimmedName = input.name?.trim();
  if (!trimmedName) {
    return null;
  }
  const expiry = parsePantryDate(input.expiresAt);
  if (!expiry) {
    return null;
  }
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const days = Math.round((expiry.getTime() - today.getTime()) / DAY_IN_MS);
  if (days <= 0) {
    return null;
  }

  const matchedRule = pantryShelfLifeRules.find(
    (rule) =>
      (!rule.category || rule.category === input.category) &&
      rule.keywords.some((keyword) => trimmedName.includes(keyword)),
  );

  if (matchedRule) {
    if (days <= matchedRule.maxDays) {
      return null;
    }
    return {
      severity: 'warning',
      message: `${matchedRule.label}通常保质期不超过 ${matchedRule.maxDays} 天,当前填写为 ${days} 天,请确认日期是否正确。`,
    };
  }

  const fallbackMax = pantryCategoryFallbackMaxDays[input.category];
  if (days <= fallbackMax) {
    return null;
  }
  return {
    severity: 'warning',
    message: `${input.category}类商品保质期通常不超过 ${fallbackMax} 天,当前填写为 ${days} 天,请确认日期是否正确。`,
  };
}
