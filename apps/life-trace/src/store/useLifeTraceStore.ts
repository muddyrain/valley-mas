import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { initialPlans, initialTraces } from '@/data/mock';
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
  traces: Trace[];
  settings: UserSettings;
  aiActions: AiAction[];
  setActiveTab: (tab: AppTab) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  addPlan: (input: NewPlanInput) => void;
  addTrace: (input: NewTraceInput) => void;
  completePlan: (planId: string) => void;
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

const createPlanId = () =>
  `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createActionId = () =>
  `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createManualTraceId = () =>
  `trace-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createTraceId = () =>
  `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getAiActions = (state: Pick<LifeTraceState, 'aiActions'>) => state.aiActions ?? [];

export const useLifeTraceStore = create<LifeTraceState>()(
  persist(
    (set) => ({
      activeTab: 'today',
      plans: initialPlans,
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
      addPlan: (input) =>
        set((state) => ({
          plans: [{ id: createPlanId(), completed: false, ...input }, ...state.plans],
          aiActions: [
            { id: createActionId(), title: `创建了「${input.title}」计划`, timeLabel: '刚刚' },
            ...getAiActions(state),
          ],
        })),
      addTrace: (input) =>
        set((state) => ({
          traces: [{ id: createTraceId(), ...input }, ...state.traces],
          aiActions: [
            { id: createActionId(), title: `生成了「${input.title}」踪迹`, timeLabel: '刚刚' },
            ...getAiActions(state),
          ],
        })),
      completePlan: (planId) =>
        set((state) => {
          const target = state.plans.find((plan) => plan.id === planId);

          if (!target || target.completed) {
            return state;
          }

          return {
            plans: state.plans.map((plan) =>
              plan.id === planId ? { ...plan, completed: true } : plan,
            ),
            traces: [createTraceFromPlan(target), ...state.traces],
            aiActions: [
              { id: createActionId(), title: `生成了「${target.title}」踪迹`, timeLabel: '刚刚' },
              ...getAiActions(state),
            ],
          };
        }),
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        plans: state.plans,
        traces: state.traces,
        settings: state.settings,
        aiActions: state.aiActions,
      }),
    },
  ),
);
