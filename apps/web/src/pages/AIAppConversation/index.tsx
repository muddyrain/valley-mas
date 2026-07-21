import { Copy, MessageCirclePlus, Send, Square, Trash2, UserRound } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
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
  streamAIAppConversation,
} from '@/api/aiWorkbench';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import { AIResponseContext } from '@/components/ai-workbench/AIResponseContext';
import { EditorPageHeader } from '@/components/ai-workbench/EditorPageHeader';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const quickPrompts = [
  '介绍一下你的能力',
  '根据资料库回答一个问题',
  '帮我梳理当前任务',
  '给我一个开始建议',
];

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
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
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
  const controllerRef = useRef<AbortController | null>(null);
  const loadedAppIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!appId) return;
    let active = true;
    listAIAppConversations(appId)
      .then((result) => {
        if (active) setConversations(result.list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载会话列表失败'));
      });
    return () => {
      active = false;
    };
  }, [appId]);

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

  const stop = () => controllerRef.current?.abort();

  const upsertRun = (run: AIAppRun) => {
    setRuns((items) => [run, ...items.filter((item) => item.id !== run.id)]);
  };

  const conversationConfig: AgentConfig = (() => {
    const version = versions.find((item) => item.id === conversation?.versionId);
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
      return {
        modelProfile: 'ark-text-default',
        systemPrompt: '',
        openingMessage: '',
        exampleQuestions: [],
      };
    }
  })();
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
    return (
      <div className="relative h-screen">
        <BoxLoadingOverlay show compact minimal title="加载会话" />
      </div>
    );
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
      <EditorPageHeader
        title={conversation.title}
        description={
          hasNewerDraft
            ? `此会话固定在 v${conversationVersion?.number}；${draftVersionLabel} 不会改写历史对话。`
            : '此会话固定在创建时的智能体版本，后续保存不会改写历史对话。'
        }
        status={<Badge variant="secondary">{conversationVersionLabel}</Badge>}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void createConversation()}>
              <MessageCirclePlus data-icon="inline-start" />
              {hasNewerDraft && draftVersion ? `用 v${draftVersion.number} 新建会话` : '新建会话'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/workbench/apps/${appId}`)}>
              查看版本历史
            </Button>
          </>
        }
        onBack={() => navigate(`/workbench/apps/${appId}`)}
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col bg-muted/30 p-4 lg:border-r lg:border-border">
          <Button className="w-full justify-start" onClick={() => void createConversation()}>
            <MessageCirclePlus data-icon="inline-start" />
            新建会话
          </Button>
          <div className="mt-6 flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground">最近会话</p>
            <Badge variant="secondary">{conversations.length}</Badge>
          </div>
          <ScrollArea className="mt-3 min-h-36 flex-1">
            <div className="flex flex-col gap-1 pr-3">
              {conversations.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group flex items-center rounded-lg transition-colors hover:bg-muted focus-within:bg-muted',
                    item.id === conversationId && 'bg-muted',
                  )}
                >
                  <Button
                    variant="ghost"
                    className="min-w-0 flex-1 justify-start bg-transparent hover:bg-transparent"
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
          <Separator className="my-4" />
          <Badge variant="outline" className="self-start">
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
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-8">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                  <AgentAvatar
                    name={app?.name || '智能体'}
                    src={app?.avatarUrl}
                    className="size-12"
                  />
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {app?.name || '开始一段新对话'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {conversationConfig.openingMessage || '发送问题，智能体会基于固定版本回应。'}
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
          <div className="border-t border-border bg-background px-4 py-5 sm:px-7">
            <Card className="mx-auto max-w-3xl gap-0 border-border py-0 shadow-none" size="sm">
              <CardContent className="px-4 py-3">
                <div className="mb-3">
                  <ModelPicker
                    value={textModelId}
                    onValueChange={setTextModelId}
                    capability="text"
                    label="对话模型"
                  />
                </div>
                <Textarea
                  value={input}
                  placeholder="输入消息，Enter 发送，Shift + Enter 换行"
                  disabled={sending}
                  className="min-h-24 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="secondary">{conversationVersionLabel}</Badge>
                    {hasNewerDraft && draftVersion ? (
                      <span className="text-xs text-muted-foreground">
                        已有 {draftVersionLabel}（{formatVersionSavedAt(draftVersion.createdAt)}）
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        保存新版本不会改写本会话
                      </span>
                    )}
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
                      onClick={() => void send()}
                      disabled={!input.trim() || !textModelId}
                      aria-label="发送消息"
                      title="发送消息"
                    >
                      <Send />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
