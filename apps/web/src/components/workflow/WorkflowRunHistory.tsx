import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronDown,
  CircleSlash2,
  Clock3,
  Loader2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import {
  cancelWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
  type WorkflowRun,
  type WorkflowRunDetail,
  type WorkflowRunTraceEvent,
} from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { NodeRunDetails } from './NodeRunDetails';
import type { NodeRunSnapshot } from './runSession';

function statusMeta(status: WorkflowRun['status'] | WorkflowRunTraceEvent['status']) {
  if (status === 'success')
    return { label: '成功', icon: CheckCircle2, className: 'text-emerald-600' };
  if (status === 'cancelled')
    return { label: '已取消', icon: CircleSlash2, className: 'text-muted-foreground' };
  if (status === 'cancelling')
    return { label: '取消中', icon: Loader2, className: 'animate-spin text-primary' };
  if (status === 'skipped')
    return { label: '已跳过', icon: CircleSlash2, className: 'text-muted-foreground' };
  if (status === 'running')
    return { label: '运行中', icon: Loader2, className: 'animate-spin text-primary' };
  if (status === 'waiting_approval')
    return { label: '等待审批', icon: Clock3, className: 'text-amber-600' };
  return { label: '失败', icon: AlertCircle, className: 'text-destructive' };
}

function parsePreview(raw: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function nodeSnapshot(detail: WorkflowRunDetail, nodeID: string): NodeRunSnapshot {
  const node = detail.nodes.find((item) => item.nodeId === nodeID);
  return {
    status: node?.status === 'waiting_approval' ? 'running' : (node?.status ?? 'error'),
    input: node ? parsePreview(node.input) : undefined,
    output: node ? parsePreview(node.output) : undefined,
    error: node?.status === 'error' ? '该节点在本次运行中失败' : undefined,
    errorCode: node?.errorCode,
    durationMs: node?.durationMs,
  };
}

type TimelineEvent = {
  event: WorkflowRunTraceEvent;
  startedAt?: string;
};

function compactTraceEvents(events: WorkflowRunTraceEvent[]): TimelineEvent[] {
  const compacted: TimelineEvent[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const firstEvent = events[index];
    const matchesNode = (
      candidate: WorkflowRunTraceEvent | undefined,
    ): candidate is WorkflowRunTraceEvent =>
      Boolean(
        candidate &&
          candidate.nodeId === firstEvent.nodeId &&
          candidate.loopIteration === firstEvent.loopIteration &&
          candidate.loopDepth === firstEvent.loopDepth &&
          candidate.bodyNodeId === firstEvent.bodyNodeId,
      );

    let event = firstEvent;
    const startedAt = firstEvent.status === 'running' ? firstEvent.occurredAt : undefined;
    const completedEvent = events[index + 1];
    if (
      firstEvent.status === 'running' &&
      matchesNode(completedEvent) &&
      completedEvent.status !== 'running'
    ) {
      event = completedEvent;
      index += 1;
    }

    compacted.push({ event, startedAt });
  }

  return compacted;
}

function durationText(event: WorkflowRunTraceEvent, startedAt?: string) {
  const durationMs =
    event.durationMs ??
    (startedAt ? new Date(event.occurredAt).getTime() - new Date(startedAt).getTime() : undefined);
  if (!durationMs || durationMs < 0) return null;
  return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(2)}s` : `${durationMs}ms`;
}

function timeRangeText(event: WorkflowRunTraceEvent, startedAt?: string) {
  const completedAt = new Date(event.occurredAt).toLocaleTimeString('zh-CN');
  if (!startedAt || startedAt === event.occurredAt) return completedAt;
  return `${new Date(startedAt).toLocaleTimeString('zh-CN')} → ${completedAt}`;
}

function TraceEventRow({
  item,
  nodeLabels,
  historical,
  isWorkflowTerminal = false,
  showSequence = false,
  isLast,
}: {
  item: TimelineEvent;
  nodeLabels: Record<string, string>;
  historical: boolean;
  isWorkflowTerminal?: boolean;
  showSequence?: boolean;
  isLast: boolean;
}) {
  const { event } = item;
  const meta = statusMeta(event.status);
  const Icon = meta.icon;
  const nodeLabel = isWorkflowTerminal
    ? '工作流'
    : event.nodeId
      ? (nodeLabels[event.nodeId] ?? event.nodeId)
      : '工作流';
  const statusLabel = isWorkflowTerminal
    ? event.status === 'success'
      ? '工作流完成'
      : event.status === 'error'
        ? '工作流失败'
        : meta.label
    : historical && event.status === 'running'
      ? '开始执行'
      : meta.label;
  const duration = durationText(event, item.startedAt);
  const timeRange = timeRangeText(event, item.startedAt);

  return (
    <li
      className={cn(
        'relative flex gap-3 py-2.5 pl-1',
        !isLast &&
          'after:absolute after:bottom-[-10px] after:left-[14px] after:top-7 after:w-px after:bg-border',
      )}
    >
      <span className="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
        <Icon className={`size-3.5 ${meta.className}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showSequence ? (
            <span className="font-mono text-[10px] text-muted-foreground">#{event.sequence}</span>
          ) : null}
          <span className="min-w-0 truncate text-xs font-medium text-foreground">{nodeLabel}</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
            {statusLabel}
          </Badge>
          {duration ? (
            <span className="font-mono text-[10px] text-muted-foreground">{duration}</span>
          ) : null}
        </div>
        {event.message ? (
          <p
            className={cn(
              'mt-1 text-xs leading-5 text-muted-foreground',
              event.status === 'error' &&
                'rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-destructive',
            )}
          >
            {event.message}
          </p>
        ) : null}
      </div>
      <time
        className="mt-0.5 shrink-0 text-right text-[10px] leading-5 text-muted-foreground"
        dateTime={event.occurredAt}
      >
        {timeRange}
      </time>
    </li>
  );
}

