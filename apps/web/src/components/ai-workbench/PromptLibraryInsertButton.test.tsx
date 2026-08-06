/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { PromptLibraryInsertButton } from './PromptLibraryInsertButton';

let capturedDialogProps: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel?: string;
} | null = null;

vi.mock('./PromptLibraryDialog', () => ({
  PromptLibraryDialog: ({ open, onOpenChange, targetLabel }: any) => {
    capturedDialogProps = { open, onOpenChange, targetLabel };
    return <div data-open={String(open)} data-target-label={targetLabel || ''} />;
  },
}));

describe('PromptLibraryInsertButton', () => {
  it('renders default text button and keeps dialog closed initially', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<PromptLibraryInsertButton onInsert={vi.fn()} />);
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain('提示词库');

    expect(capturedDialogProps).not.toBeNull();
    expect(capturedDialogProps?.open).toBe(false);
    expect(capturedDialogProps?.targetLabel).toBe('提示词');
  });

  it('opens dialog after clicking button and uses icon-only mode text', () => {
    const onInsert = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PromptLibraryInsertButton onInsert={onInsert} targetLabel="生图提示词" showText={false} />,
      );
    });

    const button = container.querySelector('button');
    expect(button?.getAttribute('type')).toBe('button');

    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(capturedDialogProps?.open).toBe(true);
    expect(capturedDialogProps?.targetLabel).toBe('生图提示词');

    act(() => {
      capturedDialogProps?.onOpenChange(false);
    });

    expect(capturedDialogProps?.open).toBe(false);
    expect(button?.textContent).toContain('提示词库');

    root.unmount();
    container.remove();
  });
});
