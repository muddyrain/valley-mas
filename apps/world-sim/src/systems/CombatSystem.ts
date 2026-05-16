export type DamageableTarget = {
  hp: number;
  maxHp: number;
};

export type DamageRollOptions = {
  attackPower: number;
  defense: number;
  weaponMultiplier?: number;
  randomFactor?: number;
};

export class CombatSystem {
  calculateDamage(options: DamageRollOptions) {
    const weaponMultiplier = options.weaponMultiplier ?? 1;
    const randomFactor = options.randomFactor ?? Math.random();
    const variance = 0.8 + randomFactor * 0.4;
    const rawDamage = options.attackPower * weaponMultiplier * variance - options.defense;

    return Math.max(1, Math.floor(rawDamage));
  }

  applyDamage(target: DamageableTarget, damage: number) {
    target.hp = Math.max(0, target.hp - Math.max(0, Math.floor(damage)));
    return target.hp <= 0;
  }
}
