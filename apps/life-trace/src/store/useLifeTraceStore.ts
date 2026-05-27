import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createPlan, deletePlan, listPlans, updatePlanStatus } from '@/api/plans';
import { initialTraces } from '@/data/mock';
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
  traces: Trace[];
  settings: UserSettings;
  aiActions: AiAction[];
  setActiveTab: (tab: AppTab) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  loadPlans: () => Promise<void>;
  addPlan: (input: NewPlanInput) => Promise<Plan | null>;
  addTrace: (input: NewTraceInput) => void;
  completePlan: (planId: string) => Promise<void>;
  removePlan: (planId: string) => Promise<void>;
  addAiAction: (title: string) => void;
  generateTraceFromLatestPlan: () => Trace | null;
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

const createTraceFromPlan = (plan: Plan): Trace => ({
  id: `trace-${plan.id}`,
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

const createManualTraceId = () =>
  `trace-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createTraceId = () =>
  `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getAiActions = (state: Pick<LifeTraceState, 'aiActions'>) => state.aiActions ?? [];

const getToken = () => useAuthStore.getState().token;

export const useLifeTraceStore = create<LifeTraceState>()(
  persist(
    (set, get) => ({
      activeTab: 'today',
      plans: [],
      plansLoaded: false,
      plansLoading: false,
      plansError: '',
      traces: initialTraces,
      settings: defaultSettings,
      aiActions: [
        { id: 'ai-initial-plan', title: '创建了「周六看电影」计划', timeLabel: '2小时前' },
        { id: 'ai-initial-reminder', title: '设置了晚餐提醒', timeLabel: '昨天' },
        { id: 'ai-initial-trace', title: '生成了「咖啡店下午茶」踪迹', timeLabel: '昨天' },
      ],
      setActiveTab: (tab) => set({ activeTab: tab }),
      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),
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
      addPlan: async (input) => {
        const token = getToken();
        if (!token) {
          set({ plansError: '请先登录后再创建计划' });
          return null;
        }

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
        }
      },
      addTrace: (input) =>
        set((state) => ({
          traces: [{ id: createTraceId(), ...input }, ...state.traces],
          aiActions: [
            { id: createActionId(), title: `生成了「${input.title}」踪迹`, timeLabel: '刚刚' },
            ...getAiActions(state),
          ],
        })),
      completePlan: async (planId) => {
        const target = get().plans.find((plan) => plan.id === planId);
        const token = getToken();

        if (!target || target.completed || !token) {
          return;
        }

        try {
          const updated = await updatePlanStatus(token, planId, true);
          set((state) => ({
            plans: state.plans.map((plan) => (plan.id === planId ? updated : plan)),
            traces: [createTraceFromPlan(updated), ...state.traces],
            plansError: '',
            aiActions: [
              { id: createActionId(), title: `生成了「${updated.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          }));
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '更新计划失败' });
        }
      },
      removePlan: async (planId) => {
        const token = getToken();
        if (!token) {
          return;
        }

        try {
          await deletePlan(token, planId);
          set((state) => ({
            plans: state.plans.filter((plan) => plan.id !== planId),
            plansError: '',
          }));
        } catch (error) {
          set({ plansError: error instanceof Error ? error.message : '删除计划失败' });
        }
      },
      addAiAction: (title) =>
        set((state) => ({
          aiActions: [{ id: createActionId(), title, timeLabel: '刚刚' }, ...getAiActions(state)],
        })),
      generateTraceFromLatestPlan: () => {
        let generatedTrace: Trace | null = null;

        set((state) => {
          const target = state.plans.find((plan) => plan.completed) ?? state.plans[0];

          if (!target) {
            return state;
          }

          generatedTrace = {
            ...createTraceFromPlan(target),
            id: createManualTraceId(),
            summary: `Life AI 已根据「${target.title}」生成一条生活踪迹，你可以继续补充照片和心情。`,
          };

          return {
            traces: [generatedTrace, ...state.traces],
            aiActions: [
              { id: createActionId(), title: `生成了「${target.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          };
        });

        return generatedTrace;
      },
    }),
    {
      name: 'life-trace-state',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        traces: state.traces,
        settings: state.settings,
        aiActions: state.aiActions,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<LifeTraceState>;
        const { plans, plansLoaded, plansLoading, plansError, ...rest } = state;
        void plans;
        void plansLoaded;
        void plansLoading;
        void plansError;
        return rest;
      },
    },
  ),
);
