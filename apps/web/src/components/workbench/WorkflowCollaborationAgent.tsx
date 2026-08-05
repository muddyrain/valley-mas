import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock3,
  LocateFixed,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TimerReset,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type AISkill, listAISkills } from '@/api/aiWorkbench';
import type { CopilotContext } from '@/api/workbenchCopilot';
import { getWorkflow, type WorkflowItem } from '@/api/workflow';
import {
  type ArchivedWorkflowCollaborationData,
  cancelWorkflowCollaborationTask,
  createWorkflowCollaborationTask,
  decideWorkflowCollaborationApproval,
  deleteWorkflowCollaborationAttachment,
  downloadWorkflowCollaborationAttachment,
  getArchivedWorkflowCollaborationSession,
  getWorkflowCollaboration,
  parseWorkflowCollaborationDiff,
  resetWorkflowCollaborationContext,
  revertWorkflowCollaborationChange,
  uploadWorkflowCollaborationAttachment,
  type WorkflowCollaborationApproval,
  type WorkflowCollaborationAttachment,
  type WorkflowCollaborationChange,
  type WorkflowCollaborationMessage,
  type WorkflowCollaborationSession,
  type WorkflowCollaborationTask,
} from '@/api/workflowCollaboration';
import { ConversationAttachmentCard } from '@/components/ai/ConversationAttachmentCard';
import {
  ConversationComposer,
  type ConversationComposerFile,
} from '@/components/ai/ConversationComposer';
import { ConversationMessageBubble } from '@/components/ai/ConversationMessageBubble';
import { ModelPicker } from '@/components/ai/ModelPicker';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WorkflowCollaborationAgentProps {
  context: CopilotContext & { serverRevision?: number };
  suggestions?: string[];
  className?: string;
  onBeforeSubmit?: () => Promise<boolean | undefined> | boolean | undefined;
  onWorkflowUpdated: (workflow: WorkflowItem) => boolean | undefined;
  onLocateNode?: (nodeId?: string) => void;
  visible?: boolean;
  draftRequest?: {
    id: string;
    prompt: string;
    context: { selectedNodeId?: string; nodeLabels?: Record<string, string> };
  };
  onUnreadChange?: (unread: boolean) => void;
}

const ACTIVE_STATUSES = new Set(['queued', 'running', 'waiting_approval']);

function statusLabel(task: WorkflowCollaborationTask) {
  if (task.status === 'queued')
    return task.queuePosition ? `排队中 · 第 ${task.queuePosition} 位` : '排队中';
  if (task.status === 'running') return task.statusMessage || '正在处理';
  if (task.status === 'succeeded') return '已完成';
  if (task.status === 'conflicted') return '与手动编辑冲突';
  if (task.status === 'cancelled') return '已停止';
  if (task.status === 'waiting_approval') return '等待确认';
  return task.statusMessage || '执行失败';
}

function StatusIcon({ task }: { task: WorkflowCollaborationTask }) {
  if (task.status === 'succeeded') return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (task.status === 'failed' || task.status === 'conflicted')
    return <AlertCircle className="size-4 text-destructive" />;
  return <Clock3 className="size-4 text-primary" />;
}

