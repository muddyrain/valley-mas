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
  Clipboard,
  Copy,
  Database,
  Download,
  Edit2,
  History,
  Maximize,
  MoreHorizontal,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
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
  explainWorkflowRun,
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
  type WorkflowRunExplanation,
} from '@/api/workflow';
import { AIGenerationProgress } from '@/components/ai-workbench/AIGenerationProgress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { KnowledgeBaseBindings } from '@/components/workbench/KnowledgeBaseBindings';
import { NodePanel } from '@/components/workflow/NodePanel';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { PropertyPanel, type PropertyPanelTab } from '@/components/workflow/PropertyPanel';
import type { WorkflowRunInput } from '@/components/workflow/RunPanel';
import { RunPanel } from '@/components/workflow/RunPanel';
import {
  createWorkflowRunSession,
  workflowRunSessionReducer,
} from '@/components/workflow/runSession';
import { useWorkflowHistory } from '@/components/workflow/useWorkflowHistory';
import { validateWorkflowConfig } from '@/components/workflow/validateWorkflowConfig';
import { WorkflowNode } from '@/components/workflow/WorkflowNode';
import { WorkflowRuntimeProvider } from '@/components/workflow/WorkflowRuntimeContext';
import {
  normalizeWorkflowEdges,
  serializeWorkflowGraph,
} from '@/components/workflow/workflowGraph';

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

const workflowNodeTypes = Object.fromEntries(
  Object.keys(NODE_CONFIGS).map((type) => [type, WorkflowNode]),
);

type SaveStatus = 'idle' | 'creating' | 'saving' | 'saved' | 'error';

interface WorkflowSnapshot {
  name: string;
  graph: string;
  revision: number;
}

