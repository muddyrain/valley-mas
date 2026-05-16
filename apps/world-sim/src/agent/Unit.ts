import * as Phaser from 'phaser';
import { StateMachine } from './StateMachine';
import { AttackState } from './states/AttackState';
import { BuildState } from './states/BuildState';
import { FleeState } from './states/FleeState';
import { HarvestState } from './states/HarvestState';
import { IdleState } from './states/IdleState';
import { MarchState } from './states/MarchState';
import { RestState } from './states/RestState';
import type { UnitState, UnitStateContext } from './states/UnitStateTypes';
import { WanderState } from './states/WanderState';

export type UnitOptions = {
  id: string;
  scene: Phaser.Scene;
  x: number;
  y: number;
  name?: string;
  race?: 'human' | 'orc' | 'elf' | 'dwarf';
  gender?: 'male' | 'female';
  factionId?: string;
  factionColor?: number;
  traits?: string[];
  speed?: number;
  wanderRadius?: number;
  hp?: number;
  vitality?: number;
  age?: number;
  worldBounds: Phaser.Geom.Rectangle;
  pickHarvestTarget: () => Phaser.Math.Vector2 | undefined;
  harvestResource: () => boolean;
  hasBuildTask: () => boolean;
  hasAttackTask?: () => boolean;
  hasFleeTask?: () => boolean;
  shouldHarvest?: () => boolean;
  pickBuildTarget: () => Phaser.Math.Vector2 | undefined;
  pickAttackTarget?: () => Phaser.Math.Vector2 | undefined;
  pickFleeTarget?: () => Phaser.Math.Vector2 | undefined;
  buildAtTarget: (deltaMs: number) => boolean;
  attackAtTarget?: (deltaMs: number) => boolean;
  restPoint: Phaser.Math.Vector2;
};

const MAX_HP = 100;
const MAX_VITALITY = 100;
const LOW_VITALITY_THRESHOLD = 30;
const NATURAL_DEATH_AGE = 60;
const GAME_YEAR_MS = 60_000;
const VITALITY_DRAIN_PER_SECOND = 1;
const VITALITY_REST_RECOVERY_PER_SECOND = 9;
const HP_DRAIN_PER_SECOND_AT_ZERO_VITALITY = 6;
const DEFAULT_WANDER_RADIUS = 120;
const WANDER_MIN_DISTANCE = 36;

export class Unit {
  readonly id: string;
  readonly name: string;
  readonly race: 'human' | 'orc' | 'elf' | 'dwarf';
  readonly gender: 'male' | 'female';
  readonly factionId: string;
  readonly factionColor: number;
  readonly traits: string[];
  readonly sprite: Phaser.GameObjects.Rectangle;
  readonly factionBadge: Phaser.GameObjects.Rectangle;
  readonly speed: number;
  readonly maxHp = MAX_HP;
  readonly maxVitality = MAX_VITALITY;

  hp: number;
  vitality: number;
  age: number;

  private target?: Phaser.Math.Vector2;
  private readonly worldBounds: Phaser.Geom.Rectangle;
  private readonly pickHarvestTargetFn: () => Phaser.Math.Vector2 | undefined;
  private readonly harvestResourceFn: () => boolean;
  private readonly hasBuildTaskFn: () => boolean;
  private readonly hasAttackTaskFn: () => boolean;
  private readonly hasFleeTaskFn: () => boolean;
  private readonly shouldHarvestFn: () => boolean;
  private readonly pickBuildTargetFn: () => Phaser.Math.Vector2 | undefined;
  private readonly pickAttackTargetFn: () => Phaser.Math.Vector2 | undefined;
  private readonly pickFleeTargetFn: () => Phaser.Math.Vector2 | undefined;
  private readonly buildAtTargetFn: (deltaMs: number) => boolean;
  private readonly attackAtTargetFn: (deltaMs: number) => boolean;
  private readonly restPoint: Phaser.Math.Vector2;
  private readonly scene: Phaser.Scene;
  private readonly wanderRadius: number;
  private readonly stateContext: UnitStateContext;
  private readonly stateMachine: StateMachine<UnitState, UnitStateContext>;
  private gameYearElapsedMs = 0;
  private dead = false;

