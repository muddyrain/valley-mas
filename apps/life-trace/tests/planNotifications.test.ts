import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPlanNotificationRecord,
  hasPlanNotificationRecord,
  showPlanReminderNotification,
} from '../src/lib/planNotifications';
import type { DueReminder } from '../src/lib/planReminder';
import type { Plan } from '../src/types';

const createStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
  };
};

const plan: Plan = {
  id: 'plan-1',
  title: '预约取车',
  type: '普通事项',
  timeLabel: '今天 18:30',
  scheduledDate: '2026-06-01',
  scheduledTime: '18:30',
  reminder: true,
  note: '',
  completed: false,
};

function createReminder(dueAt: Date): DueReminder {
  return {
    plan,
    dueAt,
    dateText: '今天',
    timeText: '18:30',
  };
}

describe('plan notification records', () => {
  beforeEach(() => {
    const localStorage = createStorage();
    const Notification = {
      permission: 'granted',
    };
    const navigator = {
      serviceWorker: {
        ready: Promise.resolve({
          showNotification: vi.fn().mockResolvedValue(undefined),
        }),
      },
    };

    vi.stubGlobal('window', {
      isSecureContext: true,
      localStorage,
      Notification,
    });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('Notification', Notification);
    vi.stubGlobal('navigator', navigator);
  });

  it('records notified reminders by plan and due time', async () => {
    const first = createReminder(new Date(2026, 5, 1, 18, 30, 0));
    const second = createReminder(new Date(2026, 5, 1, 19, 0, 0));

    expect(hasPlanNotificationRecord(first)).toBe(false);
    expect(await showPlanReminderNotification(first)).toBe(true);
    expect(hasPlanNotificationRecord(first)).toBe(true);
    expect(hasPlanNotificationRecord(second)).toBe(false);
  });

  it('clears all notification records for a plan', async () => {
    const first = createReminder(new Date(2026, 5, 1, 18, 30, 0));
    const second = createReminder(new Date(2026, 5, 1, 19, 0, 0));

    await showPlanReminderNotification(first);
    await showPlanReminderNotification(second);
    clearPlanNotificationRecord(plan.id);

    expect(hasPlanNotificationRecord(first)).toBe(false);
    expect(hasPlanNotificationRecord(second)).toBe(false);
  });
});
