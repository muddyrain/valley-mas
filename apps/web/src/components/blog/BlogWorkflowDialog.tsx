import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  type NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image,
  Loader2,
  Play,
  Sparkles,
  Tags,
  Type,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Group, Visibility } from '@/api/blog';
import {
  publishWorkflowDraft,
  startBlogWorkflow,
  type WorkflowCoverData,
  type WorkflowExcerptData,
  type WorkflowParseData,
  type WorkflowSSEEvent,
  type WorkflowTagsData,
} from '@/api/blogWorkflow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WorkflowPhase = 'upload' | 'running' | 'preview' | 'done';

interface StepStatus {
  step: string;
  status: 'pending' | 'running' | 'success' | 'skipped' | 'error';
  message?: string;
  data?: unknown;
}

interface PreviewData {
  postId: string;
  title: string;
  excerpt: string;
  coverUrl: string;
  coverSource: string;
  tagNames: string[];
  tagIds: string[];
}

const STEP_CONFIG = [
  { id: 'parse', label: '解析 Markdown', icon: FileText },
  { id: 'excerpt', label: 'AI 生成摘要', icon: Type },
  { id: 'cover', label: 'AI 匹配封面', icon: Image },
  { id: 'tags', label: 'AI 推荐标签', icon: Tags },
  { id: 'create', label: '创建草稿', icon: Sparkles },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'border-border bg-accent/30 text-muted-foreground',
  running: 'border-primary bg-primary text-primary-foreground',
  success: 'border-primary bg-primary text-primary-foreground',
  skipped: 'border-border bg-muted text-muted-foreground',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

// --- Workflow Node Component ---
function WorkflowNode({ data }: NodeProps) {
  const { label, status, message } = data as {
    label: string;
    status: string;
    message?: string;
    icon: string;
  };

  const statusIcon = (() => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  })();

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-primary/50 !w-2 !h-2" />
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 px-4 py-3 shadow-sm transition-all duration-300 min-w-[180px]',
          STATUS_COLORS[status] || STATUS_COLORS.pending,
        )}
      >
        {statusIcon}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          {message && status !== 'pending' && <span className="text-xs opacity-70">{message}</span>}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary/50 !w-2 !h-2" />
    </>
  );
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode,
};

function buildDagreLayout(steps: StepStatus[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 });

  const nodes: Node[] = steps.map((step, i) => {
    const config = STEP_CONFIG[i];
    g.setNode(step.step, { width: 200, height: 60 });
    return {
      id: step.step,
      type: 'workflowNode',
      position: { x: 0, y: 0 },
      data: {
        label: config.label,
        status: step.status,
        message: step.message,
        icon: config.id,
      },
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const sourceStatus = steps[i].status;
    const isSkipped = sourceStatus === 'skipped';
    const isRunning = sourceStatus === 'running';
    g.setEdge(steps[i].step, steps[i + 1].step);
    edges.push({
      id: `e-${steps[i].step}-${steps[i + 1].step}`,
      source: steps[i].step,
      target: steps[i + 1].step,
      animated: isRunning,
      style: isSkipped
        ? { stroke: 'hsl(var(--border))', strokeDasharray: '5 5' }
        : isRunning
          ? { stroke: 'hsl(var(--primary))' }
          : { stroke: 'hsl(var(--muted-foreground))' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isSkipped
          ? 'hsl(var(--border))'
          : isRunning
            ? 'hsl(var(--primary))'
            : 'hsl(var(--muted-foreground))',
      },
    });
  }

  dagre.layout(g);

  for (const node of nodes) {
    const pos = g.node(node.id);
    node.position = { x: pos.x - 100, y: pos.y - 30 };
  }

  return { nodes, edges };
}

export interface BlogWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  defaultGroupId?: string;
  defaultVisibility?: Visibility;
  onCreated?: (result: { postId: string }) => void | Promise<void>;
}

export function BlogWorkflowDialog({
  open,
  onOpenChange,
  groups,
  defaultGroupId = '',
  defaultVisibility = 'private',
  onCreated,
}: BlogWorkflowDialogProps) {
  return (
    <ReactFlowProvider>
      <BlogWorkflowDialogInner
        open={open}
        onOpenChange={onOpenChange}
        groups={groups}
        defaultGroupId={defaultGroupId}
        defaultVisibility={defaultVisibility}
        onCreated={onCreated}
      />
    </ReactFlowProvider>
  );
}

