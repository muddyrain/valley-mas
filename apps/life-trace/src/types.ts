import type { LucideIcon } from 'lucide-react';

export type AppTab = 'today' | 'plans' | 'ai' | 'traces' | 'profile';

export type PlanType = '电影' | '吃饭' | '运动' | '阅读' | '聚会' | '普通事项';

export type PlanRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type Plan = {
  id: string;
  placeId?: string;
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
  recurrenceFrequency?: PlanRecurrenceFrequency;
  recurrenceInterval?: number;
  recurrenceEndAt?: string;
  recurrenceParentId?: string;
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
  activePantryHouseholdId?: string;
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
  pantryReminderEnabled: boolean;
  pantryReminderRules: PantryReminderRule[];
  pantryReminderTime: string;
  subscriptionReminderEnabled: boolean;
  subscriptionReminderRules: SubscriptionReminderRule[];
  subscriptionReminderTime: string;
  pantryListStatusFilter: PantryListStatusFilter;
  pantryListCategoryFilter: PantryListCategoryFilter;
  pantryListSortMode: PantrySortMode;
};

export type PantryListStatusFilter =
  | 'all'
  | 'normal'
  | 'expiring'
  | 'expired'
  | 'no-expiry'
  | 'used-up'
  | 'discarded';

export type PantryListCategoryFilter = 'all' | PantryCategory;

export type PantryCategory = '食品' | '日用品' | '药品' | '宠物' | '其他';

export type PantryLocation = '冷藏' | '冷冻' | '厨房' | '储物柜' | '卫生间' | '玄关' | '其他';

export type PantryReminderRule = '7d' | '3d' | 'same-day' | 'expired';

export type PantryItemStatus = 'normal' | 'expiring' | 'expired' | 'used-up' | 'discarded';

export type PantrySortMode = 'expiry-asc' | 'created-desc' | 'expiry-desc';

export type PantryReminderConfig = {
  enabled: boolean;
  useDefault: boolean;
  rules: PantryReminderRule[];
  reminderTime: string;
};

export type PantryOverview = {
  total: number;
  expiring: number;
  expired: number;
  active: number;
};

