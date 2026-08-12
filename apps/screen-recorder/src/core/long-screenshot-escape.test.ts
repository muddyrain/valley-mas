import { describe, expect, it, vi } from 'vitest';
import { registerLongScreenshotEscape } from './long-screenshot-escape';

describe('long screenshot Escape shortcut', () => {
  it('cancels from Escape without focusing the inactive preview window', () => {
    const cancel = vi.fn();
    let handler: (() => void) | undefined;
    const register = vi.fn((_accelerator: string, callback: () => void) => {
      handler = callback;
      return true;
    });
    const unregister = vi.fn();

    const dispose = registerLongScreenshotEscape({ register, unregister }, cancel);
    expect(register).toHaveBeenCalledWith('Escape', expect.any(Function));

    handler?.();
    expect(cancel).toHaveBeenCalledOnce();

    dispose();
    expect(unregister).toHaveBeenCalledWith('Escape');
  });

  it('does not unregister a shortcut that failed to register', () => {
    const unregister = vi.fn();
    const dispose = registerLongScreenshotEscape({ register: () => false, unregister }, vi.fn());

    dispose();
    expect(unregister).not.toHaveBeenCalled();
  });
});
