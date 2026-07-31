import { gsap } from 'gsap';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Ellipsis,
  History,
  MessageCirclePlus,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Search,
  Send,
  Settings2,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import { type AIImageGeneration, getAIImageGeneration } from '@/api/aiImages';
import {
  type AgentConfig,
  type AIApp,
  type AIAppConversation,
  type AIAppConversationMessage,
  type AIAppConversationToolTrace,
  type AIAppRun,
  type AIAppVersion,
  type AIKnowledgeReference,
  type AISkill,
  createAIAppConversation,
  deleteAIAppConversation,
  getAIApp,
  getAIAppConversation,
  getAPIErrorMessage,
  listAIAppConversations,
  listAISkills,
  publishAIApp,
  saveAIAppVersion,
  streamAIAppConversation,
} from '@/api/aiWorkbench';
import {
  ConversationComposer,
  type ConversationComposerReferenceImage,
} from '@/components/ai/ConversationComposer';
import { ConversationMessageBubble } from '@/components/ai/ConversationMessageBubble';
import { AIImageGenerationImage } from '@/components/ai-images/AIImageGenerationImage';
import { GenerationPreview } from '@/components/ai-images/GenerationOverlay';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import { AIResponseContext } from '@/components/ai-workbench/AIResponseContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const quickPrompts = [
  '介绍一下你的能力',
  '根据资料库回答一个问题',
  '帮我梳理当前任务',
  '给我一个开始建议',
];

const defaultConfig: AgentConfig = {
  modelProfile: 'ark-text-default',
  systemPrompt: '',
  openingMessage: '',
  exampleQuestions: [],
  skillIds: [],
};

type ConversationStreamState = {
  reply: string;
  toolStatus: string | null;
  imageGenerating: boolean;
};

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

