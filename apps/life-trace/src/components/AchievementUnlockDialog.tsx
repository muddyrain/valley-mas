import { X } from 'lucide-react';
import { useEffect } from 'react';
import { getAchievementIcon } from '@/components/AchievementCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { achievementCategoryLabels, achievementRarityLabels } from '@/lib/achievements';
import type { Achievement } from '@/types';

type AchievementUnlockDialogProps = {
  achievement: Achievement;
  extraCount?: number;
  onClose: () => void;
  onOpenAchievements: () => void;
};

function formatUnlockedAt(value?: string) {
  if (!value) {
    return '刚刚解锁';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚解锁';
  }

  return `${date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })} ${date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })} 解锁`;
}

export function AchievementUnlockDialog({
  achievement,
  extraCount = 0,
  onClose,
  onOpenAchievements,
}: AchievementUnlockDialogProps) {
  const Icon = getAchievementIcon(achievement.icon);
  const unlockedAtText = formatUnlockedAt(achievement.unlockedAt);
  const progressText =
    achievement.target > 1 ? `${achievement.progress}/${achievement.target}` : '已收集';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-background/72 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-6 backdrop-blur-sm sm:items-center sm:pb-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievement-unlock-title"
        className="relative w-full max-w-[430px] overflow-hidden rounded-2xl border border-life-health/45 bg-zinc-950 text-white shadow-[0_24px_72px_rgba(0,0,0,0.58),0_0_42px_rgba(245,158,11,0.22)] animate-[life-achievement-toast_320ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
        data-achievement-unlock-dialog
      >
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health to-transparent"
        />
        <button
          type="button"
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="关闭成就"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-life-health/45 bg-life-health/15 text-life-health shadow-[0_0_34px_rgba(245,158,11,0.28)]">
              <Icon className="size-7" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <Badge tone="health">成就已解锁</Badge>
              <h2
                id="achievement-unlock-title"
                className="mt-3 text-xl font-semibold leading-snug text-white"
              >
                {achievement.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/70">{achievement.description}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <AchievementUnlockMeta
              label="类别"
              value={achievementCategoryLabels[achievement.category]}
            />
            <AchievementUnlockMeta
              label="稀有度"
              value={achievementRarityLabels[achievement.rarity]}
            />
            <AchievementUnlockMeta label="进度" value={progressText} />
          </div>

          {achievement.aiComment ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/75">
              {achievement.aiComment}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
            <span>{unlockedAtText}</span>
            {extraCount > 0 ? <span>另外 {extraCount} 枚也已收集</span> : null}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="w-full sm:flex-1" onClick={onOpenAchievements}>
              查看成就页
            </Button>
            <Button type="button" variant="outline" className="w-full sm:flex-1" onClick={onClose}>
              收好
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AchievementUnlockMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] font-medium text-white/50">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
