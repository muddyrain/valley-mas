import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { ArrowLeft, Copy, GitBranch, Network, Workflow } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { createWorkflow } from '@/api/workflow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getNodeConfigSummary, NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { serializeWorkflowGraph } from '@/components/workflow/workflowGraph';
import { getWorkflowTemplateGraph } from '../workflowTemplateGraphs';
import { getWorkflowTemplate } from '../workflowTemplates';
import '@xyflow/react/dist/style.css';

interface TemplatePreviewNodeData {
  label: string;
  nodeType: string;
  config?: Record<string, unknown>;
}

function TemplatePreviewNode({ data }: NodeProps) {
  const nodeData = data as unknown as TemplatePreviewNodeData;
  const config = NODE_CONFIGS[nodeData.nodeType];
  const summary = getNodeConfigSummary(nodeData.nodeType, nodeData.config);

  return (
    <div className="relative w-[196px] rounded-lg border border-border bg-card px-3 py-3 shadow-xs">
      <Handle
        type="target"
        position={Position.Left}
        className="!pointer-events-none !h-2.5 !w-2.5 !-left-1.5 !border-2 !border-primary !bg-background"
      />
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Workflow className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{nodeData.label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {summary || config?.label || nodeData.nodeType}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!pointer-events-none !h-2.5 !w-2.5 !-right-1.5 !border-2 !border-primary !bg-background"
      />
    </div>
  );
}

const templatePreviewNodeTypes = { templatePreview: TemplatePreviewNode };

const previewEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: 'hsl(var(--primary))',
  },
};

export default function WorkflowTemplateDetail() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const [isCopying, setIsCopying] = useState(false);
  const copyRequestRef = useRef<Promise<void> | null>(null);
  const template = getWorkflowTemplate(templateId || '');
  const graph = useMemo(
    () => (templateId ? getWorkflowTemplateGraph(templateId) : undefined),
    [templateId],
  );
  const supported = Boolean(template?.enabled && graph);

  const previewNodes = useMemo(
    () =>
      (graph?.nodes || []).map((node) => ({
        ...node,
        type: 'templatePreview',
        draggable: false,
        selectable: false,
      })),
    [graph],
  );

  const handleCopy = async () => {
    if (!template || !graph || !template.enabled || copyRequestRef.current) return;

    const copyRequest = (async () => {
      setIsCopying(true);
      try {
        const workflow = await createWorkflow({
          name: template.name,
          graph: serializeWorkflowGraph(graph.nodes, graph.edges),
          status: 'draft',
        });
        toast.success('已复制到我的工作流');
        navigate(`/workbench/edit?id=${workflow.id}`, { replace: true });
      } catch {
        toast.error('复制模板失败，请稍后重试');
      } finally {
        setIsCopying(false);
      }
    })();

    copyRequestRef.current = copyRequest;
    try {
      await copyRequest;
    } finally {
      copyRequestRef.current = null;
    }
  };

  if (!template) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-10 sm:px-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>模板不存在</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">该模板可能已下架或链接无效。</p>
              <Button onClick={() => navigate('/workbench')}>返回工作台</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const Icon = template.icon;

  return (
    <ReactFlowProvider>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
          <div className="mb-6 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/workbench')}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">返回工作台</span>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">工作流模板</p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {template.name}
              </h1>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitBranch className="h-4 w-4 text-primary" />
                  工作流预览
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {graph ? (
                  <div className="h-[min(560px,calc(100vh-240px))] min-h-[360px] bg-muted/20">
                    <ReactFlow
                      nodes={previewNodes}
                      edges={graph.edges}
                      nodeTypes={templatePreviewNodeTypes}
                      defaultEdgeOptions={previewEdgeOptions}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      minZoom={0.35}
                      maxZoom={1.5}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      nodesFocusable={false}
                      edgesFocusable={false}
                      elementsSelectable={false}
                      zoomOnDoubleClick={false}
                      proOptions={{ hideAttribution: true }}
                    >
                      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    </ReactFlow>
                  </div>
                ) : (
                  <div className="flex min-h-[360px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    该模板暂时无法预览。
                  </div>
                )}
              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card>
                <CardContent className="space-y-5 pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">{template.name}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-y border-border py-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">节点</p>
                      <p className="mt-1 font-medium text-foreground">{graph?.nodes.length ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">连接</p>
                      <p className="mt-1 font-medium text-foreground">{graph?.edges.length ?? 0}</p>
                    </div>
                  </div>

                  {supported ? (
                    <Button
                      className="w-full"
                      onClick={() => void handleCopy()}
                      disabled={isCopying}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {isCopying ? '复制中...' : '复制到我的工作流'}
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                      此模板暂未开放复制。
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Network className="h-4 w-4 text-primary" />
                    使用方式
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  复制后会在你的工作流列表中创建一份可独立编辑和运行的草稿。
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
      </div>
    </ReactFlowProvider>
  );
}
