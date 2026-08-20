import { expect, test } from '@playwright/test';

const longEightTimesMinutes = Number(process.env.EON_EIGHT_TIMES_SOAK_MINUTES ?? 0);

test.skip(true, 'legacy runtime acceptance is frozen during the vertical domain replacement');

test.describe('long 8x browser soak', () => {
  test.skip(longEightTimesMinutes <= 0, 'set EON_EIGHT_TIMES_SOAK_MINUTES to enable');
  test.setTimeout(Math.max(90_000, longEightTimesMinutes * 70_000));

  test('keeps the complete world responsive without changing player speed', async ({ page }) => {
    await page.goto('/?worldStress=1000&mapSize=384');
    const canvas = page.getByLabel('纪元谷像素世界');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-resource-nodes')))
      .toBeGreaterThan(25_000);
    await page.keyboard.press('4');
    const eightTimes = page.getByRole('button', { name: '8×', exact: true });
    await expect(eightTimes).toHaveClass(/active/);
    await page.getByRole('button', { name: '性能监视' }).click();

    let previousTick = Number(await canvas.getAttribute('data-tick'));
    for (let minute = 1; minute <= longEightTimesMinutes; minute += 1) {
      await page.waitForTimeout(60_000);
      const currentTick = Number(await canvas.getAttribute('data-tick'));
      const metrics = await page.evaluate(() => window.__EON_METRICS__);
      const redraws = await canvas.evaluate((element) => ({
        mapDeltaCells: element.dataset.mapDeltaCells,
        mapDeltaRedrawChunks: element.dataset.mapDeltaRedrawChunks,
        mapDeltaRedrawMs: element.dataset.mapDeltaRedrawMs,
        mapDeltaRedrawMaxMs: element.dataset.mapDeltaRedrawMaxMs,
        resourceRedrawChunks: element.dataset.resourceRedrawChunks,
        resourceRedrawMs: element.dataset.resourceRedrawMs,
        resourceRedrawMaxMs: element.dataset.resourceRedrawMaxMs,
      }));
      console.info(
        JSON.stringify({
          scenario: 'long-8x-browser',
          minute,
          tick: currentTick,
          ...metrics,
          ...redraws,
        }),
      );
      expect(currentTick).toBeGreaterThan(previousTick);
      await expect(eightTimes).toHaveClass(/active/);
      expect(metrics?.fps ?? 0).toBeGreaterThanOrEqual(60);
      expect(metrics?.frameP95Ms ?? 999).toBeLessThanOrEqual(25);
      expect(metrics?.averageTickMs ?? 999).toBeLessThanOrEqual(4);
      expect(metrics?.drawCalls ?? 999).toBeLessThanOrEqual(20);
      expect(metrics?.triangles ?? 999_999).toBeLessThan(30_000);
      expect(metrics?.pathQueue ?? 999_999).toBeLessThan(2_000);
      previousTick = currentTick;
    }
  });
});

test('controls pause and speed from the keyboard without hijacking dialogs', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');
  await expect.poll(async () => Number(await canvas.getAttribute('data-tick'))).toBeGreaterThan(10);

  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: '8×', exact: true })).toHaveClass(/active/);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '继续' })).toBeVisible();
  const pausedTick = Number(await canvas.getAttribute('data-tick'));
  await page.waitForTimeout(350);
  expect(Number(await canvas.getAttribute('data-tick'))).toBeLessThanOrEqual(pausedTick + 8);

  await page.getByRole('button', { name: '世界菜单' }).click();
  await page.getByLabel('世界种子').focus();
  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: '8×', exact: true })).toHaveClass(/active/);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: '暂停' })).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: '1×', exact: true })).toHaveClass(/active/);
});

