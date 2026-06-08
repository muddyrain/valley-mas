import { Share2 } from 'lucide-react';
import { AchievementBadgeIcon } from '@/components/AchievementBadgeIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { shareAchievementCard } from '@/lib/achievementShareCard';
import {
  achievementCategoryLabels,
  achievementRarityLabels,
  getAchievementProgressMeta,
} from '@/lib/achievements';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { Achievement, AchievementRarity } from '@/types';

const unlockedRarityStyles: Record<
  AchievementRarity,
  {
    card: string;
    rail: string;
    rarityText: string;
  }
> = {
  common: {
    card: 'border-life-ai/30 bg-card shadow-[0_14px_42px_rgba(6,182,212,0.07)]',
    rail: 'bg-life-ai/65',
    rarityText: 'text-muted-foreground',
  },
  rare: {
    card: 'border-life-health/35 bg-card shadow-[0_14px_42px_rgba(245,158,11,0.08)]',
    rail: 'bg-life-health/70',
    rarityText: 'text-life-health',
  },
  epic: {
    card: 'border-life-plan/35 bg-card shadow-[0_14px_42px_rgba(139,92,246,0.1)]',
    rail: 'bg-life-plan/70',
    rarityText: 'text-life-plan',
  },
};

type AchievementCardProps = {
  achievement: Achievement;
  compact?: boolean;
  className?: string;
};

export function AchievementCard({ achievement, compact = false, className }: AchievementCardProps) {
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const unlockedStyle = unlockedRarityStyles[achievement.rarity];
  const progressMeta = getAchievementProgressMeta(achievement);
  const progressText =
    achievement.unlocked && achievement.target > 1 ? progressMeta.label : undefined;
  const unlockedDate = achievement.unlockedAt
    ? new Date(achievement.unlockedAt).toLocaleDateString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
      })
    : '';
  const handleShare = async () => {
    try {
      const result = await shareAchievementCard(achievement);
      showToast(result === 'shared' ? '分享面板已打开' : '成就分享卡已下载', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '分享卡生成失败，请稍后再试', 'error');
    }
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-4 transition-colors',
        achievement.unlocked ? unlockedStyle.card : 'border-border bg-secondary/25',
        compact && 'p-3',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-4 top-0 h-px',
          achievement.unlocked ? unlockedStyle.rail : 'bg-muted-foreground/24',
        )}
      />
      <div className="flex items-start gap-3">
        <AchievementBadgeIcon achievement={achievement} size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={achievement.unlocked ? achievement.tone : 'default'}>
              {achievement.unlocked ? '已收集' : '待收集'}
            </Badge>
            <span className="text-xs font-medium text-muted-foreground">
              {achievementCategoryLabels[achievement.category]} ·
              <span className={cn('ml-1', achievement.unlocked && unlockedStyle.rarityText)}>
                {achievementRarityLabels[achievement.rarity]}
              </span>
            </span>
            {progressText ? (
              <span className="text-xs font-medium text-muted-foreground">{progressText}</span>
            ) : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {achievement.title}
          </h3>
          {!compact ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {achievement.description}
            </p>
          ) : null}
          {!compact && !achievement.unlocked ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
                <span>{progressMeta.label}</span>
                {progressMeta.showBar ? <span>{progressMeta.percent}%</span> : null}
              </div>
              {progressMeta.showBar ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-life-ai/55"
                    style={{ width: `${progressMeta.percent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {achievement.unlocked && unlockedDate ? (
            <p className="mt-2 text-xs font-medium text-life-ai/90">{unlockedDate} 解锁</p>
          ) : null}
          {achievement.unlocked && !compact ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-8 gap-1.5 px-3 text-xs"
              onClick={() => void handleShare()}
            >
              <Share2 className="size-3.5" />
              分享成就
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
