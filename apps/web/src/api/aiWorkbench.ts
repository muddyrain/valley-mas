import type { AxiosProgressEvent } from 'axios';
import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export function getAPIErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export type AIAppType = 'agent' | 'workflow';

export interface AIApp {
  id: string;
  type: AIAppType;
  workflowId?: string;
  name: string;
  description: string;
  avatarUrl: string;
  avatarSource: 'default' | 'ai' | 'upload';
  status: 'draft' | 'published';
  draftVersionId: string;
  publishedVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentConfig {
  modelProfile: 'ark-text-default';
  modelId?: string;
  /** @deprecated 图片理解由 modelId 对应模型的 vision 能力决定。 */
  visionModelId?: string;
  identity?: string;
  userProfile?: string;
  soul?: string;
  agentInstructions?: string;
  /** Legacy fields remain readable while existing agents migrate to profiles. */
  systemPrompt: string;
  openingMessage: string;
  exampleQuestions: string[];
  skillIds: string[];
  imageGeneration?: {
    modelId: string;
    aspectRatio: '1:1' | '4:3' | '3:4' | '16:9' | '9:16';
    quality: '1K' | '2K' | '3K' | '4K';
  };
}

export interface AgentProposal {
  name: string;
  description: string;
  config: AgentConfig;
  avatarPrompt: string;
  toolSuggestions: Array<{ name: 'content.search'; reason: string }>;
  knowledgeBaseSuggestions: Array<{ id: string; name: string; reason: string }>;
}

export interface PromptAssistantSuggestion {
  optimizedPrompt: string;
  description?: string;
  summary: string[];
  openingMessage?: string;
  exampleQuestions?: string[];
}

export type PromptAssistantField =
  | 'system_prompt'
  | 'description'
  | 'opening_message'
  | 'example_questions'
  | 'image_prompt';

export type PromptAssistantTarget = 'agent' | 'workflow_llm' | 'prompt_resource' | 'image_studio';

export interface AIAppVersion {
  id: string;
  appId: string;
  number: number;
  config: string;
  createdAt: string;
}

export interface AIAppDetail {
  app: AIApp;
  versions: AIAppVersion[];
  stats: { conversationCount: number; taskCount: number };
}

export interface AIAppRun {
  id: string;
  versionId: string;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  model: string;
  input: string;
  output: string;
  errorCode: string;
  knowledgeStatus: 'not_used' | 'used' | 'degraded';
  knowledgeErrorCode?: string;
  durationMs: number;
  createdAt: string;
}

export interface AIAppConversation {
  id: string;
  appId: string;
  versionId: string;
  title: string;
  status: 'active';
  createdAt: string;
  updatedAt: string;
}

export interface AIAppConversationMessage {
  id: string;
  conversationId: string;
  runId?: string;
  role: 'user' | 'assistant';
  content: string;
  referenceImageCount: number;
  imageGenerationIds: string;
  createdAt: string;
}

export interface AIAppConversationToolTrace {
  id: string;
  conversationId: string;
  runId: string;
  toolName: string;
  narration?: string;
  status: 'succeeded' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  durationMs: number;
  createdAt: string;
}

export interface AIAppConversationAttachment {
  id: string;
  conversationId: string;
  messageId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'ready';
  createdAt: string;
}

export interface AIAppArtifact {
  id: string;
  conversationId: string;
  runId: string;
  taskId?: string;
  resourceId: string;
  fileName: string;
  contentType: string;
  kind: 'file' | 'conversion';
  sourceFormat?: string;
  targetFormat?: string;
  sizeBytes: number;
  expiresAt?: string;
  persistedAt?: string;
  createdAt: string;
}

export interface AIAppOutputImage {
  id: string;
  prompt: string;
  resultUrl: string;
  resultWidth: number;
  resultHeight: number;
  createdAt: string;
}

export interface AIAppTask {
  id: string;
  conversationId: string;
  runId: string;
  userMessageId: string;
  title: string;
  status:
    | 'queued'
    | 'running'
    | 'waiting_approval'
    | 'needs_input'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
  progress: number;
  queuePosition?: number;
  statusMessage: string;
  partialOutput: string;
  errorCode?: string;
  cancelRequestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAppToolApproval {
  id: string;
  taskId: string;
  runId: string;
  toolName: string;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface AIAppTaskClarification {
  id: string;
  taskId: string;
  runId: string;
  conversationId: string;
  requestId: string;
  question: string;
  reason: string;
  answerType: 'single_select' | 'multi_select' | 'text' | 'file';
  suggestions: Array<{ label: string; value: string; description?: string }>;
  allowCustomAnswer: boolean;
  blocking: boolean;
  round: number;
  maxRounds: number;
  status: 'pending' | 'answered' | 'skipped' | 'declined';
  decision?: 'answer' | 'skip' | 'decline';
  answer?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AIAPIKey {
  id: string;
  name: string;
  keyPrefix: string;
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  createdAt: string;
}

export interface AIAPIKeyAppBinding {
  id: string;
  apiKeyId: string;
  appId: string;
  createdAt: string;
}

export interface AIAPIKeyDailyUsage {
  limit: number;
  count: number;
  remaining: number;
}

export interface AIAppPublicInvocation {
  id: string;
  apiKeyId: string;
  status: 'succeeded' | 'failed' | 'cancelled' | 'rejected';
  durationMs: number;
  stream: boolean;
  errorCode: string;
  dailyCallNumber: number;
  createdAt: string;
}

export interface AIKnowledgeReference {
  index: number;
  documentName: string;
  chunkId: string;
  excerpt: string;
  score: number;
  pageNumber?: number;
}

export interface AIAppRetrievalConfig {
  topK: number;
  minScore: number;
  citeSources: boolean;
  searchMode: 'semantic' | 'hybrid';
  keywordWeight: number;
  maxContextChars: number;
}

export interface AIKnowledgeBase {
  id: string;
  name: string;
  description: string;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIKnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  name: string;
  status: 'pending' | 'pending_parse' | 'pending_embedding' | 'indexing' | 'ready' | 'failed';
  errorCode: string;
  indexProgress: number;
  chunkCount: number;
  mimeType: string;
  sizeBytes: number;
  visionModelId?: string;
  source: 'upload';
  createdAt: string;
  updatedAt: string;
}

export interface AIKnowledgeChunkPreview {
  id: string;
  position: number;
  content: string;
  tokenCount: number;
  pageNumber: number;
  sourceType: 'text' | 'visual';
}

export interface AIKnowledgeRetrievalTestResult {
  documentName: string;
  chunkId: string;
  excerpt: string;
  score: number;
}

export interface AIPrompt {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceLicense?: string;
  importedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AISkill {
  id: string;
  name: string;
  description: string;
  sourceUrl: string;
  sourceAuthor: string;
  sourceLicense: string;
  tags: string[];
  installedAt: string;
}

export interface AISkillFile {
  id?: string;
  path: string;
  kind: 'skill' | 'reference' | 'reference_image' | 'asset' | 'asset_image' | 'script';
  content: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface AISkillDetail extends AISkill {
  files: AISkillFile[];
}

export interface AISkillImportCandidate {
  path: string;
  name: string;
  description: string;
  referenceCount: number;
  referenceImageCount: number;
  scriptCount: number;
  assetCount: number;
  ignoredFileCount: number;
  sourceUrl: string;
}

export interface AISkillImportPreview {
  repositoryUrl: string;
  author: string;
  skills: AISkillImportCandidate[];
}

export interface AIAppTool {
  name: string;
  description: string;
  permission: 'read' | 'model' | 'write';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AIAppToolBinding {
  toolName: string;
  approvalMode: 'auto' | 'always';
}

export interface NotionConnectionStatus {
  connected: boolean;
  configured: boolean;
  reconnectRequired: boolean;
  workspaceId?: string;
  workspaceName?: string;
  connectedAt?: string;
}

type AIAppSSEEvent = {
  type?: string;
  chunk?: string;
  toolName?: string;
  narration?: string;
  ok?: boolean;
  durationMs?: number;
  message?: string;
  errorCode?: string;
  run?: AIAppRun;
  reply?: string;
  conversation?: AIAppConversation;
  userMessage?: AIAppConversationMessage;
  assistantMessage?: AIAppConversationMessage;
  references?: AIKnowledgeReference[];
  suggestion?: PromptAssistantSuggestion;
};

async function consumeAIAppSSE(
  response: Response,
  onEvent: (event: AIAppSSEEvent) => void,
): Promise<boolean> {
  const reader = response.body?.getReader();
  if (!reader) return false;

  const decoder = new TextDecoder();
  let buffer = '';
  const consumeRecords = (flush: boolean) => {
    const records = buffer.split('\n\n');
    buffer = flush ? '' : records.pop() || '';
    for (const record of records) {
      const line = record.split('\n').find((item) => item.startsWith('data: '));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as AIAppSSEEvent);
      } catch {
        /* Ignore malformed partial events. */
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      if (buffer) consumeRecords(true);
      return true;
    }
    buffer += decoder.decode(value, { stream: true });
    consumeRecords(false);
  }
}

export function listAIApps(): Promise<{ list: AIApp[] }> {
  return request.get('/ai/apps');
}

export function createAIApp(data: {
  type: AIAppType;
  name: string;
  description?: string;
  config: object;
  toolNames?: string[];
  knowledgeBaseIds?: string[];
}): Promise<{ app: AIApp; version: AIAppVersion }> {
  return request.post('/ai/apps', data);
}

export function createAIAppProposal(
  description: string,
  modelId: string,
  current?: AgentProposal,
  signal?: AbortSignal,
): Promise<{ proposal: AgentProposal }> {
  return request.post('/ai/app-assistant/proposals', { description, modelId, current }, { signal });
}

export async function createPromptAssistantSuggestion(
  data: {
    target: PromptAssistantTarget;
    modelId?: string;
    field?: PromptAssistantField;
    mode: 'auto' | 'instruction' | 'debug_run';
    appId?: string;
    currentPrompt: string;
    instruction?: string;
    debugRunIds?: string[];
    allowedVariables?: string[];
    generateGreetings?: boolean;
    /** Lightweight field generation: shorter timeout/output and no repair retry. */
    quick?: boolean;
    agentContext?: {
      name: string;
      description: string;
      systemPrompt: string;
      openingMessage: string;
      exampleQuestions: string[];
    };
  },
  signal?: AbortSignal,
): Promise<{ suggestion: PromptAssistantSuggestion }> {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(`${base}/ai/prompt-assistant/suggestions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...data, stream: !data.quick }),
    signal,
  });
  if (data.quick) {
    const payload = (await response.json()) as {
      code?: number;
      message?: string;
      data?: { suggestion?: PromptAssistantSuggestion };
    };
    if (!response.ok || payload.code !== 0 || !payload.data?.suggestion) {
      throw new Error(payload.message || '提示词优化失败');
    }
    return { suggestion: payload.data.suggestion };
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const payload = (await response.json()) as { message?: string };
    throw new Error(payload.message || '提示词优化失败');
  }
  let suggestion: PromptAssistantSuggestion | undefined;
  let failure = '';
  await consumeAIAppSSE(response, (event) => {
    if (event.type === 'done' && event.suggestion) suggestion = event.suggestion;
    if (event.type === 'error') failure = event.message || '提示词优化失败';
  });
  if (!suggestion) throw new Error(failure || 'AI 未返回可用的提示词建议');
  return { suggestion };
}

export function generateAIAppAvatar(
  appId: string,
  modelId: string,
  context?: { name: string; description: string; systemPrompt: string },
): Promise<{ app: AIApp; model: string }> {
  return request.post(`/ai/apps/${appId}/avatar/generate`, { ...context, modelId });
}

export function uploadAIAppAvatar(appId: string, file: File): Promise<{ app: AIApp }> {
  const formData = new FormData();
  formData.set('file', file, file.name);
  return request.post(`/ai/apps/${appId}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function publishAIApp(appId: string, versionId?: string): Promise<void> {
  return request.post(`/ai/apps/${appId}/publish`, { versionId });
}

export function getAIApp(appId: string): Promise<AIAppDetail> {
  return request.get(`/ai/apps/${appId}`);
}

export function listAIAppOutputs(
  appId: string,
): Promise<{ artifacts: AIAppArtifact[]; images: AIAppOutputImage[] }> {
  return request.get(`/ai/apps/${appId}/outputs`);
}

export function getAIAppArtifactDownloadURL(
  appId: string,
  artifactId: string,
): Promise<{ url: string; expiresAt?: string }> {
  return request.get(`/ai/apps/${appId}/artifacts/${artifactId}/download-url`);
}

export function saveAIAppVersion(
  appId: string,
  data: { name: string; description: string; config: object },
): Promise<{ version: AIAppVersion }> {
  return request.post(`/ai/apps/${appId}/versions`, data);
}

export function restoreAIAppVersion(
  appId: string,
  versionId: string,
): Promise<{ version: AIAppVersion; restoredFromVersionId: string }> {
  return request.post(`/ai/apps/${appId}/restore`, { versionId });
}

export function debugAIApp(
  appId: string,
  message: string,
): Promise<{ run: AIAppRun; reply: string; model: string }> {
  return request.post(`/ai/apps/${appId}/debug`, { message });
}

export async function streamDebugAIApp(
  appId: string,
  message: string,
  modelId: string,
  handlers: {
    onDelta: (chunk: string) => void;
    onToolCall?: (toolName: string) => void;
    onToolResult?: (toolName: string, ok: boolean) => void;
    onDone: (run: AIAppRun, reply: string, references: AIKnowledgeReference[]) => void;
    onError: (message: string, run?: AIAppRun) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(`${base}/ai/apps/${appId}/debug`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, modelId, stream: true }),
    signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await response.text();
    try {
      const payload = JSON.parse(body) as { message?: string };
      handlers.onError(payload.message || '调试运行失败');
    } catch {
      handlers.onError(body || '调试运行失败');
    }
    return;
  }
  const read = await consumeAIAppSSE(response, (event) => {
    if (event.type === 'delta' && event.chunk) handlers.onDelta(event.chunk);
    if (event.type === 'tool_call' && event.toolName) handlers.onToolCall?.(event.toolName);
    if (event.type === 'tool_result' && event.toolName)
      handlers.onToolResult?.(event.toolName, event.ok === true);
    if (event.type === 'error') handlers.onError(event.message || '调试运行失败', event.run);
    if (event.type === 'done' && event.run) {
      handlers.onDone(event.run, event.reply || '', event.references || []);
    }
  });
  if (!read) {
    handlers.onError('无法读取调试响应');
  }
}

export function listAIAppRuns(appId: string): Promise<{ list: AIAppRun[] }> {
  return request.get(`/ai/apps/${appId}/runs`);
}

export function listAIAppConversations(appId: string): Promise<{ list: AIAppConversation[] }> {
  return request.get(`/ai/apps/${appId}/conversations`);
}

export function createAIAppConversation(
  appId: string,
  title?: string,
): Promise<{ conversation: AIAppConversation }> {
  return request.post(`/ai/apps/${appId}/conversations`, { title });
}

export function getAIAppConversation(
  appId: string,
  conversationId: string,
): Promise<{
  conversation: AIAppConversation;
  messages: AIAppConversationMessage[];
  toolTraces: AIAppConversationToolTrace[];
  runs: AIAppRun[];
  referencesByRunId: Record<string, AIKnowledgeReference[]>;
  attachments: AIAppConversationAttachment[];
  artifacts: AIAppArtifact[];
}> {
  return request.get(`/ai/apps/${appId}/conversations/${conversationId}`);
}

export function deleteAIAppConversation(appId: string, conversationId: string): Promise<void> {
  return request.delete(`/ai/apps/${appId}/conversations/${conversationId}`);
}

export function deleteAIApp(appId: string): Promise<void> {
  return request.delete(`/ai/apps/${appId}`);
}

export async function streamAIAppConversation(
  appId: string,
  conversationId: string,
  message: string,
  modelId: string,
  options: { referenceImages?: string[]; activeSkillIds?: string[]; attachmentIds?: string[] } = {},
  handlers: {
    onDelta: (chunk: string) => void;
    onToolCall?: (toolName: string, narration: string) => void;
    onToolResult?: (toolName: string, ok: boolean, durationMs: number, narration: string) => void;
    onDone: (payload: {
      run: AIAppRun;
      conversation: AIAppConversation;
      userMessage: AIAppConversationMessage;
      assistantMessage: AIAppConversationMessage;
      references: AIKnowledgeReference[];
    }) => void;
    onError: (payload: {
      message: string;
      errorCode?: string;
      run?: AIAppRun;
      userMessage?: AIAppConversationMessage;
    }) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(`${base}/ai/apps/${appId}/conversations/${conversationId}/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, modelId, stream: true, ...options }),
    signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await response.text();
    try {
      const payload = JSON.parse(body) as {
        message?: string;
        errorCode?: string;
        data?: { run?: AIAppRun; userMessage?: AIAppConversationMessage };
      };
      handlers.onError({
        message: payload.message || '会话发送失败',
        errorCode: payload.errorCode,
        run: payload.data?.run,
        userMessage: payload.data?.userMessage,
      });
    } catch {
      handlers.onError({ message: body || '会话发送失败' });
    }
    return;
  }
  const read = await consumeAIAppSSE(response, (event) => {
    if (event.type === 'delta' && event.chunk) handlers.onDelta(event.chunk);
    if (event.type === 'tool_call' && event.toolName)
      handlers.onToolCall?.(event.toolName, event.narration || '');
    if (event.type === 'tool_result' && event.toolName)
      handlers.onToolResult?.(
        event.toolName,
        event.ok === true,
        event.durationMs || 0,
        event.narration || '',
      );
    if (event.type === 'error') {
      handlers.onError({
        message: event.message || '会话发送失败',
        errorCode: event.errorCode,
        run: event.run,
        userMessage: event.userMessage,
      });
    }
    if (
      event.type === 'done' &&
      event.run &&
      event.conversation &&
      event.userMessage &&
      event.assistantMessage
    ) {
      handlers.onDone({
        run: event.run,
        conversation: event.conversation,
        userMessage: event.userMessage,
        assistantMessage: event.assistantMessage,
        references: event.references || [],
      });
    }
  });
  if (!read) {
    handlers.onError({ message: '无法读取会话响应' });
  }
}

export function listAIAPIKeys(): Promise<{ list: AIAPIKey[] }> {
  return request.get('/ai/api-keys');
}

export function createAIAPIKey(data: { name: string }): Promise<{ key: AIAPIKey; secret: string }> {
  return request.post('/ai/api-keys', data);
}

export function revokeAIAPIKey(keyId: string): Promise<void> {
  return request.delete(`/ai/api-keys/${keyId}`);
}

export function listAIAPIKeyAppBindings(keyId: string): Promise<{ list: AIAPIKeyAppBinding[] }> {
  return request.get(`/ai/api-keys/${keyId}/apps`);
}

export function replaceAIAPIKeyAppBindings(
  keyId: string,
  appIds: string[],
): Promise<{ appIds: string[] }> {
  return request.put(`/ai/api-keys/${keyId}/apps`, { appIds });
}

export function getAIAPIKeyDailyUsage(keyId: string): Promise<AIAPIKeyDailyUsage> {
  return request.get(`/ai/api-keys/${keyId}/usage`);
}

export function listAIAppPublicInvocations(
  appId: string,
): Promise<{ list: AIAppPublicInvocation[] }> {
  return request.get(`/ai/apps/${appId}/public-invocations`);
}

export function listAIAppTools(): Promise<{ list: AIAppTool[] }> {
  return request.get('/ai/apps/tools');
}

export function getNotionConnection(): Promise<NotionConnectionStatus> {
  return request.get('/integrations/notion');
}

export function startNotionAuthorization(): Promise<{ authUrl: string }> {
  return request.post('/integrations/notion/authorization');
}

export function disconnectNotion(): Promise<{ remoteRevoked: boolean }> {
  return request.delete('/integrations/notion');
}

export function listAIAppToolBindings(
  appId: string,
): Promise<{ tools: string[]; bindings: AIAppToolBinding[] }> {
  return request.get(`/ai/apps/${appId}/tools`);
}

export function replaceAIAppTools(
  appId: string,
  tools: string[],
  policies: AIAppToolBinding[] = [],
): Promise<{ tools: string[]; bindings: AIAppToolBinding[]; version: AIAppVersion }> {
  return request.put(`/ai/apps/${appId}/tools`, { tools, policies });
}

export function getAIAppRetrievalConfig(
  appId: string,
): Promise<{ retrievalConfig: AIAppRetrievalConfig }> {
  return request.get(`/ai/apps/${appId}/retrieval-config`);
}

export function updateAIAppRetrievalConfig(
  appId: string,
  config: AIAppRetrievalConfig,
): Promise<{ retrievalConfig: AIAppRetrievalConfig; version: AIAppVersion }> {
  return request.put(`/ai/apps/${appId}/retrieval-config`, config);
}

export function uploadAIAppConversationAttachment(
  appId: string,
  conversationId: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ attachment: AIAppConversationAttachment }> {
  const formData = new FormData();
  formData.append('file', file);
  return request.post(`/ai/apps/${appId}/conversations/${conversationId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event: AxiosProgressEvent) => {
      const ratio =
        typeof event.progress === 'number'
          ? event.progress
          : event.total && event.total > 0
            ? event.loaded / event.total
            : undefined;
      if (ratio === undefined || !Number.isFinite(ratio)) return;
      onProgress?.(Math.min(100, Math.max(0, Math.round(ratio * 100))));
    },
  });
}

export function deleteAIAppConversationAttachment(
  appId: string,
  conversationId: string,
  attachmentId: string,
): Promise<void> {
  return request.delete(
    `/ai/apps/${appId}/conversations/${conversationId}/attachments/${attachmentId}`,
  );
}

export async function getAIAppConversationAttachmentBlob(
  appId: string,
  conversationId: string,
  attachmentId: string,
): Promise<Blob> {
  const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const response = await fetch(
    `${base}/ai/apps/${appId}/conversations/${conversationId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } },
  );
  if (!response.ok) throw new Error('读取会话文件失败');
  return response.blob();
}

export async function downloadAIAppConversationAttachment(
  appId: string,
  conversationId: string,
  attachment: AIAppConversationAttachment,
): Promise<void> {
  const href = URL.createObjectURL(
    await getAIAppConversationAttachmentBlob(appId, conversationId, attachment.id),
  );
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = attachment.name;
  anchor.click();
  URL.revokeObjectURL(href);
}

export function createAIAppConversationTask(
  appId: string,
  conversationId: string,
  data: { message: string; modelId?: string; activeSkillIds?: string[]; attachmentIds?: string[] },
): Promise<{ task: AIAppTask; run: AIAppRun; userMessage: AIAppConversationMessage }> {
  return request.post(`/ai/apps/${appId}/conversations/${conversationId}/tasks`, data);
}

export function listAIAppTasks(
  appId: string,
  conversationId?: string,
): Promise<{
  list: AIAppTask[];
  approvals: AIAppToolApproval[];
  clarifications: AIAppTaskClarification[];
}> {
  return request.get(`/ai/apps/${appId}/tasks`, {
    params: conversationId ? { conversationId } : undefined,
  });
}

export function decideAIAppTaskClarification(
  appId: string,
  taskId: string,
  clarificationId: string,
  data: {
    decision: 'answer' | 'skip' | 'decline';
    answer?: string;
    attachmentIds?: string[];
  },
): Promise<{
  clarification: AIAppTaskClarification;
  task: AIAppTask;
  userMessage?: AIAppConversationMessage;
}> {
  return request.post(
    `/ai/apps/${appId}/tasks/${taskId}/clarifications/${clarificationId}/decision`,
    data,
  );
}

export function retryAIAppTask(
  appId: string,
  taskId: string,
): Promise<{ task: AIAppTask; run: AIAppRun }> {
  return request.post(`/ai/apps/${appId}/tasks/${taskId}/retry`);
}

export function decideAIAppToolApproval(
  appId: string,
  taskId: string,
  approvalId: string,
  decision: 'approve' | 'reject',
): Promise<{ approval: AIAppToolApproval }> {
  return request.post(`/ai/apps/${appId}/tasks/${taskId}/approvals/${approvalId}/decision`, {
    decision,
  });
}

export function cancelAIAppTask(appId: string, taskId: string): Promise<void> {
  return request.post(`/ai/apps/${appId}/tasks/${taskId}/cancel`);
}

export function listAIKnowledgeBases(): Promise<{ list: AIKnowledgeBase[] }> {
  return request.get('/ai/knowledge-bases');
}

export function listAIPrompts(): Promise<{ list: AIPrompt[] }> {
  return request.get('/ai/prompts');
}

export function createAIPrompt(data: {
  name: string;
  description?: string;
  content: string;
  tags: string[];
}): Promise<AIPrompt> {
  return request.post('/ai/prompts', data);
}

export function updateAIPrompt(
  promptId: string,
  data: {
    name: string;
    description?: string;
    content: string;
    tags: string[];
  },
): Promise<AIPrompt> {
  return request.patch(`/ai/prompts/${promptId}`, data);
}

export function archiveAIPrompt(promptId: string): Promise<void> {
  return request.delete(`/ai/prompts/${promptId}`);
}

export function listAISkills(): Promise<{ list: AISkill[] }> {
  return request.get('/ai/skills');
}

export function getAISkill(skillId: string): Promise<AISkillDetail> {
  return request.get(`/ai/skills/${skillId}`);
}

export function getAISkillFileImageData(
  skillId: string,
  fileId: string,
): Promise<{ imageBase64: string }> {
  return request.get<unknown, { imageBase64: string }>(
    `/ai/skills/${skillId}/files/${fileId}/image-data`,
  );
}

export type AISkillImportSource = string | File;

export function previewAISkillImport(source: AISkillImportSource): Promise<AISkillImportPreview> {
  if (typeof source === 'string') {
    return request.post('/ai/skills/preview', { url: source });
  }
  const formData = new FormData();
  formData.set('file', source, source.name);
  return request.post('/ai/skills/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function installAISkill(
  source: AISkillImportSource,
  paths: string[],
): Promise<{ list: AISkill[] }> {
  if (typeof source === 'string') {
    return request.post('/ai/skills/install', { url: source, paths });
  }
  const formData = new FormData();
  formData.set('file', source, source.name);
  paths.forEach((path) => {
    formData.append('paths', path);
  });
  return request.post('/ai/skills/install', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function archiveAISkill(skillId: string): Promise<void> {
  return request.delete(`/ai/skills/${skillId}`);
}

export function updateAISkill(skillId: string, data: { tags: string[] }): Promise<AISkill> {
  return request.patch(`/ai/skills/${skillId}`, data);
}

export function createAIKnowledgeBase(data: {
  name: string;
  description?: string;
}): Promise<AIKnowledgeBase> {
  return request.post('/ai/knowledge-bases', data);
}

export function listAIKnowledgeDocuments(
  knowledgeBaseId: string,
): Promise<{ list: AIKnowledgeDocument[] }> {
  return request.get(`/ai/knowledge-bases/${knowledgeBaseId}/documents`);
}

export function listAIKnowledgeDocumentChunks(
  knowledgeBaseId: string,
  documentId: string,
): Promise<{ document: AIKnowledgeDocument; list: AIKnowledgeChunkPreview[] }> {
  return request.get(`/ai/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/chunks`);
}

export function testAIKnowledgeRetrieval(
  knowledgeBaseId: string,
  query: string,
): Promise<{ list: AIKnowledgeRetrievalTestResult[] }> {
  return request.post(`/ai/knowledge-bases/${knowledgeBaseId}/retrieval-tests`, { query });
}

export function uploadAIKnowledgeDocument(
  knowledgeBaseId: string,
  formData: FormData,
): Promise<{ document: AIKnowledgeDocument }> {
  return request.post(`/ai/knowledge-bases/${knowledgeBaseId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function retryAIKnowledgeDocument(
  knowledgeBaseId: string,
  documentId: string,
): Promise<{ document: AIKnowledgeDocument }> {
  return request.post(`/ai/knowledge-bases/${knowledgeBaseId}/documents/${documentId}/retry`);
}

export function deleteAIKnowledgeDocument(
  knowledgeBaseId: string,
  documentId: string,
): Promise<void> {
  return request.delete(`/ai/knowledge-bases/${knowledgeBaseId}/documents/${documentId}`);
}

export function listAIAppKnowledgeBases(appId: string): Promise<{ list: AIKnowledgeBase[] }> {
  return request.get(`/ai/apps/${appId}/knowledge-bases`);
}

export function replaceAIAppKnowledgeBases(
  appId: string,
  knowledgeBaseIds: string[],
): Promise<{ knowledgeBaseIds: string[]; version: AIAppVersion }> {
  return request.put(`/ai/apps/${appId}/knowledge-bases`, { knowledgeBaseIds });
}
