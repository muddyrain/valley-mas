import type { Edge, Node } from '@xyflow/react';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from 'react';

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 400;

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

function snapshot(nodes: Node[], edges: Edge[]): Snapshot {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      id: node.id,
      type: node.type,
      position: { ...node.position },
      data: { ...node.data },
      style: node.style ? { ...node.style } : undefined,
    })),
    edges: edges.map((edge) => ({
      ...edge,
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
      data: edge.data ? { ...edge.data } : undefined,
    })),
  };
}

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface WorkflowHistory {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

export function useWorkflowHistory(
  nodes: Node[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<Node[]>>,
  setEdges: Dispatch<SetStateAction<Edge[]>>,
): WorkflowHistory {
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const isApplyingRef = useRef(false);
  const skipNextRef = useRef(false);
  const initializedRef = useRef(false);
  const lastCommittedRef = useRef<Snapshot>({ nodes: [], edges: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (isApplyingRef.current) {
      isApplyingRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastCommittedRef.current = snapshot(nodes, edges);
      return;
    }

    if (skipNextRef.current) {
      skipNextRef.current = false;
      lastCommittedRef.current = snapshot(nodes, edges);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = snapshot(nodes, edges);
      if (sameSnapshot(current, lastCommittedRef.current)) return;

      pastRef.current.push(lastCommittedRef.current);
      if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
      lastCommittedRef.current = current;
      futureRef.current = [];
      forceUpdate();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(snapshot(nodes, edges));
    isApplyingRef.current = true;
    setNodes(previous.nodes);
    setEdges(previous.edges);
    lastCommittedRef.current = previous;
    forceUpdate();
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(snapshot(nodes, edges));
    isApplyingRef.current = true;
    setNodes(next.nodes);
    setEdges(next.edges);
    lastCommittedRef.current = next;
    forceUpdate();
  }, [nodes, edges, setNodes, setEdges]);

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    skipNextRef.current = true;
    forceUpdate();
  }, []);

  return {
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    clearHistory,
  };
}
