import { describe, expect, it } from 'vitest';
import {
  isResidentEntityVisible,
  presentationForView,
  resolveViewLevel,
  viewZoom,
  visibleCellSpan,
  type WorldViewLevel,
} from './strategicView';

describe('strategic world view levels', () => {
  const wideViewport = { mapSize: 128, viewportWidth: 2048, viewportHeight: 1135 };

  it('uses visible map span instead of raw zoom to select semantic detail', () => {
    let level: WorldViewLevel = 'world';

    level = resolveViewLevel(level, 2, wideViewport);
    expect(level).toBe('world');
    level = resolveViewLevel(level, 3, wideViewport);
    expect(level).toBe('settlement');
    level = resolveViewLevel(level, 4, wideViewport);
    expect(level).toBe('settlement');
    level = resolveViewLevel(level, 8, wideViewport);
    expect(level).toBe('resident');
    level = resolveViewLevel(level, 8, wideViewport);
    expect(level).toBe('resident');
    level = resolveViewLevel(level, 6, wideViewport);
    expect(level).toBe('settlement');
  });

  it('assigns viewport-aware camera targets to every semantic level', () => {
    expect(viewZoom('world', wideViewport)).toBe(2);
    expect(viewZoom('settlement', wideViewport)).toBe(4);
    expect(viewZoom('resident', wideViewport)).toBe(8);

    const residentSpan = visibleCellSpan(viewZoom('resident', wideViewport), wideViewport);
    expect(residentSpan.width).toBeLessThanOrEqual(64);
    expect(residentSpan.height).toBeLessThanOrEqual(36);
  });

  it('keeps only strategic information in the global layer', () => {
    expect(presentationForView('world')).toEqual({
      fullEntities: false,
      strategicEntities: false,
      detailedBuildings: false,
      settlementMarkers: true,
      territories: true,
      naturalResources: false,
      terrainDetail: 'macro',
    });
    expect(presentationForView('settlement')).toEqual({
      fullEntities: false,
      strategicEntities: true,
      detailedBuildings: true,
      settlementMarkers: false,
      territories: false,
      naturalResources: false,
      terrainDetail: 'districts',
    });
    expect(presentationForView('resident')).toEqual({
      fullEntities: true,
      strategicEntities: false,
      detailedBuildings: true,
      settlementMarkers: false,
      territories: false,
      naturalResources: true,
      terrainDetail: 'resident',
    });
  });

  it('culls full-body residents outside the close-view camera bounds', () => {
    const bounds = { centerX: 64, centerZ: 64, halfWidth: 12, halfHeight: 8, margin: 2 };

    expect(isResidentEntityVisible(64, 64, bounds)).toBe(true);
    expect(isResidentEntityVisible(77.5, 64, bounds)).toBe(true);
    expect(isResidentEntityVisible(79, 64, bounds)).toBe(false);
    expect(isResidentEntityVisible(64, 75, bounds)).toBe(false);
  });
});
