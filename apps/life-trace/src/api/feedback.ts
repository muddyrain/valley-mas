import { apiRequest } from '@/api/request';

export type CreateFeedbackInput = {
  app?: string;
  content: string;
  imageUrls: string[];
};

export type LifeTraceFeedback = {
  id: string;
  userId: string;
  app: string;
  content: string;
  imageUrls: string[];
  status: 'open' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function createLifeTraceFeedback(token: string, input: CreateFeedbackInput) {
  return apiRequest<LifeTraceFeedback>('/life-trace/feedbacks', token, {
    method: 'POST',
    body: JSON.stringify({
      app: input.app ?? 'life-trace',
      content: input.content,
      imageUrls: input.imageUrls,
    }),
  });
}
