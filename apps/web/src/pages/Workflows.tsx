import {
  CircleCheckBig,
  FilePenLine,
  LayoutDashboard,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function formatWorkflowDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export default function WorkflowsPage({ embedded = false }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAICreate, setShowAICreate] = useState(false);
  const searchSkeletonTimerRef = useRef<number | null>(null);
  const workflowSearch = searchParams.get('workflow_search') || '';
  const workflowFilter = searchParams.get('workflow_filter') || 'all';
  const visibleWorkflows = useMemo(
    () =>
      workflows.filter((workflow) => {
        const matchesSearch = workflow.name
          .toLocaleLowerCase()
          .includes(workflowSearch.toLocaleLowerCase());
        const matchesStatus = workflowFilter === 'all' || workflow.status === workflowFilter;
        return matchesSearch && matchesStatus;
      }),
    [workflowFilter, workflowSearch, workflows],
  );

  const updateWorkflowQuery = (key: string, value: string) => {
    if (key === 'workflow_search') {
      setSearching(true);
      if (searchSkeletonTimerRef.current !== null) {
        window.clearTimeout(searchSkeletonTimerRef.current);
      }
      searchSkeletonTimerRef.current = window.setTimeout(() => {
        searchSkeletonTimerRef.current = null;
        setSearching(false);
      }, 160);
    }
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    listWorkflows({ page: 1, pageSize: 20 })
      .then((data) => setWorkflows(data.list))
      .catch(() => toast.error('加载工作流列表失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(
    () => () => {
      if (searchSkeletonTimerRef.current !== null) {
        window.clearTimeout(searchSkeletonTimerRef.current);
      }
    },
    [],
  );

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
    <div className={embedded ? '' : 'min-h-full bg-background'}>
      <div className={embedded ? '' : 'mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8'}>
        {!embedded && (
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
          </header>
        )}

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="overflow-hidden border-border shadow-none">
            <CardHeader className="gap-4 border-b border-border px-5 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">工作流</CardTitle>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="创建工作流"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus />
                </Button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workflowSearch}
                  onChange={(event) => updateWorkflowQuery('workflow_search', event.target.value)}
                  placeholder="搜索工作流"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 px-3 py-3">
              {[
                { value: 'all', label: '全部工作流', count: workflows.length, icon: Workflow },
                {
                  value: 'draft',
                  label: '草稿',
                  count: workflows.filter((item) => item.status === 'draft').length,
                  icon: FilePenLine,
                },
                {
                  value: 'published',
                  label: '已发布',
                  count: workflows.filter((item) => item.status === 'published').length,
                  icon: CircleCheckBig,
                },
              ].map((filter) => {
                const Icon = filter.icon;
                return (
                  <Button
                    key={filter.value}
                    variant="ghost"
                    className={`w-full justify-between px-3 ${
                      workflowFilter === filter.value
                        ? 'bg-accent text-accent-foreground hover:bg-accent'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() =>
                      updateWorkflowQuery(
                        'workflow_filter',
                        filter.value === 'all' ? '' : filter.value,
                      )
                    }
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={`size-4 ${
                          workflowFilter === filter.value ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <span>{filter.label}</span>
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {filter.count}
                    </span>
                  </Button>
                );
              })}
              <div className="my-3 border-t border-border" />
              <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">预置模板</p>
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      disabled
                        ? 'cursor-not-allowed text-muted-foreground/60'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate">{template.name}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border shadow-none">
            <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div className="flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Workflow className="size-6" />
                </span>
                <div>
                  <CardTitle className="text-xl">我的工作流</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">创建和管理自动化流程</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" onClick={() => setShowAICreate(true)}>
                  <Sparkles className="mr-2 size-4" />
                  AI 创建
                </Button>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="mr-2 size-4" />
                  新建工作流
                </Button>
              </div>
            </CardHeader>
            <div className="border-b border-border px-6 py-4">
              <div className="relative max-w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={workflowSearch}
                  onChange={(event) => updateWorkflowQuery('workflow_search', event.target.value)}
                  placeholder="搜索工作流"
                  className="pl-9"
                />
              </div>
            </div>
            {loading || searching ? (
              <div aria-busy="true" className="space-y-3 p-6">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : workflows.length === 0 ? (
              <div className="py-24 text-center">
                <Workflow className="mx-auto mb-3 size-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">还没有工作流</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">工作流名称</TableHead>
                    <TableHead>节点数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleWorkflows.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell className="max-w-0 px-6">
                        <Link
                          to={`/workbench/edit?id=${workflow.id}`}
                          className="flex min-w-0 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <LayoutDashboard className="size-5 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {workflow.name}
                            </span>
                            {workflow.description && (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {workflow.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getNodeCount(workflow)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={workflow.status === 'published' ? 'default' : 'secondary'}>
                          {workflow.status === 'published' ? '已发布' : '草稿'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatWorkflowDate(workflow.updatedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`删除 ${workflow.name}`}
                          onClick={() => setDeleteTarget(workflow)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {workflows.length > 0 && (
              <div className="border-t border-border px-6 py-4 text-sm text-muted-foreground">
                共 {visibleWorkflows.length} 个工作流
              </div>
            )}
          </Card>
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
    </div>
  );
}
