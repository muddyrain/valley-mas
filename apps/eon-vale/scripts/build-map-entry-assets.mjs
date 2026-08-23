import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(packageRoot, 'public', 'map', 'ui', 'templates');
const templateIds = [
  'continent',
  'twin_continents',
  'archipelago',
  'island_chain',
  'inland_sea',
  'ring_continent',
  'fractured_coast',
  'tri_continents',
];
const installedBrowser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(installedBrowser === undefined ? {} : { executablePath: installedBrowser }),
});

try {
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  await page.setContent(
    '<style>html,body{margin:0;background:transparent}canvas{display:block;width:128px;height:128px;image-rendering:pixelated}</style><canvas width="64" height="64"></canvas>',
  );
  for (const [index, templateId] of templateIds.entries()) {
    await page.evaluate(
      ({ templateId, seed }) => {
        const canvas = document.querySelector('canvas');
        const context = canvas.getContext('2d', { alpha: true });
        const width = canvas.width;
        const height = canvas.height;
        const image = context.createImageData(width, height);
        const colors = {
          deep: [25, 60, 88, 255],
          ocean: [38, 105, 139, 255],
          shallow: [91, 164, 177, 255],
          coast: [218, 198, 121, 255],
          grass: [105, 146, 73, 255],
          woodland: [56, 105, 67, 255],
          dry: [159, 145, 76, 255],
          highland: [102, 111, 92, 255],
          snow: [206, 216, 199, 255],
        };
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const nx = (x / (width - 1)) * 2 - 1;
            const ny = (y / (height - 1)) * 2 - 1;
            const field = templateField(templateId, nx, ny, seed);
            const local = noise(x, y, seed);
            let color = colors.deep;
            if (field > -0.12) color = colors.ocean;
            if (field > -0.035) color = colors.shallow;
            if (field > 0.015) color = colors.coast;
            if (field > 0.075) {
              const climate = noise(Math.floor(x / 4), Math.floor(y / 4), seed ^ 0x9e37);
              color = climate > 0.67 ? colors.woodland : climate < 0.24 ? colors.dry : colors.grass;
              if (local > 0.92) color = colors.highland;
              if (ny < -0.55 && local > 0.72) color = colors.snow;
            }
            image.data.set(color, (y * width + x) * 4);
          }
        }
        context.putImageData(image, 0, 0);

        function templateField(id, x, y, baseSeed) {
          const warpX =
            (noise(Math.floor((x + 1) * 9), Math.floor((y + 1) * 9), baseSeed) - 0.5) * 0.18;
          const warpY =
            (noise(Math.floor((x + 1) * 7), Math.floor((y + 1) * 7), baseSeed ^ 0x85eb) - 0.5) *
            0.16;
          const px = x + warpX;
          const py = y + warpY;
          const rough =
            (noise(Math.floor((x + 1) * 21), Math.floor((y + 1) * 21), baseSeed ^ 0xc2b2) - 0.5) *
            0.14;
          const ellipse = (cx, cy, rx, ry) => 1 - Math.hypot((px - cx) / rx, (py - cy) / ry);
          if (id === 'twin_continents') {
            let value = Math.max(
              ellipse(-0.5, -0.04, 0.4, 0.68),
              ellipse(0.5, 0.04, 0.4, 0.65),
              ellipse(-0.73, 0.32, 0.2, 0.16),
              ellipse(0.73, -0.34, 0.18, 0.15),
            );
            for (let island = 0; island < 5; island += 1) {
              const angle = island * 1.34 + 0.2;
              value = Math.max(
                value,
                ellipse(Math.cos(angle) * 0.84, Math.sin(angle) * 0.72, 0.09, 0.07),
              );
            }
            return value + rough * 0.65;
          }
          if (id === 'archipelago') {
            let value = -1;
            for (let island = 0; island < 11; island += 1) {
              const angle = island * 2.39 + baseSeed * 0.001;
              const radius = 0.18 + (island % 4) * 0.16;
              value = Math.max(
                value,
                ellipse(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.2, 0.14),
              );
            }
            return value + rough * 0.7;
          }
          if (id === 'island_chain') {
            let value = -1;
            for (let island = 0; island < 6; island += 1) {
              const t = island / 5;
              value = Math.max(
                value,
                ellipse(
                  -0.74 + t * 1.48,
                  0.56 - t * 1.12 + Math.sin(t * Math.PI) * 0.18,
                  0.15,
                  0.11,
                ),
              );
            }
            return value + rough * 0.5;
          }
          if (id === 'inland_sea') {
            return (
              Math.min(ellipse(0, 0, 0.88, 0.82), Math.hypot(px / 0.38, py / 0.3) - 0.62) + rough
            );
          }
          if (id === 'ring_continent')
            return 0.34 - Math.abs(Math.hypot(px * 0.95, py) - 0.58) + rough;
          if (id === 'fractured_coast') {
            const split = Math.max(
              ellipse(-0.2, -0.2, 0.74, 0.48),
              ellipse(0.22, 0.24, 0.68, 0.46),
              ellipse(-0.58, 0.48, 0.28, 0.22),
              ellipse(0.62, -0.46, 0.3, 0.24),
            );
            return split + rough * 1.5;
          }
          if (id === 'tri_continents') {
            let value = Math.max(
              ellipse(-0.44, -0.4, 0.36, 0.31),
              ellipse(0.44, -0.36, 0.35, 0.32),
              ellipse(0.02, 0.47, 0.5, 0.32),
            );
            for (let island = 0; island < 6; island += 1) {
              const angle = island * 1.11 + 0.35;
              value = Math.max(
                value,
                ellipse(Math.cos(angle) * 0.84, Math.sin(angle) * 0.75, 0.08, 0.065),
              );
            }
            return value + rough * 0.7;
          }

          let value = ellipse(-0.02, 0.02, 0.76, 0.82) + rough;
          for (let island = 0; island < 5; island += 1) {
            const angle = island * 1.37 + 0.3;
            value = Math.max(
              value,
              ellipse(Math.cos(angle) * 0.82, Math.sin(angle) * 0.7, 0.13, 0.1),
            );
          }
          return value;
        }

        function noise(x, y, baseSeed) {
          let value = (baseSeed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77)) >>> 0;
          value ^= value >>> 16;
          value = Math.imul(value, 0x7feb352d);
          value ^= value >>> 15;
          value = Math.imul(value, 0x846ca68b);
          return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
        }
      },
      { templateId, seed: 0x5f37_59df ^ Math.imul(index + 1, 0x9e37) },
    );
    await page.locator('canvas').screenshot({ path: path.join(outputRoot, `${templateId}.png`) });
  }
} finally {
  await browser.close();
}
