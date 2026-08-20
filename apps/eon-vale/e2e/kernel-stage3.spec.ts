import { expect, test } from '@playwright/test';

test('placed resident founds a persistent autonomous settlement', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const center = {
    x: (bounds?.width ?? 2) / 2,
    y: (bounds?.height ?? 2) / 2,
  };

  await page.getByRole('tab', { name: '地形', exact: true }).click();
  await page.getByTestId('tool-paint-land').click();
  await canvas.click({ position: center });
  await page.getByRole('tab', { name: '生命', exact: true }).click();
  await page.getByTestId('tool-spawn-human').click();
  await canvas.click({ position: center });

  await expect.poll(async () => Number(await canvas.getAttribute('data-population'))).toBe(1);
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');
  await expect(canvas).toHaveAttribute('data-kernel-invariant-errors', '0');

  await page.getByRole('button', { name: '8×', exact: true }).click();
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-kernel-tick')))
    .toBeGreaterThan(30);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-settlement-labels')))
    .toBe(1);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');

  const savedChecksum = await canvas.getAttribute('data-kernel-checksum');
  const savedTick = await canvas.getAttribute('data-kernel-tick');
  await page.getByRole('button', { name: '世界菜单', exact: true }).click();
  const archive = page.getByRole('group', { name: '手动存档' });
  await archive.getByRole('button', { name: '保存' }).first().click();
  await expect(page.getByRole('status')).toHaveText('世界已保存到档案 1');

  await page.reload();
  await page.getByRole('button', { name: '世界菜单', exact: true }).click();
  await archive.getByRole('button', { name: '载入' }).first().click();
  await expect(page.getByRole('status')).toHaveText('世界档案已载入');
  await expect.poll(() => canvas.getAttribute('data-kernel-checksum')).toBe(savedChecksum);
  await expect(canvas).toHaveAttribute('data-kernel-tick', savedTick ?? '');
  await expect(canvas).toHaveAttribute('data-population', '1');
  await expect(canvas).toHaveAttribute('data-settlement-labels', '1');
  await expect(canvas).toHaveAttribute('data-kernel-invariant-errors', '0');
});
