import type {
  InboxItem,
  MediaDiaryType,
  NewMediaDiaryEntryInput,
  NewPlanInput,
  NewTraceInput,
  PlaceStatus,
} from '@/types';

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

export type InboxMediaDraft = {
  inboxItemId: string;
  mediaType: MediaDiaryType;
  status: NewMediaDiaryEntryInput['status'];
  title: string;
  note: string;
  coverUrl: string;
  tags: string[];
};

export type InboxPlaceDraft = {
  inboxItemId: string;
  name: string;
  status: PlaceStatus;
  note: string;
};

const mediaTypeHints: Array<{ pattern: RegExp; mediaType: MediaDiaryType }> = [
  {
    pattern:
      /(douban\.com\/movie|movie\.douban|imdb\.com|netflix\.com|iqiyi|youku|tv\.qq\.com|mtime)/i,
    mediaType: '电影',
  },
  { pattern: /(bilibili\.com|youtube\.com|youtu\.be)/i, mediaType: '剧集' },
  { pattern: /(spotify|music\.163\.com|qq\.com\/music|music\.apple)/i, mediaType: '音乐' },
  { pattern: /(douban\.com\/book|book\.douban|weread|read\.qq\.com)/i, mediaType: '书籍' },
  { pattern: /(bangumi\.tv|anilist\.co|anidb\.net)/i, mediaType: '动漫' },
];

function inferMediaTypeFromText(text: string): MediaDiaryType {
  for (const hint of mediaTypeHints) {
    if (hint.pattern.test(text)) {
      return hint.mediaType;
    }
  }
  return '书籍';
}

export function buildInboxMediaDraft(item: InboxItem): InboxMediaDraft {
  const haystack = [item.title, item.content ?? '', item.linkUrl ?? ''].join(' ');
  const mediaType = inferMediaTypeFromText(haystack);
  return {
    inboxItemId: item.id,
    mediaType,
    status: '想看',
    title: getInboxDisplayTitle(item),
    note: getInboxDisplaySummary(item),
    coverUrl: item.imageUrl ?? '',
    tags: getInboxDisplayTags(item),
  };
}

export function buildInboxPlaceDraft(item: InboxItem): InboxPlaceDraft {
  return {
    inboxItemId: item.id,
    name: getInboxDisplayTitle(item),
    status: 'want',
    note: getInboxDisplaySummary(item),
  };
}
