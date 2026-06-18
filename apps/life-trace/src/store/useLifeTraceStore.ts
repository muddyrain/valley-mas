import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { listAchievements } from '@/api/achievements';
import { listAiActions } from '@/api/aiActions';
import { listCheckins, toggleCheckin } from '@/api/checkins';
import {
  type ListInboxOptions,
  listInboxItems,
  convertInboxItem as requestConvertInboxItem,
  createInboxItem as requestCreateInboxItem,
  deleteInboxItem as requestDeleteInboxItem,
  organizeInboxItem as requestOrganizeInboxItem,
  updateInboxItem as requestUpdateInboxItem,
  updateInboxItemStatus as requestUpdateInboxItemStatus,
} from '@/api/inbox';
import {
  type ListLedgerOptions,
  listLedgerEntries,
  createLedgerEntry as requestCreateLedgerEntry,
  deleteLedgerEntry as requestDeleteLedgerEntry,
  updateLedgerEntry as requestUpdateLedgerEntry,
} from '@/api/ledger';
import {
  type ListPantryOptions,
  listPantry,
  type PantryConsumeRequest,
  consumePantryItem as requestConsumePantryItem,
  createPantryItem as requestCreatePantryItem,
  deletePantryItem as requestDeletePantryItem,
  updatePantryItem as requestUpdatePantryItem,
  updatePantryItemStatus as requestUpdatePantryItemStatus,
} from '@/api/pantry';
import {
  type CreatePlaceInput,
  getPlace,
  type ListPlacesOptions,
  listPlaceRecords,
  listPlaces,
  type PlaceExport,
  createPlace as requestCreatePlace,
  exportPlaces as requestExportPlaces,
  updatePlace as requestUpdatePlace,
  type UpdatePlaceInput,
} from '@/api/places';
import {
  createPlan,
  deletePlan,
  type ListPlansOptions,
  listPlans,
  updatePlan,
  updatePlanStatus,
} from '@/api/plans';
import { getSettings, saveSettings } from '@/api/settings';
import { createTrace, deleteTrace, listTraces, updateTrace } from '@/api/traces';
import { findNewlyUnlockedAchievements, normalizeAchievement } from '@/lib/achievements';
import { normalizeAiActionRecord } from '@/lib/aiHistory';
import { getLifeTraceErrorMessage } from '@/lib/error';
import { getDefaultLedgerMonth } from '@/lib/ledger';
import { resolvePantryStatus } from '@/lib/pantry';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type {
  Achievement,
  AchievementSummary,
  AiAction,
  AppTab,
  Checkin,
  InboxConvertedType,
  InboxItem,
  InboxItemStatus,
  LedgerEntry,
  LedgerSummary,
  ListPagination,
  NewInboxItemInput,
  NewLedgerEntryInput,
  NewPantryItemInput,
  NewPlanInput,
  NewTraceInput,
  PantryItem,
  PantryItemStatus,
  PantryOverview,
  PantryPreferences,
  Place,
  PlaceRecord,
  Plan,
  Trace,
  UserSettings,
} from '@/types';

type LifeTraceState = {
  activeTab: AppTab;
  preferredPantryHouseholdId: string;
  preferredPantryHouseholdName: string;
  plans: Plan[];
  plansLoaded: boolean;
  plansLoading: boolean;
  plansLoadingMore: boolean;
  plansError: string;
  plansPagination: ListPagination;
  plansListOptions: ListPlansOptions;
  planCreating: boolean;
  planUpdatingById: Record<string, boolean>;
  planCompletingById: Record<string, boolean>;
  planDeletingById: Record<string, boolean>;
  traces: Trace[];
  tracesLoaded: boolean;
  tracesLoading: boolean;
  tracesLoadingMore: boolean;
  tracesError: string;
  tracesPagination: ListPagination;
  traceCreating: boolean;
  traceUpdatingById: Record<string, boolean>;
  traceDeletingById: Record<string, boolean>;
  places: Place[];
  placesLoaded: boolean;
  placesLoading: boolean;
  placesLoadingMore: boolean;
  placesError: string;
  placesPagination: ListPagination;
  placesListOptions: ListPlacesOptions;
  placeDetail: Place | null;
  placeRecords: PlaceRecord[];
  placeDetailLoading: boolean;
  placeRecordsLoading: boolean;
  placeCreating: boolean;
  placeUpdatingById: Record<string, boolean>;
  inboxItems: InboxItem[];
  inboxLoaded: boolean;
  inboxLoading: boolean;
  inboxLoadingMore: boolean;
  inboxError: string;
  inboxPagination: ListPagination;
  inboxListOptions: ListInboxOptions;
  inboxCreating: boolean;
  inboxUpdatingById: Record<string, boolean>;
  inboxDeletingById: Record<string, boolean>;
  ledgerEntries: LedgerEntry[];
  ledgerLoaded: boolean;
  ledgerLoading: boolean;
  ledgerLoadingMore: boolean;
  ledgerError: string;
  ledgerPagination: ListPagination;
  ledgerListOptions: ListLedgerOptions;
  ledgerSummary: LedgerSummary;
  ledgerCreating: boolean;
  ledgerUpdatingById: Record<string, boolean>;
  ledgerDeletingById: Record<string, boolean>;
  checkins: Checkin[];
  checkinsDate: string;
  checkinsLoaded: boolean;
  checkinsLoading: boolean;
  checkinsError: string;
  checkinTogglingByName: Record<string, boolean>;
  settings: UserSettings;
  settingsLoaded: boolean;
  settingsLoading: boolean;
  settingsSaving: boolean;
  settingsError: string;
  pantryItems: PantryItem[];
  pantryLoaded: boolean;
  pantryLoading: boolean;
  pantryError: string;
  pantryListItems: PantryItem[];
  pantryListLoaded: boolean;
  pantryListLoading: boolean;
  pantryListLoadingMore: boolean;
  pantryListError: string;
  pantryListPagination: ListPagination;
  pantryListOptions: ListPantryOptions;
  pantryListResolvedHouseholdId: string;
  pantryListResolvedHouseholdName: string;
  pantryListSummary: PantryOverview;
  pantryPreferences: PantryPreferences;
  achievements: Achievement[];
  achievementSummary: AchievementSummary;
  recentAchievements: Achievement[];
  achievementsLoaded: boolean;
  achievementsLoading: boolean;
  achievementsError: string;
  aiActions: AiAction[];
  setActiveTab: (tab: AppTab) => void;
  setPreferredPantryHouseholdId: (householdId?: string, householdName?: string) => void;
  setActivePantryHousehold: (
    householdId?: string,
    householdName?: string,
    options?: { silent?: boolean },
  ) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updatePantryPreferences: (preferences: Partial<PantryPreferences>) => void;
  loadSettings: () => Promise<void>;
  loadPantry: () => Promise<void>;
  loadPantryList: (options?: ListPantryOptions) => Promise<void>;
  loadMorePantryList: () => Promise<void>;
  loadPlans: (options?: ListPlansOptions) => Promise<void>;
  loadMorePlans: () => Promise<void>;
  loadTraces: () => Promise<void>;
  loadMoreTraces: () => Promise<void>;
  loadPlaces: (options?: ListPlacesOptions) => Promise<void>;
  loadMorePlaces: () => Promise<void>;
  loadPlaceDetail: (placeId: string) => Promise<void>;
  addPlace: (input: CreatePlaceInput) => Promise<Place | null>;
  editPlace: (placeId: string, input: UpdatePlaceInput) => Promise<Place | null>;
  exportPlaces: () => Promise<PlaceExport | null>;
  loadInboxItems: (options?: ListInboxOptions) => Promise<void>;
  loadMoreInboxItems: () => Promise<void>;
  loadLedgerEntries: (options?: ListLedgerOptions) => Promise<void>;
  loadMoreLedgerEntries: () => Promise<void>;
  loadCheckins: (date: string) => Promise<void>;
  loadAchievements: (options?: { notifyNew?: boolean }) => Promise<void>;
  loadAiActions: () => Promise<void>;
  toggleHabitCheckin: (date: string, name: string, completed: boolean) => Promise<void>;
  addPlan: (input: NewPlanInput) => Promise<Plan | null>;
  addPantryItem: (input: NewPantryItemInput, householdId?: string) => Promise<PantryItem | null>;
  editPantryItem: (
    itemId: string,
    input: NewPantryItemInput,
    householdId?: string,
  ) => Promise<PantryItem | null>;
  updatePantryItemStatus: (
    itemId: string,
    status: PantryItemStatus,
    householdId?: string,
  ) => Promise<PantryItem | null>;
  consumePantryItem: (
    itemId: string,
    input: PantryConsumeRequest,
    householdId?: string,
  ) => Promise<PantryItem | null>;
  removePantryItem: (itemId: string, householdId?: string) => Promise<boolean>;
  receiveServerPlan: (plan: Plan, actionTitle?: string) => void;
  receiveServerPantryItem: (item: PantryItem, actionTitle?: string) => void;
  receiveServerLedgerEntry: (entry: LedgerEntry, actionTitle?: string) => void;
  editPlan: (planId: string, input: NewPlanInput) => Promise<Plan | null>;
  addTrace: (input: NewTraceInput) => Promise<Trace | null>;
  editTrace: (traceId: string, input: NewTraceInput) => Promise<Trace | null>;
  addInboxItem: (input: NewInboxItemInput) => Promise<InboxItem | null>;
  editInboxItem: (itemId: string, input: NewInboxItemInput) => Promise<InboxItem | null>;
  updateInboxStatus: (itemId: string, status: InboxItemStatus) => Promise<InboxItem | null>;
  convertInbox: (
    itemId: string,
    convertedType: InboxConvertedType,
    convertedId: string,
  ) => Promise<InboxItem | null>;
  organizeInbox: (itemId: string) => Promise<InboxItem | null>;
  removeInboxItem: (itemId: string) => Promise<boolean>;
  addLedgerEntry: (input: NewLedgerEntryInput) => Promise<LedgerEntry | null>;
  editLedgerEntry: (entryId: string, input: NewLedgerEntryInput) => Promise<LedgerEntry | null>;
  removeLedgerEntry: (entryId: string) => Promise<boolean>;
  completePlan: (planId: string) => Promise<void>;
  removePlan: (planId: string) => Promise<void>;
  removeTrace: (traceId: string) => Promise<void>;
  addAiAction: (title: string) => void;
  generateTraceFromLatestPlan: () => Promise<Trace | null>;
};

