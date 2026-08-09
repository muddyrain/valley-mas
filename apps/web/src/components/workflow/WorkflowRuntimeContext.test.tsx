/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowRunSession } from './runSession';
import { useWorkflowRuntime, WorkflowRuntimeProvider } from './WorkflowRuntimeContext';

function Consumer() {
  const runtime = useWorkflowRuntime();
  return (
    <button type="button" onClick={() => runtime.cancelNode('writer')}>
      {runtime.session.status}
    </button>
  );
}

describe('WorkflowRuntimeContext', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('provides runtime state and commands to workflow descendants', () => {
    const cancelNode = vi.fn();
    const noOp = vi.fn();
    act(() => {
      root.render(
        <WorkflowRuntimeProvider
          value={{
            session: { ...createWorkflowRunSession(), status: 'running' },
            isRunning: true,
            isResuming: false,
            cancelNode,
            resumeFailedRun: noOp,
            validationErrors: new Map(),
            copyNode: noOp,
            deleteNode: noOp,
            insertAfter: noOp,
            insertOnEdge: noOp,
            addLoopBodyNode: noOp,
            outputPickerNodeId: null,
            connectingOutputNodeId: null,
            openOutputPicker: noOp,
            closeOutputPicker: noOp,
          }}
        >
          <Consumer />
        </WorkflowRuntimeProvider>,
      );
    });

    expect(container.textContent).toBe('running');
    act(() => container.querySelector('button')?.click());
    expect(cancelNode).toHaveBeenCalledWith('writer');
  });

  it('fails fast when a workflow node is rendered outside its provider', () => {
    expect(() => {
      act(() => root.render(<Consumer />));
    }).toThrow('WorkflowRuntimeProvider is required for workflow nodes');
  });
});
