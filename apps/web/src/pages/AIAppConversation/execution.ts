import type { AIAppConversationToolTrace, AIAppRun, AIKnowledgeReference } from '@/api/aiWorkbench';

export type AssistantExecutionStep = {
  id: string;
  label: string;
  detail: string;
  kind: 'thinking' | 'tool' | 'result';
  failed?: boolean;
};

const standaloneGreetings = new Set([
  'hi',
  'hello',
  'hey',
  'hihi',
  'hellohello',
  '你好',
  '您好',
  '嗨',
  '哈喽',
  '哈囉',
  '在吗',
  '在么',
  '有人吗',
  '早上好',
  '下午好',
  '晚上好',
  '你好吗',
]);

function isStandaloneGreeting(message: string) {
  const normalized = Array.from(message.toLocaleLowerCase())
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .join('');
  return standaloneGreetings.has(normalized);
}

export function formatAssistantToolName(toolName: string) {
  if (toolName === 'content.search') return '内容搜索';
  if (toolName === 'image.generate') return '图片生成';
  return toolName;
}

export function buildAssistantExecutionSteps(
  traces: AIAppConversationToolTrace[],
): AssistantExecutionStep[] {
  return [
    {
      id: 'analysis',
      label: '分析请求',
      detail: '确定处理方式与所需能力',
      kind: 'thinking',
    },
    ...traces.map((trace) => ({
      id: trace.id,
      label: `使用工具：${formatAssistantToolName(trace.toolName)}`,
      detail:
        trace.status === 'failed'
          ? '执行失败'
          : trace.durationMs > 0
            ? `执行完成 · ${Math.max(1, Math.round(trace.durationMs / 1000))}s`
            : '执行完成',
      kind: 'tool' as const,
      failed: trace.status === 'failed',
    })),
    {
      id: 'response',
      label: '整理答复',
      detail: '已生成本轮回复',
      kind: 'result',
    },
  ];
}

export function formatAssistantExecution(run: AIAppRun | null) {
  if (run?.status === 'cancelled') return '已停止';
  if (run && run.status !== 'succeeded') return '执行失败';
  if (run?.durationMs) return `执行完成 ${Math.max(1, Math.round(run.durationMs / 1000))}s`;
  return '执行完成';
}

export function hasAssistantExecutionDetails(
  run: AIAppRun | null,
  traces: AIAppConversationToolTrace[],
  references: AIKnowledgeReference[],
) {
  return Boolean(run) || traces.length > 0 || references.length > 0;
}

export function shouldShowAssistantExecutionReferences(
  run: AIAppRun | null,
  references: AIKnowledgeReference[],
) {
  return references.length > 0 && (!run || !isStandaloneGreeting(run.input));
}
