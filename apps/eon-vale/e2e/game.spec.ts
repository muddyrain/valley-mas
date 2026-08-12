import { expect, test } from '@playwright/test';

test('creates, shapes, follows, saves and reloads a living pixel world', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-renderer', 'pixi-v8-webgl-2d');
  await expect(canvas).toHaveAttribute('data-camera-mode', 'pixel-2d-pan-zoom');
  await expect(canvas).toHaveAttribute('data-no-tilt', 'true');
  await expect(canvas).toHaveAttribute('data-no-rotation', 'true');
  await expect(canvas).toHaveAttribute('data-human-style', 'layered-pixel-sprites');
  await expect(canvas).toHaveAttribute('data-animal-style', 'pixel-side-profiles');
  await expect(canvas).toHaveAttribute('data-animal-styles', '7');
  await expect(canvas).toHaveAttribute('data-building-style', 'functional-pixel-buildings');
  await expect(canvas).toHaveAttribute('data-kingdom-palette', 'residents-buildings-flags');
  await expect(canvas).toHaveAttribute('data-strategic-icons', '0');
  await expect(canvas).toHaveAttribute('data-map-size', '256');
  await expect(canvas).toHaveAttribute('data-map-preset', 'archipelago');
  await expect(canvas).toHaveAttribute('data-pixel-tiles', 'true');
  await expect(canvas).toHaveAttribute('data-terrain-lod', 'macro-1px');
  await expect.poll(async () => Number(await canvas.getAttribute('data-tick'))).toBeGreaterThan(20);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-settlement-labels')))
    .toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-settlement-labels-visible', 'true');

  const initialBounds = await canvas.boundingBox();
  if (!initialBounds) throw new Error('世界画布缺少可交互区域');
  const firstVillageScreen = (await canvas.getAttribute('data-first-village-screen'))
    ?.split(',')
    .map(Number);
  if (!firstVillageScreen || firstVillageScreen.some(Number.isNaN)) {
    throw new Error('首个聚落缺少屏幕坐标');
  }
  await page.mouse.move(
    initialBounds.x + (firstVillageScreen[0] ?? 0),
    initialBounds.y + (firstVillageScreen[1] ?? 0),
  );
  await expect(canvas).toHaveAttribute('data-hover-highlight', 'true');
  await expect(canvas).toHaveAttribute('data-hover-target', /^village:/);
  await expect(canvas).toHaveAttribute('data-hover-stroke-px', '1');

  await page.getByTestId('ecology-stat').click();
  const ecologyPanel = page.getByTestId('ecology-panel');
  await expect(ecologyPanel).toBeVisible();
  await expect(ecologyPanel).toContainText('鱼');
  await ecologyPanel.getByRole('button', { name: '收起生态图鉴' }).click();

  const rebuildsBeforeFrames = Number(await canvas.getAttribute('data-full-rebuilds'));
  await page.waitForTimeout(1_200);
  expect(Number(await canvas.getAttribute('data-full-rebuilds'))).toBe(rebuildsBeforeFrames);

  await page.getByRole('button', { name: '世界菜单' }).click();
  const worldLaws = page.getByTestId('world-law-options');
  const animalReturnLaw = worldLaws.locator('button').first();
  const civilizationLaw = worldLaws.locator('button').nth(1);
  await expect(animalReturnLaw).toContainText('动物自然回归');
  await expect(animalReturnLaw).toHaveClass(/active/);
  await expect(civilizationLaw).toContainText('文明自然觉醒');
  await expect(civilizationLaw).not.toHaveClass(/active/);
  await animalReturnLaw.click();
  await expect(animalReturnLaw).not.toHaveClass(/active/);
  await animalReturnLaw.click();
  await page.getByLabel('世界种子').fill('E2E-PIXEL-WORLD');
  await page.getByTestId('world-size-options').getByRole('button', { name: /中型/ }).click();
  await page.getByTestId('world-preset-options').getByRole('button', { name: '群岛' }).click();
  await page.getByTestId('create-world').click();
  await expect(page.getByText('新世界正在苏醒')).toBeVisible();
  await expect(canvas).toHaveAttribute('data-map-size', '256');
  await expect(canvas).toHaveAttribute('data-map-preset', 'archipelago');

  const revisionBefore = Number(await canvas.getAttribute('data-map-revision'));
  await page.getByRole('tab', { name: '地形', exact: true }).click();
  await page.getByTestId('tool-paint-forest').click();
  await canvas.click({ position: { x: 720, y: 360 } });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-map-revision')))
    .toBeGreaterThan(revisionBefore);

  const populationBefore = Number(await canvas.getAttribute('data-population'));
  await page.getByRole('tab', { name: '生命', exact: true }).click();
  await page.getByTestId('tool-spawn-human').click();
  await canvas.click({ position: { x: 720, y: 360 } });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-population')))
    .toBeGreaterThan(populationBefore);

  const populationBeforeFish = Number(await canvas.getAttribute('data-population'));
  await page.getByTestId('tool-spawn-fish').click();
  await canvas.click({ position: { x: 120, y: 700 } });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-population')))
    .toBeGreaterThan(populationBeforeFish);

  await page.getByRole('button', { name: '8×' }).click();
  await page.getByRole('button', { name: '暂停' }).click();
  const pausedTick = Number(await canvas.getAttribute('data-tick'));
  await page.waitForTimeout(500);
  expect(Number(await canvas.getAttribute('data-tick'))).toBeLessThanOrEqual(pausedTick + 8);
  await page.getByRole('button', { name: '继续' }).click();

  await page.getByTestId('population-stat').click();
  const populationPanel = page.getByTestId('population-panel');
  await expect(populationPanel).toBeVisible();
  await expect(populationPanel.getByText('承载力')).toBeVisible();
  await expect(populationPanel.getByLabel('年龄结构')).toBeVisible();
  await populationPanel.getByRole('button', { name: '收起人口脉络' }).click();

  await page.getByRole('tab', { name: '神力', exact: true }).click();
  await page.getByTestId('power-rain').click();
  await canvas.click({ position: { x: 720, y: 360 } });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-active-rain')))
    .toBeGreaterThan(0);

  await page.getByTestId('chronicle-toggle').click();
  await page.getByTestId('follow-resident').click();
  const residentInspector = page.getByTestId('entity-inspector');
  await expect(residentInspector).toBeVisible();
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('resident');
  await expect(canvas).toHaveAttribute('data-terrain-lod', 'resident-4px');
  await residentInspector.getByRole('tab', { name: '成长' }).click();
  await expect(residentInspector.getByText(/等级 \d+/)).toBeVisible();
  await residentInspector.getByRole('tab', { name: '装备' }).click();
  await expect(residentInspector.getByText('武器')).toBeVisible();
  await residentInspector.getByRole('tab', { name: '经历' }).click();
  await expect(residentInspector.locator('.resident-history')).toBeVisible();
  await residentInspector.getByRole('button', { name: '收藏居民' }).click();
  await expect(residentInspector.getByRole('button', { name: '取消收藏' })).toBeVisible();
  await residentInspector.getByRole('button', { name: '关闭' }).click();

  await page.getByTestId('village-chip-1').click();
  await expect(page.getByTestId('village-inspector')).toBeVisible();
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('settlement');
  await expect(canvas).toHaveAttribute('data-terrain-lod', 'districts-4px');
  await expect(canvas).toHaveAttribute('data-selection-outline', 'true');
  await expect(canvas).toHaveAttribute('data-selection-stroke-px', '1.5');
  await expect(canvas).toHaveAttribute('data-selected-target', 'village:1');
  await page.getByTestId('village-inspector').getByRole('button', { name: '关闭' }).click();
  await expect(canvas).toHaveAttribute('data-selection-outline', 'false');
  await page.getByTestId('return-to-world').click();
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('world');

  await page.getByRole('button', { name: '世界菜单' }).click();
  const firstSlot = page.locator('.save-slot').first();
  await firstSlot.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('世界已保存到档案 1')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '世界菜单' }).click();
  await page.locator('.save-slot').first().getByRole('button', { name: '载入' }).click();
  await expect(page.getByText('世界已载入')).toBeVisible();
  await expect(page.getByLabel('纪元谷像素世界')).toHaveAttribute('data-map-preset', 'archipelago');
});

