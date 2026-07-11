import { FileText, LayoutDashboard, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
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
import { cn } from '@/lib/utils';

const TAG_COLORS: Record<string, string> = {
  AI: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  博客: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  自动: 'bg-green-100 text-green-700 hover:bg-green-100',
  生成: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  内容: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  知识库: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
  检索: 'bg-teal-100 text-teal-700 hover:bg-teal-100',
};

const templates = [
  {
    id: 'blog-import',
    name: '博客导入工作流',
    description: '上传 Markdown 文件，AI 自动解析、生成摘要、匹配封面、推荐标签，一键创建博客文章',
    icon: FileText,
    tags: ['AI', '博客', '自动'],
    color: 'bg-purple-500',
  },
  {
    id: 'content-generate',
    name: '内容生成工作流',
    description: '输入主题，AI 自动生成文章内容、配图和标签',
    icon: Sparkles,
    tags: ['AI', '生成', '内容'],
    color: 'bg-blue-500',
  },
  {
    id: 'knowledge-search',
    name: '知识库检索工作流',
    description: '从向量数据库中检索相关知识，辅助内容创作',
    icon: Zap,
    tags: ['AI', '知识库', '检索'],
    color: 'bg-green-500',
  },
];

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
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 md:px-8">
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <Badge variant="outline" className="mb-4">
                  <LayoutDashboard className="h-3.5 w-3.5 mr-2" />
                  AI 工作台
                </Badge>
                <h1 className="text-3xl md:text-4xl font-semibold text-foreground mb-2">
                  AI 工作流管理
                </h1>
                <p className="text-muted-foreground">
                  创建和管理你的 AI 工作流，自动化内容创作和数据处理
                </p>
              </div>
              <Button size="lg" onClick={() => navigate('/workbench/create')}>
                <Plus className="h-5 w-5 mr-2" />
                创建工作流
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  预置模板
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {templates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <div
                      key={template.id}
                      onClick={() => navigate(`/workbench/create?template=${template.id}`)}
                      className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 hover:border-accent hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center rounded-lg p-3',
                          template.color,
                          'text-white',
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {template.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className={cn('text-xs border-0', TAG_COLORS[tag])}
                            >
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
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  我的工作流
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-accent hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center">
                          <LayoutDashboard className="h-5 w-5 text-primary" />
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
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
          </div>
        </div>

        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-foreground">AI 工作流能做什么？</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  自动化内容创作流程，从输入到输出一键完成
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">5+</div>
                  <div className="text-xs text-muted-foreground">预置模板</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">10+</div>
                  <div className="text-xs text-muted-foreground">节点类型</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <div className="text-xs text-muted-foreground">执行模式</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