const defaultSettings: UserSettings = {
  activePantryHouseholdId: '',
  city: '上海',
  workStart: '09:30',
  workEnd: '18:30',
  commuteMethod: '开车',
  dailyBriefTime: '08:10',
  workdayMode: 'legal',
  workdays: ['1', '2', '3', '4', '5'],
  holidaySync: true,
  weekendReminders: false,
  planReminderLeadMinutes: 10,
  quietStart: '22:30',
  quietEnd: '07:30',
  weatherAlerts: true,
  planReminders: true,
  aiPersonalization: true,
  habits: ['喝水', '休息', '运动', '护肤'],
  pantryReminderEnabled: true,
  pantryReminderRules: ['7d', '3d', 'same-day', 'expired'],
  pantryReminderTime: '09:00',
};

const defaultPagination: ListPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  hasMore: false,
};

const defaultPantryPreferences: PantryPreferences = {
  defaultReminderEnabled: true,
  defaultReminderRules: ['7d', '3d', 'same-day', 'expired'],
  defaultReminderTime: '09:00',
};

const defaultPantryOverview: PantryOverview = {
  total: 0,
  expiring: 0,
  expired: 0,
  active: 0,
};

const defaultAchievementSummary: AchievementSummary = {
  total: 0,
  unlocked: 0,
  monthlyNew: 0,
  rareUnlocked: 0,
};
const ACHIEVEMENT_TOAST_DURATION_MS = 4200;

const defaultPantryListOptions: ListPantryOptions = {
  page: 1,
  pageSize: 20,
  status: 'all',
  category: 'all',
  sort: 'expiry-asc',
};

const defaultInboxListOptions: ListInboxOptions = {
  page: 1,
  pageSize: 20,
  status: 'inbox',
  type: 'all',
};

const defaultLedgerListOptions: ListLedgerOptions = {
  page: 1,
  pageSize: 20,
  month: getDefaultLedgerMonth(),
  category: 'all',
  direction: 'all',
};

const defaultPlacesListOptions: ListPlacesOptions = {
  page: 1,
  pageSize: 20,
  archived: false,
};

const defaultLedgerSummary: LedgerSummary = {
  month: defaultLedgerListOptions.month ?? getDefaultLedgerMonth(),
  expenseCents: 0,
  incomeCents: 0,
  refundCents: 0,
  netCents: 0,
  expense: 0,
  income: 0,
  refund: 0,
  net: 0,
  categories: [],
};

function formatTraceRecordedTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const now = new Date();
  const sameDay =
    validDate.getFullYear() === now.getFullYear() &&
    validDate.getMonth() === now.getMonth() &&
    validDate.getDate() === now.getDate();
  const dateText = sameDay
    ? '今天'
    : validDate.toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      });
  const time = validDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateText} ${time}`;
}

const createTraceFromPlan = (plan: Plan): NewTraceInput => ({
  planId: plan.id,
  placeId: plan.placeId,
  title: plan.title.replace(/^周[五六日]晚上?/, '').replace(/^明早\s*/, ''),
  summary: `${plan.title}，已经被记录为一条新的生活踪迹。`,
  timeLabel: formatTraceRecordedTime(plan.completedAt),
  location: plan.location,
  imageUrl: plan.imageUrl,
  mood: plan.type === '运动' ? '活力' : plan.type === '吃饭' ? '满足' : '放松',
  tags: [plan.type, '计划完成', '生活迹'],
  source: '计划',
});

const createActionId = () =>
  `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getAiActions = (state: Pick<LifeTraceState, 'aiActions'>) => state.aiActions ?? [];

const getToken = () => useAuthStore.getState().token;

function notifyNewAchievements(previous: Achievement[], next: Achievement[]) {
  const newlyUnlocked = findNewlyUnlockedAchievements(previous, next);
  if (newlyUnlocked.length === 0) {
    return;
  }

  const first = newlyUnlocked[0];
  const suffix = newlyUnlocked.length > 1 ? `等 ${newlyUnlocked.length} 枚` : '';
  useFeedbackToastStore
    .getState()
    .showToast(`收集到「${first.title}」${suffix}`, 'success', ACHIEVEMENT_TOAST_DURATION_MS, {
      achievement: first,
      achievementExtraCount: Math.max(0, newlyUnlocked.length - 1),
    });
}

let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
const pantryStatusUpdateInFlightKeys = new Set<string>();
let pantryListRequestId = 0;

function normalizeSettings(settings: Partial<UserSettings>): UserSettings {
  const habits = Array.isArray(settings.habits)
    ? settings.habits
        .map((habit) => habit.trim())
        .filter((habit, index, list) => habit.length > 0 && list.indexOf(habit) === index)
    : defaultSettings.habits;

  return {
    ...defaultSettings,
    ...settings,
    activePantryHouseholdId: normalizeHouseholdScopeId(settings.activePantryHouseholdId),
    habits,
    workdays: settings.workdays?.length ? settings.workdays : defaultSettings.workdays,
    pantryReminderRules: settings.pantryReminderRules?.length
      ? settings.pantryReminderRules
      : defaultSettings.pantryReminderRules,
    planReminderLeadMinutes:
      typeof settings.planReminderLeadMinutes === 'number'
        ? settings.planReminderLeadMinutes
        : defaultSettings.planReminderLeadMinutes,
  };
}

function normalizePantryPreferences(preferences?: Partial<PantryPreferences>): PantryPreferences {
  return {
    ...defaultPantryPreferences,
    ...preferences,
    defaultReminderRules: preferences?.defaultReminderRules?.length
      ? preferences.defaultReminderRules
      : defaultPantryPreferences.defaultReminderRules,
  };
}

function normalizePantryItem(item: PantryItem): PantryItem {
  return {
    ...item,
    quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
    unit: item.unit || '件',
    note: item.note || '',
    reminder: {
      enabled: item.reminder?.enabled ?? true,
      useDefault: item.reminder?.useDefault ?? true,
      rules:
        item.reminder?.rules?.length > 0
          ? item.reminder.rules
          : defaultPantryPreferences.defaultReminderRules,
      reminderTime: item.reminder?.reminderTime || defaultPantryPreferences.defaultReminderTime,
    },
    status: resolvePantryStatus(item),
  };
}

function pantryPreferencesFromSettings(settings: UserSettings): PantryPreferences {
  return normalizePantryPreferences({
    defaultReminderEnabled: settings.pantryReminderEnabled,
    defaultReminderRules: settings.pantryReminderRules,
    defaultReminderTime: settings.pantryReminderTime,
  });
}

function settingsFromPantryPreferences(
  preferences: PantryPreferences,
): Pick<UserSettings, 'pantryReminderEnabled' | 'pantryReminderRules' | 'pantryReminderTime'> {
  return {
    pantryReminderEnabled: preferences.defaultReminderEnabled,
    pantryReminderRules: preferences.defaultReminderRules,
    pantryReminderTime: preferences.defaultReminderTime,
  };
}

function normalizePantryListOptions(
  options: ListPantryOptions = {},
  current: ListPantryOptions = defaultPantryListOptions,
): ListPantryOptions {
  const householdId = options.householdId?.trim();
  const q = options.q?.trim();
  return {
    ...current,
    ...options,
    page: options.page ?? current.page ?? 1,
    pageSize: options.pageSize ?? current.pageSize ?? defaultPantryListOptions.pageSize ?? 20,
    householdId: householdId || undefined,
    status: options.status ?? current.status ?? 'all',
    category: options.category ?? current.category ?? 'all',
    sort: options.sort ?? current.sort ?? 'expiry-asc',
    q: q || undefined,
  };
}

function normalizeHouseholdScopeId(householdId?: string) {
  const trimmed = householdId?.trim() ?? '';
  if (!trimmed || trimmed.startsWith('-')) {
    return '';
  }
  return trimmed;
}

