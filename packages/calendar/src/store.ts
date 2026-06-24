import { create } from 'zustand';
import { getChinaHolidayCalendar } from './holidays';
import type { CalendarEvent, CalendarEventInput, ChinaHolidayCalendar } from './types';
import { normalizeEventInput } from './utils';

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

function clearYearRecord<T>(record: Record<number, T>, year: number): Record<number, T> {
  const next = { ...record };
  delete next[year];
  return next;
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
      shouldLoad =
        !state.holidayCalendars[year] &&
        !state.holidayLoadingYears[year] &&
        !state.holidayErrorYears[year];
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
