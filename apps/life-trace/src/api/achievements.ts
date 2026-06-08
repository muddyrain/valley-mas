import { apiRequest } from '@/api/request';
import type { Achievement, AchievementSummary } from '@/types';

export type AchievementListResponse = {
  summary: AchievementSummary;
  list: Achievement[];
  recent: Achievement[];
};

export function listAchievements(token: string) {
  return apiRequest<AchievementListResponse>('/life-trace/achievements', token);
}