export function WorkflowRunHistory({
  workflowId,
  open,
  terminalRunID,
  onRetry,
  onResume,
  resuming = false,
  nodeLabels = {},
}: {
  workflowId: string | null;
  open: boolean;
  terminalRunID?: string;
  onRetry: (run: WorkflowRunDetail) => void;
  onResume: (run: WorkflowRunDetail) => void;
  resuming?: boolean;
  nodeLabels?: Record<string, string>;
}) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<WorkflowRunDetail | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);

  const loadRuns = useCallback(
    async (showLoading = true) => {
      if (!workflowId) return;
      if (showLoading) setLoading(true);
      try {
        setRuns((await listWorkflowRuns(workflowId, { page: 1, pageSize: 20 })).list);
      } catch (error) {
        setRuns([]);
        toast.error(getAPIErrorMessage(error, '加载运行历史失败'));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [workflowId],
  );

  useEffect(() => {
    if (!open || !workflowId) return;
    void loadRuns();
  }, [loadRuns, open, workflowId]);

  useEffect(() => {
    if (!open || !workflowId || !terminalRunID) return;
    void loadRuns(false);
  }, [loadRuns, open, terminalRunID, workflowId]);

  useEffect(() => {
    if (!open) setSelectedRun(null);
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      !workflowId ||
      !runs.some((run) => run.status === 'running' || run.status === 'cancelling')
    ) {
      return;
    }
    const timer = window.setTimeout(() => void loadRuns(false), 1500);
    return () => window.clearTimeout(timer);
  }, [loadRuns, open, runs, workflowId]);

  const loadTrace = async (run: WorkflowRun) => {
    if (!workflowId) return;
    setLoadingTrace(true);
    try {
      setSelectedRun(await getWorkflowRun(workflowId, run.id));
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载运行详情失败'));
    } finally {
      setLoadingTrace(false);
    }
  };

  const handleCancelRun = async (run: WorkflowRun) => {
    if (!workflowId || run.status !== 'running' || cancellingRunId) return;
    setCancellingRunId(run.id);
    try {
      await cancelWorkflowRun(workflowId, run.id);
      setRuns((previous) =>
        previous.map((item) => (item.id === run.id ? { ...item, status: 'cancelling' } : item)),
      );
      setSelectedRun((previous) =>
        previous?.run.id === run.id
          ? { ...previous, run: { ...previous.run, status: 'cancelling' } }
          : previous,
      );
      toast.message('正在取消运行');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '取消运行失败'));
    } finally {
      setCancellingRunId(null);
    }
  };

  const traceEvents = selectedRun?.events ?? [];
  const historicalRun =
    selectedRun != null &&
    selectedRun.run.status !== 'running' &&
    selectedRun.run.status !== 'cancelling';
  const terminalEvent = traceEvents[traceEvents.length - 1];
  const workflowTerminalEventID =
    historicalRun && terminalEvent?.status === selectedRun?.run.status
      ? terminalEvent.id
      : undefined;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (!runs.length)
    return <p className="py-10 text-center text-sm text-muted-foreground">暂无运行记录</p>;

  if (loadingTrace || selectedRun) {
    return (
      <div className="space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          disabled={loadingTrace}
          onClick={() => setSelectedRun(null)}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          返回记录
        </Button>
        {loadingTrace ? <Skeleton className="h-56 w-full" /> : null}
        {selectedRun ? (
          <>
            {selectedRun.retry?.allowed ? (
              <Button className="w-full" onClick={() => onRetry(selectedRun)}>
                重新运行
              </Button>
            ) : null}
            <section className="rounded-lg border border-border bg-muted/20">
              <div className="border-b border-border px-3 py-2 text-sm font-medium">
                本次运行详情
              </div>
              <div className="divide-y divide-border">
                {selectedRun.nodes.map((node) => (
                  <div key={node.id} className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{node.nodeId}</span>
                      <Badge variant="outline">{node.nodeType}</Badge>
                    </div>
                    <NodeRunDetails
                      snapshot={nodeSnapshot(selectedRun, node.nodeId)}
                      variant="panel"
                      resuming={resuming}
                    />
                    {node.status === 'error' && selectedRun.resume?.allowed ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        disabled={resuming}
                        onClick={() => onResume(selectedRun)}
                      >
                        {resuming ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                        {resuming ? '正在重试…' : '重试此节点并继续'}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
            {traceEvents.length ? (
              <section className="rounded-lg border border-border bg-muted/20">
                {(() => {
                  const timelineEvents = compactTraceEvents(traceEvents);
                  return (
                    <>
                      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">运行事件</p>
                          <p className="text-[11px] text-muted-foreground">
                            {timelineEvents.length} 个节点阶段
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                          {traceEvents.length} 条原始事件
                        </Badge>
                      </div>
                      <ol className="px-3 py-2">
                        {timelineEvents.map((item, index) => (
                          <TraceEventRow
                            key={item.event.id}
                            item={item}
                            nodeLabels={nodeLabels}
                            historical={historicalRun}
                            isWorkflowTerminal={item.event.id === workflowTerminalEventID}
                            isLast={index === timelineEvents.length - 1}
                          />
                        ))}
                      </ol>
                      {timelineEvents.length < traceEvents.length ? (
                        <Collapsible className="border-t border-border">
                          <CollapsibleTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between rounded-none px-3 text-xs text-muted-foreground"
                              />
                            }
                          >
                            查看全部 {traceEvents.length} 条原始事件
                            <ChevronDown className="size-3.5" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ol className="border-t border-border px-3 py-2">
                              {traceEvents.map((event, index) => (
                                <TraceEventRow
                                  key={event.id}
                                  item={{ event }}
                                  nodeLabels={nodeLabels}
                                  historical={historicalRun}
                                  isWorkflowTerminal={event.id === workflowTerminalEventID}
                                  showSequence
                                  isLast={index === traceEvents.length - 1}
                                />
                              ))}
                            </ol>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : null}
                    </>
                  );
                })()}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {runs.map((run) => {
          const meta = statusMeta(run.status);
          const Icon = meta.icon;
          const canCancel = run.status === 'running' || run.status === 'cancelling';
          const isCancelling = run.status === 'cancelling' || cancellingRunId === run.id;
          return (
            <div
              key={run.id}
              className="flex min-w-0 items-stretch rounded-lg border border-border hover:bg-muted/50"
            >
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start rounded-lg border-0 px-3 py-2.5 text-left"
                onClick={() => void loadTrace(run)}
              >
                <Icon className={`mr-2 size-4 shrink-0 ${meta.className}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{meta.label}</span>
                  <time
                    className="mt-0.5 block text-xs text-muted-foreground"
                    dateTime={run.startedAt}
                  >
                    {new Date(run.startedAt).toLocaleString('zh-CN')}
                  </time>
                </span>
                {run.finishedAt ? <Clock3 className="size-4 text-muted-foreground" /> : null}
              </Button>
              {canCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mr-1 self-center px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isCancelling}
                  aria-label={isCancelling ? '取消中' : '取消运行'}
                  title={isCancelling ? '取消中' : '取消运行'}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleCancelRun(run);
                  }}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span className="ml-1 text-xs">取消中</span>
                    </>
                  ) : (
                    <>
                      <Ban className="size-4" />
                      <span className="ml-1 text-xs">取消</span>
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
