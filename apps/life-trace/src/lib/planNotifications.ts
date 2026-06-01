import type { DueReminder } from '@/lib/planReminder';

const NOTIFIED_KEY = 'life-trace-reminder-notified';
const MAX_NOTIFICATION_RECORDS = 120;

function readNotifiedIds() {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeNotifiedIds(ids: string[]) {
  window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(ids.slice(-MAX_NOTIFICATION_RECORDS)));
}

function buildNotificationRecordId(reminder: Pick<DueReminder, 'plan' | 'dueAt'>) {
  return `${reminder.plan.id}:${reminder.dueAt.getTime()}`;
}

export function clearPlanNotificationRecord(planId: string) {
  const next = readNotifiedIds().filter((id) => id !== planId && !id.startsWith(`${planId}:`));
  writeNotifiedIds(next);
}

export function hasPlanNotificationRecord(reminder: Pick<DueReminder, 'plan' | 'dueAt'>) {
  const recordId = buildNotificationRecordId(reminder);
  return readNotifiedIds().includes(recordId);
}

export async function showPlanReminderNotification(reminder: DueReminder) {
  if (
    !window.isSecureContext ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  ) {
    return false;
  }

  const notifiedIds = readNotifiedIds();
  const recordId = buildNotificationRecordId(reminder);
  if (notifiedIds.includes(recordId)) {
    return false;
  }

  const title = `计划提醒：${reminder.plan.title}`;
  const body = `${reminder.dateText} ${reminder.timeText} · 点开 Life Trace 处理`;
  const options: NotificationOptions = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `life-trace-plan-${reminder.plan.id}`,
    data: {
      planId: reminder.plan.id,
      url: '/?tab=plans',
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }

    writeNotifiedIds([...notifiedIds, recordId]);
    return true;
  } catch {
    return false;
  }
}
