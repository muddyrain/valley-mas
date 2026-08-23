import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const acceptanceSeed = 8;
const artifactDir = path.resolve('output/p2-2-acceptance/browser-smoke');

interface RuntimeState {
  readonly session: {
    readonly status: string;
    readonly templateId?: string;
    readonly seed?: number;
    readonly error?: string;
  } | null;
  readonly renderer: {
    readonly renderer: string;
    readonly dpr: number;
    readonly lod: string;
    readonly debugMode: string;
    readonly visualCatalogVersion: string;
    readonly snapshotChecksum: string;
    readonly visibleChunks: number;
    readonly visibleDetailedChunks: number;
    readonly detailCoverageReady: boolean;
    readonly pendingChunks: number;
    readonly visibleObjects: number;
  } | null;
}

test('P2-2 savanna and desert fixtures preserve sparse dry-biome rendering', async ({ page }) => {
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
  await enterAcceptanceWorld(page, errors, failedRequests);
  const world = await runtimeState(page);
  expect(world.session).toMatchObject({
    status: 'world',
    templateId: 'continent',
    seed: acceptanceSeed,
  });
  expect(world.renderer).toMatchObject({
    renderer: 'webgl2',
    lod: 'world',
    debugMode: 'off',
    visualCatalogVersion: 'builtin-world-lod-1',
  });
  expect(world.renderer?.dpr).toBeLessThanOrEqual(2);
  await page.screenshot({ path: path.join(artifactDir, '01-world.png') });

  for (const kind of ['savanna', 'desert'] as const) {
    const transitionSamples = await page.evaluate(async (focusKind) => {
      const samples: Array<{
        visibleChunks: number;
        visibleDetailedChunks: number;
        pendingChunks: number;
      }> = [];
      window.dispatchEvent(new CustomEvent('map-focus-p2-2', { detail: focusKind }));
      for (let frame = 0; frame < 150; frame += 1) {
        await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        if (typeof window.render_game_to_text !== 'function') break;
        const state = JSON.parse(window.render_game_to_text()) as RuntimeState;
        const renderer = state.renderer;
        if (renderer === null || renderer.lod === 'world') continue;
        samples.push({
          visibleChunks: renderer.visibleChunks,
          visibleDetailedChunks: renderer.visibleDetailedChunks,
          pendingChunks: renderer.pendingChunks,
        });
        if (renderer.pendingChunks === 0 && renderer.detailCoverageReady) break;
      }
      return samples;
    }, kind);
    await writeFile(
      path.join(artifactDir, `${kind}-transition.json`),
      JSON.stringify(transitionSamples, null, 2),
    );
    expect(transitionSamples.length).toBeGreaterThan(0);
    expect(
      transitionSamples.every(
        ({ visibleChunks, visibleDetailedChunks }) =>
          visibleDetailedChunks === 0 || visibleDetailedChunks === visibleChunks,
      ),
    ).toBe(true);
    await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
    await expect
      .poll(async () => (await runtimeState(page)).renderer?.detailCoverageReady)
      .toBe(true);
    const region = await runtimeState(page);
    expect(region.renderer?.lod).toBe('region');
    expect(region.renderer?.visibleChunks).toBeGreaterThan(1);
    expect(region.renderer?.visibleDetailedChunks).toBe(region.renderer?.visibleChunks);
    expect(region.renderer?.visibleObjects).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(artifactDir, `02-${kind}-region.png`) });

    await page.locator('[data-debug-mode="ground"]').click();
    await expect.poll(async () => (await runtimeState(page)).renderer?.debugMode).toBe('ground');
    const frequency = await groundHighFrequencyMetrics(page);
    await writeFile(
      path.join(artifactDir, `${kind}-ground-frequency.json`),
      JSON.stringify(frequency, null, 2),
    );
    expect(frequency.edgeRate).toBeLessThanOrEqual(0.05);
    await page.screenshot({ path: path.join(artifactDir, `03-${kind}-ground.png`) });
    await page.locator('[data-debug-mode="off"]').click();
  }

  await page.locator('[data-focus="desert"]').click();
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error('Map canvas is unavailable');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -500);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await runtimeState(page)).renderer?.lod).toBe('close');
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  await page.screenshot({ path: path.join(artifactDir, '04-desert-close.png') });

  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + bounds.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  const afterDrag = await runtimeState(page);
  expect(afterDrag.renderer?.detailCoverageReady).toBe(true);
  expect(afterDrag.renderer?.visibleDetailedChunks).toBe(afterDrag.renderer?.visibleChunks);
  await page.screenshot({ path: path.join(artifactDir, '05-desert-close-after-drag.png') });

  await page.reload();
  await enterAcceptanceWorld(page, errors, failedRequests);
  const repeated = await runtimeState(page);
  expect(repeated.renderer?.snapshotChecksum).toBe(world.renderer?.snapshotChecksum);
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

async function enterAcceptanceWorld(
  page: Page,
  errors: readonly string[],
  failedRequests: readonly string[],
): Promise<void> {
  await expect(page.locator('[data-map-shell="template-selection"]')).toBeVisible();
  await page.locator('#world-seed').fill(String(acceptanceSeed));
  await page.locator('[data-template-id="continent"]').click();
  await expect
    .poll(async () => {
      const state = await runtimeState(page);
      if (state.session?.status === 'failed') {
        throw new Error(JSON.stringify({ state, errors, failedRequests }, null, 2));
      }
      return state.session?.status;
    })
    .toBe('world');
  await expect(page.locator('.map-debug')).toBeVisible({ timeout: 30_000 });
}

async function runtimeState(page: Page): Promise<RuntimeState> {
  return page.evaluate(() => {
    if (typeof window.render_game_to_text !== 'function') throw new Error('Missing debug bridge');
    return JSON.parse(window.render_game_to_text()) as RuntimeState;
  });
}

async function groundHighFrequencyMetrics(page: Page): Promise<{
  readonly edgeRate: number;
  readonly comparedEdges: number;
}> {
  return page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (gl === null) return { edgeRate: Number.POSITIVE_INFINITY, comparedEdges: 0 };
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let highFrequencyEdges = 0;
    let comparedEdges = 0;
    const differs = (left: number, right: number) =>
      Math.abs((pixels[left] ?? 0) - (pixels[right] ?? 0)) +
        Math.abs((pixels[left + 1] ?? 0) - (pixels[right + 1] ?? 0)) +
        Math.abs((pixels[left + 2] ?? 0) - (pixels[right + 2] ?? 0)) >=
      12;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const center = (y * width + x) * 4;
        highFrequencyEdges += Number(differs(center, center + 4));
        highFrequencyEdges += Number(differs(center, center + width * 4));
        comparedEdges += 2;
      }
    }
    return { edgeRate: highFrequencyEdges / comparedEdges, comparedEdges };
  });
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}