test('creates, shapes, follows, saves and reloads a living pixel world', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('纪元谷像素世界');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-renderer', 'pixi-v8-webgl-2d');
  await expect(canvas).toHaveAttribute('data-camera-mode', 'pixel-2d-pan-zoom');
  await expect(canvas).toHaveAttribute('data-no-tilt', 'true');
  await expect(canvas).toHaveAttribute('data-no-rotation', 'true');
  await expect(canvas).toHaveAttribute('data-human-style', 'layered-pixel-sprites');
  await expect(canvas).toHaveAttribute('data-animal-style', 'formal-pixel-side-profiles');
  await expect(canvas).toHaveAttribute('data-animal-styles', '7');
  await expect(canvas).toHaveAttribute('data-building-style', 'formal-functional-pixel-buildings');
  await expect(canvas).toHaveAttribute('data-building-profiles', '12');
  await expect(canvas).toHaveAttribute('data-visual-rollout', 'formal-full-world');
  await expect(canvas).toHaveAttribute(
    'data-formal-asset-sample',
    'resident-deer-wolf-tree-home-storage',
  );
  await expect(canvas).toHaveAttribute('data-resident-asset-size', '24x32');
  await expect(canvas).toHaveAttribute('data-animal-asset-size', '24x24');
  await expect(canvas).toHaveAttribute('data-tree-asset-size', '32x48');
  await expect(canvas).toHaveAttribute('data-building-asset-size', '48x48');
  await expect(canvas).toHaveAttribute(
    'data-terrain-layers',
    'terrain-height-temperature-moisture-surface',
  );
  await expect(canvas).toHaveAttribute('data-entity-lod', 'hidden');
  await expect(canvas).toHaveAttribute('data-resource-lod', 'cluster');
  await expect(canvas).toHaveAttribute('data-building-lod', 'settlement-outline');
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
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-territory-revision')))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('territory');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-strategic-territories', 'true');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-strategic-territory-cells')))
    .toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-kingdom-borders', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-village-borders', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-capital-markers', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-kingdom-adjacencies', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-war-fronts', /^\d+$/);

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
  await expect(ecologyPanel).toContainText(/出生 \d+ · 死亡 \d+/);
  await expect(ecologyPanel.getByTestId('ecology-food-chain')).toContainText(/新鲜尸体 \d+/);
  await expect(ecologyPanel.getByTestId('ecology-food-chain')).toContainText(/捕获鱼 \d+/);
  await ecologyPanel.getByRole('button', { name: '收起生态图鉴' }).click();

  const rebuildsBeforeFrames = Number(await canvas.getAttribute('data-full-rebuilds'));
  await page.waitForTimeout(1_200);
  expect(Number(await canvas.getAttribute('data-full-rebuilds'))).toBe(rebuildsBeforeFrames);

  await page.getByRole('button', { name: '世界菜单' }).click();
  const worldLaws = page.getByTestId('world-law-options');
  const hungerLaw = worldLaws.getByRole('button', { name: '饥饿' });
  const animalReturnLaw = worldLaws.getByRole('button', { name: '动物自然回归' });
  const civilizationLaw = worldLaws.getByRole('button', { name: '文明重启' });
  await expect(hungerLaw).toHaveClass(/active/);
  await expect(animalReturnLaw).toContainText('动物自然回归');
  await expect(animalReturnLaw).toHaveClass(/active/);
  await expect(civilizationLaw).toContainText('文明重启');
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
  const historyArchive = page.getByTestId('history-archive');
  await expect(historyArchive).toBeVisible();
  await historyArchive.getByRole('tab', { name: '村庄', exact: true }).click();
  await expect(historyArchive.locator('[data-testid^="history-event-"]').first()).toBeVisible();
  await historyArchive.getByRole('tab', { name: '全部', exact: true }).click();
  await historyArchive.locator('[data-testid^="history-link-entity-"]').first().click();
  const residentInspector = page.getByTestId('entity-inspector');
  await expect(residentInspector).toBeVisible();
  await expect(residentInspector.getByText('原因', { exact: true })).toBeVisible();
  await expect(residentInspector.getByText('阶段', { exact: true })).toBeVisible();
  await expect(residentInspector.getByText('目的地', { exact: true })).toBeVisible();
  await expect(residentInspector.getByText('预期结果', { exact: true })).toBeVisible();
  await expect(residentInspector.getByText('携带', { exact: true })).toBeVisible();
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('resident');
  await expect(canvas).toHaveAttribute('data-terrain-lod', 'resident-4px');
  await expect(canvas).toHaveAttribute('data-entity-lod', 'full');
  await expect(canvas).toHaveAttribute('data-resource-lod', 'detailed');
  await expect(canvas).toHaveAttribute('data-building-lod', 'detailed');
  await expect(canvas).toHaveAttribute('data-tree-canopy-occlusion', 'split-front-back');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-tree-canopy-front')))
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-visible-cells-width')))
    .toBeLessThanOrEqual(64);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-visible-cells-height')))
    .toBeLessThanOrEqual(36);
  await residentInspector.getByRole('tab', { name: '成长' }).click();
  await expect(residentInspector.getByText(/等级 \d+/)).toBeVisible();
  await residentInspector.getByRole('tab', { name: '装备' }).click();
  await expect(residentInspector.getByText('武器')).toBeVisible();
  await residentInspector.getByRole('tab', { name: '经历' }).click();
  await expect(residentInspector.locator('.resident-history')).toBeVisible();
  await residentInspector.getByRole('button', { name: '收藏居民' }).click();
  await expect(residentInspector.getByRole('button', { name: '取消收藏' })).toBeVisible();
  await residentInspector.getByRole('button', { name: '关闭' }).click();

  await historyArchive.getByRole('tab', { name: '收藏人物', exact: true }).click();
  await expect(historyArchive.locator('[data-testid^="history-event-"]').first()).toBeVisible();
  await historyArchive.locator('[data-testid^="history-link-village-"]').first().click();
  const villageInspector = page.getByTestId('village-inspector');
  await expect(villageInspector).toBeVisible();
  await expect.poll(async () => canvas.getAttribute('data-view-level')).toBe('settlement');
  await expect(canvas).toHaveAttribute('data-terrain-lod', 'districts-4px');
  await expect(canvas).toHaveAttribute('data-entity-lod', 'sampled');
  await expect(canvas).toHaveAttribute('data-resource-lod', 'simplified');
  await expect(canvas).toHaveAttribute('data-building-lod', 'simplified');
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-settlement-tier-glyphs')))
    .toBeGreaterThan(0);
  await expect(canvas).toHaveAttribute('data-selection-outline', 'true');
  await expect(canvas).toHaveAttribute('data-selection-stroke-px', '1.5');
  await expect(canvas).toHaveAttribute('data-selected-target', /^village:\d+$/);
  const constructionPriority = villageInspector.getByRole('combobox', { name: '建设优先' });
  await constructionPriority.selectOption('food');
  await expect(constructionPriority).toHaveValue('food');
  await expect(page.getByTestId('village-development')).toContainText('下一阶段');
  await expect(page.getByTestId('village-chronicle')).toContainText('聚落纪事');
  await villageInspector.getByRole('button', { name: '住宅区', exact: true }).click();
  const planningBounds = await canvas.boundingBox();
  if (!planningBounds) throw new Error('规划模式缺少地图画布');
  await canvas.click({ position: { x: planningBounds.width / 2, y: planningBounds.height / 2 } });
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-planning-zone-cells')))
    .toBeGreaterThan(0);
  await expect(page.getByTestId('village-work-hotspots')).toContainText('住宅规划');
  await expect(page.getByTestId('village-capabilities')).toContainText('守卫训练');
  await expect(page.getByTestId('village-capabilities')).toContainText('城墙防线');
  await expect(page.getByTestId('village-capabilities')).toContainText('边境警戒');
  await villageInspector.getByRole('button', { name: '关闭' }).click();
  await expect(canvas).toHaveAttribute('data-selection-outline', 'false');

  const buildingScreen = (await canvas.getAttribute('data-first-building-screen'))
    ?.split(',')
    .map(Number);
  const settlementBounds = await canvas.boundingBox();
  if (!settlementBounds || !buildingScreen || buildingScreen.some(Number.isNaN)) {
    throw new Error('首个建筑缺少聚落层屏幕坐标');
  }
  await canvas.click({ position: { x: buildingScreen[0] ?? 0, y: buildingScreen[1] ?? 0 } });
  const buildingInspector = page.getByTestId('building-inspector');
  await expect(buildingInspector).toBeVisible();
  await expect(buildingInspector.getByText('能力', { exact: true })).toBeVisible();
  await expect(buildingInspector.getByText('输入', { exact: true })).toBeVisible();
  await expect(buildingInspector.getByText('输出', { exact: true })).toBeVisible();
  await buildingInspector.getByRole('button', { name: '关闭' }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('work');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-work-hotspot-participants')))
    .toBeGreaterThan(0);
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
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('territory');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-strategic-territories', 'true');
  await page.keyboard.press('4');
  await expect(page.getByRole('button', { name: '8×', exact: true })).toHaveClass(/active/);
  await page.getByRole('button', { name: '性能监视' }).click();
  await page.waitForTimeout(6_000);
  const metrics = await page.evaluate(() => window.__EON_METRICS__);
  console.info(JSON.stringify({ scenario: 'complete-384-world', ...metrics }));
  expect(metrics).toBeTruthy();
  expect(metrics?.fps ?? 0).toBeGreaterThanOrEqual(60);
  expect(metrics?.frameP95Ms ?? 999).toBeLessThanOrEqual(25);
  expect(metrics?.averageTickMs ?? 999).toBeLessThanOrEqual(4);
  expect(metrics?.drawCalls ?? 999).toBeLessThanOrEqual(20);
  expect(metrics?.triangles ?? 999_999).toBeLessThan(30_000);
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
    expect(metrics?.fps ?? 0).toBeGreaterThanOrEqual(60);
    expect(metrics?.frameP95Ms ?? 999).toBeLessThanOrEqual(25);
    if (population === 1_000) {
      expect(metrics?.averageTickMs ?? 999).toBeLessThanOrEqual(2.5);
    }
    expect(metrics?.drawCalls ?? 999).toBeLessThanOrEqual(20);
    expect(metrics?.triangles ?? 999_999).toBeLessThan(30_000);
    expect(await canvas.getAttribute('data-metric-source')).toBe('pixi-batch-estimate');
  });
}

