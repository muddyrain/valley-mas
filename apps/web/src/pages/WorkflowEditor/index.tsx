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
  type NodeProps,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Download, Play, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createWorkflow, getWorkflow, runWorkflow, updateWorkflow } from '@/api/workflow';
import { Button } from '@/components/ui/button';
import { NodePanel } from '@/components/workflow/NodePanel';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { PropertyPanel } from '@/components/workflow/PropertyPanel';
import type { NodeResult } from '@/components/workflow/RunPanel';
import { RunPanel } from '@/components/workflow/RunPanel';
import { validateWorkflowConfig } from '@/components/workflow/validateWorkflowConfig';
import { WorkflowNode } from '@/components/workflow/WorkflowNode';

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
  nodes: [
    {
      id: 'start-1',
      type: 'workflowNode',
      position: { x: 50, y: 250 },
      data: {
        label: '开始',
        nodeType: 'start',
        config: {
          variables: [
            { name: '博客文件', type: 'file', required: true },
            {
              name: '博客分组',
              type: 'select',
              required: false,
              dataSource: {
                api: '/public/blog/groups',
                labelField: 'name',
                valueField: 'id',
              },
              allowCustom: true,
            },
          ],
        },
      },
    },
    {
      id: 'llm-1',
      type: 'workflowNode',
      position: { x: 350, y: 250 },
      data: {
        label: 'AI 解析内容',
        nodeType: 'llm',
        config: {
          model: 'gpt-4o-mini',
          systemPrompt:
            '你是一个专业的内容分析助手。请解析输入的 Markdown 文件内容，提取标题、正文、标签和关键信息。',
          temperature: 0.7,
          maxTokens: 2000,
        },
      },
    },
    {
      id: 'llm-2',
      type: 'workflowNode',
      position: { x: 650, y: 250 },
      data: {
        label: '生成摘要',
        nodeType: 'llm',
        config: {
          model: 'gpt-4o-mini',
          systemPrompt:
            '请根据输入内容生成简洁的摘要，包含核心要点和关键信息。如果有指定分类，请确保摘要与分类相关。',
          temperature: 0.5,
          maxTokens: 500,
        },
      },
    },
    {
      id: 'end-1',
      type: 'workflowNode',
      position: { x: 950, y: 250 },
      data: { label: '结束', nodeType: 'end' },
    },
  ],
  edges: [
    { id: 'e1', source: 'start-1', target: 'llm-1' },
    { id: 'e2', source: 'llm-1', target: 'llm-2' },
    { id: 'e3', source: 'llm-2', target: 'end-1' },
  ],
};

const DEFAULT_START_NODE: Node = {
  id: 'start-1',
  type: 'workflowNode',
  position: { x: 50, y: 250 },
  data: { label: '开始', nodeType: 'start' },
};

const DEFAULT_END_NODE: Node = {
  id: 'end-1',
  type: 'workflowNode',
  position: { x: 800, y: 250 },
  data: { label: '结束', nodeType: 'end' },
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [nodeResults, setNodeResults] = useState<Record<string, NodeResult>>({});
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const isDraggingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const isFitViewComplete = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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
            if (graph.nodes) setNodes(graph.nodes);
            if (graph.edges) setEdges(graph.edges);
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
      setNodes([DEFAULT_START_NODE, DEFAULT_END_NODE]);
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
    if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;
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
      type: 'workflowNode',
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
    setEdges((prev) => addEdge({ ...connection, source, target }, prev));
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

  const nodeTypes = {
    workflowNode: (props: NodeProps) => (
      <WorkflowNode {...props} onCopy={handleCopyNode} onDelete={handleDeleteNode} />
    ),
  };

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
    return JSON.stringify({ nodes, edges });
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
    async (inputs: Record<string, Record<string, unknown>>) => {
      setIsRunning(true);
      setNodes((prev) => prev.map((n) => ({ ...n, data: { ...n.data, runningState: 'idle' } })));
      setNodeResults({});

      abortControllerRef.current = new AbortController();

      try {
        await runWorkflow(
          workflowId ?? '',
          { inputs },
          {
            onEvent: (event) => {
              if (event.step && event.status) {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === event.step
                      ? { ...n, data: { ...n.data, runningState: event.status } }
                      : n,
                  ),
                );
                setNodeResults((prev) => ({
                  ...prev,
                  [event.step]: {
                    ...(prev[event.step] || {}),
                    status: event.status as NodeResult['status'],
                  },
                }));
              }
              if (event.status === 'done') {
                setIsRunning(false);
                toast.success('工作流执行完成');
              }
            },
            onError: (msg) => {
              toast.error(msg);
              setIsRunning(false);
            },
          },
          abortControllerRef.current.signal,
        );
      } catch {
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
          setEdges(data.edges || []);
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
      setNodes([]);
      setEdges([]);
    }
    setSelectedNode(null);
    toast.info('工作流已重置');
  }, [searchParams]);

  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/workbench')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-sm font-medium bg-transparent border-none outline-none text-foreground w-40"
            />
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
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
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
                  isRunning={isRunning}
                  nodeResults={nodeResults}
                />
              ) : (
                <PropertyPanel
                  selectedNode={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onUpdateNode={onUpdateNode}
                  nodeResult={selectedNode ? nodeResults[selectedNode.id] : undefined}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
