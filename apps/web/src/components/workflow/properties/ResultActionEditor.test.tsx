/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeWorkflowResultActions, ResultActionEditor } from './ResultActionEditor';

describe('normalizeWorkflowResultActions', () => {
  it('keeps usable persisted actions and synthesizes missing IDs', () => {
    expect(
      normalizeWorkflowResultActions([
        { id: 'edit', label: '编辑', output: 'editPath' },
        { label: '', output: 'downloadUrl' },
        { label: '', output: '' },
        null,
      ]),
    ).toEqual([
      { id: 'edit', label: '编辑', output: 'editPath' },
      { id: 'action-2', label: '', output: 'downloadUrl' },
    ]);
    expect(normalizeWorkflowResultActions({})).toEqual([]);
  });
});

describe('ResultActionEditor', () => {
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

  it('adds a default action and removes an existing action through public controls', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const onChange = vi.fn();
    act(() => {
      root.render(
        <ResultActionEditor
          actions={[{ id: 'edit', label: '编辑草稿', output: 'editPath' }]}
          outputNames={['editPath', 'downloadUrl']}
          onChange={onChange}
        />,
      );
    });

    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('添加结果动作'),
    );
    act(() => addButton?.click());
    expect(onChange).toHaveBeenCalledWith([
      { id: 'edit', label: '编辑草稿', output: 'editPath' },
      { id: 'action-123', label: '打开结果', output: 'editPath' },
    ]);

    const removeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="删除结果动作 编辑草稿"]',
    );
    act(() => removeButton?.click());
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('disables adding when no output can supply a navigation target', () => {
    act(() => {
      root.render(<ResultActionEditor actions={[]} outputNames={[]} onChange={vi.fn()} />);
    });
    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('添加结果动作'),
    );
    expect(addButton?.disabled).toBe(true);
  });
});
