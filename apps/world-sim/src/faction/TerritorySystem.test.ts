import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { createSmallTestMap } from '../test/createTestMap';
import { TerritorySystem } from './TerritorySystem';

describe('TerritorySystem', () => {
  it('claims a square radius of tiles around a world point for a faction', () => {
    const map = createSmallTestMap([], 8);
    const territorySystem = new TerritorySystem(map);

    const result = territorySystem.claimAroundWorldPoint(
      'faction-1',
      new Phaser.Math.Vector2(56, 56),
      1,
    );

    expect(result.claimedCount).toBe(9);
    expect(result.changedTiles).toHaveLength(9);
    expect(territorySystem.getTerritoryCount('faction-1')).toBe(9);
    expect(map.tiles[2 * map.width + 2].ownerFactionId).toBe('faction-1');
    expect(map.tiles[4 * map.width + 4].ownerFactionId).toBe('faction-1');
    expect(map.tiles[1 * map.width + 1].ownerFactionId).toBeUndefined();
  });

  it('skips out-of-bounds tiles when claiming near the map edge', () => {
    const map = createSmallTestMap([], 4);
    const territorySystem = new TerritorySystem(map);

    const result = territorySystem.claimAroundWorldPoint(
      'faction-1',
      new Phaser.Math.Vector2(8, 8),
    );

    expect(result.claimedCount).toBe(16);
    expect(territorySystem.getTerritoryCount('faction-1')).toBe(16);
  });

  it('updates faction territory counts when ownership changes', () => {
    const map = createSmallTestMap(
      [
        {
          x: 1,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
      ],
      3,
    );
    const territorySystem = new TerritorySystem(map);

    territorySystem.claimAroundWorldPoint('faction-1', new Phaser.Math.Vector2(24, 24), 0);

    expect(territorySystem.getTerritoryCount('faction-1')).toBe(1);
    expect(territorySystem.getTerritoryCount('faction-2')).toBe(0);
    expect(map.tiles[1 * map.width + 1].ownerFactionId).toBe('faction-1');
  });

  it('clears defeated faction territory around a contested point to neutral', () => {
    const map = createSmallTestMap(
      [
        {
          x: 1,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 2,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 3,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-3',
        },
        {
          x: 1,
          y: 2,
          terrainType: 'grass',
        },
      ],
      5,
    );
    const territorySystem = new TerritorySystem(map);

    const result = territorySystem.captureAroundWorldPoint(
      'faction-1',
      'faction-2',
      new Phaser.Math.Vector2(24, 24),
      1,
    );

    expect(result.capturedCount).toBe(2);
    expect(result.changedTiles).toHaveLength(2);
    expect(territorySystem.getTerritoryCount('faction-1')).toBe(0);
    expect(territorySystem.getTerritoryCount('faction-2')).toBe(0);
    expect(map.tiles[1 * map.width + 3].ownerFactionId).toBe('faction-3');
    expect(map.tiles[2 * map.width + 1].ownerFactionId).toBeUndefined();
  });

  it('clears all remaining territory when a faction is eliminated', () => {
    const map = createSmallTestMap(
      [
        {
          x: 0,
          y: 0,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 4,
          y: 4,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 2,
          y: 2,
          terrainType: 'grass',
          ownerFactionId: 'faction-3',
        },
      ],
      5,
    );
    const territorySystem = new TerritorySystem(map);

    const result = territorySystem.captureAllFactionTerritory('faction-1', 'faction-2');

    expect(result.capturedCount).toBe(2);
    expect(territorySystem.getTerritoryCount('faction-1')).toBe(0);
    expect(territorySystem.getTerritoryCount('faction-2')).toBe(0);
    expect(map.tiles[2 * map.width + 2].ownerFactionId).toBe('faction-3');
    expect(map.tiles[0 * map.width + 0].ownerFactionId).toBeUndefined();
    expect(map.tiles[4 * map.width + 4].ownerFactionId).toBeUndefined();
  });

  it('detects unique territory contacts between neighboring factions', () => {
    const map = createSmallTestMap(
      [
        {
          x: 1,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-1',
        },
        {
          x: 2,
          y: 1,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 1,
          y: 2,
          terrainType: 'grass',
          ownerFactionId: 'faction-2',
        },
        {
          x: 3,
          y: 3,
          terrainType: 'grass',
          ownerFactionId: 'faction-3',
        },
      ],
      5,
    );
    const territorySystem = new TerritorySystem(map);

    expect(territorySystem.getAdjacentFactionPairs()).toEqual([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);
  });
});