test('runs the complete 384 world with 1000 residents and independent resource nodes', async ({
  page,
}) => {
  await page.goto('/?worldStress=1000&mapSize=384');
  const canvas = page.getByLabel('纪元谷像素世界');
  await expect(canvas).toHaveAttribute('data-map-size', '384');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-resource-nodes')))
    .toBeGreaterThan(25_000);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-population')))
    .toBeGreaterThan(1_000);
  const rebuilds = Number(await canvas.getAttribute('data-full-rebuilds'));
  await page.waitForTimeout(1_200);
  expect(Number(await canvas.getAttribute('data-full-rebuilds'))).toBe(rebuilds);

  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('完整世界画布缺少可交互区域');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let step = 0; step < 6; step += 1) await page.mouse.wheel(0, -180);
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('resident');
  const resourceHover = page.getByTestId('resource-hover');
  for (let row = 2; row <= 7 && !(await resourceHover.isVisible()); row += 1) {
    for (let column = 2; column <= 10 && !(await resourceHover.isVisible()); column += 1) {
      await page.mouse.move(
        bounds.x + (bounds.width * column) / 12,
        bounds.y + (bounds.height * row) / 9,
      );
    }
  }
  await expect(resourceHover).toBeVisible();
  await expect(resourceHover).toContainText(/树木|露天石料|金属矿脉/);
  await expect(canvas).toHaveAttribute('data-hover-target', /^resource:/);
  await page.getByRole('button', { name: '性能监视' }).click();
  await page.waitForTimeout(3_000);
  const metrics = await page.evaluate(() => window.__EON_METRICS__);
  console.info(JSON.stringify({ scenario: 'complete-384-world', ...metrics }));
  expect(metrics).toBeTruthy();
  expect(metrics?.fps ?? 0).toBeGreaterThanOrEqual(60);
  expect(metrics?.frameP95Ms ?? 999).toBeLessThanOrEqual(25);
  expect(metrics?.averageTickMs ?? 999).toBeLessThanOrEqual(4);
});

