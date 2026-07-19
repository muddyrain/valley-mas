import { useAuthStore } from '@/stores/useAuthStore';
import request, { type RequestConfig } from '@/utils/request';

export type CopilotScope = 'workbench' | 'agent' | 'workflow';

export interface CopilotSession {
  id: string;
  scope: CopilotScope;
  targetId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'answer' | 'clarify' | 'proposal';
  content: string;
  createdAt: string;
}

export interface CopilotQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface CopilotDiff {
  schemaFrom?: number;
  schemaTo?: number;
  added?: string[];
  removed?: string[];
  updated?: string[];
  risks?: string[];
  summary?: string[];
}

export interface CopilotProposal {
  id: string;
  sessionId: string;
  targetType: 'workflow' | 'agent';
  targetId: string;
  baseHash: string;
  baseDraft: unknown;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'reverted';
  candidate: unknown;
  candidateHash: string;
  diff: CopilotDiff;
  createdAt: string;
}

export interface CopilotRun {
  id: string;
  sessionId: string;
  status: 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface CopilotContext {
  scope: CopilotScope;
  targetId?: string;
  draft: unknown;
  selectedNodeId?: string;
  nodeLabels?: Record<string, string>;
  runId?: string;
}

export function isCopilotTargetReady(scope: CopilotScope, targetId?: string): boolean {
  return scope === 'workbench' || Boolean(targetId?.trim());
}

const copilotRequestConfig: RequestConfig = { suppressErrorToast: true };

interface RawProposal extends Omit<CopilotProposal, 'baseDraft' | 'candidate' | 'diff'> {
  baseDraft: string | unknown;
  candidate: string | unknown;
  diff: string | CopilotDiff;
}

export interface CopilotSessionData {
  enabled: boolean;
  session?: CopilotSession;
  messages: CopilotMessage[];
  proposals: CopilotProposal[];
}

export type CopilotStreamEvent =
  | { type: 'session'; data: { session: CopilotSessionData['session'] } }
  | { type: 'run'; data: { run: CopilotRun } }
  | { type: 'assistant.delta'; data: { messageId: string; content: string } }
  | { type: 'activity'; data: { label: string } }
  | { type: 'clarification'; data: { messageId: string; questions: CopilotQuestion[] } }
  | {
      type: 'proposal';
      data: { proposal: RawProposal; candidate: unknown; diff: CopilotDiff };
    }
  | { type: 'done'; data: { messageId: string } }
  | { type: 'cancelled'; data: { runId: string } }
  | { type: 'error'; data: { message: string; statusCode?: number } };

function parseJSONValue<T>(value: string | T, fallback: T): T {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeProposal(proposal: RawProposal): CopilotProposal {
  return {
    ...proposal,
    baseDraft: parseJSONValue(proposal.baseDraft, null),
    candidate: parseJSONValue(proposal.candidate, null),
    diff: parseJSONValue(proposal.diff, {}),
  };
}

export async function getCopilotSession(
  scope: CopilotScope,
  targetId = '',
  sessionId = '',
): Promise<CopilotSessionData> {
  const data = (await request.get<CopilotSessionData>('/ai/workbench/copilot/session', {
    ...copilotRequestConfig,
    params: { scope, targetId, sessionId },
  })) as unknown as CopilotSessionData;
  return {
    ...data,
    messages: data.messages || [],
    proposals: (data.proposals || []).map(normalizeProposal),
  };
}

export async function listCopilotSessions(
  scope: CopilotScope,
  targetId = '',
): Promise<{ enabled: boolean; sessions: CopilotSession[] }> {
  return request.get('/ai/workbench/copilot/sessions', {
    ...copilotRequestConfig,
    params: { scope, targetId },
  });
}

export async function createCopilotSession(
  scope: CopilotScope,
  targetId = '',
): Promise<{ session: CopilotSession }> {
  return request.post('/ai/workbench/copilot/sessions', { scope, targetId }, copilotRequestConfig);
}

export async function updateCopilotProposal(
  proposalId: string,
  status: 'accepted' | 'rejected' | 'reverted',
  currentHash = '',
): Promise<void> {
  await request.patch(
    `/ai/workbench/copilot/proposals/${proposalId}`,
    { status, currentHash },
    copilotRequestConfig,
  );
}

export function cancelCopilotRun(runId: string): Promise<{ status: 'cancelling' }> {
  return request.post(
    `/ai/workbench/copilot/runs/${runId}/cancel`,
    undefined,
    copilotRequestConfig,
  );
}

export async function streamCopilotMessage(
  context: CopilotContext,
  message: string,
  sessionId: string,
  handlers: { onEvent: (event: CopilotStreamEvent) => void; onError: (message: string) => void },
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const baseHash = await hashCopilotDraft(context.draft);
  const response = await fetch(`${base}/ai/workbench/copilot/messages/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      scope: context.scope,
      targetId: context.targetId || '',
      sessionId,
      message,
      context: {
        draft: context.draft,
        selectedNodeId: context.selectedNodeId || '',
        nodeLabels: context.nodeLabels || {},
        runId: context.runId || '',
        baseHash,
      },
    }),
    signal,
  });
  if (!response.ok || !response.body) {
    handlers.onError(`AI 协作请求失败（${response.status}）`);
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const line = block
        .split('\n')
        .find((item) => item.startsWith('data:'))
        ?.slice(5)
        .trim();
      if (!line) continue;
      try {
        handlers.onEvent(JSON.parse(line) as CopilotStreamEvent);
      } catch {
        handlers.onError('AI 协作事件解析失败');
      }
    }
    if (done) break;
  }
}

function sortJSON(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJSON);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, sortJSON(nested)]),
    );
  }
  return value;
}

export async function hashCopilotDraft(value: unknown): Promise<string> {
  const canonical = JSON.stringify(sortJSON(value)).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      ({
        '<': '\\u003c',
        '>': '\\u003e',
        '&': '\\u0026',
        '\u2028': '\\u2028',
        '\u2029': '\\u2029',
      })[character] || character,
  );
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
