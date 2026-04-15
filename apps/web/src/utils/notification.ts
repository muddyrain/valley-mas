import { BadgeCheck, BellRing, type LucideIcon, XCircle } from 'lucide-react';

export interface NotificationVisual {
  icon: LucideIcon;
  iconClass: string;
  iconBgClass: string;
}

export interface NotificationStateChangedDetail {
  unreadCount?: number;
}

export interface NotificationNavigationInput {
  type: string;
  extraData?: string;
}

interface NotificationExtraData {
  postId?: string;
  blogId?: string;
  postSlug?: string;
  resourceId?: string;
  resourceSlug?: string;
  creatorCode?: string;
  creatorId?: string;
  redirectUrl?: string;
  path?: string;
}

export const NOTIFICATION_STATE_CHANGED_EVENT = 'valley-notification-state-changed';

export const formatNotificationTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const getNotificationVisual = (type: string, content: string): NotificationVisual => {
  if (type === 'creator_application_review') {
    const rejected = content.includes('未通过') || content.includes('拒绝');
    if (rejected) {
      return {
        icon: XCircle,
        iconClass: 'text-rose-600',
        iconBgClass: 'bg-rose-100',
      };
    }
    return {
      icon: BadgeCheck,
      iconClass: 'text-emerald-600',
      iconBgClass: 'bg-emerald-100',
    };
  }

  return {
    icon: BellRing,
    iconClass: 'text-amber-700',
    iconBgClass: 'bg-amber-100',
  };
};

export const emitNotificationStateChanged = (detail: NotificationStateChangedDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<NotificationStateChangedDetail>(NOTIFICATION_STATE_CHANGED_EVENT, { detail }),
  );
};

const parseNotificationExtraData = (raw?: string): NotificationExtraData | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as NotificationExtraData;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const resolveNotificationTarget = (notification: NotificationNavigationInput) => {
  const extra = parseNotificationExtraData(notification.extraData);
  const normalizedType = notification.type.toLowerCase();

  if (extra?.redirectUrl) {
    return extra.redirectUrl;
  }
  if (extra?.path) {
    return extra.path;
  }

  if (extra?.postId || extra?.blogId) {
    return `/blog/${extra.postId || extra.blogId}`;
  }
  if (extra?.postSlug) {
    return `/blog/${extra.postSlug}`;
  }
  if (extra?.resourceId) {
    return `/resource/${extra.resourceId}`;
  }
  if (extra?.resourceSlug) {
    return `/resource/${extra.resourceSlug}`;
  }
  if (extra?.creatorCode) {
    return `/creator/${extra.creatorCode}`;
  }
  if (extra?.creatorId) {
    return '/creators';
  }

  if (normalizedType.includes('blog')) {
    return '/blog';
  }
  if (normalizedType.includes('resource')) {
    return '/resources';
  }
  if (normalizedType.includes('creator')) {
    return '/creators';
  }

  if (notification.type === 'creator_application_review') {
    return '/apply-creator';
  }

  return '';
};
