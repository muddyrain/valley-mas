import { describe, expect, it } from 'vitest';
import { defaultClosetItemForm, mergeClosetAnalysisDraft } from '../src/components/ClosetItemSheet';
import type { NewClosetItemInput } from '../src/types';

describe('closet item AI draft merge', () => {
  it('fills untouched fields from the AI draft', () => {
    const draft: Partial<NewClosetItemInput> = {
      name: '碎花连衣裙',
      category: '套装',
      color: '白底彩色碎花',
      material: '棉',
      warmthLevel: '轻薄',
      seasons: ['春', '夏'],
      sceneTags: ['日常', '度假'],
      note: '轻薄碎花款，适合暖和天气。',
    };

    expect(mergeClosetAnalysisDraft(defaultClosetItemForm, draft)).toEqual({
      ...defaultClosetItemForm,
      ...draft,
    });
  });

  it('keeps fields the user already changed', () => {
    const current: NewClosetItemInput = {
      ...defaultClosetItemForm,
      name: '我的白裙',
      category: '下装',
      color: '米白',
      material: '亚麻',
      seasons: ['夏'],
      sceneTags: ['约会'],
      note: '不要覆盖备注',
    };
    const draft: Partial<NewClosetItemInput> = {
      name: '碎花连衣裙',
      category: '套装',
      color: '白底彩色碎花',
      material: '棉',
      warmthLevel: '轻薄',
      seasons: ['春', '夏'],
      sceneTags: ['日常', '度假'],
      note: '轻薄碎花款，适合暖和天气。',
    };

    expect(mergeClosetAnalysisDraft(current, draft)).toEqual({
      ...current,
      warmthLevel: '轻薄',
    });
  });
});
