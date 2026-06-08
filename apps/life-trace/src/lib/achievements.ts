import type { Achievement, AchievementCategory, AchievementRarity } from '@/types';

export const achievementCategoryOptions: Array<{
  value: AchievementCategory | 'all';
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'plan', label: '计划' },
  { value: 'trace', label: '踪迹' },
  { value: 'pantry', label: '库存' },
  { value: 'ai', label: 'AI' },
  { value: 'family', label: '家庭' },
];

export const achievementCategoryLabels: Record<AchievementCategory, string> = {
  plan: '计划',
  trace: '踪迹',
  pantry: '库存',
  ai: 'AI',
  family: '家庭',
};

export const achievementRarityLabels: Record<AchievementRarity, string> = {
  common: '日常',
  rare: '少见',
  epic: '稀有',
};

export function normalizeAchievement(item: Achievement): Achievement {
  const target = Number.isFinite(item.target) && item.target > 0 ? item.target : 1;
  const progress = Number.isFinite(item.progress) && item.progress > 0 ? item.progress : 0;
  return {
    ...item,
    hidden: Boolean(item.hidden),
    unlocked: Boolean(item.unlocked),
    progress: Math.min(progress, target),
    target,
  };
}

export function getAchievementProgressMeta(item: Achievement) {
  const achievement = normalizeAchievement(item);
  const percent = Math.round((achievement.progress / achievement.target) * 100);

  if (achievement.unlocked) {
    return {
      label: achievement.target > 1 ? `${achievement.progress}/${achievement.target}` : '已收集',
      percent: 100,
      showBar: false,
    };
  }

  if (achievement.target > 1) {
    return {
      label: `已经靠近 ${achievement.progress}/${achievement.target}`,
      percent,
      showBar: true,
    };
  }

  return {
    label: '等一次生活证据',
    percent: 0,
    showBar: false,
  };
}

export function filterAchievements(
  achievements: Achievement[],
  category: AchievementCategory | 'all',
) {
  if (category === 'all') {
    return achievements;
  }
  return achievements.filter((achievement) => achievement.category === category);
}

export function findNewlyUnlockedAchievements(previous: Achievement[], next: Achievement[]) {
  const previousUnlocked = new Set(
    previous.filter((achievement) => achievement.unlocked).map((achievement) => achievement.code),
  );
  return next.filter(
    (achievement) => achievement.unlocked && !previousUnlocked.has(achievement.code),
  );
}
