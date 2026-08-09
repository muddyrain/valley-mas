/** @vitest-environment jsdom */

import type { ButtonHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AICoverAssistantDialog,
  type AICoverAssistantPayload,
  BLOG_COVER_AI_ASPECT_RATIO,
  BLOG_COVER_AI_QUALITY,
} from './AICoverAssistantDialog';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DialogDescription: ({ children }: HTMLAttributes<HTMLParagraphElement>) => <p>{children}</p>,
  DialogFooter: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DialogHeader: ({ children }: HTMLAttributes<HTMLDivElement>) => <div>{children}</div>,
  DialogTitle: ({ children }: HTMLAttributes<HTMLHeadingElement>) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
    <label htmlFor={htmlFor} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

vi.mock('@/components/ai/ModelPicker', () => ({
  ModelPicker: ({
    onValueChange,
    value,
  }: {
    onValueChange: (value: string) => void;
    value?: string;
  }) => (
    <select
      value={value}
      onChange={(event) => onValueChange((event.target as HTMLSelectElement).value)}
    >
      <option value="">请选择模型</option>
      <option value="model-1">model-1</option>
      <option value="model-2">model-2</option>
    </select>
  ),
}));

vi.mock('@/components/ai-workbench/PromptLibraryInsertButton', () => ({
  PromptLibraryInsertButton: ({ onInsert }: { onInsert: (value: string) => void }) => (
    <button type="button" onClick={() => onInsert('extra prompt')}>
      选择提示词
    </button>
  ),
}));

function findButton(container: HTMLElement, label: string) {
  return Array.from(container.querySelectorAll('button')).find(
    (node) => (node.textContent || '').trim() === label,
  );
}

function getPayloadArgument(mock: ReturnType<typeof vi.fn>) {
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return call?.[0] as AICoverAssistantPayload | undefined;
}

describe('AICoverAssistantDialog', () => {
  it('builds generate payload with defaults and latest prompt', async () => {
    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);
    const onConfirm = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <AICoverAssistantDialog
          onConfirm={onConfirm}
          defaultModelId="model-1"
          defaultAspectRatio="4:3"
          defaultQuality="2K"
          defaultPrompt="起始提示词"
        />,
      );
    });

    const confirmButton = findButton(rootElement, '确认并生图');
    expect(confirmButton).not.toBeNull();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(getPayloadArgument(onConfirm)).toMatchObject({
      mode: 'generate',
      modelId: 'model-1',
      aspectRatio: '4:3',
      quality: '2K',
      variationMode: 'balanced',
      prompt: '起始提示词',
    });

    root.unmount();
    rootElement.remove();
  });

  it('supports switching to pick mode and keeps model optional for that mode', async () => {
    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);
    const onConfirm = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <AICoverAssistantDialog
          onConfirm={onConfirm}
          defaultModelId="" // pick mode should still be submittable without model
          defaultAspectRatio={BLOG_COVER_AI_ASPECT_RATIO}
          defaultQuality={BLOG_COVER_AI_QUALITY}
          defaultPrompt=""
        />,
      );
    });

    const pickButton = findButton(rootElement, 'AI 选图');
    expect(pickButton).not.toBeNull();

    await act(async () => {
      pickButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const pickConfirmButton = findButton(rootElement, '确认并选图');
    expect(pickConfirmButton).not.toBeNull();

    await act(async () => {
      pickConfirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(getPayloadArgument(onConfirm)).toMatchObject({
      mode: 'pick',
      modelId: '',
      aspectRatio: BLOG_COVER_AI_ASPECT_RATIO,
      quality: BLOG_COVER_AI_QUALITY,
      prompt: expect.any(String),
    });

    root.unmount();
    rootElement.remove();
  });

  it('appends selected prompt phrase before confirm payload', async () => {
    const rootElement = document.createElement('div');
    document.body.appendChild(rootElement);
    const root = createRoot(rootElement);
    const onConfirm = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        <AICoverAssistantDialog
          onConfirm={onConfirm}
          defaultModelId="model-1"
          defaultPrompt="起始提示词"
        />,
      );
    });

    const promptInsertButton = findButton(rootElement, '选择提示词');
    expect(promptInsertButton).not.toBeNull();

    await act(async () => {
      promptInsertButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = findButton(rootElement, '确认并生图');
    expect(confirmButton).not.toBeNull();

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(getPayloadArgument(onConfirm)).toMatchObject({
      mode: 'generate',
      modelId: 'model-1',
      prompt: '起始提示词\n\nextra prompt',
    });

    root.unmount();
    rootElement.remove();
  });
});
