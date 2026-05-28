import { apiRequest } from '@/api/request';
import type { Checkin } from '@/types';

export function listCheckins(token: string, date: string) {
  const query = new URLSearchParams({ date });
  return apiRequest<{ date: string; list: Checkin[] }>(`/life-trace/checkins?${query}`, token);
}

export function toggleCheckin(
  token: string,
  input: { date: string; name: string; completed: boolean },
) {
  return apiRequest<Checkin>('/life-trace/checkins', token, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
