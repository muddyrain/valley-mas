import { expect, test } from '@playwright/test';

test('starts a paused empty world and keeps playback rate orthogonal', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');

  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-renderer', 'pixi-v8-webgl-2d');
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-invariant-errors', '0');
  await expect(canvas).toHaveAttribute('data-population', '0');
  await expect(canvas).toHaveAttribute('data-map-size', '256');
  await expect(canvas).toHaveAttribute('data-map-preset', 'archipelago');
  await expect(canvas).toHaveAttribute('data-settleable-regions', '4');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-resource-nodes')))
    .toBeGreaterThan(0);

  const initialChecksum = await canvas.getAttribute('data-kernel-checksum');
  expect(initialChecksum).toMatch(/^[0-9a-f]{8}$/);

  const eightTimes = page.getByRole('button', { name: '8×', exact: true });
  await eightTimes.click();
  await expect(eightTimes).toHaveClass(/active/);
  await page.waitForTimeout(350);
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-checksum', initialChecksum ?? '');

  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-kernel-tick')))
    .toBeGreaterThan(10);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  const pausedTick = await canvas.getAttribute('data-kernel-tick');
  const pausedChecksum = await canvas.getAttribute('data-kernel-checksum');
  await page.waitForTimeout(400);
  await expect(canvas).toHaveAttribute('data-kernel-tick', pausedTick ?? '');
  await expect(canvas).toHaveAttribute('data-kernel-checksum', pausedChecksum ?? '');
});

test('creates a replayable large world and edits terrain while paused', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');

  const eightTimes = page.getByRole('button', { name: '8×', exact: true });
  await eightTimes.click();
  await page.getByRole('button', { name: '世界菜单', exact: true }).click();
  await page.getByLabel('世界种子', { exact: true }).fill('E2E-KERNEL-STAGE1');
  await page.getByRole('button', { name: '大型 384×384', exact: true }).click();
  await page.getByRole('button', { name: '主大陆', exact: true }).click();
  await page.getByRole('button', { name: '创造世界', exact: true }).click();

  await expect(canvas).toHaveAttribute('data-map-size', '384');
  await expect(canvas).toHaveAttribute('data-map-preset', 'continent');
  await expect(canvas).toHaveAttribute('data-settleable-regions', '6');
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-invariant-errors', '0');
  await expect(canvas).toHaveAttribute('data-population', '0');
  await expect(eightTimes).toHaveClass(/active/);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-resource-nodes')))
    .toBeGreaterThan(0);

  const checksumBeforeEdit = await canvas.getAttribute('data-kernel-checksum');
  expect(checksumBeforeEdit).toMatch(/^[0-9a-f]{8}$/);

  await page.getByRole('tab', { name: '地形', exact: true }).click();
  const raiseTool = page.getByRole('button', { name: '抬高', exact: true });
  await raiseTool.click();
  await expect(raiseTool).toHaveClass(/active/);
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await canvas.click({
    position: {
      x: (bounds?.width ?? 2) / 2,
      y: (bounds?.height ?? 2) / 2,
    },
  });

  await expect
    .poll(async () => await canvas.getAttribute('data-kernel-checksum'))
    .not.toBe(checksumBeforeEdit);
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-invariant-errors', '0');
});