test('observes a real kingdom through capital, borders and selection focus', async ({ page }) => {
  await page.goto('/?seed=civilization-loop&initialHumans=72&mapSize=128');
  const canvas = page.getByLabel('纪元谷像素世界');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('territory');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '8×', exact: true }).click();

  await expect
    .poll(async () => Number(await canvas.getAttribute('data-capital-markers')), {
      timeout: 50_000,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-kingdom-borders')))
    .toBeGreaterThan(0);

  await page.getByTestId('chronicle-toggle').click();
  const historyArchive = page.getByTestId('history-archive');
  await historyArchive.getByRole('tab', { name: '王国', exact: true }).click();
  await historyArchive.getByTestId('history-link-kingdom-1').first().click();
  const inspector = page.getByTestId('kingdom-inspector');
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('首都');
  await expect(inspector).toContainText(/邻国 \d+/);
  await expect(inspector.getByRole('button', { name: '定位首都' })).toBeVisible();
  await expect(inspector.getByTestId('kingdom-chronicle')).toContainText('王国纪事');
  await expect(canvas).toHaveAttribute('data-selected-target', 'kingdom:1');
  await expect(canvas).toHaveAttribute('data-observed-kingdom', '1');
  await expect(canvas).toHaveAttribute('data-kingdom-adjacencies', /^\d+$/);
  await expect(canvas).toHaveAttribute('data-war-fronts', /^\d+$/);
});
