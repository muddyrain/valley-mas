import { afterEach, expect, it, vi } from 'vitest';
import type { AnnotationAction } from '../core/annotation';
import { ScreenshotCanvasRenderer } from './screenshot-canvas';

afterEach(() => vi.unstubAllGlobals());

it('reuses committed annotations and reads only the mosaic footprint while dragging', () => {
  const cacheContext = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    strokeRect: vi.fn(),
  };
  const cacheCanvas = { width: 0, height: 0, getContext: () => cacheContext };
  vi.stubGlobal('document', { createElement: () => cacheCanvas });
  const targetContext = {
    canvas: { width: 2400, height: 1400 },
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4).fill(255),
    })),
  };
  const image = {} as HTMLImageElement;
  const source = { x: 200, y: 200, width: 2400, height: 1400 };
  const history: AnnotationAction[] = [
    {
      type: 'rectangle',
      start: { x: 10, y: 10 },
      end: { x: 80, y: 80 },
      color: '#2563eb',
      strokeWidth: 4,
    },
  ];
  const renderer = new ScreenshotCanvasRenderer();
  for (let step = 0; step < 20; step++) {
    renderer.render(
      targetContext as unknown as CanvasRenderingContext2D,
      image,
      source,
      history,
      {
        type: 'mosaic',
        points: [{ x: 300 + step, y: 300 }],
        mosaicSize: 8,
      },
      2,
    );
  }
  expect(cacheContext.drawImage).toHaveBeenCalledOnce();
  expect(cacheContext.strokeRect).toHaveBeenCalledOnce();
  expect(targetContext.getImageData).toHaveBeenCalledTimes(20);
  for (const [x, y, width, height] of targetContext.getImageData.mock.calls) {
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(width * height).toBeLessThan(10000);
  }
  renderer.render(
    targetContext as unknown as CanvasRenderingContext2D,
    image,
    source,
    [],
    undefined,
    2,
  );
  expect(cacheContext.drawImage).toHaveBeenCalledTimes(2);
});
