import { describe, expect, it } from 'vitest';
import {
  getPendingClarification,
  groupConversationClarificationsByMessage,
  toClarificationToolCard,
  toToolErrorCard,
} from './interactionCards';

describe('AI app conversation interaction cards', () => {
  const clarification = {
    id: 'clarification-1',
    taskId: 'task-1',
    runId: 'run-1',
    conversationId: 'conversation-1',
    requestId: 'request-1',
    question: '请选择目标格式',
    reason: '转换前需要目标格式',
    answerType: 'single_select' as const,
    suggestions: [{ label: 'PNG', value: 'png' }],
    allowCustomAnswer: true,
    blocking: true,
    round: 1,
    maxRounds: 3,
    status: 'pending' as const,
    createdAt: '2026-08-08T00:00:00Z',
  };

  it('restores the pending clarification for the active conversation', () => {
    const task = { id: 'task-1', conversationId: 'conversation-1', status: 'needs_input' as const };
    expect(getPendingClarification([task], [clarification], 'conversation-1')).toEqual({
      task,
      clarification,
    });
    expect(toClarificationToolCard(clarification)).toMatchObject({
      type: 'clarification',
      id: 'clarification-1',
      question: '请选择目标格式',
    });
  });

  it('ignores answered clarifications and other conversations', () => {
    expect(
      getPendingClarification(
        [{ id: 'task-1', conversationId: 'conversation-1', status: 'needs_input' as const }],
        [{ ...clarification, status: 'answered' as const }],
        'conversation-1',
      ),
    ).toBeNull();
    expect(
      getPendingClarification(
        [{ id: 'task-1', conversationId: 'conversation-1', status: 'needs_input' as const }],
        [clarification],
        'conversation-2',
      ),
    ).toBeNull();
  });

  it('keeps a clarification anchored before its later answer message', () => {
    const answer = {
      id: 'message-answer',
      role: 'user',
      runId: 'run-1',
      createdAt: '2026-08-08T00:02:00Z',
    };
    const grouped = groupConversationClarificationsByMessage(
      [
        {
          id: 'message-original',
          role: 'user',
          runId: 'run-1',
          createdAt: '2026-08-08T00:00:00Z',
        },
        answer,
      ],
      [
        {
          ...clarification,
          status: 'answered' as const,
          decision: 'answer' as const,
          answer: '南京',
          createdAt: '2026-08-08T00:01:00Z',
        },
      ],
      'conversation-1',
    );

    expect(grouped.get('message-original')?.[0]).toMatchObject({
      id: 'clarification-1',
      answer: '南京',
    });
    expect(grouped.has(answer.id)).toBe(false);
  });

  it('maps the persisted answer into a read-only clarification card', () => {
    expect(
      toClarificationToolCard({
        ...clarification,
        status: 'answered',
        decision: 'answer',
        answer: '南京',
      }),
    ).toMatchObject({
      status: 'answered',
      decision: 'answer',
      answer: '南京',
    });
  });

  it('maps a failed tool trace to a stable retry card', () => {
    expect(
      toToolErrorCard({
        id: 'trace-1',
        conversationId: 'conversation-1',
        runId: 'run-1',
        toolName: 'image.convert',
        status: 'failed',
        durationMs: 12,
        errorCode: 'ARTIFACT_STORAGE_UNAVAILABLE',
        errorMessage: '文件暂时无法读取，请稍后重试。',
        retryable: true,
        createdAt: '2026-08-08T00:00:00Z',
      }),
    ).toEqual({
      type: 'tool_error',
      title: '图片转换失败',
      message: '文件暂时无法读取，请稍后重试。',
      errorCode: 'ARTIFACT_STORAGE_UNAVAILABLE',
      retryable: true,
    });
  });
});
