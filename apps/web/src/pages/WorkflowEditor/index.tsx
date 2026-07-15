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
import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  Clipboard,
  Copy,
  Database,
  Download,
  Edit2,
  History,
  Maximize,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type AIKnowledgeBase,
  getAPIErrorMessage,
  listAIAppKnowledgeBases,
  listAIKnowledgeBases,
  replaceAIAppKnowledgeBases,
} from '@/api/aiWorkbench';
import {
  createWorkflow,
  getWorkflow,
  getWorkflowPlatform,
  getWorkflowRun,
  listWorkflowRuns,
  publishWorkflowVersion,
  restoreWorkflowVersion,
  runWorkflow,
  updateWorkflow,
  type WorkflowPlatformData,
  type WorkflowRun,
  type WorkflowRunDetail,
} from '@/api/workflow';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { KnowledgeBaseBindings } from '@/components/workbench/KnowledgeBaseBindings';
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
import { useWorkflowHistory } from '@/components/workflow/useWorkflowHistory';
import { validateWorkflowConfig } from '@/components/workflow/validateWorkflowConfig';
import { WorkflowNode } from '@/components/workflow/WorkflowNode';
import { WorkflowRuntimeProvider } from '@/components/workflow/WorkflowRuntimeContext';
import { getWorkflowTemplate, isTemplateSupported } from '../workflowTemplates';

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
  schemaVersion: 2,
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

