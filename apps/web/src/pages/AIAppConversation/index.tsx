import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  History,
  MessageCirclePlus,
  Save,
  Send,
  Settings2,
  Square,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import {
  type AgentConfig,
  type AIApp,
  type AIAppConversation,
  type AIAppConversationMessage,
  type AIAppConversationToolTrace,
  type AIAppRun,
  type AIAppVersion,
  type AIKnowledgeReference,
  createAIAppConversation,
  deleteAIAppConversation,
  getAIApp,
  getAIAppConversation,
  getAPIErrorMessage,
  listAIAppConversations,
  publishAIApp,
  saveAIAppVersion,
  streamAIAppConversation,
} from '@/api/aiWorkbench';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import { AIResponseContext } from '@/components/ai-workbench/AIResponseContext';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
};

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
    };
  } catch {
    return defaultConfig;
  }
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatVersionSavedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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

function ConversationMessageBubble({ message }: { message: AIAppConversationMessage }) {
  const isUser = message.role === 'user';
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success('消息已复制');
    } catch {
      toast.error('复制失败，请手动复制');
    }
  };

  return (
    <div className="group max-w-[min(85%,42rem)]">
      <div
        className={cn(
          'rounded-xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap',
          isUser ? 'bg-foreground text-background' : 'bg-muted/75 text-foreground',
        )}
      >
        {message.content}
      </div>
      <div
        className={cn(
          'mt-1 flex items-center gap-1 px-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
          isUser && 'justify-end',
        )}
      >
        <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        <Button
          size="icon-xs"
          variant="ghost"
          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="复制消息"
          title="复制消息"
          onClick={() => void copyMessage()}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
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
        className="w-80 gap-2 rounded-2xl p-2 shadow-lg"
      >
        <div className="px-2 py-1 text-sm font-medium">模型</div>
        <ScrollArea className="max-h-72">
          <div className="space-y-1 pr-2">
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function AIAppConversationSkeleton() {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-background" aria-busy="true">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-6">
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
      <div className="grid min-h-0 flex-1 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border/70 bg-muted/20 p-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="mt-5 h-3 w-16" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-4/5 rounded-md" />
            <Skeleton className="h-9 w-11/12 rounded-md" />
            <Skeleton className="h-9 w-3/4 rounded-md" />
          </div>
          <Skeleton className="mt-auto h-5 w-16 rounded-full" />
        </aside>
        <section className="flex min-h-0 flex-col">
          <div className="flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-6 py-10 sm:px-10">
              <div className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-72 rounded-full" />
                  <Skeleton className="h-4 w-56 rounded-full" />
                </div>
              </div>
              <div className="flex items-start justify-end gap-3">
                <div className="space-y-2 pt-1">
                  <Skeleton className="ml-auto h-4 w-52 rounded-full" />
                  <Skeleton className="ml-auto h-4 w-36 rounded-full" />
                </div>
                <Skeleton className="size-8 rounded-full" />
              </div>
            </div>
          </div>
          <div className="px-5 pb-6 pt-3 sm:px-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-sm">
              <Skeleton className="h-20 w-full rounded-xl" />
              <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="size-9 rounded-full" />
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [textModelId, setTextModelId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);
  const controllerRef = useRef<AbortController | null>(null);
  const loadedAppIdRef = useRef<string | null>(null);
  const settingsOpenRef = useRef(false);

  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

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
    setStreamingReply('');
    setToolStatus(null);
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
    if (!appId) return;
    try {
      await deleteAIAppConversation(appId, target.id);
      const next = conversations.filter((item) => item.id !== target.id);
      setConversations(next);
      if (target.id === conversationId) {
        if (next[0])
          navigate(`/workbench/apps/${appId}/conversations/${next[0].id}`, { replace: true });
        else navigate(`/workbench/apps/${appId}`, { replace: true });
      }
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '删除会话失败'));
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

  const publish = async () => {
    if (!appId) return;
    const versionId = draftVersionId || versions[0]?.id;
    if (!versionId) {
      toast.error('请先保存智能体配置');
      return;
    }
    try {
      setPublishing(true);
      await publishAIApp(appId, versionId);
      setApp((current) =>
        current ? { ...current, status: 'published', publishedVersionId: versionId } : current,
      );
      toast.success('已发布当前草稿');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '发布失败，请稍后重试'));
    } finally {
      setPublishing(false);
    }
  };

  const stop = () => controllerRef.current?.abort();

  const upsertRun = (run: AIAppRun) => {
    setRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
  };

  const conversationConfig = parseAgentConfig(
    versions.find((item) => item.id === conversation?.versionId),
  );
  const starterQuestions =
    conversationConfig.exampleQuestions.length > 0
      ? conversationConfig.exampleQuestions
      : quickPrompts;

  const send = async () => {
    if (!appId || !conversationId || !input.trim() || !textModelId || sending) return;
    const content = input.trim();
    const localUserMessage: AIAppConversationMessage = {
      id: `local-user-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setInput('');
    setMessages((items) => [...items, localUserMessage]);
    setStreamingReply('');
    setToolStatus(null);
    setReferences([]);
    setSending(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await streamAIAppConversation(
        appId,
        conversationId,
        content,
        textModelId,
        {
          onDelta: (chunk) => setStreamingReply((reply) => reply + chunk),
          onToolCall: (name) =>
            setToolStatus(name === 'content.search' ? '正在搜索内容' : '正在调用工具'),
          onToolResult: (name, ok) => {
            setToolStatus(
              name === 'content.search' ? (ok ? '内容搜索完成' : '内容搜索失败') : null,
            );
          },
          onDone: (result) => {
            setConversation(result.conversation);
            setConversations((items) => [
              result.conversation,
              ...items.filter((item) => item.id !== result.conversation.id),
            ]);
            setMessages((items) => [
              ...items.filter((item) => item.id !== localUserMessage.id),
              result.userMessage,
              result.assistantMessage,
            ]);
            upsertRun(result.run);
            setReferences(result.references);
            // 在移除流式气泡前结束发送态，避免空文本短暂回退为“正在思考…”。
            setSending(false);
            setStreamingReply('');
          },
          onError: ({ message, run, userMessage }) => {
            if (run) upsertRun(run);
            if (userMessage) {
              setMessages((items) => [
                ...items.filter((item) => item.id !== localUserMessage.id),
                userMessage,
              ]);
            }
            setStreamingReply('');
            toast.error(message);
          },
        },
        controller.signal,
      );
    } catch (error) {
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
        setMessages((items) =>
          items.map((item) =>
            item.id === localUserMessage.id ? { ...item, runId: cancelledRun.id } : item,
          ),
        );
        upsertRun(cancelledRun);
      } else {
        toast.error(getAPIErrorMessage(error, '会话发送失败'));
      }
    } finally {
      controllerRef.current = null;
      setSending(false);
    }
  };

  if (initialLoading) {
    return <AIAppConversationSkeleton />;
  }
  if (!conversation || !appId) return null;

  const conversationVersion = versions.find((item) => item.id === conversation.versionId);
  const draftVersion = versions.find((item) => item.id === draftVersionId) ?? versions[0];
  const conversationVersionLabel = conversationVersion
    ? `会话 v${conversationVersion.number}`
    : '固定版本';
  const hasNewerDraft = Boolean(
    conversationVersion && draftVersion && conversationVersion.id !== draftVersion.id,
  );
  const draftVersionLabel = draftVersion ? `当前草稿 v${draftVersion.number}` : '';

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 sm:px-6">
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
          <h1 className="truncate text-sm font-semibold">{app?.name || conversation.title}</h1>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {conversationVersionLabel}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void createConversation()}>
            <MessageCirclePlus data-icon="inline-start" />
            <span className="hidden sm:inline">新建会话</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 data-icon="inline-start" />
            <span className="hidden sm:inline">配置</span>
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={publishing}>
            {publishing ? '发布中…' : '发布'}
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border/70 bg-muted/20 p-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => void createConversation()}
          >
            <MessageCirclePlus data-icon="inline-start" />
            新建会话
          </Button>
          <div className="mt-5 flex items-center justify-between px-2">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground">最近会话</p>
            <span className="text-[11px] text-muted-foreground">{conversations.length}</span>
          </div>
          <ScrollArea className="mt-2 min-h-36 flex-1">
            <div className="flex flex-col gap-1 pr-2">
              {conversations.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group flex items-center rounded-md transition-colors hover:bg-muted/70 focus-within:bg-muted/70',
                    item.id === conversationId && 'bg-muted',
                  )}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 flex-1 justify-start bg-transparent px-2 text-xs font-normal hover:bg-transparent"
                    onClick={() => navigate(`/workbench/apps/${appId}/conversations/${item.id}`)}
                  >
                    <span className="truncate">{item.title}</span>
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="mr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="删除会话"
                    title="删除会话"
                    onClick={() => void removeConversation(item)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <Separator className="my-3" />
          <Badge variant="outline" className="self-start text-[10px] font-normal">
            仅自己可见
          </Badge>
        </aside>
        <section
          className="relative flex min-h-0 flex-col bg-background"
          aria-busy={conversationLoading}
        >
          <BoxLoadingOverlay
            show={conversationLoading}
            compact
            minimal
            title="加载会话"
            className="rounded-none bg-background/80"
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-7 px-6 py-10 sm:px-10">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-20 text-center">
                  <AgentAvatar
                    name={app?.name || '智能体'}
                    src={app?.avatarUrl}
                    className="size-10"
                  />
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                      {app?.name || '开始一段新对话'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {conversationConfig.openingMessage || '有什么想一起完成的？'}
                    </p>
                  </div>
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {starterQuestions.map((prompt) => (
                      <Button
                        key={prompt}
                        size="sm"
                        variant="outline"
                        onClick={() => setInput(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              {messages.map((message) => {
                const run = message.runId ? runs.find((item) => item.id === message.runId) : null;
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
                      <ConversationMessageBubble message={message} />
                    </div>
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
                  <div className="max-w-[min(85%,42rem)] rounded-xl bg-muted px-4 py-3 text-sm leading-6 whitespace-pre-wrap">
                    {streamingReply || '正在思考…'}
                  </div>
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
            </div>
          </div>
          <div className="px-5 pb-6 pt-3 sm:px-8">
            <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-sm">
              <div className="px-4 pt-3">
                <Textarea
                  value={input}
                  placeholder="继续对话，或输入一个新任务"
                  disabled={sending}
                  className="min-h-28 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <ConversationModelControl value={textModelId} onValueChange={setTextModelId} />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {hasNewerDraft && draftVersion
                      ? `已有 ${draftVersionLabel}（${formatVersionSavedAt(draftVersion.createdAt)}）`
                      : '此会话使用固定版本'}
                  </span>
                </div>
                {sending ? (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={stop}
                    aria-label="停止生成"
                    title="停止生成"
                  >
                    <Square />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="rounded-full"
                    onClick={() => void send()}
                    disabled={!input.trim() || !textModelId}
                    aria-label="发送消息"
                    title="发送消息"
                  >
                    <Send />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>配置智能体</SheetTitle>
            <SheetDescription>保存后，新建会话会使用新的草稿版本。</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <FieldGroup className="gap-6 p-4">
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
                  className="min-h-20 resize-y"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="agent-system-prompt">角色与规则</FieldLabel>
                <Textarea
                  id="agent-system-prompt"
                  value={config.systemPrompt}
                  onChange={(event) =>
                    setConfig((current) => ({ ...current, systemPrompt: event.target.value }))
                  }
                  placeholder="定义智能体的身份、边界和回答方式"
                  className="min-h-44 resize-y"
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
                  className="min-h-24 resize-y"
                />
              </Field>
              <div className="rounded-lg border border-border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">资料库、工具与版本</p>
                    <p className="mt-1 text-xs text-muted-foreground">在完整设置中管理</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/workbench/apps/${appId}/settings`)}
                  >
                    <History data-icon="inline-start" />
                    更多配置
                  </Button>
                </div>
              </div>
            </FieldGroup>
          </ScrollArea>
          <SheetFooter className="border-t">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveSettings()} disabled={savingSettings}>
              <Save data-icon="inline-start" />
              {savingSettings ? '保存中…' : '保存草稿'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
