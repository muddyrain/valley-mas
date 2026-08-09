/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowRunInputFields } from './WorkflowRunInputFields';

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('WorkflowRunInputFields', () => {
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

  it('renders typed fields and maps text, number, and comma-list edits to runtime values', () => {
    const onValueChange = vi.fn();
    act(() => {
      root.render(
        <WorkflowRunInputFields
          definitions={{
            topic: { type: 'string', required: true, control: 'default' },
            count: { type: 'number', required: false, control: 'default' },
            keywords: { type: 'string[]', required: false, control: 'default' },
          }}
          values={{}}
          files={{}}
          tags={[]}
          groups={[]}
          loadingOptions={false}
          onValueChange={onValueChange}
          onFileChange={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('写作主题');
    expect(container.textContent).toContain('必填');
    const topic = container.querySelector<HTMLInputElement>('#workflow-input-topic');
    const count = container.querySelector<HTMLInputElement>('#workflow-input-count');
    const keywords = container.querySelector<HTMLInputElement>('#workflow-input-keywords');
    act(() => {
      if (topic) setInputValue(topic, 'AI 工作流');
      if (count) setInputValue(count, '3');
      if (keywords) setInputValue(keywords, 'AI, workflow,  测试 ');
    });

    expect(onValueChange.mock.calls).toEqual([
      ['topic', 'AI 工作流'],
      ['count', 3],
      ['keywords', ['AI', 'workflow', '测试']],
    ]);
  });

  it('accepts and removes a Markdown file through the file input contract', () => {
    const onFileChange = vi.fn();
    const file = new File(['# post'], 'post.md', { type: 'text/markdown' });
    const render = (files: Record<string, File>) => {
      act(() => {
        root.render(
          <WorkflowRunInputFields
            definitions={{
              markdownFile: {
                type: 'file',
                required: true,
                control: 'markdown_file',
              },
            }}
            values={{}}
            files={files}
            tags={[]}
            groups={[]}
            loadingOptions={false}
            onValueChange={vi.fn()}
            onFileChange={onFileChange}
          />,
        );
      });
    };

    render({});
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    act(() => input?.dispatchEvent(new Event('change', { bubbles: true })));
    expect(onFileChange).toHaveBeenCalledWith('markdownFile', file);

    render({ markdownFile: file });
    expect(container.textContent).toContain('post.md');
    act(() =>
      container.querySelector<HTMLButtonElement>('[aria-label="移除Markdown 文件"]')?.click(),
    );
    expect(onFileChange).toHaveBeenLastCalledWith('markdownFile', undefined);
  });
});
