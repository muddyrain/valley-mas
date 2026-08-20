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

  it('normalizes pointer coordinates and resets to the center outside the stage', () => {
    const bus = createPointerBus();
    bus.move(75, 25, { left: 25, top: 0, width: 100, height: 100 });
    expect(bus.frame).toMatchObject({ inside: true, x: 0.5, y: 0.25 });

    bus.reset();
    expect(bus.frame).toMatchObject({ inside: false, x: 0.5, y: 0.5 });
  });
});
