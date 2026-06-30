import { afterEach, describe, expect, it, vi } from 'vitest';
import { withMinimumLoadingTime } from './loading';

describe('withMinimumLoadingTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps fast tasks pending until the minimum loading time passes', async () => {
    vi.useFakeTimers();
    let settled = false;
    const result = withMinimumLoadingTime(() => Promise.resolve('ok'), 250).then((value) => {
      settled = true;
      return value;
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe('ok');
    expect(settled).toBe(true);
  });

  it('does not delay tasks that already took longer than the minimum loading time', async () => {
    vi.useFakeTimers();
    const result = withMinimumLoadingTime(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('slow-ok'), 300);
        }),
      250,
    );

    await vi.advanceTimersByTimeAsync(300);
    await expect(result).resolves.toBe('slow-ok');
  });
});
