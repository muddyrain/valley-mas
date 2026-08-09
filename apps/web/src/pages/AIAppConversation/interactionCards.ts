import type {
  AIAppConversationToolTrace,
  AIAppTask,
  AIAppTaskClarification,
} from '@/api/aiWorkbench';
import type { ClarificationToolCard, ToolErrorCard } from '@/components/ai/ConversationToolCard';
import { formatAssistantToolName } from './execution';

type TaskIdentity = Pick<AIAppTask, 'id' | 'conversationId' | 'status'>;

type ClarificationMessage = {
  id: string;
  role: string;
  runId?: string;
  createdAt: string;
};

export function getPendingClarification<TTask extends TaskIdentity>(
  tasks: TTask[],
  clarifications: AIAppTaskClarification[],
  conversationId: string,
): { task: TTask; clarification: AIAppTaskClarification } | null {
  for (const clarification of clarifications) {
    if (clarification.conversationId !== conversationId || clarification.status !== 'pending') {
      continue;
    }
    const task = tasks.find(
      (item) => item.id === clarification.taskId && item.status === 'needs_input',
    );
    if (task) return { task, clarification };
  }
  return null;
}

export function toClarificationToolCard(
  clarification: AIAppTaskClarification,
): ClarificationToolCard {
  return {
    type: 'clarification',
    id: clarification.id,
    question: clarification.question,
    reason: clarification.reason,
    answerType: clarification.answerType,
    suggestions: clarification.suggestions,
    allowCustomAnswer: clarification.allowCustomAnswer,
    blocking: clarification.blocking,
    round: clarification.round,
    maxRounds: clarification.maxRounds,
    status: clarification.status,
    decision: clarification.decision,
    answer: clarification.answer,
  };
}

export function groupConversationClarificationsByMessage(
  messages: ReadonlyArray<ClarificationMessage>,
  clarifications: ReadonlyArray<AIAppTaskClarification>,
  conversationId: string,
) {
  const grouped = new Map<string, AIAppTaskClarification[]>();
  for (const clarification of clarifications) {
    if (clarification.conversationId !== conversationId) continue;
    const sameRunUsers = messages.filter(
      (message) => message.role === 'user' && message.runId === clarification.runId,
    );
    if (sameRunUsers.length === 0) continue;

    const clarificationTime = Date.parse(clarification.createdAt);
    const eligibleMessages = Number.isFinite(clarificationTime)
      ? sameRunUsers.filter((message) => {
          const messageTime = Date.parse(message.createdAt);
          return Number.isFinite(messageTime) && messageTime <= clarificationTime;
        })
      : [];
    const anchor = eligibleMessages[eligibleMessages.length - 1] ?? sameRunUsers[0];
    const current = grouped.get(anchor.id) ?? [];
    current.push(clarification);
    grouped.set(anchor.id, current);
  }
  return grouped;
}

export function toToolErrorCard(trace: AIAppConversationToolTrace): ToolErrorCard | null {
  if (trace.status !== 'failed' || !trace.errorMessage) return null;
  return {
    type: 'tool_error',
    title: `${formatAssistantToolName(trace.toolName)}失败`,
    message: trace.errorMessage,
    errorCode: trace.errorCode,
    retryable: Boolean(trace.retryable),
  };
}
