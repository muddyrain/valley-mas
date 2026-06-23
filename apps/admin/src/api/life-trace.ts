import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';

export type LifeTraceRecordType =
  | 'plans'
  | 'traces'
  | 'pantry'
  | 'weekly-reviews'
  | 'ai-conversations'
  | 'push-subscriptions'
  | 'push-plan-deliveries'
  | 'push-daily-deliveries'
  | 'push-pantry-deliveries';

export interface LifeTraceOverview {
  settings: number;
  plans: number;
  openPlans: number;
  traces: number;
  pantryItems: number;
  expiredPantryItems: number;
  weeklyReviews: number;
  feedbacks: number;
  openFeedbacks: number;
  aiConversations: number;
  aiMessages: number;
  pushSubscriptions: number;
  pushPlanDeliveries: number;
  pushDailyDeliveries: number;
  pushPantryDeliveries: number;
  pushErrors: number;
  households: number;
}

export interface LifeTraceOverviewResponse {
  overview: LifeTraceOverview;
}

export interface LifeTraceUserRow {
  userId: string;
  nickname?: string;
  username?: string;
  avatar?: string;
  role: string;
  isActive: boolean;
  city?: string;
  commuteMethod?: string;
  dailyBriefTime?: string;
  notificationReady: boolean;
  plans: number;
  openPlans: number;
  traces: number;
  pantryItems: number;
  weeklyReviews: number;
  aiConversations: number;
  feedbacks: number;
  pushSubscriptions: number;
  latestActivityAt?: string;
  createdAt: string;
}

export interface LifeTraceRecordRow {
  id: string;
  type: LifeTraceRecordType;
  userId: string;
  userName: string;
  title: string;
  status: string;
  source?: string;
  timeLabel?: string;
  createdAt: string;
  updatedAt?: string;
  detail: Record<string, unknown>;
}

export interface LifeTraceUserListParams extends PaginationParams {
  keyword?: string;
}

export interface LifeTraceRecordListParams extends PaginationParams {
  type: LifeTraceRecordType;
  userId?: string;
  keyword?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type LifeTraceUserListResponse = PaginationResponse<LifeTraceUserRow>;
export type LifeTraceRecordListResponse = PaginationResponse<LifeTraceRecordRow>;

export const reqGetLifeTraceOverview = () => {
  return http.get<unknown, LifeTraceOverviewResponse>('/admin/life-trace/overview');
};

export const reqGetLifeTraceUsers = (params: LifeTraceUserListParams) => {
  return http.get<unknown, LifeTraceUserListResponse>('/admin/life-trace/users', { params });
};

export const reqGetLifeTraceRecords = (params: LifeTraceRecordListParams) => {
  return http.get<unknown, LifeTraceRecordListResponse>('/admin/life-trace/records', { params });
};