function BlogWorkflowDialogInner({
  open,
  onOpenChange,
  groups,
  defaultGroupId = '',
  defaultVisibility = 'private',
  onCreated,
}: BlogWorkflowDialogProps) {
  const [phase, setPhase] = useState<WorkflowPhase>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [, setStepStatuses] = useState<StepStatus[]>(
    STEP_CONFIG.map((s) => ({ step: s.id, status: 'pending' as const })),
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const initialNodes = useMemo(
    () =>
      STEP_CONFIG.map((s, i) => ({
        id: s.id,
        type: 'workflowNode',
        position: { x: i * 260, y: 0 },
        data: { label: s.label, status: 'pending', icon: s.id },
      })),
    [],
  );

  const initialEdges = useMemo(
    () =>
      STEP_CONFIG.slice(0, -1).map((s, i) => ({
        id: `e-${s.id}-${STEP_CONFIG[i + 1].id}`,
        source: s.id,
        target: STEP_CONFIG[i + 1].id,
        style: { stroke: 'hsl(var(--muted-foreground))' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' },
      })),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const { fitView } = useReactFlow();

  const resetState = useCallback(() => {
    setPhase('upload');
    setSelectedFile(null);
    setStepStatuses(STEP_CONFIG.map((s) => ({ step: s.id, status: 'pending' as const })));
    setPreview(null);
    setPublishing(false);
    setError(null);
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  useEffect(() => {
    if (!open) resetState();
  }, [open, resetState]);

  const updateStep = useCallback(
    (step: string, status: StepStatus['status'], message?: string, data?: unknown) => {
      setStepStatuses((prev) => {
        const next = prev.map((s) => (s.step === step ? { ...s, status, message, data } : s));
        const layout = buildDagreLayout(next);
        setNodes(layout.nodes);
        setEdges(layout.edges);
        setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
        return next;
      });
    },
    [setNodes, setEdges, fitView],
  );

  const handleStart = useCallback(async () => {
    if (!selectedFile) return;

    setPhase('running');
    setError(null);
    abortRef.current = new AbortController();

    let parseData: WorkflowParseData | null = null;
    let excerptData: WorkflowExcerptData | null = null;
    let coverData: WorkflowCoverData | null = null;
    let tagsData: WorkflowTagsData | null = null;
    let postId = '';

    try {
      await startBlogWorkflow(
        {
          file: selectedFile,
          groupId: groupId || undefined,
          visibility,
        },
        {
          onEvent: (event: WorkflowSSEEvent) => {
            if (event.step && event.status && event.status !== 'done') {
              updateStep(
                event.step,
                event.status as StepStatus['status'],
                event.message,
                event.data,
              );

              if (event.status === 'success' && event.data) {
                switch (event.step) {
                  case 'parse':
                    parseData = event.data as WorkflowParseData;
                    break;
                  case 'excerpt':
                    excerptData = event.data as WorkflowExcerptData;
                    break;
                  case 'cover':
                    coverData = event.data as WorkflowCoverData;
                    break;
                  case 'tags':
                    tagsData = event.data as WorkflowTagsData;
                    break;
                  case 'create':
                    postId = (event.data as { postId: string }).postId;
                    break;
                }
              }
            }

            if (event.status === 'done' && postId) {
              setPreview({
                postId,
                title: parseData?.title || '',
                excerpt: excerptData?.excerpt || parseData?.excerpt || '',
                coverUrl: coverData?.coverUrl || parseData?.cover || '',
                coverSource: coverData?.coverSource || 'none',
                tagNames: tagsData?.tagNames || parseData?.tags || [],
                tagIds: tagsData?.tagIds || [],
              });
              setPhase('preview');
            }
          },
          onError: (msg: string) => {
            setError(msg);
            setPhase('upload');
          },
        },
        abortRef.current.signal,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '未知错误');
      setPhase('upload');
    }
  }, [selectedFile, groupId, visibility, updateStep]);

  const handlePublish = useCallback(async () => {
    if (!preview) return;
    setPublishing(true);
    try {
      await publishWorkflowDraft(preview.postId);
      toast.success('文章已发布');
      setPhase('done');
      onCreated?.({ postId: preview.postId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  }, [preview, onCreated]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 工作流导入
          </DialogTitle>
          <DialogDescription>
            上传 Markdown 文件，AI 自动生成摘要、封面和标签，一键创建博客文章
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Phase */}
          {phase === 'upload' && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-foreground">选择 Markdown 文件</label>
                <input
                  type="file"
                  accept=".md,.markdown"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent-foreground hover:file:bg-accent/80"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="mb-2 text-xs text-muted-foreground">文章分组</div>
                  <div className="border-border bg-accent/50 flex flex-wrap gap-2 rounded-xl border p-2">
                    <button
                      type="button"
                      onClick={() => setGroupId('')}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        !groupId
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-card text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      未分组
                    </button>
                    {groups.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setGroupId(item.id)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          groupId === item.id
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-card text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-2 text-xs text-muted-foreground">可见范围</div>
                  <div className="border-border bg-accent/50 flex flex-wrap gap-2 rounded-xl border p-2">
                    {[
                      { label: '私密', value: 'private' as const },
                      { label: '共享', value: 'shared' as const },
                      { label: '公开', value: 'public' as const },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.value}
                        onClick={() => setVisibility(item.value)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          visibility === item.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-card text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button
                onClick={handleStart}
                disabled={!selectedFile}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Play className="mr-2 h-4 w-4" />
                开始工作流
              </Button>
            </div>
          )}

          {/* Running Phase - ReactFlow Pipeline */}
          {phase === 'running' && (
            <div className="h-[350px] w-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                proOptions={{ hideAttribution: true }}
                minZoom={0.3}
                maxZoom={1.5}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          )}

          {/* Preview Phase */}
          {phase === 'preview' && preview && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-primary">
                工作流完成！文章已创建为草稿，请确认后发布。
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground">标题</label>
                  <p className="mt-1 text-sm text-foreground">{preview.title}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">摘要</label>
                  <p className="mt-1 text-sm text-muted-foreground">{preview.excerpt || '(无)'}</p>
                </div>

                {preview.coverUrl && (
                  <div>
                    <label className="text-sm font-medium text-foreground">封面</label>
                    <div className="mt-1">
                      <img
                        src={preview.coverUrl}
                        alt="封面"
                        className="h-24 w-auto rounded-lg object-cover"
                      />
                      <span className="mt-1 text-xs text-muted-foreground">
                        来源: {preview.coverSource}
                      </span>
                    </div>
                  </div>
                )}

                {preview.tagNames.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground">标签</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {preview.tagNames.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleClose} variant="outline" className="flex-1">
                  保存为草稿
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {publishing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  立即发布
                </Button>
              </div>
            </div>
          )}

          {/* Done Phase */}
          {phase === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-lg font-medium text-foreground">文章已发布！</p>
              <Button onClick={handleClose}>关闭</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
