import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const artifactDir = path.resolve('output/p3-1-new-world-entry/browser-smoke');

test('new-world entry hides seed, exposes eight structures, and enters a generated world', async ({
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

  await page.goto('/');
  await expect(page.locator('[data-map-shell="template-selection"]')).toBeVisible();
  await expect(page.locator('[data-template-id]')).toHaveCount(8);
  await expect(page.locator('#world-seed')).toHaveCount(0);
  await expect(page.locator('[data-dev-seed-control]')).toHaveCount(0);
  await expect(page.getByText('每张蓝图只决定海陆的大致关系', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: '主大陆概念图' })).toHaveAttribute(
    'src',
    '/map/ui/concepts/continent.webp',
  );
  await page.screenshot({ path: path.join(artifactDir, '01-template-selection.png') });

  await page.locator('[data-template-id="continent"]').focus();
  await expect(page.getByRole('heading', { name: '主大陆', level: 2 })).toBeVisible();
  await page.locator('[data-template-id="continent"]').click();
  await expect(page.locator('[data-map-shell="loading"]')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '世界生成进度' })).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, '02-loading.png') });
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
      return (JSON.parse(raw) as { session?: { status?: string } }).session?.status;
    })
    .toBe('world');
  await expect(page.locator('.map-debug')).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() ?? '{}'));
  expect(state.session).toMatchObject({ status: 'world', templateId: 'continent' });
  expect(Number.isInteger(state.session.seed)).toBe(true);
  expect(state.session.seed).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: path.join(artifactDir, '03-world.png') });

  await page.locator('[data-debug-mode="biome"]').click();
  await expect(page.locator('[data-debug-mode="biome"]')).toHaveClass(/is-active/);
  await page.locator('[data-focus="rainforest"]').click();
  await expect(page.locator('[data-map-shell="loading"]')).toBeVisible();
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => window.render_game_to_text?.() ?? '{}');
      return (JSON.parse(raw) as { session?: { status?: string; seed?: number } }).session;
    })
    .toMatchObject({ status: 'world', seed: 0x1a2b3c4d });

  await page.locator('[data-return-template-selection]').click();
  await expect(page.locator('[data-map-shell="template-selection"]')).toBeVisible();
  await expect(page.locator('[data-template-id="tri_continents"]')).toBeVisible();
  await page.screenshot({ path: path.join(artifactDir, '04-returned-selection.png') });

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

declare global {
  interface Window {
    render_game_to_text?: () => string;
  }
}
