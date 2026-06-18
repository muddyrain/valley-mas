import { create } from 'zustand';

export interface Notification {
  id: string;
  app: string;
  title: string;
  body: string;
  // 简化时间：相对当前时间的分钟数
  minutesAgo: number;
}

interface NotificationCenterStore {
  isOpen: boolean;
  notifications: Notification[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const SEED: Notification[] = [
  {
    id: 'n-1',
    app: '便签',
    title: '今日待办',
    body: '完成 desktop-os 的通知中心 P0 + 验收 Phase 3 收尾',
    minutesAgo: 3,
  },
  {
    id: 'n-2',
    app: '邮件',
    title: 'Vercel · 部署成功',
    body: '你的 desktop-os 预览环境已上线 https://...',
    minutesAgo: 18,
  },
  {
    id: 'n-3',
    app: 'App Store',
    title: '可更新 3 项',
    body: 'Xcode、Pages、备忘录有新版本',
    minutesAgo: 64,
  },
];

export const useNotificationCenterStore = create<NotificationCenterStore>((set) => ({
  isOpen: false,
  notifications: SEED,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearAll: () => set({ notifications: [] }),
}));
