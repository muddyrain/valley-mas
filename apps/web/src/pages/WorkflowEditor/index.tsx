import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Download, Edit2, Play, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createWorkflow, getWorkflow, runWorkflow, updateWorkflow } from '@/api/workflow';
import { Button } from '@/components/ui/button';
import { NodePanel } from '@/components/workflow/NodePanel';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { PropertyPanel } from '@/components/workflow/PropertyPanel';
import type { WorkflowRunInput } from '@/components/workflow/RunPanel';
import { RunPanel } from '@/components/workflow/RunPanel';
import {
  createWorkflowRunSession,
  workflowRunSessionReducer,
} from '@/components/workflow/runSession';
import { normalizePhaseOneStartInputs } from '@/components/workflow/types';
import { validateWorkflowConfig } from '@/components/workflow/validateWorkflowConfig';
import { WorkflowNode } from '@/components/workflow/WorkflowNode';
import { WorkflowRuntimeProvider } from '@/components/workflow/WorkflowRuntimeContext';

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { stroke: '#3b82f6', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: '#3b82f6',
  },
};

const blogImportTemplate = {
  schemaVersion: 1,
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 50, y: 250 },
      data: {
        label: '开始',
        nodeType: 'start',
        config: {
          inputs: {
            markdownFile: { type: 'file', required: true },
            tagIds: { type: 'string[]', required: false },
            groupId: { type: 'string', required: false },
            visibility: { type: 'string', required: true },
          },
        },
      },
    },
    {
      id: 'parse-markdown',
      type: 'blog.parseMarkdown',
      position: { x: 330, y: 250 },
      data: {
        label: '解析 Markdown',
        nodeType: 'blog.parseMarkdown',
        config: { fileInput: '{{start.output.markdownFile}}' },
      },
    },
    {
      id: 'llm-summary',
      type: 'llm.text',
      position: { x: 610, y: 250 },
      data: {
        label: '生成摘要',
        nodeType: 'llm.text',
        config: {
          modelProfile: 'ark-text-default',
          systemPrompt: '你是内容编辑助手。请基于 Markdown 正文生成一句简洁、准确的博客摘要。',
          prompt:
            '标题：{{parse-markdown.output.title}}\n\n正文：{{parse-markdown.output.content}}',
          temperature: 0.4,
          maxOutputTokens: 512,
        },
      },
    },
    {
      id: 'create-draft',
      type: 'blog.createDraft',
      position: { x: 900, y: 250 },
      data: {
        label: '创建博客草稿',
        nodeType: 'blog.createDraft',
        config: {
          title: '{{parse-markdown.output.title}}',
          content: '{{parse-markdown.output.content}}',
          excerpt: '{{llm-summary.output.text}}',
          cover: '{{parse-markdown.output.cover}}',
          tags: '{{start.output.tagIds}}',
          suggestedTags: '{{parse-markdown.output.tagNames}}',
          tagMode: 'merge',
          visibility: '{{start.output.visibility}}',
        },
      },
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 1190, y: 250 },
      data: {
        label: '结束',
        nodeType: 'end',
        config: {
          outputs: {
            postId: '{{create-draft.output.postId}}',
            title: '{{create-draft.output.title}}',
            editPath: '{{create-draft.output.editPath}}',
            tagIds: '{{create-draft.output.tagIds}}',
          },
        },
      },
    },
  ],
  edges: [
    { id: 'start-parse', source: 'start', sourceHandle: 'output', target: 'parse-markdown' },
    {
      id: 'parse-llm',
      source: 'parse-markdown',
      sourceHandle: 'output',
      target: 'llm-summary',
    },
    {
      id: 'llm-draft',
      source: 'llm-summary',
      sourceHandle: 'output',
      target: 'create-draft',
    },
    { id: 'draft-end', source: 'create-draft', sourceHandle: 'output', target: 'end' },
  ],
};

function normalizeWorkflowEdges(edges: Edge[]): Edge[] {
  return edges.map((edge, index) => {
    const sourceHandle = edge.sourceHandle || 'output';
    const targetHandleKey = edge.targetHandle || 'default-target';
    return {
      ...edge,
      id: edge.id || `${edge.source}-${sourceHandle}-${edge.target}-${targetHandleKey}-${index}`,
      sourceHandle,
    };
  });
}

const workflowNodeTypes = Object.fromEntries(
  Object.keys(NODE_CONFIGS).map((type) => [type, WorkflowNode]),
);

