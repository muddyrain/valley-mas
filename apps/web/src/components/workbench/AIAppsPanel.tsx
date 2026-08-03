import { ArrowUpRight, Bot, Clock3, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIApp, deleteAIApp, listAIApps } from '@/api/aiWorkbench';
import { AgentAvatar } from '@/components/ai-workbench/AgentAvatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { AIAgentCreateDialog } from './AIAgentCreateDialog';

function AgentItemSkeleton() {
  return (
    <Card size="sm" className="min-h-44 gap-0 py-0 ring-border/70">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function AgentCard({ app, onDelete }: { app: AIApp; onDelete: (app: AIApp) => void }) {
  return (
    <Card
      size="sm"
      className="group/agent relative min-h-44 gap-0 py-0 ring-border/70 transition-[box-shadow,ring-color] duration-200 hover:shadow-md hover:ring-foreground/20 focus-within:ring-2 focus-within:ring-ring"
    >
      <Link
        to={`/workbench/apps/${app.id}`}
        className="flex h-full min-h-44 cursor-pointer flex-col p-4 pr-11 outline-none"
      >
        <div className="flex items-start gap-3">
          <AgentAvatar name={app.name} src={app.avatarUrl} className="size-12" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                {app.name}
              </h3>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover/agent:text-foreground" />
            </div>
            <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {app.description || '等待配置'}
            </p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5 shrink-0" />
            更新于 {formatUpdatedAt(app.updatedAt)}
          </span>
          <Badge variant={app.status === 'published' ? 'default' : 'secondary'}>
            {app.status === 'published' ? '已发布' : '草稿'}
          </Badge>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label={`${app.name} 操作`}
            >
              <Ellipsis />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(app)}>
            <Trash2 />
            删除智能体
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

export function AIAppsPanel() {
  const [apps, setApps] = useState<AIApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIApp | null>(null);
  const [deleting, setDeleting] = useState(false);
  const agents = apps.filter((app) => app.type === 'agent');

  useEffect(() => {
    listAIApps()
      .then(({ list }) => setApps(list))
      .catch(() => toast.error('加载 AI 应用失败'))
      .finally(() => setLoading(false));
  }, []);

  const removeAgent = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await deleteAIApp(deleteTarget.id);
      setApps((items) => items.filter((item) => item.id !== deleteTarget.id));
      toast.success('智能体已删除');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除智能体失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">智能体</h2>
          <p className="mt-1 text-sm text-muted-foreground">配置、调试并发布可复用的 AI 能力。</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            创建智能体
          </Button>
        </div>
      </div>
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <AgentItemSkeleton />
          <AgentItemSkeleton />
          <AgentItemSkeleton />
        </div>
      ) : agents.length === 0 ? (
        <Card size="sm">
          <CardContent>
            <div className="py-7 text-center">
              <Bot className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">还没有智能体</p>
              <p className="mt-1 text-xs text-muted-foreground">
                从一个草稿开始，配置后可随时调试和发布。
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {agents.map((app) => (
            <AgentCard key={app.id} app={app} onDelete={setDeleteTarget} />
          ))}
        </div>
      )}
      <AIAgentCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={() => {
          void listAIApps().then(({ list }) => setApps(list));
        }}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除智能体？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除“{deleteTarget?.name}”及其版本、会话和运行记录，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void removeAgent()}
            >
              {deleting ? '删除中…' : '删除智能体'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
