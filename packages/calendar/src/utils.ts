import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarHolidayInfo,
  ChinaAdjustedWorkday,
  ChinaHolidayCalendar,
  ChinaHolidayRange,
} from './types';

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

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
