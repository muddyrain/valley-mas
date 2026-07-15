import { Bot, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIApp, createAIApp, listAIApps } from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function AgentItemSkeleton() {
  return (
    <div className="flex min-h-20 w-full items-center justify-between rounded-lg border border-border bg-background p-4">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-sm" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-5 w-10 rounded-md" />
    </div>
  );
}

export function AIAppsPanel() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AIApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const agents = apps.filter((app) => app.type === 'agent');

  useEffect(() => {
    listAIApps()
      .then(({ list }) => setApps(list))
      .catch(() => toast.error('加载 AI 应用失败'))
      .finally(() => setLoading(false));
  }, []);

  const createAgent = async () => {
    try {
      setCreating(true);
      const { app } = await createAIApp({
        type: 'agent',
        name: '未命名智能体',
        config: { modelProfile: 'ark-text-default', systemPrompt: '', openingMessage: '' },
      });
      setApps((items) => [app, ...items]);
      toast.success('已创建智能体草稿');
    } catch {
      toast.error('创建智能体失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">智能体</h2>
          <p className="mt-1 text-sm text-muted-foreground">配置、调试并发布可复用的 AI 能力。</p>
        </div>
        <Button size="sm" disabled={creating} onClick={createAgent}>
          <Plus className="mr-2 h-4 w-4" />
          新建智能体
        </Button>
      </div>
      <Card>
        <CardHeader className="sr-only">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            智能体
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AgentItemSkeleton />
              <AgentItemSkeleton />
            </div>
          ) : agents.length === 0 ? (
            <div className="py-7 text-center">
              <Bot className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">还没有智能体</p>
              <p className="mt-1 text-xs text-muted-foreground">
                从一个草稿开始，配置后可随时调试和发布。
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((app) => (
                <Button
                  key={app.id}
                  variant="outline"
                  className="flex h-auto min-h-20 w-full items-center justify-between rounded-lg p-4 text-left hover:border-primary/40 hover:bg-accent/50"
                  onClick={() => navigate(`/workbench/apps/${app.id}`)}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      <Bot className="h-4 w-4 text-primary" />
                      {app.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.description || '等待配置'}
                    </p>
                  </div>
                  <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
                    {app.status === 'published' ? '已发布' : '草稿'}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
