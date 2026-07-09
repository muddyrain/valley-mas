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
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlow,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { Download, Play, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NodePanel } from './NodePanel';
import { NODE_CONFIGS } from './nodeConfig';
import { PropertyPanel } from './PropertyPanel';
import { WorkflowNode } from './WorkflowNode';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

export function WorkflowEditor() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    type: string;
    data: { label: string; nodeType: string; config?: Record<string, unknown> };
  } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

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

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.current.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

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

  const handleSave = useCallback(() => {
    const workflow = { nodes, edges };
    localStorage.setItem('valley-workflow', JSON.stringify(workflow));
    toast.success('工作流已保存');
  }, [nodes, edges]);

  const handleRun = useCallback(() => {
    if (nodes.length === 0) {
      toast.warning('请先添加节点');
      return;
    }
    toast.info('正在运行工作流...');
  }, [nodes]);

  const handleExport = useCallback(() => {
    const workflow = { nodes, edges };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('工作流已导出');
  }, [nodes, edges]);

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
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    toast.info('工作流已重置');
  }, []);

  return (
    <ReactFlowProvider>
      <div className="flex h-full">
        <div className="w-64 flex-shrink-0">
          <NodePanel onDragStart={onDragStart} />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="mr-2">
                AI 工作流编辑器
              </Badge>
              <span className="text-sm text-muted-foreground">
                {nodes.length} 个节点 · {edges.length} 条连接
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
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button size="sm" onClick={handleRun}>
                <Play className="h-4 w-4 mr-2" />
                运行
              </Button>
            </div>
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
              fitView
              minZoom={0.2}
              maxZoom={2}
              onInit={(instance) => {
                reactFlowInstance.current = instance;
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </div>

        <div className="w-72 flex-shrink-0">
          <PropertyPanel
            selectedNode={selectedNode}
            onClose={() => setSelectedNode(null)}
            onUpdateNode={onUpdateNode}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
