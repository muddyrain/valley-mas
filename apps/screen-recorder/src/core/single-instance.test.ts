import { describe, expect, it, vi } from 'vitest';
import { createSecondInstanceActivation } from './single-instance';

describe('second instance activation', () => {
  it('shows the existing control window immediately when it is ready', () => {
    const show = vi.fn(() => true);
    const activation = createSecondInstanceActivation(show);
    activation.request();
    expect(show).toHaveBeenCalledOnce();
    expect(activation.hasPendingRequest()).toBe(false);
  });

  it('queues an early second launch and opens the control window after startup', () => {
    const show = vi.fn(() => false);
    const activation = createSecondInstanceActivation(show);
    activation.request();
    expect(activation.hasPendingRequest()).toBe(true);
    show.mockReturnValue(true);
    activation.flush();
    expect(show).toHaveBeenCalledTimes(2);
    expect(activation.hasPendingRequest()).toBe(false);
  });
});
