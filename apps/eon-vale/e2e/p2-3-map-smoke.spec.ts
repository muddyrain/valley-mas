import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const artifactDir = path.resolve('output/p2-3-acceptance/browser-smoke');

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
    readonly visibleChunks: number;
    readonly visibleDetailedChunks: number;
    readonly detailCoverageReady: boolean;
  } | null;
}

test('P2-3 tundra, polar coast, and cold ridge render through the browser', async ({ page }) => {
  await mkdir(artifactDir, { recursive: true });
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('requestfailed', (request) =>
    failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`),
  );

  await page.goto('/?mapDebug=1');
  await page.locator('#world-seed').fill('8');
  await page.locator('[data-template-id="continent"]').click();
  await expect.poll(async () => (await state(page)).session?.status).toBe('world');
  await expect(page.locator('.map-debug')).toBeVisible({ timeout: 30_000 });

  const world = await state(page);
  expect(world.session).toMatchObject({ status: 'world', templateId: 'continent', seed: 8 });
  expect(world.renderer).toMatchObject({
    renderer: 'webgl2',
    lod: 'world',
    visualCatalogVersion: 'builtin-world-lod-1',
  });
  expect(world.renderer?.dpr).toBeLessThanOrEqual(2);
  await page.screenshot({ path: path.join(artifactDir, '01-world.png') });

  for (const focus of ['tundra', 'polar', 'cold-elevation'] as const) {
    await page.locator(`[data-focus="${focus}"]`).click();
    await expect.poll(async () => (await state(page)).renderer?.pendingChunks).toBe(0);
    await expect.poll(async () => (await state(page)).renderer?.detailCoverageReady).toBe(true);
    const focused = await state(page);
    expect(focused.renderer?.lod).toBe('region');
    expect(focused.renderer?.visibleDetailedChunks).toBe(focused.renderer?.visibleChunks);
    await page.screenshot({ path: path.join(artifactDir, `02-${focus}.png`) });
    await page.locator('[data-debug-mode="ground"]').click();
    expect(await groundEdgeRate(page)).toBeLessThanOrEqual(0.05);
    await page.screenshot({ path: path.join(artifactDir, `03-${focus}-ground.png`) });
    await page.locator('[data-debug-mode="off"]').click();
  }

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

async function state(page: Page): Promise<RuntimeState> {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') throw new Error('Missing debug bridge');
    return JSON.parse(window.render_game_to_text()) as RuntimeState;
  });
}

async function groundEdgeRate(page: Page): Promise<number> {
  return page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (gl === null) return Number.POSITIVE_INFINITY;
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
    let changed = 0;
    let compared = 0;
    const difference = (left: number, right: number) =>
      Math.abs((pixels[left] ?? 0) - (pixels[right] ?? 0)) +
      Math.abs((pixels[left + 1] ?? 0) - (pixels[right + 1] ?? 0)) +
      Math.abs((pixels[left + 2] ?? 0) - (pixels[right + 2] ?? 0));
    for (let y = 1; y < gl.drawingBufferHeight - 1; y += 1) {
      for (let x = 1; x < gl.drawingBufferWidth - 1; x += 1) {
        const center = (y * gl.drawingBufferWidth + x) * 4;
        changed += Number(difference(center, center + 4) >= 12);
        changed += Number(difference(center, center + gl.drawingBufferWidth * 4) >= 12);
        compared += 2;
      }
    }
    return changed / compared;
  });
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}
