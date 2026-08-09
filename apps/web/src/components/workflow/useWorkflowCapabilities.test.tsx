/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listWorkflowCapabilitiesMock } = vi.hoisted(() => ({
  listWorkflowCapabilitiesMock: vi.fn(),
}));

vi.mock('@/api/workflow', () => ({
  listWorkflowCapabilities: listWorkflowCapabilitiesMock,
}));

import { useWorkflowCapabilities } from './useWorkflowCapabilities';

function Harness({ enabled = true }: { enabled?: boolean }) {
  const state = useWorkflowCapabilities(enabled);
  return (
    <span>{`${state.loading}:${state.error || 'ok'}:${state.nodeTypes.length}:${state.toolCapabilities.length}`}</span>
  );
}

describe('useWorkflowCapabilities', () => {
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

  it('deduplicates concurrent loads and reuses the resolved capability cache', async () => {
    let resolveLoad: ((value: unknown) => void) | undefined;
    listWorkflowCapabilitiesMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    act(() => {
      root.render(
        <>
          <Harness />
          <Harness />
        </>,
      );
    });
    expect(listWorkflowCapabilitiesMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe('true:ok:0:0true:ok:0:0');

    await act(async () => {
      resolveLoad?.({
        nodeTypes: [{ type: 'start' }],
        toolCapabilities: [{ id: 'tool.demo' }],
      });
      await Promise.resolve();
    });
    expect(container.textContent).toBe('false:ok:1:1false:ok:1:1');

    act(() => root.render(<Harness />));
    expect(container.textContent).toBe('false:ok:1:1');
    expect(listWorkflowCapabilitiesMock).toHaveBeenCalledTimes(1);
  });
});
