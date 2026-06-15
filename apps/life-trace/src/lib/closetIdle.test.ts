import { describe, expect, it } from 'vitest';
import type { ClosetItemWearStats } from '@/api/closet';
import {
  buildClosetOrganizePlanInput,
  getClosetIdleLabel,
  isClosetItemIdle,
} from '@/lib/closetIdle';
import type { ClosetItem } from '@/types';

const baseItem: ClosetItem = {
  id: 'closet-1',
  name: '米色风衣',
  category: '外套',
  color: '米色',
  warmthLevel: '常规',
  seasons: ['春', '秋'],
  sceneTags: ['日常'],
  status: 'active',
  shared: false,
  note: '',
};

describe('closetIdle', () => {
  it('identifies idle items and formats label', () => {
    const stats: ClosetItemWearStats = {
      wornCount: 1,
      lastWornDate: '2026-05-01',
      idleDays: 45,
      idleLevel: 'idle',
    };

    expect(isClosetItemIdle(stats)).toBe(true);
    expect(getClosetIdleLabel(stats)).toBe('45 天未穿');
  });

  it('builds an organize reminder plan from a closet item', () => {
    const plan = buildClosetOrganizePlanInput(baseItem, '2026-06-15');

    expect(plan).toMatchObject({
      title: '整理「米色风衣」',
      type: '普通事项',
      timeLabel: '今天 20:00',
      scheduledDate: '2026-06-15',
      scheduledTime: '20:00',
      reminder: true,
    });
    expect(plan.note).toContain('米色风衣');
  });
});
