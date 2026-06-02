import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { listCheckins, toggleCheckin } from '@/api/checkins';
import {
  listPantry,
  createPantryItem as requestCreatePantryItem,
  deletePantryItem as requestDeletePantryItem,
  updatePantryItem as requestUpdatePantryItem,
  updatePantryItemStatus as requestUpdatePantryItemStatus,
} from '@/api/pantry';
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
import { resolvePantryStatus } from '@/lib/pantry';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  AiAction,
  AppTab,
  Checkin,
  ListPagination,
  NewPantryItemInput,
  NewPlanInput,
  NewTraceInput,
  PantryItem,
  PantryItemStatus,
  PantryPreferences,
  Plan,
  Trace,
  UserSettings,
} from '@/types';

type LifeTraceState = {
  activeTab: AppTab;
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
  pantryPreferences: PantryPreferences;
  aiActions: AiAction[];
  setActiveTab: (tab: AppTab) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updatePantryPreferences: (preferences: Partial<PantryPreferences>) => void;
  loadSettings: () => Promise<void>;
  loadPantry: () => Promise<void>;
  loadPlans: (options?: ListPlansOptions) => Promise<void>;
  loadMorePlans: () => Promise<void>;
  loadTraces: () => Promise<void>;
  loadMoreTraces: () => Promise<void>;
  loadCheckins: (date: string) => Promise<void>;
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
  removePantryItem: (itemId: string, householdId?: string) => Promise<void>;
  receiveServerPlan: (plan: Plan, actionTitle?: string) => void;
  editPlan: (planId: string, input: NewPlanInput) => Promise<Plan | null>;
  addTrace: (input: NewTraceInput) => Promise<Trace | null>;
  editTrace: (traceId: string, input: NewTraceInput) => Promise<Trace | null>;
  completePlan: (planId: string) => Promise<void>;
  removePlan: (planId: string) => Promise<void>;
  removeTrace: (traceId: string) => Promise<void>;
  addAiAction: (title: string) => void;
  generateTraceFromLatestPlan: () => Promise<Trace | null>;
};

