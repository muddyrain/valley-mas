import { AlertCircle, Ban, CheckCircle2, CircleSlash2, Clock3, Loader2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
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

export function WorkflowRunHistory({
  workflowId,
  open,
  onRetry,
  onResume,
}: {
  workflowId: string | null;
  open: boolean;
  onRetry: (run: WorkflowRunDetail) => void;
  onResume: (run: WorkflowRunDetail) => void;
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
      toast.success('已请求取消运行');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '取消运行失败'));
    } finally {
      setCancellingRunId(null);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {runs.map((run) => {
          const meta = statusMeta(run.status);
          const Icon = meta.icon;
          const selected = selectedRun?.run.id === run.id;
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
                aria-pressed={selected}
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
      {loadingTrace ? <Skeleton className="h-32 w-full" /> : null}
      {selectedRun ? (
        <>
          {selectedRun.retry?.allowed ? (
            <Button className="w-full" onClick={() => onRetry(selectedRun)}>
              重新运行
            </Button>
          ) : null}
          <section className="rounded-lg border border-border bg-muted/20">
            <div className="border-b border-border px-3 py-2 text-sm font-medium">本次运行详情</div>
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
                  />
                  {node.status === 'error' && selectedRun.resume?.allowed ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => onResume(selectedRun)}
                    >
                      重试此节点并继续
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
          {selectedRun.events?.length ? (
            <section className="rounded-lg border border-border bg-muted/20">
              <div className="border-b border-border px-3 py-2 text-sm font-medium">运行事件</div>
              <ol className="divide-y divide-border">
                {selectedRun.events.map((event) => {
                  const meta = statusMeta(event.status);
                  const Icon = meta.icon;
                  return (
                    <li key={event.id} className="flex items-start gap-2 px-3 py-2 text-xs">
                      <Icon className={`mt-0.5 size-3.5 shrink-0 ${meta.className}`} />
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          #{event.sequence} {event.nodeId || '工作流'} · {meta.label}
                        </span>
                        {event.message ? (
                          <span className="mt-0.5 block">{event.message}</span>
                        ) : null}
                      </span>
                      <time className="shrink-0 text-muted-foreground" dateTime={event.occurredAt}>
                        {new Date(event.occurredAt).toLocaleTimeString('zh-CN')}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
