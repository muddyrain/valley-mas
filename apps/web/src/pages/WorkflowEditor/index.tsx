import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionLineType,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  MiniMap,
  type Node,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart,
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
  Plus,
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
import type { CopilotProposal } from '@/api/workbenchCopilot';
import {
  cancelWorkflowRun,
  createWorkflow,
  getWorkflow,
  getWorkflowPlatform,
  publishWorkflowVersion,
  restoreWorkflowVersion,
  retryWorkflowRun,
  runWorkflow,
  updateWorkflow,
  type WorkflowPlatformData,
  type WorkflowRunDetail,
} from '@/api/workflow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { KnowledgeBaseBindings } from '@/components/workbench/KnowledgeBaseBindings';
import { MobileCopilotSheet } from '@/components/workbench/MobileCopilotSheet';
import { WorkbenchCopilot } from '@/components/workbench/WorkbenchCopilot';
import { isAIWorkflowDraft, workflowDraftToCanvas } from '@/components/workbench/workflowDraft';
import { InsertableEdge } from '@/components/workflow/InsertableEdge';
import { LoopBodyNode } from '@/components/workflow/LoopBodyNode';
import { LoopBoundaryEdge } from '@/components/workflow/LoopBoundaryEdge';
import { NodePicker, type NodePickerItem } from '@/components/workflow/NodePicker';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { PropertyPanel, type PropertyPanelTab } from '@/components/workflow/PropertyPanel';
import type { WorkflowRunInput } from '@/components/workflow/RunPanel';
import { RunPanel } from '@/components/workflow/RunPanel';
import {
  createWorkflowRunSession,
  type WorkflowRunSession,
  workflowRunSessionReducer,
} from '@/components/workflow/runSession';
import type { WorkflowNodeData } from '@/components/workflow/types';
import { useWorkflowHistory } from '@/components/workflow/useWorkflowHistory';
import {
  getInvalidWorkflowVariableReferenceErrors,
  type ValidationError,
  validateWorkflowDraft,
} from '@/components/workflow/validateWorkflowConfig';
import { WorkflowAlignmentGuides } from '@/components/workflow/WorkflowAlignmentGuides';
import { WorkflowConnectionLine } from '@/components/workflow/WorkflowConnectionLine';
import { WorkflowNode } from '@/components/workflow/WorkflowNode';
import { WorkflowRunHistory } from '@/components/workflow/WorkflowRunHistory';
import { WorkflowRuntimeProvider } from '@/components/workflow/WorkflowRuntimeContext';
import { WorkflowTestCases } from '@/components/workflow/WorkflowTestCases';
import {
  WorkflowWorkspacePanel,
  type WorkflowWorkspaceTab,
} from '@/components/workflow/WorkflowWorkspacePanel';
import {
  getWorkflowAlignment,
  type WorkflowAlignment,
} from '@/components/workflow/workflowAlignment';
import {
  expandLoopCanvas,
  loopBodyChildID,
  loopBodyChildPosition,
  loopBodyID,
  normalizeWorkflowEdges,
  serializeWorkflowGraph,
} from '@/components/workflow/workflowGraph';
import { layoutNodeInsertion } from '@/components/workflow/workflowLayout';
import { getWorkflowRunBranchHandle } from '@/components/workflow/workflowRunBranches';
import { useIsMobile } from '@/hooks/use-mobile';

const defaultEdgeOptions = {
  type: 'insertable',
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
workflowNodeTypes.loopBody = LoopBodyNode;
const workflowEdgeTypes = { insertable: InsertableEdge, loopBoundary: LoopBoundaryEdge };
const minimumRunPanelHeight = 220;
const maximumRunPanelHeight = 720;
const minimumRightPanelWidth = 420;
const maximumRightPanelWidth = 560;
const SERVER_NODE_FIELD_VALIDATION_PATTERN =
  /节点\s+([^\s；，]+)\s+的\s+([^\s；，]+)\s+需要\s+([^，；]+)，实际为\s+([^；]+)/g;
const SERVER_NODE_VALIDATION_PATTERN = /(?:选择器)?节点\s+([^\s；，]+)/g;

function didRunTraverseEdge(edge: Edge, nodes: Node[], session: WorkflowRunSession) {
  const sourceRun = session.nodes[edge.source];
  if (sourceRun?.status !== 'success' || !sourceRun.output) return true;
  const sourceNode = nodes.find((node) => node.id === edge.source);
  const sourceType = (sourceNode?.data as { nodeType?: string } | undefined)?.nodeType;

  const activeHandle = getWorkflowRunBranchHandle(sourceType, sourceRun.output);
  return activeHandle ? edge.sourceHandle === activeHandle : true;
}

function runtimeEdgeStyle(edge: Edge, stroke: string) {
  return {
    ...edge.style,
    stroke,
    strokeWidth: edge.style?.strokeWidth ?? defaultEdgeOptions.style.strokeWidth,
  };
}

function isLoopBodyChildNode(node: Node) {
  const data = node.data as unknown as WorkflowNodeData;
  return data.isLoopBody !== true && Boolean(data.loopParentId);
}

function workflowPanelNode(node: Node, nodes: Node[]) {
  const data = node.data as unknown as WorkflowNodeData;
  if (!data.isLoopBody || !data.loopParentId) return node;
  return nodes.find((candidate) => candidate.id === data.loopParentId) || node;
}

// React Flow applies a z-index per canvas node. Runtime details should sit
// above ordinary cards. A selected loop body may intentionally cover its
// parent's detail panel, but a selected child card must not hide that panel.
function workflowCanvasNodeZIndex(
  node: Node,
  selectedNodeID: string | undefined,
  session: WorkflowRunSession,
) {
  const snapshot = session.nodes[node.id];
  const isSelected = node.id === selectedNodeID || node.selected;
  const data = node.data as unknown as WorkflowNodeData;
  const parentRun = data.loopParentId ? session.nodes[data.loopParentId] : undefined;

  // While an outer loop detail panel is visible, keep completed/idle children
  // beneath it. An actively running child still rises so its own live detail
  // remains inspectable.
  if (isLoopBodyChildNode(node) && parentRun && snapshot?.status !== 'running') {
    if (isSelected) return 10;
    return snapshot ? 5 : 0;
  }

  if (isSelected) return 30;
  return snapshot ? 20 : 0;
}

function hasSameValidationGraph(
  previousNodes: Node[],
  nextNodes: Node[],
  previousEdges: Edge[],
  nextEdges: Edge[],
) {
  if (previousNodes.length !== nextNodes.length || previousEdges.length !== nextEdges.length) {
    return false;
  }
  if (
    previousNodes.some(
      (node, index) =>
        node.id !== nextNodes[index].id ||
        node.type !== nextNodes[index].type ||
        node.data !== nextNodes[index].data,
    )
  ) {
    return false;
  }
  return !previousEdges.some(
    (edge, index) =>
      edge.id !== nextEdges[index].id ||
      edge.source !== nextEdges[index].source ||
      edge.sourceHandle !== nextEdges[index].sourceHandle ||
      edge.target !== nextEdges[index].target ||
      edge.targetHandle !== nextEdges[index].targetHandle,
  );
}

function getServerValidationErrors(message: string, nodes: Node[]): ValidationError[] {
  const nodeByID = new Map(nodes.map((node) => [node.id, node]));
  const errors: ValidationError[] = [];
  const handledNodeIDs = new Set<string>();

  for (const match of message.matchAll(SERVER_NODE_FIELD_VALIDATION_PATTERN)) {
    const [, nodeID, field, expected, actual] = match;
    const node = nodeByID.get(nodeID);
    if (!node) continue;
    const data = node.data as { label?: string; nodeType?: string };
    errors.push({
      nodeId: nodeID,
      nodeLabel: data.label || nodeID,
      nodeType: data.nodeType || node.type || '',
      field,
      message: `字段“${field}”需要${expected}，实际为${actual.trim()}`,
    });
    handledNodeIDs.add(nodeID);
  }

  for (const match of message.matchAll(SERVER_NODE_VALIDATION_PATTERN)) {
    const nodeID = match[1];
    if (handledNodeIDs.has(nodeID)) continue;
    const node = nodeByID.get(nodeID);
    if (!node) continue;
    const data = node.data as { label?: string; nodeType?: string };
    errors.push({
      nodeId: nodeID,
      nodeLabel: data.label || nodeID,
      nodeType: data.nodeType || node.type || '',
      message: message.replace(/^工作流配置无效:\s*/, ''),
    });
  }

  return errors;
}

function notifyWorkflowValidation(action: '保存' | '发布' | '运行', errors: ValidationError[]) {
  const firstError = errors[0];
  if (!firstError) return;

  const remainingCount = errors.length - 1;
  toast.error(
    firstError.nodeId === 'workflow'
      ? `${action}前请完善：${firstError.message}`
      : `${action}前请完善：${firstError.nodeLabel} — ${firstError.message}${
          remainingCount > 0 ? `（另有 ${remainingCount} 项）` : ''
        }`,
    {
      className:
        '!border-destructive/30 !bg-destructive/10 !text-destructive [&_svg]:!text-destructive',
    },
  );
}

type SaveStatus = 'idle' | 'pending' | 'creating' | 'saving' | 'saved' | 'error';

function formatAutoSavedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '已自动保存';
  return `已自动保存 ${date.toLocaleTimeString('zh-CN', { hour12: false })}`;
}

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

