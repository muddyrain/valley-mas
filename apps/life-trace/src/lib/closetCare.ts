import type { ClosetItemCareStats } from '@/api/closet';

export function isClosetItemCareDue(stats?: ClosetItemCareStats | null) {
  return stats?.careStatus === 'due' || stats?.careStatus === 'overdue';
}

export function buildClosetCareLabel(stats?: ClosetItemCareStats | null) {
  if (!stats) {
    return '';
  }
  if (stats.careStatus === 'overdue' && stats.overdueWears) {
    return `已超 ${stats.overdueWears} 次`;
  }
  if (stats.careStatus === 'due') {
    return '该洗了';
  }
  if (stats.careStatus === 'fresh' && stats.dueInWears !== undefined) {
    return `还差 ${stats.dueInWears} 次`;
  }
  return '';
}

export function buildClosetCarePayload(todayDate: string) {
  return { lastCareDate: todayDate };
}
