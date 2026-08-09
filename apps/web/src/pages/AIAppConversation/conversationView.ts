export function getAIAppSettingsPath(appId: string) {
  return `/workbench/apps/${appId}/settings`;
}

export function getConversationActivityKey(
  messages: ReadonlyArray<{ id: string; content: string }>,
  tasks: ReadonlyArray<{
    id: string;
    status: string;
    statusMessage: string;
    partialOutput: string;
  }>,
  toolTraceCount: number,
  creatingTask: boolean,
) {
  const latestMessage = messages[messages.length - 1];
  const taskKey = tasks
    .map((task) => `${task.id}:${task.status}:${task.statusMessage}:${task.partialOutput.length}`)
    .join('|');
  return `${latestMessage?.id || ''}:${latestMessage?.content.length || 0}:${taskKey}:${toolTraceCount}:${creatingTask}`;
}

export function scrollConversationToLatest(
  viewport: Pick<HTMLElement, 'scrollHeight' | 'scrollTo'>,
) {
  viewport.scrollTo({
    top: viewport.scrollHeight,
    behavior: 'auto',
  });
}

export function isConversationNearLatest(
  viewport: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  threshold = 96,
) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= threshold;
}

export function hasAssistantMessageForRun(
  messages: ReadonlyArray<{ role: string; runId?: string }>,
  runId: string,
) {
  return messages.some((message) => message.role === 'assistant' && message.runId === runId);
}

export function hasTerminalConversationRun(run?: { status: string } | null) {
  return run?.status === 'succeeded' || run?.status === 'failed' || run?.status === 'cancelled';
}

export function orderConversationMessages<T extends { id: string; role: string; runId?: string }>(
  messages: ReadonlyArray<T>,
) {
  const assistantsByRunId = new Map<string, T[]>();
  const userRunIds = new Set<string>();
  const lastUserIndexByRunId = new Map<string, number>();
  for (const [index, message] of messages.entries()) {
    if (message.role === 'user' && message.runId) {
      userRunIds.add(message.runId);
      lastUserIndexByRunId.set(message.runId, index);
    }
    if (message.role !== 'assistant' || !message.runId) continue;
    const items = assistantsByRunId.get(message.runId) ?? [];
    items.push(message);
    assistantsByRunId.set(message.runId, items);
  }

  const ordered: T[] = [];
  for (const [index, message] of messages.entries()) {
    if (message.role === 'assistant' && message.runId && userRunIds.has(message.runId)) continue;
    ordered.push(message);
    if (
      message.role === 'user' &&
      message.runId &&
      lastUserIndexByRunId.get(message.runId) === index
    ) {
      ordered.push(...(assistantsByRunId.get(message.runId) ?? []));
    }
  }
  return ordered;
}

export function isLastUserMessageForRun<T extends { role: string; runId?: string }>(
  messages: ReadonlyArray<T>,
  index: number,
) {
  const message = messages[index];
  if (message?.role !== 'user' || !message.runId) return false;
  return !messages
    .slice(index + 1)
    .some((candidate) => candidate.role === 'user' && candidate.runId === message.runId);
}

export function isLastMessageForRun<T extends { runId?: string }>(
  messages: ReadonlyArray<T>,
  index: number,
) {
  const runId = messages[index]?.runId;
  if (!runId) return false;
  return !messages.slice(index + 1).some((candidate) => candidate.runId === runId);
}

export function replaceOptimisticConversationMessage<T extends { id: string }>(
  messages: ReadonlyArray<T>,
  optimisticId: string,
  persistedMessage: T,
) {
  const withoutPersistedDuplicate = messages.filter(
    (message) => message.id !== persistedMessage.id,
  );
  const optimisticIndex = withoutPersistedDuplicate.findIndex(
    (message) => message.id === optimisticId,
  );
  if (optimisticIndex < 0) return [...withoutPersistedDuplicate, persistedMessage];

  return withoutPersistedDuplicate.map((message, index) =>
    index === optimisticIndex ? persistedMessage : message,
  );
}

export function retargetConversationMessageRun<T extends { id: string; runId?: string }>(
  messages: ReadonlyArray<T>,
  messageId: string,
  runId: string,
) {
  return messages.map((message) => (message.id === messageId ? { ...message, runId } : message));
}

export function mergePersistedConversationMessages<
  T extends {
    id: string;
    conversationId: string;
    role?: string;
    content?: string;
    createdAt?: string;
  },
>(persistedMessages: ReadonlyArray<T>, currentMessages: ReadonlyArray<T>, conversationId: string) {
  const persistedIds = new Set(persistedMessages.map((message) => message.id));
  const matchedOptimisticPersistedIds = new Set<string>();
  const newerCurrentMessages = currentMessages.filter((message) => {
    if (message.conversationId !== conversationId || persistedIds.has(message.id)) return false;
    if (!message.id.startsWith('local-user-')) return true;

    const optimisticCreatedAt = Date.parse(message.createdAt || '');
    const counterpart = persistedMessages.find((persisted) => {
      if (
        matchedOptimisticPersistedIds.has(persisted.id) ||
        persisted.role !== message.role ||
        persisted.content !== message.content
      ) {
        return false;
      }
      const persistedCreatedAt = Date.parse(persisted.createdAt || '');
      return (
        Number.isFinite(optimisticCreatedAt) &&
        Number.isFinite(persistedCreatedAt) &&
        Math.abs(persistedCreatedAt - optimisticCreatedAt) <= 30_000
      );
    });
    if (!counterpart) return true;
    matchedOptimisticPersistedIds.add(counterpart.id);
    return false;
  });
  return [...persistedMessages, ...newerCurrentMessages];
}

