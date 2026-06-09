import type { InboxItem, NewPlanInput, NewTraceInput } from '@/types';

function getDefaultPlanTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  return date.toTimeString().slice(0, 5);
}

function getDefaultTraceTimeLabel() {
  const time = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `今天 ${time}`;
}

function getInboxDisplayTitle(item: InboxItem) {
  return item.aiTitle?.trim() || item.title;
}

function getInboxDisplaySummary(item: InboxItem) {
  return item.aiSummary?.trim() || [item.content, item.linkUrl].filter(Boolean).join('\n');
}

function getInboxDisplayTags(item: InboxItem) {
  return item.aiTags?.length ? item.aiTags : item.tags;
}

export function buildInboxPlanDraft(item: InboxItem): Partial<NewPlanInput> {
  return {
    title: getInboxDisplayTitle(item),
    type: '普通事项',
    timeLabel: `今天 ${getDefaultPlanTime()}`,
    reminder: true,
    imageUrl: item.imageUrl,
    note: getInboxDisplaySummary(item),
    source: 'manual',
  };
}

export function buildInboxTraceDraft(item: InboxItem): Partial<NewTraceInput> {
  const summary = getInboxDisplaySummary(item);
  return {
    title: getInboxDisplayTitle(item),
    summary: summary || getInboxDisplayTitle(item),
    timeLabel: getDefaultTraceTimeLabel(),
    imageUrl: item.imageUrl,
    mood: '放松',
    tags: getInboxDisplayTags(item).length ? getInboxDisplayTags(item) : ['生活迹'],
    source: '手动',
  };
}

export function applyInboxAISuggestion(item: InboxItem): InboxItem {
  return {
    ...item,
    title: getInboxDisplayTitle(item),
    content: item.aiSummary?.trim() || item.content,
    tags: getInboxDisplayTags(item),
  };
}
