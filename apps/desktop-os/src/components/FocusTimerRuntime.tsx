import { useEffect, useRef } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { FOCUS_LABELS, useToolStore } from '../store/toolStore';

export default function FocusTimerRuntime() {
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const syncFocusTimer = useToolStore((s) => s.syncFocusTimer);
  const lastFocusCompletion = useToolStore((s) => s.lastFocusCompletion);
  const focusStatus = useToolStore((s) => s.focusStatus);
  const notifiedRef = useRef<string | null>(lastFocusCompletion?.id ?? null);

  useEffect(() => {
    if (focusStatus !== 'running') return;
    const timer = window.setInterval(() => syncFocusTimer(), 1000);
    return () => window.clearInterval(timer);
  }, [focusStatus, syncFocusTimer]);

  useEffect(() => {
    if (!lastFocusCompletion || notifiedRef.current === lastFocusCompletion.id) return;
    notifiedRef.current = lastFocusCompletion.id;
    pushNotification({
      app: '专注钟',
      title: `${FOCUS_LABELS[lastFocusCompletion.mode]}完成`,
      body: '记录已更新',
    });
  }, [lastFocusCompletion, pushNotification]);

  return null;
}
