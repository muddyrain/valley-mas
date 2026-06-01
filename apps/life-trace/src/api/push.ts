import { apiRequest } from '@/api/request';

export type PushConfig = {
  enabled: boolean;
  publicKey: string;
};

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushSubscriptionRecord = PushSubscriptionPayload & {
  id: string;
  userId: string;
  status: 'active' | 'disabled';
  userAgent?: string;
  lastError?: string;
  lastSentAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function getPushConfig(token: string) {
  return apiRequest<PushConfig>('/life-trace/push/config', token);
}

export function savePushSubscription(token: string, subscription: PushSubscriptionPayload) {
  return apiRequest<PushSubscriptionRecord>('/life-trace/push/subscription', token, {
    method: 'PUT',
    body: JSON.stringify(subscription),
  });
}

export function deletePushSubscription(token: string, endpoint: string) {
  const params = new URLSearchParams({ endpoint });
  return apiRequest<{ endpoint: string }>(
    `/life-trace/push/subscription?${params.toString()}`,
    token,
    {
      method: 'DELETE',
    },
  );
}

export function testServerPush(token: string) {
  return apiRequest<{ sent: boolean }>('/life-trace/push/test', token, {
    method: 'POST',
  });
}
