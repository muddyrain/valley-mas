import { RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AchievementCard, getAchievementIcon } from '@/components/AchievementCard';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { achievementCategoryOptions, filterAchievements } from '@/lib/achievements';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Achievement, AchievementCategory } from '@/types';

type AchievementFilter = AchievementCategory | 'all';

export function AchievementsPage() {
  const [activeFilter, setActiveFilter] = useState<AchievementFilter>('all');
  const achievements = useLifeTraceStore((state) => state.achievements);
  const achievementSummary = useLifeTraceStore((state) => state.achievementSummary);
  const recentAchievements = useLifeTraceStore((state) => state.recentAchievements);
  const achievementsLoaded = useLifeTraceStore((state) => state.achievementsLoaded);
  const achievementsLoading = useLifeTraceStore((state) => state.achievementsLoading);
  const achievementsError = useLifeTraceStore((state) => state.achievementsError);
  const loadAchievements = useLifeTraceStore((state) => state.loadAchievements);

  useEffect(() => {
    if (!achievementsLoaded && !achievementsLoading) {
      void loadAchievements();
    }
  }, [achievementsLoaded, achievementsLoading, loadAchievements]);

  const filteredAchievements = useMemo(
    () => filterAchievements(achievements, activeFilter),
    [achievements, activeFilter],
  );
  const latestAchievement = recentAchievements[0];

  return (
    <SubPageShell
      title="生活成就"
      eyebrow="Life Badges"
      fallbackBackTo="/profile"
      action={
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="刷新生活成就"
          disabled={achievementsLoading}
          onClick={() => void loadAchievements({ notifyNew: true })}
        >
          {achievementsLoading ? (
            <ActionLoadingIcon className="size-4" tone="ai" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </Button>
      }
    >
      <div className="space-y-5">
        <Card className="relative overflow-hidden border-life-ai/20 p-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-life-ai/70"
          />
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-3xl border border-life-ai/20 bg-life-ai/10 text-life-ai">
              <Sparkles className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <Badge tone="ai">生活成就</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                {achievementSummary.unlocked}/{achievementSummary.total || achievements.length} 枚
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {latestAchievement
                  ? `最近收集到「${latestAchievement.title}」。`
                  : '慢慢收集日常里的小进展。'}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <AchievementStat label="本月新增" value={achievementSummary.monthlyNew} />
            <AchievementStat label="少见成就" value={achievementSummary.rareUnlocked} />
            <AchievementStat label="已收集" value={achievementSummary.unlocked} />
          </div>
        </Card>

        {recentAchievements.length > 0 ? (
          <section>
            <SectionHeader title="最近解锁" meta={`${recentAchievements.length} 枚`} />
            <Card className="relative overflow-hidden border-life-health/20 p-4">
              <div
                aria-hidden="true"
                className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-life-health/70 to-transparent"
              />
              <div className="space-y-3">
                {recentAchievements.slice(0, 5).map((achievement, index) => (
                  <RecentAchievementItem
                    key={achievement.code}
                    achievement={achievement}
                    last={index === Math.min(recentAchievements.length, 5) - 1}
                  />
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {achievementCategoryOptions.map((option) => {
            const active = activeFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition',
                  active
                    ? 'bg-life-ai text-background shadow-[0_12px_30px_rgba(6,182,212,0.18)]'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setActiveFilter(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <section>
          <SectionHeader
            title="徽章馆"
            meta={achievementsLoading ? '同步中' : `${filteredAchievements.length} 枚`}
          />
          {achievementsError ? (
            <EmptyState
              title="生活成就暂时没同步"
              description={achievementsError}
              eyebrow="同步失败"
              tone="default"
              action={
                <Button type="button" variant="outline" onClick={() => void loadAchievements()}>
                  重新同步
                </Button>
              }
            />
          ) : achievementsLoading && achievements.length === 0 ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <Card key={item} className="h-28 animate-pulse bg-secondary/60" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredAchievements.map((achievement) => (
                <AchievementCard key={achievement.code} achievement={achievement} />
              ))}
            </div>
          )}
        </section>
      </div>
    </SubPageShell>
  );
}

function RecentAchievementItem({ achievement, last }: { achievement: Achievement; last: boolean }) {
  const Icon = getAchievementIcon(achievement.icon);
  const unlockedAt = formatRecentAchievementTime(achievement.unlockedAt);

  return (
    <div className="relative flex gap-3">
      {!last ? (
        <div
          aria-hidden="true"
          className="absolute left-5 top-11 h-[calc(100%-1.75rem)] w-px bg-border"
        />
      ) : null}
      <div className="relative grid size-10 shrink-0 place-items-center rounded-2xl border border-life-health/30 bg-life-health/10 text-life-health">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={achievement.tone}>{achievement.title}</Badge>
          <span className="text-xs font-medium text-muted-foreground">{unlockedAt}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {achievement.description}
        </p>
      </div>
    </div>
  );
}

function formatRecentAchievementTime(value?: string) {
  if (!value) {
    return '刚刚';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function AchievementStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
