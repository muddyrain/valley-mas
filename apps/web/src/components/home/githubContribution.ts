export interface GithubContributionPoint {
  date: string;
  count: number;
  level: number;
}

export interface GithubContributionPayload {
  total: Record<string, number>;
  contributions: GithubContributionPoint[];
}

export interface ContributionCell {
  date: string;
  count: number;
  tone: number;
  inRange: boolean;
}

export interface ContributionOverview {
  weeks: ContributionCell[][];
  weeklyTotals: number[];
  total: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  maxDayCount: number;
  maxWeekTotal: number;
}

export const GITHUB_AUTHOR_LOGIN = 'muddyrain';

const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRIBUTION_RANGE_DAYS = 182;

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getContributionTone(count: number, maxDayCount: number) {
  if (count <= 0 || maxDayCount <= 0) return 0;
  const ratio = count / maxDayCount;
  if (ratio < 0.22) return 1;
  if (ratio < 0.46) return 2;
  if (ratio < 0.72) return 3;
  return 4;
}

export function buildContributionOverview(points: GithubContributionPoint[]): ContributionOverview {
  const map = new Map<string, number>();
  points.forEach((point) => {
    if (!point.date) return;
    map.set(point.date, Math.max(0, point.count ?? 0));
  });

  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (CONTRIBUTION_RANGE_DAYS - 1));
  const gridStart = new Date(startDate);
  gridStart.setDate(startDate.getDate() - startDate.getDay());

  const totalDays = Math.floor((endDate.getTime() - gridStart.getTime()) / DAY_MS) + 1;
  const baseDays: Array<{ date: string; count: number; inRange: boolean }> = [];

  let total = 0;
  let activeDays = 0;
  let maxDayCount = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(gridStart.getTime() + index * DAY_MS);
    const dateKey = toDateKey(date);
    const count = map.get(dateKey) ?? 0;
    const inRange = date >= startDate && date <= endDate;
    baseDays.push({ date: dateKey, count, inRange });
    if (inRange) {
      total += count;
      maxDayCount = Math.max(maxDayCount, count);
      if (count > 0) {
        activeDays += 1;
        runningStreak += 1;
        bestStreak = Math.max(bestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }
  }

  let currentStreak = 0;
  for (let index = baseDays.length - 1; index >= 0; index -= 1) {
    const day = baseDays[index];
    if (!day.inRange) continue;
    if (day.count > 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const weeks: ContributionCell[][] = [];
  const weeklyTotals: number[] = [];
  baseDays.forEach((day, index) => {
    const weekIndex = Math.floor(index / 7);
    if (!weeks[weekIndex]) {
      weeks[weekIndex] = [];
      weeklyTotals[weekIndex] = 0;
    }
    const tone = day.inRange ? getContributionTone(day.count, maxDayCount) : 0;
    weeks[weekIndex].push({
      date: day.date,
      count: day.count,
      tone,
      inRange: day.inRange,
    });
    if (day.inRange) {
      weeklyTotals[weekIndex] += day.count;
    }
  });

  return {
    weeks,
    weeklyTotals,
    total,
    activeDays,
    currentStreak,
    bestStreak,
    maxDayCount,
    maxWeekTotal: Math.max(...weeklyTotals, 0),
  };
}
