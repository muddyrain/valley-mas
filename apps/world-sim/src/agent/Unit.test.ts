import * as Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Unit } from './Unit';

function createMockScene() {
  const rectangle = {
    x: 0,
    y: 0,
    setStrokeStyle: vi.fn(),
    setDepth: vi.fn(),
    setFillStyle: vi.fn(),
    setAlpha: vi.fn(),
    setScale: vi.fn(),
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    destroy: vi.fn(),
  };
  const image = {
    x: 0,
    y: 0,
    setDepth: vi.fn(),
    setDisplaySize: vi.fn(),
    setTint: vi.fn(),
    setAlpha: vi.fn(),
    setScale: vi.fn(),
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    destroy: vi.fn(),
  };

  return {
    add: {
      rectangle: vi.fn((x: number, y: number) => ({
        ...rectangle,
        x,
        y,
      })),
      image: vi.fn((x: number, y: number) => ({
        ...image,
        x,
        y,
      })),
    },
    tweens: {
      add: vi.fn(({ onComplete }) => {
        onComplete?.();
      }),
    },
  } as unknown as Phaser.Scene;
}

function createUnit(overrides: Partial<ConstructorParameters<typeof Unit>[0]> = {}) {
  const scene = createMockScene();
  const restPoint = new Phaser.Math.Vector2(64, 64);

  const unit = new Unit({
    id: 'unit-1',
    scene,
    x: 24,
    y: 24,
    worldBounds: {
      left: 0,
      right: 160,
      top: 0,
      bottom: 160,
    } as unknown as Phaser.Geom.Rectangle,
    pickHarvestTarget: vi.fn(() => undefined),
    harvestResource: vi.fn(() => false),
    hasBuildTask: vi.fn(() => false),
    pickBuildTarget: vi.fn(() => undefined),
    buildAtTarget: vi.fn(() => false),
    restPoint,
    ...overrides,
  });

  return {
    scene,
    unit,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Unit state machine', () => {
  it('moves to a target and returns to Idle when the target is reached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unit } = createUnit();

    unit.moveTo(32, 24);
    expect(unit.state).toBe('March');

    unit.update(200);

    expect(unit.position).toEqual(new Phaser.Math.Vector2(32, 24));
    expect(unit.state).toBe('Idle');
  });

  it('forces a low-vitality unit into Rest and returns to Idle after recovery', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unit } = createUnit({ vitality: 20 });

    unit.update(1000);

    expect(unit.state).toBe('Rest');
    expect(unit.position).toEqual(new Phaser.Math.Vector2(64, 64));

    unit.update(7000);

    expect(unit.vitality).toBeGreaterThanOrEqual(80);
    expect(unit.state).toBe('Idle');
  });

  it('chooses build before harvest when an idle unit has a build task', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unit } = createUnit({
      hasBuildTask: vi.fn(() => true),
      pickBuildTarget: vi.fn(() => new Phaser.Math.Vector2(24, 24)),
      buildAtTarget: vi.fn(() => false),
    });

    unit.update(900);

    expect(unit.state).toBe('Build');
    expect(unit.targetPosition).toEqual(new Phaser.Math.Vector2(24, 24));
  });

  it('leaves Build when another unit already completed the build task', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const hasBuildTask = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const { unit } = createUnit({
      hasBuildTask,
      pickBuildTarget: vi.fn(() => new Phaser.Math.Vector2(24, 24)),
      buildAtTarget: vi.fn(() => false),
    });

    unit.update(900);
    expect(unit.state).toBe('Build');

    unit.update(100);

    expect(unit.state).toBe('Rest');
    expect(unit.targetPosition).toEqual(new Phaser.Math.Vector2(64, 64));
  });

  it('switches to Attack when an enemy is nearby and resolves the strike', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const attackAtTarget = vi.fn(() => true);
    const { unit } = createUnit({
      hasAttackTask: vi.fn(() => true),
      pickAttackTarget: vi.fn(() => new Phaser.Math.Vector2(40, 24)),
      attackAtTarget,
      hasFleeTask: vi.fn(() => false),
    });

    unit.update(900);

    expect(unit.state).toBe('Idle');
    expect(attackAtTarget).toHaveBeenCalled();
  });

  it('switches to Flee when hp falls below the combat threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const pickFleeTarget = vi.fn(() => new Phaser.Math.Vector2(24, 24));
    const { unit } = createUnit({
      hp: 19,
      pickFleeTarget,
      hasFleeTask: vi.fn(() => true),
      hasAttackTask: vi.fn(() => false),
    });

    unit.update(100);

    expect(unit.state).toBe('Flee');
    expect(pickFleeTarget).toHaveBeenCalled();
  });

  it('wanders instead of harvesting when the stockpile target is met', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unit } = createUnit({
      shouldHarvest: vi.fn(() => false),
    });

    unit.update(900);

    expect(unit.state).toBe('March');
    expect(unit.targetPosition).toEqual(new Phaser.Math.Vector2(60, 24));
  });

  it('keeps a faction color badge visible while state color changes', () => {
    const { scene, unit } = createUnit({
      factionColor: 0xb55945,
      shouldHarvest: vi.fn(() => false),
    });

    expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
    expect(unit.factionBadge.x).toBe(24);
    expect(unit.factionBadge.y).toBe(15);
    expect(unit.factionBadge.setFillStyle).not.toHaveBeenCalled();

    unit.moveTo(48, 24);
    unit.update(250);

    expect(unit.factionBadge.x).toBe(unit.position.x);
    expect(unit.factionBadge.y).toBe(unit.position.y - 9);
  });

  it('keeps optional unit art aligned with the movement hitbox', () => {
    const { scene, unit } = createUnit({
      unitTextureKey: 'm1-unit-human-male',
      shouldHarvest: vi.fn(() => false),
    });

    expect(scene.add.image).toHaveBeenCalledWith(24, 24, 'm1-unit-human-male');
    expect(unit.artSprite?.x).toBe(24);
    expect(unit.artSprite?.y).toBe(24);

    unit.moveTo(48, 24);
    unit.update(250);

    expect(unit.artSprite?.x).toBe(unit.position.x);
    expect(unit.artSprite?.y).toBe(unit.position.y);
  });

  it('uses a smaller wander radius for guard-style units', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { unit } = createUnit({
      shouldHarvest: vi.fn(() => false),
      wanderRadius: 32,
    });

    unit.update(900);

    expect(unit.targetPosition).toEqual(new Phaser.Math.Vector2(56, 24));
  });
});
