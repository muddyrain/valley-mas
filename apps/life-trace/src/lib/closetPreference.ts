import type { ClosetPreferenceLevel } from '@/types';

export function getClosetPreferenceLabel(level?: ClosetPreferenceLevel) {
  switch (level) {
    case 'favorite':
      return '常穿';
    case 'avoid':
      return '少穿';
    default:
      return '';
  }
}
