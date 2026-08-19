// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConversationMessage } from './ConversationMessage';

vi.mock('@/components/ImagePreviewDialog', () => ({
  default: ({ open, src, title }: { open: boolean; src?: string; title?: string }) =>
    open ? (
      <div role="dialog" data-preview-src={src}>
        {title}
      </div>
    ) : null,
}));

describe('ConversationMessage', () => {
  it('renders a user avatar, aligned bubble, and reference image attachment together', () => {
    const markup = renderToStaticMarkup(
      <ConversationMessage
        messageRole="user"
        content="基于这张参考图生成壁纸"
        user={{ name: '小谷', avatarUrl: '/avatars/user.png' }}
        attachments={[
          {
            id: 'reference-1',
            name: 'reference.png',
            mimeType: 'image/png',
            sizeBytes: 2048,
            previewUrl: 'data:image/png;base64,AAAA',
          },
        ]}
        presentation="workspace"
      />,
    );

    expect(markup).toContain('小谷的头像');
    expect(markup).toContain('reference.png');
    expect(markup).toContain('基于这张参考图生成壁纸');
    expect(markup).toContain('flex-row-reverse');
  });

  it('uses the same row structure for an assistant avatar and bubble', () => {
    const markup = renderToStaticMarkup(
      <ConversationMessage
        messageRole="assistant"
        content="我正在生成图片。"
        assistant={{ name: '图片助手', avatarUrl: '/avatars/agent.png' }}
        presentation="workspace"
      />,
    );

    expect(markup).toContain('图片助手的头像');
    expect(markup).toContain('我正在生成图片。');
    expect(markup).not.toContain('flex-row-reverse');
  });

  it('opens image attachments in the shared preview instead of the file fallback', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const fileFallback = vi.fn();

    await act(async () => {
      root.render(
        <ConversationMessage
          messageRole="user"
          content="Use this reference"
          attachments={[
            {
              id: 'reference-1',
              name: 'reference.png',
              mimeType: 'image/png',
              previewUrl: 'data:image/png;base64,AAAA',
              onOpen: fileFallback,
            },
          ]}
        />,
      );
    });

    await act(async () => {
      container.querySelector('button')?.click();
    });

    const preview = container.querySelector('[role="dialog"]');
    expect(preview?.getAttribute('data-preview-src')).toBe('data:image/png;base64,AAAA');
    expect(preview?.textContent).toBe('reference.png');
    expect(fileFallback).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
