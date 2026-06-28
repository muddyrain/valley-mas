import { useEffect, useRef } from 'react';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { FOCUS_LABELS, useToolStore } from '../store/toolStore';
import { useWindowStore } from '../store/windowStore';
import { shouldRunFocusTimerRuntime } from './runtimeGatePolicy';

export default function FocusTimerRuntimeGate() {
  const isFocusWindowRunning = useWindowStore((s) => s.runningAppIds.includes('focus'));
  const focusStatus = useToolStore((s) => s.focusStatus);
  const lastFocusCompletion = useToolStore((s) => s.lastFocusCompletion);
  const focusNotifiedCompletionId = useToolStore((s) => s.focusNotifiedCompletionId);
  const hasPendingCompletion = Boolean(
    lastFocusCompletion && lastFocusCompletion.id !== focusNotifiedCompletionId,
  );

  if (!shouldRunFocusTimerRuntime({ isFocusWindowRunning, focusStatus, hasPendingCompletion })) {
    return null;
  }

  return <FocusTimerRuntime />;
}

function FocusTimerRuntime() {
  const pushNotification = useNotificationCenterStore((s) => s.pushNotification);
  const syncFocusTimer = useToolStore((s) => s.syncFocusTimer);
  const lastFocusCompletion = useToolStore((s) => s.lastFocusCompletion);
  const focusNotifiedCompletionId = useToolStore((s) => s.focusNotifiedCompletionId);
  const markFocusCompletionNotified = useToolStore((s) => s.markFocusCompletionNotified);
  const focusStatus = useToolStore((s) => s.focusStatus);
  const notifiedRef = useRef<string | null>(lastFocusCompletion?.id ?? null);

  useEffect(() => {
    if (focusStatus !== 'running') return;
    const timer = window.setInterval(() => syncFocusTimer(), 1000);
    return () => window.clearInterval(timer);
  }, [focusStatus, syncFocusTimer]);

  useEffect(() => {
    if (
      !lastFocusCompletion ||
      focusNotifiedCompletionId === lastFocusCompletion.id ||
      notifiedRef.current === lastFocusCompletion.id
    ) {
      return;
    }
    notifiedRef.current = lastFocusCompletion.id;
    pushNotification({
      app: '专注钟',
      title: `${FOCUS_LABELS[lastFocusCompletion.mode]}完成`,
      body: '记录已更新',
    });
    markFocusCompletionNotified(lastFocusCompletion.id);
  }, [
    focusNotifiedCompletionId,
    lastFocusCompletion,
    markFocusCompletionNotified,
    pushNotification,
  ]);

  return null;
}
