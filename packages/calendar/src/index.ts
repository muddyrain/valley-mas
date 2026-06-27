// Types

export type { HolidayCalendarApiOptions } from './holidays';
// Holiday API
export { createHolidayCalendarApi, getChinaHolidayCalendar } from './holidays';
export type { LunarDateInfo } from './lunar';
export { formatChineseLunarDate, getChineseLunarDate } from './lunar';
// Store
export { useCalendarStore } from './store';
export type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarEventInput,
  CalendarHolidayInfo,
  CalendarReminderMinutes,
  ChinaAdjustedWorkday,
  ChinaHolidayCalendar,
  ChinaHolidayRange,
} from './types';

// Utils
export {
  eventsForDate,
  getHolidayInfoForDate,
  isWeekendDate,
  normalizeEventInput,
} from './utils';
