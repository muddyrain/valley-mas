import type { Plan } from '@/types';
import { buildScheduledDateTime, getPlanScheduledDateTime, parseClockTime } from './planSchedule';

const weekdayMap: Record<string, number> = {
  周日: 0,
  星期日: 0,
  周六: 6,
  星期六: 6,
};

export type NextReminder = {
  plan: Plan;
  dueAt: Date;
  dateText: string;
  timeText: string;
  relativeText: string;
};

export type DueReminder = {
  plan: Plan;
  dueAt: Date;
  dateText: string;
  timeText: string;
};

export function splitPlanTimeLabel(timeLabel: string) {
  const [dateText, timeText, ...rest] = timeLabel.trim().split(/\s+/);
  return {
    dateText: dateText || '待定',
    timeText: timeText || rest.join(' ') || '待定',
  };
}

function buildDate(base: Date, daysToAdd: number, time: string) {
  const parsed = parseClockTime(time);
  if (!parsed) {
    return null;
  }

  const date = new Date(base);
  date.setDate(base.getDate() + daysToAdd);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

function getDaysUntilWeekday(base: Date, targetWeekday: number) {
  const diff = (targetWeekday - base.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}

function parseTimeLabelDate(timeLabel: string, now: Date) {
  const [datePart, timePart] = timeLabel.trim().split(/\s+/);
  if (!datePart || !timePart) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map(Number);
    const parsed = parseClockTime(timePart);
    return parsed ? new Date(year, month - 1, day, parsed.hours, parsed.minutes, 0, 0) : null;
  }

  if (datePart === '今天') {
    return buildDate(now, 0, timePart);
  }

  if (datePart === '明天') {
    return buildDate(now, 1, timePart);
  }

  const weekday = weekdayMap[datePart];
  if (weekday !== undefined) {
    return buildDate(now, getDaysUntilWeekday(now, weekday), timePart);
  }

  return null;
}

export function parsePlanReminderDate(plan: Plan, now = new Date()) {
  const scheduledDateTime = getPlanScheduledDateTime(plan);
  if (scheduledDateTime) {
    return scheduledDateTime;
  }

  return parseTimeLabelDate(plan.timeLabel, now);
}

export function formatReminderDateText(dueAt: Date, now = new Date()) {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const target = new Date(dueAt);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - base.getTime()) / 86_400_000);

  if (diffDays === -2) {
    return '前天';
  }
  if (diffDays === -1) {
    return '昨天';
  }
  if (diffDays === 0) {
    return '今天';
  }
  if (diffDays === 1) {
    return '明天';
  }
  if (diffDays === 2) {
    return '后天';
  }

  return dueAt.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatReminderTimeText(dueAt: Date) {
  return dueAt.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getPlanDisplayTimeParts(
  plan: Pick<Plan, 'scheduledDate' | 'scheduledTime' | 'timeLabel'>,
  now = new Date(),
) {
  const scheduledDateTime = buildScheduledDateTime(plan.scheduledDate, plan.scheduledTime);
  if (scheduledDateTime) {
    return {
      dateText: formatReminderDateText(scheduledDateTime, now),
      timeText: formatReminderTimeText(scheduledDateTime),
    };
  }

  return splitPlanTimeLabel(plan.timeLabel);
}

export function getReminderRelativeText(dueAt: Date, now = new Date()) {
  const diffMinutes = Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 60000));

  if (diffMinutes < 60) {
    return diffMinutes <= 0 ? '现在' : `${diffMinutes} 分钟后`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  if (diffHours < 24) {
    return remainingMinutes > 0
      ? `${diffHours} 小时 ${remainingMinutes} 分钟后`
      : `${diffHours} 小时后`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天后`;
}

export function getNextReminder(plans: Plan[], now = new Date()): NextReminder | null {
  const next = plans
    .filter((plan) => plan.reminder && !plan.completed)
    .map((plan) => ({ plan, dueAt: parsePlanReminderDate(plan, now) }))
    .filter((item): item is { plan: Plan; dueAt: Date } => Boolean(item.dueAt))
    .filter((item) => item.dueAt.getTime() >= now.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0];

  if (!next) {
    return null;
  }

  return {
    ...next,
    dateText: formatReminderDateText(next.dueAt, now),
    timeText: formatReminderTimeText(next.dueAt),
    relativeText: getReminderRelativeText(next.dueAt, now),
  };
}

export function getDueReminder(
  plans: Plan[],
  now = new Date(),
  {
    ignoredPlanIds = [],
    snoozedUntilByPlanId = {},
    lookbackMinutes = 720,
  }: {
    ignoredPlanIds?: string[];
    snoozedUntilByPlanId?: Record<string, number>;
    lookbackMinutes?: number;
  } = {},
): DueReminder | null {
  const ignored = new Set(ignoredPlanIds);
  const lookbackMs = lookbackMinutes * 60000;
  const nowTime = now.getTime();

  const due = plans
    .filter((plan) => plan.reminder && !plan.completed && !ignored.has(plan.id))
    .filter((plan) => {
      const snoozedUntil = snoozedUntilByPlanId[plan.id] ?? 0;
      return snoozedUntil <= nowTime;
    })
    .map((plan) => ({ plan, dueAt: parsePlanReminderDate(plan, now) }))
    .filter((item): item is { plan: Plan; dueAt: Date } => Boolean(item.dueAt))
    .filter((item) => {
      const dueTime = item.dueAt.getTime();
      return dueTime <= nowTime && nowTime - dueTime <= lookbackMs;
    })
    .sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime())[0];

  if (!due) {
    return null;
  }

  return {
    ...due,
    dateText: formatReminderDateText(due.dueAt, now),
    timeText: formatReminderTimeText(due.dueAt),
  };
}
