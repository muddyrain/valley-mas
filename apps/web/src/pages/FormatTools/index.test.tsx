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

function dispatchPointer(
  element: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
  });
  element.dispatchEvent(event);
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
    expect(container.textContent).toContain('拖入图片，或点击选择');
    cleanup(container, root);
  });

  it('keeps the current category when a tool is selected', () => {
    const { container, root } = renderPage();
    const timestampTool = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('时间戳与日期'),
    );

    act(() => timestampTool?.click());

    expect(container.querySelector('[data-testid="location"]')?.textContent).toContain(
      'tool=timestamp-date',
    );
    expect(container.querySelector('[data-testid="location"]')?.textContent).not.toContain(
      'category=data',
    );
    expect(
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent?.trim() === '全部')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
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
    expect(container.querySelector('[aria-label="图片编辑工具"]')).not.toBeNull();
    expect(container.querySelector('img[alt="图片编辑预览"]')).not.toBeNull();

    const widthInput = container.querySelector('input[aria-label="输出宽度"]') as HTMLInputElement;
    act(() => setInputValue(widthInput, '800'));
    const watermarkTool = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '水印',
    );
    act(() => watermarkTool?.click());

    const watermarkInput = container.querySelector(
      'input[aria-label="水印文字"]',
    ) as HTMLInputElement;
    act(() => setInputValue(watermarkInput, 'Valley'));
    await flush();
    expect(container.querySelector('[data-testid="watermark-preview"]')?.textContent).toBe(
      'Valley',
    );
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

  it('keeps crop movable and previews size and corner changes in real time', async () => {
    const { container, root } = renderPage('/tools/format?category=image&tool=image-transform');
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['source'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();

    const previewImage = container.querySelector('img[alt="图片编辑预览"]') as HTMLImageElement;
    Object.defineProperties(previewImage, {
      naturalWidth: { configurable: true, value: 136 },
      naturalHeight: { configurable: true, value: 148 },
    });
    act(() => previewImage.dispatchEvent(new Event('load', { bubbles: true })));

    const widthInput = container.querySelector('input[aria-label="输出宽度"]') as HTMLInputElement;
    act(() => setInputValue(widthInput, '272'));

    const previewSurface = container.querySelector(
      '[data-testid="image-preview-surface"]',
    ) as HTMLElement;
    expect(previewSurface.dataset.previewSize).toBe('272 × 296');
    expect(previewSurface.style.aspectRatio).toBe('272 / 296');

    const cropTool = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '裁剪',
    );
    act(() => cropTool?.click());

    const cropSelection = container.querySelector('[data-testid="crop-selection"]') as HTMLElement;
    expect(Number.parseFloat(cropSelection.style.left)).toBeGreaterThan(0);
    expect(Number.parseFloat(cropSelection.style.top)).toBeGreaterThan(0);
    expect(Number.parseFloat(cropSelection.style.width)).toBeLessThan(100);
    expect(Number.parseFloat(cropSelection.style.height)).toBeLessThan(100);
    expect(container.querySelector('button[aria-label="从左上角调整裁剪范围"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="从右侧调整裁剪范围"]')).not.toBeNull();

    Object.defineProperty(previewSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 544, height: 592 }),
    });
    Object.defineProperties(cropSelection, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    act(() => dispatchPointer(cropSelection, 'pointerdown', 100, 100));
    act(() => dispatchPointer(cropSelection, 'pointermove', 132, 140));
    act(() => dispatchPointer(cropSelection, 'pointerup', 132, 140));

    expect(
      (container.querySelector('input[aria-label="裁剪起点 X"]') as HTMLInputElement).value,
    ).toBe('22');
    expect(
      (container.querySelector('input[aria-label="裁剪起点 Y"]') as HTMLInputElement).value,
    ).toBe('25');

    const cornerTool = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '圆角',
    );
    act(() => cornerTool?.click());
    const cornerPreset = container.querySelector('button[aria-label="圆角 64 像素"]');
    act(() => (cornerPreset as HTMLButtonElement)?.click());

    expect(previewSurface.style.borderRadius).not.toBe('0%');
    expect(previewSurface.style.overflow).toBe('hidden');
    cleanup(container, root);
  });
});
