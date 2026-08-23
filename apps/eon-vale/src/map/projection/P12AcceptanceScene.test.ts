import { describe, expect, it } from 'vitest';

import { generateWorldSnapshot } from '../generation/WorldGenerator';
import { EnvironmentThemeCode, LandformCode } from '../model/WorldSnapshot';
import { TEMPERATE_MAP_VISUAL_BUNDLE } from '../visual/TemperateMapVisualBundle';
import { createVisualCatalog } from '../visual/VisualCatalog';
import {
  compileP12AcceptanceScene,
  findP12AcceptanceChunks,
  P12_ACCEPTANCE_WORLD,
} from './P12AcceptanceScene';

describe('P1-2 fixed acceptance scenes', () => {
  it('locks deterministic bridge, elevation, and corruption slices', async () => {
    const snapshot = await generateWorldSnapshot(P12_ACCEPTANCE_WORLD);
    const catalog = await createVisualCatalog(TEMPERATE_MAP_VISUAL_BUNDLE, async (source) => {
      const atlas = TEMPERATE_MAP_VISUAL_BUNDLE.manifest.atlases.find(
        ({ id }) => TEMPERATE_MAP_VISUAL_BUNDLE.atlasSources[id] === source,
      );
      if (atlas === undefined) throw new Error(`Unknown P1 atlas: ${source}`);
      return {
        width: atlas.width,
        height: atlas.height,
        pixels: new Uint8ClampedArray(atlas.width * atlas.height * 4),
      };
    });

    expect(findP12AcceptanceChunks(snapshot)).toEqual({
      bridge: 180,
      elevation: 118,
      corruption: 166,
    });
    const bridge = compileP12AcceptanceScene(snapshot, catalog, 'bridge');
    const elevation = compileP12AcceptanceScene(snapshot, catalog, 'elevation');
    const corruption = compileP12AcceptanceScene(snapshot, catalog, 'corruption');
    expect([...bridge.biomeBridges].filter((band) => band > 0).length).toBeGreaterThan(80);
    expect([...elevation.elevationBands].filter((band) => band > 0).length).toBeGreaterThan(120);
    expect([...elevation.landforms]).toContain(LandformCode.Highland);
    expect([...elevation.landforms]).toContain(LandformCode.Mountain);
    expect([...corruption.environmentThemes]).toContain(EnvironmentThemeCode.Corruption);
    expect([...corruption.themeBands]).toContain(1);
    expect([...corruption.themeVisuals].some((handle) => handle !== 0xffff_ffff)).toBe(true);
  });
});
