import { describe, expect, it } from 'vitest';
import { CombatSystem } from './CombatSystem';

describe('CombatSystem', () => {
  it('calculates damage with random variance and minimum 1 damage', () => {
    const system = new CombatSystem();

    expect(
      system.calculateDamage({
        attackPower: 10,
        defense: 3,
        randomFactor: 0.5,
      }),
    ).toBe(7);

    expect(
      system.calculateDamage({
        attackPower: 2,
        defense: 9,
        randomFactor: 0,
      }),
    ).toBe(1);
  });

  it('applies damage to a unit-like target and reports destruction at zero hp', () => {
    const system = new CombatSystem();
    const target = {
      hp: 8,
      maxHp: 8,
    };

    const destroyed = system.applyDamage(target, 5);

    expect(destroyed).toBe(false);
    expect(target.hp).toBe(3);

    const finished = system.applyDamage(target, 10);

    expect(finished).toBe(true);
    expect(target.hp).toBe(0);
  });
});
