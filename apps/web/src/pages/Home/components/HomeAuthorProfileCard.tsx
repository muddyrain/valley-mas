import { ArrowRight, Github, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContributionOverview } from './githubContribution';

export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
}

interface HomeAuthorProfileCardProps {
  loadingGithubProfile: boolean;
  githubProfile: GithubProfile | null;
  loadingGithubContributions: boolean;
  contributionOverview: ContributionOverview;
}

const CONTRIBUTION_HEAT_COLORS = [
  'rgba(255,255,255,0.7)',
  'rgba(var(--theme-tertiary-rgb),0.34)',
  'rgba(var(--theme-secondary-rgb),0.42)',
  'rgba(var(--theme-primary-rgb),0.58)',
  'rgba(var(--theme-primary-rgb),0.78)',
];

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getContributionTileStyle(tone: number, inRange: boolean): CSSProperties {
  if (!inRange) {
    return {
      background: 'rgba(255,255,255,0.35)',
      borderColor: 'rgba(var(--theme-primary-rgb),0.08)',
      opacity: 0.32,
    };
  }
  return {
    background: CONTRIBUTION_HEAT_COLORS[tone] ?? CONTRIBUTION_HEAT_COLORS[0],
    borderColor:
      tone > 0 ? 'rgba(var(--theme-primary-rgb),0.32)' : 'rgba(var(--theme-primary-rgb),0.16)',
    boxShadow:
      tone > 0
        ? `0 0 0 1px rgba(var(--theme-primary-rgb),0.08), 0 5px 12px rgba(var(--theme-primary-rgb),${0.08 + tone * 0.04})`
        : 'inset 0 0 0 1px rgba(var(--theme-primary-rgb),0.06)',
  };
}

function ContributionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-theme-shell-border bg-white/86 px-3 py-2 shadow-[0_8px_20px_rgba(var(--theme-primary-rgb),0.1)]">
      <div className="text-[11px] tracking-[0.12em] text-slate-500 uppercase">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ContributionLoadingScene() {
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[16px] border border-theme-shell-border bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(var(--theme-primary-rgb),0.1))] p-3">
        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full border border-theme-shell-border/70 bg-[conic-gradient(from_0deg,rgba(var(--theme-secondary-rgb),0.2),rgba(var(--theme-primary-rgb),0.36),rgba(var(--theme-tertiary-rgb),0.26),rgba(var(--theme-secondary-rgb),0.2))] blur-[1px] animate-[spin_8s_linear_infinite]" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.12em] text-theme-primary uppercase">
              正在同步贡献信号
            </div>
            <div className="mt-1 text-sm text-slate-600">GitHub 活跃数据加载中...</div>
          </div>
          <div className="relative h-12 w-12 shrink-0">
            <div className="absolute inset-0 rounded-full border border-theme-shell-border bg-white/75" />
            <div className="absolute inset-1 rounded-full border border-theme-shell-border/70 border-t-theme-primary animate-[spin_1.6s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full bg-theme-primary/70 shadow-[0_0_16px_rgba(var(--theme-primary-rgb),0.4)] animate-pulse" />
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-theme-shell-border bg-white/88 p-3">
        <div className="grid grid-flow-col auto-cols-fr gap-1">
          {Array.from({ length: 26 }).map((_, weekIndex) => (
            <div key={`loading-week-${weekIndex}`} className="grid grid-rows-7 gap-1">
              {Array.from({ length: 7 }).map((_, dayIndex) => (
                <div
                  key={`loading-day-${weekIndex}-${dayIndex}`}
                  className="h-2.5 w-full rounded-[4px] border border-theme-shell-border/50 bg-[linear-gradient(90deg,rgba(var(--theme-primary-rgb),0.12),rgba(var(--theme-secondary-rgb),0.26),rgba(var(--theme-tertiary-rgb),0.2))] animate-[pulse_2.2s_ease-in-out_infinite]"
                  style={{ animationDelay: `${(weekIndex * 7 + dayIndex) * 0.012}s` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[16px] border border-theme-shell-border bg-white/84 p-3">
        <div className="mb-2 text-[11px] tracking-[0.08em] text-slate-500 uppercase">
          周活跃节奏
        </div>
        <div className="flex h-14 items-end gap-1">
          {Array.from({ length: 24 }).map((_, index) => {
            const height = 28 + ((index * 17) % 60);
            return (
              <div
                key={`loading-bar-${index}`}
                className="flex-1 rounded-[6px] border border-theme-shell-border/60 bg-[linear-gradient(180deg,rgba(var(--theme-secondary-rgb),0.52),rgba(var(--theme-primary-rgb),0.38))] animate-[pulse_2.4s_ease-in-out_infinite]"
                style={{ height: `${height}%`, animationDelay: `${index * 0.03}s` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function HomeAuthorProfileCard({
  loadingGithubProfile,
  githubProfile,
  loadingGithubContributions,
  contributionOverview,
}: HomeAuthorProfileCardProps) {
  return (
    <div className="rounded-[34px] border border-white/84 bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(var(--theme-primary-rgb),0.11),rgba(var(--theme-secondary-rgb),0.08))] p-5 shadow-[0_20px_60px_rgba(var(--theme-primary-rgb),0.16)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="bg-theme-soft text-theme-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
          <Github className="h-3.5 w-3.5" />
          作者介绍
        </div>
        <span className="text-xs text-slate-400">GitHub</span>
      </div>
      {loadingGithubProfile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-36 rounded-full" />
              <Skeleton className="h-4 w-48 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-20 rounded-[20px]" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-18 rounded-[16px]" />
            ))}
          </div>
        </div>
      ) : githubProfile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-theme-shell-border bg-white shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.15)]">
              <img
                src={githubProfile.avatar_url}
                alt={githubProfile.login}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-2xl font-semibold text-slate-900">
                {githubProfile.name || githubProfile.login}
              </div>
              <a
                href={githubProfile.html_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-theme-primary hover:underline"
              >
                @{githubProfile.login}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-[24px] border border-theme-shell-border bg-theme-soft p-4">
            <p className="text-sm leading-7 text-slate-600">
              {githubProfile.bio || '你好，我是一名前端开发者，热衷于探索新技术和解决问题。'}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-theme-shell-border bg-[linear-gradient(145deg,rgba(255,255,255,0.95),rgba(var(--theme-primary-rgb),0.11),rgba(var(--theme-secondary-rgb),0.08))] p-4 shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.16)]">
            <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-[conic-gradient(from_40deg,rgba(var(--theme-secondary-rgb),0.42),rgba(var(--theme-tertiary-rgb),0.28),rgba(var(--theme-primary-rgb),0.4),rgba(var(--theme-secondary-rgb),0.42))] opacity-60 blur-[2px] animate-[spin_22s_linear_infinite]" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(var(--theme-primary-rgb),0.28),transparent_68%)] blur-md" />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme-shell-border bg-white/90 px-3 py-1 text-[11px] tracking-[0.14em] text-theme-primary uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                贡献热力图谱
              </div>
              {loadingGithubContributions ? (
                <ContributionLoadingScene />
              ) : contributionOverview.weeks.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <ContributionStat label="年度贡献" value={`${contributionOverview.total}`} />
                    <ContributionStat
                      label="活跃天数"
                      value={`${contributionOverview.activeDays} 天`}
                    />
                    <ContributionStat
                      label="当前连更"
                      value={`${contributionOverview.currentStreak} 天`}
                    />
                    <ContributionStat
                      label="最长连更"
                      value={`${contributionOverview.bestStreak} 天`}
                    />
                  </div>
                  <div className="rounded-[18px] border border-theme-shell-border bg-white/88 p-3">
                    <div className="grid grid-flow-col auto-cols-fr gap-1">
                      {contributionOverview.weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="grid grid-rows-7 gap-1">
                          {week.map((day) => {
                            const parsed = parseDateKey(day.date);
                            const label = `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, '0')}-${`${parsed.getDate()}`.padStart(2, '0')}`;
                            return (
                              <div
                                key={day.date}
                                title={
                                  day.inRange
                                    ? `${label} · ${day.count} 次贡献`
                                    : `${label} · 区间外`
                                }
                                className="h-2.5 w-full rounded-[4px] border transition hover:scale-110"
                                style={getContributionTileStyle(day.tone, day.inRange)}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">统计区间：近半年公开贡献活跃度</div>
                  <div className="rounded-[16px] border border-theme-shell-border bg-white/84 p-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] tracking-[0.08em] text-slate-500 uppercase">
                      <span>周活跃节奏</span>
                      <span>峰值 {contributionOverview.maxDayCount} / 天</span>
                    </div>
                    <div className="flex h-14 items-end gap-1">
                      {contributionOverview.weeklyTotals.slice(-24).map((value, index) => {
                        const ratio =
                          contributionOverview.maxWeekTotal > 0
                            ? value / contributionOverview.maxWeekTotal
                            : 0;
                        const height = `${Math.max(12, Math.round(ratio * 100))}%`;
                        return (
                          <div
                            key={index}
                            title={`第 ${index + 1} 周 · ${value} 次贡献`}
                            className="flex-1 rounded-[6px] border border-theme-shell-border/70 bg-[linear-gradient(180deg,rgba(var(--theme-secondary-rgb),0.78),rgba(var(--theme-primary-rgb),0.62))] shadow-[0_8px_18px_rgba(var(--theme-primary-rgb),0.2)]"
                            style={{ height }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[18px] border border-theme-shell-border bg-white/84 px-4 py-5 text-sm leading-7 text-slate-600">
                  暂未拉取到可展示的公开贡献数据，稍后会自动重试。
                </div>
              )}
            </div>
          </div>

          <a
            href={githubProfile.html_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-theme-shell-border bg-white/86 px-4 py-2 text-sm text-theme-primary shadow-sm transition hover:bg-white"
          >
            访问 GitHub 主页
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-theme-shell-border bg-theme-soft p-5 text-sm leading-7 text-slate-600">
            这里会展示网站作者的 GitHub 公开资料。
          </div>
          <a
            href="https://github.com/muddyrain"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-theme-shell-border bg-white/86 px-4 py-2 text-sm text-theme-primary shadow-sm transition hover:bg-white"
          >
            打开 @muddyrain
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}
