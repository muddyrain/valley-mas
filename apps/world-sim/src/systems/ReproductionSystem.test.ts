import * as Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import type { UnitState } from '../agent/states/UnitStateTypes';
import { type ReproductionAgent, ReproductionSystem } from './ReproductionSystem';

function createAgent(overrides: Partial<ReproductionAgent> = {}): ReproductionAgent {
  return {
    id: 'unit-1',
    name: 'unit-1',
    race: 'human',
    factionId: 'faction-1',
    gender: 'male',
    age: 18,
    hp: 100,
    vitality: 100,
    state: 'Idle' as UnitState,
    position: new Phaser.Math.Vector2(24, 24),
    isDead: false,
    ...overrides,
  };
}

describe('ReproductionSystem', () => {
  it('creates a child for an adult male/female pair when food is available', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const canAffordBirth = vi.fn(() => true);
    const spendBirthCost = vi.fn(() => true);
    const system = new ReproductionSystem({
      canAffordBirth,
      spendBirthCost,
    });

    const births = system.update(300_000, [
      createAgent({ id: 'father', gender: 'male', position: new Phaser.Math.Vector2(16, 16) }),
      createAgent({ id: 'mother', gender: 'female', position: new Phaser.Math.Vector2(20, 16) }),
    ]);

    expect(canAffordBirth).toHaveBeenCalledWith('faction-1');
    expect(spendBirthCost).toHaveBeenCalledWith('faction-1');
    expect(births).toHaveLength(1);
    expect(births[0]).toMatchObject({
      parents: ['father', 'mother'],
      child: {
        age: 0,
        hp: 100,
        vitality: 100,
        factionId: 'faction-1',
        race: 'human',
        gender: 'male',
      },
    });
    expect(births[0].child.position).toEqual(new Phaser.Math.Vector2(18, 16));
  });

  it('does not spawn again during the cooldown window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const canAffordBirth = vi.fn(() => true);
    const spendBirthCost = vi.fn(() => true);
    const system = new ReproductionSystem({
      canAffordBirth,
      spendBirthCost,
    });

    const units = [
      createAgent({ id: 'father', gender: 'male', position: new Phaser.Math.Vector2(16, 16) }),
      createAgent({ id: 'mother', gender: 'female', position: new Phaser.Math.Vector2(20, 16) }),
    ];

    expect(system.update(300_000, units)).toHaveLength(1);
    expect(system.update(1_000, units)).toHaveLength(0);
    expect(spendBirthCost).toHaveBeenCalledTimes(1);
  });

  it('skips reproduction when the pair is invalid or food is missing', () => {
    const canAffordBirth = vi.fn(() => false);
    const spendBirthCost = vi.fn(() => true);
    const system = new ReproductionSystem({
      canAffordBirth,
      spendBirthCost,
    });

    const births = system.update(300_000, [
      createAgent({ id: 'father', gender: 'male', position: new Phaser.Math.Vector2(16, 16) }),
      createAgent({
        id: 'mother',
        gender: 'female',
        age: 8,
        position: new Phaser.Math.Vector2(20, 16),
      }),
    ]);

    expect(births).toHaveLength(0);
    expect(canAffordBirth).not.toHaveBeenCalled();
    expect(spendBirthCost).not.toHaveBeenCalled();
  });

  it('applies the population limit per faction instead of globally', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const canAffordBirth = vi.fn(() => true);
    const spendBirthCost = vi.fn(() => true);
    const system = new ReproductionSystem({
      canAffordBirth,
      spendBirthCost,
      populationLimit: 4,
    });

    const cappedHumanUnits = Array.from({ length: 4 }, (_, index) =>
      createAgent({
        id: `human-${index}`,
        factionId: 'human-faction',
        gender: index % 2 === 0 ? 'male' : 'female',
        position: new Phaser.Math.Vector2(96 + index * 32, 96),
      }),
    );
    const orcParents = [
      createAgent({
        id: 'orc-father',
        factionId: 'orc-faction',
        race: 'orc',
        gender: 'male',
        position: new Phaser.Math.Vector2(16, 16),
      }),
      createAgent({
        id: 'orc-mother',
        factionId: 'orc-faction',
        race: 'orc',
        gender: 'female',
        position: new Phaser.Math.Vector2(20, 16),
      }),
    ];

    const births = system.update(300_000, [...cappedHumanUnits, ...orcParents]);

    expect(births).toHaveLength(1);
    expect(births[0].child).toMatchObject({
      factionId: 'orc-faction',
      race: 'orc',
    });
    expect(canAffordBirth).toHaveBeenCalledWith('orc-faction');
    expect(spendBirthCost).toHaveBeenCalledWith('orc-faction');
  });
});
