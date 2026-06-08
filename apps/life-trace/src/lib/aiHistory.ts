import type { AiAction } from '@/types';

export type AiActionRecord = {
  id?: string;
  title?: string;
  timeLabel?: string;
  actionType?: string;
  createdAt?: string;
};

export type AssistantHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

export type AssistantHistoryGroup<T extends AssistantHistoryMessage = AssistantHistoryMessage> = {
  label: string;
  messages: T[];
};

export type AiActionMeta = {
  label: '计划' | 'Pantry' | '图片' | '回顾' | '对话';
  tone: 'ai' | 'plan' | 'trace' | 'health';
};

export function formatAiActionTimeLabel(createdAt?: string, fallback = '刚刚') {
  if (!createdAt) {
    return fallback;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function normalizeAiActionRecord(record: AiActionRecord): AiAction {
  return {
    id: record.id?.trim() || `ai-action-${record.createdAt || Date.now()}`,
    title: record.title?.trim() || '记录了一次生活操作',
    timeLabel: record.timeLabel?.trim() || formatAiActionTimeLabel(record.createdAt),
    actionType: record.actionType?.trim() || 'general',
    createdAt: record.createdAt,
  };
}

export function getAssistantMessageDate(message: AssistantHistoryMessage) {
  if (message.createdAt) {
    const date = new Date(message.createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const timestamp = message.id.match(/(?:user|assistant)-(\d+)/)?.[1];
  if (timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

export function getAssistantHistoryGroupLabel(message: AssistantHistoryMessage, now = new Date()) {
  const date = getAssistantMessageDate(message);
  if (!date) {
    return '更早';
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfMessageDay) / 86400000);

  if (dayDiff === 0) {
    return '今天';
  }
  if (dayDiff === 1) {
    return '昨天';
  }
  if (dayDiff < 7) {
    return `${dayDiff} 天前`;
  }
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function filterAssistantMessages<T extends AssistantHistoryMessage>(
  messages: T[],
  keyword: string,
) {
  const query = keyword.trim().toLowerCase();
  if (!query) {
    return messages;
  }

  return messages.filter((message) => {
    const roleText = message.role === 'user' ? '你 用户 user' : 'Life AI 生活助理 assistant';
    return `${roleText} ${message.content}`.toLowerCase().includes(query);
  });
}

export function groupAssistantMessagesByDate<T extends AssistantHistoryMessage>(
  messages: T[],
  keyword = '',
  now = new Date(),
) {
  const groups: AssistantHistoryGroup<T>[] = [];

  for (const message of filterAssistantMessages(messages, keyword)) {
    const label = getAssistantHistoryGroupLabel(message, now);
    const latestGroup = groups[groups.length - 1];
    if (latestGroup?.label === label) {
      latestGroup.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }

  return groups;
}

export function getAiActionMeta(action: AiAction): AiActionMeta {
  if (/Pantry|库存|菜谱|商品|入库|识别/.test(action.title)) {
    return { label: 'Pantry', tone: 'health' };
  }
  if (/计划|安排/.test(action.title)) {
    return { label: '计划', tone: 'plan' };
  }
  if (/图片|照片|拍照/.test(action.title)) {
    return { label: '图片', tone: 'trace' };
  }
  if (/回顾|周报/.test(action.title)) {
    return { label: '回顾', tone: 'health' };
  }
  return { label: '对话', tone: 'ai' };
}

export function filterAiActions(actions: AiAction[], keyword: string) {
  const query = keyword.trim().toLowerCase();
  if (!query) {
    return actions;
  }

  return actions.filter((action) => {
    const meta = getAiActionMeta(action);
    return `${meta.label} ${action.title} ${action.timeLabel}`.toLowerCase().includes(query);
  });
}
