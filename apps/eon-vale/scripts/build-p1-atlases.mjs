import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = process.argv.includes('--world-lod')
  ? 'builtin'
  : process.argv.includes('--p2-3')
    ? 'p2-3'
    : process.argv.includes('--p2-2')
      ? 'p2-2'
      : process.argv.includes('--p2')
        ? 'p2'
        : 'p1';
const outputRoot = path.join(packageRoot, 'public', 'map', stage);
const contactSheetRoot = path.join(
  packageRoot,
  'output',
  stage === 'builtin'
    ? 'p2-4-acceptance'
    : stage === 'p2-3'
      ? 'p2-3-acceptance'
      : stage === 'p2-2'
        ? 'p2-2-acceptance'
        : stage === 'p2'
          ? 'p2-1-acceptance'
          : 'p1-acceptance',
  'contact-sheets',
);
const vite = await createServer({ root: packageRoot, server: { middlewareMode: true } });
const bundleModule = await vite.ssrLoadModule(
  stage === 'builtin'
    ? '/src/map/visual/BuiltInMapVisualBundle.ts'
    : stage === 'p2-3'
      ? '/src/map/visual/ColdMapVisualBundle.ts'
      : stage === 'p2-2'
        ? '/src/map/visual/DryMapVisualBundle.ts'
        : stage === 'p2'
          ? '/src/map/visual/WetHotMapVisualBundle.ts'
          : '/src/map/visual/TemperateMapVisualBundle.ts',
);
const visualBundle =
  stage === 'builtin'
    ? bundleModule.BUILT_IN_MAP_VISUAL_BUNDLE
    : stage === 'p2-3'
      ? bundleModule.COLD_MAP_VISUAL_BUNDLE
      : stage === 'p2-2'
        ? bundleModule.DRY_MAP_VISUAL_BUNDLE
        : stage === 'p2'
          ? bundleModule.WET_HOT_MAP_VISUAL_BUNDLE
          : bundleModule.TEMPERATE_MAP_VISUAL_BUNDLE;
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
  await mkdir(contactSheetRoot, { recursive: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent('<canvas></canvas>');
  const silhouetteFamilies = [
    'ground_cover.grass_tuft',
    'vegetation.reed_high_grass',
    'vegetation.bush',
    'vegetation.cactus_succulent',
    'ground_cover.small_stone',
    'object.rock_cluster',
    'object.deadwood_stump',
    'object.dead_tree',
  ];
  const silhouetteResults = new Map(
    silhouetteFamilies.map((family) => [family, { ids: [], signatures: new Set() }]),
  );
  for (const atlas of visualBundle.manifest.atlases) {
    if (stage === 'builtin' && atlas.id !== 'lod-world-detailed-01') continue;
    const atlasAssets = visualBundle.manifest.assets.filter(
      ({ atlasPageId }) => atlasPageId === atlas.id,
    );
    const atlasSilhouettes = await page.evaluate(
      ({ atlas, assets, p2, p22, p23 }) => {
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
            drawP1Asset(context, frame, atlas.category, asset, assetIndex, frameIndex);
          }
        }

        const trackedFamilies = new Set([
          'ground_cover.grass_tuft',
          'vegetation.reed_high_grass',
          'vegetation.bush',
          'vegetation.cactus_succulent',
          'ground_cover.small_stone',
          'object.rock_cluster',
          'object.deadwood_stump',
          'object.dead_tree',
        ]);
        const silhouettes = [];
        if (p22) {
          for (const asset of assets) {
            const family = asset.tags.semanticFamilies[0];
            if (
              !trackedFamilies.has(family) ||
              !asset.tags.biomes.some((biome) => biome === 'savanna' || biome === 'desert')
            ) {
              continue;
            }
            const frame = asset.frames[0];
            const pixels = context.getImageData(frame.x, frame.y, frame.width, frame.height).data;
            let minX = frame.width;
            let minY = frame.height;
            let maxX = -1;
            let maxY = -1;
            for (let py = 0; py < frame.height; py += 1) {
              for (let px = 0; px < frame.width; px += 1) {
                if (pixels[(py * frame.width + px) * 4 + 3] === 0) continue;
                minX = Math.min(minX, px);
                minY = Math.min(minY, py);
                maxX = Math.max(maxX, px);
                maxY = Math.max(maxY, py);
              }
            }
            const rows = [];
            for (let py = minY; py <= maxY; py += 1) {
              let row = '';
              for (let px = minX; px <= maxX; px += 1) {
                row += pixels[(py * frame.width + px) * 4 + 3] === 0 ? '0' : '1';
              }
              rows.push(row);
            }
            silhouettes.push({
              family,
              id: asset.id,
              signature: `${maxX - minX + 1}x${maxY - minY + 1}:${rows.join('/')}`,
            });
          }
        }

        function drawP1Asset(context, frame, category, asset, assetIndex, frameIndex) {
          if (category === 'lod-world' && asset.id.includes('.cluster_')) {
            drawWorldVegetationCluster(context, frame, asset);
            return;
          }
          if (category === 'terrain-transition' && asset.autotile) {
            drawAutotileMask(context, frame, asset.autotile);
            return;
          }
          if (asset.id === 'effects.shadow.tree.generic.v01') {
            drawTreeShadow(context, frame);
            return;
          }
          if (
            category === 'terrain-ground' &&
            asset.tags.groundMaterials.includes('vegetated_soil') &&
            asset.tags.biomes.some((biome) => biome === 'grassland' || biome === 'woodland')
          ) {
            drawTemperateGround(context, frame, asset, frameIndex);
            return;
          }
          if (
            p2 &&
            category === 'terrain-ground' &&
            asset.tags.groundMaterials.includes('vegetated_soil') &&
            asset.tags.biomes.some((biome) => biome === 'rainforest' || biome === 'wetland')
          ) {
            drawWetHotGround(context, frame, asset, frameIndex);
            return;
          }
          if (
            p23 &&
            category === 'terrain-ground' &&
            asset.tags.biomes.some((biome) => biome === 'tundra' || biome === 'polar') &&
            asset.tags.groundMaterials.some(
              (material) => material === 'snow' || material === 'ice' || material === 'rock',
            )
          ) {
            drawColdGround(context, frame, asset, frameIndex);
            return;
          }
          if (
            p22 &&
            category === 'terrain-ground' &&
            asset.tags.biomes.some((biome) => biome === 'savanna' || biome === 'desert') &&
            asset.tags.groundMaterials.some(
              (material) => material === 'bare_soil' || material === 'sand',
            )
          ) {
            drawDryGround(context, frame, asset, frameIndex);
            return;
          }
          if (p2 && category === 'terrain-ground' && asset.tags.groundMaterials.includes('mud')) {
            drawWetlandMud(context, frame, asset, frameIndex);
            return;
          }
          if (category === 'terrain-ground' && asset.tags.groundMaterials.includes('rock')) {
            drawRockGround(context, frame, asset, frameIndex);
            return;
          }
          if (asset.id === 'effects.corruption.focus.v01') {
            drawCorruptionEffect(context, frame, frameIndex);
            return;
          }
          if (category === 'water') {
            drawWater(context, frame, asset, frameIndex);
            return;
          }
          if (category === 'vegetation' && isTemperateTree(asset)) {
            drawTemperateTree(context, frame, asset, assetIndex);
            return;
          }
          if (p2 && category === 'vegetation' && isWetHotTree(asset)) {
            drawWetHotTree(context, frame, asset, assetIndex);
            return;
          }
          if (p22 && category === 'vegetation' && isDryTree(asset)) {
            drawDryTree(context, frame, asset, assetIndex);
            return;
          }
          if (p23 && category === 'vegetation' && isColdTree(asset)) {
            drawColdTree(context, frame, asset, assetIndex);
            return;
          }
          if (
            p23 &&
            (category === 'ground-decoration' || category === 'vegetation') &&
            asset.tags.biomes.some((biome) => biome === 'tundra' || biome === 'polar') &&
            drawColdDecoration(context, frame, asset)
          ) {
            return;
          }
          if (
            p22 &&
            (category === 'ground-decoration' || category === 'vegetation') &&
            asset.tags.biomes.some((biome) => biome === 'savanna' || biome === 'desert') &&
            drawDryDecoration(context, frame, asset)
          ) {
            return;
          }
          if (
            p2 &&
            (category === 'ground-decoration' || category === 'vegetation') &&
            drawWetHotDecoration(context, frame, asset)
          ) {
            return;
          }
          if (
            (category === 'ground-decoration' || category === 'vegetation') &&
            drawTemperateDecoration(context, frame, asset)
          ) {
            return;
          }
          drawContractFallback(context, frame, category, asset, assetIndex, frameIndex);
        }

        function drawWorldVegetationCluster(context, frame, asset) {
          const biome = asset.tags.biomes[0] ?? 'grassland';
          const variant = Number.parseInt(asset.id.match(/cluster_(\d+)/)?.[1] ?? '1', 10);
          const palettes = {
            grassland: ['#294B35', '#4F833F', '#78AC4C', '#A6C95D'],
            woodland: ['#1E3F30', '#35623B', '#5B9246', '#86B252'],
            rainforest: ['#10392D', '#17613A', '#269647', '#64C259'],
            savanna: ['#4E5733', '#77813F', '#A1A34A', '#C7BB5D'],
            desert: ['#65573A', '#8D7442', '#B3984B', '#D0B960'],
            wetland: ['#1F493E', '#376C55', '#5E9564', '#8ABB77'],
            tundra: ['#435C52', '#667D67', '#8FA078', '#B3BC8B'],
            polar: ['#607972', '#879F95', '#AEC1B7', '#DBE4D8'],
          };
          const colors = palettes[biome] ?? palettes.grassland;
          const patterns = [
            [4, 11, 14],
            [3, 8, 13],
            [0, 7, 12],
          ];
          const pattern = patterns[(variant - 1) % patterns.length];
          context.fillStyle = colors[0];
          for (const pixel of pattern) {
            const x = pixel % 4;
            const y = Math.floor(pixel / 4);
            context.fillRect(frame.x + x, frame.y + y, 1, 1);
          }
          context.fillStyle = colors[1];
          context.fillRect(frame.x + ((variant + 1) % 3), frame.y, 2, 1);
          context.fillRect(frame.x + (variant % 2), frame.y + 1, 2, 1);
          context.fillStyle = colors[2];
          context.fillRect(frame.x + 1, frame.y + 2, 2, 1);
          context.fillRect(frame.x + (variant % 3), frame.y + 3, 2, 1);
          context.fillStyle = colors[3];
          context.fillRect(frame.x + (variant % 2) + 1, frame.y + 1, 1, 1);
          context.fillRect(frame.x + 2, frame.y + 2, 1, 1);
        }

        function isTemperateTree(asset) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          return family.startsWith('tree.grassland.') || family.startsWith('tree.woodland.');
        }

        function isWetHotTree(asset) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          return family.startsWith('tree.rainforest.') || family.startsWith('tree.wetland.');
        }

        function isDryTree(asset) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          return family.startsWith('tree.savanna.') || family.startsWith('tree.desert.');
        }

        function isColdTree(asset) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          return family.startsWith('tree.tundra.');
        }

        function drawTemperateGround(context, frame, asset, frameIndex) {
          const seed = hash(`${asset.id}:${frameIndex}`);
          const woodland = asset.tags.biomes.includes('woodland');
          const form = asset.tags.forms[0] ?? 'material_base';
          const variant = Number.parseInt(asset.id.match(/_(\d+)\.v01$/)?.[1] ?? '1', 10);
          const palette = woodland
            ? {
                base: '#416844',
                shadow: '#355E41',
                mid: '#50754B',
                light: '#628353',
                earth: '#5C6343',
                accent: '#7D7547',
              }
            : {
                base: '#769B4D',
                shadow: '#628A43',
                mid: '#84A956',
                light: '#98B661',
                earth: '#8B9651',
                accent: '#B7A45A',
              };
          if (form === 'material_base') {
            context.fillStyle = palette.base;
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            if (variant % 4 === 0) {
              context.fillStyle = variant % 2 === 0 ? palette.shadow : palette.mid;
              const px = frame.x + ((seed >>> 5) % 4);
              const py = frame.y + ((seed >>> 9) % 4);
              context.fillRect(px, py, 1, 1);
              context.fillRect(frame.x + ((px - frame.x + 1) % 4), py, 1, 1);
            }
            return;
          }
          if (form === 'material_overlay') {
            drawGroundOverlay(context, frame, palette, woodland, seed);
            return;
          }
          const primarySeed = random(seed, 1);
          const primary = {
            x: 6 + ((primarySeed >>> 5) % 4),
            y: 6 + ((primarySeed >>> 10) % 4),
            radiusX: 5 + ((primarySeed >>> 15) % 3),
            radiusY: 4 + ((primarySeed >>> 19) % 3),
          };
          const centers = [
            primary,
            {
              x: primary.x - 2 - ((primarySeed >>> 22) % 2),
              y: primary.y + (((primarySeed >>> 24) % 3) - 1),
              radiusX: 3 + ((primarySeed >>> 26) % 2),
              radiusY: 2 + ((primarySeed >>> 28) % 2),
            },
            {
              x: primary.x + 2 + ((primarySeed >>> 18) % 2),
              y: primary.y + (((primarySeed >>> 20) % 3) - 1),
              radiusX: 3 + ((primarySeed >>> 12) % 2),
              radiusY: 2 + ((primarySeed >>> 14) % 2),
            },
          ];
          for (let localY = 0; localY < frame.height; localY += 1) {
            for (let localX = 0; localX < frame.width; localX += 1) {
              const distance = Math.min(
                ...centers.map(
                  ({ x, y, radiusX, radiusY }) =>
                    ((localX - x) * (localX - x)) / (radiusX * radiusX) +
                    ((localY - y) * (localY - y)) / (radiusY * radiusY),
                ),
              );
              if (distance > 1) continue;
              const pixelSeed = random(seed, localX + localY * frame.width + 17);
              if (distance > 0.76 && pixelSeed % 11 === 0) continue;
              const materialPatch = variant % 4 === 0;
              context.fillStyle =
                distance < 0.34 && pixelSeed % 17 === 0
                  ? materialPatch
                    ? palette.accent
                    : palette.light
                  : materialPatch
                    ? palette.earth
                    : palette.mid;
              context.fillRect(frame.x + localX, frame.y + localY, 1, 1);
            }
          }
          if (variant % 4 === 0) {
            const accentSeed = random(seed ^ 0xa54ff53a, 1);
            const accentX = frame.x + 4 + ((accentSeed >>> 7) % 7);
            const accentY = frame.y + 4 + ((accentSeed >>> 14) % 7);
            context.fillStyle = palette.accent;
            context.fillRect(accentX, accentY, 2, 1);
          }
        }

        function drawGroundOverlay(context, frame, palette, woodland, seed) {
          const variant = (seed >>> 3) % 4;
          const x = frame.x;
          const y = frame.y;
          if (woodland) {
            if (variant === 0) {
              context.fillStyle = palette.earth;
              context.fillRect(x + 1, y + 1, 2, 1);
              context.fillRect(x + 2, y + 2, 1, 1);
            } else if (variant === 1) {
              context.fillStyle = palette.light;
              context.fillRect(x, y + 2, 2, 1);
              context.fillRect(x + 1, y + 1, 1, 1);
            } else if (variant === 2) {
              context.fillStyle = palette.shadow;
              context.fillRect(x + 1, y, 1, 3);
              context.fillRect(x + 2, y + 2, 2, 1);
            } else {
              context.fillStyle = palette.accent;
              context.fillRect(x + 1, y + 1, 1, 1);
              context.fillStyle = palette.earth;
              context.fillRect(x + 2, y + 2, 1, 1);
              context.fillRect(x + 3, y + 1, 1, 1);
            }
            return;
          }
          if (variant === 0) {
            context.fillStyle = palette.shadow;
            context.fillRect(x + 1, y + 1, 1, 3);
            context.fillRect(x + 2, y + 2, 1, 2);
          } else if (variant === 1) {
            context.fillStyle = palette.earth;
            context.fillRect(x, y + 2, 2, 1);
            context.fillRect(x + 2, y + 3, 1, 1);
          } else if (variant === 2) {
            context.fillStyle = palette.accent;
            context.fillRect(x + 1, y + 1, 1, 1);
            context.fillStyle = '#D78A70';
            context.fillRect(x + 2, y + 1, 1, 1);
            context.fillStyle = palette.shadow;
            context.fillRect(x + 1, y + 2, 1, 1);
          } else {
            context.fillStyle = palette.light;
            context.fillRect(x + 1, y, 1, 3);
            context.fillRect(x + 3, y + 2, 1, 2);
          }
        }

        function drawWetHotGround(context, frame, asset, frameIndex) {
          const seed = hash(`${asset.id}:${frameIndex}`);
          const wetland = asset.tags.biomes.includes('wetland');
          const form = asset.tags.forms[0] ?? 'material_base';
          const variant = Number.parseInt(asset.id.match(/_(\d+)\.v01$/)?.[1] ?? '1', 10);
          const palette = wetland
            ? {
                base: '#637B5C',
                shadow: '#496653',
                mid: '#718862',
                light: '#91A866',
                earth: '#786F4D',
                accent: '#B0B66B',
              }
            : {
                base: '#2E6948',
                shadow: '#1C513D',
                mid: '#397952',
                light: '#55905A',
                earth: '#586444',
                accent: '#8CAB58',
              };
          if (form === 'material_base') {
            context.fillStyle = palette.base;
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            return;
          }
          if (form === 'material_overlay') {
            const x = frame.x;
            const y = frame.y;
            context.fillStyle = variant % 2 === 0 ? palette.accent : palette.shadow;
            if (wetland) {
              context.fillRect(x + 1, y, 1, 4);
              context.fillRect(x + 3, y + 1, 1, 3);
            } else {
              context.fillRect(x, y + 2, 3, 1);
              context.fillRect(x + 1, y + 1, 1, 1);
              if (variant % 2 === 0) context.fillRect(x + 3, y, 1, 1);
            }
            return;
          }
          drawOrganicGroundPatch(context, frame, seed, variant, palette, wetland);
        }

        function drawWetlandMud(context, frame, asset, frameIndex) {
          const seed = hash(`${asset.id}:${frameIndex}`);
          const form = asset.tags.forms[0] ?? 'material_base';
          const variant = Number.parseInt(asset.id.match(/_(\d+)\.v01$/)?.[1] ?? '1', 10);
          const palette = {
            base: '#6B7257',
            shadow: '#4B5E50',
            mid: '#7B7B59',
            light: '#92916A',
            earth: '#756548',
            accent: '#9E9C66',
          };
          if (form === 'material_base') {
            context.fillStyle = palette.base;
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            return;
          }
          if (form === 'material_overlay') {
            context.fillStyle = variant % 3 === 0 ? palette.accent : palette.shadow;
            const x = frame.x + ((seed >>> 5) & 1);
            const y = frame.y + ((seed >>> 8) & 3);
            context.fillRect(x, y, 3, 1);
            if (variant % 2 === 0) context.fillRect(x + 1, Math.max(frame.y, y - 1), 1, 1);
            return;
          }
          drawOrganicGroundPatch(context, frame, seed, variant, palette, true);
        }

        function drawColdGround(context, frame, asset, frameIndex) {
          const polar = asset.tags.biomes.includes('polar');
          const rock = asset.tags.groundMaterials.includes('rock');
          const form = asset.tags.forms[0] ?? 'material_base';
          const seed = hash(`${asset.id}:${frameIndex}`);
          const palette = rock
            ? ['#657473', '#4B5C5E', '#84918A', '#B9C7BE']
            : polar
              ? ['#C5D8D2', '#A9C9C9', '#DCE7DD', '#82AEB7']
              : ['#879B8C', '#718589', '#A9BCB6', '#D9E3D7'];
          if (form === 'material_base') {
            context.fillStyle = palette[0];
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            return;
          }
          if (form === 'material_overlay') {
            context.fillStyle = palette[(seed >>> 3) & 1 ? 1 : 2];
            if (rock) {
              context.fillRect(frame.x + 1, frame.y + 2, 3, 1);
              context.fillRect(frame.x + 2, frame.y + 1, 1, 1);
            } else {
              context.fillRect(frame.x, frame.y + ((seed >>> 6) & 3), 3, 1);
              context.fillStyle = palette[3];
              context.fillRect(frame.x + 2, frame.y + ((seed >>> 9) & 3), 2, 1);
            }
            return;
          }
          context.clearRect(frame.x, frame.y, frame.width, frame.height);
          const patches = 5 + (seed & 3);
          for (let index = 0; index < patches; index += 1) {
            const value = random(seed, index);
            const width = 3 + ((value >>> 5) & 3);
            const height = rock ? 2 + ((value >>> 8) & 3) : 1 + ((value >>> 8) & 2);
            context.fillStyle = palette[1 + ((value >>> 12) % 3)];
            context.fillRect(
              frame.x + ((value >>> 16) % Math.max(1, frame.width - width)),
              frame.y + ((value >>> 23) % Math.max(1, frame.height - height)),
              width,
              height,
            );
          }
        }

        function drawColdTree(context, frame, asset, assetIndex) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          const conifer = family.endsWith('01');
          const age = asset.tags.ages[0] ?? 'mature';
          const height = asset.tags.heights[0] ?? 'standard';
          const sapling = age === 'sapling';
          const old = age === 'old';
          const tall = height === 'tall';
          const compact = height === 'compact';
          const center = frame.x + Math.floor(frame.width / 2);
          const bottom = frame.y + frame.height - 2;
          const top = frame.y + (sapling ? 11 : tall ? 1 : compact ? 7 : 4);
          const trunkTop = top + (conifer ? 5 : 7);
          context.fillStyle = conifer ? '#3D3630' : '#4E4540';
          context.fillRect(center - (old ? 1 : 0), trunkTop, old ? 3 : 2, bottom - trunkTop + 1);
          context.fillStyle = conifer ? '#78604A' : '#9B8C78';
          context.fillRect(center, trunkTop + 1, 1, Math.max(1, bottom - trunkTop - 1));
          if (conifer) {
            const rings = sapling ? 3 : tall ? 6 : compact ? 4 : 5;
            for (let ring = 0; ring < rings; ring += 1) {
              const y = top + ring * 3;
              const radius = Math.min(sapling ? 3 : old ? 7 : 6, 2 + ring);
              context.fillStyle = ring % 2 === 0 ? '#294E45' : '#356453';
              context.fillRect(center - radius, y + 2, radius * 2 + 1, 2);
              context.fillRect(center - Math.max(1, radius - 2), y, Math.max(3, radius * 2 - 3), 2);
              context.fillStyle = '#6F8F68';
              context.fillRect(center - Math.max(0, radius - 3), y, Math.max(1, radius - 1), 1);
              if (ring % 2 === 0) {
                context.fillStyle = '#C8D8CF';
                context.fillRect(center - radius + 1, y + 1, Math.max(1, radius - 1), 1);
              }
            }
          } else {
            const wind = (hash(asset.id) ^ assetIndex) & 1 ? 1 : -1;
            context.fillStyle = '#354F47';
            context.fillRect(center - 5, top + 4, 11, 6);
            context.fillRect(center - 3 + wind * 2, top + 1, 7, 5);
            context.fillStyle = '#627D68';
            context.fillRect(center - 4, top + 3, 5, 3);
            context.fillRect(center + wind * 3, top + 5, 4, 3);
            context.fillStyle = '#AFC2B3';
            context.fillRect(center - 2, top + 2, 3, 1);
            context.fillRect(center + wind * 3, top + 4, 2, 1);
            if (old) {
              context.fillStyle = '#D4DDD1';
              context.fillRect(center - 5, top + 7, 3, 1);
            }
          }
        }

        function drawColdDecoration(context, frame, asset) {
          const id = asset.id;
          const family = asset.tags.semanticFamilies[0] ?? '';
          const variant = Number.parseInt(id.match(/cold_(\d+)/)?.[1] ?? '1', 10);
          const x = frame.x;
          const y = frame.y;
          const bottom = y + frame.height - 1;
          const paint = (color, rects) => {
            context.fillStyle = color;
            for (const [left, top, width = 1, height = 1] of rects) {
              context.fillRect(x + left, bottom - top, width, height);
            }
          };
          if (family === 'ground_cover.grass_tuft' || family === 'ground_cover.moss_lichen') {
            paint('#526D5C', [[1, 1, 6, 2]]);
            paint(
              '#9AAA6D',
              variant === 1
                ? [
                    [2, 3, 1, 3],
                    [5, 2, 1, 2],
                  ]
                : variant === 2
                  ? [
                      [1, 2, 3, 1],
                      [5, 4, 1, 4],
                    ]
                  : [
                      [2, 2, 1, 2],
                      [4, 3, 3, 1],
                    ],
            );
            return true;
          }
          if (family === 'vegetation.bush') {
            paint(
              '#304E46',
              variant === 1
                ? [[1, 6, 10, 7]]
                : variant === 2
                  ? [
                      [0, 4, 7, 5],
                      [6, 7, 6, 8],
                    ]
                  : [
                      [2, 8, 8, 9],
                      [0, 4, 4, 4],
                    ],
            );
            paint('#698568', [
              [2, 8, 4, 3],
              [7, 6, 3, 2],
            ]);
            paint('#C5D5CC', [[3, 9, 3, 1]]);
            return true;
          }
          if (
            family === 'ground_cover.small_stone' ||
            family === 'object.rock_cluster' ||
            family === 'object.mineral_crystal'
          ) {
            const large = family !== 'ground_cover.small_stone';
            paint(
              '#435457',
              variant === 1
                ? [[1, large ? 6 : 3, large ? 10 : 6, large ? 7 : 4]]
                : variant === 2
                  ? [
                      [1, 4, 5, 5],
                      [6, large ? 8 : 3, large ? 6 : 3, large ? 9 : 4],
                    ]
                  : [
                      [0, 3, 4, 4],
                      [4, 6, 5, 7],
                      [8, 3, 4, 4],
                    ],
            );
            paint(family === 'object.mineral_crystal' ? '#9ED5D3' : '#899B94', [
              [2, large ? 7 : 4, 4, 1],
              [7, large ? 5 : 3, 2, 1],
            ]);
            paint('#D7E1D5', [[3, large ? 8 : 5, 2, 1]]);
            return true;
          }
          if (family === 'object.deadwood_stump') {
            paint(
              '#4A4037',
              variant === 1
                ? [[3, 7, 6, 8]]
                : variant === 2
                  ? [
                      [2, 5, 8, 6],
                      [7, 10, 3, 6],
                    ]
                  : [
                      [4, 9, 5, 10],
                      [1, 4, 4, 3],
                    ],
            );
            paint('#8A7255', [[4, variant === 3 ? 10 : 8, 4, 2]]);
            paint('#C1D0C5', [[3, variant === 3 ? 11 : 9, 3, 1]]);
            return true;
          }
          if (family === 'object.dead_tree') {
            const center = Math.floor(frame.width / 2);
            paint('#3F3B36', [
              [center - 1, frame.height - 3, 3, frame.height - 6],
              [variant === 2 ? center - 6 : center - 5, frame.height - 10, 6, 2],
              [center + 1, frame.height - (variant === 3 ? 13 : 8), 6, 2],
            ]);
            paint('#786B58', [[center, frame.height - 4, 1, frame.height - 9]]);
            return true;
          }
          if (family === 'ground_cover.coast_debris') {
            paint(
              '#718C88',
              variant === 1
                ? [
                    [1, 1, 6, 1],
                    [5, 3, 1, 3],
                  ]
                : variant === 2
                  ? [
                      [1, 2, 2, 2],
                      [5, 3, 2, 3],
                    ]
                  : [
                      [1, 1, 7, 1],
                      [2, 3, 1, 2],
                      [6, 4, 1, 3],
                    ],
            );
            paint('#DDE6D9', [[2, 3, 2, 1]]);
            return true;
          }
          return false;
        }

        function drawDryGround(context, frame, asset, frameIndex) {
          const desert = asset.tags.biomes.includes('desert');
          const form = asset.tags.forms[0] ?? 'material_base';
          const variant = Number.parseInt(
            asset.id.match(/_(\d+)\.prototype\.v01$/)?.[1] ?? '1',
            10,
          );
          const seed = hash(`${asset.id}:${frameIndex}`);
          const palette = desert
            ? {
                base: '#C99A59',
                shadow: '#9A7348',
                mid: '#D5AA67',
                light: '#E5C47E',
                earth: '#B2824E',
                accent: '#EED18E',
              }
            : {
                base: '#A68E4D',
                shadow: '#76683C',
                mid: '#B19B53',
                light: '#C6AE5D',
                earth: '#8C7142',
                accent: '#D4B765',
              };
          if (form === 'material_base') {
            context.fillStyle = palette.base;
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            return;
          }
          if (form === 'material_overlay') {
            const x = frame.x;
            const y = frame.y;
            context.fillStyle = variant % 2 === 0 ? palette.shadow : palette.light;
            if (desert) {
              const row = y + ((seed >>> 4) % 3);
              context.fillRect(x + (variant % 2), row, variant === 3 ? 3 : 2, 1);
              if (variant === 3) context.fillRect(x + 2, Math.min(y + 3, row + 1), 2, 1);
            } else {
              context.fillRect(x + 1, y, 1, 3);
              context.fillStyle = palette.accent;
              context.fillRect(x + 2, y + 1, 1, 2);
              if (variant === 3) context.fillRect(x + 3, y + 2, 1, 2);
            }
            return;
          }

          const centers = desert
            ? [
                [7 + (variant % 3), 7, 7, 4],
                [4, 10, 4, 3],
                [11, 5, 4, 3],
              ]
            : [
                [7, 7 + (variant % 2), 6, 5],
                [4, 5, 4, 3],
                [11, 10, 4, 3],
              ];
          for (let localY = 0; localY < frame.height; localY += 1) {
            for (let localX = 0; localX < frame.width; localX += 1) {
              const distance = Math.min(
                ...centers.map(
                  ([centerX, centerY, radiusX, radiusY]) =>
                    ((localX - centerX) * (localX - centerX)) / (radiusX * radiusX) +
                    ((localY - centerY) * (localY - centerY)) / (radiusY * radiusY),
                ),
              );
              if (distance > 1) continue;
              const pixelSeed = random(seed, localX + localY * frame.width + 67);
              context.fillStyle =
                distance > 0.76
                  ? palette.shadow
                  : localY < 6 && pixelSeed % 9 === 0
                    ? palette.light
                    : variant % 2 === 0
                      ? palette.mid
                      : palette.earth;
              context.fillRect(frame.x + localX, frame.y + localY, 1, 1);
            }
          }
          context.fillStyle = desert ? palette.accent : palette.shadow;
          const strokeY = frame.y + 4 + ((seed >>> 8) % 8);
          context.fillRect(frame.x + 4, strokeY, desert ? 5 : 2, 1);
          if (desert && variant % 2 === 0) context.fillRect(frame.x + 9, strokeY + 1, 3, 1);
        }

        function drawOrganicGroundPatch(context, frame, seed, variant, palette, wetland) {
          const primary = random(seed, 1);
          const centers = [
            {
              x: 6 + ((primary >>> 4) % 5),
              y: 6 + ((primary >>> 9) % 5),
              radiusX: 5 + ((primary >>> 14) % 3),
              radiusY: 4 + ((primary >>> 18) % 3),
            },
            {
              x: 4 + ((primary >>> 21) % 4),
              y: 7 + ((primary >>> 24) % 4),
              radiusX: 3 + ((primary >>> 27) % 2),
              radiusY: 3,
            },
            {
              x: 9 + ((primary >>> 12) % 4),
              y: 5 + ((primary >>> 16) % 5),
              radiusX: 3,
              radiusY: 3 + ((primary >>> 19) % 2),
            },
          ];
          for (let localY = 0; localY < frame.height; localY += 1) {
            for (let localX = 0; localX < frame.width; localX += 1) {
              const distance = Math.min(
                ...centers.map(
                  ({ x, y, radiusX, radiusY }) =>
                    ((localX - x) * (localX - x)) / (radiusX * radiusX) +
                    ((localY - y) * (localY - y)) / (radiusY * radiusY),
                ),
              );
              if (distance > 1) continue;
              const pixelSeed = random(seed, localX + localY * frame.width + 31);
              if (distance > 0.78 && pixelSeed % 9 === 0) continue;
              context.fillStyle =
                wetland && variant % 3 === 0
                  ? pixelSeed % 13 === 0
                    ? palette.light
                    : palette.earth
                  : pixelSeed % 17 === 0
                    ? palette.accent
                    : distance < 0.3
                      ? palette.light
                      : palette.mid;
              context.fillRect(frame.x + localX, frame.y + localY, 1, 1);
            }
          }
        }

        function drawWater(context, frame, asset, frameIndex) {
          // Water and sand base frames stay quiet. Sparse structural ripples are rendered by the
          // dedicated water-effect layer, which avoids repeating a mark in every logical cell.
          void context;
          void frame;
          void asset;
          void frameIndex;
        }

        function drawRockGround(context, frame, asset, frameIndex) {
          const seed = hash(`${asset.id}:${frameIndex}`);
          const form = asset.tags.forms[0] ?? 'material_base';
          const palette = {
            base: '#6F796C',
            shadow: '#4B5148',
            mid: '#818977',
            light: '#A6AA91',
            moss: '#657451',
          };
          if (form === 'material_base') {
            context.fillStyle = palette.base;
            context.fillRect(frame.x, frame.y, frame.width, frame.height);
            if ((seed & 3) === 0) {
              context.fillStyle = (seed & 4) === 0 ? palette.mid : palette.moss;
              context.fillRect(frame.x + ((seed >>> 5) & 3), frame.y + ((seed >>> 9) & 3), 1, 1);
            }
            return;
          }
          if (form === 'material_overlay') {
            context.fillStyle = (seed & 1) === 0 ? palette.shadow : palette.light;
            const x = frame.x + ((seed >>> 4) & 1);
            const y = frame.y + ((seed >>> 7) & 3);
            context.fillRect(x, y, 2, 1);
            if ((seed & 8) !== 0) context.fillRect(x + 1, Math.max(frame.y, y - 1), 1, 1);
            return;
          }
          const centerX = 5 + ((seed >>> 6) % 6);
          const centerY = 5 + ((seed >>> 11) % 6);
          const radiusX = 4 + ((seed >>> 16) % 4);
          const radiusY = 3 + ((seed >>> 20) % 4);
          for (let localY = 0; localY < frame.height; localY += 1) {
            for (let localX = 0; localX < frame.width; localX += 1) {
              const dx = (localX - centerX) / radiusX;
              const dy = (localY - centerY) / radiusY;
              if (dx * dx + dy * dy > 1) continue;
              const pixelSeed = random(seed, localX + localY * frame.width);
              context.fillStyle =
                localY < centerY - 1 && pixelSeed % 5 === 0
                  ? palette.light
                  : localY > centerY + 1
                    ? palette.shadow
                    : pixelSeed % 7 === 0
                      ? palette.moss
                      : palette.mid;
              context.fillRect(frame.x + localX, frame.y + localY, 1, 1);
            }
          }
        }

        function drawCorruptionEffect(context, frame, frameIndex) {
          const seed = hash(`corruption:${frameIndex}`);
          context.fillStyle = frameIndex % 2 === 0 ? '#85618D' : '#705178';
          let x = frame.x + 2 + ((seed >>> 5) % 4);
          let y = frame.y + 2;
          for (let step = 0; step < 12; step += 1) {
            context.globalAlpha = 0.34 + ((step + frameIndex) % 3) * 0.16;
            context.fillRect(x, y, step % 4 === 0 ? 2 : 1, 1);
            x += ((random(seed, step) >>> 4) % 3) - 1;
            y += 1;
          }
          context.globalAlpha = 1;
        }

        function drawWetHotTree(context, frame, asset, assetIndex) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          const rainforest = family.includes('.rainforest.');
          const age = asset.tags.ages[0] ?? 'mature';
          const height = asset.tags.heights[0] ?? 'standard';
          const archetype = Number.parseInt(family.match(/(\d+)$/)?.[1] ?? '1', 10) - 1;
          const seed = hash(asset.id) ^ assetIndex;
          const sapling = age === 'sapling';
          const old = age === 'old';
          const tall = height === 'tall';
          const compact = height === 'compact';
          const centerX = frame.x + Math.floor(frame.width / 2);
          const bottom = frame.y + frame.height - 2;
          const top = frame.y + (sapling ? 9 : tall ? 1 : compact ? 6 : 3);
          const trunkTop = frame.y + (sapling ? 14 : tall ? 8 : compact ? 13 : 10);
          const trunkWidth = old ? 3 : sapling ? 1 : 2;
          const trunk = rainforest
            ? ['#3A332A', '#655039', '#9A6A42']
            : ['#39433A', '#5A5942', '#88704A'];
          const leaves = rainforest
            ? ['#143D34', '#1E5940', '#2D7648', '#55A255', '#91BD62']
            : ['#294D42', '#3D6750', '#5D7E58', '#86A461', '#B0BA6A'];

          context.fillStyle = trunk[0];
          context.fillRect(
            centerX - Math.floor(trunkWidth / 2),
            trunkTop,
            trunkWidth,
            bottom - trunkTop + 1,
          );
          context.fillStyle = trunk[1];
          context.fillRect(centerX, trunkTop + 1, 1, Math.max(2, bottom - trunkTop - 1));
          if (old || (!rainforest && archetype === 1)) {
            context.fillStyle = trunk[0];
            context.fillRect(centerX - 4, bottom - 1, 9, 1);
            context.fillRect(centerX - 3, bottom - 3, 2, 3);
            context.fillRect(centerX + 2, bottom - 4, 2, 4);
          }
          if (rainforest && !sapling) {
            context.fillStyle = trunk[2];
            context.fillRect(centerX + 1, trunkTop + 3, 1, Math.max(2, bottom - trunkTop - 4));
          }

          const rainforestClusters = [
            [
              [0, 5, 7, 4],
              [-5, 7, 4, 3],
              [5, 7, 4, 3],
              [0, 9, 5, 3],
            ],
            [
              [0, 4, 4, 3],
              [-4, 7, 4, 3],
              [4, 7, 4, 3],
              [0, 10, 6, 3],
            ],
            [
              [0, 4, 5, 3],
              [-3, 7, 5, 3],
              [3, 9, 5, 3],
            ],
            [
              [-3, 5, 5, 4],
              [3, 5, 5, 4],
              [0, 9, 6, 3],
            ],
          ];
          const wetlandClusters = [
            [
              [0, 4, 5, 3],
              [-4, 7, 4, 4],
              [4, 7, 4, 4],
              [-3, 11, 3, 4],
              [3, 11, 3, 4],
            ],
            [
              [0, 5, 6, 3],
              [-4, 8, 4, 3],
              [4, 8, 4, 3],
            ],
            [
              [-2, 5, 5, 4],
              [3, 7, 5, 4],
              [0, 10, 4, 3],
            ],
          ];
          const scale = sapling ? 0.55 : old ? 1.06 : 0.9;
          const clusters = rainforest
            ? rainforestClusters[archetype % rainforestClusters.length]
            : wetlandClusters[archetype % wetlandClusters.length];
          for (const [offsetX, offsetY, radiusX, radiusY] of clusters) {
            drawWetHotLeafCluster(
              context,
              frame,
              centerX + Math.round(offsetX * scale),
              top + Math.round(offsetY * scale),
              Math.max(2, Math.round(radiusX * scale)),
              Math.max(2, Math.round(radiusY * scale)),
              leaves,
              seed + offsetX * 19 + offsetY * 31,
            );
          }
        }

        function drawDryTree(context, frame, asset, assetIndex) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          const desert = family.startsWith('tree.desert.');
          const archetype = Number.parseInt(family.match(/(\d+)$/)?.[1] ?? '1', 10) - 1;
          const age = asset.tags.ages[0] ?? 'mature';
          const height = asset.tags.heights[0] ?? 'standard';
          const sapling = age === 'sapling';
          const old = age === 'old';
          const tall = height === 'tall';
          const centerX = frame.x + Math.floor(frame.width / 2);
          const bottom = frame.y + frame.height - 2;
          const trunkTop = frame.y + (sapling ? 14 : tall ? 7 : 10);
          const trunkWidth = old ? 3 : sapling ? 1 : 2;
          const seed = hash(asset.id) ^ assetIndex;

          context.fillStyle = desert ? '#5B4530' : '#58422D';
          context.fillRect(
            centerX - Math.floor(trunkWidth / 2),
            trunkTop,
            trunkWidth,
            bottom - trunkTop + 1,
          );
          context.fillStyle = desert ? '#A27045' : '#8E6138';
          context.fillRect(centerX, trunkTop + 1, 1, Math.max(2, bottom - trunkTop - 2));
          if (!sapling && !desert) {
            context.fillStyle = '#58422D';
            context.fillRect(centerX - 5, trunkTop + 2, 5, 1);
            context.fillRect(centerX + 1, trunkTop + 3, 5, 1);
          }

          if (desert) {
            const top = frame.y + (sapling ? 10 : tall ? 2 : 5);
            context.fillStyle = '#36583C';
            context.fillRect(centerX - (sapling ? 2 : 5), top + 3, sapling ? 5 : 11, 4);
            context.fillRect(centerX - (sapling ? 1 : 3), top + 1, sapling ? 3 : 7, 6);
            context.fillStyle = '#5F7B45';
            context.fillRect(centerX - (sapling ? 1 : 3), top + 1, sapling ? 2 : 5, 2);
            context.fillStyle = '#A4A253';
            context.fillRect(centerX, top, 2, 1);
            if (old) {
              context.fillStyle = '#36583C';
              context.fillRect(centerX - 6, top + 5, 3, 2);
              context.fillRect(centerX + 4, top + 4, 3, 2);
            }
            return;
          }

          const top = frame.y + (sapling ? 10 : tall ? 1 : 4);
          const widths = archetype === 0 ? [5, 13, 15] : archetype === 1 ? [4, 9, 13] : [3, 7, 10];
          const scale = sapling ? 0.55 : old ? 1 : 0.82;
          const crownWidths = widths.map((width) => Math.max(3, Math.round(width * scale)));
          const crownColors = ['#4E6038', '#71803E', '#96964A', '#C0A750'];
          for (let layer = crownWidths.length - 1; layer >= 0; layer -= 1) {
            const width = crownWidths[layer];
            const x = centerX - Math.floor(width / 2);
            const y = top + layer * 2;
            context.fillStyle = crownColors[layer === crownWidths.length - 1 ? 0 : 1];
            context.fillRect(x, y + 1, width, 2);
            context.fillRect(x + 1, y, Math.max(1, width - 2), 1);
          }
          context.fillStyle = crownColors[2];
          context.fillRect(
            centerX - Math.floor(crownWidths[1] / 3),
            top + 1,
            Math.max(2, Math.floor(crownWidths[1] / 2)),
            1,
          );
          context.fillStyle = crownColors[3];
          context.fillRect(centerX - 1 + ((seed >>> 4) % 3), top, 2, 1);
        }

        function drawWetHotLeafCluster(
          context,
          frame,
          centerX,
          centerY,
          radiusX,
          radiusY,
          palette,
          seed,
        ) {
          for (let offsetY = -radiusY; offsetY <= radiusY; offsetY += 1) {
            for (let offsetX = -radiusX; offsetX <= radiusX; offsetX += 1) {
              const x = centerX + offsetX;
              const y = centerY + offsetY;
              if (
                x < frame.x ||
                x >= frame.x + frame.width ||
                y < frame.y ||
                y >= frame.y + frame.height
              ) {
                continue;
              }
              const distance =
                (offsetX * offsetX) / (radiusX * radiusX) +
                (offsetY * offsetY) / (radiusY * radiusY);
              if (distance > 1) continue;
              const pixelSeed = random(seed, offsetX + offsetY * frame.width + 53);
              context.fillStyle =
                distance > 0.72
                  ? palette[0]
                  : offsetY < -1 && pixelSeed % 5 === 0
                    ? palette[4]
                    : offsetY < 1
                      ? palette[3]
                      : pixelSeed % 7 === 0
                        ? palette[2]
                        : palette[1];
              context.fillRect(x, y, 1, 1);
            }
          }
        }

        function drawDryDecoration(context, frame, asset) {
          const id = asset.id;
          const variant = Number.parseInt(id.match(/\.v(\d+)$/)?.[1] ?? '1', 10);
          const x = frame.x;
          const y = frame.y;
          const bottom = y + frame.height - 1;
          const paint = (color, rectangles) => {
            context.fillStyle = color;
            for (const [offsetX, offsetY, width = 1, height = 1] of rectangles) {
              context.fillRect(x + offsetX, y + offsetY, width, height);
            }
          };
          if (id.startsWith('ground_cover.grass_tuft')) {
            const form = (variant - 2 + 3) % 3;
            paint('#514A2E', [[1, 7, 6, 1]]);
            if (form === 0) {
              paint('#6D6C35', [
                [3, 2, 1, 5],
                [4, 1, 1, 6],
                [2, 4, 1, 3],
                [5, 3, 1, 4],
              ]);
              paint('#A0A04B', [
                [1, 3],
                [2, 4],
                [5, 3],
                [6, 2],
                [3, 2],
              ]);
              paint('#D1BA60', [
                [4, 1],
                [6, 2],
              ]);
            } else if (form === 1) {
              paint('#666334', [
                [2, 3, 1, 4],
                [3, 4, 1, 3],
                [4, 5, 1, 2],
                [5, 5, 1, 2],
              ]);
              paint('#9A9748', [
                [2, 2, 2, 1],
                [3, 3, 2, 1],
                [4, 4, 2, 1],
                [5, 3, 2, 1],
              ]);
              paint('#CFB95D', [
                [3, 2],
                [6, 3],
              ]);
            } else {
              paint('#5E5A31', [
                [1, 4, 1, 3],
                [2, 2, 1, 5],
                [5, 3, 1, 4],
                [6, 1, 1, 6],
              ]);
              paint('#979545', [
                [0, 3, 2, 1],
                [1, 2],
                [4, 2, 2, 1],
                [5, 1],
              ]);
              paint('#D3B85A', [
                [0, 3],
                [4, 2],
                [6, 1],
              ]);
            }
            return true;
          }
          if (id.startsWith('vegetation.reed_high_grass')) {
            const form = (variant - 2 + 3) % 3;
            paint('#4C4930', [[1, 15, 10, 1]]);
            if (form === 0) {
              paint('#5D6738', [
                [2, 7, 1, 8],
                [4, 3, 1, 12],
                [6, 5, 1, 10],
                [8, 2, 1, 13],
                [9, 8, 1, 7],
              ]);
              paint('#9A994B', [
                [3, 6],
                [5, 8],
                [7, 5],
                [9, 7],
                [10, 10],
                [4, 4],
                [8, 3],
              ]);
              paint('#D0B75D', [
                [3, 5, 2, 1],
                [7, 1, 2, 2],
                [9, 6, 2, 1],
              ]);
            } else if (form === 1) {
              paint('#586238', [
                [2, 8, 1, 7],
                [3, 6, 1, 9],
                [4, 7, 1, 8],
                [5, 5, 1, 10],
                [7, 7, 1, 8],
              ]);
              paint('#929548', [
                [2, 6, 3, 1],
                [3, 5, 4, 1],
                [5, 4, 4, 1],
                [7, 6, 3, 1],
              ]);
              paint('#CBB45B', [
                [5, 3, 4, 1],
                [8, 5, 3, 1],
              ]);
            } else {
              paint('#566037', [
                [1, 8, 1, 7],
                [2, 5, 1, 10],
                [4, 7, 1, 8],
                [7, 6, 1, 9],
                [9, 4, 1, 11],
                [10, 8, 1, 7],
              ]);
              paint('#929748', [
                [0, 7, 2, 1],
                [1, 4, 2, 1],
                [3, 6, 2, 1],
                [6, 5, 2, 1],
                [8, 3, 2, 1],
                [9, 7, 2, 1],
              ]);
              paint('#D2B85F', [
                [1, 3, 2, 1],
                [8, 2, 2, 1],
              ]);
            }
            return true;
          }
          if (id.startsWith('vegetation.bush')) {
            const form = (variant - 2 + 3) % 3;
            paint('#4B3E2B', [
              [2, 14, 8, 1],
              [4, 12, 1, 3],
              [8, 12, 1, 3],
            ]);
            if (form === 0) {
              paint('#344B34', [
                [1, 9, 10, 4],
                [2, 7, 4, 3],
                [6, 6, 4, 4],
                [4, 5, 3, 3],
              ]);
              paint('#56673A', [
                [2, 8, 3, 3],
                [5, 6, 3, 3],
                [8, 7, 2, 3],
                [4, 10, 4, 2],
              ]);
              paint('#85854A', [
                [3, 7, 2, 1],
                [5, 5, 2, 1],
                [8, 7, 1, 1],
                [2, 9, 1, 1],
              ]);
              paint('#C09F54', [
                [5, 6],
                [9, 8],
              ]);
            } else if (form === 1) {
              paint('#324A34', [
                [1, 10, 10, 3],
                [3, 8, 8, 3],
                [5, 6, 6, 3],
                [8, 4, 3, 3],
              ]);
              paint('#596B3C', [
                [2, 9, 3, 2],
                [4, 8, 3, 2],
                [6, 6, 3, 2],
                [8, 5, 2, 2],
              ]);
              paint('#8A8749', [
                [3, 8, 2, 1],
                [6, 5, 2, 1],
                [9, 4, 1, 1],
              ]);
              paint('#C29C50', [
                [10, 6],
                [7, 7],
              ]);
            } else {
              paint('#314933', [
                [0, 10, 5, 3],
                [1, 7, 4, 4],
                [7, 9, 5, 4],
                [8, 6, 3, 4],
              ]);
              paint('#596C3D', [
                [1, 8, 3, 3],
                [3, 10, 2, 2],
                [8, 7, 2, 3],
                [9, 10, 2, 2],
              ]);
              paint('#8B8A4A', [
                [2, 7, 2, 1],
                [8, 6, 2, 1],
                [10, 9, 1, 1],
              ]);
              paint('#C5A354', [
                [4, 9],
                [9, 6],
              ]);
            }
            return true;
          }
          if (id.startsWith('vegetation.cactus_succulent')) {
            const form = (variant - 1 + 3) % 3;
            paint('#4E432F', [[2, 15, 8, 1]]);
            if (form === 0) {
              paint('#284B3B', [
                [5, 3, 4, 12],
                [2, 7, 3, 4],
                [1, 6, 2, 4],
                [8, 9, 3, 4],
                [10, 7, 2, 5],
              ]);
              paint('#447456', [
                [5, 2, 3, 12],
                [2, 6, 2, 3],
                [9, 8, 2, 3],
              ]);
              paint('#76A05E', [
                [6, 3, 1, 10],
                [2, 7, 1, 2],
                [10, 8, 1, 2],
              ]);
              paint('#D5B75A', [
                [6, 1],
                [1, 5],
                [10, 7],
              ]);
            } else if (form === 1) {
              paint('#294B3A', [
                [1, 10, 4, 5],
                [4, 7, 5, 8],
                [8, 9, 3, 6],
              ]);
              paint('#487657', [
                [2, 9, 2, 5],
                [5, 5, 3, 9],
                [9, 8, 1, 6],
              ]);
              paint('#7EA363', [
                [2, 10, 1, 3],
                [5, 7, 1, 6],
                [9, 9, 1, 3],
              ]);
              paint('#D6B85C', [
                [2, 8],
                [6, 4],
                [9, 7],
              ]);
            } else {
              paint('#294A3A', [
                [5, 10, 3, 5],
                [2, 8, 4, 4],
                [6, 5, 4, 5],
                [3, 3, 4, 5],
                [8, 1, 3, 5],
              ]);
              paint('#4B7759', [
                [3, 7, 2, 4],
                [6, 9, 1, 5],
                [7, 4, 2, 5],
                [4, 2, 2, 5],
                [9, 0, 1, 5],
              ]);
              paint('#7FA262', [
                [3, 8],
                [7, 5],
                [4, 3],
                [9, 1],
              ]);
              paint('#D9B95C', [
                [3, 7],
                [7, 4],
                [9, 0],
              ]);
            }
            return true;
          }
          if (id.startsWith('ground_cover.small_stone')) {
            const form = (variant - 2 + 3) % 3;
            paint('#4A4137', [[1, 7, 6, 1]]);
            if (form === 0) {
              paint('#615A4C', [
                [2, 5, 5, 2],
                [3, 4, 3, 1],
              ]);
              paint('#91866A', [
                [3, 4, 2, 1],
                [2, 5, 2, 1],
              ]);
              paint('#B4A57E', [[4, 4]]);
            } else if (form === 1) {
              paint('#5C5548', [
                [0, 6, 3, 1],
                [1, 5, 2, 1],
                [3, 5, 4, 2],
                [5, 4, 2, 1],
              ]);
              paint('#91856A', [
                [1, 5],
                [4, 5, 2, 1],
                [5, 4],
              ]);
              paint('#B7A87E', [[6, 4]]);
            } else {
              paint('#5A5247', [
                [1, 6, 7, 1],
                [2, 5, 5, 1],
                [4, 4, 3, 1],
              ]);
              paint('#8F846A', [
                [2, 5, 4, 1],
                [4, 4, 2, 1],
              ]);
              paint('#B6A77E', [[5, 4]]);
            }
            return true;
          }
          if (id.startsWith('ground_cover.coast_debris')) {
            const form = (variant - 2 + 3) % 3;
            if (form === 0) {
              paint('#785B3D', [
                [0, 6, 7, 1],
                [5, 4, 1, 3],
                [6, 3, 1, 2],
              ]);
              paint('#C09663', [
                [1, 5, 4, 1],
                [6, 3],
              ]);
            } else if (form === 1) {
              paint('#987A55', [
                [1, 6, 2, 1],
                [5, 5, 2, 2],
                [3, 3, 2, 2],
              ]);
              paint('#E1C895', [
                [1, 5],
                [3, 2, 2, 1],
                [6, 5],
              ]);
            } else {
              paint('#765F40', [
                [1, 7, 6, 1],
                [2, 4, 1, 3],
                [4, 3, 1, 4],
                [6, 5, 1, 2],
              ]);
              paint('#C2A46C', [
                [1, 4, 2, 1],
                [3, 3, 2, 1],
                [5, 5, 2, 1],
              ]);
            }
            return true;
          }
          if (id.startsWith('object.rock_cluster')) {
            const form = (variant - 2 + 3) % 3;
            paint('#493F35', [[1, 14, 10, 1]]);
            if (form === 0) {
              paint('#5B5548', [
                [1, 10, 5, 4],
                [3, 8, 4, 5],
                [6, 11, 5, 3],
                [8, 9, 2, 4],
              ]);
              paint('#817A64', [
                [2, 9, 4, 3],
                [4, 7, 2, 2],
                [7, 10, 3, 2],
              ]);
              paint('#B0A785', [
                [4, 7, 2, 1],
                [8, 9, 2, 1],
              ]);
            } else if (form === 1) {
              paint('#575145', [
                [3, 11, 7, 3],
                [5, 6, 4, 6],
                [6, 3, 3, 4],
              ]);
              paint('#7E7761', [
                [4, 10, 4, 2],
                [5, 5, 3, 5],
                [6, 2, 2, 3],
              ]);
              paint('#AEA581', [
                [6, 2, 2, 1],
                [5, 5, 2, 1],
              ]);
            } else {
              paint('#575146', [
                [0, 12, 12, 2],
                [2, 10, 9, 2],
                [4, 8, 6, 2],
              ]);
              paint('#807861', [
                [1, 11, 8, 1],
                [3, 9, 6, 1],
                [5, 7, 4, 1],
              ]);
              paint('#B1A683', [[5, 7, 4, 1]]);
            }
            return true;
          }
          if (id.startsWith('object.deadwood_stump')) {
            const form = (variant - 2 + 3) % 3;
            paint('#43362A', [[1, 14, 10, 1]]);
            if (form === 0) {
              paint('#573D2C', [
                [3, 8, 6, 6],
                [1, 13, 4, 1],
                [8, 12, 3, 2],
              ]);
              paint('#8A5D37', [
                [4, 7, 5, 5],
                [3, 8, 1, 4],
              ]);
              paint('#C18B51', [
                [4, 6, 5, 2],
                [5, 8, 3, 1],
              ]);
              paint('#6A452E', [[6, 7, 2, 1]]);
            } else if (form === 1) {
              paint('#4C382B', [
                [3, 10, 6, 4],
                [2, 13, 3, 1],
                [8, 12, 3, 2],
                [5, 6, 4, 5],
              ]);
              paint('#835837', [
                [4, 9, 4, 4],
                [6, 5, 3, 5],
              ]);
              paint('#BF8951', [
                [6, 4, 4, 2],
                [7, 6, 2, 1],
              ]);
              paint('#6A4630', [[8, 5]]);
            } else {
              paint('#4A382B', [
                [3, 10, 6, 4],
                [1, 13, 4, 1],
                [8, 12, 3, 2],
                [3, 6, 3, 5],
                [7, 5, 3, 6],
              ]);
              paint('#835A39', [
                [4, 5, 2, 6],
                [7, 4, 2, 7],
              ]);
              paint('#C18B52', [
                [3, 4, 3, 2],
                [7, 3, 3, 2],
              ]);
              paint('#68472F', [
                [4, 5],
                [8, 4],
              ]);
            }
            return true;
          }
          if (id.startsWith('object.dead_tree')) {
            const form = (variant - 2 + 3) % 3;
            paint('#3E342B', [[3, 22, 10, 1]]);
            if (form === 0) {
              paint('#49362B', [
                [7, 7, 4, 15],
                [5, 4, 3, 8],
                [2, 3, 4, 3],
                [9, 3, 3, 8],
                [11, 1, 3, 4],
                [4, 11, 4, 3],
                [2, 9, 3, 3],
              ]);
              paint('#79523A', [
                [8, 7, 2, 13],
                [6, 4, 1, 7],
                [10, 3, 1, 7],
                [3, 3, 3, 1],
                [12, 1, 2, 1],
              ]);
              paint('#A36E43', [
                [8, 8, 1, 9],
                [6, 5],
                [10, 4],
              ]);
            } else if (form === 1) {
              paint('#47352B', [
                [6, 9, 4, 13],
                [7, 6, 4, 5],
                [9, 4, 4, 4],
                [11, 2, 4, 4],
                [4, 11, 3, 3],
                [2, 10, 3, 2],
              ]);
              paint('#775139', [
                [7, 9, 2, 11],
                [8, 6, 2, 4],
                [10, 4, 2, 3],
                [12, 2, 2, 3],
                [3, 10, 2, 1],
              ]);
              paint('#A16B42', [
                [7, 10, 1, 8],
                [9, 6],
                [11, 4],
              ]);
            } else {
              paint('#46352B', [
                [6, 11, 5, 11],
                [4, 7, 3, 6],
                [2, 6, 3, 3],
                [10, 8, 4, 4],
                [12, 5, 3, 4],
                [7, 4, 3, 8],
                [8, 2, 2, 4],
              ]);
              paint('#76513A', [
                [7, 11, 2, 9],
                [5, 7, 1, 5],
                [11, 8, 2, 3],
                [8, 4, 1, 7],
              ]);
              paint('#A36D43', [
                [7, 12, 1, 4],
                [5, 7],
                [11, 8],
                [8, 4],
              ]);
              paint('#2E2925', [[8, 14, 2, 3]]);
            }
            return true;
          }
          return false;
        }

        function drawWetHotDecoration(context, frame, asset) {
          const id = asset.id;
          const x = frame.x;
          const y = frame.y;
          const bottom = y + frame.height - 1;
          if (id.startsWith('ground_cover.moss_lichen')) {
            context.fillStyle = '#2D5C42';
            context.fillRect(x + 1, bottom - 2, 6, 2);
            context.fillStyle = '#6D9851';
            context.fillRect(x + 2, bottom - 3, 3, 1);
            context.fillStyle = '#9CB565';
            context.fillRect(x + 5, bottom - 2, 1, 1);
            return true;
          }
          if (id.startsWith('ground_cover.fern_low_leaf')) {
            context.fillStyle = '#173F35';
            context.fillRect(x + 3, bottom - 6, 1, 7);
            context.fillStyle = '#3F8150';
            context.fillRect(x, bottom - 5, 4, 1);
            context.fillRect(x + 3, bottom - 4, 5, 1);
            context.fillRect(x + 1, bottom - 3, 3, 1);
            context.fillRect(x + 3, bottom - 2, 4, 1);
            context.fillStyle = '#87AA58';
            context.fillRect(x + 2, bottom - 6, 2, 1);
            return true;
          }
          if (id.startsWith('ground_cover.mushroom')) {
            context.fillStyle = '#594233';
            context.fillRect(x + 2, bottom - 2, 1, 3);
            context.fillRect(x + 5, bottom - 1, 1, 2);
            context.fillStyle = '#D68A55';
            context.fillRect(x, bottom - 4, 5, 2);
            context.fillStyle = '#E9B56C';
            context.fillRect(x + 1, bottom - 5, 3, 1);
            context.fillStyle = '#B44F4F';
            context.fillRect(x + 4, bottom - 3, 4, 2);
            return true;
          }
          if (id.startsWith('vegetation.reed_high_grass')) {
            context.fillStyle = '#385C45';
            for (const offset of [2, 4, 6, 8, 10]) {
              context.fillRect(x + offset, bottom - 10 + (offset % 3), 1, 11 - (offset % 3));
            }
            context.fillStyle = '#8EA45C';
            context.fillRect(x + 3, bottom - 12, 1, 7);
            context.fillRect(x + 7, bottom - 10, 1, 6);
            context.fillStyle = '#A6814F';
            context.fillRect(x + 2, bottom - 13, 3, 2);
            context.fillRect(x + 6, bottom - 11, 3, 2);
            return true;
          }
          if (id.startsWith('vegetation.bush')) {
            context.fillStyle = '#153D34';
            context.fillRect(x + 1, bottom - 7, 10, 8);
            context.fillStyle = '#2C6A45';
            context.fillRect(x, bottom - 8, 6, 5);
            context.fillRect(x + 5, bottom - 10, 6, 7);
            context.fillStyle = '#63A451';
            context.fillRect(x + 2, bottom - 9, 3, 2);
            context.fillRect(x + 7, bottom - 10, 2, 2);
            context.fillStyle = '#D35F57';
            context.fillRect(x + 3, bottom - 6, 1, 1);
            context.fillRect(x + 8, bottom - 5, 1, 1);
            return true;
          }
          return false;
        }

        function drawTemperateTree(context, frame, asset, assetIndex) {
          const family = asset.tags.treeArchetypes[0] ?? '';
          const woodland = family.includes('.woodland.');
          const age = asset.tags.ages[0] ?? 'mature';
          const height = asset.tags.heights[0] ?? 'standard';
          const archetype = Number.parseInt(family.match(/(\d+)$/)?.[1] ?? '1', 10) - 1;
          const seed = hash(asset.id) ^ assetIndex;
          const palette = woodland
            ? ['#213F37', '#315C3A', '#4F7D3E', '#789C4B', '#A0B95A']
            : ['#29473A', '#42683D', '#668B43', '#8EAA4D', '#B5C965'];
          const trunk = woodland
            ? ['#493B2C', '#725136', '#A06E43']
            : ['#53412D', '#805B38', '#B27B45'];
          const centerX = frame.x + Math.floor(frame.width / 2);
          const bottom = frame.y + frame.height - 2;
          const sapling = age === 'sapling';
          const old = age === 'old';
          const tall = height === 'tall';
          const compact = height === 'compact';
          const trunkTop = frame.y + (sapling ? 13 : tall ? 8 : compact ? 13 : 11);
          const trunkWidth = old ? 3 : sapling ? 1 : 2;

          context.fillStyle = trunk[0];
          context.fillRect(
            centerX - Math.floor(trunkWidth / 2),
            trunkTop,
            trunkWidth,
            bottom - trunkTop + 1,
          );
          if (!sapling) {
            context.fillRect(centerX - 4, trunkTop + 2, 4, 1);
            context.fillRect(centerX + 1, trunkTop + (old ? 1 : 3), 4, 1);
          }
          context.fillStyle = trunk[1];
          context.fillRect(centerX, trunkTop + 1, 1, bottom - trunkTop - 1);
          if (old) {
            context.fillStyle = trunk[2];
            context.fillRect(centerX + 1, trunkTop + 4, 1, 4);
            context.fillStyle = trunk[0];
            context.fillRect(centerX - 3, bottom - 1, 7, 1);
          }

          const top = frame.y + (sapling ? 8 : tall ? 1 : compact ? 6 : 3);
          const scale = sapling ? 0.55 : old ? 1.1 : 0.9;
          const clusterSets = [
            [
              [0, 5, 7, 4],
              [-4, 6, 4, 3],
              [4, 6, 4, 3],
            ],
            [
              [0, 5, 7, 3],
              [-4, 4, 4, 3],
              [4, 4, 4, 3],
            ],
            [
              [0, 5, 4, 6],
              [-3, 7, 3, 3],
              [3, 7, 3, 3],
            ],
            [
              [-3, 5, 5, 4],
              [3, 4, 5, 4],
              [0, 8, 5, 3],
            ],
            [
              [-2, 4, 7, 4],
              [4, 7, 3, 3],
            ],
            [
              [0, 5, 7, 5],
              [-5, 7, 4, 3],
              [5, 7, 4, 3],
            ],
          ];
          const clusters = clusterSets[archetype % clusterSets.length];
          for (const [offsetX, offsetY, radiusX, radiusY] of clusters) {
            drawLeafCluster(
              context,
              centerX + Math.round(offsetX * scale),
              top + Math.round(offsetY * scale),
              Math.max(2, Math.round(radiusX * scale)),
              Math.max(2, Math.round(radiusY * scale)),
              palette,
              seed + offsetX * 13 + offsetY * 29,
              frame,
            );
          }
        }

        function drawLeafCluster(
          context,
          centerX,
          centerY,
          radiusX,
          radiusY,
          palette,
          seed,
          frame,
        ) {
          fillEllipse(palette[0], centerX, centerY, radiusX, radiusY);
          fillEllipse(
            palette[1 + (random(seed, 3) % 2)],
            centerX - 1,
            centerY - 1,
            Math.max(1, radiusX - 1),
            Math.max(1, radiusY - 1),
          );
          if (radiusX >= 3 && radiusY >= 3) {
            context.fillStyle = palette[3];
            context.fillRect(
              Math.max(frame.x, centerX - Math.floor(radiusX / 2)),
              Math.max(frame.y, centerY - Math.floor(radiusY / 2)),
              Math.min(3, radiusX),
              1,
            );
            context.fillStyle = palette[4];
            context.fillRect(
              Math.max(frame.x, centerX - Math.floor(radiusX / 2) + 1),
              Math.max(frame.y, centerY - Math.floor(radiusY / 2) - 1),
              1,
              1,
            );
          }

          function fillEllipse(color, ellipseX, ellipseY, ellipseRadiusX, ellipseRadiusY) {
            context.fillStyle = color;
            for (let y = -ellipseRadiusY; y <= ellipseRadiusY; y += 1) {
              for (let x = -ellipseRadiusX; x <= ellipseRadiusX; x += 1) {
                const px = ellipseX + x;
                const py = ellipseY + y;
                if (
                  px < frame.x ||
                  px >= frame.x + frame.width ||
                  py < frame.y ||
                  py >= frame.y + frame.height
                ) {
                  continue;
                }
                const distance =
                  (x * x) / (ellipseRadiusX * ellipseRadiusX) +
                  (y * y) / (ellipseRadiusY * ellipseRadiusY);
                if (distance <= 1) context.fillRect(px, py, 1, 1);
              }
            }
          }
        }

        function drawTemperateDecoration(context, frame, asset) {
          const id = asset.id;
          const x = frame.x;
          const y = frame.y;
          const bottom = y + frame.height - 1;
          if (id.startsWith('ground_cover.grass_tuft')) {
            context.fillStyle = '#315B3D';
            context.fillRect(x + 2, bottom - 3, 1, 4);
            context.fillRect(x + 5, bottom - 4, 1, 5);
            context.fillStyle = '#83A64D';
            context.fillRect(x + 3, bottom - 2, 1, 3);
            context.fillRect(x + 4, bottom - 3, 1, 4);
            return true;
          }
          if (id.startsWith('ground_cover.flower')) {
            context.fillStyle = '#3F6B40';
            context.fillRect(x + 3, bottom - 4, 1, 5);
            context.fillStyle = '#E5C65A';
            context.fillRect(x + 2, bottom - 5, 3, 2);
            context.fillStyle = '#F0E0A0';
            context.fillRect(x + 3, bottom - 6, 1, 1);
            return true;
          }
          if (id.startsWith('ground_cover.moss_lichen')) {
            context.fillStyle = '#3D6840';
            context.fillRect(x + 1, bottom - 2, 5, 2);
            context.fillStyle = '#78964B';
            context.fillRect(x + 2, bottom - 3, 2, 1);
            context.fillRect(x + 5, bottom - 1, 2, 1);
            return true;
          }
          if (id.startsWith('ground_cover.fern_low_leaf')) {
            context.fillStyle = '#2B563B';
            context.fillRect(x + 3, bottom - 5, 1, 6);
            context.fillStyle = '#5F8A43';
            context.fillRect(x + 1, bottom - 4, 3, 1);
            context.fillRect(x + 3, bottom - 3, 4, 1);
            context.fillRect(x + 2, bottom - 2, 2, 1);
            return true;
          }
          if (id.startsWith('ground_cover.mushroom')) {
            context.fillStyle = '#72513A';
            context.fillRect(x + 3, bottom - 2, 1, 3);
            context.fillStyle = '#C97851';
            context.fillRect(x + 1, bottom - 4, 5, 2);
            context.fillStyle = '#E3A36A';
            context.fillRect(x + 2, bottom - 5, 3, 1);
            return true;
          }
          if (id.startsWith('vegetation.reed_high_grass')) {
            context.fillStyle = '#365F3D';
            for (const offset of [3, 5, 7, 9])
              context.fillRect(x + offset, bottom - offset, 1, offset + 1);
            context.fillStyle = '#91A953';
            context.fillRect(x + 4, bottom - 9, 1, 5);
            context.fillRect(x + 8, bottom - 11, 1, 6);
            return true;
          }
          if (id.startsWith('vegetation.bush')) {
            context.fillStyle = '#244B38';
            context.fillRect(x + 1, bottom - 7, 10, 7);
            context.fillStyle = '#47753E';
            context.fillRect(x + 2, bottom - 9, 4, 5);
            context.fillRect(x + 6, bottom - 8, 5, 5);
            context.fillStyle = '#789A4B';
            context.fillRect(x + 3, bottom - 9, 2, 2);
            context.fillRect(x + 7, bottom - 8, 2, 2);
            return true;
          }
          if (id.startsWith('ground_cover.small_stone')) {
            context.fillStyle = '#46575A';
            context.fillRect(x + 2, bottom - 2, 5, 3);
            context.fillStyle = '#82918A';
            context.fillRect(x + 3, bottom - 3, 3, 1);
            return true;
          }
          if (id.startsWith('ground_cover.coast_debris')) {
            context.fillStyle = '#8B714D';
            context.fillRect(x + 1, bottom - 1, 6, 1);
            context.fillRect(x + 5, bottom - 3, 1, 3);
            context.fillStyle = '#E4D39A';
            context.fillRect(x + 2, bottom - 3, 2, 1);
            return true;
          }
          if (id.startsWith('object.rock_cluster')) {
            context.fillStyle = '#384B4D';
            context.fillRect(x + 1, bottom - 5, 10, 6);
            context.fillStyle = '#60716C';
            context.fillRect(x + 2, bottom - 7, 5, 4);
            context.fillRect(x + 7, bottom - 5, 4, 3);
            context.fillStyle = '#9AA58E';
            context.fillRect(x + 3, bottom - 7, 3, 1);
            context.fillRect(x + 8, bottom - 5, 2, 1);
            return true;
          }
          if (id.startsWith('object.deadwood_stump')) {
            context.fillStyle = '#463A2D';
            context.fillRect(x + 3, bottom - 7, 6, 8);
            context.fillStyle = '#7A5838';
            context.fillRect(x + 4, bottom - 9, 5, 3);
            context.fillStyle = '#B17A48';
            context.fillRect(x + 5, bottom - 8, 3, 1);
            return true;
          }
          if (id.startsWith('object.dead_tree')) {
            const center = x + Math.floor(frame.width / 2);
            context.fillStyle = '#3C352D';
            context.fillRect(center - 1, y + 7, 3, frame.height - 8);
            context.fillRect(center - 6, y + 9, 6, 2);
            context.fillRect(center + 1, y + 5, 6, 2);
            context.fillRect(center - 4, y + 4, 2, 6);
            context.fillStyle = '#76563A';
            context.fillRect(center, y + 8, 1, frame.height - 10);
            return true;
          }
          return false;
        }

        function drawTreeShadow(context, frame) {
          context.fillStyle = 'rgba(24,49,58,.62)';
          for (let row = 0; row < 4; row += 1) {
            const inset = row === 0 || row === 3 ? 3 : 1;
            context.fillRect(
              frame.x + inset,
              frame.y + frame.height - 5 + row,
              frame.width - inset * 2,
              1,
            );
          }
        }

        function drawContractFallback(context, frame, category, asset, assetIndex, frameIndex) {
          const colors = {
            'terrain-ground': ['#77945A', '#66824F', '#94AD68'],
            vegetation: ['#41653F', '#66824F', '#94AD68'],
            'ground-decoration': ['#AF995F', '#D7A849', '#94AD68'],
            landmark: ['#596466', '#7A7C70', '#A0A28D'],
            effects: ['rgba(23,42,50,.45)', 'rgba(86,54,104,.7)', 'rgba(181,200,122,.7)'],
            'lod-world': ['#41653F', '#D0BC7A', '#63AFC0'],
          }[category] ?? ['#6A795D', '#87946D', '#B4C47B'];
          const primary = colors[(assetIndex + frameIndex) % colors.length];
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
            context.fillStyle = secondary;
            context.fillRect(
              frame.x + Math.floor(frame.width / 4),
              frame.y + inset,
              Math.ceil(frame.width / 2),
              Math.max(2, Math.floor(frame.height * 0.45)),
            );
          }
        }

        function drawAutotileMask(context, frame, autotile) {
          const masks = [
            ...new Set(Array.from({ length: 256 }, (_, mask) => normalize(mask))),
          ].sort((left, right) => left - right);
          const connected = masks[autotile.topologyCode] ?? 0;
          context.fillStyle = '#FFFFFF';
          const x = frame.x;
          const y = frame.y;
          if ((connected & 1) === 0) context.fillRect(x + 1, y, 2, 1);
          if ((connected & 2) === 0) context.fillRect(x + 3, y + 1, 1, 2);
          if ((connected & 4) === 0) context.fillRect(x + 1, y + 3, 2, 1);
          if ((connected & 8) === 0) context.fillRect(x, y + 1, 1, 2);
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

        function hash(value) {
          let result = 2166136261;
          for (let index = 0; index < value.length; index += 1) {
            result = Math.imul(result ^ value.charCodeAt(index), 16777619);
          }
          return result >>> 0;
        }

        function random(seed, salt) {
          let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
          value ^= value >>> 16;
          value = Math.imul(value, 0x7feb352d);
          value ^= value >>> 15;
          return value >>> 0;
        }

        return silhouettes;
      },
      {
        atlas,
        assets: atlasAssets,
        p2: stage !== 'p1',
        p22: stage === 'p2-2' || stage === 'p2-3' || stage === 'builtin',
        p23: stage === 'p2-3' || stage === 'builtin',
      },
    );
    for (const { family, id, signature } of atlasSilhouettes) {
      const result = silhouetteResults.get(family);
      result.ids.push(id);
      result.signatures.add(signature);
    }
    await page.locator('canvas').screenshot({
      path: path.join(outputRoot, `${atlas.id}.png`),
      omitBackground: true,
    });
    const cropHeight = {
      vegetation: 128,
      'terrain-ground': 96,
      water: 32,
      'ground-decoration': 32,
    }[atlas.category];
    if (cropHeight !== undefined) {
      await page.evaluate(
        ({ sourceWidth, cropHeight, scale }) => {
          const canvas = document.querySelector('canvas');
          const source = document.createElement('canvas');
          source.width = sourceWidth;
          source.height = cropHeight;
          source
            .getContext('2d')
            .drawImage(canvas, 0, 0, sourceWidth, cropHeight, 0, 0, sourceWidth, cropHeight);
          canvas.width = sourceWidth * scale;
          canvas.height = cropHeight * scale;
          const context = canvas.getContext('2d');
          context.imageSmoothingEnabled = false;
          context.fillStyle = '#24343A';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(
            source,
            0,
            0,
            sourceWidth,
            cropHeight,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        },
        { sourceWidth: atlas.width, cropHeight, scale: 4 },
      );
      await page.locator('canvas').screenshot({
        path: path.join(contactSheetRoot, `${atlas.id}-4x.png`),
      });
    }
  }
  if (stage === 'p2-2') {
    for (const [family, result] of silhouetteResults) {
      if (result.ids.length < 3 || result.signatures.size < 3) {
        throw new Error(
          `P2-2 silhouette gate failed for ${family}: ${result.ids.length} assets, ${result.signatures.size} distinct alpha masks`,
        );
      }
    }
    console.log(
      `P2-2 silhouette gate passed: ${silhouetteFamilies.length} families each provide at least 3 distinct alpha masks.`,
    );
  }
} finally {
  await browser.close();
  await vite.close();
}
