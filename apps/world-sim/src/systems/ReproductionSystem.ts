import * as Phaser from 'phaser';
import type { UnitState } from '../agent/states/UnitStateTypes';

export type ReproductionRace = 'human' | 'orc' | 'elf' | 'dwarf';
export type ReproductionGender = 'male' | 'female';

export type ReproductionAgent = {
  id: string;
  name: string;
  race: ReproductionRace;
  factionId: string;
  gender: ReproductionGender;
  age: number;
  hp: number;
  vitality: number;
  state: UnitState;
  position: Phaser.Math.Vector2;
  isDead: boolean;
};

export type ReproductionBirth = {
  parents: [string, string];
  child: {
    id: string;
    name: string;
    race: ReproductionRace;
    factionId: string;
    gender: ReproductionGender;
    age: number;
    hp: number;
    vitality: number;
    state: UnitState;
    position: Phaser.Math.Vector2;
  };
};

export type ReproductionSystemOptions = {
  canAffordBirth: (factionId: string) => boolean;
  spendBirthCost: (factionId: string) => boolean;
  populationLimit?: number;
  adultAgeMin?: number;
  adultAgeMax?: number;
  pairDistance?: number;
  cooldownMs?: number;
};

const DEFAULT_POPULATION_LIMIT = 150;
const DEFAULT_ADULT_AGE_MIN = 10;
const DEFAULT_ADULT_AGE_MAX = 50;
const DEFAULT_PAIR_DISTANCE = 24;
const DEFAULT_COOLDOWN_MS = 5 * 60_000;

export class ReproductionSystem {
  private readonly pairCooldowns = new Map<string, number>();
  private birthSequence = 1;

  constructor(private readonly options: ReproductionSystemOptions) {}

  update(deltaMs: number, units: ReproductionAgent[]) {
    this.tickCooldowns(deltaMs);

    const births: ReproductionBirth[] = [];
    const livingUnits = units.filter((unit) => unit.isDead === false);

    if (livingUnits.length >= (this.options.populationLimit ?? DEFAULT_POPULATION_LIMIT)) {
      return births;
    }

    const usedUnitIds = new Set<string>();

    for (let index = 0; index < livingUnits.length; index += 1) {
      const first = livingUnits[index];

      if (usedUnitIds.has(first.id) || !this.isFertile(first)) {
        continue;
      }

      for (let otherIndex = index + 1; otherIndex < livingUnits.length; otherIndex += 1) {
        const second = livingUnits[otherIndex];

        if (usedUnitIds.has(second.id) || !this.isFertile(second)) {
          continue;
        }

        if (!this.canPair(first, second)) {
          continue;
        }

        const pairKey = this.getPairKey(first.id, second.id);
        if ((this.pairCooldowns.get(pairKey) ?? 0) > 0) {
          continue;
        }

        if (!this.options.canAffordBirth(first.factionId)) {
          continue;
        }

        if (!this.options.spendBirthCost(first.factionId)) {
          continue;
        }

        const birth = this.createBirth(first, second);
        births.push(birth);
        usedUnitIds.add(first.id);
        usedUnitIds.add(second.id);
        this.pairCooldowns.set(pairKey, this.options.cooldownMs ?? DEFAULT_COOLDOWN_MS);
        break;
      }
    }

    return births;
  }

  private tickCooldowns(deltaMs: number) {
    for (const [pairKey, remainingMs] of this.pairCooldowns) {
      const nextRemainingMs = remainingMs - deltaMs;

      if (nextRemainingMs <= 0) {
        this.pairCooldowns.delete(pairKey);
        continue;
      }

      this.pairCooldowns.set(pairKey, nextRemainingMs);
    }
  }

  private isFertile(unit: ReproductionAgent) {
    return (
      unit.age >= (this.options.adultAgeMin ?? DEFAULT_ADULT_AGE_MIN) &&
      unit.age <= (this.options.adultAgeMax ?? DEFAULT_ADULT_AGE_MAX)
    );
  }

  private canPair(first: ReproductionAgent, second: ReproductionAgent) {
    if (first.factionId !== second.factionId) {
      return false;
    }

    if (first.gender === second.gender) {
      return false;
    }

    return (
      Phaser.Math.Distance.Between(
        first.position.x,
        first.position.y,
        second.position.x,
        second.position.y,
      ) <= (this.options.pairDistance ?? DEFAULT_PAIR_DISTANCE)
    );
  }

  private createBirth(first: ReproductionAgent, second: ReproductionAgent): ReproductionBirth {
    const femaleParent = first.gender === 'female' ? first : second;
    const maleParent = first.gender === 'male' ? first : second;
    const childGender: ReproductionGender = Math.random() < 0.5 ? 'male' : 'female';
    const midpoint = new Phaser.Math.Vector2(
      (first.position.x + second.position.x) / 2,
      (first.position.y + second.position.y) / 2,
    );
    const birthIndex = this.birthSequence;

    this.birthSequence += 1;

    return {
      parents: [maleParent.id, femaleParent.id],
      child: {
        id: `birth-${birthIndex}`,
        name: `newborn-${birthIndex}`,
        race: first.race,
        factionId: first.factionId,
        gender: childGender,
        age: 0,
        hp: 100,
        vitality: 100,
        state: 'Idle',
        position: midpoint,
      },
    };
  }

  private getPairKey(firstId: string, secondId: string) {
    return [firstId, secondId].sort().join('::');
  }
}
