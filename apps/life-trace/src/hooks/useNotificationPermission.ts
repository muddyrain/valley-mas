import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePushSubscription,
  getPushConfig,
  type PushConfig,
  type PushSubscriptionPayload,
  savePushSubscription,
  testServerPush,
} from '@/api/push';

export type NotificationPermissionState =
  | NotificationPermission
  | 'unsupported'
  | 'insecure-context'
  | 'service-worker-unavailable';

type ServerPushStatus = 'unsupported' | 'disabled' | 'unbound' | 'subscribed' | 'syncing' | 'error';

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

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function normalizeSubscription(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return { endpoint, keys: { p256dh, auth } };
}

async function getExistingPushSubscriptionPayload() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return null;
  }
  return normalizeSubscription(subscription);
}

async function createFreshPushSubscription(token: string, publicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    const existingPayload = normalizeSubscription(existing);
    if (existingPayload) {
      await deletePushSubscription(token, existingPayload.endpoint).catch(() => undefined);
    }
    await existing.unsubscribe().catch(() => undefined);
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export function useNotificationPermission(token?: string | null) {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission(),
  );
  const [pushConfig, setPushConfig] = useState<PushConfig | null>(null);
  const [serverPushStatus, setServerPushStatus] = useState<ServerPushStatus>('unsupported');
  const [serverPushError, setServerPushError] = useState('');
  const supported =
    permission !== 'unsupported' &&
    permission !== 'insecure-context' &&
    permission !== 'service-worker-unavailable';
  const granted = permission === 'granted';
  const secureContext = window.isSecureContext;
  const pushSupported = supported && 'PushManager' in window;

  useEffect(() => {
    const refresh = () => setPermission(getNotificationPermission());
    window.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const refreshServerPushState = useCallback(async () => {
    if (!token || !pushSupported) {
      setPushConfig(null);
      setServerPushStatus(pushSupported ? 'unbound' : 'unsupported');
      return;
    }

    setServerPushError('');
    try {
      const config = await getPushConfig(token);
      setPushConfig(config);
      if (!config.enabled || !config.publicKey) {
        setServerPushStatus('disabled');
        return;
      }

      const payload = await getExistingPushSubscriptionPayload();
      if (!payload) {
        setServerPushStatus('unbound');
        return;
      }

      await savePushSubscription(token, payload);
      setServerPushStatus('subscribed');
    } catch (error) {
      setServerPushStatus('error');
      setServerPushError(error instanceof Error ? error.message : '服务端推送待确认');
    }
  }, [pushSupported, token]);

  useEffect(() => {
    void refreshServerPushState();
  }, [refreshServerPushState]);

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

  const enableServerPush = useCallback(async () => {
    if (!token || !pushSupported) {
      setServerPushStatus(pushSupported ? 'unbound' : 'unsupported');
      return false;
    }

    setServerPushStatus('syncing');
    setServerPushError('');

    try {
      let nextPermission: NotificationPermissionState = getNotificationPermission();
      if (nextPermission === 'default') {
        nextPermission = await Notification.requestPermission();
        setPermission(nextPermission);
      }
      if (nextPermission !== 'granted') {
        setServerPushStatus('unbound');
        return false;
      }

      const config = pushConfig ?? (await getPushConfig(token));
      setPushConfig(config);
      if (!config.enabled || !config.publicKey) {
        setServerPushStatus('disabled');
        return false;
      }

      const subscription = await createFreshPushSubscription(token, config.publicKey);
      const payload = normalizeSubscription(subscription);
      if (!payload) {
        throw new Error('浏览器没有返回完整的推送订阅信息');
      }

      await savePushSubscription(token, payload);
      await refreshServerPushState();
      setServerPushStatus('subscribed');
      return true;
    } catch (error) {
      setServerPushStatus('error');
      setServerPushError(error instanceof Error ? error.message : '服务端推送绑定失败');
      return false;
    }
  }, [pushConfig, pushSupported, refreshServerPushState, token]);

  const showServerTestNotification = useCallback(async () => {
    if (!token) {
      setServerPushStatus('unbound');
      return false;
    }

    setServerPushError('');
    try {
      await testServerPush(token);
      setServerPushStatus('subscribed');
      return true;
    } catch (error) {
      setServerPushStatus('error');
      setServerPushError(error instanceof Error ? error.message : '服务端测试推送失败');
      return false;
    }
  }, [token]);

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

  const serverPushLabel = useMemo(() => {
    if (!pushSupported) {
      return '当前浏览器不支持服务端推送';
    }
    if (serverPushStatus === 'disabled') {
      return '服务端推送未配置';
    }
    if (serverPushStatus === 'subscribed') {
      return '服务端推送已绑定';
    }
    if (serverPushStatus === 'syncing') {
      return '正在同步推送设备';
    }
    if (serverPushStatus === 'error') {
      return serverPushError || '服务端推送异常';
    }
    return '可绑定服务端推送';
  }, [pushSupported, serverPushError, serverPushStatus]);

  return {
    permission,
    supported,
    granted,
    secureContext,
    pushSupported,
    serverPushStatus,
    serverPushReady: serverPushStatus === 'subscribed',
    serverPushLabel,
    serverPushError,
    label,
    requestPermission,
    showTestNotification,
    enableServerPush,
    showServerTestNotification,
    refreshServerPushState,
  };
}
