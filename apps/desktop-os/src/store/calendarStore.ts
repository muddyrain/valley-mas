import { create } from 'zustand';
import {
  type ChinaAdjustedWorkday,
  type ChinaHolidayCalendar,
  type ChinaHolidayRange,
  getChinaHolidayCalendar,
} from '../api/holidays';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  category: CalendarEventCategory;
  reminderMinutes: CalendarReminderMinutes;
  notes: string;
}

export interface CalendarEventInput {
  title: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  category: CalendarEventCategory;
  reminderMinutes: CalendarReminderMinutes;
  notes: string;
}

export type CalendarEventCategory = 'personal' | 'work' | 'life' | 'focus';
export type CalendarReminderMinutes = null | 0 | 5 | 10 | 30;

interface CalendarStore {
  events: CalendarEvent[];
  holidayCalendars: Record<number, ChinaHolidayCalendar>;
  holidayLoadingYears: Record<number, boolean>;
  holidayErrorYears: Record<number, string>;
  addEvent: (input: CalendarEventInput) => void;
  updateEvent: (id: string, input: CalendarEventInput) => void;
  deleteEvent: (id: string) => void;
  loadHolidayCalendar: (year: number) => Promise<void>;
}

let eventSeq = 0;

function nextEventId() {
  eventSeq += 1;
  return `calendar-event-${eventSeq}`;
}

export const useCalendarStore = create<CalendarStore>((set) => ({
  events: [],
  holidayCalendars: {},
  holidayLoadingYears: {},
  holidayErrorYears: {},
  addEvent: (input) =>
    set((state) => ({
      events: [...state.events, { ...normalizeEventInput(input), id: nextEventId() }],
    })),
  updateEvent: (id, input) =>
    set((state) => ({
      events: state.events.map((event) =>
        event.id === id ? { ...event, ...normalizeEventInput(input) } : event,
      ),
    })),
  deleteEvent: (id) =>
    set((state) => ({
      events: state.events.filter((event) => event.id !== id),
    })),
  loadHolidayCalendar: async (year) => {
    let shouldLoad = false;
    set((state) => {
      shouldLoad = !state.holidayCalendars[year] && !state.holidayLoadingYears[year];
      if (!shouldLoad) return state;
      return {
        holidayLoadingYears: { ...state.holidayLoadingYears, [year]: true },
        holidayErrorYears: clearYearRecord(state.holidayErrorYears, year),
      };
    });
    if (!shouldLoad) return;

    try {
      const calendar = await getChinaHolidayCalendar(year);
      set((state) => ({
        holidayCalendars: { ...state.holidayCalendars, [year]: calendar },
        holidayLoadingYears: clearYearRecord(state.holidayLoadingYears, year),
      }));
    } catch (error) {
      set((state) => ({
        holidayLoadingYears: clearYearRecord(state.holidayLoadingYears, year),
        holidayErrorYears: {
          ...state.holidayErrorYears,
          [year]: error instanceof Error ? error.message : '节假日数据不可用',
        },
      }));
    }
  },
}));

function normalizeEventInput(input: CalendarEventInput): CalendarEventInput {
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

function clearYearRecord<T>(record: Record<number, T>, year: number) {
  const next = { ...record };
  delete next[year];
  return next;
}

export interface CalendarHolidayInfo {
  date: string;
  name: string;
  kind: 'holiday' | 'weekend' | 'workday';
  sourceName: string;
}

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

function isWeekendDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return false;
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}
