import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const artifactDir = path.resolve('output/p2-4-acceptance/browser-smoke');

interface RuntimeState {
  readonly session: {
    readonly status: string;
    readonly templateId?: string;
    readonly seed?: number;
  } | null;
  readonly renderer: {
    readonly renderer: string;
    readonly dpr: number;
    readonly lod: string;
    readonly visualCatalogVersion: string;
    readonly pendingChunks: number;
    readonly detailCoverageReady: boolean;
    readonly worldTreeMarkers: number;
  } | null;
}

test('P2-4 world LOD preserves macro structure and hands off to region detail', async ({
  page,
}) => {
  await mkdir(artifactDir, { recursive: true });
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const worldAtlasResponses: number[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('requestfailed', (request) =>
    failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`),
  );
  page.on('response', (response) => {
    if (response.url().includes('/map/builtin/lod-world-detailed-01.png')) {
      worldAtlasResponses.push(response.status());
    }
  });

  await page.goto('/?mapDebug=1');
  await page.locator('#world-seed').fill('8');
  await page.locator('[data-template-id="continent"]').click();
  await expect(page.locator('[data-map-shell="loading"]')).toBeVisible();
  await expect.poll(async () => (await state(page)).session?.status).toBe('world');

  const world = await state(page);
  expect(world.session).toMatchObject({ status: 'world', templateId: 'continent', seed: 8 });
  expect(world.renderer).toMatchObject({
    renderer: 'webgl2',
    lod: 'world',
    visualCatalogVersion: 'builtin-world-lod-1',
  });
  expect(world.renderer?.dpr).toBeLessThanOrEqual(2);
  expect(world.renderer?.worldTreeMarkers).toBeGreaterThan(100);
  expect(await canvasDistinctColors(page)).toBeGreaterThan(48);
  expect(worldAtlasResponses.length).toBeGreaterThan(0);
  expect(worldAtlasResponses.every((status) => status === 200)).toBe(true);
  await page.screenshot({ path: path.join(artifactDir, '01-world.png') });

  await page.locator('[data-focus="region"]').click();
  await expect.poll(async () => (await state(page)).renderer?.pendingChunks).toBe(0);
  await expect.poll(async () => (await state(page)).renderer?.detailCoverageReady).toBe(true);
  expect((await state(page)).renderer?.lod).toBe('region');
  await page.screenshot({ path: path.join(artifactDir, '02-region.png') });

  await page.locator('[data-focus="world"]').click();
  await expect.poll(async () => (await state(page)).renderer?.lod).toBe('world');
  expect((await state(page)).renderer?.worldTreeMarkers).toBe(world.renderer?.worldTreeMarkers);
  await page.screenshot({ path: path.join(artifactDir, '03-world-return.png') });

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

async function state(page: Page): Promise<RuntimeState> {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') throw new Error('Missing debug bridge');
    return JSON.parse(window.render_game_to_text()) as RuntimeState;
  });
}

async function canvasDistinctColors(page: Page): Promise<number> {
  return page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (gl === null) return 0;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
    const colors = new Set<number>();
    for (let offset = 0; offset < pixels.length; offset += 64) {
      if ((pixels[offset + 3] ?? 0) === 0) continue;
      colors.add(
        ((pixels[offset] ?? 0) << 16) |
          ((pixels[offset + 1] ?? 0) << 8) |
          (pixels[offset + 2] ?? 0),
      );
    }
    return colors.size;
  });
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}