export const WorkflowCollaborationAgent = memo(function WorkflowCollaborationAgent({
  context,
  suggestions = ['根据当前草稿补全工作流', '检查节点配置和风险'],
  className,
  onBeforeSubmit,
  onWorkflowUpdated,
  onLocateNode,
  visible = true,
  draftRequest,
  onUnreadChange,
}: WorkflowCollaborationAgentProps) {
  const workflowId = context.targetId || '';
  const [messages, setMessages] = useState<WorkflowCollaborationMessage[]>([]);
  const [tasks, setTasks] = useState<WorkflowCollaborationTask[]>([]);
  const [changes, setChanges] = useState<WorkflowCollaborationChange[]>([]);
  const [approvals, setApprovals] = useState<WorkflowCollaborationApproval[]>([]);
  const [skills, setSkills] = useState<AISkill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string>();
  const [archivedSessions, setArchivedSessions] = useState<WorkflowCollaborationSession[]>([]);
  const [archivedTimelines, setArchivedTimelines] = useState<
    Record<string, ArchivedWorkflowCollaborationData>
  >({});
  const [loadingArchivedId, setLoadingArchivedId] = useState<string>();
  const [input, setInput] = useState('');
  const [modelId, setModelId] = useState('');
  const [attachments, setAttachments] = useState<WorkflowCollaborationAttachment[]>([]);
  const [sentAttachments, setSentAttachments] = useState<WorkflowCollaborationAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [decidingApprovalId, setDecidingApprovalId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const pendingContextRef = useRef<WorkflowCollaborationAgentProps['draftRequest']>(undefined);
  const taskStateSignatureRef = useRef('');
  const syncedRevisionRef = useRef(context.serverRevision || 0);
  const onWorkflowUpdatedRef = useRef(onWorkflowUpdated);
  onWorkflowUpdatedRef.current = onWorkflowUpdated;

  useEffect(() => {
    syncedRevisionRef.current = Math.max(syncedRevisionRef.current, context.serverRevision || 0);
  }, [context.serverRevision]);

  const syncAppliedWorkflow = useCallback(
    async (items: WorkflowCollaborationChange[]) => {
      const revision = items.reduce(
        (max, change) =>
          change.status === 'applied' ? Math.max(max, change.appliedRevision) : max,
        0,
      );
      if (!workflowId || revision <= syncedRevisionRef.current || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const workflow = await getWorkflow(workflowId);
        if (onWorkflowUpdatedRef.current(workflow) !== false) {
          syncedRevisionRef.current = workflow.revision;
        }
      } finally {
        syncingRef.current = false;
      }
    },
    [workflowId],
  );

  const refresh = useCallback(
    async (showLoading = false) => {
      if (!workflowId) return;
      if (showLoading) setLoading(true);
      try {
        const result = await getWorkflowCollaboration(workflowId);
        setMessages(result.messages || []);
        setTasks(result.tasks || []);
        setChanges(result.changes || []);
        setApprovals(result.approvals || []);
        setSentAttachments(result.attachments || []);
        setArchivedSessions(result.archivedSessions || []);
        const taskStateSignature = (result.tasks || [])
          .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
          .join('|');
        if (
          taskStateSignatureRef.current !== taskStateSignature &&
          !visible &&
          (result.tasks || []).some((task) =>
            ['waiting_approval', 'succeeded', 'failed', 'conflicted'].includes(task.status),
          )
        ) {
          onUnreadChange?.(true);
        }
        taskStateSignatureRef.current = taskStateSignature;
        await syncAppliedWorkflow(result.changes || []);
      } catch {
        if (showLoading) toast.error('加载工作流 AI 协作记录失败');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [onUnreadChange, syncAppliedWorkflow, visible, workflowId],
  );

  const loadArchivedSession = useCallback(
    async (sessionId: string) => {
      if (!workflowId || archivedTimelines[sessionId] || loadingArchivedId === sessionId) return;
      setLoadingArchivedId(sessionId);
      try {
        const result = await getArchivedWorkflowCollaborationSession(workflowId, sessionId);
        setArchivedTimelines((current) => ({ ...current, [sessionId]: result }));
      } catch {
        toast.error('加载旧会话失败');
      } finally {
        setLoadingArchivedId((current) => (current === sessionId ? undefined : current));
      }
    },
    [archivedTimelines, loadingArchivedId, workflowId],
  );

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 1800);
    return () => window.clearInterval(timer);
  }, [refresh, workflowId]);

  useEffect(() => {
    void listAISkills()
      .then((result) => setSkills(result.list || []))
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (visible) onUnreadChange?.(false);
  }, [onUnreadChange, visible]);

  useEffect(() => {
    if (!draftRequest) return;
    setInput(draftRequest.prompt);
    pendingContextRef.current = draftRequest;
  }, [draftRequest]);

  const activeTask = tasks.find((task) => ACTIVE_STATUSES.has(task.status));
  const latestTasks = useMemo(
    () => [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    [tasks],
  );
  const changesByTask = useMemo(
    () => new Map(changes.map((change) => [change.taskId, change])),
    [changes],
  );

  const timelineRevision = messages.length + tasks.length;
  useEffect(() => {
    if (timelineRevision >= 0)
      timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' });
  }, [timelineRevision]);

  const sendMessage = async (raw?: string) => {
    const message = (raw ?? input).trim();
    if (!workflowId || (!message && attachments.length === 0) || sending) return;
    setSending(true);
    try {
      if ((await onBeforeSubmit?.()) === false) return;
      const result = await createWorkflowCollaborationTask(workflowId, {
        message,
        modelId: modelId || undefined,
        activeSkillId,
        attachmentIds: attachments.map((attachment) => attachment.id),
        context: pendingContextRef.current?.context || {
          selectedNodeId: context.selectedNodeId,
          nodeLabels: context.nodeLabels,
        },
      });
      setInput('');
      setAttachments([]);
      setActiveSkillId(undefined);
      pendingContextRef.current = undefined;
      setMessages((current) => [...current, result.message]);
      setTasks((current) => [result.task, ...current]);
      toast.success('任务已进入后台队列，离开页面也会继续执行');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建工作流 AI 任务失败');
    } finally {
      setSending(false);
    }
  };

  const decideApproval = async (
    approval: WorkflowCollaborationApproval,
    decision: 'approved' | 'rejected',
  ) => {
    if (decidingApprovalId) return;
    setDecidingApprovalId(approval.id);
    try {
      const result = await decideWorkflowCollaborationApproval(
        workflowId,
        approval.taskId,
        approval.id,
        decision,
      );
      setApprovals((current) => current.filter((item) => item.id !== approval.id));
      setTasks((current) =>
        current.map((item) => (item.id === result.task.id ? result.task : item)),
      );
      toast.success(
        decision === 'approved' ? '已确认，任务将继续执行' : '已拒绝，本次操作不会执行',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '处理确认失败');
    } finally {
      setDecidingApprovalId(null);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const available = Math.max(0, 3 - attachments.length);
    const selected = files.slice(0, available);
    if (selected.length < files.length) toast.error('每次最多附加 3 个文件');
    if (selected.length === 0) return;
    setUploadingFiles(true);
    try {
      for (const file of selected) {
        const result = await uploadWorkflowCollaborationAttachment(workflowId, file);
        setAttachments((current) => [...current, result.attachment]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传协作文件失败');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeFile = async (file: ConversationComposerFile) => {
    try {
      await deleteWorkflowCollaborationAttachment(workflowId, file.id);
      setAttachments((current) => current.filter((attachment) => attachment.id !== file.id));
    } catch {
      toast.error('移除协作文件失败');
    }
  };

  const stopTask = async () => {
    if (!activeTask) return;
    try {
      const result = await cancelWorkflowCollaborationTask(workflowId, activeTask.id);
      setTasks((current) =>
        current.map((item) => (item.id === result.task.id ? result.task : item)),
      );
    } catch {
      toast.error('停止工作流 AI 任务失败');
    }
  };

  const resetContext = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await resetWorkflowCollaborationContext(workflowId);
      toast.success('已重置后续对话上下文，历史记录仍保留');
    } catch {
      toast.error('重置 AI 上下文失败');
    } finally {
      setResetting(false);
    }
  };

  const revertChange = async (change: WorkflowCollaborationChange) => {
    setRevertingId(change.id);
    try {
      const result = await revertWorkflowCollaborationChange(workflowId, change.id);
      if (onWorkflowUpdatedRef.current(result.workflow) !== false) {
        syncedRevisionRef.current = result.revision;
      }
      await refresh(false);
      toast.success('已撤销整次 AI 变更');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '相关节点已有后续修改，无法撤销');
    } finally {
      setRevertingId(null);
    }
  };

  if (!workflowId)
    return <p className="p-4 text-sm text-muted-foreground">保存后即可开始 AI 协作。</p>;

  return (
    <section className={cn('flex min-h-0 flex-1 flex-col bg-card', className)}>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">AI 协作</h2>
            <p className="truncate text-xs text-muted-foreground">
              {context.selectedNodeId
                ? `当前节点：${context.nodeLabels?.[context.selectedNodeId] || context.selectedNodeId}`
                : '直接更新草稿，后台持续执行'}
            </p>
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => void resetContext()}
          disabled={resetting}
          aria-label="重置 AI 上下文"
          title="重置 AI 上下文"
        >
          <TimerReset />
        </Button>
      </header>

      <div ref={timelineRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <BoxLoadingOverlay show={loading} title="正在加载协作记录" compact />
        <div className="flex min-h-full flex-col gap-4 px-4 py-4">
          {archivedSessions.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                已保留 {archivedSessions.length} 个旧会话为只读记录
              </p>
              <div className="space-y-2">
                {archivedSessions.map((session) => {
                  const timeline = archivedTimelines[session.id];
                  return (
                    <details
                      key={session.id}
                      className="group rounded-lg border border-border bg-background px-3 py-2"
                      onToggle={(event) => {
                        if (event.currentTarget.open) void loadArchivedSession(session.id);
                      }}
                    >
                      <summary className="cursor-pointer list-none text-xs font-medium">
                        <span>{session.title || '旧会话'}</span>
                        <span className="ml-2 font-normal text-muted-foreground">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </span>
                      </summary>
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        {loadingArchivedId === session.id ? (
                          <p className="text-xs text-muted-foreground">正在读取旧记录…</p>
                        ) : null}
                        {timeline?.messages.map((message) => (
                          <ConversationMessageBubble
                            key={message.id}
                            role={message.role}
                            content={message.content}
                            createdAt={message.createdAt}
                            presentation="workspace"
                          />
                        ))}
                        {timeline?.proposals.map((proposal) => (
                          <div
                            key={proposal.id}
                            className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
                          >
                            {proposal.summary}
                          </div>
                        ))}
                        {timeline &&
                        timeline.messages.length === 0 &&
                        timeline.proposals.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            这个旧会话没有可显示的记录。
                          </p>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : null}
          {messages.length === 0 && latestTasks.length === 0 ? (
            <div className="my-auto flex flex-col items-center gap-3 py-10 text-center">
              <span className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Bot className="size-6" />
              </span>
              <div>
                <p className="text-sm font-medium">描述你希望工作流发生的变化</p>
                <p className="mt-1 text-xs text-muted-foreground">冲突时不会覆盖你的手动修改。</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant="outline"
                    onClick={() => void sendMessage(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <ConversationMessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              createdAt={message.createdAt}
              presentation="workspace"
              header={
                message.role === 'user' &&
                sentAttachments.some((attachment) => attachment.messageId === message.id) ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {sentAttachments
                      .filter((attachment) => attachment.messageId === message.id)
                      .map((attachment) => (
                        <ConversationAttachmentCard
                          key={attachment.id}
                          name={attachment.name}
                          mimeType={attachment.mimeType}
                          sizeBytes={attachment.sizeBytes}
                          onOpen={() =>
                            void downloadWorkflowCollaborationAttachment(
                              workflowId,
                              attachment,
                            ).catch(() => toast.error('下载协作文件失败'))
                          }
                        />
                      ))}
                  </div>
                ) : undefined
              }
            />
          ))}
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">需要你的确认</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{approval.summary}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={decidingApprovalId === approval.id}
                  onClick={() => void decideApproval(approval, 'rejected')}
                >
                  拒绝
                </Button>
                <Button
                  size="sm"
                  disabled={decidingApprovalId === approval.id}
                  onClick={() => void decideApproval(approval, 'approved')}
                >
                  确认执行
                </Button>
              </div>
            </div>
          ))}
          {latestTasks.map((task) => {
            const change = changesByTask.get(task.id);
            const diff = change ? parseWorkflowCollaborationDiff(change.diff) : {};
            const nodeIds = [...(diff.added || []), ...(diff.updated || [])];
            return (
              <div key={task.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <StatusIcon task={task} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{statusLabel(task)}</p>
                    </div>
                  </div>
                  {task.status === 'running' ? (
                    <Badge variant="secondary">{Math.max(task.progress, 5)}%</Badge>
                  ) : null}
                </div>
                {nodeIds.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {nodeIds.map((nodeId) => (
                      <Button
                        key={nodeId}
                        size="xs"
                        variant="outline"
                        onClick={() => onLocateNode?.(nodeId)}
                      >
                        <LocateFixed />
                        {context.nodeLabels?.[nodeId] || nodeId}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {diff.risks?.length ? (
                  <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    {diff.risks.join('；')}
                  </div>
                ) : null}
                {change?.status === 'applied' ? (
                  <div className="mt-3 flex gap-2 border-t border-border/70 pt-3">
                    <Button size="sm" variant="outline" onClick={() => onLocateNode?.()}>
                      查看画布
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revertingId === change.id}
                      onClick={() => void revertChange(change)}
                    >
                      <RotateCcw />
                      撤销
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border bg-card p-3">
        <ConversationComposer
          value={input}
          onValueChange={setInput}
          onSubmit={() => void sendMessage()}
          placeholder="描述要修改的节点、连线或配置…"
          maxLength={4000}
          presentation="workspace"
          disabled={sending}
          canSubmit={!sending}
          files={attachments}
          onFilesSelected={(files) => void uploadFiles(files)}
          onFileRemove={(file) => void removeFile(file)}
          uploadingFiles={uploadingFiles}
          skills={skills}
          activeSkillId={activeSkillId}
          onActiveSkillChange={setActiveSkillId}
          onStop={activeTask ? () => void stopTask() : undefined}
          footer={
            <ModelPicker
              value={modelId || undefined}
              onValueChange={setModelId}
              capability="text"
              label="协作模型"
              compact
              compactLabel="模型："
              compactTrigger
              autoSelectFirst
            />
          }
        />
      </div>
    </section>
  );
});
