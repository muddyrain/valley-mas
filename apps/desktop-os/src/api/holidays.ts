import { apiRequest } from './client';

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

export function getChinaHolidayCalendar(year: number) {
  return apiRequest<ChinaHolidayCalendar>(`/public/holiday-calendars/china/${year}`);
}
