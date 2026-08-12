import { describe, expect, it } from 'vitest';
import {
  isResidentEntityVisible,
  presentationForView,
  resolveViewLevel,
  viewZoom,
  type WorldViewLevel,
} from './strategicView';

describe('strategic world view levels', () => {
  it('uses hysteresis so wheel noise does not flicker between levels', () => {
    let level: WorldViewLevel = 'world';

    level = resolveViewLevel(level, 1.7);
    expect(level).toBe('world');
    level = resolveViewLevel(level, 1.85);
    expect(level).toBe('settlement');
    level = resolveViewLevel(level, 1.55);
    expect(level).toBe('settlement');
    level = resolveViewLevel(level, 1.4);
    expect(level).toBe('world');

    level = resolveViewLevel('settlement', 4.35);
    expect(level).toBe('resident');
    level = resolveViewLevel(level, 3.9);
    expect(level).toBe('resident');
    level = resolveViewLevel(level, 3.7);
    expect(level).toBe('settlement');
  });

  it('assigns a stable camera target to every semantic level', () => {
    expect(viewZoom('world', 128)).toBe(1);
    expect(viewZoom('settlement', 128)).toBeGreaterThanOrEqual(2.6);
    expect(viewZoom('settlement', 128)).toBeLessThan(4);
    expect(viewZoom('resident', 128)).toBeGreaterThanOrEqual(5.8);
    expect(viewZoom('resident', 128)).toBeLessThanOrEqual(6.2);
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