const topicDraftTemplate = {
  schemaVersion: 2,
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
            topic: { type: 'string', required: true },
            audience: { type: 'string', required: false },
            style: { type: 'string', required: false },
            tagIds: { type: 'string[]', required: false },
            visibility: { type: 'string', required: true },
          },
        },
      },
    },
    {
      id: 'knowledge',
      type: 'knowledge.retrieve',
      position: { x: 330, y: 250 },
      data: {
        label: '检索知识库',
        nodeType: 'knowledge.retrieve',
        config: { query: '{{start.output.topic}}' },
      },
    },
    {
      id: 'writer',
      type: 'llm.text',
      position: { x: 610, y: 250 },
      data: {
        label: '生成正文',
        nodeType: 'llm.text',
        config: {
          modelProfile: 'ark-text-default',
          systemPrompt: '你是内容编辑。基于参考资料写出准确、易读的博客正文；资料不足时明确说明。',
          prompt:
            '主题：{{start.output.topic}}\n受众：{{start.output.audience}}\n风格：{{start.output.style}}\n\n参考资料：\n{{knowledge.output.context}}',
          temperature: 0.6,
          maxOutputTokens: 1200,
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
          title: '{{start.output.topic}}',
          content: '{{writer.output.text}}',
          tags: '{{start.output.tagIds}}',
          tagMode: 'manual_only',
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
          },
        },
      },
    },
  ],
  edges: [
    { id: 'start-knowledge', source: 'start', sourceHandle: 'output', target: 'knowledge' },
    { id: 'knowledge-writer', source: 'knowledge', sourceHandle: 'output', target: 'writer' },
    { id: 'writer-draft', source: 'writer', sourceHandle: 'output', target: 'create-draft' },
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
  const [platform, setPlatform] = useState<WorkflowPlatformData | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runDetail, setRunDetail] = useState<WorkflowRunDetail | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [showKnowledgeBases, setShowKnowledgeBases] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<AIKnowledgeBase[]>([]);
  const [boundKnowledgeBaseIDs, setBoundKnowledgeBaseIDs] = useState<string[]>([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [savingKnowledgeBases, setSavingKnowledgeBases] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(380);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const isFitViewComplete = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const runGenerationRef = useRef(0);
  const clipboardRef = useRef<Node[] | null>(null);
  const { undo, redo, canUndo, canRedo, clearHistory } = useWorkflowHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
  );

  const refreshWorkflowMeta = useCallback(async (id: string) => {
    const [nextPlatform, nextRuns] = await Promise.all([
      getWorkflowPlatform(id),
      listWorkflowRuns(id, { page: 1, pageSize: 10 }),
    ]);
    setPlatform(nextPlatform);
    setRuns(nextRuns.list);
  }, []);

  useEffect(() => {
    if (!workflowId) return;
    refreshWorkflowMeta(workflowId).catch(() => undefined);
  }, [workflowId, refreshWorkflowMeta]);

  const openKnowledgeBaseBindings = useCallback(async () => {
    const appID = platform?.app.id;
    if (!appID) return;
    setShowKnowledgeBases(true);
    try {
      setLoadingKnowledgeBases(true);
      const [allKnowledgeBases, bindings] = await Promise.all([
        listAIKnowledgeBases(),
        listAIAppKnowledgeBases(appID),
      ]);
      setKnowledgeBases(allKnowledgeBases.list);
      setBoundKnowledgeBaseIDs(bindings.list.map((knowledgeBase) => knowledgeBase.id));
    } catch (error) {
      setShowKnowledgeBases(false);
      toast.error(getAPIErrorMessage(error, '加载资料库失败'));
    } finally {
      setLoadingKnowledgeBases(false);
    }
  }, [platform?.app.id]);

  const updateKnowledgeBaseBindings = useCallback(
    async (knowledgeBaseIDs: string[]) => {
      const appID = platform?.app.id;
      if (!appID) return;
      try {
        setSavingKnowledgeBases(true);
        const result = await replaceAIAppKnowledgeBases(appID, knowledgeBaseIDs);
        setBoundKnowledgeBaseIDs(result.knowledgeBaseIds);
        if (workflowId) await refreshWorkflowMeta(workflowId);
        toast.success('资料库已更新，后续运行将使用新的草稿版本');
      } catch (error) {
        toast.error(getAPIErrorMessage(error, '更新资料库失败'));
      } finally {
        setSavingKnowledgeBases(false);
      }
    },
    [platform?.app.id, refreshWorkflowMeta, workflowId],
  );

  const applyBlankWorkflow = useCallback(() => {
    setNodes([
      {
        id: 'start',
        type: 'start',
        position: { x: 200, y: 250 },
        data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
      },
    ] as Node[]);
    setEdges([]);
  }, []);

  // 从 URL 获取工作流 ID 或模板
  useEffect(() => {
    const id = searchParams.get('id');
    const template = searchParams.get('template');
    const templateConfig = getWorkflowTemplate(template || '');
    const isSupportedTemplate = templateConfig ? isTemplateSupported(templateConfig.id) : false;

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
            clearHistory();
          } catch {
            // invalid graph
          }
        })
        .catch(() => {
          toast.error('加载工作流失败');
        });
    } else if (templateConfig?.id === 'blog-import' || templateConfig?.id === 'content-generate') {
      const workflowTemplate =
        templateConfig.id === 'blog-import' ? blogImportTemplate : topicDraftTemplate;
      setNodes(workflowTemplate.nodes as Node[]);
      setEdges(workflowTemplate.edges as Edge[]);
      clearHistory();
    } else if (template) {
      if (!isSupportedTemplate) {
        toast.info(`模板「${template}」尚未对外开放`);
      }
      applyBlankWorkflow();
      clearHistory();
    } else {
      applyBlankWorkflow();
      clearHistory();
    }
  }, [searchParams, clearHistory, applyBlankWorkflow]);

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

  const handleAddNode = useCallback((nodeType: string) => {
    if (!NODE_CONFIGS[nodeType]?.available) return;
    if (nodeType === 'start' || nodeType === 'end') return;

    const config = NODE_CONFIGS[nodeType];
    const wrapper = reactFlowWrapper.current;
    const center = wrapper
      ? { x: wrapper.clientWidth / 2, y: wrapper.clientHeight / 2 }
      : { x: 400, y: 300 };
    const position = reactFlowInstance.current
      ? reactFlowInstance.current.screenToFlowPosition({
          x: (wrapper?.getBoundingClientRect().left ?? 0) + center.x,
          y: (wrapper?.getBoundingClientRect().top ?? 0) + center.y,
        })
      : { x: 300, y: 250 };

    position.x -= 110;
    position.y -= 20;

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position,
      data: {
        label: config?.label || nodeType,
        nodeType,
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

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === node.id
          ? {
              ...n,
              data: {
                ...n.data,
                collapsed: !(n.data as { collapsed?: boolean }).collapsed,
              },
            }
          : n,
      ),
    );
  }, []);

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const onEdgeClick = useCallback(() => {
    setSelectedNode(null);
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

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current || clipboardRef.current.length === 0) return;
    const stamp = Date.now();
    const pasted = clipboardRef.current.map((n, i) => ({
      ...n,
      id: `${n.id}-paste-${stamp}-${i}`,
      position: { x: n.position.x + 30, y: n.position.y + 30 },
      selected: true,
    }));
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...pasted]);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const isEditingText =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (
        isMod &&
        (event.key === 'z' || event.key === 'Z' || event.key === 'y' || event.key === 'Y')
      ) {
        if (isEditingText) return;
        event.preventDefault();
        const isRedo = event.key === 'y' || event.key === 'Y' || event.shiftKey;
        if (isRedo) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isMod && (event.key === 'c' || event.key === 'C')) {
        if (isEditingText) return;
        const selected = nodes.filter((n) => n.selected);
        if (selected.length > 0) {
          clipboardRef.current = selected;
          event.preventDefault();
        } else if (selectedNode) {
          const node = nodes.find((n) => n.id === selectedNode.id);
          if (node) {
            clipboardRef.current = [node];
            event.preventDefault();
          }
        }
        return;
      }

      if (isMod && (event.key === 'v' || event.key === 'V')) {
        if (isEditingText) return;
        if (clipboardRef.current && clipboardRef.current.length > 0) {
          event.preventDefault();
          handlePaste();
        }
        return;
      }

      if (isMod && (event.key === 'a' || event.key === 'A')) {
        if (isEditingText) return;
        event.preventDefault();
        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
        return;
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (isEditingText) return;

      if (selectedNode) {
        event.preventDefault();
        handleDeleteNode(selectedNode.id);
        return;
      }

      const hasSelectedEdge = edges.some((e) => e.selected);
      if (hasSelectedEdge) {
        event.preventDefault();
        setEdges((prev) => prev.filter((e) => !e.selected));
      }
    },
    [selectedNode, handleDeleteNode, edges, nodes, undo, redo, handlePaste],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

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
      schemaVersion: 2,
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
        await updateWorkflow(workflowId, { name: workflowName, graph });
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
    const templateConfig = getWorkflowTemplate(template || '');

    if (
      (templateConfig?.id === 'blog-import' || templateConfig?.id === 'content-generate') &&
      templateConfig.enabled
    ) {
      const workflowTemplate =
        templateConfig.id === 'blog-import' ? blogImportTemplate : topicDraftTemplate;
      setNodes(workflowTemplate.nodes as Node[]);
      setEdges(workflowTemplate.edges as Edge[]);
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
              <Button
                variant="outline"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                title="撤销 (Ctrl/Cmd+Z)"
                aria-label="撤销"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                title="重做 (Ctrl/Cmd+Shift+Z)"
                aria-label="重做"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
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
              {workflowId && (
                <Button variant="outline" size="sm" onClick={() => setShowVersions(true)}>
                  <History className="mr-2 h-4 w-4" />
                  版本
                </Button>
              )}
              {workflowId && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!platform}
                  onClick={() => void openKnowledgeBaseBindings()}
                >
                  <Database className="mr-2 h-4 w-4" />
                  资料库
                </Button>
              )}
              {workflowId && (
                <Button variant="outline" size="sm" onClick={() => setShowRuns(true)}>
                  运行记录
                </Button>
              )}
              <Button size="sm" onClick={handleRun} disabled={isRunning}>
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? '运行中...' : '运行'}
              </Button>
            </div>
          </div>

          <Dialog open={showKnowledgeBases} onOpenChange={setShowKnowledgeBases}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>绑定资料库</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                仅检索已绑定的私有资料；修改会创建新的草稿版本。
              </p>
              {loadingKnowledgeBases ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : (
                <KnowledgeBaseBindings
                  knowledgeBases={knowledgeBases}
                  boundKnowledgeBaseIDs={boundKnowledgeBaseIDs}
                  disabled={savingKnowledgeBases}
                  onChange={(knowledgeBaseIDs) => {
                    void updateKnowledgeBaseBindings(knowledgeBaseIDs);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={showVersions} onOpenChange={setShowVersions}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>版本历史</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {platform?.versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>v{version.number}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={version.id === platform.app.draftVersionId}
                        onClick={async () => {
                          if (!workflowId) return;
                          await restoreWorkflowVersion(workflowId, version.id);
                          toast.success(`已恢复 v${version.number}`);
                          navigate(`/workbench/edit?id=${workflowId}&restored=${Date.now()}`, {
                            replace: true,
                          });
                        }}
                      >
                        恢复
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                disabled={
                  !workflowId || platform?.app.publishedVersionId === platform?.app.draftVersionId
                }
                onClick={async () => {
                  if (!workflowId) return;
                  await publishWorkflowVersion(workflowId);
                  await refreshWorkflowMeta(workflowId);
                  toast.success('已发布当前版本');
                }}
              >
                发布当前版本
              </Button>
            </DialogContent>
          </Dialog>

          <Dialog open={showRuns} onOpenChange={setShowRuns}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>最近运行</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无运行记录</p>
                ) : (
                  runs.map((run) => (
                    <Button
                      key={run.id}
                      variant="outline"
                      className="h-auto w-full justify-between p-3"
                      onClick={async () => {
                        if (!workflowId) return;
                        setRunDetail(await getWorkflowRun(workflowId, run.id));
                      }}
                    >
                      <span>{run.status === 'success' ? '成功' : '失败'}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString('zh-CN')}
                      </span>
                    </Button>
                  ))
                )}
              </div>
              {runDetail && (
                <div className="rounded-lg border p-3 text-xs">
                  <p className="mb-2 font-medium">节点详情</p>
                  {runDetail.nodes.map((node) => (
                    <p key={node.id}>
                      {node.nodeId} · {node.status} · {node.durationMs ?? 0} ms
                    </p>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-56 flex-shrink-0">
              <NodePanel onDragStart={onDragStart} onAddNode={handleAddNode} />
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
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                onPaneContextMenu={onPaneContextMenu}
                nodeTypes={workflowNodeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                deleteKeyCode={['Delete', 'Backspace']}
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
        {contextMenu &&
          (() => {
            const { x, y, nodeId } = contextMenu;
            return (
              <div
                className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md"
                style={{ left: x, top: y }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {nodeId ? (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                      onClick={() => {
                        handleCopyNode(nodeId);
                        setContextMenu(null);
                      }}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      复制
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                      onClick={() => {
                        handleDeleteNode(nodeId);
                        setContextMenu(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      删除
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                      onClick={() => {
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === nodeId
                              ? {
                                  ...n,
                                  data: {
                                    ...n.data,
                                    collapsed: !(n.data as { collapsed?: boolean }).collapsed,
                                  },
                                }
                              : n,
                          ),
                        );
                        setContextMenu(null);
                      }}
                    >
                      <ChevronDown className="mr-2 h-3.5 w-3.5" />
                      折叠/展开
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
                      disabled={!clipboardRef.current || clipboardRef.current.length === 0}
                      onClick={() => {
                        handlePaste();
                        setContextMenu(null);
                      }}
                    >
                      <Clipboard className="mr-2 h-3.5 w-3.5" />
                      粘贴
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                      onClick={() => {
                        setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
                        setContextMenu(null);
                      }}
                    >
                      <CheckSquare className="mr-2 h-3.5 w-3.5" />
                      全选
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                      onClick={() => {
                        reactFlowInstance.current?.fitView({ padding: 0.2 });
                        setContextMenu(null);
                      }}
                    >
                      <Maximize className="mr-2 h-3.5 w-3.5" />
                      重置视图
                    </button>
                  </>
                )}
              </div>
            );
          })()}
      </ReactFlowProvider>
    </WorkflowRuntimeProvider>
  );
}