function parseAgentConfig(version?: AIAppVersion): AgentConfig {
  try {
    const parsed = JSON.parse(version?.config || '{}') as Partial<AgentConfig>;
    return {
      modelProfile: 'ark-text-default',
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
    case 'APP_CONFIG_INVALID':
      return '智能体版本配置无效';
    case 'AI_AGENT_RUN_FAILED':
      return '智能体调用失败';
    default:
      return run.status === 'cancelled' ? '已停止生成' : '本次回复未完成';
  }
}

function ConversationModelControl({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (modelID: string) => void;
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

  useEffect(() => {
    if (!value && models[0]) onValueChange(models[0].id);
  }, [models, onValueChange, value]);

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
            <span className="max-w-44 truncate">{label}</span>
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
        <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col gap-7 px-6 py-10 sm:px-8 lg:py-12">
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
      <div className="mx-auto w-full max-w-[46rem] px-5 pb-6 pt-3 sm:px-8" aria-hidden="true">
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
      <div className="grid min-h-0 flex-1 lg:grid-cols-[18rem_minmax(0,1fr)_2.75rem]">
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
            <div className="mx-auto flex w-full max-w-[46rem] flex-col gap-5 px-6 py-10 sm:px-8">
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
        <aside className="relative hidden border-l border-border/70 lg:block">
          <Skeleton className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </aside>
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
  const [conversations, setConversations] = useState<AIAppConversation[]>([]);
  const [app, setApp] = useState<AIApp | null>(null);
  const [conversation, setConversation] = useState<AIAppConversation | null>(null);
  const [versions, setVersions] = useState<AIAppVersion[]>([]);
  const [draftVersionId, setDraftVersionId] = useState('');
  const [messages, setMessages] = useState<AIAppConversationMessage[]>([]);
  const [toolTraces, setToolTraces] = useState<AIAppConversationToolTrace[]>([]);
  const [runs, setRuns] = useState<AIAppRun[]>([]);
  const [references, setReferences] = useState<AIKnowledgeReference[]>([]);
  const [input, setInput] = useState('');
  const [referenceImages, setReferenceImages] = useState<ConversationComposerReferenceImage[]>([]);
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([]);
  const [imageGenerations, setImageGenerations] = useState<Record<string, AIImageGeneration>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationStreams, setConversationStreams] = useState<
    Record<string, ConversationStreamState>
  >({});
  const [textModelId, setTextModelId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const streamControllersRef = useRef(new Map<string, AbortController>());
  const activeConversationIdRef = useRef(conversationId);
  const loadedAppIdRef = useRef<string | null>(null);
  const settingsOpenRef = useRef(false);
  const welcomeRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLElement | null>(null);
  activeConversationIdRef.current = conversationId;

  const activeStream = conversationId ? conversationStreams[conversationId] : undefined;
  const sending = Boolean(activeStream);
  const streamingReply = activeStream?.reply || '';
  const toolStatus = activeStream?.toolStatus || null;
  const conversationConfig = parseAgentConfig(
    versions.find((item) => item.id === conversation?.versionId),
  );
  const boundSkills = skills.filter((skill) => conversationConfig.skillIds.includes(skill.id));

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
    void Promise.all(
      pending.map((id) => getAIImageGeneration(id).then((result) => result.generation)),
    )
      .then((items) => {
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
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  useEffect(
    () => () => {
      for (const controller of streamControllersRef.current.values()) controller.abort();
      streamControllersRef.current.clear();
    },
    [],
  );

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
          if (!settingsOpenRef.current) {
            setName(detail.app.name);
            setDescription(detail.app.description);
            setConfig(
              parseAgentConfig(
                detail.versions.find((item) => item.id === detail.app.draftVersionId) ??
                  detail.versions[0],
              ),
            );
          }
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
    setReferences([]);
    getAIAppConversation(appId, conversationId)
      .then((result) => {
        if (!active) return;
        loadedAppIdRef.current = appId;
        setConversation(result.conversation);
        setMessages(result.messages);
        setToolTraces(result.toolTraces);
        setRuns(result.runs);
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
    if (initialLoading || !conversation || messages.length > 0 || !welcomeRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { duration: 0.52, ease: 'power2.out' },
      });
      timeline
        .fromTo(
          '[data-agent-reveal="intro"]',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, clearProps: 'all' },
        )
        .fromTo(
          '[data-agent-reveal="meta"]',
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, clearProps: 'all' },
          '-=0.32',
        )
        .fromTo(
          '[data-agent-reveal="composer"]',
          { autoAlpha: 0, scale: 0.985, y: 12 },
          { autoAlpha: 1, scale: 1, y: 0, clearProps: 'all' },
          '-=0.3',
        )
        .fromTo(
          '[data-agent-reveal="quick-start"]',
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, clearProps: 'all' },
          '-=0.28',
        )
        .fromTo(
          '[data-agent-quick-prompt]',
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
    }, welcomeRef);
    return () => context.revert();
  }, [conversation, initialLoading, messages.length]);

  useEffect(() => {
    if (!inspectorOpen || !inspectorRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        inspectorRef.current,
        { autoAlpha: 0, x: 24 },
        { autoAlpha: 1, x: 0, duration: 0.34, ease: 'power2.out', clearProps: 'all' },
      );
    }, inspectorRef);
    return () => context.revert();
  }, [inspectorOpen]);

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
    if (!appId || deletingConversationId || streamControllersRef.current.has(String(target.id)))
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

  const saveSettings = async (): Promise<AIAppVersion | null> => {
    if (!appId || !name.trim()) {
      toast.error('请输入智能体名称');
      return null;
    }
    try {
      setSavingSettings(true);
      const { version } = await saveAIAppVersion(appId, {
        name: name.trim(),
        description: description.trim(),
        config,
      });
      setVersions((items) => [version, ...items.filter((item) => item.id !== version.id)]);
      setDraftVersionId(version.id);
      setApp((current) =>
        current
          ? {
              ...current,
              name: name.trim(),
              description: description.trim(),
              draftVersionId: version.id,
            }
          : current,
      );
      toast.success(`已保存草稿 v${version.number}`);
      return version;
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存草稿失败'));
      return null;
    } finally {
      setSavingSettings(false);
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

  const stop = () => {
    if (conversationId) streamControllersRef.current.get(conversationId)?.abort();
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
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setInspectorOpen(true);
      return;
    }
    setSettingsOpen(true);
  };

  const send = async () => {
    const targetConversationId = conversationId;
    if (
      !appId ||
      !targetConversationId ||
      !input.trim() ||
      !textModelId ||
      streamControllersRef.current.has(targetConversationId)
    )
      return;
    const content = input.trim();
    const currentReferenceImages = referenceImages;
    const currentActiveSkillIds = activeSkillIds;
    const localUserMessage: AIAppConversationMessage = {
      id: `local-user-${Date.now()}`,
      conversationId: targetConversationId,
      role: 'user',
      content,
      referenceImageCount: currentReferenceImages.length,
      imageGenerationIds: '[]',
      createdAt: new Date().toISOString(),
    };
    setInput('');
    setReferenceImages([]);
    setActiveSkillIds([]);
    setMessages((items) => [...items, localUserMessage]);
    setReferences([]);
    setConversationStreams((items) => ({
      ...items,
      [targetConversationId]: { reply: '', toolStatus: null, imageGenerating: false },
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
          onToolCall: (name) =>
            setConversationStreams((items) => {
              const current = items[targetConversationId];
              if (!current) return items;
              return {
                ...items,
                [targetConversationId]: {
                  ...current,
                  toolStatus:
                    name === 'content.search'
                      ? '正在搜索内容'
                      : name === 'image.generate'
                        ? '正在生成图片'
                        : '正在调用工具',
                  imageGenerating: name === 'image.generate',
                },
              };
            }),
          onToolResult: (name, ok) => {
            setConversationStreams((items) => {
              const current = items[targetConversationId];
              if (!current) return items;
              return {
                ...items,
                [targetConversationId]: {
                  ...current,
                  toolStatus:
                    name === 'content.search' ? (ok ? '内容搜索完成' : '内容搜索失败') : null,
                  imageGenerating: name === 'image.generate' ? false : current.imageGenerating,
                },
              };
            });
          },
          onDone: (result) => {
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
              setReferences(result.references);
            }
          },
          onError: ({ message, run, userMessage }) => {
            clearConversationStream();
            if (activeConversationIdRef.current === targetConversationId) {
              if (run) upsertRun(run);
              if (userMessage) {
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

  const conversationComposer = (className?: string) => (
    <ConversationComposer
      value={input}
      onValueChange={setInput}
      onSubmit={() => void send()}
      disabled={sending}
      canSubmit={Boolean(textModelId)}
      placeholder="继续对话，输入 / 选择技能，或附加参考图"
      skills={boundSkills}
      activeSkillId={activeSkillIds[0]}
      onActiveSkillChange={(skillId) => setActiveSkillIds(skillId ? [skillId] : [])}
      referenceImages={referenceImages}
      onReferenceImagesChange={setReferenceImages}
      footer={
        <>
          <ConversationModelControl value={textModelId} onValueChange={setTextModelId} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Enter 发送 · Shift + Enter 换行
          </span>
        </>
      }
      onStop={stop}
      className={cn('max-w-[42rem]', className)}
      revealAttribute="composer"
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
            <div className="flex flex-col gap-1.5 pr-2">
              {visibleConversations.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative flex min-h-14 items-center rounded-lg border border-transparent transition-colors hover:bg-sidebar-accent focus-within:bg-sidebar-accent',
                    item.id === conversationId &&
                      'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-xs before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
                  )}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-w-0 flex-1 justify-start gap-2.5 bg-transparent px-2.5 py-2 text-left font-normal hover:bg-transparent"
                    onClick={() => navigate(`/workbench/apps/${appId}/conversations/${item.id}`)}
                    aria-current={item.id === conversationId ? 'page' : undefined}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border/70',
                        item.id === conversationId && 'text-foreground',
                      )}
                    >
                      <MessageSquareText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {item.title}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {conversationStreams[item.id] ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                            生成中
                          </span>
                        ) : (
                          formatConversationUpdatedAt(item.updatedAt)
                        )}
                        {item.id === conversationId ? (
                          <Badge
                            variant="secondary"
                            className="h-4 shrink-0 px-1 text-[9px] leading-none"
                          >
                            当前
                          </Badge>
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
                          className="mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
                          deletingConversationId !== null || Boolean(conversationStreams[item.id])
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
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col gap-7 px-6 py-10 sm:px-8 lg:py-12">
                  {messages.length === 0 ? (
                    <div
                      ref={welcomeRef}
                      className="flex w-full max-w-[42rem] flex-1 flex-col items-start justify-center gap-5 py-10 text-left sm:py-14"
                    >
                      <div data-agent-reveal="intro">
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                          你好，我是 {app?.name || '智能体'}
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                          {conversationConfig.openingMessage || '有什么想一起完成的？'}
                        </p>
                      </div>
                      <div
                        className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-border bg-card text-left shadow-xs sm:grid-cols-3"
                        data-agent-reveal="meta"
                      >
                        <div className="border-b border-border px-3 py-3 sm:border-b-0 sm:border-r">
                          <p className="text-xs text-muted-foreground">智能体</p>
                          <p className="mt-1 truncate text-sm font-medium">
                            {app?.name || '当前智能体'}
                          </p>
                        </div>
                        <div className="border-r border-border px-3 py-3">
                          <p className="text-xs text-muted-foreground">会话</p>
                          <p className="mt-1 truncate text-sm font-medium">{conversation.title}</p>
                        </div>
                        <div className="px-3 py-3">
                          <p className="text-xs text-muted-foreground">访问范围</p>
                          <p className="mt-1 text-sm font-medium">仅自己可见</p>
                        </div>
                      </div>
                      {conversationComposer('mt-1')}
                      <div className="w-full pt-1 text-left">
                        <div
                          className="mb-2 flex items-center justify-between"
                          data-agent-reveal="quick-start"
                        >
                          <p className="text-sm font-medium">快速开始</p>
                          <span className="text-xs text-muted-foreground">选择一个任务</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {starterQuestions.map((prompt) => (
                            <Button
                              key={prompt}
                              size="sm"
                              variant={input === prompt ? 'secondary' : 'outline'}
                              className="h-auto min-h-16 min-w-0 justify-start overflow-hidden rounded-lg px-3 py-3 text-left leading-5 font-normal whitespace-normal break-words transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                              onClick={() => setInput(prompt)}
                              data-agent-quick-prompt
                            >
                              {prompt}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => {
                        const run = message.runId
                          ? runs.find((item) => item.id === message.runId)
                          : null;
                        const failedRun = run && run.status !== 'succeeded' ? run : null;
                        return (
                          <Fragment key={message.id}>
                            <div
                              className={cn(
                                'flex items-start gap-3',
                                message.role === 'user' && 'flex-row-reverse',
                              )}
                            >
                              {message.role === 'user' ? (
                                <Avatar>
                                  <AvatarFallback>
                                    <UserRound />
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
                              )}
                              <ConversationMessageBubble
                                role={message.role}
                                content={message.content}
                                createdAt={message.createdAt}
                                footer={
                                  message.role === 'user' && message.referenceImageCount > 0 ? (
                                    <Badge variant="secondary" className="font-normal">
                                      附加 {message.referenceImageCount} 张参考图
                                    </Badge>
                                  ) : undefined
                                }
                              />
                            </div>
                            {message.role === 'assistant'
                              ? parseImageGenerationIDs(message.imageGenerationIds).map(
                                  (generationID) => {
                                    const generation = imageGenerations[generationID];
                                    if (!generation?.resultUrl) return null;
                                    return (
                                      <div
                                        key={generationID}
                                        className="ml-11 max-w-[min(85%,28rem)] overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xs"
                                      >
                                        <AIImageGenerationImage
                                          generationId={generation.id}
                                          src={generation.resultUrl}
                                          alt="智能体生成的图片"
                                          className="aspect-square w-full rounded-lg object-cover"
                                        />
                                        <div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs text-muted-foreground">
                                          <span>
                                            智能体生成 · {generation.aspectRatio} ·{' '}
                                            {generation.quality}
                                          </span>
                                          <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => navigate('/workbench/images')}
                                          >
                                            继续编辑
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  },
                                )
                              : null}
                            {failedRun ? (
                              <div className="flex items-start gap-3" role="status">
                                <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
                                <div className="max-w-[min(85%,42rem)] rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                      {failedRun.status === 'cancelled' ? '已停止' : '未完成'}
                                    </Badge>
                                    {failedRun.errorCode ? (
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {failedRun.errorCode}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1">{formatRunFailure(failedRun)}</p>
                                </div>
                              </div>
                            ) : null}
                          </Fragment>
                        );
                      })}
                      {sending ? (
                        <div className="flex items-start gap-3">
                          <AgentAvatar name={app?.name || '智能体'} src={app?.avatarUrl} />
                          {activeStream?.imageGenerating ? (
                            <div className="w-[min(100%,20rem)] rounded-xl border border-border/70 bg-card p-3">
                              <GenerationPreview compact stage="generating" />
                            </div>
                          ) : (
                            <div className="max-w-[min(85%,42rem)] rounded-xl bg-muted px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                              {streamingReply || '正在思考…'}
                            </div>
                          )}
                        </div>
                      ) : null}
                      <AIResponseContext
                        className="ml-11 max-w-[min(85%,42rem)]"
                        toolStatus={toolStatus}
                        toolTraces={toolTraces.map((trace) => ({
                          id: trace.id,
                          name: trace.toolName,
                          status: trace.status === 'succeeded' ? 'succeeded' : 'failed',
                          durationMs: trace.durationMs,
                        }))}
                        references={references}
                      />
                    </>
                  )}
                </div>
              </div>
              {messages.length > 0 ? (
                <div className="mx-auto w-full max-w-[46rem] px-5 pb-6 pt-3 sm:px-8">
                  {conversationComposer()}
                </div>
              ) : null}
            </>
          )}
        </section>
        {inspectorOpen ? (
          <aside
            ref={inspectorRef}
            className="absolute inset-y-0 right-0 z-20 hidden min-h-0 w-[22rem] flex-col border-l border-border/70 bg-background shadow-lg lg:flex"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-5">
              <div>
                <p className="text-sm font-semibold">配置智能体</p>
                <p className="mt-0.5 text-xs text-muted-foreground">当前草稿</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setInspectorOpen(false)}
                aria-label="收起配置面板"
                title="收起配置面板"
              >
                <X />
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="divide-y divide-border/70">
                <section className="space-y-4 p-5">
                  <div>
                    <p className="text-sm font-semibold">1 身份设定</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">名称与对外介绍</p>
                  </div>
                  <FieldGroup className="gap-4">
                    <Field>
                      <FieldLabel htmlFor="inspector-agent-name">名称</FieldLabel>
                      <Input
                        id="inspector-agent-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="给智能体起个名字"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inspector-agent-description">简介</FieldLabel>
                      <Textarea
                        id="inspector-agent-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="简短说明它能完成什么"
                        className="min-h-20 resize-y"
                      />
                    </Field>
                  </FieldGroup>
                </section>
                <section className="space-y-4 p-5">
                  <div>
                    <p className="text-sm font-semibold">2 角色与规则</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      定义回答方式与工作边界
                    </p>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="inspector-agent-system-prompt">角色设定</FieldLabel>
                    <Textarea
                      id="inspector-agent-system-prompt"
                      value={config.systemPrompt}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, systemPrompt: event.target.value }))
                      }
                      placeholder="定义智能体的身份、边界和回答方式"
                      className="min-h-36 resize-y"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inspector-agent-opening-message">开场白</FieldLabel>
                    <Textarea
                      id="inspector-agent-opening-message"
                      value={config.openingMessage}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, openingMessage: event.target.value }))
                      }
                      placeholder="新会话开始时显示的第一句话"
                      className="min-h-24 resize-y"
                    />
                  </Field>
                </section>
                <section className="space-y-3 p-5">
                  <div>
                    <p className="text-sm font-semibold">3 资源</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">管理资料与工具</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/workbench/apps/${appId}/settings`)}
                  >
                    <History data-icon="inline-start" />
                    完整设置
                  </Button>
                </section>
              </div>
            </ScrollArea>
            <div className="border-t border-border/70 p-4">
              <Button
                className="w-full"
                onClick={() => void saveSettings()}
                disabled={savingSettings}
              >
                <Save data-icon="inline-start" />
                {savingSettings ? '保存中…' : '保存草稿'}
              </Button>
            </div>
          </aside>
        ) : null}
        <Button
          variant="outline"
          size="icon-sm"
          className={cn(
            'absolute top-1/2 z-30 hidden -translate-y-1/2 rounded-full bg-background shadow-sm active:not-aria-[haspopup]:!-translate-y-1/2 motion-safe:transition-[right] motion-safe:duration-300 motion-safe:ease-out lg:inline-flex',
            inspectorOpen ? 'right-[21rem]' : 'right-3',
          )}
          onClick={() => setInspectorOpen((current) => !current)}
          data-agent-inspector-toggle
          aria-label={inspectorOpen ? '收起配置面板' : '展开配置面板'}
          title={inspectorOpen ? '收起配置面板' : '展开配置面板'}
        >
          {inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </div>
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="gap-0 p-0 sm:max-w-md">
          <Tabs defaultValue="identity" className="min-h-0 flex-1 gap-0">
            <SheetHeader className="border-b border-border px-5 py-5">
              <SheetTitle>配置智能体</SheetTitle>
              <SheetDescription>编辑当前草稿</SheetDescription>
            </SheetHeader>
            <TabsList
              variant="line"
              className="w-full justify-start gap-3 border-b border-border px-4"
            >
              <TabsTrigger value="identity" className="flex-none px-2">
                身份
              </TabsTrigger>
              <TabsTrigger value="guidance" className="flex-none px-2">
                行为
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex-none px-2">
                资源
              </TabsTrigger>
            </TabsList>
            <TabsContent value="identity" className="min-h-0">
              <ScrollArea className="h-full">
                <FieldGroup className="gap-6 p-5">
                  <Field>
                    <FieldLabel htmlFor="agent-name">名称</FieldLabel>
                    <Input
                      id="agent-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="给智能体起个名字"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="agent-description">简介</FieldLabel>
                    <Textarea
                      id="agent-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="简短说明它能完成什么"
                      className="min-h-24 resize-y"
                    />
                  </Field>
                </FieldGroup>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="guidance" className="min-h-0">
              <ScrollArea className="h-full">
                <FieldGroup className="gap-6 p-5">
                  <Field>
                    <FieldLabel htmlFor="agent-system-prompt">角色与规则</FieldLabel>
                    <Textarea
                      id="agent-system-prompt"
                      value={config.systemPrompt}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, systemPrompt: event.target.value }))
                      }
                      placeholder="定义智能体的身份、边界和回答方式"
                      className="min-h-52 resize-y"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="agent-opening-message">开场白</FieldLabel>
                    <Textarea
                      id="agent-opening-message"
                      value={config.openingMessage}
                      onChange={(event) =>
                        setConfig((current) => ({ ...current, openingMessage: event.target.value }))
                      }
                      placeholder="新会话开始时显示的第一句话"
                      className="min-h-28 resize-y"
                    />
                  </Field>
                </FieldGroup>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="resources" className="min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-3 p-5">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium">资料库与工具</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate(`/workbench/apps/${appId}/settings`)}
                    >
                      <History data-icon="inline-start" />
                      打开完整设置
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
            <SheetFooter className="border-t border-border px-5 py-4">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                取消
              </Button>
              <Button onClick={() => void saveSettings()} disabled={savingSettings}>
                <Save data-icon="inline-start" />
                {savingSettings ? '保存中…' : '保存草稿'}
              </Button>
            </SheetFooter>
          </Tabs>
        </SheetContent>
      </Sheet>
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
                setSettingsOpen(true);
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
