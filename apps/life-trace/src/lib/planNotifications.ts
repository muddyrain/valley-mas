import type { DueReminder } from '@/lib/planReminder';

const NOTIFIED_KEY = 'life-trace-reminder-notified';

function readNotifiedIds() {
  try {
    const raw = window.localStorage.getItem(NOTIFIED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeNotifiedIds(ids: string[]) {
  window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(ids.slice(-80)));
}

export function clearPlanNotificationRecord(planId: string) {
  const next = readNotifiedIds().filter((id) => id !== planId);
  writeNotifiedIds(next);
}

export async function showPlanReminderNotification(reminder: DueReminder) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const notifiedIds = readNotifiedIds();
  if (notifiedIds.includes(reminder.plan.id)) {
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

    writeNotifiedIds([...notifiedIds, reminder.plan.id]);
    return true;
  } catch {
    return false;
  }
}
