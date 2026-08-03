import { describe, expect, it, vi } from 'vitest';
import {
  getAIAppSettingsPath,
  getConversationActivityKey,
  hasAssistantMessageForRun,
  hasTerminalConversationRun,
  isConversationUserMessagePending,
  mergePersistedConversationMessages,
  modelSupportsImageUnderstanding,
  orderConversationMessages,
  replaceOptimisticConversationMessage,
  scrollConversationToLatest,
  shouldShowActiveConversationTask,
  shouldShowMessageWaitingIndicator,
} from './conversationView';

describe('AI app conversation view', () => {
  it('links configuration actions to the full agent editor', () => {
    expect(getAIAppSettingsPath('agent-1')).toBe('/workbench/apps/agent-1/settings');
  });

  it('positions a loaded conversation at its latest content', () => {
    const scrollTo = vi.fn();

    scrollConversationToLatest({ scrollHeight: 1280, scrollTo });

    expect(scrollTo).toHaveBeenCalledWith({ top: 1280, behavior: 'auto' });
  });

  it('keeps each assistant result with the user turn that created it', () => {
    const messages = [
      { id: 'user-summer', role: 'user', runId: 'run-summer' },
      { id: 'user-spring', role: 'user', runId: 'run-spring' },
      { id: 'assistant-summer', role: 'assistant', runId: 'run-summer' },
    ];

    expect(orderConversationMessages(messages).map((message) => message.id)).toEqual([
      'user-summer',
      'assistant-summer',
      'user-spring',
    ]);
  });

  it('replaces an optimistic message without moving it behind later messages', () => {
    const messages = [
      { id: 'local-summer', content: '夏天' },
      { id: 'local-spring', content: '春天' },
    ];

    expect(
      replaceOptimisticConversationMessage(messages, 'local-summer', {
        id: 'server-summer',
        content: '夏天',
      }),
    ).toEqual([
      { id: 'server-summer', content: '夏天' },
      { id: 'local-spring', content: '春天' },
    ]);
  });

  it('keeps unresolved optimistic messages when a polling snapshot is older', () => {
    const persistedMessages = [
      { id: 'server-summer', conversationId: 'conversation-1', content: '夏天' },
    ];
    const currentMessages = [
      ...persistedMessages,
      { id: 'local-user-spring', conversationId: 'conversation-1', content: '春天' },
      { id: 'local-user-other', conversationId: 'conversation-2', content: '其他会话' },
    ];

    expect(
      mergePersistedConversationMessages(persistedMessages, currentMessages, 'conversation-1'),
    ).toEqual([
      { id: 'server-summer', conversationId: 'conversation-1', content: '夏天' },
      { id: 'local-user-spring', conversationId: 'conversation-1', content: '春天' },
    ]);
  });

  it('collapses a persisted user message with its still-visible optimistic copy', () => {
    const persistedMessages = [
      {
        id: 'server-summer',
        conversationId: 'conversation-1',
        role: 'user',
        content: '夏天',
        createdAt: '2026-08-02T14:49:00.200Z',
      },
    ];
    const currentMessages = [
      {
        id: 'local-user-summer',
        conversationId: 'conversation-1',
        role: 'user',
        content: '夏天',
        createdAt: '2026-08-02T14:49:00.000Z',
      },
    ];

    expect(
      mergePersistedConversationMessages(persistedMessages, currentMessages, 'conversation-1'),
    ).toEqual(persistedMessages);
  });

  it('does not collapse repeated optimistic messages beyond persisted matches', () => {
    const persistedMessages = [
      {
        id: 'server-hello',
        conversationId: 'conversation-1',
        role: 'user',
        content: '你好',
        createdAt: '2026-08-02T14:49:00.100Z',
      },
    ];
    const currentMessages = [
      {
        id: 'local-user-hello-1',
        conversationId: 'conversation-1',
        role: 'user',
        content: '你好',
        createdAt: '2026-08-02T14:49:00.000Z',
      },
      {
        id: 'local-user-hello-2',
        conversationId: 'conversation-1',
        role: 'user',
        content: '你好',
        createdAt: '2026-08-02T14:49:00.500Z',
      },
    ];

    expect(
      mergePersistedConversationMessages(persistedMessages, currentMessages, 'conversation-1'),
    ).toEqual([persistedMessages[0], currentMessages[1]]);
  });

  it('keeps newer persisted client messages when an older request returns an empty snapshot', () => {
    const currentMessages = [
      { id: 'server-summer', conversationId: 'conversation-1', content: '夏天' },
      { id: 'server-spring', conversationId: 'conversation-1', content: '春天' },
    ];

    expect(mergePersistedConversationMessages([], currentMessages, 'conversation-1')).toEqual(
      currentMessages,
    );
  });

  it('restores a persisted message if a stale refresh already removed its optimistic copy', () => {
    expect(
      replaceOptimisticConversationMessage(
        [{ id: 'server-summer', content: '夏天' }],
        'local-spring',
        { id: 'server-spring', content: '春天' },
      ),
    ).toEqual([
      { id: 'server-summer', content: '夏天' },
      { id: 'server-spring', content: '春天' },
    ]);
  });

  it('changes the activity key for new messages and streamed task output', () => {
    const task = {
      id: 'task-1',
      status: 'running',
      statusMessage: '正在思考',
      partialOutput: '',
    };
    const initial = getConversationActivityKey(
      [{ id: 'message-1', content: '问题' }],
      [task],
      0,
      false,
    );
    const streaming = getConversationActivityKey(
      [{ id: 'message-1', content: '问题' }],
      [{ ...task, partialOutput: '正在回答' }],
      0,
      false,
    );
    const completed = getConversationActivityKey(
      [
        { id: 'message-1', content: '问题' },
        { id: 'message-2', content: '完整回答' },
      ],
      [],
      0,
      false,
    );

    expect(streaming).not.toBe(initial);
    expect(completed).not.toBe(streaming);
  });

  it('lets the persisted assistant message override a stale running task snapshot', () => {
    const messages = [{ role: 'assistant', runId: 'run-1' }];

    expect(hasAssistantMessageForRun(messages, 'run-1')).toBe(true);
    expect(shouldShowActiveConversationTask({ status: 'running', runId: 'run-1' }, messages)).toBe(
      false,
    );
  });

  it('lets a terminal run override a stale active task snapshot', () => {
    expect(hasTerminalConversationRun({ status: 'failed' })).toBe(true);
    expect(hasTerminalConversationRun({ status: 'cancelled' })).toBe(true);
    expect(hasTerminalConversationRun({ status: 'succeeded' })).toBe(true);
    expect(hasTerminalConversationRun({ status: 'running' })).toBe(false);
    expect(hasTerminalConversationRun(undefined)).toBe(false);
  });

  it('only shows queue state for tasks that really exceed the concurrent limit', () => {
    expect(
      shouldShowActiveConversationTask({ status: 'queued', queuePosition: 0, runId: 'run-1' }, []),
    ).toBe(false);
    expect(
      shouldShowActiveConversationTask({ status: 'queued', queuePosition: 1, runId: 'run-2' }, []),
    ).toBe(true);
  });

  it('does not mark the first immediate message as waiting', () => {
    expect(
      shouldShowMessageWaitingIndicator({
        hasEarlierPendingMessage: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMessageWaitingIndicator({
        taskStatus: 'queued',
        queuePosition: 0,
        hasEarlierPendingMessage: false,
      }),
    ).toBe(false);
  });

  it('marks only messages that really wait behind earlier work', () => {
    expect(
      shouldShowMessageWaitingIndicator({
        hasEarlierPendingMessage: true,
      }),
    ).toBe(true);
    expect(
      shouldShowMessageWaitingIndicator({
        hasEarlierPendingMessage: true,
      }),
    ).toBe(true);
    expect(
      shouldShowMessageWaitingIndicator({
        taskStatus: 'queued',
        queuePosition: 0,
        hasEarlierPendingMessage: true,
      }),
    ).toBe(true);
    expect(
      shouldShowMessageWaitingIndicator({
        taskStatus: 'running',
        queuePosition: 1,
        hasEarlierPendingMessage: true,
      }),
    ).toBe(false);
  });

  it('treats a missing task snapshot as pending until a terminal state or answer is known', () => {
    expect(
      isConversationUserMessagePending({
        isLocalPending: false,
        hasAssistantMessage: false,
      }),
    ).toBe(true);
    expect(
      isConversationUserMessagePending({
        isLocalPending: false,
        hasAssistantMessage: false,
        taskStatus: 'failed',
      }),
    ).toBe(false);
    expect(
      isConversationUserMessagePending({
        isLocalPending: false,
        hasAssistantMessage: true,
        runStatus: 'running',
      }),
    ).toBe(false);
  });

  it('only accepts a conversation model whose vision capability is verified', () => {
    expect(
      modelSupportsImageUnderstanding({
        capabilities: ['text', 'vision'],
        verifiedCapabilities: ['text'],
      }),
    ).toBe(false);
    expect(
      modelSupportsImageUnderstanding({
        capabilities: ['text', 'vision'],
        verifiedCapabilities: ['text', 'vision'],
      }),
    ).toBe(true);
  });
});
