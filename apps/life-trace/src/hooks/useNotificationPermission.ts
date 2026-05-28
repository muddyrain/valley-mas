import { useCallback, useEffect, useMemo, useState } from 'react';

export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'service-worker-unavailable';

function getNotificationPermission(): NotificationPermissionState {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (!('serviceWorker' in navigator)) {
    return 'service-worker-unavailable';
  }

  return Notification.permission;
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission(),
  );
  const supported = permission !== 'unsupported' && permission !== 'service-worker-unavailable';
  const granted = permission === 'granted';

  useEffect(() => {
    const refresh = () => setPermission(getNotificationPermission());
    window.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission(getNotificationPermission());
      return;
    }

    const next = await Notification.requestPermission();
    setPermission(next);
  }, []);

  const label = useMemo(() => {
    if (permission === 'granted') {
      return '系统通知已开启';
    }
    if (permission === 'denied') {
      return '通知已被浏览器关闭';
    }
    if (permission === 'unsupported') {
      return '当前浏览器暂不支持通知';
    }
    if (permission === 'service-worker-unavailable') {
      return '需要 Service Worker 支持';
    }
    return '可以开启系统通知';
  }, [permission]);

  return {
    permission,
    supported,
    granted,
    label,
    requestPermission,
  };
}
