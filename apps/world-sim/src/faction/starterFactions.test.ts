import { describe, expect, it } from 'vitest';
import { createM1StarterFactions, getHumanPrototypeCampPoints } from './starterFactions';

describe('createM1StarterFactions', () => {
  it('creates two visible starter factions with paired units and starter territory', () => {
    const starters = createM1StarterFactions({
      width: 64,
      height: 64,
      tileSize: 16,
    });

    expect(starters).toHaveLength(2);
    expect(starters.map((starter) => starter.factionId)).toEqual(['faction-1', 'faction-2']);
    expect(starters.map((starter) => starter.race)).toEqual(['human', 'orc']);
    expect(starters[1].units.every((unit) => unit.wanderRadius === 32)).toBe(true);

    for (const starter of starters) {
      expect(starter.starterTerritoryRadiusTiles).toBe(2);
      expect(starter.units).toHaveLength(2);
      expect(starter.units.map((unit) => unit.gender)).toEqual(['male', 'female']);
      expect(starter.units.every((unit) => unit.factionId === starter.factionId)).toBe(true);
      expect(starter.units.every((unit) => unit.restPoint.x === starter.capitalPosition.x)).toBe(
        true,
      );
      expect(starter.units.every((unit) => unit.restPoint.y === starter.capitalPosition.y)).toBe(
        true,
      );
      expect(starter.buildPoint).toEqual({
        x: starter.capitalPosition.x + 16,
        y: starter.capitalPosition.y + 16,
      });
    }
  });

  it('keeps the human prototype build and rest points near the human starter camp', () => {
    const map = {
      width: 64,
      height: 64,
      tileSize: 16,
    };
    const [humanStarter] = createM1StarterFactions(map);
    const campPoints = getHumanPrototypeCampPoints(map);

    expect(campPoints.buildPoint).toEqual({
      x: humanStarter.capitalPosition.x + map.tileSize,
      y: humanStarter.capitalPosition.y + map.tileSize,
    });
    expect(campPoints.restPoint).toEqual(humanStarter.capitalPosition);
  });
});
