import type {
  CalendarDayCell,
  CalendarEvent,
  CalendarEventInput,
  CalendarHolidayInfo,
  CalendarWeekOptions,
  CalendarWeekStartsOn,
  ChinaAdjustedWorkday,
  ChinaHolidayCalendar,
  ChinaHolidayRange,
} from './types';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * Get holiday info for a specific date from loaded calendars.
 */
export function getHolidayInfoForDate(
  calendars: Record<number, ChinaHolidayCalendar>,
  date: string,
): CalendarHolidayInfo | null {
  const year = Number(date.slice(0, 4));
  const calendar = calendars[year];

  const adjustedWorkday = calendar?.adjustedWorkdays.find((item) => item.date === date);
  if (adjustedWorkday) {
    return holidayInfoFromAdjustedWorkday(adjustedWorkday, calendar.sourceName);
  }

  const holiday = calendar?.holidays.find((item) => item.dates.includes(date));
  if (holiday) {
    return holidayInfoFromRange(holiday, date, calendar.sourceName);
  }

  if (isWeekendDate(date)) {
    return {
      date,
      name: '周末休息',
      kind: 'weekend',
      sourceName: calendar?.sourceName ?? '本地日历',
    };
  }

  return null;
}

function holidayInfoFromAdjustedWorkday(
  item: ChinaAdjustedWorkday,
  sourceName: string,
): CalendarHolidayInfo {
  return {
    date: item.date,
    name: item.name,
    kind: 'workday',
    sourceName,
  };
}

function holidayInfoFromRange(
  item: ChinaHolidayRange,
  date: string,
  sourceName: string,
): CalendarHolidayInfo {
  return {
    date,
    name: item.name,
    kind: 'holiday',
    sourceName,
  };
}

/**
 * Check if a date string represents a weekend (Saturday or Sunday).
 */
export function isWeekendDate(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return false;
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

/**
 * Normalize event input before storing.
 */
export function normalizeEventInput(input: CalendarEventInput): CalendarEventInput {
  const date = input.date;
  const endDate = input.endDate && input.endDate >= date ? input.endDate : date;
  const allDay = Boolean(input.allDay);
  const startTime = allDay ? '00:00' : input.startTime || '09:00';
  const endTime = allDay ? '23:59' : input.endTime || startTime;

  return {
    title: input.title.trim(),
    date,
    endDate,
    startTime,
    endTime: !allDay && endTime < startTime ? startTime : endTime,
    allDay,
    category: input.category,
    reminderMinutes: input.reminderMinutes,
    notes: input.notes.trim(),
  };
}

/**
 * Filter events that occur on a specific date.
 */
export function eventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const key = formatDateKey(date);
  return events
    .filter((event) => event.date <= key && event.endDate >= key)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startTime.localeCompare(b.startTime);
    });
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

export function toCalendarDate(value: Date | string | undefined, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return startOfDay(value);
  }

  if (typeof value === 'string') {
    const parsed = parseDateKey(value);
    if (parsed) return parsed;
  }

  return startOfDay(fallback);
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getCalendarWeekStart(
  date: Date | string,
  weekStartsOn: CalendarWeekStartsOn = 1,
): Date {
  const current = toCalendarDate(date);
  const day = current.getDay();
  const offset = weekStartsOn === 1 ? (day + 6) % 7 : day;
  return addCalendarDays(current, -offset);
}

export function getCalendarWeekDays(
  cursorDate: Date | string,
  options: CalendarWeekOptions = {},
): CalendarDayCell[] {
  const weekStartsOn = options.weekStartsOn ?? 1;
  const cursor = toCalendarDate(cursorDate);
  const selected = toCalendarDate(options.selectedDate, cursor);
  const today = toCalendarDate(options.today);
  const start = getCalendarWeekStart(cursor, weekStartsOn);
  const currentMonth = cursor.getMonth();

  return Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(start, index);
    return {
      date,
      dateKey: formatDateKey(date),
      weekday: date.getDay(),
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      dayOfMonth: date.getDate(),
      isToday: isSameCalendarDay(date, today),
      isSelected: isSameCalendarDay(date, selected),
      isCurrentMonth: date.getMonth() === currentMonth,
    };
  });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}