export const useLifeTraceStore = create<LifeTraceState>()(
  persist(
    (set, get) => ({
      activeTab: 'today',
      preferredPantryHouseholdId: '',
      preferredPantryHouseholdName: '',
      plans: [],
      plansLoaded: false,
      plansLoading: false,
      plansLoadingMore: false,
      plansError: '',
      plansPagination: defaultPagination,
      plansListOptions: { page: 1, pageSize: 20 },
      planCreating: false,
      planUpdatingById: {},
      planCompletingById: {},
      planDeletingById: {},
      traces: [],
      tracesLoaded: false,
      tracesLoading: false,
      tracesLoadingMore: false,
      tracesError: '',
      tracesPagination: defaultPagination,
      traceCreating: false,
      traceUpdatingById: {},
      traceDeletingById: {},
      places: [],
      placesLoaded: false,
      placesLoading: false,
      placesLoadingMore: false,
      placesError: '',
      placesPagination: {
        ...defaultPagination,
        pageSize: defaultPlacesListOptions.pageSize ?? 20,
      },
      placesListOptions: defaultPlacesListOptions,
      placeDetail: null,
      placeRecords: [],
      placeDetailLoading: false,
      placeRecordsLoading: false,
      placeCreating: false,
      placeUpdatingById: {},
      inboxItems: [],
      inboxLoaded: false,
      inboxLoading: false,
      inboxLoadingMore: false,
      inboxError: '',
      inboxPagination: {
        ...defaultPagination,
        pageSize: defaultInboxListOptions.pageSize ?? 20,
      },
      inboxListOptions: defaultInboxListOptions,
      inboxCreating: false,
      inboxUpdatingById: {},
      inboxDeletingById: {},
      ledgerEntries: [],
      ledgerLoaded: false,
      ledgerLoading: false,
      ledgerLoadingMore: false,
      ledgerError: '',
      ledgerPagination: {
        ...defaultPagination,
        pageSize: defaultLedgerListOptions.pageSize ?? 20,
      },
      ledgerListOptions: defaultLedgerListOptions,
      ledgerSummary: defaultLedgerSummary,
      ledgerCreating: false,
      ledgerUpdatingById: {},
      ledgerDeletingById: {},
      checkins: [],
      checkinsDate: '',
      checkinsLoaded: false,
      checkinsLoading: false,
      checkinsError: '',
      checkinTogglingByName: {},
      settings: defaultSettings,
      settingsLoaded: false,
      settingsLoading: false,
      settingsSaving: false,
      settingsError: '',
      pantryItems: [],
      pantryLoaded: false,
      pantryLoading: false,
      pantryError: '',
      pantryListItems: [],
      pantryListLoaded: false,
      pantryListLoading: false,
      pantryListLoadingMore: false,
      pantryListError: '',
      pantryListPagination: {
        ...defaultPagination,
        pageSize: defaultPantryListOptions.pageSize ?? 20,
      },
      pantryListOptions: defaultPantryListOptions,
      pantryListResolvedHouseholdId: '',
      pantryListResolvedHouseholdName: '',
      pantryListSummary: defaultPantryOverview,
      pantryPreferences: defaultPantryPreferences,
      achievements: [],
      achievementSummary: defaultAchievementSummary,
      recentAchievements: [],
      achievementsLoaded: false,
      achievementsLoading: false,
      achievementsError: '',
      aiActions: [],
      setActiveTab: (tab) => set({ activeTab: tab }),
      setPreferredPantryHouseholdId: (householdId, householdName) =>
        set((state) => {
          const nextHouseholdId = normalizeHouseholdScopeId(householdId);
          const trimmedHouseholdName = householdName?.trim() ?? '';
          const keepCurrentName = state.preferredPantryHouseholdId === nextHouseholdId;

          return {
            preferredPantryHouseholdId: nextHouseholdId,
            preferredPantryHouseholdName: nextHouseholdId
              ? trimmedHouseholdName || (keepCurrentName ? state.preferredPantryHouseholdName : '')
              : '',
          };
        }),
      setActivePantryHousehold: async (householdId, householdName, options = {}) => {
        const nextHouseholdId = normalizeHouseholdScopeId(householdId);
        const trimmedHouseholdName = householdName?.trim() ?? '';
        const nextSettings = normalizeSettings({
          ...get().settings,
          activePantryHouseholdId: nextHouseholdId,
        });
        const token = getToken();

        set((state) => ({
          settings: nextSettings,
          preferredPantryHouseholdId: nextHouseholdId,
          preferredPantryHouseholdName: nextHouseholdId
            ? trimmedHouseholdName ||
              (state.preferredPantryHouseholdId === nextHouseholdId
                ? state.preferredPantryHouseholdName
                : '')
            : '',
          pantryPreferences: pantryPreferencesFromSettings(nextSettings),
          settingsSaving: Boolean(token),
          settingsError: '',
        }));

        if (!token) {
          return;
        }

        if (settingsSaveTimer) {
          clearTimeout(settingsSaveTimer);
          settingsSaveTimer = null;
        }

        try {
          const saved = await saveSettings(token, nextSettings, {
            suppressErrorToast: options.silent,
          });
          const persistedSettings = normalizeSettings(saved);
          const persistedHouseholdId = normalizeHouseholdScopeId(
            persistedSettings.activePantryHouseholdId,
          );
          set((state) => ({
            settings: persistedSettings,
            preferredPantryHouseholdId: persistedHouseholdId,
            preferredPantryHouseholdName: persistedHouseholdId
              ? trimmedHouseholdName ||
                (state.preferredPantryHouseholdId === persistedHouseholdId
                  ? state.preferredPantryHouseholdName
                  : '')
              : '',
            pantryPreferences: pantryPreferencesFromSettings(persistedSettings),
            settingsSaving: false,
            settingsError: '',
          }));
        } catch (error) {
          set({
            settingsSaving: false,
            settingsError: options.silent
              ? ''
              : error instanceof Error
                ? error.message
                : '保存偏好失败',
          });
        }
      },
      updatePantryPreferences: (preferences) => {
        const nextPreferences = normalizePantryPreferences({
          ...get().pantryPreferences,
          ...preferences,
        });
        set({ pantryPreferences: nextPreferences });
        get().updateSettings(settingsFromPantryPreferences(nextPreferences));
      },
      updateSettings: (settings) => {
        const nextSettings = normalizeSettings({ ...get().settings, ...settings });
        const token = getToken();
        const nextPreferredHouseholdId = normalizeHouseholdScopeId(
          nextSettings.activePantryHouseholdId,
        );

        set((state) => ({
          settings: nextSettings,
          preferredPantryHouseholdId: nextPreferredHouseholdId,
          preferredPantryHouseholdName:
            state.preferredPantryHouseholdId === nextPreferredHouseholdId
              ? state.preferredPantryHouseholdName
              : '',
          pantryPreferences: pantryPreferencesFromSettings(nextSettings),
          settingsSaving: Boolean(token),
          settingsError: '',
        }));

        if (!token) {
          return;
        }

        if (settingsSaveTimer) {
          clearTimeout(settingsSaveTimer);
        }

        settingsSaveTimer = setTimeout(() => {
          settingsSaveTimer = null;
          void (async () => {
            const latestToken = getToken();
            if (!latestToken) {
              set({ settingsSaving: false });
              return;
            }

            try {
              const saved = await saveSettings(latestToken, get().settings);
              const nextSettings = normalizeSettings(saved);
              const nextPreferredHouseholdId = normalizeHouseholdScopeId(
                nextSettings.activePantryHouseholdId,
              );
              set((state) => ({
                settings: nextSettings,
                preferredPantryHouseholdId: nextPreferredHouseholdId,
                preferredPantryHouseholdName:
                  state.preferredPantryHouseholdId === nextPreferredHouseholdId
                    ? state.preferredPantryHouseholdName
                    : '',
                pantryPreferences: pantryPreferencesFromSettings(nextSettings),
                settingsSaving: false,
                settingsError: '',
              }));
            } catch (error) {
              set({
                settingsSaving: false,
                settingsError: error instanceof Error ? error.message : '保存偏好失败',
              });
            }
          })();
        }, 500);
      },
      loadSettings: async () => {
        const token = getToken();
        if (!token) {
          set({
            settingsLoaded: true,
            settingsLoading: false,
            settingsSaving: false,
            settingsError: '',
          });
          return;
        }

        set({ settingsLoading: true, settingsError: '' });
        try {
          const settings = normalizeSettings(await getSettings(token));
          const nextPreferredHouseholdId = normalizeHouseholdScopeId(
            settings.activePantryHouseholdId,
          );
          set((state) => ({
            settings,
            preferredPantryHouseholdId: nextPreferredHouseholdId,
            preferredPantryHouseholdName:
              state.preferredPantryHouseholdId === nextPreferredHouseholdId
                ? state.preferredPantryHouseholdName
                : '',
            pantryPreferences: pantryPreferencesFromSettings(settings),
            settingsLoaded: true,
            settingsLoading: false,
            settingsError: '',
          }));
        } catch (error) {
          set({
            settingsLoaded: true,
            settingsLoading: false,
            settingsError: error instanceof Error ? error.message : '获取偏好失败',
          });
        }
      },
      loadPantry: async () => {
        const token = getToken();
        if (!token) {
          set({
            pantryLoaded: true,
            pantryLoading: false,
            pantryError: '',
          });
          return;
        }

        if (get().pantryLoading) {
          return;
        }

        set({ pantryLoading: true, pantryError: '' });
        try {
          const { list } = await listPantry(token, { page: 1, pageSize: 200 });
          set({
            pantryItems: list.map(normalizePantryItem),
            pantryLoaded: true,
            pantryLoading: false,
            pantryError: '',
          });
        } catch (error) {
          set({
            pantryLoaded: true,
            pantryLoading: false,
            pantryError: getLifeTraceErrorMessage(error, '获取库存失败'),
          });
        }
      },
      loadPantryList: async (options = {}) => {
        const token = getToken();
        const nextOptions = normalizePantryListOptions(
          {
            ...get().pantryListOptions,
            ...options,
            page: 1,
            pageSize:
              options.pageSize ??
              get().pantryListOptions.pageSize ??
              defaultPantryListOptions.pageSize,
          },
          get().pantryListOptions,
        );

        if (!token) {
          set({
            pantryListItems: [],
            pantryListLoaded: true,
            pantryListLoading: false,
            pantryListLoadingMore: false,
            pantryListError: '',
            pantryListPagination: {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? defaultPantryListOptions.pageSize ?? 20,
            },
            pantryListOptions: nextOptions,
            pantryListResolvedHouseholdId: '',
            pantryListResolvedHouseholdName: '',
            pantryListSummary: defaultPantryOverview,
          });
          return;
        }

        const requestId = ++pantryListRequestId;
        set({
          pantryListLoading: true,
          pantryListLoadingMore: false,
          pantryListError: '',
          pantryListOptions: nextOptions,
        });
        try {
          const { householdId, householdName, list, pagination, summary } = await listPantry(
            token,
            nextOptions,
          );
          if (requestId !== pantryListRequestId) {
            return;
          }
          const resolvedHouseholdId = normalizeHouseholdScopeId(householdId);
          const resolvedHouseholdName = householdName?.trim() ?? '';
          set({
            pantryListItems: list.map(normalizePantryItem),
            pantryListPagination: pagination ?? {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? defaultPantryListOptions.pageSize ?? 20,
              total: list.length,
              hasMore: false,
            },
            pantryListLoaded: true,
            pantryListLoading: false,
            pantryListLoadingMore: false,
            pantryListError: '',
            pantryListResolvedHouseholdId: resolvedHouseholdId,
            pantryListResolvedHouseholdName: resolvedHouseholdName,
            pantryListSummary: summary ?? defaultPantryOverview,
          });
        } catch (error) {
          if (requestId !== pantryListRequestId) {
            return;
          }
          set({
            pantryListLoaded: true,
            pantryListLoading: false,
            pantryListLoadingMore: false,
            pantryListError: getLifeTraceErrorMessage(error, '获取库存失败'),
          });
        }
      },
      loadMorePantryList: async () => {
        const token = getToken();
        const {
          pantryListItems,
          pantryListLoading,
          pantryListLoadingMore,
          pantryListOptions,
          pantryListPagination,
        } = get();
        if (!token || pantryListLoading || pantryListLoadingMore || !pantryListPagination.hasMore) {
          return;
        }

        const nextPage = pantryListPagination.page + 1;
        const nextOptions = normalizePantryListOptions(
          {
            ...pantryListOptions,
            page: nextPage,
            pageSize: pantryListPagination.pageSize,
          },
          pantryListOptions,
        );

        const requestId = ++pantryListRequestId;
        set({ pantryListLoadingMore: true, pantryListError: '' });
        try {
          const { householdId, householdName, list, pagination, summary } = await listPantry(
            token,
            nextOptions,
          );
          if (requestId !== pantryListRequestId) {
            return;
          }
          const resolvedHouseholdId = normalizeHouseholdScopeId(householdId);
          const resolvedHouseholdName = householdName?.trim() ?? '';
          const existingIds = new Set(pantryListItems.map((item) => item.id));
          const nextItems = list
            .map(normalizePantryItem)
            .filter((item) => !existingIds.has(item.id));
          set((state) => ({
            pantryListItems: [...state.pantryListItems, ...nextItems],
            pantryListPagination: pagination ?? {
              page: nextPage,
              pageSize: pantryListPagination.pageSize,
              total: state.pantryListItems.length + nextItems.length,
              hasMore: false,
            },
            pantryListLoadingMore: false,
            pantryListError: '',
            pantryListResolvedHouseholdId:
              resolvedHouseholdId || state.pantryListResolvedHouseholdId,
            pantryListResolvedHouseholdName:
              resolvedHouseholdName || state.pantryListResolvedHouseholdName,
            pantryListSummary: summary ?? state.pantryListSummary,
          }));
        } catch (error) {
          if (requestId !== pantryListRequestId) {
            return;
          }
          set({
            pantryListLoadingMore: false,
            pantryListError: getLifeTraceErrorMessage(error, '加载更多库存失败'),
          });
        }
      },
      loadPlans: async (options = {}) => {
        const token = getToken();
        const nextOptions = {
          ...get().plansListOptions,
          ...options,
          page: 1,
          pageSize: options.pageSize ?? get().plansListOptions.pageSize ?? 20,
        };
        if (!token) {
          set({
            plans: [],
            plansLoaded: true,
            plansLoading: false,
            plansLoadingMore: false,
            plansError: '',
            plansPagination: defaultPagination,
            plansListOptions: nextOptions,
          });
          return;
        }

        set({ plansLoading: true, plansError: '', plansListOptions: nextOptions });
        try {
          const { list, pagination } = await listPlans(token, nextOptions);
          set({
            plans: list,
            plansPagination: pagination ?? {
              ...defaultPagination,
              total: list.length,
              hasMore: false,
            },
            plansLoaded: true,
            plansLoading: false,
            plansError: '',
          });
        } catch (error) {
          set({
            plansLoading: false,
            plansLoaded: true,
            plansError: error instanceof Error ? error.message : '获取计划失败',
          });
        }
      },
      loadMorePlans: async () => {
        const token = getToken();
        const { plansListOptions, plansPagination, plansLoading, plansLoadingMore } = get();
        if (!token || plansLoading || plansLoadingMore || !plansPagination.hasMore) {
          return;
        }

        set({ plansLoadingMore: true, plansError: '' });
        try {
          const nextPage = plansPagination.page + 1;
          const { list, pagination } = await listPlans(token, {
            ...plansListOptions,
            page: nextPage,
            pageSize: plansPagination.pageSize,
          });
          set((state) => {
            const existingIds = new Set(state.plans.map((plan) => plan.id));
            const nextPlans = list.filter((plan) => !existingIds.has(plan.id));
            return {
              plans: [...state.plans, ...nextPlans],
              plansPagination: pagination ?? {
                page: nextPage,
                pageSize: plansPagination.pageSize,
                total: state.plans.length + nextPlans.length,
                hasMore: false,
              },
              plansLoadingMore: false,
              plansError: '',
            };
          });
        } catch (error) {
          set({
            plansLoadingMore: false,
            plansError: error instanceof Error ? error.message : '加载更多计划失败',
          });
        }
      },
      loadTraces: async () => {
        const token = getToken();
        if (!token) {
          set({
            traces: [],
            tracesLoaded: true,
            tracesLoading: false,
            tracesLoadingMore: false,
            tracesError: '',
            tracesPagination: defaultPagination,
          });
          return;
        }

        set({ tracesLoading: true, tracesError: '' });
        try {
          const { list, pagination } = await listTraces(token, { page: 1, pageSize: 20 });
          set({
            traces: list,
            tracesPagination: pagination ?? {
              ...defaultPagination,
              total: list.length,
              hasMore: false,
            },
            tracesLoaded: true,
            tracesLoading: false,
            tracesError: '',
          });
        } catch (error) {
          set({
            tracesLoading: false,
            tracesLoaded: true,
            tracesError: error instanceof Error ? error.message : '获取踪迹失败',
          });
        }
      },
      loadMoreTraces: async () => {
        const token = getToken();
        const { tracesPagination, tracesLoading, tracesLoadingMore } = get();
        if (!token || tracesLoading || tracesLoadingMore || !tracesPagination.hasMore) {
          return;
        }

        set({ tracesLoadingMore: true, tracesError: '' });
        try {
          const nextPage = tracesPagination.page + 1;
          const { list, pagination } = await listTraces(token, {
            page: nextPage,
            pageSize: tracesPagination.pageSize,
          });
          set((state) => {
            const existingIds = new Set(state.traces.map((trace) => trace.id));
            const nextTraces = list.filter((trace) => !existingIds.has(trace.id));
            return {
              traces: [...state.traces, ...nextTraces],
              tracesPagination: pagination ?? {
                page: nextPage,
                pageSize: tracesPagination.pageSize,
                total: state.traces.length + nextTraces.length,
                hasMore: false,
              },
              tracesLoadingMore: false,
              tracesError: '',
            };
          });
        } catch (error) {
          set({
            tracesLoadingMore: false,
            tracesError: error instanceof Error ? error.message : '加载更多踪迹失败',
          });
        }
      },
      loadPlaces: async (options = {}) => {
        const token = getToken();
        const nextOptions = {
          ...get().placesListOptions,
          ...options,
          page: 1,
          pageSize: options.pageSize ?? get().placesListOptions.pageSize ?? 20,
        };
        if (!token) {
          set({
            places: [],
            placesLoaded: true,
            placesLoading: false,
            placesLoadingMore: false,
            placesError: '',
            placesPagination: {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
            },
            placesListOptions: nextOptions,
          });
          return;
        }

        set({ placesLoading: true, placesError: '', placesListOptions: nextOptions });
        try {
          const { list, pagination } = await listPlaces(token, nextOptions);
          set({
            places: list,
            placesPagination: pagination ?? {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
              total: list.length,
              hasMore: false,
            },
            placesLoaded: true,
            placesLoading: false,
            placesError: '',
          });
        } catch (error) {
          set({
            placesLoaded: true,
            placesLoading: false,
            placesError: getLifeTraceErrorMessage(error, '获取地点失败'),
          });
        }
      },
      loadMorePlaces: async () => {
        const token = getToken();
        const { placesListOptions, placesPagination, placesLoading, placesLoadingMore } = get();
        if (!token || placesLoading || placesLoadingMore || !placesPagination.hasMore) {
          return;
        }

        set({ placesLoadingMore: true, placesError: '' });
        try {
          const nextPage = placesPagination.page + 1;
          const { list, pagination } = await listPlaces(token, {
            ...placesListOptions,
            page: nextPage,
            pageSize: placesPagination.pageSize,
          });
          set((state) => {
            const existingIds = new Set(state.places.map((place) => place.id));
            const nextPlaces = list.filter((place) => !existingIds.has(place.id));
            return {
              places: [...state.places, ...nextPlaces],
              placesPagination: pagination ?? {
                page: nextPage,
                pageSize: placesPagination.pageSize,
                total: state.places.length + nextPlaces.length,
                hasMore: false,
              },
              placesLoadingMore: false,
              placesError: '',
            };
          });
        } catch (error) {
          set({
            placesLoadingMore: false,
            placesError: getLifeTraceErrorMessage(error, '加载更多地点失败'),
          });
        }
      },
      loadPlaceDetail: async (placeId) => {
        const token = getToken();
        if (!token) {
          set({
            placeDetail: null,
            placeRecords: [],
            placeDetailLoading: false,
            placeRecordsLoading: false,
            placesError: '',
          });
          return;
        }

        set({ placeDetailLoading: true, placeRecordsLoading: true, placesError: '' });
        try {
          const [place, records] = await Promise.all([
            getPlace(token, placeId),
            listPlaceRecords(token, placeId, { page: 1, pageSize: 50 }),
          ]);
          set({
            placeDetail: place,
            placeRecords: records.list,
            placeDetailLoading: false,
            placeRecordsLoading: false,
            placesError: '',
          });
        } catch (error) {
          set({
            placeDetailLoading: false,
            placeRecordsLoading: false,
            placesError: getLifeTraceErrorMessage(error, '读取地点失败'),
          });
        }
      },
      addPlace: async (input) => {
        const token = getToken();
        if (!token) {
          set({ placesError: '请先登录后再创建地点' });
          return null;
        }
        if (get().placeCreating) {
          return null;
        }

        set({ placeCreating: true, placesError: '' });
        try {
          const created = await requestCreatePlace(token, input);
          set((state) => ({
            places: [created, ...state.places.filter((place) => place.id !== created.id)],
            placeDetail: created,
            placeCreating: false,
            placesError: '',
          }));
          void get().loadPlaces(get().placesListOptions);
          return created;
        } catch (error) {
          set({
            placeCreating: false,
            placesError: getLifeTraceErrorMessage(error, '创建地点失败'),
          });
          return null;
        }
      },
      editPlace: async (placeId, input) => {
        const token = getToken();
        if (!token) {
          set({ placesError: '请先登录后再编辑地点' });
          return null;
        }
        if (get().placeUpdatingById[placeId]) {
          return null;
        }

        set((state) => ({
          placeUpdatingById: { ...state.placeUpdatingById, [placeId]: true },
          placesError: '',
        }));
        try {
          const updated = await requestUpdatePlace(token, placeId, input);
          set((state) => ({
            places: state.places.map((place) => (place.id === placeId ? updated : place)),
            placeDetail: state.placeDetail?.id === placeId ? updated : state.placeDetail,
            placesError: '',
          }));
          return updated;
        } catch (error) {
          set({ placesError: getLifeTraceErrorMessage(error, '更新地点失败') });
          return null;
        } finally {
          set((state) => ({
            placeUpdatingById: { ...state.placeUpdatingById, [placeId]: false },
          }));
        }
      },
      exportPlaces: async () => {
        const token = getToken();
        if (!token) {
          set({ placesError: '请先登录后再导出地点' });
          return null;
        }

        try {
          const exported = await requestExportPlaces(token);
          set({ placesError: '' });
          return exported;
        } catch (error) {
          set({ placesError: getLifeTraceErrorMessage(error, '导出地点失败') });
          return null;
        }
      },
      loadInboxItems: async (options = {}) => {
        const token = getToken();
        const nextOptions = {
          ...get().inboxListOptions,
          ...options,
          page: 1,
          pageSize: options.pageSize ?? get().inboxListOptions.pageSize ?? 20,
        };
        if (!token) {
          set({
            inboxItems: [],
            inboxLoaded: true,
            inboxLoading: false,
            inboxLoadingMore: false,
            inboxError: '',
            inboxPagination: {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
            },
            inboxListOptions: nextOptions,
          });
          return;
        }

        set({ inboxLoading: true, inboxError: '', inboxListOptions: nextOptions });
        try {
          const { list, pagination } = await listInboxItems(token, nextOptions);
          set({
            inboxItems: list,
            inboxPagination: pagination ?? {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
              total: list.length,
              hasMore: false,
            },
            inboxLoaded: true,
            inboxLoading: false,
            inboxError: '',
          });
        } catch (error) {
          set({
            inboxLoading: false,
            inboxLoaded: true,
            inboxError: getLifeTraceErrorMessage(error, '获取 Inbox 失败'),
          });
        }
      },
      loadMoreInboxItems: async () => {
        const token = getToken();
        const { inboxListOptions, inboxPagination, inboxLoading, inboxLoadingMore } = get();
        if (!token || inboxLoading || inboxLoadingMore || !inboxPagination.hasMore) {
          return;
        }

        set({ inboxLoadingMore: true, inboxError: '' });
        try {
          const nextPage = inboxPagination.page + 1;
          const { list, pagination } = await listInboxItems(token, {
            ...inboxListOptions,
            page: nextPage,
            pageSize: inboxPagination.pageSize,
          });
          set((state) => {
            const existingIds = new Set(state.inboxItems.map((item) => item.id));
            const nextItems = list.filter((item) => !existingIds.has(item.id));
            return {
              inboxItems: [...state.inboxItems, ...nextItems],
              inboxPagination: pagination ?? {
                page: nextPage,
                pageSize: inboxPagination.pageSize,
                total: state.inboxItems.length + nextItems.length,
                hasMore: false,
              },
              inboxLoadingMore: false,
              inboxError: '',
            };
          });
        } catch (error) {
          set({
            inboxLoadingMore: false,
            inboxError: getLifeTraceErrorMessage(error, '加载更多 Inbox 失败'),
          });
        }
      },
      loadLedgerEntries: async (options = {}) => {
        const token = getToken();
        const nextOptions = {
          ...get().ledgerListOptions,
          ...options,
          page: 1,
          pageSize: options.pageSize ?? get().ledgerListOptions.pageSize ?? 20,
          month: options.month ?? get().ledgerListOptions.month ?? getDefaultLedgerMonth(),
        };
        if (!token) {
          set({
            ledgerEntries: [],
            ledgerLoaded: true,
            ledgerLoading: false,
            ledgerLoadingMore: false,
            ledgerError: '',
            ledgerPagination: {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
            },
            ledgerListOptions: nextOptions,
            ledgerSummary: {
              ...defaultLedgerSummary,
              month: nextOptions.month ?? getDefaultLedgerMonth(),
            },
          });
          return;
        }

        set({ ledgerLoading: true, ledgerError: '', ledgerListOptions: nextOptions });
        try {
          const { list, summary, pagination } = await listLedgerEntries(token, nextOptions);
          set({
            ledgerEntries: list,
            ledgerSummary: summary,
            ledgerPagination: pagination ?? {
              ...defaultPagination,
              pageSize: nextOptions.pageSize ?? 20,
              total: list.length,
              hasMore: false,
            },
            ledgerLoaded: true,
            ledgerLoading: false,
            ledgerError: '',
          });
        } catch (error) {
          set({
            ledgerLoading: false,
            ledgerLoaded: true,
            ledgerError: getLifeTraceErrorMessage(error, '获取账目失败'),
          });
        }
      },
      loadMoreLedgerEntries: async () => {
        const token = getToken();
        const { ledgerListOptions, ledgerPagination, ledgerLoading, ledgerLoadingMore } = get();
        if (!token || ledgerLoading || ledgerLoadingMore || !ledgerPagination.hasMore) {
          return;
        }

        set({ ledgerLoadingMore: true, ledgerError: '' });
        try {
          const nextPage = ledgerPagination.page + 1;
          const { list, summary, pagination } = await listLedgerEntries(token, {
            ...ledgerListOptions,
            page: nextPage,
            pageSize: ledgerPagination.pageSize,
          });
          set((state) => {
            const existingIds = new Set(state.ledgerEntries.map((entry) => entry.id));
            const nextEntries = list.filter((entry) => !existingIds.has(entry.id));
            return {
              ledgerEntries: [...state.ledgerEntries, ...nextEntries],
              ledgerSummary: summary,
              ledgerPagination: pagination ?? {
                page: nextPage,
                pageSize: ledgerPagination.pageSize,
                total: state.ledgerEntries.length + nextEntries.length,
                hasMore: false,
              },
              ledgerLoadingMore: false,
              ledgerError: '',
            };
          });
        } catch (error) {
          set({
            ledgerLoadingMore: false,
            ledgerError: getLifeTraceErrorMessage(error, '加载更多账目失败'),
          });
        }
      },
      loadCheckins: async (date) => {
        const token = getToken();
        if (!token) {
          set({
            checkins: [],
            checkinsDate: date,
            checkinsLoaded: true,
            checkinsLoading: false,
            checkinsError: '',
          });
          return;
        }

        set({ checkinsLoading: true, checkinsError: '', checkinsDate: date });
        try {
          const { list } = await listCheckins(token, date);
          set({
            checkins: list,
            checkinsDate: date,
            checkinsLoaded: true,
            checkinsLoading: false,
            checkinsError: '',
          });
        } catch (error) {
          set({
            checkinsLoading: false,
            checkinsLoaded: true,
            checkinsError: error instanceof Error ? error.message : '获取打卡失败',
          });
        }
      },
      loadAchievements: async (options = {}) => {
        const token = getToken();
        if (!token) {
          set({
            achievements: [],
            achievementSummary: defaultAchievementSummary,
            recentAchievements: [],
            achievementsLoaded: true,
            achievementsLoading: false,
            achievementsError: '',
          });
          return;
        }

        const previous = get().achievements;
        set({ achievementsLoading: true, achievementsError: '' });
        try {
          const response = await listAchievements(token);
          const nextAchievements = response.list.map(normalizeAchievement);
          const nextRecent = response.recent.map(normalizeAchievement);
          set({
            achievements: nextAchievements,
            achievementSummary: response.summary,
            recentAchievements: nextRecent,
            achievementsLoaded: true,
            achievementsLoading: false,
            achievementsError: '',
          });
          if (options.notifyNew && previous.length > 0) {
            notifyNewAchievements(previous, nextAchievements);
          }
        } catch (error) {
          set({
            achievementsLoaded: true,
            achievementsLoading: false,
            achievementsError: getLifeTraceErrorMessage(error, '获取生活成就失败'),
          });
        }
      },
      loadAiActions: async () => {
        const token = getToken();
        if (!token) {
          set({ aiActions: [] });
          return;
        }

        try {
          const response = await listAiActions(token);
          set({ aiActions: response.list.map(normalizeAiActionRecord) });
        } catch {
          // Keep local actions when the history endpoint is temporarily unavailable.
        }
      },
      toggleHabitCheckin: async (date, name, completed) => {
        const token = getToken();
        if (!token) {
          set({ checkinsError: '请先登录后再打卡' });
          return;
        }
        if (get().checkinTogglingByName[name]) {
          return;
        }

        set((state) => ({
          checkinTogglingByName: { ...state.checkinTogglingByName, [name]: true },
          checkinsError: '',
        }));
        try {
          const updated = await toggleCheckin(token, { date, name, completed });
          set((state) => {
            const exists = state.checkins.some((item) => item.name === name && item.date === date);
            return {
              checkinsDate: date,
              checkins: exists
                ? state.checkins.map((item) =>
                    item.name === name && item.date === date ? updated : item,
                  )
                : [...state.checkins, updated],
              checkinsError: '',
              aiActions: [
                {
                  id: createActionId(),
                  title: `${completed ? '完成' : '取消'}了「${name}」打卡`,
                  timeLabel: '刚刚',
                },
                ...getAiActions(state),
              ],
            };
          });
          void get().loadAchievements({ notifyNew: true });
        } catch (error) {
          set({ checkinsError: error instanceof Error ? error.message : '保存打卡失败' });
        } finally {
          set((state) => ({
            checkinTogglingByName: { ...state.checkinTogglingByName, [name]: false },
          }));
        }
      },
      addPlan: async (input) => {
        const token = getToken();
        if (!token) {
          set({ plansError: '请先登录后再创建计划' });
          return null;
        }

        if (get().planCreating) {
          return null;
        }

        set({ planCreating: true, plansError: '' });
        try {
          const plan = await createPlan(token, {
            ...input,
            source: input.source ?? 'manual',
          });
          set((state) => ({
            plans: [plan, ...state.plans],
            plansError: '',
            aiActions: [
              { id: createActionId(), title: `创建了「${input.title}」计划`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          void get().loadAchievements({ notifyNew: true });
          void get().loadPlaces(get().placesListOptions);
          return plan;
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '创建计划失败' });
          return null;
        } finally {
          set({ planCreating: false });
        }
      },
      addPantryItem: async (input, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再添加库存' });
          return null;
        }

        try {
          const item = normalizePantryItem(
            await requestCreatePantryItem(token, input, householdId),
          );
          const activeHouseholdId = normalizeHouseholdScopeId(get().pantryListOptions.householdId);
          const targetHouseholdId = normalizeHouseholdScopeId(householdId);
          set((state) => ({
            pantryItems: targetHouseholdId ? state.pantryItems : [item, ...state.pantryItems],
            pantryError: '',
            aiActions: [
              { id: createActionId(), title: `收进了「${item.name}」`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          if (get().pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(get().pantryListOptions);
          }
          if (get().tracesLoaded) {
            void get().loadTraces();
          }
          void get().loadAchievements({ notifyNew: true });
          return item;
        } catch (error) {
          set({ pantryError: getLifeTraceErrorMessage(error, '添加库存失败') });
          return null;
        }
      },
      editPantryItem: async (itemId, input, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再编辑库存' });
          return null;
        }

        try {
          const updatedItem = normalizePantryItem(
            await requestUpdatePantryItem(token, itemId, input, householdId),
          );
          const activeHouseholdId = normalizeHouseholdScopeId(get().pantryListOptions.householdId);
          const targetHouseholdId = normalizeHouseholdScopeId(householdId);
          set((state) => ({
            pantryItems: targetHouseholdId
              ? state.pantryItems
              : state.pantryItems.map((item) => (item.id === itemId ? updatedItem : item)),
            pantryError: '',
            aiActions: [
              {
                id: createActionId(),
                title: `更新了「${updatedItem.name}」库存`,
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          }));
          if (get().pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(get().pantryListOptions);
          }
          return updatedItem;
        } catch (error) {
          set({ pantryError: getLifeTraceErrorMessage(error, '编辑库存失败') });
          return null;
        }
      },
      updatePantryItemStatus: async (itemId, status, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再更新库存状态' });
          return null;
        }

        const statusUpdateKey = `${normalizeHouseholdScopeId(householdId) || 'personal'}:${itemId}`;
        if (pantryStatusUpdateInFlightKeys.has(statusUpdateKey)) {
          return null;
        }

        pantryStatusUpdateInFlightKeys.add(statusUpdateKey);
        try {
          const updatedItem = normalizePantryItem(
            await requestUpdatePantryItemStatus(token, itemId, status, householdId),
          );
          const activeHouseholdId = normalizeHouseholdScopeId(get().pantryListOptions.householdId);
          const targetHouseholdId = normalizeHouseholdScopeId(householdId);
          set((state) => ({
            pantryItems: targetHouseholdId
              ? state.pantryItems
              : state.pantryItems.map((item) => (item.id === itemId ? updatedItem : item)),
            pantryError: '',
            aiActions: [
              {
                id: createActionId(),
                title:
                  status === 'used-up'
                    ? '记录了一件已用完'
                    : status === 'discarded'
                      ? '记录了一件已丢弃'
                      : '更新了库存状态',
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          }));
          if (get().pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(get().pantryListOptions);
          }
          if ((status === 'used-up' || status === 'discarded') && get().tracesLoaded) {
            void get().loadTraces();
          }
          void get().loadAchievements({ notifyNew: true });
          return updatedItem;
        } catch (error) {
          set({ pantryError: getLifeTraceErrorMessage(error, '更新库存状态失败') });
          return null;
        } finally {
          pantryStatusUpdateInFlightKeys.delete(statusUpdateKey);
        }
      },
      consumePantryItem: async (itemId, input, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再更新库存数量' });
          return null;
        }

        const consumeKey = `${normalizeHouseholdScopeId(householdId) || 'personal'}:${itemId}:consume`;
        if (pantryStatusUpdateInFlightKeys.has(consumeKey)) {
          return null;
        }

        pantryStatusUpdateInFlightKeys.add(consumeKey);
        try {
          const updatedItem = normalizePantryItem(
            await requestConsumePantryItem(token, itemId, input, householdId),
          );
          const activeHouseholdId = normalizeHouseholdScopeId(get().pantryListOptions.householdId);
          const targetHouseholdId = normalizeHouseholdScopeId(householdId);
          set((state) => ({
            pantryItems: targetHouseholdId
              ? state.pantryItems
              : state.pantryItems.map((item) => (item.id === itemId ? updatedItem : item)),
            pantryError: '',
            aiActions: [
              {
                id: createActionId(),
                title: input.action === 'used' ? '记录了库存使用' : '记录了库存丢弃',
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          }));
          if (get().pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(get().pantryListOptions);
          }
          if (get().tracesLoaded) {
            void get().loadTraces();
          }
          void get().loadAchievements({ notifyNew: true });
          return updatedItem;
        } catch (error) {
          set({ pantryError: getLifeTraceErrorMessage(error, '更新库存数量失败') });
          return null;
        } finally {
          pantryStatusUpdateInFlightKeys.delete(consumeKey);
        }
      },
      removePantryItem: async (itemId, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再删除库存' });
          return false;
        }

        try {
          await requestDeletePantryItem(token, itemId, householdId);
          const activeHouseholdId = normalizeHouseholdScopeId(get().pantryListOptions.householdId);
          const targetHouseholdId = normalizeHouseholdScopeId(householdId);
          set((state) => ({
            pantryItems: targetHouseholdId
              ? state.pantryItems
              : state.pantryItems.filter((item) => item.id !== itemId),
            pantryListItems:
              activeHouseholdId === targetHouseholdId
                ? state.pantryListItems.filter((item) => item.id !== itemId)
                : state.pantryListItems,
            pantryListPagination:
              activeHouseholdId === targetHouseholdId
                ? {
                    ...state.pantryListPagination,
                    total: Math.max(state.pantryListPagination.total - 1, 0),
                  }
                : state.pantryListPagination,
            pantryError: '',
          }));
          if (get().pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(get().pantryListOptions);
          }
          return true;
        } catch (error) {
          set({ pantryError: getLifeTraceErrorMessage(error, '删除库存失败') });
          return false;
        }
      },
      receiveServerPlan: (plan, actionTitle) => {
        set((state) => {
          const exists = state.plans.some((item) => item.id === plan.id);
          const plans = exists
            ? state.plans.map((item) => (item.id === plan.id ? plan : item))
            : [plan, ...state.plans];

          return {
            plans,
            plansError: '',
            aiActions: [
              {
                id: createActionId(),
                title: actionTitle || `创建了「${plan.title}」计划`,
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          };
        });
        void get().loadAchievements({ notifyNew: true });
      },
      receiveServerPantryItem: (item, actionTitle) => {
        set((state) => {
          const normalizedItem = normalizePantryItem(item);
          const targetHouseholdId = normalizeHouseholdScopeId(normalizedItem.householdId);
          const activeHouseholdId = normalizeHouseholdScopeId(state.pantryListOptions.householdId);
          const pantryItems = targetHouseholdId
            ? state.pantryItems
            : state.pantryItems.some((current) => current.id === normalizedItem.id)
              ? state.pantryItems.map((current) =>
                  current.id === normalizedItem.id ? normalizedItem : current,
                )
              : [normalizedItem, ...state.pantryItems];

          if (state.pantryListLoaded && activeHouseholdId === targetHouseholdId) {
            void get().loadPantryList(state.pantryListOptions);
          }
          if (state.tracesLoaded) {
            void get().loadTraces();
          }

          return {
            pantryItems,
            pantryError: '',
            aiActions: [
              {
                id: createActionId(),
                title: actionTitle || `收进了「${normalizedItem.name}」`,
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          };
        });
        void get().loadAchievements({ notifyNew: true });
      },
      receiveServerLedgerEntry: (entry, actionTitle) => {
        set((state) => {
          const exists = state.ledgerEntries.some((item) => item.id === entry.id);
          const ledgerEntries = exists
            ? state.ledgerEntries.map((item) => (item.id === entry.id ? entry : item))
            : [entry, ...state.ledgerEntries];

          return {
            ledgerEntries,
            ledgerPagination: {
              ...state.ledgerPagination,
              total: exists ? state.ledgerPagination.total : state.ledgerPagination.total + 1,
            },
            ledgerError: '',
            aiActions: [
              {
                id: createActionId(),
                title: actionTitle || `记下了「${entry.category}」账目`,
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          };
        });
        void get().loadLedgerEntries(get().ledgerListOptions);
        void get().loadAchievements({ notifyNew: true });
      },
      editPlan: async (planId, input) => {
        const token = getToken();
        if (!token) {
          set({ plansError: '请先登录后再编辑计划' });
          return null;
        }

        if (get().planUpdatingById[planId]) {
          return null;
        }

        set((state) => ({
          planUpdatingById: { ...state.planUpdatingById, [planId]: true },
          plansError: '',
        }));
        try {
          const updated = await updatePlan(token, planId, {
            ...input,
            source: input.source ?? 'manual',
          });
          set((state) => ({
            plans: state.plans.map((plan) => (plan.id === planId ? updated : plan)),
            plansError: '',
            aiActions: [
              { id: createActionId(), title: `更新了「${updated.title}」计划`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          void get().loadPlaces(get().placesListOptions);
          return updated;
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '编辑计划失败' });
          return null;
        } finally {
          set((state) => ({
            planUpdatingById: { ...state.planUpdatingById, [planId]: false },
          }));
        }
      },
      addTrace: async (input) => {
        const token = getToken();
        if (!token) {
          set({ tracesError: '请先登录后再生成踪迹' });
          return null;
        }

        if (get().traceCreating) {
          return null;
        }

        set({ traceCreating: true, tracesError: '' });
        try {
          const trace = await createTrace(token, input);
          set((state) => ({
            traces: [trace, ...state.traces],
            tracesError: '',
            aiActions: [
              { id: createActionId(), title: `生成了「${input.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          void get().loadAchievements({ notifyNew: true });
          void get().loadPlaces(get().placesListOptions);
          return trace;
        } catch (error) {
          set({ tracesError: error instanceof Error ? error.message : '创建踪迹失败' });
          return null;
        } finally {
          set({ traceCreating: false });
        }
      },
      editTrace: async (traceId, input) => {
        const token = getToken();
        if (!token) {
          set({ tracesError: '请先登录后再编辑踪迹' });
          return null;
        }

        if (get().traceUpdatingById[traceId]) {
          return null;
        }

        set((state) => ({
          traceUpdatingById: { ...state.traceUpdatingById, [traceId]: true },
          tracesError: '',
        }));
        try {
          const updated = await updateTrace(token, traceId, input);
          set((state) => ({
            traces: state.traces.map((trace) => (trace.id === traceId ? updated : trace)),
            tracesError: '',
            aiActions: [
              { id: createActionId(), title: `更新了「${updated.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          void get().loadPlaces(get().placesListOptions);
          return updated;
        } catch (error) {
          set({ tracesError: error instanceof Error ? error.message : '编辑踪迹失败' });
          return null;
        } finally {
          set((state) => ({
            traceUpdatingById: { ...state.traceUpdatingById, [traceId]: false },
          }));
        }
      },
      addInboxItem: async (input) => {
        const token = getToken();
        if (!token) {
          set({ inboxError: '请先登录后再收下内容' });
          return null;
        }
        if (get().inboxCreating) {
          return null;
        }

        set({ inboxCreating: true, inboxError: '' });
        try {
          const item = await requestCreateInboxItem(token, input);
          set((state) => ({
            inboxItems: [item, ...state.inboxItems],
            inboxPagination: {
              ...state.inboxPagination,
              total: state.inboxPagination.total + 1,
            },
            inboxError: '',
            aiActions: [
              { id: createActionId(), title: `收下了「${item.title}」`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          return item;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, '创建 Inbox 失败') });
          return null;
        } finally {
          set({ inboxCreating: false });
        }
      },
      editInboxItem: async (itemId, input) => {
        const token = getToken();
        if (!token) {
          set({ inboxError: '请先登录后再编辑 Inbox' });
          return null;
        }
        if (get().inboxUpdatingById[itemId]) {
          return null;
        }

        set((state) => ({
          inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: true },
          inboxError: '',
        }));
        try {
          const updated = await requestUpdateInboxItem(token, itemId, input);
          set((state) => ({
            inboxItems: state.inboxItems.map((item) => (item.id === itemId ? updated : item)),
            inboxError: '',
          }));
          return updated;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, '编辑 Inbox 失败') });
          return null;
        } finally {
          set((state) => ({
            inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: false },
          }));
        }
      },
      updateInboxStatus: async (itemId, status) => {
        const token = getToken();
        if (!token) {
          set({ inboxError: '请先登录后再更新 Inbox' });
          return null;
        }
        if (get().inboxUpdatingById[itemId]) {
          return null;
        }

        set((state) => ({
          inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: true },
          inboxError: '',
        }));
        try {
          const updated = await requestUpdateInboxItemStatus(token, itemId, status);
          set((state) => ({
            inboxItems: state.inboxItems.map((item) => (item.id === itemId ? updated : item)),
            inboxError: '',
          }));
          return updated;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, '更新 Inbox 失败') });
          return null;
        } finally {
          set((state) => ({
            inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: false },
          }));
        }
      },
      convertInbox: async (itemId, convertedType, convertedId) => {
        const token = getToken();
        if (!token) {
          set({ inboxError: '请先登录后再转化 Inbox' });
          return null;
        }
        if (get().inboxUpdatingById[itemId]) {
          return null;
        }

        set((state) => ({
          inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: true },
          inboxError: '',
        }));
        try {
          const updated = await requestConvertInboxItem(token, itemId, {
            convertedType,
            convertedId,
          });
          set((state) => ({
            inboxItems: state.inboxItems.map((item) => (item.id === itemId ? updated : item)),
            inboxError: '',
            aiActions: [
              { id: createActionId(), title: `转化了「${updated.title}」`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          return updated;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, '转化 Inbox 失败') });
          return null;
        } finally {
          set((state) => ({
            inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: false },
          }));
        }
      },
      organizeInbox: async (itemId) => {
        const token = getToken();
        if (!token) {
          set({ inboxError: '请先登录后再整理 Inbox' });
          return null;
        }
        if (get().inboxUpdatingById[itemId]) {
          return null;
        }

        set((state) => ({
          inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: true },
          inboxError: '',
        }));
        try {
          const updated = await requestOrganizeInboxItem(token, itemId);
          set((state) => ({
            inboxItems: state.inboxItems.map((item) => (item.id === itemId ? updated : item)),
            inboxError: '',
            aiActions: [
              { id: createActionId(), title: `整理了「${updated.title}」`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          return updated;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, 'AI 整理 Inbox 失败') });
          return null;
        } finally {
          set((state) => ({
            inboxUpdatingById: { ...state.inboxUpdatingById, [itemId]: false },
          }));
        }
      },
      removeInboxItem: async (itemId) => {
        const token = getToken();
        if (!token || get().inboxDeletingById[itemId]) {
          return false;
        }

        set((state) => ({
          inboxDeletingById: { ...state.inboxDeletingById, [itemId]: true },
          inboxError: '',
        }));
        try {
          await requestDeleteInboxItem(token, itemId);
          set((state) => ({
            inboxItems: state.inboxItems.filter((item) => item.id !== itemId),
            inboxPagination: {
              ...state.inboxPagination,
              total: Math.max(state.inboxPagination.total - 1, 0),
            },
            inboxError: '',
          }));
          return true;
        } catch (error) {
          set({ inboxError: getLifeTraceErrorMessage(error, '删除 Inbox 失败') });
          return false;
        } finally {
          set((state) => ({
            inboxDeletingById: { ...state.inboxDeletingById, [itemId]: false },
          }));
        }
      },
      addLedgerEntry: async (input) => {
        const token = getToken();
        if (!token) {
          set({ ledgerError: '请先登录后再记账' });
          return null;
        }
        if (get().ledgerCreating) {
          return null;
        }

        set({ ledgerCreating: true, ledgerError: '' });
        try {
          const entry = await requestCreateLedgerEntry(token, input);
          set((state) => ({
            ledgerEntries: [entry, ...state.ledgerEntries],
            ledgerPagination: {
              ...state.ledgerPagination,
              total: state.ledgerPagination.total + 1,
            },
            ledgerError: '',
            aiActions: [
              { id: createActionId(), title: `记下了「${entry.category}」账目`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          void get().loadLedgerEntries(get().ledgerListOptions);
          return entry;
        } catch (error) {
          set({ ledgerError: getLifeTraceErrorMessage(error, '创建账目失败') });
          return null;
        } finally {
          set({ ledgerCreating: false });
        }
      },
      editLedgerEntry: async (entryId, input) => {
        const token = getToken();
        if (!token) {
          set({ ledgerError: '请先登录后再编辑账目' });
          return null;
        }
        if (get().ledgerUpdatingById[entryId]) {
          return null;
        }

        set((state) => ({
          ledgerUpdatingById: { ...state.ledgerUpdatingById, [entryId]: true },
          ledgerError: '',
        }));
        try {
          const updated = await requestUpdateLedgerEntry(token, entryId, input);
          set((state) => ({
            ledgerEntries: state.ledgerEntries.map((entry) =>
              entry.id === entryId ? updated : entry,
            ),
            ledgerError: '',
            aiActions: [
              {
                id: createActionId(),
                title: `更新了「${updated.category}」账目`,
                timeLabel: '刚刚',
              },
              ...getAiActions(state),
            ],
          }));
          void get().loadLedgerEntries(get().ledgerListOptions);
          return updated;
        } catch (error) {
          set({ ledgerError: getLifeTraceErrorMessage(error, '编辑账目失败') });
          return null;
        } finally {
          set((state) => ({
            ledgerUpdatingById: { ...state.ledgerUpdatingById, [entryId]: false },
          }));
        }
      },
      removeLedgerEntry: async (entryId) => {
        const token = getToken();
        if (!token || get().ledgerDeletingById[entryId]) {
          return false;
        }

        set((state) => ({
          ledgerDeletingById: { ...state.ledgerDeletingById, [entryId]: true },
          ledgerError: '',
        }));
        try {
          await requestDeleteLedgerEntry(token, entryId);
          set((state) => ({
            ledgerEntries: state.ledgerEntries.filter((entry) => entry.id !== entryId),
            ledgerPagination: {
              ...state.ledgerPagination,
              total: Math.max(state.ledgerPagination.total - 1, 0),
            },
            ledgerError: '',
          }));
          void get().loadLedgerEntries(get().ledgerListOptions);
          return true;
        } catch (error) {
          set({ ledgerError: getLifeTraceErrorMessage(error, '删除账目失败') });
          return false;
        } finally {
          set((state) => ({
            ledgerDeletingById: { ...state.ledgerDeletingById, [entryId]: false },
          }));
        }
      },
      completePlan: async (planId) => {
        const target = get().plans.find((plan) => plan.id === planId);
        const token = getToken();

        if (!target || !token || get().planCompletingById[planId]) {
          return;
        }

        set((state) => ({
          planCompletingById: { ...state.planCompletingById, [planId]: true },
          plansError: '',
        }));
        try {
          const nextCompleted = !target.completed;
          const result = await updatePlanStatus(token, planId, nextCompleted);
          const updated: Plan =
            result && typeof result === 'object' && 'plan' in result
              ? result.plan
              : (result as Plan);
          const derivedPlan: Plan | null =
            result && typeof result === 'object' && 'derivedPlan' in result
              ? (result.derivedPlan ?? null)
              : null;
          if (!nextCompleted) {
            set((state) => ({
              plans: state.plans.map((plan) => (plan.id === planId ? updated : plan)),
              plansError: '',
              aiActions: [
                {
                  id: createActionId(),
                  title: `取消了「${updated.title}」完成状态`,
                  timeLabel: '刚刚',
                },
                ...getAiActions(state),
              ],
            }));
            void get().loadAchievements({ notifyNew: true });
            return;
          }

          const trace = await createTrace(token, createTraceFromPlan(updated));
          set((state) => {
            const replaced = state.plans.map((plan) => (plan.id === planId ? updated : plan));
            const nextPlans = derivedPlan ? [derivedPlan, ...replaced] : replaced;
            const nextActions = derivedPlan
              ? [
                  {
                    id: createActionId(),
                    title: `周期计划「${updated.title}」已生成下一次（${derivedPlan.scheduledDate || ''}）`,
                    timeLabel: '刚刚',
                  },
                  {
                    id: createActionId(),
                    title: `生成了「${updated.title}」踪迹`,
                    timeLabel: '刚刚',
                  },
                  ...getAiActions(state),
                ]
              : [
                  {
                    id: createActionId(),
                    title: `生成了「${updated.title}」踪迹`,
                    timeLabel: '刚刚',
                  },
                  ...getAiActions(state),
                ];
            return {
              plans: nextPlans,
              traces: [trace, ...state.traces],
              plansError: '',
              tracesError: '',
              aiActions: nextActions,
            };
          });
          void get().loadAchievements({ notifyNew: true });
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '更新计划失败' });
        } finally {
          set((state) => ({
            planCompletingById: { ...state.planCompletingById, [planId]: false },
          }));
        }
      },
      removePlan: async (planId) => {
        const token = getToken();
        if (!token || get().planDeletingById[planId]) {
          return;
        }

        set((state) => ({
          planDeletingById: { ...state.planDeletingById, [planId]: true },
          plansError: '',
        }));
        try {
          await deletePlan(token, planId);
          set((state) => ({
            plans: state.plans.filter((plan) => plan.id !== planId),
            plansError: '',
          }));
          void get().loadPlaces(get().placesListOptions);
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '删除计划失败' });
        } finally {
          set((state) => ({
            planDeletingById: { ...state.planDeletingById, [planId]: false },
          }));
        }
      },
      removeTrace: async (traceId) => {
        const token = getToken();
        if (!token || get().traceDeletingById[traceId]) {
          return;
        }

        set((state) => ({
          traceDeletingById: { ...state.traceDeletingById, [traceId]: true },
          tracesError: '',
        }));
        try {
          await deleteTrace(token, traceId);
          set((state) => ({
            traces: state.traces.filter((trace) => trace.id !== traceId),
            tracesError: '',
          }));
          void get().loadPlaces(get().placesListOptions);
        } catch (error) {
          set({ tracesError: error instanceof Error ? error.message : '删除踪迹失败' });
        } finally {
          set((state) => ({
            traceDeletingById: { ...state.traceDeletingById, [traceId]: false },
          }));
        }
      },
      addAiAction: (title) =>
        set((state) => ({
          aiActions: [{ id: createActionId(), title, timeLabel: '刚刚' }, ...getAiActions(state)],
        })),
      generateTraceFromLatestPlan: async () => {
        const target = get().plans.find((plan) => plan.completed) ?? get().plans[0];
        if (!target) {
          return null;
        }

        return get().addTrace({
          ...createTraceFromPlan(target),
          summary: `Life AI 已根据「${target.title}」生成一条生活踪迹，你可以继续补充照片和心情。`,
        });
      },
    }),
    {
      name: 'life-trace-state',
      version: 7,
      storage: createJSONStorage(() => localStorage),
      partialize: () => ({}),
      migrate: () => ({}),
    },
  ),
);
