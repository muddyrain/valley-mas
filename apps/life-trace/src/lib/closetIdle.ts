import type { ClosetItemWearStats } from '@/api/closet';
import type { ClosetItem, NewPlanInput } from '@/types';

export function isClosetItemIdle(stats?: ClosetItemWearStats | null) {
  return (
    (stats?.idleLevel === 'idle' || stats?.idleLevel === 'stale') && (stats.idleDays ?? 0) >= 30
  );
}

export function getClosetIdleLabel(stats?: ClosetItemWearStats | null) {
  if (!stats?.idleDays || !isClosetItemIdle(stats)) {
    return '';
  }
  return `${stats.idleDays} 天未穿`;
}

export function buildClosetOrganizePlanInput(
  item: ClosetItem,
  scheduledDate: string,
): NewPlanInput {
  return {
    title: `整理「${item.name}」`,
    type: '普通事项',
    timeLabel: '今天 20:00',
    scheduledDate,
    scheduledTime: '20:00',
    timezone: 'Asia/Shanghai',
    reminder: true,
    location: '',
    imageUrl: item.imageUrl,
    note: `检查「${item.name}」是否需要收纳、清洗、捐赠或继续保留。`,
    source: 'manual',
  };
}
