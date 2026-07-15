import { BookOpenText, FileText, LayoutDashboard, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { AIAppsPanel } from '@/components/workbench/AIAppsPanel';
import { WORKFLOW_TEMPLATE_DEFS } from '../workflowTemplates';

const templates = WORKFLOW_TEMPLATE_DEFS;

export default function Workbench() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    listWorkflows({ page: 1, pageSize: 20 })
      .then((data) => setWorkflows(data.list))
      .catch(() => toast.error('加载工作流列表失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = (workflow: WorkflowItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(workflow);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await deleteWorkflow(deleteTarget.id);
      setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      toast.success('工作流已删除');
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const getNodeCount = (workflow: WorkflowItem): number => {
    try {
      const graph = JSON.parse(workflow.graph);
      return Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 md:px-8">
        <section className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="outline" className="mb-3">
              <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
              AI 工作台
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              创作与自动化
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              从智能体、工作流和资料库开始，继续最近的创作任务。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/workbench/knowledge')}>
              <BookOpenText className="mr-2 h-4 w-4" />
              资料库
            </Button>
            <Button onClick={() => navigate('/workbench/create')}>
              <Plus className="mr-2 h-4 w-4" />
              新建工作流
            </Button>
          </div>
        </section>

        <AIAppsPanel />

        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <Card size="sm" className="h-full">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  预置模板
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.map((template) => {
                  const Icon = template.icon;
                  const disabled = template.enabled === false;
                  const onTemplateClick = disabled
                    ? () => toast.info(`${template.name}暂未开放，先使用「博客导入工作流」`)
                    : () => navigate(`/workbench/create?template=${template.id}`);
                  return (
                    <div
                      key={template.id}
                      onClick={onTemplateClick}
                      className={`group flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors ${
                        disabled
                          ? 'cursor-not-allowed border-dashed border-muted-foreground/40 text-muted-foreground bg-muted/30'
                          : 'cursor-pointer border-border hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        {disabled && (
                          <p className="text-xs mt-1 text-amber-500">该模板正在对齐中</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>

          <section>
            <Card size="sm" className="h-full">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  工作流
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : workflows.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">还没有工作流</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => navigate('/workbench/create')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      创建第一个工作流
                    </Button>
                  </div>
                ) : (
                  workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      onClick={() => navigate(`/workbench/edit?id=${workflow.id}`)}
                      className="group flex items-center justify-between rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/60 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <LayoutDashboard className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {workflow.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            更新于 {new Date(workflow.updatedAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getNodeCount(workflow)} 节点
                        </Badge>
                        <Badge
                          variant={workflow.status === 'published' ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {workflow.status === 'published' ? '已发布' : '草稿'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDelete(workflow, e)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={() => !deleting && setDeleteTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">删除工作流？</DialogTitle>
              <DialogDescription>
                「{deleteTarget?.name}」删除后将无法恢复，确定要删除吗？
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                取消
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="bg-destructive text-primary-foreground hover:bg-destructive/90"
              >
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
