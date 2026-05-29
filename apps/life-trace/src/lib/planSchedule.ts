import type { Plan } from '@/types';

export type PlanDateOption = '今天' | '明天' | '周五' | '周六' | '周日' | 'custom';

type BuildPlanScheduleInput = {
  dateOption: PlanDateOption;
  customDate?: string;
  time: string;
  now?: Date;
};

type BuildTodayScheduleInput = {
  timeLabel: string;
  scheduledTime: string;
  now?: Date;
};

const weekdayMap: Partial<Record<PlanDateOption | string, number>> = {
  周日: 0,
  星期日: 0,
  周五: 5,
  星期五: 5,
  周六: 6,
  星期六: 6,
};

export function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
}

export function getLocalISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseClockTime(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(base.getDate() + days);
  return date;
}

function getDaysUntilWeekday(base: Date, targetWeekday: number) {
  return (targetWeekday - base.getDay() + 7) % 7;
}

export function resolveScheduledDate(
  dateOption: PlanDateOption | string,
  customDate = '',
  now = new Date(),
) {
  if (dateOption === 'custom') {
    return customDate;
  }

  if (dateOption === '今天') {
    return getLocalISODate(now);
  }

  if (dateOption === '明天') {
    return getLocalISODate(addDays(now, 1));
  }

  const weekday = weekdayMap[dateOption];
  if (weekday !== undefined) {
    return getLocalISODate(addDays(now, getDaysUntilWeekday(now, weekday)));
  }

  return '';
}

export function buildPlanSchedule({
  dateOption,
  customDate = '',
  time,
  now = new Date(),
}: BuildPlanScheduleInput) {
  const scheduledDate = resolveScheduledDate(dateOption, customDate, now);

  return {
    timeLabel: `${scheduledDate || (dateOption === 'custom' ? customDate : dateOption)} ${time}`,
    scheduledDate,
    scheduledTime: time,
    timezone: getClientTimezone(),
  };
}

export function buildTodaySchedule({ scheduledTime, now = new Date() }: BuildTodayScheduleInput) {
  const scheduledDate = getLocalISODate(now);

  return {
    timeLabel: `${scheduledDate} ${scheduledTime}`,
    scheduledDate,
    scheduledTime,
    timezone: getClientTimezone(),
  };
}

export function buildScheduledDateTime(
  scheduledDate?: string,
  scheduledTime?: string,
): Date | null {
  if (!scheduledDate || !scheduledTime || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return null;
  }

  const parsedTime = parseClockTime(scheduledTime);
  if (!parsedTime) {
    return null;
  }

  const [year, month, day] = scheduledDate.split('-').map(Number);
  return new Date(year, month - 1, day, parsedTime.hours, parsedTime.minutes, 0, 0);
}

export function getPlanScheduledDateTime(plan: Plan) {
  return buildScheduledDateTime(plan.scheduledDate, plan.scheduledTime);
}

export function isPlanScheduledToday(plan: Plan, now = new Date()) {
  if (plan.scheduledDate) {
    return plan.scheduledDate === getLocalISODate(now);
  }

  return plan.timeLabel.trim().startsWith('今天');
}

export function isPlanScheduledWeekend(plan: Plan) {
  if (plan.scheduledDate) {
    const date = buildScheduledDateTime(plan.scheduledDate, plan.scheduledTime || '00:00');
    if (date) {
      return date.getDay() === 0 || date.getDay() === 6;
    }
  }

  const timeLabel = plan.timeLabel.trim();
  return (
    timeLabel.startsWith('周末') ||
    timeLabel.startsWith('周六') ||
    timeLabel.startsWith('周日') ||
    timeLabel.startsWith('星期六') ||
    timeLabel.startsWith('星期日')
  );
}
