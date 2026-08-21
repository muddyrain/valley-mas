import { describe, expect, it } from 'vitest';
import { createPointerBus, createScrollBus } from './stageBus';

describe('stageBus', () => {
  it('publishes immutable scroll snapshots without replacing the mutable frame object', () => {
    const bus = createScrollBus();
    const frame = bus.frame;
    const snapshots: number[] = [];
    const unsubscribe = bus.subscribe(() => snapshots.push(bus.getSnapshot().scroll));

    bus.write({
      direction: 1,
      limit: 1200,
      progress: 0.25,
      scroll: 300,
      velocity: 18,
      viewportHeight: 800,
    });

    expect(bus.frame).toBe(frame);
    expect(bus.frame.scroll).toBe(300);
    expect(snapshots).toEqual([300]);
    unsubscribe();
  });

  it('normalizes pointer motion into a single immutable frame and resets outside the stage', () => {
    const bus = createPointerBus();
    const rect = { left: 25, top: 0, width: 100, height: 100 };
    bus.move(75, 25, rect, 1_000);
    expect(bus.frame).toMatchObject({
      deltaX: 0,
      deltaY: 0,
      inside: true,
      lastMoveAt: 1_000,
      sequence: 1,
      speed: 0,
      x: 0.5,
      y: 0.25,
    });

    bus.move(100, 50, rect, 1_016);
    expect(bus.frame).toMatchObject({
      deltaX: 0.25,
      deltaY: 0.25,
      inside: true,
      lastMoveAt: 1_016,
      sequence: 2,
      x: 0.75,
      y: 0.5,
    });
    expect(bus.frame.speed).toBeCloseTo(22.097, 2);

    bus.reset();
    expect(bus.frame).toMatchObject({
      deltaX: 0,
      deltaY: 0,
      inside: false,
      lastMoveAt: 0,
      sequence: 3,
      speed: 0,
      x: 0.5,
      y: 0.5,
    });
  });
});
