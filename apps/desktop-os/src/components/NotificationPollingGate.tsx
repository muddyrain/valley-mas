import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDockStore } from '../store/dockStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';

export default function NotificationPollingGate() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadCurrentUser = useAuthStore((s) => s.loadCurrentUser);
  const loadDockPreferences = useDockStore((s) => s.loadPreferences);
  const clearDockServerSync = useDockStore((s) => s.clearServerSync);
  const refreshUnreadCount = useNotificationCenterStore((s) => s.refreshUnreadCount);
  const resetNotifications = useNotificationCenterStore((s) => s.resetServerState);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      clearDockServerSync();
      resetNotifications();
      return;
    }

    const activeToken = token;
    let timer: number | undefined;

    function stopPolling() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = undefined;
    }

    function refreshIfVisible() {
      if (document.visibilityState === 'hidden') return;
      void refreshUnreadCount(activeToken);
    }

    function startPolling() {
      stopPolling();
      if (document.visibilityState === 'hidden') return;
      timer = window.setInterval(refreshIfVisible, 60_000);
    }

    function handleVisibilityChange() {
      refreshIfVisible();
      startPolling();
    }

    void loadDockPreferences(activeToken);
    refreshIfVisible();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    clearDockServerSync,
    isAuthenticated,
    loadDockPreferences,
    refreshUnreadCount,
    resetNotifications,
    token,
  ]);

  return null;
}
