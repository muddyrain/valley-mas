import type { ChinaHolidayCalendar } from './types';

export interface HolidayCalendarApiOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * Creates a holiday calendar API client.
 * Uses native fetch by default.
 */
export function createHolidayCalendarApi(options: HolidayCalendarApiOptions) {
  const { baseUrl, fetch: fetcher = globalThis.fetch } = options;

  async function getChinaHolidayCalendar(year: number): Promise<ChinaHolidayCalendar> {
    const response = await fetcher(`${baseUrl}/public/holiday-calendars/china/${year}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`节假日数据加载失败: ${response.status}`);
    }

    const payload = (await response.json()) as {
      code: number;
      message?: string;
      data: ChinaHolidayCalendar;
    };

    if (payload.code !== 0) {
      throw new Error(payload.message || '节假日数据不可用');
    }

    return payload.data;
  }

  return {
    getChinaHolidayCalendar,
  };
}

// Default API instance using localhost as base
const defaultApi = createHolidayCalendarApi({
  baseUrl: 'http://localhost:8080/api/v1',
});

export const getChinaHolidayCalendar = defaultApi.getChinaHolidayCalendar;
