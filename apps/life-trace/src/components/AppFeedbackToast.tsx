import { AlertTriangle, CheckCircle2, Info, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AchievementUnlockDialog } from '@/components/AchievementUnlockDialog';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { Achievement } from '@/types';

const toneClassMap = {
  success: 'border-life-trace/30 bg-card text-life-trace',
  info: 'border-life-ai/30 bg-card text-life-ai',
  warning: 'border-life-alert/30 bg-card text-life-alert',
  error: 'border-life-alert/35 bg-card text-life-alert',
} as const;

const toneIconMap = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertTriangle,
} as const;

export type AchievementToastPayload = {
  title: string;
  extraText?: string;
};

export function getAchievementToastPayload(message: string): AchievementToastPayload | null {
  const match = message.match(/^收集到「(.+?)」(?:等 (\d+) 枚)?$/);
  if (!match) {
    return null;
  }

  const totalCount = match[2] ? Number(match[2]) : 1;
  return {
    title: match[1],
    extraText: totalCount > 1 ? `另外 ${totalCount - 1} 枚也已收集` : undefined,
  };
}

export function AppFeedbackToast() {
  const current = useFeedbackToastStore((state) => state.current);
  const dismissToast = useFeedbackToastStore((state) => state.dismissToast);
  const [selectedUnlock, setSelectedUnlock] = useState<{
    achievement: Achievement;
    extraCount: number;
  } | null>(null);
  const navigate = useNavigate();

  const closeSelectedUnlock = () => setSelectedUnlock(null);
  const openAchievementsPage = () => {
    setSelectedUnlock(null);
    navigate('/achievements');
  };

  const renderToast = () => {
    if (!current) {
      return null;
    }

    const achievementToast = getAchievementToastPayload(current.message);
    if (achievementToast) {
      const canOpenDetail = Boolean(current.achievement);
      const openAchievementDetail = () => {
        if (!current.achievement) {
          return;
        }

        setSelectedUnlock({
          achievement: current.achievement,
          extraCount: current.achievementExtraCount ?? 0,
        });
        dismissToast();
      };

      return (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[70] mx-auto w-full max-w-[430px] px-4">
          <div
            className={cn(
              'pointer-events-auto relative overflow-hidden rounded-2xl border border-life-health/45 bg-zinc-950/95 p-3.5 text-white shadow-[0_18px_52px_rgba(0,0,0,0.55),0_0_34px_rgba(245,158,11,0.22)] backdrop-blur animate-[life-achievement-toast_360ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none',
              canOpenDetail && 'cursor-pointer',
            )}
            role={canOpenDetail ? 'button' : undefined}
            tabIndex={canOpenDetail ? 0 : undefined}
            onClick={canOpenDetail ? openAchievementDetail : undefined}
            onKeyDown={(event) => {
              if (!canOpenDetail || (event.key !== 'Enter' && event.key !== ' ')) {
                return;
              }
              event.preventDefault();
              openAchievementDetail();
            }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute inset-y-0 -left-1/3 w-1/3 animate-[life-shimmer_1.3s_ease-out_1] bg-gradient-to-r from-transparent via-white/10 to-transparent motion-reduce:animate-none"
            />
            <div className="relative flex items-center gap-3">
              <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl border border-life-health/40 bg-life-health/15 text-life-health shadow-[0_0_26px_rgba(245,158,11,0.34)]">
                <span className="absolute inset-0 animate-[ping_780ms_cubic-bezier(0,0,0.2,1)_1_forwards] rounded-2xl bg-life-health/20 motion-reduce:animate-none" />
                <Trophy className="relative size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-life-health">成就已解锁</p>
                <p className="mt-0.5 truncate text-base font-semibold text-white">
                  {achievementToast.title}
                </p>
                {achievementToast.extraText ? (
                  <p className="mt-0.5 text-xs text-white/60">{achievementToast.extraText}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="关闭提示"
                onClick={(event) => {
                  event.stopPropagation();
                  dismissToast();
                }}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    const Icon = toneIconMap[current.tone];

    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[70] mx-auto w-full max-w-[430px] px-4">
        <div
          className={cn(
            'pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur',
            toneClassMap[current.tone],
          )}
        >
          <Icon className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm font-medium">{current.message}</p>
          <button
            type="button"
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="关闭提示"
            onClick={dismissToast}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderToast()}
      {selectedUnlock ? (
        <AchievementUnlockDialog
          achievement={selectedUnlock.achievement}
          extraCount={selectedUnlock.extraCount}
          onClose={closeSelectedUnlock}
          onOpenAchievements={openAchievementsPage}
        />
      ) : null}
    </>
  );
}
