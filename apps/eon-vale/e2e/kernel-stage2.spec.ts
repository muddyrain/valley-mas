import { expect, test } from '@playwright/test';

test('manual kernel snapshot survives refresh and restores authority', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect.poll(() => canvas.getAttribute('data-kernel-checksum')).toMatch(/^[0-9a-f]{8}$/);
  const savedChecksum = await canvas.getAttribute('data-kernel-checksum');
  expect(savedChecksum).toBeTruthy();
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');

  await page.getByRole('button', { name: '世界菜单' }).click();
  const archive = page.getByRole('group', { name: '手动存档' });
  await archive.getByRole('button', { name: '保存' }).first().click();
  await expect(page.getByRole('status')).toHaveText('世界已保存到档案 1');
  await page.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('button', { name: '4×' }).click();
  await page.getByRole('button', { name: '继续' }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-kernel-tick')))
    .toBeGreaterThan(5);
  await page.getByRole('button', { name: '暂停' }).click();
  await expect.poll(() => canvas.getAttribute('data-kernel-checksum')).not.toBe(savedChecksum);

  await page.reload();
  await page.getByRole('button', { name: '世界菜单' }).click();
  await expect(archive.getByRole('button', { name: '载入' }).first()).toBeEnabled();
  await archive.getByRole('button', { name: '载入' }).first().click();

  await expect(page.getByRole('status')).toHaveText('世界档案已载入');
  await expect.poll(() => canvas.getAttribute('data-kernel-checksum')).toBe(savedChecksum);
  await expect(canvas).toHaveAttribute('data-kernel-tick', '0');
  await expect(canvas).toHaveAttribute('data-kernel-paused', 'true');
  await expect(page.getByRole('button', { name: '4×' })).toHaveClass(/active/);
});
