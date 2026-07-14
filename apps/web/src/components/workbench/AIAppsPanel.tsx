import { Bot, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AIApp, createAIApp, listAIApps } from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="mb-8">
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          智能体
        </CardTitle>
        <Button size="sm" variant="outline" disabled={creating} onClick={createAgent}>
          <Plus className="mr-2 h-4 w-4" />
          新建智能体
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">正在加载智能体…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有智能体。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {agents.map((app) => (
              <Button
                key={app.id}
                variant="outline"
                className="flex h-auto w-full items-center justify-between p-3 text-left"
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
  );
}
