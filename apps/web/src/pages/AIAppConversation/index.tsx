import { gsap } from 'gsap';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Ellipsis,
  MessageCirclePlus,
  MessageSquareText,
  Search,
  Send,
  Settings2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import {
  type AIImageGeneration,
  getAIImageGeneration,
  saveAIImageGenerationResource,
} from '@/api/aiImages';
import {
  type AgentConfig,
  type AIApp,
  type AIAppArtifact,
  type AIAppConversation,
  type AIAppConversationAttachment,
  type AIAppConversationMessage,
  type AIAppConversationToolTrace,
  type AIAppRun,
  type AIAppTask,
  type AIAppToolApproval,
  type AIAppVersion,
  type AIKnowledgeReference,
  type AISkill,
  cancelAIAppTask,
  createAIAppConversation,
  createAIAppConversationTask,
  decideAIAppToolApproval,
  deleteAIAppConversation,
  deleteAIAppConversationAttachment,
  downloadAIAppConversationAttachment,
  getAIApp,
  getAIAppConversation,
  getAIAppConversationAttachmentBlob,
  getAPIErrorMessage,
  listAIAppConversations,
  listAIAppTasks,
  listAISkills,
  publishAIApp,
  streamAIAppConversation,
  uploadAIAppConversationAttachment,
} from '@/api/aiWorkbench';
import { ConversationAttachmentCard } from '@/components/ai/ConversationAttachmentCard';
import {
  ConversationComposer,
  type ConversationComposerFile,
} from '@/components/ai/ConversationComposer';
import { ConversationMessageBubble } from '@/components/ai/ConversationMessageBubble';
import {
  SaveResourceDialog,
  type SaveResourceVisibility,
} from '@/components/ai/SaveResourceDialog';
import { AIImageGenerationImage } from '@/components/ai-images/AIImageGenerationImage';
import { AIImageResultActions } from '@/components/ai-images/AIImageResultActions';
import { GenerationPreview } from '@/components/ai-images/GenerationOverlay';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AssistantActiveExecution,
  AssistantExecutionHeader,
} from '@/pages/AIAppConversation/AssistantExecution';
import { AssistantFailureState } from '@/pages/AIAppConversation/AssistantFailureState';
import { ConversationDeletingOverlay } from '@/pages/AIAppConversation/ConversationDeletingOverlay';
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
} from '@/pages/AIAppConversation/conversationView';
import {
  type AssistantStreamTool,
  hasAssistantExecutionDetails,
  isAssistantRunFailure,
  shouldNotifyTaskQueued,
  shouldShowAssistantExecutionReferences,
} from '@/pages/AIAppConversation/execution';
import { loadAvailableConversationImages } from '@/pages/AIAppConversation/history';
import { useAuthStore } from '@/stores/useAuthStore';

const quickPrompts = [
  '介绍一下你的能力',
  '根据资料库回答一个问题',
  '帮我梳理当前任务',
  '给我一个开始建议',
];

type ConversationAgentConfig = AgentConfig & {
  openingMessage: string;
  exampleQuestions: string[];
  skillIds: string[];
};

const defaultConfig: ConversationAgentConfig = {
  modelProfile: 'ark-text-default',
  systemPrompt: '',
  openingMessage: '',
  exampleQuestions: [],
  skillIds: [],
};

type ConversationStreamState = {
  reply: string;
  tools: AssistantStreamTool[];
  imageGenerating: boolean;
  startedAt: number;
};

const isTaskActive = (task: AIAppTask) =>
  task.status === 'queued' || task.status === 'running' || task.status === 'waiting_approval';

function parseImageGenerationIDs(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function parseAgentConfig(version?: AIAppVersion): ConversationAgentConfig {
  try {
    const parsed = JSON.parse(version?.config || '{}') as Partial<AgentConfig>;
    return {
      modelProfile: 'ark-text-default',
      modelId: typeof parsed.modelId === 'string' ? parsed.modelId : undefined,
      systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : '',
      openingMessage: typeof parsed.openingMessage === 'string' ? parsed.openingMessage : '',
      exampleQuestions: Array.isArray(parsed.exampleQuestions)
        ? parsed.exampleQuestions
            .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
            .slice(0, 4)
        : [],
      skillIds: Array.isArray(parsed.skillIds)
        ? parsed.skillIds.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [],
    };
  } catch {
    return defaultConfig;
  }
}

function formatConversationUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return new Intl.DateTimeFormat(
    'zh-CN',
    isToday
      ? { hour: '2-digit', minute: '2-digit' }
      : {
          month: 'numeric',
          day: 'numeric',
        },
  ).format(date);
}

function formatRunFailure(run: AIAppRun) {
  switch (run.errorCode) {
    case 'RAG_POSTGRES_REQUIRED':
      return '知识库检索需要 PostgreSQL 数据库';
    case 'RAG_PGVECTOR_UNAVAILABLE':
      return '数据库未启用 pgvector 扩展';
    case 'RAG_VECTOR_DIMENSION_MISMATCH':
      return '知识库向量维度不匹配，请重新索引全部文档';
    case 'RAG_VECTOR_OPERATOR_UNAVAILABLE':
      return '知识库向量检索不可用，请检查 pgvector 与数据库迁移';
    case 'RAG_SCHEMA_OUTDATED':
      return '知识库数据库结构未迁移，请执行服务端迁移';
    case 'RAG_DATABASE_UNAVAILABLE':
      return '知识库数据库暂不可用，请稍后重试';
    case 'ARK_EMBEDDING_NOT_CONFIGURED':
      return '知识库向量模型未配置';
    case 'ARK_EMBEDDING_FAILED':
      return '知识库向量服务调用失败';
    case 'RAG_CONFIG_INVALID':
      return '知识库检索配置无效';
    case 'RAG_QUERY_FAILED':
      return '知识库检索服务异常';
    case 'RUN_CANCELLED':
      return '已停止生成';
    case 'AI_EMPTY_RESPONSE':
      return 'AI 未返回有效内容';
    case 'MODEL_NOT_CONFIGURED':
      return '所选模型暂不可用';
    case 'VISION_MODEL_NOT_CONFIGURED':
      return '所选对话模型不支持图片理解，请切换模型';
    case 'APP_CONFIG_INVALID':
      return '智能体版本配置无效';
    case 'AI_AGENT_RUN_FAILED':
      return '模型服务暂时不可用，请稍后再试';
    default:
      return run.status === 'cancelled' ? '已停止生成' : '本次回复未完成';
  }
}