const defaultSettings: UserSettings = {
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

let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;

function normalizeSettings(settings: Partial<UserSettings>): UserSettings {
  return {
    ...defaultSettings,
    ...settings,
    habits: settings.habits?.length ? settings.habits : defaultSettings.habits,
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

function pantryInputFromItem(item: PantryItem): NewPantryItemInput {
  return {
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    location: item.location,
    expiresAt: item.expiresAt,
    openedAt: item.openedAt,
    note: item.note,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    status: item.status,
    reminder: {
      enabled: item.reminder.enabled,
      useDefault: item.reminder.useDefault,
      rules: item.reminder.rules,
      reminderTime: item.reminder.reminderTime,
    },
  };
}

export const useLifeTraceStore = create<LifeTraceState>()(
  persist(
    (set, get) => ({
      activeTab: 'today',
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
      pantryPreferences: defaultPantryPreferences,
      aiActions: [
        { id: 'ai-initial-plan', title: '创建了「周六看电影」计划', timeLabel: '2小时前' },
        { id: 'ai-initial-reminder', title: '设置了晚餐提醒', timeLabel: '昨天' },
        { id: 'ai-initial-trace', title: '生成了「咖啡店下午茶」踪迹', timeLabel: '昨天' },
      ],
      setActiveTab: (tab) => set({ activeTab: tab }),
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

        set({
          settings: nextSettings,
          pantryPreferences: pantryPreferencesFromSettings(nextSettings),
          settingsSaving: Boolean(token),
          settingsError: '',
        });

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
              set({
                settings: nextSettings,
                pantryPreferences: pantryPreferencesFromSettings(nextSettings),
                settingsSaving: false,
                settingsError: '',
              });
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
          set({
            settings,
            pantryPreferences: pantryPreferencesFromSettings(settings),
            settingsLoaded: true,
            settingsLoading: false,
            settingsError: '',
          });
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

        const localItems = get().pantryItems.map(normalizePantryItem);
        set({ pantryLoading: true, pantryError: '' });
        try {
          let { list } = await listPantry(token, { page: 1, pageSize: 200 });
          if (list.length === 0 && localItems.length > 0) {
            for (const item of localItems) {
              await requestCreatePantryItem(token, pantryInputFromItem(item));
            }
            ({ list } = await listPantry(token, { page: 1, pageSize: 200 }));
          }

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
            pantryError: error instanceof Error ? error.message : '获取库存失败',
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
          set((state) => ({
            pantryItems: [item, ...state.pantryItems],
            pantryError: '',
            aiActions: [
              { id: createActionId(), title: `收进了「${item.name}」`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
          return item;
        } catch (error) {
          set({ pantryError: error instanceof Error ? error.message : '添加库存失败' });
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
          set((state) => ({
            pantryItems: state.pantryItems.map((item) => (item.id === itemId ? updatedItem : item)),
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
          return updatedItem;
        } catch (error) {
          set({ pantryError: error instanceof Error ? error.message : '编辑库存失败' });
          return null;
        }
      },
      updatePantryItemStatus: async (itemId, status, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再更新库存状态' });
          return null;
        }

        try {
          const updatedItem = normalizePantryItem(
            await requestUpdatePantryItemStatus(token, itemId, status, householdId),
          );
          set((state) => ({
            pantryItems: state.pantryItems.map((item) => (item.id === itemId ? updatedItem : item)),
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
          return updatedItem;
        } catch (error) {
          set({ pantryError: error instanceof Error ? error.message : '更新库存状态失败' });
          return null;
        }
      },
      removePantryItem: async (itemId, householdId) => {
        const token = getToken();
        if (!token) {
          set({ pantryError: '请先登录后再删除库存' });
          return;
        }

        try {
          await requestDeletePantryItem(token, itemId, householdId);
          set((state) => ({
            pantryItems: state.pantryItems.filter((item) => item.id !== itemId),
            pantryError: '',
          }));
        } catch (error) {
          set({ pantryError: error instanceof Error ? error.message : '删除库存失败' });
        }
      },
      receiveServerPlan: (plan, actionTitle) =>
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
        }),
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
          const updated = await updatePlanStatus(token, planId, nextCompleted);
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
            return;
          }

          const trace = await createTrace(token, createTraceFromPlan(updated));
          set((state) => ({
            plans: state.plans.map((plan) => (plan.id === planId ? updated : plan)),
            traces: [trace, ...state.traces],
            plansError: '',
            tracesError: '',
            aiActions: [
              { id: createActionId(), title: `生成了「${updated.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
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
      version: 4,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        pantryItems: state.pantryItems,
        pantryPreferences: state.pantryPreferences,
        aiActions: state.aiActions,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<LifeTraceState>;
        const {
          plans,
          plansLoaded,
          plansLoading,
          plansLoadingMore,
          plansError,
          plansPagination,
          plansListOptions,
          planCreating,
          planUpdatingById,
          planCompletingById,
          planDeletingById,
          traces,
          tracesLoaded,
          tracesLoading,
          tracesLoadingMore,
          tracesError,
          tracesPagination,
          traceCreating,
          traceUpdatingById,
          traceDeletingById,
          checkins,
          checkinsDate,
          checkinsLoaded,
          checkinsLoading,
          checkinsError,
          checkinTogglingByName,
          settingsLoaded,
          settingsLoading,
          settingsSaving,
          settingsError,
          pantryItems,
          pantryLoaded,
          pantryLoading,
          pantryError,
          pantryPreferences,
          ...rest
        } = state;
        void plans;
        void plansLoaded;
        void plansLoading;
        void plansLoadingMore;
        void plansError;
        void plansPagination;
        void plansListOptions;
        void planCreating;
        void planUpdatingById;
        void planCompletingById;
        void planDeletingById;
        void traces;
        void tracesLoaded;
        void tracesLoading;
        void tracesLoadingMore;
        void tracesError;
        void tracesPagination;
        void traceCreating;
        void traceUpdatingById;
        void traceDeletingById;
        void checkins;
        void checkinsDate;
        void checkinsLoaded;
        void checkinsLoading;
        void checkinsError;
        void checkinTogglingByName;
        void settingsLoaded;
        void settingsLoading;
        void settingsSaving;
        void settingsError;
        void pantryLoaded;
        void pantryLoading;
        void pantryError;
        return {
          ...rest,
          pantryItems: Array.isArray(pantryItems)
            ? pantryItems.map((item) => normalizePantryItem(item as PantryItem))
            : [],
          pantryPreferences: normalizePantryPreferences(
            pantryPreferences as Partial<PantryPreferences> | undefined,
          ),
        };
      },
    },
  ),
);
