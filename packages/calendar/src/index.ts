// Types

export type { HolidayCalendarApiOptions } from './holidays';
// Holiday API
export { createHolidayCalendarApi, getChinaHolidayCalendar } from './holidays';
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
