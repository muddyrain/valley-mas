import { apiRequest } from '@/api/request';
import type { UserSettings } from '@/types';

export function getSettings(token: string) {
  return apiRequest<UserSettings>('/life-trace/settings', token);
}

export function saveSettings(token: string, settings: UserSettings) {
  return apiRequest<UserSettings>('/life-trace/settings', token, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
