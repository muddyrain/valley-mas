import { beforeAll, describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import type { WorldSnapshot } from '../model/WorldSnapshot';
import { BUILT_IN_MAP_VISUAL_BUNDLE } from '../visual/BuiltInMapVisualBundle';
import { createVisualCatalog, type VisualCatalog } from '../visual/VisualCatalog';
import { compileChunkPlan, compileWorldViewPlan } from './MapProjection';

const FIXED_TEMPLATE = 'continent';
const FIXED_SEED = 0x1a2b3c4d;
const VISIBLE_CHUNKS = [145, 146, 147, 161, 162, 163, 177, 178, 179] as const;

describe('MapProjection cold visible-detail budget', () => {
  let snapshot: WorldSnapshot;
  let catalog: VisualCatalog;

  beforeAll(async () => {
    snapshot = await generateWorldSnapshot({ templateId: FIXED_TEMPLATE, seed: FIXED_SEED });
    catalog = await createVisualCatalog(BUILT_IN_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = BUILT_IN_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => BUILT_IN_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });
  });

  it('compiles the fixed nine-chunk visible set within the 150ms detail budget', () => {
    const startedAt = performance.now();
    const checksums = VISIBLE_CHUNKS.map((chunkIndex) =>
      compileChunkPlan(snapshot, catalog, chunkIndex),
    ).map(({ checksum }) => checksum);
    const elapsedMs = performance.now() - startedAt;

    expect(new Set(checksums).size).toBe(VISIBLE_CHUNKS.length);
    expect(elapsedMs).toBeLessThanOrEqual(150);
  });

  it('compiles the complete textured world overview within 350ms', () => {
    const startedAt = performance.now();
    const plan = compileWorldViewPlan(snapshot, catalog);
    const elapsedMs = performance.now() - startedAt;

    expect(plan.treeMarkerCount).toBeGreaterThan(100);
    expect(elapsedMs).toBeLessThanOrEqual(350);
  });
});
