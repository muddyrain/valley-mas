import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const acceptanceSeed = 0x1a2b3c4d;
const artifactDir = path.resolve('output/p2-1-acceptance/browser-smoke');

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
    readonly debugMode: string;
    readonly visualCatalogVersion: string;
    readonly snapshotChecksum: string;
    readonly representativeChunk: { readonly checksum: string };
    readonly visibleChunks: number;
    readonly visibleDetailedChunks: number;
    readonly detailCoverageReady: boolean;
    readonly cachedChunks: number;
    readonly pendingChunks: number;
    readonly visibleObjects: number;
  } | null;
}

test('P2-1 wet-hot fixtures preserve the complete world, region, and close LOD chain', async ({
  page,
}) => {
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
  await expect(page.locator('[data-map-shell="template-selection"]')).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, '01-template.png') });

  await page.locator('[data-template-id="continent"]').click();
  await expect(page.locator('[data-map-shell="loading"]')).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, '02-loading.png') });
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
  await page.screenshot({ path: path.join(artifactDir, '03-world.png') });

  const first = await runtimeState(page);
  expect(first.session).toMatchObject({
    status: 'world',
    templateId: 'continent',
    seed: acceptanceSeed,
  });
  expect(first.renderer).toMatchObject({ renderer: 'webgl2', lod: 'world', debugMode: 'off' });
  expect(first.renderer?.visualCatalogVersion).toBe('builtin-world-lod-1');
  expect(first.renderer?.representativeChunk).toMatchObject({ x: 256, y: 704 });
  expect(first.renderer?.dpr).toBeLessThanOrEqual(2);
  expect(await visibleColorCount(page)).toBeGreaterThanOrEqual(5);

  const coldTransition = await page.evaluate(async () => {
    const frameTimes: number[] = [];
    const samples: Array<{
      visibleChunks: number;
      visibleDetailedChunks: number;
      pendingChunks: number;
    }> = [];
    let lastFrame = performance.now();
    let elapsedMs = 0;
    let detailReadyAtMs: number | null = null;
    window.dispatchEvent(new CustomEvent('map-focus-region'));
    for (let frame = 0; frame < 180; frame += 1) {
      const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      const frameTime = now - lastFrame;
      lastFrame = now;
      elapsedMs += frameTime;
      frameTimes.push(frameTime);
      if (typeof window.render_game_to_text !== 'function') break;
      const state = JSON.parse(window.render_game_to_text()) as RuntimeState;
      const renderer = state.renderer;
      if (renderer !== null && renderer.lod !== 'world') {
        samples.push({
          visibleChunks: renderer.visibleChunks,
          visibleDetailedChunks: renderer.visibleDetailedChunks,
          pendingChunks: renderer.pendingChunks,
        });
      }
      if (detailReadyAtMs === null && renderer?.detailCoverageReady === true) {
        detailReadyAtMs = elapsedMs;
      }
      if (renderer?.lod === 'region' && renderer.pendingChunks === 0) break;
    }
    const sortedFrameTimes = [...frameTimes].sort((left, right) => left - right);
    return {
      samples,
      detailReadyAtMs,
      p95FrameTimeMs:
        sortedFrameTimes[Math.floor(sortedFrameTimes.length * 0.95)] ?? Number.POSITIVE_INFINITY,
    };
  });
  await writeFile(
    path.join(artifactDir, 'cold-transition-performance.json'),
    JSON.stringify(coldTransition, null, 2),
  );
  const buildSamples = coldTransition.samples;
  expect(buildSamples.length).toBeGreaterThan(0);
  expect(
    buildSamples.some(
      ({ visibleChunks, visibleDetailedChunks }) =>
        visibleDetailedChunks > 0 && visibleDetailedChunks < visibleChunks,
    ),
  ).toBe(false);
  expect(coldTransition.detailReadyAtMs).not.toBeNull();
  expect(coldTransition.detailReadyAtMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(150);
  expect(coldTransition.p95FrameTimeMs).toBeLessThanOrEqual(25);
  await expect.poll(async () => (await runtimeState(page)).renderer?.lod).toBe('region');
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  const region = await runtimeState(page);
  expect(region.session).toMatchObject({ status: 'world', lod: 'region' });
  expect(region.renderer?.visibleChunks).toBeGreaterThan(1);
  expect(region.renderer?.detailCoverageReady).toBe(true);
  expect(region.renderer?.visibleDetailedChunks).toBe(region.renderer?.visibleChunks);
  expect(region.renderer?.cachedChunks).toBeGreaterThanOrEqual(region.renderer?.visibleChunks ?? 0);
  expect(region.renderer?.visibleObjects).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(artifactDir, '04-region.png') });
  await saveState('04-region-state.json', region);

  const rapidViewportTransition = await page.evaluate(async () => {
    const samples: Array<{
      visibleDetailedChunks: number;
      pendingChunks: number;
    }> = [];
    window.dispatchEvent(new CustomEvent('map-focus-p1-2', { detail: 'elevation' }));
    for (let frame = 0; frame < 90; frame += 1) {
      await new Promise<number>((resolve) => requestAnimationFrame(resolve));
      if (typeof window.render_game_to_text !== 'function') break;
      const state = JSON.parse(window.render_game_to_text()) as RuntimeState;
      const renderer = state.renderer;
      if (renderer === null || renderer.lod === 'world') continue;
      samples.push({
        visibleDetailedChunks: renderer.visibleDetailedChunks,
        pendingChunks: renderer.pendingChunks,
      });
      if (renderer.pendingChunks === 0) break;
    }
    return samples;
  });
  await writeFile(
    path.join(artifactDir, 'rapid-viewport-transition.json'),
    JSON.stringify(rapidViewportTransition, null, 2),
  );
  expect(rapidViewportTransition.some(({ pendingChunks }) => pendingChunks > 0)).toBe(true);
  expect(
    rapidViewportTransition.every(({ visibleDetailedChunks }) => visibleDetailedChunks > 0),
  ).toBe(true);
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('map-focus-p1-2', { detail: 'bridge' }));
  });
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);

  for (const mode of ['ground', 'biome', 'terrain', 'chunk', 'autotile'] as const) {
    await page.locator(`[data-debug-mode="${mode}"]`).click();
    await expect.poll(async () => (await runtimeState(page)).renderer?.debugMode).toBe(mode);
    if (mode === 'ground') {
      expect((await runtimeState(page)).renderer?.visibleObjects).toBe(0);
      const groundFrequency = await groundHighFrequencyMetrics(page);
      await writeFile(
        path.join(artifactDir, 'ground-frequency.json'),
        JSON.stringify(groundFrequency, null, 2),
      );
      expect(groundFrequency.edgeRate).toBeLessThanOrEqual(0.05);
    }
    await page.screenshot({ path: path.join(artifactDir, `debug-${mode}.png`) });
  }

  for (const kind of ['bridge', 'elevation', 'corruption'] as const) {
    await page.evaluate((focusKind) => {
      window.dispatchEvent(new CustomEvent('map-focus-p1-2', { detail: focusKind }));
      window.dispatchEvent(new CustomEvent('map-debug-mode', { detail: 'off' }));
    }, kind);
    await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
    await expect
      .poll(async () => (await runtimeState(page)).renderer?.detailCoverageReady)
      .toBe(true);
    await expect.poll(async () => (await runtimeState(page)).renderer?.debugMode).toBe('off');
    await page.screenshot({ path: path.join(artifactDir, `07-${kind}.png`) });
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('map-debug-mode', { detail: 'structure' }));
    });
    await expect.poll(async () => (await runtimeState(page)).renderer?.debugMode).toBe('structure');
    await page.screenshot({ path: path.join(artifactDir, `debug-structure-${kind}.png`) });
  }

  for (const kind of ['rainforest', 'wetland'] as const) {
    await page.locator(`[data-focus="${kind}"]`).click();
    await page.locator('[data-debug-mode="off"]').click();
    await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
    await expect
      .poll(async () => (await runtimeState(page)).renderer?.detailCoverageReady)
      .toBe(true);
    const state = await runtimeState(page);
    expect(state.renderer?.visibleObjects).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(artifactDir, `08-${kind}-region.png`) });
    await page.locator('[data-debug-mode="ground"]').click();
    await expect.poll(async () => (await runtimeState(page)).renderer?.debugMode).toBe('ground');
    const groundFrequency = await groundHighFrequencyMetrics(page);
    await writeFile(
      path.join(artifactDir, `08-${kind}-ground-frequency.json`),
      JSON.stringify(groundFrequency, null, 2),
    );
    expect(groundFrequency.edgeRate).toBeLessThanOrEqual(0.05);
    await page.screenshot({ path: path.join(artifactDir, `08-${kind}-ground.png`) });
  }

  await page.locator('[data-focus="rainforest"]').click();
  await page.locator('[data-debug-mode="off"]').click();
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);

  const canvas = page.locator('canvas');
  const bounds = await canvas.boundingBox();
  if (bounds === null) throw new Error('Map canvas is unavailable');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -500);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await runtimeState(page)).renderer?.lod).toBe('close');
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  const beforeDrag = await runtimeState(page);
  expect(beforeDrag.session).toMatchObject({ status: 'world', lod: 'close' });
  expect(beforeDrag.renderer?.visibleObjects).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(artifactDir, '05-close.png') });
  await saveState('05-close-state.json', beforeDrag);
  await page.mouse.move(bounds.x + bounds.width * 0.22, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.78, bounds.y + bounds.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(async () => (await runtimeState(page)).renderer?.pendingChunks).toBe(0);
  const afterDrag = await runtimeState(page);
  expect(afterDrag.renderer?.visibleChunks).toBeGreaterThan(0);
  expect(afterDrag.renderer?.detailCoverageReady).toBe(true);
  expect(afterDrag.renderer?.visibleDetailedChunks).toBe(afterDrag.renderer?.visibleChunks);
  expect(afterDrag.renderer?.cachedChunks).toBeGreaterThanOrEqual(
    beforeDrag.renderer?.cachedChunks ?? 0,
  );
  await page.screenshot({ path: path.join(artifactDir, '06-close-after-drag.png') });
  await saveState('06-close-after-drag-state.json', afterDrag);

  await page.reload();
  await page.locator('[data-template-id="continent"]').click();
  await expect(page.locator('.map-debug')).toBeVisible({ timeout: 30_000 });
  const second = await runtimeState(page);
  expect(second.renderer?.snapshotChecksum).toBe(first.renderer?.snapshotChecksum);
  expect(second.renderer?.representativeChunk.checksum).toBe(
    first.renderer?.representativeChunk.checksum,
  );
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

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
        const right = center + 4;
        const down = center + width * 4;
        highFrequencyEdges += Number(differs(center, right));
        highFrequencyEdges += Number(differs(center, down));
        comparedEdges += 2;
      }
    }
    return { edgeRate: highFrequencyEdges / comparedEdges, comparedEdges };
  });
}

async function visibleColorCount(page: Page): Promise<number> {
  return page.locator('canvas').evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (gl === null) return 0;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(4 * width * height);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    const stride = Math.max(4, Math.floor(pixels.length / 20_000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`);
    }
    return colors.size;
  });
}

async function saveState(name: string, state: RuntimeState): Promise<void> {
  await writeFile(path.join(artifactDir, name), JSON.stringify(state, null, 2));
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}
