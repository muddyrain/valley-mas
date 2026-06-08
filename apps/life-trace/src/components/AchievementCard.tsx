import {
  AlarmClockCheck,
  Archive,
  BookOpenText,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Footprints,
  History,
  Image,
  ImagePlus,
  Leaf,
  type LucideIcon,
  MessageCircle,
  PackagePlus,
  ScanBarcode,
  Sparkles,
  SunMedium,
  Users,
  Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  achievementCategoryLabels,
  achievementRarityLabels,
  getAchievementProgressMeta,
} from '@/lib/achievements';
import { cn } from '@/lib/utils';
import type { Achievement, AchievementRarity } from '@/types';

const achievementIcons: Record<string, LucideIcon> = {
  'alarm-clock-check': AlarmClockCheck,
  archive: Archive,
  'book-open-text': BookOpenText,
  'calendar-days': CalendarDays,
  'calendar-plus': CalendarPlus,
  'check-circle-2': CheckCircle2,
  'chef-hat': ChefHat,
  'clipboard-list': ClipboardList,
  footprints: Footprints,
  history: History,
  image: Image,
  'image-plus': ImagePlus,
  leaf: Leaf,
  'message-circle': MessageCircle,
  'package-plus': PackagePlus,
  'scan-barcode': ScanBarcode,
  sparkles: Sparkles,
  'sun-medium': SunMedium,
  users: Users,
  utensils: Utensils,
};

export function getAchievementIcon(icon: string): LucideIcon {
  return achievementIcons[icon] ?? Sparkles;
}

const unlockedRarityStyles: Record<
  AchievementRarity,
  {
    card: string;
    rail: string;
    icon: string;
    rarityText: string;
  }
> = {
  common: {
    card: 'border-life-ai/30 bg-card shadow-[0_14px_42px_rgba(6,182,212,0.07)]',
    rail: 'bg-life-ai/65',
    icon: 'border-life-ai/20 bg-life-ai/10 text-life-ai',
    rarityText: 'text-muted-foreground',
  },
  rare: {
    card: 'border-life-health/35 bg-card shadow-[0_14px_42px_rgba(245,158,11,0.08)]',
    rail: 'bg-life-health/70',
    icon: 'border-life-health/25 bg-life-health/10 text-life-health',
    rarityText: 'text-life-health',
  },
  epic: {
    card: 'border-life-plan/35 bg-card shadow-[0_14px_42px_rgba(139,92,246,0.1)]',
    rail: 'bg-life-plan/70',
    icon: 'border-life-plan/25 bg-life-plan/10 text-life-plan',
    rarityText: 'text-life-plan',
  },
};

type AchievementCardProps = {
  achievement: Achievement;
  compact?: boolean;
  className?: string;
};

export function AchievementCard({ achievement, compact = false, className }: AchievementCardProps) {
  const Icon = getAchievementIcon(achievement.icon);
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
        <div
          className={cn(
            'grid shrink-0 place-items-center rounded-2xl border',
            compact ? 'size-10' : 'size-12',
            achievement.unlocked
              ? unlockedStyle.icon
              : 'border-border bg-card/70 text-muted-foreground',
          )}
        >
          <Icon className={compact ? 'size-4' : 'size-5'} />
        </div>
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
        </div>
      </div>
    </Card>
  );
}
