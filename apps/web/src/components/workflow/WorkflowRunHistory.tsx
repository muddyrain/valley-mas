import { AlertCircle, CheckCircle2, CircleSlash2, Clock3, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import {
  getWorkflowRun,
  listWorkflowRuns,
  type WorkflowRun,
  type WorkflowRunDetail,
} from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NodeRunDetails } from './NodeRunDetails';
import type { NodeRunSnapshot } from './runSession';

function statusMeta(status: WorkflowRun['status']) {
  if (status === 'success')
    return { label: '成功', icon: CheckCircle2, className: 'text-emerald-600' };
  if (status === 'cancelled')
    return { label: '已取消', icon: CircleSlash2, className: 'text-muted-foreground' };
  if (status === 'running')
    return { label: '运行中', icon: Loader2, className: 'animate-spin text-primary' };
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
    status: node?.status || 'error',
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
}: {
  workflowId: string | null;
  open: boolean;
}) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<WorkflowRunDetail | null>(null);
  const [loadingTrace, setLoadingTrace] = useState(false);

  useEffect(() => {
    if (!open || !workflowId) return;
    let active = true;
    setLoading(true);
    listWorkflowRuns(workflowId, { page: 1, pageSize: 20 })
      .then((data) => {
        if (active) setRuns(data.list);
      })
      .catch((error) => {
        if (active) setRuns([]);
        if (active) toast.error(getAPIErrorMessage(error, '加载运行历史失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, workflowId]);

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
          return (
            <Button
              key={run.id}
              variant="ghost"
              className="h-auto w-full justify-start rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted/50"
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
          );
        })}
      </div>
      {loadingTrace ? <Skeleton className="h-32 w-full" /> : null}
      {selectedRun ? (
        <section className="rounded-lg border border-border bg-muted/20">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">本次运行详情</div>
          <div className="divide-y divide-border">
            {selectedRun.nodes.map((node) => (
              <div key={node.id} className="p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{node.nodeId}</span>
                  <Badge variant="outline">{node.nodeType}</Badge>
                </div>
                <NodeRunDetails snapshot={nodeSnapshot(selectedRun, node.nodeId)} variant="panel" />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
