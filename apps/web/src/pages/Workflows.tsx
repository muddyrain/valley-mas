import { FileText, LayoutDashboard, Plus, Sparkles, Trash2, Workflow, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { deleteWorkflow, listWorkflows, type WorkflowItem } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AIWorkflowCreateDialog } from '@/components/workbench/AIWorkflowCreateDialog';
import { WorkflowCreateDialog } from '@/components/workbench/WorkflowCreateDialog';
import { WORKFLOW_TEMPLATE_DEFS } from './workflowTemplates';

function getNodeCount(workflow: WorkflowItem): number {
  try {
    const graph = JSON.parse(workflow.graph) as { nodes?: unknown[] };
    return Array.isArray(graph.nodes) ? graph.nodes.length : 0;
  } catch {
    return 0;
  }
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAICreate, setShowAICreate] = useState(false);

  useEffect(() => {
    listWorkflows({ page: 1, pageSize: 20 })
      .then((data) => setWorkflows(data.list))
      .catch(() => toast.error('加载工作流列表失败'))
      .finally(() => setLoading(false));
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await deleteWorkflow(deleteTarget.id);
      setWorkflows((items) => items.filter((item) => item.id !== deleteTarget.id));
      toast.success('工作流已删除');
      setDeleteTarget(null);
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-3">
              <Workflow className="mr-2 size-3.5" />
              工作流
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              自动化工作流
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">创建、编排和发布自动化流程。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowAICreate(true)}>
              <Sparkles className="mr-2 size-4" />
              AI 创建
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 size-4" />
              创建工作流
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section>
            <Card size="sm" className="h-full">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  预置模板
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {WORKFLOW_TEMPLATE_DEFS.map((template) => {
                  const Icon = template.icon;
                  const disabled = template.enabled === false;
                  return (
                    <Link
                      key={template.id}
                      to={`/workbench/templates/${template.id}`}
                      aria-disabled={disabled}
                      onClick={(event) => {
                        if (disabled) event.preventDefault();
                      }}
                      className={`group flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        disabled
                          ? 'cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground'
                          : 'border-border bg-background hover:bg-muted/60'
                      }`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{template.name}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {template.description}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card size="sm" className="h-full">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-primary" />
                  我的工作流
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3 p-3">
                      <Skeleton className="size-9 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : workflows.length === 0 ? (
                  <div className="py-10 text-center">
                    <Zap className="mx-auto mb-3 size-9 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">还没有工作流</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowCreate(true)}
                    >
                      <Plus className="mr-2 size-4" />
                      创建第一个工作流
                    </Button>
                  </div>
                ) : (
                  workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-background p-2 transition-colors hover:bg-muted/60"
                    >
                      <Link
                        to={`/workbench/edit?id=${workflow.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <LayoutDashboard className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {workflow.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            更新于 {new Date(workflow.updatedAt).toLocaleString('zh-CN')}
                          </span>
                        </span>
                        <Badge variant="outline">{getNodeCount(workflow)} 节点</Badge>
                        <Badge variant={workflow.status === 'published' ? 'default' : 'secondary'}>
                          {workflow.status === 'published' ? '已发布' : '草稿'}
                        </Badge>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`删除 ${workflow.name}`}
                        onClick={() => setDeleteTarget(workflow)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <WorkflowCreateDialog open={showCreate} onOpenChange={setShowCreate} />
      <AIWorkflowCreateDialog open={showAICreate} onOpenChange={setShowAICreate} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除工作流？</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」删除后将无法恢复，确定要删除吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? '删除中…' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
