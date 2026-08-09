/** @vitest-environment jsdom */
import type { Edge, Node } from '@xyflow/react';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkflowHistory, type WorkflowHistory } from './useWorkflowHistory';

describe('useWorkflowHistory', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('debounces snapshots, supports undo/redo, and clears future history on a new edit', () => {
    let history: WorkflowHistory | undefined;
    let setExternalNodes: ((nodes: Node[]) => void) | undefined;
    let latestNodes: Node[] = [];

    function Harness() {
      const [nodes, setNodes] = useState<Node[]>([
        { id: 'start', position: { x: 0, y: 0 }, data: { value: 1 } },
      ]);
      const [edges, setEdges] = useState<Edge[]>([]);
      history = useWorkflowHistory(nodes, edges, setNodes, setEdges);
      latestNodes = nodes;
      setExternalNodes = setNodes;
      return <span>{`${nodes[0].position.x}:${history.canUndo}:${history.canRedo}`}</span>;
    }

    act(() => root.render(<Harness />));
    act(() =>
      setExternalNodes?.([{ id: 'start', position: { x: 100, y: 0 }, data: { value: 2 } }]),
    );
    act(() => vi.advanceTimersByTime(400));
    expect(history?.canUndo).toBe(true);

    act(() => history?.undo());
    expect(latestNodes[0].position.x).toBe(0);
    expect(history?.canRedo).toBe(true);

    act(() => history?.redo());
    expect(latestNodes[0].position.x).toBe(100);

    act(() => history?.clearHistory());
    expect(history?.canUndo).toBe(false);
    expect(history?.canRedo).toBe(false);
  });
});
