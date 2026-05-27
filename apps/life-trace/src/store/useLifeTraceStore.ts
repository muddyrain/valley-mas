import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createPlan, deletePlan, listPlans, updatePlanStatus } from '@/api/plans';
import { getSettings, saveSettings } from '@/api/settings';
import { createTrace, deleteTrace, listTraces } from '@/api/traces';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  AiAction,
  AppTab,
  NewPlanInput,
  NewTraceInput,
  Plan,
  Trace,
  UserSettings,
} from '@/types';

type LifeTraceState = {
  activeTab: AppTab;
  plans: Plan[];
  plansLoaded: boolean;
  plansLoading: boolean;
  plansError: string;
  planCreating: boolean;
  planCompletingById: Record<string, boolean>;
  planDeletingById: Record<string, boolean>;
  traces: Trace[];
  tracesLoaded: boolean;
  tracesLoading: boolean;
  tracesError: string;
  settings: UserSettings;
  settingsLoaded: boolean;
  settingsLoading: boolean;
  settingsSaving: boolean;
  settingsError: string;
  aiActions: AiAction[];
  setActiveTab: (tab: AppTab) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  loadSettings: () => Promise<void>;
  loadPlans: () => Promise<void>;
  loadTraces: () => Promise<void>;
  addPlan: (input: NewPlanInput) => Promise<Plan | null>;
  addTrace: (input: NewTraceInput) => Promise<Trace | null>;
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
  weatherAlerts: true,
  planReminders: true,
  aiPersonalization: true,
  habits: ['喝水', '休息', '运动', '护肤'],
};

const createTraceFromPlan = (plan: Plan): NewTraceInput => ({
  planId: plan.id,
  title: plan.title.replace(/^周[五六日]晚上?/, '').replace(/^明早\s*/, ''),
  summary: `${plan.title}，已经被记录为一条新的生活踪迹。`,
  timeLabel: plan.timeLabel,
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

export const useLifeTraceStore = create<LifeTraceState>()(
  persist(
    (set, get) => ({
      activeTab: 'today',
      plans: [],
      plansLoaded: false,
      plansLoading: false,
      plansError: '',
      planCreating: false,
      planCompletingById: {},
      planDeletingById: {},
      traces: [],
      tracesLoaded: false,
      tracesLoading: false,
      tracesError: '',
      settings: defaultSettings,
      settingsLoaded: false,
      settingsLoading: false,
      settingsSaving: false,
      settingsError: '',
      aiActions: [
        { id: 'ai-initial-plan', title: '创建了「周六看电影」计划', timeLabel: '2小时前' },
        { id: 'ai-initial-reminder', title: '设置了晚餐提醒', timeLabel: '昨天' },
        { id: 'ai-initial-trace', title: '生成了「咖啡店下午茶」踪迹', timeLabel: '昨天' },
      ],
      setActiveTab: (tab) => set({ activeTab: tab }),
      updateSettings: (settings) => {
        const nextSettings = { ...get().settings, ...settings };
        const token = getToken();

        set({
          settings: nextSettings,
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
              set({ settings: saved, settingsSaving: false, settingsError: '' });
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
          const settings = await getSettings(token);
          set({
            settings,
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
      loadPlans: async () => {
        const token = getToken();
        if (!token) {
          set({ plans: [], plansLoaded: true, plansLoading: false, plansError: '' });
          return;
        }

        set({ plansLoading: true, plansError: '' });
        try {
          const { list } = await listPlans(token);
          set({ plans: list, plansLoaded: true, plansLoading: false, plansError: '' });
        } catch (error) {
          set({
            plansLoading: false,
            plansLoaded: true,
            plansError: error instanceof Error ? error.message : '获取计划失败',
          });
        }
      },
      loadTraces: async () => {
        const token = getToken();
        if (!token) {
          set({ traces: [], tracesLoaded: true, tracesLoading: false, tracesError: '' });
          return;
        }

        set({ tracesLoading: true, tracesError: '' });
        try {
          const { list } = await listTraces(token);
          set({ traces: list, tracesLoaded: true, tracesLoading: false, tracesError: '' });
        } catch (error) {
          set({
            tracesLoading: false,
            tracesLoaded: true,
            tracesError: error instanceof Error ? error.message : '获取踪迹失败',
          });
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
      addTrace: async (input) => {
        const token = getToken();
        if (!token) {
          set({ tracesError: '请先登录后再生成踪迹' });
          return null;
        }

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
        }
      },
      completePlan: async (planId) => {
        const target = get().plans.find((plan) => plan.id === planId);
        const token = getToken();

        if (!target || target.completed || !token || get().planCompletingById[planId]) {
          return;
        }

        set((state) => ({
          planCompletingById: { ...state.planCompletingById, [planId]: true },
          plansError: '',
        }));
        try {
          const updated = await updatePlanStatus(token, planId, true);
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
        if (!token) {
          return;
        }

        try {
          await deleteTrace(token, traceId);
          set((state) => ({
            traces: state.traces.filter((trace) => trace.id !== traceId),
            tracesError: '',
          }));
        } catch (error) {
          set({ tracesError: error instanceof Error ? error.message : '删除踪迹失败' });
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        aiActions: state.aiActions,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<LifeTraceState>;
        const {
          plans,
          plansLoaded,
          plansLoading,
          plansError,
          planCreating,
          planCompletingById,
          planDeletingById,
          traces,
          tracesLoaded,
          tracesLoading,
          tracesError,
          settingsLoaded,
          settingsLoading,
          settingsSaving,
          settingsError,
          ...rest
        } = state;
        void plans;
        void plansLoaded;
        void plansLoading;
        void plansError;
        void planCreating;
        void planCompletingById;
        void planDeletingById;
        void traces;
        void tracesLoaded;
        void tracesLoading;
        void tracesError;
        void settingsLoaded;
        void settingsLoading;
        void settingsSaving;
        void settingsError;
        return rest;
      },
    },
  ),
);