function hasSameAlignment(current: WorkflowAlignment | null, next: WorkflowAlignment | null) {
  if (current === next) return true;
  if (!current || !next) return false;

  return (
    current.vertical?.position === next.vertical?.position &&
    current.vertical?.start === next.vertical?.start &&
    current.vertical?.end === next.vertical?.end &&
    current.horizontal?.position === next.horizontal?.position &&
    current.horizontal?.start === next.horizontal?.start &&
    current.horizontal?.end === next.horizontal?.end
  );
}

function retryInputNodes(graphSnapshot: string): Node[] | null {
  try {
    const graph: unknown = JSON.parse(graphSnapshot);
    if (
      !graph ||
      typeof graph !== 'object' ||
      !Array.isArray((graph as { nodes?: unknown }).nodes)
    ) {
      return null;
    }
    return (graph as { nodes: Array<Record<string, unknown>> }).nodes.map((node) => ({
      id: String(node.id || ''),
      type: typeof node.type === 'string' ? node.type : undefined,
      position:
        node.position && typeof node.position === 'object'
          ? (node.position as { x: number; y: number })
          : { x: 0, y: 0 },
      data: {
        label: typeof node.label === 'string' ? node.label : String(node.id || ''),
        nodeType: typeof node.type === 'string' ? node.type : '',
        config:
          node.config && typeof node.config === 'object'
            ? (node.config as Record<string, unknown>)
            : {},
      },
    }));
  } catch {
    return null;
  }
}

