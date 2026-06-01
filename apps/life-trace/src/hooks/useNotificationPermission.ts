import { useCallback, useEffect, useMemo, useState } from 'react';

export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'insecure-context'
  | 'service-worker-unavailable';

function getNotificationPermission(): NotificationPermissionState {
  if (!window.isSecureContext) {
    return 'insecure-context';
  }

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
  const supported =
    permission !== 'unsupported' &&
    permission !== 'insecure-context' &&
    permission !== 'service-worker-unavailable';
  const granted = permission === 'granted';
  const secureContext = window.isSecureContext;

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
    if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission(getNotificationPermission());
      return;
    }

    const next = await Notification.requestPermission();
    setPermission(next);
  }, []);

  const showTestNotification = useCallback(async () => {
    if (
      !window.isSecureContext ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      setPermission(getNotificationPermission());
      return false;
    }

    const title = 'Life Trace 测试提醒';
    const options: NotificationOptions = {
      body: '如果你看到这条通知，说明当前设备已经能收到本地提醒。',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'life-trace-test-notification',
      data: { url: '/plans' },
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return true;
    }

    new Notification(title, options);
    return true;
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
    if (permission === 'insecure-context') {
      return '需要通过 HTTPS 或 localhost 打开';
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
    secureContext,
    label,
    requestPermission,
    showTestNotification,
  };
}
