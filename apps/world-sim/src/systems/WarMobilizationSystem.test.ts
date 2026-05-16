import * as Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { WarMobilizationSystem } from './WarMobilizationSystem';

describe('WarMobilizationSystem', () => {
  it('mobilizes living units from both factions toward the rally point with spacing', () => {
    const warMobilizationSystem = new WarMobilizationSystem();
    const rallyPoint = new Phaser.Math.Vector2(64, 32);
    const units = [
      {
        id: 'human-1',
        factionId: 'faction-1',
        isDead: false,
        moveTo: vi.fn(),
      },
      {
        id: 'human-2',
        factionId: 'faction-1',
        isDead: false,
        moveTo: vi.fn(),
      },
      {
        id: 'orc-1',
        factionId: 'faction-2',
        isDead: false,
        moveTo: vi.fn(),
      },
      {
        id: 'orc-dead',
        factionId: 'faction-2',
        isDead: true,
        moveTo: vi.fn(),
      },
      {
        id: 'neutral',
        factionId: 'faction-3',
        isDead: false,
        moveTo: vi.fn(),
      },
    ];

    const mobilizedCount = warMobilizationSystem.mobilize(
      [
        {
          firstFactionId: 'faction-1',
          secondFactionId: 'faction-2',
          rallyPoint,
        },
      ],
      units,
    );

    expect(mobilizedCount).toBe(3);
    expect(units[0].moveTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(units[1].moveTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(units[2].moveTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    expect(units[3].moveTo).not.toHaveBeenCalled();
    expect(units[4].moveTo).not.toHaveBeenCalled();
  });
});
