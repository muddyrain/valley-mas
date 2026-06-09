import { describe, expect, it } from 'vitest';
import type { InboxItem } from '@/types';
import { applyInboxAISuggestion, buildInboxPlanDraft, buildInboxTraceDraft } from './inbox';

const imageItem: InboxItem = {
  id: 'inbox-1',
  title: '晚餐照片',
  content: '朋友聚餐',
  itemType: 'image',
  imageUrl: 'https://example.com/dinner.jpg',
  tags: ['待整理'],
  status: 'inbox',
  aiTitle: '周末晚餐记录',
  aiSummary: '记录一张周末晚餐照片，适合沉淀为生活踪迹。',
  aiTags: ['晚餐', '朋友'],
  aiSuggestedType: 'trace',
};

describe('inbox helpers', () => {
  it('passes imageUrl into plan and trace drafts', () => {
    expect(buildInboxPlanDraft(imageItem)).toMatchObject({
      title: '周末晚餐记录',
      imageUrl: 'https://example.com/dinner.jpg',
      note: '记录一张周末晚餐照片，适合沉淀为生活踪迹。',
    });

    expect(buildInboxTraceDraft(imageItem)).toMatchObject({
      title: '周末晚餐记录',
      imageUrl: 'https://example.com/dinner.jpg',
      summary: '记录一张周末晚餐照片，适合沉淀为生活踪迹。',
      tags: ['晚餐', '朋友'],
    });
  });

  it('applies AI suggestions without changing conversion state', () => {
    expect(applyInboxAISuggestion(imageItem)).toMatchObject({
      id: 'inbox-1',
      title: '周末晚餐记录',
      content: '记录一张周末晚餐照片，适合沉淀为生活踪迹。',
      tags: ['晚餐', '朋友'],
      status: 'inbox',
    });
    expect(applyInboxAISuggestion(imageItem)).not.toHaveProperty('convertedType');
  });
});
