import { describe, expect, it, vi } from 'vitest';
import { scheduleWindowDestroy } from './window-lifecycle';

describe('window lifecycle', () => {
  it('acknowledges the caller before destroying a pinned window and destroys it only once', () => {
    const queued: Array<() => void> = [];
    let destroyed = false;
    const destroy = vi.fn(() => {
      destroyed = true;
    });

    scheduleWindowDestroy(
      {
        isDestroyed: () => destroyed,
        destroy,
      },
      (task) => queued.push(task),
    );

    expect(destroy).not.toHaveBeenCalled();
    expect(queued).toHaveLength(1);
    queued[0]?.();
    queued[0]?.();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
