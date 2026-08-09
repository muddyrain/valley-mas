/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runBrowserImageToolMock } = vi.hoisted(() => ({
  runBrowserImageToolMock: vi.fn(),
}));

vi.mock('@valley/browser-media', async () => {
  const actual =
    await vi.importActual<typeof import('@valley/browser-media')>('@valley/browser-media');
  return { ...actual, runBrowserImageTool: runBrowserImageToolMock };
});

import FormatTools from '.';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntry = '/tools/format') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/tools/format"
            element={
              <>
                <FormatTools />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
  });
  return { container, root };
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  });
  runBrowserImageToolMock.mockResolvedValue({
    ok: true,
    file: new File(['output'], 'output.webp', { type: 'image/webp' }),
  });
});

describe('FormatTools', () => {
  it('restores a structured package tool from the URL and executes it', async () => {
    const { container, root } = renderPage('/tools/format?category=data&tool=json-sort-keys');

    expect(container.querySelector('h1')?.textContent).toBe('实用工具');
    expect(container.textContent).toContain('JSON 键排序');
    const input = container.querySelector('textarea[aria-label="输入内容"]') as HTMLTextAreaElement;
    act(() => setInputValue(input, '{"z":1,"a":2}'));
    const runButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('执行处理'),
    );
    await act(async () => runButton?.click());

    expect(
      (container.querySelector('textarea[aria-label="处理结果"]') as HTMLTextAreaElement).value,
    ).toBe('{\n  "a": 2,\n  "z": 1\n}');
    cleanup(container, root);
  });

  it('publishes tool and category selection to the URL', () => {
    const { container, root } = renderPage();
    const imageTool = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('图片处理'),
    );

    act(() => imageTool?.click());

    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain(
      'tool=image-transform',
    );
    expect(container.textContent).toContain('裁剪');
    expect(container.textContent).toContain('旋转与翻转');
    expect(container.textContent).toContain('水印');
    cleanup(container, root);
  });

  it('passes image controls to the browser-media package and exposes the download', async () => {
    const { container, root } = renderPage('/tools/format?category=image&tool=image-transform');
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['source'], 'source.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();
    expect(container.textContent).toContain('source.png');

    const widthInput = container.querySelector('input[aria-label="输出宽度"]') as HTMLInputElement;
    const watermarkInput = container.querySelector(
      'input[aria-label="水印文字"]',
    ) as HTMLInputElement;
    act(() => setInputValue(widthInput, '800'));
    act(() => setInputValue(watermarkInput, 'Valley'));
    await flush();
    const processButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '处理图片',
    );
    expect(processButton).toBeDefined();
    await act(async () => processButton?.click());
    await flush();

    expect(runBrowserImageToolMock).toHaveBeenCalledWith({
      file,
      options: expect.objectContaining({
        width: 800,
        watermark: expect.objectContaining({ text: 'Valley' }),
      }),
    });
    expect(container.querySelector('a[download="output.webp"]')).not.toBeNull();
    cleanup(container, root);
  });
});