export type PantryItem = {
  id: string;
  householdId?: string;
  name: string;
  category: PantryCategory;
  tags: string[];
  quantity: number;
  unit: string;
  location: PantryLocation;
  expiresAt?: string;
  openedAt?: string;
  note: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  barcodeValue?: string;
  barcodeFormat?: string;
  status: PantryItemStatus;
  reminder: PantryReminderConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type NewPantryItemInput = Omit<PantryItem, 'id' | 'tags' | 'createdAt' | 'updatedAt'> & {
  tags?: string[];
};

export type PantryPreferences = {
  defaultReminderEnabled: boolean;
  defaultReminderRules: PantryReminderRule[];
  defaultReminderTime: string;
};

export type ShoppingListSource =
  | 'manual'
  | 'pantry_used_up'
  | 'pantry_low'
  | 'pantry_discard'
  | 'recipe';

export type ShoppingListItem = {
  id: string;
  householdId?: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  source: ShoppingListSource;
  sourcePantryItemId?: string;
  note?: string;
  checkedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewShoppingListItemInput = {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  source?: ShoppingListSource;
  sourcePantryItemId?: string;
  note?: string;
};

export type ClosetCategory = '上装' | '下装' | '外套' | '鞋履' | '配饰' | '包袋' | '套装' | '其他';

export type ClosetWarmthLevel = '轻薄' | '常规' | '保暖' | '厚重';

export type ClosetSeason = '春' | '夏' | '秋' | '冬' | '四季';

export type ClosetItemStatus = 'active' | 'laundry' | 'archived';
export type ClosetCareMethod = '机洗' | '手洗' | '干洗' | '通风';
export type ClosetPreferenceLevel = 'neutral' | 'favorite' | 'avoid';

export type ClosetItem = {
  id: string;
  householdId?: string;
  name: string;
  category: ClosetCategory;
  color: string;
  material?: string;
  warmthLevel: ClosetWarmthLevel;
  seasons: ClosetSeason[];
  sceneTags: string[];
  status: ClosetItemStatus;
  imageUrl?: string;
  shared: boolean;
  note: string;
  careMethod?: ClosetCareMethod;
  careIntervalWears?: number;
  lastCareDate?: string;
  preferenceLevel?: ClosetPreferenceLevel;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewClosetItemInput = Omit<
  ClosetItem,
  'id' | 'householdId' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>;

export type OutfitStatus = 'planned' | 'worn' | 'saved';

export type Outfit = {
  id: string;
  householdId?: string;
  title: string;
  itemIds: string[];
  scene: string;
  weatherText?: string;
  minTemp: number;
  maxTemp: number;
  planId?: string;
  wornDate?: string;
  rating: number;
  note: string;
  imageUrl?: string;
  shared: boolean;
  status: OutfitStatus;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewOutfitInput = Omit<
  Outfit,
  'id' | 'householdId' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
>;

export type HouseholdKind = 'personal' | 'shared';

export type HouseholdStatus = 'active' | 'dissolved';

export type HouseholdRole = 'owner' | 'admin' | 'member';

export type HouseholdMemberStatus = 'active' | 'left' | 'removed';

export type HouseholdSummary = {
  id: string;
  name: string;
  kind: HouseholdKind;
  status: HouseholdStatus;
  ownerUserId: string;
  role: HouseholdRole;
  memberCount: number;
};

export type HouseholdMember = {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  joinedAt?: string;
  leftAt?: string;
};

export type HouseholdInvitePayload = {
  householdId: string;
  inviteCode: string;
  expiresAt?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
};

export type Trace = {
  id: string;
  planId?: string;
  placeId?: string;
  pantryItemId?: string;
  mediaDiaryId?: string;
  outfitId?: string;
  title: string;
  summary: string;
  timeLabel: string;
  location?: string;
  imageUrl?: string;
  mood: string;
  tags: string[];
  source: '计划' | '库存' | '书影音' | '穿搭' | '手动';
  createdAt?: string;
  updatedAt?: string;
};

export type NewTraceInput = Omit<Trace, 'id' | 'createdAt' | 'updatedAt'>;

export type Place = {
  id: string;
  name: string;
  normalizedName: string;
  status: PlaceStatus;
  city?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  favorite: boolean;
  archived: boolean;
  note: string;
  visitCount: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PlaceStatus = 'visited' | 'want';

export type PlaceRecordType = 'plan' | 'trace';

export type PlaceRecord = {
  id: string;
  recordType: PlaceRecordType;
  title: string;
  timeLabel?: string;
  location?: string;
  imageUrl?: string;
  source?: string;
  completed?: boolean;
  mood?: string;
  tags?: string[];
  createdAt?: string;
};

export type InboxItemType = 'text' | 'link' | 'image';

export type InboxItemStatus = 'inbox' | 'converted' | 'archived';

export type InboxConvertedType = 'plan' | 'trace' | 'ledger' | 'media' | 'place';

export type InboxAISuggestedType = 'plan' | 'trace';

export type InboxItem = {
  id: string;
  title: string;
  content?: string;
  itemType: InboxItemType;
  linkUrl?: string;
  imageUrl?: string;
  tags: string[];
  status: InboxItemStatus;
  convertedType?: InboxConvertedType;
  convertedId?: string;
  convertedAt?: string;
  aiTitle?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiSuggestedType?: InboxAISuggestedType;
  aiReason?: string;
  aiModel?: string;
  aiOrganizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewInboxItemInput = {
  title: string;
  content?: string;
  itemType: InboxItemType;
  linkUrl?: string;
  imageUrl?: string;
  tags: string[];
};

export type LedgerDirection = '支出' | '收入' | '退款' | '转账备注';

export type LedgerCategory =
  | '吃饭'
  | '交通'
  | '购物'
  | '书影音'
  | '订阅'
  | '家用'
  | '礼物'
  | '医疗'
  | '其他';

export type LedgerEntry = {
  id: string;
  amount: number;
  amountCents: number;
  currency: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  occurredAt: string;
  merchant?: string;
  location?: string;
  note: string;
  imageUrl?: string;
  inboxItemId?: string;
  planId?: string;
  traceId?: string;
  pantryItemId?: string;
  recurringPaymentId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewLedgerEntryInput = {
  amount: number;
  currency?: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  occurredAt: string;
  merchant?: string;
  location?: string;
  note?: string;
  imageUrl?: string;
  inboxItemId?: string;
  planId?: string;
  traceId?: string;
  pantryItemId?: string;
  recurringPaymentId?: string;
};

export type LedgerCategorySummary = {
  category: LedgerCategory;
  amountCents: number;
  amount: number;
  count: number;
};

export type LedgerSummary = {
  month: string;
  expenseCents: number;
  incomeCents: number;
  refundCents: number;
  netCents: number;
  expense: number;
  income: number;
  refund: number;
  net: number;
  categories: LedgerCategorySummary[];
};

export type SubscriptionReminderRule = '7d' | '3d' | 'same-day' | 'overdue';

export type RecurringPaymentFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'half_year'
  | 'yearly';

export type RecurringPaymentDirection = '支出' | '收入';

export type RecurringPaymentReminderConfig = {
  enabled: boolean;
  useDefault: boolean;
  rules: SubscriptionReminderRule[];
  reminderTime: string;
};

export type RecurringPayment = {
  id: string;
  userId: string;
  name: string;
  category: LedgerCategory;
  amount: number;
  amountCents: number;
  currency: string;
  direction: RecurringPaymentDirection;
  merchant?: string;
  note: string;
  imageUrl?: string;
  frequency: RecurringPaymentFrequency;
  interval: number;
  startedAt: string;
  nextDueAt: string;
  endAt?: string;
  archived: boolean;
  canceledAt?: string;
  reminder: RecurringPaymentReminderConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type NewRecurringPaymentInput = {
  name: string;
  category: LedgerCategory;
  amount: number;
  currency?: string;
  direction: RecurringPaymentDirection;
  merchant?: string;
  note?: string;
  imageUrl?: string;
  frequency: RecurringPaymentFrequency;
  interval: number;
  startedAt: string;
  endAt?: string;
  reminder: RecurringPaymentReminderConfig;
};

export type RecurringPaymentSummary = {
  total: number;
  activeCount: number;
  overdueCount: number;
  upcomingCount: number;
  monthlyExpenseCents: number;
  monthlyExpense: number;
  upcomingDays: number;
};

export type MediaDiaryType = '书籍' | '电影' | '剧集' | '动漫' | '音乐';

export type MediaDiaryStatus = '想看' | '进行中' | '已完成' | '搁置';

export type MediaDiaryEntry = {
  id: string;
  userId: string;
  traceId?: string;
  mediaType: MediaDiaryType;
  status: MediaDiaryStatus;
  title: string;
  originalTitle?: string;
  creator?: string;
  releaseYear?: number;
  coverUrl?: string;
  rating: number;
  startedAt?: string;
  finishedAt?: string;
  note: string;
  quote: string;
  tags: string[];
  source: 'manual' | 'ai_suggest';
  createdAt?: string;
  updatedAt?: string;
};

export type NewMediaDiaryEntryInput = Omit<
  MediaDiaryEntry,
  'id' | 'userId' | 'traceId' | 'createdAt' | 'updatedAt'
>;

export type MediaDiaryAISuggestion = {
  originalTitle?: string;
  creator?: string;
  releaseYear?: number;
  tags: string[];
  note: string;
};

export type MediaDiarySummary = {
  total: number;
  completedMonth: number;
  bestRating: number;
  recent?: MediaDiaryEntry;
};

export type AiAction = {
  id: string;
  title: string;
  timeLabel: string;
  actionType?: string;
  createdAt?: string;
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

export type AchievementCategory = 'plan' | 'trace' | 'pantry' | 'ai' | 'family';

export type AchievementRarity = 'common' | 'rare' | 'epic';

export type AchievementTone = 'default' | 'weather' | 'ai' | 'plan' | 'trace' | 'health' | 'alert';

export type Achievement = {
  code: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  icon: string;
  tone: AchievementTone;
  hidden: boolean;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  target: number;
  evidenceType?: string;
  evidenceId?: string;
  aiComment?: string;
};

export type AchievementSummary = {
  total: number;
  unlocked: number;
  monthlyNew: number;
  rareUnlocked: number;
};