  constructor(options: UnitOptions) {
    this.id = options.id;
    this.name = options.name ?? options.id;
    this.race = options.race ?? 'human';
    this.gender = options.gender ?? 'male';
    this.factionId = options.factionId ?? 'faction-1';
    this.factionColor = options.factionColor ?? 0x1a1c2c;
    this.traits = [...(options.traits ?? [])];
    this.speed = options.speed ?? 96;
    this.wanderRadius = Math.max(0, options.wanderRadius ?? DEFAULT_WANDER_RADIUS);
    this.hp = Phaser.Math.Clamp(options.hp ?? MAX_HP, 0, MAX_HP);
    this.vitality = Phaser.Math.Clamp(options.vitality ?? MAX_VITALITY, 0, MAX_VITALITY);
    this.age = Math.max(0, Math.floor(options.age ?? 18));
    this.scene = options.scene;
    this.worldBounds = options.worldBounds;
    this.pickHarvestTargetFn = options.pickHarvestTarget;
    this.harvestResourceFn = options.harvestResource;
    this.hasBuildTaskFn = options.hasBuildTask;
    this.hasAttackTaskFn = options.hasAttackTask ?? (() => false);
    this.hasFleeTaskFn = options.hasFleeTask ?? (() => false);
    this.shouldHarvestFn = options.shouldHarvest ?? (() => true);
    this.pickBuildTargetFn = options.pickBuildTarget;
    this.pickAttackTargetFn = options.pickAttackTarget ?? (() => undefined);
    this.pickFleeTargetFn = options.pickFleeTarget ?? (() => undefined);
    this.buildAtTargetFn = options.buildAtTarget;
    this.attackAtTargetFn = options.attackAtTarget ?? (() => false);
    this.restPoint = options.restPoint.clone();
    this.sprite = options.scene.add.rectangle(options.x, options.y, 14, 14, 0xf4f4f4, 1);
    this.sprite.setStrokeStyle(2, this.factionColor, 0.9);
    this.sprite.setDepth(10);
    this.factionBadge = options.scene.add.rectangle(
      options.x,
      options.y - 9,
      8,
      3,
      this.factionColor,
      1,
    );
    this.factionBadge.setDepth(11);

    this.stateContext = {
      waitUntil: 0,
      now: 0,
      hasTarget: () => this.hasTarget(),
      moveTowardTarget: (deltaMs: number) => this.moveTowardTarget(deltaMs),
      pickWanderTarget: () => this.pickWanderTarget(),
      pickHarvestTarget: () => this.pickHarvestTarget(),
      pickBuildTarget: () => this.pickBuildTarget(),
      pickRestTarget: () => this.pickRestTarget(),
      pickAttackTarget: () => this.pickAttackTarget(),
      pickFleeTarget: () => this.pickFleeTarget(),
      harvestResource: () => this.harvestResource(),
      hasBuildTask: () => this.hasBuildTask(),
      hasAttackTask: () => this.hasAttackTask(),
      hasFleeTask: () => this.hasFleeTask(),
      shouldHarvest: () => this.shouldHarvest(),
      buildAtTarget: (deltaMs: number) => this.buildAtTarget(deltaMs),
      attackAtTarget: (deltaMs: number) => this.attackAtTarget(deltaMs),
      isRested: () => this.vitality >= 80,
      transition: (state: UnitState) => this.stateMachine.transition(state),
    };
    this.stateMachine = new StateMachine<UnitState, UnitStateContext>(
      this.stateContext,
      {
        Idle: new IdleState(),
        Wander: new WanderState(),
        March: new MarchState(),
        Harvest: new HarvestState(),
        Build: new BuildState(),
        Rest: new RestState(),
        Attack: new AttackState(),
        Flee: new FleeState(),
      },
      'Idle',
    );
  }

  get position() {
    return new Phaser.Math.Vector2(this.sprite.x, this.sprite.y);
  }

  get targetPosition() {
    return this.target?.clone();
  }

  get state() {
    return this.stateMachine.state;
  }

  get isDead() {
    return this.dead;
  }

  moveTo(x: number, y: number) {
    if (this.dead) {
      return;
    }

    this.setTarget(x, y);
    this.stateMachine.transition('March');
  }

  update(deltaMs: number) {
    if (this.dead) {
      return;
    }

    this.stateContext.now += deltaMs;
    this.updateSurvival(deltaMs);

    if (this.dead) {
      return;
    }

    if (this.vitality < LOW_VITALITY_THRESHOLD && this.stateMachine.state !== 'Rest') {
      this.stateMachine.transition('Rest');
    }

    if (this.hp < this.maxHp * 0.2 && this.stateMachine.state !== 'Flee') {
      this.stateMachine.transition('Flee');
    } else if (
      this.stateMachine.state !== 'Attack' &&
      this.stateMachine.state !== 'Flee' &&
      this.hasAttackTask()
    ) {
      this.stateMachine.transition('Attack');
    }

    this.stateMachine.update(deltaMs);
    this.syncSpriteStyle();
  }

  applyDamage(amount: number) {
    if (this.dead) {
      return true;
    }

    this.hp = Phaser.Math.Clamp(this.hp - Math.max(0, Math.floor(amount)), 0, this.maxHp);

    if (this.hp <= 0) {
      this.die();
      return true;
    }

    return false;
  }

  destroy() {
    this.dead = true;
    this.factionBadge.destroy();
    this.sprite.destroy();
  }

