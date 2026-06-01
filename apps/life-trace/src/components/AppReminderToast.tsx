import { Bell, Check, Clock3, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  clearPlanNotificationRecord,
  hasPlanNotificationRecord,
  showPlanReminderNotification,
} from '@/lib/planNotifications';
import { getDueReminder, getNextReminder } from '@/lib/planReminder';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

const DISMISSED_KEY = 'life-trace-reminder-dismissed';
const SNOOZED_KEY = 'life-trace-reminder-snoozed';
const SNOOZE_MINUTES = 10;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function AppReminderToast() {
  const plans = useLifeTraceStore((state) => state.plans);
  const planCompletingById = useLifeTraceStore((state) => state.planCompletingById);
  const completePlan = useLifeTraceStore((state) => state.completePlan);
  const [now, setNow] = useState(() => new Date());
  const [dismissedPlanIds, setDismissedPlanIds] = useState<string[]>(() =>
    readJson<string[]>(DISMISSED_KEY, []),
  );
  const [snoozedUntilByPlanId, setSnoozedUntilByPlanId] = useState<Record<string, number>>(() =>
    readJson<Record<string, number>>(SNOOZED_KEY, {}),
  );

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const dueReminder = useMemo(
    () =>
      getDueReminder(plans, now, {
        ignoredPlanIds: dismissedPlanIds,
        snoozedUntilByPlanId,
      }),
    [dismissedPlanIds, now, plans, snoozedUntilByPlanId],
  );
  const nextReminder = useMemo(() => getNextReminder(plans, now), [now, plans]);

  const dismissReminder = () => {
    if (!dueReminder) {
      return;
    }

    const next = Array.from(new Set([...dismissedPlanIds, dueReminder.plan.id]));
    setDismissedPlanIds(next);
    writeJson(DISMISSED_KEY, next);
  };

  const snoozeReminder = () => {
    if (!dueReminder) {
      return;
    }

    clearPlanNotificationRecord(dueReminder.plan.id);
    const next = {
      ...snoozedUntilByPlanId,
      [dueReminder.plan.id]: Date.now() + SNOOZE_MINUTES * 60_000,
    };
    setSnoozedUntilByPlanId(next);
    writeJson(SNOOZED_KEY, next);
  };

  const completeReminder = async () => {
    if (!dueReminder) {
      return;
    }

    await completePlan(dueReminder.plan.id);
    dismissReminder();
  };

  useEffect(() => {
    if (!dueReminder) {
      return;
    }

    void showPlanReminderNotification(dueReminder);
  }, [dueReminder]);

  useEffect(() => {
    if (!nextReminder || hasPlanNotificationRecord(nextReminder)) {
      return;
    }

    const delay = nextReminder.dueAt.getTime() - Date.now();
    if (delay < 0 || delay > 2_147_483_647) {
      return;
    }

    const timer = window.setTimeout(() => {
      void showPlanReminderNotification({
        plan: nextReminder.plan,
        dueAt: nextReminder.dueAt,
        dateText: nextReminder.dateText,
        timeText: nextReminder.timeText,
      });
      setNow(new Date());
    }, delay);

    return () => window.clearTimeout(timer);
  }, [nextReminder]);

  if (!dueReminder) {
    return null;
  }

  const completing = Boolean(planCompletingById[dueReminder.plan.id]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto w-full max-w-[430px] px-4">
      <Card className="relative overflow-hidden border-life-health/30 bg-card/95 p-4 shadow-[0_18px_70px_rgba(34,197,94,0.16)] backdrop-blur">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health/80 to-transparent"
        />
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-life-health/25 bg-life-health/10 text-life-health">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="health">计划提醒</Badge>
              <button
                type="button"
                className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="关闭提醒"
                onClick={dismissReminder}
              >
                <X className="size-4" />
              </button>
            </div>
            <h2 className="mt-2 line-clamp-2 text-base font-semibold">{dueReminder.plan.title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="size-4 text-life-health" />
              {dueReminder.dateText} {dueReminder.timeText}
            </p>
            <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2 max-[360px]:grid-cols-1">
              <Button
                type="button"
                variant="ai"
                size="sm"
                disabled={completing}
                onClick={() => void completeReminder()}
              >
                {completing ? <ActionLoadingIcon tone="trace" /> : <Check className="size-4" />}
                {completing ? '完成中' : '完成'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={completing}
                onClick={snoozeReminder}
              >
                稍后
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={completing}
                onClick={dismissReminder}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
