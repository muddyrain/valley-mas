import { describe, expect, it } from 'vitest';
import type { AiAction } from '@/types';
import {
  filterAiActions,
  filterAssistantMessages,
  getAiActionMeta,
  groupAssistantMessagesByDate,
  normalizeAiActionRecord,
} from './aiHistory';

const messages = [
  {
    id: 'user-1',
    role: 'user' as const,
    content: '帮我安排晚餐',
    createdAt: '2026-06-08T10:00:00.000Z',
  },
  {
    id: 'assistant-1',
    role: 'assistant' as const,
    content: '可以，建议先用掉冰箱里的番茄。',
    createdAt: '2026-06-08T10:01:00.000Z',
  },
  {
    id: 'user-2',
    role: 'user' as const,
    content: '周末提醒我买牛奶',
    createdAt: '2026-06-07T10:00:00.000Z',
  },
];

const actions: AiAction[] = [
  { id: 'action-1', title: '生成了库存优先智能菜谱', timeLabel: '刚刚' },
  { id: 'action-2', title: '生活助理创建了「买牛奶」计划', timeLabel: '10 分钟前' },
  { id: 'action-3', title: '分析了晚餐照片', timeLabel: '昨天' },
];

describe('ai history helpers', () => {
  it('filters assistant messages by content and keeps role matches', () => {
    expect(filterAssistantMessages(messages, '番茄')).toEqual([messages[1]]);
    expect(filterAssistantMessages(messages, '你')).toEqual([messages[0], messages[2]]);
    expect(filterAssistantMessages(messages, ' LIFE ')).toEqual([messages[1]]);
  });

  it('groups filtered assistant messages by display date', () => {
    const groups = groupAssistantMessagesByDate(
      messages,
      '牛奶',
      new Date('2026-06-20T10:00:00.000Z'),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe('2026/06/07');
    expect(groups[0]?.messages).toEqual([messages[2]]);
  });

  it('classifies and filters AI actions', () => {
    const [pantryAction, planAction, imageAction] = actions;
    if (!pantryAction || !planAction || !imageAction) {
      throw new Error('missing action fixture');
    }

    expect(getAiActionMeta(pantryAction).label).toBe('Pantry');
    expect(getAiActionMeta(planAction).label).toBe('计划');
    expect(getAiActionMeta(imageAction).label).toBe('图片');
    expect(filterAiActions(actions, '牛奶')).toEqual([actions[1]]);
    expect(filterAiActions(actions, 'pantry')).toEqual([actions[0]]);
  });

  it('normalizes cloud AI actions for the archive UI', () => {
    expect(
      normalizeAiActionRecord({
        id: 'cloud-1',
        title: '  生成了今日生活建议  ',
        actionType: 'advice',
        createdAt: '2026-06-08T10:00:00.000Z',
      }),
    ).toEqual({
      id: 'cloud-1',
      title: '生成了今日生活建议',
      actionType: 'advice',
      createdAt: '2026-06-08T10:00:00.000Z',
      timeLabel: '06/08 18:00',
    });

    expect(normalizeAiActionRecord({ id: 'cloud-2', title: '', timeLabel: '刚刚' }).title).toBe(
      '记录了一次生活操作',
    );
  });
});