export function isConversationUserMessagePending({
  isLocalPending,
  hasAssistantMessage,
  taskStatus,
  runStatus,
}: {
  isLocalPending: boolean;
  hasAssistantMessage: boolean;
  taskStatus?: string;
  runStatus?: string;
}) {
  if (isLocalPending) return true;
  if (hasAssistantMessage) return false;
  if (taskStatus) {
    return (
      taskStatus === 'queued' ||
      taskStatus === 'running' ||
      taskStatus === 'waiting_approval' ||
      taskStatus === 'needs_input'
    );
  }
  if (runStatus) return runStatus === 'running';
  return true;
}

export type ConversationTurnPhase =
  | 'idle'
  | 'starting'
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'needs_input'
  | 'finalizing'
  | 'complete'
  | 'failed'
  | 'cancelled';

export function resolveConversationTurnPhase({
  isLocalPending,
  creatingTask,
  hasAssistantMessage,
  taskStatus,
  queuePosition = 0,
  runStatus,
  resumingClarification = false,
}: {
  isLocalPending: boolean;
  creatingTask: boolean;
  hasAssistantMessage: boolean;
  taskStatus?: string;
  queuePosition?: number;
  runStatus?: string;
  resumingClarification?: boolean;
}): ConversationTurnPhase {
  if (hasAssistantMessage) return 'complete';
  if (taskStatus === 'cancelled' || runStatus === 'cancelled') return 'cancelled';
  if (taskStatus === 'failed' || runStatus === 'failed') return 'failed';
  if (taskStatus === 'succeeded' || runStatus === 'succeeded') return 'finalizing';
  if (taskStatus === 'needs_input' && resumingClarification) return 'starting';
  if (taskStatus === 'waiting_approval') return 'waiting_approval';
  if (taskStatus === 'needs_input') return 'needs_input';
  if (taskStatus === 'queued') return queuePosition > 0 ? 'queued' : 'starting';
  if (taskStatus === 'running' || runStatus === 'running') return 'running';
  if (isLocalPending || creatingTask) return 'starting';
  return 'idle';
}

export function shouldShowTaskWaitingSummary(
  phase: ConversationTurnPhase,
  hasPendingApproval = false,
) {
  return phase === 'waiting_approval' && !hasPendingApproval;
}

export function shouldRefreshConversationDetail({
  taskStatus,
  runStatus,
  hasAssistantMessage,
}: {
  taskStatus?: string;
  runStatus?: string;
  hasAssistantMessage: boolean;
}) {
  if (hasAssistantMessage) return false;
  if (
    taskStatus === 'queued' ||
    taskStatus === 'running' ||
    taskStatus === 'waiting_approval' ||
    taskStatus === 'needs_input' ||
    taskStatus === 'succeeded'
  ) {
    return true;
  }
  if (taskStatus === 'failed' || taskStatus === 'cancelled') return !runStatus;
  return runStatus === 'running' || runStatus === 'succeeded';
}

export function shouldShowActiveConversationTask(
  task: { status: string; queuePosition?: number; runId: string },
  messages: ReadonlyArray<{ role: string; runId?: string }>,
) {
  if (hasAssistantMessageForRun(messages, task.runId)) return false;
  return task.status !== 'queued' || (task.queuePosition ?? 0) > 0;
}

export function shouldShowMessageWaitingIndicator({
  taskStatus,
  queuePosition = 0,
  hasEarlierPendingMessage,
}: {
  taskStatus?: string;
  queuePosition?: number;
  hasEarlierPendingMessage: boolean;
}) {
  if (taskStatus && taskStatus !== 'queued' && taskStatus !== 'pending') {
    return false;
  }
  if (hasEarlierPendingMessage) return true;
  return taskStatus === 'queued' && queuePosition > 0;
}

export function shouldShowMessageStartingIndicator({
  isUserMessage,
  isLocalPending,
  creatingTask,
  taskStatus,
  queuePosition = 0,
  hasEarlierPendingMessage,
  hasRenderedTaskForRun,
}: {
  isUserMessage: boolean;
  isLocalPending: boolean;
  creatingTask: boolean;
  taskStatus?: string;
  queuePosition?: number;
  hasEarlierPendingMessage: boolean;
  hasRenderedTaskForRun: boolean;
}) {
  if (!isUserMessage || hasEarlierPendingMessage || hasRenderedTaskForRun) return false;
  return isLocalPending && creatingTask ? true : taskStatus === 'queued' && queuePosition === 0;
}

export function modelSupportsImageUnderstanding(model?: {
  capabilities: string[];
  verifiedCapabilities: string[];
}) {
  return Boolean(
    model?.capabilities.includes('vision') && model.verifiedCapabilities.includes('vision'),
  );
}
