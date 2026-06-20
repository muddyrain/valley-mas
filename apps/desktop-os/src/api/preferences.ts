import { apiRequest } from './client';

export interface UserPreference {
  id: string;
  userId: string;
  namespace: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export function getUserPreference(namespace: string, token: string) {
  return apiRequest<UserPreference>(`/user/preferences/${encodeURIComponent(namespace)}`, {
    token,
  });
}

export function updateUserPreference(namespace: string, value: string, token: string) {
  return apiRequest<UserPreference>(`/user/preferences/${encodeURIComponent(namespace)}`, {
    method: 'PUT',
    token,
    body: { value },
  });
}
