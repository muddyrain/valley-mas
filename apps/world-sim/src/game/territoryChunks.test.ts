import { describe, expect, it } from 'vitest';
import {
  buildVisibleRegionIdsForViewport,
  buildVisibleTerritoryChunks,
  TERRITORY_CHUNK_SIZE_TILES,
  type TerritoryRegion,
} from './territoryChunks';

type TestRegion = TerritoryRegion & {
  name: string;
  center: { x: number; y: number };
  ownerFactionId: string;
  stability: number;
  coreExposure: number;
  resourceValue: number;
  terrainModifier: number;
  tileIndices: number[];
  renderRuns: { x: number; y: number; length: number }[];
  neighborRegionIds: string[];
  pressureStreakTicks: number;
  postCaptureVulnerabilityTicks: number;
  currentPressure: number;
  lastMomentum: number;
};

function region(id: string, x: number, y: number): TestRegion {
  return {
    id,
    name: id,
    center: { x: x + 4, y: y + 4 },
    ownerFactionId: 'faction-a',
    stability: 70,
    coreExposure: 0,
    resourceValue: 10,
    terrainModifier: 1,
    bounds: { minX: x, minY: y, maxX: x + 7, maxY: y + 7 },
    tileIndices: [],
    renderRuns: Array.from({ length: 8 }, (_, offset) => ({ x, y: y + offset, length: 8 })),
    neighborRegionIds: [],
    pressureStreakTicks: 0,
    postCaptureVulnerabilityTicks: 0,
    currentPressure: 0,
    lastMomentum: 0,
  };
}

describe('territory chunks', () => {
  it('returns only chunks touched by the current viewport', () => {
    const chunks = buildVisibleTerritoryChunks({
      width: 256,
      height: 256,
      viewport: { x: 70, y: 70, width: 32, height: 32 },
    });

    expect(chunks.map((chunk) => chunk.key)).toEqual(['1:1']);
    expect(TERRITORY_CHUNK_SIZE_TILES).toBe(64);
  });

  it('finds visible regions from static geometry without needing projection tiles', () => {
    const visible = buildVisibleRegionIdsForViewport(
      { regions: [region('inside', 8, 8), region('outside', 80, 80)] },
      new Map([
        ['inside', { renderRuns: region('inside', 8, 8).renderRuns }],
        ['outside', { renderRuns: region('outside', 80, 80).renderRuns }],
      ]),
      { x: 0, y: 0, width: 32, height: 32 },
    );

    expect([...visible]).toEqual(['inside']);
  });
});