export default function WorkflowEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    type: string;
    data: { label: string; nodeType: string; config?: Record<string, unknown> };
  } | null>(null);
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runSession, dispatchRunSession] = useReducer(
    workflowRunSessionReducer,
    undefined,
    createWorkflowRunSession,
  );
  const [runError, setRunError] = useState<string | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const isDraggingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const isFitViewComplete = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runGenerationRef = useRef(0);

  // 从 URL 获取工作流 ID 或模板
  useEffect(() => {
    const id = searchParams.get('id');
    const template = searchParams.get('template');

    if (id) {
      getWorkflow(id)
        .then((data) => {
          setWorkflowId(id);
          setWorkflowName(data.name);
          try {
            const graph = JSON.parse(data.graph);
            if (graph.nodes) {
              setNodes(
                graph.nodes.map((node: Node) => ({
                  ...node,
                  type:
                    node.type === 'workflowNode'
                      ? (node.data as { nodeType?: string }).nodeType || 'start'
                      : node.type,
                  data: node.data || {
                    label: node.id,
                    nodeType: node.type,
                    config: (node as Node & { config?: Record<string, unknown> }).config || {},
                  },
                })),
              );
            }
            if (graph.edges) setEdges(normalizeWorkflowEdges(graph.edges as Edge[]));
          } catch {
            // invalid graph
          }
        })
        .catch(() => {
          toast.error('加载工作流失败');
        });
    } else if (template === 'blog-import') {
      setNodes(blogImportTemplate.nodes as Node[]);
      setEdges(blogImportTemplate.edges as Edge[]);
    } else {
      setNodes([
        {
          id: 'start',
          type: 'start',
          position: { x: 200, y: 250 },
          data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
        },
      ] as Node[]);
      setEdges([]);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      isFitViewComplete.current = true;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (
      !type ||
      !reactFlowInstance.current ||
      !reactFlowWrapper.current ||
      !NODE_CONFIGS[type]?.available
    )
      return;
    if (type === 'start' || type === 'end') return;

    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    position.x -= 110;
    position.y -= 20;

    const config = NODE_CONFIGS[type];
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: {
        label: config?.label || type,
        nodeType: type,
      },
    };

    setNodes((prev) => [...prev, newNode]);
    toast.success(`已添加 ${config?.label} 节点`);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)),
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)),
    [],
  );

  const onConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;
    setEdges((prev) =>
      addEdge(
        { ...connection, source, target, sourceHandle: connection.sourceHandle || 'output' },
        prev,
      ),
    );
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode({
      id: node.id,
      type: node.type || '',
      data: node.data as { label: string; nodeType: string; config?: Record<string, unknown> },
    });
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const nodeType = (node.data as { nodeType: string }).nodeType;
      if (nodeType === 'start' || nodeType === 'end') {
        toast.warning('开始/结束节点不可删除');
        return;
      }
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [nodes, selectedNode],
  );

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const newNode: Node = {
        ...node,
        id: `${nodeId}-copy-${Date.now()}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
      };
      setNodes((prev) => [...prev, newNode]);
    },
    [nodes],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!selectedNode) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDeleteNode(selectedNode.id);
      }
    },
    [selectedNode, handleDeleteNode],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = rightPanelWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = startX - moveEvent.clientX;
        const newWidth = Math.max(320, Math.min(640, startWidth + deltaX));
        setRightPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [rightPanelWidth],
  );

  const onUpdateNode = useCallback(
    (nodeId: string, updates: Partial<{ label: string; config: Record<string, unknown> }>) => {
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates,
                },
              }
            : node,
        ),
      );

      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...updates } } : null));
      }
    },
    [selectedNode],
  );

  const graphToJSON = useCallback(() => {
    return JSON.stringify({
      schemaVersion: 1,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: (node.data as { nodeType: string }).nodeType,
        config:
          (node.data as { nodeType: string }).nodeType === 'start'
            ? {
                inputs: normalizePhaseOneStartInputs(
                  (node.data as { config?: { inputs?: unknown } }).config?.inputs,
                ),
              }
            : (node.data as { config?: Record<string, unknown> }).config || {},
        position: node.position,
        data: node.data,
      })),
      edges: normalizeWorkflowEdges(edges).map(
        ({ id, source, sourceHandle, target, targetHandle }) => ({
          id,
          source,
          sourceHandle,
          target,
          targetHandle,
        }),
      ),
    });
  }, [nodes, edges]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const graph = graphToJSON();
      if (workflowId) {
        await updateWorkflow(workflowId, { graph });
        toast.success('工作流已保存');
      } else {
        const result = await createWorkflow({ name: workflowName, graph, status: 'draft' });
        setWorkflowId(result.id);
        navigate(`/workbench/edit?id=${result.id}`, { replace: true });
        toast.success('工作流已创建');
      }
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, graphToJSON, navigate]);

  const handleRunConfirm = useCallback(
    async ({ inputs, files }: WorkflowRunInput) => {
      setIsRunning(true);
      setRunError(null);
      const generation = runGenerationRef.current + 1;
      runGenerationRef.current = generation;
      dispatchRunSession({ type: 'begin', generation });

      abortControllerRef.current = new AbortController();

      try {
        await runWorkflow(
          workflowId ?? '',
          { inputs, files },
          {
            onEvent: (event) => {
              dispatchRunSession({ type: 'event', generation, event });
              if (event.status === 'done') {
                setIsRunning(false);
                toast.success('工作流执行完成');
              }
            },
            onError: (msg) => {
              setRunError(msg);
              dispatchRunSession({ type: 'error', generation, error: msg });
              toast.error(msg);
              setIsRunning(false);
            },
          },
          abortControllerRef.current.signal,
        );
      } catch {
        setRunError('运行请求失败');
        dispatchRunSession({ type: 'error', generation, error: '运行请求失败' });
        setIsRunning(false);
      }
    },
    [workflowId],
  );

  const handleRun = useCallback(() => {
    if (nodes.length === 0) {
      toast.warning('请先添加节点');
      return;
    }

    if (!workflowId) {
      toast.warning('请先保存工作流');
      return;
    }

    const errors = validateWorkflowConfig(nodes);
    if (errors.length > 0) {
      const firstError = errors[0];
      toast.warning(
        `以下节点需要配置：${errors.map((e) => e.nodeLabel).join('、')}。点击画布上的橙色高亮节点进行配置。`,
      );
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === firstError.nodeId })));
      return;
    }

    setShowRunPanel(true);
  }, [nodes, workflowId]);

  const handleCancelRun = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleExport = useCallback(() => {
    const workflow = { nodes, edges };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('工作流已导出');
  }, [nodes, edges, workflowName]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setNodes(data.nodes || []);
          setEdges(normalizeWorkflowEdges(data.edges || []));
          toast.success('工作流已导入');
        } catch {
          toast.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleClear = useCallback(() => {
    if (nodes.length === 0) return;
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    toast.info('工作流已清空');
  }, [nodes]);

  const handleReset = useCallback(() => {
    const template = searchParams.get('template');
    if (template === 'blog-import') {
      setNodes(blogImportTemplate.nodes as Node[]);
      setEdges(blogImportTemplate.edges as Edge[]);
    } else {
      setNodes([
        {
          id: 'start',
          type: 'start',
          position: { x: 200, y: 250 },
          data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
        },
      ] as Node[]);
      setEdges([]);
    }
    setSelectedNode(null);
    toast.info('工作流已重置');
  }, [searchParams]);

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const source = runSession.nodes[edge.source]?.status;
        const target = runSession.nodes[edge.target]?.status;
        if (source === 'error' || target === 'error') {
          return {
            ...edge,
            animated: false,
            style: { ...edge.style, stroke: 'hsl(var(--destructive))' },
          };
        }
        if (source === 'running' || target === 'running') {
          return {
            ...edge,
            animated: true,
            style: { ...edge.style, stroke: 'hsl(var(--primary))' },
          };
        }
        if (source === 'success' && target === 'success') {
          return { ...edge, animated: false, style: { ...edge.style, stroke: '#16a34a' } };
        }
        return edge;
      }),
    [edges, runSession.nodes],
  );

  const runtimeValue = useMemo(
    () => ({
      session: runSession,
      toggleNodeResult: (nodeId: string) => dispatchRunSession({ type: 'toggleExpanded', nodeId }),
      copyNode: handleCopyNode,
      deleteNode: handleDeleteNode,
    }),
    [handleCopyNode, handleDeleteNode, runSession],
  );

  return (
    <WorkflowRuntimeProvider value={runtimeValue}>
      <ReactFlowProvider>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/workbench')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {isEditingName ? (
                  <input
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    className="text-sm font-medium bg-accent border border-border rounded px-2 py-1 outline-none text-foreground w-40"
                  />
                ) : (
                  <span className="text-sm font-medium text-foreground">{workflowName}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-60 hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingName(!isEditingName)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {nodes.length} 节点 · {edges.length} 连接
                {workflowId && <span className="ml-2">· 已保存</span>}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                导入
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                重置
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-2" />
                清空
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
              <Button size="sm" onClick={handleRun} disabled={isRunning}>
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? '运行中...' : '运行'}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-56 flex-shrink-0">
              <NodePanel onDragStart={onDragStart} />
            </div>

            <div
              ref={reactFlowWrapper}
              className="flex-1 bg-background"
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <ReactFlow
                nodes={nodes}
                edges={renderedEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={workflowNodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                fitView={nodes.length > 0 && !isFitViewComplete.current}
                minZoom={0.2}
                maxZoom={2}
                connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
                onInit={(instance) => {
                  reactFlowInstance.current = instance;
                }}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>

            <div className="flex">
              <div
                className="w-1 bg-gray-200 cursor-col-resize hover:bg-gray-300 transition-colors flex items-center justify-center"
                onMouseDown={handleMouseDown}
              >
                <div className="w-0.5 h-8 bg-gray-400 rounded" />
              </div>
              <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0">
                {showRunPanel ? (
                  <RunPanel
                    open={showRunPanel}
                    onOpenChange={setShowRunPanel}
                    nodes={nodes}
                    onRun={handleRunConfirm}
                    onCancel={handleCancelRun}
                    isRunning={isRunning}
                    session={runSession}
                    runError={runError}
                  />
                ) : (
                  <PropertyPanel
                    selectedNode={selectedNode}
                    onClose={() => setSelectedNode(null)}
                    onUpdateNode={onUpdateNode}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </ReactFlowProvider>
    </WorkflowRuntimeProvider>
  );
}
