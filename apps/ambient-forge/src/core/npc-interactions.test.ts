import { describe, expect, it } from 'vitest';
import { createNpcConversation, getRelationshipReaction } from './npc-interactions';

describe('npc interactions', () => {
  it('根据熟悉度生成逐级增强的居民回应', () => {
    expect(getRelationshipReaction(null)).toBe('nod');
    expect(getRelationshipReaction({ familiarity: 1, label: '面熟' })).toBe('wave');
    expect(getRelationshipReaction({ familiarity: 2, label: '熟人' })).toBe('approach');
    expect(getRelationshipReaction({ familiarity: 4, label: '老朋友' })).toBe('follow');
  });

  it('对话会结合居民工作、天气、时间和关系', () => {
    const work = createNpcConversation({
      npcId: 'gardener',
      npcName: '苔芽',
      role: '温室园丁',
      task: '恢复作物灌溉',
      routine: 'work',
      weather: 'clear',
      timeOfDay: 11,
      relation: null,
    });
    const rain = createNpcConversation({
      npcId: 'mechanic',
      npcName: '铆钉',
      role: '港口技师',
      task: '检查抛锚车辆',
      routine: 'work',
      weather: 'rain',
      timeOfDay: 16,
      relation: { familiarity: 2, label: '熟人' },
    });
    const night = createNpcConversation({
      npcId: 'ranger',
      npcName: '岩雀',
      role: '巡镇员',
      task: '返回住处休息',
      routine: 'rest',
      weather: 'clear',
      timeOfDay: 23,
      relation: { familiarity: 4, label: '老朋友' },
    });

    expect(work).toMatchObject({ relationLabel: '初次见面', gesture: 'nod' });
    expect(work.line).toContain('恢复作物灌溉');
    expect(rain).toMatchObject({ relationLabel: '熟人', gesture: 'approach' });
    expect(rain.line).toContain('雨');
    expect(night).toMatchObject({ relationLabel: '老朋友', gesture: 'follow' });
    expect(night.line).toContain('夜');
  });
});
