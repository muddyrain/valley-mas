import { Bot, Cable, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { type AIAppTool, getAPIErrorMessage, listAIAppTools } from '@/api/aiWorkbench';
import { listWorkflowCapabilities, type WorkflowToolCapability } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import NotionConnectorCard from './NotionConnectorCard';

const categoryLabels: Record<string, string> = {
  content: '内容',
  flow: '流程',
  image: '图片',
  knowledge: '知识',
  logic: '逻辑',
  tool: '外部工具',
};

const sideEffectLabels: Record<WorkflowToolCapability['sideEffect'], string> = {
  none: '无副作用',
  read: '读取数据',
  model: '调用模型',
  model_and_storage: '生成并存储',
  write: '写入内容',
};

function ToolCatalogSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} size="sm" className="min-h-44">
          <CardHeader className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
          </CardHeader>
          <CardContent className="mt-auto flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ToolResources() {
  const [tools, setTools] = useState<WorkflowToolCapability[]>([]);
  const [agentTools, setAgentTools] = useState<AIAppTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([listWorkflowCapabilities(), listAIAppTools()])
      .then(([capabilities, agentCatalog]) => {
        if (!active) return;
        setTools(capabilities.toolCapabilities);
        setAgentTools(agentCatalog.list);
      })
      .catch((loadError) => {
        if (!active) return;
        const message = getAPIErrorMessage(loadError, '加载工具目录失败');
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const agentToolNames = new Set(
    agentTools.filter((tool) => tool.permission === 'read').map((tool) => tool.name),
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="ai-tool-catalog-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ai-tool-catalog-title" className="text-lg font-semibold text-foreground">
              工具目录
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              在智能体或工作流编辑器中选择已支持的工具。
            </p>
          </div>
          {!loading && !error ? <Badge variant="outline">{tools.length} 个工具</Badge> : null}
        </div>

        {loading ? (
          <ToolCatalogSkeleton />
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {error}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => {
              const agentAvailable = agentToolNames.has(tool.id);
              return (
                <Card key={tool.id} size="sm" className="min-h-44">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Wrench className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="truncate" title={tool.name}>
                          {tool.name}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2 min-h-10">
                          {tool.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <p
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={tool.id}
                    >
                      {tool.id}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">
                        {categoryLabels[tool.category] || tool.category}
                      </Badge>
                      <Badge variant="secondary">{sideEffectLabels[tool.sideEffect]}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="gap-1">
                        <Cable className="size-3" />
                        工作流可用
                      </Badge>
                      {agentAvailable ? (
                        <Badge variant="outline" className="gap-1">
                          <Bot className="size-3" />
                          智能体可用
                        </Badge>
                      ) : null}
                      {!tool.available ? <Badge variant="destructive">暂不可用</Badge> : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="ai-tool-connection-title">
        <div className="mb-4">
          <h2 id="ai-tool-connection-title" className="text-lg font-semibold text-foreground">
            外部连接
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">为需要授权的工具管理连接。</p>
        </div>
        <NotionConnectorCard />
      </section>
    </div>
  );
}
