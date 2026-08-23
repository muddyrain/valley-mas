import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(packageRoot, 'public', 'map', 'p0');
const vite = await createServer({ root: packageRoot, server: { middlewareMode: true } });
const { MAP_VISUAL_CONTRACT_BUNDLE } = await vite.ssrLoadModule(
  '/src/map/visual/MapVisualContractBundle.ts',
);
const installedBrowser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
const browser = await chromium.launch({
  headless: true,
  ...(installedBrowser === undefined ? {} : { executablePath: installedBrowser }),
});

try {
  await mkdir(outputRoot, { recursive: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent('<canvas></canvas>');
  for (const atlas of MAP_VISUAL_CONTRACT_BUNDLE.manifest.atlases) {
    const atlasAssets = MAP_VISUAL_CONTRACT_BUNDLE.manifest.assets.filter(
      ({ atlasPageId }) => atlasPageId === atlas.id,
    );
    await page.evaluate(
      ({ atlas, assets }) => {
        const canvas = document.querySelector('canvas');
        canvas.width = atlas.width;
        canvas.height = atlas.height;
        canvas.style.width = `${atlas.width}px`;
        canvas.style.height = `${atlas.height}px`;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, atlas.width, atlas.height);
        context.imageSmoothingEnabled = false;
        for (const [assetIndex, asset] of assets.entries()) {
          for (const [frameIndex, frame] of asset.frames.entries()) {
            drawContractShape(context, frame, atlas.category, asset, assetIndex, frameIndex);
          }
        }

        function drawContractShape(context, frame, category, asset, assetIndex, frameIndex) {
          if (category === 'terrain-transition' && asset.autotile) {
            drawAutotileMask(context, frame, asset.autotile);
            return;
          }
          const colors = {
            'terrain-ground': ['#77945A', '#66824F', '#94AD68'],
            'terrain-transition': ['#D0BC7A', '#AF995F', '#E2D294'],
            water: ['#32769A', '#63AFC0', '#234968'],
            vegetation: ['#41653F', '#66824F', '#94AD68'],
            'ground-decoration': ['#AF995F', '#D7A849', '#94AD68'],
            landmark: ['#596466', '#7A7C70', '#A0A28D'],
            effects: ['rgba(23,42,50,.45)', 'rgba(86,54,104,.7)', 'rgba(181,200,122,.7)'],
            'lod-world': ['#41653F', '#D0BC7A', '#63AFC0'],
          }[category];
          const primary = semanticColor(asset, colors[(assetIndex + frameIndex) % colors.length]);
          const secondary = colors[(assetIndex + frameIndex + 1) % colors.length];
          const inset = Math.max(0, Math.floor(Math.min(frame.width, frame.height) / 6));
          context.fillStyle = primary;
          context.fillRect(
            frame.x + inset,
            frame.y + inset,
            frame.width - inset * 2,
            frame.height - inset * 2,
          );
          if (frame.width >= 8 && frame.height >= 8) {
            const crownHeight = Math.max(2, Math.floor(frame.height * 0.45));
            context.clearRect(frame.x, frame.y, frame.width, Math.max(1, inset));
            context.fillStyle = secondary;
            context.fillRect(
              frame.x + Math.floor(frame.width / 4),
              frame.y + inset,
              Math.ceil(frame.width / 2),
              crownHeight,
            );
            context.fillRect(
              frame.x + Math.floor(frame.width / 2) - 1,
              frame.y + crownHeight,
              2,
              frame.height - crownHeight - inset,
            );
          } else if ((assetIndex + frameIndex) % 3 === 0) {
            context.fillStyle = secondary;
            context.fillRect(frame.x + frame.width - 1, frame.y, 1, frame.height);
          }
        }

        function semanticColor(asset, fallback) {
          const landform = asset.tags.landforms[0];
          if (landform === 'deep_ocean') return '#234968';
          if (landform === 'open_ocean') return '#32769A';
          if (landform === 'shallow_water') return '#63AFC0';
          if (landform === 'coast') return '#D7C987';
          const material = asset.tags.groundMaterials[0];
          return {
            vegetated_soil: '#82A85A',
            bare_soil: '#A88955',
            sand: '#C9B66F',
            mud: '#6F7650',
            rock: '#69766B',
            snow: '#C5DAD0',
            ice: '#9BC6CA',
          }[material] ?? fallback;
        }

        function drawAutotileMask(context, frame, autotile) {
          const masks = [...new Set(Array.from({ length: 256 }, (_, mask) => normalize(mask)))].sort(
            (left, right) => left - right,
          );
          const connected = masks[autotile.topologyCode] ?? 0;
          context.fillStyle = ['#D7C987', '#C3AF69', '#E0D598'][autotile.edgeRhythm - 1];
          const x = frame.x;
          const y = frame.y;
          if ((connected & 1) === 0) context.fillRect(x, y, 4, 1);
          if ((connected & 2) === 0) context.fillRect(x + 3, y, 1, 4);
          if ((connected & 4) === 0) context.fillRect(x, y + 3, 4, 1);
          if ((connected & 8) === 0) context.fillRect(x, y, 1, 4);
          if (autotile.edgeRhythm === 2) context.fillRect(x + 1, y + 1, 1, 1);
          if (autotile.edgeRhythm === 3) context.fillRect(x + 2, y + 2, 1, 1);
        }

        function normalize(mask) {
          let normalized = mask & 15;
          if ((mask & 3) === 3 && (mask & 16) !== 0) normalized |= 16;
          if ((mask & 6) === 6 && (mask & 32) !== 0) normalized |= 32;
          if ((mask & 12) === 12 && (mask & 64) !== 0) normalized |= 64;
          if ((mask & 9) === 9 && (mask & 128) !== 0) normalized |= 128;
          return normalized;
        }
      },
      { atlas, assets: atlasAssets },
    );
    await page.locator('canvas').screenshot({
      path: path.join(outputRoot, `${atlas.id}.png`),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
  await vite.close();
}