  private setTarget(x: number, y: number) {
    this.target = new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, this.worldBounds.left, this.worldBounds.right),
      Phaser.Math.Clamp(y, this.worldBounds.top, this.worldBounds.bottom),
    );
  }

  private hasTarget() {
    return Boolean(this.target);
  }

  private moveTowardTarget(deltaMs: number) {
    if (!this.target) {
      return true;
    }

    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y,
    );
    const step = (this.speed * deltaMs) / 1000;

    if (distance <= step) {
      this.sprite.setPosition(this.target.x, this.target.y);
      this.target = undefined;
      return true;
    }

    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y,
    );
    this.sprite.x += Math.cos(angle) * step;
    this.sprite.y += Math.sin(angle) * step;
    return false;
  }

  private pickWanderTarget() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.min(
      this.wanderRadius,
      WANDER_MIN_DISTANCE + Math.random() * Math.max(0, this.wanderRadius - WANDER_MIN_DISTANCE),
    );

    this.setTarget(
      this.sprite.x + Math.cos(angle) * distance,
      this.sprite.y + Math.sin(angle) * distance,
    );
  }

  private pickHarvestTarget() {
    const harvestTarget = this.pickHarvestTargetFn();

    if (harvestTarget) {
      this.setTarget(harvestTarget.x, harvestTarget.y);
    }
  }

  private pickRestTarget() {
    this.setTarget(this.restPoint.x, this.restPoint.y);
  }

  private pickBuildTarget() {
    const buildTarget = this.pickBuildTargetFn();

    if (buildTarget) {
      this.setTarget(buildTarget.x, buildTarget.y);
    }
  }

  private pickAttackTarget() {
    const attackTarget = this.pickAttackTargetFn();

    if (attackTarget) {
      this.setTarget(attackTarget.x, attackTarget.y);
    }
  }

  private pickFleeTarget() {
    const fleeTarget = this.pickFleeTargetFn();

    if (fleeTarget) {
      this.setTarget(fleeTarget.x, fleeTarget.y);
    }
  }

  private updateSurvival(deltaMs: number) {
    this.gameYearElapsedMs += deltaMs;

    while (this.gameYearElapsedMs >= GAME_YEAR_MS) {
      this.gameYearElapsedMs -= GAME_YEAR_MS;
      this.age += 1;

      if (this.age >= NATURAL_DEATH_AGE) {
        this.die();
        return;
      }
    }

    const deltaSeconds = deltaMs / 1000;

    if (this.stateMachine.state === 'Rest') {
      this.vitality = Phaser.Math.Clamp(
        this.vitality + VITALITY_REST_RECOVERY_PER_SECOND * deltaSeconds,
        0,
        this.maxVitality,
      );
      return;
    }

    this.vitality = Phaser.Math.Clamp(
      this.vitality - VITALITY_DRAIN_PER_SECOND * deltaSeconds,
      0,
      this.maxVitality,
    );

    if (this.vitality <= 0) {
      this.hp = Phaser.Math.Clamp(
        this.hp - HP_DRAIN_PER_SECOND_AT_ZERO_VITALITY * deltaSeconds,
        0,
        this.maxHp,
      );

      if (this.hp <= 0) {
        this.die();
      }
    }
  }

  private syncSpriteStyle() {
    const fillColorByState: Record<UnitState, number> = {
      Idle: 0xf4f4f4,
      Wander: 0x94b0c2,
      March: 0xffcd75,
      Harvest: 0x38b764,
      Build: 0xc0a080,
      Rest: 0x5b6ee1,
      Attack: 0xb13e53,
      Flee: 0xef7d57,
    };

    this.sprite.setFillStyle(fillColorByState[this.stateMachine.state], 1);
    this.sprite.setStrokeStyle(
      2,
      this.vitality < LOW_VITALITY_THRESHOLD ? 0xb13e53 : this.factionColor,
      0.95,
    );
    this.factionBadge.setPosition(this.sprite.x, this.sprite.y - 9);
  }

  private die() {
    if (this.dead) {
      return;
    }

    this.dead = true;
    this.target = undefined;
    this.factionBadge.destroy();
    this.sprite.setFillStyle(0x566c86, 1);
    this.sprite.setStrokeStyle(2, 0xb13e53, 0.95);

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 0.35,
      scaleY: 0.35,
      duration: 480,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.sprite.destroy();
      },
    });
  }

  private harvestResource() {
    return this.harvestResourceFn();
  }

  private hasBuildTask() {
    return this.hasBuildTaskFn();
  }

  private hasAttackTask() {
    return this.hasAttackTaskFn();
  }

  private hasFleeTask() {
    return this.hasFleeTaskFn();
  }

  private shouldHarvest() {
    return this.shouldHarvestFn();
  }

  private buildAtTarget(deltaMs: number) {
    return this.buildAtTargetFn(deltaMs);
  }

  private attackAtTarget(deltaMs: number) {
    return this.attackAtTargetFn(deltaMs);
  }
}
