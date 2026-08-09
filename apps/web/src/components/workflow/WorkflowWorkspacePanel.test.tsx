/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowWorkspacePanel } from './WorkflowWorkspacePanel';

describe('WorkflowWorkspacePanel', () => {
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

  it('renders both stable workspaces, announces unread AI state, and requests tab changes', () => {
    const onActiveTabChange = vi.fn();
    act(() => {
      root.render(
        <WorkflowWorkspacePanel
          activeTab="node"
          onActiveTabChange={onActiveTabChange}
          nodeContent={<div>节点详情内容</div>}
          copilotContent={<div>协作对话内容</div>}
          aiUnread
        />,
      );
    });

    expect(container.textContent).toContain('节点详情内容');
    expect(container.textContent).toContain('协作对话内容');
    expect(container.textContent).toContain('有新的 AI 协作状态');

    const aiTab = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('AI 协作'),
    );
    act(() => aiTab?.click());
    expect(onActiveTabChange).toHaveBeenCalledWith('ai');
  });
});
