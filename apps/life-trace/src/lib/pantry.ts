import type {
  NewTraceInput,
  PantryItem,
  PantryItemStatus,
  PantryPreferences,
  PantryReminderConfig,
  PantryReminderRule,
} from '@/types';

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
  if (item.status === 'used-up' || item.status === 'discarded') {
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
  return status === 'used-up' || status === 'discarded' ? status : 'normal';
}

export function getPantryStatusLabel(status: PantryItemStatus) {
  switch (status) {
    case 'expiring':
      return '临期';
    case 'expired':
      return '已过期';
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
    active: statuses.filter((status) => status === 'normal' || status === 'expiring').length,
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
