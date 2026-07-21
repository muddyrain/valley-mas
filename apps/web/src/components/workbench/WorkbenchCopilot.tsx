import {
  AlertCircle,
  Bot,
  Check,
  ChevronDown,
  History,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type CopilotContext,
  type CopilotMessage,
  type CopilotProposal,
  type CopilotQuestion,
  type CopilotSession,
  cancelCopilotRun,
  createCopilotSession,
  getCopilotSession,
  hashCopilotDraft,
  isCopilotTargetReady,
  listCopilotSessions,
  streamCopilotMessage,
  updateCopilotProposal,
} from '@/api/workbenchCopilot';
import { ModelPicker } from '@/components/ai/ModelPicker';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

interface WorkbenchCopilotProps {
  context: CopilotContext;
  title?: string;
  suggestions?: string[];
  className?: string;
  fallback?: ReactNode;
  onApplyProposal: (proposal: CopilotProposal) => Promise<void> | void;
}

const DEFAULT_SUGGESTIONS = ['根据当前草稿给我改进建议', '检查有没有缺失的配置'];

export function WorkbenchCopilot({
  context,
  title = 'AI 协作',
  suggestions = DEFAULT_SUGGESTIONS,
  className,
  fallback,
  onApplyProposal,
}: WorkbenchCopilotProps) {
  const [enabled, setEnabled] = useState(true);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [proposals, setProposals] = useState<CopilotProposal[]>([]);
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [questions, setQuestions] = useState<CopilotQuestion[]>([]);
  const [input, setInput] = useState('');
  const [textModelId, setTextModelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [activeRunId, setActiveRunId] = useState('');
  const [activity, setActivity] = useState('');
  const [requestError, setRequestError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const targetReady = isCopilotTargetReady(context.scope, context.targetId);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    setProposals([]);
    setSessions([]);
    setActiveSessionId('');
    setQuestions([]);
    setActivity('');
    setRequestError('');
    setCancelling(false);
    setActiveRunId('');
    if (!targetReady) {
      controllerRef.current?.abort();
      setLoading(false);
      return () => {
        active = false;
      };
    }
    void getCopilotSession(context.scope, context.targetId)
      .then((result) => {
        if (!active) return;
        setEnabled(result.enabled);
        setActiveSessionId(result.session?.id || '');
        setMessages(result.messages);
        setProposals(result.proposals);
        return listCopilotSessions(context.scope, context.targetId);
      })
      .then((result) => {
        if (!active || !result) return;
        setSessions(result.sessions);
      })
      .catch(() => {
        if (active) toast.error('加载 AI 协作记录失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controllerRef.current?.abort();
    };
  }, [context.scope, context.targetId, targetReady]);

  const loadSession = async (sessionId: string) => {
    if (!targetReady || !sessionId || sessionId === activeSessionId || streaming) return;
    setLoading(true);
    setQuestions([]);
    setRequestError('');
    try {
      const result = await getCopilotSession(context.scope, context.targetId, sessionId);
      setActiveSessionId(result.session?.id || sessionId);
      setMessages(result.messages);
      setProposals(result.proposals);
      setHistoryOpen(false);
    } catch {
      toast.error('加载历史会话失败');
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    if (!targetReady || streaming) return;
    setLoading(true);
    try {
      const result = await createCopilotSession(context.scope, context.targetId);
      setSessions((current) => [result.session, ...current]);
      setActiveSessionId(result.session.id);
      setMessages([]);
      setProposals([]);
      setQuestions([]);
      setInput('');
      setRequestError('');
    } catch {
      toast.error('创建新会话失败');
    } finally {
      setLoading(false);
    }
  };

  const timelineRevision =
    messages.length +
    proposals.length +
    questions.length +
    Number(Boolean(activity)) +
    Number(Boolean(requestError));
  useEffect(() => {
    if (timelineRevision >= 0) {
      timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight });
    }
  }, [timelineRevision]);

  const proposalsBySession = useMemo(
    () => [...proposals].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [proposals],
  );

  const sendMessage = async (raw?: string) => {
    const message = (raw ?? input).trim();
    if (!targetReady || !message || streaming || !activeSessionId) return;
    if (!textModelId) {
      toast.error('请选择文本模型');
      return;
    }
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        sessionId: '',
        role: 'user',
        kind: 'text',
        content: message,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput('');
    setQuestions([]);
    setRequestError('');
    setStreaming(true);
    setCancelling(false);
    setActiveRunId('');
    setActivity('正在连接工作台上下文');
    const controller = new AbortController();
    controllerRef.current = controller;
    const refreshSessionAfterTerminal = () => {
      if (!activeSessionId) return;
      void getCopilotSession(context.scope, context.targetId, activeSessionId).then((result) => {
        setMessages(result.messages);
        setProposals(result.proposals);
      });
    };
    try {
      await streamCopilotMessage(
        context,
        message,
        textModelId,
        activeSessionId,
        {
          onEvent: (event) => {
            if (event.type === 'session' && event.data.session) {
              setActiveSessionId(event.data.session.id);
              setSessions((current) => [
                event.data.session as CopilotSession,
                ...current.filter((item) => item.id !== event.data.session?.id),
              ]);
            }
            if (event.type === 'run') setActiveRunId(event.data.run.id);
            if (event.type === 'activity') setActivity(event.data.label);
            if (event.type === 'assistant.delta') {
              setActivity('');
              setMessages((current) => {
                const existing = current.find((item) => item.id === event.data.messageId);
                if (existing) {
                  return current.map((item) =>
                    item.id === event.data.messageId
                      ? { ...item, content: item.content + event.data.content }
                      : item,
                  );
                }
                return [
                  ...current,
                  {
                    id: event.data.messageId,
                    sessionId: '',
                    role: 'assistant',
                    kind: 'answer',
                    content: event.data.content,
                    createdAt: new Date().toISOString(),
                  },
                ];
              });
            }
            if (event.type === 'clarification') setQuestions(event.data.questions);
            if (event.type === 'proposal') {
              setProposals((current) => [
                ...current.filter((item) => item.status !== 'pending'),
                {
                  ...event.data.proposal,
                  candidate: event.data.candidate,
                  diff: event.data.diff,
                },
              ]);
            }
            if (event.type === 'error') {
              setActivity('');
              setRequestError(event.data.message);
              toast.error(event.data.message);
              if (event.data.sequence) refreshSessionAfterTerminal();
            }
            if (event.type === 'done') {
              setActivity('');
              setStreaming(false);
              if (event.data.sequence) refreshSessionAfterTerminal();
            }
            if (event.type === 'cancelled') {
              setActivity('');
              setCancelling(false);
              if (event.data.sequence) refreshSessionAfterTerminal();
            }
          },
          onReconnect: () => setActivity('正在恢复连接'),
        },
        controller.signal,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        const errorMessage = error instanceof Error ? error.message : 'AI 协作请求失败';
        setRequestError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setActivity('');
      setStreaming(false);
      setCancelling(false);
      setActiveRunId('');
    }
  };

  const cancelActiveRun = async () => {
    if (!activeRunId || cancelling) return;
    setCancelling(true);
    setActivity('正在取消');
    try {
      await cancelCopilotRun(activeRunId);
    } catch {
      setCancelling(false);
      setActivity('');
      toast.error('取消 AI 协作失败');
    }
  };

  const resolveProposal = async (proposal: CopilotProposal, status: 'accepted' | 'rejected') => {
    if (applyingId) return;
    setApplyingId(proposal.id);
    try {
      if (status === 'accepted') {
        const currentHash = await hashCopilotDraft(context.draft);
        if (currentHash !== proposal.baseHash) {
          toast.error('草稿已经变化，请让 AI 基于最新内容重新生成');
          return;
        }
        await onApplyProposal(proposal);
      }
      await updateCopilotProposal(proposal.id, status);
      setProposals((current) =>
        current.map((item) => (item.id === proposal.id ? { ...item, status } : item)),
      );
      toast.success(status === 'accepted' ? '提案已写入草稿，尚未运行或发布' : '已拒绝该提案');
    } catch {
      toast.error(status === 'accepted' ? '应用提案失败' : '更新提案状态失败');
    } finally {
      setApplyingId(null);
    }
  };

  const revertProposal = async (proposal: CopilotProposal) => {
    if (applyingId || !proposal.candidateHash || !proposal.baseDraft) return;
    setApplyingId(proposal.id);
    try {
      const currentHash = await hashCopilotDraft(context.draft);
      if (currentHash !== proposal.candidateHash) {
        toast.error('草稿已有后续修改，无法直接撤销这次 AI 改动');
        return;
      }
      await onApplyProposal({ ...proposal, candidate: proposal.baseDraft });
      await updateCopilotProposal(proposal.id, 'reverted', currentHash);
      setProposals((current) =>
        current.map((item) => (item.id === proposal.id ? { ...item, status: 'reverted' } : item)),
      );
      toast.success('已撤销这次 AI 改动');
    } catch {
      toast.error('撤销 AI 改动失败');
    } finally {
      setApplyingId(null);
    }
  };

  if (!enabled) {
    if (fallback) return fallback;
    return <p className="p-4 text-sm text-muted-foreground">AI 协作当前未启用。</p>;
  }

  return (
    <section className={`flex min-h-0 flex-1 flex-col bg-card ${className || ''}`}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {context.scope === 'workflow'
                ? context.selectedNodeId
                  ? `当前节点：${context.selectedNodeId}`
                  : '已读取当前工作流草稿'
                : context.scope === 'agent'
                  ? '已读取当前智能体草稿'
                  : '创建或继续工作台任务'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline">AI</Badge>
          <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="历史会话"
                  disabled={!targetReady || streaming}
                >
                  <History />
                </Button>
              }
            />
            <PopoverContent align="end" className="w-80 gap-2 p-2">
              <PopoverHeader className="px-2 py-1">
                <PopoverTitle>历史会话</PopoverTitle>
              </PopoverHeader>
              <ScrollArea className="max-h-72">
                <div className="flex flex-col gap-1">
                  {sessions.map((session) => (
                    <Button
                      key={session.id}
                      type="button"
                      variant={session.id === activeSessionId ? 'secondary' : 'ghost'}
                      size="sm"
                      className="justify-start"
                      onClick={() => void loadSession(session.id)}
                    >
                      <span className="truncate">{session.title}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="新建会话"
            disabled={!targetReady || streaming || loading}
            onClick={() => void startNewSession()}
          >
            <Plus />
          </Button>
        </div>
      </header>

      <div
        ref={timelineRef}
        className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
      >
        <BoxLoadingOverlay show={loading} title="正在加载会话" compact minimal />
        {!loading && !targetReady ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            保存工作流后即可开始 AI 协作。
          </div>
        ) : !loading && messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4 text-primary" />
              直接描述目标，我会先补齐条件，再给出可审查的草稿。
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  size="sm"
                  variant="outline"
                  onClick={() => void sendMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : !loading ? (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        ) : null}

        {activity ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" />
            {activity}
          </div>
        ) : null}

        {requestError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{requestError}</span>
          </div>
        ) : null}

        {questions.map((question) => (
          <div key={question.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{question.prompt}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {question.options.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant="outline"
                  disabled={streaming}
                  onClick={() => void sendMessage(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ))}

        {proposalsBySession.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            applying={applyingId === proposal.id}
            onAccept={() => void resolveProposal(proposal, 'accepted')}
            onReject={() => void resolveProposal(proposal, 'rejected')}
            onRevert={() => void revertProposal(proposal)}
          />
        ))}
      </div>

      <div className="border-t border-border p-3">
        <div className="mb-2">
          <ModelPicker
            value={textModelId || undefined}
            onValueChange={setTextModelId}
            capability="text"
            label="文本模型"
          />
        </div>
        <Textarea
          value={input}
          className="min-h-20 resize-none"
          maxLength={4000}
          placeholder="描述目标，或要求修改当前草稿…"
          disabled={!targetReady}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            variant={streaming ? 'outline' : 'default'}
            disabled={!targetReady || (!streaming && !input.trim()) || (streaming && !activeRunId)}
            onClick={() => {
              if (streaming) void cancelActiveRun();
              else void sendMessage();
            }}
          >
            {streaming ? <Square data-icon="inline-start" /> : <Send data-icon="inline-start" />}
            {streaming ? (cancelling ? '取消中' : '停止') : '发送'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProposalCard({
  proposal,
  applying,
  onAccept,
  onReject,
  onRevert,
}: {
  proposal: CopilotProposal;
  applying: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRevert: () => void;
}) {
  const { diff } = proposal;
  const pending = proposal.status === 'pending';
  return (
    <article className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">变更提案</p>
          <p className="text-xs text-muted-foreground">
            {proposal.targetType === 'workflow' ? '工作流草稿' : '智能体草稿'}
          </p>
        </div>
        <Badge variant={pending ? 'secondary' : 'outline'}>
          {proposal.status === 'pending'
            ? '待确认'
            : proposal.status === 'accepted'
              ? '已应用'
              : proposal.status === 'rejected'
                ? '已拒绝'
                : proposal.status === 'reverted'
                  ? '已撤销'
                  : '已过期'}
        </Badge>
      </div>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        {diff.schemaFrom !== diff.schemaTo && (
          <p>
            协议：v{diff.schemaFrom || 0} → v{diff.schemaTo}
          </p>
        )}
        {diff.added?.length ? <p>新增：{diff.added.join('、')}</p> : null}
        {diff.updated?.length ? <p>修改：{diff.updated.join('、')}</p> : null}
        {diff.removed?.length ? <p>删除：{diff.removed.join('、')}</p> : null}
        {diff.summary?.map((item) => (
          <p key={item}>{item}</p>
        ))}
        {diff.risks?.map((risk) => (
          <p key={risk} className="text-amber-600 dark:text-amber-400">
            风险：{risk}
          </p>
        ))}
      </div>
      <Collapsible className="mt-3">
        <CollapsibleTrigger className="inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium hover:bg-muted">
          <ChevronDown data-icon="inline-start" />
          查看候选草稿
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-muted p-2 text-[11px] leading-5">
            {JSON.stringify(proposal.candidate, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
      {pending ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={applying} onClick={onReject}>
            <X data-icon="inline-start" />
            拒绝
          </Button>
          <Button size="sm" disabled={applying} onClick={onAccept}>
            <Check data-icon="inline-start" />
            {applying ? '应用中…' : '应用到草稿'}
          </Button>
        </div>
      ) : proposal.status === 'accepted' && proposal.baseDraft && proposal.candidateHash ? (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" disabled={applying} onClick={onRevert}>
            <RotateCcw data-icon="inline-start" />
            {applying ? '撤销中…' : '撤销这次改动'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
