import { create } from 'zustand';
import {
  getUnreadNotificationCount,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ServerNotification,
} from '../api/notifications';

export interface Notification {
  id: string;
  app: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  localOnly?: boolean;
}

interface NotificationCenterStore {
  isOpen: boolean;
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  pushNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  loadNotifications: (token: string) => Promise<void>;
  refreshUnreadCount: (token: string) => Promise<void>;
  dismiss: (id: string, token?: string | null) => Promise<void>;
  clearAll: (token?: string | null) => Promise<void>;
  resetServerState: () => void;
}

const SEED: Notification[] = [
  {
    id: 'n-1',
    app: 'Finder',
    title: '资源已更新',
    body: 'AI 工具、设计资源和开发资源已加入 Finder。',
    createdAt: minutesAgo(3),
    isRead: false,
    localOnly: true,
  },
  {
    id: 'n-2',
    app: 'Desktop OS',
    title: '桌面已就绪',
    body: 'Safari、Dock、控制中心和小组件可继续扩展。',
    createdAt: minutesAgo(18),
    isRead: false,
    localOnly: true,
  },
  {
    id: 'n-3',
    app: 'Safari',
    title: '浏览器模式',
    body: '地址栏已支持网页载入和新窗口打开。',
    createdAt: minutesAgo(64),
    isRead: false,
    localOnly: true,
  },
];

export const useNotificationCenterStore = create<NotificationCenterStore>((set, get) => ({
  isOpen: false,
  notifications: SEED,
  unreadCount: SEED.length,
  loading: false,
  error: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  pushNotification: (notification) =>
    set((s) => ({
      notifications: [
        {
          id: `n-${Date.now()}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          localOnly: true,
          ...notification,
        },
        ...s.notifications,
      ].slice(0, 12),
      unreadCount: s.unreadCount + 1,
    })),
  loadNotifications: async (token) => {
    set({ loading: true, error: null });
    try {
      const [notifications, unread] = await Promise.all([
        listMyNotifications(token, 1, 20),
        getUnreadNotificationCount(token),
      ]);
      set({
        notifications: notifications.list.map(serverNotificationToDesktop),
        unreadCount: unread.unread,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '通知加载失败',
      });
    }
  },
  refreshUnreadCount: async (token) => {
    try {
      const data = await getUnreadNotificationCount(token);
      set({ unreadCount: data.unread, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '通知刷新失败' });
    }
  },
  dismiss: async (id, token) => {
    const current = get().notifications.find((item) => item.id === id);
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, isRead: true } : item,
      ),
      unreadCount: Math.max(0, state.unreadCount - (current?.isRead ? 0 : 1)),
      error: null,
    }));
    if (!token || current?.localOnly) return;
    try {
      await markNotificationRead(id, token);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '通知更新失败' });
    }
  },
  clearAll: async (token) => {
    set((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, isRead: true })),
      unreadCount: 0,
      error: null,
    }));
    if (!token) return;
    try {
      await markAllNotificationsRead(token);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '通知更新失败' });
    }
  },
  resetServerState: () =>
    set({ notifications: SEED, unreadCount: SEED.length, loading: false, error: null }),
}));

function serverNotificationToDesktop(item: ServerNotification): Notification {
  return {
    id: item.id,
    app: notificationTypeLabel(item.type),
    title: item.title,
    body: item.content,
    createdAt: item.createdAt,
    isRead: item.isRead,
  };
}

function notificationTypeLabel(type: string) {
  switch (type) {
    case 'creator_application_review':
      return '创作者申请';
    case 'admin':
      return 'Valley';
    case 'system':
      return '系统';
    default:
      return type || '通知';
  }
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
