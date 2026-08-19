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

export type PromptAssistantTarget = 'workflow_llm' | 'prompt_resource' | 'image_studio';

export interface AIKnowledgeReference {
  index: number;
  documentName: string;
  chunkId: string;
  excerpt: string;
  score: number;
  pageNumber?: number;
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

export interface NotionConnectionStatus {
  connected: boolean;
  configured: boolean;
  reconnectRequired: boolean;
  workspaceId?: string;
  workspaceName?: string;
  connectedAt?: string;
}

type AIAssistantSSEEvent = {
  type?: string;
  chunk?: string;
  message?: string;
  suggestion?: PromptAssistantSuggestion;
};

async function consumeAIAssistantSSE(
  response: Response,
  onEvent: (event: AIAssistantSSEEvent) => void,
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
        onEvent(JSON.parse(line.slice(6)) as AIAssistantSSEEvent);
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

export async function createPromptAssistantSuggestion(
  data: {
    target: PromptAssistantTarget;
    modelId?: string;
    field?: PromptAssistantField;
    mode: 'auto' | 'instruction';
    currentPrompt: string;
    instruction?: string;
    allowedVariables?: string[];
    generateGreetings?: boolean;
    /** Lightweight field generation: shorter timeout/output and no repair retry. */
    quick?: boolean;
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
  await consumeAIAssistantSSE(response, (event) => {
    if (event.type === 'done' && event.suggestion) suggestion = event.suggestion;
    if (event.type === 'error') failure = event.message || '提示词优化失败';
  });
  if (!suggestion) throw new Error(failure || 'AI 未返回可用的提示词建议');
  return { suggestion };
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

// The workflow editor binds knowledge bases through the workflow's linked app
// mirror, so these two endpoints remain part of the shared workbench surface.
export function listAIAppKnowledgeBases(appId: string): Promise<{ list: AIKnowledgeBase[] }> {
  return request.get(`/ai/apps/${appId}/knowledge-bases`);
}

export function replaceAIAppKnowledgeBases(
  appId: string,
  knowledgeBaseIds: string[],
): Promise<{ knowledgeBaseIds: string[]; version: { id: string } }> {
  return request.put(`/ai/apps/${appId}/knowledge-bases`, { knowledgeBaseIds });
}
