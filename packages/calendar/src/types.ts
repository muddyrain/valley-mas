// Calendar event types
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

// Holiday calendar types (China)
export interface ChinaHolidayRange {
  name: string;
  startDate: string;
  endDate: string;
  dates: string[];
}

export interface ChinaAdjustedWorkday {
  date: string;
  name: string;
}

export interface ChinaHolidayCalendar {
  country: string;
  year: number;
  sourceName: string;
  sourceUrl: string;
  publishedDate: string;
  holidays: ChinaHolidayRange[];
  adjustedWorkdays: ChinaAdjustedWorkday[];
}

// Holiday info for a specific date
export interface CalendarHolidayInfo {
  date: string;
  name: string;
  kind: 'holiday' | 'weekend' | 'workday';
  sourceName: string;
}

export interface CalendarDayCell {
  date: Date;
  dateKey: string;
  weekday: number;
  weekdayLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  isSelected: boolean;
  isCurrentMonth: boolean;
}

export type CalendarWeekStartsOn = 0 | 1;

export interface CalendarWeekOptions {
  selectedDate?: Date | string;
  today?: Date | string;
  weekStartsOn?: CalendarWeekStartsOn;
}

export interface LunarDateInfo {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
  monthName: string;
  dayName: string;
  text: string;
}
