import { Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import {
  decideWorkflowApproval,
  listWorkflowApprovals,
  type WorkflowApproval,
} from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkflowApprovalsDialogProps {
  workflowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowApprovalsDialog({
  workflowId,
  open,
  onOpenChange,
}: WorkflowApprovalsDialogProps) {
  const [items, setItems] = useState<WorkflowApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listWorkflowApprovals(workflowId);
      setItems(result.list);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '加载人工审批失败'));
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const decide = async (approval: WorkflowApproval, decision: 'approved' | 'rejected') => {
    setDecidingId(approval.id);
    try {
      const updated = await decideWorkflowApproval(workflowId, approval.id, decision);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(
        decision === 'approved' ? '已批准，工作流将继续运行' : '已拒绝，工作流将按拒绝分支继续',
      );
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '处理人工审批失败'));
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>人工审批</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : items.length ? (
            items.map((approval) => (
              <article key={approval.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-amber-600" />
                      <h3 className="truncate text-sm font-medium">{approval.title}</h3>
                      <Badge variant={approval.status === 'pending' ? 'secondary' : 'outline'}>
                        {approval.status === 'pending'
                          ? '待处理'
                          : approval.status === 'approved'
                            ? '已批准'
                            : '已拒绝'}
                      </Badge>
                    </div>
                    {approval.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{approval.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(approval.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {approval.status === 'pending' ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        disabled={decidingId === approval.id}
                        onClick={() => void decide(approval, 'approved')}
                      >
                        {decidingId === approval.id ? (
                          <Loader2 className="mr-1 size-4 animate-spin" />
                        ) : (
                          <Check className="mr-1 size-4" />
                        )}
                        批准
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decidingId === approval.id}
                        onClick={() => void decide(approval, 'rejected')}
                      >
                        <X className="mr-1 size-4" />
                        拒绝
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              暂无审批记录
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
