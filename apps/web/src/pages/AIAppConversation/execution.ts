import type {
  AIAppConversationToolTrace,
  AIAppRun,
  AIAppTask,
  AIKnowledgeReference,
} from '@/api/aiWorkbench';

export type AssistantStreamTool = {
  id: string;
  toolName: string;
  narration?: string;
  status: 'running' | 'succeeded' | 'failed';
  durationMs: number;
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

export function formatAssistantToolAction(toolName: string) {
  if (toolName === 'content.search') return '搜索内容';
  if (toolName === 'image.generate') return '生成图片';
  return formatAssistantToolName(toolName);
}

export function formatAssistantExecution(run: AIAppRun | null) {
  if (run?.status === 'running') return '正在执行';
  if (run?.status === 'cancelled') return '已停止';
  if (run && run.status !== 'succeeded') return '执行失败';
  if (run?.durationMs) return `执行完成 ${Math.max(1, Math.round(run.durationMs / 1000))} 秒`;
  return '执行完成';
}

export function formatAssistantToolSummary(toolNames: string[]) {
  const names = [...new Set(toolNames.map(formatAssistantToolName))];
  return `调用 ${toolNames.length} 次工具 · ${names.join('、')}`;
}

export function isAssistantRunFailure(run: AIAppRun | null) {
  return run?.status === 'failed' || run?.status === 'cancelled';
}

export function shouldNotifyTaskQueued(task: AIAppTask) {
  return task.status === 'queued' && (task.queuePosition ?? 0) > 0;
}

export function hasAssistantExecutionDetails(
  traces: AIAppConversationToolTrace[],
  references: AIKnowledgeReference[],
) {
  return traces.length > 0 || references.length > 0;
}

export function shouldShowAssistantExecutionReferences(
  run: AIAppRun | null,
  references: AIKnowledgeReference[],
) {
  return references.length > 0 && (!run || !isStandaloneGreeting(run.input));
}
