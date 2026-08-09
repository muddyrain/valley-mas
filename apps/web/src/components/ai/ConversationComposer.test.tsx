/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ConversationComposer } from './ConversationComposer';

describe('ConversationComposer', () => {
  it('shows attached files and exposes the file picker', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value="总结文件"
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        placeholder="输入消息"
        files={[{ id: 'file-1', name: 'requirements.pdf', sizeBytes: 1024 }]}
        onFilesSelected={() => undefined}
        onFileRemove={() => undefined}
      />,
    );

    expect(markup).toContain('requirements.pdf');
    expect(markup).toContain('aria-label="附加文件"');
    expect(markup).toContain('image/jpeg,image/png,image/webp');
    expect(markup).toContain('.md,.markdown,.txt,.pdf,.json,.csv');
  });

  it('forwards measured upload progress to the attachment card', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value=""
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        placeholder="输入消息"
        files={[
          {
            id: 'upload-1',
            name: 'requirements.pdf',
            sizeBytes: 1024,
            status: 'uploading',
            progress: 42,
          },
        ]}
      />,
    );

    expect(markup).toContain('上传中 42%');
    expect(markup).toContain('aria-valuenow="42"');
  });

  it('shows stop for an empty composer while an agent is running', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value=""
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        placeholder="输入消息"
      />,
    );

    expect(markup).toContain('aria-label="停止生成"');
    expect(markup).not.toContain('aria-label="发送消息"');
  });

  it('keeps the send action available when a queued follow-up has content', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value="继续补充"
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        placeholder="输入消息"
      />,
    );

    expect(markup).toContain('aria-label="发送消息"');
    expect(markup).not.toContain('aria-label="停止生成"');
    expect(markup).not.toContain('textarea disabled=""');
  });

  it('adds pasted images to reference images when no file uploader is configured', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onReferenceImagesChange = vi.fn();

    await act(async () => {
      root.render(
        <ConversationComposer
          value=""
          onValueChange={() => undefined}
          onSubmit={() => undefined}
          placeholder="输入消息"
          referenceImages={[]}
          onReferenceImagesChange={onReferenceImagesChange}
        />,
      );
    });

    const textarea = container.querySelector('textarea');
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', {
      type: 'image/png',
    });
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: { files: [image] },
    });

    await act(async () => {
      textarea?.dispatchEvent(pasteEvent);
    });

    expect(pasteEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() =>
      expect(onReferenceImagesChange).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'reference.png',
          mimeType: 'image/png',
          sizeBytes: image.size,
          dataUrl: expect.stringContaining('data:image/png;base64,'),
        }),
      ]),
    );

    root.unmount();
    container.remove();
  });
});
