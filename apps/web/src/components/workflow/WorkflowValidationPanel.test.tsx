/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowValidationPanel } from './WorkflowValidationPanel';

describe('WorkflowValidationPanel', () => {
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

  it('renders the error count, focuses node errors, and disables workflow-level errors', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <WorkflowValidationPanel
          errors={[
            {
              nodeId: 'writer',
              nodeLabel: '生成正文',
              nodeType: 'llm',
              message: '请填写用户提示词',
            },
            {
              nodeId: 'workflow',
              nodeLabel: '工作流',
              nodeType: 'workflow',
              message: '必须且只能有一个结束节点',
            },
          ]}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );
    });

    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('错误列表');
    expect(container.textContent).toContain('2');
    const errorButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      (button) =>
        button.textContent?.includes('请填写') || button.textContent?.includes('必须且只能'),
    );
    act(() => errorButtons[0].click());
    expect(onSelect).toHaveBeenCalledWith('writer');
    expect(errorButtons[1].disabled).toBe(true);

    act(() => container.querySelector<HTMLButtonElement>('[aria-label="关闭错误列表"]')?.click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
