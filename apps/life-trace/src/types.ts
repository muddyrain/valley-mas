import type { LucideIcon } from 'lucide-react';

export type AppTab = 'today' | 'plans' | 'ai' | 'traces' | 'profile';

export type PlanType = '电影' | '吃饭' | '运动' | '阅读' | '聚会' | '普通事项';

export type Plan = {
  id: string;
  title: string;
  type: PlanType;
  timeLabel: string;
  scheduledDate?: string;
  scheduledTime?: string;
  timezone?: string;
  reminder: boolean;
  imageUrl?: string;
  location?: string;
  note: string;
  source?: PlanSource;
  completed: boolean;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewPlanInput = Omit<
  Plan,
  'id' | 'completed' | 'completedAt' | 'createdAt' | 'updatedAt'
>;

export type PlanSource = 'manual' | 'weather_advice' | 'ai_advice' | 'image_ai';

export type CommuteMethod = '开车' | '地铁' | '步行' | '骑行' | '远程';

export type UserSettings = {
  city: string;
  workStart: string;
  workEnd: string;
  commuteMethod: CommuteMethod;
  dailyBriefTime: string;
  weatherAlerts: boolean;
  planReminders: boolean;
  aiPersonalization: boolean;
  habits: string[];
};

export type Trace = {
  id: string;
  planId?: string;
  title: string;
  summary: string;
  timeLabel: string;
  location?: string;
  imageUrl?: string;
  mood: string;
  tags: string[];
  source: '计划' | '打卡' | '手动';
  createdAt?: string;
  updatedAt?: string;
};

export type NewTraceInput = Omit<Trace, 'id' | 'createdAt' | 'updatedAt'>;

export type AiAction = {
  id: string;
  title: string;
  timeLabel: string;
};

export type AdviceTone = 'weather' | 'ai' | 'plan' | 'trace' | 'health' | 'alert';

export type AdvicePayload = {
  id: string;
  title: string;
  detail: string;
  tone: AdviceTone;
};

export type Advice = AdvicePayload & {
  icon: LucideIcon;
};
