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

export type ListPagination = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type CommuteMethod = '开车' | '地铁' | '步行' | '骑行' | '远程';

export type WorkdayMode = 'legal' | 'custom' | 'daily';

export type UserSettings = {
  city: string;
  workStart: string;
  workEnd: string;
  commuteMethod: CommuteMethod;
  dailyBriefTime: string;
  workdayMode: WorkdayMode;
  workdays: string[];
  holidaySync: boolean;
  weekendReminders: boolean;
  planReminderLeadMinutes: number;
  quietStart: string;
  quietEnd: string;
  weatherAlerts: boolean;
  planReminders: boolean;
  aiPersonalization: boolean;
  habits: string[];
  pantryReminderEnabled: boolean;
  pantryReminderRules: PantryReminderRule[];
  pantryReminderTime: string;
};

export type PantryCategory = '食品' | '日用品' | '药品' | '宠物' | '其他';

export type PantryLocation = '冷藏' | '冷冻' | '厨房' | '储物柜' | '卫生间' | '玄关' | '其他';

export type PantryReminderRule = '7d' | '3d' | 'same-day' | 'expired';

export type PantryItemStatus = 'normal' | 'expiring' | 'expired' | 'used-up' | 'discarded';

export type PantryReminderConfig = {
  enabled: boolean;
  useDefault: boolean;
  rules: PantryReminderRule[];
  reminderTime: string;
};

export type PantryItem = {
  id: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  location: PantryLocation;
  expiresAt?: string;
  openedAt?: string;
  note: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  status: PantryItemStatus;
  reminder: PantryReminderConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type NewPantryItemInput = Omit<PantryItem, 'id' | 'createdAt' | 'updatedAt'>;

export type PantryPreferences = {
  defaultReminderEnabled: boolean;
  defaultReminderRules: PantryReminderRule[];
  defaultReminderTime: string;
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

export type Checkin = {
  id: string;
  userId: string;
  date: string;
  name: string;
  completed: boolean;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

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
