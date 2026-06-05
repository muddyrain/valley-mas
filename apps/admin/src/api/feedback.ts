import type { PaginationParams, PaginationResponse } from '../types/api';
import http from '../utils/request';
import type { User } from './user';

export type FeedbackStatus = 'open' | 'resolved';

export interface Feedback {
  id: string;
  userId: string;
  app: string;
  content: string;
  imageUrls: string[];
  status: FeedbackStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface FeedbackListParams extends PaginationParams {
  status?: FeedbackStatus | 'all';
  app?: string;
  keyword?: string;
}

export type FeedbackListResponse = PaginationResponse<Feedback>;

export const reqGetFeedbackList = (params: FeedbackListParams) => {
  return http.get<unknown, FeedbackListResponse>('/admin/feedbacks', { params });
};

export const reqUpdateFeedbackStatus = (id: string, status: FeedbackStatus) => {
  return http.patch<unknown, Feedback>(`/admin/feedbacks/${id}/status`, { status });
};