interface WorkflowEditorState {
  name: string;
  nodes: Node[];
  edges: Edge[];
}

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
  const [activePropertyTab, setActivePropertyTab] = useState<PropertyPanelTab>('config');
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveRevision, setSaveRevision] = useState(0);
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
  const [runExplanation, setRunExplanation] = useState<WorkflowRunExplanation | null>(null);
  const [explainingRun, setExplainingRun] = useState(false);
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
  const handledFailedNodeRef = useRef<string | null>(null);
  const clipboardRef = useRef<Node[] | null>(null);
  const workflowIdRef = useRef<string | null>(null);
  const workflowStateRef = useRef<WorkflowEditorState>({
    name: '未命名工作流',
    nodes: [],
    edges: [],
  });
  const workflowSnapshotRef = useRef<WorkflowSnapshot>({
    name: '未命名工作流',
    graph: serializeWorkflowGraph([], []),
    revision: 0,
  });
  const saveRevisionRef = useRef(0);
  const persistedRevisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const createPromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingCreatedWorkflowIdRef = useRef<string | null>(null);
  const historyMutationRef = useRef(false);
  const editorSessionRef = useRef(0);
  const activeRouteKeyRef = useRef<string | null>(null);
  const isEditorMountedRef = useRef(false);
  const { undo, redo, canUndo, canRedo, clearHistory } = useWorkflowHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
  );

  useEffect(() => {
    isEditorMountedRef.current = true;
    return () => {
      isEditorMountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      runGenerationRef.current += 1;
    };
  }, []);

  const isActiveWorkflowSession = useCallback(
    (session: number, id: string) =>
      isEditorMountedRef.current &&
      editorSessionRef.current === session &&
      workflowIdRef.current === id,
    [],
  );

  const refreshWorkflowMeta = useCallback(
    async (id: string) => {
      const session = editorSessionRef.current;
      if (!isActiveWorkflowSession(session, id)) return;
      const [nextPlatform, nextRuns] = await Promise.all([
        getWorkflowPlatform(id),
        listWorkflowRuns(id, { page: 1, pageSize: 10 }),
      ]);
      if (!isActiveWorkflowSession(session, id)) return;
      setPlatform(nextPlatform);
      setRuns(nextRuns.list);
    },
    [isActiveWorkflowSession],
  );

  useEffect(() => {
    if (!workflowId) return;
    refreshWorkflowMeta(workflowId).catch(() => undefined);
  }, [workflowId, refreshWorkflowMeta]);

  const openKnowledgeBaseBindings = useCallback(async () => {
    const appID = platform?.app.id;
    const id = workflowIdRef.current;
    const session = editorSessionRef.current;
    if (!appID || !id || !isActiveWorkflowSession(session, id)) return;
    setShowKnowledgeBases(true);
    try {
      setLoadingKnowledgeBases(true);
      const [allKnowledgeBases, bindings] = await Promise.all([
        listAIKnowledgeBases(),
        listAIAppKnowledgeBases(appID),
      ]);
      if (!isActiveWorkflowSession(session, id)) return;
      setKnowledgeBases(allKnowledgeBases.list);
      setBoundKnowledgeBaseIDs(bindings.list.map((knowledgeBase) => knowledgeBase.id));
    } catch (error) {
      if (!isActiveWorkflowSession(session, id)) return;
      setShowKnowledgeBases(false);
      toast.error(getAPIErrorMessage(error, '加载资料库失败'));
    } finally {
      if (isActiveWorkflowSession(session, id)) setLoadingKnowledgeBases(false);
    }
  }, [isActiveWorkflowSession, platform?.app.id]);

  const updateKnowledgeBaseBindings = useCallback(
    async (knowledgeBaseIDs: string[]) => {
      const appID = platform?.app.id;
      const id = workflowIdRef.current;
      const session = editorSessionRef.current;
      if (!appID || !id || !isActiveWorkflowSession(session, id)) return;
      try {
        setSavingKnowledgeBases(true);
        const result = await replaceAIAppKnowledgeBases(appID, knowledgeBaseIDs);
        if (!isActiveWorkflowSession(session, id)) return;
        setBoundKnowledgeBaseIDs(result.knowledgeBaseIds);
        await refreshWorkflowMeta(id);
        if (!isActiveWorkflowSession(session, id)) return;
        toast.success('资料库已更新，后续运行将使用新的草稿版本');
      } catch (error) {
        if (!isActiveWorkflowSession(session, id)) return;
        toast.error(getAPIErrorMessage(error, '更新资料库失败'));
      } finally {
        if (isActiveWorkflowSession(session, id)) setSavingKnowledgeBases(false);
      }
    },
    [isActiveWorkflowSession, platform?.app.id, refreshWorkflowMeta],
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

  useEffect(() => {
    workflowIdRef.current = workflowId;
  }, [workflowId]);

  useEffect(() => {
    const currentState = { name: workflowName, nodes, edges };
    workflowStateRef.current = currentState;
    if (saveRevisionRef.current === persistedRevisionRef.current) {
      workflowSnapshotRef.current = {
        name: currentState.name,
        graph: serializeWorkflowGraph(currentState.nodes, currentState.edges),
        revision: saveRevisionRef.current,
      };
    }
  }, [edges, nodes, workflowName]);

  const markWorkflowDirty = useCallback((updates: Partial<WorkflowEditorState> = {}) => {
    const nextState = { ...workflowStateRef.current, ...updates };
    workflowStateRef.current = nextState;
    saveRevisionRef.current += 1;
    workflowSnapshotRef.current = {
      name: nextState.name,
      graph: serializeWorkflowGraph(nextState.nodes, nextState.edges),
      revision: saveRevisionRef.current,
    };
    setSaveRevision(saveRevisionRef.current);
  }, []);

  const handleWorkflowNameChange = useCallback(
    (name: string) => {
      setWorkflowName(name);
      markWorkflowDirty({ name });
    },
    [markWorkflowDirty],
  );

  useEffect(() => {
    if (!historyMutationRef.current) return;
    historyMutationRef.current = false;
    markWorkflowDirty({ name: workflowName, nodes, edges });
  }, [edges, markWorkflowDirty, nodes, workflowName]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    historyMutationRef.current = true;
    undo();
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    historyMutationRef.current = true;
    redo();
  }, [canRedo, redo]);

  const finishCreatedWorkflow = useCallback(
    (id: string, session: number) => {
      if (
        !isEditorMountedRef.current ||
        editorSessionRef.current !== session ||
        workflowIdRef.current !== id
      )
        return;
      if (pendingCreatedWorkflowIdRef.current !== id) return;
      pendingCreatedWorkflowIdRef.current = null;
      setWorkflowId(id);
      setSaveStatus('saved');
      navigate(`/workbench/edit?id=${id}`, { replace: true });
    },
    [navigate],
  );

  const enqueueWorkflowUpdate = useCallback(
    async (force = false): Promise<boolean> => {
      const session = editorSessionRef.current;
      const id = workflowIdRef.current;
      if (!id) return false;
      const queuedUpdate = saveQueueRef.current.then(async () => {
        if (
          !isEditorMountedRef.current ||
          editorSessionRef.current !== session ||
          workflowIdRef.current !== id
        )
          return false;

        setSaveStatus('saving');
        let shouldForce = force;
        try {
          while (
            shouldForce ||
            workflowSnapshotRef.current.revision > persistedRevisionRef.current
          ) {
            const snapshot = workflowSnapshotRef.current;
            await updateWorkflow(id, { name: snapshot.name, graph: snapshot.graph });
            if (
              !isEditorMountedRef.current ||
              editorSessionRef.current !== session ||
              workflowIdRef.current !== id
            )
              return false;
            persistedRevisionRef.current = snapshot.revision;
            shouldForce = false;
          }
          if (
            !isEditorMountedRef.current ||
            editorSessionRef.current !== session ||
            workflowIdRef.current !== id
          )
            return false;
          setSaveStatus('saved');
          finishCreatedWorkflow(id, session);
          return true;
        } catch {
          if (
            !isEditorMountedRef.current ||
            editorSessionRef.current !== session ||
            workflowIdRef.current !== id
          )
            return false;
          setSaveStatus('error');
          toast.error('保存失败');
          return false;
        }
      });

      saveQueueRef.current = queuedUpdate.then(
        () => undefined,
        () => undefined,
      );
      return queuedUpdate;
    },
    [finishCreatedWorkflow],
  );

  const createDraftWorkflow = useCallback(
    async (snapshot: WorkflowSnapshot): Promise<boolean> => {
      if (createPromiseRef.current) return createPromiseRef.current;
      const session = editorSessionRef.current;

      const createPromise = (async () => {
        setSaveStatus('creating');
        try {
          const result = await createWorkflow({
            name: snapshot.name,
            graph: snapshot.graph,
            status: 'draft',
          });
          if (!isEditorMountedRef.current || editorSessionRef.current !== session) return false;
          workflowIdRef.current = result.id;
          pendingCreatedWorkflowIdRef.current = result.id;
          persistedRevisionRef.current = snapshot.revision;

          const saved = await enqueueWorkflowUpdate();
          if (!saved) return false;
          finishCreatedWorkflow(result.id, session);
          return true;
        } catch {
          if (!isEditorMountedRef.current || editorSessionRef.current !== session) return false;
          setSaveStatus('error');
          toast.error('保存失败');
          return false;
        } finally {
          if (editorSessionRef.current === session) createPromiseRef.current = null;
        }
      })();

      createPromiseRef.current = createPromise;
      return createPromise;
    },
    [enqueueWorkflowUpdate, finishCreatedWorkflow],
  );

  const persistLatestWorkflow = useCallback(
    async ({ force = false, createIfMissing = false } = {}): Promise<boolean> => {
      if (workflowIdRef.current) return enqueueWorkflowUpdate(force);
      if (!createIfMissing) return false;
      return createDraftWorkflow({
        ...workflowSnapshotRef.current,
        revision: saveRevisionRef.current,
      });
    },
    [createDraftWorkflow, enqueueWorkflowUpdate],
  );

  useEffect(() => {
    if (!workflowId || saveRevision === 0 || saveRevision <= persistedRevisionRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void persistLatestWorkflow();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [persistLatestWorkflow, saveRevision, workflowId]);

  // 模板只能在详情页复制；编辑器只加载既有工作流或空白草稿。
  useEffect(() => {
    const id = searchParams.get('id');
    const template = searchParams.get('template');
    if (template) {
      navigate(`/workbench/templates/${encodeURIComponent(template)}`, { replace: true });
      return;
    }

    const routeKey = id || '';
    if (activeRouteKeyRef.current !== routeKey) {
      activeRouteKeyRef.current = routeKey;
      editorSessionRef.current += 1;
      workflowIdRef.current = null;
      pendingCreatedWorkflowIdRef.current = null;
      persistedRevisionRef.current = 0;
      saveRevisionRef.current = 0;
      saveQueueRef.current = Promise.resolve();
      createPromiseRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      runGenerationRef.current += 1;
      workflowSnapshotRef.current = {
        name: '未命名工作流',
        graph: serializeWorkflowGraph([], []),
        revision: 0,
      };
      setWorkflowId(null);
      setSaveRevision(0);
      setSaveStatus('idle');
      setIsRunning(false);
      setRunError(null);
      setPlatform(null);
      setRuns([]);
      setRunDetail(null);
      setKnowledgeBases([]);
      setBoundKnowledgeBaseIDs([]);
    }
    const session = editorSessionRef.current;
    if (id) {
      pendingCreatedWorkflowIdRef.current = null;
      setSaveStatus('idle');
      getWorkflow(id)
        .then((data) => {
          if (!isEditorMountedRef.current || editorSessionRef.current !== session) return;
          workflowIdRef.current = id;
          saveRevisionRef.current = 0;
          persistedRevisionRef.current = 0;
          setSaveRevision(0);
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
          setSaveStatus('saved');
        })
        .catch(() => {
          if (!isEditorMountedRef.current || editorSessionRef.current !== session) return;
          setSaveStatus('error');
          toast.error('加载工作流失败');
        });
    } else {
      setWorkflowName('未命名工作流');
      applyBlankWorkflow();
      clearHistory();
    }
  }, [searchParams, clearHistory, applyBlankWorkflow, navigate]);

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

  const onDrop = useCallback(
    (event: React.DragEvent) => {
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

      const nextNodes = [...workflowStateRef.current.nodes, newNode];
      setNodes(nextNodes);
      markWorkflowDirty({ nodes: nextNodes });
      toast.success(`已添加 ${config?.label} 节点`);
    },
    [markWorkflowDirty],
  );

  const handleAddNode = useCallback(
    (nodeType: string) => {
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

      const nextNodes = [...workflowStateRef.current.nodes, newNode];
      setNodes(nextNodes);
      markWorkflowDirty({ nodes: nextNodes });
      toast.success(`已添加 ${config?.label} 节点`);
    },
    [markWorkflowDirty],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextNodes = applyNodeChanges(changes, workflowStateRef.current.nodes);
      setNodes(nextNodes);
      if (changes.some((change) => change.type !== 'select' && change.type !== 'dimensions')) {
        markWorkflowDirty({ nodes: nextNodes });
      } else {
        workflowStateRef.current = { ...workflowStateRef.current, nodes: nextNodes };
      }
    },
    [markWorkflowDirty],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextEdges = applyEdgeChanges(changes, workflowStateRef.current.edges);
      setEdges(nextEdges);
      if (changes.some((change) => change.type !== 'select')) {
        markWorkflowDirty({ edges: nextEdges });
      } else {
        workflowStateRef.current = { ...workflowStateRef.current, edges: nextEdges };
      }
    },
    [markWorkflowDirty],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      if (!source || !target) return;
      const nextEdges = addEdge(
        { ...connection, source, target, sourceHandle: connection.sourceHandle || 'output' },
        workflowStateRef.current.edges,
      );
      setEdges(nextEdges);
      markWorkflowDirty({ edges: nextEdges });
    },
    [markWorkflowDirty],
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode({
      id: node.id,
      type: node.type || '',
      data: node.data as { label: string; nodeType: string; config?: Record<string, unknown> },
    });
    setActivePropertyTab('config');
  }, []);

  useEffect(() => {
    const failedNodeId = runSession.failedNodeId;
    if (!failedNodeId) return;

    const failureKey = `${runSession.generation}:${failedNodeId}`;
    if (handledFailedNodeRef.current === failureKey) return;
    handledFailedNodeRef.current = failureKey;

    const failedNode = workflowStateRef.current.nodes.find((node) => node.id === failedNodeId);
    if (!failedNode) return;

    setSelectedNode({
      id: failedNode.id,
      type: failedNode.type || '',
      data: failedNode.data as {
        label: string;
        nodeType: string;
        config?: Record<string, unknown>;
      },
    });
    setActivePropertyTab('run');
  }, [runSession.failedNodeId, runSession.generation]);

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
      const node = workflowStateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const nodeType = (node.data as { nodeType: string }).nodeType;
      if (nodeType === 'start' || nodeType === 'end') {
        toast.warning('开始/结束节点不可删除');
        return;
      }
      const nextNodes = workflowStateRef.current.nodes.filter((n) => n.id !== nodeId);
      const nextEdges = workflowStateRef.current.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
    },
    [markWorkflowDirty, selectedNode],
  );

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const node = workflowStateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const newNode: Node = {
        ...node,
        id: `${nodeId}-copy-${Date.now()}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
      };
      const nextNodes = [...workflowStateRef.current.nodes, newNode];
      setNodes(nextNodes);
      markWorkflowDirty({ nodes: nextNodes });
    },
    [markWorkflowDirty],
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
    const nextNodes = [
      ...workflowStateRef.current.nodes.map((node) => ({ ...node, selected: false })),
      ...pasted,
    ];
    setNodes(nextNodes);
    markWorkflowDirty({ nodes: nextNodes });
  }, [markWorkflowDirty]);

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
          handleRedo();
        } else {
          handleUndo();
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

      const hasSelectedEdge = workflowStateRef.current.edges.some((edge) => edge.selected);
      if (hasSelectedEdge) {
        event.preventDefault();
        const nextEdges = workflowStateRef.current.edges.filter((edge) => !edge.selected);
        setEdges(nextEdges);
        markWorkflowDirty({ edges: nextEdges });
      }
    },
    [selectedNode, handleDeleteNode, nodes, handleRedo, handleUndo, handlePaste, markWorkflowDirty],
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
      const nextNodes = workflowStateRef.current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
            }
          : node,
      );
      setNodes(nextNodes);

      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) => (prev ? { ...prev, data: { ...prev.data, ...updates } } : null));
      }
      markWorkflowDirty({ nodes: nextNodes });
    },
    [markWorkflowDirty, selectedNode],
  );

  const handleSave = useCallback(async () => {
    await persistLatestWorkflow({ force: true, createIfMissing: true });
  }, [persistLatestWorkflow]);

  const handleRunConfirm = useCallback(
    async ({ inputs, files }: WorkflowRunInput) => {
      const id = workflowId;
      const session = editorSessionRef.current;
      if (!id || !isActiveWorkflowSession(session, id)) return;

      setIsRunning(true);
      setRunError(null);
      const generation = runGenerationRef.current + 1;
      runGenerationRef.current = generation;
      dispatchRunSession({ type: 'begin', generation });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const isActiveRun = () =>
        isActiveWorkflowSession(session, id) && runGenerationRef.current === generation;

      try {
        await runWorkflow(
          id,
          { inputs, files },
          {
            onEvent: (event) => {
              if (!isActiveRun()) return;
              dispatchRunSession({ type: 'event', generation, event });
              if (event.status === 'done') {
                setIsRunning(false);
                toast.success('工作流执行完成');
              }
            },
            onError: (msg) => {
              if (!isActiveRun()) return;
              setRunError(msg);
              dispatchRunSession({ type: 'error', generation, error: msg });
              toast.error(msg);
              setIsRunning(false);
            },
          },
          abortController.signal,
        );
      } catch {
        if (!isActiveRun()) return;
        setRunError('运行请求失败');
        dispatchRunSession({ type: 'error', generation, error: '运行请求失败' });
      } finally {
        if (isActiveRun()) {
          if (abortControllerRef.current === abortController) abortControllerRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [isActiveWorkflowSession, workflowId],
  );

  const handleRun = useCallback(async () => {
    if (nodes.length === 0) {
      toast.warning('请先添加节点');
      return;
    }

    if (!workflowId) return;

    const errors = validateWorkflowConfig(nodes, edges);
    if (errors.length > 0) {
      const firstError = errors[0];
      toast.warning(
        `以下节点需要配置：${errors.map((e) => e.nodeLabel).join('、')}。点击画布上的橙色高亮节点进行配置。`,
      );
      setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === firstError.nodeId })));
      return;
    }

    if (!(await persistLatestWorkflow())) {
      return;
    }

    setShowRunPanel(true);
  }, [edges, nodes, persistLatestWorkflow, workflowId]);

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
          const nextNodes = data.nodes || [];
          const nextEdges = normalizeWorkflowEdges(data.edges || []);
          setNodes(nextNodes);
          setEdges(nextEdges);
          markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
          toast.success('工作流已导入');
        } catch {
          toast.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [markWorkflowDirty]);

  const handleClear = useCallback(() => {
    if (workflowStateRef.current.nodes.length === 0) return;
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
    markWorkflowDirty({ nodes: [], edges: [] });
    toast.info('工作流已清空');
  }, [markWorkflowDirty]);

  const handleReset = useCallback(() => {
    const nextNodes = [
      {
        id: 'start',
        type: 'start',
        position: { x: 200, y: 250 },
        data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
      },
    ] as Node[];
    setNodes(nextNodes);
    setEdges([]);
    markWorkflowDirty({ nodes: nextNodes, edges: [] });
    setSelectedNode(null);
    toast.info('工作流已重置');
  }, [markWorkflowDirty]);

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
      copyNode: handleCopyNode,
      deleteNode: handleDeleteNode,
    }),
    [handleCopyNode, handleDeleteNode, runSession],
  );

  const saveStatusText =
    saveStatus === 'creating'
      ? '正在创建'
      : saveStatus === 'saving'
        ? '正在保存'
        : saveStatus === 'saved'
          ? '已保存'
          : saveStatus === 'error'
            ? '保存失败'
            : null;

  return (
    <WorkflowRuntimeProvider value={runtimeValue}>
      <ReactFlowProvider>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/workbench')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {isEditingName ? (
                  <input
                    value={workflowName}
                    onChange={(e) => handleWorkflowNameChange(e.target.value)}
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
                {saveStatusText && <span className="ml-2">· {saveStatusText}</span>}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleUndo}
                disabled={!canUndo}
                title="撤销 (Ctrl/Cmd+Z)"
                aria-label="撤销"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRedo}
                disabled={!canRedo}
                title="重做 (Ctrl/Cmd+Shift+Z)"
                aria-label="重做"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon" aria-label="更多工作流操作" />}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={handleImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    导入
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    重置
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={handleClear}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saveStatus === 'creating' || saveStatus === 'saving'}
              >
                <Save className="h-4 w-4 mr-2" />
                立即保存
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
              <Button
                size="sm"
                onClick={() => void handleRun()}
                disabled={!workflowId || isRunning || saveStatus === 'creating'}
              >
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
            <DialogContent className="max-h-[min(720px,calc(100vh-3rem))] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>版本历史</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  恢复历史版本会创建一份新的草稿，不会覆盖已有记录。
                </p>
              </DialogHeader>
              <div className="space-y-3">
                {platform?.versions.map((version) => (
                  <article
                    key={version.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">v{version.number}</span>
                        {version.id === platform.app.draftVersionId && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            当前草稿
                          </span>
                        )}
                        {version.id === platform.app.publishedVersionId && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            已发布
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
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
                        恢复为草稿
                      </Button>
                    </div>
                  </article>
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
                        setRunExplanation(null);
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
                <div className="rounded-lg border border-border p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-medium">节点详情</p>
                    {runDetail.run.status === 'error' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={explainingRun}
                        onClick={async () => {
                          if (!workflowId) return;
                          setExplainingRun(true);
                          try {
                            const result = await explainWorkflowRun(workflowId, runDetail.run.id);
                            setRunExplanation(result.explanation);
                          } catch (error) {
                            toast.error(getAPIErrorMessage(error, 'AI 解释失败'));
                          } finally {
                            setExplainingRun(false);
                          }
                        }}
                      >
                        <Sparkles className="mr-1.5 size-3.5" />
                        AI 解释
                      </Button>
                    ) : null}
                  </div>
                  {runDetail.nodes.map((node) => (
                    <p key={node.id}>
                      {node.nodeId} · {node.status} · {node.durationMs ?? 0} ms
                    </p>
                  ))}
                  {explainingRun ? (
                    <AIGenerationProgress
                      compact
                      className="mt-3"
                      title="正在分析失败原因"
                      description="AI 正在定位异常节点并整理可执行的修复建议。"
                    />
                  ) : runExplanation ? (
                    <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                      <p className="font-medium">{runExplanation.cause}</p>
                      {runExplanation.nodeId ? (
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          定位节点：{runExplanation.nodeId}
                        </p>
                      ) : null}
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                        {runExplanation.suggestions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </DialogContent>
          </Dialog>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-64 flex-shrink-0">
              <NodePanel onDragStart={onDragStart} onAddNode={handleAddNode} />
            </div>

            <div
              ref={reactFlowWrapper}
              className="relative flex-1 bg-muted/20"
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
              {showRunPanel ? (
                <div className="absolute inset-x-4 bottom-4 z-10 h-[min(520px,55vh)] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
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
                </div>
              ) : null}
            </div>

            <div className="flex">
              <div
                className="flex w-1 cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-primary/30"
                onMouseDown={handleMouseDown}
              >
                <div className="h-8 w-0.5 rounded bg-muted-foreground/40" />
              </div>
              <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0">
                <PropertyPanel
                  selectedNode={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onUpdateNode={onUpdateNode}
                  nodes={nodes}
                  edges={edges}
                  runSnapshot={selectedNode ? runSession.nodes[selectedNode.id] : undefined}
                  activeTab={activePropertyTab}
                  onActiveTabChange={setActivePropertyTab}
                />
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
