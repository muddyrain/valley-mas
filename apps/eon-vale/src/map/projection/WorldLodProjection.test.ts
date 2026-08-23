import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import { LandformCode } from '../model/WorldSnapshot';
import { WORLD_RULES_CATALOG } from '../rules/WorldRulesCatalog';
import { BUILT_IN_MAP_VISUAL_BUNDLE } from '../visual/BuiltInMapVisualBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import { compileWorldViewPlan } from './MapProjection';

describe('world LOD projection', () => {
  it('compiles all eight template structures into deterministic, textured world plans', async () => {
    const catalog = await createVisualCatalog(BUILT_IN_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = BUILT_IN_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => BUILT_IN_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown built-in atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    for (const [index, template] of WORLD_RULES_CATALOG.templates.entries()) {
      const seed = (0x1357_9bdf + index * 0x1020_3041) >>> 0;
      const snapshot = await generateWorldSnapshot({ templateId: template.id, seed });
      const first = compileWorldViewPlan(snapshot, catalog);
      if (index === 0) {
        const second = compileWorldViewPlan(snapshot, catalog);
        expect(first.rgba).toEqual(second.rgba);
        expect(first.vegetationMarkers.visualHandles).toEqual(
          second.vegetationMarkers.visualHandles,
        );
        expect(first.vegetationMarkers.anchorX).toEqual(second.vegetationMarkers.anchorX);
      }
      const treeIds = new Set(WORLD_RULES_CATALOG.treeArchetypes.map(({ numericId }) => numericId));
      const treeObjectCount = [...snapshot.objects.semanticFamilyIds].filter((id) =>
        treeIds.has(id),
      ).length;
      if (treeObjectCount > 0) expect(first.treeMarkerCount).toBeGreaterThan(0);
      expect(first.treeMarkerCount).toBe(first.vegetationMarkers.visualHandles.length);
      expect(new Set(snapshot.cells.landform).has(LandformCode.DeepOcean)).toBe(true);
      expect(new Set(snapshot.cells.landform).has(LandformCode.Lowland)).toBe(true);
      expect(countDistinctRgb(first.rgba)).toBeGreaterThan(48);
    }
  }, 60_000);
});

function countDistinctRgb(rgba: Uint8ClampedArray): number {
  const colors = new Set<number>();
  for (let offset = 0; offset < rgba.length; offset += 4) {
    colors.add(
      ((rgba[offset] ?? 0) << 16) | ((rgba[offset + 1] ?? 0) << 8) | (rgba[offset + 2] ?? 0),
    );
  }
  return colors.size;
}
