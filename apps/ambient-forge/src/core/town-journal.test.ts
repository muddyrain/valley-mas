import { describe, expect, it } from 'vitest';
import { appendTownJournalEntry, createTownJournalState } from './town-journal';

describe('town journal', () => {
  it('按最新优先记录本局故事且不修改旧状态', () => {
    const initial = createTownJournalState();
    const entered = appendTownJournalEntry(initial, {
      kind: 'control',
      title: '岚进入小镇',
      detail: '开始步行探索',
      time: '08:15',
    });
    const delivered = appendTownJournalEntry(entered, {
      kind: 'event-stage',
      title: '温室补给送达',
      detail: '港口补给 · 2/4',
      time: '08:18',
    });

    expect(initial.entries).toEqual([]);
    expect(delivered.entries.map((entry) => entry.title)).toEqual(['温室补给送达', '岚进入小镇']);
    expect(delivered.entries[0]).toMatchObject({ id: 'journal-2', kind: 'event-stage' });
  });

  it('限制本局日志数量以保持控制面板简洁', () => {
    let state = createTownJournalState();
    for (let index = 0; index < 12; index += 1) {
      state = appendTownJournalEntry(
        state,
        {
          kind: 'event-stage',
          title: `事件 ${index}`,
          detail: '已完成',
          time: '12:00',
        },
        8,
      );
    }

    expect(state.entries).toHaveLength(8);
    expect(state.entries[0]?.title).toBe('事件 11');
    expect(state.entries.at(-1)?.title).toBe('事件 4');
  });
});