export default function WorkflowEditorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    type: string;
    data: {
      label: string;
      nodeType: string;
      config?: Record<string, unknown>;
      when?: import('@/api/workflow').WorkflowRule;
    };
  } | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkflowWorkspaceTab>('node');
  const [activePropertyTab, setActivePropertyTab] = useState<PropertyPanelTab>('config');
  const [workflowName, setWorkflowName] = useState('未命名工作流');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveRevision, setSaveRevision] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [retryRun, setRetryRun] = useState<WorkflowRunDetail | null>(null);
  const [pendingRetryRun, setPendingRetryRun] = useState<WorkflowRunDetail | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [serverValidationErrors, setServerValidationErrors] = useState<ValidationError[]>([]);
  const [pendingValidationFocusNodeID, setPendingValidationFocusNodeID] = useState<string | null>(
    null,
  );
  const [runPanelHeight, setRunPanelHeight] = useState<number | null>(null);
  const [isRunPanelResizing, setIsRunPanelResizing] = useState(false);
  const [runSession, dispatchRunSession] = useReducer(
    workflowRunSessionReducer,
    undefined,
    createWorkflowRunSession,
  );
  const [runError, setRunError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<WorkflowPlatformData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showKnowledgeBases, setShowKnowledgeBases] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<AIKnowledgeBase[]>([]);
  const [boundKnowledgeBaseIDs, setBoundKnowledgeBaseIDs] = useState<string[]>([]);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [savingKnowledgeBases, setSavingKnowledgeBases] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(minimumRightPanelWidth);
  const [showMobileWorkspace, setShowMobileWorkspace] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<WorkflowAlignment | null>(null);
  const [isViewportMoving, setIsViewportMoving] = useState(false);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [outputPickerNodeId, setOutputPickerNodeId] = useState<string | null>(null);
  const [connectingOutputNodeId, setConnectingOutputNodeId] = useState<string | null>(null);
  const alignmentGuidesRef = useRef<WorkflowAlignment | null>(null);
  const isDraggingRef = useRef(false);
  const isNodeDragInProgressRef = useRef(false);
  const pendingNodeDragChangesRef = useRef<NodeChange[] | null>(null);
  const nodeDragFrameRef = useRef<number | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const runPanelRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const [canvasInitialized, setCanvasInitialized] = useState(false);
  const [fitViewRequest, setFitViewRequest] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRunIDRef = useRef<string | null>(null);
  const connectingOutputNodeIdRef = useRef<string | null>(null);
  const runGenerationRef = useRef(0);
  const handledFailedNodeRef = useRef<string | null>(null);
  const clipboardRef = useRef<Node[] | null>(null);
  const isMobile = useIsMobile();
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
  const persistedGraphHashRef = useRef('');
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const createPromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingCreatedWorkflowIdRef = useRef<string | null>(null);
  const historyMutationRef = useRef(false);
  const editorSessionRef = useRef(0);
  const activeRouteKeyRef = useRef<string | null>(null);
  const isEditorMountedRef = useRef(false);
  const validationGraphRef = useRef({ nodes, edges });
  if (
    !hasSameValidationGraph(
      validationGraphRef.current.nodes,
      nodes,
      validationGraphRef.current.edges,
      edges,
    )
  ) {
    validationGraphRef.current = { nodes, edges };
  }
  const validationGraph = validationGraphRef.current;
  const { undo, redo, canUndo, canRedo, clearHistory } = useWorkflowHistory(
    nodes,
    edges,
    setNodes,
    setEdges,
  );

  const applyServerValidationError = useCallback((message: string) => {
    const errors = getServerValidationErrors(message, workflowStateRef.current.nodes);
    if (errors.length === 0) return message;
    setServerValidationErrors(errors);
    setShowValidationErrors(true);
    setPendingValidationFocusNodeID(errors[0].nodeId);
    return `“${errors[0].nodeLabel}”节点：${errors[0].message}`;
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    setShowValidationErrors(false);
    setServerValidationErrors([]);
    setPendingValidationFocusNodeID(null);
  }, [isRunning]);

  useEffect(() => {
    isEditorMountedRef.current = true;
    return () => {
      isEditorMountedRef.current = false;
      if (nodeDragFrameRef.current !== null) {
        window.cancelAnimationFrame(nodeDragFrameRef.current);
      }
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
      const nextPlatform = await getWorkflowPlatform(id);
      if (!isActiveWorkflowSession(session, id)) return;
      setPlatform(nextPlatform);
    },
    [isActiveWorkflowSession],
  );

  const openHistory = useCallback(async () => {
    const id = workflowIdRef.current;
    const session = editorSessionRef.current;
    if (!id || !isActiveWorkflowSession(session, id)) return;
    setShowHistory(true);
    setLoadingHistory(true);
    try {
      await refreshWorkflowMeta(id);
    } catch (error) {
      if (isActiveWorkflowSession(session, id)) {
        toast.error(getAPIErrorMessage(error, '加载历史失败'));
      }
    } finally {
      if (isActiveWorkflowSession(session, id)) setLoadingHistory(false);
    }
  }, [isActiveWorkflowSession, refreshWorkflowMeta]);

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

  const requestFitView = useCallback(() => {
    setFitViewRequest((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!canvasInitialized || fitViewRequest === 0) return;
    const frame = window.requestAnimationFrame(() => {
      reactFlowInstance.current?.fitView({ maxZoom: 0.8, padding: 0.2 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canvasInitialized, fitViewRequest]);

  const applyBlankWorkflow = useCallback(() => {
    setNodes([
      {
        id: 'start',
        type: 'start',
        position: { x: 220, y: 250 },
        data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 620, y: 250 },
        data: { label: '结束', nodeType: 'end', config: { outputs: {} } },
      },
    ] as Node[]);
    setEdges(
      normalizeWorkflowEdges([
        { id: 'start-end', source: 'start', target: 'end', type: 'insertable' },
      ] as Edge[]),
    );
    requestFitView();
  }, [requestFitView]);

  useEffect(() => {
    workflowIdRef.current = workflowId;
  }, [workflowId]);

  useEffect(() => {
    const currentState = { name: workflowName, nodes, edges };
    workflowStateRef.current = currentState;
    if (isNodeDragInProgressRef.current) return;
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
    setShowValidationErrors(false);
    setServerValidationErrors([]);
    setPendingValidationFocusNodeID(null);
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
      setLastAutoSavedAt(new Date().toISOString());
      navigate(`/workbench/edit?id=${id}`, { replace: true });
    },
    [navigate],
  );

  const enqueueWorkflowUpdate = useCallback(
    async (force = false, silent = false, recordHistory = false): Promise<boolean> => {
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
        let shouldRecordHistory = recordHistory;
        try {
          while (
            shouldForce ||
            workflowSnapshotRef.current.revision > persistedRevisionRef.current
          ) {
            const snapshot = workflowSnapshotRef.current;
            const result = await updateWorkflow(
              id,
              {
                name: snapshot.name,
                graph: snapshot.graph,
                baseHash: persistedGraphHashRef.current || undefined,
                recordHistory: shouldRecordHistory,
              },
              { suppressErrorToast: true },
            );
            if (
              !isEditorMountedRef.current ||
              editorSessionRef.current !== session ||
              workflowIdRef.current !== id
            )
              return false;
            persistedRevisionRef.current = snapshot.revision;
            persistedGraphHashRef.current = result.graphHash;
            shouldForce = false;
            shouldRecordHistory = false;
          }
          if (
            !isEditorMountedRef.current ||
            editorSessionRef.current !== session ||
            workflowIdRef.current !== id
          )
            return false;
          await refreshWorkflowMeta(id).catch(() => undefined);
          if (
            !isEditorMountedRef.current ||
            editorSessionRef.current !== session ||
            workflowIdRef.current !== id
          )
            return false;
          setSaveStatus('saved');
          setLastAutoSavedAt(new Date().toISOString());
          finishCreatedWorkflow(id, session);
          return true;
        } catch (error) {
          if (
            !isEditorMountedRef.current ||
            editorSessionRef.current !== session ||
            workflowIdRef.current !== id
          )
            return false;
          setSaveStatus('error');
          if (!silent) {
            const message = applyServerValidationError(getAPIErrorMessage(error, '保存失败'));
            toast.error(message);
          }
          return false;
        }
      });

      saveQueueRef.current = queuedUpdate.then(
        () => undefined,
        () => undefined,
      );
      return queuedUpdate;
    },
    [applyServerValidationError, finishCreatedWorkflow, refreshWorkflowMeta],
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
          persistedGraphHashRef.current = result.graphHash || '';

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
    async ({
      force = false,
      createIfMissing = false,
      silent = false,
      recordHistory = false,
    } = {}): Promise<boolean> => {
      if (workflowIdRef.current) return enqueueWorkflowUpdate(force, silent, recordHistory);
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
      void persistLatestWorkflow({ silent: true });
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
      persistedGraphHashRef.current = '';
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
      setWorkflowDescription('');
      setSaveRevision(0);
      setSaveStatus('idle');
      setIsRunning(false);
      setRetryRun(null);
      setPendingRetryRun(null);
      setRunError(null);
      setPlatform(null);
      setShowHistory(false);
      setLoadingHistory(false);
      setKnowledgeBases([]);
      setBoundKnowledgeBaseIDs([]);
      setLastAutoSavedAt(null);
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
          setWorkflowDescription(data.description || '');
          setLastAutoSavedAt(data.updatedAt || null);
          persistedGraphHashRef.current = data.graphHash || '';
          try {
            const graph = JSON.parse(data.graph);
            const nextNodes = Array.isArray(graph.nodes)
              ? graph.nodes.map(
                  (
                    node: Node & {
                      label?: string;
                      config?: Record<string, unknown>;
                      when?: import('@/api/workflow').WorkflowRule;
                    },
                  ) => ({
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: {
                      label: node.label || NODE_CONFIGS[node.type || '']?.label || node.id,
                      nodeType: node.type,
                      config: node.config || {},
                      when: node.when,
                    },
                  }),
                )
              : [];
            const nextEdges = Array.isArray(graph.edges)
              ? normalizeWorkflowEdges(graph.edges as Edge[])
              : [];
            const expanded = expandLoopCanvas(nextNodes, nextEdges);
            workflowStateRef.current = {
              name: data.name,
              nodes: expanded.nodes,
              edges: expanded.edges,
            };
            workflowSnapshotRef.current = {
              name: data.name,
              graph: serializeWorkflowGraph(expanded.nodes, expanded.edges),
              revision: 0,
            };
            setNodes(expanded.nodes);
            setEdges(expanded.edges);
            requestFitView();
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
  }, [searchParams, clearHistory, applyBlankWorkflow, navigate, requestFitView]);

  const createPickerNode = useCallback(
    (item: NodePickerItem, position: { x: number; y: number }): Node => ({
      id: `${item.nodeType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: item.nodeType,
      position,
      data: {
        label: item.label,
        nodeType: item.nodeType,
        config: { ...item.config, ...(item.sideEffect ? { sideEffect: item.sideEffect } : {}) },
      },
    }),
    [],
  );

  const insertLoopBodyNode = useCallback(
    (loopID: string, item: NodePickerItem, afterNodeID?: string, prepend = false) => {
      const bodyID = loopBodyID(loopID);
      const body = workflowStateRef.current.nodes.find((node) => node.id === bodyID);
      if (!body) return null;

      const children = workflowStateRef.current.nodes
        .filter((node) => {
          const data = node.data as { isLoopBody?: boolean; loopParentId?: string };
          return data.loopParentId === loopID && !data.isLoopBody;
        })
        .sort(
          (left, right) =>
            left.position.x - right.position.x ||
            left.position.y - right.position.y ||
            left.id.localeCompare(right.id),
        );
      if (children.length >= 30) {
        toast.warning('循环体最多支持 30 个节点');
        return null;
      }

      const currentIndex = afterNodeID ? children.findIndex((node) => node.id === afterNodeID) : -1;
      const insertIndex = prepend ? 0 : currentIndex === -1 ? children.length : currentIndex + 1;
      const nextNodeCount = children.length + 1;
      const created = createPickerNode(item, loopBodyChildPosition(insertIndex, nextNodeCount));
      const child: Node = {
        ...created,
        id: loopBodyChildID(loopID, created.id),
        parentId: bodyID,
        extent: 'parent',
        data: {
          ...created.data,
          loopParentId: loopID,
          loopBodyNodeId: created.id,
        },
      };
      const orderedChildren = [
        ...children.slice(0, insertIndex),
        child,
        ...children.slice(insertIndex),
      ];
      const positions = new Map(
        orderedChildren.map((node, index) => [
          node.id,
          loopBodyChildPosition(index, nextNodeCount),
        ]),
      );
      return {
        node: child,
        nodes: [
          ...workflowStateRef.current.nodes.map((node) => {
            const position = positions.get(node.id);
            return position ? { ...node, position } : node;
          }),
          child,
        ],
      };
    },
    [createPickerNode],
  );

  const handleAddNode = useCallback(
    (item: NodePickerItem) => {
      if (isRunning) return;
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

      const newNode = createPickerNode(item, position);

      const expanded = expandLoopCanvas(
        [...workflowStateRef.current.nodes, newNode],
        workflowStateRef.current.edges,
      );
      setNodes(expanded.nodes);
      setEdges(expanded.edges);
      markWorkflowDirty({ nodes: expanded.nodes, edges: expanded.edges });
      toast.success(`已添加 ${item.label} 节点`);
    },
    [createPickerNode, isRunning, markWorkflowDirty],
  );

  const handleAddLoopBodyNode = useCallback(
    (loopID: string, item: NodePickerItem) => {
      if (isRunning) return;
      const insertion = insertLoopBodyNode(loopID, item);
      if (!insertion) return;
      const expanded = expandLoopCanvas(insertion.nodes, workflowStateRef.current.edges);
      setNodes(expanded.nodes);
      setEdges(expanded.edges);
      markWorkflowDirty({ nodes: expanded.nodes, edges: expanded.edges });
    },
    [insertLoopBodyNode, isRunning, markWorkflowDirty],
  );

  const handleInsertAfter = useCallback(
    (nodeId: string, item: NodePickerItem) => {
      if (isRunning) return;
      const source = workflowStateRef.current.nodes.find((node) => node.id === nodeId);
      if (!source) return;
      const outgoing = workflowStateRef.current.edges.filter((edge) => edge.source === nodeId);
      if (outgoing.length > 1) {
        toast.info('请使用对应连线上的加号选择插入分支');
        return;
      }
      const sourceData = source.data as unknown as WorkflowNodeData;
      const loopID = sourceData.loopParentId;
      const loopInsertion = loopID ? insertLoopBodyNode(loopID, item, nodeId) : null;
      if (loopID && !loopInsertion) return;
      const layout = loopID
        ? null
        : layoutNodeInsertion(
            workflowStateRef.current.nodes,
            workflowStateRef.current.edges,
            nodeId,
            outgoing[0]?.target,
          );
      if (!loopInsertion && !layout) return;
      let newNode: Node;
      let baseNodes: Node[];
      if (loopInsertion) {
        newNode = loopInsertion.node;
        baseNodes = loopInsertion.nodes;
      } else {
        if (!layout) return;
        newNode = createPickerNode(item, layout.position);
        baseNodes = [...layout.nodes, newNode];
      }
      let nextEdges = workflowStateRef.current.edges;
      if (outgoing[0]) {
        nextEdges = nextEdges.filter((edge) => edge.id !== outgoing[0].id);
        const insertedEdges: Edge[] = [
          {
            id: `${nodeId}-${newNode.id}`,
            source: nodeId,
            sourceHandle: outgoing[0].sourceHandle || 'output',
            target: newNode.id,
            targetHandle: 'input',
            type: 'insertable',
          },
        ];
        if (item.nodeType !== 'condition' && item.nodeType !== 'intent') {
          insertedEdges.push({
            id: `${newNode.id}-${outgoing[0].target}`,
            source: newNode.id,
            sourceHandle: 'output',
            target: outgoing[0].target,
            targetHandle: outgoing[0].targetHandle || 'input',
            type: 'insertable',
          });
        }
        nextEdges = normalizeWorkflowEdges([...nextEdges, ...insertedEdges]);
      } else {
        nextEdges = normalizeWorkflowEdges([
          ...nextEdges,
          {
            id: `${nodeId}-${newNode.id}`,
            source: nodeId,
            sourceHandle: 'output',
            target: newNode.id,
            targetHandle: 'input',
            type: 'insertable',
          },
        ] as Edge[]);
      }
      const expanded = expandLoopCanvas(baseNodes, nextEdges);
      const nextNodes = expanded.nodes;
      nextEdges = expanded.edges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
      if ((item.nodeType === 'condition' || item.nodeType === 'intent') && outgoing[0]) {
        toast.info(
          item.nodeType === 'intent'
            ? '意图识别节点已插入，请连接每个意图和其他出口'
            : '条件节点已插入，请从 true / false 端口连接后续节点',
        );
      }
    },
    [createPickerNode, insertLoopBodyNode, isRunning, markWorkflowDirty],
  );

  const handleInsertOnEdge = useCallback(
    (edgeId: string, item: NodePickerItem) => {
      if (isRunning) return;
      const edge = workflowStateRef.current.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return;
      const source = workflowStateRef.current.nodes.find((node) => node.id === edge.source);
      const target = workflowStateRef.current.nodes.find((node) => node.id === edge.target);
      if (!source || !target) return;
      const sourceData = source.data as unknown as WorkflowNodeData;
      const targetData = target.data as unknown as WorkflowNodeData;
      const sourceLoopID = sourceData.loopParentId;
      const targetLoopID = targetData.loopParentId;
      const sourceIsLoopBody = Boolean(sourceData.isLoopBody);
      const targetIsLoopBody = Boolean(targetData.isLoopBody);
      const loopInsertion =
        sourceLoopID && sourceLoopID === targetLoopID
          ? insertLoopBodyNode(sourceLoopID, item, edge.source, sourceIsLoopBody)
          : null;
      if (sourceLoopID === targetLoopID && sourceLoopID && !loopInsertion) return;
      const layout = loopInsertion
        ? null
        : layoutNodeInsertion(
            workflowStateRef.current.nodes,
            workflowStateRef.current.edges,
            edge.source,
            edge.target,
          );
      if (!loopInsertion && !layout) return;
      let newNode: Node;
      let baseNodes: Node[];
      if (loopInsertion) {
        newNode = loopInsertion.node;
        baseNodes = loopInsertion.nodes;
      } else {
        if (!layout) return;
        newNode = createPickerNode(item, layout.position);
        baseNodes = [...layout.nodes, newNode];
      }
      const insertedEdges: Edge[] = [
        {
          id: `${edge.source}-${newNode.id}`,
          source: edge.source,
          sourceHandle: edge.sourceHandle || 'output',
          target: newNode.id,
          targetHandle: 'input',
          ...(sourceIsLoopBody
            ? { type: 'loopBoundary', data: { isLoopBodyBoundary: true } }
            : { type: 'insertable' }),
        },
      ];
      if (item.nodeType !== 'condition' && item.nodeType !== 'intent') {
        insertedEdges.push({
          id: `${newNode.id}-${edge.target}`,
          source: newNode.id,
          sourceHandle: 'output',
          target: edge.target,
          targetHandle: edge.targetHandle || 'input',
          ...(targetIsLoopBody
            ? { type: 'loopBoundary', data: { isLoopBodyBoundary: true } }
            : { type: 'insertable' }),
        });
      }
      const baseEdges = normalizeWorkflowEdges([
        ...workflowStateRef.current.edges.filter((candidate) => candidate.id !== edgeId),
        ...insertedEdges,
      ]);
      const expanded = expandLoopCanvas(baseNodes, baseEdges);
      const nextNodes = expanded.nodes;
      const nextEdges = expanded.edges;
      setNodes(nextNodes);
      setEdges(nextEdges);
      markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
      if (item.nodeType === 'condition' || item.nodeType === 'intent') {
        toast.info(
          item.nodeType === 'intent'
            ? '意图识别节点已插入，请连接每个意图和其他出口'
            : '条件节点已插入，请从 true / false 端口连接后续节点',
        );
      }
    },
    [createPickerNode, insertLoopBodyNode, isRunning, markWorkflowDirty],
  );

  const updateAlignmentGuides = useCallback((next: WorkflowAlignment | null) => {
    if (hasSameAlignment(alignmentGuidesRef.current, next)) return;
    alignmentGuidesRef.current = next;
    setAlignmentGuides(next);
  }, []);

  const applyWorkflowNodeChanges = useCallback(
    (changes: NodeChange[]) => {
      const isDragging = changes.some(
        (change) => change.type === 'position' && change.dragging === true,
      );
      const didStopDragging = changes.some(
        (change) => change.type === 'position' && change.dragging === false,
      );
      if (isDragging && !isNodeDragInProgressRef.current) {
        isNodeDragInProgressRef.current = true;
        setIsNodeDragging(true);
      }
      if (didStopDragging && isNodeDragInProgressRef.current) {
        isNodeDragInProgressRef.current = false;
        setIsNodeDragging(false);
      }

      let nextNodes = applyNodeChanges(changes, workflowStateRef.current.nodes);
      const movedNodeChange = changes.find(
        (change) => change.type === 'position' && change.position,
      );
      if (movedNodeChange?.type === 'position') {
        const movedNode = nextNodes.find((node) => node.id === movedNodeChange.id);
        if (movedNode && movedNodeChange.dragging !== undefined) {
          const movedData = movedNode.data as unknown as WorkflowNodeData;
          const alignment = getWorkflowAlignment(
            movedNode,
            nextNodes,
            reactFlowInstance.current?.getViewport().zoom || 1,
          );
          if (alignment.vertical || alignment.horizontal) {
            nextNodes = nextNodes.map((node) =>
              node.id === movedNode.id ? { ...node, position: alignment.position } : node,
            );
          }
          if (movedData.isLoopBody && movedData.loopParentId) {
            const bodyPosition = nextNodes.find((node) => node.id === movedNode.id)?.position;
            if (bodyPosition) {
              nextNodes = nextNodes.map((node) => {
                if (node.id !== movedData.loopParentId) return node;
                const data = node.data as unknown as WorkflowNodeData;
                return {
                  ...node,
                  data: {
                    ...data,
                    config: { ...data.config, bodyPosition },
                  },
                };
              });
            }
          }
          updateAlignmentGuides(movedNodeChange.dragging ? alignment : null);
        }
      }
      const movedLoopBodyChild = changes.some((change) => {
        if (change.type !== 'position' || !change.position) return false;
        const changedNode = nextNodes.find((node) => node.id === change.id);
        const data = changedNode?.data as WorkflowNodeData | undefined;
        return Boolean(data?.loopParentId) && !data?.isLoopBody;
      });
      if (movedLoopBodyChild) {
        nextNodes = expandLoopCanvas(nextNodes, workflowStateRef.current.edges).nodes;
      }
      setNodes(nextNodes);
      const hasCommittedChange = changes.some(
        (change) =>
          change.type !== 'select' &&
          change.type !== 'dimensions' &&
          (change.type !== 'position' || change.dragging !== true),
      );
      if (hasCommittedChange) {
        markWorkflowDirty({ nodes: nextNodes });
      } else {
        workflowStateRef.current = { ...workflowStateRef.current, nodes: nextNodes };
      }
    },
    [markWorkflowDirty, updateAlignmentGuides],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isRunning) {
        const selectionChanges = changes.filter((change) => change.type === 'select');
        if (selectionChanges.length) applyWorkflowNodeChanges(selectionChanges);
        return;
      }
      const draggingChanges = changes.filter(
        (change) => change.type === 'position' && change.dragging === true,
      );
      const didStopDragging = changes.some(
        (change) => change.type === 'position' && change.dragging === false,
      );

      if (!draggingChanges.length) {
        if (didStopDragging && nodeDragFrameRef.current !== null) {
          window.cancelAnimationFrame(nodeDragFrameRef.current);
          nodeDragFrameRef.current = null;
          const pendingChanges = pendingNodeDragChangesRef.current;
          pendingNodeDragChangesRef.current = null;
          if (pendingChanges?.length) applyWorkflowNodeChanges(pendingChanges);
        }
        applyWorkflowNodeChanges(changes);
        return;
      }

      const immediateChanges = changes.filter(
        (change) => !(change.type === 'position' && change.dragging === true),
      );
      if (immediateChanges.length) applyWorkflowNodeChanges(immediateChanges);

      pendingNodeDragChangesRef.current = draggingChanges;
      if (nodeDragFrameRef.current !== null) return;

      nodeDragFrameRef.current = window.requestAnimationFrame(() => {
        nodeDragFrameRef.current = null;
        const pendingChanges = pendingNodeDragChangesRef.current;
        pendingNodeDragChangesRef.current = null;
        if (pendingChanges?.length) applyWorkflowNodeChanges(pendingChanges);
      });
    },
    [applyWorkflowNodeChanges, isRunning],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      isNodeDragInProgressRef.current = false;
      setIsNodeDragging(false);
      updateAlignmentGuides(null);
      const nodeData = node.data as {
        loopParentId?: string;
        isLoopBody?: boolean;
        label?: string;
        nodeType?: string;
        config?: Record<string, unknown>;
      };
      if (nodeData.loopParentId && !nodeData.isLoopBody) {
        const nextNodes = workflowStateRef.current.nodes.map((candidate) =>
          candidate.id === node.id ? { ...candidate, position: node.position } : candidate,
        );
        const expanded = expandLoopCanvas(nextNodes, workflowStateRef.current.edges);
        setNodes(expanded.nodes);
        setEdges(expanded.edges);
        markWorkflowDirty({ nodes: expanded.nodes, edges: expanded.edges });
        setSelectedNode({
          id: node.id,
          type: node.type || '',
          data: node.data as {
            label: string;
            nodeType: string;
            config?: Record<string, unknown>;
            when?: import('@/api/workflow').WorkflowRule;
          },
        });
        return;
      }
      if (!nodeData.loopParentId && !nodeData.isLoopBody) {
        const loopBody = workflowStateRef.current.nodes.find((candidate) => {
          const data = candidate.data as { isLoopBody?: boolean };
          if (!data.isLoopBody) return false;
          const width = Number(candidate.style?.width || 560);
          const height = Number(candidate.style?.height || 330);
          return (
            node.position.x >= candidate.position.x &&
            node.position.x <= candidate.position.x + width &&
            node.position.y >= candidate.position.y &&
            node.position.y <= candidate.position.y + height
          );
        });
        if (loopBody) {
          const bodyData = loopBody.data as { loopParentId?: string };
          const parentID = bodyData.loopParentId;
          const attachedEdges = workflowStateRef.current.edges.filter(
            (edge) => edge.source === node.id || edge.target === node.id,
          );
          if (!parentID || attachedEdges.length) {
            toast.warning('请先断开节点的外层连线，再拖入循环体');
          } else {
            const childID = loopBodyChildID(parentID, node.id);
            const nextNodeCount =
              workflowStateRef.current.nodes.filter((candidate) => {
                const data = candidate.data as { isLoopBody?: boolean; loopParentId?: string };
                return data.loopParentId === parentID && !data.isLoopBody;
              }).length + 1;
            const nextNodes = workflowStateRef.current.nodes.map((candidate) =>
              candidate.id === node.id
                ? {
                    ...candidate,
                    id: childID,
                    parentId: loopBody.id,
                    extent: 'parent' as const,
                    position: loopBodyChildPosition(nextNodeCount - 1, nextNodeCount),
                    data: { ...candidate.data, loopParentId: parentID, loopBodyNodeId: node.id },
                  }
                : candidate,
            );
            const expanded = expandLoopCanvas(nextNodes, workflowStateRef.current.edges);
            setNodes(expanded.nodes);
            setEdges(expanded.edges);
            markWorkflowDirty({ nodes: expanded.nodes, edges: expanded.edges });
            setSelectedNode(null);
            return;
          }
        }
      }
      const panelNode = workflowPanelNode(node, workflowStateRef.current.nodes);
      setSelectedNode({
        id: panelNode.id,
        type: panelNode.type || '',
        data: panelNode.data as {
          label: string;
          nodeType: string;
          config?: Record<string, unknown>;
          when?: import('@/api/workflow').WorkflowRule;
        },
      });
    },
    [markWorkflowDirty, updateAlignmentGuides],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isRunning && changes.some((change) => change.type !== 'select')) return;
      const nextEdges = applyEdgeChanges(changes, workflowStateRef.current.edges);
      setEdges(nextEdges);
      if (changes.some((change) => change.type !== 'select')) {
        markWorkflowDirty({ edges: nextEdges });
      } else {
        workflowStateRef.current = { ...workflowStateRef.current, edges: nextEdges };
      }
    },
    [isRunning, markWorkflowDirty],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isRunning) return;
      const { source, target } = connection;
      if (!source || !target) return;
      const sourceNode = workflowStateRef.current.nodes.find((node) => node.id === source);
      const targetNode = workflowStateRef.current.nodes.find((node) => node.id === target);
      const sourceParent = (sourceNode?.data as { loopParentId?: string } | undefined)
        ?.loopParentId;
      const targetParent = (targetNode?.data as { loopParentId?: string } | undefined)
        ?.loopParentId;
      if (sourceParent !== targetParent) {
        toast.warning('循环体内外不能直接连线，请通过循环输入或输出映射传递数据');
        return;
      }
      const sourceIsLoopBody = Boolean(
        (sourceNode?.data as { isLoopBody?: boolean } | undefined)?.isLoopBody,
      );
      const targetIsLoopBody = Boolean(
        (targetNode?.data as { isLoopBody?: boolean } | undefined)?.isLoopBody,
      );
      const isLoopBodyBoundary = sourceIsLoopBody || targetIsLoopBody;
      const nextEdges = addEdge(
        {
          ...connection,
          source,
          target,
          sourceHandle: connection.sourceHandle || 'output',
          ...(isLoopBodyBoundary
            ? {
                type: 'loopBoundary',
                data: { isLoopBodyBoundary: true },
                selectable: true,
                deletable: true,
              }
            : {}),
        },
        workflowStateRef.current.edges,
      );
      setEdges(nextEdges);
      markWorkflowDirty({ edges: nextEdges });
    },
    [isRunning, markWorkflowDirty],
  );

  const openOutputPicker = useCallback((nodeId: string) => {
    setOutputPickerNodeId(nodeId);
  }, []);

  const closeOutputPicker = useCallback((nodeId: string) => {
    setOutputPickerNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId));
  }, []);

  const onConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      if (isRunning) return;
      if (params.handleType !== 'source' || params.handleId !== 'output' || !params.nodeId) return;
      connectingOutputNodeIdRef.current = params.nodeId;
      setConnectingOutputNodeId(params.nodeId);
      setOutputPickerNodeId(null);
    },
    [isRunning],
  );

  const onConnectEnd = useCallback<OnConnectEnd>((_event, connectionState) => {
    const sourceNodeId = connectingOutputNodeIdRef.current;
    connectingOutputNodeIdRef.current = null;
    setConnectingOutputNodeId(null);
    if (sourceNodeId && !connectionState.isValid) {
      setOutputPickerNodeId(sourceNodeId);
    }
  }, []);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const panelNode = workflowPanelNode(node, workflowStateRef.current.nodes);
      setSelectedNode({
        id: panelNode.id,
        type: panelNode.type || '',
        data: panelNode.data as {
          label: string;
          nodeType: string;
          config?: Record<string, unknown>;
          when?: import('@/api/workflow').WorkflowRule;
        },
      });

      // A completed run remains inspectable from the 运行 tab, but subsequent
      // node selection returns the editor to the configuration workflow.
      setActivePropertyTab(isRunning ? 'run' : 'config');
    },
    [isRunning],
  );

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
        when?: import('@/api/workflow').WorkflowRule;
      },
    });
    setActivePropertyTab('run');
  }, [runSession.failedNodeId, runSession.generation]);

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (isRunning) {
        setContextMenu(null);
        return;
      }
      const nodeType = (node.data as { nodeType?: string }).nodeType || node.type || '';
      if (NODE_CONFIGS[nodeType]?.fixed) {
        setContextMenu(null);
        return;
      }
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [isRunning],
  );

  const onEdgeClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onViewportMoveStart = useCallback(() => {
    setIsViewportMoving(true);
  }, []);

  const onViewportMoveEnd = useCallback(() => {
    setIsViewportMoving(false);
  }, []);

  const handleDeleteNodes = useCallback(
    (nodeIDs: string[]) => {
      if (isRunning) return;
      const removedNodeIDs = new Set<string>();
      const collectLoopDescendants = (id: string) => {
        if (removedNodeIDs.has(id)) return;
        removedNodeIDs.add(id);
        removedNodeIDs.add(loopBodyID(id));
        for (const candidate of workflowStateRef.current.nodes) {
          const candidateData = candidate.data as { loopParentId?: string; nodeType?: string };
          if (candidateData.loopParentId !== id) continue;
          if (candidateData.nodeType === 'loop') collectLoopDescendants(candidate.id);
          else removedNodeIDs.add(candidate.id);
        }
      };

      for (const nodeID of nodeIDs) {
        const node = workflowStateRef.current.nodes.find((candidate) => candidate.id === nodeID);
        if (!node) continue;
        const nodeData = node.data as {
          nodeType?: string;
          loopParentId?: string;
          isLoopBody?: boolean;
        };
        if (nodeData.nodeType === 'start' || nodeData.nodeType === 'end') {
          toast.warning('开始/结束节点不可删除');
          continue;
        }
        const loopID = nodeData.isLoopBody ? nodeData.loopParentId : node.id;
        if (nodeData.nodeType === 'loop' || loopID !== node.id) {
          if (loopID) collectLoopDescendants(loopID);
        } else {
          removedNodeIDs.add(node.id);
        }
      }
      if (removedNodeIDs.size === 0) return;

      const nextNodes = workflowStateRef.current.nodes.filter(
        (candidate) => !removedNodeIDs.has(candidate.id),
      );
      const nextEdges = workflowStateRef.current.edges.filter(
        (edge) => !removedNodeIDs.has(edge.source) && !removedNodeIDs.has(edge.target),
      );
      const expanded = expandLoopCanvas(nextNodes, nextEdges);
      setNodes(expanded.nodes);
      setEdges(expanded.edges);
      markWorkflowDirty({ nodes: expanded.nodes, edges: expanded.edges });
      if (selectedNode && removedNodeIDs.has(selectedNode.id)) {
        setSelectedNode(null);
      }
    },
    [isRunning, markWorkflowDirty, selectedNode],
  );

  const handleDeleteNode = useCallback(
    (nodeID: string) => handleDeleteNodes([nodeID]),
    [handleDeleteNodes],
  );

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      if (isRunning) return;
      const node = workflowStateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const nodeType = (node.data as { nodeType?: string }).nodeType || node.type || '';
      if (NODE_CONFIGS[nodeType]?.fixed) return;
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
    [isRunning, markWorkflowDirty],
  );

  const handlePaste = useCallback(() => {
    if (isRunning) return;
    if (!clipboardRef.current || clipboardRef.current.length === 0) return;
    const stamp = Date.now();
    const copyableNodes = clipboardRef.current.filter((node) => {
      const nodeType = (node.data as { nodeType?: string }).nodeType || node.type || '';
      return !NODE_CONFIGS[nodeType]?.fixed;
    });
    if (copyableNodes.length === 0) return;
    const pasted = copyableNodes.map((n, i) => ({
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
  }, [isRunning, markWorkflowDirty]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement | null;
      const isEditingText =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isRunning) {
        if (
          event.key === 'Delete' ||
          (isMod && ['z', 'Z', 'y', 'Y', 'v', 'V'].includes(event.key))
        ) {
          event.preventDefault();
        }
        return;
      }

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
          clipboardRef.current = selected.filter((node) => {
            const nodeType = (node.data as { nodeType?: string }).nodeType || node.type || '';
            return !NODE_CONFIGS[nodeType]?.fixed;
          });
          event.preventDefault();
        } else if (selectedNode) {
          const node = nodes.find((n) => n.id === selectedNode.id);
          const nodeType =
            (node?.data as { nodeType?: string } | undefined)?.nodeType || node?.type || '';
          if (node && !NODE_CONFIGS[nodeType]?.fixed) {
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

      if (event.key !== 'Delete') return;
      if (isEditingText) return;

      const selectedNodes = workflowStateRef.current.nodes.filter((node) => node.selected);
      if (selectedNodes.length > 0) {
        event.preventDefault();
        handleDeleteNodes(selectedNodes.map((node) => node.id));
        return;
      }

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
    [
      selectedNode,
      handleDeleteNodes,
      handleDeleteNode,
      nodes,
      handleRedo,
      handleUndo,
      handlePaste,
      isRunning,
      markWorkflowDirty,
    ],
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
        const newWidth = Math.max(
          minimumRightPanelWidth,
          Math.min(maximumRightPanelWidth, startWidth + deltaX),
        );
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

  const handleRunPanelResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startHeight =
      runPanelRef.current?.getBoundingClientRect().height ??
      Math.min(360, Math.round(window.innerHeight * 0.48));
    const maxHeight = Math.max(
      minimumRunPanelHeight,
      Math.min(maximumRunPanelHeight, window.innerHeight - 64),
    );

    setIsRunPanelResizing(true);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextHeight = startHeight - (moveEvent.clientY - startY);
      setRunPanelHeight(Math.max(minimumRunPanelHeight, Math.min(maxHeight, nextHeight)));
    };
    const handleMouseUp = () => {
      setIsRunPanelResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const copilotDraftVersion = `${workflowId || 'new'}:${saveRevision}`;
  const copilotDraft = useMemo(() => {
    void copilotDraftVersion;
    const graph = JSON.parse(workflowSnapshotRef.current.graph) as {
      schemaVersion: 4;
      nodes: Array<{
        id: string;
        type: import('@/api/workflow').WorkflowNodeType;
        label: string;
        position: { x: number; y: number };
        config: Record<string, unknown>;
        when?: import('@/api/workflow').WorkflowRule;
      }>;
      edges: Array<{
        source: string;
        sourceHandle?: string;
        target: string;
        targetHandle?: string;
      }>;
    };
    return {
      name: workflowName,
      description: '',
      graph: {
        schemaVersion: graph.schemaVersion,
        nodes: graph.nodes,
        edges: graph.edges.map(({ source, sourceHandle, target, targetHandle }) => ({
          source,
          sourceHandle,
          target,
          targetHandle,
        })),
      },
    };
  }, [copilotDraftVersion, workflowName]);

  const applyCopilotProposal = useCallback(
    (proposal: CopilotProposal) => {
      if (proposal.targetType !== 'workflow' || !isAIWorkflowDraft(proposal.candidate)) {
        throw new Error('提案不是有效的工作流草稿');
      }
      const canvas = workflowDraftToCanvas(proposal.candidate);
      setWorkflowName(proposal.candidate.name);
      setNodes(canvas.nodes);
      setEdges(canvas.edges);
      setSelectedNode(null);
      requestFitView();
      markWorkflowDirty({
        name: proposal.candidate.name,
        nodes: canvas.nodes,
        edges: canvas.edges,
      });
    },
    [markWorkflowDirty, requestFitView],
  );

  const onUpdateNode = useCallback(
    (
      nodeId: string,
      updates: Partial<{
        label: string;
        config: Record<string, unknown>;
        when: import('@/api/workflow').WorkflowRule | undefined;
      }>,
    ) => {
      if (isRunning) return;
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
    [isRunning, markWorkflowDirty, selectedNode],
  );

  const handleSave = useCallback(async () => {
    setShowValidationErrors(false);
    setServerValidationErrors([]);
    const saved = await persistLatestWorkflow({
      force: true,
      createIfMissing: true,
      recordHistory: true,
    });
    if (saved) {
      toast.success('已保存', {
        className: '!border-emerald-200 !bg-emerald-50 !text-emerald-700 [&_svg]:!text-emerald-600',
      });
    }
  }, [persistLatestWorkflow]);

  const handlePublish = useCallback(async () => {
    const state = workflowStateRef.current;
    const errors = validateWorkflowDraft(state.nodes, state.edges);
    if (errors.length > 0) {
      setSaveStatus('pending');
      setShowValidationErrors(true);
      setPendingValidationFocusNodeID(errors[0].nodeId);
      notifyWorkflowValidation('发布', errors);
      return;
    }

    setShowValidationErrors(false);
    setServerValidationErrors([]);
    setIsPublishing(true);
    try {
      const saved = await persistLatestWorkflow({
        force: true,
        createIfMissing: true,
        recordHistory: true,
      });
      const id = workflowIdRef.current;
      if (!saved || !id) return;

      await publishWorkflowVersion(id);
      await refreshWorkflowMeta(id);
      toast.success('已发布当前版本');
    } catch (error) {
      const message = applyServerValidationError(getAPIErrorMessage(error, '发布失败'));
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  }, [applyServerValidationError, persistLatestWorkflow, refreshWorkflowMeta]);

  const handleRunConfirm = useCallback(
    async ({ inputs, files }: WorkflowRunInput) => {
      const id = workflowId;
      const sourceRun = retryRun;
      const session = editorSessionRef.current;
      if (!id || !isActiveWorkflowSession(session, id)) return;
      if (abortControllerRef.current) {
        toast.message('工作流正在运行，请等待当前运行结束。');
        return;
      }

      setIsRunning(true);
      setRunError(null);
      setShowValidationErrors(false);
      setServerValidationErrors([]);
      setPendingValidationFocusNodeID(null);
      const generation = runGenerationRef.current + 1;
      runGenerationRef.current = generation;
      dispatchRunSession({ type: 'begin', generation });

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      activeRunIDRef.current = null;
      const isActiveRun = () =>
        isActiveWorkflowSession(session, id) && runGenerationRef.current === generation;

      try {
        const handlers = {
          onEvent: (event: import('@/api/workflow').WorkflowRunEvent) => {
            if (!isActiveRun()) return;
            if (event.data?.runId) activeRunIDRef.current = event.data.runId;
            dispatchRunSession({ type: 'event', generation, event });
            if (event.status === 'done') {
              setIsRunning(false);
              toast.success('工作流执行完成');
            }
            if (event.status === 'cancelled') {
              setIsRunning(false);
              if (!event.data?.nodeType) toast.message('工作流已取消');
            }
          },
          onError: (msg: string) => {
            if (!isActiveRun()) return;
            if (msg === '运行已取消') {
              dispatchRunSession({ type: 'cancelled', generation });
              setIsRunning(false);
              return;
            }
            const errorMessage = applyServerValidationError(msg);
            setRunError(errorMessage);
            dispatchRunSession({ type: 'error', generation, error: errorMessage });
            toast.error(errorMessage);
            setIsRunning(false);
          },
        };
        if (sourceRun) {
          await retryWorkflowRun(id, sourceRun.run.id, { inputs, files }, handlers, {
            confirmedSideEffects: sourceRun.retry?.requiresConfirmation === true,
            signal: abortController.signal,
          });
        } else {
          await runWorkflow(id, { inputs, files }, handlers, abortController.signal);
        }
      } catch {
        if (!isActiveRun()) return;
        setRunError('运行请求失败');
        dispatchRunSession({ type: 'error', generation, error: '运行请求失败' });
      } finally {
        if (isActiveRun()) {
          if (abortControllerRef.current === abortController) abortControllerRef.current = null;
          if (isActiveRun()) activeRunIDRef.current = null;
          setIsRunning(false);
          setRetryRun(null);
        }
      }
    },
    [applyServerValidationError, isActiveWorkflowSession, retryRun, workflowId],
  );

  const focusValidationNode = useCallback((nodeID: string) => {
    const node = workflowStateRef.current.nodes.find((item) => item.id === nodeID);
    if (!node) return;

    setNodes((prev) => prev.map((item) => ({ ...item, selected: item.id === nodeID })));
    setSelectedNode({
      id: node.id,
      type: node.type || '',
      data: node.data as {
        label: string;
        nodeType: string;
        config?: Record<string, unknown>;
        when?: import('@/api/workflow').WorkflowRule;
      },
    });
    setActiveWorkspaceTab('node');
    setActivePropertyTab('config');
  }, []);

  useEffect(() => {
    if (!pendingValidationFocusNodeID) return;
    focusValidationNode(pendingValidationFocusNodeID);
    setPendingValidationFocusNodeID(null);
  }, [focusValidationNode, pendingValidationFocusNodeID]);

  const handleRun = useCallback(async () => {
    const state = workflowStateRef.current;
    if (state.nodes.length === 0) {
      toast.warning('请先添加节点');
      return;
    }

    const errors = validateWorkflowDraft(state.nodes, state.edges);
    if (errors.length > 0) {
      setShowValidationErrors(true);
      const firstError = errors[0];
      notifyWorkflowValidation('运行', errors);
      setPendingValidationFocusNodeID(firstError.nodeId);
      return;
    }

    setShowValidationErrors(false);
    setServerValidationErrors([]);
    setPendingValidationFocusNodeID(null);

    if (!(await persistLatestWorkflow({ createIfMissing: true }))) {
      return;
    }

    setRetryRun(null);
    setShowRunPanel(true);
  }, [persistLatestWorkflow]);

  const openRetryRunPanel = useCallback((run: WorkflowRunDetail) => {
    if (!retryInputNodes(run.run.graphSnapshot)) {
      toast.error('历史工作流无法读取，不能重新运行');
      return;
    }
    setRetryRun(run);
    setShowHistory(false);
    setShowRunPanel(true);
  }, []);

  const handleRetryFromHistory = useCallback(
    (run: WorkflowRunDetail) => {
      if (run.retry?.requiresConfirmation) {
        setPendingRetryRun(run);
        return;
      }
      openRetryRunPanel(run);
    },
    [openRetryRunPanel],
  );

  const handleRunPanelOpenChange = useCallback(
    (open: boolean) => {
      setShowRunPanel(open);
      if (!open && !isRunning) setRetryRun(null);
    },
    [isRunning],
  );

  const handleCancelRun = useCallback(async () => {
    const id = workflowId;
    const runID = activeRunIDRef.current;
    if (!id || !runID) {
      return;
    }
    try {
      await cancelWorkflowRun(id, runID);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '取消运行失败'));
    }
  }, [workflowId]);

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
    const nextNodes = [
      {
        id: 'start',
        type: 'start',
        position: { x: 220, y: 250 },
        data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 620, y: 250 },
        data: { label: '结束', nodeType: 'end', config: { outputs: {} } },
      },
    ] as Node[];
    const nextEdges = normalizeWorkflowEdges([
      { id: 'start-end', source: 'start', target: 'end', type: 'insertable' },
    ] as Edge[]);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNode(null);
    markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
    toast.info('已清空为基础工作流');
  }, [markWorkflowDirty]);

  const handleReset = useCallback(() => {
    const nextNodes = [
      {
        id: 'start',
        type: 'start',
        position: { x: 220, y: 250 },
        data: { label: '开始', nodeType: 'start', config: { inputs: {} } },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 620, y: 250 },
        data: { label: '结束', nodeType: 'end', config: { outputs: {} } },
      },
    ] as Node[];
    const nextEdges = normalizeWorkflowEdges([
      { id: 'start-end', source: 'start', target: 'end', type: 'insertable' },
    ] as Edge[]);
    setNodes(nextNodes);
    setEdges(nextEdges);
    markWorkflowDirty({ nodes: nextNodes, edges: nextEdges });
    setSelectedNode(null);
    toast.info('工作流已重置');
  }, [markWorkflowDirty]);

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const source = runSession.nodes[edge.source]?.status;
        const target = runSession.nodes[edge.target]?.status;
        if (!didRunTraverseEdge(edge, workflowStateRef.current.nodes, runSession)) {
          return edge;
        }
        if (source === 'error' || target === 'error') {
          return {
            ...edge,
            animated: false,
            style: runtimeEdgeStyle(edge, 'hsl(var(--destructive))'),
          };
        }
        if (source === 'running' || target === 'running') {
          return {
            ...edge,
            animated: true,
            style: runtimeEdgeStyle(edge, 'hsl(var(--primary))'),
          };
        }
        if (source === 'success' && target === 'success') {
          return { ...edge, animated: false, style: runtimeEdgeStyle(edge, '#16a34a') };
        }
        return edge;
      }),
    [edges, runSession],
  );

  const renderedNodes = useMemo<Node[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        zIndex: workflowCanvasNodeZIndex(node, selectedNode?.id, runSession),
      })),
    [nodes, runSession, selectedNode?.id],
  );

  const visibleValidationErrors = useMemo(() => {
    const invalidReferenceErrors = getInvalidWorkflowVariableReferenceErrors(
      validationGraph.nodes,
      validationGraph.edges,
    );
    if (!showValidationErrors) return [...invalidReferenceErrors, ...serverValidationErrors];

    return [
      ...validateWorkflowDraft(validationGraph.nodes, validationGraph.edges).filter(
        (error) => error.nodeId !== 'workflow',
      ),
      ...invalidReferenceErrors,
      ...serverValidationErrors,
    ];
  }, [serverValidationErrors, showValidationErrors, validationGraph]);

  const nodeValidationMessages = useMemo(() => {
    const messages = new Map<string, string>();
    for (const error of visibleValidationErrors) {
      messages.set(
        error.nodeId,
        messages.has(error.nodeId)
          ? `${messages.get(error.nodeId)}；${error.message}`
          : error.message,
      );
    }
    return messages;
  }, [visibleValidationErrors]);

  const runtimeValue = useMemo(
    () => ({
      session: runSession,
      isRunning,
      validationErrors: nodeValidationMessages,
      copyNode: handleCopyNode,
      deleteNode: handleDeleteNode,
      insertAfter: handleInsertAfter,
      insertOnEdge: handleInsertOnEdge,
      addLoopBodyNode: handleAddLoopBodyNode,
      outputPickerNodeId,
      connectingOutputNodeId,
      openOutputPicker,
      closeOutputPicker,
    }),
    [
      handleCopyNode,
      handleDeleteNode,
      handleInsertAfter,
      handleInsertOnEdge,
      handleAddLoopBodyNode,
      outputPickerNodeId,
      connectingOutputNodeId,
      openOutputPicker,
      closeOutputPicker,
      runSession,
      isRunning,
      nodeValidationMessages,
    ],
  );

  const saveStatusText = formatAutoSavedAt(lastAutoSavedAt);
  const isCanvasInteracting = isViewportMoving || isNodeDragging;

  useEffect(() => {
    if (isRunning) setActivePropertyTab('run');
  }, [isRunning]);

  const copilotNodeLabels = useMemo(
    () =>
      Object.fromEntries(
        validationGraph.nodes.map((node) => [
          node.id,
          (node.data as { label?: string }).label || node.id,
        ]),
      ),
    [validationGraph.nodes],
  );

  const copilotContext = useMemo(
    () => ({
      scope: 'workflow' as const,
      targetId: workflowId || undefined,
      draft: copilotDraft,
      selectedNodeId: selectedNode?.id,
      nodeLabels: copilotNodeLabels,
      runId: runSession.runId || undefined,
    }),
    [copilotDraft, copilotNodeLabels, runSession.runId, selectedNode?.id, workflowId],
  );

  const copilotSuggestions = useMemo(
    () => [
      selectedNode ? '把这一步改得更适合初学者' : '根据当前草稿补全工作流',
      runSession.failedNodeId ? '根据最近失败生成修复提案' : '检查节点配置和风险',
    ],
    [runSession.failedNodeId, selectedNode],
  );

  const copilot = useMemo(
    () => (
      <WorkbenchCopilot
        context={copilotContext}
        suggestions={copilotSuggestions}
        onApplyProposal={applyCopilotProposal}
      />
    ),
    [applyCopilotProposal, copilotContext, copilotSuggestions],
  );

  const propertyPanel = useMemo(
    () => (
      <PropertyPanel
        selectedNode={selectedNode}
        onClose={onPaneClick}
        onUpdateNode={onUpdateNode}
        nodes={validationGraph.nodes}
        edges={validationGraph.edges}
        runSnapshot={selectedNode ? runSession.nodes[selectedNode.id] : undefined}
        validationErrors={visibleValidationErrors}
        activeTab={activePropertyTab}
        onActiveTabChange={setActivePropertyTab}
        isRunning={isRunning}
      />
    ),
    [
      activePropertyTab,
      isRunning,
      onPaneClick,
      onUpdateNode,
      runSession.nodes,
      selectedNode,
      validationGraph.edges,
      validationGraph.nodes,
      visibleValidationErrors,
    ],
  );

  const workspacePanel = useMemo(
    () => (
      <WorkflowWorkspacePanel
        activeTab={activeWorkspaceTab}
        onActiveTabChange={setActiveWorkspaceTab}
        copilotContent={copilot}
        nodeContent={propertyPanel}
      />
    ),
    [activeWorkspaceTab, copilot, propertyPanel],
  );

  return (
    <WorkflowRuntimeProvider value={runtimeValue}>
      <ReactFlowProvider>
        <div className="h-screen flex flex-col bg-background">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 shadow-xs">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/workbench/workflows')}>
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
                  <HoverCard>
                    <HoverCardTrigger
                      delay={350}
                      closeDelay={100}
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="max-w-56 px-1 font-medium"
                          onClick={() => setIsEditingName(true)}
                        />
                      }
                    >
                      <span className="truncate">{workflowName}</span>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start" className="w-80 p-3">
                      <p className="line-clamp-4 text-sm leading-6 text-foreground">
                        {workflowDescription.trim() ||
                          `${nodes.length} 个节点 · ${edges.length} 条连接`}
                      </p>
                    </HoverCardContent>
                  </HoverCard>
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
                disabled={saveStatus === 'creating' || saveStatus === 'saving' || isPublishing}
              >
                <Save className="h-4 w-4 mr-2" />
                立即保存
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handlePublish()}
                disabled={
                  isPublishing ||
                  saveStatus === 'creating' ||
                  saveStatus === 'saving' ||
                  (Boolean(workflowId) &&
                    platform?.app.publishedVersionId === platform?.app.draftVersionId)
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                {platform?.app.publishedVersionId === platform?.app.draftVersionId
                  ? '已发布'
                  : '发布'}
              </Button>
              {workflowId && (
                <Button variant="outline" size="sm" onClick={() => void openHistory()}>
                  <History className="mr-2 h-4 w-4" />
                  历史
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
              <Button
                size="sm"
                onClick={() => void handleRun()}
                disabled={isRunning || saveStatus === 'creating'}
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

          <AlertDialog
            open={Boolean(pendingRetryRun)}
            onOpenChange={(open) => {
              if (!open) setPendingRetryRun(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认重新运行？</AlertDialogTitle>
                <AlertDialogDescription>
                  此工作流包含 AI
                  存储或写入操作。重新运行可能再次生成文件或创建内容草稿；历史文本和文件不会被自动复用。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingRetryRun) openRetryRunPanel(pendingRetryRun);
                    setPendingRetryRun(null);
                  }}
                >
                  继续重新运行
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet open={showHistory} onOpenChange={setShowHistory}>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
              <SheetHeader className="border-b pr-14">
                <SheetTitle>历史</SheetTitle>
                <SheetDescription>草稿版本与最近运行</SheetDescription>
              </SheetHeader>

              <ScrollArea className="min-h-0 flex-1">
                <div className="p-4">
                  <section className="mb-6">
                    <h3 className="mb-3 text-sm font-medium text-foreground">最近运行</h3>
                    <WorkflowRunHistory
                      workflowId={workflowId}
                      open={showHistory}
                      onRetry={handleRetryFromHistory}
                    />
                  </section>
                  <section className="mb-6 border-t border-border pt-5">
                    <WorkflowTestCases
                      workflowId={workflowId}
                      versions={platform?.versions || []}
                      open={showHistory}
                    />
                  </section>
                  <section className="border-t border-border pt-5">
                    <h3 className="mb-3 text-sm font-medium text-foreground">草稿与发布版本</h3>
                    {loadingHistory && !platform ? (
                      <div className="space-y-3">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : platform?.versions.length ? (
                      <ol className="relative ml-2 border-l border-border">
                        {platform.versions.map((version) => {
                          const isCurrent = version.id === platform.app.draftVersionId;
                          const isPublished = version.id === platform.app.publishedVersionId;
                          return (
                            <li key={version.id} className="relative pb-4 pl-6 last:pb-0">
                              <span
                                className={`absolute -left-[5px] top-4 size-2.5 rounded-full border-2 border-background ${
                                  isCurrent ? 'bg-primary' : 'bg-muted-foreground/40'
                                }`}
                                aria-hidden="true"
                              />
                              <article
                                aria-current={isCurrent ? 'true' : undefined}
                                className={`rounded-lg border p-3 transition-colors ${
                                  isCurrent
                                    ? 'border-primary/25 bg-primary/5'
                                    : 'border-transparent hover:bg-muted/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium text-foreground">
                                        v{version.number}
                                      </span>
                                      {isCurrent ? (
                                        <Badge variant="secondary">当前草稿</Badge>
                                      ) : null}
                                      {isPublished ? <Badge variant="outline">已发布</Badge> : null}
                                    </div>
                                    <time
                                      className="mt-2 block text-xs text-muted-foreground"
                                      dateTime={version.createdAt}
                                    >
                                      {new Date(version.createdAt).toLocaleString('zh-CN')}
                                    </time>
                                  </div>
                                  {!isCurrent ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={async () => {
                                        if (!workflowId) return;
                                        try {
                                          await restoreWorkflowVersion(workflowId, version.id);
                                          setShowHistory(false);
                                          toast.success(`已恢复 v${version.number}`);
                                          navigate(
                                            `/workbench/edit?id=${workflowId}&restored=${Date.now()}`,
                                            { replace: true },
                                          );
                                        } catch (error) {
                                          toast.error(getAPIErrorMessage(error, '恢复版本失败'));
                                        }
                                      }}
                                    >
                                      恢复
                                    </Button>
                                  ) : null}
                                </div>
                              </article>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        暂无历史版本
                      </p>
                    )}
                  </section>
                </div>
              </ScrollArea>

              <SheetFooter className="border-t">
                <Button
                  className="w-full"
                  disabled={
                    !workflowId ||
                    isPublishing ||
                    platform?.app.publishedVersionId === platform?.app.draftVersionId
                  }
                  onClick={() => void handlePublish()}
                >
                  发布当前版本
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 overflow-hidden">
            <div ref={reactFlowWrapper} className="relative flex-1 bg-muted/20">
              <ReactFlow
                className={
                  isCanvasInteracting ? 'workflow-canvas is-interacting' : 'workflow-canvas'
                }
                nodes={renderedNodes}
                edges={renderedEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeClick={onNodeClick}
                onNodeContextMenu={onNodeContextMenu}
                onNodeDragStop={onNodeDragStop}
                onEdgeClick={onEdgeClick}
                onPaneClick={onPaneClick}
                onPaneContextMenu={onPaneContextMenu}
                onMoveStart={onViewportMoveStart}
                onMoveEnd={onViewportMoveEnd}
                nodesDraggable={!isRunning}
                edgesReconnectable={!isRunning}
                nodeTypes={workflowNodeTypes}
                edgeTypes={workflowEdgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                deleteKeyCode={null}
                minZoom={0.2}
                maxZoom={2}
                connectionLineType={ConnectionLineType.Bezier}
                connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
                connectionLineComponent={WorkflowConnectionLine}
                onlyRenderVisibleElements
                onInit={(instance) => {
                  reactFlowInstance.current = instance;
                  setCanvasInitialized(true);
                }}
              >
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                <WorkflowAlignmentGuides alignment={alignmentGuides} />
                <Controls />
                {isCanvasInteracting ? null : <MiniMap />}
              </ReactFlow>
              {!showRunPanel ? (
                <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                  <NodePicker
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl bg-background shadow-md"
                        disabled={isRunning}
                      >
                        <Plus className="mr-2 size-4" />
                        添加节点
                      </Button>
                    }
                    onSelect={handleAddNode}
                  />
                </div>
              ) : null}
              {showRunPanel ? (
                <div
                  ref={runPanelRef}
                  style={runPanelHeight ? { height: `${runPanelHeight}px` } : undefined}
                  className={`absolute inset-x-4 bottom-4 z-30 overflow-hidden rounded-lg border border-border bg-card shadow-lg ${
                    isRunPanelResizing
                      ? 'transition-none'
                      : 'transition-[height] duration-200 motion-reduce:transition-none'
                  } ${runPanelHeight ? '' : 'h-[min(360px,48vh)]'}`}
                >
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="调整试运行面板高度"
                    className="group absolute inset-x-0 top-0 z-10 h-3 cursor-row-resize touch-none hover:bg-primary/10"
                    onMouseDown={handleRunPanelResizeStart}
                  >
                    <span className="absolute left-1/2 top-1 h-0.5 w-10 -translate-x-1/2 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
                  </div>
                  <RunPanel
                    open={showRunPanel}
                    onOpenChange={handleRunPanelOpenChange}
                    nodes={retryRun ? retryInputNodes(retryRun.run.graphSnapshot) || nodes : nodes}
                    onRun={handleRunConfirm}
                    onCancel={handleCancelRun}
                    isRunning={isRunning}
                    session={runSession}
                    runError={runError}
                    retrying={Boolean(retryRun)}
                  />
                </div>
              ) : null}
            </div>

            {!isMobile ? (
              <div className="flex">
                <div
                  className="flex w-1 cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-primary/30"
                  onMouseDown={handleMouseDown}
                >
                  <div className="h-8 w-0.5 rounded bg-muted-foreground/40" />
                </div>
                <div style={{ width: `${rightPanelWidth}px` }} className="flex-shrink-0">
                  {workspacePanel}
                </div>
              </div>
            ) : null}
          </div>
          {isMobile ? (
            <MobileCopilotSheet
              open={showMobileWorkspace}
              onOpenChange={setShowMobileWorkspace}
              triggerLabel="工作区"
              title="工作流工作区"
            >
              {workspacePanel}
            </MobileCopilotSheet>
          ) : null}
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