function ConversationModelControl({
  value,
  defaultValue,
  onValueChange,
  onModelChange,
}: {
  value: string;
  defaultValue?: string;
  onValueChange: (modelID: string) => void;
  onModelChange: (model?: AvailableAIModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<AvailableAIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    void listAvailableAIModels('text')
      .then((result) => {
        if (active) setModels(result.list);
      })
      .catch(() => {
        if (active) {
          setModels([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = models.find((item) => item.id === value);
  const label = selected?.displayName || (loading ? '正在加载模型' : '选择模型');
  const isTemporaryOverride = Boolean(defaultValue && value && value !== defaultValue);

  useEffect(() => {
    if (!value && models[0]) onValueChange(models[0].id);
  }, [models, onValueChange, value]);

  useEffect(() => {
    onModelChange(selected);
  }, [onModelChange, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="选择对话模型"
          >
            <span className="max-w-44 truncate">
              {label}
              {isTemporaryOverride ? ' · 临时' : ''}
            </span>
            <ChevronDown className="size-3.5" />
          </Button>
        }
      />
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="max-h-[min(24rem,var(--available-height))] w-80 gap-2 overflow-hidden rounded-2xl p-2 shadow-lg"
      >
        <div className="px-2 py-1 text-sm font-medium">模型</div>
        <div className="max-h-[min(20rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain pr-2">
          <div className="space-y-1">
            {loading ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">正在加载模型</p>
            ) : failed ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                模型列表暂时无法加载
              </p>
            ) : models.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                没有可用的对话模型
              </p>
            ) : (
              models.map((item) => {
                const selectedModel = item.id === value;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    className={cn(
                      'h-auto w-full justify-start rounded-xl px-3 py-2.5 text-left',
                      selectedModel && 'bg-muted',
                    )}
                    onClick={() => {
                      onValueChange(item.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.displayName}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {item.provider}
                        {modelSupportsImageUnderstanding(item) ? ' · 支持图片理解' : ''}
                      </span>
                    </span>
                    {selectedModel ? <Check className="size-4 shrink-0" /> : null}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ConversationContentSkeleton() {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-hidden" aria-hidden="true">
        <div className="mx-auto flex min-h-full w-full max-w-[54rem] flex-col gap-6 px-6 py-8 sm:px-8 lg:py-10">
          <div className="flex items-start justify-end gap-3">
            <div className="w-48 max-w-[70%] rounded-xl bg-muted/60 px-4 py-4">
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="w-full max-w-lg space-y-2 rounded-xl bg-muted/60 px-4 py-4">
              <Skeleton className="h-4 w-4/5 max-w-full rounded-full" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-3/5 max-w-full rounded-full" />
            </div>
          </div>
          <div className="flex items-start justify-end gap-3">
            <div className="w-56 max-w-[70%] rounded-xl bg-muted/60 px-4 py-4">
              <Skeleton className="h-4 w-full rounded-full" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="w-full max-w-md space-y-2 rounded-xl bg-muted/60 px-4 py-4">
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-4 w-2/3 max-w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[54rem] px-5 pb-6 pt-3 sm:px-8" aria-hidden="true">
        <div className="rounded-xl border border-border bg-card px-4 pt-4 shadow-sm">
          <div className="space-y-2 pb-8">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="h-4 w-2/5 rounded-full" />
          </div>
          <div className="flex items-center justify-between border-t border-border/70 py-2">
            <Skeleton className="h-8 w-36 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      </div>
    </>
  );
}

function AIAppConversationSkeleton() {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background" aria-busy="true">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="hidden h-5 w-14 rounded-full sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-18 rounded-md" />
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-8 w-12 rounded-md" />
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-14 rounded-full" />
            </div>
            <Skeleton className="size-8 rounded-md" />
          </div>
          <Skeleton className="mt-5 h-9 w-full rounded-md" />
          <div className="mt-5 space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
          <Skeleton className="mt-auto h-14 w-full rounded-lg" />
        </aside>
        <section className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 items-center overflow-hidden">
            <div className="mx-auto flex w-full max-w-[54rem] flex-col gap-5 px-6 py-10 sm:px-8">
              <div className="space-y-3">
                <Skeleton className="h-8 w-80 max-w-full rounded-md" />
                <Skeleton className="h-4 w-[34rem] max-w-full rounded-full" />
                <Skeleton className="h-4 w-96 max-w-full rounded-full" />
              </div>
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-20 w-full rounded-lg" />
                <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3">
                  <Skeleton className="h-8 w-28 rounded-full" />
                  <Skeleton className="size-9 rounded-full" />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
            </div>
          </div>
        </section>
      </div>
      <span className="sr-only" role="status">
        加载智能体会话
      </span>
    </div>
  );
}

export default function AIAppConversationPage() {
  const { appId, conversationId } = useParams<{ appId: string; conversationId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<AIAppConversation[]>([]);
  const [app, setApp] = useState<AIApp | null>(null);
  const [conversation, setConversation] = useState<AIAppConversation | null>(null);
  const [versions, setVersions] = useState<AIAppVersion[]>([]);
  const [draftVersionId, setDraftVersionId] = useState('');
  const [messages, setMessages] = useState<AIAppConversationMessage[]>([]);
  const [toolTraces, setToolTraces] = useState<AIAppConversationToolTrace[]>([]);
  const [runs, setRuns] = useState<AIAppRun[]>([]);
  const [referencesByRunId, setReferencesByRunId] = useState<
    Record<string, AIKnowledgeReference[]>
  >({});
  const [attachments, setAttachments] = useState<AIAppConversationAttachment[]>([]);
  const [artifacts, setArtifacts] = useState<AIAppArtifact[]>([]);
  const [tasks, setTasks] = useState<AIAppTask[]>([]);
  const [approvals, setApprovals] = useState<AIAppToolApproval[]>([]);
  const [uploadItems, setUploadItems] = useState<ConversationComposerFile[]>([]);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const [pendingTaskCreations, setPendingTaskCreations] = useState<Record<string, number>>({});
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [imageGenerations, setImageGenerations] = useState<Record<string, AIImageGeneration>>({});
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const [saveTarget, setSaveTarget] = useState<AIImageGeneration | null>(null);
  const [savingImageResourceId, setSavingImageResourceId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [, setConversationStreams] = useState<Record<string, ConversationStreamState>>({});
  const [textModelId, setTextModelId] = useState('');
  const [selectedConversationModel, setSelectedConversationModel] = useState<AvailableAIModel>();
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const streamControllersRef = useRef(new Map<string, AbortController>());
  const taskStatusesRef = useRef(new Map<string, AIAppTask['status']>());
  const activeConversationIdRef = useRef(conversationId);
  const attachmentPreviewUrlsRef = useRef<Record<string, string>>({});
  const loadedAppIdRef = useRef<string | null>(null);
  const welcomeRef = useRef<HTMLDivElement | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement | null>(null);
  const taskDetailRefreshAtRef = useRef(0);
  const taskCreationChainRef = useRef<Promise<void>>(Promise.resolve());
  activeConversationIdRef.current = conversationId;
  const creatingTask = Boolean(conversationId && (pendingTaskCreations[conversationId] ?? 0) > 0);
  const sending = creatingTask;
  const conversationConfig = parseAgentConfig(
    versions.find((item) => item.id === conversation?.versionId),
  );
  const boundSkills = skills.filter((skill) => conversationConfig.skillIds.includes(skill.id));
  const orderedMessages = orderConversationMessages(messages);
  const tasksByRunId = new Map(tasks.map((task) => [task.runId, task]));
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const activeConversationTasks = tasks.filter(
    (task) =>
      task.conversationId === conversationId &&
      isTaskActive(task) &&
      !hasTerminalConversationRun(runsById.get(task.runId)) &&
      !hasAssistantMessageForRun(messages, task.runId),
  );
  const visibleConversationTasks = activeConversationTasks.filter((task) =>
    shouldShowActiveConversationTask(task, messages),
  );
  const renderedConversationTasks = visibleConversationTasks.filter(
    (task) => task.status !== 'queued',
  );
  const renderedTasksByRunId = new Map(renderedConversationTasks.map((task) => [task.runId, task]));
  const currentExecutingTask = activeConversationTasks.find(
    (task) => task.status === 'running' || task.status === 'waiting_approval',
  );
  const shouldPollTasksRapidly = activeConversationTasks.length > 0 || creatingTask;
  const conversationActivityKey = getConversationActivityKey(
    messages,
    activeConversationTasks,
    toolTraces.length,
    creatingTask,
  );

  useEffect(() => {
    setTextModelId(conversationConfig.modelId || '');
  }, [conversationConfig.modelId]);

  useEffect(() => {
    let active = true;
    void listAISkills()
      .then((result) => {
        if (active) setSkills(result.list);
      })
      .catch(() => {
        if (active) setSkills([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const generationIds = [
      ...new Set(
        messages.flatMap((message) => parseImageGenerationIDs(message.imageGenerationIds)),
      ),
    ];
    const pending = generationIds.filter((id) => !imageGenerations[id]);
    if (pending.length === 0) return;
    let active = true;
    void loadAvailableConversationImages(
      pending,
      async (id) => (await getAIImageGeneration(id)).generation,
    )
      .then((items) => {
        if (items.length === 0) return;
        if (!active) return;
        setImageGenerations((current) => ({
          ...current,
          ...Object.fromEntries(items.map((item) => [item.id, item])),
        }));
      })
      .catch(() => {
        // The message remains available even if a historical image was removed.
      });
    return () => {
      active = false;
    };
  }, [imageGenerations, messages]);

  useEffect(() => {
    if (!appId) return;
    let active = true;
    listAIAppConversations(appId)
      .then(async (result) => {
        if (!active) return;
        setConversations(result.list);
        if (conversationId) return;
        const currentConversation = result.list[0];
        if (currentConversation) {
          navigate(`/workbench/apps/${appId}/conversations/${currentConversation.id}`, {
            replace: true,
          });
          return;
        }
        try {
          const created = await createAIAppConversation(appId);
          if (!active) return;
          setConversations([created.conversation]);
          navigate(`/workbench/apps/${appId}/conversations/${created.conversation.id}`, {
            replace: true,
          });
        } catch (error) {
          if (active) toast.error(getAPIErrorMessage(error, '创建会话失败'));
          if (active) setInitialLoading(false);
        }
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载会话列表失败'));
        if (active && !conversationId) setInitialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId, conversationId, navigate]);

  useEffect(() => {
    if (!appId) return;
    let active = true;
    const loadVersionContext = () => {
      void getAIApp(appId)
        .then((detail) => {
          if (!active) return;
          setVersions(detail.versions);
          setDraftVersionId(detail.app.draftVersionId);
          setApp(detail.app);
        })
        .catch(() => {
          // 会话已绑定版本；版本元数据加载失败不应阻断继续对话。
        });
    };
    loadVersionContext();
    window.addEventListener('focus', loadVersionContext);
    return () => {
      active = false;
      window.removeEventListener('focus', loadVersionContext);
    };
  }, [appId]);

  useEffect(() => {
    if (!appId || !conversationId) return;
    let active = true;
    const isInitialLoad = loadedAppIdRef.current !== appId;
    if (isInitialLoad) {
      setInitialLoading(true);
    } else {
      setConversationLoading(true);
    }
    setReferencesByRunId({});
    getAIAppConversation(appId, conversationId)
      .then((result) => {
        if (!active) return;
        loadedAppIdRef.current = appId;
        setConversation(result.conversation);
        setMessages((currentMessages) =>
          mergePersistedConversationMessages(result.messages, currentMessages, conversationId),
        );
        setToolTraces(result.toolTraces);
        setRuns(result.runs);
        setReferencesByRunId(result.referencesByRunId);
        setAttachments(result.attachments);
        setArtifacts(result.artifacts);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getAPIErrorMessage(error, '加载会话失败'));
        navigate(`/workbench/apps/${appId}`, { replace: true });
      })
      .finally(() => {
        if (!active) return;
        setInitialLoading(false);
        setConversationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appId, conversationId, navigate]);

  useEffect(() => {
    if (!appId || !conversationId) return;
    const pendingImages = attachments.filter(
      (attachment) =>
        attachment.mimeType.startsWith('image/') &&
        !attachmentPreviewUrlsRef.current[attachment.id],
    );
    if (pendingImages.length === 0) return;
    let active = true;
    void Promise.all(
      pendingImages.map(async (attachment) => ({
        id: attachment.id,
        url: URL.createObjectURL(
          await getAIAppConversationAttachmentBlob(appId, conversationId, attachment.id),
        ),
      })),
    )
      .then((previews) => {
        if (!active) {
          previews.forEach((preview) => {
            URL.revokeObjectURL(preview.url);
          });
          return;
        }
        const next = Object.fromEntries(previews.map((preview) => [preview.id, preview.url]));
        attachmentPreviewUrlsRef.current = { ...attachmentPreviewUrlsRef.current, ...next };
        setAttachmentPreviewUrls((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        // 图片预览失败不影响文件下载和任务执行。
      });
    return () => {
      active = false;
    };
  }, [appId, attachments, conversationId]);

  useEffect(
    () => () => {
      Object.values(attachmentPreviewUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
      attachmentPreviewUrlsRef.current = {};
    },
    [],
  );

  useEffect(() => {
    if (!appId || !conversationId) return;
    let active = true;
    let timeoutId: number | undefined;
    const refreshTasks = async () => {
      try {
        const result = await listAIAppTasks(appId);
        if (!active) return;
        const hasActiveCurrentTask = result.list.some(
          (task) => task.conversationId === conversationId && isTaskActive(task),
        );
        const completedCurrentTask = result.list.some((task) => {
          const previous = taskStatusesRef.current.get(task.id);
          return (
            task.conversationId === conversationId &&
            previous !== undefined &&
            (previous === 'queued' || previous === 'running' || previous === 'waiting_approval') &&
            !isTaskActive(task)
          );
        });
        const shouldRefreshActiveDetail =
          hasActiveCurrentTask && Date.now() - taskDetailRefreshAtRef.current >= 2500;
        if (completedCurrentTask || shouldRefreshActiveDetail) {
          const detail = await getAIAppConversation(appId, conversationId);
          if (!active) return;
          taskDetailRefreshAtRef.current = Date.now();
          setConversation(detail.conversation);
          setMessages((currentMessages) =>
            mergePersistedConversationMessages(detail.messages, currentMessages, conversationId),
          );
          setToolTraces(detail.toolTraces);
          setRuns(detail.runs);
          setReferencesByRunId(detail.referencesByRunId);
          setAttachments(detail.attachments);
          setArtifacts(detail.artifacts);
        }
        taskStatusesRef.current = new Map(result.list.map((task) => [task.id, task.status]));
        setTasks(result.list);
        setApprovals(result.approvals);
      } catch {
        // 任务列表短暂不可用时保留当前会话，不打断用户输入。
      } finally {
        if (active) {
          timeoutId = window.setTimeout(
            () => void refreshTasks(),
            shouldPollTasksRapidly ? 400 : 2500,
          );
        }
      }
    };
    void refreshTasks();
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [appId, conversationId, shouldPollTasksRapidly]);

  useLayoutEffect(() => {
    if (initialLoading || conversationLoading || !conversationId || !conversationActivityKey)
      return;
    const viewport = conversationScrollRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => scrollConversationToLatest(viewport));
    return () => window.cancelAnimationFrame(frame);
  }, [conversationActivityKey, conversationId, conversationLoading, initialLoading]);

  useLayoutEffect(() => {
    if (initialLoading || conversationLoading || !conversationId) return;
    const hasLoadedConversationImage = messages.some((message) =>
      parseImageGenerationIDs(message.imageGenerationIds).some((generationID) =>
        Boolean(imageGenerations[generationID]?.resultUrl),
      ),
    );
    if (!hasLoadedConversationImage) return;
    const viewport = conversationScrollRef.current;
    if (!viewport) return;
    const frame = window.requestAnimationFrame(() => scrollConversationToLatest(viewport));
    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, conversationLoading, imageGenerations, initialLoading, messages]);

  useEffect(() => {
    if (initialLoading || !conversation || messages.length > 0 || !welcomeRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const welcome = welcomeRef.current;
    const context = gsap.context(() => {
      const select = gsap.utils.selector(welcome);
      const intro = select('[data-agent-reveal="intro"]');
      const quickStart = select('[data-agent-reveal="quick-start"]');
      const composer = select('[data-agent-reveal="composer"]');
      const quickPrompts = select('[data-agent-quick-prompt]');
      const timeline = gsap.timeline({
        defaults: { duration: 0.52, ease: 'power2.out' },
      });
      if (intro.length) {
        timeline.fromTo(intro, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, clearProps: 'all' });
      }
      if (quickStart.length) {
        timeline.fromTo(
          quickStart,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, clearProps: 'all' },
          '-=0.32',
        );
      }
      if (composer.length) {
        timeline.fromTo(
          composer,
          { autoAlpha: 0, scale: 0.985, y: 12 },
          { autoAlpha: 1, scale: 1, y: 0, clearProps: 'all' },
          '-=0.3',
        );
      }
      if (quickPrompts.length) {
        timeline.fromTo(
          quickPrompts,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.07,
            clearProps: 'all',
          },
          '-=0.32',
        );
      }
    }, welcome);
    return () => context.revert();
  }, [conversation, initialLoading, messages.length]);

  const createConversation = async () => {
    if (!appId) return;
    try {
      const result = await createAIAppConversation(appId);
      setConversations((items) => [result.conversation, ...items]);
      navigate(`/workbench/apps/${appId}/conversations/${result.conversation.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建会话失败'));
    }
  };

  const removeConversation = async (target: AIAppConversation) => {
    if (
      !appId ||
      deletingConversationId ||
      tasks.some((task) => task.conversationId === target.id && isTaskActive(task))
    )
      return;
    const next = conversations.filter((item) => item.id !== target.id);
    try {
      setDeletingConversationId(target.id);
      await deleteAIAppConversation(appId, target.id);
      setConversations(next);
      toast.success('会话已删除');
      if (String(target.id) === String(conversationId)) {
        if (next[0])
          navigate(`/workbench/apps/${appId}/conversations/${next[0].id}`, { replace: true });
        else navigate(`/workbench/apps/${appId}`, { replace: true });
      }
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除会话失败'));
    } finally {
      setDeletingConversationId(null);
    }
  };

  const publish = async (): Promise<boolean> => {
    if (!appId) return false;
    const versionId = draftVersionId || versions[0]?.id;
    if (!versionId) {
      toast.error('请先保存智能体配置');
      return false;
    }
    try {
      setPublishing(true);
      await publishAIApp(appId, versionId);
      setApp((current) =>
        current ? { ...current, status: 'published', publishedVersionId: versionId } : current,
      );
      toast.success('已发布当前草稿');
      return true;
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '发布失败，请稍后重试'));
      return false;
    } finally {
      setPublishing(false);
    }
  };

  const upsertRun = (run: AIAppRun) => {
    setRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
  };

  const starterQuestions =
    conversationConfig.exampleQuestions.length > 0
      ? conversationConfig.exampleQuestions
      : quickPrompts;
  const conversationQuery = searchParams.get('conversation') ?? '';
  const visibleConversations = conversations.filter((item) =>
    item.title.toLocaleLowerCase('zh-CN').includes(conversationQuery.toLocaleLowerCase('zh-CN')),
  );
  const updateConversationQuery = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('conversation', value);
    else next.delete('conversation');
    setSearchParams(next, { replace: true });
  };
  const openConfiguration = () => {
    if (!appId) return;
    navigate(getAIAppSettingsPath(appId));
  };

  const pendingAttachments = attachments.filter((attachment) => !attachment.messageId);
  const composerFiles: ConversationComposerFile[] = [
    ...pendingAttachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      previewUrl: attachmentPreviewUrls[attachment.id],
      status: 'ready' as const,
    })),
    ...uploadItems,
  ];

  const uploadFiles = async (files: File[]) => {
    if (!appId || !conversationId || files.length === 0) return;
    if (pendingAttachments.length + uploadItems.length + files.length > 3) {
      toast.error('每轮最多附加 3 个文件');
      return;
    }
    const uploadBatch = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      name: file.name || `粘贴文件-${index + 1}`,
      sizeBytes: file.size,
      mimeType: file.type,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'uploading' as const,
      source: file,
    }));
    setUploadItems((items) => [...items, ...uploadBatch]);
    for (const upload of uploadBatch) {
      try {
        const file = upload.source;
        const result = await uploadAIAppConversationAttachment(appId, conversationId, file);
        setAttachments((items) => [...items, result.attachment]);
        if (upload.previewUrl) {
          attachmentPreviewUrlsRef.current = {
            ...attachmentPreviewUrlsRef.current,
            [result.attachment.id]: upload.previewUrl,
          };
          setAttachmentPreviewUrls((current) => ({
            ...current,
            [result.attachment.id]: upload.previewUrl as string,
          }));
        }
        setUploadItems((items) => items.filter((item) => item.id !== upload.id));
      } catch (error) {
        setUploadItems((items) =>
          items.map((item) =>
            item.id === upload.id ? { ...item, status: 'failed' as const } : item,
          ),
        );
        toast.error(getAPIErrorMessage(error, `${upload.name} 上传失败`));
      }
    }
  };

  const removePendingFile = async (file: ConversationComposerFile) => {
    if (!appId || !conversationId) return;
    if (file.id.startsWith('upload-')) {
      if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      setUploadItems((items) => items.filter((item) => item.id !== file.id));
      return;
    }
    try {
      await deleteAIAppConversationAttachment(appId, conversationId, file.id);
      setAttachments((items) => items.filter((item) => item.id !== file.id));
      const previewUrl = attachmentPreviewUrlsRef.current[file.id];
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      delete attachmentPreviewUrlsRef.current[file.id];
      setAttachmentPreviewUrls((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '移除文件失败'));
    }
  };

  const decideApproval = async (
    task: AIAppTask,
    approval: AIAppToolApproval,
    decision: 'approve' | 'reject',
  ) => {
    if (!appId) return;
    try {
      setDecidingApprovalId(approval.id);
      const result = await decideAIAppToolApproval(appId, task.id, approval.id, decision);
      setApprovals((items) =>
        items.map((item) => (item.id === approval.id ? result.approval : item)),
      );
      toast.success(decision === 'approve' ? '已允许执行' : '已拒绝执行');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '处理工具确认失败'));
    } finally {
      setDecidingApprovalId(null);
    }
  };

  const cancelTask = async (task: AIAppTask) => {
    if (!appId) return;
    try {
      setCancellingTaskId(task.id);
      await cancelAIAppTask(appId, task.id);
      setTasks((items) =>
        items.map((item) =>
          item.id === task.id
            ? { ...item, status: 'cancelled', statusMessage: '已取消任务', progress: 100 }
            : item,
        ),
      );
      taskStatusesRef.current.set(task.id, 'cancelled');
      toast.success('任务已取消');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '取消任务失败'));
    } finally {
      setCancellingTaskId(null);
    }
  };

  const saveGenerationToResources = async (visibility: SaveResourceVisibility) => {
    if (!saveTarget) return;
    try {
      setSavingImageResourceId(saveTarget.id);
      const result = await saveAIImageGenerationResource(saveTarget.id, { visibility });
      setImageGenerations((items) => ({
        ...items,
        [saveTarget.id]: { ...saveTarget, resourceId: result.resource.id },
      }));
      setSaveTarget(null);
      toast.success(visibility === 'public' ? '已保存并公开访问' : '已保存到私有资源库');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存到资源库失败'));
    } finally {
      setSavingImageResourceId(null);
    }
  };

  const send = async (contentOverride?: string) => {
    const targetConversationId = conversationId;
    const content = (contentOverride ?? input).trim();
    if (
      !appId ||
      !targetConversationId ||
      (!content && pendingAttachments.length === 0) ||
      !textModelId
    )
      return;
    const currentReferenceImages: Array<{ dataUrl: string }> = [];
    const useBackgroundTask = true;
    const currentAttachments = pendingAttachments;
    if (
      currentAttachments.some((attachment) => attachment.mimeType.startsWith('image/')) &&
      !modelSupportsImageUnderstanding(selectedConversationModel)
    ) {
      toast.error('当前对话模型不支持图片理解，请先切换为带图片理解能力的模型');
      return;
    }
    const currentAttachmentIds = currentAttachments.map((attachment) => attachment.id);
    const currentActiveSkillIds = activeSkillIds;
    const localUserMessage: AIAppConversationMessage = {
      id: `local-user-${crypto.randomUUID()}`,
      conversationId: targetConversationId,
      role: 'user',
      content,
      referenceImageCount: 0,
      imageGenerationIds: '[]',
      createdAt: new Date().toISOString(),
    };
    const pendingRunId = `pending:${targetConversationId}:${localUserMessage.id}`;
    setInput('');
    setActiveSkillIds([]);
    setMessages((items) => [...items, localUserMessage]);
    setAttachments((items) =>
      items.map((attachment) =>
        currentAttachmentIds.includes(attachment.id)
          ? { ...attachment, messageId: localUserMessage.id }
          : attachment,
      ),
    );
    if (useBackgroundTask) {
      setPendingTaskCreations((counts) => ({
        ...counts,
        [targetConversationId]: (counts[targetConversationId] ?? 0) + 1,
      }));
      const createTask = async () => {
        try {
          const result = await createAIAppConversationTask(appId, targetConversationId, {
            message: content,
            modelId: textModelId,
            activeSkillIds: currentActiveSkillIds,
            attachmentIds: currentAttachmentIds,
          });
          if (activeConversationIdRef.current === targetConversationId) {
            setMessages((items) =>
              replaceOptimisticConversationMessage(items, localUserMessage.id, result.userMessage),
            );
            setAttachments((items) =>
              items.map((attachment) =>
                currentAttachmentIds.includes(attachment.id)
                  ? { ...attachment, messageId: result.userMessage.id }
                  : attachment,
              ),
            );
            upsertRun(result.run);
          }
          setTasks((items) => [result.task, ...items.filter((item) => item.id !== result.task.id)]);
          taskStatusesRef.current.set(result.task.id, result.task.status);
          if (shouldNotifyTaskQueued(result.task)) {
            toast.success('已加入执行队列');
          }
        } catch (error) {
          if (activeConversationIdRef.current === targetConversationId) {
            setMessages((items) => items.filter((item) => item.id !== localUserMessage.id));
            setAttachments((items) =>
              items.map((attachment) =>
                currentAttachmentIds.includes(attachment.id)
                  ? { ...attachment, messageId: undefined }
                  : attachment,
              ),
            );
            setInput((current) => current || content);
          }
          toast.error(getAPIErrorMessage(error, '创建任务失败'));
        } finally {
          setPendingTaskCreations((counts) => {
            const nextCount = Math.max(0, (counts[targetConversationId] ?? 0) - 1);
            if (nextCount > 0) return { ...counts, [targetConversationId]: nextCount };
            const next = { ...counts };
            delete next[targetConversationId];
            return next;
          });
        }
      };
      const queuedCreation = taskCreationChainRef.current.then(createTask, createTask);
      taskCreationChainRef.current = queuedCreation;
      await queuedCreation;
      return;
    }
    setConversationStreams((items) => ({
      ...items,
      [targetConversationId]: {
        reply: '',
        tools: [],
        imageGenerating: false,
        startedAt: Date.now(),
      },
    }));
    const controller = new AbortController();
    streamControllersRef.current.set(targetConversationId, controller);
    const clearConversationStream = () => {
      streamControllersRef.current.delete(targetConversationId);
      setConversationStreams((items) => {
        if (!items[targetConversationId]) return items;
        const next = { ...items };
        delete next[targetConversationId];
        return next;
      });
    };
    try {
      await streamAIAppConversation(
        appId,
        targetConversationId,
        content,
        textModelId,
        {
          referenceImages: currentReferenceImages.map((item) => item.dataUrl),
          activeSkillIds: currentActiveSkillIds,
          attachmentIds: currentAttachmentIds,
        },
        {
          onDelta: (chunk) =>
            setConversationStreams((items) => {
              const current = items[targetConversationId];
              if (!current) return items;
              return {
                ...items,
                [targetConversationId]: { ...current, reply: current.reply + chunk },
              };
            }),
          onToolCall: (name, narration) =>
            setConversationStreams((items) => {
              const current = items[targetConversationId];
              if (!current) return items;
              const tool: AssistantStreamTool = {
                id: `stream-tool-${targetConversationId}-${Date.now()}-${current.tools.length}`,
                toolName: name,
                narration: narration.trim() || current.reply.trim(),
                status: 'running',
                durationMs: 0,
              };
              return {
                ...items,
                [targetConversationId]: {
                  ...current,
                  reply: '',
                  tools: [...current.tools, tool],
                  imageGenerating: name === 'image.generate',
                },
              };
            }),
          onToolResult: (name, ok, durationMs, narration) => {
            setToolTraces((items) => [
              ...items,
              {
                id: `local-tool-${targetConversationId}-${name}-${Date.now()}`,
                conversationId: targetConversationId,
                runId: pendingRunId,
                toolName: name,
                narration,
                status: ok ? 'succeeded' : 'failed',
                durationMs,
                createdAt: new Date().toISOString(),
              },
            ]);
            setConversationStreams((items) => {
              const current = items[targetConversationId];
              if (!current) return items;
              const tools = [...current.tools];
              let toolIndex = tools.length - 1;
              while (
                toolIndex >= 0 &&
                (tools[toolIndex].toolName !== name || tools[toolIndex].status !== 'running')
              ) {
                toolIndex -= 1;
              }
              if (toolIndex >= 0) {
                tools[toolIndex] = {
                  ...tools[toolIndex],
                  narration: tools[toolIndex].narration || narration,
                  status: ok ? 'succeeded' : 'failed',
                  durationMs,
                };
              }
              return {
                ...items,
                [targetConversationId]: {
                  ...current,
                  tools,
                  imageGenerating: name === 'image.generate' ? false : current.imageGenerating,
                },
              };
            });
          },
          onDone: (result) => {
            setToolTraces((items) =>
              items.map((trace) =>
                trace.runId === pendingRunId ? { ...trace, runId: result.run.id } : trace,
              ),
            );
            clearConversationStream();
            setConversations((items) => [
              result.conversation,
              ...items.filter((item) => item.id !== result.conversation.id),
            ]);
            if (activeConversationIdRef.current === targetConversationId) {
              setConversation(result.conversation);
              setMessages((items) => [
                ...items.filter(
                  (item) =>
                    item.id !== localUserMessage.id &&
                    item.id !== result.userMessage.id &&
                    item.id !== result.assistantMessage.id,
                ),
                result.userMessage,
                result.assistantMessage,
              ]);
              upsertRun(result.run);
              setAttachments((items) =>
                items.map((attachment) =>
                  currentAttachmentIds.includes(attachment.id)
                    ? { ...attachment, messageId: result.userMessage.id }
                    : attachment,
                ),
              );
              setReferencesByRunId((items) => ({
                ...items,
                [result.run.id]: result.references,
              }));
            }
          },
          onError: ({ message, run, userMessage }) => {
            setToolTraces((items) => items.filter((trace) => trace.runId !== pendingRunId));
            clearConversationStream();
            if (activeConversationIdRef.current === targetConversationId) {
              if (run) upsertRun(run);
              if (userMessage) {
                setAttachments((items) =>
                  items.map((attachment) =>
                    currentAttachmentIds.includes(attachment.id)
                      ? { ...attachment, messageId: userMessage.id }
                      : attachment,
                  ),
                );
                setMessages((items) => [
                  ...items.filter(
                    (item) => item.id !== localUserMessage.id && item.id !== userMessage.id,
                  ),
                  userMessage,
                ]);
              }
            }
            toast.error(message);
          },
        },
        controller.signal,
      );
    } catch (error) {
      setToolTraces((items) => items.filter((trace) => trace.runId !== pendingRunId));
      clearConversationStream();
      if (error instanceof DOMException && error.name === 'AbortError') {
        const cancelledRun: AIAppRun = {
          id: `local-cancelled-${Date.now()}`,
          versionId: conversation?.versionId || '',
          status: 'cancelled',
          model: '',
          input: content,
          output: '',
          errorCode: 'RUN_CANCELLED',
          durationMs: 0,
          createdAt: new Date().toISOString(),
        };
        if (activeConversationIdRef.current === targetConversationId) {
          setMessages((items) =>
            items.map((item) =>
              item.id === localUserMessage.id ? { ...item, runId: cancelledRun.id } : item,
            ),
          );
          upsertRun(cancelledRun);
        }
      } else {
        setAttachments((items) =>
          items.map((attachment) =>
            currentAttachmentIds.includes(attachment.id)
              ? { ...attachment, messageId: undefined }
              : attachment,
          ),
        );
        toast.error(getAPIErrorMessage(error, '会话发送失败'));
      }
    } finally {
      clearConversationStream();
    }
  };

  if (initialLoading) {
    return <AIAppConversationSkeleton />;
  }
  if (!conversation || !appId) return null;

  const renderConversationTask = (task: AIAppTask) => (
    <div key={task.id} className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3">
      <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
      <div
        className={cn(
          'col-start-2 min-w-0 w-full max-w-[52rem]',
          task.status === 'running' && 'hidden',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock3
            className={cn('size-4 text-primary', task.status === 'running' && 'animate-spin')}
          />
          {task.status === 'waiting_approval' ? '等待你的确认' : '正在后台执行'}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {task.statusMessage || '可以离开当前页面，任务会继续运行。'}
        </p>
      </div>
      {task.status === 'running' ? (
        <div className="col-start-2 min-w-0 w-full max-w-[52rem]">
          <AssistantActiveExecution
            startedAt={new Date(task.startedAt || task.createdAt).getTime()}
            reply={task.partialOutput}
            tools={toolTraces
              .filter((trace) => trace.runId === task.runId)
              .map((trace) => ({ ...trace, narration: trace.narration || '' }))}
          >
            {task.statusMessage.includes('图片') ? (
              <div className="w-[min(100%,20rem)] pt-1">
                <GenerationPreview compact stage="generating" />
              </div>
            ) : null}
          </AssistantActiveExecution>
        </div>
      ) : null}
      <div className="col-start-2 min-w-0 w-full max-w-[52rem]">
        {approvals
          .filter((approval) => approval.taskId === task.id && approval.status === 'pending')
          .map((approval) => (
            <div key={approval.id} className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{approval.toolName}</span>
                <Badge variant="outline">
                  {approval.riskLevel === 'high'
                    ? '高风险'
                    : approval.riskLevel === 'medium'
                      ? '中风险'
                      : '低风险'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{approval.summary}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={decidingApprovalId === approval.id}
                  onClick={() => void decideApproval(task, approval, 'approve')}
                >
                  允许执行
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decidingApprovalId === approval.id}
                  onClick={() => void decideApproval(task, approval, 'reject')}
                >
                  拒绝
                </Button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  const conversationComposer = (className?: string) => (
    <ConversationComposer
      value={input}
      onValueChange={setInput}
      onSubmit={() => void send()}
      onStop={currentExecutingTask ? () => void cancelTask(currentExecutingTask) : undefined}
      stopDisabled={cancellingTaskId === currentExecutingTask?.id}
      canSubmit={Boolean(textModelId) && uploadItems.length === 0}
      placeholder="继续对话，粘贴或附加文件，也可以只发送附件"
      skills={boundSkills}
      activeSkillId={activeSkillIds[0]}
      onActiveSkillChange={(skillId) => setActiveSkillIds(skillId ? [skillId] : [])}
      emptySkillAction={{ onClick: () => navigate(`/workbench/apps/${appId}/settings`) }}
      files={composerFiles}
      onFilesSelected={(files) => void uploadFiles(files)}
      onFileRemove={(file) => void removePendingFile(file)}
      footer={
        <>
          <ConversationModelControl
            value={textModelId}
            defaultValue={conversationConfig.modelId}
            onValueChange={setTextModelId}
            onModelChange={setSelectedConversationModel}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Enter 发送 · Shift + Enter 换行
          </span>
        </>
      }
      className={cn('max-w-[60rem]', className)}
      revealAttribute="composer"
      presentation="workspace"
    />
  );

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/workbench')}
            aria-label="返回工作台"
            title="返回工作台"
          >
            <ArrowLeft />
          </Button>
          <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} className="size-7" />
          <h1 className="truncate text-sm font-semibold tracking-tight">
            {app?.name || conversation.title}
          </h1>
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            <span className="size-1.5 rounded-full bg-primary" />
            {app?.status === 'published' ? '已发布' : '草稿'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => void createConversation()}
          >
            <MessageCirclePlus data-icon="inline-start" />
            新建会话
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex"
            onClick={openConfiguration}
          >
            <Settings2 data-icon="inline-start" />
            配置
          </Button>
          <Button
            size="sm"
            className="hidden lg:inline-flex"
            onClick={() => setPublishDialogOpen(true)}
            disabled={publishing}
          >
            {publishing ? '发布中…' : '发布'}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileActionsOpen(true)}
            aria-label="会话操作"
            title="会话操作"
          >
            <Ellipsis />
          </Button>
        </div>
      </header>
      <div className="relative grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground lg:flex">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">会话历史</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{conversations.length} 个会话</p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              className="shrink-0 bg-sidebar"
              onClick={() => void createConversation()}
              aria-label="新建会话"
              title="新建会话"
            >
              <MessageCirclePlus />
            </Button>
          </div>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={conversationQuery}
              onChange={(event) => updateConversationQuery(event.target.value)}
              placeholder="搜索会话"
              aria-label="搜索会话"
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="mt-5 flex items-center justify-between px-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              最近
            </p>
            {conversationQuery ? (
              <Button
                variant="ghost"
                size="xs"
                className="h-6 px-2 text-[11px]"
                onClick={() => updateConversationQuery('')}
              >
                清除
              </Button>
            ) : null}
          </div>
          <ScrollArea className="mt-2 min-h-36 flex-1">
            <div className="flex flex-col gap-2 pr-2">
              {visibleConversations.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative flex min-h-[4.25rem] items-center rounded-xl border border-transparent transition-[background-color,border-color,box-shadow] hover:border-sidebar-border hover:bg-sidebar-accent/70 focus-within:border-sidebar-ring/30 focus-within:bg-sidebar-accent',
                    item.id === conversationId &&
                      'border-primary/20 bg-primary/5 text-sidebar-accent-foreground shadow-xs before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r-full before:bg-primary',
                  )}
                >
                  <ConversationDeletingOverlay active={deletingConversationId === item.id} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-w-0 flex-1 justify-start gap-3 bg-transparent px-3 py-2.5 text-left font-normal hover:bg-transparent"
                    onClick={() => {
                      if (deletingConversationId !== item.id)
                        navigate(`/workbench/apps/${appId}/conversations/${item.id}`);
                    }}
                    aria-current={item.id === conversationId ? 'page' : undefined}
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border/70 transition-colors',
                        item.id === conversationId && 'bg-primary/10 text-primary ring-primary/20',
                      )}
                    >
                      <MessageSquareText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em]">
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {tasks.some(
                          (task) => task.conversationId === item.id && isTaskActive(task),
                        ) ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                            生成中
                          </span>
                        ) : (
                          formatConversationUpdatedAt(item.updatedAt)
                        )}
                        {item.id === conversationId ? (
                          <span className="shrink-0 font-medium text-primary">当前</span>
                        ) : null}
                      </span>
                    </span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className={cn(
                            'mr-1 shrink-0 opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100',
                            item.id === conversationId && 'opacity-70',
                          )}
                          aria-label="会话操作"
                          title="会话操作"
                        >
                          <Ellipsis />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/workbench/apps/${appId}/conversations/${item.id}`)
                        }
                      >
                        打开会话
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={
                          deletingConversationId !== null ||
                          tasks.some(
                            (task) => task.conversationId === item.id && isTaskActive(task),
                          )
                        }
                        onClick={() => void removeConversation(item)}
                      >
                        <Trash2 />
                        {deletingConversationId === item.id ? '删除中…' : '删除会话'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {visibleConversations.length === 0 ? (
                <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-8 text-center">
                  <MessageSquareText className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-xs font-medium">没有匹配的会话</p>
                  <Button
                    variant="link"
                    size="xs"
                    className="mt-1"
                    onClick={() => updateConversationQuery('')}
                  >
                    清除搜索
                  </Button>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <Separator className="my-3 bg-sidebar-border" />
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 p-3">
            <AgentAvatar
              name={app?.name || '智能体'}
              src={app?.avatarUrl}
              className="size-8 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{app?.name || '当前智能体'}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">仅自己可见</p>
            </div>
          </div>
        </aside>
        <section
          className="relative flex min-h-0 flex-col bg-background"
          aria-busy={conversationLoading}
        >
          {conversationLoading ? (
            <ConversationContentSkeleton />
          ) : (
            <>
              <div
                ref={conversationScrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                data-conversation-scroll-viewport
              >
                <div className="mx-auto flex min-h-full w-full max-w-[64rem] flex-col gap-7 px-6 py-8 sm:px-8 lg:py-10">
                  {messages.length === 0 ? (
                    <div
                      ref={welcomeRef}
                      className="flex w-full max-w-[52rem] flex-1 flex-col items-center justify-center py-10 text-center sm:py-14"
                    >
                      <div className="max-w-2xl" data-agent-reveal="intro">
                        <AgentAvatar
                          name={app?.name || '智能体'}
                          src={app?.avatarUrl}
                          className="mx-auto size-20 border-4 border-background shadow-sm"
                        />
                        <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                          让 {app?.name || '智能伙伴'} 帮你做点什么？
                        </h2>
                      </div>
                      <div
                        className="relative mt-10 w-full max-w-[48rem]"
                        data-agent-reveal="composer"
                      >
                        {conversationComposer()}
                      </div>
                      <div
                        className="mt-8 flex max-w-[48rem] flex-wrap justify-center gap-2"
                        data-agent-reveal="quick-start"
                      >
                        {boundSkills.length > 0
                          ? boundSkills.slice(0, 5).map((skill) => (
                              <Button
                                key={skill.id}
                                size="sm"
                                variant={activeSkillIds[0] === skill.id ? 'secondary' : 'outline'}
                                className="rounded-full font-normal"
                                onClick={() => setActiveSkillIds([skill.id])}
                                data-agent-quick-prompt
                              >
                                {skill.name}
                              </Button>
                            ))
                          : starterQuestions.slice(0, 4).map((prompt) => (
                              <Button
                                key={prompt}
                                size="sm"
                                variant={input === prompt ? 'secondary' : 'outline'}
                                className="rounded-full font-normal"
                                onClick={() => setInput(prompt)}
                                data-agent-quick-prompt
                              >
                                {prompt}
                              </Button>
                            ))}
                      </div>
                    </div>
                  ) : (
                    orderedMessages.map((message, index) => {
                      const run = message.runId
                        ? (runs.find((item) => item.id === message.runId) ?? null)
                        : null;
                      const messageTraces = run
                        ? toolTraces.filter((trace) => trace.runId === run.id)
                        : [];
                      const messageReferences = run ? referencesByRunId[run.id] || [] : [];
                      const messageAttachments = attachments.filter(
                        (attachment) => attachment.messageId === message.id,
                      );
                      const messageArtifacts = run
                        ? artifacts.filter((artifact) => artifact.runId === run.id)
                        : [];
                      const visibleMessageReferences = shouldShowAssistantExecutionReferences(
                        run,
                        messageReferences,
                      )
                        ? messageReferences
                        : [];
                      const hasExecutionDetails = hasAssistantExecutionDetails(
                        messageTraces,
                        visibleMessageReferences,
                      );
                      const failedRun = isAssistantRunFailure(run) ? run : null;
                      const messageTask = message.runId
                        ? tasksByRunId.get(message.runId)
                        : undefined;
                      const hasEarlierPendingMessage = orderedMessages
                        .slice(0, index)
                        .some((candidate) => {
                          if (candidate.role !== 'user') return false;
                          if (candidate.id.startsWith('local-user-')) return true;
                          if (!candidate.runId) return false;
                          const candidateTask = tasksByRunId.get(candidate.runId);
                          const candidateRun = runs.find((item) => item.id === candidate.runId);
                          return isConversationUserMessagePending({
                            isLocalPending: candidate.id.startsWith('local-user-'),
                            hasAssistantMessage: hasAssistantMessageForRun(
                              messages,
                              candidate.runId,
                            ),
                            taskStatus: candidateTask?.status,
                            runStatus: candidateRun?.status,
                          });
                        });
                      const showWaitingIndicator =
                        message.role === 'user' &&
                        shouldShowMessageWaitingIndicator({
                          taskStatus: messageTask?.status,
                          queuePosition: messageTask?.queuePosition,
                          hasEarlierPendingMessage,
                        });
                      const renderedMessageTask = message.runId
                        ? renderedTasksByRunId.get(message.runId)
                        : undefined;
                      const showStartingIndicator =
                        message.role === 'user' &&
                        !hasEarlierPendingMessage &&
                        !renderedMessageTask &&
                        ((message.id.startsWith('local-user-') && creatingTask) ||
                          (messageTask?.status === 'queued' &&
                            (messageTask.queuePosition ?? 0) === 0));
                      return (
                        <Fragment key={message.id}>
                          <div className={cn(message.role === 'assistant' && 'space-y-3')}>
                            <div
                              className={cn(
                                'flex items-start gap-3',
                                message.role === 'user' && 'flex-row-reverse',
                              )}
                            >
                              {message.role === 'user' ? (
                                <Avatar className="size-8 shrink-0 ring-1 ring-border/70">
                                  {currentUser?.avatar ? (
                                    <AvatarImage
                                      src={currentUser.avatar}
                                      alt={`${currentUser.nickname || currentUser.username || '用户'}的头像`}
                                      className="object-cover"
                                    />
                                  ) : null}
                                  <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                                    {currentUser?.nickname?.trim().slice(0, 1) ||
                                      currentUser?.username?.trim().slice(0, 1) || (
                                        <UserRound className="size-4" />
                                      )}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
                              )}
                              <ConversationMessageBubble
                                role={message.role}
                                content={message.content}
                                citations={message.role === 'assistant' ? messageReferences : []}
                                onCitationClick={() => navigate('/workbench/knowledge')}
                                createdAt={message.createdAt}
                                showActions={index === orderedMessages.length - 1}
                                presentation="workspace"
                                header={
                                  message.role === 'user' && messageAttachments.length > 0 ? (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {messageAttachments.map((attachment) => (
                                        <ConversationAttachmentCard
                                          key={attachment.id}
                                          name={attachment.name}
                                          mimeType={attachment.mimeType}
                                          sizeBytes={attachment.sizeBytes}
                                          previewUrl={attachmentPreviewUrls[attachment.id]}
                                          secondary={new Intl.DateTimeFormat('zh-CN', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }).format(new Date(attachment.createdAt))}
                                          onOpen={() =>
                                            void downloadAIAppConversationAttachment(
                                              appId,
                                              conversation.id,
                                              attachment,
                                            ).catch((error) =>
                                              toast.error(
                                                getAPIErrorMessage(error, '下载文件失败'),
                                              ),
                                            )
                                          }
                                        />
                                      ))}
                                    </div>
                                  ) : message.role === 'assistant' && hasExecutionDetails ? (
                                    <AssistantExecutionHeader
                                      run={run}
                                      traces={messageTraces}
                                      references={messageReferences}
                                      onReferenceOpen={() => navigate('/workbench/knowledge')}
                                    />
                                  ) : undefined
                                }
                                className={
                                  message.role === 'assistant'
                                    ? '!max-w-[min(94%,52rem)]'
                                    : '!max-w-[min(82%,40rem)]'
                                }
                              >
                                {showWaitingIndicator ? (
                                  <div
                                    className={cn(
                                      'flex justify-end',
                                      message.content.trim() && 'mt-2',
                                    )}
                                  >
                                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-xs leading-4 text-muted-foreground shadow-sm ring-1 ring-border/60">
                                      <AgentAvatar
                                        name={app?.name || '智能体'}
                                        src={app?.avatarUrl}
                                        className="size-4"
                                      />
                                      <span className="truncate">等待 {app?.name || '智能体'}</span>
                                    </span>
                                  </div>
                                ) : null}
                              </ConversationMessageBubble>
                            </div>
                            {message.role === 'assistant'
                              ? parseImageGenerationIDs(message.imageGenerationIds).map(
                                  (generationID) => {
                                    const generation = imageGenerations[generationID];
                                    if (!generation?.resultUrl) return null;
                                    return (
                                      <div
                                        key={generationID}
                                        className="ml-11 w-[calc(100%-2.75rem)] max-w-[42rem] overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xs"
                                      >
                                        <button
                                          type="button"
                                          className="block w-full cursor-zoom-in overflow-hidden rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
                                          onClick={() =>
                                            setImagePreview({
                                              src: generation.resultUrl,
                                              title: '智能体生成图片预览',
                                            })
                                          }
                                          aria-label="预览智能体生成图片"
                                        >
                                          <AIImageGenerationImage
                                            generationId={generation.id}
                                            src={generation.resultUrl}
                                            alt="智能体生成的图片"
                                            className="w-full object-cover"
                                            style={{
                                              aspectRatio: generation.aspectRatio.replace(
                                                ':',
                                                ' / ',
                                              ),
                                            }}
                                          />
                                        </button>
                                        <div className="flex flex-col gap-2 px-1 pt-2 text-xs text-muted-foreground">
                                          <span>
                                            智能体生成 · {generation.aspectRatio} ·{' '}
                                            {generation.quality}
                                          </span>
                                          <AIImageResultActions
                                            onRegenerate={() =>
                                              void send(
                                                '请重新生成刚才这张图片，保持相同的主体、构图和比例。',
                                              )
                                            }
                                            onDownload={() =>
                                              window.open(
                                                generation.resultUrl,
                                                '_blank',
                                                'noopener,noreferrer',
                                              )
                                            }
                                            onContinueEdit={() => navigate('/workbench/images')}
                                            onSave={() => setSaveTarget(generation)}
                                            regenerating={sending}
                                            saving={savingImageResourceId === generation.id}
                                            saved={Boolean(generation.resourceId)}
                                          />
                                        </div>
                                      </div>
                                    );
                                  },
                                )
                              : null}
                            {message.role === 'assistant' && messageArtifacts.length > 0 ? (
                              <div className="ml-11 grid w-[calc(100%-2.75rem)] max-w-[42rem] gap-2 sm:grid-cols-2">
                                {messageArtifacts.map((artifact) => (
                                  <ConversationAttachmentCard
                                    key={artifact.id}
                                    name={artifact.fileName}
                                    mimeType={artifact.contentType}
                                    sizeBytes={artifact.sizeBytes}
                                    secondary="成果文件"
                                    onOpen={() =>
                                      window.open(artifact.url, '_blank', 'noopener,noreferrer')
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                            {failedRun ? (
                              <AssistantFailureState
                                agentName={app?.name || '智能体'}
                                avatarUrl={app?.avatarUrl}
                                cancelled={failedRun.status === 'cancelled'}
                                message={formatRunFailure(failedRun)}
                              />
                            ) : null}
                          </div>
                          {renderedMessageTask ? (
                            renderConversationTask(renderedMessageTask)
                          ) : showStartingIndicator ? (
                            <div className="flex items-start gap-3">
                              <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
                              <AssistantActiveExecution
                                startedAt={new Date(message.createdAt).getTime()}
                                reply=""
                                tools={[]}
                              />
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </div>
              </div>
              {messages.length > 0 ? (
                <div className="shrink-0 bg-background px-5 py-3 sm:px-8 sm:py-4">
                  <div className="mx-auto w-full max-w-[60rem]">{conversationComposer()}</div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布智能体</DialogTitle>
            <DialogDescription>将当前草稿设为可用版本。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              取消
            </Button>
            <Button
              disabled={publishing}
              onClick={() => {
                void publish().then((succeeded) => {
                  if (succeeded) setPublishDialogOpen(false);
                });
              }}
            >
              {publishing ? '发布中…' : '确认发布'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImagePreviewDialog
        open={Boolean(imagePreview)}
        src={imagePreview?.src}
        title={imagePreview?.title}
        onOpenChange={(open) => {
          if (!open) setImagePreview(null);
        }}
      />
      <SaveResourceDialog
        open={Boolean(saveTarget)}
        onOpenChange={(open) => {
          if (!open && !savingImageResourceId) setSaveTarget(null);
        }}
        pending={Boolean(savingImageResourceId)}
        onConfirm={saveGenerationToResources}
      />
      <Drawer
        open={mobileActionsOpen}
        onOpenChange={setMobileActionsOpen}
        showSwipeHandle
        swipeDirection="down"
      >
        <DrawerContent className="lg:hidden">
          <DrawerHeader>
            <DrawerTitle>会话操作</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => {
                setMobileActionsOpen(false);
                void createConversation();
              }}
            >
              <MessageCirclePlus />
              新建会话
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => {
                setMobileActionsOpen(false);
                openConfiguration();
              }}
            >
              <Settings2 />
              配置智能体
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 py-4"
              onClick={() => {
                setMobileActionsOpen(false);
                setPublishDialogOpen(true);
              }}
            >
              <Send />
              发布
            </Button>
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setMobileActionsOpen(false)}>
              取消
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