for (const population of [100, 500, 1_000]) {
  test(`measures the representative PixiJS scene with ${population} residents`, async ({
    page,
  }) => {
    await page.goto(`/?stress=${population}`);
    const canvas = page.getByLabel('纪元谷像素世界');
    await expect(canvas).toHaveAttribute('data-renderer', 'pixi-v8-webgl-2d');
    await expect(canvas).toHaveAttribute('data-pixel-tiles', 'true');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-tick')))
      .toBeGreaterThan(40);
    await expect(canvas).toHaveAttribute('data-population', String(population));

    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('世界画布缺少可交互区域');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    for (let step = 0; step < 6; step += 1) await page.mouse.wheel(0, -180);
    await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('resident');
    await expect(canvas).toHaveAttribute('data-terrain-lod', 'resident-4px');
    const visibleResidents = Number(await canvas.getAttribute('data-resident-visible'));
    expect(visibleResidents).toBeGreaterThan(0);
    expect(visibleResidents).toBeLessThan(population);

    await page.getByRole('button', { name: '性能监视' }).click();
    await page.waitForTimeout(2_500);
    const metrics = await page.evaluate(() => window.__EON_METRICS__);
    console.info(JSON.stringify({ population, visibleResidents, ...metrics }));
    expect(metrics).toBeTruthy();
    expect(metrics?.fps ?? 0).toBeGreaterThan(20);
    expect(metrics?.frameP95Ms ?? 999).toBeLessThan(50);
    expect(metrics?.drawCalls ?? 999).toBeLessThanOrEqual(20);
    expect(metrics?.triangles ?? 999_999).toBeLessThan(30_000);
    expect(await canvas.getAttribute('data-metric-source')).toBe('pixi-batch-estimate');
  });
}
