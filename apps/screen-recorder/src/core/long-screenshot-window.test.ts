import { describe, expect, it, vi } from 'vitest';
import { showLongScreenshotWindow } from './long-screenshot-window';

function createWindow(destroyed = false) {
  const showInactive = vi.fn();
  return {
    target: {
      isDestroyed: () => destroyed,
      showInactive,
    },
    showInactive,
  };
}

describe('showLongScreenshotWindow', () => {
  it('shows immediately without depending on a renderer paint event', () => {
    const fixture = createWindow();
    const beforeShow = vi.fn();

    showLongScreenshotWindow(fixture.target, beforeShow);

    expect(beforeShow).toHaveBeenCalledOnce();
    expect(fixture.showInactive).toHaveBeenCalledOnce();
  });

  it('does not show a window that was already destroyed', () => {
    const fixture = createWindow(true);

    showLongScreenshotWindow(fixture.target);

    expect(fixture.showInactive).not.toHaveBeenCalled();
  });
});
